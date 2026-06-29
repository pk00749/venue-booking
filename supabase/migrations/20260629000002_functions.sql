-- venue-booking v2 · migration 00002 · functions + triggers
-- 对应 PRD §5.2（updated_at / 角色保护 / auth.users→profiles 同步）
--         PRD §US-205（regenerate_slots）
--         PRD §10.4（id_card_no 加解密 helper）
--         RLS helper（is_admin / is_owner_of_venue）放这里，00003 RLS 依赖
-- AGENTS §8.3 service_role 永不下发到前端 —— 所有 trigger 涉及跨表写都加 security definer

-- =====================================================================
-- 1. RLS helpers（被 00003 RLS 引用，必须先建）
-- =====================================================================
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $fn$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$fn$;
comment on function public.is_admin() is '当前会话用户是否为 admin —— RLS 复用';

create or replace function public.is_owner_of_venue(p_venue_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $fn$
  select exists (
    select 1 from public.venues
    where id = p_venue_id and owner_id = auth.uid()
  );
$fn$;
comment on function public.is_owner_of_venue(uuid) is '当前会话用户是否为该 venue 的 owner —— RLS 复用';

-- =====================================================================
-- 2. updated_at 通用 trigger (PRD §5.2)
-- =====================================================================
create or replace function public.tg_set_updated_at()
  returns trigger
  language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create trigger trg_venues_updated_at
  before update on public.venues
  for each row execute function public.tg_set_updated_at();

create trigger trg_courts_updated_at
  before update on public.courts
  for each row execute function public.tg_set_updated_at();

create trigger trg_slot_templates_updated_at
  before update on public.slot_templates
  for each row execute function public.tg_set_updated_at();

-- =====================================================================
-- 3. 保护 profiles.role —— 只能由 service_role 改 (PRD §6.1 + AGENTS §8.3)
-- =====================================================================
create or replace function public.tg_profiles_protect_role()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $fn$
begin
  if old.role is distinct from new.role then
    if coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'profiles.role can only be changed by service_role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$fn$;

create trigger trg_profiles_protect_role
  before update on public.profiles
  for each row execute function public.tg_profiles_protect_role();
comment on function public.tg_profiles_protect_role() is 'profiles.role 仅可被 service_role 修改（admin 升级走 service_role 上下文）';

-- =====================================================================
-- 4. auth.users INSERT → 自动建 profiles  (PRD §5.2 / §6.1)
-- =====================================================================
create or replace function public.tg_handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $fn$
begin
  insert into public.profiles (id, email, nickname, locale, is_email_verified)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'locale', 'zh-CN'),
    new.email_confirmed_at is not null
  );
  return new;
end;
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();
comment on function public.tg_handle_new_user() is 'auth.users 插入时同步建 profiles（PRD §6.1）';

-- =====================================================================
-- 5. email_confirmed_at 变化 → 同步 is_email_verified
-- =====================================================================
create or replace function public.tg_handle_user_email_confirmed()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $fn$
begin
  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or old.email_confirmed_at <> new.email_confirmed_at) then
    update public.profiles
    set is_email_verified = true
    where id = new.id and is_email_verified = false;
  end if;
  return new;
end;
$fn$;

create trigger on_auth_user_email_confirmed
  after update on auth.users
  for each row execute function public.tg_handle_user_email_confirmed();

-- =====================================================================
-- 6. PII 加解密 helper (PRD §10.4：id_card_no 用 pgcrypto)
--    key 通过连接级 `set local app.pii_key = '...'` 注入
--    Edge Function / migrations 持有 key；anon 永远拿不到
-- =====================================================================
create or replace function public.encrypt_pii(plain text)
  returns bytea
  language plpgsql
  security definer
  set search_path = ''
as $fn$
declare
  v_key text;
begin
  v_key := current_setting('app.pii_key', true);
  if v_key is null or v_key = '' then
    raise exception 'app.pii_key is not set on this connection';
  end if;
  return pgp_sym_encrypt(plain, v_key);
