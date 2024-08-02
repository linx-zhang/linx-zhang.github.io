import os
import time
from PIL import Image
import numpy as np

t = time.time()

# 设置图片路径
image_dir = r'C:\Users\Linx\Pictures\Screenshots'

# 获取目录下的所有图片文件
image_files = [f for f in os.listdir(image_dir) if f.endswith('.jpg') or f.endswith('.png')]

# 将每个图片转换为 NumPy 数组并存储在列表中
image_arrays = []
for image_file in sorted(image_files):
    image = Image.open(os.path.join(image_dir, image_file))
    image_array = np.array(image)
    image_arrays.append(image_array)

# 获取最大的宽度，填充白色
max_width = max(image_array.shape[1] for image_array in image_arrays)
pixel_len = max(image_array.shape[2] for image_array in image_arrays)
for i, image_array in enumerate(image_arrays):
    # 宽度统一
    if image_array.shape[1] < max_width:
        # TODO color
        color = [255, 255, 255]
        if image_array.shape[2] == 4:
            color.append(255)
        length = image_array.shape[0]
        width = max_width - image_array.shape[1]

        padding = np.array([color] * length * width, dtype=np.uint8).reshape(
            (length, width, len(color))
        )
        image_array = np.concatenate((image_array, padding), axis=1)

    # 补充rgb -> rgba
    if image_array.shape[2] < pixel_len:
        image_array = np.pad(image_array,
                             ((0, 0), (0, 0), (0, pixel_len - image_array.shape[2])),
                             'constant', constant_values=255)
    image_arrays[i] = image_array

# 纵向合并所有 NumPy 数组
merged_array = np.concatenate(image_arrays, axis=0)

# 从合并后的 NumPy 数组创建 PIL 图像
merged_image = Image.fromarray(merged_array)

# 保存长图
merged_image.save(image_dir + r'\long_image.png')

print('Time:', time.time() - t)
print('Done!')
