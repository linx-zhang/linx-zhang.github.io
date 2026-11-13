
```python
import os
from PIL import Image

def merge_images_vertical(target_dir: str, output_path: str = "merged.png"):
    """
    多张图片从上到下合并，左对齐，宽度不够补白色背景
    :param target_dir: 图片文件夹路径
    :param output_path: 输出图片路径
    """
    # 1. 获取文件夹图片，按文件名排序
    img_ext = (".jpg", ".jpeg", ".png", ".bmp")
    file_list = [f for f in os.listdir(target_dir) if f.lower().endswith(img_ext)]
    file_list.sort()  # 按文件名排序

    if not file_list:
        raise FileNotFoundError("target文件夹没有找到图片")

    images = []
    max_width = 0
    total_height = 0

    # 遍历读取图片，计算最大宽度、总高度
    for filename in file_list:
        fp = os.path.join(target_dir, filename)
        im = Image.open(fp).convert("RGBA")
        images.append(im)
        w, h = im.size
        if w > max_width:
            max_width = w
        total_height += h

    # 创建画布：最大宽度，全部图片高度之和，白色背景
    result = Image.new("RGBA", (max_width, total_height), color=(255, 255, 255, 255))

    current_y = 0
    for im in images:
        w, h = im.size
        # 左对齐粘贴，x=0；宽度不足max_width，右侧自动留白
        result.paste(im, box=(0, current_y))
        current_y += h

    # 如果想要输出jpg，转RGB去掉alpha通道
    if output_path.lower().endswith(".jpg") or output_path.lower().endswith(".jpeg"):
        result = result.convert("RGB")
    result.save(output_path)
    print(f"合并完成，输出：{output_path}")


if __name__ == "__main__":
    merge_images_vertical(target_dir="./target", output_path="./out.png")

```
