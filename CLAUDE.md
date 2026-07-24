# CLAUDE.md — WebPageStore

> 给将来协助开发这个项目的 Claude / AI 协作者的项目说明。所有内容原则：和 plan 文件 (`plans/markdown-1-2-playful-stardust.md`) 协同，但这里聚焦"工程现状 + 约定"。

## 这是什么

WebPageStore 是一个 Chrome / Edge 浏览器扩展（Manifest V3），把当前网页**剪存**成 Markdown 档案。

由 **esbuild + 手写 manifest.json** 构建，React + TypeScript。已不再使用 Plasmo。

**当前完成态**：本地 .md 保存（仅文字，不下载图片）。v0.3 语雀上传代码已实现（11 文件 / ~900 行 / 工作树暂存），**待用户开专业会员后启用**（语雀 PAT 当前需专业会员）。

## 协作约定（最高优先级）

> 这一节优先级最高，所有 Claude 协作者必读：先解释、再执行；小功能先自测再交付。

### 全局约束（每条对话 / 每次操作都适用）

- **用户是编程小白**：技术决策用"推荐默认 + 解释为什么"；不替他拍板。
- **中文回复**。
- **执行命令的询问密度按当前模式决定**：Ask 模式（方案讨论 / 用户未拍板）外部命令前征求同意；Edit 模式（用户明确"按刚才讨论的开干"）常规流程不必每次问，事后简要汇报做了什么即可。
- **执行命令后简要解释做了什么**。

### 写代码必做（每次写代码前读）

- **写代码前的解释**：动手前先讲清楚
  1. 打算新增 / 修改哪些文件、各自做什么
  2. 估计的行数级和会引入的新依赖
  3. 一两个"非显然的设计决策"（例如为什么是 A 而不是 B）
- **写代码中的解释**：遇到非显然决策（命名取舍、错误处理路径、模块边界、踩坑写法）时，在代码 / Commit / 注释里用大白话补一句
- **写代码后的解释**：明确告诉用户
  1. 这段代码做了什么（功能层面，不逐行）
  2. 怎么验证（参考"## E2E 验证用例"那节）
  3. 下一步打算做什么

### 每个需求点开始的强制流程（4 步）

1. **询问是否压缩上下文**：先问用户"是否需要 /compact"压缩上下文，避免长对话导致重复犯错或遗忘早期决策
2. **讨论方案，不写代码**：
   - 逐环节展开：先简短介绍当前需求有哪些环节；逐环节讲目的 / 实现方式 / 优缺点，让用户选。
   - 逐子决策拍板：环节内的多个子决策先列清单，再逐个列详情让用户拍板；不一次性全部确认。
   - 当前环节所有子决策拍板完后，再给具体实现描述：要改哪些文件 / 各自做什么 / 估计行数级 / 会引入的新依赖 / 一两个非显然设计决策。
   - 当前环节方案全部确定后，再进下一环节（参下面的"中途不抢跑"）。
3. **等用户拍板**：方案讨论完后，**主动问**"是否开始编程"；得到明确同意后才进 Edit / Write 阶段
4. **中途不抢跑**：用户在回答"是否开始"前，不要自己写代码、跑命令、做修改
   - 例外：用户对话里直接说"开始 / 写 / 改 / 按刚才讨论的开干"等同同意，可省略"问"这一步
   - 与下条"写代码前的解释"配合：本条是**流程**（要不要写、何时写），下一条是**内容**（写什么、怎么写）

### 每个功能点完成的完整流程（6 步）

1. **自测**：交付前先按 E2E 验证用例自测一次（哪怕是 `npm run build` 通过 + 打开测试页看看 popup 显示），把测试结果告诉用户再继续下一步；不通过就先 debug 再交付。
2. **询问是否触发 code-review**：我主动问你"是否触发 code-review？"。你点头进入阶段 3。
3. **code-review 循环**：
   - **actor 是你（user）**：你在 IDE 端按 `/code-review` slash command；findings 通过 background notification + peer message 注入本 session
   - 我读 findings，自修真问题（功能正确性 / 数据完整性 / 边角崩溃 / 真维护负担；**不是** nice-to-have 风格 / 性能 / 文档 drift）→ 重跑自测 → 直到你确认 review 干净
   - 期间如需要再 review → 你再点 `/code-review` → 仍有问题 → 自修 → 继续循环
