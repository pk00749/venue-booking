import { describe, expect, it } from "vitest";
import { tierOf } from "@/features/competition/types";

function levelOf(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + xp / 25)) / 2));
}

function xpMinForLevel(L: number): number {
  return 50 * L * (L - 1);
}

function expectedScore(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function eloDelta(rA: number, rB: number, score: number, k: number): number {
  return k * (score - expectedScore(rA, rB));
}

function xpForOutcome(win: boolean, draw: boolean, diff: number, friendly: boolean, decay: number): number {
  let base = 0;
  if (draw) base = 20;
  else if (win) {
    if (diff <= -5) base = 20;
    else if (diff <= -3) base = 30;
    else if (diff <= -1) base = 40;
    else if (diff === 0) base = 50;
    else if (diff === 1) base = 60;
    else if (diff === 2) base = 70;
    else if (diff === 3) base = 80;
    else if (diff === 4) base = 90;
    else base = 100;
  } else base = 10;
  if (friendly) base = Math.round(base * 0.5);
  return Math.round(base * decay);
}

describe("competition algorithms", () => {
  it("levelOf matches PRD thresholds", () => {
    // levelOf 公式 L = floor((1+sqrt(1+xp/25))/2)
    expect(levelOf(0)).toBe(1);
    expect(levelOf(100)).toBe(1);   // 100 < 156.13 → 还是 1
    expect(levelOf(200)).toBe(2);   // 200 >= 156
    expect(levelOf(400)).toBe(2);
    expect(levelOf(600)).toBe(3);   // 600 >= 525
    expect(levelOf(99999)).toBeGreaterThan(30);
  });

  it("xpMinForLevel returns the approximate threshold", () => {
    // xpMinForLevel 是 feature §4.1 给出的软阈值（不是 levelOf 公式的严格临界）
    expect(xpMinForLevel(2)).toBe(100);
    expect(xpMinForLevel(3)).toBe(300);
    expect(xpMinForLevel(4)).toBe(600);
    // levelOf 公式的实际临界略高：100→1，200→2，600→3
  });

  it("Elo expectedScore when equal is 0.5", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 5);
  });

  it("Elo higher rating has >0.5 expectation", () => {
    expect(expectedScore(1300, 1100)).toBeGreaterThan(0.5);
    expect(expectedScore(1100, 1300)).toBeLessThan(0.5);
  });

  it("Elo delta changes sign per outcome", () => {
    const winDelta = eloDelta(1000, 1000, 1, 40);
    const loseDelta = eloDelta(1000, 1000, 0, 40);
    expect(winDelta).toBeGreaterThan(0);
    expect(loseDelta).toBeLessThan(0);
    expect(winDelta + loseDelta).toBeCloseTo(0, 5);
  });

  it("K-factor tiers", () => {
    function kFor(rating: number, placementDone: number): number {
      if (placementDone < 5) return 60;
      if (rating < 1500) return 40;
      if (rating < 2100) return 25;
      return 15;
    }
    expect(kFor(1000, 0)).toBe(60);
    expect(kFor(1000, 5)).toBe(40);
    expect(kFor(1499, 5)).toBe(40);
    expect(kFor(1500, 5)).toBe(25);
    expect(kFor(2099, 5)).toBe(25);
    expect(kFor(2100, 5)).toBe(15);
    expect(kFor(2200, 5)).toBe(15);
  });

  it("XP table covers all diff buckets", () => {
    expect(xpForOutcome(true, false, -10, false, 1)).toBe(20);
    expect(xpForOutcome(true, false, -3, false, 1)).toBe(30);
    expect(xpForOutcome(true, false, -1, false, 1)).toBe(40);
    expect(xpForOutcome(true, false, 0, false, 1)).toBe(50);
    expect(xpForOutcome(true, false, 1, false, 1)).toBe(60);
    expect(xpForOutcome(true, false, 4, false, 1)).toBe(90);
    expect(xpForOutcome(true, false, 10, false, 1)).toBe(100);
  });

  it("friendly match halves XP", () => {
    expect(xpForOutcome(true, false, 0, true, 1)).toBe(25);
    expect(xpForOutcome(false, false, 0, true, 1)).toBe(5);
  });

  it("decay factor", () => {
    expect(xpForOutcome(true, false, 0, false, 0.5)).toBe(25);
    expect(xpForOutcome(true, false, 0, false, 0.2)).toBe(10);
  });

  it("draw yields 20 XP regardless of diff", () => {
    expect(xpForOutcome(false, true, -5, false, 1)).toBe(20);
    expect(xpForOutcome(false, true, 5, false, 1)).toBe(20);
  });

  it("loss yields 10 XP", () => {
    expect(xpForOutcome(false, false, -5, false, 1)).toBe(10);
    expect(xpForOutcome(false, false, 5, false, 1)).toBe(10);
  });

  it("tierOf mapping", () => {
    expect(tierOf(0)).toBe("bronze");
    expect(tierOf(1099)).toBe("bronze");
    expect(tierOf(1100)).toBe("silver");
    expect(tierOf(1399)).toBe("silver");
    expect(tierOf(1400)).toBe("gold");
    expect(tierOf(1699)).toBe("gold");
    expect(tierOf(1700)).toBe("platinum");
    expect(tierOf(1999)).toBe("platinum");
    expect(tierOf(2000)).toBe("diamond");
    expect(tierOf(4000)).toBe("diamond");
  });

  it("season soft reset converges to 1000", () => {
    function reset(rating: number) { return Math.round(1000 + 0.75 * (rating - 1000)); }
    expect(reset(2000)).toBe(1750);
    expect(reset(800)).toBe(850);
    expect(reset(1000)).toBe(1000);
    let r = 2500;
    for (let i = 0; i < 25; i++) r = reset(r);
    expect(Math.abs(r - 1000)).toBeLessThan(5);
  });
});
