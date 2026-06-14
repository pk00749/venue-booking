import { useTranslation } from "react-i18next";
import { useUi } from "@/lib/store";
import type { Locale } from "@/lib/types";

export function LocaleSwitcher() {
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  return (
    <select
      aria-label={t("common.language")}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="px-2 py-1 text-sm border border-slate-300 rounded bg-white"
    >
      <option value="zh-CN">中文</option>
      <option value="en-US">English</option>
    </select>
  );
}
