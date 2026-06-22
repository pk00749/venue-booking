// 我的预订 —— IG 风
//   1) 顶部：eyebrow + 大 display 标题
//   2) tabs：白底圆角 chips，active IG 渐变 + 白字
//   3) 列表：白底圆角 card，左 sport mono + venue + 时段，右 status chip + 取消按钮
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSession, useUi } from "@/lib/store";
import { listMyBookings, cancelBooking } from "@/features/bookings/api";
import { store } from "@/lib/mock-data";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Booking, SportType } from "@/lib/types";
import clsx from "clsx";

const SPORT_VISUAL: Record<SportType, { emoji: string; light: string; mono: string }> = {
  squash:      { emoji: "🏸", light: "bg-squash-light",   mono: "SQUASH"     },
  football:    { emoji: "⚽", light: "bg-football-light", mono: "FOOTBALL"   },
  basketball:  { emoji: "🏀", light: "bg-hoops-light",    mono: "BASKETBALL" },
  badminton:   { emoji: "🏸", light: "bg-squash-light",   mono: "BADMINTON"  },
  tennis:      { emoji: "🎾", light: "bg-football-light", mono: "TENNIS"     },
  table_tennis:{ emoji: "🏓", light: "bg-hoops-light",    mono: "PING PONG"  },
  volleyball:  { emoji: "🏐", light: "bg-football-light", mono: "VOLLEYBALL" },
  other:       { emoji: "🎯", light: "bg-ink-100",        mono: "OTHER"      },
};

function statusChip(b: Booking) {
  const map: Record<Booking["status"], { tone: string; cls: string }> = {
    confirmed:   { tone: "success", cls: "bg-football-light text-football-dark" },
    pending:     { tone: "warn",    cls: "bg-hoops-light text-hoops-dark" },
    completed:   { tone: "info",    cls: "bg-ink-100 text-ink-700" },
    cancelled:   { tone: "danger",  cls: "bg-squash-light text-squash-dark" },
    rejected:    { tone: "danger",  cls: "bg-squash-light text-squash-dark" },
  };
  return map[b.status] ?? { tone: "info", cls: "bg-ink-100 text-ink-700" };
}

