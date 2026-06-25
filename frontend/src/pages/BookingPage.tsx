// 提交预订 —— IG 风（v3 重构为「球馆 → 场次 → 场地」三层）
//   1) 顶部只读 summary：球馆 + 场次时间 + 场地名 + "X/Y 满" 拼场进度
//   2) 附加服务（数量 stepper）
//   3) 联系人 + 备注
//   4) 底部固定 sticky：合计 + 提交 CTA
// URL 形式：/venues/:id/book?date=YYYY-MM-DD&start=<ISO>&court=<courtId>
// 向后兼容：旧 ?slot=sl_<...> 自动解析后 navigate(replace) 跳新 URL
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  findSlot,
  getCourt,
  getVenue,
  listVenueServices,
} from "@/features/venues/api";
import { createBooking } from "@/features/bookings/api";
import { useSession, useUi } from "@/lib/store";
import { formatCourtName, formatDate, formatMoney } from "@/lib/format";
import { store } from "@/lib/mock-data";
import clsx from "clsx";

const inputCls =
  "w-full rounded-xl border border-canvas-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder-ink-400 transition focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-200";

// 解析旧 ?slot= 的兼容入口：
//   - 新格式：sl_<courtId>_<tsMs>，courtId 形如 c_<venueId>_<idx>
//   - 旧格式（v3 之前的 mock）：sl_<venueId>_<tsMs>
// 任一格式都能反推到 (courtId, startsAt) → 跳新 URL。
function resolveLegacySlotToCourt(
  slotId: string,
  venueId: string,
): { courtId: string; startsAt: string } | null {
  const m = slotId.match(/^sl_(.+)_\d{13,}$/);
  if (!m) return null;
  const head = m[1];
  const tsMs = Number(slotId.slice(slotId.lastIndexOf("_") + 1));
  if (!Number.isFinite(tsMs)) return null;
  const startsAt = new Date(tsMs).toISOString();
  // 新格式：head = c_<venueId>_<idx>；直接查 store
  const candidate = store.courts.find((c) => c.id === head && c.venueId === venueId);
  if (candidate) return { courtId: candidate.id, startsAt };
  // 旧格式：head = <venueId>；取该 venue 首片 active court
  if (head === venueId) {
    const first = store.courts
      .filter((c) => c.venueId === venueId && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0];
    if (first) return { courtId: first.id, startsAt };
  }
  return null;
}

