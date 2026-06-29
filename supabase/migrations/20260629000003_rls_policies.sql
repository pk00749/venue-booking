-- venue-booking v2 · migration 00003 · RLS policies
-- 对应 PRD §6.1-§6.8 全部 RLS strategy
-- 依赖 00002 functions (is_admin, is_owner_of_venue)
-- AGENTS §8.3 service_role 永不下发到前端，所有写入都受 RLS 约束

-- =====================================================================
-- 1. enable RLS on all 13 tables
-- =====================================================================
alter table public.profiles             enable row level security;
alter table public.owner_applications   enable row level security;
alter table public.venues               enable row level security;
alter table public.venue_services       enable row level security;
alter table public.courts               enable row level security;
alter table public.slot_templates       enable row level security;
alter table public.slots                enable row level security;
alter table public.bookings             enable row level security;
alter table public.booking_services     enable row level security;
alter table public.notifications        enable row level security;
alter table public.sensitive_words      enable row level security;
alter table public.audit_logs           enable row level security;
alter table public.email_outbox         enable row level security;

-- =====================================================================
-- 2. profiles (PRD §6.1)
--    SELECT：所有人可看；UPDATE：仅自己；role 字段由 00002 trigger 保护
-- =====================================================================
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- INSERT：仅由 auth.users 触发器写（无 INSERT policy = anon/user 不能直接 insert）

-- =====================================================================
-- 3. venues (PRD §6.2)
--    SELECT：所有人可看 status='active'；owner 看自己的全部（含 pending/rejected）；admin 看全部
--    INSERT：role=owner/admin；owner_id 必须是自己
--    UPDATE：owner 改自己 / admin 改任意
--    DELETE：禁（实际走 status=inactive 软删，PRD §US-203a / §US-305）
-- =====================================================================
create policy "venues_select_visible"
  on public.venues for select
  using (
    status = 'active'
    or owner_id = auth.uid()
    or public.is_admin()
  );

create policy "venues_insert_owner_or_admin"
  on public.venues for insert
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('owner','admin')
    )
  );

create policy "venues_update_owner_or_admin"
  on public.venues for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- =====================================================================
-- 4. courts (PRD §6.3)
--    SELECT：is_active=true 公开；owner 看自己场馆全部；admin 看全部
--    ALL：owner / admin
-- =====================================================================
create policy "courts_select_visible"
  on public.courts for select
  using (
    is_active = true
    or public.is_owner_of_venue(venue_id)
    or public.is_admin()
  );

create policy "courts_modify_owner_or_admin"
  on public.courts for all
  using (public.is_owner_of_venue(venue_id) or public.is_admin())
  with check (public.is_owner_of_venue(venue_id) or public.is_admin());

-- =====================================================================
-- 5. venue_services (PRD §US-204)
--    跟 venues 同步可见性；ALL：owner / admin
-- =====================================================================
create policy "venue_services_select_visible"
  on public.venue_services for select
  using (
    exists (
      select 1 from public.venues v
      where v.id = venue_services.venue_id
        and (v.status = 'active' or v.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "venue_services_modify_owner_or_admin"
  on public.venue_services for all
  using (public.is_owner_of_venue(venue_id) or public.is_admin())
  with check (public.is_owner_of_venue(venue_id) or public.is_admin());

-- =====================================================================
-- 6. slots (PRD §6.4)
--    SELECT：所有人；ALL：owner / admin（普通用户不直改 slot；下单走 service_role）
-- =====================================================================
create policy "slots_select_all"
  on public.slots for select
  using (true);

create policy "slots_modify_owner_or_admin"
  on public.slots for all
  using (public.is_owner_of_venue(venue_id) or public.is_admin())
  with check (public.is_owner_of_venue(venue_id) or public.is_admin());

-- =====================================================================
-- 7. slot_templates (PRD §6.4a)
--    跟 venues 同步可见性；ALL：owner / admin
-- =====================================================================
create policy "slot_templates_select_visible"
  on public.slot_templates for select
  using (
    exists (
      select 1 from public.venues v
      where v.id = slot_templates.venue_id
        and (v.status = 'active' or v.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "slot_templates_modify_owner_or_admin"
  on public.slot_templates for all
  using (public.is_owner_of_venue(venue_id) or public.is_admin())
  with check (public.is_owner_of_venue(venue_id) or public.is_admin());

-- =====================================================================
-- 8. bookings (PRD §6.5)
--    SELECT：申请人 / 场馆 owner / admin
--    INSERT：申请人必须是 auth.uid() 且 role in (user/owner/admin)
--    UPDATE：user / owner / admin（状态机约束在应用层 / trigger）
--    DELETE：禁
-- =====================================================================
create policy "bookings_select_self_or_owner_or_admin"
  on public.bookings for select
  using (
    user_id = auth.uid()
    or public.is_owner_of_venue(venue_id)
    or public.is_admin()
  );

create policy "bookings_insert_self"
  on public.bookings for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('user','owner','admin')
    )
  );

create policy "bookings_update_self_or_owner_or_admin"
  on public.bookings for update
  using (
    user_id = auth.uid()
    or public.is_owner_of_venue(venue_id)
    or public.is_admin()
  )
  with check (
    user_id = auth.uid()
    or public.is_owner_of_venue(venue_id)
    or public.is_admin()
  );

-- =====================================================================
-- 9. booking_services (bookings × venue_services N:M)
--    SELECT：通过 booking 的 RLS 决定；INSERT：申请人本人
-- =====================================================================
create policy "booking_services_select_via_booking"
  on public.booking_services for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_services.booking_id
        and (b.user_id = auth.uid()
             or public.is_owner_of_venue(b.venue_id)
             or public.is_admin())
    )
  );

create policy "booking_services_insert_via_booking"
  on public.booking_services for insert
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_services.booking_id and b.user_id = auth.uid()
    )
  );

-- =====================================================================
-- 10. owner_applications (PRD §6.6)
--    SELECT：申请人本人 / admin；INSERT：申请人本人；UPDATE：仅 admin
-- =====================================================================
create policy "owner_apps_select_self_or_admin"
  on public.owner_applications for select
  using (user_id = auth.uid() or public.is_admin());

create policy "owner_apps_insert_self"
  on public.owner_applications for insert
  with check (user_id = auth.uid());

create policy "owner_apps_update_admin"
  on public.owner_applications for update
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 11. notifications (PRD §6.7)
--    SELECT/UPDATE：仅收件人；INSERT：仅 service_role（Edge Function 写）
-- =====================================================================
create policy "notifications_select_self"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_self"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =====================================================================
-- 12. sensitive_words (PRD §6.7)
--    ALL：仅 admin
-- =====================================================================
create policy "sensitive_words_admin_all"
  on public.sensitive_words for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 13. audit_logs (PRD §6.8)
--    SELECT：仅 admin；INSERT：仅 service_role
-- =====================================================================
create policy "audit_logs_select_admin"
  on public.audit_logs for select
  using (public.is_admin());

-- =====================================================================
-- 14. email_outbox
--    仅 service_role 写；不对前端 / 普通用户开放（无任何 policy）
-- =====================================================================
