# 衣LOG 审美关系基座：正式执行计划

> 状态：已确认，作为二阶段唯一执行计划
>
> 版本：v1.0
>
> 更新日期：2026-07-19

> 2026-07-19 补充：当前本地分析层的正式数据合同、证据权重、洞察门槛与禁止规则固定于 `docs/AESTHETIC-ANALYSIS-RULES.md`。当该文档与本计划的早期临时统计描述冲突时，以规则文档为准。

## 0. 这份文档的作用

这份文档是衣LOG 二阶段的执行依据。后续涉及审美关系、图片识别、数据洞察、快速搭配、实验台和好友搭配的设计或开发，必须先读取本文件、`docs/PROJECT-STATUS.md` 和 `docs/AESTHETIC-LAB-LESSONS-LEARNED.md`。

本阶段的核心交付物是一个能够被 Victor 检查、纠正和回放的个人审美数据基座。系统每一个重要结论都必须能回到：

- 原始衣物图片；
- 单品描述和故事；
- Best Match 的搭配描述和槽位；
- 可复算的统计指标；
- Victor 的确认、修改、拒绝或实穿反馈。

AI 可以提出候选，Victor 才是个人审美事实的最终确认者。

## 1. 已确定的硬约束

### 1.0 环境先于功能：Development readiness 闸门

Development 与 Production 是两个独立系统。二阶段的第一步不是开发功能，而是把 Development 准备成可工作的实验环境：确认 project ref，补齐 migration、RLS、认证、Victor 的真实账号数据和 Kimi Provider，并逐项做真实请求验证。

在 Development readiness 未通过前：

- 不继续扩展审美关系、统计或实验台功能；
- 不把 Production 只读桥当作最终方案；
- 不用手动快照掩盖账号/环境未打通；
- 不把 401、origin mismatch、空数据或 Supabase 未配置简单归因给“代码问题”。

通过闸门后，再在“Development 本地闭环 / Development Preview / 其它隔离方案”中做选择。选择依据是数据完整性、权限边界、Provider 能力和真实使用成本，而不是哪个方案暂时绕过了阻塞。

### 1.1 图片识别是必经步骤

当前系统尚未启用图片识别。审美关系基座开始提取风格字段前，必须先对单品图片进行视觉分析。

图片分析至少需要输出：

- 廓形：宽松、修身、直筒、短款、长款、硬挺、垂坠等；
- 颜色：主色、辅色、点缀色及其 RGB 值；
- 材质：棉、羊毛、皮革、尼龙、针织、丹宁等；
- 图案：纯色、条纹、格纹、印花、Logo 等；
- 视觉重量：轻、中、重；
- 正式度：休闲、日常、半正式、正式；
- 风格候选：由系统提出，不能直接视为用户确认。

颜色不以自然语言作为唯一值。每个颜色候选至少保存 RGB、HEX、颜色角色、服装区域、面积占比和置信度。RGB 应尽量来自图像像素或图像区域采样；无法可靠区分衣服和背景时，标记低置信度并进入人工确认队列。

### 1.2 图片结果必须经过 Victor 认可

图片分析状态固定为：`pending -> processing -> proposed -> confirmed`，也允许进入 `rejected` 或 `failed`。

- `proposed` 只能用于候选展示和实验统计；
- `confirmed` 才能进入正式审美画像、推荐排序和关系推导；
- Victor 可以逐字段修改；
- 用户手工修改后的值优先级高于 AI 值；
- 图片改变时保留旧版本，生成新版本；
- AI 失败时保留原始数据，不阻塞已有 Best Match。

### 1.3 可视化审计台是首阶段必做功能

审计台建议路由为 `/aesthetic-lab`，只对 Victor 开放。它必须让 Victor 看见原始数据、图片识别候选、文本语义、搭配关联、统计过程、结论和待人工处理项。审计台优先清晰、可筛选、可追溯、可修改，不追求视觉装饰。

## 2. 数据如何学习审美

