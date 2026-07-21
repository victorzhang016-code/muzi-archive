# 衣LOG（wearlog）项目现状

> 更新时间：2026-07-18
> 状态：一阶段施工完成。本文是当前项目状态的事实源；产品计划、旧 PRD 与历史踩坑记录中的冲突内容，以本文和代码为准。

## 一句话定位

衣LOG（wearlog，历史目录名「模子の衣柜」）是 Victor 的个人衣物档案 app。它用实体服装吊牌作为视觉隐喻，帮助人记录衣物、理解自己的审美，并把“心中最佳搭配”保存成可分享的个人档案。它不是自动推荐穿搭的工具。

线上主地址：<https://www.wearlog.cn>；Vercel 备用地址：<https://wear-log.vercel.app>
代码仓库：<https://github.com/victorzhang016-code/muzi-archive>（仓库名仍保留历史名）

## 一阶段已完成

### 衣物档案

- Archive 主流程：新增、编辑、删除、筛选、排序、品牌统计、裤长与品类子类型。
- 单品字段包含名称、品牌、品类、季节、裤长/上装类型/配饰子类型、Margiela 评分、故事、购买年份和图片。
- 支持 JSON / CSV 导入；TXT / PDF 通过浏览器提取文字后交给 Kimi 解析，导入后仍需人工核对。
- 当前单柜前端上限为 200 件。
- 支持 HEIC/HEIF 图片转 JPEG、裁剪压缩后上传。

### Best Match

- `/best-match`、`/best-match/new`、`/best-match/:id` 已完成并接入 Archive。
- 衣柜累计至少 3 件单品后解锁；保存至少 1 件上装 + 1 件下装，鞋和配饰可空。
- 主交互是拼贴画板；品类主件上限为 tops=4、bottoms=2、shoes=2、accessories=5。
- 支持同品类多件、变体（variant）、编辑、删除、整套 Look 照片、6 个 scene tags，以及名称和最多 500 字的故事说明。
- `allItemIds` 扁平保存主件和变体，为后续“单件辐射图”查询保留数据基础。
- 累计 10 套搭配后展示 Aesthetic Profile 解锁状态卡；AI 分析内容仍是下一阶段能力，当前没有实际分析结果页。
- 主人详情与访客详情共用 `BestMatchView`，吊牌串、占位单品和变体展示保持一致。

### 分享与公开访问

- 支持分享单品、Best Match 和整柜；分享卡生成 PNG 与二维码短链。
- 公开路由：`/share/:publicId`、`/share/:publicId/item/:itemId`、`/share/:publicId/best-match/:matchId`。
- `shared` 控制单条单品/搭配，`profiles.wardrobe_public` 控制整柜公开；Best Match 分享会同步引用单品的公开状态。
- 访客公开读取统一经 `/api/public*` 与 Supabase RPC，不在客户端直接读取他人数据。
- `/author`、登录页卡墙和新用户示例卡复用作者公开衣柜。
- 公开 JSON 当前使用 `s-maxage=300, stale-while-revalidate=3600`；访客图片统一经 `/api/img` 做分享 gate 和代理，图片缓存为 `s-maxage=3600` 且不使用 SWR。取消分享的 API 层延迟约 1 小时，不承诺秒级失效。
- 当前 Blob 对象仍是 public；因此已经被复制出去的旧 Blob URL 无法被这层 API 撤回。若未来需要真正的撤销分享，要迁移到私有对象 + 签名/短期 token，不能只调缓存时间。

### 账号与 AI

- 当前主身份系统是 Supabase Auth：Google 登录、邮箱密码注册/登录、忘记密码和重置密码。
- 已移除匿名登录；每个用户通过 Supabase `auth.users.id` 保持稳定身份。
- `/api/ai-import` 只接受 Supabase access token，Kimi key 仅在服务端环境变量中使用。
- AI 导入有请求体大小限制与数据库侧时间窗口限流：文本默认每小时 40 次，视觉分析每小时 10 次。

### 图片与基础设施

- 图片字节存放在 Vercel Blob `wearlog-images`，数据库主要保存 URL；新上传已统一走 `/api/blob-upload`。
- Supabase Postgres 当前表：`profiles`、`wardrobe_items`、`best_matches`、`aesthetic_profiles`、`ai_import_usage`。
- RLS 负责用户隔离；公开访问由服务端 RPC `get_public_wardrobe`、`get_public_item`、`get_public_match` 执行分享闸门。
- Vercel 继续承载 SPA、Serverless API 和 Blob。

