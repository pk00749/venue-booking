// 场地列表 — IG 风：白底圆角卡片，左侧 emoji 头像圆，右侧日期 chip + 容量 + 价格
// 过滤条 / 搜索框统一白底圆角；active 状态用 IG 渐变
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format, isToday, isTomorrow, addDays } from "date-fns";
import { listVenues, listNextAvailableDates, parseCity, parseDistrict } from "@/features/venues/api";
import { EmptyState, Skeleton } from "@/components/ui";
import { useUi } from "@/lib/store";
import { formatMoney } from "@/lib/format";
import { SPORT_TYPES, type SportType } from "@/lib/types";
import clsx from "clsx";
import { useEffect, useMemo } from "react";

const SPORT_VISUAL: Record<SportType, { emoji: string; light: string; glow: string; mono: string }> = {
  squash:     { emoji: "🏸", light: "bg-squash-light",   glow: "bg-squash-glow",   mono: "SQUASH"     },
  football:   { emoji: "⚽", light: "bg-football-light", glow: "bg-football-glow", mono: "FOOTBALL"   },
  basketball: { emoji: "🏀", light: "bg-hoops-light",    glow: "bg-hoops-glow",    mono: "BASKETBALL" },
  badminton:    { emoji: "🏸", light: "bg-squash-light",   glow: "bg-squash-glow",   mono: "BADMINTON"  },
  tennis:       { emoji: "🎾", light: "bg-football-light", glow: "bg-football-glow", mono: "TENNIS"     },
  table_tennis: { emoji: "🏓", light: "bg-hoops-light",    glow: "bg-hoops-glow",    mono: "PING PONG"  },
  volleyball:   { emoji: "🏐", light: "bg-football-light", glow: "bg-football-glow", mono: "VOLLEYBALL" },
  other:        { emoji: "🎯", light: "bg-ink-100",        glow: "bg-ink-200",       mono: "OTHER"      },
};

