// 与 PRD §5 数据模型对齐的 TS 类型
// 命名沿用 PRD：snake_case 字段，camelCase 局部类型名
// 注：v2 mock 阶段在 PRD 基础上额外加了 `squash`、场馆 capacity/notes、
// 场次 capacity/confirmedCount 等展示用字段，落到 Supabase 时同步改 migration。

export type Locale = "zh-CN" | "en-US";
export type Role = "user" | "owner" | "admin";
export type SportType =
  | "squash"        // 壁球（本期 UI 优先展示，PRD v2 增量）
  | "badminton"
  | "basketball"
  | "football"
  | "tennis"
  | "table_tennis"
  | "volleyball"
  | "other";

export const SPORT_TYPES: SportType[] = [
  "squash",
  "badminton",
  "basketball",
  "football",
  "tennis",
  "table_tennis",
  "volleyball",
  "other",
];

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "rejected";

export type OwnerAppStatus = "pending" | "approved" | "rejected";
export type WordSeverity = "block" | "review";
export type SlotStatus = "available" | "held" | "booked" | "blocked";

export interface Profile {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string;
  phone?: string;
  role: Role;
  locale: Locale;
  createdAt: string;
}

export interface Venue {
  id: string;
  ownerId: string;
  name: string;
  sportType: SportType;
  // —— 结构化地址（替代旧 address text，PRD §US-203）——
  provinceCode: string;   // GB/T 2260 省级代码，如 "310000"
  cityCode: string;       // 市级代码，如 "310100"
  districtCode: string;   // 区/县级代码，如 "310115"
  addressDetail: string;  // 街道门牌等详细地址
  description: string;
  images: string[];
  openTimeStart: string; // "08:00"
  openTimeEnd: string;   // "22:00"
  slotDurationMinutes: 30 | 60 | 90 | 120;
  requireApproval: boolean;
  cancelHours: number;
  basePriceCents: number;
  // —— amenities：场馆特性清单（PRD §US-208）——
  // 元素格式：`preset:<key>` 或 `custom:<label>`
  // preset 取值见 AMENITY_PRESETS
  amenities: string[];
  status: "active" | "inactive";
  createdAt: string;
  // —— v2 mock 增量字段 ——
  capacity: number;        // 默认单场地容纳人数；具体场地可在 courts[*].capacity 覆盖
  notes?: string;          // 场馆备注（空时 UI 渲染为「无」）
}

// —— v3：场馆下属的「场地 / court」 ——
// 一个球馆通常有 2–4 片场地（A/B/C…），场主可自由命名；slot 改挂到 court 下，
// 实现「球馆 → 场次 → 场地」三层预订流程。名称按双语独立存，缺一边时回退另一边。
export interface Court {
  id: string;
  venueId: string;
  name_zh: string;         // 中文显示名（"A 场" / "1 号场"）
  name_en: string;         // 英文显示名（"Court A" / "Court 1"）
  sortOrder: number;       // 列表/选择时的稳定排序
  capacity: number;        // 单场地容纳人数（拼场容量；不是预订占位）
  priceCents: number;      // 单片场地小时价；0 = 沿用 venue.basePriceCents（PRD §US-203b）
  notes?: string;          // 单片场地备注（"靠窗 / 有空调"）
  isActive: boolean;       // 软停用；停用后该 court 不再展示
  createdAt: string;
}

export interface VenueService {
  id: string;
  venueId: string;
  name: string;
  priceCents: number;
  required: boolean;
}

export interface Slot {
  id: string;
  venueId: string;
  courtId: string;         // v3：隶属具体场地；同 court 同 starts_at 唯一
  startsAt: string; // ISO
  endsAt: string;
  status: SlotStatus;
  // —— v2 mock 增量字段 ——
  capacity: number;          // 本场总容纳
  confirmedCount: number;    // 已确认参加人数
}

// —— 时段模板（PRD §US-205 扩展）——
// 描述"周内某天 / 每天，时段窗口 [timeStart, timeEnd) 内开放哪几片场"
export interface SlotTemplate {
  id: string;
  venueId: string;
  dayOfWeek: number | null;  // 0-6 (Sun-Sat)，null = 每天
  timeStart: string;         // "08:00"
  timeEnd: string;           // "09:00"
  courtIds: string[];        // 该窗口内开放的场地 ID 列表
  slotDurationMinutes?: 30 | 60 | 90 | 120; // 可选覆盖；缺省沿用 venue.slotDurationMinutes
  createdAt: string;
}

// amenities 预设 key 常量（PRD §US-208）
export const AMENITY_PRESETS = [
  "concession",         // 小卖部
  "restroom",           // 洗手间
  "equipment_rental",   // 运动器材出租
  "shower",             // 淋浴间
  "parking",            // 停车位
  "locker",             // 储物柜
  "wifi",               // Wi-Fi
  "changing_room",      // 更衣室
] as const;
export type AmenityPreset = typeof AMENITY_PRESETS[number];

// amenities 元素格式辅助
export const AMENITY_PRESET_PREFIX = "preset:" as const;
export const AMENITY_CUSTOM_PREFIX = "custom:" as const;
export const isPresetAmenity = (s: string): s is `${typeof AMENITY_PRESET_PREFIX}${AmenityPreset}` =>
  s.startsWith(AMENITY_PRESET_PREFIX) &&
  (AMENITY_PRESETS as readonly string[]).includes(s.slice(AMENITY_PRESET_PREFIX.length));
export const isCustomAmenity = (s: string): s is `${typeof AMENITY_CUSTOM_PREFIX}${string}` =>
  s.startsWith(AMENITY_CUSTOM_PREFIX) && s.length > AMENITY_CUSTOM_PREFIX.length;
export const presetAmenityKey = (k: AmenityPreset): string => `${AMENITY_PRESET_PREFIX}${k}`;
export const customAmenityKey = (label: string): string => `${AMENITY_CUSTOM_PREFIX}${label.trim()}`;

export interface BookingServiceLine {
  serviceId: string;
  quantity: number;
  priceCentsSnapshot: number;
}

export interface Booking {
  id: string;
  userId: string;
  venueId: string;
  slotIds: string[];
  status: BookingStatus;
  contactName: string;
  contactPhone: string;
  totalPriceCents: number;
  notes?: string;
  cancelReason?: string;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
  services: BookingServiceLine[];
}

export interface OwnerApplication {
  id: string;
  userId: string;
  realName: string;
  idCardNo: string;
  contactPhone: string;
  licenseUrl?: string;
  status: OwnerAppStatus;
  rejectReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

export interface SensitiveWord {
  id: string;
  word: string;
  severity: WordSeverity;
  note?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: "admin" | "owner";
  // 已知动作（与 PRD §4.4 对齐）：
  //   review_owner_app · review_booking
  //   word_add · word_update · word_toggle · word_delete · word_bulk_import
  //   venue_update · venue_set_status
  //   admin_role_change
  // 留 string 方便后续扩展，但 UI 渲染时通过 t(`admin.action.${log.action}`) 双语化
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}
