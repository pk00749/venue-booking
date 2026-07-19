// 公开：按运动 + 类型（ranked/friendly）+ cursor 分页
import { HttpError, errorResponse, makeServiceClient, SPORT_TYPES } from "../_shared/competition.ts";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const sport = url.searchParams.get("sport") ?? "";
    const kind = (url.searchParams.get("kind") ?? "ranked") as "ranked" | "friendly";
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
    const cursor = Number(url.searchParams.get("cursor") ?? "0");
    if (!SPORT_TYPES.includes(sport as never)) throw new HttpError(422, "invalid_sport");
    if (!["ranked","friendly"].includes(kind)) throw new HttpError(422, "invalid_kind");

    const admin = makeServiceClient();
    const { data, error } = await admin.rpc("leaderboard_top", { p_sport: sport, p_kind: kind, p_limit: cursor + limit });
    if (error) throw new HttpError(500, "db_error", error.message);
    const rows = (data ?? []).slice(cursor);
    return Response.json({ ok: true, items: rows, nextCursor: rows.length < limit ? null : cursor + limit });
  } catch (e) { return errorResponse(e); }
});
