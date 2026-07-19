// 创建竞赛（PRD US-501 / ADR-0002）
import { HttpError, errorResponse, requireAuth, makeServiceClient } from "../_shared/competition.ts";

interface Input {
  bookingId: string;
  slotId: string;
  kind: "friendly" | "ranked";
  mode: "singles" | "teams";
  teamSize: number;
  visibility?: "public" | "private";
}

Deno.serve(async (req) => {
  try {
    const ctx = await requireAuth(req);
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
    const body = (await req.json()) as Input;
    if (!body.bookingId || !body.slotId) throw new HttpError(422, "missing_field");
    if (!["friendly","ranked"].includes(body.kind)) throw new HttpError(422, "invalid_kind");
    if (!["singles","teams"].includes(body.mode)) throw new HttpError(422, "invalid_mode");
    if (body.teamSize < 1 || body.teamSize > 10) throw new HttpError(422, "invalid_team_size");
    const admin = makeServiceClient();

    const { data: booking, error: bErr } = await admin.from("bookings")
      .select("id,user_id,venue_id,status,slot_ids")
      .eq("id", body.bookingId).maybeSingle();
    if (bErr) throw new HttpError(500, "db_error", bErr.message);
    if (!booking) throw new HttpError(404, "booking_not_found");
    if (booking.user_id !== ctx.userId) throw new HttpError(403, "not_owner");
    if (booking.status !== "confirmed") throw new HttpError(409, "booking_not_confirmed");
    if (!booking.slot_ids?.includes(body.slotId)) throw new HttpError(422, "slot_not_in_booking");

    const { data: slot, error: sErr } = await admin.from("slots")
      .select("id,venue_id,court_id,starts_at,ends_at")
      .eq("id", body.slotId).maybeSingle();
    if (sErr) throw new HttpError(500, "db_error", sErr.message);
    if (!slot) throw new HttpError(404, "slot_not_found");
    if (new Date(slot.starts_at).getTime() <= Date.now() + 30 * 60 * 1000) {
      throw new HttpError(409, "too_close_to_start");
    }

    const { data: existing } = await admin.from("competitions").select("id").eq("slot_id", body.slotId).maybeSingle();
    if (existing) throw new HttpError(409, "slot_in_use");

    const { data: venue } = await admin.from("venues").select("sport_type").eq("id", slot.venue_id).maybeSingle();
    if (!venue) throw new HttpError(404, "venue_not_found");

    const { data: court } = await admin.from("courts").select("capacity").eq("id", slot.court_id).maybeSingle();
    if (!court) throw new HttpError(404, "court_not_found");
    const total = body.mode === "teams" ? body.teamSize * 2 : 2;
    if (total > court.capacity) throw new HttpError(422, "exceeds_court_capacity");

    if (body.kind === "ranked") {
      const { data: lock } = await admin.rpc("is_ranked_locked", { p_user_id: ctx.userId, p_sport_type: venue.sport_type });
      if (lock === true) throw new HttpError(423, "ranked_locked");
    }

    const { data: comp, error: insErr } = await admin.from("competitions").insert({
      booking_id: body.bookingId,
      slot_id: body.slotId,
      court_id: slot.court_id,
      venue_id: slot.venue_id,
      sport_type: venue.sport_type,
      creator_id: ctx.userId,
      kind: body.kind,
      mode: body.mode,
      team_size: body.teamSize,
      visibility: body.visibility ?? "public",
      status: "recruiting",
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      submit_deadline_at: new Date(new Date(slot.ends_at).getTime() + 7 * 86400_000).toISOString(),
    }).select("id").maybeSingle();
    if (insErr) throw new HttpError(500, "db_error", insErr.message);

    await admin.from("competition_participants").insert({
      competition_id: comp!.id,
      user_id: ctx.userId,
      team: "A",
      status: "accepted",
      responded_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, competitionId: comp!.id });
  } catch (e) { return errorResponse(e); }
});
