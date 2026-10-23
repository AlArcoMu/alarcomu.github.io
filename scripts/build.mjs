import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const data = JSON.parse(read("content/content.json"));
const { settings: S, profile: P } = data;
const education = data.education || [];
const experience = data.experience || [];
const projects = data.projects || [];

const esc = (v = "") =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const siteUrl = new URL(S.siteUrl.endsWith("/") ? S.siteUrl : S.siteUrl + "/");
const BASE = siteUrl.pathname;
const SITE = siteUrl.href;
const isAbs = (u) => /^(https?:)?\/\//.test(u) || u.startsWith("mailto:") || u.startsWith("tel:");
const asset = (u) => (!u ? "" : isAbs(u) ? u : BASE + u.replace(/^\/+/, ""));
const absUrl = (u) => (!u ? "" : isAbs(u) ? u : new URL(u.replace(/^\/+/, ""), SITE).href);
const ext = (href) => `href="${esc(href)}" target="_blank" rel="noopener"`;

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const parseYM = (s) => {
  const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(s || "");
  return m ? { y: +m[1], m: m[2] ? +m[2] : null } : null;
};
const fmtYM = (s) => {
  const d = parseYM(s);
  if (!d) return "";
  return d.m ? `${MONTHS[d.m - 1]} ${d.y}` : String(d.y);
};
const when = (start, end, current = false) => {
  const a = fmtYM(start);
  const b = end ? fmtYM(end) : current ? "actualidad" : "";
  if (!a && !b) return "";
  const dt = (s, label) => (parseYM(s) ? `<time datetime="${esc(s)}">${esc(label)}</time>` : esc(label));
  return b ? `${dt(start, a)} – ${end ? dt(end, b) : esc(b)}` : dt(start, a);
};
const duration = (start, end) => {
  const a = parseYM(start);
  if (!a || !a.m) return "";
  const now = new Date();
  const b = parseYM(end) || { y: now.getFullYear(), m: now.getMonth() + 1 };
  if (!b.m) return "";
  const total = (b.y - a.y) * 12 + (b.m - a.m) + 1;
  if (total <= 0) return "";
  const y = Math.floor(total / 12), m = total % 12;
  const parts = [];
  if (y) parts.push(`${y} ${y === 1 ? "año" : "años"}`);
  if (m) parts.push(`${m} ${m === 1 ? "mes" : "meses"}`);
  return parts.join(" y ");
};
const now = new Date();
const updatedLabel = `${MONTHS_LONG[now.getMonth()]} de ${now.getFullYear()}`;

