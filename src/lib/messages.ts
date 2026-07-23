// 跨 background / popup 共用的用户提示文案常量。
// 集中在这里：以后改措辞、加 i18n、加新场景只动一处。

/**
 * 当 chrome.scripting.executeScript 失败（页面 chrome:// / edge:// / PDF /
 * 严格 CSP 等）时，附在错误后的友好提示。background 拼错误用，popup 兜底 catch 也用。
 */
export const INJECT_FAIL_HINT =
  "（提示：当前页可能禁用了脚本，例如 chrome:// 页面、PDF、严格的 CSP 站点）"

/**
 * 当 active tab 不是 http(s) 时，直接拒绝注入，避免 noisy 的 lastError。
 * background 在 executeScript 前主动检查，给用户一个明确的解释。
 */
export const NON_HTTP_TAB_MSG =
  "当前标签页不是 http(s) 站点（chrome:// / file:// / about: / 扩展页 等），无法抓取。请切到普通网页后再试。"
