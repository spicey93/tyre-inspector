// =========================
// Tyre Inspector — Page JS
// =========================

// ---------- Config / constants ----------
var PATHS = {
  osf: "offside.front",
  nsf: "nearside.front",
  osr: "offside.rear",
  nsr: "nearside.rear",
};

var FAIL_TAGS = new Set(["Bulge", "Cord exposed", "Puncture"]);
var ADV_TAGS = new Set([
  "Perished",
  "Cracked sidewall",
  "Uneven wear",
  "Bald on inner edge",
  "Bald on outer edge",
]);

// ---------- Small helpers ----------
function isLarge() {
  return window.matchMedia("(min-width: 1024px)").matches;
}
function isNum(v) {
  return v !== "" && !isNaN(Number(v));
}
function filled(v) {
  return v != null && String(v).trim() !== "";
}
function q(name) {
  return document.querySelector('[name="' + name + '"]');
}
function $(sel, root) {
  return (root || document).querySelector(sel);
}
function $all(sel, root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(sel));
}

// ---------- API ----------
function fetchModels(brand) {
  if (!brand) return Promise.resolve([]);
  return fetch(
    "/inspections/api/tyres/models?brand=" + encodeURIComponent(brand)
  )
    .then(function (res) {
      return res.json();
    })
    .catch(function () {
      return [];
    });
}

// Populate the model datalist for a given panel key
function setModelOptionsFor(key, models) {
  var list = $("#models-" + key);
  if (!list) return;
  list.innerHTML = "";
  (models || []).forEach(function (m) {
    var opt = document.createElement("option");
    opt.value = m;
    list.appendChild(opt);
  });
}

// ---------- Completion & condition ----------
function hasAllTreads(path) {
  var i = q(path + ".treadDepth.inner");
  i = i ? i.value : "";
  var m = q(path + ".treadDepth.middle");
  m = m ? m.value : "";
  var o = q(path + ".treadDepth.outer");
  o = o ? o.value : "";
  return isNum(i) && isNum(m) && isNum(o);
}

function tyreComplete(path) {
  var size = q(path + ".size");
  size = size ? size.value : "";
  var brand = q(path + ".brand");
  brand = brand ? brand.value : "";
  var model = q(path + ".model");
  model = model ? model.value : "";
  return filled(size) && filled(brand) && filled(model) && hasAllTreads(path);
}

function readTagsFor(path) {
  var safe = path.replace(/\./g, "\\.");
  var inputs = document.querySelectorAll('input[name="' + safe + '.tags"]');
  var out = [];
  for (var i = 0; i < inputs.length; i++) {
    if (inputs[i].checked) out.push(inputs[i].value);
  }
  return out;
}

function determineCondition(path) {
  var tags = readTagsFor(path);
  for (var i = 0; i < tags.length; i++) {
    if (FAIL_TAGS.has(tags[i])) return "fail";
  }
  var advFromTags = tags.some(function (t) {
    return ADV_TAGS.has(t);
  });

  var iv = q(path + ".treadDepth.inner");
  iv = iv ? Number(iv.value) : NaN;
  var mv = q(path + ".treadDepth.middle");
  mv = mv ? Number(mv.value) : NaN;
  var ov = q(path + ".treadDepth.outer");
  ov = ov ? Number(ov.value) : NaN;
  var vals = [];
  if (!isNaN(iv)) vals.push(iv);
  if (!isNaN(mv)) vals.push(mv);
  if (!isNaN(ov)) vals.push(ov);

  if (vals.length) {
    if (
      vals.some(function (v) {
        return v < 3;
      })
    )
      return "fail";
    if (
      vals.some(function (v) {
        return v < 4;
      })
    )
      return "advisory";
  }
  if (advFromTags) return "advisory";
  return "ok";
}

