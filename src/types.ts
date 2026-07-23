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
