# 衣LOG 新用户 Onboarding 优化 PRD

**版本**：v0.2
**日期**：2026-07-17
**状态**：已完成需求评审 / 待实现
**负责人**：产品、前端、认证与数据协作

**本次增量**：保留 v0.1 的需求判断、用户路径和验收框架，仅补充移动端相册/拍照选择，以及现有 vision 接口的轻量“名称 + 品类”识别实验方案；不重新跑需求判断和反向评审。

## 需求判断卡

| 项目 | 判断 |
| --- | --- |
| 观察到的事件 | 新用户可以在登录页登录、注册或浏览作者衣柜；但从作者公开页进入“创建我自己的衣柜”后，当前会回到登录页且容易丢失来源。新用户进入空衣柜后，第一件单品仍需完成较重的完整表单。当前邮箱注册没有在前端阻断未验证账号；Best Match 访问门槛是至少 3 件单品，创建搭配仍要求至少 1 件上装和 1 件下装。 |
| 用户要完成的工作 | 用户想先快速拥有一个属于自己的衣柜，记录第一件真实穿过或喜欢的衣服，并尽快看到“这件记录能带来什么”。 |
| 被破坏的承诺 | 登录页承诺“开始记录”，产品却先要求完成资料录入；公开浏览带来的兴趣没有被带入注册后路径；Best Match 的解锁目标也没有在首件录入时形成连续引导。 |
| 机制与责任归属假设 | 认证状态由 Supabase Auth 与 src/components/Auth.tsx 负责；来源承接由公开页、路由和登录页负责；首件摩擦由 WardrobeList、AddEditItemModal 和新增 Quick Add 流程负责；图片识别只做建议，不承担数据正确性的最终责任。 |
| 已解决状态 | 用户完成认证后能回到原始意图，使用“拍下第一件衣服”或“名称 + 品类”完成首件记录；保存后立即看到单品卡和下一步提示，达到 3 件后自然进入第一套 Best Match，达到 10 套后看到 AI 审美档案解锁进度。 |
| 需求路线 | C：功能交付型 PRD；包含 AI 辅助录入子模块。当前有代码事实与竞品资料，但没有现有漏斗基线，首轮上线必须先补齐埋点。 |

## 1. 决策摘要

本次将新用户路径收敛为一条“先拥有、再完善、最后发现智能价值”的连续体验：

~~~text
登录页
  ├─ Google 登录 / 邮箱登录
  ├─ 邮箱注册 → 验证邮箱 → 返回原始意图
  └─ 查看作者衣柜 → 保持公开浏览 → 创建自己的衣柜 → 登录/注册 → 首件录入
                                      ↓
                         快速记录第一件衣物
                                      ↓
                   继续添加至 3 件 → 建立第一套 Best Match
                                      ↓
                   累积至 10 套 → 解锁审美档案能力
~~~

### 本期必须做

1. 开启并明确执行邮箱验证：未验证邮箱不能进入已登录衣柜；支持重发验证邮件、验证失败恢复和验证后回到原路径。
2. 公开作者衣柜继续可匿名浏览；“创建我自己的衣柜”只负责承接创建意图，不改变作者页的公开能力。
3. 增加首件 Quick Add：照片为最快入口，名称和品类为最低必填；完整故事、品牌、季节等后置。
4. 支持“拍照 → AI 预填 → 用户确认 → 保存”的短路径，同时提供不依赖 AI 的手动兜底。
5. 将 1 件、3 件、10 套三个里程碑连续呈现，首件保存后明确引导“继续添加”或“先看看我的衣柜”。

### 本期不做

不做整柜自动识别、商品目录/Web Clip、复杂抠图与人工裁剪重构、不改 Best Match 的 3 件访问门槛和 10 套 AI 解锁规则、不改业务数据结构与业务权限模型、不强迫用户上传照片。允许为本期埋点新增独立的 onboarding_events 事件表及其 RLS。

## 2. 用户、场景与证据

### 2.1 目标用户

| 用户 | 触发 | 当前阻力 | 需要的承接 |
| --- | --- | --- | --- |
| 作者衣柜访客 | 被真实衣柜或搭配吸引 | 点击创建后回登录，回不到刚才的上下文 | 保留公开浏览；注册后回到“创建自己的衣柜”并直接进入首件录入 |
| 新注册用户 | 想试用产品 | 认证、填表、上传图片连续叠加 | 先完成一个最小可用记录，再逐步丰富 |
| 邮箱用户 | 已有邮箱但不使用 Google | 验证状态不清楚，可能直接进入产品 | 明确“验证邮箱”状态与重发入口 |
| 已登录但空衣柜用户 | 已拥有账号 | 首个完整表单要求故事，价值反馈延迟 | 首件卡片和三步进度引导 |

