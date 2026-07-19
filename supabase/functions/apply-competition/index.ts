import { HttpError, errorResponse, requireAuth, makeServiceClient } from "../_shared/competition.ts";
Deno.serve(async (req) => {
  try {
    const ctx = await requireAuth(req);
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
    const body = (await req.json()) as { competitionId: string; team: "A" | "B" };
    if (!["A","B"].includes(body.team)) throw new HttpError(422, "invalid_team");
    const admin = makeServiceClient();
    const { data: comp } = await admin.from("competitions").select("id,status,team_size,mode,participant_set_hash,creator_id").eq("id", body.competitionId).maybeSingle();
    if (!comp) throw new HttpError(404, "not_found");
    if (comp.status !== "recruiting") throw new HttpError(409, "invalid_state");
    if (comp.creator_id === ctx.userId) throw new HttpError(409, "creator_cannot_apply");

    const { count: acceptedCount } = await admin.from("competition_participants").select("user_id", { count: "exact", head: true })
      .eq("competition_id", comp.id).eq("status", "accepted");
    if (comp.mode === "singles" && (acceptedCount ?? 0) >= 2) throw new HttpError(409, "roster_full");

    if (comp.participant_set_hash) {
      const { data: prev } = await admin.from("competitions")
        .select("id").eq("participant_set_hash", comp.participant_set_hash).neq("id", comp.id)
        .eq("status", "approved").gte("ends_at", new Date(Date.now() - 7 * 86400_000).toISOString());
      if (prev && prev.length > 0) throw new HttpError(409, "cooldown_active");
    }
    const { count: teamCount } = await admin.from("competition_participants")
      .select("user_id", { count: "exact", head: true })
      .eq("competition_id", comp.id).eq("team", body.team).eq("status", "accepted");
    if ((teamCount ?? 0) >= comp.team_size) throw new HttpError(409, "team_full");

    const { error } = await admin.from("competition_participants").upsert({
      competition_id: comp.id,
      user_id: ctx.userId,
      team: body.team,
      status: "pending",
    }, { onConflict: "competition_id,user_id" });
    if (error) throw new HttpError(500, "db_error", error.message);

    await admin.from("notifications").insert({
      user_id: comp.creator_id,
      type: "competition.apply",
      title: "新竞赛申请",
      body: "有用户申请加入你发起的竞赛",
      payload: { competitionId: comp.id, applicantId: ctx.userId },
    });
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
});
