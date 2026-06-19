// 场主控制台 —— IG 风
//   1) 头：eyebrow + display 标题 + 副标
//   2) 权限不足：白底锁屏 + 跳首页
//   3) 我的场馆：白底 card 列表 + 顶部「+ 新建场馆」IG 渐变 chip
//   4) 待审预订：白底 card 列表 + 行内 批准（IG 渐变）/ 拒绝（squash-light）
//   5) CreateVenueForm：inputCls 样式 + select 圆角
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession, useUi } from "@/lib/store";
import { createVenue, listVenuesByOwner } from "@/features/venues/api";
import { listPendingBookingsForOwner, reviewBooking } from "@/features/bookings/api";
import { store } from "@/lib/mock-data";
import { SPORT_TYPES, type SportType } from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/format";

const SPORT_LABEL_KEY: Record<SportType, string> = {
  squash: "sport.squash",
  badminton: "sport.badminton",
  basketball: "sport.basketball",
  football: "sport.football",
  tennis: "sport.tennis",
  table_tennis: "sport.table_tennis",
  volleyball: "sport.volleyball",
  other: "sport.other",
};

const SPORT_VISUAL: Record<SportType, { emoji: string; light: string; mono: string; accent: string }> = {
  squash:      { emoji: "🏸", light: "bg-squash-light",   mono: "SQUASH",     accent: "text-squash-dark"   },
  football:    { emoji: "⚽", light: "bg-football-light", mono: "FOOTBALL",   accent: "text-football-dark" },
  basketball:  { emoji: "🏀", light: "bg-hoops-light",    mono: "BASKETBALL", accent: "text-hoops-dark"    },
  badminton:   { emoji: "🏸", light: "bg-squash-light",   mono: "BADMINTON",  accent: "text-squash-dark"   },
  tennis:      { emoji: "🎾", light: "bg-football-light", mono: "TENNIS",     accent: "text-football-dark" },
  table_tennis:{ emoji: "🏓", light: "bg-hoops-light",    mono: "PING PONG",  accent: "text-hoops-dark"    },
  volleyball:  { emoji: "🏐", light: "bg-football-light", mono: "VOLLEYBALL", accent: "text-football-dark" },
  other:       { emoji: "🎯", light: "bg-ink-100",        mono: "OTHER",      accent: "text-ink-700"       },
};

const inputCls =
  "w-full rounded-xl border border-canvas-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder-ink-400 transition focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-200";

const selectCls = inputCls;

