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

// ---- v0.3 语雀配置 ----

export interface YuqueConfig {
  token: string
  namespace: string
}

/** chrome.storage.local 单 key —— 简化读 / 写 / 清。 */
export const KEY_YUQUE_CONFIG = "yuqueConfig"

/**
 * popup 主界面"保存目标" radio 的 3 选项。
 * v0.4 新增 "clipboard" —— 提到 types.ts 共享给 popup.tsx 和 storage.ts，
 * 避免类型重复声明。
 *
 * 顺序约定（v0.4 用户拍板）：剪切板 / 本地 / 语雀
 * —— UI 顺序写在 popup.tsx 的 Radio options 里（data-driven），不在这里管。
 */
export type Target = "local" | "clipboard" | "yuque"
/** chrome.storage.local 单 key —— 记住用户上一次的 target 选择。 */
export const KEY_TARGET = "target"

// ---- v0.3 消息协议 ----
//
// 设计要点：
// - 错误响应带 `code` 字段（optional）—— popup / options 按 code 决定提示文案与重试策略
// - "no_token" / "no_namespace" 表示**配置缺失**（不同于 API 错误），
//   popup 用它触发 D5-3 的"去 options" banner，而不是泛错误
// - 工厂 okYuque() / failYuque() 集中构造，与现有 okExtract / fail 风格一致

export type SetYuqueConfigRequest = {
  type: "setYuqueConfig"
  config: YuqueConfig
}
export type SetYuqueConfigSuccess = { ok: true }
export type SetYuqueConfigFailure = { ok: false; error: string }
export type SetYuqueConfigResponse = SetYuqueConfigSuccess | SetYuqueConfigFailure

export type ClearYuqueConfigRequest = { type: "clearYuqueConfig" }
export type ClearYuqueConfigResponse = { ok: true } | { ok: false; error: string }

/** options 页存盘时调：验 token + 验 namespace 同时进行。 */
export type YuqueSanityRequest = { type: "yuqueSanity" }
export type YuqueSanitySuccess = {
  ok: true
  login: string
  repoTitle: string
  publicLevel: number
}
/** `code` 区分错误类型 —— options 按 code 决定提示。 */
export type YuqueSanityCode =
  | "no_token"
  | "no_namespace"
  | "401"
  | "404"
  | "429"
  | "5xx"
  | "network"
export type YuqueSanityFailure = { ok: false; error: string; code: YuqueSanityCode }
export type YuqueSanityResponse = YuqueSanitySuccess | YuqueSanityFailure

/** popup 点"保存到语雀"时调 —— 主体功能。 */
export type YuqueUploadRequest = {
  type: "yuqueUpload"
  payload: {
    title: string
    markdown: string
    sourceUrl: string
  }
}
export type YuqueUploadSuccess = { ok: true; docUrl: string; docId: number }
export type YuqueUploadCode =
  | "no_token"
  | "no_namespace"
  | "no_markdown"
  | "401"
  | "404"
  | "429"
  | "5xx"
  | "network"
export type YuqueUploadFailure = { ok: false; error: string; code: YuqueUploadCode }
export type YuqueUploadResponse = YuqueUploadSuccess | YuqueUploadFailure

// ---- v0.3 响应工厂 ----
//
// 注意：v0.4 删了 okYuqueConfig —— popup / options 直接 import storage.getYuqueConfig()，
// 不再绕 background 走 message 协议，所以 GetYuqueConfigSuccess / GetYuqueConfigResponse 都已删除。

export function okYuqueSanity(
  data: Omit<YuqueSanitySuccess, "ok">,
): YuqueSanitySuccess {
  return { ok: true, ...data }
}

export function okYuqueUpload(
  data: Omit<YuqueUploadSuccess, "ok">,
): YuqueUploadSuccess {
  return { ok: true, ...data }
}
