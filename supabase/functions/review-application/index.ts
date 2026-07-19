import { HttpError, errorResponse, requireAuth, makeServiceClient } from "../_shared/competition.ts";
Deno.serve(async (req) => {
  try {
    const ctx = await requireAuth(req);
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
    const body = (await req.json()) as { competitionId: string; userId: string; action: "accept" | "reject" };
    const admin = makeServiceClient();
    const { data: comp } = await admin.from("competitions").select("id,creator_id,status,team_size").eq("id", body.competitionId).maybeSingle();
    if (!comp) throw new HttpError(404, "not_found");
    if (comp.creator_id !== ctx.userId && ctx.role !== "admin") throw new HttpError(403, "forbidden");
    if (comp.status !== "recruiting") throw new HttpError(409, "invalid_state");

    const { data: applicant } = await admin.from("competition_participants").select("team").eq("competition_id", comp.id).eq("user_id", body.userId).maybeSingle();
    if (!applicant?.team) throw new HttpError(404, "application_not_found");

    if (body.action === "accept") {
      const { count: teamCount } = await admin.from("competition_participants").select("user_id", { count: "exact", head: true })
        .eq("competition_id", comp.id).eq("team", applicant.team).eq("status", "accepted");
      if ((teamCount ?? 0) >= comp.team_size) throw new HttpError(409, "team_full");
      await admin.from("competition_participants").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("competition_id", comp.id).eq("user_id", body.userId);
    } else {
      await admin.from("competition_participants").update({ status: "rejected", responded_at: new Date().toISOString() }).eq("competition_id", comp.id).eq("user_id", body.userId);
    }
    await admin.from("notifications").insert({
      user_id: body.userId,
      type: body.action === "accept" ? "competition.accepted" : "competition.rejected",
      title: body.action === "accept" ? "申请通过" : "申请被拒",
      body: body.action === "accept" ? "你被接受加入竞赛" : "你的申请被拒绝",
      payload: { competitionId: comp.id },
    });
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
});
