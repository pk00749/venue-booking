# 运动竞赛、积分等级与排行榜 Feature 文档

> 状态：提议 · v0.1 · 2026-07-18
> 范围：仅“用户粘性 + 比赛激烈程度”增强功能；与 `PRD.md` §2.2 / §4 冲突时，按本文规则先同步 PRD 再编码。

## 0. TL;DR

- 每项运动独立维护永久成长 XP（决定等级、只升不降）与赛季竞技分（决定竞技榜、可升降）。
- 竞赛是现有预订之上的参赛层，绑定到单个 `court × slot`，不改预订责任、价格或支付（v2 不接支付，PRD §2.2）。
- 比赛分友谊赛（50% XP，不动竞技分）与排位赛（完整 XP + Elo 式竞技分结算）。
- 结果由发起人提交 → 参赛者 24h 确认或异议 → 场主审核；场主有利益冲突或 72h 未处理时自动升级到管理员。
- 服务端事务一次写入 XP / 竞技分流水，幂等且不可篡改；同一比赛、同一用户只能结算一次。
- 首页每项运动默认展示竞技榜 Top 20，可切换成长榜；所有排名与详情不公开 PII。

## 1. 范围与非目标

### 1.1 In Scope

- 竞赛模式创建 / 取消 / 队伍申请与审核 / 名单锁定
- 排位赛与友谊赛结算（含团队赛）
- 永久成长等级 + 赛季竞技分 + 12 周赛季重置
- 首页运动排行榜（Top 20 + cursor 分页完整榜）
- 个人运动档案（赛季战绩、胜率、不同对手数、最佳连胜、历史荣誉）
- 反刷分衰减、爽约处罚、利益冲突转审、审计日志
- 站内通知（不开邮件推送）

### 1.2 Out of Scope（首版明确不做）

- 支付分摊、退款、押金（PRD §2.2）
- 公开动态流 / 评论 / 点赞 / 聊天 / IM
- 多队排名赛 / 淘汰赛 / 循环赛 / 跨场馆锦标赛
- 现金奖励、优惠券、核销权益
- AI 自动配对、ML 异常检测（仅做规则化风控）
- 移动端原生 / 微信小程序入口

## 2. 关键概念

| 概念 | 说明 |
| --- | --- |
| 成长 XP（Experience Points） | 单项运动内累计的经验值，只增不减；驱动等级与成长榜 |
| 等级（Level） | 由 XP 决定的永久段位，最低 1 级，不掉级 |
| 竞技分（Rating） | 单项运动内可升降的实力评分，初始 1000；驱动竞技榜与配对 |
| 段位（Tier） | 由竞技分映射的可视段位（青铜/白银/黄金/铂金/钻石） |
| 竞赛（Competition） | 绑定一个 `court × slot` 的参赛活动，可由已确认预订的创建者开启 |
| 友谊赛 | 不影响竞技分，仅获得 50% XP |
| 排位赛 | 影响 XP 与竞技分；按 Elo 思路结算 |
| 定位赛 | 用户前 5 场排位；显示“定位中”，不进入竞技榜 |
| 赛季 | 12 周滚动周期；赛季结束对竞技分软重置 |

## 3. 用户旅程

### 3.1 创建竞赛

1. 已确认预订的创建者进入「我的预订 → 预订详情」；开场时间 > 30 分钟才允许创建。
2. 选择比赛类型（友谊 / 排位）、双队比赛的人均队伍人数或 `1v1`、是否公开可加入。
3. 创建者自动成为 A 队成员；场馆详情对应场次显示竞赛标识与剩余名额。
4. 提交即写 `competitions.status = 'recruiting'`，站内通知 + 实时推送。

### 3.2 加入竞赛

1. 公开竞赛对所有登录用户可见；私密竞赛通过站内邀请。
2. 用户选择队伍 → 创建一条申请记录（`pending`）；重复申请 / 满员 / 重复对手冷却会被前端拒绝。
3. 创建者收到通知 → 接受或拒绝；接受时记录 `accepted_at`，并在锁定后不允许退出。
4. 距开场 30 分钟内自动锁定阵容；锁定时若一方未满则该竞赛作废。

### 3.3 提交与审核结果

