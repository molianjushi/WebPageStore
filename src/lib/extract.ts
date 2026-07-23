// content.ts 用的提取层：Readability + Turndown + 图片收集 + markdown 引用块 frontmatter。
//
// 设计要点：
// - Plasmo 默认把 src/content.ts 编译为 ISOLATED world content script，
//   它能访问页面的 DOM（只读），不会受页面 JS 干扰。
// - Readability 接受 cloned document 进行解析（避免污染原页面）。
// - Turndown 把清洗后的 HTML 转 Markdown。
// - collectImageUrls 只扫 Readability 输出的 article 子树 —— 防止抓到广告 / 头像 / 侧栏。
// - prependFrontMatter 用 markdown 引用块（`> ` 前缀）输出元数据：每个字段加 emoji 前缀，
//   key 改中文（标题 / 原文链接 / 作者 / 站点 / 摘要 / 抓取时间）+ 末尾加署名行。
//   注意：放弃 YAML 语法（不再 pandoc/hugo 兼容）；用户视觉一致性优先。

import { Readability } from "@mozilla/readability"
import TurndownService from "turndown"

export interface RawArticle {
  title: string
  byline?: string
  siteName?: string
  excerpt?: string
  contentHtml: string
  textContent: string
  /** Readability 输出的 article 元素（off-DOM 容器），用于 collectImageUrls 范围限定。 */
  articleElement: HTMLElement
}

/**
 * 在 cloned document 上移除明显不属于正文的节点（评论 / 侧栏 / 导航 / 页脚）。
 * 不污染原页面（只在 clone 上跑）。
 *
 * 适用范围：非知乎站点（v0.1.1 后知乎走专用 extractZhihu 路径，不调本函数）。
 *
 * ⚠️ 副作用评估（CLAUDE.md 协作约定"边角"）：
 * - 用 `[role="complementary"]` 替代裸 `<aside>`：避免误伤 MDN 等站点的 `<aside>` 提示框
 * - `[class*="comment" i]`：极少数站点可能用 "comment" 命名正文节点 → 接受这风险
 *   （V2EX、简书等都是真的评论结构）
 */
export function patchDocForExtraction(doc: Document): void {
  const noiseSelectors: string[] = [
    '[role="complementary"]', // aside 区域
    '[role="navigation"]', // 导航
    '[class*="comment" i]', // 评论（CommentList 等 obfuscated class）
    '[id*="comment" i]', // 同上（id 维度）
    '[class*="Comment-Modal" i]', // 评论展开的 Modal
    '[class*="Comment-List" i]',
    'nav',
    'footer',
  ]
  for (const sel of noiseSelectors) {
    doc.querySelectorAll(sel).forEach((el) => el.remove())
  }
}

/**
 * 从 <meta> 标签提取 title / byline 覆盖（如果存在）。
 * 知乎专栏场景：Readability 的 byline 可能被评论作者污染；
 * 用 `<meta property="og:author">` / `<meta name="author">` 覆盖更稳。
 */
export function extractMetaOverrides(doc: Document): {
  title?: string
  byline?: string
} {
  const meta = (name: string): string | undefined => {
    const el =
      doc.querySelector(`meta[property="${name}"]`) ||
      doc.querySelector(`meta[name="${name}"]`)
    return el?.getAttribute("content")?.trim() || undefined
  }
  return {
    title: meta("og:title") || meta("twitter:title"),
    byline: meta("author") || meta("og:author") || meta("twitter:creator"),
  }
}

/** 跑 Readability 拿到正文；失败返回 null。
 *
 * v0.1.1 知乎专用路径：question 主页多回答共存时，Readability 启发式不可靠，
 * 直接用 schema.org 标记定位 wrapper + viewport 中央匹配 + data-zop 解析作者。
 * 其它站点走原 Readability 路径不受影响。
 */
export function extractRaw(): RawArticle | null {
  // 知乎：走专用路径，不依赖 Readability
  if (location.host.includes("zhihu.com")) {
    return extractZhihu()
  }
  return extractWithReadability()
}

