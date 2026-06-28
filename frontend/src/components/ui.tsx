// 轻量 UI 原子组件，撑住 MVP。AGENTS §13 OQ-1 选定 shadcn/ui 之前先 inline。
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import clsx from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "subtle";
  size?: "sm" | "md" | "lg";
};
export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonProps) {
  const base = "inline-flex items-center justify-center font-medium rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none";
  const sizes = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  }[size];
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow",
    secondary: "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100",
    ghost: "text-slate-700 hover:bg-slate-100 active:bg-slate-200",
    subtle: "bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200",
    danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm",
  }[variant];
  return <button className={clsx(base, sizes, variants, className)} {...rest} />;
}

type InputProps = InputHTMLAttributes<HTMLInputElement>;
export function Input({ className, ...rest }: InputProps) {
  return <input className={clsx("w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition", className)} {...rest} />;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;
export function Select({ className, children, ...rest }: SelectProps) {
  return <select className={clsx("w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition", className)} {...rest}>{children}</select>;
}

type CardProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  padded?: boolean;
};
export function Card({ children, className, interactive = false, padded = false }: CardProps) {
  return (
    <div
      className={clsx(
        "bg-white rounded-lg border border-slate-200 shadow-sm transition",
        interactive && "hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 cursor-pointer",
        padded && "p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

type BadgeTone = "default" | "success" | "warn" | "danger" | "info";
export function Badge({ children, tone = "default", className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  const tones: Record<BadgeTone, string> = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    warn: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
  };
  return <span className={clsx("inline-flex items-center px-2 py-0.5 text-xs font-medium rounded", tones[tone], className)}>{children}</span>;
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "confirmed":
    case "approved":
    case "completed":
      return "success";
    case "pending":
      return "warn";
    case "cancelled":
    case "rejected":
      return "danger";
    default:
      return "info";
  }
}

// ---------- 装饰/状态组件 ----------

// 渐变骨架屏，用于 loading 占位
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded bg-slate-200/70", className)} />;
}

// 空态：统一 icon + 标题 + 描述 + 可选 CTA
export function EmptyState({
  icon = "📭",
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm ring-1 ring-slate-200">
        {icon}
      </div>
      <div className="font-medium text-slate-800">{title}</div>
      {body && <div className="mt-1 text-sm text-slate-500">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// 运动图标 + 渐变背景：场馆卡片/详情页用，零外部图片依赖
const SPORT_VISUAL: Record<string, { emoji: string; gradient: string }> = {
  badminton: { emoji: "🏸", gradient: "from-emerald-400 to-teal-500" },
  basketball: { emoji: "🏀", gradient: "from-orange-400 to-rose-500" },
  football: { emoji: "⚽", gradient: "from-green-400 to-emerald-600" },
  tennis: { emoji: "🎾", gradient: "from-lime-400 to-green-500" },
  table_tennis: { emoji: "🏓", gradient: "from-red-400 to-pink-500" },
  volleyball: { emoji: "🏐", gradient: "from-sky-400 to-blue-500" },
  other: { emoji: "🏟️", gradient: "from-violet-400 to-indigo-500" },
};

export function sportVisual(sportType: string): { emoji: string; gradient: string } {
  return SPORT_VISUAL[sportType] ?? SPORT_VISUAL.other;
}

export function SportIcon({ sportType, size = "md" }: { sportType: string; size?: "sm" | "md" | "lg" }) {
  const v = sportVisual(sportType);
  const dims = { sm: "h-10 w-10 text-xl", md: "h-16 w-16 text-3xl", lg: "h-24 w-24 text-5xl" }[size];
  return (
    <div className={clsx("flex items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-inner", v.gradient, dims)}>
      <span>{v.emoji}</span>
    </div>
  );
}

// 通用错误/警告 banner
export function Banner({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "success"; children: ReactNode }) {
  const tones = {
    info: "bg-blue-50 text-blue-800 border-blue-200",
    warn: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  }[tone];
  return <div className={clsx("rounded-md border px-3 py-2 text-sm", tones)}>{children}</div>;
}

// ---------- IG 风格统计卡（admin/owner 看板复用） ----------
// PRD §US-207 / §US-303；保持 IG 设计系统（白底 + 圆角 + 渐变 stripe 风格由父容器决定）
export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: string;
}) {
  return (
    <div className="rounded-2xl border border-canvas-200 bg-white p-4 shadow-softSm transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="ig-eyebrow text-ink-500">{label}</p>
          <p className="mt-1 font-display text-2xl text-ink-800">{value}</p>
          {hint && <p className="mt-0.5 text-[11px] text-ink-500">{hint}</p>}
        </div>
        {icon && <div className="shrink-0 text-2xl opacity-80" aria-hidden>{icon}</div>}
      </div>
    </div>
  );
}
