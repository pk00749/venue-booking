-- venue-booking v2 · migration 00001 · init schema
-- 对应 PRD §5.2 / §5.3 数据模型 + 索引
-- RLS 在 00002 单独建；trigger / function / seed 在 00003 / 00004
-- AGENTS §6 约定：表名复数下划线 / 列名单数 / 枚举用 text+check / 钱以分存 int / 时间一律 timestamptz
-- AGENTS §8.10 价格相关字段走 cents；AGENTS §6 时间一律 UTC 存
-- AGENTS §10.4 id_card_no 用 pgcrypto 加密（bytea）

-- =====================================================================
-- 1. extensions
-- =====================================================================
create extension if not exists "pgcrypto";   -- gen_random_uuid() / pgp_sym_encrypt
create extension if not exists "citext";     -- email 大小写不敏感

-- =====================================================================
-- 2. profiles  (1:1 with auth.users)
-- =====================================================================
create table if not exists public.profiles (
  id               uuid        primary key references auth.users(id) on delete cascade,
  email            citext      unique not null,
  nickname         text        not null,
  avatar_url       text,
  phone            text,
  role             text        not null default 'user' check (role in ('user','owner','admin')),
  locale           text        not null default 'zh-CN' check (locale in ('zh-CN','en-US')),
  is_email_verified boolean    not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.profiles is '用户资料 1:1 跟随 auth.users；role 仅可被 service_role 改（migration 00002 trigger 兜底）';

-- =====================================================================
-- 3. owner_applications  (user → owner 的资质审核)
-- =====================================================================
create table if not exists public.owner_applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  real_name     text not null,
  -- pgcrypto 加密：写入 pgp_sym_encrypt(text, current_setting('app.pii_key'))；读取 pgp_sym_decrypt(id_card_no, ...)
  -- 实际 key 由 Edge Function / migrations 在 connection 级别 `set local app.pii_key = '...'`
  id_card_no    bytea not null,
  contact_phone text not null,
  license_url   text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text,
  reviewed_by   uuid references public.profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_owner_apps_status_created
  on public.owner_applications(status, created_at);
comment on table public.owner_applications is '场主入驻申请；审批通过后由 Edge Function 把 profiles.role 升级为 owner';

-- =====================================================================
-- 4. venues  (球馆)
-- =====================================================================
create table if not exists public.venues (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles(id) on delete restrict,
  name                  text not null,
  sport_type            text not null check (sport_type in
                            ('squash','badminton','basketball','football','tennis','table_tennis','volleyball','other')),
  province_code         text not null,    -- GB/T 2260
  city_code             text not null,
  district_code         text not null,
  address_detail        text not null,
  -- 冗余展示字段：写入时由应用层补齐 "省 市 区 detail"（PRD §5.2）
  address_display       text generated always as
                            (province_code || ' ' || city_code || ' ' || district_code || ' ' || address_detail) stored,
  description           text not null default '',
  images                text[] not null default '{}',
  open_time_start       time not null,
  open_time_end         time not null,
  slot_duration_minutes smallint not null check (slot_duration_minutes in (30,60,90,120)),
  require_approval      boolean not null default false,
  cancel_hours          integer not null default 2 check (cancel_hours between 0 and 168),
  base_price_cents      integer not null default 0 check (base_price_cents >= 0),
  amenities             text[] not null default '{}',    -- 元素格式：'preset:<key>' | 'custom:<label>'
  status                text not null default 'active' check (status in ('active','inactive')),
  capacity              integer not null default 4 check (capacity > 0),
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (open_time_end > open_time_start)
);
create index if not exists idx_venues_status_sport_city
  on public.venues(status, sport_type, city_code, district_code);
create index if not exists idx_venues_owner
  on public.venues(owner_id);
comment on table public.venues is '球馆 / 场地；PRD §US-203 提交即 active 对外可见；§US-203a 走 status=inactive 软删';

-- =====================================================================
-- 5. venue_services  (球馆下的附加服务)
-- =====================================================================
create table if not exists public.venue_services (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  name        text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  required    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_venue_services_venue on public.venue_services(venue_id);
comment on table public.venue_services is '附加服务（球拍租赁等付费加项，PRD §US-204），与 amenities（场地特性，免费）独立';

-- =====================================================================
-- 6. courts  (球馆下属的「场地 / court」)
-- =====================================================================
create table if not exists public.courts (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues(id) on delete cascade,
  name_zh       text not null,
  name_en       text not null,
  sort_order    integer not null default 0,
  capacity      integer not null default 4 check (capacity > 0),     -- 拼场容量（展示用，非预订占位）
  price_cents   integer not null default 0 check (price_cents >= 0), -- 0 = 沿用 venue.base_price_cents
  notes         text,
  is_active     boolean not null default true,                       -- 软停用：false 后不出现在前端选择
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_courts_venue_sort on public.courts(venue_id, sort_order);
comment on table public.courts is '场地（球场）；price_cents > 0 优先于 venue.base_price_cents（PRD §US-203b）';

-- =====================================================================
-- 7. slot_templates  (周内某天 / 每天的开放窗口模板)
-- =====================================================================
create table if not exists public.slot_templates (
  id                     uuid primary key default gen_random_uuid(),
  venue_id               uuid not null references public.venues(id) on delete cascade,
  day_of_week            smallint check (day_of_week between 0 and 6),  -- null = 每天；0 = 周日, 6 = 周六
  time_start             time not null,
  time_end               time not null,
  court_ids              uuid[] not null default '{}',
  slot_duration_minutes  smallint check (slot_duration_minutes in (30,60,90,120)),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (time_end > time_start)
);
create index if not exists idx_slot_templates_venue on public.slot_templates(venue_id);
comment on table public.slot_templates is '时段模板（PRD §US-205）；null slot_duration_minutes 沿用 venue';

-- =====================================================================
-- 8. slots  (按 court × starts_at 预生成)
-- =====================================================================
create table if not exists public.slots (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues(id) on delete cascade,
  court_id   uuid not null references public.courts(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  status     text not null default 'available' check (status in ('available','held','booked','blocked')),
  created_at timestamptz not null default now(),
  unique (court_id, starts_at),
  check (ends_at > starts_at)
);
create index if not exists idx_slots_court_starts on public.slots(court_id, starts_at);
create index if not exists idx_slots_venue_starts on public.slots(venue_id, starts_at);
create index if not exists idx_slots_available
  on public.slots(starts_at) where status = 'available';
comment on table public.slots is '可被预订的最小时间单元；同 (court_id, starts_at) 唯一；status=held 是下单页 10 分钟临时锁';

-- =====================================================================
-- 9. bookings
-- =====================================================================
create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete restrict,
  venue_id          uuid not null references public.venues(id) on delete restrict,
  status            text not null default 'pending' check (status in
                          ('pending','confirmed','cancelled','completed','rejected')),
  contact_name      text not null,
  contact_phone     text not null,
  total_price_cents integer not null default 0 check (total_price_cents >= 0),
  notes             text,
  cancel_reason     text,
  confirmed_at      timestamptz,
  cancelled_at      timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_bookings_user_created on public.bookings(user_id, created_at desc);
create index if not exists idx_bookings_venue_created on public.bookings(venue_id, created_at desc);
create index if not exists idx_bookings_status on public.bookings(status);
comment on table public.bookings is '用户预订；v2 不接支付（PRD §2.2），仅占位语义';

-- =====================================================================
-- 10. booking_services  (bookings × venue_services N:M)
-- =====================================================================
create table if not exists public.booking_services (
  booking_id           uuid not null references public.bookings(id) on delete cascade,
  service_id           uuid not null references public.venue_services(id) on delete restrict,
  quantity             integer not null default 1 check (quantity > 0),
  price_cents_snapshot integer not null default 0,    -- 下单时价格快照
  primary key (booking_id, service_id)
);
comment on table public.booking_services is '预订带的附加服务行；price_cents_snapshot 防 venue 改价影响历史订单';

-- =====================================================================
-- 11. notifications  (站内收件箱)
-- =====================================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,    -- 例：'booking.confirmed', 'owner.approved'
  title      text not null,
  body       text not null default '',
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_inbox
  on public.notifications(user_id, read_at, created_at desc);
comment on table public.notifications is '站内通知（PRD §7.2 / US-105）；邮件通过 email_outbox';

-- =====================================================================
-- 12. sensitive_words  (敏感词词库)
-- =====================================================================
create table if not exists public.sensitive_words (
  id         uuid primary key default gen_random_uuid(),
  word       text unique not null,
  severity   text not null default 'block' check (severity in ('block','review')),
  note       text,
  is_active  boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_sensitive_words_active
  on public.sensitive_words(word) where is_active = true;
comment on table public.sensitive_words is '敏感词词库（PRD §US-302 / §9）；Edge Function sensitive-check 走 5min LRU 缓存';

-- =====================================================================
-- 13. audit_logs  (管理员 / 场主关键动作审计)
-- =====================================================================
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id),
  action      text not null,         -- 例：'owner.approve', 'review_booking', 'word_add'
  target_type text not null,         -- 例：'owner_applications', 'bookings'
  target_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_actor_action
  on public.audit_logs(actor_id, action, created_at desc);
comment on table public.audit_logs is '审计日志（PRD §US-304 / §6.8）；仅 admin 可读，仅 service_role 可写';

-- =====================================================================
-- 14. email_outbox  (邮件重试 / 终态失败队列)
-- =====================================================================
create table if not exists public.email_outbox (
  id          uuid primary key default gen_random_uuid(),
  to_email    citext not null,
  template_key text not null,         -- 例：'booking.confirmed'，对应 _templates/ 下的双语模板
  locale      text not null default 'zh-CN' check (locale in ('zh-CN','en-US')),
  payload     jsonb not null default '{}'::jsonb,
  attempts    smallint not null default 0,
  last_error  text,
  sent_at     timestamptz,
  failed_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_email_outbox_pending
  on public.email_outbox(created_at) where sent_at is null and failed_at is null;
comment on table public.email_outbox is '邮件队列（PRD §7.1）；重试 3 次仍失败则写 failed_at 终态';
