// 简化版敏感词检测：大小写不敏感 + 包含匹配
// PRD §9 描述了 Aho-Corasick 的方案；这里 MVP 用 includes 即可
import { store } from "./mock-data";
import type { WordSeverity } from "./types";

export interface SensitiveHit {
  word: string;
  severity: WordSeverity;
}

export function checkSensitive(text: string): SensitiveHit[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits: SensitiveHit[] = [];
  for (const w of store.words) {
    if (!w.isActive) continue;
    if (lower.includes(w.word.toLowerCase())) {
      hits.push({ word: w.word, severity: w.severity });
    }
  }
  return hits;
}

export function validateAgainstBlock(hits: SensitiveHit[]): { ok: boolean; words: string[] } {
  const blocked = hits.filter((h) => h.severity === "block").map((h) => h.word);
  return { ok: blocked.length === 0, words: blocked };
}
