// 内存 Mock 数据层 —— 与 PRD §5 字段一致，便于后续替换为 Supabase 调用
// 替换策略：每个 export 函数都返回 Promise，可逐个换为 supabase.from(...).select()
import type {
  Booking,
  Court,
  Notification,
  OwnerApplication,
  Profile,
  SensitiveWord,
  Slot,
  SportType,
  Venue,
  VenueService,
} from "./types";

// 简单 ID 生成
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

// 可复用的「确定性伪随机」：同一 (venueId, day) 跑出来的 confirmedCount
// 是稳定的，避免每次刷新跳来跳去
function seededRand(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 0x100000000;
  };
}

// ---------- 初始数据 ----------
const seedUsers: Profile[] = [
  { id: "u_demo",  email: "demo@example.com",  nickname: "Demo User",   role: "user",  locale: "zh-CN", createdAt: now() },
  { id: "u_owner", email: "owner@example.com", nickname: "场馆主理人",   role: "owner", locale: "zh-CN", createdAt: now() },
  { id: "u_admin", email: "admin@example.com", nickname: "平台管理员",   role: "admin", locale: "zh-CN", createdAt: now() },
];

// 三类运动示范数据：壁球 4 片 · 足球 3 片 · 篮球 5 片（共 12 块场馆）
const seedVenues: Venue[] = [
  // 壁球 ——
  {
    id: "v_sq_1", ownerId: "u_owner", name: "前滩壁球会", sportType: "squash",
    address: "上海市浦东新区前滩大道 18 号 B1",
    description: "4 片国际标准壁球场，木地板 + 玻璃后墙，附淋浴与储物柜。",
    images: [], openTimeStart: "07:00", openTimeEnd: "23:00",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 2,
    basePriceCents: 12000, status: "active", createdAt: now(),
    capacity: 4, notes: "自带球拍享 9 折；更衣室提供毛巾。",
  },
  {
    id: "v_sq_2", ownerId: "u_owner", name: "徐家汇壁球馆", sportType: "squash",
    address: "上海市徐汇区漕溪北路 333 号 5 楼",
    description: "2 片单打球场，配 LED 比赛照明；新装空调。",
    images: [], openTimeStart: "08:00", openTimeEnd: "22:00",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 2,
    basePriceCents: 9800, status: "active", createdAt: now(),
    capacity: 4,
  },
  {
    id: "v_sq_3", ownerId: "u_owner", name: "联洋壁球俱乐部", sportType: "squash",
    address: "上海市浦东新区芳甸路 199 号",
    description: "教练驻场，可预约私教；周末 18:00 后需提前 24h 锁场。",
    images: [], openTimeStart: "09:00", openTimeEnd: "22:00",
    slotDurationMinutes: 60, requireApproval: true, cancelHours: 4,
    basePriceCents: 13800, status: "active", createdAt: now(),
    capacity: 4, notes: "教练驻场时段：周二 / 周四 19:00–21:00。",
  },
  {
    id: "v_sq_4", ownerId: "u_owner", name: "静安壁球生活馆", sportType: "squash",
    address: "上海市静安区南京西路 1500 号",
    description: "商务区午休时段 12:00–14:00 推出 30 分钟快打卡。",
    images: [], openTimeStart: "07:30", openTimeEnd: "22:30",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 2,
    basePriceCents: 10800, status: "active", createdAt: now(),
    capacity: 4, notes: "12:00–14:00 推出 30 分钟快打（暂仅会员）。",
  },
  // 足球 ——
  {
    id: "v_fb_1", ownerId: "u_owner", name: "绿茵五人制足球场", sportType: "football",
    address: "上海市闵行区吴中路 999 号",
    description: "3 片五人制人工草皮，含夜间灯光；提供分队背心。",
    images: [], openTimeStart: "10:00", openTimeEnd: "22:00",
    slotDurationMinutes: 90, requireApproval: false, cancelHours: 6,
    basePriceCents: 30000, status: "active", createdAt: now(),
    capacity: 10, notes: "雨天提前 2 小时短信通知改期。",
  },
  {
    id: "v_fb_2", ownerId: "u_owner", name: "世博源 7 人制球场", sportType: "football",
    address: "上海市浦东新区国展路 1099 号",
    description: "1 片 7 人制真草，含球门网与计分牌。",
    images: [], openTimeStart: "10:00", openTimeEnd: "23:00",
    slotDurationMinutes: 90, requireApproval: true, cancelHours: 12,
    basePriceCents: 60000, status: "active", createdAt: now(),
    capacity: 14, notes: "需提前 12 小时锁场；带队长身份证复印件。",
  },
  {
    id: "v_fb_3", ownerId: "u_owner", name: "杨浦滨江足球公园", sportType: "football",
    address: "上海市杨浦区杨树浦路 2524 号",
    description: "2 片五人制人工草皮，免费提供分队背心。",
    images: [], openTimeStart: "08:00", openTimeEnd: "22:00",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 4,
    basePriceCents: 24000, status: "active", createdAt: now(),
    capacity: 10,
  },
  // 篮球 ——
  {
    id: "v_bk_1", ownerId: "u_owner", name: "星光羽毛球馆", sportType: "badminton",
    address: "上海市浦东新区张江路 100 号 3 楼",
    description: "12 片标准羽毛球场，PVC 运动地板，全场 LED 灯光。",
    images: [], openTimeStart: "08:00", openTimeEnd: "22:00",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 2,
    basePriceCents: 8000, status: "active", createdAt: now(),
    capacity: 4,
  },
  {
    id: "v_bk_2", ownerId: "u_owner", name: "城市之光篮球公园", sportType: "basketball",
    address: "上海市徐汇区漕溪北路 88 号",
    description: "室外 4 片半场，室内 2 片全场；提供计分牌与饮水机。",
    images: [], openTimeStart: "09:00", openTimeEnd: "23:00",
    slotDurationMinutes: 90, requireApproval: true, cancelHours: 4,
    basePriceCents: 15000, status: "active", createdAt: now(),
    capacity: 10, notes: "室外场雨天关闭；可免费使用计分牌。",
  },
  {
    id: "v_bk_3", ownerId: "u_owner", name: "五角场篮球中心", sportType: "basketball",
    address: "上海市杨浦区国济路 100 号",
    description: "室内 3 片全场，配木地板与电子记分。",
    images: [], openTimeStart: "08:00", openTimeEnd: "22:30",
    slotDurationMinutes: 90, requireApproval: false, cancelHours: 4,
    basePriceCents: 18000, status: "active", createdAt: now(),
    capacity: 10, notes: "3v3 黄金档 19:00–21:00。",
  },
  {
    id: "v_bk_4", ownerId: "u_owner", name: "普陀篮球工场", sportType: "basketball",
    address: "上海市普陀区真大路 520 号",
    description: "1 片室内全场 + 2 片半场，丙烯酸地面。",
    images: [], openTimeStart: "09:00", openTimeEnd: "23:00",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 2,
    basePriceCents: 12000, status: "active", createdAt: now(),
    capacity: 10,
  },
  {
    id: "v_bk_5", ownerId: "u_owner", name: "金桥 3v3 篮球场", sportType: "basketball",
    address: "上海市浦东新区金桥路 1788 号",
    description: "2 片半场仅供 3v3 比赛；周末设报名制友谊赛。",
    images: [], openTimeStart: "10:00", openTimeEnd: "22:00",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 2,
    basePriceCents: 9000, status: "active", createdAt: now(),
    capacity: 6, notes: "3v3 报名赛：周六 14:00 / 周日 10:00。",
  },
];

