# 衣LOG 2.0｜从一件定全身·快速模式 PRD

**文档类型**：功能 PRD + AI 产品模块（本期不调用 AI）  
**版本**：v1.6  
**日期**：2026-08-04  
**状态**：待 Victor 评审后进入 Development 开发  
**范围**：仅衣LOG Development / localhost；不改变线上主页、Production、原始视觉字段或现有 Best Match 数据。

> **需求判断卡**
>
> - **观察到的事件**：Victor 已有 43 套高质量 Best Match、明确的核心外衣与变体关系，但日常想穿某件衣服时，仍要翻档案、回忆搭配和判断哪些替换只在特定上下文成立。
> - **用户任务**：从一件正在考虑穿的衣服出发，在一分钟内选到一套已经被自己认可、可以直接穿的完整搭配。
> - **当前断裂的承诺**：衣LOG 已保存“这件衣服如何被搭配”的知识，却没有把它在当下决策时交回给用户。
> - **可观察的解决状态**：用户从单品页进入后，看到最多三套可追溯、包含该单品、上下装完整的搭配；选中后可在之后留下实穿结果。
> - **推荐文档类型**：功能 PRD。真实个人数据和审美引擎已验证方向；P0 将范围压缩为已确认案例的检索与反馈，不承诺生成新搭配。
> - **重要未知**：这项能力是否能稳定缩短选择时间、让已有 Best Match 被真正复用；先在 Victor 的 Development 账户连续使用两周验证。

## 一、决策摘要

**问题**：衣橱数据已经回答了“我曾怎样搭”，却还没有回答“今天这件衣服怎么穿”。

**核心动作**：用户在任一单品详情点击“用这件搭一套”，系统仅返回包含该单品的已确认 Best Match，或该单品在原搭配单一槽位中已经被记录为可替换的版本。

**预期效果**：用户不需要再记忆或翻找搭配；每一次“今天穿这套”和后续实穿反馈，都会为下一阶段的推荐与审美规则提供可解释证据。

**本次要拍板的事**：批准以“已确认搭配优先、一次只呈现少量完整选项、反馈严格局限在当前上下文”的 P0 开发；新组合生成、天气、日历、好友邀请、拼贴实验和 Agent 接入全部后置。

### 产品原则

1. **先复用已确认经验。** P0 不把相似度、字段频率或 AI 猜测包装成“适合”。
2. **锚点不可丢。** 用户从哪件衣服进来，每张卡都必须包含它。
3. **变体只在原上下文成立。** P0 一次只替换来源 Best Match 的一个槽位；不允许在卡片上自由拼多个变体。
4. **解释短、可回溯。** 先告诉用户这套从哪里来；只有审美引擎已有足够证据时，才补充最多两条具体处理。
5. **反馈比“看起来聪明”重要。** 用户的穿过、满意、不满意与原因，必须被安全地记录为未来规则的正反例。

## 二、用户、场景与证据

### 目标用户与触发

首轮只服务 Victor 本人：他在单品详情页看到一件衣服，想知道今天能怎样快速穿出去，而非研究整个衣橱。

当前替代做法是翻 Best Match 列表、凭记忆找同一件衣服，或重新在衣柜里思考。它慢，也会让已记录的变体和搭配说明失去作用。

### 已知证据与约束

- 本地审美快照已形成 101 件人工审阅单品、43 套 Best Match、有效变体关系；核心外衣与搭配说明可追溯。
- 现有审美引擎已能生成 `DecisionMechanism`：规则、条件、动作、效果、案例与证据的统一对象。
- Victor 已明确：基础件高频不等于审美核心；一套搭配的上下文和外衣核心非常重要。
- 当前数据没有可靠的真实穿着日历、天气或地理位置；P0 不能假装知道这些条件。

### 首轮成功假设

如果用户能从一件衣服快速看到自己已确认的完整搭配，他会更快做出选择，并开始留下真实实穿反馈。两周后据此决定是否继续做“实验模式”的新组合建议，或先优化入口与排序。

## 三、竞品与替代方案研究

