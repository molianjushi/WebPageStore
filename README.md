# WebPageStore

> 智能网页剪存浏览器插件 —— 一键把网页保存为 Markdown，支持**本地下载 / 系统剪贴板 / 语雀知识库**三种目标。

Chrome / Edge 浏览器扩展（Manifest V3）。打开 popup → 自动抓取正文 → 选目标 → 一键保存。

---

## ✨ 功能

- 📥 **一键抓取**：用 [@mozilla/readability](https://github.com/mozilla/readability) 提取正文，自动过滤广告 / 侧栏 / 评论
- 📝 **Markdown 输出**：用 [turndown](https://github.com/domchristie/turndown) 转 md，前置引用块 frontmatter（含原文链接 / 作者 / 抓取时间）
- 🎯 **三种保存目标**（顺序：**剪切板 / 本地 / 语雀**，自动记住上次选择）：
  - 📋 **剪切板** — 一键复制 markdown 全文到系统剪贴板
  - 📁 **本地** — 下载为 `.md` 文件到 `~/Downloads/WebPageStore/`
  - 📚 **语雀** — 推到指定语雀知识库（v0.3，待专业会员 PAT 启用）

---

## 📦 安装

### Chrome / Edge（开发模式）

1. 克隆仓库：
   ```bash
   git clone https://github.com/molianjushi/WebPageStore.git
   cd WebPageStore
   ```

2. 安装依赖 + 构建：
   ```bash
   npm install
   npm run build
   ```

3. 打开 Chrome，进入 [`chrome://extensions`](chrome://extensions)，开启右上角"开发者模式"

4. 点"加载已解压的扩展程序"，选择 `dist/` 目录

5. 浏览器右上角会出现 📥 WebPageStore 图标

---

## 🚀 使用

1. 打开任意网页（掘金 / 知乎 / 博客园 / Medium / 个人博客等）
2. 点浏览器右上角的 📥 WebPageStore 图标，弹出 popup
3. popup 自动抓取当前页正文，显示**标题 / 摘要 / Markdown 长度**
4. 可编辑标题（Readability 取错时手动修正）
5. 选保存目标（剪切板 / 本地 / 语雀），点主按钮
6. 复制成功 / 下载完成 / 推到语雀 后，popup 自动关闭

### 已测试站点

| 站点 | URL 示例 | 状态 |
|---|---|---|
| 掘金 | juejin.cn/post | ✅ |
| 知乎专栏 | zhuanlan.zhihu.com/p/xxx | ✅ |
| 知乎回答 | zhihu.com/question/xxx/answer/yyy | ✅ |
| 博客园 | cnblogs.com | ✅ |
| Medium | medium.com | ✅ |
| Hexo 个人博客 | xxx.github.io | ✅ |
| chrome:// 页面 | chrome://extensions | ✅ 友好提示 |

---

## 🛠 开发

### 命令

```bash
npm run build        # esbuild bundle → dist/
npm run icons        # 渲染 SVG 图标 → 16/32/48/128 PNG
npm run typecheck    # tsc --noEmit（只检查类型，不产出文件）
```

### 技术栈

| 层 | 选型 |
|---|---|
| 构建 | esbuild + PostCSS + Tailwind |
| UI | React 18 + TypeScript 5 |
| 内容提取 | @mozilla/readability + turndown |
| 状态 | chrome.storage.local |
| 图标 | sharp（SVG → PNG 渲染） |

### 项目结构

```
WebPageStore/
├── src/
│   ├── content.ts          # 内容提取（Readability + Turndown）
│   ├── background.ts       # service worker（语雀 API + downloads）
│   ├── popup.tsx           # popup 主界面
│   ├── options.tsx         # 语雀配置页
│   ├── components/         # 通用 UI 组件（Banner / Radio）
│   └── lib/                # 共享逻辑（yuque / storage / extract / ...）
├── assets/
│   ├── icon.svg            # SVG 源（手画）
│   └── icon_*.png          # 16/32/48/128 PNG（sharp 渲染）
├── build.mjs               # esbuild + PostCSS bundler
├── build-icons.mjs         # SVG → PNG 渲染脚本
├── manifest.json           # Chrome MV3 手写 manifest
└── CLAUDE.md               # 给 Claude / AI 协作者的详细文档
```

---

## 🗺 路线图

| 版本 | 内容 | 状态 |
|---|---|---|
| v0.1 | 本地 `.md` 保存（无图片下载） | ✅ 已发布 |
| v0.1.1 | 修知乎专栏 / 回答页抓取异常 | ✅ 已发布 |
| v0.3 | 语雀 API 上传 | ✅ **已实现，待专业会员 PAT 启用** |
| v0.4 | 复制到剪切板 + 真实图标 | ✅ 已发布 |
| v0.5+ | 图片下载 zip / AI 精炼 / 云同步 | 📋 计划中 |

---

## ⚠️ 当前限制

| 限制 | 原因 |
|---|---|
| 不下载图片（v0.1 ~ v0.4） | 当前 `.md` 路径已满足需求，zip 打包作为 v0.5+ 计划 |
| Markdown 上限 ~600KB（CJK 字符） | Chrome data URL 上限 ~2MB，UTF-8 CJK 3 字节 / encode 后 9 字节 |
| 语雀上传待专业会员 | 个人版 PAT 仅专业会员可生成 |
| 极端 SPA 可能抓空壳 | 按需注入后失去 `run_at: "document_idle"` 时机 |

完整限制清单见 [CLAUDE.md](CLAUDE.md)。

---

## 📄 详细文档

工程约定 / 设计决策 / 已知限制 / E2E 用例：见 [CLAUDE.md](CLAUDE.md)。

---

## 📜 License

MIT