1. 从图片中获取可观察的视觉事实。
2. 从单品故事中提取情感、记忆、身份和偏好信号。
3. 从 Best Match 描述中提取搭配意图和关系谓词。
4. 从已有搭配中计算共现、复用、替换和槽位关系。
5. 从标签、分类、年份和使用记录中计算统计变化。
6. 将事实、关系和统计组合成可检查的洞察。
7. 由 Victor 确认、修改或拒绝，形成个人审美证据。
8. 将后续选择、拒绝和实穿结果回流，更新关系可信度。

首轮不训练通用审美模型，也不从单品相似度直接生成整套搭配。

## 3. 数据合同

### 3.1 视觉属性

首轮新增视觉分析对象，至少包含：

```ts
type VisionAnalysis = {
  itemId: string
  imageHash: string
  sourceUrl: string
  modelVersion: string
  status: 'pending' | 'processing' | 'proposed' | 'confirmed' | 'rejected' | 'failed'
  silhouetteTags: VisionTag[]
  materialTags: VisionTag[]
  patternTags: VisionTag[]
  dominantColors: VisionColor[]
  visualWeight?: VisionScalar
  formality?: VisionScalar
  styleTags: VisionTag[]
  designHighlights: VisionTag[]
  reviewedBy?: 'victor'
  reviewedAt?: string
}

type VisionColor = {
  rgb: [number, number, number]
  hex: string
  role: 'dominant' | 'secondary' | 'accent'
  areaRatio?: number
  region?: 'garment' | 'trim' | 'pattern' | 'unknown'
  confidence: number
  source: 'pixel_sampling' | 'vision_model' | 'user'
}
```

### 3.2 统一审美证据

首轮用统一的 `aesthetic_evidence` 语义对象承载：`personal_signal`、`outfit_intent`、`relation_claim`、`item_feature`。每条证据必须保存 `scopeType`、`scopeId`、`payload`、`evidenceQuote`、`source`、`sourceVersion`、`modelVersion`、`confidence` 和 `status`。

单品故事重点提取情感依恋、身份表达、记忆、喜欢原因、实用偏好、厌恶和象征意义。Best Match 故事重点提取平衡、呼应、对比、稳定、提亮、柔化、锐化、连接、替换和依赖等关系。

任何没有原文引用的主观判断，只能作为待验证假设。

### 3.3 统计与洞察

`aesthetic_metrics` 保存 `metricKey`、维度、分子、分母、数值、样本量、时间范围、覆盖率、缺失字段和计算版本。

`aesthetic_insights` 保存结论类型（事实、推断、假设）、结论文本、证据引用、指标引用、样本量、置信度、时间范围和建议验证动作。

统计结果必须说明分母、样本量、时间范围和缺失覆盖率；洞察必须能够回到具体图片、文本、搭配或指标。

## 4. 可视化审计台

### 4.1 信息架构

左侧流程节点：数据快照、图片识别、文本语义、搭配关系、统计指标、洞察结论、待人工处理。

中间工作区：

- 图片识别：单品图片、候选属性、RGB 色板、置信度；
- 文本语义：原文、证据句、个人信号、搭配意图；
- 搭配关系：Best Match、槽位、变体、共现和替换路径；
- 统计指标：指标、分母、时间范围、数据覆盖；
- 洞察结论：结论、证据、事实/推断/假设标签。

右侧证据检查器：来源图片或原文、对象路径、模型版本、证据引用、当前状态、修改/确认/拒绝和修改历史。

### 4.2 必须具备的交互

- 按状态、单品、Best Match、标签和关系筛选；
- 点击关系跳转来源对象；
- 点击统计结论查看计算明细；
- 编辑单个颜色的 RGB、角色和区域；
- 编辑或删除单个风格标签；
- 对文本只保留部分证据；
- 一键查看所有等待 Victor 处理的节点；
- 保留每次人工修订记录。

### 4.3 审计台验收标准

- 任意结论都能追溯到原始图片、文本和统计；
- 视觉属性可以逐字段确认；
- RGB 以数值显示并可修改；
- AI 候选和用户确认有明确区分；
- 失败节点有原因和重试入口；
- 不需要打开数据库或日志就能判断系统做了什么；
- 审计台不生成未经确认的正式审美结论。