1. 比赛结束 → 预订按原规则变为 `completed`，竞赛状态进入 `awaiting_result`。
2. 发起人在 7 天内提交结构化比分（按运动类型选择比分格式）。
3. 所有参赛者 24 小时内确认或提出异议（reason 必填）；全部提前确认可提前进入待审。
4. 场主审核通过或驳回；场主本人参赛 / 是发起人 / 存在账号冲突时自动转管理员。
5. 场主 72 小时未处理，结果自动进入管理员队列。
6. 通过后由服务端事务写入 XP / 竞技分；驳回后发起人在 7 天总窗口内可重新提交。
7. 7 天仍未完成审核则关闭结算；管理员可手动恢复。

## 4. 规则详解

### 4.1 等级与 XP

- 升级累计门槛：`XP_min(L) = 50 × L × (L - 1)`；从 `L` 升到 `L+1` 需要 `100 × L` XP。
- 单场经验档位（按“对方赛前平均等级 - 己方等级”分档）：

| 等级差 Δ | 胜 | 平 | 负 |
| --- | --- | --- | --- |
| Δ ≤ -5 | 20 | 20 | 10 |
| -4 ~ -3 | 30 | 20 | 10 |
| -2 ~ -1 | 40 | 20 | 10 |
| 0 | 50 | 20 | 10 |
| +1 | 60 | 20 | 10 |
| +2 | 70 | 20 | 10 |
| +3 | 80 | 20 | 10 |
| +4 | 90 | 20 | 10 |
| Δ ≥ +5 | 100 | 20 | 10 |

- 友谊赛按上表的 50% 计算；作废、弃权、取消、`awaiting_result` 超时关闭均为 0 XP；正常到场者可获 10 XP “到场奖励”。
- 团队赛按对方已锁定阵容的赛前平均等级（向下取整）作为“对方等级”，对每名成员独立应用上表。
- 等级提升支持一次跨多级；累计阈值采用 `L = floor((1 + sqrt(1 + xp/25)) / 2)`（整数临界：xp=200 升 L=2、xp=600 升 L=3、xp=1200 升 L=4…）；`feature.md` §4.1 表格与 ADR-0001 以 `50×L×(L-1)` 作为软阈值近似展示。

### 4.2 竞技分（Rating）

- 初始值 `1000`；范围软约束 `0 ~ 3000`，超出后增减幅度衰减。
- 单场结算使用 Elo 公式：
  - 期望胜率 `E_A = 1 / (1 + 10 ^ ((R_B - R_A) / 400))`
  - 实际得分 `S_A = 1 / 0.5 / 0`（胜 / 平 / 负）
  - 变化 `ΔR_A = K × (S_A - E_A)`
  - `K`：定位赛 `60`，`Rating < 1500` `40`，`Rating < 2100` `25`，`Rating ≥ 2100` `15`
- 团队赛以双方平均 `Rating` 计算 `E`，每个成员应用相同 `ΔR`。
- 同一完整对阵阵容 7 天内衰减：

| 7 天内累计场次 | XP 系数 | Rating 变化 |
| --- | --- | --- |
| 1 | 100% | 100% |
| 2 | 100% | 100% |
| 3 | 50% | 50% |
| ≥ 4 | 20% | 0% |

- “完整对阵阵容”以锁定时的 `participant_set_hash` 识别；换人不绕过。

### 4.3 段位（Tiers）

| 段位 | Rating 区间 |
| --- | --- |
| 青铜 Bronze | 0 - 1099 |
| 白银 Silver | 1100 - 1399 |
| 黄金 Gold | 1400 - 1699 |
| 铂金 Platinum | 1700 - 1999 |
| 钻石 Diamond | 2000+ |

- 段位只用于展示、赛季徽章与段位匹配推荐，不直接改变结算。

### 4.4 排位赛匹配与分队

- 推荐对手：竞技分相差不超过 `±200` 且段位相同优先；超过 `±400` 不出现在“推荐”列表。
- 团队排位赛：名单锁定后由系统按 `Rating` 自动平衡两队；允许发起人手动调整，调整后两队平均 `Rating` 差必须 `≤100`。
- 报名页展示预计胜率 `E_A × 100%` 和可能的 `ΔR` 范围（含 K 因子上限 / 下限）。
- 友谊赛不强制平衡。

### 4.5 爽约与争议

- 场主审核时可标记“爽约”；发起人 / 现场参赛者可附 24 小时内凭证（截图 / 描述）。
- 30 天内累计 2 次爽约 → 暂停排位 7 天（仍可参加友谊赛，但无效竞技分变化）。
- 任何参赛者 24 小时内可提异议；异议触发场主必须在 24 小时内处理或转管理员。
- 异常事件（重复阵容、风控命中）写入 `audit_logs`；管理员可在 30 天内人工撤销结算。

