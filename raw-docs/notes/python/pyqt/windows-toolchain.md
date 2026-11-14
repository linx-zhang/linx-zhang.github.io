# Windows 上做 PyQt 桌面应用的工具链

这串东西——Qt、Visual Studio、CMake、NSIS/nsi——不是给「写代码」用的，而是**把一个 PyQt/PySide 桌面应用编译、打包、做成 Windows 安装包**的完整链条。判断依据很简单：`NSIS` 只出现在「要交付一个可安装的 exe」的场景，写插件用不到它。

各管一段：

- **Qt**：运行时库 + Qt Designer（拖界面，产出 `.ui`，再用 `pyuic` 转成 Python）。装的是开源版（`Qt5/Qt6` + MSVC 版），版本要和 PyQt 的绑定版本对上。
- **Visual Studio（MSVC）**：提供 Windows 的 C++ 编译器与运行库。只装「使用 C++ 的桌面开发」工作负载就够，Python 本身不需要它，但 `Qt` 的 MSVC 二进制、以及要编译的 C++ 扩展需要。
- **CMake**：Qt 官方二进制是 CMake 工程，编 Qt 插件（Designer 自定义控件）或有 C++ 扩展时要它；纯 Python 打包用不到。
- **NSIS + `.nsi` 脚本**：把 `PyInstaller` 打出的目录做成安装包——写入 Program Files、创建快捷方式、注册卸载项。`.nsi` 就是那份安装脚本。

所以顺序是：Qt/Designer 做界面 → PyInstaller 打成 `onedir` → NSIS 用 `.nsi` 包成 `setup.exe`。

只有一种例外：如果目标只是**给 Qt Designer 写一个自定义控件插件**（`.dll` 放进 `designer/plugins`），那链条到 CMake 就结束，不需要 NSIS。

> 这点当初记漏了：见到 `NSIS` 就说明交付物是「安装包」，也就是一个完整应用，而不是插件。
