// 省 / 市 / 区 级联下拉 —— PRD §US-203 结构化地址
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  isMunicipality,
  listCitiesForProvince,
  listDistrictsForCity,
  listProvinces,
  shortName,
} from "@/lib/region";

export interface AddressValue {
  provinceCode: string;
  cityCode: string;
  districtCode: string;
  addressDetail: string;
}

export interface RegionPickerProps {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  // 是否启用「直辖市跳过 city 这一级」的优化：默认 true
  collapseMunicipality?: boolean;
}

const selectCls =
  "w-full rounded-xl border border-canvas-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 transition focus:border-ink-300 focus:outline-none focus:ring-2 focus:ring-ink-200";

export function RegionPicker({ value, onChange, collapseMunicipality = true }: RegionPickerProps) {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language === "en-US" ? "en-US" : "zh-CN") as "zh-CN" | "en-US";
  const provinces = useMemo(() => listProvinces(), []);

  const handleProvinceChange = (next: string) => {
    const cities = listCitiesForProvince(next);
    const municipality = isMunicipality(next) && collapseMunicipality;
    const newCity = municipality ? next : cities[0]?.code ?? "";
    const districts = newCity ? listDistrictsForCity(newCity) : [];
    onChange({
      provinceCode: next,
      cityCode: newCity,
      districtCode: districts[0]?.code ?? "",
      addressDetail: value.addressDetail,
    });
  };

  const handleCityChange = (next: string) => {
    const districts = listDistrictsForCity(next);
    onChange({
      ...value,
      cityCode: next,
      districtCode: districts[0]?.code ?? "",
    });
  };

  const handleDistrictChange = (next: string) => {
    onChange({ ...value, districtCode: next });
  };

  const handleDetailChange = (next: string) => {
    onChange({ ...value, addressDetail: next });
  };

  const cities = value.provinceCode ? listCitiesForProvince(value.provinceCode) : [];
  const districts = value.cityCode ? listDistrictsForCity(value.cityCode) : [];
  const hideCity = collapseMunicipality && isMunicipality(value.provinceCode);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label className="text-xs font-medium text-ink-600">{t("ownerForm.province")}</label>
        <select
          className={selectCls + " mt-1"}
          value={value.provinceCode}
          onChange={(e) => handleProvinceChange(e.target.value)}
        >
          <option value="">{t("ownerForm.regionPick")}</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {locale === "zh-CN" ? p.name_zh : p.name_en}
            </option>
          ))}
        </select>
      </div>
      {!hideCity && (
        <div>
          <label className="text-xs font-medium text-ink-600">{t("ownerForm.city")}</label>
          <select
            className={selectCls + " mt-1"}
            value={value.cityCode}
            onChange={(e) => handleCityChange(e.target.value)}
            disabled={!value.provinceCode || cities.length === 0}
          >
            <option value="">{t("ownerForm.regionPick")}</option>
            {cities.map((c) => (
              <option key={c.code} value={c.code}>
                {locale === "zh-CN" ? c.name_zh : c.name_en}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="text-xs font-medium text-ink-600">{t("ownerForm.district")}</label>
        <select
          className={selectCls + " mt-1"}
          value={value.districtCode}
          onChange={(e) => handleDistrictChange(e.target.value)}
          disabled={!value.cityCode || districts.length === 0}
        >
          <option value="">{t("ownerForm.regionPick")}</option>
          {districts.map((d) => (
            <option key={d.code} value={d.code}>
              {locale === "zh-CN" ? d.name_zh : d.name_en}
            </option>
          ))}
        </select>
      </div>
      <div className={hideCity ? "sm:col-span-2" : "sm:col-span-3"}>
        <label className="text-xs font-medium text-ink-600">{t("ownerForm.addressDetail")}</label>
        <input
          className={selectCls + " mt-1"}
          placeholder={t("ownerForm.addressDetailHint")}
          value={value.addressDetail}
          onChange={(e) => handleDetailChange(e.target.value)}
        />
      </div>
      <p className="sm:col-span-3 font-mono text-[11px] tracking-wider text-ink-500">
        {value.provinceCode && value.cityCode && value.districtCode ? (
          <>
            {shortName(value.provinceCode, locale)} · {shortName(value.cityCode, locale)} · {shortName(value.districtCode, locale)}
            {value.addressDetail ? ` · ${value.addressDetail}` : ""}
          </>
        ) : (
          t("ownerForm.addressPreviewEmpty")
        )}
      </p>
    </div>
  );
}
