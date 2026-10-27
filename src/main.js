(() => {
  const menuBtn = document.querySelector(".menu-toggle");
  const links = document.getElementById("nav-links");
  const closeMenu = () => { links?.classList.remove("is-open"); menuBtn?.setAttribute("aria-expanded", "false"); };
  menuBtn?.addEventListener("click", () => {
    const open = !links.classList.contains("is-open");
    links.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    if (open) links.querySelector("a")?.focus();
  });
  links?.addEventListener("click", (e) => { if (e.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  const header = document.querySelector(".site-header");
  if (header && "IntersectionObserver" in window) {
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none";
    document.body.prepend(sentinel);
    new IntersectionObserver(([entry]) => header.classList.toggle("is-scrolled", !entry.isIntersecting)).observe(sentinel);
  }

  const navMap = new Map([...document.querySelectorAll('.nav-links a[href^="#"]')].map((a) => [a.getAttribute("href").slice(1), a]));
  if ("IntersectionObserver" in window && navMap.size) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navMap.forEach((a) => a.removeAttribute("aria-current"));
        navMap.get(entry.target.id)?.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navMap.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

})();
