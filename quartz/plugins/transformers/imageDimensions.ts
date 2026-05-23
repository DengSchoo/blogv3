import { QuartzTransformerPlugin } from "../types"
import { visit } from "unist-util-visit"
import { Root, Element } from "hast"
import { VFile } from "vfile"
import sharp from "sharp"
import path from "path"
import fs from "fs"

interface CacheEntry {
  width: number
  height: number
  mtimeMs: number
}

// 同一构建生命周期内复用；mtime 变了自动失效
const dimensionCache = new Map<string, CacheEntry>()

async function readDimensions(absPath: string): Promise<CacheEntry | null> {
  try {
    const stat = await fs.promises.stat(absPath)
    const cached = dimensionCache.get(absPath)
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached

    const meta = await sharp(absPath).metadata()
    if (!meta.width || !meta.height) return null
    const entry: CacheEntry = {
      width: meta.width,
      height: meta.height,
      mtimeMs: stat.mtimeMs,
    }
    dimensionCache.set(absPath, entry)
    return entry
  } catch {
    return null
  }
}

function isRemoteUrl(src: string): boolean {
  return /^(https?:)?\/\//.test(src) || src.startsWith("data:")
}

// src 可能是：
//   - OFM `![[]]` 转出来：相对 content 根的 slugified 路径，如 "attachments/foo.png"
//   - 标准 markdown ![](./foo.png)：相对源 md 文件
//   - 绝对路径 /attachments/foo.png：相对 content 根
function resolveLocal(src: string, mdFilePath: string, contentDir: string): string | null {
  const clean = decodeURIComponent(src.split("?")[0].split("#")[0])

  const candidates: string[] = []
  // 相对源 md 文件
  candidates.push(path.resolve(path.dirname(mdFilePath), clean))
  // 相对 content 根（去掉前导 /）
  candidates.push(path.resolve(contentDir, clean.replace(/^\/+/, "")))

  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  }
  return null
}

export const ImageDimensions: QuartzTransformerPlugin = () => ({
  name: "ImageDimensions",
  htmlPlugins(ctx) {
    return [
      () => async (tree: Root, file: VFile) => {
        const contentDir = path.resolve(ctx.argv.directory)
        const mdFilePath = file.data.filePath as string | undefined

        const tasks: Array<Promise<void>> = []
        visit(tree, "element", (node: Element) => {
          if (node.tagName !== "img") return
          const props = (node.properties ??= {})
          const src = props.src as string | undefined
          if (!src) return

          // 已经有 W/H 就不动（OFM 的 |WxH 写法、用户裸 HTML 都会有）
          if (props.width && props.height) return

          // 远程图交给客户端兜底
          if (isRemoteUrl(src)) return
          if (!mdFilePath) return

          const absPath = resolveLocal(src, mdFilePath, contentDir)
          if (!absPath) return

          tasks.push(
            readDimensions(absPath).then((dim) => {
              if (!dim) return
              props.width = dim.width
              props.height = dim.height
              if (!props.loading) props.loading = "lazy"
              if (!props.decoding) props.decoding = "async"
            }),
          )
        })

        await Promise.all(tasks)
      },
    ]
  },
})
