# 边遍历目录边流式生成 tar

在后台线程里边遍历目录边生成未压缩的 tar 流，通过有界队列交给调用方逐块消费。

## 概览

| 名称 | 作用 | 关键参数 |
| --- | --- | --- |
| `TarQueueWriter` | 把 tar 字节按块写入队列的 `fileobj` 适配器 | `q`、`chunk_size` |
| `.write` / `.flush` | 攒满一块就入队；flush 推入剩余字节 | `b: bytes` |
| `stream_tar_directory` | 生成器：后台线程打包，主线程逐块 `yield` | `dir_path`、`chunk_size=1 MiB`、`q_maxsize=16` |

## 依赖与上下文

- 仅标准库：`threading`、`tarfile`、`os`、`pathlib`、`queue`，不依赖 Django 或项目内模块。
- 全仓库搜索无调用方；推断可作 `StreamingHttpResponse` 的数据源，但当前未接入。

## 核心逻辑

1. `resolve()` 后校验 `is_dir()`，否则抛 `FileNotFoundError`。
2. 建 `Queue(maxsize=q_maxsize)`、`error` 列表与 `SENTINEL`，启动 daemon 线程。
3. `tarfile.open(mode="w|")` 流式写；`os.walk` 只取文件，`arcname` 用相对路径并把 `\` 换成 `/`，`mtime` 由 `stat()` 覆盖后 `addfile`。
4. 正常或异常路径都 `close` + `flush`，异常存入 `error`，最后 `q.put(SENTINEL)`。
5. 主线程 `q.get` 后 `yield`，遇 `SENTINEL` 退出；`finally` 中 `join(10s)`，有异常则重抛（客户端断开的两类异常除外）。

关键边界：

- 空目录会产出合法的空 tar。
- 中途失败时部分数据已发出，随后才抛异常。
- 队列满会阻塞写入形成背压；消费端提前退出时线程可能滞留，靠 daemon 随进程退出。

## 要点 / 坑

- 不压缩：`w|` 产出纯 tar，无 gzip。
- 无顶层目录、不保留空目录：只打包文件，`arcname` 相对源目录。
- 不确定性：条目顺序依赖 `os.walk`，元信息不完全可控；软链接/特殊文件行为未显式处理（待确认）。
- 内存约 `chunk_size × (q_maxsize + 1)`，默认约 16 MiB 级。
- 错误在 `SENTINEL` 后才抛出，HTTP 状态码可能已发出。
- `BrokenPipeError` / `ConnectionResetError` 被有意吞掉。
- `close` / `flush` 各调两次，第二次为空操作。
- `write` 不返回字节数；隐藏文件、临时文件也会被打包（不做过滤）。

## 完整源码

```python
# tar_gen.py
import threading
import tarfile
import os
from pathlib import Path
from typing import Generator
from queue import Queue


class TarQueueWriter:
    """极简自定义writer，只实现write，供tarfile使用，不需要seek/tell"""
    def __init__(self, q: Queue, chunk_size: int):
        self.q = q
        self.chunk_size = chunk_size
        self.buffer = b""

    def write(self, b: bytes):
        self.buffer += b
        # 攒够块大小丢入队列
        while len(self.buffer) >= self.chunk_size:
            send_chunk = self.buffer[:self.chunk_size]
            self.buffer = self.buffer[self.chunk_size:]
            self.q.put(send_chunk)

    def flush(self):
        # 把剩余残留buffer推到队列
        if self.buffer:
            self.q.put(self.buffer)
            self.buffer = b""


def stream_tar_directory(dir_path: str, chunk_size=1024*1024, q_maxsize=16) -> Generator[bytes, None, None]:
    """
    流式打包目录为 tar（不压缩）
    :param dir_path: 源目录
    :param chunk_size: 输出块大小
    :param q_maxsize: 队列最大缓存块数，背压，限制内存上限
    """
    dir_path = Path(dir_path).resolve()
    if not dir_path.is_dir():
        raise FileNotFoundError(f"目录不存在: {dir_path}")

    q: Queue[bytes | None] = Queue(maxsize=q_maxsize)
    error: list[BaseException] = []
    SENTINEL = None

    def _tar_worker():
        tw = None
        tar = None
        try:
            tw = TarQueueWriter(q, chunk_size)
            # w| 代表：流式写，不压缩（|=stream模式）
            tar = tarfile.open(mode="w|", fileobj=tw)

            for root, _, files in os.walk(dir_path):
                for fname in files:
                    fpath = Path(root) / fname
                    # tar内路径，统一正斜杠
                    arcname = str(fpath.relative_to(dir_path)).replace("\\", "/")
                    stat = fpath.stat()

                    # 创建tarinfo，填充元信息
                    tarinfo = tar.gettarinfo(fpath, arcname=arcname)
                    tarinfo.mtime = stat.st_mtime
                    # 读文件写入tar流
                    with open(fpath, "rb") as f:
                        tar.addfile(tarinfo, f)

            tar.close()
            tw.flush()
        except BaseException as e:
            error.append(e)
        finally:
            if tar is not None:
                try:
                    tar.close()
                except Exception:
                    pass
            if tw is not None:
                try:
                    tw.flush()
                except Exception:
                    pass
            # 发送结束标记
            q.put(SENTINEL)

    t = threading.Thread(target=_tar_worker, daemon=True)
    t.start()

    try:
        while True:
            item = q.get(block=True)
            if item is SENTINEL:
                break
            yield item
    finally:
        t.join(timeout=10)
        if error:
            exc = error[0]
            # 客户端断开连接属于正常
            if not isinstance(exc, (BrokenPipeError, ConnectionResetError)):
                raise exc
```
