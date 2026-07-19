export type { SportType } from "@/lib/types";
import { z } from "zod";

export const CompetitionKindSchema = z.enum(["friendly", "ranked"]);
export const CompetitionModeSchema = z.enum(["singles", "teams"]);
export const CompetitionVisibilitySchema = z.enum(["public", "private"]);
export const TeamSchema = z.enum(["A", "B"]);
export const WinnerTeamSchema = z.enum(["A", "B", "draw"]);

export const ScoreSetsSchema = z.object({
  format: z.literal("sets"),
  best_of: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  team_a_sets: z.number().int().min(0),
  team_b_sets: z.number().int().min(0),
  set_scores: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])),
  winner: z.enum(["A", "B"]),
});

export const ScoreGoalsSchema = z.object({
  format: z.literal("goals"),
  team_a_goals: z.number().int().min(0),
  team_b_goals: z.number().int().min(0),
  winner: WinnerTeamSchema,
});

export const ScoreTotalPointsSchema = z.object({
  format: z.literal("total_points"),
  team_a_points: z.number().int().min(0),
  team_b_points: z.number().int().min(0),
  winner: WinnerTeamSchema,
});

export const ScorePayloadSchema = z.discriminatedUnion("format", [
  ScoreSetsSchema, ScoreGoalsSchema, ScoreTotalPointsSchema,
]);

export const CreateCompetitionInputSchema = z.object({
  bookingId: z.string().uuid(),
  slotId: z.string().uuid(),
  kind: CompetitionKindSchema,
  mode: CompetitionModeSchema,
  teamSize: z.number().int().min(1).max(10),
  visibility: CompetitionVisibilitySchema.optional(),
});
export type CreateCompetitionInput = z.infer<typeof CreateCompetitionInputSchema>;

export const ApplyCompetitionInputSchema = z.object({
  competitionId: z.string().uuid(),
  team: TeamSchema,
});
export type ApplyCompetitionInput = z.infer<typeof ApplyCompetitionInputSchema>;

export const ReviewApplicationInputSchema = z.object({
  competitionId: z.string().uuid(),
  userId: z.string().uuid(),
  action: z.enum(["accept", "reject"]),
});

export const SubmitResultInputSchema = z.object({
  competitionId: z.string().uuid(),
  scorePayload: ScorePayloadSchema,
  notes: z.string().max(2000).optional(),
});
export type SubmitResultInput = z.infer<typeof SubmitResultInputSchema>;

export const RespondResultInputSchema = z.object({
  competitionId: z.string().uuid(),
  response: z.enum(["confirm", "object"]),
  reason: z.string().max(500).optional(),
});

export const ReviewResultInputSchema = z.object({
  competitionId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
  noShowUserIds: z.array(z.string().uuid()).optional(),
});
export type ReviewResultInput = z.infer<typeof ReviewResultInputSchema>;
