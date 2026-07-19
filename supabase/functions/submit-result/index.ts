import { HttpError, errorResponse, requireAuth, makeServiceClient, validateScore, type ScorePayload } from "../_shared/competition.ts";

Deno.serve(async (req) => {
  try {
    const ctx = await requireAuth(req);
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
    const body = (await req.json()) as { competitionId: string; scorePayload: ScorePayload; notes?: string };
    const admin = makeServiceClient();
    const { data: comp } = await admin.from("competitions").select("id,status,sport_type,submit_deadline_at,creator_id,participant_set_hash").eq("id", body.competitionId).maybeSingle();
    if (!comp) throw new HttpError(404, "not_found");
    if (!["locked","awaiting_result"].includes(comp.status)) throw new HttpError(409, "invalid_state");
    if (new Date(comp.submit_deadline_at).getTime() < Date.now()) throw new HttpError(409, "submit_deadline_passed");
    const { data: me } = await admin.from("competition_participants").select("user_id").eq("competition_id", comp.id).eq("user_id", ctx.userId).maybeSingle();
    if (!me && comp.creator_id !== ctx.userId && ctx.role !== "admin") throw new HttpError(403, "not_participant");

    const score = validateScore(comp.sport_type, body.scorePayload);
    const winner = score.winner;

    // 已存在则覆盖 pending_review / awaiting_responses
    const { data: existing } = await admin.from("competition_results").select("id,status,expires_at").eq("competition_id", comp.id).maybeSingle();
    if (existing && existing.status === "approved") throw new HttpError(409, "already_settled");

    const row = {
      competition_id: comp.id,
      submitted_by: ctx.userId,
      score_payload: score as unknown as object,
      winner_team: winner,
      notes: body.notes ?? null,
      submitted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "awaiting_responses",
    };
    if (existing) {
      await admin.from("competition_results").update(row).eq("id", existing.id);
    } else {
      await admin.from("competition_results").insert(row);
    }
    await admin.from("competitions").update({ status: "awaiting_result" }).eq("id", comp.id);
    // 通知所有参赛者
    const { data: parts } = await admin.from("competition_participants").select("user_id").eq("competition_id", comp.id).neq("user_id", ctx.userId);
    if (parts) {
      await admin.from("notifications").insert(parts.map(p => ({
        user_id: p.user_id,
        type: "competition.result_submitted",
        title: "结果已提交，请确认",
        body: "提交人已记录比赛结果，24 小时内确认或异议",
        payload: { competitionId: comp.id },
      })));
    }
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
});
