// 通用顶部 banner 组件 —— 错误 / 警告 / 成功三态共用。
//
// 设计要点：
// - 三 variant：错误（红）/ 警告（黄）/ 成功（绿）。
// - 可选 details：默认折叠，点"详情"展开 —— popup 空间宝贵，不展开不占地方。
// - 可选 action 按钮：用于"去 options 配置" / "重试"等跳转 / 重试入口。
// - 不依赖 React 之外的状态管理；纯展示组件。

import { useState } from "react"

export type BannerVariant = "error" | "warning" | "success"

interface BannerProps {
  variant: BannerVariant
  message: string
  details?: string
  action?: { label: string; onClick: () => void }
}

const variantStyles: Record<
  BannerVariant,
  { bg: string; border: string; text: string }
> = {
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
  },
  warning: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
  },
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
  },
}

export function Banner({ variant, message, details, action }: BannerProps) {
  const [showDetails, setShowDetails] = useState(false)
  const style = variantStyles[variant]
  return (
    <div
      className={`px-3 py-2 ${style.bg} border ${style.border} rounded text-sm ${style.text}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">{message}</div>
        {details && (
          <button
            className="text-xs underline shrink-0"
            onClick={() => setShowDetails((s) => !s)}
          >
            {showDetails ? "收起" : "详情"}
          </button>
        )}
      </div>
      {showDetails && details && (
        <div className="mt-1 text-xs whitespace-pre-wrap break-words opacity-80">
          {details}
        </div>
      )}
      {action && (
        <button
          className="mt-2 px-3 py-1 bg-white border border-current rounded text-xs"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}