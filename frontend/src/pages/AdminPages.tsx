// 管理后台（4 页合一） —— IG 风
//   1) Dashboard：eyebrow + 9 个 stat 卡（白底圆角 + emoji）+ Top Venues 列表
//   2) OwnerApps：tabs（rounded-full chip + IG 渐变 active）+ 列表行
//   3) SensitiveWords：白底 card 添加条 + 列表（divide-y 表格）
//   4) PendingBookings：白底 card 列表 + 批准/拒绝
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession, useUi } from "@/lib/store";
import { store } from "@/lib/mock-data";
import { formatCourtName, formatDateTime } from "@/lib/format";
import {
  listSensitiveWords,
  addSensitiveWord,
  toggleSensitiveWord,
  deleteSensitiveWord,
  bulkAddSensitiveWords,
  listAllPendingBookings,
  listAuditLogs,
} from "@/features/admin/api";
import { dashboardStatsEdge, clearDashboardStatsCache } from "@/lib/edge-functions/dashboard-stats";
import { listOwnerApps, reviewOwnerApp } from "@/features/owner/api";
import { reviewBooking } from "@/features/bookings/api";
import { StatCard } from "@/components/ui";
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
  const { data: stats, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardStatsEdge,
    staleTime: 60_000,
  });
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
        <p className="mt-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-wide text-ink-400">
          <span>via dashboard-stats · 60s cache</span>
          {dataUpdatedAt > 0 && (
            <span className="text-ink-500">
              · {t("admin.lastSynced", { s: Math.max(0, Math.floor((Date.now() - dataUpdatedAt) / 1000)) })}
            </span>
          )}
          <button
            type="button"
            onClick={() => clearDashboardStatsCache()}
            className="rounded-full border border-canvas-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-ink-600 transition hover:bg-canvas-50"
          >
            {t("admin.invalidateCache")}
          </button>
        </p>
      </header>

      <AdminTabs />

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

      <AdminTabs />

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

  // —— US-302 批量导入 ——
  const [csvText, setCsvText] = useState("");
  const [csvSeverity, setCsvSeverity] = useState<"block" | "review">("block");
  const [csvResult, setCsvResult] = useState<{ added: number; skipped: number } | null>(null);

  const parseCsv = (text: string, defaultSeverity: "block" | "review") => {
    const out: { word: string; severity: "block" | "review"; note?: string }[] = [];
    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      // 去掉 UTF-8 BOM
      const clean = line.replace(/^\uFEFF/, "");
      const parts = clean.split(",").map((p) => p.trim());
      if (parts.length === 0 || !parts[0]) continue;
      const sevRaw = (parts[1] ?? "").toLowerCase();
      const sev: "block" | "review" = sevRaw === "review" ? "review" : "block";
      out.push({
        word: parts[0],
        severity: sev === "review" ? "review" : defaultSeverity,
        note: parts[2] || undefined,
      });
    }
    return out;
  };
  const parsedCsvRows = parseCsv(csvText, csvSeverity);

  const csvImportM = useMutation({
    mutationFn: () => bulkAddSensitiveWords(parsedCsvRows, me?.id ?? "u_admin"),
    onSuccess: (r) => {
      setCsvResult(r);
      setCsvText("");
      qc.invalidateQueries({ queryKey: ["sensitive-words"] });
    },
  });

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

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

      <AdminTabs />

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

      <section className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm sm:p-6">
        <p className="ig-eyebrow text-ink-500">CSV IMPORT</p>
        <h2 className="mt-0.5 font-display text-xl text-ink-800">{t("admin.csvImportTitle")}</h2>
        <p className="mt-1 text-xs text-ink-500">{t("admin.csvImportHint")}</p>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-ink-600">{t("admin.csvFile")}</label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleCsvFile}
              className="mt-1 block w-full text-sm text-ink-700 file:mr-3 file:rounded-full file:border-0 file:bg-ink-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink-700 hover:file:bg-canvas-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">{t("admin.csvDefaultSeverity")}</label>
            <select
              value={csvSeverity}
              onChange={(e) => setCsvSeverity(e.target.value as "block" | "review")}
              className={selectCls + " mt-1"}
            >
              <option value="block">{t("admin.block")}</option>
              <option value="review">{t("admin.review")}</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="text-xs font-medium text-ink-600">{t("admin.csvPaste")}</label>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={5}
            className={inputCls + " mt-1 font-mono text-xs"}
            placeholder={"违禁词A,block,备注\n敏感词B,review\nplain_word"}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-ink-600">
            {parsedCsvRows.length > 0 ? (
              <span>{t("admin.csvPreviewCount", { n: parsedCsvRows.length })}</span>
            ) : (
              <span className="text-ink-400">{t("admin.csvPreviewEmpty")}</span>
            )}
          </div>
          <button
            onClick={() => csvImportM.mutate()}
            disabled={parsedCsvRows.length === 0 || csvImportM.isPending}
            className="ig-stripe rounded-full px-5 py-2 text-sm font-semibold text-white shadow-softSm transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {csvImportM.isPending ? t("common.importing") : t("admin.csvImportButton", { n: parsedCsvRows.length })}
          </button>
        </div>

        {csvResult && (
          <div className="mt-3 rounded-xl border border-football bg-football-light px-3.5 py-2.5 text-sm text-football-dark">
            {t("admin.csvImportResult", { added: csvResult.added, skipped: csvResult.skipped })}
          </div>
        )}
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

      <AdminTabs />

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

