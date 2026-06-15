# 模子の衣柜 — 项目 CLAUDE.md

## 项目定位

**模子の衣柜** 是 Victor 的个人衣物档案 app，以实体服装吊牌为核心视觉隐喻（Margiela / Essentials 风格）。不是穿搭推荐工具，是建立自我认知的工具——每件衣服背后都有只属于自己的故事。

**目标用户：** AI / builder 圈（18-35岁），核心主张：builder 文化本身是一种时尚。

**线上地址：**
- GitHub: `https://github.com/victorzhang016-code/muzi-archive`（main 分支）
- Vercel: `https://muzi-archive.vercel.app`（push main 自动部署，不用 Vercel CLI）

---

## Tech Stack

| 层 | 技术 |
|---|---|
| 前端 | React + TypeScript + Vite |
| 样式 | Tailwind CSS v4 |
| 动画 | motion v12 |
| 认证 | Firebase Auth（Google 专属，**已移除匿名登录**） |
| 数据库 | Firestore（**命名数据库**，非 default） |
| 图片存储 | Firestore base64（**不用 Firebase Storage**） |
| 后端 | Vercel serverless functions（`/api/` 目录） |
| AI 导入 | Kimi relay via `/api/ai-import` |

---

## 关键架构决策（勿改）

### Firestore 命名数据库
- 数据库 ID：`ai-studio-6fd5f2f5-eaa7-473f-b484-cc0b2cdcd9bb`（不是 `(default)`）
- Firebase Console 默认显示 default 库的规则，改规则必须先在顶部切换数据库
- 规则直链：`console.firebase.google.com/project/gen-lang-client-0133868878/firestore/databases/ai-studio-6fd5f2f5-eaa7-473f-b484-cc0b2cdcd9bb/rules`

### 图片存储用 base64，不用 Storage
- Firebase Storage 新格式 bucket 默认 `allow write: if false`，上传必失败
- 图片压缩：720px 宽，78% JPEG，通过 `src/lib/cropImage.ts` 的 `compressToBase64()`
- base64 直接存 Firestore 文档字段

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
- 该函数用 **Firestore REST**（免 SDK、无 gRPC）读取，显式校验 `shareEnabled`，把 Timestamp 序列化成 millis。响应头 `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` → Firestore 每作者每天只被读约 24 次，**与访问量无关**。
- 客户端统一用 `src/lib/publicWardrobe.ts` 的 `fetchPublicWardrobe()`；消费方：`ShareView`、`SharedItemView`、`SharedBestMatchView`、`sampleItems`（卡墙/示例卡）。
- 时间戳兼容：公开路径是 millis，owner 直连路径是 Firestore Timestamp → 渲染日期一律用 `toDateSafe()`。
- owner 自己的 app（`WardrobeContext`/`BestMatchContext` 实时直连）**不走缓存**，保持即时。
- 新增公开页时**务必走缓存接口**，不要再写 `getDocs`/`onSnapshot` 直读公开数据。
- 公开页相对 owner 编辑有约 1 小时延迟（缓存 TTL），属预期。
- **Phase 2（已上线，带宽优化）**：公开接口**不再内联 base64**，把 `imageUrl`/`photoBase64` 改写成图片接口 URL `api/img/[uid]/[id].ts`（读单条解码成 JPEG，缓存 1 天，规则 gate）。整柜 JSON 从 8.58MB → ~100KB；图片走独立缓存接口 + 懒加载（`WardrobeItemCard` 的 `eager` prop：owner=eager 默认，公开页传 `eager={false}`）。owner 自用仍直连 base64，不受影响。

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
| 防限流上了，调试时读取仍 1 万/次 | **每次部署清空边缘缓存**（Phase2 后还作废全部 ~101 图）→ 部署后首批访问全回源 | 这是 deploy churn，非生产问题；**别刚部署完量读取**，焐热后连刷应全 `x-vercel-cache: HIT`、0 读 |
| 迁移 / 批量操作把数据弄没 | 破坏性操作直接对生产库跑 | **先 export 备份**，先在测试库演练 |

> ⚠️ 读取额度（Phase1 边缘缓存）+ 带宽（Phase2 图片拆分）两道防线均已上线，公开分享可放心传播；细节见下「公开页边缘缓存」节与 `踩坑经验.md`。

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
  imageUrl?: string        // base64
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
cd "C:\Users\29748\Desktop\衣柜\模子の衣柜"
npm run dev          # 本地开发
git push origin main # 触发 Vercel 自动部署（不用 vercel CLI）
```

**env 变量：**
- `KIMI_API_KEY`：服务端，无 VITE_ 前缀
- `GEMINI_API_KEY`：客户端（legacy，当前 AI 用 Kimi）
- `VITE_AUTHOR_UID`：作者账号 uid，用于登录页卡墙 / 新用户示例卡 / `/author` 公开预览。**构建期变量**（VITE_ 前缀，打包时写死）→ 改了必须重新构建才生效。本地在 `.env`，线上在 Vercel 环境变量。当前值 `Tji9nTlLbvSJFJJoeuCDzMqmmxN2`。

---

## 分享 / 作者公开衣柜（运维必读）

分享功能与登录页卡墙都依赖「作者衣柜公开可读」。换设备 / 换账号 / 部署排查时按此核对：

**隐私模型：** 全局开关 `wardrobe_users/{uid}.shareEnabled`。开了之后该用户整个衣柜（含 best match）只读公开；单品 / best match 分享都复用这一个开关（没有逐条开关）。

**作者公开衣柜要生效，三处缺一不可：**
1. **作者账号点过「分享」** → 写入 `wardrobe_users/{authorUid}.shareEnabled=true`。没点 → 公开读被规则挡 → 卡墙拉到 0 张 → 优雅降级为空（不是 bug）。
2. **`VITE_AUTHOR_UID` 要等于该作者 uid**，且三处同步：本地 `.env`、Vercel **Production**、Vercel Development（Preview 因 CLI 限制可在后台手动加，仅影响 PR 预览）。
   - 拿 uid 最快方式：作者登录后点「分享」，下方 Link `…/share/XXXX` 里的 XXXX 即 uid。
3. **改了 uid 或规则后要重新构建 / 部署**：
   - 代码 / env 改动：`git push origin main`（Vercel 自动重建，env 在构建时注入）。
   - Firestore 规则：`firebase deploy --only firestore:rules`（先切到命名数据库 `ai-studio-...`，确认输出 "uploading rules"）。

**分享技术点：**
- 公开深链：`/share/:uid/item/:id`、`/share/:uid/best-match/:id`（顶层路由，无需登录）。
- 分享图：`ShareCardModal` 用 `html-to-image` 把卡片渲染成 PNG + `qrcode` 二维码短链。
- `best_matches` 规则已加 `sharingEnabled()` 公开读（与 `wardrobe_items` 对齐）。
- 复用组件 `SharedItemCard`（只读弹窗 / 深链页 / 分享图三处共用）。

---

## 已上线功能（截至 2026-06）

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