## 当前技术事实

| 层 | 现行实现 |
|---|---|
| 前端 | React 19 + TypeScript + Vite |
| 样式与动效 | Tailwind CSS v4 + motion |
| 登录 | Supabase Auth；Google ID token 绑定 + 邮箱密码 |
| 业务数据 | Supabase Postgres + RLS + RPC |
| 图片 | Vercel Blob；旧数据仍兼容 `data:` URL |
| AI | Kimi relay：`/api/ai-import` |
| 部署 | Vercel，push `main` 自动部署 |

## 迁移后的兼容遗留

Firebase 已不再是现行业务数据平面。仓库里仍保留 Firebase 依赖、`src/firebase.ts`、`firebase-applet-config.json`、模拟器脚本和 `Timestamp` 类型适配，原因是历史代码和旧数据兼容；新增功能默认使用 Supabase，不要重新把业务读写接回 Firestore。

同理，`firebase-errors.ts` 与部分变量名仍沿用旧命名，属于错误分类和迁移兼容层，不代表当前后端依赖 Firebase。

## 当前开发规则

### UI 设计原则

页面布局、操作层级和移动端适配以 `docs/UI-DESIGN-SYSTEM.md` 为准。当前项目的 UI 原则是：主内容优先，顶部最多两个工作区；依据功能属性合并操作；核心创建动作独立突出；筛选排序归入同一控制层；品牌、年份等次级筛选默认折叠；低频说明按需出现；移动端保持一屏一卡和连续的筛选状态。

这套原则是信息架构和空间分配规则，优先于局部按钮样式调整。任何新增功能都必须先说明它属于哪个操作层级、是否需要独立占行，以及它会占用多少首屏空间。

- 修改数据模型先同步 `src/types.ts`、`supabase/migrations/`、`src/lib/supabaseData.ts` 和公开 RPC 映射。
- 新增公开读取必须走服务端 RPC/API，不能在访客页面直接查询 Supabase 表。
- 服务端永远不把 service-role key 或 Kimi key 放进 `VITE_*` 环境变量。
- 上传图片先压缩，再经 `/api/blob-upload`；数据库保存 URL，不把新的 base64 塞回业务表。
- 改动后至少运行 `npm run lint` 与 `npm run build`。
- `npm run dev` 默认要求本地 Supabase；没有 `VITE_SUPABASE_ENV=development` 和本地 URL 时会 fail closed。托管开发 Supabase 只能显式设置 `VITE_ALLOW_HOSTED_SUPABASE_DEV=true`。`npm run emu` 等 Firebase 模拟器脚本是历史兼容工具，不是当前业务后端。

## 二阶段历史候选（已被正式执行计划取代）

- Aesthetic Profile：基于至少 10 套 Best Match 生成真实 AI 分析与探索建议。
- 单件辐射图：从 `allItemIds` 反向查询“这件衣物出现在哪些搭配里”。
- 继续完善移动端、登录转化、反馈闭环和真实使用数据观测。
- 清理 Firebase 兼容层、旧环境变量、历史迁移/备份字段和过时文档。

本节保留历史讨论背景，不再作为当前范围或开发依据；当前范围以 `docs/AESTHETIC-FOUNDATION-EXECUTION-PLAN.md` 为准。

## 2026-07-17 部署收口

- Supabase Production：`wearlog`，ref `cfnkhilwpkfqebrticqe`，4 个 migrations 已执行。
- Supabase Preview / Development：`wearlog-dev`，ref `mazsopbfpqchzhyuaron`，4 个 migrations 已执行。
- Vercel Production 与 Preview 已使用不同 Supabase 项目；Production 已部署并绑定 `www.wearlog.cn`。
- Vercel 环境变量矩阵与后续维护约定见 `docs/DEPLOYMENT-ENV.md`。

## 2026-07-18 Onboarding 与邮箱认证复核