end;
$fn$;

create or replace function public.decrypt_pii(cipher bytea)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $fn$
declare
  v_key text;
begin
  v_key := current_setting('app.pii_key', true);
  if v_key is null or v_key = '' then
    raise exception 'app.pii_key is not set on this connection';
  end if;
  return pgp_sym_decrypt(cipher, v_key);
end;
$fn$;
comment on function public.encrypt_pii(text) is 'PII 加密写入；调用前需 set local app.pii_key = ...';
comment on function public.decrypt_pii(bytea) is 'PII 解密读取；同上';

-- =====================================================================
-- 7. regenerate_slots(venue_id, from_date, to_date)  (PRD §US-205)
--    按 venue 的 slot_templates 展开为 (court × slot)；
--    同 (court_id, starts_at) 唯一约束，冲突跳过；
--    security definer 让 service_role / Edge Function 都能跑
-- =====================================================================
create or replace function public.regenerate_slots(
  p_venue_id uuid,
  p_from     date,
  p_to       date
)
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $fn$
declare
  v_venue          public.venues%rowtype;
  v_template       record;
  v_court_id       uuid;
  v_day            date;
  v_dow            integer;
  v_slot_start     time;
  v_step_minutes   integer;
  v_starts_at      timestamptz;
  v_ends_at        timestamptz;
  v_inserted       integer := 0;
  v_status         text;
begin
  if p_to < p_from then
    raise exception 'p_to (%) must be >= p_from (%)', p_to, p_from;
  end if;

  select * into v_venue from public.venues where id = p_venue_id;
  if not found then
    raise exception 'venue % not found', p_venue_id;
  end if;

  for v_day in select generate_series(p_from, p_to, '1 day'::interval)::date loop
    v_dow := extract(dow from v_day);  -- 0=Sun..6=Sat

    for v_template in
      select * from public.slot_templates
      where venue_id = p_venue_id
        and (day_of_week is null or day_of_week = v_dow)
    loop
      v_step_minutes := coalesce(v_template.slot_duration_minutes, v_venue.slot_duration_minutes);
      if v_step_minutes is null or v_step_minutes <= 0 then
        continue;
      end if;

      for v_court_id in select unnest(v_template.court_ids) loop
        v_slot_start := v_template.time_start;
        while v_slot_start + make_interval(mins => v_step_minutes) <= v_template.time_end loop
          v_starts_at := (v_day::timestamp) + v_slot_start;
          v_ends_at   := v_starts_at + make_interval(mins => v_step_minutes);

          -- 跳过已存在 slot（不覆盖 held/booked/blocked）
          select status into v_status from public.slots
          where court_id = v_court_id and starts_at = v_starts_at;
          if not found then
            insert into public.slots (venue_id, court_id, starts_at, ends_at, status)
            values (p_venue_id, v_court_id, v_starts_at, v_ends_at, 'available');
            v_inserted := v_inserted + 1;
          end if;

          v_slot_start := v_slot_start + make_interval(mins => v_step_minutes);
        end loop;
      end loop;
    end loop;
  end loop;

  return v_inserted;
end;
$fn$;
comment on function public.regenerate_slots(uuid, date, date) is '按 slot_templates + date_range 展开为 slots（PRD §US-205）；返回新增条数';

-- =====================================================================
-- 8. has_free_slot_on_date(venue_id, date)  (PRD §US-101 列表页筛选)
--    Asia/Shanghai 时区约定
-- =====================================================================
create or replace function public.has_free_slot_on_date(
  p_venue_id uuid,
  p_date     date
)
  returns boolean
  language sql
  stable
  set search_path = ''
as $fn$
  select exists (
    select 1 from public.slots
    where venue_id = p_venue_id
      and status = 'available'
      and (starts_at at time zone 'Asia/Shanghai')::date = p_date
  );
$fn$;
comment on function public.has_free_slot_on_date(uuid, date) is '某 venue 在某日期（Asia/Shanghai）是否有可订 slot';
