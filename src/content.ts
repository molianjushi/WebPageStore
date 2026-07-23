// content script：监听 popup 的 extract 请求，把当前页面整成 Markdown。

import type { PlasmoCSConfig } from "plasmo"
import {
  extractRaw,
  collectImageUrls,
  htmlToMarkdown,
  prependFrontMatter,
} from "./lib/extract"
import type { ExtractRequest, ExtractResponse } from "./types"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  // 需等页面骨架就绪后再让 Readability 判定正文，所以选 document_idle
  runAt: "document_idle",
  // 不要"所有 frame" —— 多数站点顶层就能拿到，嵌套 iframe 留给后续
  all_frames: false,
}

chrome.runtime.onMessage.addListener(
  (req: unknown, _sender, sendResponse: (r: ExtractResponse) => void) => {
    const m = req as ExtractRequest
    if (!m || m.type !== "extract") return false

    try {
      const raw = extractRaw()
      if (!raw) {
        sendResponse({ ok: false, error: "正文提取失败（页面结构可能太特殊，尝试用浏览器自带的"阅读模式"对比一下）" })
        return false
      }
      const markdown =
        prependFrontMatter({
          title: raw.title,
          sourceUrl: location.href,
          siteName: raw.siteName,
          byline: raw.byline,
          excerpt: raw.excerpt,
          fetchedAt: new Date().toISOString(),
        }) + htmlToMarkdown(raw.contentHtml)

      const imageUrls = collectImageUrls(30)
      sendResponse({
        ok: true,
        title: raw.title,
        byline: raw.byline,
        siteName: raw.siteName,
        excerpt: raw.excerpt,
        markdown,
        imageUrls,
        sourceUrl: location.href,
      })
    } catch (e: any) {
      sendResponse({ ok: false, error: e?.message ?? String(e) })
    }
    return false
  },
)