4. **自测结果回报（必做）**：review 干净后、提交前，我**主动把当前自测结果汇报给你**——修了哪些 review 真问题、当前 typecheck / build 状态、必要 Chrome E2E 状态。**等你看过这些信息再决定**是否提交
5. **询问是否提交**：自测报告 + review 干净 → 我主动问你"是否提交代码到远程仓库？"。你点头才进入下一阶段
6. **自动 commit + push**：你同意 → 我自动 `git add .` + `git commit -m <中文 conventional 风格>` + `git push -u origin <branch>`

### "每个功能点完成的完整流程"的附加约束

- 自测未通过、review 不通过都不会推进到下一阶段
- review 只在**功能点完成节点**触发；中途小 bug fix **不重跑 review**
- 粒度：**一个功能点**（实现该功能所需的所有源码、必要配置、对应用例）= 1 个 commit；中途零散改动不 commit
- commit message 中文，conventional 风格：`feat:` / `fix:` / `chore:` / `docs:` / `refactor:`
- 仓库：`git@github.com:molianjushi/WebPageStore.git`（用户创建）

## 当前进度

### 版本发布状态

| 版本 | 内容 | 状态 |
|---|---|---|
| v0.1 | 单 .md 本地存档（无图片下载） | ✅ **完成**（commit `b0e9278`）：Plasmo 迁 esbuild + 修真 8 项 critical bugs + 21 项 review findings |
| v0.1.1 | 修知乎专栏 / 回答页抓取异常 | ✅ **完成**（commit `544fdea`）：知乎走专用 `extractZhihu` 路径（schema.org Answer + data-zop 解析作者 + viewport 中央匹配） |
| v0.2 | ~~本地 zip 包（含 images/ 目录）~~ | ❌ **已取消**（用户决定不做：当前 .md 路径已满足需求） |
| v0.3 | 语雀 API 上传 | ⏸ **已实现待启用**（PAT 需专业会员；代码工作树暂存） |

**Chrome E2E 6 站全过**：掘金 juejin.cn/post、知乎专栏 zhuanlan.zhihu.com/p/xxx、知乎回答 zhihu.com/question/xxx/answer/yyy、博客园 cnblogs.com、Medium medium.com、Hexo 个人博客；外加 chrome:// 边界（友好提示，不是 console error）。

### 代码文件状态（v0.1.1 末态）

| 文件 | 关键内容 |
|---|---|
| `package.json` | 依赖 + scripts（`build` / `typecheck`；fake `watch` 已删） |
| `tsconfig.json` | TypeScript 5 + chrome types |
| `tailwind.config.js` / `postcss.config.mjs` | Tailwind 3 + PostCSS pipeline |
| `manifest.json` | 手写 Chrome MV3 schema（无 `content_scripts`；无 `host_permissions`；用 `activeTab + scripting` 按需注入） |
| `build.mjs` | esbuild bundler（4 entry + PostCSS pipeline；`exists()` 用顶部 import `access`） |
| `src/popup.html` / `src/popup.css` / `src/options.html` | popup + options 入口 |
| `src/types.ts` | 消息协议 + `ok()` / `fail()` 工厂 |
| `src/lib/util.ts` | `errMsg()` / `lastErrorMsg()` 跨上下文复用 |
| `src/lib/messages.ts` | 提示文案常量（`INJECT_FAIL_HINT` / `NON_HTTP_TAB_MSG`） |
| `src/lib/sanitize.ts` | 文件名清洗 |
| `src/lib/extract.ts` | Readability + Turndown + 引用块 frontmatter（emoji + 中文 key + 末尾双空行）+ 知乎专用路径 |
| `src/content.ts` | 按需注入；globalThis guard 防重复注册；`waitForDocumentComplete()` 兜底 SPA |
| `src/background.ts` | service worker（type: module）；先 sendMessage 再 executeScript；scheme guard；CJK 预算 |
| `src/popup.tsx` | React UI + createRoot mount + retry guard 修复 + 删 dead `export default` |
| `src/options.tsx` | 占位 React + createRoot mount + 删 dead `export default` |
| `assets/icon*.png` | 占位 1×1 PNG（**待替换为真实图标**）|

⚠️ **当前已知限制（非 blocker，记录给未来）**：

