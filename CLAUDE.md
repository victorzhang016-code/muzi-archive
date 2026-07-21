# 衣LOG（wearlog）— Claude 工程上下文

当前状态：一阶段施工完成；2026-07-18 已同步 onboarding、邮箱认证复核和环境隔离事实。先读 `docs/PROJECT-STATUS.md`，再处理具体需求。

现行主架构是 Supabase Auth + Postgres/RLS/RPC、Vercel Serverless、Vercel Blob 和 Kimi relay。Firebase/Firestore 仅为历史兼容遗留，不能作为新增业务的默认数据层。

已上线的核心能力：

- Archive 衣物档案、筛选、评分、故事、导入和图片上传。
- Best Match 画板、Gallery、Detail、编辑删除、变体、scene tags、照片和分享。
- 单品 / Best Match / 整柜公开，以及 PNG + QR 分享卡和访客深链。
- Google、邮箱密码登录、密码重置；匿名登录已移除。
- 邮箱确认、重发验证邮件、`/auth/confirm` 回调、来源意图承接和首件 Quick Add 已实现；真实 SMTP 送达与线上端到端邮件验收仍待受控测试邮箱验证。
- Production `wearlog` 与 Preview/Development `wearlog-dev` 已隔离；具体变量、域名和 ref 见 `docs/DEPLOYMENT-ENV.md`。

二阶段候选：真实 Aesthetic Profile、单件辐射图、真实反馈观测、移动端细节和 Firebase 兼容层清理。候选尚未锁定，不要在文档中写成已承诺范围。当前优先补齐邮箱端到端验收，再根据真实使用反馈排序二阶段。

工程要求：新公开读走 `/api/public*` 与 Supabase RPC；新图片走 `/api/blob-upload`；修改数据模型时同步 migration、映射和公开 JSON；改动后运行 `npm run lint` 与 `npm run build`。

UI 设计与布局必须遵守 `docs/UI-DESIGN-SYSTEM.md`：内容优先、顶部最多两个工作区、按功能属性分组、主操作独立突出、辅助功能降权、说明按需出现；移动端保持一屏一卡和可读的任务路径。增加新按钮前先判断它是否真的需要独立占据一行。