## 5. 执行排期

### 第 1 周：快照与图片识别原型

交付数据快照脚本、视觉分析状态模型、图片区域识别与 RGB 提取原型、视觉属性 JSON Schema 和第一版人工确认表。

闸门：候选结构化、RGB 为 `[0,255]` 整数数组、原图/版本/结果可追溯、失败不影响既有能力。

### 第 2 周：图片确认与文本语义

交付 `/aesthetic-lab` 图片确认工作区、单品故事个人信号、Best Match 搭配意图、逐字段确认/修改/拒绝和版本记录。

闸门：每条语义有原文引用，Victor 可以修正，未确认内容不进入正式画像。

### 第 3 周：关系索引与统计引擎

交付 Best Match 主单品/变体/槽位索引，共现/复用/替换/桥梁单品计算，品类/品牌/标签/年份统计，以及指标快照。

闸门：统计有分子/分母/样本量，旧 `best_matches.items` 不改写，关系证据等级清晰。

### 第 4 周：洞察生成与 Victor 校准

交付情感锚点、审美核心、桥梁单品、时间变化、潜在矛盾五类洞察和证据查看器。

闸门：事实/推断/假设分层，泛化或无证据结论不进入正式画像。

### 第 5 周：Supabase 表、RLS 与 API

交付 `aesthetic_evidence`、`aesthetic_metrics`、`aesthetic_insights`、`outfit_feedback_events` 及 migration、RLS、索引、同意状态和关系调试 API。

闸门：可回滚、旧客户端兼容、用户隔离、AI 关闭后确定性能力可用。

### 第 6 周：只读画像与关系页

交付审美画像页、单品关系页、Best Match 搭配思路页和统一证据查看器。

### 第 7 周：快速模式

交付从单品获取已有 Best Match、上下文变体、选择/实穿反馈和 Quick session 埋点。

### 第 8 周：实验模式

交付 RPG 拼贴槽位、替换/比较/撤销、待尝试/接受/拒绝/实穿状态和逐槽位证据。好友邀请放在以上能力稳定之后。

## 6. 技术实现位置

建议新增：

```text
src/lib/aesthetic/contracts.ts
src/lib/aesthetic/normalize.ts
src/lib/aesthetic/vision.ts
src/lib/aesthetic/evidence.ts
src/lib/aesthetic/relations.ts
src/lib/aesthetic/stats.ts
src/lib/aesthetic/insights.ts
src/pages/AestheticLabPage.tsx
src/components/aesthetic-lab/*
scripts/aesthetic-lab/snapshot.ts
scripts/aesthetic-lab/extract.ts
scripts/aesthetic-lab/report.ts
supabase/migrations/YYYYMMDD_aesthetic_foundation.sql
```

建议 API：

```text
POST /api/aesthetic/vision/analyze
POST /api/aesthetic/vision/:id/review
GET  /api/aesthetic/evidence
GET  /api/aesthetic/metrics
GET  /api/aesthetic/insights
POST /api/aesthetic/insights/:id/review
GET  /api/item/:id/relationships
```

图片识别复用当前 Supabase Auth、服务端 Kimi relay 和图片上传规则，模型密钥不得出现在客户端。

## 7. 测试与停止条件

必须覆盖 RGB 格式与范围、图片重复和替换、低置信度、人工修订历史、文本证据引用、关系证据等级、统计分母/缺失值/时间范围、洞察引用、AI 同意撤回、RLS 和旧客户端兼容。

以下情况出现时停止扩大范围：图片结果长期无法被 Victor 认可；RGB 受背景影响无法复现；AI 标签没有原文证据；统计只能生成排行榜；洞察无法追溯；已有 Best Match 检索尚未产生真实价值。

## 8. 后续执行规则

1. 任何二阶段任务先读取本文件和 `docs/PROJECT-STATUS.md`。
2. 完成当前周交付物和闸门后再进入下一周。
3. 未经 Victor 确认的数据不得标记为个人审美事实。
4. 新字段必须同步 TypeScript 类型、migration、数据访问层、RLS 和测试。
5. 修改数据或 API 后运行 `npm run lint` 与 `npm run build`。
6. 每个阶段结束时更新本文件版本、完成项、未决项和下一闸门。

