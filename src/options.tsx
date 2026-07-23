// 选项页（v0.1 占位）。Plasmo 默认会把 src/options.tsx 自动注册为 options page。
//   - 打开方式：右键点击扩展图标 → 选项；或在 chrome://extensions 详情页点"扩展程序选项"。
//   - v0.3 将改造为：Token 输入框 + 知识库选择 + 父文档选择。

function Options() {
  return (
    <div className="p-6 max-w-xl text-sm text-gray-700">
      <h1 className="text-xl font-semibold text-gray-900 mb-3">
        WebPageStore · 设置
      </h1>
      <p className="mb-2">当前版本 <code className="px-1 py-0.5 bg-gray-100 rounded">v0.1</code>，无需任何设置。</p>
      <p className="mb-2">
        扩展已自动把剪存结果存到本机的
        <code className="px-1 py-0.5 bg-gray-100 rounded mx-1">~/Downloads/WebPageStore/clip_*.md</code>
        文件夹下，按时间戳 + 标题命名。
      </p>
      <p className="text-xs text-gray-500 mt-4">
        下个版本（v0.3）将在此处加入语雀 Personal Access Token 配置、知识库 / 父文档选择。
      </p>
    </div>
  )
}

export default Options
