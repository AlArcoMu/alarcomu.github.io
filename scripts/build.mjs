import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const data = JSON.parse(read("content/content.json"));
const S0 = data.settings;

const esc = (v = "") =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const siteUrl = new URL(S0.siteUrl.endsWith("/") ? S0.siteUrl : S0.siteUrl + "/");
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

const parseYM = (s) => {
  const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(s || "");
  return m ? { y: +m[1], m: m[2] ? +m[2] : null } : null;
};
const now = new Date();
const today = now.toISOString().slice(0, 10);

const I = {
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>',
};
const logoMark = read("public/logo.svg").replace("<svg ", '<svg aria-hidden="true" focusable="false" ');
const stop = (t = "") => (/[.!?…:]$/.test(t.trim()) ? esc(t.trim()) : `${esc(t.trim())}.`);

const css = read("src/styles.css")
  .replaceAll('url("/fonts/', `url("${BASE}fonts/`)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/\s*([{}:;,>])\s*/g, "$1")
  .replace(/;}/g, "}")
  .trim();
const js = read("src/main.js");

const LOCALES = {
  es: {
    html: "es", og: "es_ES", ld: "es-ES", dir: "", privacy: "privacidad/", name: "Español",
    months: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    monthsLong: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    monthYear: (m, y) => `${m} de ${y}`,
    present: "actualidad",
    duration: (y, m) => [y ? `${y} ${y === 1 ? "año" : "años"}` : "", m ? `${m} ${m === 1 ? "mes" : "meses"}` : ""].filter(Boolean).join(" y "),
    ids: { estudios: "estudios", experiencia: "experiencia", proyectos: "proyectos", aficiones: "aficiones", contacto: "contacto", project: "proyecto-" },
    nav: { estudios: "Estudios", experiencia: "Experiencia", proyectos: "Proyectos", aficiones: "Aficiones", contacto: "Contacto" },
    titles: { estudios: "Estudios", experiencia: "Experiencia laboral", proyectos: "Proyectos", aficiones: "Fuera del trabajo", contacto: "Contacto" },
    skills: "Habilidades", languages: "Idiomas", subjects: "Materias", tools: "Herramientas", tech: "Tecnologías",
    demo: "Ver demo", code: "Ver código", newTab: (t) => ` de ${t} (se abre en otra pestaña)`,
    navMain: "Principal", navSections: "Secciones", home: (h) => `${h}, inicio`, cvPdf: " en PDF", openMenu: "Abrir menú",
    viewProjects: "Ver proyectos", writeMe: "Escríbeme", downloadCv: "Descargar CV", skip: "Saltar al contenido",
    contactText: "¿Buscas a alguien para implantación, soporte técnico o desarrollo? Escríbeme y hablamos.",
    privacyLink: "Privacidad y cookies", updated: "Actualizado en", projectsList: "Proyectos",
    switchTo: "Versión en español",
    privacyTitle: "Privacidad y cookies",
    privacyDesc: (n) => `Cómo trata los datos la web de ${n}: sin cookies, sin analítica y sin contenido de terceros.`,
    privacyBody: (P, mail, upd) => `
          <div class="block">
            <h2 class="block-title">Sin cookies</h2>
            <p>Esta web no usa cookies ni tecnologías similares, como el almacenamiento local del navegador, para analítica, publicidad ni seguimiento. Tampoco carga contenido de terceros: la tipografía y las imágenes se sirven desde este mismo dominio. Por eso no verás ningún aviso de cookies.</p>
            <p class="muted">Si en el futuro se añade algún servicio que las necesite, se te pedirá el consentimiento antes de activarlo y se actualizará esta página.</p>
          </div>
          <div class="block">
            <h2 class="block-title">Responsable</h2>
            <p>${esc(P.name)}${P.location ? `, ${esc(P.location)}` : ""}.${mail ? ` Contacto: ${mail}.` : ""}</p>
          </div>
          <div class="block">
            <h2 class="block-title">Qué datos se tratan</h2>
            <ul class="highlights">
              <li><strong>Si me escribes por email</strong>, uso tus datos solo para responderte. No se ceden a terceros y se conservan el tiempo necesario para atender tu mensaje.</li>
              <li><strong>Alojamiento.</strong> La web está alojada en GitHub Pages, de GitHub, Inc. Como cualquier servidor, puede registrar la dirección IP de quien visita la web por motivos de seguridad. Más información en la <a ${ext("https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement")}>declaración de privacidad de GitHub</a>.</li>
              <li><strong>Enlaces externos.</strong> Al pulsar en LinkedIn o GitHub sales de esta web y se aplican las políticas de esos sitios.</li>
            </ul>
          </div>
          <div class="block">
            <h2 class="block-title">Tus derechos</h2>
            <p>Puedes pedir el acceso, la rectificación o la supresión de tus datos, así como oponerte a su tratamiento o limitarlo, escribiendo ${mail ? `a ${mail}` : "por email"}. Si consideras que no se han respetado tus derechos, puedes reclamar ante la <a ${ext("https://www.aepd.es")}>Agencia Española de Protección de Datos</a>.</p>
            <p class="meta">Última actualización: ${upd}.</p>
          </div>`,
  },
  en: {
    html: "en", og: "en_GB", ld: "en-GB", dir: "en/", privacy: "privacy/", name: "English",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    monthsLong: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthYear: (m, y) => `${m} ${y}`,
    present: "present",
    duration: (y, m) => [y ? `${y} ${y === 1 ? "year" : "years"}` : "", m ? `${m} ${m === 1 ? "month" : "months"}` : ""].filter(Boolean).join(", "),
    ids: { estudios: "education", experiencia: "experience", proyectos: "projects", aficiones: "hobbies", contacto: "contact", project: "project-" },
    nav: { estudios: "Education", experiencia: "Experience", proyectos: "Projects", aficiones: "Hobbies", contacto: "Contact" },
    titles: { estudios: "Education", experiencia: "Work experience", proyectos: "Projects", aficiones: "Outside work", contacto: "Contact" },
    skills: "Skills", languages: "Languages", subjects: "Subjects", tools: "Tools", tech: "Technologies",
    demo: "Live demo", code: "Source code", newTab: (t) => ` for ${t} (opens in a new tab)`,
    navMain: "Main", navSections: "Sections", home: (h) => `${h}, home`, cvPdf: " (PDF)", openMenu: "Open menu",
    viewProjects: "See projects", writeMe: "Get in touch", downloadCv: "Download CV", skip: "Skip to content",
    contactText: "Looking for someone for software implementation, technical support or development? Drop me a line and let's talk.",
    privacyLink: "Privacy and cookies", updated: "Updated", projectsList: "Projects",
    switchTo: "English version",
    privacyTitle: "Privacy and cookies",
    privacyDesc: (n) => `How ${n}'s website handles data: no cookies, no analytics and no third-party content.`,
    privacyBody: (P, mail, upd) => `
          <div class="block">
            <h2 class="block-title">No cookies</h2>
            <p>This website doesn't use cookies or similar technologies, such as the browser's local storage, for analytics, advertising or tracking. It doesn't load any third-party content either: the font and images are served from this same domain. That's why you won't see a cookie banner.</p>
            <p class="muted">If a service that needs them is ever added, you'll be asked for consent before it's switched on and this page will be updated.</p>
          </div>
          <div class="block">
            <h2 class="block-title">Data controller</h2>
            <p>${esc(P.name)}${P.location ? `, ${esc(P.location)}` : ""}.${mail ? ` Contact: ${mail}.` : ""}</p>
          </div>
          <div class="block">
            <h2 class="block-title">What data is processed</h2>
            <ul class="highlights">
              <li><strong>If you email me</strong>, I'll only use your details to reply. They aren't shared with third parties and are kept only as long as it takes to deal with your message.</li>
              <li><strong>Hosting.</strong> The site is hosted on GitHub Pages, run by GitHub, Inc. Like any web server, it may log visitors' IP addresses for security reasons. More information in <a ${ext("https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement")}>GitHub's privacy statement</a>.</li>
              <li><strong>External links.</strong> If you click through to LinkedIn or GitHub, you leave this site and their own policies apply.</li>
            </ul>
          </div>
          <div class="block">
            <h2 class="block-title">Your rights</h2>
            <p>You can ask to access, correct or delete your data, or to object to or restrict its processing, by writing ${mail ? `to ${mail}` : "by email"}. If you think your rights haven't been respected, you can file a complaint with the <a ${ext("https://www.aepd.es/en")}>Spanish Data Protection Agency (AEPD)</a>.</p>
            <p class="meta">Last updated: ${upd}.</p>
          </div>`,
  },
};
const LANGS = Object.keys(LOCALES);
const homeUrl = (lang) => SITE + LOCALES[lang].dir;
const homePath = (lang) => BASE + LOCALES[lang].dir;
const privacyUrl = (lang) => homeUrl(lang) + LOCALES[lang].privacy;
const privacyPath = (lang) => homePath(lang) + LOCALES[lang].privacy;