## 9. 当前下一步

固定启动 Sprint 1：导出 Victor 当前账号数据快照，选取首批图片建立视觉识别样本，完成 RGB 和风格字段确认界面，记录第一轮人工修订，再开始文本语义和搭配关系提取。

在 Sprint 1 完成前，不开发系统推测搭配，不开发好友邀请，不把 AI 视觉结果写入正式审美画像。

## 10. Sprint 1 实施状态（2026-07-19）

已完成代码：

- 新增 `supabase/migrations/202607190001_aesthetic_vision.sql`：图片识别同意、视觉候选、修订历史和 RLS；
- 新增 `/api/aesthetic/vision/analyze`：登录校验、同意校验、AI 限流、视觉 JSON 解析和字段归一化；
- 新增 `src/lib/aestheticVision.ts`：图片读取、哈希、候选保存、人工确认、拒绝和修订记录；
- 新增 `/aesthetic-lab`：流程节点、单品样本、RGB 编辑、视觉字段确认、待处理队列和修订历史；
- 主导航已增加 Aesthetic Lab 入口。

验证结果：

- `npm run lint` 通过；
- `npm run build` 通过；
- 构建仍有既有的大型 chunk warning，不影响本次功能构建。

当前边界：

- 迁移文件已应用到 Development `wearlog-dev`（`mazsopbfpqchzhyuaron`），并通过 `npx supabase db push --dry-run` 确认远端已是最新；Production `wearlog`（`cfnkhilwpkfqebrticqe`）未 link、未 push；
- 迁移应用前，审计台会明确显示数据库不可用，不会静默写入本地或伪造分析结果；
- 下一步是在隔离的 Preview/Development 环境用 Victor 账号识别第一批图片并完成人工校准。

隔离规则：本地 `supabase/config.toml` 只允许指向 Development project ref；任何 Production 迁移必须使用独立、明确的生产配置和单独审批，不得复用本文件。

## 12. 审计台 Preview 交付（2026-07-19）

- `/aesthetic-lab` 已部署到隔离 Preview：
  `https://wearlog-victorzhang016-code-victorzhang016-codes-projects.vercel.app/aesthetic-lab`
- Vercel Preview 已补齐 `SUPABASE_ENV=development`；API 闸门现在允许明确指向 Development 的 Preview，仍拒绝缺失或错误环境配置。
- Preview 的 `VITE_SUPABASE_URL` 和 publishable key 已重新写入 Development 项目配置；本地 `.env.local` 已同步，且由 `.gitignore` 保护。
- 预发布验证：页面返回 200；未携带登录令牌调用视觉 API 返回预期的登录失效错误，未触发生产服务。
- 本次没有使用 `--prod`，Production 域名和 Production 环境变量未变更。

### Preview 配置校验修复

前端原先用 `import.meta.env.PROD` 直接要求 `VITE_SUPABASE_ENV=production`，导致所有 Vercel Preview 构建被误判为 Production。现已改为仅当 `VITE_VERCEL_ENV=production` 时执行 Production 校验；Preview 使用 Development Supabase。修复后已在 Victor 当前 Chrome 标签页实测，Supabase 配置错误消失。

### Google 授权来源修复

Google Identity Services 要求当前页面 origin 位于 OAuth 客户端的 Authorized JavaScript origins。此前使用随机 Preview 域名会触发 `origin_mismatch`。现已将 Preview 绑定到固定入口 `https://wearlog-victorzhang016-code-victorzhang016-codes-projects.vercel.app`，并只在 Google OAuth 客户端中加入这一来源。Production 域名、Production Supabase 和现有回调 URI 未改动；Chrome 实测已能进入 Google 账号选择页。

## 13. 本地优先执行补充（2026-07-19，后续执行依据）