| # | slug | 位置 | 限制 |
|---|---|---|---|
| 9 | `SPA-empty` | [src/content.ts](src/content.ts) | 按需注入后失去原 manifest `run_at: "document_idle"` 时机。已用 `waitForDocumentComplete()` 兜底，但极端 SPA（load 后还在 lazy-fetch 数据）仍可能抓空壳 |
| 10 | `host-permissions` | [manifest.json](manifest.json) | 已删 `host_permissions: ["<all_urls>"]`（activeTab + scripting 足够）；若将来要跨域 fetch 资源需重新评估 |
| 11 | `img-natural-width` | [src/lib/extract.ts](src/lib/extract.ts) `collectImageUrls` | off-DOM 容器里 `img.naturalWidth` / `img.currentSrc` 永远空 → 小图 guard 仅 fallback 路径生效。当前不下载图片，**不影响功能** |
| 12 | `data-url-cjk` | [src/background.ts](src/background.ts) | `data URL` 上限 ~2MB 是字符数，CJK 1 字符 ≈ 9 字节 → markdown 字节预算 ~600KB。当前直接报错 + 提示；用户接受此限制（不做 zip 方案） |
| 13 | `zhihu-schema` | [src/lib/extract.ts](src/lib/extract.ts) `extractZhihu` | 知乎专用路径用 `[itemtype="http://schema.org/Answer"]` selector；知乎未来改 schema.org 标记会失效（极不可能，改了会丢 SEO） |

> 表里 `slug` 列是稳定标识符；引用限制用 `limitation \`slug-name\`` 而不是行号（避免增删限制时引用断链）。

## 技术栈

| 层 | 选型 | 备注 | 为什么选 |
|---|---|---|---|
| 构建工具 | esbuild 0.28 | 多 entry（popup / options / background / content）+ PostCSS | 比 webpack 简单一个量级；MV3 service worker 原生支持 ESM；零配置 PostCSS 集成 |
| 扩展清单 | 手写 `manifest.json` | Chrome MV3 schema 直接抄官方；用 `activeTab + scripting` 按需注入，**无** content_scripts，**无** host_permissions | 不引 Plasmo 抽象层，直接面对 Chrome schema；可控性最高、报错最透明 |
| 内容提取 | `@mozilla/readability` | 在 content script（IIFE bundle）里跑；off-DOM `articleElement` 容器；知乎走专用 `extractZhihu` 不走 Readability | Firefox 阅读模式同款启发式，业界事实标准；cloned document 不污染原页面 DOM |
| HTML → MD | `turndown` | 自定义 `fencedCode` rule 保留语言标记；接 `Element` 输入复用 parse 一次 | 老牌库、规则可扩展（已自写 fencedCode rule）；和 Readability 无缝衔接 |
| UI 框架 | React 18 + TypeScript 5 | popup / options 通过 esbuild `jsx: "automatic"` 编译；esbuild 入口顶层 `createRoot(...).render(...)` | 用户已熟悉 React 生态；TS 类型守卫减少 popup / background / content 跨 context 的消息协议错误 |
| 样式 | Tailwind 3 | build.mjs 跑 PostCSS + autoprefixer，输出 `dist/popup.css` | popup / options 体量小不需要 CSS-in-JS 运行时；utility class 直接写 UI，省去维护 BEM 命名 |
| 消息总线 | `chrome.runtime.sendMessage` | popup 查 tabId 传 background；不走 `@plasmohq/messaging` | MV3 官方 API 已足够；不引 Plasmo messaging 抽象层 |
| 错误归一 | `src/lib/util.ts` `errMsg` / `lastErrorMsg` | 跨 background / popup / content 共用 | 避免每个 context 各自 catch + 各自 toString；一处实现三处复用 |
| 提示文案 | `src/lib/messages.ts` | 常量集中；将来 i18n / 改措辞只动一处 | 用户文案常迭代；常量集中后 grep / 全文搜索友好 |
| 响应工厂 | `src/types.ts` `ok()` / `fail()` | 配合 discriminated union | 强制类型守卫 `if (res.ok) ...` 比 try/catch 直观；和消息协议 union 配合 |

## 项目结构

