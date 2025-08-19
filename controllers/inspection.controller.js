// controllers/inspection.controller.js
import Vehicle from "../models/vehicle.model.js";
import Tyre from "../models/tyre.model.js";
import Inspection from "../models/inspection.model.js";

/* ----------------------------- helper utilities ---------------------------- */

const toNum = (v) => (v === "" || v == null ? undefined : Number(v));
const toArr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);
const trimOrEmpty = (v) => (typeof v === "string" ? v.trim() : "");
const upperTrim = (v) => (typeof v === "string" ? v.toUpperCase().trim() : v);
const isValidCode = (code) => /^[A-Z0-9]{6}$/.test(code);

/** Safe getter for request body fields that may contain dots */
const getBody = (req, key) => req.body?.[key];

/** Build a treadDepth object from a base key (e.g., "offside.front.treadDepth") */
const buildTreadDepth = (req, baseKey) => ({
  inner: toNum(getBody(req, `${baseKey}.inner`)),
  middle: toNum(getBody(req, `${baseKey}.middle`)),
  outer: toNum(getBody(req, `${baseKey}.outer`)),
});

/**
 * Build a tyre entry (front/rear) from a prefix like "offside.front" or "nearside.rear".
 * Accepts both "*Value" override fields for brand/model where present; falls back to plain fields.
 */
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
    // tags exist on offside.* in your current code; supporting generally is harmless.
    tags: toArr(getBody(req, `${prefix}.tags`)),
  };
};

/** Parse tyreSize the same way as before (keeping blank if not provided or "__none__") */
const parseTyreSizeParam = (tyreSize) => {
  let frontSize = "";
  let rearSize = "";

  if (tyreSize && tyreSize !== "__none__") {
    const decoded = decodeURIComponent(tyreSize);
    const parts = decoded
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length === 1) {
      frontSize = parts[0];
      rearSize = parts[0];
    } else if (parts.length >= 2) {
      [frontSize, rearSize] = parts;
    }
  }
  return { frontSize, rearSize };
};

/** Fetch sorted brand options once */
const getBrandOptions = async () => {
  const brandsDocs = await Tyre.find({}, "brand").sort({ brand: 1 }).lean();
  return brandsDocs.map((b) => b.brand);
};

/** Build the inspection payload from req + code */
const buildInspectionPayload = (req, code) => ({
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

/* --------------------------------- routes --------------------------------- */

export const newInspection = async (req, res) => {
  try {
    const { vrm, tyreSize, mileage } = req.query;
    if (!vrm) return res.status(400).send("Missing vrm");

    const vehicle = await Vehicle.findOne({ vrm: vrm.toUpperCase() }).lean();
    if (!vehicle) return res.status(404).send("Vehicle not found");

    const last = vehicle.tyreRecords?.[vehicle.tyreRecords.length - 1];

    // Parse optional tyreSize
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

    // Pass mileage through for hidden input in the form
    const safeMileage = String(mileage ?? "").replace(/[^\d]/g, "");

    return res.render("inspections/new", {
      vehicle,
      defaults: { frontSize, rearSize, pressures },
      brandOptions,
      mileage: safeMileage, // <— NEW
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};


export const listBrands = async (_req, res) => {
  try {
    const brandOptions = await getBrandOptions();
    return res.json(brandOptions);
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

    return res.render("inspections/show", {
      inspection: { ...inspection, vehicle },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};

export const createInspection = async (req, res) => {
  try {
    // First attempt
    const code = await Inspection.generateUniqueCode();
    const doc = await Inspection.create(buildInspectionPayload(req, code));
    return res.render("inspections/created", { code: doc.code, vrm: doc.vrm });
  } catch (e) {
    // unique code rare collision: retry once with a fresh code
    if (e?.code === 11000 && e?.keyPattern?.code) {
      try {
        const code2 = await Inspection.generateUniqueCode();
        const doc2 = await Inspection.create(
          buildInspectionPayload(req, code2)
        );
        return res.render("inspections/created", {
          code: doc2.code,
          vrm: doc2.vrm,
        });
      } catch (err) {
        console.error(err);
      }
    }
    console.error(e);
    return res.status(500).send("Failed to save inspection");
  }
};