### 2.2 当前链路与断点

当前代码确认存在 Google 和邮箱登录/注册；邮箱注册调用 Supabase signUp，但 Auth.tsx 没有把 email_confirmed_at 作为进入衣柜的门槛，也没有重发注册验证邮件能力。公开作者页的创建 CTA 当前导航到 /，未携带来源意图。空衣柜入口直接打开完整的 AddEditItemModal，其中 name、category、story 为必填；图片虽可选，但没有“拍下第一件”的优先引导。

Best Match 当前已有两层价值门槛：衣柜至少 3 件单品才能进入，至少 10 套搭配才解锁 AI 审美档案。该规则保留，本 PRD 只优化到达路径。

### 2.3 证据分级

| 事实 | 类型 | 处理 |
| --- | --- | --- |
| 邮箱登录和注册仍存在 | 已确认代码事实 | 作为主链路之一设计，不隐藏 |
| 邮箱验证当前未被可靠阻断 | 已确认代码事实 | 作为 P0 认证修复 |
| 作者 CTA 丢失来源上下文 | 已确认代码事实 | 以 URL/session intent 修复 |
| 首件故事必填会增加录入阻力 | 产品判断 + 代码事实 | Quick Add 允许空故事，完整资料后置 |
| 图片能降低输入成本 | 竞品证据 + 产品判断 | 让图片成为快路径，AI 仅预填 |
| 当前真实漏斗和识别准确率 | 未知 | 上线前补埋点与小样本验证，不预设伪基线 |

### 2.4 用户当前可用的替代方式

用户可以直接手填完整表单，也可以使用已有的 JSON、CSV、TXT、PDF 批量导入；后者适合已有清单，无法解决“我只想先记录一件”的首次摩擦。当前产品缺少一个对新用户解释成本低、保存反馈快的中间路径。

## 3. 竞品与替代方案