```
web-page-store/
├── package.json                # scripts: build / typecheck
├── tsconfig.json               # 独立 tsconfig（继承 esbuild 默认；不接 Plasmo base）
├── manifest.json               # 手写 Chrome MV3 manifest（无 content_scripts / host_permissions）
├── build.mjs                   # esbuild + PostCSS bundler（4 entry 串行）
├── tailwind.config.js
├── postcss.config.mjs
├── assets/
│   ├── icon.png                # 占位 1×1 transparent PNG —— 真实图标留待替换
│   └── icon_{16,32,48,128}.png
├── src/
│   ├── content.ts
│   ├── background.ts
│   ├── popup.tsx
│   ├── popup.html
│   ├── popup.css
│   ├── options.tsx
│   ├── options.html
│   ├── lib/                    # 共享逻辑：extract 是核心（Readability + Turndown），其它是辅助工具
│   │   ├── extract.ts
│   │   ├── sanitize.ts
│   │   ├── util.ts
│   │   └── messages.ts
│   └── types.ts
├── plans/
│   └── markdown-1-2-playful-stardust.md   # 已批准的实现方案
└── CLAUDE.md                   # 本文件
```

## 关键约定

> 9 条约定按关注点分 3 组：① 工程层（构建 / 注入 / 生命周期）；② 协议层（数据 / 消息 / 错误）；③ 提取策略（Readability / 知乎 / 输出格式）。全局编号 1-9 不变，方便跨处引用。

### ① 工程层（构建 / 注入 / 生命周期）

1. **按需注入 content script**：`manifest.json` 不再声明 `content_scripts`；用户在 popup 打开时，background 收到 `popupExtract` 消息 → 先 `tabs.sendMessage`（已注入则直接拿结果）→ 否则 `chrome.scripting.executeScript({files:["content.js"]})` 注入 → 再 `tabs.sendMessage`。每次 popup 打开**不**重新注入，避免 listener 累积。content script 端加 `globalThis.__wps_injected` 兜底防重复注册。

2. **SPA 抓空兜底**：按需注入后失去原 `run_at: "document_idle"` 时机。`content.ts` 在收到 `extract` 消息后，先 `waitForDocumentComplete()`（检查 `document.readyState`，否则等 `window.load`）再跑 Readability。极端 SPA（load 后还在 lazy-fetch）仍可能抓空壳。

3. **service worker 不放状态**：每个 message 一气呵成，所有 IO 内联做完再返回。worker 一旦 30s 无活动就被回收。**tabId 由 popup 传入**（service worker 没有 `currentWindow` 概念，SW 里查 `tabs.query({currentWindow:true})` 行为未定义）。

5. **文件名清洗**：Windows 文件名不允许 `\ / : * ? " < > |`，sanitize.ts 已处理。

### ② 协议层（数据 / 消息 / 错误）

4. **download 用 data URL**（不是 blob URL）：规避 worker 终止后 `URL.createObjectURL` 失效。Chrome data URL 上限约 2MB 是**字符数**；CJK 1 字符 UTF-8 3 字节 → encodeURIComponent 后 9 字节 → markdown 字节预算约 600KB。超阈值直接报错 + 提示用户分段剪存。**这是当前长期限制**（用户已接受，不做 zip 方案）。

6. **消息协议的类型**集中在 `src/types.ts`，每个 `type: "xxx"` 是显式联合类型，新加 message 时同步补类型。响应构造走 `ok()` / `fail()` 工厂。

8. **错误归一**：跨 background / popup / content 三处都走 `errMsg(e)`；`chrome.runtime.lastError` 走 `lastErrorMsg()`。提示文案走 `messages.ts` 常量。

### ③ 提取策略（Readability / 知乎 / 输出格式）

7. **markdown 引用块 frontmatter** 写到每个 .md 头部：每行 `> ` 前缀 + emoji 装饰，key 改中文（标题 / 原文链接 / 作者 / 站点 / 摘要 / 抓取时间），末尾固定署名行 `> ✂️ 本文由WebPageStore（网页剪存）一键剪存`。放弃 YAML 语法（不再兼容 pandoc / hugo / jekyll frontmatter 解析）；视觉一致性优先。引用块末尾**留两个空行**，区分正文开始。

9. **知乎专用提取路径**：v0.1.1 加的。`location.host.includes("zhihu.com")` → 走 `extractZhihu()`（**完全跳过 Readability**），其它站点走 `extractWithReadability()`（原 Readability 路径）。知乎 selector 用 `[itemtype="http://schema.org/Answer"]`（schema.org 标记，最权威），作者从 `data-zop` JSON 拿 `authorName`，viewport 中央匹配解决"同一 URL 滚不同回答"问题。

## dev 工作流

```bash
# 安装依赖
npm install

# 自测 / 构建
npm run typecheck      # tsc --noEmit（只检查类型，不产出文件）
npm run build          # node build.mjs → 输出 dist/

# 装到 Chrome：
# 1. 打开 chrome://extensions
# 2. 开发者模式 ON
# 3. "加载已解压的扩展程序"，选 dist/ 目录
# 4. 修改 src/** 后：npm run build → chrome://extensions 点 WebPageStore 的"刷新"图标
```

