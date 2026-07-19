-- venue-booking v2 · migration 00006 · 竞赛 + 等级 + 排行榜 schema
-- 对应 PRD §4.6 US-501..US-516 + feature.md §5 / §6
-- 依赖：00001 schema、00002 functions（is_admin / is_owner_of_venue）、00003 RLS、00004/00005 booking_slots
-- AGENTS §6 表名复数下划线 / 时间 UTC timestamptz / 钱分 cents（这里 xp / rating 用 integer）

-- =====================================================================
-- 1. competition_seasons  -- 12 周滚动赛季
-- =====================================================================
create table if not exists public.competition_seasons (
  id            uuid primary key default gen_random_uuid(),
  number        integer unique not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        text not null default 'active' check (status in ('upcoming','active','settled')),
  reset_formula text not null default '1000 + 0.75 * (R - 1000)',
  awards        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists idx_competition_seasons_active
  on public.competition_seasons(status, starts_at desc);
comment on table public.competition_seasons is '赛季（PRD US-511）；12 周滚动；记录段位徽章与重置公式';

-- =====================================================================
-- 2. user_sport_progress  -- 单项运动进度
-- =====================================================================
create table if not exists public.user_sport_progress (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  sport_type     text not null check (sport_type in
                    ('squash','badminton','basketball','football','tennis','table_tennis','volleyball','other')),
  xp             integer not null default 0 check (xp >= 0),
  level          integer not null default 1 check (level >= 1),
  rating         integer not null default 1000 check (rating between 0 and 4000),
  peak_rating    integer not null default 1000 check (peak_rating >= 0),
  placement_done integer not null default 0 check (placement_done between 0 and 10),
  no_show_30d    integer not null default 0 check (no_show_30d >= 0),
  ranked_locked_until timestamptz,
  last_match_at  timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (user_id, sport_type)
);
create index if not exists idx_usp_rating
  on public.user_sport_progress(sport_type, rating desc, user_id);
create index if not exists idx_usp_xp
  on public.user_sport_progress(sport_type, xp desc, user_id);
comment on table public.user_sport_progress is '用户单项运动进度（feature §4）；xp / level 只增不减，rating 可升降，前端 RLS 禁止直接改写';

-- =====================================================================
-- 3. competitions  -- 单 slot 单竞赛
-- =====================================================================
create table if not exists public.competitions (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references public.bookings(id) on delete restrict,
  slot_id             uuid not null references public.slots(id) on delete restrict,
  court_id            uuid not null references public.courts(id) on delete restrict,
  venue_id            uuid not null references public.venues(id) on delete restrict,
  sport_type          text not null check (sport_type in
                        ('squash','badminton','basketball','football','tennis','table_tennis','volleyball','other')),
  creator_id          uuid not null references public.profiles(id) on delete restrict,
  kind                text not null check (kind in ('friendly','ranked')),
  mode                text not null check (mode in ('singles','teams')),
  team_size           integer not null default 1 check (team_size between 1 and 10),
  visibility          text not null default 'public' check (visibility in ('public','private')),
  status              text not null default 'recruiting' check (status in
                        ('recruiting','locked','awaiting_result','pending_review','approved','rejected','voided','cancelled')),
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  participant_set_hash text,
  locked_at           timestamptz,
  submit_deadline_at  timestamptz not null,
  reviewed_by         uuid references public.profiles(id),
  reviewed_at         timestamptz,
  review_escalated_to uuid references public.profiles(id),
  review_escalated_at timestamptz,
  escalation_reason   text,
  reject_reason       text,
  notes               text,
  created_at          timestamptz not null default now(),
  unique (slot_id),
  check (ends_at > starts_at),
  check (team_size >= 1 and team_size <= 10)
);
create index if not exists idx_competitions_venue_starts
  on public.competitions(venue_id, sport_type, starts_at desc);
create index if not exists idx_competitions_status_ends
  on public.competitions(status, ends_at);
create index if not exists idx_competitions_creator
  on public.competitions(creator_id, created_at desc);
create index if not exists idx_competitions_pending_review
  on public.competition_result_review_queue(competition_id) where status in ('pending_review','awaiting_result');
comment on table public.competitions is '竞赛（PRD US-501）；unique(slot_id) 保证一个 slot 最多一场竞赛';

-- =====================================================================
-- 4. competition_participants
-- =====================================================================
create table if not exists public.competition_participants (
  id                uuid primary key default gen_random_uuid(),
  competition_id    uuid not null references public.competitions(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete restrict,
  team              text check (team in ('A','B')),
  status            text not null default 'pending' check (status in
                      ('invited','pending','accepted','declined','rejected','withdrawn','no_show','played')),
  applied_at        timestamptz not null default now(),
  responded_at      timestamptz,
  pre_match_level   integer,
  pre_match_rating  integer,
  pre_match_xp      integer,
  no_show_flagged_at timestamptz,
  primary key (competition_id, user_id)
);
create index if not exists idx_cp_user_status
  on public.competition_participants(user_id, status);
create index if not exists idx_cp_competition_team
  on public.competition_participants(competition_id, team) where team is not null;
comment on table public.competition_participants is '竞赛参赛者；锁定时快照 pre_match_level / rating / xp，用于结算一致性与衰减识别';

-- =====================================================================
-- 5. competition_results  -- 结构化比分（仅一份 approved）
-- =====================================================================
create table if not exists public.competition_results (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid unique not null references public.competitions(id) on delete cascade,
  submitted_by   uuid not null references public.profiles(id),
  score_payload  jsonb not null,
  winner_team    text check (winner_team in ('A','B','draw')),
  notes          text,
  submitted_at   timestamptz not null default now(),
  expires_at     timestamptz not null,
  status         text not null default 'awaiting_responses' check (status in
                   ('awaiting_responses','pending_review','approved','rejected','voided')),
  created_at     timestamptz not null default now()
);
create index if not exists idx_results_status_expiry
  on public.competition_results(status, expires_at);
comment on table public.competition_results is '比赛结果（feature §5.3）；唯一约束保证一场比赛只有一个最终提交';

-- =====================================================================
-- 6. competition_result_responses  -- 参赛者确认 / 异议
-- =====================================================================
create table if not exists public.competition_result_responses (
  id              uuid primary key default gen_random_uuid(),
  result_id       uuid not null references public.competition_results.id) on delete cascade,
  participant_id  uuid not null references public.competition_participants(id) on delete cascade,
  response        text not null check (response in ('confirm','object')),
  reason          text,
  responded_at    timestamptz not null default now(),
  unique (result_id, participant_id)
);
comment on table public.competition_result_responses is '结果确认 / 异议（feature §3.3）';

-- =====================================================================
-- 7. experience_ledger  -- 不可变流水（幂等键）
-- =====================================================================
create table if not exists public.experience_ledger (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete restrict,
  sport_type      text not null check (sport_type in
                    ('squash','badminton','basketball','football','tennis','table_tennis','volleyball','other')),
  competition_id  uuid references public.competitions(id) on delete set null,
  idempotency_key text unique not null,
  xp_delta        integer not null default 0,
  rating_delta    integer not null default 0,
  pre_level       integer not null,
  post_level      integer not null,
  pre_rating      integer not null,
  post_rating     integer not null,
  pre_xp          integer not null,
  post_xp         integer not null,
  reason          text not null check (reason in
                    ('match_win','match_draw','match_loss','attendance','void_reversal','season_reset','admin_adjust')),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ledger_user_sport
  on public.experience_ledger(user_id, sport_type, created_at desc);
create index if not exists idx_ledger_competition
  on public.experience_ledger(competition_id);
comment on table public.experience_ledger is '不可变流水（feature §5.1）；幂等键 `competition_id:user_id:reason`';

-- =====================================================================
-- 8. competition_no_shows  -- 爽约事件
-- =====================================================================
create table if not exists public.competition_no_shows (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  flagged_by      uuid references public.profiles(id),
  evidence        text,
  flagged_at      timestamptz not null default now(),
  unique (competition_id, user_id)
);
create index if not exists idx_no_show_user_recent
  on public.competition_no_shows(user_id, flagged_at desc);
comment on table public.competition_no_shows is '爽约记录；30 天 2 次触发排位暂停（ADR-0002）';

