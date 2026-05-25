import mediumZoom from "medium-zoom"

// 把所有 UI 增强行为统一打包：lightbox、阅读进度条、远程图尺寸兜底、
// 图片加载淡入、复制按钮反馈、返回顶部。
// 由 Enhancements 组件通过 afterDOMLoaded 注入；客户端运行。

// medium-zoom 在模块加载时通过 styleInject 往 <head> 注入一个 <style>，
// 提供 .medium-zoom-overlay 的 position:fixed 和 opacity 过渡。spa.inline.ts 在
// SPA 跳转时会清掉所有不带 data-persist 的 head 子元素，那个注入样式就一起没了；
// 而 styleInject 在模块顶层只跑一次，跳转后不会再注入。结果就是首次 SPA 跳转后
// 点击图片，overlay 没遮罩、点空白处也关不掉，刷新整页才恢复。
// 这里把它打上 data-persist，让 spa.inline.ts 跳过它。
;(function persistMediumZoomStyle() {
  const styles = document.head.querySelectorAll("style")
  for (const s of styles) {
    if (s.textContent && s.textContent.includes(".medium-zoom-overlay")) {
      s.setAttribute("data-persist", "")
      break
    }
  }
})()

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

// 图片加载完成后加 .loaded class，配合 CSS 淡入
function imageFadeIn() {
  const imgs = document.querySelectorAll<HTMLImageElement>("article img")
  imgs.forEach((img) => {
    if (img.complete && img.naturalWidth) {
      img.classList.add("loaded")
    } else {
      img.addEventListener("load", () => img.classList.add("loaded"), { once: true })
      img.addEventListener("error", () => img.classList.add("loaded"), { once: true })
    }
  })
}

// ─── Toast 容器 + 函数 ────────────────────────────
function ensureToastContainer(): HTMLElement {
  let c = document.querySelector<HTMLElement>(".toast-container")
  if (!c) {
    c = document.createElement("div")
    c.className = "toast-container"
    document.body.appendChild(c)
  }
  return c
}

function showToast(message: string) {
  const container = ensureToastContainer()
  const t = document.createElement("div")
  t.className = "toast"
  t.textContent = message
  container.appendChild(t)
  // 触发进入动画
  requestAnimationFrame(() => t.classList.add("show"))
  setTimeout(() => {
    t.classList.remove("show")
    setTimeout(() => t.remove(), 300)
  }, 1600)
}

// 复制按钮反馈：弹跳 + toast
// Quartz 的 clipboard.inline.ts 负责实际复制 + 切图标，
// 这里只追加视觉反馈
let copyDelegated = false
function setupCopyFeedback() {
  if (copyDelegated) return
  copyDelegated = true
  document.body.addEventListener("click", (e) => {
    const btn = (e.target as Element)?.closest?.(".clipboard-button") as HTMLElement | null
    if (!btn) return
    btn.classList.remove("bounce")
    void btn.offsetWidth // 重置动画
    btn.classList.add("bounce")
    showToast("已复制")
  })
}

