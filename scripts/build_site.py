import os
import re
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set


def find_repository_root(target_name: str = "linx-zhang.github.io") -> Path:
    """递归向上或当前目录搜索指定的仓库根目录，未找到则回退到上一级目录。"""
    current_dir = Path.cwd().resolve()
    for root, dirs, _ in os.walk(current_dir):
        if target_name in dirs:
            return Path(root) / target_name
    return current_dir.parent


PROJECT_ROOT: Path = find_repository_root()


class SiteIndexBuilder:
    """扫描项目结构并生成/更新 index.html 中的站点导航目录列表。"""

    GITHUB_BASE_URL: str = "https://linx-zhang.github.io/"
    FOLDER_ICON: str = '<img src="./static/icon/folder.png" >'
    FILE_ICON: str = '<img src="./static/icon/file_icon.png" >'

    IGNORE_DIR_NAMES: Set[str] = {".git", ".idea", "static", "__pycache__"}
    EXCLUDED_FILE_SUFFIXES: Set[str] = {".go", ".py"}

    DIRECTORY_INDENT: str = "&nbsp;" * 8
    LINE_INDENT: str = " " * 4
    UL_REGEX: re.Pattern = re.compile(r"<ul>(.*?)</ul>", re.DOTALL)

    def __init__(self, root_dir: Path = PROJECT_ROOT) -> None:
        self.root_dir = root_dir
        self.index_file = self.root_dir / "index.html"
        self.visited_prefixes: Set[str] = set()
        self.html_entries: List[str] = ["\n"]

    def build_and_overwrite(self) -> None:
        """执行目录遍历并覆写 index.html。"""
        self._traverse_directory()
        if not self.index_file.exists():
            print(f"[Warning] Index file not found at: {self.index_file}")
            return

        index_content = self.index_file.read_text(encoding="utf-8")
        match = self.UL_REGEX.search(index_content)
        if not match:
            print("[Warning] No <ul>...</ul> tags found in index.html to replace.")
            return

        old_ul_content = match.group(1)
        new_ul_content = self.LINE_INDENT.join(self.html_entries)
        updated_content = index_content.replace(old_ul_content, new_ul_content, 1)

        self.index_file.write_text(updated_content, encoding="utf-8")
        print(f"[Success] Updated navigation in {self.index_file}")

    def _traverse_directory(self) -> None:
        for current_root, dir_names, file_names in os.walk(self.root_dir):
            # 原地过滤无需扫描的目录，提升遍历性能
            dir_names[:] = [d for d in dir_names if d not in self.IGNORE_DIR_NAMES]

            if not file_names:
                continue

            for file_name in file_names:
                file_path = Path(current_root) / file_name
                if file_path.suffix in self.EXCLUDED_FILE_SUFFIXES:
                    continue

                rel_path = file_path.relative_to(self.root_dir)
                self._record_path_entry(rel_path)

    def _record_path_entry(self, rel_path: Path) -> None:
        parts = rel_path.parts
        if len(parts) <= 1:
            return

        for depth, part in enumerate(parts, start=1):
            sub_path = "/".join(parts[:depth])
            if sub_path in self.visited_prefixes:
                continue
            self.visited_prefixes.add(sub_path)

            indent = self.DIRECTORY_INDENT * (depth - 1)
            is_file = depth == len(parts)

            if is_file:
                # 链接去除末尾后缀
                href_path = "/".join(parts)
                href = f"{self.GITHUB_BASE_URL}{href_path.rsplit('.', 1)[0]}"
                html = f'<li><a href="{href}">{indent}{self.FILE_ICON}{part}</a></li>'
            else:
                html = f"<li>{indent}{self.FOLDER_ICON}{part}</li>"

            self.html_entries.append(f"{html}\n")


class ScriptMarkdownExporter:
    """智能转换脚本文件为带有语法高亮代码块的 Markdown 文件。"""

    # 扩展名到 Markdown 语法高亮标签映射
    LANGUAGE_MAP: Dict[str, str] = {
        ".py": "python",
        ".go": "go",
        ".sh": "bash",
        ".bash": "bash",
        ".js": "javascript",
        ".ts": "typescript",
        ".rs": "rust",
        ".cpp": "cpp",
        ".c": "c",
        ".java": "java",
        ".rb": "ruby",
        ".sql": "sql",
    }

    # 默认自动扫描脚本的目录
    DEFAULT_SCAN_DIRS: List[str] = ["scripts", "python"]

    def __init__(self, root_dir: Path = PROJECT_ROOT) -> None:
        self.root_dir = root_dir

    def export(
        self,
        explicit_scripts: Optional[Iterable[str]] = None,
        auto_scan: bool = True,
    ) -> None:
        """导出指定的脚本文件，或自动扫描支持的脚本生成 Markdown。"""
        target_files: Set[Path] = set()

        # 1. 添加显式指定的文件
        if explicit_scripts:
            for rel_str in explicit_scripts:
                target_path = self.root_dir / rel_str
                if target_path.exists():
                    target_files.add(target_path)
                else:
                    print(f"[Warning] Specified script not found: {target_path}")

        # 2. 自动扫描常规脚本目录中的代码文件
        if auto_scan:
            for folder_name in self.DEFAULT_SCAN_DIRS:
                folder_path = self.root_dir / folder_name
                if not folder_path.is_dir():
                    continue
                for file_path in folder_path.rglob("*"):
                    if (
                        file_path.is_file()
                        and file_path.suffix in self.LANGUAGE_MAP
                        and "__pycache__" not in file_path.parts
                    ):
                        target_files.add(file_path)

        # 3. 执行转换
        for script_file in sorted(target_files):
            self._convert_single_script(script_file)

    def _convert_single_script(self, script_path: Path) -> None:
        try:
            code_content = script_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            print(f"[Error] Failed to read text from {script_path}, skipping.")
            return

        lang = self.LANGUAGE_MAP.get(script_path.suffix, "")
        md_file = script_path.with_suffix(".md")

        md_content = f"```{lang}\n{code_content}\n```\n"
        md_file.write_text(md_content, encoding="utf-8")
        print(f"[Exported] {script_path.name} -> {md_file.name}")


if __name__ == "__main__":
    # 1. 生成并覆盖导航菜单
    SiteIndexBuilder().build_and_overwrite()

    # 2. 智能导出脚本为 Markdown（自动识别 scripts/ 与 python/ 目录下的脚本与代码高亮）
    ScriptMarkdownExporter().export()