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

// ---- v0.3 语雀相关提示 ----
//
// popup / options 按 `code` 字段决定提示文案。
// 这里集中存放文案，让 popup / options 不写 inline 字符串（便于 i18n）。

/** 401 —— token 失效 / 错。引导用户去重新生成。 */
export const YUQUE_TOKEN_INVALID_HINT =
  "语雀 Token 无效或已失效，请到 https://www.yuque.com/settings/token 重新生成。"

/** 404 —— namespace 不存在或知识库未公开。 */
export const YUQUE_NAMESPACE_INVALID_HINT =
  "语雀 namespace 找不到（请确认 login/repo_slug 拼写正确，并在语雀后台把知识库设为公开）。"

/** fetch 抛异常 / 网络错。 */
export const YUQUE_NETWORK_HINT = "网络错误，请检查网络连接后重试。"

/** 429 —— 语雀 API 限流。 */
export const YUQUE_QUOTA_HINT =
  "语雀 API 限流（429），请稍等几秒后重试。"

/** 5xx —— 语雀服务端错。 */
export const YUQUE_SERVER_HINT = "语雀服务器错误（5xx），请稍等后重试。"

/** payload 里 markdown 为空 —— 不是网络问题，是 popup 调用 bug 或 extract 出错。 */
export const YUQUE_NO_MARKDOWN_HINT =
  "没有可上传的 Markdown 内容（抓取可能失败，请重新打开 popup 再试）。"

/** 用户没配 token / namespace 就选了"语雀"目标。触发 D5-3 banner。 */
export const YUQUE_CONFIG_MISSING_HINT =
  "未配置语雀 Token + namespace，请先到扩展选项页填写。"

/**
 * navigator.clipboard.writeText 失败时的兜底文案。
 * popup 是 chrome-extension://（secure context），正常不会失败；
 * 失败一般是：浏览器版本过旧、用户拒了剪贴板权限、或 page 处于非 secure context。
 */
export const COPY_FAIL_HINT =
  "复制失败：浏览器剪贴板权限被拒或浏览器版本过旧，请检查权限或升级浏览器。"
