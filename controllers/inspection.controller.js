import { body, validationResult } from "express-validator";
import Inspection from "../models/inspection.model.js";

/** Helpers */
function isEmptyTyre(tyre) {
  if (!tyre || typeof tyre !== "object") return true;
  const td = tyre.treadDepth || {};
  const hasTD = td.inner || td.middle || td.outer;
  return !(
    (tyre.size && tyre.size.trim()) ||
    hasTD ||
    tyre.psi ||
    (tyre.brand && tyre.brand.trim()) ||
    (tyre.dot && tyre.dot.trim()) ||
    (tyre.notes && tyre.notes.trim()) ||
    (tyre.status && tyre.status.trim())
  );
}

function pruneEmptyTyres(tyres) {
  if (!tyres) return tyres;
  const slots = [
    ["nearside", "front"],
    ["nearside", "rear"],
    ["offside", "front"],
    ["offside", "rear"],
  ];
  for (const [side, pos] of slots) {
    if (tyres?.[side]?.[pos] && isEmptyTyre(tyres[side][pos])) {
      delete tyres[side][pos];
    }
  }
  // REMOVED: spare
  return tyres;
}

/** Validation for POST /inspections */
export const validateInspection = [
  body("vrm").trim().notEmpty().withMessage("VRM is required."),
  body("mileage").optional().trim(),
  body("notes").optional().trim(),

  // NEW: Tyre size validation (lenient; accepts with/without load/speed)
  ...["nearside.front", "nearside.rear", "offside.front", "offside.rear"].map((k) =>
    body(`tyres.${k}.size`)
      .optional({ values: "falsy" })
      .matches(/^\d{3}\/\d{2}\s*R\d{2}(?:\s*\d{2,3}[A-Z])?$/i)
      .withMessage("Tyre size must look like 205/55 R16 91V")
  ),

  // DOT last-4 (WWYY)
  body([
    "tyres.nearside.front.dot",
    "tyres.nearside.rear.dot",
    "tyres.offside.front.dot",
    "tyres.offside.rear.dot",
  ])
    .optional({ values: "falsy" })
    .isString()
    .matches(/^(0[1-9]|[1-4][0-9]|5[0-3])[0-9]{2}$/)
    .withMessage("DOT must be 4 digits: week 01–53 + year (e.g., 0523)."),

  // Numbers / enums
  ...["nearside.front", "nearside.rear", "offside.front", "offside.rear"].flatMap((k) => [
    body(`tyres.${k}.treadDepth.inner`).optional({ values: "falsy" }).isFloat({ min: 0 }).withMessage("Inner must be ≥ 0"),
    body(`tyres.${k}.treadDepth.middle`).optional({ values: "falsy" }).isFloat({ min: 0 }).withMessage("Middle must be ≥ 0"),
    body(`tyres.${k}.treadDepth.outer`).optional({ values: "falsy" }).isFloat({ min: 0 }).withMessage("Outer must be ≥ 0"),
    body(`tyres.${k}.psi`).optional({ values: "falsy" }).isFloat({ min: 0 }).withMessage("PSI must be ≥ 0"),
    body(`tyres.${k}.brand`).optional().trim(),
    body(`tyres.${k}.notes`).optional().trim(),
    body(`tyres.${k}.status`)
      .optional({ values: "falsy" })
      .isIn(["Good", "Warning", "Bad"])
      .withMessage("Status must be Good, Warning, or Bad"),
  ]),
];

/** POST /inspections */
export async function createInspection(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render("inspections/new", {
      error: [...new Set(errors.array().map((e) => e.msg))].join("<br>"),
      data: req.body,
    });
  }

  try {
    if (req.body.tyres) req.body.tyres = pruneEmptyTyres(req.body.tyres);
    const doc = await Inspection.create(req.body);
    return res.redirect(`/inspections?code=${encodeURIComponent(doc.code)}`);
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.code) {
      return res.status(409).render("inspections/new", {
        error: "A collision occurred while generating the inspection code. Please submit again.",
        data: req.body,
      });
    }
    console.error("Failed to create inspection:", err);
    return res.status(500).render("inspections/new", {
      error: "Something went wrong creating the inspection.",
      data: req.body,
    });
  }
}

/** GET /inspections?code=XXXXXXXX */
export const getInspection = async (req, res) => {
  const raw = (req.query && req.query.code) || "";
  const code = (typeof raw === "string" ? raw.trim().toUpperCase() : "");
  if (!code) {
    return res.status(400).render("inspections/show", {
      error: "Missing inspection code.",
      inspection: null,
      code: "",
    });
  }

  try {
    const inspection = await Inspection.findOne({ code }).lean();
    if (!inspection) {
      return res.status(404).render("inspections/show", {
        error: `No inspection found for code "${code}".`,
        inspection: null,
        code,
      });
    }
    return res.render("inspections/show", { inspection, code: inspection.code });
  } catch (err) {
    console.error("Lookup failed:", err);
    return res.status(500).render("inspections/show", {
      error: "Something went wrong fetching the inspection.",
      inspection: null,
      code,
    });
  }
};
