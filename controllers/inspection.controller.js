// controllers/inspection.controller.js
import Vehicle from "../models/vehicle.model.js";
import Tyre from "../models/tyre.model.js";
import Inspection from "../models/inspection.model.js";

const toNum = (v) => (v === "" || v == null ? undefined : Number(v));
const toArr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);

export const newInspection = async (req, res) => {
  try {
    const { vrm, tyreSize } = req.query;
    if (!vrm) return res.status(400).send("Missing vrm");

    const vehicle = await Vehicle.findOne({ vrm: vrm.toUpperCase() }).lean();
    if (!vehicle) return res.status(404).send("Vehicle not found");

    const last = vehicle.tyreRecords?.[vehicle.tyreRecords.length - 1];

    // If no tyreSize provided, keep blank; otherwise parse as before
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

    const pressures = {
      front:
        typeof last?.front?.pressure === "number" ? last.front.pressure : "",
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

export const listBrands = async (_req, res) => {
  const brands = await Tyre.find({}, "brand").sort({ brand: 1 }).lean();
  res.json(brands.map((b) => b.brand));
};

export const listModelsByBrand = async (req, res) => {
  const { brand } = req.query;
  if (!brand) return res.json([]);
  const doc = await Tyre.findOne({ brand }, "models").lean();
  const models = Array.isArray(doc?.models) ? [...doc.models].sort() : [];
  res.json(models);
};

export const showByCode = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Missing code");
  const norm = String(code).toUpperCase().trim();
  if (!/^[A-Z0-9]{6}$/.test(norm))
    return res.status(400).send("Invalid code format");
  const inspection = await Inspection.findOne({ code: norm }).lean();
  if (!inspection) return res.status(404).send("Inspection not found");
  return res.render("inspections/show", { inspection });
};

export const createInspection = async (req, res) => {
  try {
    const code = await Inspection.generateUniqueCode();

    const doc = await Inspection.create({
      code,
      vrm: req.body.vrm?.toUpperCase(),
      mileage: toNum(req.body.mileage),
      notes: req.body.notes,

      offside: {
        front: {
          size: req.body["offside.front.size"]?.trim(),
          pressure: toNum(req.body["offside.front.pressure"]),
          brand:
            req.body["offside.front.brandValue"]?.trim() ||
            req.body["offside.front.brand"]?.trim(), // manual fallback
          model:
            req.body["offside.front.modelValue"]?.trim() ||
            req.body["offside.front.model"]?.trim(),
          dot: req.body["offside.front.dot"]?.trim(),
          treadDepth: {
            inner: toNum(req.body["offside.front.treadDepth.inner"]),
            middle: toNum(req.body["offside.front.treadDepth.middle"]),
            outer: toNum(req.body["offside.front.treadDepth.outer"]),
          },
          condition: req.body["offside.front.condition"],
          notes: req.body["offside.front.notes"],
          tags: toArr(req.body["offside.front.tags"]),
        },
        rear: {
          size: req.body["offside.rear.size"]?.trim(),
          pressure: toNum(req.body["offside.rear.pressure"]),
          brand:
            req.body["offside.front.brandValue"]?.trim() ||
            req.body["offside.front.brand"]?.trim(),
          model:
            req.body["offside.front.modelValue"]?.trim() ||
            req.body["offside.front.model"]?.trim(),
          dot: req.body["offside.rear.dot"]?.trim(),
          treadDepth: {
            inner: toNum(req.body["offside.rear.treadDepth.inner"]),
            middle: toNum(req.body["offside.rear.treadDepth.middle"]),
            outer: toNum(req.body["offside.rear.treadDepth.outer"]),
          },
          condition: req.body["offside.rear.condition"],
          notes: req.body["offside.rear.notes"],
          tags: toArr(req.body["offside.front.tags"]),
        },
      },
      nearside: {
        front: {
          size: req.body["nearside.front.size"]?.trim(),
          pressure: toNum(req.body["nearside.front.pressure"]),
          brand: req.body["nearside.front.brand"]?.trim(),
          model: req.body["nearside.front.model"]?.trim(),
          dot: req.body["nearside.front.dot"]?.trim(),
          treadDepth: {
            inner: toNum(req.body["nearside.front.treadDepth.inner"]),
            middle: toNum(req.body["nearside.front.treadDepth.middle"]),
            outer: toNum(req.body["nearside.front.treadDepth.outer"]),
          },
          condition: req.body["nearside.front.condition"],
          notes: req.body["nearside.front.notes"],
        },
        rear: {
          size: req.body["nearside.rear.size"]?.trim(),
          pressure: toNum(req.body["nearside.rear.pressure"]),
          brand: req.body["nearside.rear.brand"]?.trim(),
          model: req.body["nearside.rear.model"]?.trim(),
          dot: req.body["nearside.rear.dot"]?.trim(),
          treadDepth: {
            inner: toNum(req.body["nearside.rear.treadDepth.inner"]),
            middle: toNum(req.body["nearside.rear.treadDepth.middle"]),
            outer: toNum(req.body["nearside.rear.treadDepth.outer"]),
          },
          condition: req.body["nearside.rear.condition"],
          notes: req.body["nearside.rear.notes"],
        },
      },
    });

    // Instead of redirecting straight to the report, show a confirmation screen
    // with code + copy + link (better for techs to put on work order).
    return res.render("inspections/created", { code: doc.code, vrm: doc.vrm });
  } catch (e) {
    // unique code rare collision retry
    if (e?.code === 11000 && e?.keyPattern?.code) {
      try {
        const code = await Inspection.generateUniqueCode();
        req.body.vrm = req.body.vrm?.toUpperCase();
        // simplest retry: set code and re-run creation with same payload
        return await createInspection(
          { ...req, body: { ...req.body, code } },
          res
        );
      } catch (err) {
        console.error(err);
      }
    }
    console.error(e);
    return res.status(500).send("Failed to save inspection");
  }
};
