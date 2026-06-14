// 申请成为场主 —— IG 风
//   1) 顶部：IG 渐变 emoji 大头 + eyebrow + 标题
//   2) 已申请：白底圆角 card 显示当前状态 + 拒绝原因
//   3) 未申请：白底圆角 card 表单
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyOwnerApp, submitOwnerApplication } from "@/features/owner/api";
import { useSession } from "@/lib/store";
import clsx from "clsx";

const inputCls =
  "w-full rounded-xl border border-canvas-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder-ink-400 transition focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-200";

export function BecomeOwnerPage() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const qc = useQueryClient();
  const [realName, setRealName] = useState("");
  const [idCardNo, setIdCardNo] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: existing } = useQuery({
    queryKey: ["my-owner-app", user?.id],
    queryFn: () => listMyOwnerApp(user!.id),
    enabled: !!user,
  });

  const m = useMutation({
    mutationFn: () => submitOwnerApplication({ userId: user!.id, realName, idCardNo, contactPhone }),
    onSuccess: () => { setDone(true); qc.invalidateQueries({ queryKey: ["my-owner-app"] }); },
    onError: () => setErr(t("errors.generic")),
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-canvas-200 bg-white p-8 text-center shadow-softSm">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-3 font-display text-2xl text-ink-800">{t("loginRequired.title")}</h1>
          <p className="mt-1 text-sm text-ink-500">{t("loginRequired.body")}</p>
          <Link
            to="/login"
            className="ig-stripe mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-softSm"
          >
            {t("nav.login")} →
          </Link>
        </div>
      </div>
    );
  }

  const statusKey =
    existing?.status === "approved" ? "confirmed"
    : existing?.status === "rejected" ? "rejected"
    : "pending";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* 顶部头 */}
      <div className="flex items-center gap-4">
        <div className="ig-stripe flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-softSm">🏟️</div>
        <div className="flex-1">
          <p className="ig-eyebrow">{t("nav.appName")}</p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink-800">{t("ownerApp.title")}</h1>
          <p className="mt-1 text-sm text-ink-500">{t("ownerApp.subtitle")}</p>
        </div>
      </div>

      <div className="ig-hairline" />

      {existing ? (
        <div className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm">
          <div className="flex items-center gap-3">
            <span className="ig-eyebrow">{t("ownerApp.statusLabel")}</span>
            <span
              className={clsx(
                "rounded-full px-2.5 py-0.5 font-mono text-[11px] tracking-[0.14em]",
                existing.status === "approved" && "bg-football-light text-football-dark",
                existing.status === "pending"  && "bg-hoops-light text-hoops-dark",
                existing.status === "rejected" && "bg-squash-light text-squash-dark"
              )}
            >
              {t(`status.${statusKey}`)}
            </span>
          </div>
          {existing.rejectReason && (
            <div className="mt-3 rounded-xl border border-squash/30 bg-squash-light px-3.5 py-2.5 text-sm text-squash-dark">
              {t("ownerApp.rejectLabel")}: {existing.rejectReason}
            </div>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); setErr(null); m.mutate(); }}
          className="space-y-4 rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm"
        >
          <div className="space-y-1.5">
            <label className="ig-eyebrow block">{t("ownerApp.realName")}</label>
            <input className={inputCls} value={realName} onChange={(e) => setRealName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="ig-eyebrow block">{t("ownerApp.idCardNo")}</label>
            <input
              className={inputCls}
              value={idCardNo}
              onChange={(e) => setIdCardNo(e.target.value)}
              placeholder={t("ownerApp.idCardPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="ig-eyebrow block">{t("ownerApp.contactPhone")}</label>
            <input
              className={inputCls}
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder={t("ownerApp.phonePlaceholder")}
            />
          </div>

          {err && (
            <div className="rounded-xl border border-squash/30 bg-squash-light px-3.5 py-2.5 text-sm text-squash-dark">
              {err}
            </div>
          )}
          {done && (
            <div className="rounded-xl border border-football/30 bg-football-light px-3.5 py-2.5 text-sm text-football-dark">
              ✅ {t("ownerApp.submitted")}
            </div>
          )}

          <button
            type="submit"
            disabled={m.isPending || !realName || !contactPhone}
            className="ig-stripe inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-softSm transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {m.isPending ? t("common.loading") : t("ownerApp.submit")}
          </button>
          <p className="font-mono text-[10px] tracking-wider text-ink-500">{t("ownerApp.disclaimer")}</p>
        </form>
      )}
    </div>
  );
}
