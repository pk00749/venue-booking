import { useTranslation } from "react-i18next";
import { useApplyCompetition } from "../hooks";
import type { Team } from "../types";

interface Props {
  competitionId: string;
  team: Team;
  disabled?: boolean;
  reason?: string;
}

export function ApplyButton({ competitionId, team, disabled, reason }: Props) {
  const { t } = useTranslation();
  const apply = useApplyCompetition();
  return (
    <button
      disabled={disabled || apply.isPending}
      onClick={() => apply.mutate({ competitionId, team })}
      className="ig-stripe rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-softSm disabled:opacity-50"
      aria-label={reason}
    >
      {t("competition.applyButton")} {t(`competition.applyTeam${team}`)}
    </button>
  );
}
