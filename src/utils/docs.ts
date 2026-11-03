// src/utils/docs.ts

// 1. 扫描时加上 html
const rawModules = import.meta.glob('/raw-docs/**/*.{md,markdown,html}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface DocItem {
  slug: string;
  filePath: string;
  title: string;
  rawContent: string;
  type: 'md' | 'html'; // 新增：标记文件类型
}

export function getDocList(): DocItem[] {
  return Object.entries(rawModules).map(([filePath, rawContent]) => {
    // 判断扩展名
    const isHtml = filePath.endsWith('.html');
    
    // 去除前缀和后缀，兼容 html
    const slug = filePath
      .replace(/^\/raw-docs\//, '')
      .replace(/\.(md|markdown|html)$/, '');

    // 提取标题 (如果是 HTML，简单正则抓一下 <title> 标签，抓不到就用 slug)
    let title = slug;
    if (isHtml) {
      const titleMatch = rawContent.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) title = titleMatch[1].trim();
    } else {
      const firstLine = rawContent.trim().split('\n')[0] || '';
      const titleMatch = firstLine.match(/^#\s+(.+)$/);
      if (titleMatch) title = titleMatch[1].trim();
    }

    return {
      slug,
      filePath,
      title,
      rawContent,
      type: isHtml ? 'html' : 'md', // 标记类型
    };
  });
}

export function getDocBySlug(slug: string): DocItem | undefined {
  return getDocList().find((d) => d.slug === slug);
}