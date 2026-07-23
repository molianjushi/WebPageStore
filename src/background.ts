// background.ts —— service worker：承担跨页面资源调用（下载 / 语雀 API / 按需注入 content）。
// 注意 MV3 worker 30s 不活动会被回收，所以这里必须"一气呵成"，不放状态。
//
// 职责（v0.1）：
//   1. 响应 popup 的 "popupExtract" 消息：拿当前 tab → 注入 content.js → 转发 extract → 回传结果。
//      优化：先 tabs.sendMessage，失败再 executeScript（避免 listener 累积）。
//   2. 响应 popup 的 "saveLocal" 消息：data URL → chrome.downloads
//      优化：size guard 按 encodeURIComponent 后长度 + CJK 膨胀预算（1.9MB 不够，要更小）。
//   3. 安装时给个空欢迎。

import { sanitizeFilename, timestampForFilename } from "./lib/sanitize"
import { errMsg, lastErrorMsg } from "./lib/util"
import { INJECT_FAIL_HINT, NON_HTTP_TAB_MSG } from "./lib/messages"
import {
  fail,
  okSave,
  type ExtractResponse,
  type LocalSaveRequest,
  type LocalSaveResponse,
  type PopupExtractRequest,
} from "./types"

/**
 * Chrome data URL 的近似上限（实测 ~2MB）。我们按 encodeURIComponent 后的字符数算，
 * 因为 data URL 的实际长度 = "data:text/markdown;charset=utf-8," + encodeURIComponent(markdown)；
 * 又因为 CJK 字符 UTF-8 是 3 字节、encodeURIComponent 后是 9 字节 ≈ 3× 膨胀，
 * 所以 2MB 的 data URL 对应的 markdown UTF-8 字节数实际只允许 ~600KB。
 * 取 600_000 留点余量。
 */
const MAX_DATA_URL_CHARS = 600_000

/**
 * 把当前 tab 抓出来给 content 跑 extract。
 * 关键：先 tabs.sendMessage（已有 receiver → 直接拿结果），
 *       失败再 executeScript（no receiver → 注入 content.js 后再 sendMessage）。
 * 这样避免每个 popup 打开都注入 content.js 造成 listener 累积。
 */
function handlePopupExtract(
  tabId: number,
  sendResponse: (r: ExtractResponse) => void,
) {
  // scheme guard：chrome:// / edge:// / file:// / about: / 扩展页 / PDF 都不注入
  chrome.tabs.get(tabId, (tab) => {
    const url = tab?.url ?? ""
    if (!/^https?:\/\//i.test(url)) {
      sendResponse(fail(NON_HTTP_TAB_MSG))
      return
    }

    // 第 1 步：先试试当前 tab 是不是已经有 content.js receiver
    chrome.tabs.sendMessage(tabId, { type: "extract" }, (existingRes) => {
      if (!chrome.runtime.lastError && existingRes) {
        sendResponse(existingRes)
        return
      }
      // 第 2 步：没 receiver → 注入 content.js（也设置了 globalThis.__wps_injected 兜底）
      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: ["content.js"],
        },
        () => {
          const le = lastErrorMsg()
          if (le) {
            sendResponse(fail("注入失败：" + le + INJECT_FAIL_HINT))
            return
          }
          // 注入成功 → 转发 extract 请求
          chrome.tabs.sendMessage(
            tabId,
            { type: "extract" },
            (extractRes: ExtractResponse | undefined) => {
              if (chrome.runtime.lastError) {
                sendResponse(fail("提取失败：" + lastErrorMsg()))
                return
              }
              sendResponse(extractRes ?? fail("content script 没回响应"))
            },
          )
        },
      )
    })
  })
}

/**
 * 保存 markdown 到本地下载目录（data URL → chrome.downloads）。
 * 大小阈值按 encodeURIComponent 后的字符数算（避免 CJK 触发 2MB 边界）。
 */
function handleSaveLocal(
  req: LocalSaveRequest,
  sendResponse: (r: LocalSaveResponse) => void,
) {
  const { title, markdown } = req.payload ?? ({} as any)
  if (!markdown) {
    sendResponse(fail("没有可保存的 Markdown 内容"))
    return
  }

  try {
    // data URL 实际长度（不是 markdown 字节数）。中文 1 字符 → UTF-8 3 字节 → encode 后 9 字节 ≈ 3×。
    const encoded = encodeURIComponent(markdown)
    const dataUrl = "data:text/markdown;charset=utf-8," + encoded
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      sendResponse(
        fail(
          `Markdown 太长（编码后 ${(dataUrl.length / 1_000_000).toFixed(2)} MB），` +
            "超出浏览器 data URL 限制（约 2MB）。" +
            "v0.2 上线 zip 打包后会支持，请先分段剪存或改用 v0.3 的语雀上传。",
        ),
      )
      return
    }

    const ts = timestampForFilename()
    const safeTitle = sanitizeFilename(title || "untitled")
    const filename = `WebPageStore/clip_${ts}_${safeTitle}.md`

    chrome.downloads.download(
      {
        url: dataUrl,
        filename,
        saveAs: false,
        conflictAction: "uniquify",
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse(fail(lastErrorMsg() || errMsg(chrome.runtime.lastError)))
          return
        }
        sendResponse(okSave({ filename, downloadId: downloadId ?? 0 }))
      },
    )
  } catch (e) {
    sendResponse(fail(errMsg(e)))
  }
}

chrome.runtime.onMessage.addListener(
  (
    req: unknown,
    _sender,
    sendResponse: (r: ExtractResponse | LocalSaveResponse) => void,
  ) => {
    const m = req as PopupExtractRequest | LocalSaveRequest

    // ---- 分支 1：popup 触发抓取（→ 优先 sendMessage，失败再注入 content） ----
    if (m?.type === "popupExtract") {
      const tabId = (m as PopupExtractRequest).tabId
      if (typeof tabId !== "number") {
        sendResponse(fail("popup 没传 tabId（service worker 不能自己查 currentWindow）"))
        return false
      }
      handlePopupExtract(tabId, sendResponse as (r: ExtractResponse) => void)
      return true // 异步 sendResponse
    }

    // ---- 分支 2：popup 触发保存 ----
    if (m?.type === "saveLocal") {
      handleSaveLocal(m as LocalSaveRequest, sendResponse as (r: LocalSaveResponse) => void)
      return true // 异步 sendResponse（chrome.downloads 回调）
    }

    return false
  },
)

// 安装时给个空欢迎 —— 后续 v0.3 这里写"语雀首次配置引导"。
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[WebPageStore] 已安装 ~ v0.1 仅支持本地 .md 下载")
  }
})