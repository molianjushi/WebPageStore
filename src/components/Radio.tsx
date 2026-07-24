// 通用单选按钮组 —— 用于"本地 / 语雀"目标切换。
//
// 设计要点：
// - 泛型 <T extends string>：调用方传 union 类型（"local" | "yuque"）保证类型安全。
// - 选项数组驱动：options.length 不限，将来加新目标（如"剪存到 GitHub"）只改调用方。
// - 选中态用蓝底白字；未选中态 hover 有反馈。
// - 不写 input[type=radio]：popup 空间小，按钮形态更适合点按。

interface RadioOption<T extends string> {
  value: T
  label: string
}

interface RadioProps<T extends string> {
  value: T
  options: RadioOption<T>[]
  onChange: (value: T) => void
}

export function Radio<T extends string>({
  value,
  options,
  onChange,
}: RadioProps<T>) {
  return (
    <div className="flex border border-gray-300 rounded overflow-hidden text-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-2 py-1.5 transition-colors ${
            value === opt.value
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}