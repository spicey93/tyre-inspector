// /public/js/inspection-form.js
(function () {
  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  // Load models for a brand into a datalist
  async function loadModels(brand, datalistEl) {
    if (!datalistEl) return;
    datalistEl.innerHTML = "";
    if (!brand) return;
    try {
      const url = `/inspections/api/tyres/models?brand=${encodeURIComponent(brand)}`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) return;
      const models = await res.json();
      (models || []).forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        datalistEl.appendChild(opt);
      });
    } catch { /* ignore network errors */ }
  }

  // Wire brand->models for every tyre group on the form
  function setupBrandModelLinks() {
    $all("[data-tyre-group]").forEach(group => {
      const brandInput = $("[data-brand-input]", group);
      const modelDatalist = $("[data-model-datalist]", group);
      if (!brandInput || !modelDatalist) return;

      // initial
      loadModels(brandInput.value, modelDatalist);

      // on change (input to capture datalist value as well)
      brandInput.addEventListener("input", () => {
        loadModels(brandInput.value, modelDatalist);
      });
    });
  }

  // Simple "add another tag" mechanism (multiple inputs with same name)
  function setupTags() {
    $all("[data-tags-root]").forEach(root => {
      const addBtn = $("[data-add-tag]", root);
      const list = $("[data-tags-list]", root);
      const name = root.getAttribute("data-tags-root");

      function addTag(value = "") {
        const wrap = document.createElement("div");
        wrap.className = "flex items-center gap-2";
        wrap.innerHTML = `
          <input name="${name}" value="${value}" class="mt-1 flex-1 rounded-lg border border-slate-300 px-3 py-2" />
          <button type="button" class="inline-flex items-center rounded-md border px-2 py-2 text-slate-600 hover:bg-slate-50" title="Remove">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        `;
        const removeBtn = wrap.lastElementChild;
        removeBtn.addEventListener("click", () => wrap.remove());
        list.appendChild(wrap);
      }

      addBtn?.addEventListener("click", () => addTag(""));
      // If there are zero inputs at load, seed one (optional tags)
      if (!list.querySelector("input")) addTag("");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupBrandModelLinks();
    setupTags();
  });
})();