const hash = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => { let a = hash(seed); return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const r1 = (n) => Math.round(n * 10) / 10;
const smooth = (pts, closed = false) => {
  const p = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${r1(p[1][0])} ${r1(p[1][1])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
};
const wave = (seed, { w = 600, h = 24, waves = 9, amp = 6 } = {}) => {
  const rand = rng(seed);
  const pts = [];
  const steps = waves * 2;
  for (let i = 0; i <= steps; i++) {
    const x = 4 + (i / steps) * (w - 8) + (rand() - 0.5) * 8;
    const drift = Math.sin((i / steps) * Math.PI) * -2;
    const y = h / 2 + (i % 2 ? -1 : 1) * amp * (0.55 + rand() * 0.6) + drift;
    pts.push([x, y]);
  }
  return smooth(pts);
};
const ring = (seed, start = -105, sweep = 395, base = 92) => {
  const rand = rng(seed);
  const pts = [];
  for (let a = 0; a <= sweep; a += 22) {
    const t = ((start + a) * Math.PI) / 180;
    const r = base + (rand() - 0.5) * 5 + (a / sweep) * 3;
    pts.push([100 + Math.cos(t) * r, 100 + Math.sin(t) * r * 0.985]);
  }
  return smooth(pts);
};
const svgWave = (seed, cls = "scribble", opts) =>
  `<svg class="${cls}" viewBox="0 0 ${opts?.w || 600} ${opts?.h || 24}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path pathLength="1" d="${wave(seed, opts)}"/></svg>`;

const I = {
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5h5v5"/><path d="M19 5 10 14"/><path d="M18 14v5H5V6h5"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>',
};
const logoMark = read("public/logo.svg").replace("<svg ", '<svg aria-hidden="true" focusable="false" ');

const tags = (list = []) =>
  list.length ? `<ul class="tags" aria-label="Tecnologías">${list.map((t) => `<li class="tag">${esc(t)}</li>`).join("")}</ul>` : "";

const sectionHead = (id, title, note = "") => `
      <div class="section-head">
        <h2 class="section-title" id="${id}-title">${esc(title)}${svgWave(id + "-title", "scribble", { w: 600, h: 24, waves: 7, amp: 5 })}</h2>
        ${note ? `<p class="section-note">${esc(note)}</p>` : ""}
      </div>`;

const sections = {
  estudios: () => {
    const items = education.map((e) => `
        <li class="entry">
          <div class="entry-head">
            <h3 class="entry-title">${esc(e.title)}</h3>
            ${when(e.start, e.end) ? `<p class="entry-when">${when(e.start, e.end)}</p>` : ""}
          </div>
          <p class="entry-org">${esc(e.school)}${e.location ? `<span class="client">, ${esc(e.location)}</span>` : ""}</p>
          ${e.description ? `<p class="entry-text">${esc(e.description)}</p>` : ""}
          ${tags(e.tags)}
        </li>`).join("");
    const langs = (P.languages || []).filter((l) => l.name);
    return `
    <section class="section wrap" id="estudios" aria-labelledby="estudios-title">
      ${sectionHead("estudios", "Estudios")}
      <ol class="entries" reversed>${items}
      </ol>
      ${(P.skills || []).length ? `<div class="side-block skills"><h3>Habilidades</h3>${tags(P.skills).replace('aria-label="Tecnologías"', 'aria-label="Habilidades"')}</div>` : ""}
      ${langs.length ? `<div class="side-block"><h3>Idiomas</h3><ul class="tags" aria-label="Idiomas">${langs.map((l) => `<li class="tag">${esc(l.name)}${l.level ? `, ${esc(l.level)}` : ""}</li>`).join("")}</ul></div>` : ""}
    </section>`;
  },
  experiencia: () => {
    const items = experience.map((x) => {
      const dur = duration(x.start, x.end);
      return `
        <li class="entry">
          <div class="entry-head">
            <h3 class="entry-title">${esc(x.role)}</h3>
            <p class="entry-when">${when(x.start, x.end, !x.end)}${dur ? `<span class="dur">${esc(dur)}</span>` : ""}</p>
          </div>
          <p class="entry-org">${esc(x.company)}${x.client ? `<span class="client">, ${esc(x.client)}</span>` : ""}${x.location ? `<span class="client">, ${esc(x.location)}</span>` : ""}</p>
          ${(x.highlights || []).length ? `<ul class="entry-list">${x.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
          ${tags(x.tags)}
        </li>`;
    }).join("");
    return `
    <section class="section wrap" id="experiencia" aria-labelledby="experiencia-title">
      ${sectionHead("experiencia", "Experiencia laboral")}
      <ol class="entries" reversed>${items}
      </ol>
    </section>`;
  },
  proyectos: () => {
    const items = projects.map((p, i) => {
      const meta = [p.context, p.year].filter(Boolean).join(", ");
      const media = p.image
        ? `<div class="project-media"><img src="${esc(asset(p.image))}" alt="${esc(p.imageAlt || "")}" width="800" height="500" loading="${i < 2 ? "eager" : "lazy"}" decoding="async"></div>`
        : "";
      const links = [
        p.repo ? `<a class="btn btn-ghost btn-small" ${ext(p.repo)}>Ver código${I.out}<span class="visually-hidden"> de ${esc(p.title)} (se abre en otra pestaña)</span></a>` : "",
        p.demo ? `<a class="btn btn-primary btn-small" ${ext(p.demo)}>Ver demo${I.out}<span class="visually-hidden"> de ${esc(p.title)} (se abre en otra pestaña)</span></a>` : "",
      ].join("");
      return `
        <li>
          <article class="project" id="proyecto-${esc(p.id)}" aria-labelledby="proyecto-${esc(p.id)}-t">
            ${media}
            <div class="project-body">
              ${meta ? `<p class="project-meta">${esc(meta)}</p>` : ""}
              <h3 class="project-title" id="proyecto-${esc(p.id)}-t">${esc(p.title)}</h3>
              <p class="project-summary">${esc(p.summary)}</p>
              ${p.details ? `<p class="project-details">${esc(p.details)}</p>` : ""}
              ${tags(p.tags)}
              ${links ? `<div class="project-links">${links}</div>` : ""}
            </div>
          </article>
        </li>`;
    }).join("");
    return `
    <section class="section wrap" id="proyectos" aria-labelledby="proyectos-title">
      ${sectionHead("proyectos", "Proyectos", S.projectsNote || "")}
      <ul class="projects">${items}
      </ul>
    </section>`;
  },
};

const order = (S.order || ["estudios", "experiencia", "proyectos"]).filter((k) => sections[k]);
const navLabels = { estudios: "Estudios", experiencia: "Experiencia", proyectos: "Proyectos" };

const headerFor = (pre = "") => `
  <header class="site-header">
    <nav class="nav wrap" aria-label="Principal">
      <a class="logo" href="${BASE}" aria-label="${esc(P.handle)}, inicio">${logoMark}<span>${esc(P.handle)}</span></a>
      <ul class="nav-links" id="nav-links">
        ${order.map((k) => `<li><a href="${pre}#${k}">${navLabels[k]}</a></li>`).join("\n        ")}
        <li><a href="${pre}#contacto">Contacto</a></li>
      </ul>
      <div class="nav-tools">
        ${P.cv ? `<a class="btn btn-ghost btn-small" href="${esc(asset(P.cv))}" download>${I.download}<span class="nav-cv-label">Descargar CV</span><span class="visually-hidden"> (PDF)</span></a>` : ""}
        <button class="icon-btn menu-toggle" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Abrir menú">${I.menu}</button>
      </div>
    </nav>
  </header>`;

const photo = P.photo
  ? `<picture>
          ${P.photo.endsWith(".webp") && P.photoFallback ? `<source srcset="${esc(asset(P.photo))}" type="image/webp">` : ""}
          <img src="${esc(asset(P.photo.endsWith(".webp") && P.photoFallback ? P.photoFallback : P.photo))}" alt="${esc(P.photoAlt || P.name)}" width="300" height="300" fetchpriority="high" decoding="async">
        </picture>`
  : "";

const hero = `
    <section class="hero wrap" aria-labelledby="nombre">
      <div class="hero-copy">
        <h1 class="hero-name" id="nombre">
          <span class="line line-1">${esc(P.nameLine1)}</span>
          <span class="line line-2">${esc(P.nameLine2)}</span>
          ${svgWave("hero", "scribble draw", { w: 600, h: 24, waves: 10, amp: 6 }).replace('focusable="false">', 'focusable="false"><defs><linearGradient id="neon" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="600" y2="0"><stop offset="0" stop-color="#2e8bff"/><stop offset="1" stop-color="#ff2bd6"/></linearGradient></defs>')}
        </h1>
        <p class="hero-role">${esc(P.role)}</p>
        <p class="hero-summary">${esc(P.summary)}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#proyectos">Ver proyectos${I.arrowDown}</a>
          ${P.email ? `<a class="btn btn-ghost" href="mailto:${esc(P.email)}">${I.mail}Escríbeme</a>` : ""}
        </div>
        <ul class="hero-meta">
          ${P.location ? `<li>${I.pin}<span>${esc(P.location)}</span></li>` : ""}
          ${P.available && P.availabilityText ? `<li class="ok">${I.check}<span>${esc(P.availabilityText)}</span></li>` : ""}
          ${P.linkedin ? `<li><a ${ext(P.linkedin)}>LinkedIn</a></li>` : ""}
          ${P.github ? `<li><a ${ext(P.github)}>GitHub</a></li>` : ""}
        </ul>
      </div>
      <div class="portrait">
        ${photo}
        <svg class="ring draw" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><path pathLength="1" d="${ring("ring-a")}"/></svg>
      </div>
    </section>`;

const contact = `
    <section class="section wrap contact" id="contacto" aria-labelledby="contacto-title">
      ${sectionHead("contacto", "Contacto")}
      <p class="contact-lead">${esc(P.contactText || "¿Buscas a alguien para implantación, soporte técnico o desarrollo? Escríbeme y hablamos.")}</p>
      ${P.email ? `<a class="contact-mail" href="mailto:${esc(P.email)}">${esc(P.email)}</a>` : ""}
      <div class="contact-actions">
        ${P.linkedin ? `<a class="btn btn-ghost" ${ext(P.linkedin)}>LinkedIn${I.out}</a>` : ""}
        ${P.github ? `<a class="btn btn-ghost" ${ext(P.github)}>GitHub${I.out}</a>` : ""}
        ${P.phone ? `<a class="btn btn-ghost" href="tel:${esc(P.phone.replace(/\s+/g, ""))}">${esc(P.phone)}</a>` : ""}
        ${P.cv ? `<a class="btn btn-primary" href="${esc(asset(P.cv))}" download>${I.download}Descargar CV</a>` : ""}
      </div>
    </section>`;

const footer = `
    <footer class="site-footer wrap">
      <p>© ${now.getFullYear()} ${esc(P.name)}</p>
      <p>Actualizado en ${updatedLabel}</p>
    </footer>`;

const ogImage = absUrl(S.ogImage || P.photo);
const [locality, region] = (P.location || "").split(",").map((s) => s.trim());
const personId = SITE + "#person";
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": SITE + "#website", url: SITE, name: P.name, alternateName: P.handle, inLanguage: "es-ES", publisher: { "@id": personId } },
    {
      "@type": "ProfilePage", "@id": SITE + "#profile", url: SITE, name: S.title, description: S.description,
      isPartOf: { "@id": SITE + "#website" }, mainEntity: { "@id": personId }, about: { "@id": personId },
      dateModified: now.toISOString(), inLanguage: "es-ES",
      primaryImageOfPage: { "@type": "ImageObject", url: absUrl(P.photoFallback || P.photo) },
    },
    {
      "@type": "Person", "@id": personId, name: P.name, givenName: P.givenName, familyName: P.familyName,
      alternateName: P.handle, jobTitle: P.role, description: P.summary, url: SITE,
      image: absUrl(P.photoFallback || P.photo),
      ...(P.email ? { email: "mailto:" + P.email } : {}),
      sameAs: [P.linkedin, P.github].filter(Boolean),
      address: { "@type": "PostalAddress", addressLocality: locality || undefined, addressRegion: region || undefined, addressCountry: P.country || "ES" },
      alumniOf: [...new Set(education.map((e) => e.school).filter(Boolean))].map((name) => ({ "@type": "EducationalOrganization", name })),
      hasOccupation: { "@type": "Occupation", name: P.role, skills: (P.skills || []).join(", ") },
      knowsAbout: [...new Set([...(P.skills || []), ...experience.flatMap((x) => x.tags || [])])],
      knowsLanguage: (P.languages || []).map((l) => l.name).filter(Boolean),
    },
    {
      "@type": "ItemList", "@id": SITE + "#proyectos", name: "Proyectos",
      itemListElement: projects.map((p, i) => ({
        "@type": "ListItem", position: i + 1,
        item: {
          "@type": "CreativeWork", name: p.title, description: p.summary,
          url: p.demo || p.repo || `${SITE}#proyecto-${p.id}`,
          ...(p.image ? { image: absUrl(p.image) } : {}),
          keywords: (p.tags || []).join(", "), creator: { "@id": personId },
          ...(p.year ? { dateCreated: String(p.year) } : {}),
        },
      })),
    },
  ],
};
const ld = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