// 共享 admin nav：5 个 section 间互跳（US-304 新增 audit-logs）
function AdminTabs() {
  const { t } = useTranslation();
  const tabs: { to: string; label: string; end?: boolean }[] = [
    { to: "/admin", label: t("admin.nav.dashboard"), end: true },
    { to: "/admin/owners", label: t("admin.nav.owners") },
    { to: "/admin/bookings", label: t("admin.nav.bookings") },
    { to: "/admin/words", label: t("admin.nav.words") },
    { to: "/admin/audit-logs", label: t("admin.nav.audit") },
  ];
  return (
    <nav className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            isActive
              ? "ig-stripe rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-softSm"
              : "rounded-full border border-canvas-200 bg-white px-4 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-canvas-50"
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

// 5) Admin Audit Logs（PRD §4.4 US-304）
type ActorFilter = "all" | "admin" | "owner" | "system" | "unknown";
type ActionFilter = "all" | string;

function chipCls(active: boolean): string {
  return active
    ? "ig-stripe rounded-full px-3.5 py-1 text-[11px] font-semibold text-white shadow-softSm"
    : "rounded-full border border-canvas-200 bg-white px-3.5 py-1 text-[11px] font-semibold text-ink-600 transition hover:bg-canvas-50";
}

function actionLabel(t: (k: string, opts?: Record<string, unknown>) => string, action: string): string {
  return t(`admin.action.${action}`, { defaultValue: action });
}

function actorDisplayName(actorId: string, _role: string): string {
  const p = store.profiles.find((x) => x.id === actorId);
  return p?.nickname ?? actorId;
}

export function AdminAuditLogsPage() {
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const [actorFilter, setActorFilter] = useState<ActorFilter>("all");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", actionFilter],
    queryFn: () => listAuditLogs(actionFilter === "all" ? {} : { action: actionFilter }),
  });

  const filteredLogs = logs.filter((l) => {
    if (actorFilter === "all") return true;
    if (actorFilter === "unknown") return !store.profiles.some((p) => p.id === l.actorId);
    return l.actorRole === actorFilter;
  });

  // 已知动作全集（按 i18n key 顺序列出，便于 filter chip）
  const knownActions: string[] = [
    "review_owner_app",
    "review_booking",
    "word_add",
    "word_update",
    "word_toggle",
    "word_delete",
    "word_bulk_import",
    "venue_update",
    "venue_set_status",
    "admin_role_change",
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="ig-eyebrow text-ink-500">AUDIT LOG</p>
        <h1 className="mt-1 font-display text-3xl text-ink-800 sm:text-4xl">{t("admin.auditLogs")}</h1>
        <p className="mt-1 text-sm text-ink-500">{t("admin.auditLogsSubtitle")}</p>
      </header>

      <AdminTabs />

      <section className="space-y-3 rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm sm:p-6">
        <div>
          <p className="ig-eyebrow text-ink-500">ACTOR</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["all", "admin", "owner", "system", "unknown"] as const).map((k) => (
              <button key={k} onClick={() => setActorFilter(k)} className={chipCls(actorFilter === k)}>
                {k === "all" ? t("admin.filterAll") : t(`admin.actor${k.charAt(0).toUpperCase()}${k.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="ig-eyebrow text-ink-500">ACTION</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => setActionFilter("all")} className={chipCls(actionFilter === "all")}>
              {t("admin.filterAll")}
            </button>
            {knownActions.map((a) => (
              <button key={a} onClick={() => setActionFilter(a)} className={chipCls(actionFilter === a)}>
                {actionLabel(t, a)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-canvas-200 bg-white shadow-softSm">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-canvas-100" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-3xl">📜</div>
            <p className="ig-eyebrow mt-2 text-ink-500">EMPTY</p>
            <p className="mt-1 text-sm font-medium text-ink-700">{t("admin.emptyAudit")}</p>
            <p className="mt-1 text-xs text-ink-500">{t("admin.emptyAuditBody")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-canvas-50 text-ink-600">
                <tr>
                  <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">{t("admin.colAt")}</th>
                  <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">{t("admin.colActor")}</th>
                  <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">{t("admin.colAction")}</th>
                  <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">{t("admin.colTarget")}</th>
                  <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">{t("admin.colIp")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-t border-canvas-200 transition hover:bg-canvas-50">
                    <td className="p-3 whitespace-nowrap text-xs text-ink-600 font-mono">
                      {formatDateTime(log.createdAt, locale)}
                    </td>
                    <td className="p-3 text-ink-800">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            log.actorRole === "admin"
                              ? "rounded-full bg-hoops-light px-2 py-0.5 text-[10px] font-semibold text-hoops-dark"
                              : log.actorRole === "owner"
                                ? "rounded-full bg-football-light px-2 py-0.5 text-[10px] font-semibold text-football-dark"
                                : "rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-700"
                          }
                        >
                          {t(`admin.actor${log.actorRole.charAt(0).toUpperCase()}${log.actorRole.slice(1)}`)}
                        </span>
                        <span className="text-xs text-ink-700">{actorDisplayName(log.actorId, log.actorRole)}</span>
                      </div>
                    </td>
                    <td className="p-3 text-ink-800">
                      <span className="text-sm font-medium">{actionLabel(t, log.action)}</span>
                    </td>
                    <td className="p-3 text-ink-600">
                      <div className="font-mono text-[11px] text-ink-700">{log.targetType}:{log.targetId}</div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-1 text-[11px] text-ink-500">
                          {Object.entries(log.metadata)
                            .slice(0, 3)
                            .map(([k, v]) => `${k}=${String(v)}`)
                            .join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap font-mono text-xs text-ink-500">{log.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
