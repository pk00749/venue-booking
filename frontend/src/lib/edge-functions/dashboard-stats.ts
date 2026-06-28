// dashboard-stats 的「前端 mock」缓存层
// ——未来真实形态（PRD §US-303）：Supabase Edge Function `dashboard-stats`，
//   在服务端聚合 9 项看板指标 + KV / 函数级缓存 60s。当前 mock 阶段：
//   - 调用链不变（queryFn 走这里而不是 features/admin/api.ts）
//   - 在前端模块作用域内做 60s 缓存：同一窗口内多次进入 /admin 只跑一次聚合
//   - 同一窗口内的并发请求去重（pending Promise 直接复用）
//   - 失败时自动清缓存，保证下次能重试
import { getDashboardStats, type DashboardStats } from "@/features/admin/api";

const TTL_MS = 60_000;

interface CacheEntry {
  value: Promise<DashboardStats>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const EMPTY_KEY = "default";

export function dashboardStatsEdge(): Promise<DashboardStats> {
  const now = Date.now();
  const hit = cache.get(EMPTY_KEY);
  if (hit && hit.expiresAt > now) return hit.value;

  const p = getDashboardStats()
    .then((v) => v)
    .catch((err) => {
      // 失败 → 立即清缓存，下次调用能再试
      cache.delete(EMPTY_KEY);
      throw err;
    });
  cache.set(EMPTY_KEY, { value: p, expiresAt: now + TTL_MS });
  return p;
}

export function clearDashboardStatsCache(): void {
  cache.delete(EMPTY_KEY);
}