const filled = (v) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== "");
const overlay = (base, over) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) if (filled(v)) out[k] = v;
  return out;
};
const localize = (lang) => {
  const tr = lang === "es" ? {} : data[lang] || {};
  const list = (key) => (data[key] || []).map((it) => overlay(it, tr[key]?.[it.id]));
  return {
    S: overlay(S0, tr.settings),
    P: overlay(data.profile, tr.profile),
    education: list("education"),
    experience: list("experience"),
    projects: list("projects"),
    hobbies: list("hobbies").filter((h) => h.image),
  };
};

const order = [...(S0.order || ["estudios", "experiencia", "proyectos"])];
if (!order.includes("aficiones")) order.push("aficiones");

const alternates = (pathFor) => [...LANGS.map((l) => [l, pathFor(l)]), ["x-default", pathFor("es")]];

const render = (lang) => {
  const T = LOCALES[lang];
  const other = LANGS.find((l) => l !== lang);
  const O = LOCALES[other];
  const { S, P, education, experience, projects, hobbies } = localize(lang);
  const sectionKeys = order.filter((k) => ["estudios", "experiencia", "proyectos", "aficiones"].includes(k) && (k !== "aficiones" || hobbies.length));

  const fmtYM = (s) => {
    const d = parseYM(s);
    if (!d) return "";
    return d.m ? `${T.months[d.m - 1]} ${d.y}` : String(d.y);
  };
  const when = (start, end, current = false) => {
    const a = fmtYM(start);
    const b = end ? fmtYM(end) : current ? T.present : "";
    if (!a && !b) return "";
    const dt = (s, label) => (parseYM(s) ? `<time datetime="${esc(s)}">${esc(label)}</time>` : esc(label));
    return b ? `${dt(start, a)} – ${end ? dt(end, b) : esc(b)}` : dt(start, a);
  };
  const duration = (start, end) => {
    const a = parseYM(start);
    if (!a || !a.m) return "";
    const b = parseYM(end) || { y: now.getFullYear(), m: now.getMonth() + 1 };
    if (!b.m) return "";
    const total = (b.y - a.y) * 12 + (b.m - a.m) + 1;
    if (total <= 0) return "";
    return T.duration(Math.floor(total / 12), total % 12);
  };
  const updatedLabel = T.monthYear(T.monthsLong[now.getMonth()], now.getFullYear());

  const pills = (list = [], label = T.tech, cls = "") =>
    list.length ? `<ul class="pills ${cls}" aria-label="${esc(label)}">${list.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";

  const linkPills = (p, variant = "") => {
    const items = [
      p.demo ? `<a class="btn ${variant === "featured" ? "btn-dark" : "btn-primary"} btn-sm" ${ext(p.demo)}>${T.demo}${I.out}<span class="visually-hidden">${esc(T.newTab(p.title))}</span></a>` : "",
      p.repo ? `<a class="btn ${variant === "featured" ? "btn-outline-dark" : "btn-ghost"} btn-sm" ${ext(p.repo)}>${T.code}${I.out}<span class="visually-hidden">${esc(T.newTab(p.title))}</span></a>` : "",
    ].join("");
    return items ? `<div class="actions">${items}</div>` : "";
  };

  const section = (key, title, body, band) => {
    const id = T.ids[key];
    return `
    <section class="section${band ? " band" : ""}" id="${id}" aria-labelledby="${id}-title">
      <div class="wrap section-grid">
        <h2 class="section-title" id="${id}-title">${stop(title)}</h2>
        <div class="section-body">${body}
        </div>
      </div>
    </section>`;
  };

  const pid = (p) => `${T.ids.project}${esc(p.id)}`;
  const sections = {
    estudios: (band) => {
      const items = education.map((e) => `
          <li class="block">
            ${when(e.start, e.end) ? `<p class="meta">${when(e.start, e.end)}</p>` : ""}
            <h3 class="block-title">${esc(e.title)}</h3>
            <p class="org">${esc(e.school)}${e.location ? `<span>, ${esc(e.location)}</span>` : ""}</p>
            ${e.description ? `<p class="muted">${esc(e.description)}</p>` : ""}
            ${pills(e.tags, T.subjects)}
          </li>`).join("");
      const langs = (P.languages || []).filter((l) => l.name);
      const extra = `
          <div class="feature-grid extras">
            ${(P.skills || []).length ? `<div class="block block-wide"><h3 class="block-title">${T.skills}</h3>${pills(P.skills, T.skills, "pills-strong")}</div>` : ""}
            ${langs.length ? `<div class="block"><h3 class="block-title">${T.languages}</h3><ul class="lang-list">${langs.map((l) => `<li><span>${esc(l.name)}</span>${l.level ? `<span class="muted">${esc(l.level)}</span>` : ""}</li>`).join("")}</ul></div>` : ""}
          </div>`;
      return section("estudios", T.titles.estudios, `
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
            ${pills(x.tags, T.tools)}
          </li>`;
      }).join("");
      return section("experiencia", T.titles.experiencia, `
          <ol class="jobs" reversed>${items}
          </ol>`, band);
    },
    proyectos: (band) => {
      const img = (p, sizes) => p.image ? `<div class="media">${picture(p.image, { alt: p.imageAlt, sizes })}</div>` : "";
      const meta = (p) => [p.context, p.year].filter(Boolean).join(", ");
      const [first, ...rest] = projects;
      const featured = first ? `
          <article class="featured${first.image ? " has-media" : ""}" id="${pid(first)}" aria-labelledby="${pid(first)}-t">
            <div class="featured-copy">
              ${meta(first) ? `<p class="meta">${esc(meta(first))}</p>` : ""}
              <h3 class="featured-title" id="${pid(first)}-t">${esc(first.title)}</h3>
              <p class="featured-summary">${esc(first.summary.trim())}</p>
              ${first.details ? `<p class="featured-details">${esc(first.details)}</p>` : ""}
              ${pills(first.tags)}
              ${linkPills(first, "featured")}
            </div>
            ${img(first, "(max-width: 64rem) calc(100vw - 2rem), 22rem")}
          </article>` : "";
      const items = rest.map((p) => `
            <li>
              <article class="project" id="${pid(p)}" aria-labelledby="${pid(p)}-t">
                ${img(p, "(max-width: 46rem) calc(100vw - 2rem), (max-width: 52rem) 45vw, 22rem")}
                <div class="block">
                  ${meta(p) ? `<p class="meta">${esc(meta(p))}</p>` : ""}
                  <h3 class="block-title" id="${pid(p)}-t">${esc(p.title)}</h3>
                  <p>${esc(p.summary.trim())}</p>
                  ${p.details ? `<p class="muted">${esc(p.details)}</p>` : ""}
                  ${pills(p.tags)}
                  ${linkPills(p)}
                </div>
              </article>
            </li>`).join("");
      return section("proyectos", T.titles.proyectos, `${S.projectsNote ? `
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
      return section("aficiones", S.hobbiesTitle || T.titles.aficiones, `${S.hobbiesIntro ? `
          <p class="lead">${esc(S.hobbiesIntro)}</p>` : ""}
          <div class="pile" style="--count:${hobbies.length}">
            <div class="pile-stage">
              <ol class="pile-list">${items}
              </ol>
            </div>
          </div>`, band);
    },
  };

  const navItems = (pre = "") => [...sectionKeys, "contacto"]
    .map((k) => `<li><a href="${pre}#${T.ids[k]}">${T.nav[k]}</a></li>`).join("\n          ");

  const langSwitch = (href) =>
    `<a class="lang-switch" href="${esc(href)}" hreflang="${other}" lang="${other}"><span aria-hidden="true">${other.toUpperCase()}</span><span class="visually-hidden">${O.switchTo}</span></a>`;

  const cv = P.cv ? asset(P.cv) : "";
  const headerFor = (pre, altHref) => `
  <header class="site-header">
    <nav class="wrap nav" aria-label="${T.navMain}">
      <a class="logo" href="${homePath(lang)}" aria-label="${esc(T.home(P.handle))}">${logoMark}<span>${esc(P.handle)}</span></a>
      <ul class="nav-links" id="nav-links">
          ${navItems(pre)}
      </ul>
      <div class="nav-tools">
        ${langSwitch(altHref)}
        ${cv ? `<a class="btn btn-ghost btn-sm nav-cv" href="${esc(cv)}" download>${I.download}<span>CV</span><span class="visually-hidden">${T.cvPdf}</span></a>` : ""}
        <button class="icon-btn menu-toggle" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="${T.openMenu}">${I.menu}</button>
      </div>
    </nav>
  </header>`;

  const footerFor = (pre, altHref) => `
  <footer class="site-footer">
    <div class="wrap">
      <p class="footer-mark" aria-hidden="true">${logoMark}<span>${esc(P.handle)}</span></p>
      <div class="footer-cols">
        <nav aria-label="${T.navSections}"><ul>
          ${navItems(pre)}
        </ul></nav>
        <ul>
          ${P.email ? `<li><a href="mailto:${esc(P.email)}">${esc(P.email)}</a></li>` : ""}
          ${P.linkedin ? `<li><a ${ext(P.linkedin)}>LinkedIn</a></li>` : ""}
          ${P.github ? `<li><a ${ext(P.github)}>GitHub</a></li>` : ""}
          <li><a href="${esc(altHref)}" hreflang="${other}" lang="${other}">${O.switchTo}</a></li>
        </ul>
      </div>
      <div class="footer-legal">
        <p>© ${now.getFullYear()} ${esc(P.name)}</p>
        <p><a href="${privacyPath(lang)}">${T.privacyLink}</a></p>
        <p>${T.updated} ${updatedLabel}</p>
      </div>
    </div>
  </footer>`;

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
            <p class="statement-text">${esc(P.summary.trim())}</p>
            <div class="actions">
              <a class="btn btn-primary" href="#${T.ids.proyectos}">${T.viewProjects}${I.arrowDown}</a>
              ${P.email ? `<a class="btn btn-ghost" href="mailto:${esc(P.email)}">${T.writeMe}</a>` : ""}
            </div>
          </div>
        </div>
        ${metaItems ? `<ul class="hero-meta">
          ${metaItems}
        </ul>` : ""}
      </div>
    </section>`;

  const contact = section("contacto", T.titles.contacto, `
          <p class="lead">${esc(P.contactText || T.contactText)}</p>
          ${P.email ? `<a class="contact-mail" href="mailto:${esc(P.email)}">${esc(P.email)}</a>` : ""}
          <div class="actions">
            ${cv ? `<a class="btn btn-primary" href="${esc(cv)}" download>${I.download}${T.downloadCv}</a>` : ""}
            ${P.linkedin ? `<a class="btn btn-ghost" ${ext(P.linkedin)}>LinkedIn${I.out}</a>` : ""}
            ${P.github ? `<a class="btn btn-ghost" ${ext(P.github)}>GitHub${I.out}</a>` : ""}
            ${P.phone ? `<a class="btn btn-ghost" href="tel:${esc(P.phone.replace(/\s+/g, ""))}">${esc(P.phone)}</a>` : ""}
          </div>`, sectionKeys.length % 2 === 1);

  const pageUrl = homeUrl(lang);
  const ogImage = absUrl(S.ogImage || P.photo);
  const [locality, region] = (P.location || "").split(",").map((s) => s.trim());
  const personId = SITE + "#person";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": SITE + "#website", url: SITE, name: P.name, alternateName: P.handle, inLanguage: LANGS.map((l) => LOCALES[l].ld), publisher: { "@id": personId } },
      {
        "@type": "ProfilePage", "@id": pageUrl + "#profile", url: pageUrl, name: S.title, description: S.description,
        isPartOf: { "@id": SITE + "#website" }, mainEntity: { "@id": personId }, about: { "@id": personId },
        dateModified: now.toISOString(), inLanguage: T.ld,
        primaryImageOfPage: { "@type": "ImageObject", url: absUrl(P.photoFallback || P.photo) },
      },
      {
        "@type": "Person", "@id": personId, name: P.name, givenName: P.givenName, familyName: P.familyName,
        alternateName: P.handle, jobTitle: P.role, description: P.summary.trim(), url: pageUrl,
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
        "@type": "ItemList", "@id": pageUrl + "#" + T.ids.proyectos, name: T.projectsList,
        itemListElement: projects.map((p, i) => ({
          "@type": "ListItem", position: i + 1,
          item: {
            "@type": "CreativeWork", name: p.title, description: p.summary.trim(), inLanguage: T.ld,
            url: p.demo || p.repo || `${pageUrl}#${T.ids.project}${p.id}`,
            ...(p.image ? { image: absUrl(p.image) } : {}),
            keywords: (p.tags || []).join(", "), creator: { "@id": personId },
            ...(p.year ? { dateCreated: String(p.year) } : {}),
          },
        })),
      },
    ],
  };
  const ld = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  const head = ({ title, description, canonical, alts = [], robots = "index, follow, max-image-preview:large, max-snippet:-1", extra = "" }) => `<!doctype html>
<html lang="${T.html}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="author" content="${esc(P.name)}">
  <meta name="robots" content="${robots}">
  ${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
  ${alts.map(([hl, href]) => `<link rel="alternate" hreflang="${hl}" href="${esc(href)}">`).join("\n  ")}
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
  <meta property="og:locale" content="${T.og}">
  <meta property="og:locale:alternate" content="${O.og}">
  <meta property="og:title" content="${esc(S.title)}">
  <meta property="og:description" content="${esc(S.description)}">
  <meta property="og:url" content="${esc(pageUrl)}">
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

  const home = `${head({ title: S.title, description: S.description, canonical: pageUrl, alts: alternates(homeUrl), extra: seoExtra })}
