// background.ts —— service worker：承担跨页面资源调用（下载 / 语雀 API）。
// 注意 MV3 worker 30s 不活动会被回收，所以这里必须"一气呵成"，不放状态。

import { sanitizeFilename, timestampForFilename } from "./lib/sanitize"
import type { LocalSaveRequest, LocalSaveResponse } from "./types"

// 标记 printable 错误：避免 worker 抛 stringify 后丢信息
function errMsg(e: unknown): string {
  if (!e) return "未知错误"
  if (typeof e === "string") return e
  if (e instanceof Error) return e.message
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

chrome.runtime.onMessage.addListener(
  (req: unknown, _sender, sendResponse: (r: LocalSaveResponse) => void) => {
    const m = req as LocalSaveRequest
    if (!m || m.type !== "saveLocal") return false

    const { title, markdown, sourceUrl } = m.payload ?? ({} as any)
    if (!markdown) {
      sendResponse({ ok: false, error: "没有可保存的 Markdown 内容" })
      return false
    }

    try {
      const ts = timestampForFilename()
      const safeTitle = sanitizeFilename(title || "untitled")
      const filename = `WebPageStore/clip_${ts}_${safeTitle}.md`

      // 在 worker 里用 data URL 直接传给 chrome.downloads：
      //   - 避开 blob URL 在 worker 终止后被 revoke 的坑
      //   - Chrome downloads 接受 data: URL（max length 通常限 2MB，对 Markdown 完全够用）
      const dataUrl =
        "data:text/markdown;charset=utf-8," + encodeURIComponent(markdown)

      chrome.downloads.download(
        {
          url: dataUrl,
          filename,
          saveAs: false, // 直接存到默认下载目录；若要"每次询问"改成 true
          conflictAction: "uniquify",
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              ok: false,
              error: chrome.runtime.lastError.message ?? errMsg(chrome.runtime.lastError),
            })
          } else {
            sendResponse({ ok: true, filename, downloadId })
          }
        },
      )
      // 关键：返回 true 表示"sendResponse 会被异步调用"
      return true
    } catch (e) {
      sendResponse({ ok: false, error: errMsg(e) })
      return false
    }
  },
)

// 安装时给个空欢迎 —— 后续 v0.3 这里写"语雀首次配置引导"。
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[WebPageStore] 已安装 ~ v0.1 仅支持本地 .md 下载")
  }
})