- 新用户 onboarding 主要路径已实现：来源意图承接、邮箱确认状态与重发、`/auth/confirm` 回调、密码重置回调、首件 Quick Add，以及移动端 Google 登录降级提示。
- Quick Add 的视觉识别仍由 `VITE_ONBOARDING_VISION_ENABLED` 控制，当前默认关闭；首发可靠路径是照片可选的“名称 + 品类”手动确认。
- 生产与开发 Supabase 的 Auth settings 均确认 `mailer_autoconfirm=false`，邮箱确认确实开启；模拟密码登录请求分别返回 `400 Invalid login credentials`，找回密码请求分别返回 `200`，说明两套 Auth API 可达且响应行为正常。
- 已修复邮箱确认成功后未消费 onboarding 意图的问题，避免旧的 `next` 路径影响后续登录。
- 尚未完成真实邮箱端到端验收：当前检查无法证明 SMTP 实际送达、邮件链接点击后的回跳白名单以及不同域名下的完整浏览器流程。发布邮箱 onboarding 前仍需使用受控测试邮箱完成注册、收信、点击、重复点击、过期链接和回跳验证。

## 二阶段现行执行计划（已确认）

二阶段的唯一执行计划为：

`docs/AESTHETIC-FOUNDATION-EXECUTION-PLAN.md`

该计划明确了图片识别、RGB 颜色字段、Victor 人工确认、可视化审计台、审美证据、统计关系、阶段闸门和后续快速模式/实验模式的实现顺序。后续开发前必须同时读取本文件和该执行计划。

## 2026-07-19 Sprint 1 实施状态

已新增图片视觉分析 migration、服务端视觉分析接口、候选与修订记录数据访问层，以及 `/aesthetic-lab` 内部审计台。审计台要求先明确同意图片识别，AI 结果进入 `proposed` 后必须由 Victor 逐字段确认，RGB 以数值形式保存。

`npm run lint` 与 `npm run build` 均已通过。`supabase/migrations/202607190001_aesthetic_vision.sql` 已应用到 Development `wearlog-dev`（`mazsopbfpqchzhyuaron`）；Production `wearlog`（`cfnkhilwpkfqebrticqe`）未 link、未 push，网站本体保持隔离。

本地 `supabase/config.toml` 已固定为 Development project ref；后续迁移和真实图片识别只能在该开发项目中进行。

审计台已部署到隔离的 Vercel Preview，固定入口为：
`https://wearlog-victorzhang016-code-victorzhang016-codes-projects.vercel.app/aesthetic-lab`
该 Preview 使用 Development Supabase。Production 未重新部署。

本地 `.env.local` 已从 Preview Development 配置生成，包含 `VITE_SUPABASE_URL`、publishable key 和 `VITE_ALLOW_HOSTED_SUPABASE_DEV=true`；文件已加入 `.gitignore`，不得提交。

2026-07-19 追加修复：前端环境校验已区分 Vite production build 与 Vercel Production deployment；Preview 允许 `VITE_SUPABASE_ENV=development`，只有 `VITE_VERCEL_ENV=production` 才要求 Production Supabase。修复后在 Chrome 实际 Preview 标签页验证，登录页不再显示“Supabase 未配置”。

## 2026-07-19 本地数据分析模式（当前优先入口）

Victor 已明确：数据分析和图片字段识别先在本机闭环，不以 Google OAuth、Supabase Provider 或线上 Preview 为前置条件。当前本地入口为：

`npm run dev:local` 后打开 `http://localhost:3000/aesthetic-lab/local`

本地模式的边界与能力：

- 优先从衣 log Production 只读同步衣物、Best Match、变体和已有视觉分析，也支持 JSON 快照导入；数据只写浏览器 `localStorage`，可随时导出分析 JSON；
- 在本地计算品类、品牌、季节、年份、标签分布，共现/变体关系，并生成带事实、推断、待验证标记的结论；
- 选择单品后执行“读图”，字段先进入待确认状态。Victor 可逐项修改廓形、材质、纹样、风格、视觉重量、正式度和 RGB 主色，确认后才参与统计；
- `npm run dev` 启动的 Vite 开发服务器提供 `/api/local/aesthetic/vision` 本地中间件。Kimi key 只从 `.env.local` 读取并留在 Node 进程，不进入浏览器、不部署成公开 API；
- 未配置或无效 Kimi 时，导入、统计、关系和人工录入仍可用；读图自动降级为本地 RGB 像素提取，廓形/材质/风格保持待确认，不伪造模型结论。

