// 全局测试环境：jest-dom 断言 + i18n 初始化（用真 zh-CN / en-US，方便断言实际渲染文本）
import "@testing-library/jest-dom/vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach } from "vitest";
import zh from "@/i18n/zh-CN.json";
import en from "@/i18n/en-US.json";
import { useUi } from "@/lib/store";

// 启动 i18n（用真翻译，与生产一致）
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { "zh-CN": { translation: zh }, "en-US": { translation: en } },
    lng: "zh-CN",
    fallbackLng: "en-US",
    interpolation: { escapeValue: false },
  });
});

// jsdom 不实现 matchMedia —— 部分组件库会调用，给个无害 stub
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// 每个 case 重置 store / i18n，避免污染
beforeEach(() => {
  useUi.setState({ locale: "zh-CN" });
  i18n.changeLanguage("zh-CN");
});
