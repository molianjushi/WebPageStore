// 跨 background / popup / content 共用的小工具。
// 当前只放错误归一化：避免三处 `e?.message ?? String(e)` 各自漂移。

/**
 * 把任意 thrown value 转成 printable 字符串。
 * 顺序：null/undefined → "未知错误"；string → 原样；Error → message；
 * 其它 → JSON.stringify（带 try/catch 防止循环引用炸）。
 */
export function errMsg(e: unknown): string {
  if (e == null) return "未知错误"
  if (typeof e === "string") return e
  if (e instanceof Error) return e.message
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

/**
 * 从 chrome.runtime.lastError 安全取 message。
 * 大多数 lastError 必有 .message；fallback 用 errMsg 兜底（实际几乎不触发）。
 */
export function lastErrorMsg(): string {
  const le = chrome.runtime.lastError
  if (!le) return ""
  return le.message ?? errMsg(le)
}