function SelectPill({
  value,
  onChange,
  ariaLabel,
  disabled,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      disabled={disabled}
      className={clsx(
        "rounded-full border border-ink-300 bg-canvas-50 px-3 py-1.5 pr-7 text-[12px] font-semibold text-ink-700 transition",
        "hover:border-ink-500 hover:text-ink-800 focus:border-ink-500 focus:outline-none",
        "appearance-none bg-no-repeat bg-[length:12px_12px] bg-[right_10px_center]",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%23475569%22><path d=%22M5.5 7.5l4.5 5 4.5-5z%22/></svg>')]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {children}
    </select>
  );
}

function dateChipLabel(iso: string, t: (k: string) => string) {
  const d = new Date(iso);
  if (isToday(d)) return t("venues.today");
  if (isTomorrow(d)) return t("venues.tomorrow");
  if (format(d, "yyyy-MM-dd") === format(addDays(new Date(), 2), "yyyy-MM-dd")) {
    return t("venues.dayAfter");
  }
  return format(d, "MM/dd");
}

export function VenuesPage() {
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const [params, setParams] = useSearchParams();
  const sportParam = params.get("sport");
  const sport: SportType | "all" =
    sportParam && (SPORT_TYPES as readonly string[]).includes(sportParam)
      ? (sportParam as SportType)
      : "all";
  const keyword = params.get("q") ?? "";
  const cityParam = params.get("city") ?? "";
  const districtParam = params.get("district") ?? "";

  const setKeyword = (k: string) => {
    const next = new URLSearchParams(params);
    if (k) next.set("q", k); else next.delete("q");
    setParams(next, { replace: true });
  };
  const setCity = (c: string) => {
    const next = new URLSearchParams(params);
    if (c) next.set("city", c); else next.delete("city");
    next.delete("district"); // 切换城市时清空区县
    setParams(next, { replace: true });
  };
  const setDistrict = (d: string) => {
    const next = new URLSearchParams(params);
    if (d) next.set("district", d); else next.delete("district");
    setParams(next, { replace: true });
  };

  // 用于派生筛选选项的「同运动下」完整列表（不含 city / district 过滤）
  const { data: sportVenues = [] } = useQuery({
    queryKey: ["venues.options", sport],
    queryFn: () => listVenues({ sportType: sport }),
  });

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ["venues", sport, cityParam, districtParam, keyword],
    queryFn: () =>
      listVenues({
        sportType: sport,
        city: cityParam || undefined,
        district: districtParam || undefined,
        keyword,
      }),
  });

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const v of sportVenues) {
      const c = parseCity(v.address);
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }, [sportVenues]);

  const districts = useMemo(() => {
    const set = new Set<string>();
    for (const v of sportVenues) {
      if (cityParam && parseCity(v.address) !== cityParam) continue;
      const d = parseDistrict(v.address);
      if (d) set.add(d);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }, [sportVenues, cityParam]);

  // 当可用区县列表里找不到当前 district 时（切了城市），把 district 清掉
  useEffect(() => {
    if (districtParam && districts.length > 0 && !districts.includes(districtParam)) {
      const next = new URLSearchParams(params);
      next.delete("district");
      setParams(next, { replace: true });
    }
  }, [districtParam, districts, params, setParams]);

  const { data: datesByVenue = {} } = useQuery({
    queryKey: ["venues.nextDates", venues.map((v) => v.id).join("|")],
    enabled: venues.length > 0,
    queryFn: async () => {
      const out: Record<string, string[]> = {};
      await Promise.all(
        venues.map(async (v) => {
          out[v.id] = await listNextAvailableDates(v.id, 3);
        })
      );
      return out;
    },
  });

  const sportName =
    sport === "all" ? t("venues.allFeatured") : t(`sport.${sport}`);
  const sportEmoji = sport === "all" ? "🏟️" : SPORT_VISUAL[sport].emoji;
  const sportGlow  = sport === "all" ? "ig-stripe" : SPORT_VISUAL[sport].glow;

  return (
    <div className="space-y-7">
      {/* 顶部：返回 */}
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-500 hover:text-ink-800"
      >
        <span aria-hidden>←</span> {t("venues.backToSports")}
      </Link>

      {/* 头部：emoji 大圆 + 运动名 + 计数 */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`h-16 w-16 rounded-full ${sportGlow} flex items-center justify-center text-[36px] shadow-softSm`}>
            {sportEmoji}
          </div>
          <div>
            <p className="ig-eyebrow">
              {locale === "zh-CN" ? "运动 · 场地" : "Sport · Venues"}
            </p>
            <h1 className="font-display text-[40px] font-extrabold leading-none tracking-tighter text-ink-800">
              {sportName}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-ink-500">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas-200 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-football" />
            {venues.length} {locale === "zh-CN" ? "片场地" : "venues"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas-200 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-squash" />
            {t("venues.nextDates")}
          </span>
        </div>
      </header>

      <p className="max-w-xl text-[14px] text-ink-600">{t("venues.subtitle")}</p>

      {/* 过滤条：城市 / 区县 + 名称搜索（运动由 URL ?sport= 控制） */}
      <div className="flex flex-wrap items-center gap-2 border-y border-ink-300 py-3">
        <SelectPill
          value={cityParam}
          onChange={setCity}
          ariaLabel={t("venues.city")}
          disabled={cities.length === 0}
        >
          <option value="">{t("venues.cityAll")}</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </SelectPill>
        <SelectPill
          value={districtParam}
          onChange={setDistrict}
          ariaLabel={t("venues.district")}
          disabled={!cityParam || districts.length === 0}
        >
          <option value="">{t("venues.districtAll")}</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </SelectPill>
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t("venues.searchPlaceholder") /* "搜索场馆名称" */}
          className="ml-auto w-full max-w-xs rounded-full border border-ink-300 bg-canvas-50 px-4 py-1.5 text-[12px] text-ink-800 placeholder:text-ink-500 focus:border-ink-500 focus:outline-none transition"
        />
      </div>

      {/* 列表 */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-ink-300 bg-canvas-50 p-5">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : venues.length === 0 ? (
        <EmptyState
          icon="∅"
          title={t("venues.emptyTitle")}
          body={t("venues.emptyBody")}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4">
          {venues.map((v) => {
            const dates = datesByVenue[v.id] ?? [];
            const priceValid = v.basePriceCents > 0;
            const vis = SPORT_VISUAL[v.sportType];
            return (
              <li key={v.id}>
                <Link
                  to={`/venues/${v.id}`}
                  className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-800 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded-2xl"
                >
                  <article className="flex flex-col sm:flex-row items-stretch gap-4 sm:gap-5 rounded-2xl border border-ink-300 bg-canvas-50 p-4 sm:p-5 shadow-softSm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-soft group-hover:border-ink-500">
                    {/* 左侧：emoji 头像圆 */}
                    <div className="flex-shrink-0 flex items-start sm:items-center">
                      <div className={`h-16 w-16 rounded-full ${vis.glow} flex items-center justify-center text-[32px] shadow-softSm`}>
                        {vis.emoji}
                      </div>
                    </div>

                    {/* 中部：标题 / 地址 / 日期 chip */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono tracking-[0.2em] text-ink-500 uppercase">
                          {vis.mono}
                        </span>
                        {v.requireApproval && (
                          <span className="rounded-full border border-ink-300 px-2 py-0.5 text-[10px] font-mono tracking-wider text-ink-600">
                            {t("venues.requireApproval")}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 font-display text-[20px] font-extrabold leading-tight text-ink-800 tracking-tight">
                        {v.name}
                      </h3>
                      <p className="mt-1 text-[13px] text-ink-600 truncate">
                        {v.address}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono tracking-[0.18em] text-ink-500 uppercase">
                          {t("venues.nextDates")}
                        </span>
                        {dates.length === 0 ? (
                          <span className="text-[11px] text-ink-500">—</span>
                        ) : (
                          dates.map((iso) => (
                            <span
                              key={iso}
                              className="rounded-full bg-canvas-200 px-2 py-0.5 text-[11px] font-mono tracking-wider text-ink-700"
                            >
                              {dateChipLabel(iso, t)}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 右侧：容量 + 价格 */}
                    <div className="flex flex-row sm:flex-col items-end sm:items-end justify-between sm:justify-center gap-3 sm:gap-2 sm:text-right sm:pl-5 sm:border-l border-ink-200 min-w-[120px]">
                      <div>
                        <p className="text-[10px] font-mono tracking-[0.18em] text-ink-500 uppercase">
                          {t("venues.capacity")}
                        </p>
                        <p className="mt-0.5 font-numeric text-[18px] font-extrabold text-ink-800">
                          {v.capacity}
                          <span className="ml-1 text-[10px] font-mono tracking-wider text-ink-500">
                            {t("venues.capacityUnit")}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="font-numeric text-[18px] font-extrabold leading-none text-ink-800">
                          {priceValid ? formatMoney(v.basePriceCents, locale) : "—"}
                        </p>
                        <p className="mt-0.5 text-[10px] font-mono tracking-[0.18em] text-ink-500">
                          {priceValid ? t("venueDetail.perHour") : t("venues.priceN/A")}
                        </p>
                      </div>
                    </div>

                    {/* 末尾箭头 */}
                    <div className="hidden sm:flex items-center text-ink-400 group-hover:text-ink-800 transition-colors">
                      <span className="text-xl">→</span>
                    </div>
                  </article>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
