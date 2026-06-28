// 行政区划 helpers —— 基于 region-data 的扁平表做内存查询
// PRD §US-203：场馆地址用结构化省 / 市 / 区；UI 用级联下拉
import { MUNICIPALITY_CODES, REGIONS } from "./region-data";
import type { Region } from "./region-data";

const REGION_BY_CODE = new Map<string, Region>(REGIONS.map((r) => [r.code, r]));

export function getRegion(code: string | null | undefined): Region | null {
  if (!code) return null;
  return REGION_BY_CODE.get(code) ?? null;
}

// 省级全集（parentCode === null）
export function listProvinces(): Region[] {
  return REGIONS.filter((r) => r.parentCode === null);
}

// 省 → 市 / 直辖市的虚拟市项
// 直辖市：返回一条 city（code === provinceCode），方便 UI 共用一套「省→市→区」级联
// 非直辖市：返回该省下属的 CITIES 条目
export function listCitiesForProvince(provinceCode: string): Region[] {
  if (MUNICIPALITY_CODES.includes(provinceCode as (typeof MUNICIPALITY_CODES)[number])) {
    const r = getRegion(provinceCode);
    return r ? [r] : [];
  }
  return REGIONS.filter((r) => r.parentCode === provinceCode);
}

// 市 → 区
// 直辖市的 district 直接挂在 provinceCode 下
export function listDistrictsForCity(cityCode: string): Region[] {
  return REGIONS.filter((r) => r.parentCode === cityCode);
}

export function isMunicipality(provinceCode: string): boolean {
  return MUNICIPALITY_CODES.includes(provinceCode as (typeof MUNICIPALITY_CODES)[number]);
}

// 把结构化地址拼成展示文本：${省} ${市} ${区} ${detail}
// 缺哪一段就跳过该段（不应出现，但 mock 期兜底）
export function formatAddress(
  provinceCode: string,
  cityCode: string,
  districtCode: string,
  detail: string,
  locale: "zh-CN" | "en-US" = "zh-CN",
): string {
  const fields = [provinceCode, cityCode, districtCode]
    .map((c) => getRegion(c))
    .filter((r): r is Region => !!r);
  const place = fields
    .map((r) => (locale === "zh-CN" ? r.name_zh : r.name_en))
    .join(" ");
  const tail = (detail ?? "").trim();
  return tail ? `${place} ${tail}` : place;
}

// 按 code 取短名（用于 VenuesPage 筛选 chip 等只显示城市名的场景）
export function shortName(code: string | null | undefined, locale: "zh-CN" | "en-US" = "zh-CN"): string {
  const r = getRegion(code);
  if (!r) return code ?? "";
  return locale === "zh-CN" ? r.name_zh : r.name_en;
}
