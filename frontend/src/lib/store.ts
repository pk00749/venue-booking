// 全局客户端状态：当前登录用户、UI 偏好（语言、通知面板等）
// 仅放客户端状态；服务端状态统一走 TanStack Query
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Locale, Profile, Role } from "./types";

interface SessionState {
  user: Profile | null;
  setUser: (u: Profile | null) => void;
  switchRole: (role: Role) => void; // 演示用：mock 角色切换
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (u) => set({ user: u }),
      switchRole: (role) =>
        set((s) => (s.user ? { user: { ...s.user, role } } : s)),
    }),
    { name: "vb_session", storage: createJSONStorage(() => localStorage) }
  )
);

interface UiState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      locale: "zh-CN",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "vb_ui", storage: createJSONStorage(() => localStorage) }
  )
);
