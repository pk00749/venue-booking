// 场馆详情 —— IG 风延续
//   1) 头部：左 emoji 圆 + 大软色 art 块；右 eyebrow + sport mono + 标题 + 地址
//   2) 4 列 stat 条：白底圆角（营业时间 / 容量 / 起价 / ID）
//   3) 备注：白底 card，空时灰字「无」
//   4) 日期 tabs：白底圆角 chips，active IG 渐变 + 白字
//   5) 时段格子：4 列网格，白底圆角 + 时间 + 价格 + 进度条 + 状态 chip
//   6) 服务行 + legend
// 关键：保留 statFor() 业务逻辑（full/open/blocked），只换视觉
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { addDays, format, isToday, isTomorrow } from "date-fns";
import { getVenue, listSlots, listVenueServices } from "@/features/venues/api";
import { EmptyState, Skeleton } from "@/components/ui";
import { useUi } from "@/lib/store";
import { formatMoney } from "@/lib/format";
import type { Slot, SportType, Venue } from "@/lib/types";
import clsx from "clsx";

type Visual = { emoji: string; light: string; glow: string; mono: string; ring: string; accent: string };
const SPORT_VISUAL: Record<SportType, Visual> = {
  squash:      { emoji: "🏸", light: "bg-squash-light",   glow: "bg-squash-glow",   mono: "SQUASH",     ring: "ring-squash",   accent: "text-squash-dark"   },
  football:    { emoji: "⚽", light: "bg-football-light", glow: "bg-football-glow", mono: "FOOTBALL",   ring: "ring-football", accent: "text-football-dark" },
  basketball:  { emoji: "🏀", light: "bg-hoops-light",    glow: "bg-hoops-glow",    mono: "BASKETBALL", ring: "ring-hoops",    accent: "text-hoops-dark"    },
  badminton:   { emoji: "🏸", light: "bg-squash-light",   glow: "bg-squash-glow",   mono: "BADMINTON",  ring: "ring-squash",   accent: "text-squash-dark"   },
  tennis:      { emoji: "🎾", light: "bg-football-light", glow: "bg-football-glow", mono: "TENNIS",     ring: "ring-football", accent: "text-football-dark" },
  table_tennis:{ emoji: "🏓", light: "bg-hoops-light",    glow: "bg-hoops-glow",    mono: "PING PONG",  ring: "ring-hoops",    accent: "text-hoops-dark"    },
  volleyball:  { emoji: "🏐", light: "bg-football-light", glow: "bg-football-glow", mono: "VOLLEYBALL", ring: "ring-football", accent: "text-football-dark" },
  other:       { emoji: "🎯", light: "bg-ink-100",        glow: "bg-ink-200",       mono: "OTHER",      ring: "ring-ink-200",  accent: "text-ink-700"       },
};

type SlotStat =
  | { kind: "full"; capacity: number; confirmed: number }
  | { kind: "open"; capacity: number; confirmed: number; missing: number }
  | { kind: "blocked"; capacity: number; confirmed: number };

function statFor(slot: Slot): SlotStat {
  const cap = Math.max(1, slot.capacity);
  const conf = Math.min(cap, slot.confirmedCount);
  if (slot.status === "blocked") return { kind: "blocked", capacity: cap, confirmed: conf };
  if (conf >= cap) return { kind: "full", capacity: cap, confirmed: conf };
  return { kind: "open", capacity: cap, confirmed: conf, missing: cap - conf };
}

