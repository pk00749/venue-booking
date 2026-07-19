import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCreateCompetition } from "../hooks";
import { Card, Button } from "@/components/ui";
import clsx from "clsx";

interface Props {
  bookingId: string;
  slotId: string;
  courtCapacity: number;
  open: boolean;
  onClose: () => void;
  onCreated?: (competitionId: string) => void;
}

export function CreateCompetitionModal({ bookingId, slotId, courtCapacity, open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<"friendly" | "ranked">("friendly");
  const [mode, setMode] = useState<"singles" | "teams">("singles");
  const [teamSize, setTeamSize] = useState(1);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const create = useCreateCompetition();

  if (!open) return null;

  const maxTeam = Math.max(1, Math.floor(courtCapacity / 2));
  const total = mode === "teams" ? teamSize * 2 : 2;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink-800/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <Card className="w-full max-w-md space-y-4 p-5">
        <header>
          <p className="ig-eyebrow">{t("competition.createModalTitle")}</p>
          <h2 className="mt-0.5 font-display text-xl text-ink-800">{t("competition.createButton")}</h2>
        </header>

        <Field label={t("competition.createModalKind")}>
          <Seg value={kind} options={[
            { v: "friendly", l: t("competition.createModalKindFriendly") },
            { v: "ranked",   l: t("competition.createModalKindRanked") },
          ]} onChange={(v) => setKind(v as "friendly" | "ranked")} />
        </Field>

        <Field label={t("competition.createModalMode")}>
          <Seg value={mode} options={[
            { v: "singles", l: t("competition.createModalModeSingles") },
            { v: "teams",   l: t("competition.createModalModeTeams") },
          ]} onChange={(v) => setMode(v as "singles" | "teams")} />
        </Field>

        {mode === "teams" && (
          <Field label={t("competition.createModalTeamSize")}>
            <select
              value={teamSize}
              onChange={(e) => setTeamSize(Number(e.target.value))}
              className="w-full rounded-lg border border-canvas-200 bg-white px-3 py-2 text-sm"
            >
              {Array.from({ length: maxTeam }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-500">{t("competition.createModalTeamSize")} ≤ {maxTeam}</p>
          </Field>
        )}

        <Field label={t("competition.createModalVisibility")}>
          <Seg value={visibility} options={[
            { v: "public", l: t("competition.createModalVisPublic") },
            { v: "private", l: t("competition.createModalVisPrivate") },
          ]} onChange={(v) => setVisibility(v as "public" | "private")} />
        </Field>

        {total > courtCapacity && (
          <p className="text-xs text-squash-dark">{t("errors.generic")}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            {t("competition.createModalCancel")}
          </Button>
          <Button
            className="ig-stripe text-white"
            disabled={create.isPending || total > courtCapacity}
            onClick={async () => {
              const res = await create.mutateAsync({ bookingId, slotId, kind, mode, teamSize, visibility });
              onCreated?.(res.competitionId);
              onClose();
            }}
          >
            {t("competition.createModalSubmit")}
          </Button>
        </div>
        {create.isError && (
          <p className="text-xs text-squash-dark">{(create.error as Error).message}</p>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="ig-eyebrow">{label}</span>
      {children}
    </label>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border border-canvas-200 bg-canvas-50 p-1">
      {options.map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={clsx(
            "flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition",
            value === o.v ? "bg-white shadow-softSm text-ink-800" : "text-ink-600 hover:text-ink-800",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