<body>
  <a class="skip" href="#contenido">${T.skip}</a>${headerFor("", homePath(other))}
  <main id="contenido">${hero}${sectionKeys.map((k, i) => sections[k](i % 2 === 1)).join("")}${contact}
  </main>${footerFor("", homePath(other))}
  <script>${js}</script>
</body>
</html>
`;

  const mail = P.email ? `<a href="mailto:${esc(P.email)}">${esc(P.email)}</a>` : "";
  const privacy = `${head({ title: `${T.privacyTitle} | ${P.name}`, description: T.privacyDesc(P.name), canonical: privacyUrl(lang), alts: alternates(privacyUrl) })}
<body>
  <a class="skip" href="#contenido">${T.skip}</a>${headerFor(homePath(lang), privacyPath(other))}
  <main id="contenido">
    <section class="section legal" aria-labelledby="privacidad-title">
      <div class="wrap section-grid">
        <h1 class="section-title" id="privacidad-title">${T.privacyTitle}.</h1>
        <div class="section-body">${T.privacyBody(P, mail, updatedLabel)}
        </div>
      </div>
    </section>
  </main>${footerFor(homePath(lang), privacyPath(other))}
  <script>${js}</script>
</body>
</html>
`;

  return { home, privacy, head, headerFor, footerFor, P, projects };
};

const out = Object.fromEntries(LANGS.map((l) => [l, render(l)]));
const es = out.es;

const notFound = `${es.head({ title: `Página no encontrada | ${es.P.name}`, description: "Esta página no existe.", robots: "noindex, follow" })}
<body>
${es.headerFor(BASE, homePath("en"))}
  <main class="hero notfound" id="contenido">
    <div class="wrap">
      <h1 class="wordmark"><span class="line"><span>404</span></span></h1>
      <div>
        <p class="statement-title">Esta página no existe.</p>
        <p class="statement-text" lang="en">This page doesn't exist.</p>
      </div>
      <div class="actions">
        <a class="btn btn-primary" href="${BASE}">Volver al inicio</a>
        <a class="btn btn-ghost" href="${homePath("en")}" hreflang="en" lang="en">Go to the English site</a>
      </div>
    </div>
  </main>${es.footerFor(BASE, homePath("en"))}
  <script>${js}</script>
