import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
// 自定义组件：不通过 Component.* 引用，避免修改上游 components/index.ts
import EnhancementsCtor from "./quartz/components/Enhancements"
const Enhancements = EnhancementsCtor

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Enhancements(),
    Component.ConditionalRender({
      component: Component.RecentNotes({
        title: "最近更新",
        limit: 5,
        showTags: true,
        filter: (f) => f.slug?.startsWith("posts/") ?? false,
      }),
      condition: (page) => page.fileData.slug === "index",
    }),
    Component.Comments({
      provider: "giscus",
      options: {
        repo: "DengSchoo/giscus_repo",
        repoId: "R_kgDOSl4OKw",
        category: "Announcements",
        categoryId: "DIC_kwDOSl4OK84C9r9l",
        mapping: "pathname",
        strict: false,
        lang: "zh-CN",
      },
    }),
  ],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [],
}
