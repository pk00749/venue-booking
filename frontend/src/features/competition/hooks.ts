import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { competitionApi } from "./api";
import type { SportType } from "@/lib/types";

export function useLeaderboard(sport: SportType, kind: "ranked" | "friendly" = "ranked", limit = 20) {
  return useQuery({
    queryKey: ["leaderboard", sport, kind, limit],
    queryFn: () => competitionApi.getLeaderboard(sport, kind, 0, limit),
    enabled: !!sport,
    staleTime: 60_000,
  });
}

export function useSportProfile(userId: string | undefined, sport: SportType) {
  return useQuery({
    queryKey: ["sport-profile", userId, sport],
    queryFn: () => competitionApi.getSportProfile(userId!, sport),
    enabled: !!userId && !!sport,
    staleTime: 30_000,
  });
}

export function useCreateCompetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competitionApi.createCompetition,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-bookings"] }),
  });
}

export function useCancelCompetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competitionApi.cancelCompetition,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-bookings"] }),
  });
}

export function useApplyCompetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competitionApi.applyCompetition,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitions"] }),
  });
}

export function useReviewApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competitionApi.reviewApplication,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitions"] }),
  });
}

export function useSubmitResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competitionApi.submitResult,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitions"] }),
  });
}

export function useRespondResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competitionApi.respondResult,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitions"] }),
  });
}

export function useReviewResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: competitionApi.reviewResult,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitions"] }),
  });
}