## 5. 数据模型

### 5.1 新增表

#### `competition_seasons`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| number | integer unique | 赛季序号，自增 |
| starts_at | timestamptz | |
| ends_at | timestamptz | |
| status | text check in ('upcoming','active','settled') | |
| reset_formula | text | 默认 `1000 + 0.75 × (R - 1000)` |
| created_at | timestamptz default now() | |

#### `user_sport_progress`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| user_id | uuid FK → profiles.id | |
| sport_type | text check in (PRD §5.2 sport_type 枚举) | |
| xp | integer default 0 | 永久累计 |
| level | integer default 1 | `floor((1 + sqrt(1 + xp/25)) / 2)` |
| rating | integer default 1000 | 赛季竞技分 |
| peak_rating | integer default 1000 | 历史峰值 |
| placement_done | integer default 0 | 已完成定位赛场次 |
| last_match_at | timestamptz | |
| primary key (user_id, sport_type) | | |

> `xp` 与 `level` 永不下降；`rating` 赛季结束按 `reset_formula` 更新。

#### `competitions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| booking_id | uuid FK → bookings.id | 关联预订 |
| slot_id | uuid FK → slots.id | 关联 slot |
| court_id | uuid FK → courts.id | 关联场地 |
| venue_id | uuid FK → venues.id | |
| sport_type | text check in (...) | 冗余字段，避免跨表 |
| creator_id | uuid FK → profiles.id | 发起人 |
| kind | text check in ('friendly','ranked') | |
| mode | text check in ('singles','teams') | |
| team_size | integer check > 0 | 每队人数；`1v1` 时为 1 |
| visibility | text check in ('public','private') default 'public' | |
| status | text check in ('recruiting','locked','awaiting_result','pending_review','approved','rejected','voided','cancelled') | |
| starts_at | timestamptz | slot 起始时间 |
| ends_at | timestamptz | slot 结束时间 |
| participant_set_hash | text | 锁定阵容哈希，用于衰减识别 |
| locked_at | timestamptz | |
| submit_deadline_at | timestamptz | `ends_at + 7d` |
| reviewed_by | uuid FK → profiles.id nullable | |
| reviewed_at | timestamptz nullable | |
| review_escalated_to | uuid FK → profiles.id nullable | |
| review_escalated_at | timestamptz nullable | |
| created_at | timestamptz default now() | |
| check (ends_at > starts_at) | | |
| check (team_size * (case mode when 'singles' then 2 else 1 end) <= (select capacity from courts where id = court_id)) | | 队伍总人数 ≤ 场地容量 |

> `unique(slot_id)`：一个 slot 最多一场竞赛。

#### `competition_participants`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| competition_id | uuid FK → competitions.id on delete cascade | |
| user_id | uuid FK → profiles.id | |
| team | text check in ('A','B') nullable | `null` 表示申请中或被拒 |
| status | text check in ('invited','pending','accepted','declined','rejected','withdrawn','no_show','played') | |
| applied_at | timestamptz default now() | |
| responded_at | timestamptz nullable | |
| pre_match_level | integer | 锁定时快照等级 |
| pre_match_rating | integer | 锁定时快照竞技分 |
| primary key (competition_id, user_id) | | |

> 唯一约束：同一竞赛同一用户仅一条记录。

#### `competition_results`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| competition_id | uuid FK → competitions.id unique | |
| submitted_by | uuid FK → profiles.id | |
| score_payload | jsonb not null | 结构化比分，按运动 schema |
| winner_team | text check in ('A','B','draw') nullable | 由 score_payload 推导 |
| notes | text nullable | |
| submitted_at | timestamptz default now() | |
| expires_at | timestamptz | `submitted_at + 24h` |
| status | text check in ('awaiting_responses','pending_review','approved','rejected','voided') | |

> `score_payload` schema 见 §5.3。

#### `competition_result_responses`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| result_id | uuid FK → competition_results.id on delete cascade | |
| participant_id | uuid FK → competition_participants.id | |
| response | text check in ('confirm','object') | |
| reason | text nullable | `object` 时必填 |
| responded_at | timestamptz default now() | |
| unique (result_id, participant_id) | | |

