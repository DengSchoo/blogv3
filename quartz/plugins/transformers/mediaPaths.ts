import { QuartzTransformerPlugin } from "../types"
import { visit } from "unist-util-visit"
import { Root, Element } from "hast"
import isAbsoluteUrl from "is-absolute-url"
import { RelativeURL, TransformOptions, transformLink } from "../../util/path"

/**
 * 治本插件：补 CrawlLinks 的媒体盲区。
 *
 * CrawlLinks 只重写 <video src=>, <audio src=>, <iframe src= > 直挂在元素上的 src。
 * 但常见写法是 <video><source src="..."></video>，src 在子元素 <source> 上——
 * 这种 CrawlLinks 看不到。
 *
 * 同时给 <video> / <audio> 加默认 controls + preload="metadata"，写起来更省心。
 *
 * 必须放在 CrawlLinks 之后，复用它已经设置的 slug / transformLink 上下文。
 */
export const MediaPaths: QuartzTransformerPlugin = () => ({
  name: "MediaPaths",
  htmlPlugins(ctx) {
    return [
      () => (tree: Root, file) => {
        const slug = file.data.slug
        if (!slug) return

        const transformOptions: TransformOptions = {
          strategy: "shortest",
          allSlugs: ctx.allSlugs,
        }

        const fixSrcAttr = (node: Element, attr: "src" | "srcset" | "href") => {
          const value = node.properties?.[attr]
          if (typeof value !== "string") return
          if (isAbsoluteUrl(value, { httpOnly: false })) return
          if (value.startsWith("#") || value.startsWith("data:")) return

          node.properties![attr] = transformLink(slug, value as RelativeURL, transformOptions)
        }

        visit(tree, "element", (node: Element) => {
          // 给 video / audio 加默认 controls + preload
          if (node.tagName === "video" || node.tagName === "audio") {
            node.properties ??= {}
            if (node.properties.controls === undefined) {
              node.properties.controls = true
            }
            if (!node.properties.preload) {
              node.properties.preload = "metadata"
            }
            fixSrcAttr(node, "src")
          }

          // <source> / <track> 在 video/audio 内部，src 单独需要修
          if (node.tagName === "source" || node.tagName === "track") {
            fixSrcAttr(node, "src")
            fixSrcAttr(node, "srcset")
          }

          // <iframe> CrawlLinks 已处理 src，这里只兜底 + 加 loading="lazy"
          if (node.tagName === "iframe") {
            node.properties ??= {}
            if (!node.properties.loading) {
              node.properties.loading = "lazy"
            }
            fixSrcAttr(node, "src")
          }
        })
      },
    ]
  },
})
