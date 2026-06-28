import { store, newId, nowIso } from "@/lib/mock-data";
import { checkSensitive } from "@/lib/sensitive";
import type { Booking, BookingServiceLine } from "@/lib/types";
import { effectivePriceCents } from "@/features/venues/api";

const wait = <T,>(v: T, ms = 120): Promise<T> => new Promise((r) => setTimeout(() => r(v), ms));

export interface CreateBookingInput {
  userId: string;
  venueId: string;
  slotIds: string[];
  contactName: string;
  contactPhone: string;
  notes?: string;
  services: { serviceId: string; quantity: number }[];
}

export async function createBooking(input: CreateBookingInput): Promise<{ ok: true; booking: Booking } | { ok: false; reason: string }> {
  // 敏感词
  const hits = [...checkSensitive(input.contactName), ...checkSensitive(input.contactPhone)];
  const blocked = hits.filter((h) => h.severity === "block");
  if (blocked.length) return { ok: false, reason: `sensitive:${blocked.map((b) => b.word).join(",")}` };

  const venue = store.venues.find((v) => v.id === input.venueId);
  if (!venue) return { ok: false, reason: "venue_not_found" };

  const slots = store.slots.filter((s) => input.slotIds.includes(s.id) && s.venueId === venue.id);
  if (slots.length !== input.slotIds.length) return { ok: false, reason: "slots_mismatch" };
  if (slots.some((s) => s.status !== "available")) return { ok: false, reason: "slot_taken" };

  // 计算总价 —— 按 court 实际单价（PRD §US-203b：court.priceCents > 0 优先；否则 venue.basePriceCents）
  const courtById = new Map(store.courts.filter((c) => c.venueId === venue.id).map((c) => [c.id, c]));
  let total = 0;
  for (const sl of slots) {
    const court = courtById.get(sl.courtId) ?? null;
    total += effectivePriceCents(venue, court);
  }
  const serviceLines: BookingServiceLine[] = [];
  for (const sel of input.services) {
    const svc = store.services.find((s) => s.id === sel.serviceId && s.venueId === venue.id);
    if (!svc) continue;
    total += svc.priceCents * sel.quantity;
    serviceLines.push({
      serviceId: svc.id,
      quantity: sel.quantity,
      priceCentsSnapshot: svc.priceCents,
    });
  }

  // 锁 slot
  for (const sl of slots) sl.status = "booked";

  const b: Booking = {
    id: newId(),
    userId: input.userId,
    venueId: input.venueId,
    slotIds: input.slotIds,
    status: venue.requireApproval ? "pending" : "confirmed",
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    totalPriceCents: total,
    notes: input.notes,
    services: serviceLines,
    confirmedAt: venue.requireApproval ? undefined : nowIso(),
    createdAt: nowIso(),
  };
  store.bookings.push(b);

  // 站内通知
  store.notifications.push({
    id: newId(),
    userId: b.userId,
    type: b.status === "pending" ? "booking.pending" : "booking.confirmed",
    title: b.status === "pending" ? "预订已提交，待场主审核" : "预订已确认",
    body: venue.name,
    payload: { bookingId: b.id },
    createdAt: nowIso(),
  });
  if (venue.requireApproval) {
    store.notifications.push({
      id: newId(),
      userId: venue.ownerId,
      type: "booking.review_required",
      title: "新预订待审核",
      body: `${venue.name} - ${slots.length} 个时段`,
      payload: { bookingId: b.id },
      createdAt: nowIso(),
    });
  }

  return wait({ ok: true, booking: b });
}

export async function listMyBookings(userId: string): Promise<Booking[]> {
  return wait(store.bookings.filter((b) => b.userId === userId));
}

export async function listBookingsForVenue(venueId: string): Promise<Booking[]> {
  return wait(store.bookings.filter((b) => b.venueId === venueId));
}

export async function listPendingBookingsForOwner(ownerId: string): Promise<Booking[]> {
  const venueIds = new Set(store.venues.filter((v) => v.ownerId === ownerId).map((v) => v.id));
  return wait(store.bookings.filter((b) => venueIds.has(b.venueId) && b.status === "pending"));
}

export async function cancelBooking(bookingId: string): Promise<{ ok: boolean; reason?: string }> {
  const b = store.bookings.find((x) => x.id === bookingId);
  if (!b) return { ok: false, reason: "not_found" };
  const venue = store.venues.find((v) => v.id === b.venueId)!;
  const earliest = b.slotIds
    .map((id) => store.slots.find((s) => s.id === id)?.startsAt)
    .filter(Boolean)
    .sort()[0];
  if (!earliest) return { ok: false, reason: "no_slot" };
  const diffH = (new Date(earliest).getTime() - Date.now()) / 3_600_000;
  if (diffH < venue.cancelHours) return { ok: false, reason: "too_late" };
  b.status = "cancelled";
  b.cancelledAt = nowIso();
  for (const sid of b.slotIds) {
    const sl = store.slots.find((s) => s.id === sid);
    if (sl) sl.status = "available";
  }
  return wait({ ok: true });
}

export async function reviewBooking(bookingId: string, action: "confirm" | "reject", reason?: string): Promise<{ ok: boolean }> {
  const b = store.bookings.find((x) => x.id === bookingId);
  if (!b) return { ok: false };
  b.status = action === "confirm" ? "confirmed" : "rejected";
  if (action === "confirm") b.confirmedAt = nowIso();
  if (action === "reject") b.cancelReason = reason;
  store.notifications.push({
    id: newId(),
    userId: b.userId,
    type: action === "confirm" ? "booking.approved" : "booking.rejected",
    title: action === "confirm" ? "预订已通过" : "预订已拒绝",
    body: reason ?? "",
    payload: { bookingId: b.id },
    createdAt: nowIso(),
  });
  return wait({ ok: true });
}
