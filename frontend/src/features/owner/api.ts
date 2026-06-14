import { store, newId, nowIso } from "@/lib/mock-data";
import type { OwnerApplication } from "@/lib/types";

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
