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

// ---------- LIST (index) ----------
export const indexInspections = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = 15;
    const skip = (page - 1) * limit;

    const search = trimOrEmpty(req.query.search || "");
    const from = trimOrEmpty(req.query.from || "");
    const to = trimOrEmpty(req.query.to || "");

    // Technicians should only ever see their own inspections.
    // Admins see everything **owned by their account** (including work created by technicians).
    // This assumes inspection.user is always the admin/owner account id.
    const q =
      req.user.role === "admin"
        ? { user: req.user._id }
        : { createdBy: req.user._id, user: req.user.owner || req.user._id };

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

    // If a technician is logged in, they may only view inspections they created.
    if (req.user && req.user.role === "technician") {
      const createdByTech = String(inspection.createdBy) === String(req.user._id);
      if (!createdByTech) {
        // Mask existence to avoid leaking information.
        return res.status(404).send("Inspection not found");
      }
    }

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

// ---------- Create ----------
export const createInspection = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).send("Login required");

    // Work out the billing account (admin) and the actor (admin or technician)
    const isTech = req.user.role === "technician" && req.user.owner;
    const accountId = isTech ? req.user.owner : req.user._id; // the admin account that owns/bills
    const actorId = req.user._id;

    const code = await Inspection.generateUniqueCode();

    const getBody = (key) => req.body?.[key];
    const buildTreadDepth = (baseKey) => ({
      inner: toNum(getBody(`${baseKey}.inner`)),
      middle: toNum(getBody(`${baseKey}.middle`)),
      outer: toNum(getBody(`${baseKey}.outer`)),
    });
    const buildTyrePosition = (prefix) => {
      const brandValue = trimOrEmpty(getBody(`${prefix}.brandValue`));
      const brand = brandValue || trimOrEmpty(getBody(`${prefix}.brand`));
      const modelValue = trimOrEmpty(getBody(`${prefix}.modelValue`));
      const model = modelValue || trimOrEmpty(getBody(`${prefix}.model`));
      const baseDepthKey = `${prefix}.treadDepth`;

      return {
        size: trimOrEmpty(getBody(`${prefix}.size`)),
        pressure: toNum(getBody(`${prefix}.pressure`)),
        brand,
        model,
        dot: trimOrEmpty(getBody(`${prefix}.dot`)),
        treadDepth: buildTreadDepth(baseDepthKey),
        condition: getBody(`${prefix}.condition`),
        notes: getBody(`${prefix}.notes`),
        tags: toArr(getBody(`${prefix}.tags`)),
      };
    };

    const payload = {
      // OWNER is always the admin account
      user: accountId,
      // Who created it (admin or technician)
      createdBy: actorId,
      code,
      vrm: upperTrim(getBody("vrm")),
      mileage: toNum(getBody("mileage")),
      notes: getBody("notes"),
      offside: {
        front: buildTyrePosition("offside.front"),
        rear: buildTyrePosition("offside.rear"),
      },
      nearside: {
        front: buildTyrePosition("nearside.front"),
        rear: buildTyrePosition("nearside.rear"),
      },
    };

    const doc = await Inspection.create(payload);

    // implicit VRM usage logging (once per day per VRM **per actor**) + bill to admin pool
    try {
      const vrm = (doc.vrm || "").toUpperCase().trim();
      if (vrm) {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
        const exists = await UsageEvent.exists({
          user: actorId,
          type: "vrm_lookup",
          "meta.vrm": vrm,
          createdAt: { $gte: start, $lt: end },
        });
        if (!exists) {
          await UsageEvent.create({
            user: actorId,
            billedTo: accountId,
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
    // Technicians are read-only: no delete.
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).send("Forbidden");
    }

    const { id } = req.params;

    // Only delete documents owned by the current user (admin)
    const doc = await Inspection.findOne({ _id: id, user: req.user._id });
    if (!doc) return res.status(404).send("Not found");

    const code = doc.code;
    await doc.deleteOne();

    // Fire an event for toast & counter updates
    res.setHeader("HX-Trigger", JSON.stringify({ inspectionDeleted: { id, code } }));

    // Return 200 with empty body so hx-target="closest tr" + hx-swap="outerHTML" removes the row
    return res.status(200).send("");
  } catch (err) {
    console.error("deleteInspection failed", err);
    return res.status(500).send("Failed to delete inspection");
  }
};