const css = read("src/styles.css")
  .replaceAll('url("/fonts/', `url("${BASE}fonts/`)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/\s*([{}:;,>])\s*/g, "$1")
  .replace(/;}/g, "}")
  .trim();
const js = read("src/main.js");

const head = ({ title, description, canonical, robots = "index, follow, max-image-preview:large, max-snippet:-1", extra = "" }) => `<!doctype html>
<html lang="${esc(S.lang || "es")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="author" content="${esc(P.name)}">
  <meta name="robots" content="${robots}">
  ${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
  <meta name="theme-color" content="#000000">
  <meta name="color-scheme" content="dark">
  <link rel="icon" href="${BASE}favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="${BASE}apple-touch-icon.png">
  <link rel="manifest" href="${BASE}site.webmanifest">
  <link rel="preload" href="${BASE}fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
  <style>${css}</style>${extra}
</head>`;

const seoExtra = `
  <meta name="keywords" content="${esc((S.keywords || []).join(", "))}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="${esc(P.name)}">
  <meta property="og:locale" content="${esc(S.locale || "es_ES")}">
  <meta property="og:title" content="${esc(S.title)}">
  <meta property="og:description" content="${esc(S.description)}">
  <meta property="og:url" content="${esc(SITE)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(P.name + ", " + P.role)}">
  <meta property="profile:first_name" content="${esc(P.givenName)}">
  <meta property="profile:last_name" content="${esc(P.familyName)}">
  <meta property="profile:username" content="${esc(P.handle)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(S.title)}">
  <meta name="twitter:description" content="${esc(S.description)}">
  <meta name="twitter:image" content="${esc(ogImage)}">
  ${[P.linkedin, P.github].filter(Boolean).map((u) => `<link rel="me" href="${esc(u)}">`).join("\n  ")}
  <script type="application/ld+json">${ld}</script>`;

