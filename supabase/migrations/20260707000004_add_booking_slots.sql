-- venue-booking v2 · migration 00004 · 业务修正
--   1. 新增 booking_slots 联结表（bookings N:M slots，PRD §US-103）
--   2. 修复 venues.address_display 为普通列（generated -> plain，前端补齐名称）
--   3. 修复 regenerate_slots 时区（显式 set timezone='Asia/Shanghai'）
-- 依赖：00001 schema、00002 functions

-- =====================================================================
-- 1. booking_slots  ——  bookings x slots N:M 联结表
--    每个预订可能包含多个 slot（PRD §US-103：选 1 到 N 个场地 x 场次）
--    slot 被预订后 status 改为 'booked'，取消时释放回 'available'；
--    此联结表的 (booking_id, slot_id) 唯一
-- =====================================================================
create table if not exists public.booking_slots (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  slot_id    uuid not null references public.slots(id) on delete restrict,
  primary key (booking_id, slot_id)
);
create index if not exists idx_booking_slots_slot
  on public.booking_slots(slot_id);
comment on table public.booking_slots is '预订 - Slot N:M 关联（PRD §US-103）；slot_id 唯一 = 一个 slot 只能被一个 booking 占有';

-- 唯一约束：每 slot 最多被一个 booking 关联（应用层 / Edge Function 在占用 slot 前检查）
create unique index if not exists idx_booking_slots_slot_unique
  on public.booking_slots(slot_id);

-- =====================================================================
-- 2. venues.address_display：generated column -> plain text
--    PRD §5.2 标注「由前端写入层补齐」
--    当前 generated column 拼接的是 GB/T 2260 数值码而非中英文地名，不可用
--    改为普通列，由前端在 CREATE / UPDATE venue 时传入拼接好的展示文字
-- =====================================================================
alter table public.venues drop column if exists address_display;
alter table public.venues add column address_display text;

-- =====================================================================
-- 3. regenerate_slots：显式声明 Asia/Shanghai 时区
--    原函数隐式依赖于 session timezone（Edge Function 上默认为 UTC），
--    导致 (v_day + v_slot_start) 被按 UTC 解释，slot 偏差 8 小时。
--    修：在函数签名显式 set timezone = 'Asia/Shanghai'
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
  set timezone = 'Asia/Shanghai'           -- <- 修复：显式指定时区
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
    v_dow := extract(dow from v_day);

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
comment on function public.regenerate_slots(uuid, date, date) is '按 slot_templates + date_range 展开为 slots（PRD §US-205）；时区固定 Asia/Shanghai（v00004 修复）';
