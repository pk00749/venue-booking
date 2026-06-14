// Layout — Instagram 风：白底 sticky nav、1px 浅灰底线、圆形渐变 ring logo、
// 文字 nav、底部 1px 分割。颜色用 ink/canvas 三阶灰。
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSession } from "@/lib/store";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Button, Badge } from "./ui";
import clsx from "clsx";

const ROLE_TONE = {
  user: "info",
  owner: "success",
  admin: "warn",
} as const;

function BrandMark() {
  // IG 渐变环 + 中心 emoji 球点
  return (
    <span className="relative flex h-9 w-9 items-center justify-center rounded-full ig-stripe p-[2px]">
      <span className="flex h-full w-full items-center justify-center rounded-full bg-canvas-50 text-base">
        <span className="leading-none">🏟️</span>
      </span>
    </span>
  );
}

export function Layout() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const switchRole = useSession((s) => s.switchRole);
  const navigate = useNavigate();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "px-1 py-3 text-[13px] font-semibold tracking-tight transition",
      isActive
        ? "text-ink-800"
        : "text-ink-500 hover:text-ink-800"
    );

  return (
    <div className="min-h-screen bg-canvas text-ink-800 flex flex-col">
      <header className="sticky top-0 z-20 bg-canvas-50/90 backdrop-blur border-b border-ink-300">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-5">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-[20px] font-extrabold tracking-tighter text-ink-800">
              {t("app.name")}
            </span>
            <span className="hidden md:inline-block text-[12px] text-ink-500 font-medium pl-2 ml-1 border-l border-ink-300">
              {t("app.tagline")}
            </span>
          </Link>

          {/* 中央 nav：IG 风下划线 */}
          <nav className="flex items-center gap-5 ml-3">
            <NavLink to="/" end className={navClass}>
              {({ isActive }) => (
                <span className="inline-flex items-center gap-1.5">
                  {t("nav.home")}
                  {isActive && <span className="h-1 w-1 rounded-full bg-ink-800" />}
                </span>
              )}
            </NavLink>
            <NavLink to="/venues" className={navClass}>
              {({ isActive }) => (
                <span className="inline-flex items-center gap-1.5">
                  {t("nav.venues")}
                  {isActive && <span className="h-1 w-1 rounded-full bg-ink-800" />}
                </span>
              )}
            </NavLink>
            {user && (
              <NavLink to="/my-bookings" className={navClass}>
                {({ isActive }) => (
                  <span className="inline-flex items-center gap-1.5">
                    {t("nav.myBookings")}
                    {isActive && <span className="h-1 w-1 rounded-full bg-ink-800" />}
                  </span>
                )}
              </NavLink>
            )}
            {user?.role === "user" && (
              <NavLink to="/become-owner" className={navClass}>
                {t("nav.becomeOwner")}
              </NavLink>
            )}
            {user?.role === "owner" && (
              <NavLink to="/owner" className={navClass}>
                {t("nav.ownerConsole")}
              </NavLink>
            )}
            {user?.role === "admin" && (
              <NavLink to="/admin" className={navClass}>
                {t("nav.admin")}
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <LocaleSwitcher />
            {user ? (
              <>
                <div className="hidden md:flex items-center gap-2">
                  <Badge tone={ROLE_TONE[user.role]}>{t(`common.${user.role}`)}</Badge>
                  <span className="text-ink-500 max-w-[140px] truncate text-[12px]">
                    {user.email}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUser(null)}
                  className="text-[12px] font-semibold text-ink-700 hover:text-ink-800"
                >
                  {t("nav.logout")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/login")}
                  className="text-[13px] font-semibold text-ink-700 hover:text-ink-800"
                >
                  {t("nav.login")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/signup")}
                  className="text-[13px] font-semibold rounded-lg ig-stripe text-white px-4 py-2 hover:opacity-90 transition"
                >
                  {t("nav.signup")}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 角色切换：IG 风圆点 chip，置于 nav 下方第二条 */}
        {user && (
          <div className="border-t border-ink-300 bg-canvas-50">
            <div className="max-w-5xl mx-auto px-4 h-10 flex items-center gap-2">
              <span className="text-[11px] font-medium text-ink-500">
                {t("nav.switchRole")}:
              </span>
              {(["user", "owner", "admin"] as const).map((r) => {
                const active = user.role === r;
                return (
                  <button
                    key={r}
                    onClick={() => switchRole(r)}
                    className={clsx(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition border",
                      active
                        ? `border-ink-800 bg-ink-800 text-canvas-50`
                        : "border-ink-300 text-ink-600 hover:border-ink-500 hover:text-ink-800"
                    )}
                  >
                    <span className={clsx(
                      "h-1.5 w-1.5 rounded-full",
                      { "bg-squash":   r === "user",
                        "bg-football": r === "owner",
                        "bg-hoops":    r === "admin" }
                    )} />
                    {t(`common.${r}`)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-ink-300 bg-canvas-50 mt-12">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrandMark />
              <span className="text-[13px] font-semibold text-ink-700">
                {t("app.name")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-ink-500">
              <span>© {new Date().getFullYear()}</span>
              <span>·</span>
              <span>v0.3.0</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-squash" />
            <span className="h-2 w-2 rounded-full bg-football" />
            <span className="h-2 w-2 rounded-full bg-hoops" />
            <span className="ml-1 text-[11px] text-ink-500">
              03 SPORTS · {t("app.tagline")}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
