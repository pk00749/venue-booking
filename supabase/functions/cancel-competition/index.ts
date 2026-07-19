import { HttpError, errorResponse, requireAuth, makeServiceClient } from "../_shared/competition.ts";
Deno.serve(async (req) => {
  try {
    const ctx = await requireAuth(req);
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
    const body = (await req.json()) as { competitionId: string; reason?: string };
    const admin = makeServiceClient();
    const { data: comp } = await admin.from("competitions").select("id,creator_id,status").eq("id", body.competitionId).maybeSingle();
    if (!comp) throw new HttpError(404, "not_found");
    if (comp.status !== "recruiting" && ctx.role !== "admin") throw new HttpError(409, "invalid_state");
    if (comp.creator_id !== ctx.userId && ctx.role !== "admin") throw new HttpError(403, "forbidden");
    await admin.from("competitions").update({ status: "cancelled" }).eq("id", comp.id);
    return Response.json({ ok: true });
  } catch (e) { return errorResponse(e); }
});
