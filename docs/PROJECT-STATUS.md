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

- 修改数据模型先同步 `src/types.ts`、`supabase/migrations/`、`src/lib/supabaseData.ts` 和公开 RPC 映射。
- 新增公开读取必须走服务端 RPC/API，不能在访客页面直接查询 Supabase 表。
- 服务端永远不把 service-role key 或 Kimi key 放进 `VITE_*` 环境变量。
- 上传图片先压缩，再经 `/api/blob-upload`；数据库保存 URL，不把新的 base64 塞回业务表。
- 改动后至少运行 `npm run lint` 与 `npm run build`。
- `npm run dev` 默认要求本地 Supabase；没有 `VITE_SUPABASE_ENV=development` 和本地 URL 时会 fail closed。托管开发 Supabase 只能显式设置 `VITE_ALLOW_HOSTED_SUPABASE_DEV=true`。`npm run emu` 等 Firebase 模拟器脚本是历史兼容工具，不是当前业务后端。

## 二阶段候选（尚未锁定）

- Aesthetic Profile：基于至少 10 套 Best Match 生成真实 AI 分析与探索建议。
- 单件辐射图：从 `allItemIds` 反向查询“这件衣物出现在哪些搭配里”。
- 继续完善移动端、登录转化、反馈闭环和真实使用数据观测。
- 清理 Firebase 兼容层、旧环境变量、历史迁移/备份字段和过时文档。

以上是候选方向，不代表已承诺的二阶段范围。

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
