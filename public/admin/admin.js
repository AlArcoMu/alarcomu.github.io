
const CONTENT_PATH = "content/content.json";
const API = "https://api.github.com";
const store = {
  get: (k, s = localStorage) => { try { return s.getItem(k); } catch { return null; } },
  set: (k, v, s = localStorage) => { try { s.setItem(k, v); return true; } catch { return false; } },
  del: (k) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch {} },
};

const S = { cfg: null, token: null, data: null, original: "", originalNorm: "", baseSha: null, files: new Map(), previews: new Map(), tab: "projects", force: false };

const $ = (sel, el = document) => el.querySelector(sel);
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const norm = (s) => { try { return JSON.stringify(JSON.parse(s)); } catch { return s; } };
const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item";
const uid = (s) => `${slug(s)}-${Date.now().toString(36).slice(-4)}`;
const isAbs = (u) => /^(https?:)?\/\//.test(u || "");
const imgSrc = (p) => (!p ? "" : S.previews.get(p) || (isAbs(p) ? p : "../" + p.replace(/^\/+/, "")));
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtYM = (s) => { const m = /^(\d{4})-(\d{2})$/.exec(s || ""); return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : s || ""; };
const range = (a, b, current) => [fmtYM(a), b ? fmtYM(b) : current && a ? "actualidad" : ""].filter(Boolean).join(" – ");
const initials = (t = "") => t.split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || t.slice(0, 2).toUpperCase();

function toast(content, ms = 5000) {
  const t = $("#toast");
  t.replaceChildren(typeof content === "string" ? document.createTextNode(content) : content);
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}

