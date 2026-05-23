# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Quartz v4 — a static-site generator that publishes a folder of Markdown notes (a "digital garden") as an interlinked website. Distributed both as the runnable site here and as a `quartz` CLI (`bin` in `package.json`) that downstream users install.

## Common commands

- `npx quartz build --serve` — build `content/` to `public/` and host on `http://localhost:8080` with WebSocket hot-reload (default port 3001).
- `npx quartz build` — one-shot static build (CI / production).
- `npm run docs` — build & serve the bundled `docs/` directory (useful when changing docs).
- `npm run check` — `tsc --noEmit` + Prettier check. Run before commits.
- `npm run format` — apply Prettier.
- `npm test` — runs `tsx --test`, which auto-discovers `*.test.ts` files (e.g. `quartz/util/path.test.ts`, `quartz/components/scripts/search.test.ts`). Run a single file with `npx tsx --test path/to/file.test.ts`.
- `npm run profile` — flame-graph a single-threaded build via `0x`.

Common `quartz build` flags: `-d <dir>` (input, default `content`), `-o <dir>` (output, default `public`), `--concurrency <n>` (worker threads), `-v` (verbose plugin loading).

Requires Node ≥ 22 (`.node-version` pins this) and npm ≥ 10.9.

## Architecture

### Two user-facing config files

- `quartz.config.ts` — site-wide `QuartzConfig` (title, baseUrl, theme, analytics, locale, **and the `plugins` pipeline**). Plugin order matters; e.g. `ObsidianFlavoredMarkdown` must run before `CrawlLinks`.
- `quartz.layout.ts` — composes Preact components into `sharedPageComponents` (head/header/footer/afterBody, applied everywhere) and per-page-type layouts (`defaultContentPageLayout`, `defaultListPageLayout`). Layout slots are `beforeBody`, `left`, `right`.

These two files are the seam between Quartz internals and the user. Avoid changing their shape without considering downstream users who fork this repo.

### Build pipeline (`quartz/build.ts` → `quartz/processors/{parse,filter,emit}.ts`)

1. **Glob** `content/` for `.md` files (`cfg.configuration.ignorePatterns` applied).
2. **Parse** in a `workerpool` (`quartz/worker.ts`): each chunk runs `createMdProcessor` (markdown AST transforms) then `createHtmlProcessor` (HTML AST transforms), both built from `transformers[*].markdownPlugins` / `htmlPlugins`.
3. **Filter** via `filters[*].shouldPublish` (drafts, explicit-publish gating).
4. **Emit** via `emitters[*].emit` — each emitter writes files to `public/` and may declare `getQuartzComponents` so only used components contribute CSS/JS to the page.

In `--serve`/`--watch` mode, `chokidar` triggers `partialEmit` when supported, otherwise a full rebuild. WebSocket on `wsPort` notifies the browser to reload.

### Plugin types (`quartz/plugins/types.ts`)

- **Transformer** — adds unified/remark/rehype plugins or `externalResources` (css/js to inject).
- **Filter** — pure `shouldPublish(ctx, content) → boolean`.
- **Emitter** — writes output. Implement `partialEmit` for incremental rebuild support.

Plugins live in `quartz/plugins/{transformers,filters,emitters}/` and are re-exported from `quartz/plugins/index.ts`, then consumed in `quartz.config.ts`.

### Components (`quartz/components/`)

- JSX is **Preact**, not React (`tsconfig.json` sets `"jsxImportSource": "preact"`). SSR via `preact-render-to-string`.
- A `QuartzComponent` is a Preact component with optional `css`, `beforeDOMLoaded`, `afterDOMLoaded` string resources attached to the function itself. The build pipeline collects these per-page.
- Client-side behavior lives in **`*.inline.ts`** files under `quartz/components/scripts/` (e.g. `spa.inline.ts`, `search.inline.ts`, `popover.inline.ts`). These are bundled separately by esbuild and shipped to the browser; they listen for the custom `nav`/`prenav` SPA events declared in `index.d.ts`.
- Per-component styles live alongside as `.scss` and are imported as strings (see `globals.d.ts`).

### CLI (`quartz/bootstrap-cli.mjs` → `quartz/cli/handlers.js`)

Five subcommands: `create`, `update`, `restore`, `sync`, `build`. `create`/`update`/`sync` manage the upstream git remote (`UPSTREAM_NAME`, `QUARTZ_SOURCE_BRANCH` in `cli/constants.js`) so end users can pull Quartz updates without losing their content. Editing CLI behavior affects this upgrade path — be conservative.

