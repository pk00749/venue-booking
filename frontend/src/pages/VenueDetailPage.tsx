// 场馆详情 —— IG 风延续（v3 重构为「球馆 → 场次 → 场地」三层）
//   1) 头部：左 emoji 圆 + 大软色 art 块；右 eyebrow + sport mono + 标题 + 地址
//   2) 3 列 stat 条：营业时间 / 容量 / 起价
//   3) 备注：白底 card，空时灰字「无」
//   4) 日期 tabs：白底圆角 chips
//   5) 场次网格：每片 = HH:mm–HH:mm + "X/Y 片可加入" chip + 进度条
//   6) 点击场次 → 下方内联展开「场地列表」（court 名 + X/Y + 状态 chip）
//   7) 点击「可加入」的 court → /venues/:id/book?date=&start=&court=
//   8) 过去场次：灰显 + 不可展开
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { addDays, format, isToday, isTomorrow } from "date-fns";
import { getVenue, listCourts, listSessions, listVenueServices, venueAddress, type Session } from "@/features/venues/api";
import { EmptyState, Skeleton } from "@/components/ui";
import { useUi } from "@/lib/store";
import { formatCourtName, formatMoney } from "@/lib/format";
import type { Court, SportType, Venue } from "@/lib/types";
import {
  AMENITY_CUSTOM_PREFIX,
  AMENITY_PRESET_PREFIX,
  isCustomAmenity,
  isPresetAmenity,
} from "@/lib/types";
import { AMENITY_PRESETS_META } from "@/lib/amenities";
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

