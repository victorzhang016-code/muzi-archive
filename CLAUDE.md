# 衣LOG（wearlog）— 项目 CLAUDE.md

> **命名说明（重要）：** 本项目**现用名「衣LOG」**（英文 **wearlog**），**曾用名「模子の衣柜」**。
> 凡是文档、代码、git 历史、本机路径、仓库/域名里出现的 **「衣柜」「模子の衣柜」「muzi」「muzi-archive」** 都指**同一个项目（衣LOG / wearlog）**，不是另一个东西。
> 历史遗留命名（仍未改、改了有成本）：GitHub 仓库名仍是 `muzi-archive`，本机目录仍是 `…\模子の衣柜`，部分内部 localStorage / 文件名前缀历史用过 `muzi-`。面向用户的名称、UI、SEO 已全部统一为 衣LOG / wearlog。

## 项目定位

**衣LOG（wearlog，曾用名「模子の衣柜」）** 是 Victor 的个人衣物档案 app，以实体服装吊牌为核心视觉隐喻（Margiela / Essentials 风格）。不是穿搭推荐工具，是建立自我认知的工具——每件衣服背后都有只属于自己的故事。

**目标用户：** AI / builder 圈（18-35岁），核心主张：builder 文化本身是一种时尚。

**线上地址：**
- GitHub: `https://github.com/victorzhang016-code/muzi-archive`（仓库名仍是旧名 muzi-archive，main 分支）
- Vercel: `https://wear-log.vercel.app`（现用域名；曾用 `muzi-archive.vercel.app`。push main 自动部署，不用 Vercel CLI）

---

## 关联文档（碰到对应需求**先查**）

| 文档 | 什么时候必查 |
|---|---|
| **`容量评估.md`** | 任何涉及**面向公众 / 承载力 / 能扛多少用户·访问 / 扩容 / 升级套餐 / 定价 / 上量决策**的需求 —— 先读它拿数字和瓶颈，再回答/动手 |
| **`踩坑经验.md`** | 排错、Firebase/Vercel 配置、迁移、AI 导入、防限流相关问题 —— 先查有没有踩过的坑（本文件下方「踩坑速查」是精简版）|

---

## Tech Stack

| 层 | 技术 |
|---|---|
| 前端 | React + TypeScript + Vite |
| 样式 | Tailwind CSS v4 |
| 动画 | motion v12 |
| 认证 | Firebase Auth（Google 专属，**已移除匿名登录**） |
| 数据库 | Firestore（**命名数据库**，非 default） |
| 图片存储 | **Vercel Blob**（Phase3 已完成；旧图仍兼容 Firestore base64 读取） |
| 后端 | Vercel serverless functions（`/api/` 目录） |
| AI 导入 | Kimi relay via `/api/ai-import` |

---

## 关键架构决策（勿改）

### Firestore 命名数据库
- 数据库 ID：`ai-studio-6fd5f2f5-eaa7-473f-b484-cc0b2cdcd9bb`（不是 `(default)`）
- Firebase Console 默认显示 default 库的规则，改规则必须先在顶部切换数据库
- 规则直链：`console.firebase.google.com/project/gen-lang-client-0133868878/firestore/databases/ai-studio-6fd5f2f5-eaa7-473f-b484-cc0b2cdcd9bb/rules`

### 图片存储：Vercel Blob（Phase3，已完成）⟵ 原 base64 存 Firestore
- **历史（Phase1–2）**：弃用 Firebase Storage（新格式 bucket 默认 `allow write: if false`，上传必失败）；图片压缩成 base64（720px 宽 / 78% JPEG，`src/lib/cropImage.ts` 的 `compressToBase64()`）直接存 Firestore 文档字段。
- **Phase3（2026-06 起）**：图片字节搬到 **Vercel Blob**（public store `wearlog-images`），Firestore 文档只存 https URL。根治读额度被烧 + 带宽 + 发版清缓存（图搬走后看图 0 Firestore 读、Blob CDN 不随部署清）。
  - **新上传**：压缩后经 `/api/blob-upload`（用 `jose` 验 Firebase ID token → `put()` 到 Blob）→ 拿 URL 存进 `imageUrl`/`photoBase64`。前端 `src/lib/blobUpload.ts`；三处上传（`AddEditItemModal` 裁剪后、`BestMatchDetail`、`BestMatchBuilder` 照片）均已切。HEIC 仍先经 `normalizeImageFile` 转 JPEG。
  - **读取兼容**：渲染同时支持 `data:`(旧 base64) 和 `https:`(新 Blob)；`api/public` 透传 https、旧 `data:` 仍改写 `/api/img`，并剔除迁移备份字段。
  - **存量老图迁移（已完成，前端入口已下线）**：曾用 owner 首页一次性「迁移我的图片」按钮（`MigrateImages`，每人各跑自己）逐张搬到 Blob；迁移已跑完，组件与 `/migrate` 数据迁移工具（`MigrateData`）均已从前端移除（见 git 历史）。原图备份字段 `imageUrlBackup` / `photoBackup` 仍在文档里，可单独清理回收存储。
  - 存储/CLI 参照、坑详见 memory `wearlog-vercel-blob-store` / `wearlog-image-blob-migration`。

