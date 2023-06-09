
# Find chinese-character Tool

- [Find-chinese-character.zip (win-x86-64.exe)](https://github.com/linx-zhang/static/blob/main/tools/find_cn_character.zip)
- Source code execution, Requires a python environment
- `Find.open_file_check.zh_pattern` can be customized
- [output`zh.json`](http://m.qpic.cn/psc?/V52HCgKy0b7Yhv1a5Lcc2Cuwq53oINm3/ruAMsa53pVQWN7FLK88i5sQRKXyjssey5bD0sGgNn76ogLYakfOhyO2XOx4OqsgDnr4xYowKZhPpWgic3vp7t5cuLM3uktjk2DagtcUwP*A!/b&bo=GgSdAgAAAAADB6M!&rf=viewer_4)

```python

import os
import sys
import re
import json
import time
from collections import defaultdict
from functools import lru_cache

sys.path.append(os.path.abspath(__file__))


SCAN_DIR = r"D:\this_code\test\我的笔记\linx-zhang.github.io"
# SCAN_DIR = input('Input Scan Folder, please:')
RESULTS_FILE = os.path.join(SCAN_DIR, "zh.json")
PASS_DIRS = [
    ".git",
    ".vscode",
    ".idea",
    # "scripts",
]


class Find:
    def __init__(self) -> None:
        self.init()

        results_dict = defaultdict(list)
        for root, dirs, files in os.walk(SCAN_DIR):
            if root in self.pass_dirs():
                continue
            for f in files:
                try:
                    self.open_file_check(os.path.join(root, f), results_dict)
                except Exception:  # noqa
                    continue
        with open(RESULTS_FILE, "w") as fw:
            fw.write(json.dumps(results_dict, indent=2))

    def init(self):

        global SCAN_DIR
        global RESULTS_FILE
        global PASS_DIRS

        SCAN_DIR = input("Input Scan Folder, please:")
        RESULTS_FILE = os.path.join(SCAN_DIR, "zh.json")

    @staticmethod
    def open_file_check(
        file: str, results: defaultdict, zh_pattern=re.compile("[\u4e00-\u9fa5]+")
    ):
        with open(file, "r", encoding="utf8") as fr:
            for index, line in enumerate(iter(fr.readline, "")):
                if zh_pattern.search(line):
                    results[file[len(SCAN_DIR) :]].append(index + 1)

    @staticmethod
    @lru_cache()
    def pass_dirs():
        dir_set = set()

        for dir_item in PASS_DIRS:
            root_dir = os.path.join(SCAN_DIR, *filter(None, dir_item.split("/")))
            dir_set.add(root_dir)
            dir_set |= {
                os.path.join(r, d) for r, dir_s, _ in os.walk(root_dir) for d in dir_s
            }
        return dir_set


if __name__ == "__main__":
    t = time.time()

    while True:
        try:
            Find()
        except Exception as e:
            print(e)
        else:
            break

    print("Took", time.time() - t, "seconds")
    print("Results file:", RESULTS_FILE)
    input()

```