// Uppercase VRM as user types (preserve caret)
const vrmInput = document.querySelector('input[name="vrm"]');
vrmInput?.addEventListener("input", (e) => {
  const { selectionStart, selectionEnd, value } = e.target;
  const upper = value.toUpperCase();
  if (upper !== value) {
    e.target.value = upper;
    e.target.setSelectionRange(selectionStart, selectionEnd);
  }
});

// Convert comma-separated "tags" text to array-like on submit (the backend accepts either; this makes UX nicer)
document.querySelector("form")?.addEventListener("submit", (e) => {
  const tagInputs = document.querySelectorAll('input[name$=".tags"]');
  tagInputs.forEach((inp) => {
    const raw = inp.value || "";
    // Backend accepts array or single; submitting as "a, b" string is fine too,
    // but normalise to "a,b" to avoid accidental spaces.
    inp.value = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  });
});