const rp = () => `/repos/${encodeURIComponent(S.cfg.owner)}/${encodeURIComponent(S.cfg.repo)}`;
async function gh(path, { method = "GET", body, raw = false } = {}) {
  const res = await fetch(API + path, {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${S.token}`,
      Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).message || msg; } catch {}
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }
  if (res.status === 204) return null;
  return raw ? res.text() : res.json();
}
const bytesToB64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const textToB64 = (t) => bytesToB64(new TextEncoder().encode(t));
const blobToB64 = async (b) => bytesToB64(new Uint8Array(await b.arrayBuffer()));

function explain(err) {
  if (err.status === 401) return "El token no es válido o ha caducado. Genera uno nuevo y vuelve a conectar.";
  if (err.status === 403) return "GitHub ha rechazado la petición. Revisa que el token tenga permiso Contents: Read and write en este repositorio.";
  if (err.status === 404) return "No encuentro el repositorio, la rama o el archivo content/content.json. Revisa los datos y que el token tenga acceso a ese repositorio.";
  if (err.status === 409 || err.status === 422) return "La rama ha cambiado mientras publicabas. Vuelve a intentarlo.";
  if (err instanceof TypeError) return "No hay conexión con GitHub. Comprueba tu red y vuelve a intentarlo.";
  return `GitHub respondió: ${err.message}`;
}

function loadSession() {
  const cfg = store.get("admin:cfg");
  S.cfg = cfg ? JSON.parse(cfg) : null;
  S.token = store.get("admin:token", sessionStorage) || store.get("admin:token");
}
function showLogin(error) {
  $("#app").hidden = true;
  $("#login").hidden = false;
  const f = $("#login-form");
  if (S.cfg) { f.owner.value = S.cfg.owner; f.repo.value = S.cfg.repo; f.branch.value = S.cfg.branch; }
  const e = $("#login-error");
  e.hidden = !error;
  e.textContent = error || "";
  (S.cfg ? f.token : f.owner).focus();
}

$("#login-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.currentTarget;
  if (!f.checkValidity()) return f.reportValidity();
  S.cfg = { owner: f.owner.value.trim(), repo: f.repo.value.trim(), branch: f.branch.value.trim() };
  S.token = f.token.value.trim();
  const btn = $("#login-btn");
  btn.disabled = true;
  btn.replaceChildren(h("span", { class: "spinner", "aria-hidden": "true" }), " Conectando…");
  try {
    await connect();
    store.set("admin:cfg", JSON.stringify(S.cfg));
    store.del("admin:token");
    store.set("admin:token", S.token, f.remember.checked ? localStorage : sessionStorage);
    f.token.value = "";
  } catch (err) {
    showLogin(err.userMessage || explain(err));
  } finally {
    btn.disabled = false;
    btn.textContent = "Conectar";
  }
});

$("#logout-btn").addEventListener("click", () => {
  if (isDirty() && !confirm("Tienes cambios sin publicar. Se guardan como borrador en este navegador. ¿Salir?")) return;
  store.del("admin:token");
  S.token = null;
  showLogin();
});

async function connect() {
  const repo = await gh(rp());
  if (!repo.permissions?.push) {
    const e = new Error("sin permisos");
    e.userMessage = "El token puede leer el repositorio pero no escribir en él. Dale el permiso Contents: Read and write.";
    throw e;
  }
  await loadContent();
  $("#login").hidden = true;
  $("#app").hidden = false;
  render();
}

async function loadContent() {
  const ref = await gh(`${rp()}/git/ref/heads/${encodeURIComponent(S.cfg.branch)}`);
  S.baseSha = ref.object.sha;
  S.original = await gh(`${rp()}/contents/${CONTENT_PATH}?ref=${S.baseSha}`, { raw: true });
  S.originalNorm = norm(S.original);
  S.data = JSON.parse(S.original);
  S.files.clear();

  const draftRaw = store.get(draftKey());
  if (draftRaw) {
    try {
      const d = JSON.parse(draftRaw);
      const same = JSON.stringify(d.data) === S.originalNorm;
      if (!same && d.originalNorm === S.originalNorm) {
        const when = new Date(d.savedAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
        if (confirm(`Tienes cambios sin publicar del ${when}. ¿Quieres recuperarlos?`)) S.data = d.data;
        else store.del(draftKey());
      } else if (!same) {
        store.del(draftKey());
        toast("Había un borrador antiguo, pero el contenido cambió en GitHub desde entonces y se ha descartado.");
      }
    } catch { store.del(draftKey()); }
  }
}

const draftKey = () => `admin:draft:${S.cfg.owner}/${S.cfg.repo}`;
const referencedFiles = () => {
  const json = JSON.stringify(S.data);
  return [...S.files.entries()].filter(([, f]) => json.includes(`"${f.sitePath}"`));
};
const isDirty = () => !!S.data && (JSON.stringify(S.data) !== S.originalNorm || referencedFiles().length > 0);
const LABELS = { settings: "Ajustes y SEO", profile: "Perfil", experience: "Experiencia", education: "Estudios", projects: "Proyectos" };
function changedSections() {
  const orig = JSON.parse(S.original);
  return Object.keys(LABELS).filter((k) => JSON.stringify(S.data[k]) !== JSON.stringify(orig[k]));
}
let draftTimer;
function changed() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    if (isDirty()) store.set(draftKey(), JSON.stringify({ data: S.data, originalNorm: S.originalNorm, savedAt: Date.now() }));
    else store.del(draftKey());
  }, 400);
  updateStatus();
}
function updateStatus() {
  const dirty = isDirty();
  const st = $("#status");
  const sections = changedSections();
  const nFiles = referencedFiles().length;
  st.classList.toggle("dirty", dirty);
  st.textContent = dirty
    ? `Cambios sin publicar en ${[...sections.map((k) => LABELS[k].toLowerCase()), ...(nFiles ? [`${nFiles} ${nFiles === 1 ? "imagen" : "imágenes"}`] : [])].join(", ")}`
    : `Todo publicado · ${S.cfg.owner}/${S.cfg.repo}`;
  $("#publish-btn").disabled = !dirty;
  $("#discard-btn").hidden = !dirty;
  document.querySelectorAll(".tabs button").forEach((b) => {
    const has = sections.includes(b.dataset.tab);
    b.querySelector(".dot")?.remove();
    if (has) b.append(h("span", { class: "dot", "aria-label": "con cambios" }));
  });
}
window.addEventListener("beforeunload", (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ""; } });

$("#discard-btn").addEventListener("click", () => {
  if (!confirm("Se descartarán todos los cambios sin publicar. ¿Continuar?")) return;
  S.data = JSON.parse(S.original);
  S.files.clear();
  store.del(draftKey());
  render();
  toast("Cambios descartados.");
});

async function processImage(file, { w, h: hh, type = "image/webp" }) {
  const bmp = await createImageBitmap(file);
  const ratio = w / hh;
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (sw / sh > ratio) { const nw = sh * ratio; sx = (sw - nw) / 2; sw = nw; } else { const nh = sw / ratio; sy = (sh - nh) / 2; sh = nh; }
  const tw = Math.round(Math.min(w, sw)), th = Math.round(tw / ratio);
  const canvas = Object.assign(document.createElement("canvas"), { width: tw, height: th });
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, tw, th);
  let blob = await new Promise((r) => canvas.toBlob(r, type, 0.86));
  if (!blob || blob.type !== type) blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.88));
  return blob;
}
function addPending(blob, dir, name) {
  const extn = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" }[blob.type] || "bin";
  const sitePath = `${dir}/${name}.${extn}`;
  const url = URL.createObjectURL(blob);
  S.files.set("public/" + sitePath, { blob, sitePath });
  S.previews.set(sitePath, url);
  return sitePath;
}
const IMAGE_KINDS = {
  project: { w: 1600, h: 1000, dir: "uploads", round: false, hint: "Se recorta a 16:10 y se optimiza a WebP." },
  photo: { w: 800, h: 800, dir: "img", round: true, hint: "Se recorta en cuadrado y se optimiza a WebP." },
  og: { w: 1200, h: 630, dir: "img", round: false, type: "image/jpeg", hint: "Imagen al compartir en redes: 1200 × 630, JPG." },
};

function counterFor(input, [min, max]) {
  const c = h("span", { class: "counter" });
  const upd = () => {
    const n = input.value.length;
    c.textContent = `${n} caracteres (ideal ${min}–${max})`;
    c.className = "counter " + (n >= min && n <= max ? "ok" : n > max + 15 || n < min / 2 ? "bad" : "warn");
  };
  input.addEventListener("input", upd);
  upd();
  return c;
}

function field(def, obj, onChange = changed) {
  const id = `f-${def.key}-${Math.random().toString(36).slice(2, 7)}`;
  const set = (v) => { obj[def.key] = v; onChange(); };
  const label = h("span", {}, def.label, def.required ? h("span", { class: "req", "aria-hidden": "true" }, "*") : null);
  const hint = def.hint ? h("small", { id: id + "-h" }, def.hint) : null;
  const common = { id, name: def.key, required: def.required, "aria-describedby": def.hint ? id + "-h" : null, placeholder: def.placeholder };
  let control;

  switch (def.type) {
    case "textarea": {
      control = h("textarea", { ...common, rows: def.rows || 3, maxlength: def.maxlength, oninput: (e) => set(e.target.value) });
      control.value = obj[def.key] || "";
      break;
    }
    case "lines": {
      control = h("textarea", { ...common, rows: def.rows || 4, oninput: (e) => set(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)) });
      control.value = (obj[def.key] || []).join("\n");
      break;
    }
    case "tags": {
      control = h("input", { ...common, oninput: (e) => set(e.target.value.split(",").map((s) => s.trim()).filter(Boolean)) });
      control.value = (obj[def.key] || []).join(", ");
      break;
    }
    case "langs": {
      control = h("textarea", { ...common, rows: 3, oninput: (e) => set(e.target.value.split("\n").map((l) => l.split("|").map((s) => s.trim())).filter(([n]) => n).map(([name, level = ""]) => ({ name, level }))) });
      control.value = (obj[def.key] || []).map((l) => (l.level ? `${l.name} | ${l.level}` : l.name)).join("\n");
      break;
    }
    case "check": {
      const cb = h("input", { type: "checkbox", id, onchange: (e) => set(e.target.checked) });
      cb.checked = !!obj[def.key];
      return h("label", { class: "check" }, cb, def.label);
    }
    case "month": {
      control = h("input", { ...common, type: "month", pattern: "\\d{4}-\\d{2}", placeholder: "2025-05", oninput: (e) => set(e.target.value) });
      control.value = obj[def.key] || "";
      break;
    }
    case "image": return imageField(def, obj, set, label, hint);
    case "pdf": return pdfField(def, obj, set, label, hint);
    case "order": return orderField(def, obj, set);
    default: {
      control = h("input", { ...common, type: def.type || "text", maxlength: def.maxlength, oninput: (e) => set(e.target.value.trim() === "" ? "" : e.target.value), autocomplete: "off" });
      control.value = obj[def.key] ?? "";
    }
  }
  const wrap = h("div", { class: "field" }, h("label", { for: id }, label), control);
  if (def.seo) wrap.append(counterFor(control, def.seo));
  if (hint) wrap.append(hint);
  return wrap;
}

function imageField(def, obj, set, label, hint) {
  const kind = IMAGE_KINDS[def.kind || "project"];
  const preview = h("div", { class: "image-preview" + (kind.round ? " round" : "") });
  const input = h("input", { type: "file", accept: "image/*", hidden: true });
  const remove = h("button", { type: "button", class: "btn btn-danger btn-sm", text: "Quitar" });
  const choose = h("button", { type: "button", class: "btn btn-ghost btn-sm", text: "Elegir imagen", onclick: () => input.click() });
  const paint = () => {
    const p = obj[def.key];
    preview.replaceChildren(p ? h("img", { src: imgSrc(p), alt: "" }) : document.createTextNode("Sin imagen"));
    remove.hidden = !p || def.required;
    choose.textContent = p ? "Cambiar imagen" : "Elegir imagen";
  };
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    choose.disabled = true;
    choose.textContent = "Optimizando…";
    try {
      const blob = await processImage(file, kind);
      const base = def.kind === "photo" ? "alberto" : def.kind === "og" ? "og" : slug(obj.title || file.name.replace(/\.[^.]+$/, ""));
      set(addPending(blob, kind.dir, `${base}-${Date.now().toString(36)}`));
      if (def.kind === "photo") obj.photoFallback = "";
    } catch {
      toast("No he podido leer esa imagen. Prueba con un JPG, PNG o WebP.");
    } finally {
      choose.disabled = false;
      input.value = "";
      paint();
    }
  });
  remove.addEventListener("click", () => { set(""); paint(); });
  paint();
  return h("div", { class: "field" }, label,
    h("div", { class: "image-field" }, preview, h("div", { class: "image-actions" }, choose, remove), input),
    h("small", {}, def.hint || kind.hint));
}

function pdfField(def, obj, set, label, hint) {
  const name = h("span", { class: "muted" });
  const input = h("input", { type: "file", accept: "application/pdf", hidden: true });
  const paint = () => (name.textContent = obj[def.key] ? obj[def.key].split("/").pop() : "Sin archivo");
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") return toast("El CV tiene que ser un PDF.");
    if (file.size > 8 * 1024 * 1024) return toast("El PDF pesa más de 8 MB. Expórtalo con menos calidad.");
    set(addPending(file, "cv", "Alberto-Arcones-Munoz-CV-" + Date.now().toString(36)));
    input.value = "";
    paint();
  });
  paint();
  return h("div", { class: "field" }, label,
    h("div", { class: "image-field" }, name, h("button", { type: "button", class: "btn btn-ghost btn-sm", text: "Subir PDF", onclick: () => input.click() }), input),
    hint);
}

function orderField(def, obj, set) {
  const names = { estudios: "Estudios", experiencia: "Experiencia laboral", proyectos: "Proyectos" };
  const list = h("ol", { class: "order-list" });
  const paint = () => {
    const arr = obj[def.key] || ["estudios", "experiencia", "proyectos"];
    list.replaceChildren(...arr.map((k, i) => h("li", {}, h("span", {}, `${i + 1}. ${names[k] || k}`),
      h("span", { class: "btns" },
        h("button", { type: "button", class: "icon-btn", "aria-label": `Subir ${names[k]}`, disabled: i === 0, onclick: () => move(i, -1), text: "↑" }),
        h("button", { type: "button", class: "icon-btn", "aria-label": `Bajar ${names[k]}`, disabled: i === arr.length - 1, onclick: () => move(i, 1), text: "↓" })))));
  };
  const move = (i, d) => { const arr = [...(obj[def.key] || ["estudios", "experiencia", "proyectos"])]; [arr[i], arr[i + d]] = [arr[i + d], arr[i]]; set(arr); paint(); };
  paint();
  return h("div", { class: "field" }, h("span", {}, def.label), list, h("small", {}, "Contacto aparece siempre al final."));
}

const SCHEMAS = {
  projects: {
    title: "Proyectos", singular: "proyecto", add: "Añadir proyecto",
    intro: "Aparecen en la web en este orden, en una cuadrícula de dos columnas.",
    fields: [
      { key: "title", label: "Título", required: true, maxlength: 70 },
      [{ key: "context", label: "Contexto", placeholder: "Proyecto personal" }, { key: "year", label: "Año", placeholder: "2026", maxlength: 4 }],
      { key: "summary", label: "Resumen", type: "textarea", required: true, seo: [80, 200], hint: "Qué es y qué problema resuelve, en una o dos frases." },
      { key: "details", label: "Detalles", type: "textarea", hint: "Cómo está hecho o qué aporta. Opcional." },
      { key: "image", label: "Imagen", type: "image", kind: "project" },
      { key: "imageAlt", label: "Texto alternativo de la imagen", hint: "Describe la imagen para lectores de pantalla y Google. Obligatorio si hay imagen." },
      { key: "tags", label: "Tecnologías", type: "tags", hint: "Separadas por comas." },
      [{ key: "repo", label: "Enlace al código", type: "url", placeholder: "https://github.com/alarcomu/…" }, { key: "demo", label: "Enlace a la demo", type: "url", placeholder: "https://…" }],
    ],
    blank: () => ({ id: "", title: "", year: String(new Date().getFullYear()), context: "Proyecto personal", summary: "", details: "", image: "", imageAlt: "", tags: [], repo: "", demo: "" }),
    row: (p) => ({ title: p.title, sub: [p.context, p.year, (p.tags || []).slice(0, 4).join(", ")].filter(Boolean).join(" · "), thumb: p.image ? imgSrc(p.image) : initials(p.title) }),
  },
  experience: {
    title: "Experiencia", singular: "experiencia", add: "Añadir experiencia",
    intro: "Pon primero la más reciente. Deja la fecha de fin vacía si sigues en el puesto.",
    fields: [
      { key: "role", label: "Puesto", required: true },
      [{ key: "company", label: "Empresa", required: true }, { key: "location", label: "Ubicación", placeholder: "Toledo o En remoto" }],
      { key: "client", label: "Cliente o proyecto", placeholder: "Proyecto Inditex" },
      [{ key: "start", label: "Inicio", type: "month", required: true }, { key: "end", label: "Fin", type: "month", hint: "Vacío = actualidad." }],
      { key: "highlights", label: "Logros y funciones", type: "lines", rows: 6, hint: "Una por línea. Empieza por un verbo o un sustantivo de acción." },
      { key: "tags", label: "Herramientas", type: "tags", hint: "Separadas por comas." },
    ],
    blank: () => ({ id: "", role: "", company: "", client: "", location: "", start: "", end: "", highlights: [], tags: [] }),
    row: (x) => ({ title: x.role, sub: [x.company, range(x.start, x.end, true)].filter(Boolean).join(" · ") }),
  },
  education: {
    title: "Estudios", singular: "formación", add: "Añadir formación",
    intro: "Títulos, cursos y certificaciones. Las fechas son opcionales.",
    fields: [
      { key: "title", label: "Título", required: true },
      [{ key: "school", label: "Centro", required: true }, { key: "location", label: "Ubicación" }],
      [{ key: "start", label: "Inicio", type: "month" }, { key: "end", label: "Fin", type: "month" }],
      { key: "description", label: "Descripción", type: "textarea" },
      { key: "tags", label: "Materias", type: "tags", hint: "Separadas por comas." },
    ],
    blank: () => ({ id: "", title: "", school: "", location: "", start: "", end: "", description: "", tags: [] }),
    row: (e) => ({ title: e.title, sub: [e.school, range(e.start, e.end)].filter(Boolean).join(" · ") }),
  },
};

const PROFILE_GROUPS = [
  { title: "Nombre y titular", fields: [
    { key: "name", label: "Nombre completo", required: true },
    [{ key: "nameLine1", label: "Nombre en portada, línea 1" }, { key: "nameLine2", label: "Línea 2" }],
    [{ key: "givenName", label: "Nombre" }, { key: "familyName", label: "Apellidos" }],
    [{ key: "role", label: "Puesto", required: true }, { key: "handle", label: "Alias" }],
    { key: "summary", label: "Presentación", type: "textarea", rows: 4, seo: [120, 280], hint: "Las líneas bajo tu nombre en la portada." },
  ] },
  { title: "Foto y CV", fields: [
    { key: "photo", label: "Foto", type: "image", kind: "photo" },
    { key: "photoAlt", label: "Texto alternativo de la foto" },
    { key: "cv", label: "CV en PDF", type: "pdf", hint: "Se descarga desde la cabecera y la sección de contacto. Incluye los datos que pongas en él." },
  ] },
  { title: "Contacto y disponibilidad", fields: [
    [{ key: "email", label: "Email", type: "email" }, { key: "phone", label: "Teléfono", type: "tel", hint: "Opcional. Será público en la web." }],
    [{ key: "linkedin", label: "LinkedIn", type: "url" }, { key: "github", label: "GitHub", type: "url" }],
    { key: "location", label: "Ubicación", placeholder: "Borox, Toledo" },
    { key: "available", label: "Mostrar que estoy disponible", type: "check" },
    { key: "availabilityText", label: "Texto de disponibilidad" },
    { key: "contactText", label: "Texto de la sección de contacto", type: "textarea", rows: 2 },
  ] },
  { title: "Habilidades e idiomas", fields: [
    { key: "skills", label: "Habilidades", type: "lines", rows: 6, hint: "Una por línea." },
    { key: "languages", label: "Idiomas", type: "langs", hint: "Una por línea, con el nivel tras una barra: Inglés | B2" },
  ] },
];

const SETTINGS_GROUPS = [
  { title: "Buscadores", seo: true, fields: [
    { key: "title", label: "Título de la página", required: true, seo: [30, 60] },
    { key: "description", label: "Meta descripción", type: "textarea", required: true, seo: [110, 160] },
    { key: "keywords", label: "Palabras clave", type: "lines", rows: 5, hint: "Una por línea. Úsalas también en tus textos: es lo que de verdad cuenta." },
    { key: "ogImage", label: "Imagen para redes sociales", type: "image", kind: "og" },
  ] },
  { title: "Estructura", fields: [
    { key: "order", label: "Orden de las secciones", type: "order" },
    { key: "projectsNote", label: "Nota junto al título de Proyectos", placeholder: "Opcional" },
  ] },
  { title: "Dominio", fields: [
    { key: "siteUrl", label: "URL de la web", type: "url", required: true, hint: "Se usa para la URL canónica, el sitemap y las imágenes al compartir." },
    { key: "customDomain", label: "Dominio propio", placeholder: "albertoarconesmunoz.com", hint: "Opcional. Si lo rellenas, se genera el archivo CNAME. Cambia también la URL de arriba." },
  ] },
];

function fieldsBlock(defs, obj, onChange) {
  return defs.map((d) => (Array.isArray(d) ? h("div", { class: "grid-2" }, d.map((x) => field(x, obj, onChange))) : field(d, obj, onChange)));
}

function render() {
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === S.tab)));
  const panel = $("#panel");
  panel.replaceChildren();
  if (SCHEMAS[S.tab]) renderList(panel, S.tab);
  else if (S.tab === "profile") renderGroups(panel, "Perfil", "Tus datos personales y lo que aparece en la portada.", PROFILE_GROUPS, S.data.profile);
  else renderSettings(panel);
  updateStatus();
}

function renderList(panel, key) {
  const sc = SCHEMAS[key];
  const arr = (S.data[key] ||= []);
  panel.append(h("div", { class: "panel-head" },
    h("div", {}, h("h1", { text: sc.title }), h("p", { class: "muted", text: sc.intro })),
    h("button", { class: "btn btn-primary", type: "button", text: sc.add, onclick: () => openEditor(key, -1) })));

  if (!arr.length) {
    panel.append(h("div", { class: "empty" }, h("p", { text: `Todavía no hay ningún ${sc.singular}.` }),
      h("button", { class: "btn btn-ghost", type: "button", text: sc.add, onclick: () => openEditor(key, -1) })));
    return;
  }
  const list = h("ul", { class: "items" });
  arr.forEach((it, i) => {
    const r = sc.row(it);
    const thumb = key === "projects"
      ? h("div", { class: "item-thumb" }, r.thumb && r.thumb.length > 3 ? h("img", { src: r.thumb, alt: "" }) : r.thumb)
      : null;
    list.append(h("li", { class: "item" + (thumb ? " with-thumb" : "") },
      h("div", { class: "item-order" },
        h("button", { type: "button", class: "icon-btn", "aria-label": `Subir ${r.title}`, disabled: i === 0, text: "↑", onclick: () => move(key, i, -1) }),
        h("button", { type: "button", class: "icon-btn", "aria-label": `Bajar ${r.title}`, disabled: i === arr.length - 1, text: "↓", onclick: () => move(key, i, 1) })),
      thumb,
      h("div", {}, h("p", { class: "item-title", text: r.title || "(sin título)" }), h("p", { class: "item-sub", text: r.sub })),
      h("div", { class: "item-actions" },
        h("button", { type: "button", class: "btn btn-ghost btn-sm", text: "Editar", "aria-label": `Editar ${r.title}`, onclick: () => openEditor(key, i) }),
        h("button", { type: "button", class: "btn btn-danger btn-sm", text: "Eliminar", "aria-label": `Eliminar ${r.title}`, onclick: () => removeItem(key, i) }))));
  });
  panel.append(list);
}

function move(key, i, d) {
  const arr = S.data[key];
  [arr[i], arr[i + d]] = [arr[i + d], arr[i]];
  changed();
  render();
  $(`#panel .items li:nth-child(${i + d + 1}) .item-order button:${d < 0 ? "first-child" : "last-child"}`)?.focus();
}
function removeItem(key, i) {
  const r = SCHEMAS[key].row(S.data[key][i]);
  if (!confirm(`¿Eliminar «${r.title}»? Podrás descartarlo antes de publicar.`)) return;
  S.data[key].splice(i, 1);
  changed();
  render();
  toast(`«${r.title}» eliminado. Publica para aplicarlo en la web.`);
}

function renderGroups(panel, title, intro, groups, obj, extra) {
  panel.append(h("div", { class: "panel-head" }, h("div", {}, h("h1", { text: title }), h("p", { class: "muted", text: intro }))));
  groups.forEach((g) => {
    const card = h("section", { class: "card" }, h("h2", { text: g.title }));
    if (g.seo && extra) card.append(extra);
    card.append(...fieldsBlock(g.fields, obj, () => { changed(); extra?.refresh?.(); }));
    panel.append(card);
  });
}

function renderSettings(panel) {
  const s = S.data.settings;
  const url = h("p", { class: "serp-url" }), t = h("p", { class: "serp-title" }), d = h("p", { class: "serp-desc" });
  const serp = h("div", { class: "serp", "aria-label": "Vista previa en Google" }, url, t, d);
  serp.refresh = () => {
    url.textContent = (s.siteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    t.textContent = (s.title || "").length > 62 ? s.title.slice(0, 60) + "…" : s.title;
    d.textContent = (s.description || "").length > 162 ? s.description.slice(0, 158) + "…" : s.description;
  };
  serp.refresh();
  const wrap = h("div", { class: "field" }, h("span", { text: "Así se vería en Google" }), serp);
  wrap.refresh = serp.refresh;
  renderGroups(panel, "Ajustes y SEO", "Cómo te encuentran los buscadores y cómo se ve tu web al compartirla.", SETTINGS_GROUPS, s, wrap);
}

document.querySelectorAll(".tabs button").forEach((b) =>
  b.addEventListener("click", () => { S.tab = b.dataset.tab; render(); $("#panel").focus({ preventScroll: true }); }));

const editor = $("#editor");
let editing = null;
function openEditor(key, index) {
  const sc = SCHEMAS[key];
  const item = index < 0 ? sc.blank() : clone(S.data[key][index]);
  editing = { key, index, item };
  $("#editor-title").textContent = index < 0 ? sc.add : `Editar ${sc.singular}`;
  $("#editor-save").textContent = index < 0 ? sc.add : "Guardar cambios";
  $("#editor-body").replaceChildren(...fieldsBlock(sc.fields, item, () => {}));
  editor.showModal();
  $("#editor-body input, #editor-body textarea")?.focus();
}
editor.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) editor.close(); });
$("#editor-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const { key, index, item } = editing;
  const alt = form.querySelector('[name="imageAlt"]');
  if (alt) alt.setCustomValidity(item.image && !item.imageAlt?.trim() ? "Describe la imagen en una frase." : "");
  if (!form.checkValidity()) return form.reportValidity();
  if (item.start && item.end && item.end < item.start) {
    const end = form.querySelector('[name="end"]');
    end.setCustomValidity("La fecha de fin no puede ser anterior a la de inicio.");
    end.reportValidity();
    end.addEventListener("input", () => end.setCustomValidity(""), { once: true });
    return;
  }
  if (!item.id) item.id = uid(item.title || item.role);
  if (index < 0) S.data[key].unshift(item);
  else S.data[key][index] = item;
  editor.close();
  changed();
  render();
  toast(index < 0 ? "Añadido. Publica para verlo en la web." : "Guardado. Publica para verlo en la web.");
});
editor.addEventListener("input", (e) => { if (e.target.name === "imageAlt") e.target.setCustomValidity(""); });

