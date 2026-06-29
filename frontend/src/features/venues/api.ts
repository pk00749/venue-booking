// 场馆相关 Mock API —— 后续替换为 supabase.from('venues').select(...)
import { store, newId, nowIso } from "@/lib/mock-data";
import { courtLetter } from "@/lib/mock-data";
import { checkSensitive } from "@/lib/sensitive";
import { formatAddress, getRegion } from "@/lib/region";
import { addAuditLog } from "@/features/admin/api";
import type {
  Court,
  Slot,
  SlotTemplate,
  SportType,
  Venue,
  VenueService,
} from "@/lib/types";

const wait = <T,>(value: T, ms = 150): Promise<T> =>
  new Promise((res) => setTimeout(() => res(value), ms));

// 单一价格解析：court.priceCents 优先；0 = 沿用 venue.basePriceCents（PRD §US-203b）
export function effectivePriceCents(venue: Venue, court?: Court | null): number {
  if (court && court.priceCents > 0) return court.priceCents;
  return venue.basePriceCents;
}

// Venue 的展示用地址字符串（mock 阶段实时拼接，Supabase 接入后改为 `address_display` 生成列）
export function venueAddress(venue: Venue, locale: "zh-CN" | "en-US" = "zh-CN"): string {
  return formatAddress(venue.provinceCode, venue.cityCode, venue.districtCode, venue.addressDetail, locale);
}

export interface VenueFilters {
  sportType?: SportType | "all";
  keyword?: string;
  cityCode?: string;       // 直辖市：province code；其他：市级 code
  districtCode?: string;
  date?: string; // YYYY-MM-DD; if set, only venues with >=1 free slot on that day
  // 场主视角：只返回 ownerId === me 的场馆（v0.3.1 owner 角色在 /venues 走"我的场馆"分支）
  // 与 status='active' 公开列表口径叠加：owner 看不到自己已下架的场馆，去 /owner 控制台看
  ownerId?: string;
}

export async function listVenues(filters: VenueFilters = {}): Promise<Venue[]> {
  let rows = store.venues.filter((v) => v.status === "active");
  if (filters.ownerId) {
    rows = rows.filter((v) => v.ownerId === filters.ownerId);
  }
  if (filters.sportType && filters.sportType !== "all") {
    rows = rows.filter((v) => v.sportType === filters.sportType);
  }
  if (filters.cityCode) {
    const c = filters.cityCode;
    rows = rows.filter((v) => v.cityCode === c);
  }
  if (filters.districtCode) {
    const d = filters.districtCode;
    rows = rows.filter((v) => v.districtCode === d);
  }
  if (filters.keyword) {
    const k = filters.keyword.toLowerCase();
    rows = rows.filter((v) => {
      const addr = venueAddress(v).toLowerCase();
      return v.name.toLowerCase().includes(k) || addr.includes(k);
    });
  }
  if (filters.date) {
    const iso = filters.date;
    rows = rows.filter((v) => hasFreeSlotOnDate(v.id, iso));
  }
  return wait(rows);
}

// —— v0.2 兼容：旧代码 / VenuesPage 的 city/district label 取自 region 表
export function parseCity(code: string): string {
  const r = getRegion(code);
  if (!r) return code;
  return r.parentCode === null ? r.name_zh : (getRegion(r.parentCode)?.name_zh ?? r.name_zh);
}
export function parseDistrict(code: string): string {
  const r = getRegion(code);
  return r ? r.name_zh : code;
}

// 把 ISO 日期（或任意可被 Date 解析的字符串）规整成 [startMs, endMs) 区间，
// —— mock 内部用，后续 Supabase 接入后应改为按 date 列直接查 slots。
function dayBounds(dateLike: string): { start: number; end: number } {
  const d = new Date(dateLike);
  d.setHours(0, 0, 0, 0);
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  return { start: d.getTime(), end: next.getTime() };
}

export function hasFreeSlotOnDate(venueId: string, dateIso: string): boolean {
  const { start, end } = dayBounds(dateIso);
  return store.slots.some(
    (s) =>
      s.venueId === venueId &&
      new Date(s.startsAt).getTime() >= start &&
      new Date(s.startsAt).getTime() < end &&
      s.confirmedCount < s.capacity
  );
}

