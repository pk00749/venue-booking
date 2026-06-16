// 首页 —— Instagram 风
//   1) 克制 hero：标题 + 副标 + IG 渐变 CTA + 计数 chip
//   2) 三张运动卡：白底圆角 16 + emoji 圆形头像（彩色径向渐变背景）+ 描述 + CTA
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { listVenues } from "@/features/venues/api";
import { useSession, useUi } from "@/lib/store";
import { FEATURED_SPORTS } from "@/lib/mock-data";
import type { SportType } from "@/lib/types";
import { useMemo } from "react";
import { format } from "date-fns";

type SportVisual = {
  emoji: string;
  zh: string;
  glow: string;      // tailwind class for radial gradient bg
  ring: string;      // tailwind class for ring color
  accent: string;    // text accent color
  light: string;     // light tint bg
  mono: string;      // short mono label
  blurb: { zh: string; en: string };
};

const SPORT_VISUAL: Record<SportType, SportVisual> = {
  squash: {
    emoji: "🏸",
    zh:    "壁球",
    glow:  "bg-squash-glow",
    ring:  "ring-squash",
    accent:"text-squash-dark",
    light: "bg-squash-light",
    mono:  "SQUASH",
    blurb: { zh: "小空间，撞墙节拍；2-4 人即开。", en: "Wall-bouncing rallies for 2-4." },
  },
  football: {
    emoji: "⚽",
    zh:    "足球",
    glow:  "bg-football-glow",
    ring:  "ring-football",
    accent:"text-football-dark",
    light: "bg-football-light",
    mono:  "FOOTBALL",
    blurb: { zh: "五人/七人场，凑队开踢；周末最热。", en: "5- or 7-a-side, weekends are busy." },
  },
  basketball: {
    emoji: "🏀",
    zh:    "篮球",
    glow:  "bg-hoops-glow",
    ring:  "ring-hoops",
    accent:"text-hoops-dark",
    light: "bg-hoops-light",
    mono:  "BASKETBALL",
    blurb: { zh: "半场 3v3，节奏快；下班也能开。", en: "Half-court 3v3, easy after work." },
  },
  badminton:    { emoji:"🏸", zh:"羽毛球", glow:"bg-squash-glow",   ring:"ring-squash",   accent:"text-squash-dark",   light:"bg-squash-light",   mono:"BADMINTON",    blurb:{zh:"轻量好上手。",en:"Light & easy."} },
  tennis:       { emoji:"🎾", zh:"网球",   glow:"bg-football-glow", ring:"ring-football", accent:"text-football-dark", light:"bg-football-light", mono:"TENNIS",       blurb:{zh:"标准硬地球场。",en:"Hard court ready."} },
  table_tennis: { emoji:"🏓", zh:"乒乓",   glow:"bg-hoops-glow",    ring:"ring-hoops",    accent:"text-hoops-dark",    light:"bg-hoops-light",    mono:"PING PONG",    blurb:{zh:"室内快打。",en:"Indoor fast rallies."} },
  volleyball:   { emoji:"🏐", zh:"排球",   glow:"bg-football-glow", ring:"ring-football", accent:"text-football-dark", light:"bg-football-light", mono:"VOLLEYBALL",   blurb:{zh:"六人组队。",en:"6-a-side squads."} },
  other:        { emoji:"🎯", zh:"其他",   glow:"bg-ink-200",       ring:"ring-ink-500",  accent:"text-ink-700",       light:"bg-ink-100",       mono:"OTHER",        blurb:{zh:"等你提名。",en:"More coming soon."} },
};

