import { store, newId, nowIso } from "@/lib/mock-data";
import type { OwnerApplication } from "@/lib/types";

// 场主看板（PRD §US-207）：仅看本场地的运营数据
// - todayCount：今日（本地时区）"有场要打" 的预订数（按 booking.slotIds 任一 slot.startsAt ∈ today 计数）
// - completionRate7d / cancelRate7d：按 booking.createdAt 7 日窗口对齐 admin 看板口径
//   （completed / total、cancelled / total；total = 该窗口内总预订，含 pending/confirmed 等中间态）
export interface OwnerDashboardStats {
  todayCount: number;
  completionRate7d: number; // 0-1
  cancelRate7d: number; // 0-1
}

export async function getOwnerDashboardStats(ownerId: string): Promise<OwnerDashboardStats> {
  const venueIds = new Set(
    store.venues.filter((v) => v.ownerId === ownerId).map((v) => v.id),
  );
  const ownerBookings = store.bookings.filter((b) => venueIds.has(b.venueId));

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86400_000;
  const todayCount = ownerBookings.filter((b) =>
    b.slotIds.some((sid) => {
      const sl = store.slots.find((s) => s.id === sid);
      if (!sl) return false;
      const t = new Date(sl.startsAt).getTime();
      return t >= startOfToday && t < endOfToday;
    }),
  ).length;

  const since7d = Date.now() - 7 * 86400_000;
  const recent = ownerBookings.filter((b) => new Date(b.createdAt).getTime() >= since7d);
  const total = recent.length || 1; // 0 预订时给 1 兜底，比例显示 0.0%
  const completed = recent.filter((b) => b.status === "completed").length;
  const cancelled = recent.filter((b) => b.status === "cancelled").length;

  return wait({
    todayCount,
    completionRate7d: completed / total,
    cancelRate7d: cancelled / total,
  });
}

const wait = <T,>(v: T, ms = 100): Promise<T> => new Promise((r) => setTimeout(() => r(v), ms));

export interface SubmitOwnerAppInput {
  userId: string;
  realName: string;
  idCardNo: string;
  contactPhone: string;
  licenseUrl?: string;
}

export async function submitOwnerApplication(input: SubmitOwnerAppInput): Promise<OwnerApplication> {
  const app: OwnerApplication = {
    id: newId(),
    userId: input.userId,
    realName: input.realName,
    idCardNo: input.idCardNo,
    contactPhone: input.contactPhone,
    licenseUrl: input.licenseUrl,
    status: "pending",
    createdAt: nowIso(),
  };
  store.ownerApps.push(app);
  return wait(app);
}

export async function listMyOwnerApp(userId: string): Promise<OwnerApplication | null> {
  return wait(
    [...store.ownerApps].reverse().find((a) => a.userId === userId) ?? null
  );
}

export async function listOwnerApps(status?: "pending" | "approved" | "rejected"): Promise<OwnerApplication[]> {
  let rows = [...store.ownerApps].reverse();
  if (status) rows = rows.filter((a) => a.status === status);
  return wait(rows);
}

export async function reviewOwnerApp(appId: string, action: "approve" | "reject", reason?: string): Promise<{ ok: boolean }> {
  const a = store.ownerApps.find((x) => x.id === appId);
  if (!a) return { ok: false };
  a.status = action === "approve" ? "approved" : "rejected";
  a.rejectReason = action === "reject" ? reason : undefined;
  a.reviewedAt = nowIso();
  a.reviewedBy = "u_admin";
  if (action === "approve") {
    const u = store.profiles.find((p) => p.id === a.userId);
    if (u) u.role = "owner";
  }
  store.notifications.push({
    id: newId(),
    userId: a.userId,
    type: action === "approve" ? "owner.approved" : "owner.rejected",
    title: action === "approve" ? "场主入驻通过" : "场主入驻被拒",
    body: reason ?? "",
    payload: { applicationId: a.id },
    createdAt: nowIso(),
  });
  return wait({ ok: true });
}
