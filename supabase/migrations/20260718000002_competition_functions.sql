-- venue-booking v2 · migration 00007 · 竞赛 SQL functions + leaderboard view
-- 对应 feature §5 / §6 / §7，所有写操作均通过 service_role 或本文件中的 security definer 函数
-- 依赖：00006 schema、00002 functions（is_admin / is_owner_of_venue）

set search_path = public;

-- =====================================================================
-- 1. apply_match_settlement(p_competition_id)
--   在单一事务内：
--     a) 校验结果 approved + 未被结算过
--     b) 计算每个参赛者的 XP / Rating 变化（按 ADR-0001 / ADR-0002 公式）
--     c) 写 experience_ledger（idempotency_key = competition_id:user_id）
--     d) 更新 user_sport_progress.xp / level / rating / placement_done
--     e) 标记 competitions.status = 'approved'，写入 reviewed_by / reviewed_at
--   仅 service_role 可调用；RLS 不允许前端直写进度表
-- =====================================================================
create or replace function public.apply_match_settlement(p_competition_id uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $fn$
declare
  v_comp            public.competitions%rowtype;
  v_result          public.competition_results%rowtype;
  v_winner          text;
  v_kind            text;
  v_decay_xp        numeric := 1.0;
  v_decay_r         numeric := 1.0;
  v_repeat_count    integer;
  v_avg_level_a     int  := 1;
  v_avg_rating_a    int  := 1000;
  v_avg_level_b     int  := 1;
  v_avg_rating_b    int  := 1000;
  v_user            record;
  v_pre_xp          int;
  v_pre_level       int;
  v_pre_rating      int;
  v_pre_placement   int;
  v_post_xp         int;
  v_post_level      int;
  v_post_rating     int;
  v_xp_delta        int := 0;
  v_rating_delta    int := 0;
  v_diff            int;
  v_xp_win          int;
  v_idem            text;
  v_k               int;
  v_exp             numeric;
  v_score           numeric;
  v_delta           numeric;
  v_inserted        jsonb := '[]'::jsonb;
begin
  select * into v_comp from public.competitions
   where id = p_competition_id for update;
  if not found then raise exception 'competition_not_found'; end if;
  if v_comp.status not in ('pending_review','awaiting_result') then
    raise exception 'invalid_state:%', v_comp.status;
  end if;

  select * into v_result from public.competition_results
   where competition_id = p_competition_id;
  if not found then raise exception 'result_missing'; end if;
  if v_result.status <> 'approved' then
    raise exception 'result_not_approved:%', v_result.status;
  end if;

  v_winner := v_result.winner_team;
  v_kind   := v_comp.kind;

  -- ADR-0002: 同一完整对阵 7 天衰减
  if v_comp.participant_set_hash is null then
    raise exception 'roster_not_locked';
  end if;
  select count(*) into v_repeat_count
    from public.competitions
   where participant_set_hash = v_comp.participant_set_hash
     and status = 'approved'
     and id <> v_comp.id
     and ends_at >= now() - interval '7 days';
  v_repeat_count := v_repeat_count + 1;
  if v_repeat_count = 3 then
    v_decay_xp := 0.5;
    v_decay_r  := 0.5;
  elsif v_repeat_count >= 4 then
    v_decay_xp := 0.2;
    v_decay_r  := 0.0;
  end if;

  -- 双方参赛者平均等级 / Rating
  select coalesce(round(avg(pre_match_level))::int, 1),
         coalesce(round(avg(pre_match_rating))::int, 1000)
    into v_avg_level_a, v_avg_rating_a
  from public.competition_participants
  where competition_id = p_competition_id
    and team = 'A' and status in ('accepted','played');
  select coalesce(round(avg(pre_match_level))::int, 1),
         coalesce(round(avg(pre_match_rating))::int, 1000)
    into v_avg_level_b, v_avg_rating_b
  from public.competition_participants
  where competition_id = p_competition_id
    and team = 'B' and status in ('accepted','played');

  for v_user in
    select cp.user_id, cp.team, cp.pre_match_level, cp.pre_match_rating, cp.pre_match_xp,
           cp.status as cp_status
      from public.competition_participants cp
     where cp.competition_id = p_competition_id
       and cp.status in ('accepted','played')
     order by cp.team, cp.user_id
  loop
    -- 初始化进度行
    insert into public.user_sport_progress(user_id, sport_type)
      values (v_user.user_id, v_comp.sport_type)
      on conflict (user_id, sport_type) do nothing;

    select xp, level, rating, placement_done
      into v_pre_xp, v_pre_level, v_pre_rating, v_pre_placement
      from public.user_sport_progress
     where user_id = v_user.user_id and sport_type = v_comp.sport_type;

    -- 选定对手聚合
    if v_user.team = 'A' then
      v_diff := v_avg_level_b - v_pre_level;
    else
      v_diff := v_avg_level_a - v_pre_level;
    end if;

    -- 经验档位
    if v_diff <= -5 then v_xp_win := 20;
    elsif v_diff <= -3 then v_xp_win := 30;
    elsif v_diff <= -1 then v_xp_win := 40;
    elsif v_diff = 0  then v_xp_win := 50;
    elsif v_diff = 1  then v_xp_win := 60;
    elsif v_diff = 2  then v_xp_win := 70;
    elsif v_diff = 3  then v_xp_win := 80;
    elsif v_diff = 4  then v_xp_win := 90;
    else v_xp_win := 100;
    end if;

    if v_winner = 'draw' then
      v_xp_delta := 20;
      v_rating_delta := 0;
    elsif v_winner = v_user.team then
      v_xp_delta := v_xp_win;
      v_rating_delta := 0;
    else
      v_xp_delta := 10;
      v_rating_delta := 0;
    end if;

    if v_kind = 'friendly' then
      v_xp_delta := round(v_xp_delta * 0.5)::int;
      v_rating_delta := 0;
    end if;

    v_xp_delta := round(v_xp_delta * v_decay_xp)::int;

    -- Elo 仅排位赛
    if v_kind = 'ranked' and v_winner is not null then
      if v_user.team = 'A' then
        v_exp := 1.0 / (1.0 + power(10, (v_avg_rating_b - v_pre_rating) / 400.0));
      else
        v_exp := 1.0 / (1.0 + power(10, (v_avg_rating_a - v_pre_rating) / 400.0));
      end if;
      if v_winner = 'draw' then
        v_score := 0.5;
      elsif v_winner = v_user.team then
        v_score := 1.0;
      else
        v_score := 0.0;
      end if;
      if v_pre_placement < 5 then v_k := 60;
      elsif v_pre_rating < 1500 then v_k := 40;
      elsif v_pre_rating < 2100 then v_k := 25;
      else v_k := 15;
      end if;
      v_delta := v_k * (v_score - v_exp);
      v_rating_delta := v_rating_delta + round(v_delta)::int;
    end if;

    v_rating_delta := round(v_rating_delta * v_decay_r)::int;

    -- 软约束
    v_post_rating := greatest(0, least(4000, v_pre_rating + v_rating_delta));
    v_rating_delta := v_post_rating - v_pre_rating;
    v_post_xp := v_pre_xp + v_xp_delta;
    v_post_level := greatest(1, floor((1 + sqrt(1 + v_post_xp::numeric / 25.0)) / 2)::int);

    v_idem := v_comp.id::text || ':' || v_user.user_id::text || ':match';
    insert into public.experience_ledger(
      user_id, sport_type, competition_id, idempotency_key,
      xp_delta, rating_delta,
      pre_level, post_level, pre_rating, post_rating, pre_xp, post_xp,
      reason, metadata
    ) values (
      v_user.user_id, v_comp.sport_type, v_comp.id, v_idem,
      v_xp_delta, v_rating_delta,
      v_pre_level, v_post_level, v_pre_rating, v_post_rating, v_pre_xp, v_post_xp,
      case when v_winner = 'draw' then 'match_draw'::text
           when v_winner = v_user.team then 'match_win'::text
           else 'match_loss'::text end,
      jsonb_build_object('decay_factor_xp', v_decay_xp, 'decay_factor_rating', v_decay_r, 'repeat_count', v_repeat_count)
    ) on conflict (idempotency_key) do nothing;

    update public.user_sport_progress
       set xp = v_post_xp,
           level = v_post_level,
           rating = v_post_rating,
           peak_rating = greatest(peak_rating, v_post_rating),
           placement_done = case when v_kind = 'ranked' then least(10, placement_done + 1) else placement_done end,
           last_match_at = now(),
           updated_at = now()
     where user_id = v_user.user_id and sport_type = v_comp.sport_type;

    update public.competition_participants
       set status = 'played'
     where competition_id = v_comp.id and user_id = v_user.user_id;

    v_inserted := v_inserted || jsonb_build_object(
      'user_id', v_user.user_id,
      'team', v_user.team,
      'xp_delta', v_xp_delta,
      'rating_delta', v_rating_delta,
      'pre_rating', v_pre_rating,
      'post_rating', v_post_rating
    );
  end loop;

  update public.competitions
     set status = 'approved',
         reviewed_by = coalesce(reviewed_by, auth.uid()),
         reviewed_at = coalesce(reviewed_at, now())
   where id = v_comp.id;

  return jsonb_build_object('competition_id', v_comp.id, 'settlements', v_inserted);
end;
$fn$;
comment on function public.apply_match_settlement(uuid) is '事务结算 XP / Rating 并写流水（ADR-0001 / ADR-0002）';


-- =====================================================================
-- 2. lock_due_competitions()  -- pg_cron 每 1 分钟跑一次
-- =====================================================================
create or replace function public.lock_due_competitions()
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $fn$
declare
  v_count integer := 0;
  v_comp record;
  v_team_a int;
  v_team_b int;
  v_hash text;
  v_sorted text;
begin
  for v_comp in
    select * from public.competitions
     where status = 'recruiting'
       and starts_at <= now() + interval '30 minutes'
     for update skip locked
  loop
    select count(*) into v_team_a from public.competition_participants
     where competition_id = v_comp.id and team = 'A' and status = 'accepted';
    select count(*) into v_team_b from public.competition_participants
     where competition_id = v_comp.id and team = 'B' and status = 'accepted';
    if v_team_a >= v_comp.team_size and v_team_b >= v_comp.team_size then
      select string_agg(u::text, ',' order by u)
        into v_sorted
      from (
        select user_id::text as u
        from public.competition_participants
        where competition_id = v_comp.id and status = 'accepted' and team = 'A'
        union all
        select user_id::text
        from public.competition_participants
        where competition_id = v_comp.id and status = 'accepted' and team = 'B'
      ) s;
      v_hash := v_comp.sport_type || ':' || v_sorted;
      update public.competitions
         set status = 'locked',
             participant_set_hash = v_hash,
             locked_at = now()
       where id = v_comp.id;
      v_count := v_count + 1;
    else
      update public.competitions
         set status = 'voided'
       where id = v_comp.id;
    end if;
  end loop;
  return v_count;
end;
$fn$;
comment on function public.lock_due_competitions() is 'pg_cron 每分钟跑；距开场 ≤ 30min 仍未满员的竞赛置 voided，否则锁定并写入 participant_set_hash';

-- =====================================================================
-- 3. expire_pending_results()  -- 提交后 24h 未确认的视为无异议；7 天后关闭结算
-- =====================================================================
create or replace function public.expire_pending_results()
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $fn$
declare
  v_count integer := 0;
  v_res record;
begin
  -- 24h 未回应：awaiting_responses -> pending_review
  for v_res in
    select id, competition_id from public.competition_results
     where status = 'awaiting_responses'
       and expires_at <= now()
     for update skip locked
  loop
    update public.competition_results set status = 'pending_review' where id = v_res.id;
    update public.competitions
       set status = 'pending_review'
     where id = v_res.competition_id
       and status in ('awaiting_result','locked');
    v_count := v_count + 1;
  end loop;

  -- 比赛结束 7 天且还在 awaiting_result / pending_review：作废
  update public.competitions c
     set status = 'voided'
   from public.competition_results r
   where r.competition_id = c.id
     and c.status in ('awaiting_result','pending_review','locked')
     and c.submit_deadline_at < now()
     and r.status in ('awaiting_responses','pending_review','rejected');

  return v_count;
end;
$fn$;
comment on function public.expire_pending_results() is 'pg_cron 每 5 分钟；24h 转审 + 7 天关闭';

-- =====================================================================
-- 4. escalate_stale_reviews()  -- 场主 72h 未处理升级
-- =====================================================================
create or replace function public.escalate_stale_reviews()
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $fn$
declare
  v_count integer := 0;
  v_c record;
begin
  for v_c in
    select c.id, c.venue_id, c.review_escalated_to
    from public.competitions c
    where c.status = 'pending_review'
      and c.review_escalated_to is null
      and c.reviewed_at is null
      and exists (
        select 1 from public.competition_results r
        where r.competition_id = c.id and r.status = 'pending_review'
      )
      and c.ends_at + interval '72 hours' < now()
    for update skip locked
  loop
    update public.competitions
       set review_escalated_at = now(),
           review_escalated_to = (
             select id from public.profiles where role = 'admin' limit 1
           ),
           escalation_reason = 'owner_timeout_72h'
     where id = v_c.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$fn$;
comment on function public.escalate_stale_reviews() is 'pg_cron 每 10 分钟；场主 72h 未审升级到 admin';

-- =====================================================================
-- 5. resolve_season(p_season_id)  -- 软重置竞技分 + 结算段位
-- =====================================================================
create or replace function public.resolve_season(p_season_id uuid)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $fn$
declare
  v_count integer := 0;
  v_s public.competition_seasons%rowtype;
  v_p record;
  v_new_rating int;
  v_award jsonb;
begin
  select * into v_s from public.competition_seasons where id = p_season_id for update;
  if not found then
    raise exception 'season_not_found';
  end if;
  if v_s.status <> 'active' then
    raise exception 'season_not_active';
  end if;
  for v_p in
    select user_id, sport_type, rating, peak_rating
    from public.user_sport_progress
    for update
  loop
    v_new_rating := round(1000 + 0.75 * (v_p.rating - 1000))::int;
    update public.user_sport_progress
       set rating = v_new_rating,
           updated_at = now()
     where user_id = v_p.user_id and sport_type = v_p.sport_type;
    v_count := v_count + 1;
  end loop;
  update public.competition_seasons
     set status = 'settled'
   where id = v_s.id;
  return v_count;
end;
$fn$;
comment on function public.resolve_season(uuid) is '赛季结算：1000 + 0.75*(R-1000) 软重置';

-- =====================================================================
-- 6. flag_no_show(p_competition_id, p_user_id, p_evidence)  -- 场主标记爽约
-- =====================================================================
create or replace function public.flag_no_show(p_competition_id uuid, p_user_id uuid, p_evidence text)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $fn$
declare
  v_actor uuid := auth.uid();
  v_venue_id uuid;
  v_count_30d int;
begin
  select venue_id into v_venue_id from public.competitions where id = p_competition_id;
  if v_venue_id is null then raise exception 'competition_not_found'; end if;
  if not (public.is_owner_of_venue(v_venue_id) or public.is_admin()) then
    raise exception 'forbidden';
  end if;

  insert into public.competition_no_shows(competition_id, user_id, flagged_by, evidence)
    values (p_competition_id, p_user_id, v_actor, p_evidence)
    on conflict do nothing;

  update public.competition_participants
     set status = 'no_show', no_show_flagged_at = now()
   where competition_id = p_competition_id and user_id = p_user_id;

  select count(*) into v_count_30d
    from public.competition_no_shows
   where user_id = p_user_id and flagged_at >= now() - interval '30 days';

  if v_count_30d >= 2 then
    update public.user_sport_progress
       set no_show_30d = v_count_30d,
           ranked_locked_until = now() + interval '7 days',
           updated_at = now()
     where user_id = p_user_id;
  else
    update public.user_sport_progress
       set no_show_30d = v_count_30d,
           updated_at = now()
     where user_id = p_user_id;
  end if;
end;
$fn$;
comment on function public.flag_no_show(uuid, uuid, text) is '场主 / 管理员标记爽约；累计 2 次 → 排位暂停 7 天（ADR-0002）';

-- =====================================================================
-- 7. leaderboard_top(sport, kind, limit) -- 公开 Top 20；服务端函数，不依赖视图权限
-- =====================================================================
create or replace function public.leaderboard_top(p_sport text, p_kind text, p_limit int default 20)
  returns table(
    rank int, user_id uuid, nickname text, avatar_url text,
    level int, xp int, rating int, peak_rating int,
    wins int, draws int, losses int, played int, tier text, last_match_at timestamptz
  )
  language sql
  security definer
  set search_path = public
  stable
as $fn$
  with agg as (
    select
      el.user_id,
      sum(case when el.reason = 'match_win' then 1 else 0 end) as wins,
      sum(case when el.reason = 'match_draw' then 1 else 0 end) as draws,
      sum(case when el.reason = 'match_loss' then 1 else 0 end) as losses,
      count(*) filter (where el.reason in ('match_win','match_draw','match_loss')) as played,
      max(el.created_at) as last_match_at
    from public.experience_ledger el
    join public.competitions c on c.id = el.competition_id
    where c.sport_type = p_sport
      and c.status = 'approved'
      and c.kind = p_kind
    group by el.user_id
  )
  select
    row_number() over (
      order by
        case when p_kind = 'ranked' then usp.rating end desc nulls last,
        case when p_kind = 'ranked' then usp.rating end desc nulls last,
        usp.xp desc nulls last,
        a.wins desc,
        a.played asc,
        p.id asc
    )::int as rank,
    p.id as user_id,
    p.nickname,
    p.avatar_url,
    usp.level,
    usp.xp,
    usp.rating,
    usp.peak_rating,
    coalesce(a.wins, 0)::int,
    coalesce(a.draws, 0)::int,
    coalesce(a.losses, 0)::int,
    coalesce(a.played, 0)::int,
    case
      when usp.rating >= 2000 then 'diamond'
      when usp.rating >= 1700 then 'platinum'
      when usp.rating >= 1400 then 'gold'
      when usp.rating >= 1100 then 'silver'
      else 'bronze'
    end as tier,
    a.last_match_at
  from public.profiles p
  join public.user_sport_progress usp on usp.user_id = p.id
  left join agg a on a.user_id = p.id
  where usp.sport_type = p_sport
    and usp.placement_done >= 5  -- 定位赛完成才入榜
    and (a.played is null or a.played > 0)
  order by
    case when p_kind = 'ranked' then usp.rating end desc nulls last,
    usp.xp desc nulls last,
    a.wins desc,
    a.played asc,
    p.id asc
  limit greatest(1, least(p_limit, 100));
$fn$;
comment on function public.leaderboard_top(text, text, int) is '竞技榜（ranked 按 rating desc）/ 成长榜（friendly 或 fallback 按 xp desc）；默认 20，限 ≤100';

-- =====================================================================
-- 8. is_ranked_locked(p_user_id, p_sport_type)  -- 客户端按钮可用性
-- =====================================================================
create or replace function public.is_ranked_locked(p_user_id uuid, p_sport_type text)
  returns boolean
  language sql
  security definer
  set search_path = public
  stable
as $fn$
  select coalesce((
    select ranked_locked_until > now()
    from public.user_sport_progress
    where user_id = p_user_id and sport_type = p_sport_type
  ), false);
$fn$;
comment on function public.is_ranked_locked(uuid, text) is '排位暂停中（爽约 2 次）；客户端用按钮 disabled';

-- =====================================================================
-- 9. predict_outcome(p_user_a, p_user_b, p_sport)  -- 报名页预计胜率
-- =====================================================================
create or replace function public.predict_outcome(p_user_a uuid, p_user_b uuid, p_sport text)
  returns numeric
  language sql
  security definer
  set search_path = public
  stable
as $fn$
  with a as (
    select coalesce(usp.rating, 1000) as rating
    from public.user_sport_progress usp
    where usp.user_id = p_user_a and usp.sport_type = p_sport
  ), b as (
    select coalesce(usp.rating, 1000) as rating
    from public.user_sport_progress usp
    where usp.user_id = p_user_b and usp.sport_type = p_sport
  )
  select round(
    (1.0 / (1.0 + power(10, ((b.rating - a.rating) / 400.0))))::numeric,
    4
  )
  from a, b;
$fn$;
comment on function public.predict_outcome(uuid, uuid, text) is '报名页预计胜率（Elo）；0~1';

