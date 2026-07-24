// popup 主组件（v0.4 改造后）。打开 popup 时主动抓取当前标签页的正文 + 读语雀配置，
// 让用户选目标（剪切板 / 本地 / 语雀）+ 触发对应动作。
//
// 关键决策：
// 1. popup 自己查当前 tab 拿 tabId，再 chrome.runtime.sendMessage({tabId}) 给 background。
//    这是 v0.1 的关键改动：service worker 不能用 `tabs.query({currentWindow:true})`，
//    所以由 popup（自然绑定一个 window）传 tabId。
// 2. 弹出即自动抓取，不做"重新提取"按钮 —— v0.1 内容提取稳定，少一次点击。
// 3. 标题 input 可编辑，避免 Readability 取错标题时无法修正。
// 4. v0.3 新增：单选切换目标（本地 / 语雀）；未配置 + 选语雀触发 banner（D5-3）。
// 5. 跳过 @plasmohq/messaging 这一层抽象（少学一套 API，减少小白的心智负担）。
// 6. v0.4 新增：把"剪切板"作为"保存目标" radio 第 1 个选项（顺序：剪切板 / 本地 / 语雀），
//    统一一个主按钮：target=local/yuque 时按钮文案"保存"，target=clipboard 时文案"复制到剪切板"。
//    不分裂成两个独立按钮：UI 紧凑、用户认知一致（"选什么 → 点主按钮"）。
//    clipboard 分支走 navigator.clipboard.writeText 同步链（user gesture 要求）；
//    成功/失败走同一套 saved/saveFailed 状态机，不分裂独立的 copyState。
// 7. v0.4 新增：记住用户上次选的 target —— 写 chrome.storage.local，
//    下次打开 popup 时读出来；首次安装无记录默认 "local"（保持 v0.1 行为）。
//
// 兼容性：MV3 popup 在用户点扩展图标时打开，点击外侧自动关闭；所以"保存中..."状态
// 必须很快返回（saveLocal / yuqueUpload / writeText 都是 ms 级），不要在这里放超过 1s 的 IO。

import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import "./popup.css"
import { errMsg } from "./lib/util"
import { getTarget, getYuqueConfig, setTarget as setTargetToStorage } from "./lib/storage"
import {
  COPY_FAIL_HINT,
  INJECT_FAIL_HINT,
  YUQUE_CONFIG_MISSING_HINT,
  YUQUE_NETWORK_HINT,
  YUQUE_NAMESPACE_INVALID_HINT,
  YUQUE_NO_MARKDOWN_HINT,
  YUQUE_QUOTA_HINT,
  YUQUE_SERVER_HINT,
  YUQUE_TOKEN_INVALID_HINT,
} from "./lib/messages"
import { Banner } from "./components/Banner"
import { Radio } from "./components/Radio"
import type {
  ExtractResponse,
  LocalSaveResponse,
  Target,
  YuqueConfig,
  YuqueUploadCode,
  YuqueUploadResponse,
} from "./types"

type UiState =
  | { kind: "loading" }
  | { kind: "ready"; data: ExtractResponse & { ok: true } }
  | { kind: "error"; message: string }
  | { kind: "saving" }
  | { kind: "saved"; target: Target; detail: string }
  | { kind: "saveFailed"; target: Target; message: string }

/** 语雀上传错误 → 友好提示。 */
function yuqueErrorHintByCode(code: YuqueUploadCode): string {
  switch (code) {
    case "401":
      return YUQUE_TOKEN_INVALID_HINT
    case "404":
      return YUQUE_NAMESPACE_INVALID_HINT
    case "429":
      return YUQUE_QUOTA_HINT
    case "5xx":
      return YUQUE_SERVER_HINT
    case "network":
      return YUQUE_NETWORK_HINT
    case "no_markdown":
      return YUQUE_NO_MARKDOWN_HINT
    default:
      return "未知错误"
  }
}

