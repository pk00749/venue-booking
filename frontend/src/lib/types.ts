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
  address: string;
  description: string;
  images: string[];
  openTimeStart: string; // "08:00"
  openTimeEnd: string;   // "22:00"
  slotDurationMinutes: 30 | 60 | 90 | 120;
  requireApproval: boolean;
  cancelHours: number;
  basePriceCents: number;
  status: "active" | "inactive";
  createdAt: string;
  // —— v2 mock 增量字段 ——
  capacity: number;        // 单场可容纳人数
  notes?: string;          // 场馆备注（空时 UI 渲染为「无」）
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
  startsAt: string; // ISO
  endsAt: string;
  status: SlotStatus;
  // —— v2 mock 增量字段 ——
  capacity: number;          // 本场总容纳
  confirmedCount: number;    // 已确认参加人数
}

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
  actorId?: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}
