// utils/inspectionViewModel.js

const fmt = (v) => (v ?? "") === "" ? "—" : v;

const rank = (c) => (c === "fail" ? 3 : c === "advisory" ? 2 : c === "ok" ? 1 : 0);

const worstOf = (a, b) => {
  const ra = rank(a), rb = rank(b);
  if (ra === 0 && rb === 0) return "—";
  return rb > ra ? b : a;
};

const deriveFromData = (node) => {
  const tags = Array.isArray(node?.tags) ? node.tags : [];
  const failTags = new Set(["Bulge", "Cord exposed", "Puncture"]);
  const advTags = new Set([
    "Perished",
    "Cracked sidewall",
    "Uneven wear",
    "Bald on inner edge",
    "Bald on outer edge",
  ]);

  let tagCond = null;
  if (tags.some((t) => failTags.has(String(t)))) tagCond = "fail";
  else if (tags.some((t) => advTags.has(String(t)))) tagCond = "advisory";

  const t = node?.treadDepth || {};
  const vals = [t.inner, t.middle, t.outer]
    .map(Number)
    .filter((n) => !isNaN(n));
  let treadCond = null;
  if (vals.length) {
    if (vals.some((v) => v < 3)) treadCond = "fail";
    else if (vals.some((v) => v < 4)) treadCond = "advisory";
    else treadCond = "ok";
  }

  if (!tagCond && !treadCond) return "—";
  if (tagCond && !treadCond) return tagCond;
  if (!tagCond && treadCond) return treadCond;
  return worstOf(tagCond, treadCond);
};

const finalCondition = (node) => {
  const explicit = node?.condition ? String(node.condition).toLowerCase() : null;
  const derived = deriveFromData(node);
  if (!explicit && derived !== "—") return derived;
  if (explicit && derived === "—") return explicit;
  if (!explicit && derived === "—") return "—";
  return worstOf(explicit, derived);
};

const classForWheel = (cond) =>
  cond === "ok" ? "ok" : cond === "advisory" ? "adv" : cond === "fail" ? "fail" : "";

const hasTag = (t, name) =>
  Array.isArray(t?.tags) &&
  t.tags.some((s) => String(s).toLowerCase() === String(name).toLowerCase());

const tagAdvice = (t) => {
  const out = [];
  if (hasTag(t, "Bulge"))
    out.push({
      why: "Sidewall bulge present (risk of blowout).",
      action: "Replace immediately; do not drive at speed.",
    });
  if (hasTag(t, "Cord exposed"))
    out.push({
      why: "Cord exposed — tyre is beyond legal/safe use.",
      action: "Replace immediately.",
    });
  if (hasTag(t, "Puncture"))
    out.push({
      why: "Puncture noted.",
      action:
        "Repair if within the repairable zone and size; otherwise replace.",
    });
  if (hasTag(t, "Perished") || hasTag(t, "Cracked sidewall"))
    out.push({
      why: "Perishing/cracked rubber (age/UV/ozone).",
      action: "Replace soon; aged tyres can fail unexpectedly.",
    });
  if (hasTag(t, "Uneven wear"))
    out.push({
      why: "Uneven tread wear observed.",
      action:
        "Check wheel alignment and suspension joints; rotate tyres if pattern allows.",
    });
  if (hasTag(t, "Bald on inner edge"))
    out.push({
      why: "Inner-edge wear pattern.",
      action:
        "Check alignment (camber/toe), bushings and tyre pressures.",
    });
  if (hasTag(t, "Bald on outer edge"))
    out.push({
      why: "Outer-edge wear pattern.",
      action:
        "Check alignment and under-inflation; driving style (cornering) may contribute.",
    });
  return out;
};

const treadFindings = (t) => {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const di = n(t?.treadDepth?.inner),
    dm = n(t?.treadDepth?.middle),
    do_ = n(t?.treadDepth?.outer);
  const vals = [di, dm, do_].filter((v) => v != null);
  if (!vals.length) return { bullets: [], minDepth: null };

  const minDepth = Math.min(...vals);
  const bullets = [];
  const TH = 0.8;

  if (di != null && dm != null && do_ != null) {
    if (dm + TH <= di && dm + TH <= do_) {
      bullets.push({
        why: "Centre more worn than edges.",
        cause: "Likely over-inflation.",
        action: "Set pressures to spec and re-check regularly.",
      });
    } else if (
      (di + TH <= dm && di + TH <= do_) ||
      (do_ + TH <= dm && do_ + TH <= di)
    ) {
      const which =
        di + TH <= dm && di + TH <= do_ ? "inner edge" : "outer edge";
      bullets.push({
        why: `More wear on ${which}.`,
        cause: "Likely alignment (camber/toe) or pressure issue.",
        action: "Book wheel alignment; check suspension and pressures.",
      });
    } else if (Math.max(di, dm, do_) - Math.min(di, dm, do_) >= TH) {
      bullets.push({
        why: "Noticeable uneven wear across the tyre.",
        cause: "Possible alignment/rotation/balance issue.",
        action: "Inspect alignment and rotation pattern.",
      });
    }
  }

  if (minDepth < 3)
    bullets.push({
      why: `Tread at ${minDepth.toFixed(1)}mm.`,
      cause: "Below safe threshold.",
      action: "Replace now.",
    });
  else if (minDepth < 4)
    bullets.push({
      why: `Tread at ${minDepth.toFixed(1)}mm.`,
      cause: "Approaching limit.",
      action: "Plan replacement soon.",
    });

  return { bullets, minDepth };
};

