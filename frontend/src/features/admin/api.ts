import { store, newId, nowIso } from "@/lib/mock-data";
import type { Booking, SensitiveWord, Venue } from "@/lib/types";

const wait = <T,>(v: T, ms = 100): Promise<T> => new Promise((r) => setTimeout(() => r(v), ms));

// 看板指标（MVP 用 mock 计算）
export interface DashboardStats {
  dau: number; wau: number; mau: number;
  newUsers7d: number;
  newBookings7d: number;
  completedBookings7d: number;
  cancelRate7d: number; // 0-1
  pendingOwners: number;
  pendingBookings: number;
  topVenues: { venue: Venue; count: number }[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const since = Date.now() - 7 * 86400_000;
  const newBookings7d = store.bookings.filter((b) => new Date(b.createdAt).getTime() >= since);
  const completed = newBookings7d.filter((b) => b.status === "completed").length;
  const cancelled = newBookings7d.filter((b) => b.status === "cancelled").length;
  const total = newBookings7d.length || 1;
  const topMap = new Map<string, number>();
  for (const b of store.bookings) topMap.set(b.venueId, (topMap.get(b.venueId) ?? 0) + 1);
  const topVenues = [...topMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([vid, count]) => ({ venue: store.venues.find((v) => v.id === vid)!, count }))
    .filter((x) => x.venue);

  return wait({
    dau: 12, wau: 58, mau: 134,
    newUsers7d: store.profiles.filter((p) => new Date(p.createdAt).getTime() >= since).length,
    newBookings7d: newBookings7d.length,
    completedBookings7d: completed,
    cancelRate7d: cancelled / total,
    pendingOwners: store.ownerApps.filter((a) => a.status === "pending").length,
    pendingBookings: store.bookings.filter((b) => b.status === "pending").length,
    topVenues,
  });
}

export async function listSensitiveWords(): Promise<SensitiveWord[]> {
  return wait([...store.words]);
}

export async function addSensitiveWord(input: { word: string; severity: "block" | "review"; note?: string; createdBy: string }): Promise<SensitiveWord> {
  const w: SensitiveWord = {
    id: newId(),
    word: input.word,
    severity: input.severity,
    note: input.note,
    isActive: true,
    createdBy: input.createdBy,
    createdAt: nowIso(),
  };
  store.words.push(w);
  return wait(w);
}

export async function toggleSensitiveWord(id: string): Promise<{ ok: boolean }> {
  const w = store.words.find((x) => x.id === id);
  if (!w) return { ok: false };
  w.isActive = !w.isActive;
  return wait({ ok: true });
}

export async function deleteSensitiveWord(id: string): Promise<{ ok: boolean }> {
  const idx = store.words.findIndex((x) => x.id === id);
  if (idx < 0) return { ok: false };
  store.words.splice(idx, 1);
  return wait({ ok: true });
}

export async function listAllPendingBookings(): Promise<Booking[]> {
  return wait(store.bookings.filter((b) => b.status === "pending"));
}