const pub = $("#publish");
pub.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) pub.close(); });
function openPublish() {
  if (!isDirty()) return;
  S.force = false;
  const sections = changedSections();
  const files = referencedFiles();
  $("#change-list").replaceChildren(
    ...sections.map((k) => h("li", { text: LABELS[k] })),
    ...files.map(([path]) => h("li", { text: `Nuevo archivo: ${path.replace(/^public\//, "")}` })));
  const f = $("#publish-form");
  f.message.value = `Actualiza ${sections.map((k) => LABELS[k].toLowerCase()).join(", ") || "archivos"} desde el panel`;
  $("#publish-error").hidden = true;
  $("#publish-confirm").textContent = "Publicar";
  pub.showModal();
  f.message.select();
}
$("#publish-btn").addEventListener("click", openPublish);
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && !$("#app").hidden) { e.preventDefault(); if (!editor.open) openPublish(); }
});

$("#publish-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  if (!f.checkValidity()) return f.reportValidity();
  const btn = $("#publish-confirm");
  const err = $("#publish-error");
  err.hidden = true;
  btn.disabled = true;
  btn.replaceChildren(h("span", { class: "spinner", "aria-hidden": "true" }), " Publicando…");
  let conflict = false;
  try {
    await publish(f.message.value.trim());
    pub.close();
    const repoUrl = `https://github.com/${S.cfg.owner}/${S.cfg.repo}`;
    toast(h("span", {}, "Publicado. La web se actualizará en uno o dos minutos. ",
      h("a", { href: `${repoUrl}/actions`, target: "_blank", rel: "noopener", text: "Ver el despliegue" })), 9000);
    render();
  } catch (ex) {
    err.hidden = false;
    conflict = !!ex.conflict;
    if (conflict) {
      S.force = true;
      err.textContent = "El contenido ha cambiado en GitHub desde que abriste el panel. Pulsa «Sobrescribir y publicar» para imponer tu versión, o cancela y recarga la página para traer la última.";
    } else {
      err.textContent = explain(ex);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = S.force ? "Sobrescribir y publicar" : "Publicar";
  }
});

