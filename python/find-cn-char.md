# Find chinese-character
- `Find.open_file_check.zh_pattern` can be customized
- output `zh.json`
- [output.png](https://github.com/linx-zhang/static/blob/main/python/15f5f8ed-110b-48e2-b4a9-e5dca9a13e30.png?raw=true)


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
RESULTS_FILE = os.path.join(SCAN_DIR, "zh.json")
PASS_DIRS = [
    ".git",
    ".vscode",
    ".idea",
    # "scripts",
]


class Find:
    def __init__(self) -> None:
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

    print("Scan dir:", SCAN_DIR)
    t = time.time()

    Find()

    print("Took", time.time() - t, "seconds")
    print("Results file:", RESULTS_FILE)

```