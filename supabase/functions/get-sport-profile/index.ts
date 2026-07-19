import { HttpError, errorResponse, requireAuth, makeServiceClient, tierOf, SPORT_TYPES } from "../_shared/competition.ts";

Deno.serve(async (req) => {
  try {
    const ctx = await requireAuth(req);
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") ?? ctx.userId;
    const sport = url.searchParams.get("sport") ?? "";
    if (!SPORT_TYPES.includes(sport as never)) throw new HttpError(422, "invalid_sport");
    const admin = makeServiceClient();
    const { data: usp } = await admin.from("user_sport_progress").select("*").eq("user_id", userId).eq("sport_type", sport).maybeSingle();
    if (!usp) throw new HttpError(404, "no_progress");

    const { data: profile } = await admin.from("profiles").select("id,nickname,avatar_url,locale").eq("id", userId).maybeSingle();
    if (!profile) throw new HttpError(404, "no_profile");

    const { data: ledger } = await admin.from("experience_ledger")
      .select("id,reason,xp_delta,rating_delta,created_at,competition_id")
      .eq("user_id", userId).eq("sport_type", sport).order("created_at", { ascending: false }).limit(20);

    const { data: opponents } = await admin.rpc("predict_outcome", { p_user_a: userId, p_user_b: userId, p_sport: sport });

    const { data: matches } = await admin.from("competitions")
      .select("id,kind,status,starts_at,ends_at,score_payload")
      .eq("status", "approved")
      .contains("participant_set_hash", [userId]).order("ends_at", { ascending: false }).limit(10);

    return Response.json({
      ok: true,
      profile: { id: profile.id, nickname: profile.nickname, avatar_url: profile.avatar_url, locale: profile.locale },
      progress: {
        level: usp.level,
        xp: usp.xp,
        rating: usp.rating,
        peak_rating: usp.peak_rating,
        tier: tierOf(usp.rating),
        placement_done: usp.placement_done,
        ranked_locked_until: usp.ranked_locked_until,
        last_match_at: usp.last_match_at,
      },
      ledger: ledger ?? [],
      matches: matches ?? [],
    });
  } catch (e) { return errorResponse(e); }
});