### AI 导入链路
```
PDF → 浏览器用 unpdf 提文字（不传 PDF 文件，避免 Vercel 4.5MB 限制）
TXT → 直接读文字
文字 → POST /api/ai-import → Kimi relay
Kimi: https://api.kimi.com/coding/v1/messages，Anthropic 协议
env var: KIMI_API_KEY（无 VITE_ 前缀，服务端可见）
max_tokens: 16384，客户端做截断兜底
```

### Firestore 规则
- 只校验 auth + userId，**不做字段类型校验**
- 原因：base64 图片超字符上限 → permission-denied
- 改规则后部署：`firebase deploy --only firestore:rules`
- 确认输出有 "uploading rules" 而非 "skipping upload"（后者代表 firebase.json 路径写错）

### 公开页边缘缓存（防限流，勿绕过）
- **所有公开读都走 `api/public/[uid].ts`（Vercel 边缘缓存），不直连 Firestore。** 这是免费层 5 万读/天上限下抗流量的命门。
- 该函数用 **Firestore REST**（免 SDK、无 gRPC）读取，显式校验 `wardrobePublic`（整柜公开闸门，v2 已从旧 `shareEnabled` 改名），把 Timestamp 序列化成 millis。命门：缓存让 **Firestore 读取与访问量解耦**。
- 客户端取数都在 `src/lib/publicWardrobe.ts`：整柜 `fetchPublicWardrobe()`（`ShareView`、`sampleItems` 卡墙/示例卡）；单条深链 `fetchPublicItem()`（`SharedItemView`）/ `fetchPublicMatch()`（`SharedBestMatchView`，走 `api/public-item`、`api/public-match`，按单品/搭配 gate，整柜未公开也能开单条）。
- 时间戳兼容：公开路径是 millis，owner 直连路径是 Firestore Timestamp → 渲染日期一律用 `toDateSafe()`。
- 2026-06-28 线上事故记忆：若 `/author` 和整柜公开同时失效，先别查前端，先直接请求 `https://wear-log.vercel.app/api/public/<authorUid>`。这次真实症状是该接口返回 `500 FUNCTION_INVOCATION_FAILED`，导致“先看作者衣柜”和访客公开衣柜一起坏。
- 这次根因不在 `wardrobePublic` 判定，而在公开相关动态 serverless 函数启动失败。`api/public`、`api/public-item`、`api/public-match`、`api/img` 共同依赖 `api/_lib/devGuard`；线上恢复时采用的稳妥修法是把 `blockDevProdFirestore` 直接内联到这 4 个文件里，减少函数装载链路风险。提交：`b4cc169`，标题 `Fix public wardrobe API deployment`。
- 复核顺序：先查 `/api/public/:uid` 是否从 500 恢复到 200；再查 `/api/public-item/:uid/:id` 与 `/api/img/:uid/:id` 是否 200。不要只看 `git push` 或 `npm run lint` 就认定线上已恢复。
- owner 自己的 app（`WardrobeContext`/`BestMatchContext` 实时直连）**不走缓存**，保持即时。
- 新增公开页时**务必走缓存接口**，不要再写 `getDocs`/`onSnapshot` 直读公开数据。

#### 当前缓存值（2026-06，勿无脑改回 60s）
| 接口 | `Cache-Control` | 撤销延迟 |
|---|---|---|
| JSON：`public` / `public-item` / `public-match` | `s-maxage=300, stale-while-revalidate=3600` | ~5 分钟 |
| 图片：`api/img` / `api/media` | `s-maxage=3600, stale-while-revalidate=0` | ~1 小时 |

