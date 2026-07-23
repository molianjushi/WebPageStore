// content.ts 用的提取层：Readability + Turndown + 图片收集 + YAML front matter。
//
// 设计要点：
// - Plasmo 默认把 src/content.ts 编译为 ISOLATED world content script，
//   它能访问页面的 DOM（只读），不会受页面 JS 干扰。
// - Readability 接受 cloned document 进行解析（避免污染原页面）。
// - Turndown 把清洗后的 HTML 转 Markdown。

import { Readability } from "@mozilla/readability"
import TurndownService from "turndown"

export interface RawArticle {
  title: string
  byline?: string
  siteName?: string
  excerpt?: string
  contentHtml: string
  textContent: string
}

/** 跑 Readability 拿到正文；失败返回 null。 */
export function extractRaw(): RawArticle | null {
  try {
    const docClone = document.cloneNode(true) as Document
    const reader = new Readability(docClone, {
      debug: false,
      charThreshold: 200,
      keepClasses: false,
    })
    const parsed = reader.parse()
    if (!parsed) return null
    return {
      title: parsed.title || document.title || "untitled",
      byline: parsed.byline || undefined,
      siteName: parsed.siteName || undefined,
      excerpt: parsed.excerpt || undefined,
      contentHtml: parsed.content || "",
      textContent: parsed.textContent || "",
    }
  } catch (e) {
    console.error("[WebPageStore] Readability 失败", e)
    return null
  }
}

/** 收集正文内的 <img> URL，过滤掉过小 / data / blob 图。 */
export function collectImageUrls(max = 30): string[] {
  const urls = new Set<string>()
  const imgs = document.querySelectorAll("img")
  for (const img of Array.from(imgs)) {
    const src = (img.currentSrc || img.getAttribute("src") || "").trim()
    if (!src) continue
    if (src.startsWith("data:")) continue
    if (src.startsWith("blob:")) continue
    if (img.naturalWidth > 0 && img.naturalWidth < 50) continue
    if (img.width > 0 && img.width < 50) continue
    urls.add(src)
    if (urls.size >= max) break
  }
  return Array.from(urls)
}

/** Turndown 把 HTML 转 Markdown。 */
export function htmlToMarkdown(html: string): string {
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
    return td.turndown(html)
  } catch (e) {
    console.error("[WebPageStore] Turndown 失败", e)
    return html
  }
}

/** 在 Markdown 顶部加一段 YAML front matter，便于归档后追溯。 */
export function prependFrontMatter(meta: {
  title: string
  sourceUrl: string
  siteName?: string
  byline?: string
  excerpt?: string
  fetchedAt: string
}): string {
  const yamlLines = ["---"]
  yamlLines.push(`title: ${meta.title}`)
  yamlLines.push(`source: ${meta.sourceUrl}`)
  if (meta.byline) yamlLines.push(`author: ${meta.byline}`)
  if (meta.siteName) yamlLines.push(`site: ${meta.siteName}`)
  if (meta.excerpt) yamlLines.push(`excerpt: ${meta.excerpt}`)
  yamlLines.push(`fetched_at: ${meta.fetchedAt}`)
  yamlLines.push("---", "")
  return yamlLines.join("\n")
}