// —— v3：场馆下属「场地 / court」预设 ——
// 按场馆业务描述取「片」数；每家场馆起 1-6 片。
const courtPlans: Record<string, { count: number; perCourtCapacity: number }> = {
  v_sq_1: { count: 4, perCourtCapacity: 4 },   // 4 片国际标准壁球场
  v_sq_2: { count: 2, perCourtCapacity: 2 },   // 2 片单打球场
  v_sq_3: { count: 4, perCourtCapacity: 4 },
  v_sq_4: { count: 4, perCourtCapacity: 4 },
  v_fb_1: { count: 3, perCourtCapacity: 10 },  // 3 片五人制
  v_fb_2: { count: 1, perCourtCapacity: 14 },  // 1 片 7 人制
  v_fb_3: { count: 2, perCourtCapacity: 10 },  // 2 片五人制
  v_bk_1: { count: 6, perCourtCapacity: 4 },   // 羽毛球（demo 上限 6）
  v_bk_2: { count: 4, perCourtCapacity: 10 },
  v_bk_3: { count: 3, perCourtCapacity: 10 },
  v_bk_4: { count: 3, perCourtCapacity: 10 },
  v_bk_5: { count: 2, perCourtCapacity: 6 },
};

// 场地命名辅助：0→A、1→B、…、25→Z、26→1、27→2 …
export function courtLetter(i: number): string {
  if (i < 26) return String.fromCharCode(65 + i);
  return String(i - 25);
}

function genCourtsForVenue(v: Venue): Court[] {
  const plan = courtPlans[v.id] ?? { count: 1, perCourtCapacity: v.capacity };
  return Array.from({ length: plan.count }, (_, i) => ({
    id: `c_${v.id}_${i}`,
    venueId: v.id,
    name_zh: `${courtLetter(i)} 场`,
    name_en: `Court ${courtLetter(i)}`,
    sortOrder: i,
    capacity: plan.perCourtCapacity,
    isActive: true,
    createdAt: now(),
  }));
}