function applyWheelColour(key) {
  var el = document.querySelector('.wheel-hotspot[data-key="' + key + '"]');
  if (!el) return;
  el.classList.remove("cond-ok", "cond-adv", "cond-fail");
  if (tyreComplete(PATHS[key])) {
    var c = determineCondition(PATHS[key]);
    if (c === "ok") el.classList.add("cond-ok");
    else if (c === "advisory") el.classList.add("cond-adv");
    else if (c === "fail") el.classList.add("cond-fail");
  }
}

function markWheel(key) {
  applyWheelColour(key);
  updateReviewList();
  updateSaveVisibility();
}

var saveCueShown = false;

function setBadgeEl(el, text, tone) {
  // tone: "pending" | "ok" | "advisory" | "fail"
  var cls =
    {
      pending: "bg-slate-100 text-slate-700",
      ok: "bg-emerald-100 text-emerald-800",
      advisory: "bg-amber-100 text-amber-800",
      fail: "bg-rose-100 text-rose-800",
    }[tone] || "bg-slate-100 text-slate-700";

  el.className =
    "badge inline-flex items-center rounded-full px-2 py-0.5 text-xs " + cls;
  el.textContent = text;
}

function updateReviewList() {
  Object.keys(PATHS).forEach(function (key) {
    var li = $("#review-" + key);
    if (!li) return;
    var badge = li.querySelector(".badge");
    var done = tyreComplete(PATHS[key]);
    if (!done) {
      setBadgeEl(badge, "Pending", "pending");
    } else {
      var c = determineCondition(PATHS[key]); // "ok" | "advisory" | "fail"
      var label = c === "ok" ? "OK" : c === "advisory" ? "Advisory" : "Fail";
      setBadgeEl(
        badge,
        label,
        c === "ok" ? "ok" : c === "advisory" ? "advisory" : "fail"
      );
    }
  });
}

