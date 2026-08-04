# 衣LOG 审美能力产品化｜Design control

## Gate 1 — Proposition
- Decision: released for controlled Development implementation.
- User approval: Victor 明确要求“上开发”，并要求遵循此前方向和特色。
- Approval evidence: 2026-08-04 当前对话原文。
- Deliverable form: 多状态产品界面；不做单张视觉稿。
- Surface lock: `/item/:id`、`/outfit/quick/:itemId`、`/aesthetic`，以及详情内的 AI 字段修正面板。
- Source route: 工作区真实产品数据与现有设计 token。
- Source policy: 不新增生成或外部图片；不伪造用户数据。
- Hero source: 用户当前选择的真实单品或 Best Match。
- Generation exception: 无。

### Evidence selection

| Selected evidence | Source | Confidence | Task role | Reason |
|---|---|---:|---|---|
| 纸张/吊牌作为档案载体 | 当前衣LOG UI 与 UI-DESIGN-SYSTEM | high | 页面环境与对象感 | 与衣物记录的真实物质载体一致 |
| 墨色为当前主操作、印章色为决定事件 | 当前设计 token | high | 操作层级 | 已在现有产品验证，且语义明确 |
| 内容优先、顶部最多两个工作区 | UI-DESIGN-SYSTEM | high | 信息密度 | 直接修正审美工作台过去的纵向堆叠问题 |
| 来源证据按需展开 | 规则合同与用户反馈 | high | 信任 | 结论可读，证据仍能两次点击内回溯 |

### Palette and type cause
- Field: `kraft/linen/tag` 来自衣物档案的纸张环境。
- Primary action: `ink`，表示当前任务。
- Decision/review event: `stamp`，只用于选择、待确认、拒绝和来源焦点。
- Type: 标题保留现有故事/档案字体；操作与正文使用清晰中文无衬线/宋体回退。
- Rejected palette: 通用蓝紫 AI 渐变；它不能表达用户自己的衣物档案。
- Rejected type voice: 大量小号 mono 元数据；会降低普通用户的阅读效率。

### Form challenge
1. Authority: 用户明确要求开发面向用户功能。
2. Reader action: 需要完成选择、展开、修正与确认，必须是状态流。
3. Single-canvas test: 不成立；单张页面无法覆盖选择后的反馈和 AI 修正状态。

## Gate 2 — Product master
- Decision: implement directly against existing product tokens, then review real routes at desktop、390px、375px。
- Required state map: loading / result / empty / error / decision / post-decision。
- User approval: implementation review pending after working build.

## Gate 3 — Delivery
- Decision: native React/CSS source in the application repository；代码验收通过，等待 Victor 登录后的真实数据视觉复核。
- Editable source: React components, TypeScript engine adapters, existing Tailwind tokens.
- Release condition: lint、aesthetic tests、build、route screenshots and interaction regression pass.
- Verification: `npm run lint`、19 项 `npm run test:aesthetic`、`npm run build` 已通过；`/aesthetic`、`/outfit/quick/:itemId` 与本地 Kimi 路由均可访问。
- Residual check: 当前受控浏览器没有登录态，只验证到登录边界；真实原则卡、搭配列表、替换展开与 375/390px 视觉需要 Victor 登录后完成最终复核。本轮未部署。