| 选择 | 已知能力 | 可借鉴 | 本期不照搬的部分 |
|---|---|---|---|
| 手动翻衣LOG Best Match | 信息真实但检索成本高 | 保留原始搭配、故事、变体的完整上下文 | 不能要求用户每次重新理解档案 |
| [Acloset](https://www.acloset.app/) | 公开介绍包含衣橱数字化、按单品组织和日常穿搭建议 | 单品可作为穿搭入口 | 通用建议的来源与个人已确认关系不总是可见 |
| [Stylebook](https://www.stylebookapp.com/stories/work_wardrobe.html) | 已保存搭配、单品关联、穿着日历等工具 | 保存的搭配可以直接回到单品使用 | P0 不引入日历和“随机搭配”来掩盖关系证据不足 |
| [Indyx](https://www.myindyx.com/how-it-works) | 衣橱整理、搭配、分享与服务 | 低摩擦整理和再次使用搭配 | P0 不做社区或人工造型服务；差异仍是 Victor 自己确认过的关系与解释 |

**结论**：市场已证明“从衣橱到今日搭配”是有效任务；衣LOG 的切入点应是把个人确认过的 Best Match 和上下文变体变成可信的当下选择，而非在数据量很小时先做泛化生成。

## 四、目标、范围与约束

### 目标与验收结果

| 目标 | P0 的可观察结果 |
|---|---|
| 快速完成选择 | 从单品页进入，最多三张完整候选卡；用户可点“今天穿这套” |
| 不误导搭配证据 | 每张卡都有“已确认搭配”或“已确认替换”来源；锚点始终在卡内 |
| 得到真实反馈 | 选择后 12 小时起，在下一次 Quick session 中最多提醒一次；用户可记录满意、不满意、没穿或以后再说 |
| 为下一阶段积累数据 | 选择与反馈保存为 owner 私有、可审计的事件；拒绝理由只约束当前核心外衣 + 槽位 + 候选单品 |

### 本期包含

- 任意现有单品详情页的“用这件搭一套”入口。
- 已确认 Best Match 的检索、单槽位已确认变体的展示、稳定排序和短解释。
- “今天穿这套”创建、一次性提醒领取、满意/不满意/没穿/以后再说的反馈闭环。
- Development 专用数据库迁移、RLS/RPC、受控 API、私有指标与测试。

### 明确不包含

- 从零生成新组合、跨搭配拼多个变体、AI 生成解释或建议。
- 实验室拼贴、天气/日历自动判断、好友邀请、公开分享、跨用户学习、相册导入、Agent 协议。
- 对现有 `best_matches.items` JSON、视觉分析原始字段或 Production 数据的改写。

### 关键取舍

P0 的候选少于用户最终可能想要的数量，但每张都能被证明；这是对个人审美基座更有价值的起点。若某件衣服没有已确认搭配，系统诚实地留空，而不拿算法猜测填满页面。

## 五、核心方案：用户路径、规则与技术合同

### 5.1 用户路径

```text
单品详情
  → 点击「用这件搭一套」
  → Quick 页面加载候选
  → 选择一张完整搭配卡
  → 点击「今天穿这套」
  → 创建私有选择记录
  → 12 小时后下一次 Quick session 领取一次提醒
  → 满意 / 不满意（可写原因）/ 没穿 / 以后再说
  → 反馈进入该候选的上下文证据，供后续分析使用
```

### 5.2 候选生成规则

**锚点**：`anchorItemId` 可为任一 `all_item_ids` 中的有效单品，不限于核心外衣。

**候选来源（仅两种）**：

1. **已确认搭配**：锚点是某个 Best Match 任一槽位的 `primary`，原样返回该套搭配。
2. **已确认替换**：锚点只出现在某个槽位的 `variants`；系统返回该来源 Best Match，并且只把这个槽位的 primary 替换成锚点。

每个来源 Best Match 可产生多个候选，但每个候选只允许一个“替换槽位”。这样“可替换”仍然严格等于原记录中的可替换，不会组合出从未确认过的搭配。

**候选有效条件**：

- 所有选中的单品均存在、属于当前用户、当前可用；缺失、被删除或越权的引用直接剔除。
- 候选包含锚点，并至少保留一件有效上装和一件有效下装。
- 以固定槽位和数组顺序序列化 `canonicalSelections`；空槽位也有固定表示，避免同一套搭配被多次编码。

**默认排序**：

1. 已有 `satisfied_count` 高的候选；
2. 同分时 `selected_count` 高的候选；
3. 再优先锚点为 primary 的来源；
4. 再按 Best Match `updated_at DESC`；
5. 最后按 `optionKey ASC` 保持稳定。

排序只反映这条候选的私有使用情况，不将基础款频率、单品评分或颜色相近度混入 P0 排序。最多返回前三条。

### 5.3 卡片与界面交接

#### A. 单品详情入口

- 主按钮：`用这件搭一套`
- 只对当前用户拥有、仍可用的单品展示。
- 跳转：`/outfit/quick/:itemId`。

#### B. Quick 结果页

首屏从上到下：锚点小卡、标题“用「{单品名}」搭一套”、最多三张候选卡。

每张卡必须有：

- 该套搭配的完整缩略图/单品组合；
- 证据标签：`已确认搭配` 或 `已确认替换`；
- 来源：`来自 Best Match「{名称}」`；
- 一句固定说明：`这套搭配已在你的 Best Match 中保存。`；
- `为什么这样搭` 折叠区：最多两条已存在、可回溯的 `DecisionMechanism`。若没有，显示：`你已经记录过这套搭配；当前还没有足够字段说明它的具体处理方式。`；
- 操作：`今天穿这套`，以及返回单品详情。

视觉与交互：桌面端可并列三张卡；375px/390px 为一列，卡片不出现横向滚动。加载时显示三张骨架卡。不能因为解释缺失而隐藏已有搭配。

#### C. 空、失败与局部状态

| 状态 | 页面文案与动作 |
|---|---|
| 没有候选 | `这件衣服还没有已确认的搭配。先记录一套 Best Match，之后它会直接出现在这里。` + `去创建 Best Match` |
| 数据局部失效 | 显示仍有效的卡；无效引用不显示，不显示猜测替补 |
| 网络/服务失败 | `暂时没能读取你的搭配记录。` + `重试`；不把失败误报成无搭配 |
| 环境校验失败 | `当前分析环境未正确配置，无法读取数据。`；不显示或写入任何 Production 数据 |
| 选项已更新 | `这套搭配刚刚有改动，请刷新后再确认。` + `刷新搭配` |

#### D. 反馈提醒与结果

创建选择 12 小时后，用户下一次进入任一 Quick 页面时，服务端最多领取**当前用户自己**最近的一条待提醒选择。顺序固定为 `created_at DESC, id DESC`；它并不与当前锚点强绑定，语义是“上次你选的那套后来穿了吗”。

- 提醒：`上次选的「{Best Match 名称}」后来穿了吗？`
- 操作：`满意` / `不满意` / `没穿` / `以后再说`
- 选择“不满意”后才出现原因输入：最多 200 字，选填；输入内容只对本人可见。
- “以后再说”关闭本次提醒，不改变选择为终态，用户仍可在后续入口手动填写结果；提醒不会再次弹出。

### 5.4 决策证据与解释边界

- `DecisionMechanism` 是唯一允许进入“为什么这样搭”的分析对象，必须具备 `ruleId`、案例、来源和状态。
- 已确认文字、人工确认字段、变体记录与实穿反馈可以加强解释；未确认 Kimi 命题、`proposed` 视觉字段、纯颜色接近和高频基础件不能进入正式解释。
- P0 固定来源说明永远可用；审美解释只在其已存在且可追溯时展示，不新增 AI 调用。

### 5.5 接口、版本与幂等合同

浏览器只调用 API；不得直接对选择、反馈、命令回执或排序投影表做写入。

| 接口 | 用途 | 关键输入 | 成功结果 |
|---|---|---|---|
| `GET /api/outfit-options?anchorItemId=` | 读取候选 | `anchorItemId` | 最多 3 条候选、来源、`optionKey`、`dataVersion`、`presentationToken`、解释 |
| `POST /api/outfit-selections` | 创建“今天穿这套”根记录 | `sourceMatchId`、`anchorItemId`、`canonicalSelections`、`optionKey`、`dataVersion`、`presentationToken`、`idempotencyKey` | 选择 ID、状态、提醒时间 |
| `POST /api/outfit-selections/claim-reminder` | 领取一次应显示的提醒 | `idempotencyKey` | 一条提醒或 `204 No Content` |
| `POST /api/outfit-selections/:id/feedback` | 写入结果或关闭提醒 | 结果、可选原因、`idempotencyKey` | 更新后的选择状态 |

`GET /api/outfit-options` 也必须认证；它只从 JWT 的 `auth.uid()` 取得 owner，并为锚点、Best Match、单品可用性、变体和排序投影的**每一条**查询附加 `owner_id = auth.uid()`。不接受请求中的 owner 参数。锚点不属于当前 owner 或不存在时统一返回不可见，且绝不签发 token。

#### 创建选择的服务端校验

客户端字段都视为不可信。服务端按当前身份重建该锚点的全部有效 P0 候选，并且要求候选同时匹配：

`sourceMatchId + anchorItemId + canonicalSelections + optionContractVersion`

然后再比对 `optionKey` 和 `dataVersion`。任一不符返回 `409 stale_option`，客户端刷新后重新确认。只有 GET 在当前页面实际返回的最多三条候选可被创建：GET 先为本次有序结果计算 `presentedSetHash = sha256(ownerId + ordered(candidateId + optionKey + dataVersion) + optionContractVersion)`，再为每张卡签发一个 10 分钟有效、owner 绑定的 `presentationToken`。token 的 HMAC payload 固定包含 `ownerId`、`candidateId`、`sourceMatchId`、`anchorItemId`、`canonicalSelectionsHash`、`optionKey`、`dataVersion`、`optionContractVersion`、`presentedSetHash`、发放时间和过期时间；`candidateId` 是该次 GET 返回中这一张卡的稳定服务端 ID。

POST 在**同一个事务**中必须验证签名、过期时间、`verifiedToken.ownerId === auth.uid()`，同时精确核对 token、请求、重建候选与 `sourceMatchId + anchorItemId + canonicalSelections + optionContractVersion`。token 中的 `candidateId`、`canonicalSelectionsHash` 与 `presentedSetHash` 也必须匹配该卡及该次最多三张的有序展示集合；候选不在签名集合中或任一字段不符统一拒绝。所有候选、来源 Best Match 和单品的查询/重建均以 `owner_id = auth.uid()` 限定。这样客户端不能凭某个“仍有效但从未展示”的候选写入排序或反馈；若候选本身已更新，仍以 `stale_option` 处理。

`optionKey = sha256(sourceMatchId + anchorItemId + canonicalSelections + optionContractVersion)`  
`dataVersion = sha256(sourceMatchId + sourceMatchUpdatedAt + canonicalSelections + orderedSelectedItemUpdatedAt + optionContractVersion)`

哈希和版本号只由服务端生成。`canonicalSelections` 使用固定槽位、索引与空值编码，保证跨设备一致。

#### 命令回执

所有变更命令都必须携带客户端生成的 UUID v4 `idempotencyKey`（长度 36；服务端拒绝其他格式）。回执表唯一键为：

`(owner_id, command_type, idempotency_key)`

`command_type` 为 `create_selection`、`claim_reminder` 或 `submit_feedback`。回执至少保留 30 天；客户端在网络超时后只能以同一命令和同一 key 重试，操作完成或得到确定性 4xx 后不得为同一操作新建 key。

回执保存的是不可变的 `response_body` 和服务端计算的 `payload_hash`，不保存“是否重放”这个传输标识。相同命令、相同 key、相同归一化 payload 返回原业务响应，HTTP 状态保持一致，并额外附带 `idempotentReplay: true`；首次返回同一 `response_body` 加 `idempotentReplay: false`。相同 key 但 payload 不同返回 `409 idempotency_conflict`。

用于哈希、HMAC 与回执 payload hash 的所有对象必须采用同一份字节稳定的规范序列化：固定字段顺序、固定槽位/数组顺序、UTF-8、无空白重排、空值统一编码。命令回执的唯一插入/读取与根选择、事件、投影的业务变更必须在同一数据库事务中完成；回执冲突时先返回已存结果，不能先写业务数据再补回执。

### 5.6 数据、状态与权限

#### 新增表（Development migration）

| 表 | 作用 | 关键字段与限制 |
|---|---|---|
| `outfit_selections` | 一次“今天穿这套”的根投影与不可变搭配快照 | `owner_id`、`option_key`、`source_match_id`、`anchor_item_id`、`canonical_selections`、`data_version`、`option_contract_version`、`status`、`reminder_state`、`state_version`、时间字段 |
| `outfit_feedback_events` | 只追加的选择/提醒/结果历史 | `selection_id`、`owner_id`、`event_type`、`sequence`、原因字段；`unique(selection_id, sequence)` |
| `outfit_option_usage_projection` | 排序用私有计数投影 | `owner_id`、`option_key`、`selected_count`、`satisfied_count`；`unique(owner_id, option_key)` |
| `outfit_command_receipts` | 原子幂等回执 | `owner_id`、`command_type`、`idempotency_key`、`payload_hash`、`response_body`、`http_status`、创建时间；三字段唯一 |

`outfit_selections` 的搭配快照、来源和版本创建后不可更新；数据库触发器拒绝修改。创建时必须保存 `source_match_name_snapshot`、`canonical_selections` 与每件单品的 `{id, name, category, slot}` 快照，足以在日后解释“当时选了什么”。不复制图片 URL：若原图或原单品后来删除，历史选择显示名称、品类与“单品已删除”占位，绝不保留已删除图片或继续生成候选。反馈只以追加事件和受控投影状态表达，防止历史被悄悄改写。

#### 状态机

```text
create_selection
  → open / pending
  → (12h 后，领取一次) open / shown
  → 满意：satisfied（终态）
  → 不满意：unsatisfied（终态）
  → 没穿：not_worn（终态）
  → 以后再说：open / dismissed（不再自动提醒）
  → 7 × 24h 后：expired（终态）
```

- 创建在同一事务中写入 `selected_for_wear` 事件，并对 `outfit_option_usage_projection` 原子 UPSERT：`selected_count + 1`。
- 满意在同一事务中写入 `worn_satisfied`，对同一投影行原子 `satisfied_count + 1`；不满意和没穿不增加满意计数。
- `claim-reminder` 只在 **认证 owner 自己的记录** 内，以 CTE 先确定 `WHERE owner_id = auth.uid()` 下按 `created_at DESC, id DESC` 排出的**唯一最新** `open + pending + eligible` 记录，再只尝试 `FOR UPDATE SKIP LOCKED` 锁该记录。若它已被另一请求锁定或在锁前失去资格，返回 `204`，绝不回退领取更早的记录；领取成功则写入 `reminder_shown` 并设为 `shown`。并发请求至多有一个领取成功；任何查询、锁或计数均不能跨 owner。
- 每个写事务给事件序号递增，并锁定根记录及其投影行；计数不从 append-only 事件临时回算。
- 反馈和到期检查必须在同一事务内进行：先以 `FOR UPDATE` 锁定该 owner 的根记录，使用服务端 `created_at` 计算经过时间，先判断终态/到期，再决定是否写入反馈。已到期时事务只写入 `expired` 事件、更新根状态，然后固定返回 `409 selection_expired`；绝不在同一或并发请求中继续写入满意/不满意/没穿。该业务响应会被写入对应命令回执。同一 key 重放相同 409；新 key 仍得到该状态。
- 终态和 `expired` 后拒绝任何新的反馈或提醒领取；P0 不支持“改回满意”。

#### 权限与环境隔离

- API 从 Supabase JWT 得到 owner；找不到或不属于该 owner 的选择统一返回不可见，避免泄露其他人的存在。
- RLS：用户只可读自己的选择、事件和投影；浏览器对上述四张新表无 `INSERT/UPDATE/DELETE` 权限。
- 只有受控 API 能调用 `SECURITY DEFINER` RPC；每个 RPC 均从 JWT `auth.uid()` 自行取得 owner，拒绝缺失身份、外部传入 owner 或与 token 不一致的 owner。函数固定 `search_path = pg_catalog, public`、对表名全部 schema 限定；撤销 `PUBLIC` 的 execute，仅向预期 authenticated/server 角色授予最小 execute。RPC 在同一事务内完成状态、回执、事件、投影写入。
- 本地/Preview 仅允许 `SUPABASE_ENV=development` 且项目 ref 为 `mazsopbfpqchzhyuaron`；Production 仅允许 `SUPABASE_ENV=production` 且 ref 为 `cfnkhilwpkfqebrticqe`。未知或不一致一律 `503 environment_misconfigured`。
- Development/Preview 不注入 Production service-role 凭据；迁移脚本在执行前断言目标 project ref。P0 不调用 Kimi，不发送图片、故事或原因文本给第三方。

### 5.7 边界条件

| 边界 | P0 行为 |
|---|---|
| 资格与范围 | 仅登录用户自己的可用单品；访客、公开衣柜、跨账号读写均不支持 |
| 空、损坏或越权输入 | 无候选走空状态；损坏引用剔除并保留可用卡；越权返回不可见 |
| 重复与并发 | UUID 命令回执保证同命令重试不重复创建；提醒锁保证只领取一条；投影原子 UPSERT 防丢计数 |
| 版本过期 | 服务端重建并精确核对来源、锚点、选择、合同版本与数据版本；不符 409 后刷新 |
| 超时/局部失败 | 已保存的回执可安全重试；单卡失效不影响其余卡；服务失败可重试，不能显示伪结果 |
| 取消/回滚 | 用户未点击“今天穿这套”不写数据；迁移仅在 Development 先行，可用下行 migration 删除新表；不触碰原始表 |
| 容量与兼容 | 首轮每次最多三条；个人衣橱规模采用按 owner 的 SQL 查询/索引，不引入图数据库；旧客户端继续读取原 `best_matches.items` |
| 信任与隐私 | 不生成、不过度解释；原因最多 200 字、过滤 HTML、只本人可见、不进入日志与汇总指标；随选择或账户删除 |

#### 命令—状态矩阵（唯一权威）

| 命令 | 允许的来源状态 | 目标状态 / 副作用 | 首次响应 | 相同回执重放 |
|---|---|---|---|---|
| `create_selection` | N/A；仅持有未过期 `presentationToken` 的显示候选 | `open/pending`；事件 `selected_for_wear`；`selected_count +1` | `201` + 选择快照 | 原 `201` body + `idempotentReplay:true` |
| `claim_reminder` | 当前 owner 最近一条 `open/pending` 且已满 12h、未满 7×24h | `open/shown`；事件 `reminder_shown` | `200` + 提醒，或 `204` | 原状态/body + 标记 |
| `dismiss_reminder`（反馈接口的一种结果） | `open/pending` 或 `open/shown` | `open/dismissed`；事件 `reminder_dismissed` | `200` | 原 `200` body + 标记 |
| `submit_feedback:satisfied` | `open/pending`、`open/shown` 或 `open/dismissed`，且未到期 | `satisfied`；事件 `worn_satisfied`；`satisfied_count +1` | `200` | 原 `200` body + 标记 |
| `submit_feedback:unsatisfied` | 同上 | `unsatisfied`；事件 `worn_unsatisfied` | `200` | 原 `200` body + 标记 |
| `submit_feedback:not_worn` | 同上 | `not_worn`；事件 `not_worn` | `200` | 原 `200` body + 标记 |
| 任一反馈（已到期） | `open/*` 且到期 | `expired`；事件 `expired` | `409 selection_expired` | 原 `409` body + 标记 |
| 任一反馈/领取（终态或已过期） | `satisfied`、`unsatisfied`、`not_worn`、`expired` | 不写新业务事件 | `409 invalid_selection_state` 或 `409 selection_expired` | 原状态/body + 标记 |

“今天”是界面语言，不是数据库日期事实。创建时另保存 `selection_local_date`（按用户浏览器提供的 IANA 时区换算的 YYYY-MM-DD）和 `selection_time_zone`；它只用于日后显示和日历扩展。提醒和失效仍严格使用选择创建时刻起的 12 小时和 7×24 小时，不受旅行或跨日影响。

#### 排序投影定义

`outfit_option_usage_projection` 的聚合身份严格为 `(owner_id, option_key)`：`option_key` 已包含 `sourceMatchId + anchorItemId + canonicalSelections + optionContractVersion`，因此同一视觉组合若来自不同来源、锚点或替换路径，仍是不同的可审计候选。创建成功只令 `selected_count +1`；成功写入 `satisfied` 只令 `satisfied_count +1`；`unsatisfied`、`not_worn`、`dismissed`、`expired` 绝不回退或改变两项历史计数。重复创建是否会强化排序是有意的：它记录用户再次主动选了同一上下文；重复网络请求由回执去重，不能造成计数膨胀。

## 六、推进、验证与发布

### 实施顺序

1. **合同与 migration**：在 Development 新建表、RLS、触发器、RPC、目标 ref 断言与下行 migration。
2. **候选读取**：实现服务端候选重建、规范编码、版本哈希、排序投影读取与解释映射。
3. **选择与反馈事务**：实现三条命令、回执、状态机、提醒领取和隐私处理。
4. **界面**：单品入口、Quick 卡、空/错误/过期状态与反馈提醒；桌面、390px、375px 回归。
5. **私有观测**：记录 session 与结果，先由 Victor 连续使用两周。
6. **评审闸门**：根据真实复用、60 秒内选择和实穿反馈，决定进入实验模式或先修入口/排序。

### 验收清单

#### 功能与数据

- 任意有效单品能正确找回包含它的 Best Match；变体锚点只替换原来源的一个槽位。
- 候选始终包含锚点，并有有效上装和下装；删除/缺失引用不能进入候选。
- 同一搭配在同一来源、锚点和规范选择下得到稳定 `optionKey`；同一单品在两个不同槽位生成的候选不被错误合并。
- 选择创建必须精确匹配 `sourceMatchId + anchorItemId + canonicalSelections + optionContractVersion`，再校验哈希和版本。
- GET 与创建均只能从 `auth.uid()` 得到 owner；创建只接受 GET 返回的三张卡中、属于当前 owner、未过期且未被篡改的 `presentationToken`。跨 owner 锚点、未展示候选、被改写的 `candidateId` / 展示集合 hash、跨 owner token 和 10 分钟后 token 均被拒绝。
- 同 key 同 payload 并发请求只产生一条根选择和一组事件；重放业务响应一致，`idempotentReplay` 只在传输层变化。
- 投影计数在创建/满意时原子更新；并发测试不丢失 `selected_count` 与 `satisfied_count`。
- 一次提醒领取只能成功一条；“以后再说”、到期和终态均按状态机限制后续动作。
- 旧客户端、现有单品和 Best Match 读写回归通过；Production 无 schema 或行为变化。

#### 界面与说明

- 三个候选以内，首屏可以理解来源；不出现“AI 推荐”或无依据的搭配原因。
- 每条解释两次点击内能回到对应 Best Match、单品字段、已确认文字或变体记录。
- 没有证据时显示固定来源说明与诚实的缺失说明；不生成空泛文案。
- 375px/390px 下没有横向滚动、遮挡和无法操作的反馈框。

#### 自动化测试夹具

- primary 锚点、variant 锚点、多槽位同锚点、没有候选、缺上/下装、删除引用、无效变体、规范编码和稳定 hash。
- 命令回执的同 key、不同 key、并发、payload 冲突、过期反馈、跨 owner、提醒并发、终态拒绝。
- owner 范围提醒领取（并发时只领取最新一条，锁住最新项则不回退旧项）、RPC 缺少 JWT / 外部 owner / `PUBLIC execute` 拒绝、跨 owner 或过期 `presentationToken` 拒绝、历史快照在原单品和图片删除后的显示、时区日期保存、反馈与到期并发时只能形成一种终态。
- 解释存在与解释缺失两条路径；环境矩阵 local/preview/development/production 的允许与拒绝行为。

### 上线与回滚

- 仅部署到 Development，再由 Victor 使用，不做公开发布。
- 发布前运行 `npm run lint`、`npm run test:aesthetic`、Quick feature 的 API/UI 回归、`npm run build`。
- 出现越权、重复创建、错误环境连接或候选误标为已确认时立即关掉入口 feature flag；不删除原始数据。必要时执行 Development 下行 migration。

## 七、风险、依赖与开放决策

| 风险 / 依赖 | 判断 | 缓解与负责人 |
|---|---|---|
| 有些单品没有任何已确认搭配 | 高概率、可接受 | 诚实空状态，跳转创建 Best Match；产品负责人观察空状态比例 |
| 现有变体包含空位或历史脏引用 | 已知 | 候选重建时过滤，质量审计记录；工程负责 |
| “满意”不等于长期偏好 | 已知 | 只增加当前候选私有排序信号；审美原则仍需证据门槛，后续再扩展实穿语义 |
| 私人原因文本泄露 | 不可接受 | owner-only RLS、日志排除、字符上限、删除链路；工程负责 |
| Development/Production 混用 | 既往高风险 | 双环境变量与 ref 双重闸门、CI 断言、最小凭据；工程负责 |
| 候选太少导致价值不足 | 待验证 | 两周指标未通过时优先改善 Best Match 覆盖和入口，不贸然加入生成模型；产品负责人 |

### 本次暂不拍板

1. 实验模式何时允许用户把多个变体组合成新的候选；需要单独的“待验证”状态和接受事务。
2. 是否将相册解析和私人 Agent 作为衣LOG 2.0 的数据录入通道；涉及权限、批量成本、图片保留与协议边界，应另立探索 Brief。
3. 是否把满意反馈用于更广泛的替换规则；P0 只约束同一来源上下文，避免过度泛化。

## 八、埋点与指标

### 功能完成度：链路是否可靠

| 事件 / 信号 | 口径与分母 | 观察窗口 | 隐私边界 | 能改变的决策 |
|---|---|---|---|---|
| `quick_mode_open` | 每次有效进入；同一锚点 5 分钟内重复进入合并为一会话 | 每日 | owner 私有随机 session id；不带单品、故事、图片或原因 | 判断入口/加载是否可用 |
| `quick_options_loaded` / `quick_load_failed` | 以所有 `quick_mode_open` 为分母，技术失败单列 | 每日 | 同上 | 排查服务、环境或数据质量问题 |
| `quick_option_selected` | 有候选会话中的“今天穿这套”次数 / 有候选会话数 | 两周 | 不上传第三方分析 | 判断用户是否能完成选择 |
| 回执/状态机错误 | API 命令总数为分母；按 stale、权限、幂等、过期分类 | 每日 | owner 私有操作日志最小化保存 | 判断是否可扩大试用 |

### 产品与用户价值：是否值得保留

`Quick session` 从一次有效 `quick_mode_open` 开始，5 分钟无操作结束。除明确技术加载失败外，所有打开均在会话分母中；空状态和放弃不能被排除。

| 指标 | 定义 | 两周判断规则 |
|---|---|---|
| 使用频率 | 每周有效 Quick session | 每周至少 3 次 |
| 快速选择率 | 60 秒内首次“今天穿这套”的有效会话 / 全部有效会话 | 超过 50% |
| 实穿反馈 | `satisfied` 或 `unsatisfied` 终态数量；`not_worn` 不算实穿 | 每周至少 1 次实际穿过反馈 |
| 已有经验复用 | 从 primary 来源和 variant 来源创建的选择分别计数 | 观察是否真的复用 Best Match 或已确认变体 |
| 放弃 / 空状态 / 技术失败 / 未确认实穿 | 各自按全部有效会话或已选择记录单独报告 | 防止点击量制造虚假成功 |

**决策规则**：若连续两周达到前三项门槛，并观察到 Best Match 或变体的真实复用，进入实验模式设计；若未达到，先根据空状态、放弃位置和加载失败修正覆盖率、入口或排序。所有统计只为 Victor 自己的 Development 账户计算，不用于跨用户画像或训练。

---

## 附录 A：需求到合同的追踪

| 用户价值 | 产品规则 | 证明方式 |
|---|---|---|
| 一件衣服迅速出完整搭配 | primary/单变体两类候选，最多三条 | 候选夹具 + Quick 页面回归 |
| 不把猜测当确认 | 固定证据标签、无 AI、单槽位变体边界 | UI/来源测试 |
| 选择真的被记下且不重复 | server 重建校验 + 回执 + 单事务 | API 并发/重试测试 |
| 反馈能成为反例 | owner 私有 append-only 事件 + 上下文限制 | 状态机/RLS 测试 |
| 不伤害线上产品 | Development ref 双闸门、无原表改写 | 环境矩阵、迁移检查 |

## 附录 B：对抗式审查记录

### 审查协议

- **文档路线**：功能 PRD + AI 模块（AI 不在 P0 运行）。
- **审查输入**：规范化初稿、公开竞品链接、技术假设/开放问题；不含 Victor 私人故事、图片、密钥或真实导出数据。
- **隔离方式**：新鲜 Agent、`fork_turns: none`、`parent_context=false`、prompt-only、无工具访问；最终签核审查运行于 2026-08-04。

### 已处理发现

| 严重度 | 发现 | 处理位置与结论 |
|---|---|---|
| Blocker | 多个变体可被自由组合，会把从未确认的组合标为已确认 | 5.2：P0 只允许锚点对应的单槽位替换 |
| High | 任意单品锚点、候选身份、旧记录有效性和来源核对不完整 | 5.2、5.5、5.6：任意有效引用可作锚点，严格来源匹配和服务端重建 |
| High | 选择/反馈缺少原子幂等、并发与权限边界 | 5.5、5.6：独立根选择命令、回执、RLS、RPC、投影锁 |
| High | 提醒语义、过期行为与排序的并发规则不清 | 5.4、5.6：固定领取顺序、7×24h 到期、原子投影 |
| High | 命令 key 缺作用域；重放响应语义冲突 | 5.5：`command_type + UUID` 唯一；持久化业务响应与传输标记分离 |
| High | 创建选择可能匹配到相同编码但不同来源的 Best Match | 5.5：先严格匹配 `sourceMatchId + anchorItemId + canonicalSelections + optionContractVersion` |
| Medium | 原因文本、指标和环境可能越界 | 5.6、5.7、8：最小化私有存储、环境双闸门、无第三方埋点 |

**审查结果与处置**：最终修订前一轮发现 Blocker 0 / High 3 / Medium 3；命令作用域、重放语义、来源绑定、提醒顺序、过期响应与投影原子性均已修复。其后两轮独立复核继续发现并修复：GET owner 过滤、展示 token 的候选/集合绑定、owner 令牌核对、最新提醒并发竞争、反馈与到期并发竞争。最终签核为 **Blocker 0 / High 0，通过**。最终审查保留两项实现注意：命令回执唯一约束与写入必须和业务变更同一事务；所有签名字段与展示集合排序必须使用字节稳定的规范序列化。两项均已写入 5.5、5.6 和验收夹具。

## 文档自评

### 通用质量门槛

| 维度 | 评级 | 说明 |
|---|---|---|
| 决策与问题定义 | 🟢 | 从“已有搭配不能在当下被使用”的具体断裂出发 |
| 用户、场景与证据 | 🟢 | 以 Victor 的真实数据结构和两周 dogfood 为范围 |
| 竞品与替代方案研究 | 🟢 | 包含三类公开一手资料与当前手动替代 |
| 范围、约束与风险 | 🟢 | P0 和后置项、隐私、环境、回滚均明确 |
| 用户路径与界面交接 | 🟢 | 入口、卡片、空/错/过期、移动端和文案可直接设计 |
| 边界条件 / 异常处理 | 🟢 | 资格、状态、失败、兼容、隐私已逐项覆盖 |
| 功能完成度埋点 | 🟢 | 事件、分母、失败分类和决策用途已定义 |
| 产品与用户价值指标 | 🟢 | 两周门槛与未通过时的下一决策明确 |
| 可执行性 | 🟢 | 已完成独立签核；实施前只需按既定 migration 夹具确认现有表的可用/删除语义 |

### 功能 PRD + AI 模块专项门槛

| 专项维度 | 评级 | 说明 |
|---|---|---|
| 工作流、规则与状态机 | 🟢 | 候选、创建、提醒、反馈和到期均可测试 |
| 权限、幂等与兼容 | 🟢 | 浏览器禁写、RPC 单事务、回执与旧客户端策略明确 |
| AI 能力边界与人工回退 | 🟢 | P0 明确不调用 AI；解释只读取已存在证据，缺失时诚实降级 |
| 依赖与验收 | 🟢 | migration、API、UI、环境、夹具和回归都有验收点 |

**总体**：0 项红灯、0 项黄灯。文档可进入 Development 开发排期；上线前仍须按第六部分完成 migration、环境与回归验证。