/** 知乎专用提取：基于 schema.org Answer 标记 + viewport 中央匹配 */
function extractZhihu(): RawArticle | null {
  // 最稳 selector：schema.org Answer 标记（知乎自己用，改了会丢 SEO）
  const wrappers = Array.from(
    document.querySelectorAll('[itemtype="http://schema.org/Answer"]'),
  )
  if (wrappers.length === 0) return null

  // 找视口中央的 wrapper（live document，layout 正常）
  const viewportCenterY = window.innerHeight / 2
  const visible = wrappers
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .filter(({ rect }) => rect.bottom > 0 && rect.top < window.innerHeight * 2)
    .sort((a, b) => {
      const aCenter = a.rect.top + a.rect.height / 2
      const bCenter = b.rect.top + b.rect.height / 2
      return Math.abs(aCenter - viewportCenterY) - Math.abs(bCenter - viewportCenterY)
    })
  const targetWrapper = visible[0]?.el || wrappers[0]

  // 作者：从 data-zop JSON 里取 authorName（HTML-encoded，需要解码）
  let author: string | undefined
  try {
    const zopAttr = targetWrapper.getAttribute("data-zop")
    if (zopAttr) {
      const zop = JSON.parse(zopAttr.replace(/&quot;/g, '"')) as {
        authorName?: string
      }
      author = zop.authorName
    }
  } catch {
    // ignore — 知乎改版时 data-zop 格式可能变
  }

  // 标题：og:title 优先（如"互联网已经将绝大部分信息差..."）
  const ogTitle = document
    .querySelector('meta[property="og:title"]')
    ?.getAttribute("content")
  const title = ogTitle || document.title || "untitled"

  // excerpt：正文 RichText 的前 200 字
  const textSpan = targetWrapper.querySelector('[itemprop="text"]')
  const excerpt = (textSpan?.textContent || "").slice(0, 200).trim()

  // off-DOM 容器（保留 collectImageUrls 范围限定）
  const wrapperClone = targetWrapper.cloneNode(true) as HTMLElement

  return {
    title,
    byline: author,
    siteName: "知乎",
    excerpt: excerpt || undefined,
    contentHtml: wrapperClone.innerHTML,
    textContent: wrapperClone.textContent || "",
    articleElement: wrapperClone,
  }
}

/** 原 Readability 提取路径（其它站点用） */
function extractWithReadability(): RawArticle | null {
  try {
    const docClone = document.cloneNode(true) as Document
    // 先清掉评论 / 侧栏 / 导航噪声节点（修知乎专栏等长尾评论结构）
    patchDocForExtraction(docClone)
    const reader = new Readability(docClone, {
      debug: false,
      charThreshold: 200,
      keepClasses: false,
    })
    const parsed = reader.parse()
    if (!parsed) return null
    // meta 覆盖：知乎专栏 og:author / og:title 比 Readability 解析更准
    const overrides = extractMetaOverrides(docClone)
    // off-DOM 容器：把 Readability 输出的 HTML 塞进一个 div，
    //   后续 collectImageUrls 只在这个子树里找 img，避免全页面噪声。
    const articleElement = document.createElement("div")
    articleElement.innerHTML = parsed.content || ""
    return {
      title: overrides.title || parsed.title || document.title || "untitled",
      byline: overrides.byline || parsed.byline || undefined,
      siteName: parsed.siteName || undefined,
      excerpt: parsed.excerpt || undefined,
      contentHtml: parsed.content || "",
      textContent: parsed.textContent || "",
      articleElement,
    }
  } catch (e) {
    console.error("[WebPageStore] Readability 失败", e)
    return null
  }
}

/**
 * 收集 article 子树里的 <img> URL，过滤掉过小 / data / blob 图。
 *   - 范围限定在 `root` 子树里（v0.1 默认是 Readability 输出元素）；
 *     不传则降级到全文档（兜底）。
 *   - 取图顺序：currentSrc > src > 懒加载 data-src/srcset/lazy-src。
 *
 * ⚠️ off-DOM 路径的局限：
 *   `root` 是 `document.createElement("div")` 后塞 innerHTML 的容器，未 attach 到 document。
 *   对 detached 元素：`img.naturalWidth` / `img.width` 永远为 0，
 *   `img.currentSrc` 永远为空（图片未加载）。
 *   → 下面的小图 guard 仅在 fallback 到 `document` 路径时才会生效。
 *   → `currentSrc` 永远走不到，只能用 src/data-src/srcset。
 *   v0.2 接 images 下载时需要 attach 容器到 body 触发真实加载；v0.1 不下载图片，**不影响功能**。
 */
