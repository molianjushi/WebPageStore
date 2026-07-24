// 语雀 API 封装 —— v0.3 最小版：getUser / getRepo / createDoc。
//
// 设计要点：
// - 不抛错：每个函数返回 discriminated union；调用方按 code 决定 UI 文案。
//   与 types.ts 里的 YuqueSanityResponse / YuqueUploadResponse union 对应。
// - HTTP 状态码 → 我们的 code：401 → "401"（token 失效）/ 404 → "404"（namespace 错）/
//   429 → "429"（限流）/ 5xx → "5xx"（服务端错）/ 其它 → "network"（兜底）。
// - 用 lib/util.ts 的 yuqueFetch（UA + Token 已注入）—— 不重复设 header。
// - 不引 axios / ky：原生 fetch 够用。

import { yuqueFetch } from "./util"

interface YuqueUserResponse {
  id: number
  login: string
  name: string
}

interface YuqueRepoResponse {
  id: number
  title: string
  /** 0 私密 / 1 公开 / 2 团队内可见 —— 数字，调研结论。 */
  public: 0 | 1 | 2
  namespace: string
}

interface YuqueDocResponse {
  id: number
  slug: string
  title: string
  url: string
}

interface YuqueErrorResponse {
  message?: string
}

// ---- helper ----

/** 把 Response 转成我们的 code。 */
function classifyStatus(res: Response): "401" | "404" | "429" | "5xx" | "network" {
  if (res.status === 401) return "401"
  if (res.status === 404) return "404"
  if (res.status === 429) return "429"
  if (res.status >= 500 && res.status < 600) return "5xx"
  return "network"
}

/** 从错误响应体拿 message —— fallback 到 statusText / HTTP code。 */
async function errorMessage(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as YuqueErrorResponse | { data?: YuqueErrorResponse }
    const msg = (json && "data" in json ? json.data?.message : (json as YuqueErrorResponse).message)
    return msg || res.statusText || `HTTP ${res.status}`
  } catch {
    return res.statusText || `HTTP ${res.status}`
  }
}

/**
 * 语雀 OpenAPI v2 把所有成功响应包在 `{data: ...}` envelope 里。
 * 这里统一 unwrap —— 如果根上没 `data` 字段（旧版 / 异常），fallback 到根。
 *
 * 失败抛 —— 调用方负责 try/catch 兜底（service worker handler 会捕获并 sendResponse）。
 */
async function parseData<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { data?: T } | T
  if (json && typeof json === "object" && "data" in json && json.data !== undefined) {
    return json.data
  }
  return json as T
}

// ---- API ----

export type GetUserResult =
  | { ok: true; login: string }
  | { ok: false; error: string; code: "401" | "network" }

/** 拿当前用户（用于 sanity check 显示当前 login）。 */
export async function getUser(token: string): Promise<GetUserResult> {
  let res: Response
  try {
    res = await yuqueFetch("/user", {}, token)
  } catch {
    return { ok: false, error: "网络错误，请检查网络连接", code: "network" }
  }
  if (!res.ok) {
    const code = classifyStatus(res)
    // 401 / network 是 getUser 唯一可能的状态
    return { ok: false, error: await errorMessage(res), code: code === "401" ? "401" : "network" }
  }
  const data = await parseData<YuqueUserResponse>(res)
  return { ok: true, login: data.login }
}

export type GetRepoResult =
  | { ok: true; title: string; publicLevel: 0 | 1 | 2 }
  | { ok: false; error: string; code: "401" | "404" | "network" }

/** 拿知识库信息（用于 sanity check 显示 title + 公开性）。 */
export async function getRepo(
  token: string,
  namespace: string,
): Promise<GetRepoResult> {
  let res: Response
  try {
    res = await yuqueFetch(`/repos/${namespace}`, {}, token)
  } catch {
    return { ok: false, error: "网络错误", code: "network" }
  }
  if (!res.ok) {
    const code = classifyStatus(res)
    return {
      ok: false,
      error: await errorMessage(res),
      code: code === "401" || code === "404" ? code : "network",
    }
  }
  const data = await parseData<YuqueRepoResponse>(res)
  return { ok: true, title: data.title, publicLevel: data.public }
}

export type CreateDocResult =
  | { ok: true; docUrl: string; docId: number }
  | {
      ok: false
      error: string
      code: "401" | "404" | "429" | "5xx" | "network"
    }

/** 在指定知识库根目录下创建一篇文档（format=markdown，body 直传）。
 *
 * v0.3 最小版：不传 parent_uuid（open question 未确认）；默认推根目录。
 */
export async function createDoc(
  token: string,
  namespace: string,
  payload: { title: string; body: string },
): Promise<CreateDocResult> {
  let res: Response
  try {
    res = await yuqueFetch(`/repos/${namespace}/docs`, {
      method: "POST",
      body: {
        title: payload.title,
        body: payload.body,
        format: "markdown",
      },
    }, token)
  } catch {
    return { ok: false, error: "网络错误", code: "network" }
  }
  if (!res.ok) {
    const code = classifyStatus(res)
    return {
      ok: false,
      error: await errorMessage(res),
      code: code === "401" || code === "404" || code === "429" || code === "5xx" ? code : "network",
    }
  }
  const data = await parseData<YuqueDocResponse>(res)
  return {
    ok: true,
    docUrl: `https://www.yuque.com/${namespace}/${data.slug}`,
    docId: data.id,
  }
}