// Tiny inline setup for these specific modals (different structure from filters/vrm)
(function () {
  function setup(id, openId) {
    const root = document.getElementById(id);
    if (!root) return;
    const overlay = root.querySelector("[data-overlay]");
    const panel = root.querySelector("[data-panel]");
    const closers = root.querySelectorAll("[data-close]");
    function open() {
      root.classList.remove("hidden");
      requestAnimationFrame(() => {
        overlay.classList.remove("opacity-0");
        panel.classList.remove("opacity-0", "translate-y-4");
        panel.focus();
      });
    }
    function close() {
      overlay.classList.add("opacity-0");
      panel.classList.add("opacity-0", "translate-y-4");
      setTimeout(() => root.classList.add("hidden"), 150);
    }
    overlay.addEventListener("click", close);
    closers.forEach((b) => b.addEventListener("click", close));
    document.getElementById(openId)?.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    });
    return { open, close, root, panel };
  }
  const create = setup("createModal", "openCreate");
  const edit = setup("editModal");

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".editBtn");
    if (!btn) return;
    e.preventDefault();
    const id = btn.getAttribute("data-id");
    document.getElementById("editName").value =
      btn.getAttribute("data-name") || "";
    document.getElementById("editEmail").value =
      btn.getAttribute("data-email") || "";
    document.getElementById("editPassword").value = "";
    document.getElementById("editDailyLimit").value =
      btn.getAttribute("data-dailylimit") || "0";
    document.getElementById("editActive").checked =
      btn.getAttribute("data-active") === "true";
    const form = document.getElementById("editForm");
    form.action = `/technicians/${id}/update`;
    edit.open();
  });
})();