function updateSaveVisibility() {
  var keys = Object.keys(PATHS);
  var allDone = keys.every(function (k) {
    return tyreComplete(PATHS[k]);
  });
  var nb = $("#notes-block");
  var sb = $("#save-block");
  var sticky = $("#save-sticky");
  var banner = $("#complete-banner");

  if (nb) nb.classList.toggle("hidden", !allDone);
  if (sb) sb.classList.toggle("hidden", !allDone);
  if (sticky) sticky.classList.toggle("hidden", !allDone);
  if (banner) banner.classList.toggle("hidden", !allDone);

  // Desktop save button enable/disable
  var dBtn = $("#desktop-save-btn");
  var hint = $("#desktop-save-hint");
  if (dBtn) {
    dBtn.disabled = !allDone;
    dBtn.classList.toggle("cursor-not-allowed", !allDone);
    dBtn.classList.toggle("bg-emerald-600/50", !allDone);
    dBtn.classList.toggle("bg-emerald-600", allDone);
    dBtn.classList.toggle("hover:bg-emerald-700", allDone);
    if (hint) hint.classList.toggle("hidden", allDone);
  }

  if (nb) {
    nb.classList.toggle("ring-2", allDone);
    nb.classList.toggle("ring-emerald-300", allDone);
    nb.classList.toggle("shadow", allDone);
  }

  if (allDone && !saveCueShown) {
    saveCueShown = true;
    setTimeout(function () {
      if (isLarge()) {
        var aside = $("#review-aside");
        if (aside)
          aside.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        (banner || nb || sb).scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 150);
  }
}

// ---------- Panels / navigation ----------
function showPanel(key) {
  document.querySelectorAll('section[id^="panel-"]').forEach(function (s) {
    s.classList.add("hidden");
  });
  var panel = $("#panel-" + key);
  if (panel) panel.classList.remove("hidden");

  document.querySelectorAll(".wheel-hotspot").forEach(function (h) {
    h.classList.remove("active");
  });
  var spot = document.querySelector('.wheel-hotspot[data-key="' + key + '"]');
  if (spot) spot.classList.add("active");

  if (!isLarge()) {
    var pick = $("#pick-screen");
    if (pick) pick.classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function bindWheelClicks() {
  $all(".wheel-hotspot").forEach(function (btn) {
    var go = function () {
      showPanel(btn.dataset.key);
    };
    btn.addEventListener("click", go);
    btn.addEventListener(
      "touchstart",
      function (e) {
        e.preventDefault();
        go();
      },
      { passive: false }
    );
  });
}

// ---------- Autocomplete (brand/model) ----------
var brandDebounceTimers = Object.create(null);

function bindBrandAutocomplete() {
  document.addEventListener("input", function (e) {
    if (!e.target.classList.contains("brand-input")) return;
    var key = e.target.getAttribute("data-tyre-key");
    var brand = e.target.value.trim();
    clearTimeout(brandDebounceTimers[key]);
    brandDebounceTimers[key] = setTimeout(function () {
      if (!brand) {
        setModelOptionsFor(key, []);
        return;
      }
      fetchModels(brand).then(function (models) {
        setModelOptionsFor(key, models);
      });
    }, 250);
  });

  document.addEventListener("change", function (e) {
    if (!e.target.classList.contains("brand-input")) return;
    var key = e.target.getAttribute("data-tyre-key");
    var brand = e.target.value.trim();
    if (!brand) {
      setModelOptionsFor(key, []);
      return;
    }
    fetchModels(brand).then(function (models) {
      setModelOptionsFor(key, models);
    });
  });
}

// ---------- Track inputs (brand/model/size/dot/treads) ----------
function bindFieldTracking() {
  $all(".tyre-field").forEach(function (el) {
    el.addEventListener("input", function (e) {
      var key = e.target.getAttribute("data-tyre-key");
      if (key) markWheel(key);
    });
    el.addEventListener("change", function (e) {
      var key = e.target.getAttribute("data-tyre-key");
      if (key) markWheel(key);
    });
  });
}

// Auto-fill treads if one chosen and the others blank (per panel)
function bindTreadAutofill() {
  $all('section[id^="panel-"]').forEach(function (panel) {
    var selects = panel.querySelectorAll(
      'select[name$="treadDepth.inner"], select[name$="treadDepth.middle"], select[name$="treadDepth.outer"]'
    );
    selects.forEach(function (sel) {
      sel.addEventListener("change", function () {
        if (!sel.value) return;
        selects.forEach(function (other) {
          if (other !== sel && !other.value) other.value = sel.value;
        });
        var key = panel.id.replace("panel-", "");
        markWheel(key);
      });
    });
  });
}

// ---------- Tags (chips) ----------
function bindTagChips() {
  $all(".chip").forEach(function (ch) {
    ch.addEventListener("click", function (e) {
      var input = ch.querySelector(".tag-input");
      if (!input) return;
      input.checked = !input.checked;
      ch.classList.toggle("active", input.checked);
      var panel = ch.closest('section[id^="panel-"]');
      var key = panel ? panel.id.replace("panel-", "") : null;
      if (key) markWheel(key);
      e.preventDefault();
    });
  });
}

// ---------- Single header "Copy to others" ----------
function hasAllTreadsPath(path) {
  var i = q(path + ".treadDepth.inner");
  i = i ? i.value : "";
  var m = q(path + ".treadDepth.middle");
  m = m ? m.value : "";
  var o = q(path + ".treadDepth.outer");
  o = o ? o.value : "";
  return isNum(i) && isNum(m) && isNum(o);
}

function bindCopyCore() {
  function copyCoreFrom(fromKey) {
    var src = PATHS[fromKey];
    var sizeI = q(src + ".size");
    var size = sizeI ? sizeI.value : "";
    var dotI = q(src + ".dot");
    var dot = dotI ? dotI.value : "";
    var brI = q(src + ".brand");
    var brand = brI ? brI.value : "";
    var moI = q(src + ".model");
    var model = moI ? moI.value : "";

    var flashed = [];

    function doOne(k, p) {
      if (k === fromKey) return Promise.resolve();
      // Only copy to wheels that do NOT already have all tread depths filled
      if (hasAllTreadsPath(p)) return Promise.resolve();

      // Size: only copy if target size is empty (do not overwrite)
      var sEl = q(p + ".size");
      if (sEl && !sEl.value) sEl.value = size;

      // DOT: overwrite
      var dEl = q(p + ".dot");
      if (dEl) dEl.value = dot;

      // Brand & Model (autocomplete inputs)
      var bIn = q(p + ".brand");
      var mIn = q(p + ".model");

      function afterModels(models) {
        setModelOptionsFor(k, models || []);
        if (mIn && model) mIn.value = model; // set typed model
      }

      var brandPromise = Promise.resolve();
      if (bIn) {
        if (brand) bIn.value = brand;
        if (bIn.value) {
          brandPromise = fetchModels(bIn.value).then(afterModels);
        } else {
          afterModels([]);
        }
      }

      var hotspot = document.querySelector(
        '.wheel-hotspot[data-key="' + k + '"]'
      );
      if (hotspot) {
        hotspot.classList.add("flash-updated");
        flashed.push(hotspot);
      }

      markWheel(k);
      return brandPromise;
    }

    var chain = Promise.resolve();
    Object.keys(PATHS).forEach(function (k) {
      chain = chain.then(function () {
        return doOne(k, PATHS[k]);
      });
    });

    return chain.then(function () {
      setTimeout(function () {
        flashed.forEach(function (h) {
          h.classList.remove("flash-updated");
        });
      }, 700);
    });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-copy-all-from]");
    if (!btn) return;
    var fromKey = btn.getAttribute("data-copy-all-from");
    btn.disabled = true;

    copyCoreFrom(fromKey).then(function () {
      var pill = $("#copy-pill-" + fromKey);
      if (pill) {
        pill.textContent = "Copied!";
        pill.classList.remove("hidden");
        setTimeout(function () {
          pill.classList.add("hidden");
        }, 1300);
      }
      btn.classList.add("bg-slate-100");
      setTimeout(function () {
        btn.classList.remove("bg-slate-100");
        btn.disabled = false;
      }, 300);
    });
  });
}

// ---------- Notes proxy sync (desktop aside <-> real field) ----------
function bindNotesSync() {
  var real = $("#notes");
  var proxy = $("#notes-proxy");
  if (!proxy) return; // desktop only UI; real may be offscreen (mobile only container)
  // Ensure real exists; if not (on desktop), create a hidden one so form posts notes
  if (!real) {
    real = document.createElement("textarea");
    real.id = "notes";
    real.name = "notes";
    real.className = "hidden";
    $("#inspection-form").appendChild(real);
  }
  proxy.value = real.value || "";
  proxy.addEventListener("input", function () {
    real.value = proxy.value;
  });
  real.addEventListener("input", function () {
    proxy.value = real.value;
  });
}

// ---------- Mobile Save: hide form, show car ----------
function bindMobileSave() {
  $all("[data-save-back]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-save-back");
      markWheel(key);
      if (!isLarge()) {
        var panel = $("#panel-" + key);
        if (panel) panel.classList.add("hidden");
        var pick = $("#pick-screen");
        if (pick) pick.classList.remove("hidden");
        $all(".wheel-hotspot").forEach(function (h) {
          h.classList.remove("active");
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });
}

// ---------- Init ----------
function initTyreInspector() {
  bindBrandAutocomplete();
  bindWheelClicks();
  bindFieldTracking();
  bindTreadAutofill();
  bindTagChips();
  bindCopyCore();
  bindMobileSave();
  bindNotesSync();

  // Initial state
  Object.keys(PATHS).forEach(function (k) {
    applyWheelColour(k);
  });
  updateReviewList();
  updateSaveVisibility();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTyreInspector);
} else {
  initTyreInspector();
}
