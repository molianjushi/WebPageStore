// 图标生成脚本。
// 依赖：sharp（devDep，一次性装）。
// 用法：node build-icons.mjs
//
// 输入：assets/icon.svg（手画 SVG，矢量源）。
// 输出：assets/icon_{16,32,48,128}.png（Chrome MV3 要求的 4 个尺寸）。
//
// 为什么不放 build.mjs：图标改动频率低（设计师 / 用户调一次就够）；
// 单独脚本让 npm run icons 独立可跑，不污染 esbuild 主流程。

import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const assetsDir = join(__dirname, "assets")
const svgPath = join(assetsDir, "icon.svg")

const SIZES = [16, 32, 48, 128]

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

if (!(await exists(svgPath))) {
  console.error(`❌ 找不到 SVG 源文件：${svgPath}`)
  process.exit(1)
}

await mkdir(assetsDir, { recursive: true })
const svgBuffer = await readFile(svgPath)

console.log("→ 渲染图标（SVG → PNG）")
for (const size of SIZES) {
  const outPath = join(assetsDir, `icon_${size}.png`)
  await sharp(svgBuffer).resize(size, size).png().toFile(outPath)
  console.log(`  ✓ icon_${size}.png`)
}

console.log("\n✅ 图标生成完成 → assets/")