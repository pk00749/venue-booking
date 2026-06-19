// 提交预订 —— IG 风
//   1) 头：eyebrow + venue 名
//   2) 日期 picker + 时段 grid（白底圆角 chip，selected IG 渐变）
//   3) 附加服务行（数量 stepper）
//   4) 联系人 + 备注
//   5) 底部固定 sticky：合计 + 提交 CTA（IG 渐变）
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getVenue, listSlots, listVenueServices } from "@/features/venues/api";
import { createBooking } from "@/features/bookings/api";
import { useSession, useUi } from "@/lib/store";
import { formatDateTime, formatMoney } from "@/lib/format";
import clsx from "clsx";

const inputCls =
  "w-full rounded-xl border border-canvas-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder-ink-400 transition focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-200";

export function BookingPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const user = useSession((s) => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialDate = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const initialSlotId = searchParams.get("slot");

  const [date, setDate] = useState<string>(initialDate);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(
    () => (initialSlotId ? new Set([initialSlotId]) : new Set())
  );
  const [serviceQty, setServiceQty] = useState<Record<string, number>>({});
  const [contactName, setContactName] = useState(user?.nickname ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneIsValid = (p: string): boolean => /^1[3-9]\d{9}$/.test(p);
  const phoneError = phoneTouched && contactPhone.length > 0 && !phoneIsValid(contactPhone);
  // 当从场次页带 ?slot= 进入时，把时段网格折叠成已选 chip；否则保持完整 grid
  const [showSlotPicker, setShowSlotPicker] = useState<boolean>(!initialSlotId);

  const { data: venue, isLoading: vLoading } = useQuery({ queryKey: ["venue", id], queryFn: () => getVenue(id), enabled: !!id });
  const { data: slots = [], isLoading: sLoading } = useQuery({
    queryKey: ["slots", id, date],
    queryFn: () => listSlots(id, new Date(date).toISOString()),
    enabled: !!id && !!user,
  });
  const { data: services = [] } = useQuery({
    queryKey: ["services", id],
    queryFn: () => listVenueServices(id),
    enabled: !!id,
  });

  const total = useMemo(() => {
    if (!venue) return 0;
    const slotPart = venue.basePriceCents * selectedSlots.size;
    const svcPart = services.reduce((sum, s) => sum + s.priceCents * (serviceQty[s.id] ?? 0), 0);
    return slotPart + svcPart;
  }, [venue, selectedSlots, serviceQty, services]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not_logged_in");
      if (selectedSlots.size === 0) throw new Error("no_slots");
      const res = await createBooking({
        userId: user.id,
        venueId: id,
        slotIds: [...selectedSlots],
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
      qc.invalidateQueries({ queryKey: ["slots", id] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      setSubmitted(true);
      setTimeout(() => navigate("/my-bookings"), 800);
    },
    onError: (e: Error) => {
      if (e.message.startsWith("sensitive:")) {
        setError(t("booking.submitBlocked", { words: e.message.slice("sensitive:".length) }));
      } else if (e.message === "no_slots") {
        setError(t("booking.noSlotsSelected"));
      } else if (e.message === "slot_taken") {
        setError(t("booking.slotTaken"));
      } else {
        setError(t("errors.generic"));
      }
    },
  });

  const removeSlot = (slotId: string): void => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      next.delete(slotId);
      return next;
    });
  };

  // 已选 chip 被全部移除后，自动展开 picker 让用户重选
  useEffect(() => {
    if (!sLoading && selectedSlots.size === 0 && !showSlotPicker) {
      setShowSlotPicker(true);
    }
  }, [sLoading, selectedSlots.size, showSlotPicker]);

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
  if (vLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/2 animate-pulse rounded bg-canvas-200/60" />
        <div className="h-40 w-full animate-pulse rounded-2xl bg-canvas-200/60" />
        <div className="h-32 w-full animate-pulse rounded-2xl bg-canvas-200/60" />
      </div>
    );
  }
  if (!venue) {
    return (
      <div className="rounded-2xl border border-canvas-200 bg-white p-10 text-center">
        <div className="text-4xl">🔎</div>
        <h1 className="mt-3 font-display text-2xl text-ink-800">{t("venues.notFoundTitle")}</h1>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-32">
      {/* 顶部：返回场地 */}
      <Link
        to={`/venues/${id}`}
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-500 hover:text-ink-800"
      >
        <span aria-hidden>←</span> {t("booking.backToVenue")}
      </Link>

      {/* 头 */}
      <div>
        <p className="ig-eyebrow">{t("nav.appName")}</p>
        <h1 className="mt-1 font-display text-[36px] leading-tight text-ink-800">{t("booking.title")}</h1>
        <p className="mt-1 font-mono text-sm text-ink-500">⌖ {venue.name}</p>
      </div>

      {submitted && (
        <div className="rounded-xl border border-football/30 bg-football-light px-3.5 py-2.5 text-sm text-football-dark">
          ✅ {t("booking.submitted")} — {t("common.loading")}
        </div>
      )}

      {/* 日期 + 时段 */}
      <section className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm">
        {showSlotPicker ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="ig-eyebrow">{t("venues.selectDate")}</p>
                <h2 className="mt-1 font-display text-2xl text-ink-800">{t("venues.selectDate")}</h2>
              </div>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSelectedSlots(new Set());
                  setShowSlotPicker(true);
                }}
                className={clsx(inputCls, "w-auto")}
              />
            </div>

            <div className="ig-hairline mt-4" />

            <p className="ig-eyebrow mt-4">{t("venues.selectSlots")}</p>
            {sLoading ? (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-full bg-canvas-200/60" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <div className="mt-3 rounded-xl border border-canvas-200 bg-canvas-50 p-6 text-center font-mono text-sm text-ink-500">
                📅 {t("venues.noSlots")}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {slots.map((s) => {
                  const taken = s.status !== "available";
                  const selected = selectedSlots.has(s.id);
                  const time = formatDateTime(s.startsAt, locale).split(" ").pop() ?? "";
                  return (
                    <button
                      key={s.id}
                      disabled={taken}
                      onClick={() => {
                        setSelectedSlots((prev) => {
                          const n = new Set(prev);
                          if (n.has(s.id)) n.delete(s.id);
                          else n.add(s.id);
                          return n;
                        });
                      }}
                      className={clsx(
                        "rounded-full border px-3 py-2 text-sm font-mono tracking-wider transition",
                        selected
                          ? "ig-stripe border-transparent text-white shadow-softSm"
                          : taken
                            ? "border-canvas-200 bg-canvas-100 text-ink-400 cursor-not-allowed"
                            : "border-canvas-200 bg-white text-ink-800 hover:border-ink-300 hover:-translate-y-0.5"
                      )}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-3 font-mono text-[11px] tracking-wider text-ink-500">
              {t("booking.selectedSlots")}: <span className="font-semibold text-ink-800">{selectedSlots.size}</span>
            </p>
          </>
        ) : (
          // 日期和时段都已经从 URL 确定 → 折叠成单行摘要，避免重复选择
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex items-center gap-2">
              <span aria-hidden>📅</span>
              <span className="font-mono text-sm tracking-wider text-ink-800">{date}</span>
            </div>
            <span aria-hidden className="h-5 w-px bg-canvas-200" />
            <div className="flex flex-wrap items-center gap-2">
              {[...selectedSlots].map((slotId) => {
                const slot = slots.find((s) => s.id === slotId);
                if (!slot) return null;
                const start = formatDateTime(slot.startsAt, locale).split(" ").pop() ?? "";
                const end = formatDateTime(slot.endsAt, locale).split(" ").pop() ?? "";
                return (
                  <span
                    key={slotId}
                    className="ig-stripe inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-mono tracking-wider text-white shadow-softSm"
                  >
                    <span>{start}–{end}</span>
                    <button
                      type="button"
                      onClick={() => removeSlot(slotId)}
                      aria-label={t("booking.removeSlotAria")}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowSlotPicker(true)}
              className="ml-auto font-mono text-[12px] font-semibold text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
            >
              {t("booking.changeSlots")} →
            </button>
          </div>
        )}
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
            <span className="hidden sm:inline">{t("booking.backToVenue")}</span>
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
              disabled={submit.isPending || selectedSlots.size === 0}
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
