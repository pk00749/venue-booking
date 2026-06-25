// 管理后台（4 页合一） —— IG 风
//   1) Dashboard：eyebrow + 9 个 stat 卡（白底圆角 + emoji）+ Top Venues 列表
//   2) OwnerApps：tabs（rounded-full chip + IG 渐变 active）+ 列表行
//   3) SensitiveWords：白底 card 添加条 + 列表（divide-y 表格）
//   4) PendingBookings：白底 card 列表 + 批准/拒绝
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession, useUi } from "@/lib/store";
import { store } from "@/lib/mock-data";
import { formatCourtName, formatDateTime } from "@/lib/format";
import {
  getDashboardStats,
  listSensitiveWords,
  addSensitiveWord,
  toggleSensitiveWord,
  deleteSensitiveWord,
  listAllPendingBookings,
} from "@/features/admin/api";
import { listOwnerApps, reviewOwnerApp } from "@/features/owner/api";
import { reviewBooking } from "@/features/bookings/api";
import type { OwnerAppStatus } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-canvas-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder-ink-400 transition focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-200";

const selectCls = inputCls;

function ownerAppStatusChip(s: OwnerAppStatus): string {
  if (s === "approved") return "bg-football-light text-football-dark";
  if (s === "rejected") return "bg-squash-light text-squash-dark";
  return "bg-hoops-light text-hoops-dark";
}

