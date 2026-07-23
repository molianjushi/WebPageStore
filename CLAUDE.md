# CLAUDE.md — WebPageStore

> 给将来协助开发这个项目的 Claude / AI 协作者的项目说明。所有内容原则：和 plan 文件 (`plans/markdown-1-2-playful-stardust.md`) 协同，但这里聚焦"工程现状 + 约定"。

## 这是什么

WebPageStore 是一个 Chrome / Edge 浏览器扩展（Manifest V3），把当前网页**剪存**成 Markdown 档案。支持两条路径：

1. **保存到本地**（默认下载目录，下属子目录 `WebPageStore/`）
2. **保存到语雀**（v0.3 后续接入，当前未实现）

由 Plasmo 脚手架编写，React + TypeScript。

## 当前进度

| 版本 | 内容 | 状态 |
|---|---|---|
| v0.1 | 单 .md 本地存档（无图片下载） | 代码已铺，正在 `npm install` + `npm run dev` 验证 |
| v0.2 | 本地 zip 包（含 images/ 目录） | 未开始 |
| v0.3 | 语雀 API 上传（在父文档下建子文档） | 未开始 |

代码进度：
- `package.json` / `tsconfig.json` / `plasmo.config.ts` / `tailwind` / `postcss` ✅
- `assets/icon*.png` 占位 ✅
- `src/types.ts` ✅ 消息协议
- `src/lib/sanitize.ts` ✅ 文件名清洗
- `src/lib/extract.ts` ✅ Readability + Turndown + frontmatter
- `src/content.ts` ✅ content script（document_idle，跑在 ISOLATED world）
- `src/background.ts` ✅ service worker（调 `chrome.downloads.download`）
- `src/popup.tsx` ⏳ 还没写 —— popup UI + 两个保存按钮
- `src/popup.css` ⏳ Tailwind 入口
- `src/options.tsx` ⏳ 选项页（占位即可，v0.3 才完整）

**待补**：HTML 入口 `popup.html`、`options.html`（Plasmo 默认会从 .tsx 自动生成，可以省略）。

## 技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 脚手架 | [Plasmo](https://www.plasmo.com/) | React + TypeScript，MV3 模板齐，HMR |
| 内容提取 | `@mozilla/readability` | 注入到 content script 跑 |
| HTML → MD | `turndown` | 自定义 fenceCode rule 保留语言 |
| 样式 | Tailwind 3 | `popup.css` 入口 |
| 消息总线 | 直接用 `chrome.runtime.sendMessage`，暂不用 `@plasmohq/messaging` | 保持透明 |
| 存储 | `chrome.storage.local`（v0.3 才用） | |
| 打包 | JSZip（v0.2 才装） | |
| 语雀调用 | `yuque-md`（v0.3 才装） | body 转 lake |

## 项目结构

```
web-page-store/
├── package.json                # plasmo dev / build / package / preview
├── tsconfig.json               # extends plasmo/templates/tsconfig.base
├── plasmo.config.ts            # 空壳，后续可加自定义 manifest 字段
├── tailwind.config.js
├── postcss.config.mjs
├── assets/
│   ├── icon.png                # 占位 1x1 transparent PNG —— 真实图标留待替换
│   └── icon_{16,32,48,128}.png
├── src/
│   ├── content.ts              # 注入所有页面；监听 popup 的 extract 请求
│   ├── background.ts           # service worker；调 downloads / 语雀
│   ├── popup.tsx               # 弹窗 UI（待写）
│   ├── popup.css               # Tailwind 入口（待写）
│   ├── options.tsx             # 设置页（v0.1 占位，v0.3 真实）
│   ├── lib/
│   │   ├── extract.ts          # Readability + Turndown 封装
│   │   └── sanitize.ts         # 文件名清洗
│   └── types.ts                # ExtractResponse / LocalSaveResponse
├── plans/
│   └── markdown-1-2-playful-stardust.md   # 已批准的实现方案
└── CLAUDE.md                   # 本文件
```

## 关键约定

1. **content script 跑 ISOLATED world**：能读 DOM、不污染页面 JS，足够让 Readability 解析。`runAt: "document_idle"` 是为等 SPA 骨架就绪；若发现某些 SPA 抓空，下一版可考虑上 MAIN world 注入。

2. **service worker 不放状态**：每个 message 一气呵成，所有 IO 内联做完再返回。worker 一旦 30s 无活动就被回收。

3. **download 用 data URL**（不是 blob URL）：规避 worker 终止后 `URL.createObjectURL` 失效。Chrome 默认 data URL 上限约 2MB，对 Markdown 安全。若将来 MD 超大（如带 base64 内嵌图）改用 FILE / `Filesystem` API。

4. **文件名清洗**：Windows 文件名不允许 `\ / : * ? " < > |`，sanitize.ts 已处理。

5. **消息协议的类型**集中在 `src/types.ts`，每个 `type: "xxx"` 是显式联合类型，新加 message 时同步补类型。

6. **Yaml frontmatter** 写到每个 .md 头部：title / source / author / site / excerpt / fetched_at。便于后续归档 / 检索。

## dev 工作流