</body>
</html>
`;

const xhtmlAlts = (fn) => alternates(fn).map(([hl, href]) => `
    <xhtml:link rel="alternate" hreflang="${hl}" href="${esc(href)}"/>`).join("");
const images = [es.P.photoFallback || es.P.photo, ...es.projects.map((p) => p.image)].filter(Boolean)
  .map((src) => `
    <image:image><image:loc>${esc(absUrl(src))}</image:loc></image:image>`).join("");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">${LANGS.map((l) => `
  <url>
    <loc>${esc(homeUrl(l))}</loc>${xhtmlAlts(homeUrl)}
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${l === "es" ? "1.0" : "0.9"}</priority>${images}
  </url>`).join("")}${LANGS.map((l) => `
  <url>
    <loc>${esc(privacyUrl(l))}</loc>${xhtmlAlts(privacyUrl)}
    <lastmod>${today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.2</priority>
  </url>`).join("")}
</urlset>
`;
const robots = `User-agent: *
Allow: /
Disallow: ${BASE}admin/

Sitemap: ${SITE}sitemap.xml
`;
const manifest = JSON.stringify({
  name: es.P.name, short_name: es.P.handle, lang: S0.lang || "es", start_url: BASE, scope: BASE, display: "browser",
  background_color: "#000000", theme_color: "#000000",
  icons: [
    { src: BASE + "favicon.svg", sizes: "any", type: "image/svg+xml" },
    { src: BASE + "icon-512.png", sizes: "512x512", type: "image/png" },
  ],
}, null, 2);

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
if (existsSync(join(ROOT, "public"))) cpSync(join(ROOT, "public"), DIST, { recursive: true });
for (const l of LANGS) {
  const dir = join(DIST, LOCALES[l].dir);
  mkdirSync(join(dir, LOCALES[l].privacy), { recursive: true });
  writeFileSync(join(dir, "index.html"), out[l].home);
  writeFileSync(join(dir, LOCALES[l].privacy, "index.html"), out[l].privacy);
}
writeFileSync(join(DIST, "404.html"), notFound);
writeFileSync(join(DIST, "sitemap.xml"), sitemap);
writeFileSync(join(DIST, "robots.txt"), robots);
writeFileSync(join(DIST, "site.webmanifest"), manifest);
writeFileSync(join(DIST, ".nojekyll"), "");
if (S0.customDomain) writeFileSync(join(DIST, "CNAME"), S0.customDomain.trim() + "\n");

console.log(`✔ Web generada en dist/ (${LANGS.map((l) => `${l}: ${(out[l].home.length / 1024).toFixed(1)} KB`).join(", ")}) para ${SITE}`);
