// 场主控制台 —— IG 风
//   1) 头：eyebrow + display 标题 + 副标
//   2) 权限不足：白底锁屏 + 跳首页
//   3) 我的场馆：白底 card 列表 + 顶部「+ 新建场馆」IG 渐变 chip + 行内「编辑 / 下架 / 重新上架」（PRD §US-203a）
//   4) 待审预订：白底 card 列表 + 行内 批准（IG 渐变）/ 拒绝（squash-light）
//   5) CreateVenueForm：抽到 features/owner/components/CreateVenueForm.tsx（新建 + 编辑 同一组件）
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useSession, useUi } from "@/lib/store";
import { listVenuesByOwner, listSlotTemplates, listCourts, listVenueServices, setVenueStatus } from "@/features/venues/api";
import { listPendingBookingsForOwner, reviewBooking } from "@/features/bookings/api";
import { store } from "@/lib/mock-data";
import { CreateVenueForm } from "@/features/owner/components/CreateVenueForm";
import { formatCourtName, formatDateTime, formatMoney } from "@/lib/format";
import { shortName } from "@/lib/region";
import type { SportType, Venue, Court, VenueService, SlotTemplate } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";

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
  other:       { emoji: "🎯", light: "bg-ink-100",        mono: "OTHER",     accent: "text-ink-700"       },
};

