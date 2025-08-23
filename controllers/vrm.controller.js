// controllers/vrm.controller.js
import Vehicle from "../models/vehicle.model.js";
import vrmLookup from "../utils/vrmLookup.js";
import UsageEvent from "../models/usageEvent.model.js";

const normaliseVrm = (v) => v.toUpperCase().trim().replace(/\s+/g, "");
const esc = (s = "") =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toMileageString = (v) => {
  if (v == null || v === "") return "";
  const n = Number(String(v).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n >= 0 ? String(n) : "";
};

export const findVrm = async (req, res) => {
  const rawVrm = (req.body.vrm || "").trim();
  const vrm = normaliseVrm(rawVrm);
  const mileagePrefill = toMileageString(req.body.mileage);

  let vehicle = await Vehicle.findOne({ vrm }).lean();
  if (!vehicle) {
    const created = await vrmLookup(vrm);
    if (!created) {
      return res.send(`
        <div class="mb-0 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-sm px-3 py-2">
          Couldn’t find tyre data for VRM <strong class="font-semibold">${esc(vrm)}</strong>. Check the plate and try again.
        </div>
      `);
    }
    vehicle = created.toObject ? created.toObject() : created;
  }

  const records = Array.isArray(vehicle.tyreRecords) ? vehicle.tyreRecords : [];
  if (records.length === 0) {
    return res.send(`
      <div class="mb-0 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm px-3 py-2">
        No tyre records available for VRM <strong class="font-semibold">${esc(vrm)}</strong>.
      </div>
    `);
  }

  // ✅ Log VRM lookup usage (reduces daily limits)
  try {
    if (req.user?._id) {
      const isTech = req.user.role === "technician" && req.user.owner;
      const accountId = isTech ? req.user.owner : req.user._id; // bill the admin pool
      await UsageEvent.create({
        user: req.user._id,       // actor
        billedTo: accountId,      // whose pool is billed
        type: "vrm_lookup",
        meta: { vrm, reason: "explicit_lookup" },
      });
    }
  } catch (e) {
    console.error("Failed to log usage event (vrm_lookup)", e);
  }

  // ✅ Tell the client (dashboard) that usage changed so it can toast + update numbers
  try {
    // enforceDailyLimit now attaches actor usage before this lookup
    const prevUsed = res.locals?.limitInfo?.used ?? null;
    const limit = res.locals?.limitInfo?.limit ?? (typeof req.user?.dailyLimit === "number" ? req.user.dailyLimit : 0);
    const isLimited = (req.user?.role !== "admin") && (typeof limit === "number") && limit > 0;

    if (isLimited && prevUsed != null) {
      const usedAfter = prevUsed + 1;
      const remainingAfter = Math.max(0, limit - usedAfter);
      // HTMX custom event with details; bubbles to the document so our dashboard can catch it
      res.set("HX-Trigger", JSON.stringify({
        vrmSearched: { used: usedAfter, remaining: remainingAfter, limit, vrm }
      }));
    }
  } catch (e) {
    // Non-fatal if the header fails for some reason
    console.error("Failed to set HX-Trigger vrmSearched", e);
  }

  const tyreSizeElements = records
    .map((rec, idx) => {
      const isStaggered = rec.front.size !== rec.rear.size;
      const value = isStaggered
        ? `${rec.front.size} | ${rec.rear.size}`
        : rec.front.size;

      const id = `tyreSize-${idx}`;
      const subtitle = isStaggered
        ? `<span class="text-xs text-slate-500">Staggered</span>`
        : `<span class="text-xs text-slate-500">Square</span>`;

      const metaFront = [
        rec.front.runflat ? "Runflat F" : null,
        Number.isFinite(rec.front.pressure) ? `${rec.front.pressure} psi F` : null,
      ].filter(Boolean).join(" · ");

      const metaRear = [
        rec.rear.runflat ? "Runflat R" : null,
        Number.isFinite(rec.rear.pressure) ? `${rec.rear.pressure} psi R` : null,
      ].filter(Boolean).join(" · ");

      const meta = [metaFront, metaRear].filter(Boolean).join(" | ");

      return `
        <label for="${id}" class="block cursor-pointer border-b last:border-b-0 border-slate-200">
          <div class="flex items-start gap-3 p-3 hover:bg-slate-50">
            <input
              class="mt-1.5 h-4 w-4 shrink-0 text-sky-600 focus:ring-sky-500 border-slate-300 rounded"
              type="radio"
              name="tyreSize"
              id="${id}"
              value="${esc(value)}"
              ${idx === 0 ? "checked" : ""}
              required
            />
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <div class="font-semibold text-slate-900">${esc(value)}</div>
                ${subtitle}
              </div>
              ${meta ? `<div class="text-xs text-slate-500 mt-1">${esc(meta)}</div>` : ""}
            </div>
          </div>
        </label>
      `;
    })
    .join("");

  const noneOption = `
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

  // Card with VRM, vehicle summary, mileage input, then size selector
  res.send(`
    <div class="rounded-2xl bg-white border border-slate-200 shadow-[0_6px_24px_rgba(0,0,0,.06)]">
      <div class="p-4 sm:p-6">
        <div class="flex items-center gap-3 mb-4">
          <span class="inline-flex items-center rounded-md text-black text-sm font-extrabold tracking-widest px-2.5 py-1 select-none"
                style="background:linear-gradient(90deg,#ffeb3b 0 74%, #1e88e5 74% 100%);">
            ${esc(vrm)} <small class="ml-2 text-white font-semibold tracking-normal">UK</small>
          </span>
          <div>
            <div class="font-semibold text-slate-900">${esc(vehicle.make)} ${esc(vehicle.model)}</div>
            <div class="text-sm text-slate-500">${esc(vehicle.year)}${vehicle.torque ? ` &middot; Torque ${esc(vehicle.torque)}` : ""}</div>
          </div>
        </div>

        <form method="get" action="/inspections/new" class="space-y-4">
          <input type="hidden" name="vrm" value="${esc(vehicle.vrm)}" />

          <div>
            <label for="mileage" class="block text-sm font-medium text-slate-700">Mileage</label>
            <input
              id="mileage"
              name="mileage"
              type="number"
              inputmode="numeric"
              step="1"
              min="0"
              placeholder="e.g. 45678"
              value="${esc(mileagePrefill)}"
              class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>

          <div class="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-200">
            ${tyreSizeElements}
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
