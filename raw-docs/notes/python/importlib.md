# 用 importlib 从任意路径导入模块

- Import python files anywhere

```python

import importlib.util


def get_module(py_path):
    spec = importlib.util.spec_from_file_location(
        name="give_me_module_name",
        location=py_path,
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


path = r"F:\project\py_test\linx-zhang.github.io\scripts\generate_menu.py"
menu_module = get_module(path)

path = r"F:\project\py_test\linx-zhang.github.io\python\algorithm\flatten-dict-paths.py"
tree_module = get_module(path)

```