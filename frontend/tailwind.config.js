/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // IG 风：白底主，灰底副
        canvas: {
          DEFAULT: "#FAFAFA",   // IG 灰白
          50:  "#FFFFFF",       // 卡片白
          100: "#FAFAFA",       // 页面底
          200: "#F0F0F0",       // 分割/hover
          300: "#E4E4E4",
        },
        // IG 文字灰阶（替代 ink 的深蓝墨）
        ink: {
          DEFAULT: "#262626",   // IG 主文字
          900: "#000000",
          800: "#262626",
          700: "#404040",
          600: "#6E6E6E",       // muted
          500: "#8E8E8E",       // meta
          400: "#A8A8A8",
          300: "#DBDBDB",       // 1px 边线
          200: "#EFEFEF",
          100: "#F5F5F5",
        },
        // 三个运动主色保留（高饱和，做 accent + 渐变光晕）
        squash:   { DEFAULT: "#FF5C3D", light: "#FFE0D8", dark: "#D63E22" },
        football: { DEFAULT: "#1FB85B", light: "#D1F2DF", dark: "#0E8C42" },
        hoops:    { DEFAULT: "#FFB300", light: "#FFEDB8", dark: "#D99500" },
        // IG 招牌渐变五色（用于 story ring / 强调）
        ig: {
          yellow: "#FEDA75",
          orange: "#FA7E1E",
          pink:   "#FCAF45",
          red:    "#F12711",
          magenta:"#D62976",
          purple: "#962FBF",
          blue:   "#4F5BD5",
        },
      },
      fontFamily: {
        // 全面 grotesque sans — IG 的 Neue Haas Grotesk 感觉
        display: ['"Manrope"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans:    ['"Manrope"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ['"DM Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        numeric: ['"Bricolage Grotesque"', '"Manrope"', "system-ui", "sans-serif"],
        // IG logo "Instagram" 那种手写感的备选
        script:  ['"Pacifico"', "cursive"],
      },
      letterSpacing: {
        tight:  "-0.02em",
        tighter:"-0.025em",
      },
      boxShadow: {
        // 软阴影（IG 风）取代之前的硬 plate
        soft:    "0 1px 2px rgba(0,0,0,0.04), 0 6px 18px rgba(0,0,0,0.06)",
        softSm:  "0 1px 2px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.04)",
        ring:    "0 0 0 3px #fff, 0 0 0 5px transparent", // story 圈
        "ig-ring": "0 0 0 3px #fff, 0 0 0 5px #DBDBDB",
      },
      borderRadius: {
        DEFAULT: "8px",
        md:     "12px",
        lg:     "16px",
        xl:     "20px",
        "2xl":  "28px",
        "3xl":  "40px",
      },
      backgroundImage: {
        // IG 招牌五色对角线渐变
        "ig-gradient":
          "linear-gradient(45deg, #FEDA75 0%, #FA7E1E 25%, #D62976 50%, #962FBF 75%, #4F5BD5 100%)",
        // 三个运动的柔色径向渐变（故事圈 / 卡背景光）
        "squash-glow":   "radial-gradient(circle at 30% 30%, #FF8B6B 0%, #FF5C3D 60%, #D63E22 100%)",
        "football-glow": "radial-gradient(circle at 30% 30%, #4FD683 0%, #1FB85B 60%, #0E8C42 100%)",
        "hoops-glow":    "radial-gradient(circle at 30% 30%, #FFD060 0%, #FFB300 60%, #D99500 100%)",
        // 顶部 nav 底部 1px hairline 渐变模拟
        "hairline": "linear-gradient(to right, transparent, #DBDBDB 20%, #DBDBDB 80%, transparent)",
      },
      animation: {
        "spin-slow": "spin 8s linear infinite",
        "bounce-soft": "bounceSoft 1.4s ease-in-out infinite",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
      },
      keyframes: {
        bounceSoft: {
          "0%,100%": { transform: "translateY(0)" },
          "50%":     { transform: "translateY(-6px)" },
        },
        pulseSoft: {
          "0%,100%": { opacity: "1" },
          "50%":     { opacity: "0.55" },
        },
      },
    },
  },
  plugins: [],
};
