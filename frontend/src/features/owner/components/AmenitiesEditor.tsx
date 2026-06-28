// 便利设施编辑器 —— PRD §US-208
// 预设 8 项 chip + 自定义文本输入；值以 `preset:<key>` / `custom:<label>` 形式存
import { useTranslation } from "react-i18next";
import { AMENITY_PRESETS_META } from "@/lib/amenities";
import {
  AMENITY_PRESET_PREFIX,
  AMENITY_CUSTOM_PREFIX,
  isCustomAmenity,
  isPresetAmenity,
  customAmenityKey,
  presetAmenityKey,
  type AmenityPreset,
} from "@/lib/types";

export interface AmenitiesEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
}

export function AmenitiesEditor({ value, onChange }: AmenitiesEditorProps) {
  const { t } = useTranslation();

  const selectedPresets = new Set<string>(
    value
      .filter(isPresetAmenity)
      .map((s) => s.slice(AMENITY_PRESET_PREFIX.length)),
  );
  const customs = value
    .filter(isCustomAmenity)
    .map((s) => s.slice(AMENITY_CUSTOM_PREFIX.length));

  const togglePreset = (key: AmenityPreset) => {
    const k = presetAmenityKey(key);
    if (selectedPresets.has(key)) {
      onChange(value.filter((s) => s !== k));
    } else {
      onChange([...value, k]);
    }
  };

  const removeCustom = (label: string) => {
    onChange(value.filter((s) => s !== customAmenityKey(label)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {AMENITY_PRESETS_META.map((m) => {
          const active = selectedPresets.has(m.key);
          return (
            <button
              type="button"
              key={m.key}
              onClick={() => togglePreset(m.key as AmenityPreset)}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition " +
                (active
                  ? "bg-ink-800 text-white shadow-softSm"
                  : "border border-canvas-200 bg-white text-ink-700 hover:border-ink-300")
              }
              aria-pressed={active}
            >
              <span aria-hidden>{m.icon}</span>
              <span>{t(m.i18nKey)}</span>
            </button>
          );
        })}
      </div>
      <CustomAmenityInput
        onAdd={(label) => {
          const key = customAmenityKey(label);
          if (!value.includes(key)) onChange([...value, key]);
        }}
      />
      {customs.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {customs.map((c) => (
            <li
              key={c}
              className="inline-flex items-center gap-1.5 rounded-full border border-canvas-200 bg-canvas-50 px-3 py-1.5 text-xs text-ink-700"
            >
              <span>{c}</span>
              <button
                type="button"
                onClick={() => removeCustom(c)}
                className="text-ink-400 hover:text-ink-700"
                aria-label={t("amenity.customRemove")}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CustomAmenityInput({ onAdd }: { onAdd: (label: string) => void }) {
  const { t } = useTranslation();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const input = (e.currentTarget.elements.namedItem("custom") as HTMLInputElement | null);
        const v = input?.value.trim();
        if (v) {
          onAdd(v);
          if (input) input.value = "";
        }
      }}
      className="flex gap-2"
    >
      <input
        name="custom"
        placeholder={t("amenity.customHint")}
        className="flex-1 rounded-xl border border-canvas-200 bg-white px-3.5 py-2 text-sm text-ink-800 placeholder-ink-400 transition focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-200"
      />
      <button
        type="submit"
        className="rounded-full border border-canvas-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 transition hover:border-ink-300"
      >
        {t("amenity.customAdd")}
      </button>
    </form>
  );
}
