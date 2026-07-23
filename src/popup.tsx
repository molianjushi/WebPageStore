// popup 主组件。打开 popup 时自动向当前标签页的 content script 发"extract"消息，
// 拿到结构化结果后展示，让用户编辑标题 / 触发保存。
//
// 关键决策：
// 1. 用 chrome.tabs.sendMessage（不是 chrome.runtime.sendMessage）——
//    前者能把消息路由到 *当前 tab* 的 content script，后者只能到 background。
// 2. 弹出即自动抓取，不做"重新提取"按钮 —— v0.1 内容提取稳定，少一次点击。
// 3. 标题 input 可编辑，避免 Readability 取错标题时无法修正。
// 4. "保存到语雀"按钮 disabled + 标 v0.3 —— 提前占位，避免误点。
// 5. 直接用 chrome.runtime.sendMessage 转发到 background，绕过 @plasmohq/messaging
//    这一层抽象（少学一套 API，减少小白的心智负担）。
//
// 兼容性：MV3 popup 在用户点扩展图标时打开，点击外侧自动关闭；所以"保存中..."状态
// 必须很快返回（download 是 ms 级），不要在这里放超过 1s 的 IO。

import { useEffect, useState } from "react"
import "./popup.css"
import type { ExtractResponse, LocalSaveResponse } from "./types"

type UiState =
  | { kind: "loading" }
  | { kind: "ready"; data: ExtractResponse & { ok: true } }
  | { kind: "error"; message: string }
  | { kind: "saving" }
  | { kind: "saved"; filename: string }
  | { kind: "saveFailed"; message: string }

export default function Popup() {
  const [state, setState] = useState<UiState>({ kind: "loading" })
  const [title, setTitle] = useState("")

  // 挂载时主动抓取当前页
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        if (!tab?.id) {
          if (!cancelled) setState({ kind: "error", message: "找不到当前标签页" })
          return
        }

        // 走 tabs.sendMessage 会路由到该 tab 的 content.ts
        const res = (await chrome.tabs.sendMessage(tab.id, {
          type: "extract",
        })) as ExtractResponse

        if (cancelled) return
        if (!res.ok) {
          setState({ kind: "error", message: res.error })
        } else {
          setTitle(res.title || "")
          setState({ kind: "ready", data: res })
        }
      } catch (e: any) {
        // 异常常见原因：content script 被页面 CSP 拒了 / 当前 tab 不是 http(s)
        if (!cancelled)
          setState({
            kind: "error",
            message:
              (e?.message ?? String(e)) +
              "（提示：当前页可能无法注入脚本，例如 chrome:// 页面、PDF、严格的 CSP 站点）",
          })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSaveLocal() {
    if (state.kind !== "ready") return
    setState({ kind: "saving" })
    try {
      const res = (await chrome.runtime.sendMessage({
        type: "saveLocal",
        payload: {
          title: title || state.data.title,
          markdown: state.data.markdown,
          sourceUrl: state.data.sourceUrl,
        },
      })) as LocalSaveResponse

      if (res.ok) {
        setState({ kind: "saved", filename: res.filename })
        // 1.5s 后自动关闭 popup（让用户看到成功提示）
        setTimeout(() => window.close(), 1500)
      } else {
        setState({ kind: "saveFailed", message: res.error })
      }
    } catch (e: any) {
      setState({ kind: "saveFailed", message: e?.message ?? String(e) })
    }
  }

  // --- 渲染分支 ---

  if (state.kind === "loading") {
    return (
      <Shell>
        <div className="text-sm text-gray-600">正在抓取当前页…</div>
      </Shell>
    )
  }

  if (state.kind === "error") {
    return (
      <Shell>
        <div className="text-sm">
          <div className="text-red-600 font-semibold mb-2">❌ 抓取失败</div>
          <div className="text-gray-700 whitespace-pre-wrap break-words">
            {state.message}
          </div>
        </div>
      </Shell>
    )
  }

  if (state.kind === "saving") {
    return (
      <Shell>
        <div className="text-sm text-gray-700">正在保存到本地…</div>
      </Shell>
    )
  }

  if (state.kind === "saveFailed") {
    return (
      <Shell>
        <div className="text-sm">
          <div className="text-red-600 font-semibold mb-2">❌ 保存失败</div>
          <div className="text-gray-700 whitespace-pre-wrap break-words">
            {state.message}
          </div>
        </div>
        <button
          onClick={handleSaveLocal}
          className="mt-3 w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
        >
          重试
        </button>
      </Shell>
    )
  }

  // ready / saved 都用同一个主界面，只是底部状态不同
  const data = state.kind === "ready" ? state.data : null
  const savedFilename = state.kind === "saved" ? state.filename : null

  return (
    <Shell>
      <div className="text-base font-semibold text-gray-900 mb-2">
        📥 WebPageStore
      </div>

      {data && (
        <div className="text-[11px] text-gray-400 mb-2 break-all">
          {data.sourceUrl}
        </div>
      )}

      <label className="block text-xs text-gray-500 mb-1">标题</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={data?.title}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded mb-2 focus:outline-none focus:border-blue-500"
      />

      {data?.excerpt && (
        <div className="bg-gray-50 border border-gray-200 p-2 rounded text-xs text-gray-600 mb-3 max-h-24 overflow-auto leading-relaxed">
          {data.excerpt}
        </div>
      )}

      {data && (
        <div className="text-[11px] text-gray-500 mb-3">
          Markdown 长度：
          <span className="font-mono">{data.markdown.length.toLocaleString()}</span>{" "}
          字符 · 图片：
          <span className="font-mono">{data.imageUrls.length}</span> 张
          <span className="text-gray-400">（v0.1 不下载图片）</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSaveLocal}
          disabled={state.kind !== "ready"}
          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded transition-colors"
        >
          保存到本地
        </button>
        <button
          disabled
          title="v0.3 上线 —— 配置语雀 Token 后启用"
          className="flex-1 px-3 py-2 bg-gray-200 text-gray-500 text-sm rounded cursor-not-allowed"
        >
          保存到语雀
        </button>
      </div>

      {savedFilename && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 text-green-700 text-xs rounded break-all">
          ✅ 已保存
          <div className="font-mono mt-1">{savedFilename}</div>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-96 p-4 text-sm leading-relaxed bg-white text-gray-900 font-sans">
      {children}
    </div>
  )
}