export function countFreeSlotsOnDate(venueId: string, dateIso: string): number {
  const { start, end } = dayBounds(dateIso);
  return store.slots.filter(
    (s) =>
      s.venueId === venueId &&
      new Date(s.startsAt).getTime() >= start &&
      new Date(s.startsAt).getTime() < end &&
      s.confirmedCount < s.capacity
  ).length;
}

export async function getVenue(id: string): Promise<Venue | null> {
  return wait(store.venues.find((v) => v.id === id) ?? null);
}

export async function listVenueServices(venueId: string): Promise<VenueService[]> {
  return wait(store.services.filter((s) => s.venueId === venueId));
}

export async function listSlots(venueId: string, dateIso?: string) {
  let rows = store.slots.filter((s) => s.venueId === venueId);
  if (dateIso) {
    const day = new Date(dateIso);
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    rows = rows.filter((s) => {
      const t = new Date(s.startsAt).getTime();
      return t >= day.getTime() && t < next.getTime();
    });
  }
  return wait(rows);
}

// —— v3：返回某场馆下 active 的场地列表（按 sortOrder 升序） ——
export async function listCourts(venueId: string): Promise<Court[]> {
  return wait(
    store.courts
      .filter((c) => c.venueId === venueId && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );
}

export async function getCourt(courtId: string): Promise<Court | null> {
  return wait(store.courts.find((c) => c.id === courtId) ?? null);
}

export interface Session {
  startsAt: string;
  endsAt: string;
  totalCourts: number;     // 该场次下场地总数
  availableCourts: number; // 该场次下可加入（status=available 且 confirmedCount < capacity）的场地数
  courts: { court: Court; slot: Slot }[]; // 该场次下 (court, slot) 配对
}

// —— v3：返回某场馆某日的场次列表（按 startsAt 升序） ——
// 把当日所有 slot 按 startsAt 聚合，每条场次下挂 (court, slot) 配对。
export async function listSessions(venueId: string, dateIso: string): Promise<Session[]> {
  const day = new Date(dateIso);
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  const courts = store.courts
    .filter((c) => c.venueId === venueId && c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const courtById = new Map(courts.map((c) => [c.id, c]));
  const slots = store.slots.filter((s) => {
    if (s.venueId !== venueId) return false;
    const t = new Date(s.startsAt).getTime();
    return t >= day.getTime() && t < next.getTime() && courtById.has(s.courtId);
  });
  const byStart = new Map<string, Session>();
  for (const s of slots) {
    const court = courtById.get(s.courtId)!;
    let sess = byStart.get(s.startsAt);
    if (!sess) {
      sess = { startsAt: s.startsAt, endsAt: s.endsAt, totalCourts: 0, availableCourts: 0, courts: [] };
      byStart.set(s.startsAt, sess);
    }
    sess.totalCourts += 1;
    const joinable = s.status === "available" && s.confirmedCount < s.capacity;
    if (joinable) sess.availableCourts += 1;
    sess.courts.push({ court, slot: s });
  }
  return wait(
    Array.from(byStart.values())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      // 场次内 court 按 sortOrder 排序，保证「A 场 / B 场…」稳定
      .map((sess) => ({
        ...sess,
        courts: [...sess.courts].sort((x, y) => x.court.sortOrder - y.court.sortOrder),
      })),
  );
}

// —— v3：根据 (courtId, startsAt) 找对应 slot ——
export async function findSlot(courtId: string, startsAt: string): Promise<Slot | null> {
  return wait(
    store.slots.find((s) => s.courtId === courtId && s.startsAt === startsAt) ?? null,
  );
}

/**
 * 取某个场馆接下来 N 个「仍有空位」的可订日期（YYYY-MM-DD）。
 * 用于场馆列表的「最近 3 个可订日期」展示。
 */
export async function listNextAvailableDates(venueId: string, n: number): Promise<string[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: string[] = [];
  for (let d = 0; d < 7 && days.length < n; d++) {
    const day = new Date(today);
    day.setDate(day.getDate() + d);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const hasFree = store.slots.some(
      (s) =>
        s.venueId === venueId &&
        new Date(s.startsAt).getTime() >= day.getTime() &&
        new Date(s.startsAt).getTime() < next.getTime() &&
        s.confirmedCount < s.capacity
    );
    if (hasFree) {
      const iso = day.toISOString().slice(0, 10);
      days.push(iso);
    }
  }
  return wait(days);
}

export interface CreateVenueInput {
  ownerId: string;
  name: string;
  sportType: SportType;
  // 结构化地址（PRD §US-203）
  provinceCode: string;
  cityCode: string;
  districtCode: string;
  addressDetail: string;
  description: string;
  openTimeStart: string;
  openTimeEnd: string;
  slotDurationMinutes: 30 | 60 | 90 | 120;
  requireApproval: boolean;
  cancelHours: number;
  basePriceCents: number;
  capacity: number;
  amenities: string[];     // PRD §US-208
  notes?: string;
  // 场地清单（PRD §US-203b）；新增字段：priceCents / capacity / notes
  courts?: Array<{
    name_zh: string;
    name_en: string;
    priceCents?: number;
    capacity?: number;
    notes?: string;
  }>;
  // 时段模板（PRD §US-205）；空数组 = 用 venue 营业时段 + 默认 duration 自动生成一条
  slotTemplates?: Array<Omit<SlotTemplate, "id" | "venueId" | "createdAt">>;
  // 附加服务（PRD §US-204）；与 amenities（免费）解耦，独立入 venue_services
  services?: Array<{ name: string; priceCents: number; required?: boolean }>;
}

export async function createVenue(input: CreateVenueInput): Promise<{ ok: true; venue: Venue } | { ok: false; words: string[] }> {
  // PRD §9：name/description/address 走敏感词
  const hits = [
    ...checkSensitive(input.name),
    ...checkSensitive(input.description),
    ...checkSensitive(input.addressDetail),
    ...(input.notes ? checkSensitive(input.notes) : []),
    ...(input.services ?? []).flatMap((s) => checkSensitive(s.name)),
  ];
  const blocked = hits.filter((h) => h.severity === "block").map((h) => h.word);
  if (blocked.length) return { ok: false, words: blocked };
  const v: Venue = {
    id: newId(),
    ownerId: input.ownerId,
    name: input.name,
    sportType: input.sportType,
    provinceCode: input.provinceCode,
    cityCode: input.cityCode,
    districtCode: input.districtCode,
    addressDetail: input.addressDetail,
    description: input.description,
    images: [],
    openTimeStart: input.openTimeStart,
    openTimeEnd: input.openTimeEnd,
    slotDurationMinutes: input.slotDurationMinutes,
    requireApproval: input.requireApproval,
    cancelHours: input.cancelHours,
    basePriceCents: input.basePriceCents,
    amenities: input.amenities ?? [],
    // v0.4 (PRD §US-203 改) 新建场馆走 admin 审核，默认 pending；approved → active / rejected → inactive
    status: "pending",
    createdAt: nowIso(),
    submittedAt: nowIso(),
    capacity: input.capacity,
    notes: input.notes,
  };
  store.venues.push(v);
  // 写 audit log：venue_submit (PRD §US-306 配套记录)
  await addAuditLog({
    actorId: input.ownerId,
    actorRole: "owner",
    action: "venue_submit",
    targetType: "venues",
    targetId: v.id,
    metadata: { name: input.name, sportType: input.sportType },
  });
  // v3：先建 courts，再为每片 court 生成 slot
  const courtInputs = input.courts && input.courts.length > 0
    ? input.courts
    : ([0, 1, 2, 3].map((i) => ({ name_zh: `${courtLetter(i)} 场`, name_en: `Court ${courtLetter(i)}` })) as Array<{
        name_zh: string;
        name_en: string;
        priceCents?: number;
        capacity?: number;
        notes?: string;
      }>);
  const courts: Court[] = courtInputs.map((c, i) => ({
    id: `c_${v.id}_${i}`,
    venueId: v.id,
    name_zh: c.name_zh.trim() || `${courtLetter(i)} 场`,
    name_en: c.name_en.trim() || `Court ${courtLetter(i)}`,
    sortOrder: i,
    capacity: c.capacity ?? v.capacity,
    priceCents: c.priceCents ?? 0,
    notes: c.notes,
    isActive: true,
    createdAt: nowIso(),
  }));
  store.courts.push(...courts);
  // 附加服务（PRD §US-204）
  for (const s of input.services ?? []) {
    if (!s.name.trim()) continue;
    store.services.push({
      id: newId(),
      venueId: v.id,
      name: s.name.trim(),
      priceCents: Math.max(0, Math.round(s.priceCents)),
      required: !!s.required,
    });
  }
  // 时段模板里的 courtIds 占位（__pending:<i>）→ 真实 id（c_<vid>_<i>）
  const remapCourtIds = (ids: string[]): string[] =>
    ids.map((cid) => {
      const m = cid.match(/^__pending:(\d+)$/);
      if (!m) return cid;
      const idx = Number(m[1]);
      return courts[idx]?.id ?? cid;
    });
  // 时段模板（PRD §US-205）：如果 owner 没传，套一条默认（全 court × 全营业时段 × 默认 duration）
  const templates: SlotTemplate[] = (input.slotTemplates && input.slotTemplates.length > 0
    ? input.slotTemplates
    : [{
        dayOfWeek: null,
        timeStart: v.openTimeStart,
        timeEnd: v.openTimeEnd,
        courtIds: courts.filter((c) => c.isActive).map((c) => c.id),
        slotDurationMinutes: v.slotDurationMinutes,
      }]
  ).map((t) => ({
    ...t,
    courtIds: remapCourtIds(t.courtIds),
    id: newId(),
    venueId: v.id,
    createdAt: nowIso(),
  }));
  store.slotTemplates.push(...templates);
  // 立即铺 7 天 slot（mock 阶段同步生成；Supabase 阶段改为 worker / pg_cron）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let d = 0; d < 7; d++) {
    const dayMs = today.getTime() + d * 24 * 60 * 60 * 1000;
    const slots = expandTemplatesForDay(v, templates, courts, dayMs);
    store.slots.push(...slots);
  }
  return wait({ ok: true, venue: v });
}

// 给定一组模板 + 当天 0 点 ms，展开为 Slot[]（不写库，由调用方决定入库存哪里）
function expandTemplatesForDay(
  v: Venue,
  templates: SlotTemplate[],
  courts: Court[],
  dayStartMs: number,
): Slot[] {
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
  const dow = new Date(dayStartMs).getDay();
  const courtsById = new Map(courts.map((c) => [c.id, c]));
  const out = new Map<string, Slot>();
  for (const t of templates) {
    if (t.dayOfWeek !== null && t.dayOfWeek !== dow) continue;
    const [sh, sm] = t.timeStart.split(":").map(Number);
    const [eh, em] = t.timeEnd.split(":").map(Number);
    const start = new Date(dayStartMs);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(dayStartMs);
    end.setHours(eh, em, 0, 0);
    const step = t.slotDurationMinutes ?? v.slotDurationMinutes;
    for (const cid of t.courtIds) {
      const court = courtsById.get(cid);
      if (!court || !court.isActive) continue;
      for (
        let tStart = new Date(start);
        tStart.getTime() + step * 60_000 <= end.getTime();
        tStart = new Date(tStart.getTime() + step * 60_000)
      ) {
        const ts = new Date(tStart);
        if (ts.getTime() < Date.now() || ts.getTime() >= dayEndMs) continue;
        const te = new Date(ts.getTime() + step * 60_000);
        out.set(`${cid}|${ts.getTime()}`, {
          id: `sl_${cid}_${ts.getTime()}`,
          venueId: v.id,
          courtId: cid,
          startsAt: ts.toISOString(),
          endsAt: te.toISOString(),
          status: "available",
          capacity: court.capacity,
          confirmedCount: 0,
        });
      }
    }
  }
  return Array.from(out.values());
}

export async function listVenuesByOwner(ownerId: string): Promise<Venue[]> {
  return wait(store.venues.filter((v) => v.ownerId === ownerId));
}

// —— 编辑 / 下架场馆（PRD §US-203a）——
// updateVenue 接同 createVenue 的字段集（owner 编辑表单复用），并支持替换 courts / services / slotTemplates 列表
// setVenueStatus 单独拎出来：下架 / 重新上架 走的是状态翻转，不需要重铺其它字段
export interface UpdateVenueInput {
  name?: string;
  sportType?: SportType;
  provinceCode?: string;
  cityCode?: string;
  districtCode?: string;
  addressDetail?: string;
  description?: string;
  openTimeStart?: string;
  openTimeEnd?: string;
  slotDurationMinutes?: 30 | 60 | 90 | 120;
  requireApproval?: boolean;
  cancelHours?: number;
  basePriceCents?: number;
  capacity?: number;
  amenities?: string[];
  notes?: string;
  // 替换式写入：edit 模式下 owner 在表单里增删场地，服务整体刷新
  courts?: Array<{
    id?: string;
    name_zh: string;
    name_en: string;
    priceCents?: number;
    capacity?: number;
    notes?: string;
    isActive?: boolean;
  }>;
  services?: Array<{
    id?: string;
    name: string;
    priceCents: number;
    required?: boolean;
  }>;
  slotTemplates?: Array<{
    id?: string;
    dayOfWeek: number | null;
    timeStart: string;
    timeEnd: string;
    courtIds: string[];
    slotDurationMinutes?: 30 | 60 | 90 | 120;
  }>;
}

export async function updateVenue(
  venueId: string,
  patch: UpdateVenueInput,
): Promise<{ ok: true; venue: Venue } | { ok: false; words: string[] }> {
  const v = store.venues.find((x) => x.id === venueId);
  if (!v) return { ok: false, words: [] };
  // 敏感词复检（与 createVenue 对齐）
  const hits = [
    ...checkSensitive(patch.name ?? v.name),
    ...checkSensitive(patch.description ?? v.description),
    ...checkSensitive(patch.addressDetail ?? v.addressDetail),
    ...checkSensitive(patch.notes ?? v.notes ?? ""),
    ...(patch.services ?? []).flatMap((s) => checkSensitive(s.name)),
  ];
  const blocked = hits.filter((h) => h.severity === "block").map((h) => h.word);
  if (blocked.length) return { ok: false, words: blocked };

  // 基础字段
  if (patch.name !== undefined) v.name = patch.name.trim();
  if (patch.sportType !== undefined) v.sportType = patch.sportType;
  if (patch.provinceCode !== undefined) v.provinceCode = patch.provinceCode;
  if (patch.cityCode !== undefined) v.cityCode = patch.cityCode;
  if (patch.districtCode !== undefined) v.districtCode = patch.districtCode;
  if (patch.addressDetail !== undefined) v.addressDetail = patch.addressDetail.trim();
  if (patch.description !== undefined) v.description = patch.description;
  if (patch.openTimeStart !== undefined) v.openTimeStart = patch.openTimeStart;
  if (patch.openTimeEnd !== undefined) v.openTimeEnd = patch.openTimeEnd;
  if (patch.slotDurationMinutes !== undefined) v.slotDurationMinutes = patch.slotDurationMinutes;
  if (patch.requireApproval !== undefined) v.requireApproval = patch.requireApproval;
  if (patch.cancelHours !== undefined) v.cancelHours = patch.cancelHours;
  if (patch.basePriceCents !== undefined) v.basePriceCents = patch.basePriceCents;
  if (patch.capacity !== undefined) v.capacity = patch.capacity;
  if (patch.amenities !== undefined) v.amenities = patch.amenities;
  if (patch.notes !== undefined) v.notes = patch.notes;

  // 替换式：courts
  if (patch.courts !== undefined) {
    store.courts = store.courts.filter((c) => c.venueId !== venueId);
    store.courts.push(
      ...patch.courts.map((c, i) => ({
        id: c.id ?? `c_${venueId}_${i}`,
        venueId,
        name_zh: c.name_zh.trim() || `${courtLetter(i)} 场`,
        name_en: c.name_en.trim() || `Court ${courtLetter(i)}`,
        sortOrder: i,
        capacity: c.capacity ?? v.capacity,
        priceCents: c.priceCents ?? 0,
        notes: c.notes,
        isActive: c.isActive ?? true,
        createdAt: nowIso(),
      })),
    );
  }

  // 替换式：services
  if (patch.services !== undefined) {
    store.services = store.services.filter((s) => s.venueId !== venueId);
    for (const s of patch.services) {
      if (!s.name.trim()) continue;
      store.services.push({
        id: s.id ?? newId(),
        venueId,
        name: s.name.trim(),
        priceCents: Math.max(0, Math.round(s.priceCents)),
        required: !!s.required,
      });
    }
  }

  // 替换式：slotTemplates（编辑模式下 courtIds 是真实 id；不需要 __pending 映射）
  if (patch.slotTemplates !== undefined) {
    store.slotTemplates = store.slotTemplates.filter((t) => t.venueId !== venueId);
    for (const t of patch.slotTemplates) {
      store.slotTemplates.push({
        id: t.id ?? newId(),
        venueId,
        dayOfWeek: t.dayOfWeek,
        timeStart: t.timeStart,
        timeEnd: t.timeEnd,
        courtIds: t.courtIds,
        slotDurationMinutes: t.slotDurationMinutes,
        createdAt: nowIso(),
      });
    }
    // 重铺未来 7 天空缺（不动 booked/held/blocked）
    regenerateSlotsForRange(venueId, 0, 6);
  }

  return wait({ ok: true, venue: v });
}

export async function setVenueStatus(
  venueId: string,
  status: "active" | "inactive",
): Promise<{ ok: boolean }> {
  const v = store.venues.find((x) => x.id === venueId);
  if (!v) return { ok: false };
  v.status = status;
  return wait({ ok: true });
}

// —— PRD §US-203d：owner 重新提交被拒场馆
// status 从 inactive 变回 pending；清空 reviewed_* / reject_reason；刷新 submitted_at
export async function resubmitVenue(
  venueId: string,
  ownerId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const v = store.venues.find((x) => x.id === venueId);
  if (!v) return { ok: false, reason: "not_found" };
  if (v.ownerId !== ownerId) return { ok: false, reason: "not_owner" };
  if (v.status !== "inactive") return { ok: false, reason: "not_rejected" };
  v.status = "pending";
  v.submittedAt = nowIso();
  v.reviewedBy = undefined;
  v.reviewedAt = undefined;
  v.rejectReason = undefined;
  await addAuditLog({
    actorId: ownerId,
    actorRole: "owner",
    action: "venue_resubmit",
    targetType: "venues",
    targetId: v.id,
  });
  return wait({ ok: true });
}

// —— SlotTemplate CRUD（PRD §US-205）——
export async function listSlotTemplates(venueId: string): Promise<SlotTemplate[]> {
  return wait(
    store.slotTemplates
      .filter((t) => t.venueId === venueId)
      .sort((a, b) => a.timeStart.localeCompare(b.timeStart)),
  );
}

export async function createSlotTemplate(
  input: Omit<SlotTemplate, "id" | "createdAt">,
): Promise<{ ok: true; template: SlotTemplate } | { ok: false; reason: string }> {
  const v = store.venues.find((x) => x.id === input.venueId);
  if (!v) return { ok: false, reason: "venue_not_found" };
  // 校验时段在营业时段内
  if (input.timeStart < v.openTimeStart || input.timeEnd > v.openTimeEnd || input.timeStart >= input.timeEnd) {
    return { ok: false, reason: "time_out_of_range" };
  }
  // 校验 courtIds 隶属本场馆
  const courtIds = store.courts.filter((c) => c.venueId === v.id).map((c) => c.id);
  for (const cid of input.courtIds) {
    if (!courtIds.includes(cid)) return { ok: false, reason: "court_not_in_venue" };
  }
  const tpl: SlotTemplate = { ...input, id: newId(), createdAt: nowIso() };
  store.slotTemplates.push(tpl);
  // 立即触发未来 7 天滚动续期
  regenerateSlotsForRange(v.id, 0, 6);
  return wait({ ok: true, template: tpl });
}

export async function deleteSlotTemplate(templateId: string): Promise<{ ok: boolean }> {
  const idx = store.slotTemplates.findIndex((t) => t.id === templateId);
  if (idx === -1) return wait({ ok: false });
  const venueId = store.slotTemplates[idx].venueId;
  store.slotTemplates.splice(idx, 1);
  regenerateSlotsForRange(venueId, 0, 6);
  return wait({ ok: true });
}

// 滚动续期：把 [fromOffset, toOffset] 天内的 slot 按当前模板重铺（mock 阶段同步）
// 不动 booked/held/blocked 的 slot；只补 available 空缺
export function regenerateSlotsForRange(venueId: string, fromOffset: number, toOffset: number): Slot[] {
  const v = store.venues.find((x) => x.id === venueId);
  if (!v) return [];
  const courts = store.courts.filter((c) => c.venueId === venueId);
  const templates = store.slotTemplates.filter((t) => t.venueId === venueId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existingIds = new Set(store.slots.filter((s) => s.venueId === venueId).map((s) => s.id));
  const added: Slot[] = [];
  for (let d = fromOffset; d <= toOffset; d++) {
    const dayMs = today.getTime() + d * 24 * 60 * 60 * 1000;
    const slots = expandTemplatesForDay(v, templates, courts, dayMs);
    for (const s of slots) {
      if (existingIds.has(s.id)) continue;
      store.slots.push(s);
      added.push(s);
    }
  }
  return added;
}
