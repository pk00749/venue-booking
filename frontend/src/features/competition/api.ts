// 竞赛 / 等级 / 排行榜 API 调用层（Supabase Edge Functions）
// 全部走 supabase.functions.invoke(name, { body })；前端 RLS 不允许直接改 competitions / user_sport_progress
/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";
import type { ApplyCompetitionInput, CreateCompetitionInput, ReviewResultInput, SubmitResultInput } from "./schema";
import type { LeaderboardRow, SportType, UserSportProgress } from "./types";

const FUNCTIONS = {
  createCompetition: "create-competition",
  cancelCompetition: "cancel-competition",
  applyCompetition: "apply-competition",
  reviewApplication: "review-application",
  submitResult: "submit-result",
  respondResult: "respond-result",
  reviewResult: "review-result",
  getLeaderboard: "get-leaderboard",
  getSportProfile: "get-sport-profile",
} as const;

let _client: ReturnType<typeof createClient> | null = null;
function client() {
  if (_client) return _client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon) {
    throw new Error("missing_supabase_env");
  }
  _client = createClient(url, anon, { auth: { persistSession: true } });
  return _client;
}

async function invoke<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().functions.invoke(name, { body });
  if (error) throw new Error(error.message ?? `${name}_failed`);
  return data as T;
}

export const competitionApi = {
  createCompetition: (input: CreateCompetitionInput) =>
    invoke<{ ok: true; competitionId: string }>(FUNCTIONS.createCompetition, input),

  cancelCompetition: (competitionId: string) =>
    invoke<{ ok: true }>(FUNCTIONS.cancelCompetition, { competitionId }),

  applyCompetition: (input: ApplyCompetitionInput) =>
    invoke<{ ok: true }>(FUNCTIONS.applyCompetition, input),

  reviewApplication: (input: { competitionId: string; userId: string; action: "accept" | "reject" }) =>
    invoke<{ ok: true }>(FUNCTIONS.reviewApplication, input),

  submitResult: (input: SubmitResultInput) =>
    invoke<{ ok: true }>(FUNCTIONS.submitResult, input),

  respondResult: (input: { competitionId: string; response: "confirm" | "object"; reason?: string }) =>
    invoke<{ ok: true }>(FUNCTIONS.respondResult, input),

  reviewResult: (input: ReviewResultInput) =>
    invoke<{ ok: true }>(FUNCTIONS.reviewResult, input),

  getLeaderboard: async (sport: SportType, kind: "ranked" | "friendly" = "ranked", cursor = 0, limit = 20) => {
    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTIONS.getLeaderboard}`);
    url.searchParams.set("sport", sport);
    url.searchParams.set("kind", kind);
    url.searchParams.set("cursor", String(cursor));
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } });
    if (!res.ok) throw new Error(`getLeaderboard_${res.status}`);
    return (await res.json()) as { ok: true; items: LeaderboardRow[]; nextCursor: number | null };
  },

  getSportProfile: async (userId: string, sport: SportType) => {
    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTIONS.getSportProfile}`);
    url.searchParams.set("userId", userId);
    url.searchParams.set("sport", sport);
    const res = await fetch(url, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${(await client().auth.getSession()).data.session?.access_token ?? ""}`,
      },
    });
    if (!res.ok) throw new Error(`getSportProfile_${res.status}`);
    return (await res.json()) as {
      ok: true;
      profile: { id: string; nickname: string; avatar_url: string | null; locale: string };
      progress: UserSportProgress;
    };
  },
};