async function publish(message) {
  const branch = encodeURIComponent(S.cfg.branch);
  const ref = await gh(`${rp()}/git/ref/heads/${branch}`);
  const head = ref.object.sha;
  if (head !== S.baseSha && !S.force) {
    const remote = await gh(`${rp()}/contents/${CONTENT_PATH}?ref=${head}`, { raw: true });
    if (norm(remote) !== S.originalNorm) { const c = new Error("conflict"); c.conflict = true; throw c; }
  }
  const commit = await gh(`${rp()}/git/commits/${head}`);
  const json = JSON.stringify(S.data, null, 2) + "\n";
  const tree = [];
  const blob = await gh(`${rp()}/git/blobs`, { method: "POST", body: { content: textToB64(json), encoding: "base64" } });
  tree.push({ path: CONTENT_PATH, mode: "100644", type: "blob", sha: blob.sha });
  for (const [path, file] of referencedFiles()) {
    const b = await gh(`${rp()}/git/blobs`, { method: "POST", body: { content: await blobToB64(file.blob), encoding: "base64" } });
    tree.push({ path, mode: "100644", type: "blob", sha: b.sha });
  }
  const newTree = await gh(`${rp()}/git/trees`, { method: "POST", body: { base_tree: commit.tree.sha, tree } });
  const newCommit = await gh(`${rp()}/git/commits`, { method: "POST", body: { message, tree: newTree.sha, parents: [head] } });
  await gh(`${rp()}/git/refs/heads/${branch}`, { method: "PATCH", body: { sha: newCommit.sha, force: false } });

  S.baseSha = newCommit.sha;
  S.original = json;
  S.originalNorm = norm(json);
  S.files.clear();
  S.force = false;
  store.del(draftKey());
}

loadSession();
if (S.cfg && S.token) {
  connect().catch((err) => showLogin(err.userMessage || explain(err)));
} else {
  showLogin();
}
