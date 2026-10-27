import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const data = JSON.parse(read("content/content.json"));
const { settings: S, profile: P } = data;
const education = data.education || [];
const experience = data.experience || [];
const projects = data.projects || [];
const hobbies = (data.hobbies || []).filter((h) => h.image);

const esc = (v = "") =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const siteUrl = new URL(S.siteUrl.endsWith("/") ? S.siteUrl : S.siteUrl + "/");
const BASE = siteUrl.pathname;
const SITE = siteUrl.href;
const isAbs = (u) => /^(https?:)?\/\//.test(u) || u.startsWith("mailto:") || u.startsWith("tel:");
const asset = (u) => (!u ? "" : isAbs(u) ? u : BASE + u.replace(/^\/+/, ""));
const absUrl = (u) => (!u ? "" : isAbs(u) ? u : new URL(u.replace(/^\/+/, ""), SITE).href);
const ext = (href) => `href="${esc(href)}" target="_blank" rel="noopener"`;

const imageSize = (file) => {
  try {
    const b = readFileSync(file);
    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const chunk = b.toString("ascii", 12, 16);
      if (chunk === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      if (chunk === "VP8L") { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
      if (chunk === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    }
    if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) {
        const marker = b[i + 1], len = b.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        i += 2 + len;
      }
    }
  } catch {}
  return null;
};

const picture = (src, { alt = "", sizes = "100vw", eager = false, cls = "" } = {}) => {
  if (!src) return "";
  const local = !isAbs(src) && join(ROOT, "public", src);
  const size = local ? imageSize(local) : null;
  let srcset = "";
  if (local && existsSync(dirname(local))) {
    const base = basename(src, extname(src));
    const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)w${extname(src).replace(".", "\\.")}$`);
    const variants = readdirSync(dirname(local))
      .map((f) => { const m = re.exec(f); return m ? { w: +m[1], url: asset(`${dirname(src)}/${f}`) } : null; })
      .filter(Boolean).sort((a, b) => a.w - b.w);
    if (variants.length && size) srcset = [...variants.map((v) => `${v.url} ${v.w}w`), `${asset(src)} ${size.w}w`].join(", ");
  }
  return `<img${cls ? ` class="${cls}"` : ""} src="${esc(asset(src))}"${srcset ? ` srcset="${esc(srcset)}" sizes="${sizes}"` : ""} alt="${esc(alt)}"${size ? ` width="${size.w}" height="${size.h}"` : ""} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
};

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

const I = {
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>',
};
const logoMark = read("public/logo.svg").replace("<svg ", '<svg aria-hidden="true" focusable="false" ');
const stop = (t = "") => (/[.!?…:]$/.test(t.trim()) ? esc(t) : `${esc(t)}.`);

