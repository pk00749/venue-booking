// 场馆表单（新建 / 编辑）—— PRD §US-203 / §US-203a / §US-203b / §US-205 / §US-208
// 传入 initialVenue 即进入「编辑模式」：表单字段预填，提交走 updateVenue；
// 不传则是「新建模式」：表单空，提交走 createVenue。
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/store";
import { createVenue, updateVenue } from "@/features/venues/api";
import {
  SPORT_TYPES,
  type Court,
  type SlotTemplate,
  type SportType,
  type Venue,
  type VenueService,
} from "@/lib/types";
import { RegionPicker, type AddressValue } from "./RegionPicker";
import { CourtsEditor, type CourtDraft } from "./CourtsEditor";
import { AmenitiesEditor } from "./AmenitiesEditor";
import { ServicesEditor, type ServiceDraft } from "./ServicesEditor";
import { SlotTemplatesEditor, type SlotTemplateDraft } from "./SlotTemplatesEditor";

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

const inputCls =
  "w-full rounded-xl border border-canvas-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder-ink-400 transition focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-200";

const DEFAULT_COURTS: CourtDraft[] = [
  { name_zh: "A 场", name_en: "Court A", priceCents: 0, capacity: 4, isActive: true },
  { name_zh: "B 场", name_en: "Court B", priceCents: 0, capacity: 4, isActive: true },
  { name_zh: "C 场", name_en: "Court C", priceCents: 0, capacity: 4, isActive: true },
  { name_zh: "D 场", name_en: "Court D", priceCents: 0, capacity: 4, isActive: true },
];

export interface CreateVenueFormProps {
  /** 编辑模式：传入原 venue；新建模式不传 */
  initialVenue?: Venue;
  /** 编辑模式：传入该场馆已有的 courts / services / slotTemplates（与 initialVenue 一起） */
  initialCourts?: Court[];
  initialServices?: VenueService[];
  initialTemplates?: SlotTemplate[];
  onDone: () => void;
}

