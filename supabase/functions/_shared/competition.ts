// 共享：竞赛相关常量 / 错误 / 工具
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const SPORT_TYPES = [
  "squash","badminton","basketball","football","tennis","table_tennis","volleyball","other",
] as const;
export type SportType = (typeof SPORT_TYPES)[number];

export const COMP_STATUS = [
  "recruiting","locked","awaiting_result","pending_review","approved","rejected","voided","cancelled",
] as const;

export const PARTICIPANT_STATUS = [
  "invited","pending","accepted","declined","rejected","withdrawn","no_show","played",
] as const;

export type WinnerTeam = "A" | "B" | "draw";

export interface AuthedContext {
  supabase: SupabaseClient;
  userId: string;
  role: "user" | "owner" | "admin" | "service_role";
  email: string;
}

export function makeServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

export function makeUserClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
}

export async function requireAuth(req: Request): Promise<AuthedContext> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, "missing_bearer");
  }
  const supabase = makeUserClient(auth);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new HttpError(401, "invalid_token");
  const role = (data.user.app_metadata?.role ?? "user") as AuthedContext["role"];
  return { supabase, userId: data.user.id, role, email: data.user.email ?? "" };
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, public detail?: unknown) {
    super(code);
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ ok: false, code: err.code, detail: err.detail ?? null }, { status: err.status });
  }
  console.error("unhandled", err);
  return Response.json({ ok: false, code: "internal_error", detail: String((err as Error)?.message ?? err) }, { status: 500 });
}

// 结构化比分 schema 校验
export interface ScoreSets { format: "sets"; best_of: 1|3|5; team_a_sets: number; team_b_sets: number; set_scores: number[][]; winner: WinnerTeam }
export interface ScoreGoals { format: "goals"; team_a_goals: number; team_b_goals: number; winner: WinnerTeam }
export interface ScoreTotalPoints { format: "total_points"; team_a_points: number; team_b_points: number; winner: WinnerTeam }
export type ScorePayload = ScoreSets | ScoreGoals | ScoreTotalPoints;

const DRAW_ALLOWED = new Set(["football","basketball","volleyball","other"]);

export function validateScore(sport: string, payload: ScorePayload): ScorePayload {
  if (!payload || typeof payload !== "object") throw new HttpError(422, "invalid_payload");
  const format = (payload as ScorePayload).format;
  if (format === "sets") {
    const p = payload as ScoreSets;
    if (p.best_of !== 1 && p.best_of !== 3 && p.best_of !== 5) throw new HttpError(422, "invalid_payload");
    if (!Array.isArray(p.set_scores)) throw new HttpError(422, "invalid_payload");
    if (p.winner === "draw") throw new HttpError(422, "draw_not_allowed");
    if (!["A","B"].includes(p.winner)) throw new HttpError(422, "invalid_winner");
    // 服务端根据 set_scores 重算 winner，避免客户端伪造
    const a = p.set_scores.reduce((s, [x, y]) => s + (x > y ? 1 : 0), 0);
    const b = p.set_scores.reduce((s, [x, y]) => s + (y > x ? 1 : 0), 0);
    const derived = a > b ? "A" : a < b ? "B" : "draw";
    if (derived !== p.winner) throw new HttpError(422, "winner_mismatch");
    return { ...p, team_a_sets: a, team_b_sets: b };
  }
  if (format === "goals") {
    const p = payload as ScoreGoals;
    if (p.team_a_goals < 0 || p.team_b_goals < 0) throw new HttpError(422, "invalid_payload");
    if (!["A","B","draw"].includes(p.winner)) throw new HttpError(422, "invalid_winner");
    if (p.winner === "draw" && !DRAW_ALLOWED.has(sport)) throw new HttpError(422, "draw_not_allowed");
    const derived = p.team_a_goals > p.team_b_goals ? "A" : p.team_a_goals < p.team_b_goals ? "B" : "draw";
    if (derived !== p.winner) throw new HttpError(422, "winner_mismatch");
    return p;
  }
  if (format === "total_points") {
    const p = payload as ScoreTotalPoints;
    if (p.team_a_points < 0 || p.team_b_points < 0) throw new HttpError(422, "invalid_payload");
    if (!["A","B","draw"].includes(p.winner)) throw new HttpError(422, "invalid_winner");
    if (p.winner === "draw" && !DRAW_ALLOWED.has(sport)) throw new HttpError(422, "draw_not_allowed");
    const derived = p.team_a_points > p.team_b_points ? "A" : p.team_a_points < p.team_b_points ? "B" : "draw";
    if (derived !== p.winner) throw new HttpError(422, "winner_mismatch");
    return p;
  }
  throw new HttpError(422, "invalid_payload");
}

// 段位映射
export function tierOf(rating: number): string {
  if (rating >= 2000) return "diamond";
  if (rating >= 1700) return "platinum";
  if (rating >= 1400) return "gold";
  if (rating >= 1100) return "silver";
  return "bronze";
}

