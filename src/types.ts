// 跨页面 / background / popup 共用的类型 & 消息协议

export type ExtractRequest = { type: "extract" }

export type ExtractSuccess = {
  ok: true
  title: string
  byline?: string
  siteName?: string
  excerpt?: string
  markdown: string
  imageUrls: string[]
  sourceUrl: string
}

export type ExtractFailure = {
  ok: false
  error: string
}

export type ExtractResponse = ExtractSuccess | ExtractFailure

/** popup → background：请求提取当前 tab 的正文。background 负责注入 content script 后再转发。
 *
 * `tabId` 必须由 popup 传入 —— service worker 没有 currentWindow 概念，
 * 自己在 SW 里 `chrome.tabs.query({currentWindow: true})` 行为未定义。
 */
export type PopupExtractRequest = { type: "popupExtract"; tabId: number }

/** popup → background：请求保存到本地。 */
export type LocalSaveRequest = {
  type: "saveLocal"
  payload: {
    title: string
    markdown: string
    sourceUrl: string
  }
}

export type LocalSaveSuccess = { ok: true; filename: string; downloadId: number }
export type LocalSaveFailure = { ok: false; error: string }
export type LocalSaveResponse = LocalSaveSuccess | LocalSaveFailure

// ---- 响应工厂 ----
//
// 用途：在 background / content 里 `sendResponse(fail("..."))` 比
//   `sendResponse({ ok: false, error: "..." })` 更不容易漏字段、更好搜索。
// 把工厂放在 types.ts（不是 lib/util.ts）是因为它们直接依赖联合类型。
//
// v0.3 给失败响应加 code / retryable 字段时，只改这里一处：
//   - ExtractFailure / LocalSaveFailure 加字段
//   - fail() 接收可选 code / retryable，自动填到对象里
// 编译器会强制所有调用点同步更新（discriminated union）。

export function fail(error: string): ExtractFailure & LocalSaveFailure {
  return { ok: false, error }
}

export function okExtract(data: Omit<ExtractSuccess, "ok">): ExtractSuccess {
  return { ok: true, ...data }
}

export function okSave(data: Omit<LocalSaveSuccess, "ok">): LocalSaveSuccess {
  return { ok: true, ...data }
}