export function CreateVenueForm({
  initialVenue,
  initialCourts,
  initialServices,
  initialTemplates,
  onDone,
}: CreateVenueFormProps) {
  const { t } = useTranslation();
  const user = useSession((s) => s.user)!;
  const qc = useQueryClient();
  const isEdit = !!initialVenue;

  const [name, setName] = useState(initialVenue?.name ?? "");
  const [sportType, setSportType] = useState<SportType>(initialVenue?.sportType ?? "badminton");
  const [address, setAddress] = useState<AddressValue>({
    provinceCode: initialVenue?.provinceCode ?? "",
    cityCode: initialVenue?.cityCode ?? "",
    districtCode: initialVenue?.districtCode ?? "",
    addressDetail: initialVenue?.addressDetail ?? "",
  });
  const [description, setDescription] = useState(initialVenue?.description ?? "");
  const [openTimeStart, setOpenTimeStart] = useState(initialVenue?.openTimeStart ?? "08:00");
  const [openTimeEnd, setOpenTimeEnd] = useState(initialVenue?.openTimeEnd ?? "22:00");
  const [slotDuration, setSlotDuration] = useState<30 | 60 | 90 | 120>(
    initialVenue?.slotDurationMinutes ?? 60,
  );
  const [basePrice, setBasePrice] = useState(
    initialVenue ? String(Math.round(initialVenue.basePriceCents / 100)) : "80",
  );
  const [cancelHours, setCancelHours] = useState(initialVenue?.cancelHours ?? 2);
  const [requireApproval, setRequireApproval] = useState(initialVenue?.requireApproval ?? false);
  const [capacity, setCapacity] = useState(initialVenue?.capacity ?? 4);

  const [courts, setCourts] = useState<CourtDraft[]>(
    initialCourts && initialCourts.length > 0
      ? initialCourts.map((c) => ({
          id: c.id,
          name_zh: c.name_zh,
          name_en: c.name_en,
          priceCents: c.priceCents,
          capacity: c.capacity,
          notes: c.notes,
          isActive: c.isActive,
        }))
      : DEFAULT_COURTS,
  );
  const [amenities, setAmenities] = useState<string[]>(initialVenue?.amenities ?? []);
  const [services, setServices] = useState<ServiceDraft[]>(
    initialServices?.map((s) => ({
      id: s.id,
      name: s.name,
      priceCents: s.priceCents,
      required: s.required,
    })) ?? [],
  );
  const [slotTemplates, setSlotTemplates] = useState<SlotTemplateDraft[]>(
    initialTemplates && initialTemplates.length > 0
      ? initialTemplates.map((t) => ({
          dayOfWeek: t.dayOfWeek,
          timeStart: t.timeStart,
          timeEnd: t.timeEnd,
          courtIds: t.courtIds,
          slotDurationMinutes: t.slotDurationMinutes,
        }))
      : [
          {
            dayOfWeek: null,
            timeStart: "08:00",
            timeEnd: "22:00",
            courtIds: isEdit
              ? (initialCourts ?? []).map((c) => c.id)
              : DEFAULT_COURTS.map((_, i) => `__new_${i}`),
            slotDurationMinutes: 60,
          },
        ],
  );
  const [err, setErr] = useState<string | null>(null);

  const placeholderCourtIds = useMemo(
    () =>
      isEdit
        ? courts.map((c) => c.id ?? `__missing_${courts.indexOf(c)}`)
        : courts.map((_, i) => `__new_${i}`),
    [courts, isEdit],
  );

  const m = useMutation({
    mutationFn: () => {
      const basePriceCents = Math.round(Number(basePrice) * 100);
      if (isEdit && initialVenue) {
        return updateVenue(initialVenue.id, {
          name,
          sportType,
          provinceCode: address.provinceCode,
          cityCode: address.cityCode,
          districtCode: address.districtCode,
          addressDetail: address.addressDetail,
          description,
          openTimeStart,
          openTimeEnd,
          slotDurationMinutes: slotDuration,
          requireApproval,
          cancelHours,
          basePriceCents,
          capacity,
          amenities,
          courts: courts.map((c) => ({
            id: c.id,
            name_zh: c.name_zh,
            name_en: c.name_en,
            priceCents: c.priceCents,
            capacity: c.capacity,
            notes: c.notes,
            isActive: c.isActive,
          })),
          services: services.map((s) => ({
            id: s.id,
            name: s.name,
            priceCents: s.priceCents,
            required: s.required,
          })),
          slotTemplates: slotTemplates.map((tpl) => ({
            ...tpl,
            courtIds: isEdit
              ? tpl.courtIds
              : tpl.courtIds.map((cid) => {
                  const m = cid.match(/^__new_(\d+)$/);
                  return m ? `__pending:${m[1]}` : cid;
                }),
          })),
        });
      }
      return createVenue({
        ownerId: user.id,
        name,
        sportType,
        provinceCode: address.provinceCode,
        cityCode: address.cityCode,
        districtCode: address.districtCode,
        addressDetail: address.addressDetail,
        description,
        openTimeStart,
        openTimeEnd,
        slotDurationMinutes: slotDuration,
        requireApproval,
        cancelHours,
        basePriceCents,
        capacity,
        amenities,
        courts: courts.map((c) => ({
          name_zh: c.name_zh,
          name_en: c.name_en,
          priceCents: c.priceCents,
          capacity: c.capacity,
          notes: c.notes,
        })),
        services: services.map((s) => ({
          name: s.name,
          priceCents: s.priceCents,
          required: s.required,
        })),
        slotTemplates: slotTemplates.map((tpl) => ({
          ...tpl,
          courtIds: tpl.courtIds.map((cid) => {
            const m = cid.match(/^__new_(\d+)$/);
            return m ? `__pending:${m[1]}` : cid;
          }),
        })),
      });
    },
    onSuccess: (r) => {
      if (r.ok) {
        qc.invalidateQueries({ queryKey: ["my-venues"] });
        qc.invalidateQueries({ queryKey: ["venue", initialVenue?.id ?? ""] });
        qc.invalidateQueries({ queryKey: ["venues"] });
        qc.invalidateQueries({ queryKey: ["courts"] });
        qc.invalidateQueries({ queryKey: ["services"] });
        qc.invalidateQueries({ queryKey: ["slot-templates"] });
        qc.invalidateQueries({ queryKey: ["sessions"] });
        qc.invalidateQueries({ queryKey: ["owner-dashboard"] });
        onDone();
      } else {
        setErr(t("booking.submitBlocked", { words: r.words.join(", ") }));
      }
    },
    onError: () => setErr(t("errors.generic")),
  });

  const ready =
    !!name &&
    !!address.provinceCode &&
    !!address.cityCode &&
    !!address.districtCode &&
    !!address.addressDetail &&
    courts.length > 0;

  return (
    <div className="mt-5 space-y-6 border-t border-canvas-200 pt-5">
      <Section
        title={
          isEdit
            ? t("ownerForm.sectionEditTitle", { name: initialVenue?.name ?? "" })
            : t("ownerForm.sectionBasic")
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-ink-600">{t("ownerForm.name")}</label>
            <input
              className={inputCls + " mt-1"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">{t("ownerForm.sportType")}</label>
            <select
              className={inputCls + " mt-1"}
              value={sportType}
              onChange={(e) => setSportType(e.target.value as SportType)}
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
            <div className="mt-1">
              <RegionPicker value={address} onChange={setAddress} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-ink-600">{t("ownerForm.description")}</label>
            <input
              className={inputCls + " mt-1"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section title={t("ownerForm.sectionHours")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-ink-600">{t("ownerForm.openStart")}</label>
            <input
              type="time"
              className={inputCls + " mt-1"}
              value={openTimeStart}
              onChange={(e) => setOpenTimeStart(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">{t("ownerForm.openEnd")}</label>
            <input
              type="time"
              className={inputCls + " mt-1"}
              value={openTimeEnd}
              onChange={(e) => setOpenTimeEnd(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">{t("ownerForm.slotDuration")}</label>
            <select
              className={inputCls + " mt-1"}
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value) as 30 | 60 | 90 | 120)}
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
              className={inputCls + " mt-1"}
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">{t("ownerForm.cancelHours")}</label>
            <input
              type="number"
              min={0}
              max={168}
              className={inputCls + " mt-1"}
              value={cancelHours}
              onChange={(e) => setCancelHours(Math.max(0, Math.min(168, Number(e.target.value || 0))))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">{t("ownerForm.defaultCapacity")}</label>
            <input
              type="number"
              min={1}
              className={inputCls + " mt-1"}
              value={capacity}
              onChange={(e) => setCapacity(Math.max(1, Number(e.target.value || 1)))}
            />
          </div>
          <label className="inline-flex items-center gap-2 sm:col-span-3">
            <input
              type="checkbox"
              checked={requireApproval}
              onChange={(e) => setRequireApproval(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-canvas-300"
            />
            <span className="text-xs text-ink-700">{t("ownerForm.requireApproval")}</span>
          </label>
        </div>
      </Section>

      <Section title={t("ownerForm.sectionCourts")}>
        <CourtsEditor
          value={courts}
          onChange={setCourts}
          defaultCapacity={capacity}
          defaultPriceCents={Math.round(Number(basePrice) * 100)}
        />
      </Section>

      <Section title={t("ownerForm.sectionAmenities")}>
        <AmenitiesEditor value={amenities} onChange={setAmenities} />
      </Section>

      <Section title={t("ownerForm.sectionServices")}>
        <ServicesEditor value={services} onChange={setServices} />
      </Section>

      <Section title={t("ownerForm.sectionTemplates")}>
        <SlotTemplatesEditor
          value={slotTemplates}
          onChange={setSlotTemplates}
          courts={placeholderCourtIds.map((pid, i) => {
            const c = courts[i];
            return { id: pid, name_zh: c?.name_zh ?? `Court ${i + 1}`, name_en: c?.name_en ?? `Court ${i + 1}` };
          })}
          defaultSlotDurationMinutes={slotDuration}
        />
      </Section>

      {err && (
        <div className="rounded-xl border border-squash bg-squash-light px-3.5 py-2.5 text-sm text-squash-dark">
          {err}
        </div>
      )}

      {/* 底部操作栏：sticky 跟随滚动至视口底部，匹配 BookingPage / VenueDetailPage 视觉风格 */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex flex-wrap items-center gap-2 border-t border-canvas-200 bg-white/95 px-5 py-3 shadow-[0_-2px_18px_rgba(0,0,0,0.06)] backdrop-blur sm:-mx-6 sm:px-6">
        {err && (
          <span className="mr-auto text-xs font-medium text-squash-dark">{err}</span>
        )}
        <button
          type="button"
          onClick={() => m.mutate()}
          disabled={m.isPending || !ready}
          className="ig-stripe rounded-full px-5 py-2 text-sm font-semibold text-white shadow-softSm transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          {m.isPending ? t("common.loading") : isEdit ? t("ownerForm.saveChanges") : t("owner.createVenue")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full border border-canvas-200 bg-white px-5 py-2 text-sm font-medium text-ink-700 transition hover:bg-canvas-50"
        >
          {t("ownerForm.cancel")}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-display text-base text-ink-800">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}