const page = `${head({ title: S.title, description: S.description, canonical: SITE, extra: seoExtra })}
<body>
  <a class="skip" href="#contenido">Saltar al contenido</a>
  <div class="sheet">${headerFor()}
    <main id="contenido">${hero}${order.map((k) => sections[k]()).join("")}${contact}
    </main>${footer}
  </div>
  <script>${js}</script>
</body>
</html>
`;

const notFound = `${head({ title: `Página no encontrada | ${P.name}`, description: "Esta página no existe.", robots: "noindex, follow" })}
<body>
  <div class="sheet">${headerFor(BASE)}
    <main class="wrap notfound" id="contenido">
      <h1>404${svgWave("404", "scribble", { w: 600, h: 24, waves: 4, amp: 6 }).replace('class="scribble"', 'class="scribble" style="width:3em;height:.3em;color:var(--ink)"')}</h1>
      <p class="hero-summary">Esta página no existe o ha cambiado de sitio.</p>
      <div class="hero-actions"><a class="btn btn-primary" href="${BASE}">Volver al inicio</a></div>
    </main>
  </div>
  <script>${js}</script>
</body>
</html>
`;

const today = now.toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${esc(SITE)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
    <image:image><image:loc>${esc(absUrl(P.photoFallback || P.photo))}</image:loc></image:image>${projects.filter((p) => p.image).map((p) => `
    <image:image><image:loc>${esc(absUrl(p.image))}</image:loc></image:image>`).join("")}
  </url>
</urlset>
`;
const robots = `User-agent: *
Allow: /
Disallow: ${BASE}admin/

Sitemap: ${SITE}sitemap.xml
`;
const manifest = JSON.stringify({
  name: P.name, short_name: P.handle, lang: S.lang || "es", start_url: BASE, scope: BASE, display: "browser",
  background_color: "#000000", theme_color: "#000000",
  icons: [
    { src: BASE + "favicon.svg", sizes: "any", type: "image/svg+xml" },
    { src: BASE + "icon-512.png", sizes: "512x512", type: "image/png" },
  ],
}, null, 2);

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
if (existsSync(join(ROOT, "public"))) cpSync(join(ROOT, "public"), DIST, { recursive: true });
writeFileSync(join(DIST, "index.html"), page);
writeFileSync(join(DIST, "404.html"), notFound);
writeFileSync(join(DIST, "sitemap.xml"), sitemap);
writeFileSync(join(DIST, "robots.txt"), robots);
writeFileSync(join(DIST, "site.webmanifest"), manifest);
writeFileSync(join(DIST, ".nojekyll"), "");
if (S.customDomain) writeFileSync(join(DIST, "CNAME"), S.customDomain.trim() + "\n");

console.log(`✔ Web generada en dist/ (${(page.length / 1024).toFixed(1)} KB) para ${SITE}`);
