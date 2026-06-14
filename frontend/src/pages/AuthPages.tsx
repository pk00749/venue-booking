// 登录 / 注册 —— IG 风
//   1) 顶部小 IG 渐变 logo 标识
//   2) 居中 400px card：eyebrow + display 标题 + 表单 + IG 渐变 CTA
//   3) 底部切换链接
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { login, signup } from "@/features/auth/api";
import { useSession } from "@/lib/store";
import clsx from "clsx";

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="ig-eyebrow block">{label}</label>
      {children}
      {hint && <p className="font-mono text-[10px] tracking-wider text-ink-500">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-canvas-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder-ink-400 transition focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-200";

const primaryBtnCls =
  "ig-stripe inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-softSm transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";

function Banner({ tone, children }: { tone: "danger" | "success" | "warn"; children: React.ReactNode }) {
  const tones = {
    danger: "bg-squash-light text-squash-dark border-squash/30",
    success: "bg-football-light text-football-dark border-football/30",
    warn: "bg-hoops-light text-hoops-dark border-hoops/40",
  };
  return (
    <div className={clsx("rounded-xl border px-3.5 py-2.5 text-sm", tones[tone])}>{children}</div>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const setUser = useSession((s) => s.setUser);
  const navigate = useNavigate();
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("demo1234");
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (u) => {
      if (!u) { setErr(t("errors.loginFailed")); return; }
      setUser(u);
      navigate("/");
    },
    onError: () => setErr(t("errors.loginFailed")),
  });

  return (
    <div className="mx-auto max-w-md">
      {/* 顶部 logo */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="ig-stripe flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-softSm">🏟️</div>
        <span className="ig-eyebrow">{t("nav.appName")}</span>
      </div>

      <div className="rounded-2xl border border-canvas-200 bg-white p-6 shadow-softSm">
        <div className="space-y-1.5">
          <p className="ig-eyebrow">{t("auth.loginEyebrow")}</p>
          <h1 className="font-display text-3xl leading-tight text-ink-800">{t("auth.loginTitle")}</h1>
          <p className="text-sm text-ink-500">{t("auth.demoTip")}</p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); setErr(null); m.mutate(); }}
          className="mt-5 space-y-4"
        >
          <FormField label={t("auth.email")}>
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </FormField>
          <FormField label={t("auth.password")}>
            <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </FormField>

          {err && <Banner tone="danger">{err}</Banner>}

          <button type="submit" disabled={m.isPending || !email || !password} className={primaryBtnCls}>
            {m.isPending ? t("common.loading") : t("auth.submitLogin")}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-ink-500">
        <Link to="/signup" className="font-semibold text-ink-800 underline-offset-4 hover:underline">
          {t("auth.switchToSignup")} →
        </Link>
      </p>
    </div>
  );
}

export function SignupPage() {
  const { t } = useTranslation();
  const setUser = useSession((s) => s.setUser);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => signup(email, password, nickname),
    onSuccess: (u) => {
      if (!u) { setErr(t("errors.signupSensitive")); return; }
      setUser(u);
      navigate("/");
    },
    onError: () => setErr(t("errors.signupFailed")),
  });

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="ig-stripe flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-softSm">🏟️</div>
        <span className="ig-eyebrow">{t("nav.appName")}</span>
      </div>

      <div className="rounded-2xl border border-canvas-200 bg-white p-6 shadow-softSm">
        <div className="space-y-1.5">
          <p className="ig-eyebrow">{t("auth.signupEyebrow")}</p>
          <h1 className="font-display text-3xl leading-tight text-ink-800">{t("auth.signupTitle")}</h1>
          <p className="text-sm text-ink-500">{t("auth.demoTip")}</p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); setErr(null); m.mutate(); }}
          className="mt-5 space-y-4"
        >
          <FormField label={t("auth.nickname")}>
            <input className={inputCls} value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </FormField>
          <FormField label={t("auth.email")}>
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </FormField>
          <FormField label={t("auth.password")}>
            <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </FormField>

          {err && <Banner tone="danger">{err}</Banner>}

          <button type="submit" disabled={m.isPending || !email || !password || !nickname} className={primaryBtnCls}>
            {m.isPending ? t("common.loading") : t("auth.submitSignup")}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-ink-500">
        <Link to="/login" className="font-semibold text-ink-800 underline-offset-4 hover:underline">
          {t("auth.switchToLogin")} →
        </Link>
      </p>
    </div>
  );
}