export function BookingPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const user = useSession((s) => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const startParam = searchParams.get("start");
  const courtId = searchParams.get("court");
  const legacySlot = searchParams.get("slot");

  const [serviceQty, setServiceQty] = useState<Record<string, number>>({});
  const [contactName, setContactName] = useState(user?.nickname ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneIsValid = (p: string): boolean => /^1[3-9]\d{9}$/.test(p);
  const phoneError = phoneTouched && contactPhone.length > 0 && !phoneIsValid(contactPhone);

  // 旧 ?slot= → 新 ?date=&start=&court= 跳转
  useEffect(() => {
    if (legacySlot && id && (!courtId || !startParam)) {
      const resolved = resolveLegacySlotToCourt(legacySlot, id);
      if (resolved) {
        const slot = store.slots.find(
          (s) => s.courtId === resolved.courtId && s.startsAt === resolved.startsAt,
        );
        const day = slot ? format(new Date(slot.startsAt), "yyyy-MM-dd") : date;
        navigate(
          `/venues/${id}/book?date=${day}&start=${encodeURIComponent(resolved.startsAt)}&court=${encodeURIComponent(resolved.courtId)}`,
          { replace: true },
        );
      }
    }
  }, [legacySlot, id, courtId, startParam, date, navigate]);

  const { data: venue, isLoading: vLoading } = useQuery({
    queryKey: ["venue", id],
    queryFn: () => getVenue(id),
    enabled: !!id,
  });
  const { data: court, isLoading: cLoading } = useQuery({
    queryKey: ["court", courtId],
    queryFn: () => getCourt(courtId!),
    enabled: !!courtId,
  });
  const { data: services = [] } = useQuery({
    queryKey: ["services", id],
    queryFn: () => listVenueServices(id),
    enabled: !!id,
  });
  const { data: slot, isLoading: sLoading } = useQuery({
    queryKey: ["slot", courtId, startParam],
    queryFn: () => findSlot(courtId!, startParam!),
    enabled: !!courtId && !!startParam,
  });

  const isLoadingCtx = vLoading || cLoading || sLoading;
  const slotUnavailable = !!slot && (slot.status !== "available" || slot.confirmedCount >= slot.capacity);
  const slotIsPast = !!slot && new Date(slot.endsAt).getTime() < Date.now();
  const cannotBook = !venue || !court || !slot || slotUnavailable || slotIsPast;

  const total = useMemo(() => {
    if (!venue || !slot) return 0;
    const slotPart = venue.basePriceCents; // 单次预订 = 1 个 (court × session) = 1 个 slot
    const svcPart = services.reduce((sum, s) => sum + s.priceCents * (serviceQty[s.id] ?? 0), 0);
    return slotPart + svcPart;
  }, [venue, slot, serviceQty, services]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not_logged_in");
      if (!slot) throw new Error("no_slot");
      const res = await createBooking({
        userId: user.id,
        venueId: id,
        slotIds: [slot.id],
        contactName,
        contactPhone,
        notes,
        services: Object.entries(serviceQty)
          .filter(([, q]) => q > 0)
          .map(([serviceId, quantity]) => ({ serviceId, quantity })),
      });
      if (!res.ok) throw new Error(res.reason);
      return res.booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", id] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["slot", courtId, startParam] });
      qc.invalidateQueries({ queryKey: ["courts", id] });
      setSubmitted(true);
    },
    onError: (e: Error) => {
      if (e.message.startsWith("sensitive:")) {
        setError(t("booking.submitBlocked", { words: e.message.slice("sensitive:".length) }));
      } else if (e.message === "no_slot") {
        setError(t("booking.noSlotsSelected"));
      } else if (e.message === "slot_taken") {
        setError(t("booking.slotTaken"));
      } else {
        setError(t("errors.generic"));
      }
    },
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-canvas-200 bg-white p-8 text-center shadow-softSm">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-3 font-display text-2xl text-ink-800">{t("loginRequired.title")}</h1>
          <p className="mt-1 text-sm text-ink-500">{t("venues.loginFirst")}</p>
          <button
            onClick={() => navigate("/login")}
            className="ig-stripe mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-softSm"
          >
            {t("nav.login")} →
          </button>
        </div>
      </div>
    );
  }
  if (!courtId || !startParam) {
    return (
      <div className="rounded-2xl border border-canvas-200 bg-white p-10 text-center">
        <div className="text-4xl">🔎</div>
        <h1 className="mt-3 font-display text-2xl text-ink-800">
          {locale === "zh-CN" ? "请先在场次页选择场地" : "Pick a court on the venue page first"}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {locale === "zh-CN"
            ? "回到场馆详情，点开场次，再选一片可加入的场地。"
            : "Go back to the venue, expand a session, then pick an open court."}
        </p>
        <Link
          to={`/venues/${id}`}
          className="ig-stripe mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-softSm"
        >
          {t("booking.backToSlots")} →
        </Link>
      </div>
    );
  }
  if (isLoadingCtx) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/2 animate-pulse rounded bg-canvas-200/60" />
        <div className="h-40 w-full animate-pulse rounded-2xl bg-canvas-200/60" />
        <div className="h-32 w-full animate-pulse rounded-2xl bg-canvas-200/60" />
      </div>
    );
  }
  if (!venue || !court || !slot) {
    return (
      <div className="rounded-2xl border border-canvas-200 bg-white p-10 text-center">
        <div className="text-4xl">🔎</div>
        <h1 className="mt-3 font-display text-2xl text-ink-800">{t("venues.notFoundTitle")}</h1>
        <Link
          to={`/venues/${id}`}
          className="mt-4 inline-block text-sm text-ink-500 underline-offset-2 hover:underline"
        >
          {t("booking.backToSlots")}
        </Link>
      </div>
    );
  }

  const sessionTime = `${format(new Date(slot.startsAt), "HH:mm")}–${format(new Date(slot.endsAt), "HH:mm")}`;
  const sessionDate = formatDate(slot.startsAt, locale);
  const courtName = formatCourtName(court, locale);
  const summaryAria = t("booking.summaryAria", {
    venue: venue.name,
    time: sessionTime,
    court: courtName,
    confirmed: slot.confirmedCount,
    capacity: slot.capacity,
  });

  return (
    <div className="space-y-5 pb-32">
      {submitted && (
        <CheckInModal
          phone={contactPhone}
          onClose={() => navigate("/my-bookings")}
        />
      )}

      <div>
        <p className="ig-eyebrow">{t("nav.appName")}</p>
        <h1 className="mt-1 font-display text-[36px] leading-tight text-ink-800">{t("booking.title")}</h1>
        <p className="mt-1 font-mono text-sm text-ink-500">⌖ {venue.name}</p>
      </div>

      {/* v3 只读 summary：球馆 + 场次时间 + 场地名 + 拼场进度 */}
      <section
        aria-label={summaryAria}
        className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm"
      >
        <p className="ig-eyebrow">{t("booking.sessionTime")}</p>
        <h2 className="mt-1 font-display text-2xl text-ink-800">
          {sessionDate} · {sessionTime}
        </h2>
        <div className="ig-hairline mt-4" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryItem label={t("booking.court")} value={courtName} />
          <SummaryItem
            label={t("booking.courtProgress")}
            value={
              <div className="flex items-center gap-2">
                <span className="font-mono text-base text-ink-800">
                  {slot.confirmedCount}/{slot.capacity}
                </span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-canvas-200">
                  <div
                    className={clsx("h-full rounded-full", slotUnavailable ? "bg-ink-800" : "bg-football")}
                    style={{ width: `${Math.max(6, Math.round((slot.confirmedCount / Math.max(1, slot.capacity)) * 100))}%` }}
                    aria-hidden
                  />
                </div>
              </div>
            }
          />
          <SummaryItem
            label={t("venueDetail.fromPrice")}
            value={
              <span className="font-display text-base text-ink-800">
                {formatMoney(venue.basePriceCents, locale)}
              </span>
            }
          />
        </div>
        {slotIsPast ? (
          <p className="mt-3 rounded-xl border border-canvas-200 bg-canvas-100 px-3 py-2 font-mono text-[11px] tracking-wider text-ink-500">
            ⚠ {t("venueDetail.courtPast")}
          </p>
        ) : slotUnavailable ? (
          <p className="mt-3 rounded-xl border border-squash/30 bg-squash-light px-3 py-2 font-mono text-[11px] tracking-wider text-squash-dark">
            ⚠ {t("venueDetail.fullyBooked")}
          </p>
        ) : null}
      </section>

      {/* 附加服务 */}
      <section className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm">
        <p className="ig-eyebrow">{t("booking.selectServices")}</p>
        <h2 className="mt-1 font-display text-2xl text-ink-800">{t("booking.selectServices")}</h2>
        {services.length === 0 ? (
          <p className="mt-3 font-mono text-sm text-ink-500">—</p>
        ) : (
          <ul className="mt-3 divide-y divide-canvas-200">
            {services.map((s) => {
              const qty = serviceQty[s.id] ?? 0;
              return (
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink-800">
                      {s.name}
                      {s.required && (
                        <span className="ml-2 rounded-full bg-squash-light px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-squash-dark">
                          {t("venues.servicesRequired")}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 font-mono text-[12px] text-ink-500">{formatMoney(s.priceCents, locale)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setServiceQty({ ...serviceQty, [s.id]: Math.max(0, qty - 1) })}
                      className="h-8 w-8 rounded-full border border-canvas-200 bg-white text-ink-700 transition hover:-translate-y-0.5 hover:border-ink-300"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-mono text-sm text-ink-800">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setServiceQty({ ...serviceQty, [s.id]: Math.min(20, qty + 1) })}
                      className="h-8 w-8 rounded-full border border-canvas-200 bg-white text-ink-700 transition hover:-translate-y-0.5 hover:border-ink-300"
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 联系人 + 备注 */}
      <section className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm">
        <p className="ig-eyebrow">{t("booking.contactInfo")}</p>
        <h2 className="mt-1 font-display text-2xl text-ink-800">{t("booking.contactInfo")}</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="ig-eyebrow block">{t("booking.contactName")}</label>
            <input className={inputCls} value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="ig-eyebrow block">{t("booking.contactPhone")}</label>
            <input
              inputMode="numeric"
              maxLength={11}
              className={inputCls}
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, ""))}
              onBlur={() => setPhoneTouched(true)}
            />
            {phoneError && (
              <p className="font-mono text-[11px] tracking-wider text-squash-dark">
                ⚠️ {t("booking.phoneInvalid")}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <label className="ig-eyebrow block">{t("booking.notes")}</label>
          <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-squash/30 bg-squash-light px-3.5 py-2.5 text-sm text-squash-dark">
          ⚠️ {error}
        </div>
      )}

      {/* 底部 sticky */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-canvas-200 bg-white/95 shadow-[0_-2px_18px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            to={`/venues/${id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-canvas-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-500 transition hover:border-ink-300 hover:text-ink-800"
          >
            <span aria-hidden>←</span>
            <span className="hidden sm:inline">{t("booking.backToSlots")}</span>
          </Link>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <div className="ig-eyebrow">{t("venues.stickyTotal")}</div>
              <div className="font-display text-2xl text-ink-800">{formatMoney(total, locale)}</div>
            </div>
            <button
              onClick={() => {
                setPhoneTouched(true);
                if (!phoneIsValid(contactPhone)) {
                  setError(t("booking.phoneInvalid"));
                  return;
                }
                setError(null);
                submit.mutate();
              }}
              disabled={submit.isPending || cannotBook}
              className="ig-stripe inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-softSm transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {submit.isPending ? t("common.loading") : t("booking.submit")} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-canvas-200 bg-canvas-50 p-3">
      <p className="ig-eyebrow">{label}</p>
      <div className="mt-1.5">{value}</div>
    </div>
  );
}

// 核销码弹窗
function CheckInModal({ phone, onClose }: { phone: string; onClose: () => void }) {
  const { t } = useTranslation();
  const code = phone.replace(/\D/g, "").slice(-4).padStart(4, "•");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
    >
      <div aria-hidden className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-canvas-200 bg-white p-6 shadow-soft">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-football-light text-2xl">
            ✅
          </div>
          <p className="ig-eyebrow mt-3">{t("nav.appName")}</p>
          <h2 id="checkin-modal-title" className="mt-1 font-display text-2xl text-ink-800">
            {t("booking.checkInModalTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            {t("booking.checkInModalSubtitle")}
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-canvas-200 bg-canvas-50 px-4 py-5 text-center">
          <p className="ig-eyebrow">{t("booking.checkInCodeLabel")}</p>
          <p className="mt-2 font-mono text-4xl font-semibold tracking-[0.4em] text-ink-800">
            {code}
          </p>
          <p className="mt-3 font-mono text-[11px] tracking-wider text-ink-500">
            {t("booking.checkInCodeHint")} · {t("booking.checkInCodeNote")}
          </p>
        </div>

        <button
          onClick={onClose}
          className="ig-stripe mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-softSm transition hover:-translate-y-0.5"
        >
          {t("booking.checkInModalCta")} →
        </button>
      </div>
    </div>
  );
}