export function MyBookingsPage() {
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const user = useSession((s) => s.user);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [msg, setMsg] = useState<{ tone: "success" | "warn" | "danger"; text: string } | null>(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["my-bookings", user?.id],
    queryFn: () => listMyBookings(user!.id),
    enabled: !!user,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelBooking(id),
    onSuccess: (r) => {
      if (r.ok) {
        setMsg({ tone: "success", text: t("myBookings.cancelled") });
        qc.invalidateQueries({ queryKey: ["my-bookings"] });
      } else if (r.reason === "too_late") {
        const hours = store.venues.find((v) => v.id === bookings[0]?.venueId)?.cancelHours ?? 2;
        setMsg({ tone: "warn", text: t("myBookings.cancelTooLate", { hours }) });
      } else {
        setMsg({ tone: "danger", text: t("errors.generic") });
      }
    },
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-canvas-200 bg-white p-8 text-center shadow-softSm">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-3 font-display text-2xl text-ink-800">{t("loginRequired.title")}</h1>
          <Link
            to="/login"
            className="ig-stripe mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-softSm"
          >
            {t("nav.login")} →
          </Link>
        </div>
      </div>
    );
  }

  const now = Date.now();
  // 「未开场 / 已结束」严格按时间切分：任一 slot 还没到开场时间 → 未开场；否则 → 已结束
  // 状态（pending / confirmed / cancelled / rejected / completed）以 chip 形式展示在卡片上
  const upcoming = bookings.filter((b) =>
    b.slotIds.some((sid) => {
      const sl = store.slots.find((s) => s.id === sid);
      return sl ? new Date(sl.startsAt).getTime() > now : false;
    }),
  );
  const history = bookings.filter((b) => !upcoming.includes(b));
  const list = tab === "upcoming" ? upcoming : history;

  return (
    <div className="space-y-6">
      {/* 头 */}
      <div>
        <p className="ig-eyebrow">{t("nav.appName")}</p>
        <h1 className="mt-1 font-display text-[36px] leading-tight text-ink-800">{t("myBookings.title")}</h1>
      </div>

      {/* tabs */}
      <div className="flex flex-wrap gap-2">
        {(["upcoming", "history"] as const).map((k) => {
          const active = tab === k;
          const count = k === "upcoming" ? upcoming.length : history.length;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={clsx(
                "flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition",
                active
                  ? "ig-stripe border-transparent text-white shadow-softSm"
                  : "border-canvas-200 bg-white text-ink-700 hover:border-ink-300 hover:-translate-y-0.5"
              )}
            >
              {t(`myBookings.tab${k[0].toUpperCase()}${k.slice(1)}`)}
              <span className={clsx("rounded-full px-1.5 font-mono text-[10px]", active ? "bg-white/20" : "bg-canvas-100 text-ink-500")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* msg banner */}
      {msg && (
        <div
          className={clsx(
            "rounded-xl border px-3.5 py-2.5 text-sm",
            msg.tone === "success" && "border-football/30 bg-football-light text-football-dark",
            msg.tone === "warn"    && "border-hoops/40 bg-hoops-light text-hoops-dark",
            msg.tone === "danger"  && "border-squash/30 bg-squash-light text-squash-dark"
          )}
        >
          {msg.text}
        </div>
      )}

      {/* list */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-canvas-200/60" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-canvas-200 bg-white p-10 text-center">
          <div className="text-4xl">{tab === "upcoming" ? "📅" : "🗂️"}</div>
          <h2 className="mt-3 font-display text-xl text-ink-800">
            {t(`myBookings.empty${tab === "upcoming" ? "Upcoming" : "History"}`)}
          </h2>
          <p className="mt-1 text-sm text-ink-500">{t("myBookings.emptyBody")}</p>
          {tab === "upcoming" && (
            <Link
              to="/venues"
              className="ig-stripe mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-softSm"
            >
              {t("home.ctaBrowse")} →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => {
            const venue = store.venues.find((v) => v.id === b.venueId);
            const vis = venue ? SPORT_VISUAL[venue.sportType] : SPORT_VISUAL.other;
            const chip = statusChip(b);
            return (
              <div
                key={b.id}
                className="flex items-start justify-between gap-4 rounded-2xl border border-canvas-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-softSm"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className={clsx("flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-2xl ring-2 ring-canvas-200", vis.light)}>
                    {vis.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] tracking-[0.2em] text-ink-500">{vis.mono}</span>
                      <span className={clsx("rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[0.14em]", chip.cls)}>
                        {t(`status.${b.status}`)}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate font-display text-lg text-ink-800">{venue?.name ?? "—"}</div>
                    <div className="mt-1 space-y-0.5 font-mono text-[12px] text-ink-500">
                      {b.slotIds.map((sid) => {
                        const sl = store.slots.find((s) => s.id === sid);
                        return sl ? <div key={sid}>🕒 {formatDateTime(sl.startsAt, locale)}</div> : null;
                      })}
                    </div>
                    <div className="mt-1.5 text-[13px] text-ink-700">
                      👤 {b.contactName} · 📞 {b.contactPhone}
                    </div>
                    {b.notes && b.notes.trim() && (
                      <div className="mt-1 text-[13px] text-ink-700">
                        <span className="font-mono text-[10px] tracking-[0.16em] text-ink-500">
                          🗒️ {t("myBookings.notesLabel")}
                        </span>
                        <span className="ml-1 whitespace-pre-wrap break-words">{b.notes}</span>
                      </div>
                    )}
                    <div className="mt-1 font-display text-base text-ink-800">{formatMoney(b.totalPriceCents, locale)}</div>
                  </div>
                </div>

                {tab === "upcoming" && b.status !== "cancelled" && (
                  <button
                    onClick={() => {
                      if (confirm(t("myBookings.cancelConfirm"))) cancel.mutate(b.id);
                    }}
                    className="flex-shrink-0 rounded-full border border-squash/40 bg-squash-light px-3 py-1.5 font-mono text-[11px] tracking-[0.16em] text-squash-dark transition hover:-translate-y-0.5"
                  >
                    {t("myBookings.cancel")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
