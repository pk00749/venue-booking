import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { useSession } from "@/lib/store";
import { Leaderboard } from "@/features/competition/components";
// 暂用 emoji 兜底，避免循环依赖
import type { SportType } from "@/lib/types";
import clsx from "clsx";

const SPORTS: SportType[] = ["squash","badminton","basketball","football","tennis","table_tennis","volleyball","other"];

export function SportProfilePage() {
  const { t } = useTranslation();
  const { userId: routeUserId } = useParams<{ userId: string }>();
  const session = useSession((s) => s.user);
  const userId = routeUserId ?? session?.id ?? "";

  const [sport, setSport] = useState<SportType>("squash");
  // void profileQuery：保留扩展位（mock 阶段始终 null；Supabase 接入后这里挂 competitionApi.getSportProfile）
  const profileQuery = useQuery({
    queryKey: ["sport-profile", userId, sport],
    queryFn: async () => {
      // mock 阶段直接返回 null；Supabase 接入后用 competitionApi.getSportProfile
      if (!userId) return null;
      return null;
    },
    enabled: !!userId,
  });

  const tier = ("bronze" as const);
  void profileQuery; // placeholder

  return (
    <div className="space-y-6">
      <header>
        <p className="ig-eyebrow">{t("sportProfile.title")}</p>
        <h1 className="mt-1 font-display text-3xl text-ink-800 sm:text-4xl">
          {userId === session?.id ? (session?.nickname ?? t("common.user")) : t("common.user")}
        </h1>
      </header>

      <div className="flex flex-wrap gap-2">
        {SPORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            className={clsx(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
              s === sport ? "border-ink-800 bg-ink-800 text-canvas-50" : "border-canvas-200 bg-white text-ink-700 hover:border-ink-300",
            )}
          >
            <span aria-hidden>{{ squash:"🏸", badminton:"🏸", basketball:"🏀", football:"⚽", tennis:"🎾", table_tennis:"🏓", volleyball:"🏐", other:"🎯" }[s]}</span>
            <span>{t(`sport.${s}`)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Leaderboard sport={sport} />
        <section className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm">
          <p className="ig-eyebrow">{t("sportProfile.currentLevel", { level: 1 })}</p>
          <h2 className="mt-0.5 font-display text-xl text-ink-800">
            {t(`sport.${sport}`)} · {t(`competition.tier.${tier}`)}
          </h2>
          <p className="mt-2 text-sm text-ink-500">{t("sportProfile.emptyLedger")}</p>
        </section>
      </div>

      {!routeUserId && (
        <p className="text-xs text-ink-500">
          <Link to="/my-bookings" className="underline">{t("nav.myBookings")}</Link>
        </p>
      )}
    </div>
  );
}
