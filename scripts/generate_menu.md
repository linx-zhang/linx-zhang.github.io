
```python
import os
import re


class GenMenu:
    DIR_PATH = r"D:\this_code\test\我的笔记\linx-zhang.github.io"  # os.path.abspath('..')
    INDEX_PATH = os.path.join(DIR_PATH, "index.html")

    GITHUB_URL = "https://linx-zhang.github.io/"
    FOLDER_ICON = '<img src="./static/icon/folder.png" >'
    FILE_ICON = '<img src="./static/icon/file_icon.png" >'

    IGNORE_DIR = [
        ".git",
        "static",
        "scripts/__pycache__/",
    ]

    INDEX_UL_PATTERN = re.compile("<ul>(.*?)</ul>", re.DOTALL)
    DIRECTORY_INDENT = "&nbsp;" * 8
    LINE_INDENT = " " * 4

    def __init__(self) -> None:
        self.prefix = set()
        self.pass_dirs = set()
        self.write_content = ["\n"]
        self._pass_dirs()

    def _pass_dirs(self):
        for dir_item in self.IGNORE_DIR:
            root_dir = os.path.join(self.DIR_PATH, *filter(None, dir_item.split("/")))
            self.pass_dirs.add(root_dir)
            self.pass_dirs |= {
                os.path.join(r, d) for r, dir_s, _ in os.walk(root_dir) for d in dir_s
            }

    def overwrite(self):
        self.walk()
        with open(self.INDEX_PATH, "r", encoding="utf8") as fr:
            index_content = fr.read()
        old_content = self.INDEX_UL_PATTERN.findall(index_content).pop()
        new_content = self.LINE_INDENT.join(self.write_content)
        content = index_content.replace(old_content, new_content)
        with open(self.INDEX_PATH, "w", encoding="utf8") as fw:
            fw.write(content)

    def walk(self):
        len_dir_path = len(self.DIR_PATH)
        for r, d, f in os.walk(self.DIR_PATH):
            if (r in self.pass_dirs) or not f:
                continue
            for file in f:
                filepath = os.path.join(r[len_dir_path:], file)
                self.deduplicate(filepath)

    def deduplicate(self, filepath: str, sep: str = os.path.sep):
        uri_list = filepath.strip(sep).split(sep)
        if (len_uri_list := len(uri_list)) == 1:
            return

        for idx, uri in enumerate(uri_list, start=1):
            full_path = "".join(uri_list[:idx])
            if full_path in self.prefix:
                continue
            self.prefix.add(full_path)

            indent = self.DIRECTORY_INDENT * (idx - 1)
            if idx == len_uri_list:
                href = self.GITHUB_URL + "/".join(uri_list)
                href = href.rsplit(".", 1)[0]
                a_html = f'<li><a href="{href}">{indent}{self.FILE_ICON}{uri}</a></li>'
            else:
                a_html = f"<li>{indent}{self.FOLDER_ICON}{uri}</li>"
            self.write_content.append(a_html + "\n")


class SynchronizeScript:
    SCRIPTS_PATH = os.path.join(GenMenu.DIR_PATH, "scripts")
    SCRIPT_LIST = [
        "generate_menu.py",
    ]

    @classmethod
    def sync(cls):
        cls.to_md()
        cls.to_html()

    @classmethod
    def to_md(cls):
        for script in cls.SCRIPT_LIST:
            original = os.path.join(cls.SCRIPTS_PATH, script)
            with open(original, "r", encoding="utf8") as fr:
                script_content = fr.read()

            md = original[: -len(script.rsplit(".", 1).pop())] + "md"
            with open(md, "w", encoding="utf8") as fw:
                fw.write("\n```python\n")
                fw.write(script_content)
                fw.write("\n```\n")

    @classmethod
    def to_html(cls):
        pass


GenMenu().overwrite()
SynchronizeScript.sync()

```
