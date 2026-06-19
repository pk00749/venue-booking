// 路由表 + 角色守卫
// 公开路由：/、/venues、/venues/:id、/login、/signup
// 需登录：/venues/:id/book、/my-bookings、/become-owner
// 需 owner：/owner
// 需 admin：/admin 及其子页
// 守卫失败一律 redirect；不在守卫层做"无权限"展示，避免和 PRD §10 状态机冲突
import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { Card, Button } from "@/components/ui";
import { useSession } from "@/lib/store";
import type { Role } from "@/lib/types";

import { HomePage } from "@/pages/HomePage";
import { VenuesPage } from "@/pages/VenuesPage";
import { VenueDetailPage } from "@/pages/VenueDetailPage";
import { BookingPage } from "@/pages/BookingPage";
import { MyBookingsPage } from "@/pages/MyBookingsPage";
import { LoginPage, SignupPage } from "@/pages/AuthPages";
import { BecomeOwnerPage } from "@/pages/BecomeOwnerPage";
import { OwnerConsolePage } from "@/pages/OwnerConsolePage";
import {
  AdminDashboardPage,
  AdminOwnerAppsPage,
  AdminSensitiveWordsPage,
  AdminPendingBookingsPage,
} from "@/pages/AdminPages";

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const user = useSession((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-md mx-auto">
      <Card className="p-8 text-center space-y-3">
        <div className="text-5xl font-bold text-slate-300">404</div>
        <h1 className="text-xl font-semibold">{t("common.notFoundTitle")}</h1>
        <p className="text-sm text-slate-500">{t("common.notFoundBody")}</p>
        <Link to="/">
          <Button className="mt-2">{t("common.backHome")}</Button>
        </Link>
      </Card>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/venues" element={<VenuesPage />} />
        <Route path="/venues/:id" element={<VenueDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route
          path="/venues/:id/book"
          element={
            <RequireAuth>
              <BookingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/my-bookings"
          element={
            <RequireRole role="user">
              <MyBookingsPage />
            </RequireRole>
          }
        />
        <Route
          path="/become-owner"
          element={
            <RequireAuth>
              <BecomeOwnerPage />
            </RequireAuth>
          }
        />

        <Route
          path="/owner"
          element={
            <RequireRole role="owner">
              <OwnerConsolePage />
            </RequireRole>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireRole role="admin">
              <AdminDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/owners"
          element={
            <RequireRole role="admin">
              <AdminOwnerAppsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/words"
          element={
            <RequireRole role="admin">
              <AdminSensitiveWordsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/bookings"
          element={
            <RequireRole role="admin">
              <AdminPendingBookingsPage />
            </RequireRole>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
