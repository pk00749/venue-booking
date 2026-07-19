// 运动排行榜（默认 Top 20）
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLeaderboard } from "../hooks";
import type { SportType } from "@/lib/types";
import type { Tier } from "@/features/competition/types";
import clsx from "clsx";

interface Props {
  sport: SportType;
  initialKind?: "ranked" | "friendly";
  defaultLimit?: number;
}

const TIER_COLOR: Record<Tier, string> = {
  bronze: "bg-amber-700 text-white",
  silver: "bg-slate-400 text-white",
  gold: "bg-yellow-400 text-ink-800",
  platinum: "bg-cyan-500 text-white",
  diamond: "bg-fuchsia-500 text-white",
};

export function Leaderboard({ sport, initialKind = "ranked", defaultLimit = 20 }: Props) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<"ranked" | "friendly">(initialKind);
  const { data, isLoading, isError } = useLeaderboard(sport, kind, defaultLimit);

  return (
    <section className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="ig-eyebrow">{t("competition.leaderboardTitle")}</p>
          <h2 className="mt-0.5 font-display text-xl text-ink-800">
            {t(`sport.${sport}`)}
          </h2>
        </div>
        <div className="flex gap-2">
          {(["ranked","friendly"] as const).map(k => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={clsx(
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                kind === k
                  ? "border-ink-800 bg-ink-800 text-canvas-50"
                  : "border-canvas-200 bg-white text-ink-700 hover:border-ink-300",
              )}
            >
              {k === "ranked" ? t("competition.leaderboardRanked") : t("competition.leaderboardFriendly")}
            </button>
          ))}
        </div>
      </header>

      {isLoading && (
        <div className="space-y-2">
          {[0,1,2].map(i => <div key={i} className="h-9 animate-pulse rounded-lg bg-canvas-200/60" />)}
        </div>
      )}
      {isError && (
        <p className="text-sm text-squash-dark">{t("errors.generic")}</p>
      )}
      {data && data.items.length === 0 && (
        <p className="text-sm text-ink-500">{t("competition.topNEmpty")}</p>
      )}
      {data && data.items.length > 0 && (
        <ol className="divide-y divide-canvas-200">
          {data.items.map((row) => (
            <li key={row.userId} className="flex items-center gap-3 py-2.5">
              <span className="w-6 text-right font-mono text-sm tabular-nums text-ink-500">{row.rank}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas-100 text-base">
                {row.avatarUrl ? (
                  <img src={row.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                ) : "🏅"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-800">{row.nickname}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
                  <span>{t("competition.level", { level: row.level })}</span>
                  <span>·</span>
                  <span className={clsx("rounded px-1.5 font-mono text-[10px] tracking-wider", TIER_COLOR[row.tier])}>
                    {t(`competition.tier.${row.tier}`)}
                  </span>
                </div>
              </div>
              <div className="text-right font-mono text-[12px] text-ink-700">
                {kind === "ranked" ? row.rating : row.xp}
              </div>
              <div className="hidden text-right font-mono text-[10px] tracking-wider text-ink-500 sm:block">
                <span className="text-football-dark">{t("competition.wins", { n: row.wins })}</span>
                {" "}
                <span className="text-ink-500">{t("competition.draws", { n: row.draws })}</span>
                {" "}
                <span className="text-squash-dark">{t("competition.losses", { n: row.losses })}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
      {data?.nextCursor != null && (
        <p className="mt-3 text-center text-xs text-ink-500">{t("competition.viewFull")}</p>
      )}
    </section>
  );
}
