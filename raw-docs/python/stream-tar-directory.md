# transfer.py：把目录流式打包为 tar

`transfer.py` 是一个只依赖 Python 标准库的小工具：在后台线程里边遍历目录边生成未压缩的 tar 字节流，通过有界队列交给调用方逐块消费，适合把目录内容边打包边下发的场景。

## 概览

| 名称 | 作用 | 关键参数 |
| --- | --- | --- |
| `TarQueueWriter` | 极简 `fileobj` 适配器，只实现 `write` / `flush`，把 tarfile 写入的字节按固定块大小塞进队列 | `q: Queue`、`chunk_size: int` |
| `TarQueueWriter.write(b)` | 累积字节，攒满 `chunk_size` 就切块入队，剩余不足一块的留在 `buffer` | `b: bytes` |
| `TarQueueWriter.flush()` | 把 `buffer` 里的残留字节作为最后一块入队并清空 | 无 |
| `stream_tar_directory(dir_path, chunk_size=1024*1024, q_maxsize=16)` | 生成器：后台线程打包目录，主线程从队列取块并 `yield` | `dir_path` 源目录；`chunk_size` 单块字节数；`q_maxsize` 队列容量（背压上限） |

## 依赖与上下文

- **依赖**：仅标准库 `threading`、`tarfile`、`os`、`pathlib.Path`、`typing.Generator`、`queue.Queue`；不依赖 Django、models、serializers 或本项目其它模块。
- **位置**：`aap/apps/analytics/services/transfer.py`，但文件首行注释写的是 `# tar_gen.py`，文件名与内部注释不一致，推测是从独立脚本演进而来（待确认）。
- **调用方**：在 `aap4-backend` 全仓库搜索 `stream_tar_directory`、`services.transfer` 等引用，除了本文件自身没有任何命中，说明当前没有被任何视图、任务或服务 import。
- **可能的接入方式（推断）**：作为 `StreamingHttpResponse` 的数据源逐块输出。仓库中确实存在同类“生成器 + 流式响应”的写法（如 `apps/api/rest_views/stats.py` 的 `sp` action 用 `StreamingHttpResponse(generate())` 输出二进制块），但那段代码并没有使用本模块，不能视为真实调用链。

## 核心逻辑

按执行顺序：

1. **路径校验**：`Path(dir_path).resolve()` 后检查 `is_dir()`；不是目录就抛 `FileNotFoundError`（即使路径存在但类型不是目录，也用同一个异常）。
2. **准备通道**：创建 `Queue(maxsize=q_maxsize)`、错误收集列表 `error`，以及结束标记 `SENTINEL = None`。
3. **启动后台线程**（`daemon=True`），核心步骤：
   - 构造 `TarQueueWriter(q, chunk_size)`；
   - 以 `tarfile.open(mode="w|", fileobj=tw)` 打开流式、不压缩的 tar（`w|` 表示顺序写、不可回退，不需要 `seek` / `tell`）；
   - `os.walk(dir_path)` 只遍历文件（不单独处理目录条目）；
   - 对每个文件：`arcname = 相对路径 + 反斜杠转正斜杠`，`tar.gettarinfo(fpath, arcname=arcname)` 生成元信息，再用 `stat().st_mtime` 覆盖 `tarinfo.mtime`，最后 `tar.addfile(tarinfo, 文件对象)` 写入数据；
   - 正常结束后 `tar.close()` 并 `tw.flush()`；
   - 捕获 `BaseException` 存入 `error`，`finally` 里再兜底 `close()` / `flush()`（各自 try/except 忽略异常），最后 `q.put(SENTINEL)` 通知消费者结束。
4. **主线程消费**：循环 `q.get(block=True)`，遇到 `SENTINEL` 退出，否则 `yield` 数据块。
5. **收尾**：生成器 `finally` 中 `t.join(timeout=10)`；若 `error` 非空，取第一个异常，`BrokenPipeError` / `ConnectionResetError` 视为客户端断开而忽略，其它异常重新抛出。

关键分支与边界：

- 目录为空时会产出一个只有 tar 结束块的合法空归档。
- 打包中途读文件失败：已经 `yield` 过的块无法撤回，消费者会先收到部分数据，等 `SENTINEL` 后收到异常。
- 队列满时后台线程会阻塞在 `q.put`，形成背压，避免无限占用内存。
- 消费端提前停止迭代时，生成器 `finally` 只等待线程 10 秒；若线程仍阻塞在入队，会作为 daemon 线程滞留。

## 要点 / 坑

- **不压缩**：`mode="w|"` 产出纯 tar，压缩需由上层另行处理（代码里没有 gzip 逻辑）。
- **归档没有顶层目录**：`arcname` 相对 `dir_path` 计算，解包后文件直接铺在目标目录，不会多出一层源目录名。
- **不保留空目录**：只遍历 `files`，目录本身不会写入 tar。
- **元信息不完全可控**：`mtime` 被显式覆盖，但 `uid/gid/uname/gname` 等由 `gettarinfo` 填充；条目顺序依赖 `os.walk`，因此同一目录多次打包的字节不保证完全一致。
- **符号链接与特殊文件**：代码没有显式处理软链接、设备文件等，行为取决于 `tarfile.gettarinfo` 与 `open` 的默认语义，边界情况待确认。
- **内存上限**：大致是 `chunk_size × (q_maxsize + 1)` 加上 tarfile 内部缓冲（默认 1 MiB × 16 队列块，约 16 MB 级别），由队列容量控制。
- **错误传播时机**：异常在消费者收到 `SENTINEL` 之后才抛出，可能已经写出部分字节，HTTP 响应无法再改状态码。
- **客户端断开**：`BrokenPipeError` / `ConnectionResetError` 被有意吞掉，避免断开连接时刷错误日志。
- **线程收尾**：`join(timeout=10)` 不是无限等待；消费端提前关闭生成器时，后台线程可能仍卡在 `q.put`，靠 daemon 属性随进程退出。
- **重复收尾是幂等的**：`tar.close()` 与 `tw.flush()` 在 `try` 和 `finally` 中都调用了一次，第二次为空操作，用来兜底异常路径。
- **`write` 无返回值**：`TarQueueWriter.write` 只入队不返回字节数，依赖 `tarfile` 流式写入时不检查返回值。
- **不做任何过滤**：隐藏文件、临时文件、缓存文件都会被原样打包，调用方需要自己保证目录内容干净。

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