- **演进史（勿走回头路）**：原值 `3600/86400`（每作者每天回源 ~24 次，与访问量无关）→ 安全加固一度改成 `s-maxage=60, swr=0` 追求「秒级可撤销」，但这**打穿了「读取与访问量解耦」**，放量后极易撞 5万/天 → 现折中回 JSON `300/3600`、图片 `3600/0`（方案 B）。**别再改回 60s/SWR=0**，除非先解决下面的 purge 问题。
- **无 per-URL purge 的固有约束**：这套 Vite SPA + Vercel serverless **没有「按 URL 主动失效边缘缓存」的能力**。所以「取消分享」后图片直链最长还能被打开 ≈ 图片 `s-maxage`（现 ~1 小时），**不是即时**。公开图片 URL 带的版本号 `?v=updatedAt` 只解决「内容更新别看旧图」，**对撤销不起作用**（`setItemShared` 取消时不改 updatedAt）。要真·秒级撤销得换机制（签名/过期 token、un-share 轮换 blobPath 等），代价大。
- `/api/public?limit=`（卡墙/示例卡）已把 `limit + orderBy createdAt` **下推到 Firestore 查询**（复用 owner app 同款 `(userId, createdAt)` 复合索引），回源读取从 ~100 条降到 ~30 条候选再「有图优先」切前 N。
- **Phase 2（已上线，带宽优化）**：公开接口**不再内联 base64**，把 `imageUrl`/`photoBase64` 改写成图片接口 URL `api/img/[uid]/[id].ts`（读单条解码成 JPEG，缓存 1 天，规则 gate）。整柜 JSON 从 8.58MB → ~100KB；图片走独立缓存接口 + 懒加载（`WardrobeItemCard` 的 `eager` prop：owner=eager 默认，公开页传 `eager={false}`）。owner 自用仍直连 base64，不受影响。
- **Phase 3（已完成）**：图片字节搬到 **Vercel Blob**（store `wearlog-images`），Firestore 只存 blobPath/URL。
- **v2 安全加固（已上线）覆盖了 Phase3 的「透传 Blob 直链」**：为了「分享可撤销」+「外链可收回」，公开图片**不再透传 Blob 公网 URL，统一经 `api/img` 代理**（每次回源读 1 条 doc 校验 gating 再取 Blob）。代价是看图回源**不再是 0 Firestore 读**——靠上面「图片 1 小时缓存」把每张压到每小时 ≤1 次。这是「可撤销 vs 0 读」的取舍，别为省读把图片改回透传公网 URL（会让外链永久不可撤回）。

---

## Firebase / Vercel 踩坑速查

> 完整版（症状→根因→解法→教训，24 条）见仓库根 **`踩坑经验.md`**。下面是高频速查。