function VenueHeader({ venue, vis }: { venue: Venue; vis: Visual }) {
  const { t } = useTranslation();
  const priceValid = venue.basePriceCents > 0;
  const idShort = venue.id.replace(/^v_/, "").slice(0, 3).toUpperCase();

  return (
    <section className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      {/* 左：大 art 块 + emoji 圆 */}
      <div className="lg:col-span-5">
        <div className={clsx("relative overflow-hidden rounded-2xl border border-canvas-200", vis.light)}>
          <div className="flex h-full min-h-[280px] flex-col justify-between p-6">
            {/* 顶部：64px emoji 圆 + mono label */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={clsx("flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl ring-2", vis.ring)}>
                  {vis.emoji}
                </div>
                <span className="ig-eyebrow">{vis.mono}</span>
              </div>
              <span className="font-mono text-[10px] tracking-[0.2em] text-ink-500">№ {idShort}</span>
            </div>

            {/* 中部：大 emoji 中心 */}
            <div className="flex flex-1 items-center justify-center py-6">
              <span className="text-[110px] leading-none drop-shadow-sm" aria-hidden>
                {vis.emoji}
              </span>
            </div>

            {/* 底部：sport 名 + 状态 */}
            <div className="flex items-center justify-between">
              <span className={clsx("font-mono text-[11px] tracking-[0.2em]", vis.accent)}>
                {t(`sport.${venue.sportType}`)}
              </span>
              {venue.requireApproval && (
                <span className="rounded-full border border-ink-200 bg-white px-2.5 py-0.5 font-mono text-[10px] tracking-[0.16em] text-ink-700">
                  {t("venues.requireApproval")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 右：标题 + 地址 + stat 条 */}
      <div className="space-y-5 lg:col-span-7">
        <div className="space-y-2">
          <p className="ig-eyebrow">{t("venueDetail.title")} · {t(`sport.${venue.sportType}`)}</p>
          <h1 className="font-display text-[40px] leading-[1.02] tracking-tight text-ink-800 sm:text-[52px]">
            {venue.name}
          </h1>
        </div>

        <p className="font-mono text-sm text-ink-500">
          <span className="mr-2 text-ink-400">⌖</span>
          {venue.address}
        </p>

        {/* 4 列 stat 条 */}
        {/* 3 列 stat 条（营业时间 / 容量 / 起价） */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={t("venueDetail.openHours")} value={<span className="whitespace-nowrap font-mono text-base text-ink-800">{venue.openTimeStart}–{venue.openTimeEnd}</span>} mono />
          <Stat
            label={t("venueDetail.capacity")}
            value={
              <>
                <span className="font-display text-2xl text-ink-800">{venue.capacity}</span>
                <span className="ml-1 font-mono text-[10px] tracking-wider text-ink-500">
                  {t("venueDetail.people")}
                </span>
              </>
            }
          />
          <Stat
            label={t("venueDetail.fromPrice")}
            value={
              <>
                <span className="font-display text-2xl text-ink-800">
                  {priceValid ? formatMoney(venue.basePriceCents, "zh-CN") : "—"}
                </span>
                <p className="mt-0.5 font-mono text-[10px] tracking-[0.16em] text-ink-500">
                  {priceValid ? t("venueDetail.perHour") : t("venues.priceN/A")}
                </p>
              </>
            }
          />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-canvas-200 bg-white p-3.5">
      <p className="ig-eyebrow">{label}</p>
      <div className={clsx("mt-1.5", mono && "font-mono text-base text-ink-800")}>{value}</div>
    </div>
  );
}

function NotesBlock({ notes }: { notes?: string }) {
  const { t } = useTranslation();
  const has = !!(notes && notes.trim().length > 0);
  return (
    <section className="rounded-xl border border-canvas-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <p className="ig-eyebrow">{t("venueDetail.notes")}</p>
        <span className={clsx("h-1.5 w-1.5 rounded-full", has ? "bg-football" : "bg-ink-200")} />
      </div>
      <p className={clsx("mt-2 text-[15px] leading-relaxed", has ? "text-ink-800" : "text-ink-400")}>
        {has ? notes : t("venueDetail.notesEmpty")}
      </p>
    </section>
  );
}

function DateTabs({
  dates, value, onChange,
}: { dates: string[]; value: string; onChange: (iso: string) => void }) {
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);

  const tab = (iso: string) => {
    const d = new Date(iso);
    const weekday = isToday(d)
      ? locale === "zh-CN" ? "今日" : "TODAY"
      : isTomorrow(d)
        ? locale === "zh-CN" ? "明日" : "TOMORROW"
        : format(d, locale === "zh-CN" ? "EEEEEE" : "EE").toUpperCase();
    const day = format(d, "MM/dd");
    return { weekday, day };
  };

  return (
    <div className="flex flex-wrap gap-2">
      {dates.map((iso) => {
        const { weekday, day } = tab(iso);
        const active = iso === value;
        return (
          <button
            key={iso}
            onClick={() => onChange(iso)}
            className={clsx(
              "flex min-w-[78px] flex-col items-center rounded-full border px-4 py-2 transition",
              active
                ? "ig-stripe border-transparent text-white shadow-softSm"
                : "border-canvas-200 bg-white text-ink-700 hover:border-ink-300 hover:-translate-y-0.5"
            )}
          >
            <span className={clsx("font-mono text-[10px] tracking-[0.16em]", active ? "text-white/80" : "text-ink-500")}>
              {weekday}
            </span>
            <span className="font-display text-[15px] leading-tight">{day}</span>
          </button>
        );
      })}
      {dates.length === 0 && (
        <p className="px-2 py-2 font-mono text-xs text-ink-500">{t("venues.emptyDates")}</p>
      )}
    </div>
  );
}

function SlotTile({
  slot,
  t,
  basePriceCents,
  onPick,
}: {
  slot: Slot;
  t: (k: string, opts?: Record<string, unknown>) => string;
  basePriceCents: number;
  onPick: (slotId: string) => void;
}) {
  const stat = statFor(slot);
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  const time = `${format(start, "HH:mm")}–${format(end, "HH:mm")}`;
  const fillPct = Math.round((stat.confirmed / stat.capacity) * 100);
  const isPast = start.getTime() < Date.now();
  const disabled = isPast || stat.kind === "full" || stat.kind === "blocked";

  const ariaLabel = isPast
    ? t("venueDetail.slotExpiredAria", { time })
    : stat.kind === "full"
      ? t("venueDetail.slotFullAria")
      : stat.kind === "blocked"
        ? t("venueDetail.slotBlockedAria")
        : t("venueDetail.bookSlotAria", { time });

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={() => onPick(slot.id)}
      className={clsx(
        "group flex flex-col rounded-xl border bg-white p-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-300",
        disabled
          ? "border-canvas-200 opacity-60 cursor-not-allowed"
          : "border-canvas-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-softSm"
      )}
    >
      {/* 顶部：时间 + 价格 */}
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[14px] tracking-wider text-ink-800">{time}</span>
        <span className="font-mono text-[11px] tracking-[0.14em] text-ink-500">
          {basePriceCents > 0 ? formatMoney(basePriceCents, "zh-CN") : "—"}
        </span>
      </div>

      {/* 进度条（4px 圆角，无边框） */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-canvas-200">
        <div
          className={clsx("h-full rounded-full transition-all", stat.kind === "full" ? "bg-ink-800" : "bg-football")}
          style={{ width: `${Math.max(6, fillPct)}%` }}
          aria-hidden
        />
      </div>

      {/* 底部：X/Y + 状态 chip */}
      <div className="mt-2.5 flex items-center justify-between font-mono text-[11px]">
        <span className="tracking-wider text-ink-600">
          {stat.confirmed}/{stat.capacity}
        </span>
        {isPast ? (
          <span className="rounded-full border border-canvas-200 bg-canvas-100 px-2 py-0.5 text-[10px] tracking-[0.14em] text-ink-500">
            {t("venueDetail.slotExpired")}
          </span>
        ) : stat.kind === "full" ? (
          <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] tracking-[0.14em] text-white">
            {t("venueDetail.fullyBooked")}
          </span>
        ) : stat.kind === "blocked" ? (
          <span className="rounded-full border border-canvas-200 bg-canvas-100 px-2 py-0.5 text-[10px] tracking-[0.14em] text-ink-500">
            —
          </span>
        ) : (
          <span className="rounded-full border border-ink-300 px-2 py-0.5 text-[10px] tracking-[0.14em] text-ink-800">
            {t("venueDetail.missing")} {stat.missing}
          </span>
        )}
      </div>
    </button>
  );
}

export function VenueDetailPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const navigate = useNavigate();

  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });

  const { data: venue, isLoading: vLoading } = useQuery({
    queryKey: ["venue", id],
    queryFn: () => getVenue(id),
    enabled: !!id,
  });
  const { data: slots = [], isLoading: sLoading } = useQuery({
    queryKey: ["slots", id, date],
    queryFn: () => listSlots(id, new Date(date).toISOString()),
    enabled: !!id,
  });
  const { data: services = [] } = useQuery({
    queryKey: ["services", id],
    queryFn: () => listVenueServices(id),
    enabled: !!id,
  });

  const dateOptions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i);
      return d.toISOString().slice(0, 10);
    });
  }, []);

  const sortedSlots = useMemo(
    () => [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [slots]
  );

  if (vLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (!venue) {
    return (
      <EmptyState
        icon="∅"
        title={t("venues.notFoundTitle")}
        body={t("venues.notFoundBody")}
      />
    );
  }

  const vis = SPORT_VISUAL[venue.sportType];

  return (
    <div className="space-y-7 pb-20">
      <VenueHeader venue={venue} vis={vis} />

      <NotesBlock notes={venue.notes} />

      <section className="space-y-4">
        {/* 段头 */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ig-eyebrow">{t("venueDetail.timeSlots")}</p>
            <h2 className="mt-1 font-display text-[28px] leading-tight text-ink-800">
              {locale === "zh-CN" ? "选择时段" : "Pick a slot"}
            </h2>
          </div>
        </div>

        <DateTabs dates={dateOptions} value={date} onChange={setDate} />

        {sLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : sortedSlots.length === 0 ? (
          <EmptyState icon="∅" title={t("venueDetail.noSlots")} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sortedSlots.map((s) => (
              <SlotTile
                key={s.id}
                slot={s}
                t={t}
                basePriceCents={venue.basePriceCents}
                onPick={(slotId) => navigate(`/venues/${venue.id}/book?date=${date}&slot=${slotId}`)}
              />
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="ig-hairline pt-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-[0.18em] text-ink-500">
            <span className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-6 rounded-full bg-football" />
              {t("venueDetail.confirmed")} / {t("venueDetail.capacity")}
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-6 rounded-full bg-ink-800" />
              {t("venueDetail.fullyBooked")}
            </span>
            <span className="ml-auto">
              {t("venueDetail.missing")} = {t("venueDetail.capacity")} − {t("venueDetail.confirmed")}
            </span>
          </div>
        </div>
      </section>

      {services.length > 0 && (
        <section className="rounded-xl border border-canvas-200 bg-white p-4">
          <p className="ig-eyebrow">{t("venues.services")}</p>
          <ul className="mt-3 divide-y divide-canvas-200">
            {services.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between py-2.5 font-mono text-sm"
              >
                <span className="text-ink-800">
                  {s.name}
                  {s.required && (
                    <span className="ml-1 text-[10px] tracking-[0.18em] text-squash-dark">
                      {t("venues.servicesRequired")}
                    </span>
                  )}
                </span>
                <span className="text-ink-700">{formatMoney(s.priceCents, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 底部 sticky：与 BookingPage 一致的返回按钮 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-canvas-200 bg-white/95 shadow-[0_-2px_18px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            to={`/venues${venue.sportType ? `?sport=${venue.sportType}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-canvas-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-500 transition hover:border-ink-300 hover:text-ink-800"
          >
            <span aria-hidden>←</span>
            <span className="hidden sm:inline">{t("venueDetail.backToList")}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
