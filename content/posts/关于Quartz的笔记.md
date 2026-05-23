---
title: 关于 Quartz 的笔记
date: 2026-05-23
tags:
  - 技术
  - quartz
---

把搭建过程中遇到的几个点先记下来，免得下次忘。

## 写作流

1. 在 `content/` 下新建 `.md` 文件，文件名就是 URL slug（中文也可以，会被 slugify）。
2. 前置 frontmatter 至少写 `title`，可选 `date` / `tags` / `draft: true`。
3. `npx quartz build --serve` 起本地预览，保存即热重载。
4. `git push` 到部署仓库，CI 跑 `npx quartz build` 生成 `public/`。

## 一些好用的语法

- 双链：`[[关于本站]]` → [[关于本站]]
- 带显示文本：`[[关于本站|站点说明]]` → [[关于本站|站点说明]]
- 标签：在正文里写 `#思考` 或在 frontmatter 里写 `tags:`
- Callout：

> [!warning] 注意
> `draft: true` 的文章默认不会被构建到 `public/`，由 `RemoveDrafts` 过滤器处理。

## 改动入口速查

| 想改的东西 | 改哪 |
| --- | --- |
| 站点标题 / locale / 主题色 | `quartz.config.ts` |
| 左右栏组件、是否显示 Graph | `quartz.layout.ts` |
| Markdown 渲染行为（标题锚点、代码高亮等） | `plugins.transformers` |
| 输出什么文件（RSS、sitemap、OG 图） | `plugins.emitters` |

更深的改动思路见 [[关于本站]] 提到的官方文档。