| 症状 | 根因 | 解法 |
|---|---|---|
| Storage 上传 permission-denied | 新格式 bucket 默认不可写 | 弃用 Storage，用 base64 |
| 规则部署 "skipping upload" | firebase.json 中 rules 路径写错（用了冒号不是点号） | 改为 `"rules": "firestore.rules"` |
| 改了规则线上不生效 | 改的是 default 库，本项目是**命名库 `ai-studio-...`** | 控制台先切到命名库；CLI 认 firebase.json |
| 规则 permission-denied | imageUrl 字段长度校验 | 去掉字段校验，只验 auth |
| 手机登录每次 UID 不同 | signInAnonymously 和 signInWithRedirect 竞争 | 已移除匿名登录，彻底解决 |
| lazy 图片返回不加载（owner 端） | CSS columns 布局 + intersection observer 不重触发 | owner 端用 `loading="eager"`（公开端是 CSS grid，可 lazy）|
| 公开页报「未开启分享」但其实已开 | **Firestore 免费层每日读额度（5万/天）用尽 → 429**，规则 `sharingEnabled()` 的 get `wardrobe_users` 被挡 → 判 false | 额度按太平洋时间午夜重置；代码区分 `permission-denied`(真没开) vs 429(显示「繁忙」且不缓存错误)；**根治＝公开页走边缘缓存**（已上线，见下「公开页边缘缓存」节）|
| serverless 函数 500 `FUNCTION_INVOCATION_FAILED` | `package.json` 是 `"type":"module"`，ESM 下裸 `import x.json` 运行时报错（构建却过）| 函数里**别 import JSON**，把 projectId/dbId 等非密钥常量**硬编码** |
| 改了 `VITE_AUTHOR_UID` 线上不变 | `VITE_*` 是**构建期**变量；本地 `.env` 与 Vercel env 两套 | 两处都改 + **重新构建/部署**才生效 |
| 极少用户也能烧光 5万读/天 | **每次部署清空边缘缓存**（Phase2 还作废全部 ~101 图）→ 部署后访问全冷启回源。**实测：2 用户 3 小时烧光**，主因同一天**连发 5 次部署** + 紧接着互看 | **别在活跃使用期频繁部署/压测**；批量改低峰一次性发；额度太平洋午夜重置。注：v2 后公开图片改走 `api/img` 代理（可撤销），看图回源**又回来了**，靠 1 小时缓存压制（非 0 读）；另一个常被忽略的烧额度真凶是**本地 dev 直连生产**，见下条|
| 没真实访问 / Vercel 无请求，Firestore 读却匀速狂涨 | **本地 `npm run dev` 直连了生产库**：owner app 用 `onSnapshot` 直读 Firestore、绕过 `/api`、绕过 Vercel（日志看不到），HMR 反复重订阅全量重读 | 本地一律 `npm run dev`（已改默认连模拟器，需先 `npm run emu`）；只有 `npm run dev:prod` 才连生产、页面有红条提醒。判别：Vercel 无请求 + 匀速直线 = 客户端 SDK 直连。见 memory `firestore-quota-debugging-trap` |
| **线上**一次打开就读上千、用量图一阵阵尖峰（Vercel 无请求、实时读取指标却小） | **墙内/VPN 反复掐断 Firestore 实时监听的 streaming 长连接** → SDK 每次重连**整柜重读一遍**。实测一次打开放大 ~8×（143 条 → ~1150 读）。判别：DevTools Console 满屏 `ERR_CONNECTION_CLOSED` + `WebChannelConnection RPC 'Listen' stream transport errored`；网络稳时刷新则干净（几条 channel、200、走缓存近 0 读）→ 间歇性，跟代理稳定度相关 | `firebase.ts` 生产路径 `initializeFirestore` 加 **`experimentalForceLongPolling: true`**（已上线）：改走短轮询，无长连接可掐 → 不再断-重连-整柜重读。全员国内挂代理，故用 Force 而非 AutoDetect（后者连上后中途被掐救不了）|
| 迁移把数据库整个删没 | 账号迁移**比对了错误的 uid** + 原数据**无备份** → 只能重建 | 迁移前**先 export 备份**；涉及 uid 匹配先 **dry-run 核对 ID**；先在测试库演练 |
| Kimi 一键导入总解析失败 | 真因是 **PDF 文字超 Kimi 单次容量被截断**（不是输出 JSON 不干净）| **扩大单次可读取上限 / `max_tokens`**；格式强约束只治标，容量才治本 |

> ⚠️ 读取额度（Phase1 边缘缓存）+ 带宽（Phase2 图片拆分）+ Phase3（图片搬 Vercel Blob）均已上线。注意 v2 安全加固后公开图片改走 `api/img` 代理（可撤销），看图不再 0 Firestore 读 —— 当前缓存策略与「无 purge / 图片撤销 ~1h」约束见下「公开页边缘缓存」节；勿把缓存改回 60s。细节亦见 `踩坑经验.md`。

---

## WardrobeItem 数据结构

