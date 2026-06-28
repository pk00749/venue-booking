// 时段模板编辑器 —— PRD §US-205
// 每条模板：星期（0-6 / 每天）+ 时段窗口 [timeStart, timeEnd) + 开放场地 ID 集合
// 创建场馆时至少 1 条默认模板（覆盖所有 active court × 营业时段）
import { useTranslation } from "react-i18next";
import type { Court, SlotTemplate } from "@/lib/types";

export interface SlotTemplateDraft {
  dayOfWeek: number | null; // null = 每天
  timeStart: string;        // "08:00"
  timeEnd: string;          // "22:00"
  courtIds: string[];
  slotDurationMinutes?: 30 | 60 | 90 | 120;
}

export interface SlotTemplatesEditorProps {
  value: SlotTemplateDraft[];
  onChange: (next: SlotTemplateDraft[]) => void;
  courts: Pick<Court, "id" | "name_zh" | "name_en">[];
  defaultSlotDurationMinutes: number;
}

const inputCls =
  "w-full rounded-lg border border-canvas-200 bg-white px-3 py-2 text-sm text-ink-800 placeholder-ink-400 transition focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-200";

const DAY_KEYS = [
  { value: 0, key: "ownerForm.dow.sun" },
  { value: 1, key: "ownerForm.dow.mon" },
  { value: 2, key: "ownerForm.dow.tue" },
  { value: 3, key: "ownerForm.dow.wed" },
  { value: 4, key: "ownerForm.dow.thu" },
  { value: 5, key: "ownerForm.dow.fri" },
  { value: 6, key: "ownerForm.dow.sat" },
];

export function SlotTemplatesEditor({
  value,
  onChange,
  courts,
  defaultSlotDurationMinutes,
}: SlotTemplatesEditorProps) {
  const { t } = useTranslation();

  const update = (i: number, patch: Partial<SlotTemplateDraft>) => {
    const next = value.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };
  const add = () => {
    onChange([
      ...value,
      {
        dayOfWeek: null,
        timeStart: "08:00",
        timeEnd: "22:00",
        courtIds: courts.map((c) => c.id),
        slotDurationMinutes: defaultSlotDurationMinutes as 30 | 60 | 90 | 120,
      },
    ]);
  };

  const toggleCourt = (i: number, courtId: string) => {
    const tpl = value[i];
    const has = tpl.courtIds.includes(courtId);
    update(i, {
      courtIds: has ? tpl.courtIds.filter((c) => c !== courtId) : [...tpl.courtIds, courtId],
    });
  };

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-canvas-200 bg-canvas-50 p-6 text-center text-xs text-ink-500">
          {t("ownerForm.slotTemplatesEmpty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {value.map((tpl, i) => (
            <li
              key={i}
              className="grid grid-cols-1 gap-2 rounded-xl border border-canvas-200 bg-canvas-50/60 p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-3">
                <label className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {t("ownerForm.templateDow")}
                </label>
                <select
                  className={inputCls + " mt-1"}
                  value={tpl.dayOfWeek === null ? "every" : String(tpl.dayOfWeek)}
                  onChange={(e) =>
                    update(i, {
                      dayOfWeek: e.target.value === "every" ? null : Number(e.target.value),
                    })
                  }
                >
                  <option value="every">{t("ownerForm.dow.every")}</option>
                  {DAY_KEYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {t(d.key)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {t("ownerForm.templateStart")}
                </label>
                <input
                  type="time"
                  className={inputCls + " mt-1"}
                  value={tpl.timeStart}
                  onChange={(e) => update(i, { timeStart: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {t("ownerForm.templateEnd")}
                </label>
                <input
                  type="time"
                  className={inputCls + " mt-1"}
                  value={tpl.timeEnd}
                  onChange={(e) => update(i, { timeEnd: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {t("ownerForm.templateDuration")}
                </label>
                <select
                  className={inputCls + " mt-1"}
                  value={String(tpl.slotDurationMinutes ?? "")}
                  onChange={(e) => {
                    const v = e.target.value;
                    update(i, {
                      slotDurationMinutes: v
                        ? (Number(v) as 30 | 60 | 90 | 120)
                        : undefined,
                    });
                  }}
                >
                  <option value="">{t("ownerForm.templateDurationInherit")}</option>
                  <option value="30">30</option>
                  <option value="60">60</option>
                  <option value="90">90</option>
                  <option value="120">120</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {t("ownerForm.templateCourts")}
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {courts.map((c) => {
                    const active = tpl.courtIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCourt(i, c.id)}
                        aria-pressed={active}
                        className={
                          "rounded-full px-2.5 py-1 text-[11px] font-medium transition " +
                          (active
                            ? "bg-ink-800 text-white"
                            : "border border-canvas-200 bg-white text-ink-700 hover:border-ink-300")
                        }
                      >
                        {c.name_zh}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-end justify-end gap-2 sm:col-span-12">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-full border border-squash bg-squash-light px-3 py-1 text-xs font-semibold text-squash-dark hover:bg-squash-light/80"
                >
                  {t("ownerForm.templateRemove")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        disabled={courts.length === 0}
        className="inline-flex items-center gap-1.5 rounded-full border border-canvas-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 transition hover:border-ink-300 disabled:opacity-50"
      >
        + {t("ownerForm.templateAdd")}
      </button>
    </div>
  );
}

// 类型导出（让上层类型推断拿得到完整 SlotTemplate 形状）
export type { SlotTemplate };
