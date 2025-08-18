// controllers/vrm.controller.js
import Vehicle from "../models/vehicle.model.js";
import vrmLookup from "../utils/vrmLookup.js";

/* --------------------------------- helpers -------------------------------- */

const normalizeVrm = (v = "") => v.toUpperCase().trim().replace(/\s+/g, "");

/** Minimal HTML escaper for safe interpolation into strings */
const esc = (s = "") =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** Compose non-empty parts with a separator */
const joinParts = (parts, sep = " · ") => parts.filter(Boolean).join(sep);

/** Format the label value for a record (handles staggered vs square) */
const formatTyreValue = (rec) => {
  const f = esc(rec?.front?.size || "");
  const r = esc(rec?.rear?.size || "");
  if (!f && !r) return "";
  return f && r && f !== r ? `${f} | ${r}` : f || r; // prefer front if only one exists
};

const isStaggered = (rec) => {
  const f = rec?.front?.size ?? "";
  const r = rec?.rear?.size ?? "";
  return f && r && f !== r;
};

/** psi meta for front/rear (e.g., "Runflat F · 34 psi F") */
const formatMeta = (rec) => {
  const fMeta = joinParts([
    rec?.front?.runflat ? "Runflat F" : null,
    Number.isFinite(rec?.front?.pressure) ? `${rec.front.pressure} psi F` : null,
  ]);
  const rMeta = joinParts([
    rec?.rear?.runflat ? "Runflat R" : null,
    Number.isFinite(rec?.rear?.pressure) ? `${rec.rear.pressure} psi R` : null,
  ]);
  return joinParts([fMeta, rMeta], " | ");
};

/** Build one radio row for a tyre size record */
const renderTyreSizeOption = (rec, idx, checked = false) => {
  const value = formatTyreValue(rec);
  if (!value) return ""; // skip malformed rows that have no sizes
  const id = `tyreSize-${idx}`;
  const subtitle = isStaggered(rec)
    ? `<span class="text-xs text-slate-500">Staggered</span>`
    : `<span class="text-xs text-slate-500">Square</span>`;
  const meta = formatMeta(rec);

  // Use the raw sizes for the value attribute (unescaped) then escape when interpolating
  const rawFront = rec?.front?.size || "";
  const rawRear = rec?.rear?.size || "";
  const rawValue =
    rawFront && rawRear && rawFront !== rawRear
      ? `${rawFront} | ${rawRear}`
      : rawFront || rawRear;

  return `
    <label for="${esc(id)}" class="block cursor-pointer border-b last:border-b-0 border-slate-200">
      <div class="flex items-start gap-3 p-3 hover:bg-slate-50">
        <input
          class="mt-1.5 h-4 w-4 shrink-0 text-sky-600 focus:ring-sky-500 border-slate-300 rounded"
          type="radio"
          name="tyreSize"
          id="${esc(id)}"
          value="${esc(rawValue)}"
          ${checked ? "checked" : ""}
          required
        />
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <div class="font-semibold text-slate-900">${value}</div>
            ${subtitle}
          </div>
          ${meta ? `<div class="text-xs text-slate-500 mt-1">${esc(meta)}</div>` : ""}
        </div>
      </div>
    </label>
  `;
};

/** Build the “none of the above” radio row */
const renderNoneOption = () => `
  <label for="tyreSize-none" class="block cursor-pointer border-t border-slate-200">
    <div class="flex items-start gap-3 p-3 hover:bg-slate-50">
      <input
        class="mt-1.5 h-4 w-4 shrink-0 text-sky-600 focus:ring-sky-500 border-slate-300 rounded"
        type="radio"
        name="tyreSize"
        id="tyreSize-none"
        value="__none__"
        required
      />
      <div class="flex-1">
        <div class="font-semibold text-slate-900">None of the above</div>
        <div class="text-xs text-slate-500 mt-1">I’ll enter sizes manually on the next step.</div>
      </div>
    </div>
  </label>
`;

/* --------------------------------- handler -------------------------------- */

export const findVrm = async (req, res) => {
  const raw = (req.body?.vrm || "").trim();
  const vrm = normalizeVrm(raw);

  if (!vrm) {
    return res.send(`
      <div class="mb-0 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-sm px-3 py-2">
        Please enter a VRM.
      </div>
    `);
  }

  let vehicle;
  try {
    vehicle = await Vehicle.findOne({ vrm }).lean();
  } catch (e) {
    console.error(e);
    return res.send(`
      <div class="mb-0 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-sm px-3 py-2">
        There was a problem looking up VRM <strong class="font-semibold">${esc(vrm)}</strong>. Please try again.
      </div>
    `);
  }

  if (!vehicle) {
    try {
      const created = await vrmLookup(vrm);
      if (!created) {
        return res.send(`
          <div class="mb-0 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-sm px-3 py-2">
            Couldn’t find tyre data for VRM <strong class="font-semibold">${esc(vrm)}</strong>. Check the plate and try again.
          </div>
        `);
      }
      vehicle = created.toObject ? created.toObject() : created;
    } catch (e) {
      console.error(e);
      return res.send(`
        <div class="mb-0 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-sm px-3 py-2">
          Couldn’t fetch data for VRM <strong class="font-semibold">${esc(vrm)}</strong>. Please try again.
        </div>
      `);
    }
  }

  const records = Array.isArray(vehicle?.tyreRecords) ? vehicle.tyreRecords : [];
  // Render at least the “none of the above” option even if there are no records,
  // but keep your previous UX text for the empty-records case.
  if (records.length === 0) {
    return res.send(`
      <div class="mb-0 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm px-3 py-2">
        No tyre records available for VRM <strong class="font-semibold">${esc(vrm)}</strong>.
      </div>
    `);
  }

  const optionsHtml = records
    .map((rec, idx) => renderTyreSizeOption(rec, idx, idx === 0))
    .filter(Boolean)
    .join("");

  const noneOption = renderNoneOption();

  // Tailwind card-style container with VRM plate and vehicle summary
  return res.send(`
    <div class="rounded-2xl bg-white border border-slate-200 shadow-[0_6px_24px_rgba(0,0,0,.06)]">
      <div class="p-4 sm:p-6">
        <div class="flex items-center gap-3 mb-4">
          <span class="inline-flex items-center rounded-md text-black text-sm font-extrabold tracking-widest px-2.5 py-1 select-none"
                style="background:linear-gradient(90deg,#ffeb3b 0 74%, #1e88e5 74% 100%);">
            ${esc(vrm)} <small class="ml-2 text-white font-semibold tracking-normal">UK</small>
          </span>
          <div>
            <div class="font-semibold text-slate-900">${esc(vehicle?.make || "")} ${esc(vehicle?.model || "")}</div>
            <div class="text-sm text-slate-500">
              ${esc(vehicle?.year ?? "")}
              ${vehicle?.torque ? ` &middot; Torque ${esc(vehicle.torque)}` : ""}
            </div>
          </div>
        </div>

        <form method="get" action="/inspections/new" class="space-y-4">
          <input type="hidden" name="vrm" value="${esc(vehicle?.vrm || vrm)}" />

          <div class="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-200">
            ${optionsHtml}
            ${noneOption}
          </div>

          <div>
            <button class="inline-flex items-center justify-center rounded-lg bg-sky-600 text-white px-4 py-2.5 font-medium hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500">
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  `);
};
