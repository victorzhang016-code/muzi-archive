# 衣LOG 审美能力产品化｜Task brief

## Authority and scope
- Controller / user instruction: Victor 于 2026-08-04 要求按照已通过的快速模式 PRD 开发，并把既有规则引擎、搭配规律、搭配详情、替换关系、Kimi 解析与人工修正做成面向用户的功能。
- Deliverable: React/Vite 产品状态流；单品详情入口、快速搭配页、个人审美页、视觉字段解析/修正状态。源码可编辑。
- Interaction policy: controlled unattended implementation。沿用现有衣LOG设计方向；代码完成到可构建状态，但本轮不部署、不修改线上数据。Development 继续保留完整审计入口。

## Reader and truth
- Reader action: 从一件衣服找到已确认搭配；理解自己的常穿规律；查看搭配和替换为什么成立；确认或修改 AI 读图字段。
- Required facts: 正式洞察只能来自现有 `DecisionMechanism` 与可追溯证据；变体仅在来源 Best Match 上下文成立；未确认 AI 结果标为待确认。
- Refusals: 不把词频、颜色接近、高频基础款或 Kimi 自由文案当作正式规律；不新增一套分析算法；不改 Production。
- Allowed materials: 真实单品图、Best Match、确认视觉字段、已确认文字、现有纸张/吊牌品牌材料。
- Unknowns: 新用户数据稀疏时原则和替换关系可能为空；界面必须明确显示空状态。

## Asset decision
- Content-essential: 用户自己的单品图与搭配构成；移除后无法完成搭配选择。
- Identity: 现有衣LOG吊牌、纸张、墨色、印章色。
- Supporting atmosphere: 仅使用项目已有纹理与阴影，不新增生成图。
- Source route: workspace existing assets only；本次不进行图片生成或外部素材搜索。

## Form questions
- Roles: 单品页负责触发；快速页负责选择和反馈；审美页负责原则→案例→替换下钻；视觉字段面板负责 AI 候选→人工修改→确认。
- Viewing: 以手机单手使用和桌面浏览为主；首屏必须有主任务，详细证据按需展开。
- Capacity: 快速页最多三套；原则首屏最多五条；案例/替换用紧凑列表内联展开。
- Visual mother relation: “档案吊牌被重新拿到手上使用”——纸张承载已确认事实，印章色只标记当前决策、需要确认和来源入口。
- Title-removal test: 页面仍由真实服装、搭配槽位、颜色卡、规则证据和修正操作组成，无法替换成通用 AI 仪表盘。
- Form counterfactual: 单页静态界面不能完成选择、解释与确认；采用多状态产品流。

## Autonomous fallback
- Least-assumptive choice: 复用当前字体、纸张、边框、颜色 token；不引入新品牌表面；对现有工作台做信息转译而非视觉搬运。
- Remaining risk: 真实用户页的规则数据仍依赖已确认视觉字段覆盖；覆盖不足时按空状态降级。
