// popup 主组件。打开 popup 时主动抓取当前标签页的正文，让用户编辑标题 / 触发保存。
//
// 关键决策：
// 1. popup 自己查当前 tab 拿 tabId，再 chrome.runtime.sendMessage({tabId}) 给 background。
//    这是 v0.1 的关键改动：service worker 不能用 `tabs.query({currentWindow:true})`，
//    所以由 popup（自然绑定一个 window）传 tabId。
// 2. 弹出即自动抓取，不做"重新提取"按钮 —— v0.1 内容提取稳定，少一次点击。
// 3. 标题 input 可编辑，避免 Readability 取错标题时无法修正。
// 4. "保存到语雀"按钮 disabled + 标 v0.3 —— 提前占位，避免误点。
// 5. 跳过 @plasmohq/messaging 这一层抽象（少学一套 API，减少小白的心智负担）。
//
// 兼容性：MV3 popup 在用户点扩展图标时打开，点击外侧自动关闭；所以"保存中..."状态
// 必须很快返回（download 是 ms 级），不要在这里放超过 1s 的 IO。

import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import "./popup.css"
import { errMsg } from "./lib/util"
import { INJECT_FAIL_HINT } from "./lib/messages"
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

  // 挂载时主动抓取当前页 —— 走 background 中转，由 background 按需注入 content script。
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // popup 自然绑定一个 window，自己查当前 tab 拿 tabId
        // （service worker 没有 currentWindow 概念，必须由 popup 传过去）。
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        if (!tab?.id) {
          if (!cancelled) setState({ kind: "error", message: "找不到当前标签页" })
          return
        }
        // 不再 chrome.tabs.sendMessage：content script 已不再常驻（manifest 不声明 content_scripts）。
        // 这里让 background 接管：先试 sendMessage（已注入则直接拿结果）→ 否则注入 content.js → 再 sendMessage。
        const res = (await chrome.runtime.sendMessage({
          type: "popupExtract",
          tabId: tab.id,
        })) as ExtractResponse

        if (cancelled) return
        if (!res.ok) {
          setState({ kind: "error", message: res.error })
        } else {
          setTitle(res.title || "")
          setState({ kind: "ready", data: res })
        }
      } catch (e: any) {
        if (!cancelled)
          setState({
            kind: "error",
            message: errMsg(e) + INJECT_FAIL_HINT,
          })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSaveLocal() {
    // 修复 retry no-op bug：原代码这里写 `if (state.kind !== "ready") return`，
    // 导致 saveFailed 分支的"重试"按钮点不动。
    // 改成：只有 ready 分支有 state.data；其他分支的 retry 由按钮单独处理（见 saveFailed 分支）。
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
      setState({ kind: "saveFailed", message: errMsg(e) })
    }
  }

  // saveFailed 分支的"重试"按钮：保留 ready 状态以复用 handleSaveLocal。
  function handleRetrySave() {
    // 把 UI 倒回 ready，让 handleSaveLocal 能正常走 ready 分支。
    // 注意：data 已经丢了（state 切换到 saveFailed 后被覆盖），
    // 所以 retry 实际上要重新跑 extract —— 通过 setState("loading") 让用户感知。
    setState({ kind: "loading" })
    // 重新触发 useEffect 等价动作：手动重新查 tab + sendMessage。
    ;(async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        if (!tab?.id) {
          setState({ kind: "error", message: "找不到当前标签页" })
          return
        }
        const res = (await chrome.runtime.sendMessage({
          type: "popupExtract",
          tabId: tab.id,
        })) as ExtractResponse
        if (!res.ok) {
          setState({ kind: "error", message: res.error })
          return
        }
        setTitle(res.title || "")
        setState({ kind: "ready", data: res })
        // 抓到后立刻重试保存
        const saveRes = (await chrome.runtime.sendMessage({
          type: "saveLocal",
          payload: {
            title: res.title,
            markdown: res.markdown,
            sourceUrl: res.sourceUrl,
          },
        })) as LocalSaveResponse
        if (saveRes.ok) {
          setState({ kind: "saved", filename: saveRes.filename })
          setTimeout(() => window.close(), 1500)
        } else {
          setState({ kind: "saveFailed", message: saveRes.error })
        }
      } catch (e: any) {
        setState({ kind: "saveFailed", message: errMsg(e) })
      }
    })()
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
          onClick={handleRetrySave}
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
      <label className="block text-xs text-gray-500 mb-1">描述</label>
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

// 挂载：popup.html 里有 <div id="root"></div>，这里把 React 树挂上去。
// （plasmo 迁出后必加，否则 popup 打开是空白白页。）
const container = document.getElementById("root")
if (!container) throw new Error("#root not found in popup.html")
createRoot(container).render(<Popup />)

// 删了原本的 `export default Popup`：esbuild 以 IIFE 模式 bundle 入口，
// 入口文件顶层 createRoot().render() 才是真正的 mount；export default 是 plasmo 时代的
// 残留（plasmo 会读 default export 当入口组件），现在没人 import，留着会强制 emit exports 对象。
