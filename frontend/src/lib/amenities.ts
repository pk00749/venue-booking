// Amenities 预设常量 —— PRD §US-208
// key 用于 preset:<key> 字符串前缀；显示文案走 i18n key `amenity.<key>`
export const AMENITY_PRESETS_META: Array<{
  key: string;
  icon: string;        // 列表/详情页用 emoji 占位，避免引入额外图标库
  i18nKey: string;
}> = [
  { key: "concession",       icon: "🛒", i18nKey: "amenity.concession" },
  { key: "restroom",         icon: "🚻", i18nKey: "amenity.restroom" },
  { key: "equipment_rental", icon: "🏸", i18nKey: "amenity.equipment_rental" },
  { key: "shower",           icon: "🚿", i18nKey: "amenity.shower" },
  { key: "parking",          icon: "🅿️", i18nKey: "amenity.parking" },
  { key: "locker",           icon: "🔒", i18nKey: "amenity.locker" },
  { key: "wifi",             icon: "📶", i18nKey: "amenity.wifi" },
  { key: "changing_room",    icon: "👕", i18nKey: "amenity.changing_room" },
];

export function isPresetAmenityKey(key: string): boolean {
  return AMENITY_PRESETS_META.some((m) => m.key === key);
}
