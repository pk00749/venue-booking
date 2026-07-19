// 竞赛 / 等级 / 排行榜前端类型（feature.md §5 / §6）
import type { SportType } from "@/lib/types";
export type { SportType } from "@/lib/types";

export type CompetitionKind = "friendly" | "ranked";
export type CompetitionMode = "singles" | "teams";
export type CompetitionVisibility = "public" | "private";
export type CompetitionStatus =
  | "recruiting" | "locked" | "awaiting_result" | "pending_review"
  | "approved" | "rejected" | "voided" | "cancelled";

export type ParticipantStatus =
  | "invited" | "pending" | "accepted" | "declined"
  | "rejected" | "withdrawn" | "no_show" | "played";

export type Team = "A" | "B";
export type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond";
export type WinnerTeam = Team | "draw";

export interface Competition {
  id: string;
  bookingId: string;
  slotId: string;
  courtId: string;
  venueId: string;
  sportType: SportType;
  creatorId: string;
  kind: CompetitionKind;
  mode: CompetitionMode;
  teamSize: number;
  visibility: CompetitionVisibility;
  status: CompetitionStatus;
  startsAt: string;
  endsAt: string;
  participantSetHash?: string | null;
  lockedAt?: string | null;
  submitDeadlineAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewEscalatedTo?: string | null;
  reviewEscalatedAt?: string | null;
  escalationReason?: string | null;
  rejectReason?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface CompetitionParticipant {
  id: string;
  competitionId: string;
  userId: string;
  team: Team | null;
  status: ParticipantStatus;
  appliedAt: string;
  respondedAt?: string | null;
  preMatchLevel?: number | null;
  preMatchRating?: number | null;
  preMatchXp?: number | null;
  nickname?: string;
  avatarUrl?: string | null;
}

export interface CompetitionResult {
  id: string;
  competitionId: string;
  submittedBy: string;
  scorePayload: ScorePayload;
  winnerTeam: WinnerTeam;
  notes?: string | null;
  submittedAt: string;
  expiresAt: string;
  status: "awaiting_responses" | "pending_review" | "approved" | "rejected" | "voided";
}

export type ScorePayload =
  | ScoreSets
  | ScoreGoals
  | ScoreTotalPoints;

export interface ScoreSets {
  format: "sets";
  best_of: 1 | 3 | 5;
  team_a_sets: number;
  team_b_sets: number;
  set_scores: Array<[number, number]>;
  winner: "A" | "B";
}

export interface ScoreGoals {
  format: "goals";
  team_a_goals: number;
  team_b_goals: number;
  winner: WinnerTeam;
}

export interface ScoreTotalPoints {
  format: "total_points";
  team_a_points: number;
  team_b_points: number;
  winner: WinnerTeam;
}

export interface UserSportProgress {
  userId: string;
  sportType: SportType;
  xp: number;
  level: number;
  rating: number;
  peakRating: number;
  placementDone: number;
  noShow30d: number;
  rankedLockedUntil?: string | null;
  lastMatchAt?: string | null;
  tier: Tier;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  rating: number;
  peakRating: number;
  wins: number;
  draws: number;
  losses: number;
  played: number;
  tier: Tier;
  lastMatchAt: string | null;
}

export interface ExperienceLedgerRow {
  id: string;
  reason: "match_win" | "match_draw" | "match_loss" | "attendance" | "void_reversal" | "season_reset" | "admin_adjust";
  xpDelta: number;
  ratingDelta: number;
  createdAt: string;
  competitionId: string | null;
}

export function tierOf(rating: number): Tier {
  if (rating >= 2000) return "diamond";
  if (rating >= 1700) return "platinum";
  if (rating >= 1400) return "gold";
  if (rating >= 1100) return "silver";
  return "bronze";
}
