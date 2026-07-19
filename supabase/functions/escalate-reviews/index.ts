import { errorResponse, makeServiceClient } from "../_shared/competition.ts";
Deno.serve(async (req) => {
  try {
    const admin = makeServiceClient();
    const upgraded = await admin.rpc("escalate_stale_reviews");
    const expired = await admin.rpc("expire_pending_results");
    return Response.json({ ok: true, upgraded, expired });
  } catch (e) { return errorResponse(e); }
});
