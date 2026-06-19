// 场地相关 Mock API —— 后续替换为 supabase.from('venues').select(...)
import { store, newId, nowIso } from "@/lib/mock-data";
import { checkSensitive } from "@/lib/sensitive";
import type { SportType, Venue, VenueService } from "@/lib/types";

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

/**
 * 取某个场地接下来 N 个「仍有空位」的可订日期（YYYY-MM-DD）。
 * 用于场地列表的「最近 3 个可订日期」展示。
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
  // 同步生成 slot
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
    for (let t = new Date(start); t.getTime() + step * 60_000 <= end.getTime(); t = new Date(t.getTime() + step * 60_000)) {
      const ts = new Date(t);
      const te = new Date(t.getTime() + step * 60_000);
      store.slots.push({
        id: `sl_${v.id}_${ts.getTime()}`,
        venueId: v.id,
        startsAt: ts.toISOString(),
        endsAt: te.toISOString(),
        status: "available",
        capacity: v.capacity,
        confirmedCount: 0,
      });
    }
  }
  return wait({ ok: true, venue: v });
}

export async function listVenuesByOwner(ownerId: string): Promise<Venue[]> {
  return wait(store.venues.filter((v) => v.ownerId === ownerId));
}