#### `experience_ledger`（不可变）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK → profiles.id | |
| sport_type | text | |
| competition_id | uuid FK → competitions.id | |
| idempotency_key | text unique | `competition_id:user_id` |
| xp_delta | integer | |
| rating_delta | integer | |
| pre_level | integer | |
| post_level | integer | |
| pre_rating | integer | |
| post_rating | integer | |
| reason | text check in ('match_win','match_draw','match_loss','attendance','void_reversal','admin_adjust') | |
| created_at | timestamptz default now() | |

> 服务端事务一次写入；`idempotency_key` 唯一约束保证同场同人不重复结算。

### 5.2 索引

- `competitions(venue_id, sport_type, starts_at desc)` — 详情页查询
- `competitions(status, ends_at)` — 等待提交 / 审核扫描
- `competitions(creator_id, created_at desc)` — 我的竞赛
- `competition_participants(user_id, status)` — 个人档案
- `user_sport_progress(sport_type, rating desc)` — 竞技榜
- `user_sport_progress(sport_type, xp desc)` — 成长榜
- `experience_ledger(user_id, sport_type, created_at desc)` — 个人流水
- `experience_ledger(competition_id)` — 审计回溯

### 5.3 `score_payload` JSON Schema

按 `sport_type` 选择 payload 形态：

```jsonc
// badminton / squash / tennis（局制）
{
  "format": "sets",
  "best_of": 3,                 // 3 局 2 胜
  "team_a_sets": 2,
  "team_b_sets": 1,
  "set_scores": [[21, 18], [19, 21], [21, 15]],
  "winner": "A"
}

// football（进球）
{
  "format": "goals",
  "team_a_goals": 3,
  "team_b_goals": 1,
  "winner": "A"
}

// basketball（总分）
{
  "format": "total_points",
  "team_a_points": 78,
  "team_b_points": 71,
  "winner": "A"
}

// draw
{
  "format": "draw",
  "winner": "draw"
}
```

校验规则：

- 服务端 zod schema 校验字段类型、取值范围、运动允许性；
- 平局仅对允许平局的运动开放（`badminton / squash / tennis` 否，其他是）；
- `winner` 必须由 payload 数值唯一推导，禁止客户端手填；
- 一旦审核通过，`score_payload` 不可修改。

## 6. 服务端接口

> 所有写操作必须经 Edge Function / RPC 调用 `service_role`；前端 RLS 不允许直接改 XP、Rating、状态。

| 操作 | 入口 | 权限 | 幂等键 |
| --- | --- | --- | --- |
| `createCompetition` | Edge Function | 创建者 = booking.user_id | `booking_id + slot_id` |
| `cancelCompetition` | Edge Function | 招募期：创建者；之后：管理员 | |
| `applyToCompetition` | Edge Function | 登录用户，role ∈ {user, owner, admin} | `(competition_id, user_id)` |
| `reviewApplication` | Edge Function | 创建者 | |
| `lockRoster` | Edge Function / pg_cron | 系统 | `competition_id` |
| `submitResult` | Edge Function | 发起人 / 任一参赛者 | `competition_id` |
| `respondToResult` | Edge Function | 参赛者 | `(result_id, participant_id)` |
| `reviewResult` | Edge Function | 场主（无冲突）或管理员 | `competition_id` |
| `escalateReview` | pg_cron / Edge Function | 系统 | |
| `getLeaderboard` | Edge Function | 公开 | `sport + cursor` |
| `getSportProfile` | Edge Function | 本人或 admin | |

错误码：`booking_not_confirmed / slot_in_use / already_started / roster_full / duplicate_application / cooldown_active / review_conflict / review_timeout / settlement_conflict / invalid_payload`。

## 7. RLS 摘要

| 表 | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| competition_seasons | 所有人 | service_role | service_role | 禁 |
| user_sport_progress | 自己 + 公开字段（昵称 / 等级 / rating / 段位） | service_role | service_role | 禁 |
| competitions | 公开 / 参赛者 / 场馆 owner / admin | service_role | service_role | 禁 |
| competition_participants | 公开 / 参赛者 / 场馆 owner / admin | service_role | service_role | 禁 |
| competition_results | 参赛者 / 场馆 owner / admin | service_role | service_role | 禁 |
| competition_result_responses | 参赛者 / 场馆 owner / admin | service_role | service_role | 禁 |
| experience_ledger | 自己 / admin | service_role | 禁 | 禁 |

公开视图 `leaderboard_view` 仅暴露排名、昵称、头像、等级、rating、段位、胜 / 平 / 负和场次，禁止邮箱、手机号、联系人。

## 8. 前端集成