为避免 Provider 配置成为数据工作的阻塞，本计划新增一个与线上审计台并行、但完全独立的本地实验闭环。后续涉及“数据分析系统”和“图片识别字段”时，优先使用本节；Google OAuth、Supabase Auth 和 Supabase 写入不是本地实验前置条件。

### 本地入口与数据边界

- 启动：在应用目录运行 `npm run dev:local`，打开 `http://localhost:3000/aesthetic-lab/local`（也可使用 `npm run dev`）；
- 输入：优先从衣 log Production 只读同步，也支持导入 JSON 快照；快照支持 `wardrobeItems`、`bestMatches`、`visionAnalyses` 三个数组（也兼容 `items`、`matches`、`analyses`）；
- 存储：快照、人工确认字段和分析结果写入浏览器 `localStorage`，可导出 JSON；不写线上 Supabase，不修改 Production；
- 视觉服务：Vite 仅在开发服务器内挂载 `/api/local/aesthetic/vision`。`.env.local` 中的 `KIMI_API_KEY` 只在服务端读取，浏览器永远拿不到；
- 降级：没有或无效 Kimi key、读图超时或返回不可解析字段时，统计、关系和人工字段仍然可用；浏览器本地从图片像素提取 RGB 主色，廓形/材质/风格不猜测，留给 Victor 确认。

### 账号数据同步

本地页的“从我的账号同步”使用独立的数据源 Supabase 会话，只读衣 log Production 的 `wardrobe_items`、`best_matches` 和 `aesthetic_vision_analyses`。实验客户端仍固定为 Development；数据源客户端只允许 `VITE_AESTHETIC_SOURCE_ENV=production`，同步结果转换为本地快照并写入 `localStorage`，不会写回数据库。Production 只读，实验写入只发生在 localhost。

当前 `.env.local` 与 Vercel Production 的 Kimi key 指纹一致；本地请求已对齐线上成功格式（`max_tokens` 与 system message），不再使用导致误判的 `temperature` 参数。

### 图片字段闭环

1. 选择一个单品并点击“读图”；
2. 本地服务要求模型只输出可见服装事实：廓形、材质、纹样、风格、设计亮点、视觉重量、正式度和主色 RGB；其中设计亮点必须是可见且具体的结构或装饰细节，不接受泛泛的审美形容词；
3. 结果进入 `proposed`，每个字段带置信度和证据文本；
4. Victor 可编辑、删除或拒绝字段；只有点击确认后的字段进入本地分析；
5. 颜色以 `[R,G,B]` 保存，同时派生十六进制展示，模型不得只返回颜色名称。

当前先验收图片字段闭环：颜色必须能通过色盘和 RGB 数值双向修改；廓形、材质、图案、风格和设计亮点必须能直接编辑、删除；当 Victor 只知道“原结果错误”和一个宽泛概括（例如“机能面料”）时，系统必须允许提交概括并请求 3–6 个候选标签，再由 Victor 选择或继续修改。点击确认后，整组字段必须写入带有 `itemId` 的视觉分析记录并持久化到本地快照；刷新页面仍能恢复同一单品的同一组字段。该闭环完成并标记所有首批图片后，才恢复关系基座开发。

批量解析只处理有图片且当前没有 `confirmed` 记录的单品，按顺序逐件请求并立即写入 `proposed` 结果；已有 `confirmed` 记录永远跳过。批量失败的单品保留原记录并进入失败提示，不能覆盖人工已经确认的数据。

关系与结论区域当前只保留临时统计展示。它尚未实现搭配层级、槽位语义、替换路径、文本意图和证据等级组合，不能作为审美结论使用。

### 统计与关系输出

本地分析器从快照生成四类结果：标签/分类计数，年份与季节等时间尺度变化，Best Match 共现与槽位变体关系，以及三种结论等级（事实、基于多次行为的推断、需要验证的假设）。任何推测都不会冒充 Victor 已确认的审美事实。

### 明确不做

本地模式不把识别结果写回正式表、不发布公开读图 API，也不依赖 Google 授权。真实账号数据通过独立 Production 只读客户端同步，分析快照和人工确认只写 localhost；JSON 快照仍作为离线备份和故障恢复手段。