const pills = (list = [], label = "Tecnologías", cls = "") =>
  list.length ? `<ul class="pills ${cls}" aria-label="${label}">${list.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";

const linkPills = (p, variant = "") => {
  const items = [
    p.demo ? `<a class="btn ${variant === "featured" ? "btn-dark" : "btn-primary"} btn-sm" ${ext(p.demo)}>Ver demo${I.out}<span class="visually-hidden"> de ${esc(p.title)} (se abre en otra pestaña)</span></a>` : "",
    p.repo ? `<a class="btn ${variant === "featured" ? "btn-outline-dark" : "btn-ghost"} btn-sm" ${ext(p.repo)}>Ver código${I.out}<span class="visually-hidden"> de ${esc(p.title)} (se abre en otra pestaña)</span></a>` : "",
  ].join("");
  return items ? `<div class="actions">${items}</div>` : "";
};

const section = (id, title, body, band) => `
    <section class="section${band ? " band" : ""}" id="${id}" aria-labelledby="${id}-title">
      <div class="wrap section-grid">
        <h2 class="section-title" id="${id}-title">${stop(title)}</h2>
        <div class="section-body">${body}
        </div>
      </div>
    </section>`;

const sections = {
  estudios: (band) => {
    const items = education.map((e) => `
          <li class="block">
            ${when(e.start, e.end) ? `<p class="meta">${when(e.start, e.end)}</p>` : ""}
            <h3 class="block-title">${esc(e.title)}</h3>
            <p class="org">${esc(e.school)}${e.location ? `<span>, ${esc(e.location)}</span>` : ""}</p>
            ${e.description ? `<p class="muted">${esc(e.description)}</p>` : ""}
            ${pills(e.tags, "Materias")}
          </li>`).join("");
    const langs = (P.languages || []).filter((l) => l.name);
    const extra = `
          <div class="feature-grid extras">
            ${(P.skills || []).length ? `<div class="block block-wide"><h3 class="block-title">Habilidades</h3>${pills(P.skills, "Habilidades", "pills-strong")}</div>` : ""}
            ${langs.length ? `<div class="block"><h3 class="block-title">Idiomas</h3><ul class="lang-list">${langs.map((l) => `<li><span>${esc(l.name)}</span>${l.level ? `<span class="muted">${esc(l.level)}</span>` : ""}</li>`).join("")}</ul></div>` : ""}
          </div>`;
    return section("estudios", "Estudios", `
          <ol class="feature-grid" reversed>${items}
          </ol>${extra}`, band);
  },
  experiencia: (band) => {
    const items = experience.map((x) => {
      const dur = duration(x.start, x.end);
      return `
          <li class="job">
            <p class="meta">${when(x.start, x.end, !x.end)}${dur ? `<span class="dur">${esc(dur)}</span>` : ""}</p>
            <h3 class="job-title">${esc(x.role)}</h3>
            <p class="org">${esc(x.company)}${x.client ? `<span>, ${esc(x.client)}</span>` : ""}${x.location ? `<span>, ${esc(x.location)}</span>` : ""}</p>
            ${(x.highlights || []).length ? `<ul class="highlights">${x.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
            ${pills(x.tags, "Herramientas")}
          </li>`;
    }).join("");
    return section("experiencia", "Experiencia laboral", `
          <ol class="jobs" reversed>${items}
          </ol>`, band);
  },
  proyectos: (band) => {
    const img = (p, sizes) => p.image ? `<div class="media">${picture(p.image, { alt: p.imageAlt, sizes })}</div>` : "";
    const meta = (p) => [p.context, p.year].filter(Boolean).join(", ");
    const [first, ...rest] = projects;
    const featured = first ? `
          <article class="featured${first.image ? " has-media" : ""}" id="proyecto-${esc(first.id)}" aria-labelledby="proyecto-${esc(first.id)}-t">
            <div class="featured-copy">
              ${meta(first) ? `<p class="meta">${esc(meta(first))}</p>` : ""}
              <h3 class="featured-title" id="proyecto-${esc(first.id)}-t">${esc(first.title)}</h3>
              <p class="featured-summary">${esc(first.summary)}</p>
              ${first.details ? `<p class="featured-details">${esc(first.details)}</p>` : ""}
              ${pills(first.tags)}
              ${linkPills(first, "featured")}
            </div>
            ${img(first, "(max-width: 64rem) calc(100vw - 2rem), 22rem")}
          </article>` : "";
    const items = rest.map((p) => `
            <li>
              <article class="project" id="proyecto-${esc(p.id)}" aria-labelledby="proyecto-${esc(p.id)}-t">
                ${img(p, "(max-width: 46rem) calc(100vw - 2rem), (max-width: 52rem) 45vw, 22rem")}
                <div class="block">
                  ${meta(p) ? `<p class="meta">${esc(meta(p))}</p>` : ""}
                  <h3 class="block-title" id="proyecto-${esc(p.id)}-t">${esc(p.title)}</h3>
                  <p>${esc(p.summary)}</p>
                  ${p.details ? `<p class="muted">${esc(p.details)}</p>` : ""}
                  ${pills(p.tags)}
                  ${linkPills(p)}
                </div>
              </article>
            </li>`).join("");
    return section("proyectos", "Proyectos", `${S.projectsNote ? `
          <p class="section-note">${esc(S.projectsNote)}</p>` : ""}${featured}
          ${items ? `<ul class="projects">${items}
          </ul>` : ""}`, band);
  },
  aficiones: (band) => {
    const tilt = [-4, 3, -2, 5, -3, 2, -5, 4];
    const items = hobbies.map((h, i) => `
            <li class="pile-item" style="--rot:${tilt[i % tilt.length]}deg">
              <figure>
                <div class="polaroid">
                  ${picture(h.image, { alt: h.imageAlt || h.title, sizes: "(max-width: 52rem) 85vw, 30rem" })}
                  <figcaption class="polaroid-title">${esc(h.title)}</figcaption>
                </div>
                ${h.text ? `<p class="pile-text">${esc(h.text)}</p>` : ""}
              </figure>
            </li>`).join("");
    return section("aficiones", S.hobbiesTitle || "Fuera del trabajo", `${S.hobbiesIntro ? `
          <p class="lead">${esc(S.hobbiesIntro)}</p>` : ""}
          <div class="pile" style="--count:${hobbies.length}">
            <div class="pile-stage">
              <ol class="pile-list">${items}
              </ol>
            </div>
          </div>`, band);
  },
};

const order = [...(S.order || ["estudios", "experiencia", "proyectos"])];
if (!order.includes("aficiones")) order.push("aficiones");
const visible = order.filter((k) => sections[k] && (k !== "aficiones" || hobbies.length));
order.length = 0;
order.push(...visible);
const navLabels = { estudios: "Estudios", experiencia: "Experiencia", proyectos: "Proyectos", aficiones: "Aficiones" };
const navItems = (pre = "") => [...order.map((k) => [k, navLabels[k]]), ["contacto", "Contacto"]]
  .map(([k, l]) => `<li><a href="${pre}#${k}">${l}</a></li>`).join("\n          ");

