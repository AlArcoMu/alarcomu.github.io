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

  const pile = document.querySelector(".pile");
  if (pile && "IntersectionObserver" in window && window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    const items = [...pile.querySelectorAll(".pile-item")];
    const stage = pile.querySelector(".pile-stage");
    if (items.length > 1) {
      pile.classList.add("is-live");
      let frame = 0;
      const update = () => {
        frame = 0;
        const rect = pile.getBoundingClientRect();
        const travel = rect.height - stage.offsetHeight;
        const progress = Math.min(1, Math.max(0, -rect.top / travel));
        const position = progress * (items.length - 1) * 1.08;
        let active = 0;
        const states = items.map((_, i) => {
          const t = i === 0 ? 1 : Math.min(1, Math.max(0, position - (i - 1)));
          if (t >= 0.5) active = i;
          return 1 - Math.pow(1 - t, 3);
        });
        items.forEach((el, i) => {
          const e = states[i];
          const rot = parseFloat(el.style.getPropertyValue("--rot")) || 0;
          el.style.setProperty("--y", `${((1 - e) * 105).toFixed(2)}vh`);
          el.style.setProperty("--tilt", `${(rot * (1 + (1 - e) * 2.5)).toFixed(2)}deg`);
          el.classList.toggle("is-active", i === active);
          el.classList.toggle("is-under", i < active);
        });
      };
      const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) { window.addEventListener("scroll", schedule, { passive: true }); schedule(); }
        else window.removeEventListener("scroll", schedule);
      }).observe(pile);
      window.addEventListener("resize", schedule, { passive: true });
      schedule();
    }
  }

})();