const seedServices: VenueService[] = [
  { id: "s_1", venueId: "v_sq_1", name: "壁球拍租赁", priceCents: 2000, required: false },
  { id: "s_2", venueId: "v_sq_1", name: "护目镜",       priceCents: 1500, required: false },
  { id: "s_3", venueId: "v_bk_2", name: "饮用水（箱）", priceCents: 3000, required: false },
  { id: "s_4", venueId: "v_fb_1", name: "分队背心（套）", priceCents: 1500, required: false },
  { id: "s_5", venueId: "v_bk_3", name: "电子记分（场）", priceCents: 2000, required: false },
];

// 为每片 court × 7 天 × 营业时段生成 slot（v3 改）
function genSlotsForCourts(v: Venue, courts: Court[]): Slot[] {
  const slots: Slot[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let d = 0; d < 7; d++) {
    const day = new Date(today);
    day.setDate(day.getDate() + d);
    const [sh, sm] = v.openTimeStart.split(":").map(Number);
    const [eh, em] = v.openTimeEnd.split(":").map(Number);
    const start = new Date(day);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(day);
    end.setHours(eh, em, 0, 0);
    const step = v.slotDurationMinutes;
    for (
      let t = new Date(start);
      t.getTime() + step * 60_000 <= end.getTime();
      t = new Date(t.getTime() + step * 60_000)
    ) {
      const ts = new Date(t);
      const te = new Date(t.getTime() + step * 60_000);
      for (const court of courts) {
        if (!court.isActive) continue;
        // 用 (courtId, dayIndex, ts) 当种子；同片场同时间跑出来的 confirmedCount 稳定
        const rand = seededRand(`${court.id}|${d}|${ts.getTime()}`);
        // 黄金档（周末 18-22 / 工作日 19-21）更容易被占满
        const hour = ts.getHours();
        const dow = ts.getDay();
        const isPrime = (dow === 0 || dow === 6) ? hour >= 18 && hour < 22 : hour >= 19 && hour < 21;
        const fillRatio = isPrime ? 0.55 + rand() * 0.45 : rand() * 0.7;
        const confirmedCount = Math.min(court.capacity, Math.floor(court.capacity * fillRatio));
        slots.push({
          id: `sl_${court.id}_${ts.getTime()}`,
          venueId: v.id,
          courtId: court.id,
          startsAt: ts.toISOString(),
          endsAt: te.toISOString(),
          status: confirmedCount >= court.capacity ? "booked" : "available",
          capacity: court.capacity,
          confirmedCount,
        });
      }
    }
  }
  return slots;
}

const seedCourts: Court[] = seedVenues.flatMap(genCourtsForVenue);
const seedSlots: Slot[] = seedVenues.flatMap((v) =>
  genSlotsForCourts(v, genCourtsForVenue(v)),
);

const seedBookings: Booking[] = [];
const seedOwnerApps: OwnerApplication[] = [
  { id: "oa_1", userId: "u_owner", realName: "王老板", idCardNo: "310**********1234", contactPhone: "138****8888", status: "approved", reviewedBy: "u_admin", reviewedAt: now(), createdAt: now() },
];
const seedNotifications: Notification[] = [];
const seedWords: SensitiveWord[] = [
  { id: "w_1", word: "违禁词A", severity: "block",  isActive: true, createdBy: "u_admin", createdAt: now() },
  { id: "w_2", word: "敏感词B", severity: "review", isActive: true, createdBy: "u_admin", createdAt: now() },
];

// ---------- 内存仓库 ----------
class Store {
  profiles: Profile[] = [...seedUsers];
  venues: Venue[] = [...seedVenues];
  courts: Court[] = [...seedCourts];
  services: VenueService[] = [...seedServices];
  slots: Slot[] = [...seedSlots];
  bookings: Booking[] = [...seedBookings];
  ownerApps: OwnerApplication[] = [...seedOwnerApps];
  notifications: Notification[] = [...seedNotifications];
  words: SensitiveWord[] = [...seedWords];

  reset() {
    this.profiles = [...seedUsers];
    this.venues = [...seedVenues];
    this.courts = [...seedCourts];
    this.services = [...seedServices];
    this.slots = [...seedSlots];
    this.bookings = [...seedBookings];
    this.ownerApps = [...seedOwnerApps];
    this.notifications = [...seedNotifications];
    this.words = [...seedWords];
  }
}

export const store = new Store();
export const newId = uid;
export const nowIso = now;

// 一组「v2 UI 优先展示的运动」——首页只展示这三个。
export const FEATURED_SPORTS: SportType[] = ["squash", "football", "basketball"];
