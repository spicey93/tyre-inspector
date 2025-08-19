document.addEventListener('DOMContentLoaded', () => {
  // If we just created a doc, scroll its row into view for convenience
  (function(){
    const params = new URLSearchParams(location.search);
    const created = params.get('created');
    if (!created) return;
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    const row = rows.find(tr => tr.firstElementChild?.textContent?.trim() === created);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  })();

  const modal = document.getElementById('vrmModal');
  const overlay = modal.querySelector('[data-modal-overlay]');
  const panel   = modal.querySelector('[data-modal-panel]');
  const openers = document.querySelectorAll('[data-open-modal]');
  const closers = modal.querySelectorAll('[data-close-modal]');
  const vrmInput = document.getElementById('vrmInput');
  const vrmForm = document.getElementById('vrmForm');
  const vrmError = document.getElementById('vrmError');

  // Prevent opening if disabled (daily limit reached)
  openers.forEach(btn => btn.addEventListener('click', (e) => {
    if (btn.hasAttribute('disabled')) { e.preventDefault(); return; }
    e.preventDefault(); openModal();
  }));

  closers.forEach(btn => btn.addEventListener('click', closeModal));
  overlay.addEventListener('click', closeModal);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

  function openModal() {
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      overlay.classList.remove('opacity-0');
      panel.classList.remove('opacity-0', 'translate-y-4');
      panel.focus();
      setTimeout(() => vrmInput?.focus(), 120);
    });
    document.addEventListener('keydown', trapFocus);
  }

  function closeModal() {
    overlay.classList.add('opacity-0');
    panel.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => {
      modal.classList.add('hidden');
      document.removeEventListener('keydown', trapFocus);
    }, 150);
  }

  function trapFocus(e) {
    if (modal.classList.contains('hidden') || e.key !== 'Tab') return;
    const focusables = panel.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // Uppercase VRM while typing (preserve caret)
  document.addEventListener('input', (e) => {
    if (e.target === vrmInput) {
      const { selectionStart, selectionEnd, value } = e.target;
      const upper = value.toUpperCase();
      if (upper !== value) { e.target.value = upper; e.target.setSelectionRange(selectionStart, selectionEnd); }
    }
  });

  // HTMX scoped indicator + error
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
});