export function OwnerConsolePage() {
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const user = useSession((s) => s.user);
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: myVenues = [], isLoading: vLoading } = useQuery({
    queryKey: ["my-venues", user?.id],
    queryFn: () => listVenuesByOwner(user!.id),
    enabled: !!user && user.role === "owner",
  });
  const { data: pending = [], isLoading: pLoading } = useQuery({
    queryKey: ["owner-pending", user?.id],
    queryFn: () => listPendingBookingsForOwner(user!.id),
    enabled: !!user && user.role === "owner",
  });

  if (!user || user.role !== "owner") {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-canvas-200 bg-white p-8 text-center shadow-softSm">
          <div className="text-4xl">🚫</div>
          <p className="ig-eyebrow mt-3 text-ink-500">OWNER ONLY</p>
          <h1 className="mt-1 font-display text-2xl text-ink-800">{t("ownerOnly.title")}</h1>
          <p className="mt-2 text-sm text-ink-500">{t("ownerOnly.body")}</p>
          <a
            href="/"
            className="ig-stripe mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-softSm transition hover:-translate-y-0.5"
          >
            {t("common.backHome")} →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="ig-eyebrow text-ink-500">OWNER CONSOLE</p>
        <h1 className="mt-1 font-display text-3xl text-ink-800 sm:text-4xl">{t("owner.console")}</h1>
        <p className="mt-1 text-sm text-ink-500">{t("owner.subtitle")}</p>
      </header>

      <section className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="ig-eyebrow text-ink-500">VENUES · {myVenues.length}</p>
            <h2 className="mt-0.5 font-display text-xl text-ink-800">{t("owner.myVenues")}</h2>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="ig-stripe inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-softSm transition hover:-translate-y-0.5"
          >
            {showCreate ? t("ownerForm.cancel") : `+ ${t("owner.createVenue")}`}
          </button>
        </div>

        {vLoading ? (
          <div className="mt-4 h-12 animate-pulse rounded-xl bg-canvas-100" />
        ) : myVenues.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-canvas-200 bg-canvas-50 p-8 text-center">
            <div className="text-3xl">🏟️</div>
            <p className="ig-eyebrow mt-2 text-ink-500">EMPTY</p>
            <p className="mt-1 text-sm font-medium text-ink-700">{t("owner.emptyVenues")}</p>
            <p className="mt-1 text-xs text-ink-500">{t("owner.emptyVenuesBody")}</p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-canvas-200">
            {myVenues.map((v) => {
              const vis = SPORT_VISUAL[v.sportType];
              return (
                <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${vis.light}`}
                      aria-hidden
                    >
                      {vis.emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink-800">{v.name}</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${vis.light} ${vis.accent}`}>
                          {vis.mono}
                        </span>
                        <span className="text-xs text-ink-500">{t(SPORT_LABEL_KEY[v.sportType])}</span>
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-right text-sm text-ink-700">
                    {v.basePriceCents > 0 ? formatMoney(v.basePriceCents, locale) : t("venues.priceN/A")}
                    <span className="ml-1 text-xs text-ink-500">/ {t("common.perHour")}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {showCreate && (
          <CreateVenueForm
            onDone={() => {
              setShowCreate(false);
              qc.invalidateQueries({ queryKey: ["my-venues"] });
            }}
          />
        )}
      </section>

      <section className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="ig-eyebrow text-ink-500">REVIEWS · {pending.length}</p>
            <h2 className="mt-0.5 font-display text-xl text-ink-800">{t("owner.pendingBookings")}</h2>
          </div>
        </div>

        {pLoading ? (
          <div className="mt-4 h-12 animate-pulse rounded-xl bg-canvas-100" />
        ) : pending.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-canvas-200 bg-canvas-50 p-8 text-center">
            <div className="text-3xl">✨</div>
            <p className="ig-eyebrow mt-2 text-ink-500">ALL CLEAR</p>
            <p className="mt-1 text-sm font-medium text-ink-700">{t("owner.emptyPending")}</p>
            <p className="mt-1 text-xs text-ink-500">{t("owner.emptyPendingBody")}</p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-canvas-200">
            {pending.map((b) => {
              const venue = store.venues.find((v) => v.id === b.venueId);
              return (
                <li key={b.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink-800">{venue?.name}</div>
                      <div className="mt-0.5 text-xs text-ink-500">
                        {b.slotIds
                          .map((sid) => {
                            const sl = store.slots.find((s) => s.id === sid);
                            return sl ? formatDateTime(sl.startsAt, locale) : null;
                          })
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      <div className="mt-1 text-xs text-ink-500">
                        👤 {b.contactName} · 📞 {b.contactPhone}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() =>
                          reviewBooking(b.id, "confirm").then(() =>
                            qc.invalidateQueries({ queryKey: ["owner-pending"] }),
                          )
                        }
                        className="ig-stripe rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-softSm transition hover:-translate-y-0.5"
                      >
                        {t("owner.approve")}
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt(t("admin.rejectReason")) || t("ownerForm.rejectDefaultReason");
                          reviewBooking(b.id, "reject", reason).then(() =>
                            qc.invalidateQueries({ queryKey: ["owner-pending"] }),
                          );
                        }}
                        className="rounded-full border border-squash bg-squash-light px-3.5 py-1.5 text-xs font-semibold text-squash-dark transition hover:-translate-y-0.5"
                      >
                        {t("owner.reject")}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateVenueForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const user = useSession((s) => s.user)!;
  const [name, setName] = useState("");
  const [sportType, setSportType] = useState<SportType>("badminton");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [openTimeStart, setOpenTimeStart] = useState("08:00");
  const [openTimeEnd, setOpenTimeEnd] = useState("22:00");
  const [slotDuration, setSlotDuration] = useState<30 | 60 | 90 | 120>(60);
  const [basePrice, setBasePrice] = useState("80");
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      createVenue({
        ownerId: user.id,
        name,
        sportType,
        address,
        description,
        openTimeStart,
        openTimeEnd,
        slotDurationMinutes: slotDuration,
        requireApproval: false,
        cancelHours: 2,
        basePriceCents: Math.round(Number(basePrice) * 100),
        capacity: 4,
      }),
    onSuccess: (r) => {
      if (r.ok) onDone();
      else setErr(t("booking.submitBlocked", { words: r.words.join(", ") }));
    },
    onError: () => setErr(t("errors.generic")),
  });

  return (
    <div className="mt-5 border-t border-canvas-200 pt-5">
      <p className="ig-eyebrow text-ink-500">NEW VENUE</p>
      <h3 className="mt-0.5 font-display text-lg text-ink-800">{t("owner.createVenue")}</h3>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-ink-600">{t("ownerForm.name")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls + " mt-1"} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-600">{t("ownerForm.sportType")}</label>
          <select
            value={sportType}
            onChange={(e) => setSportType(e.target.value as SportType)}
            className={selectCls + " mt-1"}
          >
            {SPORT_TYPES.map((s) => (
              <option key={s} value={s}>
                {t(SPORT_LABEL_KEY[s])}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-ink-600">{t("ownerForm.address")}</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls + " mt-1"} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-ink-600">{t("ownerForm.description")}</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls + " mt-1"} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-600">{t("ownerForm.openStart")}</label>
          <input
            type="time"
            value={openTimeStart}
            onChange={(e) => setOpenTimeStart(e.target.value)}
            className={inputCls + " mt-1"}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-600">{t("ownerForm.openEnd")}</label>
          <input
            type="time"
            value={openTimeEnd}
            onChange={(e) => setOpenTimeEnd(e.target.value)}
            className={inputCls + " mt-1"}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-600">{t("ownerForm.slotDuration")}</label>
          <select
            value={slotDuration}
            onChange={(e) => setSlotDuration(Number(e.target.value) as 30 | 60 | 90 | 120)}
            className={selectCls + " mt-1"}
          >
            <option value="30">30</option>
            <option value="60">60</option>
            <option value="90">90</option>
            <option value="120">120</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-ink-600">{t("ownerForm.basePrice")}</label>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            className={inputCls + " mt-1"}
          />
        </div>
      </div>
      {err && (
        <div className="mt-4 rounded-xl border border-squash bg-squash-light px-3.5 py-2.5 text-sm text-squash-dark">
          {err}
        </div>
      )}
      <div className="mt-5 flex gap-2">
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !name || !address}
          className="ig-stripe rounded-full px-5 py-2 text-sm font-semibold text-white shadow-softSm transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          {t("owner.createVenue")}
        </button>
        <button
          onClick={onDone}
          className="rounded-full border border-canvas-200 bg-white px-5 py-2 text-sm font-medium text-ink-700 transition hover:bg-canvas-50"
        >
          {t("ownerForm.cancel")}
        </button>
      </div>
    </div>
  );
}
