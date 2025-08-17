// controllers/inspection.controller.js
import Vehicle from "../models/vehicle.model.js";
import Tyre from "../models/tyre.model.js";
import Inspection from "../models/inspection.model.js";

/* ---------- helpers ---------- */
const toNum = (v) => (v === "" || v == null ? undefined : Number(v));

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1
const randomCode = (len = 6) =>
  Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");

async function generateUniqueCode() {
  // If the model has the static, prefer that.
  if (typeof Inspection.generateUniqueCode === "function") {
    return Inspection.generateUniqueCode();
  }
  // Fallback: do it here without nanoid
  for (let i = 0; i < 5; i++) {
    const code = randomCode(6);
    const exists = await Inspection.exists({ code });
    if (!exists) return code;
  }
  throw new Error("Could not generate unique code");
}

function buildInspectionPayload(body) {
  return {
    vrm: body.vrm?.toUpperCase(),
    mileage: toNum(body.mileage),
    notes: body.notes,

    offside: {
      front: {
        size: body["offside.front.size"]?.trim(),
        pressure: toNum(body["offside.front.pressure"]),
        brand: body["offside.front.brand"]?.trim(),
        model: body["offside.front.model"]?.trim(),
      },
      rear: {
        size: body["offside.rear.size"]?.trim(),
        pressure: toNum(body["offside.rear.pressure"]),
        brand: body["offside.rear.brand"]?.trim(),
        model: body["offside.rear.model"]?.trim(),
      },
    },
    nearside: {
      front: {
        size: body["nearside.front.size"]?.trim(),
        pressure: toNum(body["nearside.front.pressure"]),
        brand: body["nearside.front.brand"]?.trim(),
        model: body["nearside.front.model"]?.trim(),
      },
      rear: {
        size: body["nearside.rear.size"]?.trim(),
        pressure: toNum(body["nearside.rear.pressure"]),
        brand: body["nearside.rear.brand"]?.trim(),
        model: body["nearside.rear.model"]?.trim(),
      },
    },
  };
}

/* ---------- GET /inspections/new ---------- */
export const newInspection = async (req, res) => {
  try {
    const { vrm, tyreSize } = req.query;
    if (!vrm) return res.status(400).send("Missing vrm");

    const vehicle = await Vehicle.findOne({ vrm: vrm.toUpperCase() }).lean();
    if (!vehicle) return res.status(404).send("Vehicle not found");

    const last = vehicle.tyreRecords?.[vehicle.tyreRecords.length - 1];
    let frontSize = last?.front?.size || "";
    let rearSize = last?.rear?.size || frontSize || "";

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

    return res.render("inspections/new", {
      vehicle,
      defaults: { frontSize, rearSize, pressures },
      brandOptions,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};

/* ---------- Autocomplete APIs ---------- */
export const listBrands = async (req, res) => {
  const brands = await Tyre.find({}, "brand").sort({ brand: 1 }).lean();
  res.json(brands.map((b) => b.brand));
};

export const listModelsByBrand = async (req, res) => {
  const { brand } = req.query;
  if (!brand) return res.json([]);
  // case-insensitive match to be friendlier
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const doc = await Tyre.findOne({ brand: new RegExp(`^${esc(brand)}$`, "i") }, "models").lean();
  const models = Array.isArray(doc?.models) ? [...doc.models].sort() : [];
  res.json(models);
};

/* ---------- GET /inspections?code=XXXXXX ---------- */
export const showByCode = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Missing code");
  const norm = String(code).toUpperCase().trim();
  if (!/^[A-Z0-9]{6}$/.test(norm)) return res.status(400).send("Invalid code format");

  const inspection = await Inspection.findOne({ code: norm }).lean();
  if (!inspection) return res.status(404).send("Inspection not found");

  return res.render("inspections/show", { inspection });
};

/* ---------- POST /inspections ---------- */
const toStr = (v) => (v == null ? undefined : String(v).trim());

function readTyre(body, prefix) {
  // prefix like "offside.front"
  const g = (name) => body[`${prefix}.${name}`];

  return {
    size: toStr(g("size")),
    pressure: toNum(g("pressure")),
    dot: toStr(g("dot")),
    brand: toStr(g("brand")),
    model: toStr(g("model")),
    notes: toStr(g("notes")),
    condition: toStr(g("condition")), // "ok" | "advisory" | "fail"
    treadDepth: {
      inner: toNum(g("treadDepth.inner")),
      middle: toNum(g("treadDepth.middle")),
      outer: toNum(g("treadDepth.outer")),
    },
  };
}

export const createInspection = async (req, res) => {
  try {
    const payload = {
      code: await generateUniqueCode(), // or Inspection.generateUniqueCode()
      vrm: toStr(req.body.vrm)?.toUpperCase(),
      mileage: toNum(req.body.mileage),
      notes: toStr(req.body.notes),

      offside: {
        front: readTyre(req.body, "offside.front"),
        rear: readTyre(req.body, "offside.rear"),
      },
      nearside: {
        front: readTyre(req.body, "nearside.front"),
        rear: readTyre(req.body, "nearside.rear"),
      },
    };

    let doc;
    try {
      doc = await Inspection.create(payload);
    } catch (e) {
      if (e?.code === 11000 && e?.keyPattern?.code) {
        payload.code = await generateUniqueCode();
        doc = await Inspection.create(payload);
      } else {
        throw e;
      }
    }

    return res.redirect(`/inspections?code=${encodeURIComponent(doc.code)}`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Failed to save inspection");
  }
};