function Popup() {
  const [state, setState] = useState<UiState>({ kind: "loading" })
  const [title, setTitle] = useState("")
  // 默认 "local" —— 首次安装无 storage 记录时保持 v0.1 行为；getTarget() 异步回来会覆盖。
  const [target, setTargetState] = useState<Target>("local")
  const [config, setConfig] = useState<YuqueConfig | null>(null)

  /**
   * 包装版 setTarget：先更新本地 state（UI 立即响应），再写 chrome.storage.local
   * （fire-and-forget —— 写失败也不重试；下次打开读不到就降级默认）。
   */
  function setTarget(t: Target) {
    setTargetState(t)
    void setTargetToStorage(t)
  }

  // 挂载时并行抓取 + 读 config + 读 target（避免三次 IO 串行）
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        if (!tab?.id) {
          if (!cancelled) setState({ kind: "error", message: "找不到当前标签页" })
          return
        }
        const [extractRes, config, savedTarget] = await Promise.all([
          chrome.runtime.sendMessage({
            type: "popupExtract",
            tabId: tab.id,
          }) as Promise<ExtractResponse>,
          // chrome.storage.local 在 popup / options context 都可直接访问，
          // 不再绕 background —— 减少一条 message branch + 一个 response type。
          getYuqueConfig(),
          getTarget(),
        ])
        if (cancelled) return
        if (!extractRes.ok) {
          setState({ kind: "error", message: extractRes.error })
          return
        }
        setTitle(extractRes.title || "")
        if (savedTarget) setTargetState(savedTarget)
        setState({ kind: "ready", data: extractRes })
        if (config) {
          setConfig(config)
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: errMsg(e) + INJECT_FAIL_HINT,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave() {
    if (state.kind !== "ready") return
    // D5-3 条件式：未配置时主按钮已 disabled；这里是双保险
    if (target === "yuque" && !config) return
    setState({ kind: "saving" })
    const payload = {
      title: title || state.data.title,
      markdown: state.data.markdown,
      sourceUrl: state.data.sourceUrl,
    }
    try {
      if (target === "local") {
        const res = (await chrome.runtime.sendMessage({
          type: "saveLocal",
          payload,
        })) as LocalSaveResponse
        if (res.ok) {
          setState({ kind: "saved", target: "local", detail: res.filename })
          setTimeout(() => window.close(), 1500)
        } else {
          setState({
            kind: "saveFailed",
            target: "local",
            message: res.error,
          })
        }
      } else if (target === "yuque") {
        const res = (await chrome.runtime.sendMessage({
          type: "yuqueUpload",
          payload,
        })) as YuqueUploadResponse
        if (res.ok) {
          setState({ kind: "saved", target: "yuque", detail: res.docUrl })
          setTimeout(() => window.close(), 1500)
        } else {
          setState({
            kind: "saveFailed",
            target: "yuque",
            message: yuqueErrorHintByCode(res.code),
          })
        }
      } else {
        // target === "clipboard" —— navigator.clipboard.writeText 必须在 click 同步链里调
        // （user gesture 要求）；这里 await writeText 不算脱离 user gesture。
        try {
          await navigator.clipboard.writeText(state.data.markdown)
          setState({
            kind: "saved",
            target: "clipboard",
            detail: "Markdown 已写入系统剪贴板",
          })
          setTimeout(() => window.close(), 1500)
        } catch {
          setState({
            kind: "saveFailed",
            target: "clipboard",
            message: COPY_FAIL_HINT,
          })
        }
      }
    } catch (e) {
      setState({
        kind: "saveFailed",
        target,
        message: errMsg(e),
      })
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
        <Banner variant="error" message="❌ 抓取失败" details={state.message} />
      </Shell>
    )
  }

  if (state.kind === "saving") {
    return (
      <Shell>
        <div className="text-sm text-gray-700">正在保存…</div>
      </Shell>
    )
  }

  if (state.kind === "saved") {
    const targetLabel =
      state.target === "yuque"
        ? "语雀"
        : state.target === "local"
        ? "本地"
        : "剪切板"
    const headline =
      state.target === "clipboard" ? "✅ 已复制" : `✅ 已保存到${targetLabel}`
    return (
      <Shell>
        <Banner variant="success" message={headline} details={state.detail} />
      </Shell>
    )
  }

  if (state.kind === "saveFailed") {
    const targetLabel =
      state.target === "yuque"
        ? "语雀"
        : state.target === "local"
        ? "本地"
        : "剪切板"
    const headline =
      state.target === "clipboard" ? "❌ 复制失败" : `❌ 保存到${targetLabel}失败`
    return (
      <Shell>
        <Banner variant="error" message={headline} details={state.message} />
      </Shell>
    )
  }

  // ready 分支 —— 主界面
  const data = state.data
  const showConfigBanner = target === "yuque" && !config
  return (
    <Shell>
      <div className="text-base font-semibold text-gray-900 mb-2">
        📥 WebPageStore
      </div>
      <div className="text-[11px] text-gray-400 mb-2 break-all">
        {data.sourceUrl}
      </div>

      {showConfigBanner && (
        <div className="mb-3">
          <Banner
            variant="warning"
            message={YUQUE_CONFIG_MISSING_HINT}
            action={{
              label: "去 options 配置",
              onClick: () => chrome.runtime.openOptionsPage(),
            }}
          />
        </div>
      )}

      <label className="block text-xs text-gray-500 mb-1">📖 标题</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={data.title}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded mb-2 focus:outline-none focus:border-blue-500"
      />

      {data.excerpt && (
        <div className="bg-gray-50 border border-gray-200 p-2 rounded text-xs text-gray-600 mb-3 max-h-24 overflow-auto leading-relaxed">
          {data.excerpt}
        </div>
      )}

      <div className="text-[11px] text-gray-500 mb-3">
        Markdown 长度：
        <span className="font-mono">
          {data.markdown.length.toLocaleString()}
        </span>{" "}
        字符 · 图片：
        <span className="font-mono">{data.imageUrls.length}</span> 张
        <span className="text-gray-400">（v0.1 不下载图片）</span>
      </div>

      <div className="mb-2">
        <div className="text-xs text-gray-500 mb-1">保存目标</div>
        <Radio<Target>
          value={target}
          onChange={setTarget}
          options={[
            { value: "clipboard", label: "📋 剪切板" },
            { value: "local", label: "📁 本地" },
            { value: "yuque", label: "📚 语雀" },
          ]}
        />
      </div>

      <button
        onClick={() => void handleSave()}
        disabled={showConfigBanner}
        className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded transition-colors"
      >
        {target === "clipboard" ? "复制到剪切板" : "保存"}
      </button>
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

const container = document.getElementById("root")
if (!container) throw new Error("#root not found in popup.html")
createRoot(container).render(<Popup />)

// 删了原本的 `export default Popup`：esbuild 以 IIFE 模式 bundle 入口，
// 入口文件顶层 createRoot().render() 才是真正的 mount；export default 是 plasmo 时代的
// 残留（plasmo 会读 default export 当入口组件），现在没人 import，留着会强制 emit exports 对象。