> ⚠️ `npm run watch` 已删除（之前是 fake watch）。HMR 由 `npm run build + chrome://extensions 点刷新` 替代。**当前不做 watch 模式**（用户接受手动 rebuild）。

> ⚠️ 旧 Plasmo 命令 `plasmo dev` / `npm run package` 已不存在。

## E2E 验证用例

每次迭代都要跑：

| 站点 | URL 示例 | 期望 |
|---|---|---|
| 掘金文章 | juejin.cn/post | 标题 + 正文 + 代码块完整；CJK 数据未超 600KB |
| 知乎专栏 | zhuanlan.zhihu.com/p/xxx | 同上 |
| 知乎回答 | zhihu.com/question/xxx/answer/yyy | 滚到哪个回答抓哪个；作者 = `data-zop.authorName` |
| 博客园 | cnblogs.com | 标题 + 正文 + 代码块完整 |
| Medium | medium.com | 需绕懒加载；图片不下载，只列 URL |
| 个人博客（Hexo） | xxx.github.io | 通常干净 |
| chrome:// 页面 | chrome://extensions | popup 应给 "不是 http(s) 站点" 友好提示，不弹 lastError |

跑测时：开 Chrome 装好扩展 → 打开测试页 → 浏览器右上角点扩展图标 → 看 popup 是否显示标题+摘要 → 点"保存到本地" → 检查 `~/Downloads/WebPageStore/clip_*.md`，打开看 frontmatter 用 `"..."` 引号、引用块末尾**留两个空行**。

## 已踩过 / 待踩的坑

| 坑 | 现象 | 现状 | 应对 |
|---|---|---|---|
| CSP 严苛的页 | inject 失败 | background scheme guard 给友好提示 | 若遇 CSP 报错无法绕过，转 MAIN world（`chrome.scripting.executeScript({world: "MAIN"})`） |
| SPA 直接抓空 | `<div id="app">` 是空壳 | `waitForDocumentComplete()` 兜底 | 已知 limitation `SPA-empty`，不处理（极端情况） |
| 懒加载 `<img data-src>` | 收集到 `data:` 占位 | `collectImageUrls` fallback 到 `data-src` / `lazy-src` / `srcset` | 当前不下载图片，无影响 |
| 防盗链 | 服务端 fetch 拿不到图 | 当前不下载图片，无影响 | 若将来恢复 v0.2：在 content script MAIN world fetch（自带 referer） |
| content script listener 累积 | 反复打开 popup → 多次注册 listener → 重复跑 extract | 已用 globalThis guard + background 先 sendMessage 再 inject | OK |
| scheme guard 缺失 | chrome:// / PDF 注入报 "Cannot access contents of the page" | 已加 scheme guard，友好提示 | OK |
| service worker 不持久 | 异步 IO 中断 | 一气呵成，`return true` 标记异步 | OK |
| downloads 权限 | 部分页拒绝下到用户态目录 | 默认下到 `~/Downloads` 不需要额外权限 | 若需"每次选目录"，`saveAs: true` |
| data URL CJK 膨胀 | 中文 markdown 编码后超 2MB silently 失败 | size guard 按 `encodeURIComponent` 后长度 + 600KB 字节预算 | **当前长期限制**（用户接受） |
| 知乎多回答 page | Readability 启发式选错回答 | `extractZhihu` 专用路径 + viewport 中央匹配 | OK |
| 知乎 author / title | Readability 选错 | `data-zop.authorName` + `og:title` | OK |

## 后续迭代路线

- **v0.2 ~~图片 zip 打包~~** ❌ **已取消**（用户决定不做：当前 .md 路径已满足需求）。如需恢复，重新讨论方案（MAIN world fetch + JSZip + CJK 预算扩展 + markdown 里 `<img>` 标签改相对路径）。
- **v0.3 ~~语雀 API 上传~~** ⏸️ **暂停**（不在当前开发范围）。如需恢复，需重新设计：语雀 body 是 lake 格式（要 lake ↔ markdown 转换）、个人版 token 走 options 页配置、imageUrls 在语雀里仍作外链（v0.4+ 才考虑附件上传）。
- **v0.4+**：AI 精炼、批量剪存、云同步、Firefox 适配。
