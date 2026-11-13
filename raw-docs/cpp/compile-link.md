# 静态库与动态库：编译、链接、加载三段到底发生了什么

C/C++ 里「编译链接」这四个字经常被当成一条流水线，其实它是**三段**：编译（compile）、链接（link）、加载（load）。静态库与动态库的差别，不在于编译，而在于**代码在第三段（加载）由谁负责搬到内存**。

- 静态库：链接阶段把代码**复制**进可执行文件，运行时不依赖外部文件。
- 动态库：链接阶段只留一个「引用」，真正的代码在**加载阶段**由动态链接器（Linux 的 `ld-linux.so`、Windows 的 loader）映射进进程地址空间。

## 编译：只产出目标文件，不管别人在哪

每个 `.c/.cpp` 单独编译成 `.o/.obj`，这一步只保证**语法**和**当前翻译单元**内的完整性。函数调用被编译成一个未解析符号（例如 `call strlen@PLT`），地址先空着。编译器此时不知道 `strlen` 是静态库里的、动态库里的，还是根本没有。

所以「头文件找得到、编译通过、链接报错」是常态，两件事分属不同阶段。

```bash
# 只编译，不链接
gcc -c util.c -o util.o
# 看一眼这个 .o 需要别人提供什么符号
nm -u util.o
```

`nm -u` 列出的是 `U`（undefined）：这些符号必须在链接阶段被别人补上；`T` 是本文件导出的函数，`t` 是内部的，`D/B` 是数据段。

## 链接：静态库是「拷贝」，动态库是「登记」

静态链接时，链接器把 `.a/.lib` 里被用到的 `.o` **抽出来塞进最终产物**，地址当场算死。所以 `nm` 看静态链接出来的可执行文件，符号是 `T`——代码已经在里面了。

```bash
gcc main.o util.o -o app_static        # 直接给 .o
gcc main.o -L. -lutil -o app_static    # 或给 libutil.a
```

动态链接时，链接器只在产物里写一条依赖：库名 + 需要的符号表，地址留给运行时。Linux 上最终产物里的符号表现为 `U`，配合 `readelf -d` 能看到 `NEEDED libutil.so`。

```bash
gcc main.o -L. -lutil -o app_shared    # libutil.so
ldd app_shared                          # 列出运行时真正会加载的库
readelf -d app_shared | grep NEEDED
```

链接顺序很关键：`-lA -lB` 时，先被扫描的库先满足符号。同一个符号在两个静态库里都有定义，第二个库的那份**不会**被拉进来，也不报错——这是排查「改了 A 库怎么没生效」的第一嫌疑。

## 加载：动态库在这一步才真正出现

动态链接器按 `DT_RPATH` → 环境变量 `LD_LIBRARY_PATH` → `DT_RUNPATH` → `/etc/ld.so.cache` → 默认目录的顺序找库。找不到就是那个经典报错：

```
error while loading shared libraries: libutil.so.1: cannot open shared object file
```

排查顺序固定：`ldd ./app` 看它找的是哪个路径 → `readelf -d` 看 `RUNPATH` → 确认 `ldconfig -p | grep libutil` 里有没有缓存。

Windows 侧的顺序是：可执行文件所在目录 → 系统目录 → `PATH`。所以「在我机器上能跑」大多是把 DLL 丢在了 exe 旁边。

## 什么时候选哪个

| 维度 | 静态库 | 动态库 |
|---|---|---|
| 发布 | 单文件，无依赖，最省心 | 需要连库一起发，或依赖系统已有版本 |
| 升级 | 必须重新链接整个程序 | 换 `.so/.dll` 即可，程序不用动 |
| 体积 | 每个程序各带一份，多程序重复 | 内存里只映射一份，多个进程共享 |
| 启动 | 无额外开销 | 首次加载有符号解析成本（可用 `-Wl,-z,now` 提前绑定） |
| 冲突 | 符号在链接期就定死，行为确定 | 符号在运行期解析，可能出现「版本串味」 |

工程上常见的组合：**内部模块用静态库**（链接期就能发现符号缺失、避免一堆 `.so` 的加载顺序问题），**对外接口或需要热替换的部分用动态库**（插件、驱动、需要 ABI 稳定的公共组件）。

## 几个反复踩到的坑

**1. 动态库导出不全**。Linux 默认导出所有非 `static` 符号，Windows 必须显式 `__declspec(dllexport)`，否则链接时报 `unresolved external symbol`，而符号在 DLL 里明明存在。用 `dumpbin /exports xxx.dll` 核对。

**2. 忘了 `-fPIC`**。把非 PIC 的目标文件链进 `.so`，在 x86_64 上直接报 `relocation R_X86_64_32S against ... can not be used when making a shared object; recompile with -fPIC`。静态库可以不带，但它一旦被链进 `.so`，就得重编。

**3. 静态库重复定义**。两个静态库各自带了一份同名实现（比如都内置了 zlib），链接时报 `multiple definition`。要么只留一份，要么把它改成动态库让运行期共享。

**4. CRT / 运行库混用（Windows）**。`/MT` 编出来的静态库和 `/MD` 编出来的主程序混用，会出现在这个堆上申请、在那个堆上释放，表现为随机崩溃。全工程统一运行库选项是硬约束。

**5. 符号可见性**。`-fvisibility=hidden` 能把内部符号藏起来，减少符号冲突，但要求你显式标出对外 API（`__attribute__((visibility("default")))`）。默认全导出时，两个库有同名内部函数就会互相串。

**6. 版本号与 SONAME**。`.so.1` 这种版本后缀靠 `SONAME` 维持，改了 ABI 就要改 SONAME，否则老程序会加载到新库直接崩。`readelf -d libutil.so.1 | grep SONAME` 是核对手段。

## 一句话记忆

编译只管当前文件，链接管「谁提供符号、地址算不算死」，加载管「库从哪个路径来」。**静态 = 链接期拷进来，动态 = 加载期找进来**。遇到问题先确定它发生在哪一段，再对症：`nm` 看符号、`ldd/readelf -d` 看依赖、`LD_DEBUG=libs` 看重定位过程。
