
# import importlib

- Import python files anywhere

```python
import importlib.util

path = r'D:\this_code\test\我的笔记\linx-zhang.github.io\scripts\generate_menu.py'

spec = importlib.util.spec_from_file_location(
    name="give_me_module_name",
    location=path,
)
menu_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(menu_module)

# Now, import ...generate_menu, menu_module == generate_menu
GenMenu=menu_module.GenMenu
GenMenu().overwrite()

```