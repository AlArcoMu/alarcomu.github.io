(() => {
  const root = document.documentElement;

  // Menú móvil
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

  // Cabecera con borde al hacer scroll
  const header = document.querySelector(".site-header");
  const onScroll = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Sección activa en la navegación
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
