// 选项页（v0.3 改造后）—— Token + namespace 配置 + sanity check 显示。
//
// 打开方式：右键点击扩展图标 → 选项；或在 chrome://extensions 详情页点"扩展程序选项"。
//
// 设计要点：
// - 表单 + 一键保存：保存即触发 yuqueSanity 验证（D4-2 拍板）；不在保存后再设"测试"按钮。
// - 清除按钮：直接调 storage.remove，无 API 调用。
// - sanity check 由 background 负责（跨域 fetch 只能在 SW 里做）—— options 只 sendMessage。
// - error 按 code 映射到 messages.ts 的提示文案（D2-7 拍板）。

import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import {
  setYuqueConfig,
  clearYuqueConfig,
  getYuqueConfig,
} from "./lib/storage"
import type {
  YuqueConfig,
  YuqueSanityCode,
  YuqueSanityResponse,
} from "./types"
import {
  YUQUE_NETWORK_HINT,
  YUQUE_NAMESPACE_INVALID_HINT,
  YUQUE_QUOTA_HINT,
  YUQUE_SERVER_HINT,
  YUQUE_TOKEN_INVALID_HINT,
} from "./lib/messages"

type Status = "idle" | "saving" | "success" | "error"

function hintByCode(code: YuqueSanityCode | undefined): string {
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
    default:
      return "未知错误"
  }
}

function Options() {
  const [token, setToken] = useState("")
  const [namespace, setNamespace] = useState("")
  const [savedConfig, setSavedConfig] = useState<YuqueConfig | null>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [sanity, setSanity] = useState<YuqueSanityResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 挂载时读已有配置 —— 让用户看到当前值（密码框仍遮蔽）
  useEffect(() => {
    void getYuqueConfig().then((cfg) => {
      if (cfg) {
        setSavedConfig(cfg)
        setToken(cfg.token)
        setNamespace(cfg.namespace)
      }
    })
  }, [])

  const handleSave = async () => {
    const trimmedToken = token.trim()
    const trimmedNs = namespace.trim()
    if (!trimmedToken || !trimmedNs) {
      setStatus("error")
      setErrorMsg("Token 和 namespace 都不能为空")
      return
    }
    setStatus("saving")
    setErrorMsg(null)
    setSanity(null)
    try {
      await setYuqueConfig({ token: trimmedToken, namespace: trimmedNs })
      // sanity check 在 background 里做（跨域 fetch 只能在 SW 里跑）
      const res = (await chrome.runtime.sendMessage({
        type: "yuqueSanity",
      })) as YuqueSanityResponse | undefined
      if (res && res.ok) {
        setStatus("success")
        setSanity(res)
        setSavedConfig({ token: trimmedToken, namespace: trimmedNs })
      } else {
        setStatus("error")
        setSanity(res ?? null)
        setErrorMsg(res ? hintByCode(res.code) : "sanity check 失败（无响应）")
      }
    } catch (e) {
      setStatus("error")
      setErrorMsg(String(e))
    }
  }

  const handleClear = async () => {
    await clearYuqueConfig()
    setSavedConfig(null)
    setToken("")
    setNamespace("")
    setStatus("idle")
    setSanity(null)
    setErrorMsg(null)
  }

  return (
    <div className="p-6 max-w-xl text-sm text-gray-700">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">
        WebPageStore · 设置
      </h1>

      {savedConfig ? (
        <div className="mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded">
          ✓ 已配置：namespace{" "}
          <code className="font-mono">{savedConfig.namespace}</code>
        </div>
      ) : (
        <div className="mb-4 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded">
          ⚠️ 未配置语雀
        </div>
      )}

      <label className="block mb-3">
        <span className="block mb-1 font-medium text-gray-800">
          语雀 Personal Access Token
        </span>
        <input
          type="password"
          className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
          placeholder="从 https://www.yuque.com/settings/token 生成"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </label>

      <label className="block mb-4">
        <span className="block mb-1 font-medium text-gray-800">
          语雀 namespace（<code className="text-xs">login/repo_slug</code>）
        </span>
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
          placeholder="例如：myusername/my-knowledge-base"
          value={namespace}
          onChange={(e) => setNamespace(e.target.value)}
        />
      </label>

      <div className="flex gap-2 mb-4">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
          disabled={status === "saving"}
          onClick={() => void handleSave()}
        >
          {status === "saving" ? "验证中..." : "保存"}
        </button>
        <button
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded"
          onClick={() => void handleClear()}
        >
          清除 Token
        </button>
      </div>

      {status === "success" && sanity?.ok && (
        <div className="px-3 py-2 bg-green-50 border border-green-200 rounded text-sm">
          ✓ 当前登录：<code className="font-mono">{sanity.login}</code>；
          知识库：<code className="font-mono">{sanity.repoTitle}</code>
          （公开性 {sanity.publicLevel}）
        </div>
      )}

      {status === "error" && errorMsg && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          ✗ {errorMsg}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-6">
        v0.3：在语雀后台生成 Personal Access Token，并把知识库设为公开（私有知识库 API 拿不到）。
      </p>
    </div>
  )
}

const container = document.getElementById("root")
if (!container) throw new Error("#root not found in options.html")
createRoot(container).render(<Options />)