## Conventions

- **Code style**: Prettier — `printWidth: 100`, no semicolons, trailing commas, 2-space indent. `tsconfig` has `strict`, `noUnusedLocals`, `noUnusedParameters` — `npm run check` will fail on unused symbols.
- **Path types**: distinguish `FilePath`, `FullSlug`, `SimpleSlug`, etc. (see `quartz/util/path.ts`). These are branded strings — use the constructors/converters, don't cast.
- **`.inline.ts` suffix is load-bearing**: it tells the build to treat the file as a client-side bundle entry. Don't rename.
- **Plugin output is cached** in `.quartz-cache/`; delete it if you suspect stale worker bundles.
- **Docs are content**: `docs/` is itself a Quartz site (built by `npm run docs`). User-facing features should get a corresponding `docs/*.md` page.

## Local customizations (deviations from upstream)

This repo is a fork that follows upstream Quartz via `quartz sync`. To minimize merge conflicts, all site-specific changes are isolated to user-config files or new files — **avoid editing `quartz/components/Head.tsx`, `Body.tsx`, or other upstream sources**. Existing local additions:

### Config customizations (`quartz.config.ts`)
- `locale: "zh-CN"`, `pageTitle: "我的数字花园"`
- Theme: Noto Sans SC body/header + JetBrains Mono code; warm cream light mode (`#fdfaf6` / 朱砂红) + dark mode (`#0d0d0f` / 亮蓝)
- Syntax highlighting: `rose-pine-dawn` (light) + `tokyo-night` (dark)
- `ObsidianFlavoredMarkdown({ mermaid: true })` for diagram support
- Custom plugin `ImageDimensions()` enabled at end of transformers (see below)

### Custom plugin (`quartz/plugins/transformers/imageDimensions.ts`)
Build-time image dimension injection using `sharp`. Walks the HTML AST and, for each `<img>` with a local-path `src`, injects `width`/`height`/`loading="lazy"`/`decoding="async"`. Skips remote URLs (those are handled client-side by `enhancements.inline.ts`). Caches by absolute path + mtime so unchanged images are O(1).

### Custom component (`quartz/components/Enhancements.tsx`)
Renders no DOM. Its only job is to attach `quartz/components/scripts/enhancements.inline.ts` via `afterDOMLoaded`. The inline script provides:
- **Image lightbox** via bundled `medium-zoom` (npm dep, not CDN)
- **Top reading-progress bar** (writes to `--read-progress` CSS var)
- **Remote-image dimension fallback** — on `<img>` `onload` writes `naturalWidth`/`naturalHeight` back as attrs so CSS columns/masonry recompute correctly

Wired into `quartz.layout.ts` via direct import (not through `quartz/components/index.ts` — avoids touching that upstream file). Always put it first in `sharedPageComponents.afterBody`.

### `sharedPageComponents.afterBody` contents (in order)
1. `Enhancements()` — see above
2. `ConditionalRender({ component: RecentNotes(...), condition: slug === "index" })` — only on home
3. `Comments({ provider: "giscus", ... })` — disabled per page via frontmatter `comments: false`

### Custom SCSS (`quartz/styles/custom.scss`)
- Article width clamped to `720px` for Chinese readability
- Paragraph `line-height: 1.8`, `margin: 1.1em 0`
- Code blocks: rounded corners + 1px border + auto line numbers via `counter-reset` on `code .line`
- Image enhancements: shadow + border on all `article img`, hover scale 1.02 (only when not in `.medium-zoom-image--opened` state)
- Image layout classes: `.image-center`, `.image-row` (justified-row flex), `.image-masonry` (3-col → 2-col responsive)
- `.reading-progress` bar styles (fixed top 3px, width driven by `--read-progress`)
- `.medium-zoom-image--opened` overrides: no border/shadow/radius when zoomed (**never override `transform`**, that breaks medium-zoom's animations)

### Authoring conventions
- Markdown lives in `content/`. Wikilinks `[[]]`, embeds `![[]]`, callouts `> [!note]`, KaTeX, `%%comments%%`, footnotes, mermaid all enabled.
- For `.image-masonry` / `.image-row` with remote images, prefer raw `<img>` tags (no blank lines inside the wrapping `<div>`) so markdown doesn't wrap each img in `<p>`.
- Local images get dimensions injected automatically — no need to write `width`/`height`.
