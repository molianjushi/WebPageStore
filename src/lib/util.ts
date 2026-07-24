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

// ---- v0.3 语雀 HTTP ----
//
// 设计要点：
// - WEBPAGE_STORE_VERSION 写死在这里，不读 manifest.json —— 避免改 build.mjs
//   做 string replace。bump 时三处（manifest / package / 这里）一起改。
// - yuqueFetch 集中注入 UA + Token + Content-Type，避免每个调用都重复设。
// - UA 必须非空，否则语雀返回 400（调研结论）。
// - 不引入 axios / ky：用浏览器原生 fetch，体积小；MV3 SW 不需要 node http。

/** 当前扩展版本 —— 与 manifest.json / package.json 保持一致。 */
export const WEBPAGE_STORE_VERSION = "0.1.2"

const YUQUE_BASE_URL = "https://www.yuque.com/api/v2"

/** 返回 `"WebPageStore/<ver>"` —— 语雀要求非空 User-Agent，否则 400。 */
export function getUserAgent(): string {
  return `WebPageStore/${WEBPAGE_STORE_VERSION}`
}

/** 语雀 fetch 包装：自动注入 UA + Token + JSON Content-Type。
 *
 * 返回原始 `Response` —— 调用方按 status 决定下一步（200 解析 JSON，401 提示换 token）。
 * 不在此层抛错：让上层把 status 转成我们自己的 `code`（401/429/5xx 等）。
 */
export async function yuqueFetch(
  path: string,
  init: { method?: string; body?: unknown } = {},
  token: string,
): Promise<Response> {
  const url = `${YUQUE_BASE_URL}${path.startsWith("/") ? path : "/" + path}`
  return fetch(url, {
    method: init.method ?? "GET",
    headers: {
      "X-Auth-Token": token,
      "User-Agent": getUserAgent(),
      "Content-Type": "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}
