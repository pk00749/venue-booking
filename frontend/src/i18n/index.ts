import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./zh-CN.json";
import en from "./en-US.json";
import { useUi } from "@/lib/store";

export const resources = {
  "zh-CN": { translation: zh },
  "en-US": { translation: en },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: "zh-CN",
  fallbackLng: "en-US",
  interpolation: { escapeValue: false },
});

// 当 zustand 中 locale 变化时同步 i18n
useUi.subscribe((s) => {
  if (i18n.language !== s.locale) {
    i18n.changeLanguage(s.locale);
    document.documentElement.lang = s.locale;
  }
});
// 启动时同步一次
i18n.changeLanguage(useUi.getState().locale);
document.documentElement.lang = useUi.getState().locale;

export default i18n;
