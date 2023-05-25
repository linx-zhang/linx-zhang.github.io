
import os


class GenMenu:
    DIR_PATH = r"D:\this_code\test\我的笔记\linx-zhang.github.io"
    # DIR_PATH = os.path.abspath('..')
    IGNORE_DIR = {".git"}

    GITHUB_URL = "https://linx-zhang.github.io/"
    DIRECTORY_INDENTATION = " " * 6

    def __init__(self) -> None:
        self.prefix = set()
        self.write_obj = open('menu.html', 'w')
        self.pass_dirs = self.pass_dirs()

    def pass_dirs(self):
        dir_set = set()

        for dir_item in self.IGNORE_DIR:
            root_dir = os.path.join(self.DIR_PATH, *filter(None, dir_item.split("/")))
            dir_set.add(root_dir)
            dir_set |= {
                os.path.join(r, d) for r, dir_s, _ in os.walk(root_dir) for d in dir_s
            }
        return dir_set

    def walk(self):
        len_dir_path = len(self.DIR_PATH)
        for r, d, f in os.walk(self.DIR_PATH):
            if (r in self.pass_dirs) or not f:
                continue
            for file in f:
                filepath = os.path.join(r[len_dir_path:], file)
                self.deduplicate(filepath)
        self.write_obj.close()

    def deduplicate(self, filepath):
        sep = os.path.sep
        uri_list = filepath.strip(sep).split(sep)
        if len(uri_list) == 1:
            return

        for idx, value in enumerate(uri_list):
            uri = self.DIRECTORY_INDENTATION * idx + value
            if uri not in self.prefix:
                self.prefix.add(uri)
                uri = uri.replace(' ', '&nbsp;')
                is_file = idx + 1 == len(uri_list)
                if not is_file:
                    div_html = '<li>{}</li>'.format(uri)
                    self.write_obj.write(div_html + '\n')
                else:
                    href = self.GITHUB_URL + "/".join(uri_list)
                    href = href.rsplit(".", 1)[0]
                    a_html = '<li><a href="{}">{}</a></li>'.format(href, uri)
                    self.write_obj.write(a_html + '\n')


GenMenu().walk()
