// /public/js/ui.js
(function () {
  function setupModal(root, overlaySel, panelSel, closeSel) {
    if (!root) return null;
    const overlay = root.querySelector(overlaySel);
    const panel = root.querySelector(panelSel);
    const closers = root.querySelectorAll(closeSel);

    function open() {
      root.classList.remove('hidden');
      requestAnimationFrame(() => {
        overlay?.classList?.remove('opacity-0');
        panel?.classList?.remove('opacity-0', 'translate-y-4');
        panel?.focus();
      });
      document.addEventListener('keydown', trapFocus);
    }
    function close() {
      overlay?.classList?.add('opacity-0');
      panel?.classList?.add('opacity-0', 'translate-y-4');
      setTimeout(() => {
        root.classList.add('hidden');
        document.removeEventListener('keydown', trapFocus);
      }, 150);
    }
    function trapFocus(e) {
      if (root.classList.contains('hidden') || e.key !== 'Tab') return;
      const focusables = panel.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    overlay?.addEventListener('click', close);
    closers.forEach(c => c.addEventListener('click', close));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.classList.contains('hidden')) close(); });

    return { open, close, root, panel };
  }

  function initFiltersModal() {
    const modal = document.getElementById('filtersModal');
    const api = setupModal(modal, '[data-filters-overlay]', '[data-filters-panel]', '[data-close-filters]');
    if (!api) return;
    document.querySelectorAll('[data-open-filters]').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); api.open(); });
    });
  }

  function initVrmModal() {
    const modal = document.getElementById('vrmModal');
    const api = setupModal(modal, '[data-modal-overlay]', '[data-modal-panel]', '[data-close-modal]');
    if (!api) return;

    const openers = document.querySelectorAll('[data-open-modal]');
    openers.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); api.open(); }));

    const vrmInput = document.getElementById('vrmInput');
    const vrmForm = document.getElementById('vrmForm');
    const vrmError = document.getElementById('vrmError');

    // Uppercase VRM while typing (preserve caret)
    document.addEventListener('input', (e) => {
      if (e.target === vrmInput) {
        const { selectionStart, selectionEnd, value } = e.target;
        const upper = value.toUpperCase();
        if (upper !== value) { e.target.value = upper; e.target.setSelectionRange(selectionStart, selectionEnd); }
      }
    });

    // HTMX indicators (only if htmx is present on the page)
    if (vrmForm && window.htmx) {
      document.body.addEventListener('htmx:beforeRequest', (evt) => {
        if (evt.target === vrmForm) {
          vrmForm.querySelector('.htmx-indicator')?.classList.remove('hidden');
          vrmError?.classList.add('hidden');
          if (vrmError) vrmError.textContent = '';
        }
      });
      document.body.addEventListener('htmx:afterOnLoad', (evt) => {
        if (evt.target === vrmForm) {
          vrmForm.querySelector('.htmx-indicator')?.classList.add('hidden');
        }
      });
      document.body.addEventListener('htmx:responseError', (evt) => {
        if (evt.target === vrmForm) {
          vrmForm.querySelector('.htmx-indicator')?.classList.add('hidden');
          if (vrmError) {
            vrmError.classList.remove('hidden');
            vrmError.textContent = "We couldn’t fetch data right now. Please check the VRM and try again.";
          }
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initFiltersModal();
    initVrmModal();
  });
})();
