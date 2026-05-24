import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "我的数字花园",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "zh-CN",
    baseUrl: "dengsh.me",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Geist",
        body: "Geist",
        code: "Geist Mono",
      },
      colors: {
        lightMode: {
          light: "#fdfaf6",
          lightgray: "#e5dfd5",
          gray: "#8a8073", // 从 #b5ab9a 调深以满足 WCAG 4.5:1 对比度（用于行号、时间、辅助文字）
          darkgray: "#4a3f33",
          dark: "#2d2418",
          secondary: "#a85751",
          tertiary: "#7d9a6f",
          highlight: "rgba(168, 87, 81, 0.08)",
          textHighlight: "#f7d77688",
        },
        darkMode: {
          light: "#0d0d0f",
          lightgray: "#2a2a2e",
          gray: "#6e6e74",
          darkgray: "#d4d4d8",
          dark: "#fafafa",
          secondary: "#60a5fa",
          tertiary: "#93c5fd",
          highlight: "rgba(96, 165, 250, 0.1)",
          textHighlight: "#a3a30088",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "rose-pine-dawn",
          dark: "tokyo-night",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false, mermaid: true }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
      // 本地图自动注入 width/height + lazy loading；远程图交给 Enhancements 客户端脚本兜底
      Plugin.ImageDimensions(),
      // 补 CrawlLinks 的媒体盲区：<source>/<track> 路径修正，+ 默认 controls / preload
      Plugin.MediaPaths(),
      // 额外加载 Noto Serif SC 作为中文 fallback（typography 槽位已被英文字体占满）
      Plugin.ExtraFonts(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