// ─── 返回顶部按钮 ────────────────────────────────
function ensureBackToTopButton(): HTMLButtonElement {
  let btn = document.querySelector<HTMLButtonElement>(".back-to-top")
  if (!btn) {
    btn = document.createElement("button")
    btn.className = "back-to-top"
    btn.type = "button"
    btn.setAttribute("aria-label", "返回顶部")
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    `
    btn.addEventListener("click", () => {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" })
    })
    document.body.appendChild(btn)
  }
  return btn
}

function setupBackToTop() {
  const btn = ensureBackToTopButton()
  const update = () => {
    btn.classList.toggle("visible", window.scrollY > 300)
  }
  update()
  window.addEventListener("scroll", update, { passive: true })
  window.addCleanup?.(() => window.removeEventListener("scroll", update))
}

// ─── 瀑布流连续切分（保留源序，最小化最高列高度） ───
// 约束：源序不能打乱——列必须是源序的连续片段。
//   列 1 = items[0..i1), 列 2 = items[i1..i2), ..., 列 k = items[ik-1..n)
// 目标：选切点 i1 < i2 < ... 让 max(列高) 最小
// 等价于 LeetCode 410 "Split Array Largest Sum"，DP O(n²k)
//
// 返回 assignment[i] = 列号
function packContiguous(heights: number[], cols: number): number[] {
  const n = heights.length
  if (n === 0) return []
  if (cols >= n) return heights.map((_, i) => i) // 每张一列

  // 前缀和加速区间和查询
  const prefix = new Array(n + 1).fill(0)
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + heights[i]

  // dp[i][j] = 前 i 张图分到 j 列时，最高列高度的最小值
  // split[i][j] = 此最优解的最后一列起始位置
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(cols + 1).fill(Infinity),
  )
  const split: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(cols + 1).fill(0),
  )
  dp[0][0] = 0

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= Math.min(i, cols); j++) {
      // 最后一列至少要 1 张（k 从 j-1 起，对应至少前 j-1 列各 1 张）
      for (let k = j - 1; k < i; k++) {
        const lastColH = prefix[i] - prefix[k]
        const candidate = Math.max(dp[k][j - 1], lastColH)
        if (candidate < dp[i][j]) {
          dp[i][j] = candidate
          split[i][j] = k
        }
      }
    }
  }

  // 回溯切点
  const assignment = new Array(n).fill(0)
  let i = n
  let j = cols
  while (j > 0) {
    const start = split[i][j]
    for (let idx = start; idx < i; idx++) assignment[idx] = j - 1
    i = start
    j--
  }
  return assignment
}

function packMasonry(container: HTMLElement) {
  const targetCols =
    parseInt(getComputedStyle(container).getPropertyValue("--masonry-cols")) || 3

  // 收集 items
  let items: HTMLElement[]
  if (container.classList.contains("js-packed")) {
    items = Array.from(container.querySelectorAll<HTMLElement>(".masonry-col > *"))
  } else {
    items = (Array.from(container.children) as HTMLElement[]).filter(
      (n) => n.tagName === "IMG" || (n.tagName === "P" && !!n.querySelector("img")),
    )
  }
  if (items.length === 0) return

  const imgs = items.map(
    (item) =>
      (item.tagName === "IMG" ? item : item.querySelector("img")) as HTMLImageElement | null,
  )

  // 等所有图尺寸就绪
  const dimReady = imgs.every(
    (img) =>
      !!img &&
      (img.naturalWidth > 0 ||
        (parseInt(img.getAttribute("width") || "0") > 0 &&
          parseInt(img.getAttribute("height") || "0") > 0)),
  )
  if (!dimReady) {
    imgs.forEach((img) => {
      if (img && !img.complete) {
        img.addEventListener("load", () => packMasonry(container), { once: true })
        img.addEventListener("error", () => packMasonry(container), { once: true })
      }
    })
    return
  }

  // 相对高度 = h / w（列宽相等）；gap 占的相对高度 ≈ 12px / 列宽
  // 列宽 ≈ container 宽 / 列数；用 0.05 经验值（720px / 3 列 ≈ 240px，12/240 = 0.05）
  const gapRelative = 0.05
  const heights = imgs.map((img) => {
    if (!img) return 0
    const w = img.naturalWidth || parseInt(img.getAttribute("width") || "1") || 1
    const h = img.naturalHeight || parseInt(img.getAttribute("height") || "1") || 1
    return h / w + gapRelative
  })

  // 连续切分：源序不打乱，DP 求最优
  const assignment = packContiguous(heights, targetCols)

  // 按列分组（assignment 本身已按源序）
  const grouped: HTMLElement[][] = Array.from({ length: targetCols }, () => [])
  assignment.forEach((c, idx) => grouped[c].push(items[idx]))

  // 构建 DOM
  const columns = grouped.map((group) => {
    const div = document.createElement("div")
    div.className = "masonry-col"
    group.forEach((item) => div.appendChild(item))
    return div
  })

  container.innerHTML = ""
  columns.forEach((col) => container.appendChild(col))
  container.classList.add("js-packed")
}

function setupMasonry() {
  document.querySelectorAll<HTMLElement>(".image-masonry").forEach(packMasonry)
}

// 窗口尺寸变化时，列数可能从 3 → 2，需要重打包
let resizeTimer: ReturnType<typeof setTimeout> | undefined
window.addEventListener(
  "resize",
  () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(setupMasonry, 200)
  },
  { passive: true },
)

// ─── dappled-light：jzhao.xyz 风格的百叶窗 + 树叶 ───
// 注入完整 DOM 结构到 body 最前，CSS 控制日出/日落动画
// 监听 themechange 后给 body 加 animation-ready，触发 sunrise/sunset 渐变
function buildDappledLight(): HTMLElement {
  const wrap = document.createElement("div")
  wrap.id = "dappled-light"
  wrap.setAttribute("aria-hidden", "true")

  // 23 片百叶窗叶片 + 2 根竖向支架
  const shuttersHTML = Array.from({ length: 23 }, () => '<div class="shutter"></div>').join("")
  const verticalHTML = '<div class="bar"></div><div class="bar"></div>'

  wrap.innerHTML = `
    <div id="glow"></div>
    <div id="glow-bounce"></div>
    <div class="perspective">
      <div id="leaves"></div>
      <div id="blinds">
        <div class="shutters">${shuttersHTML}</div>
        <div class="vertical">${verticalHTML}</div>
      </div>
    </div>
    <div id="progressive-blur">
      <div></div>
      <div></div>
    </div>
  `
  return wrap
}

function setupDappledLight() {
  if (!document.getElementById("dappled-light")) {
    document.body.prepend(buildDappledLight())
  }
}

// 监听 themechange 事件，给 body 加 .animation-ready 触发 sunrise/sunset 动画
// 仅一次性绑定（不挂在 nav 上避免重复添加）
let themeListenerBound = false
function setupAnimationReady() {
  if (themeListenerBound) return
  themeListenerBound = true
  document.addEventListener("themechange", () => {
    document.body.classList.add("animation-ready")
  })
}

document.addEventListener("nav", () => {
  initZoom()
  fixRemoteDimensions()
  imageFadeIn()
  setupMasonry()
  setupReadingProgress()
  setupBackToTop()
  setupCopyFeedback()
  setupDappledLight()
  setupAnimationReady()
})
