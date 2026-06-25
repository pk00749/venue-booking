import type { Locale } from "./types";
import type { Court } from "./types";

const moneyFmt = (locale: Locale) =>
  new Intl.NumberFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: locale === "zh-CN" ? "CNY" : "USD",
    maximumFractionDigits: 2,
  });

export function formatMoney(cents: number, locale: Locale = "zh-CN"): string {
  return moneyFmt(locale).format(cents / 100);
}

const dtFmt = (locale: Locale, withTime: boolean) =>
  new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: withTime ? "2-digit" : undefined,
    minute: withTime ? "2-digit" : undefined,
    hour12: false,
  });

export function formatDate(iso: string, locale: Locale = "zh-CN"): string {
  return dtFmt(locale, false).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: Locale = "zh-CN"): string {
  return dtFmt(locale, true).format(new Date(iso));
}

export function formatTimeRange(startIso: string, endIso: string, locale: Locale = "zh-CN"): string {
  return `${formatDateTime(startIso, locale)} – ${new Intl.DateTimeFormat(
    locale === "zh-CN" ? "zh-CN" : "en-US",
    { hour: "2-digit", minute: "2-digit", hour12: false }
  ).format(new Date(endIso))}`;
}

// 场地名按 locale 选择 name_zh / name_en；缺一边时回退另一边
export function formatCourtName(court: Court, locale: Locale = "zh-CN"): string {
  if (locale === "zh-CN") return court.name_zh || court.name_en || court.id;
  return court.name_en || court.name_zh || court.id;
}
