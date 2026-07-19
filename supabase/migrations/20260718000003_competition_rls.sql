-- venue-booking v2 · migration 00008 · 竞赛 RLS + leaderboard_view + audit hook
-- 对应 feature §7；依赖 00006 schema、00007 functions、00003 RLS

-- =====================================================================
-- 1. enable RLS on new tables
-- =====================================================================
alter table public.competition_seasons       enable row level security;
alter table public.user_sport_progress       enable row level security;
alter table public.competitions              enable row level security;
alter table public.competition_participants  enable row level security;
alter table public.competition_results       enable row level security;
alter table public.competition_result_responses enable row level security;
alter table public.experience_ledger         enable row level security;
alter table public.competition_no_shows      enable row level security;

-- =====================================================================
-- 2. competition_seasons  -- 公开
-- =====================================================================
create policy "competition_seasons_select_public"
  on public.competition_seasons for select using (true);

-- =====================================================================
-- 3. user_sport_progress  -- 公开只读（昵称 / 等级 / rating / 段位 / 胜场等）
--    UPDATE 仅 service_role（由 service_role / settlement function 触发）
-- =====================================================================
create policy "user_sport_progress_select_public"
  on public.user_sport_progress for select using (true);

-- =====================================================================
-- 4. competitions
--   SELECT：公开 / 参赛者 / 场馆 owner / admin
--   INSERT：service_role（仅 Edge Function）
--   UPDATE：service_role
--   DELETE：禁
-- =====================================================================
create policy "competitions_select_visible"
  on public.competitions for select using (
    status in ('recruiting','locked','awaiting_result','pending_review','approved','rejected','voided','cancelled')
    or public.is_admin()
  );

-- 创建者本人可看自己 cancelled / voided 等
create policy "competitions_select_creator"
  on public.competitions for select using (creator_id = auth.uid());

-- 场馆 owner 可看自己场馆的竞赛
create policy "competitions_select_owner"
  on public.competitions for select using (public.is_owner_of_venue(venue_id));

-- 参赛者可看
create policy "competitions_select_participant"
  on public.competitions for select using (
    exists (
      select 1 from public.competition_participants cp
      where cp.competition_id = competitions.id and cp.user_id = auth.uid()
    )
  );

-- =====================================================================
-- 5. competition_participants
-- =====================================================================
create policy "competition_participants_select_public"
  on public.competition_participants for select using (true);
create policy "competition_participants_select_self"
  on public.competition_participants for select using (user_id = auth.uid());

-- =====================================================================
-- 6. competition_results
--   SELECT：参赛者 + 场馆 owner + admin
-- =====================================================================
create policy "competition_results_select_participant"
  on public.competition_results for select using (
    exists (
      select 1 from public.competition_participants cp
      where cp.competition_id = competition_results.competition_id and cp.user_id = auth.uid()
    )
  );
create policy "competition_results_select_owner"
  on public.competition_results for select using (
    exists (
      select 1 from public.competitions c
      where c.id = competition_results.competition_id and public.is_owner_of_venue(c.venue_id)
    )
  );
create policy "competition_results_select_admin"
  on public.competition_results for select using (public.is_admin());

-- =====================================================================
-- 7. competition_result_responses
-- =====================================================================
create policy "competition_result_responses_select_self"
  on public.competition_result_responses for select using (
    exists (
      select 1 from public.competition_participants cp
      where cp.id = competition_result_responses.participant_id and cp.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- =====================================================================
-- 8. experience_ledger
--   SELECT：本人 + admin；其他全部由 service_role 写入
-- =====================================================================
create policy "experience_ledger_select_self"
  on public.experience_ledger for select using (user_id = auth.uid() or public.is_admin());

-- =====================================================================
-- 9. competition_no_shows
-- =====================================================================
create policy "competition_no_shows_select_self"
  on public.competition_no_shows for select using (user_id = auth.uid() or public.is_admin());

-- =====================================================================
-- 10. leaderboard_view  -- 公开视图，仅暴露排行榜必要字段（避免 PII 泄漏）
-- =====================================================================
create or replace view public.leaderboard_view
  with (security_invoker = true) as
select
  row_number() over (
    order by usp.rating desc, usp.xp desc, p.id
  )::int as rank,
  p.id as user_id,
  p.nickname,
  p.avatar_url,
  usp.sport_type,
  usp.level,
  usp.xp,
  usp.rating,
  usp.peak_rating,
  usp.placement_done,
  case
    when usp.rating >= 2000 then 'diamond'
    when usp.rating >= 1700 then 'platinum'
    when usp.rating >= 1400 then 'gold'
    when usp.rating >= 1100 then 'silver'
    else 'bronze'
  end as tier,
  usp.last_match_at
from public.profiles p
join public.user_sport_progress usp on usp.user_id = p.id
where usp.placement_done >= 5;

comment on view public.leaderboard_view is '公开排行榜视图；仅显示定位赛完成的进度行，禁止邮箱 / 手机号';

-- =====================================================================
-- 11. competition_metrics  -- 管理员看板指标 SQL 视图（feature §9）
--   优先用 SQL 聚合；前端只读不写
-- =====================================================================
create or replace view public.competition_metrics_daily
  with (security_invoker = false) as
select
  date_trunc('day', c.created_at) as day,
  c.sport_type,
  c.kind,
  count(*) filter (where c.status = 'approved') as approved_count,
  count(*) filter (where c.status = 'voided') as voided_count,
  count(*) filter (where c.status = 'recruiting') as recruiting_count,
  count(*) filter (where c.status = 'pending_review') as pending_review_count
from public.competitions c
group by 1, 2, 3;
comment on view public.competition_metrics_daily is '管理员看板：按日 / 运动 / 类型聚合竞赛状态；service_role 可写，admin 可读';

-- =====================================================================
-- 12. updated_at trigger for new tables
-- =====================================================================
create or replace function public.tg_usp_set_updated_at()
  returns trigger
  language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;
drop trigger if exists trg_usp_set_updated_at on public.user_sport_progress;
create trigger trg_usp_set_updated_at
  before update on public.user_sport_progress
  for each row execute function public.tg_usp_set_updated_at();

