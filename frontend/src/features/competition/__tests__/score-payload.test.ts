import { describe, expect, it } from "vitest";
import { ScorePayloadSchema } from "@/features/competition/schema";

describe("score_payload schema", () => {
  it("accepts badminton sets payload", () => {
    const r = ScorePayloadSchema.safeParse({
      format: "sets",
      best_of: 3,
      team_a_sets: 2,
      team_b_sets: 0,
      set_scores: [[21, 18], [21, 12]],
      winner: "A",
    });
    expect(r.success).toBe(true);
  });

  it("rejects non-A/B winner in sets", () => {
    const r = ScorePayloadSchema.safeParse({
      format: "sets",
      best_of: 3,
      team_a_sets: 2,
      team_b_sets: 0,
      set_scores: [[21, 18]],
      winner: "draw",
    });
    expect(r.success).toBe(false);
  });

  it("accepts football goals with draw", () => {
    const r = ScorePayloadSchema.safeParse({
      format: "goals",
      team_a_goals: 2,
      team_b_goals: 2,
      winner: "draw",
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative goals", () => {
    const r = ScorePayloadSchema.safeParse({
      format: "goals",
      team_a_goals: -1,
      team_b_goals: 1,
      winner: "B",
    });
    expect(r.success).toBe(false);
  });

  it("accepts basketball total points with draw", () => {
    const r = ScorePayloadSchema.safeParse({
      format: "total_points",
      team_a_points: 78,
      team_b_points: 78,
      winner: "draw",
    });
    expect(r.success).toBe(true);
  });

  it("rejects malformed format", () => {
    const r = ScorePayloadSchema.safeParse({ format: "weird" });
    expect(r.success).toBe(false);
  });
});
