// 场馆相关 Mock API —— 后续替换为 supabase.from('venues').select(...)
import { store, newId, nowIso } from "@/lib/mock-data";
import { checkSensitive } from "@/lib/sensitive";
import { courtLetter } from "@/lib/mock-data";
import type { Court, Slot, SportType, Venue, VenueService } from "@/lib/types";

const wait = <T,>(value: T, ms = 150): Promise<T> =>
  new Promise((res) => setTimeout(() => res(value), ms));

export interface VenueFilters {
  sportType?: SportType | "all";
  keyword?: string;
  city?: string;
  district?: string;
  date?: string; // YYYY-MM-DD; if set, only venues with >=1 free slot on that day
}

export async function listVenues(filters: VenueFilters = {}): Promise<Venue[]> {
  let rows = store.venues.filter((v) => v.status === "active");
  if (filters.sportType && filters.sportType !== "all") {
    rows = rows.filter((v) => v.sportType === filters.sportType);
  }
  if (filters.city) {
    const c = filters.city;
    rows = rows.filter((v) => parseCity(v.address) === c);
  }
  if (filters.district) {
    const d = filters.district;
    rows = rows.filter((v) => parseDistrict(v.address) === d);
  }
  if (filters.keyword) {
    const k = filters.keyword.toLowerCase();
    rows = rows.filter(
      (v) => v.name.toLowerCase().includes(k) || v.address.toLowerCase().includes(k)
    );
  }
  if (filters.date) {
    const iso = filters.date;
    rows = rows.filter((v) => hasFreeSlotOnDate(v.id, iso));
  }
  return wait(rows);
}

// 简易地址解析：地址模板形如 "上海市浦东新区前滩大道 18 号 B1"
// —— Supabase 接入后应改为 venue.city / venue.district 字段，此处仅 mock 兜底。
export function parseCity(address: string): string {
  const m = address.match(/^(上海市|北京市|广州市|深圳市|杭州市|成都市|重庆市|武汉市|南京市|苏州市|西安市|天津市)/);
  return m ? m[1] : "";
}
export function parseDistrict(address: string): string {
  const m = address.match(/^(?:上海市|北京市|广州市|深圳市|杭州市|成都市|重庆市|武汉市|南京市|苏州市|西安市|天津市)([\u4e00-\u9fa5]{2,4}区)/);
  return m ? m[1] : "";
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
  address: string;
  description: string;
  openTimeStart: string;
  openTimeEnd: string;
  slotDurationMinutes: 30 | 60 | 90 | 120;
  requireApproval: boolean;
  cancelHours: number;
  basePriceCents: number;
  capacity: number;
  notes?: string;
  courts?: { name_zh: string; name_en: string }[]; // v3：场地（按行对齐，单边缺失时回退到自动字母）
}

export async function createVenue(input: CreateVenueInput): Promise<{ ok: true; venue: Venue } | { ok: false; words: string[] }> {
  // PRD §9：name/description/address 走敏感词
  const hits = [
    ...checkSensitive(input.name),
    ...checkSensitive(input.description),
    ...checkSensitive(input.address),
    ...(input.notes ? checkSensitive(input.notes) : []),
  ];
  const blocked = hits.filter((h) => h.severity === "block").map((h) => h.word);
  if (blocked.length) return { ok: false, words: blocked };
  const v: Venue = {
    id: newId(),
    ownerId: input.ownerId,
    name: input.name,
    sportType: input.sportType,
    address: input.address,
    description: input.description,
    images: [],
    openTimeStart: input.openTimeStart,
    openTimeEnd: input.openTimeEnd,
    slotDurationMinutes: input.slotDurationMinutes,
    requireApproval: input.requireApproval,
    cancelHours: input.cancelHours,
    basePriceCents: input.basePriceCents,
    status: "active",
    createdAt: nowIso(),
    capacity: input.capacity,
    notes: input.notes,
  };
  store.venues.push(v);
  // v3：先建 courts，再为每片 court 生成 slot
  const courtInputs = input.courts && input.courts.length > 0
    ? input.courts
    : [0, 1, 2, 3].map((i) => ({ name_zh: `${courtLetter(i)} 场`, name_en: `Court ${courtLetter(i)}` }));
  const max = Math.max(
    ...courtInputs.map((c) => [c.name_zh.trim(), c.name_en.trim()].filter(Boolean).length),
  );
  const courts: Court[] = courtInputs.map((c, i) => ({
    id: `c_${v.id}_${i}`,
    venueId: v.id,
    name_zh: c.name_zh.trim() || `${courtLetter(i)} 场`,
    name_en: c.name_en.trim() || `Court ${courtLetter(i)}`,
    sortOrder: i,
    capacity: v.capacity,
    isActive: true,
    createdAt: nowIso(),
  }));
  // 容错：如果用户只填了一边的某些行，按行数对齐裁剪
  for (let i = 0; i < max; i++) {
    if (!courts[i]) {
      courts.push({
        id: `c_${v.id}_${i}`,
        venueId: v.id,
        name_zh: `${courtLetter(i)} 场`,
        name_en: `Court ${courtLetter(i)}`,
        sortOrder: i,
        capacity: v.capacity,
        isActive: true,
        createdAt: nowIso(),
      });
    }
  }
  store.courts.push(...courts);
  // 同步为每片 court 生成 7 天 × 营业时段内的 slot
  const step = v.slotDurationMinutes;
  const [sh, sm] = v.openTimeStart.split(":").map(Number);
  const [eh, em] = v.openTimeEnd.split(":").map(Number);
  for (let d = 0; d < 7; d++) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + d);
    const start = new Date(day);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(day);
    end.setHours(eh, em, 0, 0);
    for (const court of courts) {
      for (let t = new Date(start); t.getTime() + step * 60_000 <= end.getTime(); t = new Date(t.getTime() + step * 60_000)) {
        const ts = new Date(t);
        const te = new Date(t.getTime() + step * 60_000);
        store.slots.push({
          id: `sl_${court.id}_${ts.getTime()}`,
          venueId: v.id,
          courtId: court.id,
          startsAt: ts.toISOString(),
          endsAt: te.toISOString(),
          status: "available",
          capacity: court.capacity,
          confirmedCount: 0,
        });
      }
    }
  }
  return wait({ ok: true, venue: v });
}

export async function listVenuesByOwner(ownerId: string): Promise<Venue[]> {
  return wait(store.venues.filter((v) => v.ownerId === ownerId));
}