export function collectImageUrls(root: ParentNode | null = null, max = 30): string[] {
  const scope = root ?? document
  const urls = new Set<string>()
  const imgs = scope.querySelectorAll("img")
  for (const img of Array.from(imgs)) {
    const src =
      (img.currentSrc ||
        img.getAttribute("src") ||
        img.getAttribute("data-src") ||
        img.getAttribute("lazy-src") ||
        (img.getAttribute("srcset") || "").split(",")[0]?.trim().split(/\s+/)[0] ||
        "").trim()
    if (!src) continue
    if (src.startsWith("data:")) continue
    if (src.startsWith("blob:")) continue
    // 小图过滤：仅当 image 已 attach 到 document 且已加载（naturalWidth > 0）时生效；
    // off-DOM 路径下两个 guard 都因 naturalWidth/width == 0 永不触发（已知，见上）。
    if (img.naturalWidth > 0 && img.naturalWidth < 50) continue
    if (img.width > 0 && img.width < 50) continue
    urls.add(src)
    if (urls.size >= max) break
  }
  return Array.from(urls)
}

/**
 * Turndown 把 HTML 转 Markdown。
 *   - `input` 可为 HTML 字符串或 Element；Element 路径省一次 DOM parse。
 */
export function htmlToMarkdown(input: string | HTMLElement): string {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    linkStyle: "inlined",
  })

  // 保留代码块语言标记
  td.addRule("fencedCode", {
    filter: (node: any) =>
      node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE",
    replacement: (_: string, node: any) => {
      const code = node.firstChild as HTMLElement
      const className = code.getAttribute("class") || ""
      const langMatch =
        className.match(/language-(\w+)/) ||
        className.match(/lang-(\w+)/) ||
        className.match(/highlight-source-(\w+)/)
      const lang = langMatch ? langMatch[1] : ""
      const text = (code.textContent || "")
        .replace(/\n+$/, "")
        .replace(/^\n+/, "")
      return "\n\n```" + lang + "\n" + text + "\n```\n\n"
    },
  })

  // 去掉明显垃圾元素
  td.remove([
    "script",
    "style",
    "noscript",
    "iframe",
    "form",
    "button",
    "input",
  ])

  try {
    return td.turndown(input)
  } catch (e) {
    console.error("[WebPageStore] Turndown 失败", e)
    return typeof input === "string" ? input : input.outerHTML
  }
}

/** 在 Markdown 顶部加一段引用块 frontmatter，便于归档后追溯。
 *
 * 输出格式（每行 `> ` 前缀 + emoji 装饰）：
 *   > 📖 标题: "..."
 *   > 🔗 原文链接: "[原文链接](https://...)"
 *   > 🤵 作者: "..."
 *   > ...
 *   > ✂️ 本文由WebPageStore（网页剪存）一键剪存
 *
 * 注意：放弃 YAML 语法 —— 引用块在 markdown viewer 里视觉是引用，但不进 pandoc /
 * hugo / jekyll frontmatter 解析。如果将来要恢复机器可读 frontmatter，再叠一段 YAML。
 */
export function prependFrontMatter(meta: {
  title: string
  sourceUrl: string
  siteName?: string
  byline?: string
  excerpt?: string
  fetchedAt: string
}): string {
  const lines: string[] = []
  // 每行 `> ` 前缀 → markdown 渲染时整个 frontmatter 区段是引用块
  lines.push(`> 📖 标题: "${meta.title}"`)
  // 原文链接用 markdown 链接文本格式，emoji 起视觉装饰
  lines.push(`> 🔗 原文链接: "[原文链接](${meta.sourceUrl})"`)
  if (meta.byline) lines.push(`> 🤵 作者: "${meta.byline}"`)
  if (meta.siteName) lines.push(`> ♻️ 站点: "${meta.siteName}"`)
  if (meta.excerpt) lines.push(`> 🎈 摘要: "${meta.excerpt}"`)
  lines.push(`> ⏱️ 抓取时间: "${meta.fetchedAt}"`)
  // 末尾固定署名行（去掉方括号 —— 按用户 B 选项）
  lines.push(`> ✂️ 本文由WebPageStore（网页剪存）一键剪存`)
  // 引用块末尾留两个空行（按用户 A 选项），区分正文开始
  lines.push("", "")
  return lines.join("\n")
}
