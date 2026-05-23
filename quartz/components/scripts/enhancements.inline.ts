import mediumZoom from "medium-zoom"

// 把 3 个 UI 增强行为统一打包：lightbox、阅读进度条、远程图尺寸兜底。
// 由 Enhancements 组件通过 afterDOMLoaded 注入；客户端运行。

let zoomInstance: ReturnType<typeof mediumZoom> | null = null

function initZoom() {
  if (zoomInstance) zoomInstance.detach()
  zoomInstance = mediumZoom("article img", {
    margin: 24,
    background: "rgba(0, 0, 0, 0.85)",
    scrollOffset: 60,
  })
}

function setupReadingProgress() {
  let bar = document.querySelector<HTMLElement>(".reading-progress")
  if (!bar) {
    bar = document.createElement("div")
    bar.className = "reading-progress"
    document.body.appendChild(bar)
  }
  const update = () => {
    const h = document.documentElement
    const max = h.scrollHeight - h.clientHeight
    const pct = max > 0 ? (h.scrollTop / max) * 100 : 0
    bar!.style.setProperty("--read-progress", `${pct}%`)
  }
  update()
  window.addEventListener("scroll", update, { passive: true })
  window.addCleanup?.(() => window.removeEventListener("scroll", update))
}

// 远程图（无 width/height 属性）在 onload 后把 naturalWidth/naturalHeight 写回属性，
// 触发 CSS columns / 比例感知布局重排。本地图由 ImageDimensions 插件在构建时已注入。
function fixRemoteDimensions() {
  const imgs = document.querySelectorAll<HTMLImageElement>("article img:not([width])")
  imgs.forEach((img) => {
    const apply = () => {
      if (img.naturalWidth && img.naturalHeight) {
        img.setAttribute("width", String(img.naturalWidth))
        img.setAttribute("height", String(img.naturalHeight))
      }
    }
    if (img.complete && img.naturalWidth) apply()
    else img.addEventListener("load", apply, { once: true })
  })
}

document.addEventListener("nav", () => {
  initZoom()
  fixRemoteDimensions()
  setupReadingProgress()
})
