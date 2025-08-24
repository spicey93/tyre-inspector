document.addEventListener("DOMContentLoaded", () => {
  // ===== Filters modal =====
  const fModal = document.getElementById("filtersModal");
  const fOverlay = fModal.querySelector("[data-filters-overlay]");
  const fPanel = fModal.querySelector("[data-filters-panel]");
  const fOpeners = document.querySelectorAll("[data-open-filters]");
  const fClosers = fModal.querySelectorAll("[data-close-filters]");

  fOpeners.forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openFilters();
    })
  );
  fClosers.forEach((btn) => btn.addEventListener("click", closeFilters));
  fOverlay.addEventListener("click", closeFilters);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !fModal.classList.contains("hidden"))
      closeFilters();
  });

  function openFilters() {
    fModal.classList.remove("hidden");
    requestAnimationFrame(() => {
      fOverlay.classList.remove("opacity-0");
      fPanel.classList.remove("opacity-0", "translate-y-4");
      fPanel.focus();
    });
    document.addEventListener("keydown", trapFiltersFocus);
  }
  function closeFilters() {
    fOverlay.classList.add("opacity-0");
    fPanel.classList.add("opacity-0", "translate-y-4");
    setTimeout(() => {
      fModal.classList.add("hidden");
      document.removeEventListener("keydown", trapFiltersFocus);
    }, 150);
  }
  function trapFiltersFocus(e) {
    if (fModal.classList.contains("hidden") || e.key !== "Tab") return;
    const focusables = fPanel.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0],
      last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ===== VRM modal (RESTORED) =====
  const modal = document.getElementById("vrmModal");
  const overlay = modal.querySelector("[data-modal-overlay]");
  const panel = modal.querySelector("[data-modal-panel]");
  const openers = document.querySelectorAll("[data-open-modal]");
  const closers = modal.querySelectorAll("[data-close-modal]");
  const vrmInput = document.getElementById("vrmInput");
  const vrmForm = document.getElementById("vrmForm");
  const vrmError = document.getElementById("vrmError");

  openers.forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    })
  );
  closers.forEach((btn) => btn.addEventListener("click", closeModal));
  overlay.addEventListener("click", closeModal);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  function openModal() {
    modal.classList.remove("hidden");
    requestAnimationFrame(() => {
      overlay.classList.remove("opacity-0");
      panel.classList.remove("opacity-0", "translate-y-4");
      panel.focus();
      setTimeout(() => vrmInput?.focus(), 120);
    });
    document.addEventListener("keydown", trapFocus);
  }
  function closeModal() {
    overlay.classList.add("opacity-0");
    panel.classList.add("opacity-0", "translate-y-4");
    setTimeout(() => {
      modal.classList.add("hidden");
      document.removeEventListener("keydown", trapFocus);
    }, 150);
  }
  function trapFocus(e) {
    if (modal.classList.contains("hidden") || e.key !== "Tab") return;
    const focusables = panel.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0],
      last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Uppercase VRM while typing (preserve caret)
  document.addEventListener("input", (e) => {
    if (e.target === vrmInput) {
      const { selectionStart, selectionEnd, value } = e.target;
      const upper = value.toUpperCase();
      if (upper !== value) {
        e.target.value = upper;
        e.target.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  });

  // HTMX states for VRM lookup
  document.body.addEventListener("htmx:beforeRequest", (evt) => {
    if (evt.target === vrmForm) {
      vrmForm.querySelector(".htmx-indicator")?.classList.remove("hidden");
      vrmError?.classList.add("hidden");
      if (vrmError) vrmError.textContent = "";
    }
  });
  document.body.addEventListener("htmx:afterOnLoad", (evt) => {
    if (evt.target === vrmForm) {
      vrmForm.querySelector(".htmx-indicator")?.classList.add("hidden");
    }
  });
  document.body.addEventListener("htmx:responseError", (evt) => {
    if (evt.target === vrmForm) {
      vrmForm.querySelector(".htmx-indicator")?.classList.add("hidden");
      if (vrmError) {
        vrmError.classList.remove("hidden");
        vrmError.textContent =
          "We couldn’t fetch data right now. Please check the VRM and try again.";
      }
    }
  });
});