export function OwnerConsolePage() {
  const { t } = useTranslation();
  const locale = useUi((s) => s.locale);
  const user = useSession((s) => s.user);
  const qc = useQueryClient();
  // 同时只允许一个表单打开：新建 OR 编辑某一个 venue
  const [formMode, setFormMode] = useState<{ kind: "create" } | { kind: "edit"; venueId: string } | null>(null);

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

  // 编辑模式：拉取该 venue 的 courts / services / slotTemplates，预填表单
  const editingVenueId = formMode?.kind === "edit" ? formMode.venueId : null;
  const editingVenue = editingVenueId ? myVenues.find((v) => v.id === editingVenueId) ?? null : null;
  const { data: editCourts = [], isLoading: ecLoading } = useQuery<Court[]>({
    queryKey: ["courts", editingVenueId ?? ""],
    queryFn: () => listCourts(editingVenueId!),
    enabled: !!editingVenueId,
  });
  const { data: editServices = [] } = useQuery<VenueService[]>({
    queryKey: ["services", editingVenueId ?? ""],
    queryFn: () => listVenueServices(editingVenueId!),
    enabled: !!editingVenueId,
  });
  const { data: editTemplates = [] } = useQuery<SlotTemplate[]>({
    queryKey: ["slot-templates", editingVenueId ?? ""],
    queryFn: () => listSlotTemplates(editingVenueId!),
    enabled: !!editingVenueId,
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

  const closeForm = () => setFormMode(null);
  const startCreate = () => setFormMode({ kind: "create" });
  const startEdit = (venueId: string) => setFormMode({ kind: "edit", venueId });

  const flipStatus = async (venue: Venue, next: "active" | "inactive") => {
    const msg =
      next === "inactive"
        ? t("owner.confirmDeactivate", { name: venue.name })
        : t("owner.confirmReactivate", { name: venue.name });
    if (!window.confirm(msg)) return;
    await setVenueStatus(venue.id, next);
    qc.invalidateQueries({ queryKey: ["my-venues"] });
    qc.invalidateQueries({ queryKey: ["venues"] });
    qc.invalidateQueries({ queryKey: ["venue", venue.id] });
    qc.invalidateQueries({ queryKey: ["owner-dashboard"] });
  };

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
            onClick={startCreate}
            className="ig-stripe inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-softSm transition hover:-translate-y-0.5"
          >
            {formMode?.kind === "create" ? t("ownerForm.cancel") : `+ ${t("owner.createVenue")}`}
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
              const isInactive = v.status === "inactive";
              return (
                <li key={v.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${vis.light}`}
                        aria-hidden
                      >
                        {vis.emoji}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-ink-800">{v.name}</span>
                          {isInactive && (
                            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-600">
                              {t("owner.statusInactive")}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${vis.light} ${vis.accent}`}>
                            {vis.mono}
                          </span>
                          <span className="text-xs text-ink-500">{t(SPORT_LABEL_KEY[v.sportType])}</span>
                          <CourtCountChip venueId={v.id} />
                          <TemplateCountChip venueId={v.id} />
                        </div>
                        <div className="mt-1 truncate text-xs text-ink-500">
                          📍 {shortName(v.cityCode, locale)} · {shortName(v.districtCode, locale)}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-right text-sm text-ink-700">
                        {v.basePriceCents > 0 ? formatMoney(v.basePriceCents, locale) : t("venues.priceN/A")}
                        <span className="ml-1 text-xs text-ink-500">/ {t("common.perHour")}</span>
                      </span>
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          onClick={() => startEdit(v.id)}
                          className="rounded-full border border-canvas-200 bg-white px-3 py-1 text-[11px] font-semibold text-ink-700 transition hover:bg-canvas-50"
                        >
                          {t("owner.editVenue")}
                        </button>
                        {isInactive ? (
                          <button
                            onClick={() => flipStatus(v, "active")}
                            className="rounded-full bg-football-light px-3 py-1 text-[11px] font-semibold text-football-dark transition hover:-translate-y-0.5"
                          >
                            {t("owner.reactivateVenue")}
                          </button>
                        ) : (
                          <button
                            onClick={() => flipStatus(v, "inactive")}
                            className="rounded-full border border-squash bg-squash-light px-3 py-1 text-[11px] font-semibold text-squash-dark transition hover:-translate-y-0.5"
                          >
                            {t("owner.deactivateVenue")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

      </section>

      {/* 新建 / 编辑场馆 —— 独立 section，跟「我的场馆」「REVIEWS」平级，sticky 操作栏在 section 底部 */}
      {formMode?.kind === "create" && (
        <section className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm sm:p-6">
          <header>
            <p className="ig-eyebrow text-ink-500">CREATE VENUE</p>
            <h2 className="mt-0.5 font-display text-xl text-ink-800">{t("owner.createVenue")}</h2>
            <p className="mt-1 text-xs text-ink-500">{t("ownerForm.subtitle")}</p>
          </header>
          <div className="mt-4">
            <CreateVenueForm onDone={closeForm} />
          </div>
        </section>
      )}

      {formMode?.kind === "edit" && editingVenue && !ecLoading && (
        <section className="rounded-2xl border border-canvas-200 bg-white p-5 shadow-softSm sm:p-6">
          <header>
            <p className="ig-eyebrow text-ink-500">EDIT VENUE</p>
            <h2 className="mt-0.5 font-display text-xl text-ink-800">
              {t("ownerForm.sectionEditTitle", { name: editingVenue.name })}
            </h2>
            <p className="mt-1 text-xs text-ink-500">{t("ownerForm.subtitle")}</p>
          </header>
          <div className="mt-4">
            <CreateVenueForm
              initialVenue={editingVenue}
              initialCourts={editCourts}
              initialServices={editServices}
              initialTemplates={editTemplates}
              onDone={closeForm}
            />
          </div>
        </section>
      )}

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
                            if (!sl) return null;
                            const court = store.courts.find((c) => c.id === sl.courtId);
                            const courtName = court ? formatCourtName(court, locale) : "—";
                            return `${formatDateTime(sl.startsAt, locale)} · ${t("owner.courtProgress")} ${courtName}`;
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

// 列出该场馆的 active court 数
function CourtCountChip({ venueId }: { venueId: string }) {
  const { t } = useTranslation();
  const { data: courts = [] } = useQuery({
    queryKey: ["courts", venueId],
    queryFn: () => listCourts(venueId),
    enabled: !!venueId,
  });
  if (courts.length === 0) return null;
  return (
    <span className="rounded-full border border-canvas-200 bg-canvas-50 px-2 py-0.5 font-mono text-[10px] tracking-wider text-ink-600">
      {t("owner.courtCount", { n: courts.length })}
    </span>
  );
}

// 时段模板数（owner 控制台概览）
function TemplateCountChip({ venueId }: { venueId: string }) {
  const { t } = useTranslation();
  const { data: templates = [] } = useQuery({
    queryKey: ["slot-templates", venueId],
    queryFn: () => listSlotTemplates(venueId),
    enabled: !!venueId,
  });
  if (templates.length === 0) return null;
  return (
    <span className="rounded-full border border-canvas-200 bg-canvas-50 px-2 py-0.5 font-mono text-[10px] tracking-wider text-ink-600">
      {t("owner.templateCount", { n: templates.length })}
    </span>
  );
}
