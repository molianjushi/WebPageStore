// content script：监听 background 的 extract 请求，把当前页面整成 Markdown。
// 注入时机：按需 —— popup 打开时由 background 调 chrome.scripting.executeScript 注入。
//   （manifest.json 不再声明 content_scripts；MV3 Chrome 商店审核对 <all_urls> 静态注入
//    会发警告，且每个网页都跑 readability 浪费内存。）
//
// 兼容性说明（绕开 Plasmo 之后）：
// - 原 PlasmoCSConfig（runAt）已迁到 background 的 executeScript 调用（默认 document_idle
//   时机不再适用 —— 这里 content 是在用户点击插件图标时注入，document 可能还没 ready）。
// - 当前文件只关心消息处理 + 提取逻辑，与构建系统解耦。

import { extractRaw, collectImageUrls, htmlToMarkdown, prependFrontMatter } from "./lib/extract"
import { errMsg } from "./lib/util"
import { fail, okExtract, type ExtractRequest, type ExtractResponse } from "./types"

/**
 * 重复注入防护：background 即使修复了"先 sendMessage 再 inject"，极端时序下
 * 也可能再注入一次（worker 刚启动、注入中又收到 popup 消息）。
 * 用 globalThis flag 兜底：第二次注入时不注册 listener，直接 no-op。
 * 注意：每个 content script 运行在独立的 world（ISOLATED），但同一个 tab 注入
 * 多次会复用同一个 globalThis —— 所以 flag 在 tab 生命周期内有效。
 */
declare global {
  // eslint-disable-next-line no-var
  var __wps_injected: boolean | undefined
}

if (!globalThis.__wps_injected) {
  globalThis.__wps_injected = true
  registerContentListener()
}

function registerContentListener() {
  chrome.runtime.onMessage.addListener(
    (req: unknown, _sender, sendResponse: (r: ExtractResponse) => void) => {
      const m = req as ExtractRequest
      if (!m || m.type !== "extract") return false

      // 按需注入后失去了 manifest content_scripts 的 `document_idle` 时机，
      // 用户在 SPA 还没 hydrate 完时点图标会抓到空壳。这里主动等到 readyState=complete
      // （SPA 一般 load 后就 idle；极端 SPA 可能还需要轮询，但 v0.1 不处理）。
      waitForDocumentComplete()
        .then(() => doExtract(sendResponse))
        .catch((e) => {
          sendResponse(fail(errMsg(e)))
        })

      // 关键：return true 表示 sendResponse 会被异步调用；保持一致防未来加异步 IO 丢响应。
      return true
    },
  )
}

function waitForDocumentComplete(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve()
  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true })
  })
}

function doExtract(sendResponse: (r: ExtractResponse) => void) {
  try {
    const raw = extractRaw()  // 正则提取 返回 {title, byline, siteName, excerpt, contentHtml, articleElement}
    if (!raw) {
      sendResponse(
        fail('正文提取失败（页面结构可能太特殊，试试浏览器自带的"阅读模式"对比下）'),
      )
      return
    }
    const markdown =
      prependFrontMatter({
        title: raw.title,
        sourceUrl: location.href,
        siteName: raw.siteName,
        byline: raw.byline,
        excerpt: raw.excerpt,
        fetchedAt: new Date().toISOString(),
      }) + htmlToMarkdown(raw.articleElement) // 接 Element 复用 articleElement，省一次 parse

    const imageUrls = collectImageUrls(raw.articleElement, 30)
    sendResponse(
      okExtract({
        title: raw.title,
        byline: raw.byline,
        siteName: raw.siteName,
        excerpt: raw.excerpt,
        markdown,
        imageUrls,
        sourceUrl: location.href,
      }),
    )
  } catch (e: any) {
    sendResponse(fail(errMsg(e)))
  }
}
