import Vehicle from "../models/vehicle.model.js";
import vrmLookup from "../utils/vrmLookup.js";
import { Router } from "express";

const router = Router();
const normaliseVrm = (v) => v.toUpperCase().trim().replace(/\s+/g, "");
const esc = (s = "") =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

router.post("/", async (req, res) => {
  const raw = (req.body.vrm || "").trim();
  const vrm = normaliseVrm(raw);

  let vehicle = await Vehicle.findOne({ vrm }).lean();
  if (!vehicle) {
    const created = await vrmLookup(vrm);
    if (!created) {
      return res.send(`
        <div class="alert alert-danger mb-0" role="alert">
          Couldn’t find tyre data for VRM <strong>${esc(vrm)}</strong>. Check the plate and try again.
        </div>
      `);
    }
    vehicle = created.toObject ? created.toObject() : created;
  }

  const records = Array.isArray(vehicle.tyreRecords) ? vehicle.tyreRecords : [];
  if (records.length === 0) {
    return res.send(`
      <div class="alert alert-warning mb-0" role="alert">
        No tyre records available for VRM <strong>${esc(vrm)}</strong>.
      </div>
    `);
  }

  const tyreSizeElements = records
    .map((rec, idx) => {
      const isStaggered = rec.front.size !== rec.rear.size;
      const value = isStaggered
        ? `${rec.front.size} | ${rec.rear.size}`
        : rec.front.size;

      const id = `tyreSize-${idx}`;
      const subtitle = isStaggered
        ? `<small class="text-muted">Staggered</small>`
        : `<small class="text-muted">Square</small>`;

      // optional extra context: runflat/pressure if present
      const metaFront = [
        rec.front.runflat ? "Runflat F" : null,
        Number.isFinite(rec.front.pressure) ? `${rec.front.pressure} psi F` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const metaRear = [
        rec.rear.runflat ? "Runflat R" : null,
        Number.isFinite(rec.rear.pressure) ? `${rec.rear.pressure} psi R` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const meta = [metaFront, metaRear].filter(Boolean).join(" | ");

      return `
        <div class="list-group-item">
          <div class="form-check">
            <input
              class="form-check-input"
              type="radio"
              name="tyreSize"
              id="${id}"
              value="${esc(value)}"
              ${idx === 0 ? "checked" : ""}
              required
            >
            <label class="form-check-label d-block" for="${id}">
              <div class="d-flex justify-content-between align-items-center">
                <div class="fw-semibold">${esc(value)}</div>
                ${subtitle}
              </div>
              ${
                meta
                  ? `<div class="small text-muted mt-1">${esc(meta)}</div>`
                  : ""
              }
            </label>
          </div>
        </div>
      `;
    })
    .join("");

  const noneOption = `
    <div class="list-group-item">
      <div class="form-check">
        <input
          class="form-check-input"
          type="radio"
          name="tyreSize"
          id="tyreSize-none"
          value="__none__"
          required
        >
        <label class="form-check-label d-block" for="tyreSize-none">
          <div class="fw-semibold">None of the above</div>
          <div class="small text-muted mt-1">I’ll enter sizes manually on the next step.</div>
        </label>
      </div>
    </div>
  `;

  // Card + plate style matches the home page vibe
  res.send(`
    <div class="card card-soft">
      <div class="card-body p-3 p-sm-4">
        <div class="d-flex align-items-center gap-3 mb-3">
          <span class="plate" style="
            font-weight:700;letter-spacing:.08em;border-radius:8px;
            background:linear-gradient(90deg,#ffeb3b 0 70%, #1e88e5 70% 100%);
            color:#000;display:inline-block;padding:.25rem .6rem;
          ">
            ${esc(vrm)} <small style="color:#fff;font-weight:600;margin-left:.4rem;">UK</small>
          </span>
          <div>
            <div class="fw-semibold">${esc(vehicle.make)} ${esc(vehicle.model)}</div>
            <div class="text-muted small">${esc(vehicle.year)}${
              vehicle.torque ? ` &middot; Torque ${esc(vehicle.torque)}` : ""
            }</div>
          </div>
        </div>

        <form method="get" action="/inspections/new">
          <input type="hidden" name="vrm" value="${esc(vehicle.vrm)}" />

          <div class="list-group mb-3 border rounded overflow-hidden">
            ${tyreSizeElements}
            ${noneOption}
          </div>

          <div class="d-grid">
            <button class="btn btn-primary">
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  `);
});

export default router;
