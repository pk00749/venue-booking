import { errorResponse, makeServiceClient } from "../_shared/competition.ts";

Deno.serve(async (req) => {
  try {
    // 需 service_role token 验证：简单 secret header
    const secret = req.headers.get("x-cron-secret");
    if (!secret || secret !== Deno.env.get("CRON_SECRET")) {
      return new Response("forbidden", { status: 403 });
    }
    const admin = makeServiceClient();
    const locked = await admin.rpc("lock_due_competitions");
    const expired = await admin.rpc("expire_pending_results");
    const escalated = await admin.rpc("escalate_stale_reviews");
    return Response.json({ ok: true, locked, expired, escalated });
  } catch (e) { return errorResponse(e); }
});