- 首页（`/`）：在现有运动卡上方增加「运动排行榜」区，默认按系统活跃运动切到对应竞技榜 Top 20；提供“切换成长榜 / 竞技榜”和“查看完整榜单”。
- 场馆详情（`/venues/:id`）：竞赛场次显示「🏆 竞赛模式」chip，列出已接受参赛者的昵称、头像、等级和段位；非参赛用户可看到“申请加入”按钮。
- 我的预订（`/my-bookings`）：状态为 `confirmed` 且未开场的预订出现“开启竞赛模式”入口；详情页支持提交 / 回应结果。
- 场主控制台（`/owner`）：新增「待审结果」tab，支持通过 / 驳回；利益冲突自动转审。
- 管理员（`/admin`）：新增「竞赛冲突与异常」tab，处理转审与人工撤销。
- 个人运动档案（`/u/:id?sport=...` 或 `/profile?sport=...`）：赛季战绩、胜率、不同对手数、最佳连胜、徽章墙。
- i18n：所有新增文案同步进入 `frontend/src/i18n/{zh-CN,en-US}.json`，新增 key 一次性配齐。

## 9. 核心指标

### 9.1 北极星

- **周有效竞赛参与用户数 WVCU**：自然周内至少参加 1 场审核通过比赛的去重用户数。
- 同时按友谊 / 排位、运动类型、1v1 / 团队拆分展示，避免单一维度增长掩盖真实竞技活跃。
- 首赛季目标：连续 4 周环比非负；排位参与用户占 WVCU `≥40%`。

### 9.2 竞赛漏斗

| 指标 | 公式 | 目标 |
| --- | --- | --- |
| 竞赛转化率 | 创建竞赛的合格已确认 slot 数 ÷ 全部合格已确认 slot 数 | ≥ 10% |
| 申请接受率 | 被接受申请人数 ÷ 有效申请人数 | ≥ 60% |
| 成局率 | 锁定完整阵容的竞赛数 ÷ 已创建竞赛数 | ≥ 65% |
| 正常完赛率 | 审核通过且非作废竞赛数 ÷ 已开始且阵容完整竞赛数 | ≥ 80% |
| 结果提交率 | 结束后 7 天内提交结果的竞赛数 ÷ 正常开始竞赛数 | ≥ 90% |
| 结算成功率 | 成功写入全部 XP / Rating 流水的已通过结果数 ÷ 已审核通过结果数 | 100% |

### 9.3 粘性与回流

| 指标 | 公式 | 目标 |
| --- | --- | --- |
| 7 日竞赛复玩率 | 首次完成竞赛后 7 天内再次完成竞赛的用户占比 | ≥ 30% |
| 30 日竞赛复玩率 | 首次完成竞赛后 30 天内再次完成竞赛的用户占比 | ≥ 45% |
| 竞赛用户 D30 留存提升 | 竞赛用户 D30 留存率 − 同期仅预订用户 D30 留存率 | ≥ 10 pp |
| 月均有效比赛数 | 每名活跃竞赛用户每 30 天审核通过比赛数 | ≥ 2 |
| 对手多样性 | 每名用户每 30 天不同对手数 ÷ 对手交手总数 | ≥ 60% |
| 再战转化率（P1） | 点击“一键再战”后 14 天内与原对手完成比赛的用户占比 | 观察 |

### 9.4 竞技质量

| 指标 | 公式 | 目标 |
| --- | --- | --- |
| 势均力敌比赛占比 | 赛前预计胜率 35%–65% 的排位赛数 ÷ 全部排位赛数 | ≥ 70% |
| 团队平衡合格率 | 锁定时两队平均 Rating 差 ≤ 100 的团队排位赛占比 | 100% |
| 定位完成率 | 开始定位赛后 30 天内完成 5 场的用户占比 | ≥ 60% |
| 有效爆冷率 | 低预期胜率一方正常获胜的排位赛占比 | 仅观察 |
| 榜单活跃度 | Top 20 中 30 天内至少完成 1 场排位赛的用户占比 | ≥ 80% |

### 9.5 公平与安全护栏

| 指标 | 公式 | 目标 |
| --- | --- | --- |
| 爽约率 | 确认爽约人次 ÷ 已锁定参赛人次 | < 5% |
| 结果异议率 | 存在参赛者异议的结果数 ÷ 已提交结果数 | < 5% |
| 审核驳回率 | 被场主或管理员驳回的结果数 ÷ 已提交结果数 | < 8% |
| 管理员升级率 | 冲突或超时转管理员的结果数 ÷ 已提交结果数 | < 10% |
| 重复阵容占比 | 触发 7 天衰减规则的竞赛数 ÷ 全部已结算竞赛数 | < 15% |
| 异常结算率 | 被风控拦截或人工撤销的结算数 ÷ 全部结算数 | < 3% |
| 竞赛预订取消增量 | 竞赛预订取消率 − 普通预订取消率 | ≤ 5 pp |