```bash
# 安装
npm install

# 开发（带 HMR）
npm run dev
# → Plasmo 会在终端打印："Your extension is ready at: build/chrome-mv3-dev"

# 装到 Chrome：
# 1. 打开 chrome://extensions
# 2. 开发者模式 ON
# 3. "加载已解压的扩展程序"，选 build/chrome-mv3-dev 目录
# 4. 修改任何 src/** 文件后自动 HMR，不需要重新加载插件

# 生产构建
npm run build
# → build/chrome-mv3-prod

# 打成 .zip（用于上架 Chrome Web Store）
npm run package
```

## E2E 验证用例

每次迭代都要跑：

| 站点 | URL 示例 | 期望 |
|---|---|---|
| 掘金文章 | juejin.cn/post | 标题 + 正文 + 代码块完整 |
| 知乎专栏 | zhuanlan.zhihu.com/p/xxx | 同上 |
| 博客园 | cnblogs.com | 同上 |
| Medium | medium.com | 需绕过 lazy-load |
| 个人博客（Hexo） | xxx.github.io | 通常干净 |

跑测时：开 Chrome 装好扩展 → 打开测试页 → 浏览器右上角点扩展图标 → 看 popup 是否显示标题+摘要 → 点"保存到本地" → 检查 `~/Downloads/WebPageStore/clip_*.md`。

## 已踩过 / 待踩的坑

| 坑 | 现象 | 现状 | 应对 |
|---|---|---|---|
| CSP 严苛的页 | inject 失败 | Plasmo 默认 ISOLATED，多数不阻塞 | 若遇 CSP 报错，转 MAIN world + manifest 扩 `host_permissions` |
| SPA 直接抓空 | `<div id="app">` 是空壳 | `document_idle` 后多数 OK | 若不行，上 MutationObserver / 兜底等待 1500ms |
| 懒加载 `<img data-src>` | 收集到的是 `data:` base64 占位 | extract.ts 的 `img.src` 抓当前 src | v0.2 加一段 patch script 把 `data-src` 回写到 `src` |
| 防盗链 | 服务端 fetch 拿不到图 | content script 在页面 fetch 带 referer | v0.2 实现 |
| service worker 不持久 | 异步 IO 中断 | 一气呵成，`return true` 标记异步 | OK |
| downloads 权限 | 部分页拒绝下到用户态目录 | 默认下到 `~/Downloads` 不需要额外权限 | 若需"每次选目录"，`saveAs: true` |
| 语雀 body 是 lake | 不是 markdown | v0.3 才处理 | 引入 `yuque-md` |
| 语雀个人版 token | 只能访问自己的公开知识库 | options 页引导用户去 [yuque.com/settings/token](https://www.yuque.com/settings/token) | v0.3 |

## 后续迭代路线

- **v0.2**：把 `imageUrls` 全部并发 fetch → `Blob[]`，用 JSZip 打成 `clip_xxx.zip`，里头有 `article.md` + `images/001.png` ……防防盗链 → 在 content script 内 fetch。
- **v0.3**：options 页加 Token 表单；listRepos → listDocs（树）让用户选父文档；createDoc 提交；失败重试。
- **v0.4+**：AI 精炼、批量剪存、云同步、Firefox 适配。

## 协作约定（最高优先级）

> 这一节优先级最高，所有 Claude 协作者必读：先解释、再执行；小功能先自测再交付。

- **用户是编程小白**：技术决策用"推荐默认 + 解释为什么"；不替他拍板。
- **写代码前的解释**：动手前先讲清楚
  1. 打算新增 / 修改哪些文件、各自做什么
  2. 估计的行数级和会引入的新依赖
  3. 一两个"非显然的设计决策"（例如为什么是 A 而不是 B）
- **写代码中的解释**：遇到非显然决策（命名取舍、错误处理路径、模块边界、踩坑写法）时，在代码 / Commit / 注释里用大白话补一句
- **写代码后的解释**：明确告诉用户
  1. 这段代码做了什么（功能层面，不逐行）
  2. 怎么验证（参考"## E2E 验证用例"那节）
  3. 下一步打算做什么
- **每完成一个功能点都要自测**：交付前先按 E2E 验证用例自测一次（哪怕是 `npm run build` 通过 + 打开测试页看看 popup 显示），把测试结果告诉用户再继续下一步；不通过就先 debug 再交付。
- **每完成一个功能点都 commit 一次**（不要攒一堆才 commit）：
  - 粒度：单文件 / 一次 bug fix / 一次 manifest / config 调整都算一个 commit
  - 仅在本地 commit；**push 由用户手动触发**（SSH key 配置 / push 权限属用户决定）
  - commit message 中文，conventional 风格：`feat:` / `fix:` / `chore:` / `docs:` / `refactor:`
  - 仓库：`git@github.com:molianjushi/WebPageStore.git`（用户创建）
  - 临时未通过自测的代码**不入 commit**；不写 `WIP` / `tmp` 类占位 commit
- **任何外部命令前要征求同意**：`npm install` / `plasmo dev` / `git push` / 装到 Chrome / 写 Chrome 权限等。
- **修改用户当前文件或终端前要确认**：先列出"我要编辑 X / Y / Z 这几个文件，改动是 ……"，确认后再动手。
- **中文回复**。