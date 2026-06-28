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
import type { SlotTemplate } from "./types";
import type { AuditLog } from "./types";
import { customAmenityKey, presetAmenityKey } from "./types";

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
    provinceCode: "310000", cityCode: "310000", districtCode: "310115",
    addressDetail: "前滩大道 18 号 B1",
    description: "4 片国际标准壁球场，木地板 + 玻璃后墙，附淋浴与储物柜。",
    images: [], openTimeStart: "07:00", openTimeEnd: "23:00",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 2,
    basePriceCents: 12000, status: "active", createdAt: now(),
    capacity: 4, notes: "自带球拍享 9 折；更衣室提供毛巾。",
    amenities: [presetAmenityKey("restroom"), presetAmenityKey("locker"), presetAmenityKey("shower"), presetAmenityKey("concession"), presetAmenityKey("equipment_rental")]
  },
  {
    id: "v_sq_2", ownerId: "u_owner", name: "徐家汇壁球馆", sportType: "squash",
    provinceCode: "310000", cityCode: "310000", districtCode: "310104",
    addressDetail: "漕溪北路 333 号 5 楼",
    description: "2 片单打球场，配 LED 比赛照明；新装空调。",
    images: [], openTimeStart: "08:00", openTimeEnd: "22:00",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 2,
    basePriceCents: 9800, status: "active", createdAt: now(),
    capacity: 4,
    amenities: [presetAmenityKey("restroom"), presetAmenityKey("wifi"), presetAmenityKey("changing_room")]
  },
  {
    id: "v_sq_3", ownerId: "u_owner", name: "联洋壁球俱乐部", sportType: "squash",
    provinceCode: "310000", cityCode: "310000", districtCode: "310115",
    addressDetail: "芳甸路 199 号",
    description: "教练驻场，可预约私教；周末 18:00 后需提前 24h 锁场。",
    images: [], openTimeStart: "09:00", openTimeEnd: "22:00",
    slotDurationMinutes: 60, requireApproval: true, cancelHours: 4,
    basePriceCents: 13800, status: "active", createdAt: now(),
    capacity: 4, notes: "教练驻场时段：周二 / 周四 19:00–21:00。",
    amenities: [presetAmenityKey("restroom"), presetAmenityKey("shower"), presetAmenityKey("locker"), customAmenityKey("私教课程")]
  },
  {
    id: "v_sq_4", ownerId: "u_owner", name: "静安壁球生活馆", sportType: "squash",
    provinceCode: "310000", cityCode: "310000", districtCode: "310106",
    addressDetail: "南京西路 1500 号",
    description: "商务区午休时段 12:00–14:00 推出 30 分钟快打卡。",
    images: [], openTimeStart: "07:30", openTimeEnd: "22:30",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 2,
    basePriceCents: 10800, status: "active", createdAt: now(),
    capacity: 4, notes: "12:00–14:00 推出 30 分钟快打（暂仅会员）。",
    amenities: [presetAmenityKey("restroom"), presetAmenityKey("wifi"), presetAmenityKey("changing_room")]
  },
  // 足球 ——
  {
    id: "v_fb_1", ownerId: "u_owner", name: "绿茵五人制足球场", sportType: "football",
    provinceCode: "310000", cityCode: "310000", districtCode: "310112",
    addressDetail: "吴中路 999 号",
    description: "3 片五人制人工草皮，含夜间灯光；提供分队背心。",
    images: [], openTimeStart: "10:00", openTimeEnd: "22:00",
    slotDurationMinutes: 90, requireApproval: false, cancelHours: 6,
    basePriceCents: 30000, status: "active", createdAt: now(),
    capacity: 10, notes: "雨天提前 2 小时短信通知改期。",
    amenities: [presetAmenityKey("restroom"), presetAmenityKey("parking"), presetAmenityKey("equipment_rental"), customAmenityKey("夜间灯光")]
  },
  {
    id: "v_fb_2", ownerId: "u_owner", name: "世博源 7 人制球场", sportType: "football",
    provinceCode: "310000", cityCode: "310000", districtCode: "310115",
    addressDetail: "国展路 1099 号",
    description: "1 片 7 人制真草，含球门网与计分牌。",
    images: [], openTimeStart: "10:00", openTimeEnd: "23:00",
    slotDurationMinutes: 90, requireApproval: true, cancelHours: 12,
    basePriceCents: 60000, status: "active", createdAt: now(),
    capacity: 14, notes: "需提前 12 小时锁场；带队长身份证复印件。",
    amenities: [presetAmenityKey("restroom"), presetAmenityKey("parking"), presetAmenityKey("changing_room")]
  },
  {
    id: "v_fb_3", ownerId: "u_owner", name: "杨浦滨江足球公园", sportType: "football",
    provinceCode: "310000", cityCode: "310000", districtCode: "310110",
    addressDetail: "杨树浦路 2524 号",
    description: "2 片五人制人工草皮，免费提供分队背心。",
    images: [], openTimeStart: "08:00", openTimeEnd: "22:00",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 4,
    basePriceCents: 24000, status: "active", createdAt: now(),
    capacity: 10,
    amenities: [presetAmenityKey("restroom"), presetAmenityKey("parking"), presetAmenityKey("equipment_rental")]
  },
  // 篮球 ——
  {
    id: "v_bk_1", ownerId: "u_owner", name: "星光羽毛球馆", sportType: "badminton",
    provinceCode: "310000", cityCode: "310000", districtCode: "310115",
    addressDetail: "张江路 100 号 3 楼",
    description: "12 片标准羽毛球场，PVC 运动地板，全场 LED 灯光。",
    images: [], openTimeStart: "08:00", openTimeEnd: "22:00",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 2,
    basePriceCents: 8000, status: "active", createdAt: now(),
    capacity: 4,
    amenities: [presetAmenityKey("restroom"), presetAmenityKey("equipment_rental"), presetAmenityKey("wifi"), presetAmenityKey("locker")]
  },
  {
    id: "v_bk_2", ownerId: "u_owner", name: "城市之光篮球公园", sportType: "basketball",
    provinceCode: "310000", cityCode: "310000", districtCode: "310104",
    addressDetail: "漕溪北路 88 号",
    description: "室外 4 片半场，室内 2 片全场；提供计分牌与饮水机。",
    images: [], openTimeStart: "09:00", openTimeEnd: "23:00",
    slotDurationMinutes: 90, requireApproval: true, cancelHours: 4,
    basePriceCents: 15000, status: "active", createdAt: now(),
    capacity: 10, notes: "室外场雨天关闭；可免费使用计分牌。",
    amenities: [presetAmenityKey("restroom"), presetAmenityKey("parking"), presetAmenityKey("concession"), presetAmenityKey("changing_room")]
  },
  {
    id: "v_bk_3", ownerId: "u_owner", name: "五角场篮球中心", sportType: "basketball",
    provinceCode: "310000", cityCode: "310000", districtCode: "310110",
    addressDetail: "国济路 100 号",
    description: "室内 3 片全场，配木地板与电子记分。",
    images: [], openTimeStart: "08:00", openTimeEnd: "22:30",
    slotDurationMinutes: 90, requireApproval: false, cancelHours: 4,
    basePriceCents: 18000, status: "active", createdAt: now(),
    capacity: 10, notes: "3v3 黄金档 19:00–21:00。",
    amenities: [presetAmenityKey("restroom"), presetAmenityKey("changing_room")]
  },
  {
    id: "v_bk_4", ownerId: "u_owner", name: "普陀篮球工场", sportType: "basketball",
    provinceCode: "310000", cityCode: "310000", districtCode: "310107",
    addressDetail: "真大路 520 号",
    description: "1 片室内全场 + 2 片半场，丙烯酸地面。",
    images: [], openTimeStart: "09:00", openTimeEnd: "23:00",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 2,
    basePriceCents: 12000, status: "active", createdAt: now(),
    capacity: 10,
    amenities: [presetAmenityKey("restroom"), presetAmenityKey("changing_room"), presetAmenityKey("locker")]
  },
  {
    id: "v_bk_5", ownerId: "u_owner", name: "金桥 3v3 篮球场", sportType: "basketball",
    provinceCode: "310000", cityCode: "310000", districtCode: "310115",
    addressDetail: "金桥路 1788 号",
    description: "2 片半场仅供 3v3 比赛；周末设报名制友谊赛。",
    images: [], openTimeStart: "10:00", openTimeEnd: "22:00",
    slotDurationMinutes: 60, requireApproval: false, cancelHours: 2,
    basePriceCents: 9000, status: "active", createdAt: now(),
    capacity: 6, notes: "3v3 报名赛：周六 14:00 / 周日 10:00。",
    amenities: [presetAmenityKey("restroom"), presetAmenityKey("parking"), customAmenityKey("3v3 友谊赛报名")]
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

// —— 演示用：单片场地的 priceCents 覆盖；key 为 "${venueId}:${index}"；0 = 沿用 venue.basePriceCents
// 故意给徐家汇的 B 场一个更低的单价，体现「B 场朝西不通风」的运营场景
const courtPriceOverrides: Record<string, number> = {
  "v_sq_2:1": 8800,
};

// 演示用：单片场地的备注
const courtNotesOverrides: Record<string, string> = {
  "v_sq_1:0": "靠窗，木地板",
  "v_sq_1:2": "无窗，玻璃后墙",
  "v_sq_2:1": "朝西，下午有阳光",
  "v_fb_1:0": "灯光最佳",
  "v_bk_3:1": "中线主场",
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
    priceCents: courtPriceOverrides[`${v.id}:${i}`] ?? 0,
    notes: courtNotesOverrides[`${v.id}:${i}`],
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

// —— v3：默认时段模板（PRD §US-205）——
// 给每家场馆生成一个"覆盖所有 active court × 营业时段"的默认模板。
// dayOfWeek = null 表示每天生效。owner 后续可在控制台新增/修改模板（细化时段、按周分配等）。
function genDefaultSlotTemplates(v: Venue, courts: Court[]): SlotTemplate[] {
  return [{
    id: `st_${v.id}_default`,
    venueId: v.id,
    dayOfWeek: null,
    timeStart: v.openTimeStart,
    timeEnd: v.openTimeEnd,
    courtIds: courts.filter((c) => c.isActive).map((c) => c.id),
    slotDurationMinutes: v.slotDurationMinutes,
    createdAt: now(),
  }];
}

// 把一组模板展开成某一天的 Slot 列表；同 (courtId, startsAt) dedupe（按模板覆盖顺序后者优先）
function genSlotsFromTemplates(
  v: Venue,
  templates: SlotTemplate[],
  courts: Court[],
  dayStartMs: number,
): Slot[] {
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
  const dow = new Date(dayStartMs).getDay();
  const courtsById = new Map(courts.map((c) => [c.id, c]));
  const slotsByKey = new Map<string, Slot>();
  for (const t of templates) {
    if (t.dayOfWeek !== null && t.dayOfWeek !== dow) continue;
    const [sh, sm] = t.timeStart.split(":").map(Number);
    const [eh, em] = t.timeEnd.split(":").map(Number);
    const start = new Date(dayStartMs);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(dayStartMs);
    end.setHours(eh, em, 0, 0);
    const step = t.slotDurationMinutes ?? v.slotDurationMinutes;
    for (const cid of t.courtIds) {
      const court = courtsById.get(cid);
      if (!court || !court.isActive) continue;
      for (
        let tStart = new Date(start);
        tStart.getTime() + step * 60_000 <= end.getTime();
        tStart = new Date(tStart.getTime() + step * 60_000)
      ) {
        const ts = new Date(tStart);
        if (ts.getTime() < Date.now() || ts.getTime() >= dayEndMs) continue;
        const te = new Date(ts.getTime() + step * 60_000);
        const key = `${cid}|${ts.getTime()}`;
        slotsByKey.set(key, {
          id: `sl_${cid}_${ts.getTime()}`,
          venueId: v.id,
          courtId: cid,
          startsAt: ts.toISOString(),
          endsAt: te.toISOString(),
          status: "available",
          capacity: court.capacity,
          confirmedCount: 0,
        });
      }
    }
  }
  return Array.from(slotsByKey.values());
}

// 给生成的 slot 套上「确定性伪随机」的 confirmedCount（PRD §mock：让列表有已订感）
function applySeedFill(slots: Slot[]): Slot[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return slots.map((slot) => {
    const ts = new Date(slot.startsAt);
    const d = Math.floor((ts.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const rand = seededRand(`${slot.courtId}|${d}|${ts.getTime()}`);
    const hour = ts.getHours();
    const dow = ts.getDay();
    const isPrime = (dow === 0 || dow === 6) ? hour >= 18 && hour < 22 : hour >= 19 && hour < 21;
    const fillRatio = isPrime ? 0.55 + rand() * 0.45 : rand() * 0.7;
    const confirmedCount = Math.min(slot.capacity, Math.floor(slot.capacity * fillRatio));
    return {
      ...slot,
      confirmedCount,
      status: confirmedCount >= slot.capacity ? ("booked" as const) : ("available" as const),
    };
  });
}

// 把某场馆的 templates 展开为 7 天的 slots 并应用伪随机填位
function genSlotsForVenue(v: Venue, courts: Court[], templates: SlotTemplate[]): Slot[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const all: Slot[] = [];
  for (let d = 0; d < 7; d++) {
    const dayMs = today.getTime() + d * 24 * 60 * 60 * 1000;
    all.push(...genSlotsFromTemplates(v, templates, courts, dayMs));
  }
  return applySeedFill(all);
}

const seedCourts: Court[] = seedVenues.flatMap(genCourtsForVenue);
const seedTemplates: SlotTemplate[] = seedVenues.flatMap((v) =>
  genDefaultSlotTemplates(v, genCourtsForVenue(v)),
);
const seedSlots: Slot[] = seedVenues.flatMap((v) =>
  genSlotsForVenue(v, genCourtsForVenue(v), seedTemplates.filter((t) => t.venueId === v.id)),
);

// 给 u_owner 的每个场馆铺 6 条预订：1 今日 confirmed + 4 过去 completed + 1 过去 cancelled
// 今日 booking 引用真实 slot id（让 todayCount 真实计数）；过去 booking 用伪 slot id（避免被 todayCount 重复计入）
const seedBookings: Booking[] = (() => {
  const nowMs = Date.now();
  const todayStart = (() => {
    const d = new Date(nowMs);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const todayEnd = todayStart + 86_400_000;
  const out: Booking[] = [];
  let bid = 1;
  const mkId = () => `bk_seed_${bid++}`;
  for (const v of seedVenues) {
    if (v.ownerId !== "u_owner") continue;
    const vSlots = seedSlots.filter((s) => s.venueId === v.id);
    const todaySlot = vSlots.find((s) => {
      const t = new Date(s.startsAt).getTime();
      return t >= todayStart && t < todayEnd;
    });
    if (todaySlot) {
      out.push({
        id: mkId(),
        userId: "u_demo",
        venueId: v.id,
        slotIds: [todaySlot.id],
        status: "confirmed",
        contactName: "张三",
        contactPhone: "13800138000",
        totalPriceCents: v.basePriceCents,
        services: [],
        createdAt: new Date(nowMs - 60_000).toISOString(),
      });
    }
    for (let i = 0; i < 5; i++) {
      const status = i === 4 ? "cancelled" : "completed";
      out.push({
        id: mkId(),
        userId: "u_demo",
        venueId: v.id,
        slotIds: [`sl_past_${v.id}_${i}`],
        status,
        contactName: i % 2 === 0 ? "李四" : "王五",
        contactPhone: `1390013800${i}`,
        totalPriceCents: v.basePriceCents,
        services: [],
        createdAt: new Date(nowMs - (i + 1) * 86_400_000).toISOString(),
      });
    }
  }
  return out;
})();
const seedOwnerApps: OwnerApplication[] = [
  { id: "oa_1", userId: "u_owner", realName: "王老板", idCardNo: "310**********1234", contactPhone: "138****8888", status: "approved", reviewedBy: "u_admin", reviewedAt: now(), createdAt: now() },
];
const seedNotifications: Notification[] = [];
const seedWords: SensitiveWord[] = [
  { id: "w_1", word: "违禁词A", severity: "block",  isActive: true, createdBy: "u_admin", createdAt: now() },
  { id: "w_2", word: "敏感词B", severity: "review", isActive: true, createdBy: "u_admin", createdAt: now() },
];

// 审计日志种子：与上面 seedOwnerApps / seedWords / seedVenues 对应，让审计页有可见条目
// 时序倒序（新→旧），便于 listAuditLogs 默认排序
const seedAuditLogs: AuditLog[] = [
  {
    id: "al_1",
    actorId: "u_admin",
    actorRole: "admin",
    action: "review_owner_app",
    targetType: "owner_app",
    targetId: "oa_1",
    metadata: { decision: "approved", realName: "王老板" },
    ip: "127.0.0.1",
    createdAt: now(),
  },
  {
    id: "al_2",
    actorId: "u_admin",
    actorRole: "admin",
    action: "admin_role_change",
    targetType: "user",
    targetId: "u_owner",
    metadata: { from: "user", to: "owner", via: "review_owner_app:oa_1" },
    ip: "127.0.0.1",
    createdAt: now(),
  },
  {
    id: "al_3",
    actorId: "u_admin",
    actorRole: "admin",
    action: "word_add",
    targetType: "sensitive_word",
    targetId: "w_1",
    metadata: { word: "违禁词A", severity: "block" },
    ip: "127.0.0.1",
    createdAt: now(),
  },
  {
    id: "al_4",
    actorId: "u_admin",
    actorRole: "admin",
    action: "word_add",
    targetType: "sensitive_word",
    targetId: "w_2",
    metadata: { word: "敏感词B", severity: "review" },
    ip: "127.0.0.1",
    createdAt: now(),
  },
  {
    id: "al_5",
    actorId: "u_owner",
    actorRole: "owner",
    action: "venue_set_status",
    targetType: "venue",
    targetId: "v_sq_3",
    metadata: { from: "active", to: "inactive", reason: "US-203a 验证：手动下架测试" },
    ip: "127.0.0.1",
    createdAt: now(),
  },
];

// ---------- 内存仓库 ----------
class Store {
  profiles: Profile[] = [...seedUsers];
  venues: Venue[] = [...seedVenues];
  courts: Court[] = [...seedCourts];
  services: VenueService[] = [...seedServices];
  slots: Slot[] = [...seedSlots];
  slotTemplates: SlotTemplate[] = [...seedTemplates];
  bookings: Booking[] = [...seedBookings];
  ownerApps: OwnerApplication[] = [...seedOwnerApps];
  notifications: Notification[] = [...seedNotifications];
  words: SensitiveWord[] = [...seedWords];
  auditLogs: AuditLog[] = [...seedAuditLogs];

  reset() {
    this.profiles = [...seedUsers];
    this.venues = [...seedVenues];
    this.courts = [...seedCourts];
    this.services = [...seedServices];
    this.slots = [...seedSlots];
    this.slotTemplates = [...seedTemplates];
    this.bookings = [...seedBookings];
    this.ownerApps = [...seedOwnerApps];
    this.notifications = [...seedNotifications];
    this.words = [...seedWords];
    this.auditLogs = [...seedAuditLogs];
  }
}

export const store = new Store();
export const newId = uid;
export const nowIso = now;

// 一组「v2 UI 优先展示的运动」——首页只展示这三个。
export const FEATURED_SPORTS: SportType[] = ["squash", "football", "basketball"];
