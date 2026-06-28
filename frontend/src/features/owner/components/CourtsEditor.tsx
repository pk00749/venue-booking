// 场地（court）编辑器 —— PRD §US-203b
// 每片场地：中英文名 / 排序 / 单价（覆盖 venue）/ 容量（覆盖 venue）/ 备注 / 软停用
import { useTranslation } from "react-i18next";
import { courtLetter } from "@/lib/mock-data";

export interface CourtDraft {
  id?: string;            // 编辑模式填真实 court.id；新建模式 undefined，由 createVenue 生成
  name_zh: string;
  name_en: string;
  priceCents: number;       // 0 = 沿用 venue.basePriceCents
  capacity: number;
  notes?: string;
  isActive: boolean;
}

export interface CourtsEditorProps {
  value: CourtDraft[];
  onChange: (next: CourtDraft[]) => void;
  defaultCapacity: number;
  defaultPriceCents: number;
}

const inputCls =
  "w-full rounded-lg border border-canvas-200 bg-white px-3 py-2 text-sm text-ink-800 placeholder-ink-400 transition focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-200";

const buttonCls =
  "rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50";

export function CourtsEditor({
  value,
  onChange,
  defaultCapacity,
  defaultPriceCents,
}: CourtsEditorProps) {
  const { t } = useTranslation();
  const update = (i: number, patch: Partial<CourtDraft>) => {
    const next = value.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };
  const add = () => {
    const i = value.length;
    onChange([
      ...value,
      {
        name_zh: `${courtLetter(i)} 场`,
        name_en: `Court ${courtLetter(i)}`,
        priceCents: 0,
        capacity: defaultCapacity,
        isActive: true,
      },
    ]);
  };

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-canvas-200 bg-canvas-50 p-6 text-center text-xs text-ink-500">
          {t("ownerForm.courtsEmpty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {value.map((c, i) => (
            <li
              key={i}
              className="grid grid-cols-1 gap-2 rounded-xl border border-canvas-200 bg-canvas-50/60 p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-3">
                <label className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {t("ownerForm.courtNameZh")}
                </label>
                <input
                  className={inputCls + " mt-1"}
                  value={c.name_zh}
                  onChange={(e) => update(i, { name_zh: e.target.value })}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {t("ownerForm.courtNameEn")}
                </label>
                <input
                  className={inputCls + " mt-1 font-mono"}
                  value={c.name_en}
                  onChange={(e) => update(i, { name_en: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {t("ownerForm.courtPriceYuan")}
                </label>
                <input
                  type="number"
                  min={0}
                  className={inputCls + " mt-1"}
                  value={Math.round(c.priceCents / 100)}
                  placeholder={String(Math.round(defaultPriceCents / 100))}
                  onChange={(e) =>
                    update(i, {
                      priceCents: Math.max(0, Math.round(Number(e.target.value || 0) * 100)),
                    })
                  }
                />
              </div>
              <div className="sm:col-span-1">
                <label className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {t("ownerForm.courtCapacity")}
                </label>
                <input
                  type="number"
                  min={1}
                  className={inputCls + " mt-1"}
                  value={c.capacity}
                  onChange={(e) =>
                    update(i, { capacity: Math.max(1, Number(e.target.value || 1)) })
                  }
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {t("ownerForm.courtNotes")}
                </label>
                <input
                  className={inputCls + " mt-1"}
                  value={c.notes ?? ""}
                  onChange={(e) => update(i, { notes: e.target.value || undefined })}
                />
              </div>
              <div className="flex items-end justify-between gap-2 sm:col-span-12">
                <label className="inline-flex items-center gap-2 text-xs text-ink-600">
                  <input
                    type="checkbox"
                    checked={c.isActive}
                    onChange={(e) => update(i, { isActive: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-canvas-300"
                  />
                  {t("ownerForm.courtActive")}
                </label>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className={buttonCls + " border border-squash bg-squash-light text-squash-dark hover:bg-squash-light/80"}
                >
                  {t("ownerForm.courtRemove")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-full border border-canvas-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 transition hover:border-ink-300"
      >
        + {t("ownerForm.courtAdd")}
      </button>
    </div>
  );
}
