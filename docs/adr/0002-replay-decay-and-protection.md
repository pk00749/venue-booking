# 0002. 反刷分衰减与参赛保护规则

- 状态：已采纳
- 日期：2026-07-18
- 关联：feature.md §4.2 / §4.5，PRD §4.6 US-510 / US-515

## 背景

等级与排行榜一旦上线，会立刻被两类行为钻空子：

1. **同对手反复比赛**：固定两个账号每天互刷 5 场，7 天就能把 XP 推到 2 级以上。
2. **团队抱大腿 / 弱队刷分**：排位团队赛里把高 Rating 用户集中到一队反复屠戮弱队，Rating 增长异常。
3. **场主偏袒熟人**：场主作为审核人可以随意通过，结果与利益直接挂钩。
4. **爽约无人治**：发起人占场但参赛者不来，Booking 仍按 `completed` 结算，浪费场地。

需要一组与结算系统强绑定的护栏，使作弊成本高于收益。

## 决策

1. **同一完整对阵阵容 7 天衰减**：
   - 取锁定时的 `competitions.participant_set_hash` 作为对阵指纹；
   - 同一对指纹 7 天内累计第 3 场：XP × 0.5，Rating × 0.5；
   - 第 ≥ 4 场：XP × 0.2，Rating 0 变化（仍给 XP 鼓励参与）；
   - 换人视为新阵容，必须重新计算（指纹不同不衰减）。

2. **结果审核利益冲突自动升级**：
   - 若 `venues.owner_id = auth.uid()` 且 `auth.uid()` 在参赛名单中、或 `competitions.creator_id = auth.uid()`，直接进入 `pending_review` 时跳过场主，转入管理员队列；
   - 场主 72 小时未处理由 pg_cron 升级；
   - 审核动作写入 `audit_logs`，不可篡改。

3. **爽约治理**：
   - 场主 / 任何参赛者审核结果时标记爽约（被爽约方在 24h 内提交证据）；
   - `user_sport_progress.no_show_30d` 在 30 天滚动窗口累加；
   - 累计 2 次爽约 → 暂停排位 7 天（仅禁排位，友谊赛不受影响）。

4. **参赛端风控**：
   - 服务端在 `applyToCompetition` 时校验申请人是否处于“对手冷却名单”（过去 7 天与该阵容指纹已有结算）；
   - 锁定阶段计算 `participant_set_hash` 时按 `team_a_id + team_b_id + sport_type` 排序拼接，避免换队绕开；
   - 团队排位赛锁定后由服务端按 Rating 自动平衡两队，允许发起人手动调整，调整后两队平均 Rating 差必须 ≤100。

5. **结算幂等**：
   - 任何 XP / Rating 变更必须走 `apply_match_settlement(p_competition_id)` SQL 函数；
   - 该函数在同一事务内：写入 `experience_ledger`（唯一约束 `idempotency_key`），更新 `user_sport_progress`，将 `competition_results.status = 'approved'`；
   - 重复调用只会得到“已结算”，不会重复发 XP。

6. **赛季软重置**：
   - 12 周赛季结束由 pg_cron 调用 `season_reset(season_id)`；
   - 仅调整 `user_sport_progress.rating`，`xp` / `level` 不变；
   - 段位徽章写入 `competition_seasons.awards`。

## 后果

- 衰减与审核升级均需要 SQL 触发器 / Edge Function 协同，所有写入链路必须经过审核与流水双通道。
- 团队排位赛分队 UI 需要展示自动平衡建议与 100 分差上限警告。
- 管理员看板需要新增「竞赛冲突与异常」tab 处理升级与人工撤销。
- 任何用户对 7 天衰减的反馈必须能解释清楚（指纹、累计场次、衰减系数），故服务端返回值需带 `decay_factor`。

## 备选

- 每日仅一场：保护过强，误伤固定搭档常客。
- 仅靠人工举报：早期量小时可以，长期运营成本高。
- 衰减 + 升级 + 软重置：被采纳。

