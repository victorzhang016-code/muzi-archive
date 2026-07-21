# 衣LOG（wearlog）工程规则

> 更新时间：2026-07-18  
> 一阶段已完成。完整状态见 `docs/PROJECT-STATUS.md`。

## 项目身份

衣LOG（wearlog）是本项目现用名；「模子の衣柜」、`muzi-archive`、目录名 `模子の衣柜` 都是历史命名，指同一个项目。

- GitHub：`https://github.com/victorzhang016-code/muzi-archive`
- 生产主域名：`https://www.wearlog.cn`
- Vercel 备用域名：`https://wear-log.vercel.app`
- 部署：push `main` 后由 Vercel 自动部署，不用 Vercel CLI 作为日常发布入口

## 飞书交付规则

- 用户要求“发飞书云文档”时，必须使用 lark-cli docs +create/+update --api-version v2 创建或更新原生飞书文档（Docx/Wiki），交付链接应为 /docx/ 或 /wiki/。
- lark-cli markdown +create 生成的是云盘 Markdown 文件，不算原生飞书云文档；除非用户明确要求 Markdown 文件，否则不得作为最终交付。
- 用户要求发私聊时，使用 lark-cli im +messages-send 将原生文档链接发送给用户；发送前检查文档 URL 类型。

## 当前技术栈

| 层 | 当前实现 |
|---|---|
| 前端 | React 19 + TypeScript + Vite |
| 样式 / 动效 | Tailwind CSS v4 + motion |
| 认证 | Supabase Auth：Google、邮箱密码、重置密码 |
| 数据 | Supabase Postgres + RLS + RPC |
| 图片 | Vercel Blob `wearlog-images` |
| 后端 | Vercel Serverless Functions（`api/`） |
| AI | Kimi relay：`/api/ai-import` |

Firebase/Firestore 已退出现行业务数据平面。仓库仍保留 Firebase 包、`src/firebase.ts`、模拟器脚本、`Timestamp` 适配和历史字段，是迁移兼容遗留；新功能默认不得使用它们做业务读写。

## 已上线能力

### Archive

- 单品新增、编辑、删除、筛选、排序、品牌统计、裤长和品类子类型。
- 名称、品牌、品类、季节、评分、故事、购买年份、图片等字段。
- JSON / CSV 导入；TXT / PDF 在浏览器提取文字后经 Kimi 解析。
- HEIC/HEIF 转 JPEG、裁剪压缩、Blob 上传。
- 单柜前端上限 200 件。

### Best Match

- 路由：`/best-match`、`/best-match/new`、`/best-match/:id`。
- 累计 3 件单品后解锁；保存必须至少有 1 件上装和 1 件下装，鞋、配饰可空。
- 主件上限：tops=4、bottoms=2、shoes=2、accessories=5。
- 支持同品类多件、变体、名称、故事（最多 500 字）、6 个 scene tags、整套照片、编辑和删除。
- `allItemIds` 包含主件与变体，保留后续单件辐射图的数据基础。
- 10 套后显示 Aesthetic Profile 解锁卡；真实 AI 分析尚未接入。

### 分享

- 单品、Best Match、整柜分享；PNG 分享卡 + 二维码短链。
- 公开路由：`/share/:publicId`、`/share/:publicId/item/:itemId`、`/share/:publicId/best-match/:matchId`。
- 单条公开由 `shared` 控制，整柜公开由 `profiles.wardrobe_public` 控制。
- 公开数据统一走 `/api/public*` + Supabase RPC；访客端不能直查 Supabase 私有表。
- `/author`、登录页卡墙、新用户示例卡使用作者公开衣柜。

### Onboarding 与认证

- 邮箱注册需要完成 Supabase 邮箱确认；未确认用户不能进入自己的衣柜，支持重发验证邮件和密码重置。
- `/auth/confirm` 同时兼容 Supabase 的 code 交换和 access/refresh token 回调；验证成功后消费 onboarding intent，回到经过安全校验的站内路径。
- 作者公开页的“创建我的衣柜”会保存来源意图；空衣柜提供照片可选的 Quick Add，名称 + 品类即可保存，视觉识别由 `VITE_ONBOARDING_VISION_ENABLED` 控制且默认关闭。
- 生产项目 `wearlog`（ref `cfnkhilwpkfqebrticqe`）与 Preview/Development 项目 `wearlog-dev`（ref `mazsopbfpqchzhyuaron`）已经隔离；两边均执行 4 个 migrations。
- 邮箱 SMTP 实际送达、点击回跳白名单和重复/过期链接仍需使用受控测试邮箱完成端到端验收，不能仅凭 API 可达宣称邮件链路已完全验收。

