import { HttpError, errorResponse, requireAuth, makeServiceClient } from "../_shared/competition.ts";

Deno.serve(async (req) => {
  try {
    const ctx = await requireAuth(req);
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
    const body = (await req.json()) as { competitionId: string; action: "approve" | "reject"; reason?: string; noShowUserIds?: string[] };
    const admin = makeServiceClient();

    const { data: comp } = await admin.from("competitions").select("id,status,venue_id,creator_id,sport_type").eq("id", body.competitionId).maybeSingle();
    if (!comp) throw new HttpError(404, "not_found");
    if (comp.status !== "pending_review" && comp.status !== "awaiting_result") throw new HttpError(409, "invalid_state");

    // 审核权限：场主（无冲突）或 admin
    const { data: venue } = await admin.from("venues").select("owner_id").eq("id", comp.venue_id).maybeSingle();
    const isOwner = venue?.owner_id === ctx.userId;
    const isAdmin = ctx.role === "admin";
    const ownerIsParticipant = await admin.from("competition_participants").select("user_id").eq("competition_id", comp.id).eq("user_id", venue?.owner_id ?? "").maybeSingle();
    const conflict = (isOwner && ownerIsParticipant) || (isOwner && comp.creator_id === ctx.userId);
    if (!(isAdmin || (isOwner && !conflict))) throw new HttpError(403, conflict ? "review_conflict" : "forbidden");

    if (body.action === "approve") {
      // 调用 service_role 的 SQL 函数做事务结算
      const { error: rpcErr } = await admin.rpc("apply_match_settlement", { p_competition_id: comp.id });
      if (rpcErr) throw new HttpError(500, "settlement_error", rpcErr.message);
      // 爽约标记
      if (Array.isArray(body.noShowUserIds)) {
        for (const uid of body.noShowUserIds) {
          await admin.rpc("flag_no_show", { p_competition_id: comp.id, p_user_id: uid, p_evidence: body.reason ?? "" });
        }
      }
      await admin.from("audit_logs").insert({ actor_id: ctx.userId, action: "competition.approve", target_type: "competition", target_id: comp.id });
    } else {
      await admin.from("competition_results").update({ status: "rejected" }).eq("competition_id", comp.id);
      await admin.from("competitions").update({ status: "rejected", reject_reason: body.reason ?? null, reviewed_by: ctx.userId, reviewed_at: new Date().toISOString() }).eq("id", comp.id);
      await admin.from("audit_logs").insert({ actor_id: ctx.userId, action: "competition.reject", target_type: "competition", target_id: comp.id, metadata: { reason: body.reason ?? null } });
    }
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
});
