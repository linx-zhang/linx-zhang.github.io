# About & Site Setup Guide

## Instructions Before Reading

> [!WARNING]
> **Network Notice:** Because static assets are hosted on GitHub, access from mainland China may be slow or restricted.

- **404 Troubleshooting:** If a page or script returns a 404 error, try appending the file extension (e.g., [`build-site.py`](https://github.com/linx-zhang/linx-zhang.github.io/blob/main/raw-docs/scripts/build-site.py)).
- **Code Copying Tip:** When copying code blocks, select the first line and press `Ctrl + Shift + End` to quickly select to the end of the block.

---

## How This Site Was Built

This personal knowledge base is hosted for free via GitHub Pages. Here is the general workflow:

1. **GitHub Setup:** Register a GitHub account and configure public repositories (`linx-zhang.github.io` for main content, plus an optional asset repo for static files).
2. **Directory Structure:** Organize content folders by topics (e.g., `python`, `golang`, `cpp`) and manage static assets under `static/`.
3. **Automated Menu Generation:** Generate and update the file tree navigation in `index.html` using the custom build script:
   - [Live Documentation](https://linx-zhang.github.io/wiki/scripts/build-site)
   - [Python Source Code](https://github.com/linx-zhang/linx-zhang.github.io/blob/main/raw-docs/scripts/build-site.py)

---

## Markdown Syntax Playground

### 1. Nested Blockquote & List
> - **License**: MIT
> - **About**: Personal technical notes and code snippets
> - **Categories**:
>   - Algorithms
>   - DevOps
>   - GUI & Scripts

### 2. Ordered List
1. Initialize repository
2. Pre-generate markdown files
3. Build `index.html` catalog

### 3. Media & Links
![Avatar](https://github.com/linx-zhang/static/blob/main/icon/logo.jpg?raw=true)

- Return to [Home](/) or the [repository README](https://github.com/linx-zhang/linx-zhang.github.io#readme)