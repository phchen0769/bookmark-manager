# Bookmark Manager 🦊

一个用 **Plasmo + React + TypeScript** 开发的 Chrome 浏览器书签管理扩展。

## 功能

- 🔍 **快速搜索**：按标题和 URL 实时搜索书签（带防抖）
- 📁 **路径展示**：显示每个书签所属的文件夹层级
- 🔁 **重复检测**：自动检测相同 URL 的重复书签，一键筛选
- 📊 **统计面板**：书签总数、文件夹数、重复数一目了然
- ⚡ **自动刷新**：浏览器书签变化时界面实时同步

## 技术栈

| 组件 | 技术 |
|------|------|
| 框架 | [Plasmo](https://www.plasmo.com/) (Browser Extension Framework) |
| UI | React 18 + TypeScript |
| 样式 | 原生 CSS |
| 打包 | Vite（Plasmo 内置） |

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式（热更新）
pnpm dev

# 生产构建
pnpm build

# 打包成 zip（用于发布）
pnpm package
```

## 安装到 Chrome

1. 运行 `pnpm build`，生成 `build/chrome-mv3-prod/` 目录
2. 打开 Chrome → `chrome://extensions`
3. 打开右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择 `build/chrome-mv3-prod/` 目录

## 项目结构

```
src/
├── popup.tsx              # 弹窗入口（点击工具栏图标）
├── sidepanel.tsx          # 侧边栏入口
├── style.css              # 全局样式
├── components/
│   └── BookmarkPanel.tsx  # 主面板组件（搜索 + 列表 + 统计）
└── lib/
    ├── bookmarks.ts       # chrome.bookmarks API 封装
    └── types.ts           # 共享类型定义
```

## API 封装说明

`src/lib/bookmarks.ts` 提供以下函数：

- `getAllBookmarks()` — 扁平化获取所有书签（含路径）
- `searchBookmarks(query)` — 搜索书签
- `detectDuplicates()` — 检测重复书签
- `detectDeadLinks(bookmarks)` — 死链检测（并发探测）
- `getStats()` — 书签统计

## License

MIT
