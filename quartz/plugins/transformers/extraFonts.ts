import { QuartzTransformerPlugin } from "../types"

interface Options {
  /**
   * 额外要从 Google Fonts 加载的字体 URL（完整 css2 链接）。
   * 默认加载 Noto Serif SC 400 / 700 两个字重，配 Source Serif 4 / Newsreader 用作中文 fallback。
   */
  urls?: string[]
}

const defaultUrls = [
  // 中文 fallback，配 Geist / Inter 用
  "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap",
]

/**
 * 注入额外的字体 CSS 链接到 <head>。Quartz 的 typography 配置只能装 3 个字体，
 * 需要第 4+ 个（典型场景：中文 fallback）就用这个插件。
 *
 * 用法：
 *   Plugin.ExtraFonts()  // 加载默认 Noto Serif SC
 *   Plugin.ExtraFonts({ urls: ["https://fonts.googleapis.com/css2?family=Inter..."] })
 */
export const ExtraFonts: QuartzTransformerPlugin<Partial<Options>> = (opts) => {
  const urls = opts?.urls ?? defaultUrls
  return {
    name: "ExtraFonts",
    externalResources: () => ({
      css: urls.map((u) => ({ content: u })),
    }),
  }
}