const summariseTyre = (pos, t) => {
  const cond = finalCondition(t);
  const tFind = treadFindings(t);
  const tagFinds = tagAdvice(t);

  const reasons = [];
  const actions = new Set();

  tagFinds.forEach((x) => {
    reasons.push(x.why);
    actions.add(x.action);
  });
  tFind.bullets.forEach((b) => {
    const r = [b.why, b.cause].filter(Boolean).join(" — ");
    reasons.push(r);
    if (b.action) actions.add(b.action);
  });

  if (!reasons.length && (cond === "fail" || cond === "advisory")) {
    reasons.push(`Marked as ${cond}.`);
  }

  return {
    pos,
    cond,
    minDepth: tFind.minDepth,
    reasons,
    actions: Array.from(actions),
    replace: cond === "fail",
    plan: cond === "advisory",
  };
};

export function buildInspectionVM(inspection, vehicle) {
  const createdAtStr = inspection.createdAt
    ? new Date(inspection.createdAt).toLocaleString()
    : null;

  let vehicleLine = "";
  if (vehicle) {
    vehicleLine = `${vehicle.make || ""} ${vehicle.model || ""}`.trim();
    if (vehicle.year) vehicleLine += ` (${vehicle.year})`;
  }

  const tyres = {
    "Offside Front (OSF)": inspection.offside?.front || {},
    "Nearside Front (NSF)": inspection.nearside?.front || {},
    "Offside Rear (OSR)": inspection.offside?.rear || {},
    "Nearside Rear (NSR)": inspection.nearside?.rear || {},
  };

  const wheelPos = [
    { k: "OSF", label: "Offside Front (OSF)", left: "86%", top: "19%" },
    { k: "NSF", label: "Nearside Front (NSF)", left: "14%", top: "19%" },
    { k: "OSR", label: "Offside Rear (OSR)", left: "86%", top: "81%" },
    { k: "NSR", label: "Nearside Rear (NSR)", left: "14%", top: "81%" },
  ];

  const tyresList = Object.entries(tyres).map(([pos, t]) => ({
    pos,
    t,
    cond: finalCondition(t),
    tagStr: Array.isArray(t?.tags) ? t.tags.join(", ") : "—",
    treadStr: `${fmt(t?.treadDepth?.inner)} / ${fmt(t?.treadDepth?.middle)} / ${fmt(
      t?.treadDepth?.outer
    )}`,
  }));

  const analyses = Object.entries(tyres).map(([pos, t]) => summariseTyre(pos, t));

  const counts = analyses.reduce(
    (a, x) => {
      a[x.cond ?? "—"] = (a[x.cond ?? "—"] || 0) + 1;
      return a;
    },
    { ok: 0, advisory: 0, fail: 0, "—": 0 }
  );

  const allDepths = analyses
    .map((a) => a.minDepth)
    .filter((d) => typeof d === "number");
  const minDepthOverall = allDepths.length ? Math.min(...allDepths) : null;

  const worst = analyses
    .map((a) => a.cond)
    .reduce((acc, v) => worstOf(acc, v), "—");
  const overallHeadline =
    worst === "fail"
      ? "One or more tyres need immediate replacement."
      : worst === "advisory"
      ? "Some tyres require attention soon."
      : worst === "ok"
      ? "All tyres OK at time of inspection."
      : "Tyre status not fully specified.";

  const needsAttention = analyses.filter(
    (a) => a.cond && a.cond !== "ok" && a.cond !== "—"
  );

  return {
    // helpers that views might still use
    fmt,
    finalCondition,
    classForWheel,

    // view data
    createdAtStr,
    vehicleLine,
    wheelPos,
    tyresList,
    analyses,
    needsAttention,
    counts,
    minDepthOverall,
    overallHeadline,

    inspection: { ...inspection, vehicle },
  };
}

export { fmt, finalCondition, classForWheel };