function VenueHeader({ venue, vis }: { venue: Venue; vis: Visual }) {
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const priceValid = venue.basePriceCents > 0;
  const idShort = venue.id.replace(/^v_/, "").slice(0, 3).toUpperCase();

  return (
    <section className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      <div className="lg:col-span-5">
        <div className={clsx("relative overflow-hidden rounded-2xl border border-canvas-200", vis.light)}>
          <div className="flex h-full min-h-[280px] flex-col justify-between p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={clsx("flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl ring-2", vis.ring)}>
                  {vis.emoji}
                </div>
                <span className="ig-eyebrow">{vis.mono}</span>
              </div>
              <span className="font-mono text-[10px] tracking-[0.2em] text-ink-500">№ {idShort}</span>
            </div>
            <div className="flex flex-1 items-center justify-center py-6">
              <span className="text-[110px] leading-none drop-shadow-sm" aria-hidden>
                {vis.emoji}
              </span>
            </div>
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

      <div className="space-y-5 lg:col-span-7">
        <div className="space-y-2">
          <p className="ig-eyebrow">{t("venueDetail.title")} · {t(`sport.${venue.sportType}`)}</p>
          <h1 className="font-display text-[40px] leading-[1.02] tracking-tight text-ink-800 sm:text-[52px]">
            {venue.name}
          </h1>
        </div>

        <p className="font-mono text-sm text-ink-500">
          <span className="mr-2 text-ink-400">⌖</span>
          {venueAddress(venue, locale)}
        </p>

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

function SessionTile({
  session,
  expanded,
  onToggle,
  onPickCourt,
  isPast,
}: {
  session: Session;
  expanded: boolean;
  onToggle: () => void;
  onPickCourt: (court: Court) => void;
  isPast: boolean;
}) {
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const start = new Date(session.startsAt);
  const end = new Date(session.endsAt);
  const time = `${format(start, "HH:mm")}–${format(end, "HH:mm")}`;
  const fullDay = format(start, locale === "zh-CN" ? "MM/dd EEE" : "MM/dd EE");
  const taken = session.totalCourts - session.availableCourts;
  const fillPct = session.totalCourts > 0
    ? Math.round((taken / session.totalCourts) * 100)
    : 0;
  const disabled = isPast || session.totalCourts === 0;

  return (
    <div
      className={clsx(
        "rounded-xl border bg-white transition",
        disabled
          ? "border-canvas-200 opacity-60"
          : expanded
            ? "border-ink-300 shadow-softSm"
            : "border-canvas-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-softSm"
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={isPast ? t("venueDetail.sessionPastAria", { time }) : t("venueDetail.sessionExpandAria", { time })}
        className="flex w-full items-center gap-3 rounded-xl p-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-300"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[15px] tracking-wider text-ink-800">{time}</span>
            <span className="font-mono text-[10px] tracking-[0.18em] text-ink-500">{fullDay}</span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-canvas-200">
            <div
              className={clsx(
                "h-full rounded-full transition-all",
                session.availableCourts === 0 ? "bg-ink-800" : "bg-football",
              )}
              style={{ width: `${Math.max(6, fillPct)}%` }}
              aria-hidden
            />
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {isPast ? (
            <span className="rounded-full border border-canvas-200 bg-canvas-100 px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-ink-500">
              {t("venueDetail.courtPast")}
            </span>
          ) : session.availableCourts === 0 ? (
            <span className="rounded-full bg-ink-800 px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-white">
              {t("venueDetail.fullyBooked")}
            </span>
          ) : (
            <span className="rounded-full border border-ink-300 px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-ink-800">
              {t("venueDetail.courtsOpen", { available: session.availableCourts, total: session.totalCourts })}
            </span>
          )}
          <span aria-hidden className={clsx("font-mono text-ink-500 transition", expanded && "rotate-90")}>
            ›
          </span>
        </div>
      </button>
      {expanded && !disabled && (
        <ul className="border-t border-canvas-200 divide-y divide-canvas-200">
          {session.courts.map(({ court, slot }) => {
            const slotIsPast = new Date(slot.endsAt).getTime() < Date.now();
            const isFull = slot.confirmedCount >= slot.capacity || slot.status !== "available";
            const joinable = !slotIsPast && !isFull;
            const rowAria = slotIsPast
              ? t("venueDetail.courtPast")
              : isFull
                ? t("venueDetail.courtBooked")
                : t("venueDetail.courtAvailable");
            const fillRow = Math.round((slot.confirmedCount / Math.max(1, slot.capacity)) * 100);
            return (
              <li key={court.id}>
                <button
                  type="button"
                  disabled={!joinable}
                  onClick={() => joinable && onPickCourt(court)}
                  aria-label={`${formatCourtName(court, locale)} · ${t("venueDetail.courtProgress", { confirmed: slot.confirmedCount, capacity: slot.capacity })} · ${rowAria}`}
                  className={clsx(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-300",
                    joinable
                      ? "hover:bg-canvas-50"
                      : "cursor-not-allowed",
                  )}
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-canvas-100 font-mono text-[11px] tracking-wider text-ink-700">
                    {formatCourtName(court, locale).replace(/\s.*$/, "")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate font-display text-[15px] text-ink-800">
                        {formatCourtName(court, locale)}
                      </span>
                      <span className="font-mono text-[11px] tracking-wider text-ink-500">
                        {t("venueDetail.courtProgress", { confirmed: slot.confirmedCount, capacity: slot.capacity })}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-canvas-200">
                      <div
                        className={clsx("h-full rounded-full", isFull ? "bg-ink-800" : "bg-football")}
                        style={{ width: `${Math.max(6, fillRow)}%` }}
                        aria-hidden
                      />
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {slotIsPast ? (
                      <span className="rounded-full border border-canvas-200 bg-canvas-100 px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-ink-500">
                        {t("venueDetail.courtPast")}
                      </span>
                    ) : isFull ? (
                      <span className="rounded-full bg-ink-800 px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-white">
                        {t("venueDetail.courtBooked")}
                      </span>
                    ) : (
                      <span className="rounded-full border border-ink-300 px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-ink-800">
                        {t("venueDetail.courtAvailable")}
                      </span>
                    )}
                    {joinable && (
                      <span aria-hidden className="font-mono text-ink-500">→</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
    return format(d, "yyyy-MM-dd");
  });
  const [expandedStart, setExpandedStart] = useState<string | null>(null);

  const { data: venue, isLoading: vLoading } = useQuery({
    queryKey: ["venue", id],
    queryFn: () => getVenue(id),
    enabled: !!id,
  });
  const { data: courts = [] } = useQuery({
    queryKey: ["courts", id],
    queryFn: () => listCourts(id),
    enabled: !!id,
  });
  const { data: sessions = [], isLoading: sLoading } = useQuery({
    queryKey: ["sessions", id, date],
    queryFn: () => listSessions(id, date),
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
      return format(d, "yyyy-MM-dd");
    });
  }, []);

  const setDateAndReset = (iso: string) => {
    setDate(iso);
    setExpandedStart(null);
  };

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

  // 已下架 venue：保留 header + 备注做信息可见，预订入口关闭
  // （PRD §US-203a：下架后公开列表不可见；直访 URL 仍可见，但用户/场主/管理员三方的历史预订仍可查）
  if (venue.status === "inactive") {
    return (
      <div className="space-y-6 pb-20">
        <VenueHeader venue={venue} vis={SPORT_VISUAL[venue.sportType]} />
        <div className="rounded-2xl border border-squash bg-squash-light p-5 shadow-softSm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden>🛑</span>
            <div className="min-w-0">
              <p className="ig-eyebrow text-squash-dark">{t("venueDetail.deactivatedEyebrow")}</p>
              <h2 className="mt-1 font-display text-xl text-squash-dark">
                {t("venueDetail.deactivatedTitle")}
              </h2>
              <p className="mt-2 text-sm text-squash-dark/90">
                {t("venueDetail.deactivatedBody")}
              </p>
            </div>
          </div>
        </div>
        <NotesBlock notes={venue.notes} />
      </div>
    );
  }

  const vis = SPORT_VISUAL[venue.sportType];
  const now = Date.now();

  return (
    <div className="space-y-7 pb-20">
      <VenueHeader venue={venue} vis={vis} />

      <NotesBlock notes={venue.notes} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ig-eyebrow">{t("venueDetail.timeSlots")}</p>
            <h2 className="mt-1 font-display text-[28px] leading-tight text-ink-800">
              {locale === "zh-CN" ? "选择场次" : "Pick a session"}
            </h2>
          </div>
          {courts.length > 0 && (
            <span className="rounded-full border border-canvas-200 bg-white px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-ink-600">
              {t("owner.courtCount", { n: courts.length })}
            </span>
          )}
        </div>

        <DateTabs dates={dateOptions} value={date} onChange={setDateAndReset} />

        {sLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState icon="∅" title={t("venueDetail.noSessions")} />
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const isPast = new Date(s.endsAt).getTime() < now;
              return (
                <SessionTile
                  key={s.startsAt}
                  session={s}
                  expanded={expandedStart === s.startsAt}
                  onToggle={() =>
                    setExpandedStart((cur) => (cur === s.startsAt ? null : s.startsAt))
                  }
                  onPickCourt={(court) => {
                    const start = encodeURIComponent(s.startsAt);
                    navigate(`/venues/${venue.id}/book?date=${date}&start=${start}&court=${encodeURIComponent(court.id)}`);
                  }}
                  isPast={isPast}
                />
              );
            })}
          </div>
        )}

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
              {locale === "zh-CN" ? "点击场次展开可选场地" : "Tap a session to expand courts"}
            </span>
          </div>
        </div>
      </section>

      {venue.amenities.length > 0 && (
        <section className="rounded-xl border border-canvas-200 bg-white p-4">
          <p className="ig-eyebrow">{t("venueDetail.amenities")}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {venue.amenities.map((a) => {
              if (isPresetAmenity(a)) {
                const key = a.slice(AMENITY_PRESET_PREFIX.length);
                const meta = AMENITY_PRESETS_META.find((m) => m.key === key);
                if (!meta) return null;
                return (
                  <li
                    key={a}
                    className="inline-flex items-center gap-1.5 rounded-full border border-canvas-200 bg-canvas-50 px-3 py-1.5 text-xs text-ink-700"
                  >
                    <span aria-hidden>{meta.icon}</span>
                    <span>{t(meta.i18nKey)}</span>
                  </li>
                );
              }
              if (isCustomAmenity(a)) {
                return (
                  <li
                    key={a}
                    className="inline-flex items-center gap-1.5 rounded-full border border-canvas-200 bg-canvas-50 px-3 py-1.5 text-xs text-ink-700"
                  >
                    <span aria-hidden>✨</span>
                    <span>{a.slice(AMENITY_CUSTOM_PREFIX.length)}</span>
                  </li>
                );
              }
              return null;
            })}
          </ul>
        </section>
      )}

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
