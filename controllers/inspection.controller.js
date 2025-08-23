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
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function accountIdFor(req) {
  const isAdmin = req.user?.role === "admin";
  return isAdmin ? req.user._id : (req.user.owner || req.user._id);
}
function isAdmin(req) { return req.user?.role === "admin"; }

// ---------- LIST (index) ----------
export const indexInspections = async (req, res) => {
  try {
    const accountId = accountIdFor(req);

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = 15;
    const skip = (page - 1) * limit;

    const search = trimOrEmpty(req.query.search || "");
    const from = trimOrEmpty(req.query.from || "");
    const to = trimOrEmpty(req.query.to || "");

    const q = { user: accountId };

    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      q.$or = [{ vrm: rx }, { code: rx }];
    }

    if (from || to) {
      q.createdAt = {};
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0);
        q.createdAt.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        q.createdAt.$lte = d;
      }
    }

    const [items, total] = await Promise.all([
      Inspection.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Inspection.countDocuments(q),
    ]);

    res.render("inspections/index", {
      title: "Inspections — Tyre Inspector",
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
      filters: { search, from, to }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};

// ---------- SHOW by share code (public) ----------
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

// ---------- NEW (pre-fill + form) ----------
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

// ---------- Tyre lookups ----------
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

// ---- helpers to build payload from body ----
const getBodyVal = (req, k) => req.body?.[k];
const buildTreadDepth = (req, baseKey) => ({
  inner: toNum(getBodyVal(req, `${baseKey}.inner`)),
  middle: toNum(getBodyVal(req, `${baseKey}.middle`)),
  outer: toNum(getBodyVal(req, `${baseKey}.outer`)),
});
const buildTyrePosition = (req, prefix) => {
  const brandValue = trimOrEmpty(getBodyVal(req, `${prefix}.brandValue`));
  const brand = brandValue || trimOrEmpty(getBodyVal(req, `${prefix}.brand`));
  const modelValue = trimOrEmpty(getBodyVal(req, `${prefix}.modelValue`));
  const model = modelValue || trimOrEmpty(getBodyVal(req, `${prefix}.model`));
  const baseDepthKey = `${prefix}.treadDepth`;

  return {
    size: trimOrEmpty(getBodyVal(req, `${prefix}.size`)),
    pressure: toNum(getBodyVal(req, `${prefix}.pressure`)),
    brand,
    model,
    dot: trimOrEmpty(getBodyVal(req, `${prefix}.dot`)),
    treadDepth: buildTreadDepth(req, baseDepthKey),
    condition: getBodyVal(req, `${prefix}.condition`),
    notes: getBodyVal(req, `${prefix}.notes`),
    tags: toArr(getBodyVal(req, `${prefix}.tags`)),
  };
};

// ---------- Create ----------
export const createInspection = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).send("Login required");

    const accountId = accountIdFor(req);

    const code = await Inspection.generateUniqueCode();

    const payload = {
      user: accountId,                 // admin owns the document
      createdBy: req.user._id,         // who created (admin or technician)
      code,
      vrm: upperTrim(getBodyVal(req, "vrm")),
      mileage: toNum(getBodyVal(req, "mileage")),
      notes: getBodyVal(req, "notes"),
      offside: {
        front: buildTyrePosition(req, "offside.front"),
        rear: buildTyrePosition(req, "offside.rear"),
      },
      nearside: {
        front: buildTyrePosition(req, "nearside.front"),
        rear: buildTyrePosition(req, "nearside.rear"),
      },
    };

    const doc = await Inspection.create(payload);

    // implicit VRM usage logging (once per day per VRM); bill to admin account
    try {
      const vrm = (doc.vrm || "").toUpperCase().trim();
      if (vrm) {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
        const exists = await UsageEvent.exists({
          billedTo: accountId,
          user: req.user._id,
          type: "vrm_lookup",
          "meta.vrm": vrm,
          createdAt: { $gte: start, $lt: end },
        });
        if (!exists) {
          await UsageEvent.create({
            billedTo: accountId,
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

// ---------- EDIT (admin-only form) ----------
export const editInspectionForm = async (req, res) => {
  try {
    // Admin-only: routes enforce requireAdmin, but double-check below by ownership
    const accountId = accountIdFor(req);
    const { id } = req.params;

    const doc = await Inspection.findOne({ _id: id, user: accountId }).lean();
    if (!doc) return res.status(404).send("Inspection not found");

    res.render("inspections/edit", {
      title: "Edit Inspection — Tyre Inspector",
      inspection: doc,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};

// ---------- UPDATE (admin-only) ----------
export const updateInspection = async (req, res) => {
  try {
    const accountId = accountIdFor(req);
    const { id } = req.params;

    const existing = await Inspection.findOne({ _id: id, user: accountId });
    if (!existing) return res.status(404).send("Inspection not found");

    const updates = {
      vrm: upperTrim(getBodyVal(req, "vrm")),
      mileage: toNum(getBodyVal(req, "mileage")),
      notes: getBodyVal(req, "notes"),
      offside: {
        front: buildTyrePosition(req, "offside.front"),
        rear: buildTyrePosition(req, "offside.rear"),
      },
      nearside: {
        front: buildTyrePosition(req, "nearside.front"),
        rear: buildTyrePosition(req, "nearside.rear"),
      },
    };

    // Keep share code & ownership unchanged
    await Inspection.updateOne({ _id: existing._id }, { $set: updates });

    // Redirect back to index with a small success hint (no flash dependency)
    const backTo = `/inspections?updated=${encodeURIComponent(existing.code)}`;
    return res.redirect(backTo);
  } catch (e) {
    console.error(e);
    return res.status(500).send("Failed to update inspection");
  }
};

// --- DELETE inspection (by _id) ---
export const deleteInspection = async (req, res) => {
  try {
    const accountId = accountIdFor(req);
    const { id } = req.params;

    // Only delete documents owned by the admin account
    const doc = await Inspection.findOne({ _id: id, user: accountId });
    if (!doc) return res.status(404).send("Not found");

    const code = doc.code;
    await doc.deleteOne();

    // Fire an event for toast & counter updates
    res.setHeader("HX-Trigger", JSON.stringify({ inspectionDeleted: { id, code } }));

    return res.status(200).send("");
  } catch (err) {
    console.error("deleteInspection failed", err);
    return res.status(500).send("Failed to delete inspection");
  }
};
