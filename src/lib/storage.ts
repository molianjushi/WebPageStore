// chrome.storage.local 包装 —— 装 yuqueConfig + target 两个 key。
//
// 设计要点：
// - 单 key 方案：避免多 key 时读 / 写 / 清分散；将来要扩展（多个 repo / 加密）
//   时再拆。
// - getYuqueConfig() / getTarget() 做 defensive 检查（schema 不匹配时返回 null）
//   —— 防止 storage 里残留旧版本数据导致运行时炸。
// - 不存加密版：chrome.storage.local 已是 MV3 SW 内部存储，不外泄。
//   真要加密得引 AES + 用户密码，v0.3 不做。

import {
  KEY_TARGET,
  KEY_YUQUE_CONFIG,
  type Target,
  type YuqueConfig,
} from "../types"

export async function getYuqueConfig(): Promise<YuqueConfig | null> {
  const result = await chrome.storage.local.get(KEY_YUQUE_CONFIG)
  const cfg = result[KEY_YUQUE_CONFIG]
  if (!cfg || typeof cfg !== "object") return null
  const { token, namespace } = cfg as Partial<YuqueConfig>
  if (typeof token !== "string" || typeof namespace !== "string") return null
  if (!token.trim() || !namespace.trim()) return null
  return { token: token.trim(), namespace: namespace.trim() }
}

export async function setYuqueConfig(config: YuqueConfig): Promise<void> {
  await chrome.storage.local.set({ [KEY_YUQUE_CONFIG]: config })
}

export async function clearYuqueConfig(): Promise<void> {
  await chrome.storage.local.remove(KEY_YUQUE_CONFIG)
}

/**
 * 读用户上次选的 target。schema 不匹配返回 null —— 调用方 fallback 到默认值
 * （popup 默认 "local"，保持 v0.1 行为）。
 */
export async function getTarget(): Promise<Target | null> {
  const result = await chrome.storage.local.get(KEY_TARGET)
  const v = result[KEY_TARGET]
  if (v === "local" || v === "clipboard" || v === "yuque") return v
  return null
}

/** 写 target。同步 IO；不在 await 上挂 await setTarget（fail 也不重试——写失败时降级为默认行为）。 */
export async function setTarget(target: Target): Promise<void> {
  await chrome.storage.local.set({ [KEY_TARGET]: target })
}