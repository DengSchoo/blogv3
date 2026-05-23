import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore  - .inline.ts 由 esbuild 处理成 string
import script from "./scripts/enhancements.inline"

// 不渲染任何 DOM，只是用来挂载 afterDOMLoaded 脚本。
// 通过这个组件把所有客户端增强行为从 Head.tsx 里抽离出来，
// 这样上游 Quartz 更新时 Head.tsx 不会有 merge 冲突。
const Enhancements: QuartzComponent = () => null
Enhancements.afterDOMLoaded = script

export default (() => Enhancements) satisfies QuartzComponentConstructor
