import { HttpError, errorResponse, requireAuth, makeServiceClient } from "../_shared/competition.ts";

Deno.serve(async (req) => {
  try {
    const ctx = await requireAuth(req);
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
    const body = (await req.json()) as { competitionId: string; response: "confirm" | "object"; reason?: string };
    const admin = makeServiceClient();
    const { data: result } = await admin.from("competition_results").select("id,status,expires_at,competition_id").eq("competition_id", body.competitionId).maybeSingle();
    if (!result) throw new HttpError(404, "no_result");
    if (result.status !== "awaiting_responses") throw new HttpError(409, "not_in_responses");
    if (new Date(result.expires_at).getTime() < Date.now()) throw new HttpError(409, "expired");

    const { data: me } = await admin.from("competition_participants").select("id").eq("competition_id", result.competition_id).eq("user_id", ctx.userId).maybeSingle();
    if (!me) throw new HttpError(403, "not_participant");

    if (body.response === "object" && (!body.reason || body.reason.trim().length === 0)) {
      throw new HttpError(422, "object_reason_required");
    }
    await admin.from("competition_result_responses").upsert({
      result_id: result.id,
      participant_id: me.id,
      response: body.response,
      reason: body.reason ?? null,
      responded_at: new Date().toISOString(),
    }, { onConflict: "result_id,participant_id" });

    // 全部 confirm → 提前进入 pending_review
    const { count: total } = await admin.from("competition_participants").select("user_id", { count: "exact", head: true })
      .eq("competition_id", result.competition_id).in("status", ["accepted","played"]);
    const { count: responded } = await admin.from("competition_result_responses").select("id", { count: "exact", head: true })
      .eq("result_id", result.id).eq("response", "confirm");
    if ((responded ?? 0) >= (total ?? 0)) {
      await admin.from("competition_results").update({ status: "pending_review" }).eq("id", result.id);
      await admin.from("competitions").update({ status: "pending_review" }).eq("id", result.competition_id);
    }
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
});