当前 `.env.local` 与 Vercel Production 使用同一枚 Kimi key；按线上已验证的 `max_tokens + system message` 请求格式，本地服务也使用同一协议。

本地模式默认不读取线上数据库；如需使用 Victor 账号的真实数据，可点击“从我的账号同步”从衣 log Production 只读拉取，或导入 JSON 快照。Production 只作为数据源，实验结果和人工确认只写 localhost；不会向 Production 写入任何数据。原有线上网站和 Production Supabase 未改动。

2026-07-19 追加：本地入口已支持“从我的账号同步”。它只在本地开发模式执行，使用独立的 Production 只读 Supabase 客户端和 RLS 读取 `wardrobe_items`、`best_matches` 与已有视觉分析，再保存到本地 `localStorage`；页面显示 Production 数据源状态，没有会话时提供数据源登录表单；实验客户端仍固定为 Development，环境不符或读取失败时明确提示，不会写入 Production。

二阶段实施复盘与防重犯清单：`docs/AESTHETIC-LAB-LESSONS-LEARNED.md`。该文档记录了 Provider 误判、origin 会话隔离、环境混淆、手动快照依赖和缺少登录入口等问题，并规定环境/身份/数据/Provider 闸门必须先于功能开发。

最高优先级原则：Development readiness 先于一切二阶段功能。Production 与 Development 必须先完成环境盘点和能力补齐，再决定采用哪种本地/线上实验方案；任何 Production 只读桥只能是临时止血，不能替代 Development 准备工作。

当前执行焦点：先完成图片字段的人工确认闭环（RGB 色盘、RGB 数值双向修改、标签直接编辑/删除、人工概括请求候选、Victor 选择采用），暂缓关系与结论模块的扩展。当前关系统计仍是临时观测，不代表最终审美基座。

## 2026-07-19 审美理解引擎（本地实验层）

当前的视觉记录由分析引擎只读保护：27 条 `confirmed` 与全部 `proposed` 不会被分析或自动批量读图改写；Victor 可以在审计台继续编辑 `proposed`，确认后升级为 `confirmed`。批量读图只处理从未有过分析记录的单品，并且取消自动执行。

本地审美分析使用独立的 `AestheticAnalysisBundle`（浏览器本地存储），只读快照、另存派生关系与洞察；它不连接 Production 写入链路。正式规则见 `docs/AESTHETIC-ANALYSIS-RULES.md`，并优先于此前临时的词频与粗共现展示。页面 `/aesthetic-lab/local` 的审美理解总览包含：操作系统原则、搭配语法画布、单品角色网络、维度剖面、待开发清单和证据检查器。

2026-07-19 授权修复：Google OAuth 客户端 `915859619424-513s95ujf3rlh2ec4d60ooracvgt29va.apps.googleusercontent.com` 已加入上述固定 Preview 入口的 Authorized JavaScript origins。随机 Vercel Preview 域名不再作为登录入口；Production 域名和 Production Supabase 均未修改。当前 Chrome 实测已通过 Google 账号选择页，未再出现 `origin_mismatch`。

## 2026-07-21 Archive 移动端操作组收口

- Archive 的“批量导入”“添加衣物”“整柜公开”在桌面端和移动端统一为横向一级操作组，按钮之间保留 `0.5rem` 小间距，避免相邻边框粘连成一整条。
- “清理重复”已并入“批量导入”菜单，成为低频二级批量管理动作；桌面端不再额外占用一个一级按钮位，移动端也不再垂直堆叠批量操作。
- 移动端标题区的“作者衣柜”按钮改为与 Archive 标题内容底部对齐，使按钮下底边与“记录独属于你和衣服的故事”副标题所在区域平齐；桌面端位置保持不变。
- 本轮继续遵守：核心创建动作使用黑底白字，公开动作使用白底印章红，onboarding 的作者衣柜按钮保留原有圆角，不与登录后 Archive CTA 混用皮肤。
- 本轮代码改动完成后必须检查 `375px`、`390px` 和桌面宽度的操作行、菜单展开层级、标题区对齐、按钮间距与主内容首屏占比，再运行 `npm run lint` 和 `npm run build`。