## 数据模型与边界

Supabase 迁移文件位于 `supabase/migrations/`，当前核心表为：

- `profiles`：Supabase 用户、稳定 `public_id`、整柜公开开关、历史 Firebase UID 映射。
- `wardrobe_items`：衣物档案和 `shared`。
- `best_matches`：Best Match JSONB 结构、`all_item_ids`、`shared`。
- `aesthetic_profiles`：未来 AI 审美档案。
- `ai_import_usage`：AI 时间窗口限流。

修改字段时至少同步 `src/types.ts`、`src/lib/supabaseData.ts`、对应 migration 和公开 RPC JSON 映射。不要只改前端类型。

## 图片规则

- 新图片：前端压缩 → `/api/blob-upload` → Vercel Blob → 数据库保存 URL。
- 不要把新的 base64 写入业务表；旧 `data:` URL 只为历史兼容保留。
- `BLOB_READ_WRITE_TOKEN` 只在服务端使用；浏览器只能使用 Supabase publishable key。
- 公开图片统一经 `/api/img`，缓存为 1 小时且不使用 SWR；公开 JSON 为 5 分钟 + SWR。分享取消存在缓存延迟，不要在 UI 或文档中承诺秒级撤销。

## API 与安全规则

- `/api/ai-import`：必须带 Supabase access token；文本默认每小时 40 次，视觉分析每小时 10 次；文本 body 约 600,000 字符、视觉 body 约 4,000,000 字符上限。
- `/api/blob-upload`：必须带 Supabase access token，图片原始 payload 上限 6MB，服务端限定 Blob 路径到当前用户。
- 公开 API 使用 `get_public_wardrobe`、`get_public_item`、`get_public_match` RPC 执行公开闸门。
- `KIMI_API_KEY`、Supabase service-role key、Blob 写令牌都不得进入 `VITE_*` 或提交到仓库。

## 开发与验收

```bash
npm install
npm run dev
npm run lint
npm run build
```

改动数据、认证、分享、图片或 API 后，至少执行 `npm run lint` 与 `npm run build`。公开链路变更还要检查整柜、单品深链、Best Match 深链和取消分享状态。

Firebase `npm run emu`、`dev:emu` 是历史兼容脚本；不要把它们写成当前默认后端。开发端必须配置本地 Supabase 与 `VITE_SUPABASE_ENV=development`，否则客户端会 fail closed；Vercel Preview / Production 的完整变量矩阵见 `docs/DEPLOYMENT-ENV.md`。

## 旧文档的处理方式

- `docs/PROJECT-STATUS.md`：当前事实源，优先阅读。
- `踩坑经验.md`、`容量评估.md`：历史运维经验，涉及 Firebase 的部分需结合 Supabase 迁移现状阅读。
- `docs/plans/2026-07-10-firebase-supabase-migration.md`：迁移设计记录，不再是待执行计划。
- 根目录 `PRD-best-match.md`：产品设计与历史验收记录，末尾“实现状态校正”覆盖旧的 Firebase/开发中表述。

## UI 设计系统

所有页面布局、按钮层级、移动端适配和交互密度，必须遵守 `docs/UI-DESIGN-SYSTEM.md`。核心要求是：内容优先、顶部最多两个工作区、按功能属性分组、主操作独立突出、低频说明按需出现；不要因为功能存在就让它单独占一行。

## 二阶段唯一执行计划

审美关系基座及其后续产品能力的唯一执行依据为：

`docs/AESTHETIC-FOUNDATION-EXECUTION-PLAN.md`

该计划已经确认。后续涉及图片识别、RGB 风格字段、审美证据、关系计算、统计洞察、审计台、快速模式、实验模式或好友搭配的任务，必须先读取：

1. `docs/PROJECT-STATUS.md`
2. `docs/AESTHETIC-FOUNDATION-EXECUTION-PLAN.md`

执行时必须遵守计划中的阶段闸门。未经过 Victor 确认的图片识别或 AI 提取结果，不得写入正式个人审美画像或作为确认关系参与推荐排序。
