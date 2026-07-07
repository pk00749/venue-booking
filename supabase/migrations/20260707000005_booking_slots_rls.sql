-- venue-booking v2 · migration 00005 · booking_slots RLS
--   对应 PRD §6.5（bookings 可见性透过 booking_slots 继承）
--   依赖：00001 schema（booking_slots 表）、00002 functions（is_admin / is_owner_of_venue）

-- =====================================================================
-- 1. enable RLS on booking_slots
-- =====================================================================
alter table public.booking_slots enable row level security;

-- =====================================================================
-- 2. SELECT：通过 booking 的可见性继承
--    booking 的申请人 / venue owner / admin 可读
-- =====================================================================
create policy "booking_slots_select_via_booking"
  on public.booking_slots for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_slots.booking_id
        and (b.user_id = auth.uid()
             or public.is_owner_of_venue(b.venue_id)
             or public.is_admin())
    )
  );

-- =====================================================================
-- 3. INSERT：仅 booking 的创建者
--    批量创建 booking_slots 通常由 Edge Function 以 service_role 完成，
--    此策略作为 frontend 直连的兜底
-- =====================================================================
create policy "booking_slots_insert_via_booking"
  on public.booking_slots for insert
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_slots.booking_id and b.user_id = auth.uid()
    )
  );

-- =====================================================================
-- 4. UPDATE / DELETE：不开放
--    删除由 bookings.on delete cascade 处理；
--    更新由 Edge Function（service_role）直改 slot 状态
-- =====================================================================