### 9.6 时效与体验

| 指标 | 公式 | 目标 |
| --- | --- | --- |
| 平均成局时间 | 创建竞赛至阵容完整的中位时长 | 观察 P50 / P90 |
| 结果提交时长 | 比赛结束至首次提交结果的中位时长 | < 24h |
| 结果审核时长 | 进入可审核状态至最终审核的中位时长 / P90 | < 24h / < 72h |
| 经验到账时延 | 审核通过至流水和榜单可见 P95 | < 5s |
| 榜单查询性能 | Top 20 接口 P95 / 缓存命中 P95 | < 600ms / < 200ms |

### 9.7 指标实现

- 优先从竞赛、参与者、结果和流水表直接聚合；行为事件仅用于按钮点击、页面曝光和再战漏斗，禁止记录 PII。
- 全部指标按运动、比赛类型、赛季、新老用户和 `1v1 / 团队赛` 分组；样本不足 20 时不展示百分比结论。
- 以 Asia/Shanghai 划分自然日 / 周 / 赛季；留存 Day 0 = 首次审核通过比赛日。
- 上线前保存普通预订用户的 D7 / D30 基线；上线后按注册月份和运动类型做同期对照。
- 目标值作为首赛季初始阈值；满 2 周后校准漏斗目标，满 1 个 12 周赛季后形成正式基线；口径变化须记录版本与生效日期。
- 管理员看板展示北极星、漏斗、留存、竞技质量与风险护栏。

## 10. 测试计划

- 单元 / 迁移测试：等级 / 竞技分边界、定位赛、赛季重置、团队平均分、衰减公式、`score_payload` zod 校验。
- 集成测试：申请并发、满员、名单锁定、爽约、作废、异议、利益冲突、管理员升级。
- 安全 / RLS：匿名访问仅命中 `leaderboard_view`；`experience_ledger` 不可由前端 INSERT / UPDATE。
- 事务：审核通过 → XP / 竞技分 / 状态变更在同一事务；`idempotency_key` 重复提交返回 0 增量。
- UI：首页 Top 20、详情页竞赛标识、申请加入、结果提交 / 回应、审核、徽章展示。
- i18n：zh-CN / en-US 文案完整；新 key 在 PR 校验脚本中通过。
- 指标：使用固定种子数据可复算，分子分母在作废、取消和重复结算下保持一致。

## 11. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 头部用户抱团刷榜 | 7 天衰减 + 对手多样性指标 |
| 定位赛拖延 | 第 5 场后强制入榜，定位中显示在个人档案 |
| 团队抱大腿 | 团队排位自动平衡 + 100 分差上限 |
| 场主偏袒熟人 | 冲突自动转管理员 + 管理员看板 |
| 弃权泛滥 | 弃权 = 0 XP + 0 竞技分；场主标记爽约触发处罚 |
| 异常风控漏判 | 30 天管理员人工撤销窗口 + 审计日志 |
| PRD / feature.md 漂移 | 编码前同步更新 PRD §4 / §5；feature 状态改为“已采纳” |

## 12. 假设与默认值

- 每项运动独立成长与竞技；`user / owner / admin` 角色变化不影响数据。
- 不接支付、不接聊天、不做战队联赛；首版完成后评估是否扩展。
- 永久 XP、赛季竞技分、友谊 / 排位分流、5 场定位、12 周赛季、数字徽章奖励。
- 站内通知而非邮件；避免增加新模板和触发点。
- RLS 严格收敛写操作；`service_role` 仅出现在 Edge Function / migrations。

## 13. 待办

- [ ] 与 PRD §2.2 / §4 对齐后，将正式 US 编号与里程碑写入 `PRD.md`。
- [ ] 决定 `OQ-x` 开放问题：排行榜缓存层、Edge Function 选型（单函数 vs 多函数）、赛季时间窗起点（周一 00:00 vs 每月 1 号）。
- [ ] 设计 `feature.md` 配套 UI 线框与 i18n 文案表。
- [ ] 与 `AGENTS.md` 同步：新增业务表 RLS、价格 / 支付相关规则保持原状。
