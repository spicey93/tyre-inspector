(function () {
  // Copy link
  const copyBtn = document.getElementById("copyLink");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const url = new URL(window.location.origin + "/inspections");
      url.searchParams.set("code", "<%= inspection.code %>");
      try {
        await navigator.clipboard.writeText(url.toString());
        copyBtn.setAttribute("aria-label", "Copied");
        copyBtn.title = "Copied";
        copyBtn.classList.add("ring-2", "ring-emerald-400");
        setTimeout(() => {
          copyBtn.removeAttribute("aria-label");
          copyBtn.title = "Copy link";
          copyBtn.classList.remove("ring-2", "ring-emerald-400");
        }, 1200);
      } catch {
        prompt("Copy this link:", url.toString());
      }
    });
  }

  // Print
  const printBtn = document.getElementById("printBtn");
  if (printBtn) {
    printBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.focus();
      requestAnimationFrame(() => setTimeout(() => window.print(), 0));
    });
  }
})();
