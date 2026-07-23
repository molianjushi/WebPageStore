// 极简 Chrome MV3 构建脚本。
// 依赖：esbuild + postcss + tailwindcss + autoprefixer（已装）。
// 用法：node build.mjs
//
// 入口约定（src/ → dist/）：
//   src/popup.tsx     → dist/popup.js      (popup 页面用，React)
//   src/popup.html    → dist/popup.html    (popup HTML)
//   src/popup.css     → dist/popup.css     (过 PostCSS + Tailwind)
//   src/background.ts → dist/background.js (service worker, ESM)
//   src/content.ts    → dist/content.js    (content script; IIFE + inline readability/turndown)
//   src/options.tsx   → dist/options.js    (options page, React)
//   src/options.html  → dist/options.html
//   src/lib/*.ts      → 被入口引用，esbuild 自动 inline bundle
//   assets/           → dist/assets/       (图标等)
//   manifest.json     → dist/manifest.json (复制)

import { build } from "esbuild"
import { access, copyFile, mkdir, readdir, rm, readFile, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import postcss from "postcss"
import tailwindcss from "tailwindcss"
import autoprefixer from "autoprefixer"

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = join(__dirname, "dist")

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function copyDir(srcDir, dstDir) {
  await mkdir(dstDir, { recursive: true })
  const entries = await readdir(srcDir, { withFileTypes: true })
  for (const e of entries) {
    const s = join(srcDir, e.name)
    const d = join(dstDir, e.name)
    if (e.isDirectory()) await copyDir(s, d)
    else await copyFile(s, d)
  }
}

async function processCss(inputRel, outputRel) {
  const input = join(__dirname, inputRel)
  if (!(await exists(input))) return
  const raw = await readFile(input, "utf8")
  // 在 src/ 目录里跑 postcss（让 tailwind 能找到 config）
  const result = await postcss([
    tailwindcss({ config: join(__dirname, "tailwind.config.js") }),
    autoprefixer(),
  ]).process(raw, { from: input, to: join(dist, outputRel) })
  await mkdir(join(dist, dirname(outputRel)), { recursive: true })
  await writeFile(join(dist, outputRel), result.css, "utf8")
  console.log(`  ✓ CSS → ${outputRel} (${result.css.length} bytes)`)
}

console.log("→ 清空 dist/")
await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })

// 0. CSS (Tailwind + PostCSS + autoprefixer)
console.log("→ 编译 CSS")
await processCss("src/popup.css", "popup.css")

// 1. bundle popup (React)
console.log("→ bundle popup.js (React)")
await build({
  entryPoints: [join(__dirname, "src/popup.tsx")],
  outfile: join(dist, "popup.js"),
  bundle: true,
  format: "iife",
  jsx: "automatic",
  target: "chrome120",
  minify: false,
  sourcemap: true,
  logLevel: "info",
  // .css import -> empty（CSS 由 PostCSS 输出独立文件）
  loader: { ".css": "empty" },
})

// 2. bundle options (React)
console.log("→ bundle options.js (React)")
await build({
  entryPoints: [join(__dirname, "src/options.tsx")],
  outfile: join(dist, "options.js"),
  bundle: true,
  format: "iife",
  jsx: "automatic",
  target: "chrome120",
  minify: false,
  sourcemap: true,
  logLevel: "info",
  loader: { ".css": "empty" },
})

// 3. bundle background (ESM for service_worker type: module)
console.log("→ bundle background.js (ESM service worker)")
await build({
  entryPoints: [join(__dirname, "src/background.ts")],
  outfile: join(dist, "background.js"),
  bundle: true,
  format: "esm",
  target: "chrome120",
  platform: "browser",
  minify: false,
  sourcemap: true,
  logLevel: "info",
})

// 4. bundle content (IIFE; 把 readability/turndown inline 进 content script)
console.log("→ bundle content.js (IIFE; readability + turndown)")
await build({
  entryPoints: [join(__dirname, "src/content.ts")],
  outfile: join(dist, "content.js"),
  bundle: true,
  format: "iife",
  target: "chrome120",
  platform: "browser",
  minify: false,
  sourcemap: true,
  logLevel: "info",
})

// 5. 复制 HTML / assets / manifest
console.log("→ 复制 HTML / assets / manifest")
const filesToCopy = [
  ["src/popup.html", "popup.html"],
  ["src/options.html", "options.html"],
  ["manifest.json", "manifest.json"],
]
for (const [from, to] of filesToCopy) {
  if (await exists(join(__dirname, from))) {
    await copyFile(join(__dirname, from), join(dist, to))
  }
}

if (await exists(join(__dirname, "assets"))) {
  await copyDir(join(__dirname, "assets"), join(dist, "assets"))
}

console.log("\n✅ build 完成 →", relative(__dirname, dist))
