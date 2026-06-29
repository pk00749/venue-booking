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