const headerFor = (pre = "") => `
  <header class="site-header">
    <nav class="wrap nav" aria-label="Principal">
      <a class="logo" href="${BASE}" aria-label="${esc(P.handle)}, inicio">${logoMark}<span>${esc(P.handle)}</span></a>
      <ul class="nav-links" id="nav-links">
          ${navItems(pre)}
      </ul>
      <div class="nav-tools">
        ${P.cv ? `<a class="btn btn-ghost btn-sm nav-cv" href="${esc(asset(P.cv))}" download>${I.download}<span>CV</span><span class="visually-hidden"> en PDF</span></a>` : ""}
        <button class="icon-btn menu-toggle" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Abrir menú">${I.menu}</button>
      </div>
    </nav>
  </header>`;

const photoSrc = P.photo && P.photo.endsWith(".webp") && P.photoFallback ? P.photoFallback : P.photo;
const photo = photoSrc ? picture(photoSrc, { alt: P.photoAlt || P.name, sizes: "(max-width: 52rem) 8rem, 17rem", eager: true }) : "";

const metaItems = [
  P.location ? `<li>${esc(P.location)}</li>` : "",
  P.available && P.availabilityText ? `<li class="available"><span class="dot" aria-hidden="true"></span>${esc(P.availabilityText)}</li>` : "",
  P.linkedin ? `<li><a ${ext(P.linkedin)}>LinkedIn</a></li>` : "",
  P.github ? `<li><a ${ext(P.github)}>GitHub</a></li>` : "",
].filter(Boolean).join("\n          ");

const hero = `
    <section class="hero" aria-labelledby="nombre">
      <div class="wrap">
        <h1 class="wordmark" id="nombre">
          <span class="line"><span>${esc(P.nameLine1)}</span></span>
          <span class="line"><span>${esc(P.nameLine2)}</span></span>
        </h1>
        <div class="hero-grid">
          ${photo ? `<div class="portrait">${photo}</div>` : ""}
          <div class="statement">
            <p class="statement-title">${stop(P.role)}</p>
            <p class="statement-text">${esc(P.summary)}</p>
            <div class="actions">
              <a class="btn btn-primary" href="#proyectos">Ver proyectos${I.arrowDown}</a>
              ${P.email ? `<a class="btn btn-ghost" href="mailto:${esc(P.email)}">Escríbeme</a>` : ""}
            </div>
          </div>
        </div>
        ${metaItems ? `<ul class="hero-meta">
          ${metaItems}
        </ul>` : ""}
      </div>
    </section>`;

const contact = section("contacto", "Contacto", `
          <p class="lead">${esc(P.contactText || "¿Buscas a alguien para implantación, soporte técnico o desarrollo? Escríbeme y hablamos.")}</p>
          ${P.email ? `<a class="contact-mail" href="mailto:${esc(P.email)}">${esc(P.email)}</a>` : ""}
          <div class="actions">
            ${P.cv ? `<a class="btn btn-primary" href="${esc(asset(P.cv))}" download>${I.download}Descargar CV</a>` : ""}
            ${P.linkedin ? `<a class="btn btn-ghost" ${ext(P.linkedin)}>LinkedIn${I.out}</a>` : ""}
            ${P.github ? `<a class="btn btn-ghost" ${ext(P.github)}>GitHub${I.out}</a>` : ""}
            ${P.phone ? `<a class="btn btn-ghost" href="tel:${esc(P.phone.replace(/\s+/g, ""))}">${esc(P.phone)}</a>` : ""}
          </div>`, order.length % 2 === 1);

const footerFor = (pre = "") => `
  <footer class="site-footer">
    <div class="wrap">
      <p class="footer-mark" aria-hidden="true">${logoMark}<span>${esc(P.handle)}</span></p>
      <div class="footer-cols">
        <nav aria-label="Secciones"><ul>
          ${navItems(pre)}
        </ul></nav>
        <ul>
          ${P.email ? `<li><a href="mailto:${esc(P.email)}">${esc(P.email)}</a></li>` : ""}
          ${P.linkedin ? `<li><a ${ext(P.linkedin)}>LinkedIn</a></li>` : ""}
          ${P.github ? `<li><a ${ext(P.github)}>GitHub</a></li>` : ""}
        </ul>
      </div>
      <div class="footer-legal">
        <p>© ${now.getFullYear()} ${esc(P.name)}</p>
        <p>Actualizado en ${updatedLabel}</p>
      </div>
    </div>
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
  <a class="skip" href="#contenido">Saltar al contenido</a>${headerFor()}
  <main id="contenido">${hero}${order.map((k, i) => sections[k](i % 2 === 1)).join("")}${contact}
  </main>${footerFor()}
  <script>${js}</script>
</body>
</html>
`;

const notFound = `${head({ title: `Página no encontrada | ${P.name}`, description: "Esta página no existe.", robots: "noindex, follow" })}
<body>
${headerFor(BASE)}
  <main class="hero notfound" id="contenido">
    <div class="wrap">
      <h1 class="wordmark"><span class="line"><span>404</span></span></h1>
      <p class="statement-title">Esta página no existe.</p>
      <div class="actions"><a class="btn btn-primary" href="${BASE}">Volver al inicio</a></div>
    </div>
  </main>${footerFor(BASE)}
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
