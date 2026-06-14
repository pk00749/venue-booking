import { store, newId, nowIso } from "@/lib/mock-data";
import type { Profile, Role } from "@/lib/types";
import { checkSensitive } from "@/lib/sensitive";

const wait = <T,>(v: T, ms = 100): Promise<T> => new Promise((r) => setTimeout(() => r(v), ms));

export async function login(email: string, _password: string): Promise<Profile | null> {
  if (!email) return null;
  let u = store.profiles.find((p) => p.email === email);
  if (!u) {
    // 自动建一个 user 角色账号
    u = {
      id: newId(),
      email,
      nickname: email.split("@")[0],
      role: "user",
      locale: "zh-CN",
      createdAt: nowIso(),
    };
    store.profiles.push(u);
  }
  return wait(u);
}

export async function signup(email: string, _password: string, nickname: string, role: Role = "user"): Promise<Profile | null> {
  if (!email) return null;
  const hits = checkSensitive(nickname);
  if (hits.some((h) => h.severity === "block")) return null;
  const existing = store.profiles.find((p) => p.email === email);
  if (existing) return wait(existing);
  const p: Profile = {
    id: newId(),
    email,
    nickname: nickname || email.split("@")[0],
    role,
    locale: "zh-CN",
    createdAt: nowIso(),
  };
  store.profiles.push(p);
  return wait(p);
}

export async function getProfile(id: string): Promise<Profile | null> {
  return wait(store.profiles.find((p) => p.id === id) ?? null);
}
