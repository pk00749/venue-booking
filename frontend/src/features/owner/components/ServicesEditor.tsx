// 附加服务（付费）编辑器 —— PRD §US-204
// 与 amenities（场地特性、免费）解耦；服务在 BookingPage 勾选并参与计费
import { useTranslation } from "react-i18next";

export interface ServiceDraft {
  id?: string;            // 编辑模式填真实 service.id；新建模式 undefined，由 createVenue 生成
  name: string;
  priceCents: number;
  required: boolean;
}

export interface ServicesEditorProps {
  value: ServiceDraft[];
  onChange: (next: ServiceDraft[]) => void;
}

const inputCls =
  "w-full rounded-lg border border-canvas-200 bg-white px-3 py-2 text-sm text-ink-800 placeholder-ink-400 transition focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-200";

export function ServicesEditor({ value, onChange }: ServicesEditorProps) {
  const { t } = useTranslation();
  const update = (i: number, patch: Partial<ServiceDraft>) => {
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
      { name: "", priceCents: 0, required: false },
    ]);
  };

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-canvas-200 bg-canvas-50 p-6 text-center text-xs text-ink-500">
          {t("ownerForm.servicesEmpty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {value.map((s, i) => (
            <li
              key={i}
              className="grid grid-cols-1 gap-2 rounded-xl border border-canvas-200 bg-canvas-50/60 p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-6">
                <label className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {t("ownerForm.serviceName")}
                </label>
                <input
                  className={inputCls + " mt-1"}
                  value={s.name}
                  placeholder={t("ownerForm.serviceNameHint")}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {t("ownerForm.servicePrice")}
                </label>
                <input
                  type="number"
                  min={0}
                  className={inputCls + " mt-1"}
                  value={Math.round(s.priceCents / 100)}
                  onChange={(e) =>
                    update(i, {
                      priceCents: Math.max(0, Math.round(Number(e.target.value || 0) * 100)),
                    })
                  }
                />
              </div>
              <div className="flex items-end justify-between gap-2 sm:col-span-3">
                <label className="inline-flex items-center gap-2 text-xs text-ink-600">
                  <input
                    type="checkbox"
                    checked={s.required}
                    onChange={(e) => update(i, { required: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-canvas-300"
                  />
                  {t("ownerForm.serviceRequired")}
                </label>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-full border border-squash bg-squash-light px-3 py-1 text-xs font-semibold text-squash-dark hover:bg-squash-light/80"
                >
                  {t("ownerForm.serviceRemove")}
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
        + {t("ownerForm.serviceAdd")}
      </button>
    </div>
  );
}