公开竞品普遍把“建立衣柜”拆成多种入口：照片、相册、目录或在线导入，并允许先记录核心信息、之后再补全。Stylebook 说明其支持相机、照片库、复制粘贴、目录和批量导入，也允许不上传照片开始建立衣柜：[Stylebook Features](https://stylebookapp.com/features.html)、[Starting Your Closet](https://www.stylebookapp.com/stories/starting_your_closet.html)。Whering 支持拍照、数据库、在线商店导入，并把记录之后的搭配作为下一步：[Whering How It Works](https://whering.co.uk/how-it-works)。Cladwell 则强调可以快速添加衣物，照片可稍后补充：[Cladwell App](https://cladwell.com/app)。

| 方案 | 有效机制 | 不直接照搬的部分 | 对衣LOG的启示 |
| --- | --- | --- | --- |
| Stylebook | 多入口、批量处理、照片可后补 | 目录与复杂编辑不适合当前首件路径 | 首件允许无图；照片/手动/批量并列但有主次 |
| Whering | 先导入，再立即进入搭配 | 在线商品导入会扩大产品边界 | 把“记录”与“搭配”连接起来，减少空白状态 |
| Cladwell | 低门槛建立基础衣柜 | 模板化识别不一定符合衣LOG的真实档案气质 | 最小信息先保存，完整故事晚一点填写 |
| 当前手动表单 | 数据完整、实现简单 | 首次输入项多，反馈晚 | 保留为高级/编辑入口，首件另设轻量模式 |
| 本 PRD 推荐 | 照片快路径 + 名称/品类兜底 + 里程碑引导 | 依赖认证配置和可选 AI 服务 | 用真实衣物和第一张卡片尽快证明价值 |

## 4. 目标、范围与约束

### 4.1 产品目标

- 提升“认证成功 → 第一件单品保存”的完成率。
- 缩短用户从进入衣柜到看到第一张有效单品卡的时间。
- 降低首次录入对文字输入和完整故事的依赖。
- 让作者衣柜的浏览兴趣能自然转化为自己的衣柜创建。
- 让用户理解 3 件解锁第一套 Best Match、10 套解锁审美档案的关系。
- 为后续优化建立可按来源、认证方式和录入方式切分的漏斗数据。

首轮不虚构目标数值。先完成埋点和首批观察，基线稳定后再设定相对提升目标。

### 4.2 范围

**包含**：邮箱验证与恢复、来源意图承接、首件 Quick Add、照片上传与可选 AI 预填、空衣柜引导、首件成功反馈、3 件/10 套进度提示、首次 Best Match 引导、必要埋点、异常和无障碍状态。

**不包含**：业务数据库迁移（onboarding_events 事件表除外）、账号合并、公开权限改造、作者衣柜内容改造、批量导入重做、商品搜索目录、自动生成完整故事、强制照片上传、Best Match 数据模型和解锁阈值调整。

### 4.3 约束

- 认证继续使用 Supabase Auth；Google 为现有快捷入口，邮箱登录/注册保留为清晰的第二入口。
- 单品图片继续使用现有上传链路；前端压缩和失败重试必须复用现有能力。
- story 在已有数据类型中可保持字符串，但 Quick Add 保存空字符串，编辑时再补充。
- 保留公开作者衣柜匿名浏览，不将访客强制变成注册用户后才可查看。
- 不把 AI 识别结果当作事实写入；任何 AI 字段都必须在保存前由用户确认。

## 5. 核心方案

### 5.1 Onboarding 状态与来源承接

新增前端可恢复的轻量状态，不增加数据库字段：

~~~ts
type OnboardingSource = 'login' | 'author_wardrobe' | 'author_item' | 'author_best_match' | 'direct';
type OnboardingStage = 'auth' | 'email_verification' | 'first_item' | 'first_match' | 'complete';

type OnboardingIntent = {
  intentId: string;
  source: OnboardingSource;
  stage: OnboardingStage;
  returnPath: string;
  next: string;
  expiresAt: number;
};
~~~

来源意图以 intentId、source、stage、next、expiresAt 组成。next 只允许站内相对路径，并由统一函数校验，拒绝协议、双斜杠和外域；成功消费后立即清除。next 优先放进认证回调可携带的 URL 参数，sessionStorage 只作为同设备辅助，不承担跨设备恢复。意图过期后回退到首件入口或登录页，不自动执行写入。

登录/注册成功后的路由决策按认证状态、衣柜单品数和 intent stage 执行：未验证先进入验证状态；已验证且衣柜为空进入首件 Quick Add；已有单品的用户默认回自己的衣柜，并可看到来源上下文提示，不被强迫重复录入。意图 TTL、多标签页覆盖策略和消费日志需在实现中固定并测试。

### 5.2 邮箱认证与验证状态

1. 在 Supabase Auth 开启 Confirm Email，并配置生产域名、预览域名和验证回调白名单。开启后，注册返回用户但不建立可用 session；关闭时邮箱会被隐式视为已确认。[Supabase signUp](https://supabase.com/docs/reference/javascript/v1/auth-signup)、[Supabase Auth General Configuration](https://supabase.com/docs/guides/auth/general-configuration)
2. 注册成功后保存 pending email 和 intentId，进入“验证邮箱”状态页：显示脱敏邮箱、重发按钮、重发冷却、修改邮箱入口和返回登录入口。账号不存在、邮件发送失败和频率限制使用不暴露账号存在性的统一文案。
3. 登录成功后检查 Supabase user 的 email_confirmed_at。未验证时不渲染已登录衣柜，转入验证状态；若登录接口直接拒绝未验证用户，也必须使用用户刚输入的邮箱进入同一验证状态，不依赖返回 user 对象。
4. 使用 supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo } }) 重发注册邮件；重发必须带同一 intentId 和经过校验的 next。[Supabase resend](https://supabase.com/docs/reference/javascript/auth-resend)
5. 邮件回调增加 /auth/confirm 路由。回调需兼容当前 Supabase 配置的 code 或 token-hash 形式：收到 code 时交换 session，收到 token 时建立 session；随后调用 getSession/getUser 刷新认证状态，再消费 intentId。邮件模板只允许跳转到站内安全路径。
6. 回调状态机必须覆盖成功、过期、已使用、格式错误、用户取消和网络失败。成功后恢复 next；失败则展示验证失败页，保留重发和返回登录，不创建半完成 onboarding。验证邮件模板、Auth Logs 和生产 SMTP 需一并验收。[Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)、[Supabase Email Troubleshooting](https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw)
7. 对历史上已注册但未验证的邮箱，不删除账号；下次登录展示同一验证状态并支持重发、修改邮箱、重新登录。密码重置继续走现有 /reset-password 流程。
8. 必须测试新注册、重发、过期链接、重复点击链接、同设备回调、跨设备回调、回调后刷新页面和验证后恢复作者来源八条路径。

推荐文案：

- 注册成功：验证邮箱后，衣LOG会把你带回刚才想做的事。
- 未验证登录：先验证邮箱，才能安全保存你的衣柜。
- 重发：没收到？重新发送验证邮件

### 5.3 作者衣柜路径

作者衣柜的公开浏览能力保持不变。访客可以继续看作者公开的衣物、搭配和分享卡片；“创建我自己的衣柜”是一个创建意图入口，含义是：

~~~text
访客浏览作者衣柜 → 点击创建自己的衣柜 → 保存 source/returnPath → 登录或注册
→ 邮箱验证（如需要）→ 首件 Quick Add → 进入自己的衣柜
~~~

作者原页面不被编辑，也不因为点击 CTA 关闭。若用户返回或取消登录，仍可回到原作者页面。若用户已经登录，点击 CTA 直接进入首件录入或自己的空衣柜，不再绕过登录页。

### 5.4 首件 Quick Add

空衣柜页面的第一视觉焦点是“先记录一件你最近穿过的衣服”，提供三级入口：

1. **主按钮：从相册选择一张** —— 移动端优先选择已有照片；用户通常可以直接使用刚拍过的穿搭或商品图，少一次权限打断。
2. **次按钮：现在拍一张** —— 只有用户主动点击时才打开系统相机入口；移动端使用文件选择器的拍照能力，不在页面加载时申请摄像头权限。
3. **辅助入口：手动填写名称和品类** —— 不依赖照片和 AI，最低要求为名称、品类。
4. **低强调入口：已有清单？批量导入** —— 继续复用现有 JSON/CSV/TXT/PDF 导入。

移动端不首发自建相机预览页。实现优先使用 input type=file、accept=image/*，拍照入口增加 capture=environment 作为系统提示；不同浏览器可能仍展示相册或系统选择器，因此界面必须接受两种结果。只有未来需要连续拍摄、裁剪或实时预览时，才评估 getUserMedia。浏览器的 capture 是拍摄提示，不是强制保证；getUserMedia 会触发明确的摄像头权限流程。[MDN capture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture)、[MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

Quick Add 字段：

| 字段 | 首件状态 | 规则 |
| --- | --- | --- |
| 照片 | 可选但主推 | 上传中展示进度；失败不阻断手动保存 |
| 名称 | 必填 | 照片识别后预填，用户可修改 |
| 品类 | 必填 | 预填结果必须可一键改选；没有识别结果时默认要求选择 |
| 品牌 | 可选 | 保存后在单品编辑页补充 |
| 故事 | 可选 | Quick Add 不展示长文本输入；默认空字符串 |
| 季节、年份、评分 | 采用默认值或后置 | 不阻断首次保存 |

保存后的首件反馈必须包含：已保存的单品卡、1 / 3 件，距离第一套 Best Match 还差 2 件、继续添加、先看看我的衣柜。若该件已有图片，卡片优先展示图片；没有图片，展示稳定的品牌色占位卡并提示后补照片。

### 5.5 图片与 AI 辅助

图片是降低输入意愿成本的“快路径”，不是门槛。当前仓库已有 /api/ai-import 的 vision 模式、登录校验、请求体限制和 vision 限流；它目前更接近自由文本视觉分析，尚未接入首件单品字段。因此本期沿用这条基础通路，只增加一个轻量的衣物字段实验，不新建模型或数据表。交互责任边界如下：

~~~text
用户拍照/选图 → 前端压缩与上传 → AI 只生成名称/品类/品牌候选
                         ↓
              用户确认或修改 → 保存单品
                         ↓
                 AI 失败 → 手动名称+品类
~~~

AI 必须明确承担：从图片生成候选字段、返回置信度或“需要确认”状态、给出可编辑草稿。AI 不承担：自动保存、生成用户故事、推断用户拥有关系、替用户决定季节或评分。

AI 输入只包含用户主动上传的单品图片和必要的任务上下文；不发送邮箱、作者来源、私密衣柜列表或故事。图片隐私遵循现有存储权限。AI 失败、超时、识别不确定或接口成本/配额不可用时，立即切换手动表单，保留已经选择的图片，不丢失输入。

#### 轻量识别实验方案

首发底座仍是“照片 + 手动确认”，AI 建议以 feature flag 灰度打开。前端在图片上传完成后调用现有接口：

~~~json
{
  "mode": "vision",
  "task": "wardrobe_item_draft",
  "image": "data:image/jpeg;base64,..."
}
~~~

后端收到 wardrobe_item_draft 后使用固定的服务端提示词，不把用户自由输入直接当作系统规则。模型只返回可解析的 JSON 草稿：

~~~json
{
  "name": "白色针织衫",
  "category": "上装",
  "brand": null,
  "needsConfirmation": true
}
~~~

前端只接收 name、category、brand 三个候选字段；先解析 JSON，再校验 category 是否属于现有品类枚举。返回格式错误、类别无法映射、图片不是单件衣物、接口超时或限流时，直接展示手动填写，不把异常结果写入单品。用户确认后才调用现有保存逻辑，AI 不改数据库结构。

这个实验的变量只有“是否展示识别草稿”。至少保留两条可比较路径：照片上传后直接手填；照片上传后展示名称/品类候选。观察首件保存率、从选图到保存的耗时、用户修改字段比例、识别失败率和手动兜底使用率。先建立基线，再决定是否扩大 AI 放量；任何情况下，手动路径都必须可用。

AI 打开前必须固定响应 schema、现有 category 的映射规则、超时、单次成本上限、失败率和用户修改率阈值；未达到阈值时只发布照片和手动路径。AI 上线前用代表性衣物图像验证品类候选正确率、用户修改率、首件保存率、端到端延迟、成本和失败率。

### 5.6 三个里程碑与 Best Match

- **1 件**：服务端返回有效 item id，刷新衣柜仍能看到该记录；展示 1 / 3 的衣柜数量进度。
- **3 件**：以服务端非删除单品计数为准，数量进度和品类条件分开显示。若没有上装或下装，显示“衣柜已记录 3 件；还需要一件上装/下装”；同时满足时才展示“建立第一套 Best Match”。
- **10 套**：以服务端非删除 match 计数为准，展示已记录 X / 10 套；只有现有 AI 审美档案的解锁状态和入口均可刷新打开时，才显示“已解锁”。删除、保存失败、重复保存和草稿不计入里程碑。

首次进入 Builder 时，按“先选一件上装，再选一件下装”的顺序给出轻提示；鞋和配饰明确为可选。保存证明必须是 Best Match 记录已返回有效 id 且详情页刷新后可打开，不能只依赖按钮点击或本地状态。

## 6. 边界条件与异常恢复

| 边界 | 预期行为 |
| --- | --- |
| 未登录直接访问作者页 | 正常公开浏览；创建 CTA 保存来源后进入认证 |
| 认证中断/关闭页面 | URL 仍可恢复来源；过期 intent 回退登录页，不自动写入数据 |
| 邮箱未验证 | 不进入衣柜；可重发、修改邮箱、重新登录；错误文案不暴露账号是否存在 |
| Google 登录 | 视为已完成认证，直接按 intent 进入首件阶段 |
| 图片为空/用户拒绝授权 | 进入手动 Quick Add，名称+品类仍可保存 |
| AI 超时/低置信度 | 显示“请确认或手动填写”，不自动保存，不清除图片 |
| 图片上传失败 | 保留本地预览；允许去掉图片后保存文字记录，或重试上传 |
| 图片状态 | photo_selected → uploading → uploaded / upload_failed / removed；文字记录保存与图片上传解耦，图片失败时允许无图保存 |
| 上传中点击保存 | 保存名称+品类和空图片记录；上传完成后再绑定图片，或明确等待并保留草稿，不丢失输入 |
| 重复点击保存 | 每次 Quick Add 和 Best Match 保存都带 client idempotency key；服务端重试返回同一记录，前端禁用按钮只作辅助 |
| 名称/品类缺失 | 明确标红具体字段；不以通用“保存失败”代替 |
| 网络断开 | 保留已输入字段；恢复网络后允许重试，不重复创建 |
| 账号已有单品 | 不再展示新用户 onboarding；普通新增入口保持原流程 |
| 单品容量达到现有限制 | 显示容量说明并回到普通衣柜，不让 onboarding 无限重试 |
| AI 图片异常 | 非衣物、多件衣物、损坏图片、超大文件、无有效类别或非法 AI 输出均进入手动填写，不写入未经映射的类别 |
| 私密性 | onboarding 不默认改变整柜公开状态；不在埋点中记录图片、故事和邮箱 |

## 7. 执行、验收与验证

### 7.1 分阶段交付

**Phase 0：认证前置检查**

- 确认 Supabase Confirm Email、生产/预览 redirect allowlist、邮件模板和 SMTP。
- 盘点历史未验证账号，明确兼容策略。
- 给出当前邮箱注册、验证、重发、登录的手动验收记录。

**Phase 1：身份与来源承接**

- 增加 OnboardingIntent 管理、intentId、TTL、站内 next 校验和 /auth/confirm 回调。
- 改造作者 CTA、登录/注册成功后的恢复逻辑。
- 增加未验证状态页、重发邮件和错误恢复。
- 明确 code/token-hash 回调协议、session 刷新、intent 消费和历史未验证用户分支。

**Phase 2：首件 Quick Add**

- 增加空衣柜 onboarding 状态卡和 Quick Add UI。
- 把名称+品类设为首件最低必填，故事改为后置。
- 接入照片压缩、上传、可选 AI 草稿和手动兜底。
- 首发默认关闭 AI；固定照片状态机、现有品类映射、响应 schema 和保存幂等 key。
- 复用 /api/ai-import 的 vision 模式，新增 wardrobe_item_draft 任务和前端 JSON 校验；不新建识别服务。
- 保存后立即渲染有效单品卡与 1/3 进度。

**Phase 3：Best Match 连续引导**

- 在 3 件节点检查上装/下装覆盖情况。
- 引导进入已有 Builder，减少首次选择的认知负担。
- 保存首套后展示成功反馈与 1/10 AI 解锁进度。

**Phase 4：测量与回归**

- 接入统一 onboarding 事件接口和最小数据存储/查询。
- 完成桌面、移动、Google、邮箱、作者来源、AI 失败和网络失败测试。

### 7.2 功能验收标准

- 新用户可从作者公开衣柜点击创建，完成认证后回到首件录入，不回到无上下文的空首页。
- 邮箱注册后必须经过验证才能进入衣柜；验证邮件可重发，验证完成后能恢复首件路径。
- 邮箱验证成功、失败、过期、重复点击、同设备和跨设备回调均有可验证的最终状态。
- Quick Add 中仅填写名称和品类即可保存一件没有图片、品牌和故事的单品。
- 用户拍照后，图片上传失败或 AI 失败不会阻断保存；手动兜底保留图片或允许去图保存。
- AI 草稿始终可编辑，未确认的 AI 候选不能直接写入最终字段。
- AI 返回非法 JSON、未知品类、非衣物或多件衣物时，能稳定回到手动填写，不写入错误字段。
- 保存成功后的单品卡来自服务端有效记录；刷新页面不会丢失。
- 用户添加到 3 件后，页面能根据是否已有上装/下装给出不同下一步；Builder 的必需规则仍为至少一件上装和下装。
- 第一套 Best Match 保存后能打开详情；10 套前展示进度，10 套后才进入现有审美档案解锁逻辑。
- 已有单品的老用户不被新手引导打断，现有批量导入和普通新增流程继续可用。
- Quick Add 的空 story、图片可选性、category 映射和服务端校验已通过集成测试。
- 网络超时重试不会产生重复 item、图片绑定或 Best Match。

### 7.3 可用性验证

首轮用真实的作者衣柜来源、Google 登录、邮箱注册和直接注册四种入口做任务测试。观察用户能否在不解释的情况下完成：

1. 看完作者衣柜后创建自己的衣柜。
2. 不上传照片，仅用名称+品类保存第一件。
3. 拍照并修改 AI 预填结果后保存。
4. 添加到 3 件并理解第一套 Best Match 的条件。
5. 保存第一套搭配并理解 10 套解锁关系。

主要观察点是：是否知道下一步、是否误以为照片必填、是否相信 AI 结果、是否因邮箱验证离开、是否能在失败后恢复。小样本数量和上线窗口在评审时确定。

图片识别实验只比较“照片后手填”和“照片后给名称/品类建议”两条路径，不比较不同模型。先在受邀用户或内部环境灰度，确认识别草稿不会降低首件保存率，再扩大范围。

## 8. 风险、依赖与开放决策

### 8.1 风险与缓解

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| Supabase Confirm Email 或 SMTP 未配置好，用户收不到邮件 | 高 | Phase 0 作为上线阻断项；配置自有 SMTP、检查 Auth Logs、提供重发和改邮箱 |
| 历史未验证账号被突然阻断 | 高 | 不删除账号；登录后解释原因并提供重发；灰度观察恢复率 |
| AI 识别错误反而增加修改成本 | 高 | AI 只做草稿；记录修改率；低置信度直接进入手动确认；可 feature flag 关闭 |
| 首件过度简化导致档案质量下降 | 中 | 后置补全提醒；不改变完整编辑能力；用后续补充率观察质量 |
| 来源 intent 过期或跨设备丢失 | 中 | URL 优先、sessionStorage 辅助；回退到首件阶段，不暴露内部状态 |
| 新手引导遮挡老用户工作流 | 中 | 仅对 items.length === 0 和未完成阶段展示；可关闭且不重复打断 |

### 8.2 依赖

- Supabase Auth Confirm Email、redirect allowlist、邮件模板和 SMTP。
- 现有图片上传和 /api/ai-import 能力；需确认图片识别字段和成本上限。
- 现有 WardrobeProvider、AddEditItemModal、BestMatchBuilder 的保存成功回调。
- 新增受 RLS 保护的 onboarding_events 表，作为本期唯一事件源；不改业务数据表结构。

### 8.3 已锁定决策与剩余确认

1. 已锁定：首发为照片 + 手动确认，AI 默认关闭，后续以 feature flag 灰度。
2. 已锁定：事件源为 onboarding_events 表；允许新增该表、迁移和 RLS，不改变业务数据表结构、权限和 API。
3. 需在 Phase 0 确认：Supabase 生产项目的 Confirm Email、SMTP、redirect allowlist 和历史账号策略。
4. 已推荐：首件成功后“继续添加”为主按钮，同时保留“先看看我的衣柜”。

## 9. 埋点与指标

当前代码没有统一 analytics provider，因此本期新增受 RLS 保护的 onboarding_events 表，并通过 provider-agnostic 的 trackOnboardingEvent 接口写入。事件不进入业务表，发布前必须能按用户、session、source 和时间查询，否则只能验证功能，不能判断漏斗是否改善。

### 9.1 事件

| 事件 | 关键属性 | 触发证明 |
| --- | --- | --- |
| auth_success | method, source, onboarding_session_id | Supabase session 已刷新且用户可进入下一状态 |
| registration_success | method, source, onboarding_session_id | signUp 返回用户并进入验证或已认证状态 |
| onboarding_view | source, stage, auth_method | 页面真实渲染 |
| auth_started | method, source | 用户点击登录/注册 |
| email_verification_sent | source, resend_count | Supabase resend 返回成功 |
| email_verified | source, elapsed_ms | 回调确认成功 |
| onboarding_first_item_started | input_mode: photo/manual/import | Quick Add 已打开 |
| onboarding_photo_selected | source, mime_type, size_bucket | 用户确认选图 |
| onboarding_ai_suggestion_shown | latency_ms, confidence_bucket | AI 草稿渲染 |
| onboarding_ai_suggestion_edited | fields_changed | 用户修改候选字段 |
| onboarding_first_item_saved | input_mode, has_photo, elapsed_ms | 服务端返回 item id |
| onboarding_progress_3_reached | has_top, has_bottom | 服务端单品数达到 3 |
| onboarding_best_match_started | source | Builder 真实打开 |
| onboarding_best_match_saved | item_counts, elapsed_ms | 服务端返回 match id |
| onboarding_progress_10_reached | match_count | 服务端搭配数达到 10 |
| onboarding_error | stage, error_code, recovery_action | 可归因错误出现 |

事件表最小字段为 event_id、event_name、occurred_at、onboarding_session_id、intent_id、actor_id、source、stage、event_version、properties、dedup_key。actor_id 仅使用已认证用户 id；认证前仅使用随机 session id，不写邮箱。properties 不包含图片原图、图片 URL、故事正文或 AI 原始响应。RLS 允许客户端只写入自身事件，产品侧通过受控查询读取；dedup_key 防止重复渲染和重试重复计数，保留期限与现有数据策略一致。

### 9.2 指标、分母与决策

| 指标 | 分子 / 分母 | 观察窗口 | 用途 |
| --- | --- | --- | --- |
| 首件完成率 | first_item_saved / 认证成功用户 | 每周 cohort | 核心激活指标 |
| 首件耗时 | 认证成功至服务端保存的 elapsed_ms | p50、p90 | 判断输入摩擦 |
| 邮箱验证完成率 | email_verified / 邮箱注册成功 | 每周 cohort | 判断认证摩擦与邮件可靠性 |
| 作者来源转化率 | 作者来源的首件保存 / 作者来源认证成功 | 每周 cohort | 判断上下文承接价值 |
| 图片路径保存率 | 图片路径首件保存 / 图片路径开始 | 每周 cohort | 判断拍照快路径 |
| AI 修改率 | 有编辑的 AI 草稿 / AI 草稿展示 | 每周 cohort | 判断识别质量 |
| 首套搭配完成率 | best_match_saved / 达到 3 件用户 | 每周 cohort | 判断价值连续性 |
| 10 套解锁率 | 达到 10 套 / 首套保存用户 | 长期 cohort | 判断 Best Match 长期价值 |

首轮先获取基线，再按最大漏斗损失决定迭代顺序：验证完成率低先修认证；首件耗时和完成率差先修 Quick Add；AI 修改率高则保持 AI 关闭或优化模型提示；首套搭配完成率低则优化品类覆盖和 Builder 引导。图片降低成本是待验证假设，不能由竞品功能存在直接推断。

## 10. 追踪矩阵与发布门槛

| 来源事实 | 破坏的产品承诺 | 解决落点 | 验收证明 |
| --- | --- | --- | --- |
| 邮箱注册未强制验证 | “安全保存自己的衣柜”不可信 | Confirm Email + 验证状态页 | 未验证账号无法进入衣柜，验证后可恢复路径 |
| 作者 CTA 只导航 / | “从喜欢到拥有”上下文中断 | OnboardingIntent | 作者来源用户认证后进入首件阶段 |
| 完整表单要求 story | “先记录一件”成本过高 | Quick Add 最小字段 | 名称+品类可保存空故事单品 |
| 图片入口不突出 | 首次输入主要依赖键盘 | 拍照/相册主按钮 | 图像失败仍可手动完成 |
| Best Match 只在 3 件后显现 | 用户不知道为何继续添加 | 1/3、3 件、1/10 里程碑 | 用户能复述下一步和解锁条件 |
| 无统一漏斗数据 | 无法证明优化有效 | onboarding_events + 事件接口 | 事件含分母所需属性、去重键且可查询 |

### 发布阻断项

- Supabase 邮箱验证、回调和 SMTP 未完成真实邮件测试，不发布邮箱 onboarding。
- 未验证账号无明确恢复路径，不发布认证改动。
- 图片或 AI 失败会清空用户已输入内容，不发布 Quick Add。
- 不能通过服务端记录证明首件/首套保存成功，不发布里程碑成功页。
- 没有 onboarding_events 表、RLS、成功事件和分母查询，不对外宣称“降低了首件录入阻力”。

## 11. PRD 自审记录

本 PRD 按 prd-master skill 的 Feature Delivery 路线编写，已覆盖：需求判断卡、当前链路与证据等级、竞品/替代方案、目标与非目标、路线专属方案、边界条件、AI 责任与人工兜底、执行验收、风险依赖、指标分母和发布阻断项。

### 隔离式反向评审记录

初稿完成后，使用全新上下文的独立评审 agent，仅提供以下四类输入：规范化 PRD 初稿、证据附录、假设/开放问题、路线标识；评审 agent 不接收本次对话和隐藏推理。评审结论将回填本节，Blocker/High 必须在发布前关闭。

| 字段 | 值 |
| --- | --- |
| run_id | onboarding-prd-review-20260717-8C2E8B6A |
| protocol | prd-master adversarial-review v1 |
| draft_hash | 8C2E8B6AEA60CE2DEBD95C3738B99BE07BDB4B54B0549ECBA1912E8EB061CCF6 |
| reviewer | 019f6f39-708a-7b70-a6a9-3f4fc108e031 / Newton |
| status | resolved_with_changes |
| isolation_attestation | true；fresh context，未读取工作区与既有对话 |
| findings | 6 Blocker、6 High、2 Medium、1 Low；全部 Blocker/High 已在本文中完成响应 |

评审发现与闭环：补充了 code/token-hash 回调、session 刷新、过期/重复链接、历史未验证登录、intentId/TTL/next 安全校验；将照片+手动确认锁定为首发、AI 默认关闭；为 1 件、3 件、10 套补充服务端权威证明；确定 onboarding_events、成功事件、session/cohort/source 关联、dedup 和 RLS；补充 Quick Add 后端契约、图片状态机、服务端幂等、老用户路由和 AI 异常输入边界。竞品对“图片降低成本”的推论已降级为待验证假设。
