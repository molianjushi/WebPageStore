// 文件名清洗 — Windows 不允许 \ / : * ? " < > |，且全文件名长度 ≤ 255。

const FORBIDDEN = /[\\/:*?"<>|\x00-\x1f]/g

export function sanitizeFilename(input: string | null | undefined, max = 100): string {
  if (!input) return "untitled"
  let s = input.trim()
  s = s.replace(FORBIDDEN, "_")
  // 折叠空白
  s = s.replace(/\s+/g, " ")
  // 去掉首尾的 . 或空格
  s = s.replace(/^[.\s]+|[.\s]+$/g, "")
  if (s.length > max) s = s.slice(0, max).trim()
  if (!s) s = "untitled"
  return s
}

/** 返回 yyyyMMdd_HHmmss，2026-07-23 17:13:42 → 20260723_171342 */
export function timestampForFilename(d: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}