// 1) Admin Dashboard
export function AdminDashboardPage() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useQuery({ queryKey: ["dashboard-stats"], queryFn: getDashboardStats });
  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/3 animate-pulse rounded-xl bg-canvas-100" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-canvas-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <header>
        <p className="ig-eyebrow text-ink-500">DASHBOARD</p>
        <h1 className="mt-1 font-display text-3xl text-ink-800 sm:text-4xl">{t("admin.dashboard")}</h1>
        <p className="mt-1 text-sm text-ink-500">{t("admin.dashboardSubtitle")}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard icon="👥" label={t("admin.dau")} value={stats.dau} />
        <StatCard icon="📈" label={t("admin.wau")} value={stats.wau} />
        <StatCard icon="🌐" label={t("admin.mau")} value={stats.mau} />
        <StatCard icon="🏛️" label={t("admin.pendingOwners")} value={stats.pendingOwners} hint={t("admin.todo")} />
        <StatCard icon="📋" label={t("admin.pendingBookings")} value={stats.pendingBookings} hint={t("admin.todo")} />
        <StatCard icon="🆕" label={t("admin.newUsers7d")} value={stats.newUsers7d} />
        <StatCard icon="📅" label={t("admin.newBookings7d")} value={stats.newBookings7d} />
        <StatCard icon="✅" label={t("admin.completedBookings7d")} value={stats.completedBookings7d} />
        <StatCard icon="❌" label={t("admin.cancelRate7d")} value={`${(stats.cancelRate7d * 100).toFixed(1)}%`} />
      </div>

      <section className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm sm:p-6">
        <p className="ig-eyebrow text-ink-500">TOP VENUES</p>
        <h2 className="mt-0.5 font-display text-xl text-ink-800">{t("admin.topVenues")}</h2>
        {stats.topVenues.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">—</p>
        ) : (
          <ol className="mt-4 divide-y divide-canvas-200">
            {stats.topVenues.map(({ venue, count }, idx) => (
              <li key={venue.id} className="flex items-center justify-between py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas-100 font-mono text-xs text-ink-700">
                    {idx + 1}
                  </span>
                  <span className="truncate text-sm font-medium text-ink-800">{venue.name}</span>
                </div>
                <span className="shrink-0 text-sm text-ink-500">
                  {count} {t("admin.bookingsCount")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, hint, icon }: { label: string; value: string | number; hint?: string; icon?: string }) {
  return (
    <div className="rounded-2xl border border-canvas-200 bg-white p-4 shadow-softSm transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="ig-eyebrow text-ink-500">{label}</p>
          <p className="mt-1 font-display text-2xl text-ink-800">{value}</p>
          {hint && <p className="mt-0.5 text-[11px] text-ink-500">{hint}</p>}
        </div>
        {icon && <div className="text-2xl opacity-80" aria-hidden>{icon}</div>}
      </div>
    </div>
  );
}

// 2) Admin Owner Apps
export function AdminOwnerAppsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<OwnerAppStatus>("pending");
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["admin-owner-apps", tab],
    queryFn: () => listOwnerApps(tab),
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="ig-eyebrow text-ink-500">OWNER APPS</p>
        <h1 className="mt-1 font-display text-3xl text-ink-800 sm:text-4xl">{t("admin.ownerApps")}</h1>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={
              tab === k
                ? "ig-stripe rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-softSm"
                : "rounded-full border border-canvas-200 bg-white px-4 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-canvas-50"
            }
          >
            {t(`status.${k}`)}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-canvas-200 bg-white shadow-softSm">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-canvas-100" />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-3xl">📭</div>
            <p className="ig-eyebrow mt-2 text-ink-500">EMPTY</p>
            <p className="mt-1 text-sm font-medium text-ink-700">{t("admin.emptyApps")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-canvas-200">
            {apps.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink-800">{a.realName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ownerAppStatusChip(a.status)}`}>
                      {t(`status.${a.status === "approved" ? "confirmed" : a.status === "rejected" ? "rejected" : "pending"}`)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-ink-500">
                    📞 {a.contactPhone} · 🆔 {a.userId}
                  </div>
                </div>
                {a.status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() =>
                        reviewOwnerApp(a.id, "approve").then(() =>
                          qc.invalidateQueries({ queryKey: ["admin-owner-apps"] }),
                        )
                      }
                      className="ig-stripe rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-softSm transition hover:-translate-y-0.5"
                    >
                      {t("admin.approve")}
                    </button>
                    <button
                      onClick={() => {
                        const r = prompt(t("admin.rejectReason")) ?? "";
                        reviewOwnerApp(a.id, "reject", r).then(() =>
                          qc.invalidateQueries({ queryKey: ["admin-owner-apps"] }),
                        );
                      }}
                      className="rounded-full border border-squash bg-squash-light px-3.5 py-1.5 text-xs font-semibold text-squash-dark transition hover:-translate-y-0.5"
                    >
                      {t("admin.reject")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// 3) Admin Sensitive Words
export function AdminSensitiveWordsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const me = useSession((s) => s.user);
  const [word, setWord] = useState("");
  const [severity, setSeverity] = useState<"block" | "review">("block");
  const { data: words = [], isLoading } = useQuery({ queryKey: ["sensitive-words"], queryFn: listSensitiveWords });

  const addM = useMutation({
    mutationFn: () => addSensitiveWord({ word, severity, createdBy: me?.id ?? "u_admin" }),
    onSuccess: () => {
      setWord("");
      qc.invalidateQueries({ queryKey: ["sensitive-words"] });
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="ig-eyebrow text-ink-500">SENSITIVE WORDS</p>
        <h1 className="mt-1 font-display text-3xl text-ink-800 sm:text-4xl">{t("admin.sensitiveWords")}</h1>
      </header>

      <section className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="text-xs font-medium text-ink-600">{t("admin.word")}</label>
            <input value={word} onChange={(e) => setWord(e.target.value)} className={inputCls + " mt-1"} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">{t("admin.severity")}</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as "block" | "review")}
              className={selectCls + " mt-1"}
            >
              <option value="block">{t("admin.block")}</option>
              <option value="review">{t("admin.review")}</option>
            </select>
          </div>
          <button
            onClick={() => addM.mutate()}
            disabled={!word}
            className="ig-stripe rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-softSm transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {t("admin.addWord")}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-canvas-200 bg-white shadow-softSm">
        {isLoading ? (
          <div className="p-5">
            <div className="h-12 animate-pulse rounded-xl bg-canvas-100" />
          </div>
        ) : words.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-3xl">📋</div>
            <p className="ig-eyebrow mt-2 text-ink-500">EMPTY</p>
            <p className="mt-1 text-sm font-medium text-ink-700">{t("admin.emptyWords")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-canvas-50 text-ink-600">
              <tr>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">{t("admin.word")}</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">{t("admin.severity")}</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">{t("common.status")}</th>
                <th className="p-3 text-right text-xs font-semibold uppercase tracking-wide">{t("common.actionsLabel")}</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w) => (
                <tr key={w.id} className="border-t border-canvas-200 transition hover:bg-canvas-50">
                  <td className="p-3 font-mono text-ink-800">{w.word}</td>
                  <td className="p-3">
                    <span
                      className={
                        w.severity === "block"
                          ? "rounded-full bg-squash-light px-2 py-0.5 text-[10px] font-semibold text-squash-dark"
                          : "rounded-full bg-hoops-light px-2 py-0.5 text-[10px] font-semibold text-hoops-dark"
                      }
                    >
                      {t(`admin.${w.severity}`)}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() =>
                        toggleSensitiveWord(w.id).then(() =>
                          qc.invalidateQueries({ queryKey: ["sensitive-words"] }),
                        )
                      }
                      className={
                        w.isActive
                          ? "rounded-full bg-football-light px-2 py-0.5 text-[10px] font-semibold text-football-dark"
                          : "rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-700"
                      }
                    >
                      {w.isActive ? t("admin.active") : t("admin.inactive")}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() =>
                        deleteSensitiveWord(w.id).then(() =>
                          qc.invalidateQueries({ queryKey: ["sensitive-words"] }),
                        )
                      }
                      className="rounded-full border border-squash bg-squash-light px-3 py-1 text-xs font-semibold text-squash-dark transition hover:-translate-y-0.5"
                    >
                      {t("admin.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// 4) Admin Pending Bookings
export function AdminPendingBookingsPage() {
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const qc = useQueryClient();
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["admin-pending-bookings"],
    queryFn: listAllPendingBookings,
  });
  return (
    <div className="space-y-6">
      <header>
        <p className="ig-eyebrow text-ink-500">PENDING BOOKINGS</p>
        <h1 className="mt-1 font-display text-3xl text-ink-800 sm:text-4xl">{t("admin.pendingBookings")}</h1>
      </header>

      <section className="rounded-2xl border border-canvas-200 bg-white shadow-softSm">
        {isLoading ? (
          <div className="p-5">
            <div className="h-12 animate-pulse rounded-xl bg-canvas-100" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-3xl">✨</div>
            <p className="ig-eyebrow mt-2 text-ink-500">ALL CLEAR</p>
            <p className="mt-1 text-sm font-medium text-ink-700">{t("admin.emptyPending")}</p>
            <p className="mt-1 text-xs text-ink-500">{t("admin.emptyPendingBody")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-canvas-200">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink-800">
                    {store.venues.find((v) => v.id === b.venueId)?.name}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-500">
                    {b.slotIds
                      .map((sid) => {
                        const sl = store.slots.find((s) => s.id === sid);
                        if (!sl) return null;
                        const court = store.courts.find((c) => c.id === sl.courtId);
                        const courtName = court ? formatCourtName(court, locale) : "—";
                        return `${formatDateTime(sl.startsAt, locale)} · ${t("admin.court")} ${courtName}`;
                      })
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="mt-1 text-xs text-ink-500">
                    👤 {b.contactName} · 📞 {b.contactPhone}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() =>
                      reviewBooking(b.id, "confirm").then(() =>
                        qc.invalidateQueries({ queryKey: ["admin-pending-bookings"] }),
                      )
                    }
                    className="ig-stripe rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-softSm transition hover:-translate-y-0.5"
                  >
                    {t("admin.approve")}
                  </button>
                  <button
                    onClick={() =>
                      reviewBooking(b.id, "reject").then(() =>
                        qc.invalidateQueries({ queryKey: ["admin-pending-bookings"] }),
                      )
                    }
                    className="rounded-full border border-squash bg-squash-light px-3.5 py-1.5 text-xs font-semibold text-squash-dark transition hover:-translate-y-0.5"
                  >
                    {t("admin.reject")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
