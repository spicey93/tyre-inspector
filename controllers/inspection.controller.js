// controllers/inspection.controller.js
import Vehicle from "../models/vehicle.model.js";
import Tyre from "../models/tyre.model.js";
import Inspection from "../models/inspection.model.js";
import UsageEvent from "../models/usageEvent.model.js";

const toNum = (v) => (v === "" || v == null ? undefined : Number(v));
const toArr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);
const trimOrEmpty = (v) => (typeof v === "string" ? v.trim() : "");
const upperTrim = (v) => (typeof v === "string" ? v.toUpperCase().trim() : v);
const isValidCode = (code) => /^[A-Z0-9]{6}$/.test(code);

const getBody = (req, key) => req.body?.[key];
const buildTreadDepth = (req, baseKey) => ({
  inner: toNum(getBody(req, `${baseKey}.inner`)),
  middle: toNum(getBody(req, `${baseKey}.middle`)),
  outer: toNum(getBody(req, `${baseKey}.outer`)),
});
const buildTyrePosition = (req, prefix) => {
  const brandValue = trimOrEmpty(getBody(req, `${prefix}.brandValue`));
  const brand = brandValue || trimOrEmpty(getBody(req, `${prefix}.brand`));
  const modelValue = trimOrEmpty(getBody(req, `${prefix}.modelValue`));
  const model = modelValue || trimOrEmpty(getBody(req, `${prefix}.model`));
  const baseDepthKey = `${prefix}.treadDepth`;

  return {
    size: trimOrEmpty(getBody(req, `${prefix}.size`)),
    pressure: toNum(getBody(req, `${prefix}.pressure`)),
    brand,
    model,
    dot: trimOrEmpty(getBody(req, `${prefix}.dot`)),
    treadDepth: buildTreadDepth(req, baseDepthKey),
    condition: getBody(req, `${prefix}.condition`),
    notes: getBody(req, `${prefix}.notes`),
    tags: toArr(getBody(req, `${prefix}.tags`)),
  };
};

const buildInspectionPayload = (req, code) => ({
  user: req.user?._id,
  code,
  vrm: upperTrim(getBody(req, "vrm")),
  mileage: toNum(getBody(req, "mileage")),
  notes: getBody(req, "notes"),
  offside: {
    front: buildTyrePosition(req, "offside.front"),
    rear: buildTyrePosition(req, "offside.rear"),
  },
  nearside: {
    front: buildTyrePosition(req, "nearside.front"),
    rear: buildTyrePosition(req, "nearside.rear"),
  },
});

export const newInspection = async (req, res) => {
  try {
    const { vrm, tyreSize, mileage } = req.query;
    if (!vrm) return res.status(400).send("Missing vrm");

    const vehicle = await Vehicle.findOne({ vrm: vrm.toUpperCase() }).lean();
    if (!vehicle) return res.status(404).send("Vehicle not found");

    const last = vehicle.tyreRecords?.[vehicle.tyreRecords.length - 1];

    let frontSize = "";
    let rearSize = "";
    if (tyreSize && tyreSize !== "__none__") {
      const decoded = decodeURIComponent(tyreSize);
      const parts = decoded.split("|").map((s) => s.trim()).filter(Boolean);
      if (parts.length === 1) {
        frontSize = parts[0];
        rearSize = parts[0];
      } else if (parts.length >= 2) {
        [frontSize, rearSize] = parts;
      }
    }

    const pressures = {
      front: typeof last?.front?.pressure === "number" ? last.front.pressure : "",
      rear: typeof last?.rear?.pressure === "number" ? last.rear.pressure : "",
    };

    const brandsDocs = await Tyre.find({}, "brand").sort({ brand: 1 }).lean();
    const brandOptions = brandsDocs.map((b) => b.brand);

    const safeMileage = String(mileage ?? "").replace(/[^\d]/g, "");

    return res.render("inspections/new", {
      vehicle,
      defaults: { frontSize, rearSize, pressures },
      brandOptions,
      mileage: safeMileage,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};

export const listBrands = async (_req, res) => {
  try {
    const brandsDocs = await Tyre.find({}, "brand").sort({ brand: 1 }).lean();
    return res.json(brandsDocs.map((b) => b.brand));
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};

export const listModelsByBrand = async (req, res) => {
  try {
    const { brand } = req.query;
    if (!brand) return res.json([]);

    const doc = await Tyre.findOne({ brand }, "models").lean();
    const models = Array.isArray(doc?.models) ? [...doc.models].sort() : [];
    return res.json(models);
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};

export const showByCode = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("Missing code");

    const norm = upperTrim(String(code));
    if (!isValidCode(norm)) return res.status(400).send("Invalid code format");

    const inspection = await Inspection.findOne({ code: norm }).lean();
    if (!inspection) return res.status(404).send("Inspection not found");

    let vehicle = null;
    try {
      vehicle = await Vehicle.findOne({ vrm: inspection.vrm }).lean();
    } catch {
      vehicle = null;
    }

    return res.render("inspections/show", { inspection: { ...inspection, vehicle } });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};

export const createInspection = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).send("Login required");

    const code = await Inspection.generateUniqueCode();
    const doc = await Inspection.create(buildInspectionPayload(req, code));

    // ✅ If no VRM lookup today for this VRM, log implicit usage
    try {
      const vrm = (doc.vrm || "").toUpperCase().trim();
      if (vrm) {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
        const exists = await UsageEvent.exists({
          user: req.user._id,
          type: "vrm_lookup",
          "meta.vrm": vrm,
          createdAt: { $gte: start, $lt: end },
        });
        if (!exists) {
          await UsageEvent.create({
            user: req.user._id,
            type: "vrm_lookup",
            meta: { vrm, reason: "implicit_from_inspection", code: doc.code },
          });
        }
      }
    } catch (e) {
      console.error("Implicit VRM usage logging failed", e);
    }

    return res.redirect(`/dashboard?created=${encodeURIComponent(doc.code)}`);
  } catch (e) {
    console.error(e);
    return res.status(500).send("Failed to save inspection");
  }
};

// --- DELETE inspection (by _id) ---
export const deleteInspection = async (req, res) => {
  try {
    const { id } = req.params;

    // Only delete documents owned by the current user
    const doc = await Inspection.findOne({ _id: id, user: req.user._id });
    if (!doc) return res.status(404).send("Not found");

    const code = doc.code;
    await doc.deleteOne();

    // Fire an event for toast & counter updates
    res.setHeader("HX-Trigger", JSON.stringify({ inspectionDeleted: { id, code } }));

    // IMPORTANT: return 200 with empty body so hx-target="closest tr" + hx-swap="outerHTML" removes the row
    return res.status(200).send("");
  } catch (err) {
    console.error("deleteInspection failed", err);
    return res.status(500).send("Failed to delete inspection");
  }
};