```typescript
{
  userId: string           // Firebase Auth UID
  name: string             // 单品名称
  brand?: string           // 品牌（联名用 " x " 分隔，规范化处理）
  category: '上装' | '下装' | '鞋子' | '配饰'
  season: '春秋' | '夏季' | '冬季' | '四季' | '无'
  length?: '长裤' | '短裤'  // 仅下装
  rating: number           // Margiela 评分
  story: string            // 故事/装备描述（核心字段）
  purchaseYear?: number
  imageUrl?: string        // Phase3=Vercel Blob https URL；旧数据可能仍是 data:base64
  imageUrlBackup?: string  // 迁移时原 base64 备份（回退用；回收存储时清理）
  orderIndex: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## 导航与动画规则

- **禁用 `navigate(-1)`**，所有返回按钮用固定父级路由（`navigate('/archive')` 等）
- 动画必须双向：进入 fan-out + 返回 collapse，使用 motion v12
- 物理感 ease（非线性，有弹性感）

---

## 开发工作流

```bash
cd "E:\个人项目\衣柜\模子の衣柜"
npm run emu          # 先起 Firebase 模拟器（需 Java）
npm run dev          # 本地开发 —— 默认连【模拟器】，读写不碰生产、额度恒 0
git push origin main # 触发 Vercel 自动部署（不用 vercel CLI）
```

> ⚠️ **本地一律连模拟器，别直连生产库。** `npm run dev` 已改为**默认连模拟器**（安全默认）。
> 只有 `npm run dev:prod`（加载 `.env.prod` 的 `VITE_ALLOW_PROD=true`）才在 dev 下连生产——
> **会烧免费额度**，且 owner app 用 onSnapshot 直连 Firestore、绕过 /api，**Vercel 日志里看不到这些读**。
> 真要连生产排查时，页面顶部会有红色横幅提醒。serverless 侧另有 `api/_lib/devGuard.ts` 默认禁止 dev 直读生产。
> 历史教训见 memory `firestore-quota-debugging-trap`。

**env 变量：**
- `KIMI_API_KEY`：服务端，无 VITE_ 前缀
- `BLOB_READ_WRITE_TOKEN`：服务端，Vercel Blob 写令牌。建 Blob store 时自动注入 Vercel Production/Preview/Development + 本地 `.env.local`（`.env*` 已 gitignore）。`/api/blob-upload` 用。
- `GEMINI_API_KEY`：客户端（legacy，当前 AI 用 Kimi）
- `VITE_AUTHOR_UID`：作者账号 uid，用于登录页卡墙 / 新用户示例卡 / `/author` 公开预览。**构建期变量**（VITE_ 前缀，打包时写死）→ 改了必须重新构建才生效。本地在 `.env`，线上在 Vercel 环境变量。当前值 `Tji9nTlLbvSJFJJoeuCDzMqmmxN2`。
- `VITE_ALLOW_PROD`：仅本地。`true` 时让 `npm run dev:prod` 在 dev 下连**生产** Firestore（默认不连，`npm run dev` 走模拟器）。放在已入库的 `.env.prod`（非密钥）。生产构建（mode=production）不加载此文件，不受影响。
- `ALLOW_DEV_PROD_FIRESTORE`：仅本地 / vercel dev 的 serverless 侧。默认禁止 `/api` 直读生产 Firestore，`true` 才放行（见 `api/_lib/devGuard.ts`）。

---

## 分享 / 作者公开衣柜（运维必读）

分享功能与登录页卡墙都依赖「作者衣柜公开可读」。换设备 / 换账号 / 部署排查时按此核对：

**隐私模型（v2，按单品/搭配分享）：**
- **每条** `wardrobe_items` / `best_matches` 有 `shared:boolean` —— true=这一条可被链接公开访问。分享卡打开即自动把目标置 `shared=true`，可在卡里「取消分享这一件」。
- **整柜公开** = `wardrobe_users/{uid}.wardrobePublic`（**新字段**）。只在分享卡里勾选「公开我的整个衣柜」才置 true，可随时取消。
- 分享一套 best match 会**连带**把它 `allItemIds` 引用的单品也置 `shared=true`（落地页才能渲染吊牌串 / 点开单品）；取消时回收（但跳过仍被其它已分享搭配引用的单品）。逻辑在 `src/lib/sharing.ts`。
- ⚠️ **旧的全局 `shareEnabled` 字段已停用**（闸门改读 `wardrobePublic`）→ 老用户整柜自动回到私密，无需批量写。`shareEnabled` 残留数据无害。
- 单条深链不再拉整柜：`/share/:uid/item/:id` 走 `api/public-item`，`/share/:uid/best-match/:id` 走 `api/public-match`（各自单条 gate）；整柜页 `ShareView` 仍走 `api/public`（gate=`wardrobePublic`）。

**作者公开衣柜（卡墙 / `/author`）要生效：**
1. **作者账号在任一分享卡勾过「公开我的整个衣柜」** → 写入 `wardrobe_users/{authorUid}.wardrobePublic=true`。没勾 → 公开读被规则挡 → 卡墙拉到 0 张 → 优雅降级为空（不是 bug）。**注意：v2 上线后作者需重新勾一次**（旧 `shareEnabled` 不再被读）。
2. **`VITE_AUTHOR_UID` 要等于该作者 uid**，且三处同步：本地 `.env`、Vercel **Production**、Vercel Development（Preview 因 CLI 限制可在后台手动加，仅影响 PR 预览）。
   - 拿 uid 最快方式：作者登录后点「分享」，下方 Link `…/share/XXXX` 里的 XXXX 即 uid。
3. **改了 uid 或规则后要重新构建 / 部署**：
   - 代码 / env 改动：`git push origin main`（Vercel 自动重建，env 在构建时注入）。
   - Firestore 规则：`firebase deploy --only firestore:rules`（先切到命名数据库 `ai-studio-...`，确认输出 "uploading rules"）。

**分享技术点：**
- 公开深链：`/share/:uid/item/:id`、`/share/:uid/best-match/:id`（顶层路由，无需登录）。
- 分享图：`ShareCardModal` 用 `html-to-image` 把卡片渲染成 PNG + `qrcode` 二维码短链。
- `wardrobe_items` / `best_matches` 规则公开读 = `resource.data.shared == true || wardrobePublic(userId)`（与彼此对齐）。
- 复用组件 `SharedItemCard`（只读弹窗 / 深链页 / 分享图三处共用）。

---

## 已上线功能（截至 2026-06）

- **图片搬 Vercel Blob（Phase3，已完成）**：新上传走 Blob，公开看图 0 Firestore 读；存量老图已迁完，前端迁移按钮已下线。详见上「图片存储」节。
- **HEIC/HEIF 上传**：iPhone 默认格式，上传前 `normalizeImageFile` 动态加载 `heic-to`(WASM) 转 JPEG，再走原有压缩链路。
- **配饰子类型新增「美甲」「袜子」**（`AccessoryType`）。
- **访客 Best Match 详情 = 主人布局**：抽出共用只读组件 `BestMatchView`，`BestMatchDetail`(主人) 与 `SharedBestMatchView`(访客) 共用，差异用 slot 注入，杜绝两套 JSX 漂移。
- **登录页卡墙**：作者公开卡片模糊持续滚动 +「先看看作者的衣柜」预览入口（跳 `/author`）
- **新用户示例卡**：空衣柜展示一张作者真实卡片作示例
- **分享单品 / best match**：生成图文卡片（PNG + 二维码短链）+ 公开深链落地页
- **公开衣柜页（ShareView）单品/Best Match 分视图切换**：顶部「单品 / Best Match」切换按钮（best match 区带一句说明），best match 卡点开进 `/share/:uid/best-match/:id`；页面顶部醒目 CTA「创建我自己的衣柜」→ 回登录页（`/`）

## 已上线功能（截至 2026-05）

- Google 专属登录页（WebView 检测 + 引导在浏览器打开）
- Archive：衣物卡片，CARE LABEL + Polaroid 吊牌视觉系统
- 品牌筛选（折叠 pill 列表）、品牌统计面板、联名品牌规范化
- 裤长字段（仅下装）
- 滚动位置恢复（详情页返回主页不归顶）
- 新建时品类跟随当前筛选默认
- 筛选结果描述句（斜体标题）
- Margiela 评分展示
- 分享页（只读公开链接）
- 数据导入（JSON / CSV / PDF）
- **Best Match**：心中最佳搭配记录，吊牌叠叠乐视觉（开发中）

---

## 路线图

```
Best Match（搭配记录）      ← 当前
穿搭助手（早上推荐）
穿着频率统计
衣服 Dating（AI 对话）
时尚社区
```

---

## Build in Public 上下文

这个 app 是 Victor 的个人项目，公开分享，定期在小红书记录开发过程。

**内容策略：** AI × 物质主义哲思。核心立场：AI 时代真正稀缺的是真实的物质和时间，用 AI 来记录和回归物质生活，而非被它拽进内容消费。

**受众：** AI builder 圈，对「builder 文化是一种时尚」这个反共识有共鸣的人。

**已发内容：**
- 小红书视频（2026.05）：给99件衣服写小作文的男人，做了个「奇迹暖暖」
  - 封面：具体画面感 + 数字 + 文化引用
  - 标题：认真对待物质，是AI时代最被低估的事
  - 冷启动经验：第一版封面「Vibing了」失败，删帖重发后起量

**发布节奏建议：** 每个重要功能上线后配一条视频，主角是 Victor 这个「做东西的人」，产品是道具。