function SportCard({
  sport, count, href, locale,
}: { sport: SportType; count: number; href: string; locale: string }) {
  const v = SPORT_VISUAL[sport];
  const blurb = locale === "zh-CN" ? v.blurb.zh : v.blurb.en;
  return (
    <Link
      to={href}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-800 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <article className="relative h-full bg-canvas-50 rounded-2xl border border-ink-300 overflow-hidden shadow-softSm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-soft">
        {/* 顶部：大色块 + emoji 圆 + mono 标签 */}
        <div className={`relative ${v.light} h-44 overflow-hidden`}>
          <div className="absolute right-4 top-4 text-[10px] font-mono tracking-[0.22em] text-ink-600">
            {v.mono}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className={`h-20 w-20 rounded-full ${v.glow} flex items-center justify-center text-[44px] shadow-softSm`}>
              {v.emoji}
            </div>
          </div>
        </div>

        {/* 卡片内容 */}
        <div className="p-4">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-[22px] font-extrabold tracking-tight text-ink-800">
                {v.zh}
              </h3>
              <p className="mt-0.5 text-[12px] text-ink-500 font-mono tracking-wider">
                {v.mono}
              </p>
            </div>
            <div className="text-right">
              <div className={`font-numeric text-2xl font-extrabold leading-none ${v.accent}`}>
                {count}
              </div>
              <div className="text-[10px] text-ink-500 mt-0.5">
                {locale === "zh-CN" ? "片球场" : "courts"}
              </div>
            </div>
          </div>

          <p className="mt-3 text-[13px] text-ink-700 leading-relaxed line-clamp-2">
            {blurb}
          </p>

          {/* 底部行动条 */}
          <div className="mt-4 flex items-center justify-between border-t border-ink-200 pt-3">
            <span className={`text-[12px] font-semibold ${v.accent}`}>
              {locale === "zh-CN" ? "找场开打" : "Find a court"}
            </span>
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${v.glow} text-white text-sm transition-transform group-hover:translate-x-0.5`}>
              →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const locale = useUi((s) => s.locale);
  const { data: venues = [] } = useQuery({
    queryKey: ["venues", "home"],
    queryFn: () => listVenues({}),
  });

  const counts = useMemo(() => {
    const map: Partial<Record<SportType, number>> = {};
    for (const v of venues) map[v.sportType] = (map[v.sportType] ?? 0) + 1;
    return map;
  }, [venues]);

  const today = format(new Date(), "MM.dd");
  const totalCourts = useMemo(
    () => FEATURED_SPORTS.reduce((s, sp) => s + (counts[sp] ?? 0), 0),
    [counts]
  );

  return (
    <div className="space-y-10">
      {/* 顶部 eyebrow：刊号 / 日期 */}
      <div className="flex items-center justify-between">
        <p className="ig-eyebrow">
          {locale === "zh-CN" ? "约球手册" : "Yueqiu almanac"} · 06.2026
        </p>
        <p className="ig-eyebrow">
          {locale === "zh-CN" ? "上海" : "Shanghai"} · {today}
        </p>
      </div>

      {/* IG 风 Hero */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-8">
          <h1 className="font-display text-[56px] sm:text-[72px] font-extrabold leading-[0.95] tracking-tighter text-ink-800">
            {t("app.name")}
            <span className="inline-block align-top ml-2 text-[40px] sm:text-[52px]">🏟️</span>
          </h1>
          <p className="mt-3 text-[18px] text-ink-600 font-medium max-w-xl">
            {t("app.tagline")}
          </p>
          <p className="mt-2 text-[14px] text-ink-500 max-w-lg">
            {locale === "zh-CN"
              ? "挑一项运动，凑齐队友，挑个时间——剩下的我们来处理。"
              : "Pick a sport, find your crew, choose a slot. We handle the rest."}
          </p>
        </div>

        <div className="md:col-span-4 flex flex-col items-stretch md:items-end gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas-200 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-squash" />
              {totalCourts} {locale === "zh-CN" ? "片球场" : "courts"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas-200 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-football" />
              03 {locale === "zh-CN" ? "类运动" : "sports"}
            </span>
          </div>
        </div>
      </section>

      {/* 三张运动卡 */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURED_SPORTS.map((sport) => (
            <SportCard
              key={sport}
              sport={sport}
              count={counts[sport] ?? 0}
              href={`/venues?sport=${sport}`}
              locale={locale}
            />
          ))}
        </div>
        {!user && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <Link
              to="/become-owner"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-300 bg-canvas-50 px-5 py-3 text-[14px] font-semibold text-ink-800 hover:bg-ink-100 transition"
            >
              {t("home.ctaOwner")}
            </Link>
            <p className="text-[12px] text-ink-500">
              {locale === "zh-CN" ? "手上有场？入驻即上线" : "Own a court? List it in minutes."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
