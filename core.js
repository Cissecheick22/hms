// Socle de la maquette HMS : utilitaires partagés, registre des modules, navigation.
// Chargé après data.js et avant modules/*.js. Voir docs/MAQUETTE.md pour les conventions.
const D = window.PROTOTYPE_DATA
const $ = (s) => document.querySelector(s)
const toggleTheme = () => {
  const r = document.documentElement
  r.dataset.theme = r.dataset.theme === "dark" ? "light" : "dark"
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
const q = (s) => `'${esc(s)}'` // argument chaîne dans un onclick

// ---------- Dates et montants ----------
const day = (s) => new Date(s + "T00:00:00")
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const addDays = (s, n) => { const d = day(s); d.setDate(d.getDate() + n); return iso(d) }
const nights = (a, b) => Math.round((day(b) - day(a)) / 864e5)
const fd = (s) => s.slice(8, 10) + "/" + s.slice(5, 7)
const fdLong = (s) => day(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
const wd = (s) => day(s).toLocaleDateString("fr-FR", { weekday: "short" })
const money = (n) => Math.round(n).toLocaleString("fr-FR") + " " + D.currency
// Date hôtelière : globale, avancée par l'audit de nuit (setBusinessDate). Les modules lisent `today` au moment du rendu.
let today = D.today
const setBusinessDate = (d) => { D.today = today = d }

// ---------- Accès aux données ----------
const G = (id) => D.guests.find((g) => g.id === id)
const T = (c) => D.roomTypes.find((t) => t.code === c)
const R = (id) => D.reservations.find((r) => r.id === id)
const inHouse = () => D.reservations.filter((r) => r.status === "arrivee")
const arrivals = () => D.reservations.filter((r) => r.from === today && ["confirmee", "arrivee"].includes(r.status))
const departures = () => D.reservations.filter((r) => r.to === today && ["arrivee", "partie"].includes(r.status))
const occupant = (no) => inHouse().find((r) => r.room === no)
const readyRooms = () => D.rooms.filter((r) => r.hk === "propre" && !occupant(r.no))
// Retenues de chambres sans réservation nominative (blocs de groupes, d'événements) : chaque module en déclare
// via holdRooms((type, date) => nombre). ui.holdSkip permet à un module d'ignorer son propre bloc quand il le convertit.
const HOLDS = []
const holdRooms = (fn) => HOLDS.push(fn)
const held = (type, date) => HOLDS.reduce((s, f) => s + (f(type, date) || 0), 0)
const available = (type, date, exceptId) =>
  D.rooms.filter((r) => r.type === type && r.hk !== "hs").length -
  D.reservations.filter((r) => r.id !== exceptId && r.type === type && ["confirmee", "arrivee"].includes(r.status) && r.from <= date && date < r.to).length -
  held(type, date)
const folio = (r) => {
  const n = nights(r.from, r.to)
  const lines = [{ label: `Hébergement ${T(r.type).label} — ${n} nuit${n > 1 ? "s" : ""} × ${money(r.rate)}`, amount: n * r.rate }, ...(D.extras[r.id] || [])]
  const total = lines.reduce((s, l) => s + l.amount, 0)
  const paid = D.payments[r.id] || 0
  return { lines, total, paid, balance: total - paid }
}

const STATUS = { confirmee: ["Confirmée", "info"], arrivee: ["En séjour", "ok"], partie: ["Partie", "outline"], annulee: ["Annulée", "dark"], noshow: ["No-show", "dark"], deloge: ["Délogé", "outline"] }
const HK = { propre: ["Propre", "ok"], sale: ["Sale", "warn"], inspection: ["En inspection", "info"], hs: ["Hors commande", "dark"] } // hs = hors commande : retirée de la vente (RG-ORG-02). Le « hors service » vendable est un statut d'exploitation (org-chambres)
const pill = (map, k) => `<span class="pill ${map[k][1]}">${esc(map[k][0])}</span>`
const vip = (g) => (g.vip ? ` <span class="pill on">VIP</span>` : "")
const guestLink = (id) => `<button class="link" onclick="go('clients/${esc(id)}')">${esc(G(id).name)}</button>`
const kpi = (label, value, hint) => `<div class="card"><div class="muted">${esc(label)}</div><div class="kpi">${esc(value)}</div><div class="muted">${esc(hint)}</div></div>`
const tbl = (cols, rows, empty = "Rien à afficher.", foot = "") => rows.length
  ? `<div class="tablewrap"><table><thead><tr>${cols.map((c) => `<th class="${c.startsWith("#") ? "num" : ""}">${esc(c.replace(/^#/, ""))}</th>`).join("")}</tr></thead>
     <tbody>${rows.map((r) => `<tr>${r.map((v, i) => `<td class="${cols[i].startsWith("#") ? "num" : ""}">${v}</td>`).join("")}</tr>`).join("")}</tbody>${foot}</table></div>`
  : `<p class="muted">${esc(empty)}</p>`

// État d'interface (non métier)
const ui = { resFilter: "actives", hkFilter: "toutes", done: null, encoding: null, invoiceSeq: 1041, resSeq: 2062 }

let toastT
const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600) }
const go = (h) => { if (location.hash === "#" + h) render(); else location.hash = h }

// ---------- Composants d'interface génériques ----------
// Tous renvoient du HTML (chaîne). Les textes venant des données passent par esc().
const badge = (text, kind = "") => `<span class="pill ${kind}">${esc(text)}</span>` // kind : "" | on (=ok) | ok | warn | dark (=bad) | bad | info | outline
const pageHead = (title, lead = "", actions = "") =>
  `<div class="row between"><h1>${esc(title)}</h1>${actions ? `<span class="row">${actions}</span>` : ""}</div>${lead ? `<p class="lead">${esc(lead)}</p>` : ""}`
const btn = (label, onclick, kind = "") => `<button class="btn ${kind}" onclick="${onclick}">${esc(label)}</button>` // kind : "" | ghost | accent | sm | "ghost sm"
const card = (title, body, extra = "") => `<div class="card" ${extra}>${title ? `<h3 style="margin-top:0">${esc(title)}</h3>` : ""}${body}</div>`
const cards = (items) => `<div class="grid">${items.join("")}</div>`
// Sous-onglets d'un écran : route `${base}/${id}`
const subtabs = (base, tabs, current) =>
  `<div class="chips">${tabs.map(([id, label]) => `<button aria-pressed="${id === current}" onclick="go('${base}/${id}')">${esc(label)}</button>`).join("")}</div>`
// Filtres : la valeur courante vit dans ui[key]
const chips = (key, options, counts = {}) =>
  `<div class="chips">${Object.entries(options).map(([k, l]) => `<button aria-pressed="${ui[key] === k}" onclick="ui['${key}']='${k}';render()">${esc(l)}${counts[k] != null ? ` (${counts[k]})` : ""}</button>`).join("")}</div>`
const field = (id, label, control, cls = "") => `<div class="${cls}"><label for="${id}">${esc(label)}</label>${control}</div>`
const input = (id, value = "", attrs = "") => `<input id="${id}" value="${esc(value)}" ${attrs}>`
const select = (id, options, value, attrs = "") =>
  `<select id="${id}" ${attrs}>${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>` }).join("")}</select>`
const form = (fields) => `<div class="form">${fields.join("")}</div>`
const val = (id) => (document.getElementById(id)?.value ?? "").trim()
// Liste maître à gauche + panneau détail à droite
const split = (left, right) => `<div class="split"><div>${left}</div><div>${right}</div></div>`
const listItems = (items, current, route) =>
  `<div class="list">${items.map((it) => `<button aria-current="${it.id === current}" onclick="go('${route}/${esc(it.id)}')"><strong>${esc(it.title)}</strong>${it.badge || ""}${it.sub ? `<div class="muted">${esc(it.sub)}</div>` : ""}</button>`).join("")}</div>`
// Barres horizontales : items [{ label, value, hint? }], fmt formate la valeur
const bars = (items, fmt = (v) => v) => {
  const max = Math.max(1, ...items.map((i) => i.value))
  return `<div class="bars">${items.map((i) => `<div class="barrow"><span>${esc(i.label)}</span><span class="track"><i style="width:${(i.value / max) * 100}%"></i></span><span class="num">${esc(fmt(i.value))}</span></div>`).join("")}</div>`
}
// Colonnes verticales : labels[], values[]
const columns = (labels, values, fmt = (v) => v) => {
  const max = Math.max(1, ...values)
  return `<div class="cols-chart">${values.map((v, i) => `<div class="col" title="${esc(labels[i])} : ${esc(fmt(v))}"><span class="num">${esc(fmt(v))}</span><i style="height:${(v / max) * 100}%"></i><span class="muted">${esc(labels[i])}</span></div>`).join("")}</div>`
}
// Suggestion d'IA (simulée) : même présentation dans tous les modules
const aiBox = (title, text, actions = "") =>
  `<div class="card ai"><div class="row between"><strong>${esc(title)}</strong>${badge("IA · simulé", "outline")}</div><p style="margin:6px 0 0">${esc(text)}</p>${actions ? `<div class="row" style="margin-top:10px">${actions}</div>` : ""}</div>`
// Cadre de téléphone pour les applications mobiles
const phone = (html, title = "") => `<div class="phone"><div class="phone-bar">${esc(title)}</div><div class="phone-body">${html}</div></div>`
const pct = (n) => Math.round(n * 10) / 10 + " %"
let seq = 1
const uid = (prefix) => `${prefix}-${Date.now().toString(36).slice(-4)}${seq++}`.toUpperCase()

// ---------- Registre des modules ----------
// Ordre d'affichage des groupes dans le menu
const GROUPS = ["Réception & séjour", "Ventes & clients", "Opérations", "Services", "Personnel", "Finance", "Pilotage & IA", "Plateforme"]
const HMS = { modules: [], screens: {}, groups: GROUPS.map((name) => ({ name, items: [] })) }
const A = {} // actions par module : A.<code>.<action>
HMS.module = ({ code, group, title, phase, spec, screens, actions }) => {
  if (actions) A[code] = actions
  let g = HMS.groups.find((x) => x.name === group)
  if (!g) HMS.groups.push((g = { name: group, items: [] }))
  screens.forEach((s) => {
    if (HMS.screens[s.id]) console.error(`Écran en double : ${s.id}`)
    HMS.screens[s.id] = { ...s, code, group }
    if (!s.hidden) g.items.push(s)
  })
  HMS.modules.push({ code, group, title, phase, spec, screens })
}

// ---------- Données factices persistées ----------
// L'état (D + ui) est sauvegardé dans le navigateur après chaque rendu et rechargé au démarrage.
// Si les données d'origine changent (nouvelle version de la maquette), l'ancienne sauvegarde est ignorée.
const STORE = "hms-maquette"
const hash = (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return String(h) }
let fingerprint = ""
// Remplace le contenu de target par celui de src sans changer les références des objets (les modules gardent les leurs)
const syncInPlace = (target, src) => {
  Object.keys(target).forEach((k) => { if (!(k in src)) delete target[k] })
  Object.entries(src).forEach(([k, v]) => {
    const t = target[k]
    if (Array.isArray(t) && Array.isArray(v)) t.splice(0, t.length, ...v)
    else if (t && v && typeof t === "object" && typeof v === "object" && !Array.isArray(t) && !Array.isArray(v)) syncInPlace(t, v)
    else target[k] = v
  })
}
const saveState = () => { try { localStorage.setItem(STORE, JSON.stringify({ fp: fingerprint, D, ui })) } catch (e) {} }
const loadState = () => {
  fingerprint = hash(JSON.stringify(D))
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null")
    if (!saved || saved.fp !== fingerprint) return
    syncInPlace(D, saved.D)
    today = D.today
    Object.assign(ui, saved.ui, { encoding: null, done: null })
  } catch (e) {}
}
const resetData = () => {
  if (!confirm("Revenir aux données d'exemple d'origine ? Toutes les modifications faites dans la maquette seront effacées.")) return
  localStorage.removeItem(STORE)
  location.hash = ""
  location.reload()
}

// ---------- Navigation ----------
// ---------- Icônes (tracés au trait, style Lucide) ----------
const ICON = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>',
  bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  move: '<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  tag: '<path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l8.59-8.59a1 1 0 0 0 0-1.41Z"/><circle cx="7" cy="7" r="1.5"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  check: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  sparkle: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/><path d="M19 17v4M17 19h4"/>',
  party: '<path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  bus: '<path d="M8 6v6M16 6v6M2 12h20M7 18h10"/><rect x="3" y="3" width="18" height="15" rx="2"/><circle cx="7" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 14h.01M12 14h.01M16 14v4M8 18h4"/>',
  bank: '<path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>',
  chart: '<path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/>',
  pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  brain: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  filecheck: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  chevrons: '<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  dot: '<circle cx="12" cy="12" r="3"/>',
}
const ico = (k, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ICON.dot}</svg>`
const SCREEN_ICON = {
  accueil: "home", reservations: "calendar", checkin: "key", checkout: "receipt", "sej-rack": "grid", "sej-mouv": "move", "sej-groupes": "users", "sej-audit": "moon",
  clients: "user", "rat-tarifs": "tag", "rat-distribution": "globe", crm: "heart", "crm-relation": "message",
  chambres: "bed", "acc-cles": "key", "acc-materiel": "lock", "acc-securite": "shield", "mnt-ot": "wrench", "mnt-hk": "check", "prc-achats": "cart", "prc-stocks": "box", "bln-linge": "shirt", "bln-pressing": "shirt",
  fnb: "utensils", spa: "sparkle", "spa-loisirs": "bus", evt: "party",
  "hr-personnel": "users", "hr-temps": "clock", "hr-paie": "wallet", "hr-portail": "phone", "hr-declarations": "file", "hr-pilotage": "chart",
  "fol-folios": "receipt", "fol-paiements": "wallet", "fol-ledger": "building", "fol-caisse": "calc", "fin-pilotage": "chart", "fin-compta": "calc", "fin-tiers": "users", "fin-treso": "bank", "fin-ndf": "receipt",
  "fin-immo": "building", "fin-fiscal": "file", "fin-gestion": "pie", "fin-cloture": "lock", "fin-etats": "filecheck",
  "aip-rm": "chart", "aip-ia": "brain", "bi-dash": "pie", "bi-rapports": "file",
  "plt-acces": "users", "plt-audit": "list", "plt-params": "sliders", "org-etab": "building", "org-chambres": "bed", "org-codes": "tag", "int-hub": "plug", "ops-console": "server",
  "ops-conformite": "shield", "ops-migration": "upload", "mob-apps": "phone", couverture: "filecheck", architecture: "layers",
}

// ---------- Connexion simulée et rôles ----------
// Comptes de démonstration (fictifs). Chaque rôle voit les groupes du menu qui le concernent.
const DEMO_PASSWORD = "demo1234"
const USERS = [
  { email: "direction@hotel-exemple.test", name: "Kouadio Brou", role: "Directeur général", groups: "*" },
  { email: "reception@hotel-exemple.test", name: "Aya Koffi", role: "Réceptionniste", groups: ["Réception & séjour", "Ventes & clients", "Services"], extra: ["chambres", "acc-cles", "fol-folios", "fol-paiements", "fol-caisse", "mob-apps"] },
  { email: "gouvernante@hotel-exemple.test", name: "Amenan Yao", role: "Gouvernante générale", groups: ["Opérations"], extra: ["accueil", "sej-rack", "bi-dash"] },
  { email: "compta@hotel-exemple.test", name: "Adjoua Koné", role: "Comptable", groups: ["Finance", "Personnel"], extra: ["bi-dash", "bi-rapports", "prc-achats"] },
  { email: "admin@hotel-exemple.test", name: "Kouadio Yapi", role: "Administrateur plateforme", groups: "*" },
]
const SESSION = "hms-session"
const currentUser = () => { try { const s = JSON.parse(localStorage.getItem(SESSION) || "null"); return s && USERS.find((u) => u.email === s.email) } catch (e) { return null } }
const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
const canSee = (id, u = currentUser()) => {
  const s = HMS.screens[id]
  if (!s || !u) return false
  if (s.navAs && s.navAs !== id) return canSee(s.navAs, u)
  return u.groups === "*" || s.group === "Projet" || u.groups.includes(s.group) || (u.extra || []).includes(id)
}
const firstScreen = (u) => HMS.groups.flatMap((g) => g.items).find((s) => canSee(s.id, u))?.id
const AUTH = {
  tab(t) { ui.loginTab = t; ui.loginMsg = ""; render() },
  open(u) { localStorage.setItem(SESSION, JSON.stringify({ email: u.email, at: Date.now() })); ui.loginMsg = ""; location.hash = firstScreen(u); render(); toast(`Bienvenue ${u.name.split(" ")[0]} · ${u.role}`) },
  submit() {
    const email = val("lg-email").toLowerCase(), pwd = $("#lg-pwd")?.value || ""
    const u = USERS.find((x) => x.email === email)
    if (!email || !pwd) return AUTH.msg("Saisis ton e-mail et ton mot de passe.")
    if (!u || pwd !== DEMO_PASSWORD) return AUTH.msg("E-mail ou mot de passe incorrect.")
    AUTH.open(u)
  },
  magic() {
    const email = val("lg-email").toLowerCase(), u = USERS.find((x) => x.email === email)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return AUTH.msg("Saisis une adresse e-mail valide.")
    ui.loginMagic = u ? email : ""
    AUTH.msg(u ? "Lien de connexion envoyé (simulé). Ouvre-le ci-dessous." : "Si un compte existe pour cette adresse, un lien vient d'être envoyé (simulé).", true)
  },
  forgot() {
    const email = val("lg-email")
    AUTH.msg(email ? `Un lien de réinitialisation a été envoyé à ${email} s'il existe un compte (simulé).` : "Saisis ton e-mail puis clique sur « Mot de passe oublié ? ».", !!email)
  },
  msg(m, ok = false) { ui.loginMsg = m; ui.loginOk = ok; const email = val("lg-email"); render(); if ($("#lg-email")) $("#lg-email").value = email },
  demo(email) { ui.loginTab = "pwd"; render(); $("#lg-email").value = email; $("#lg-pwd").value = DEMO_PASSWORD },
  peek() { const i = $("#lg-pwd"); i.type = i.type === "password" ? "text" : "password" },
  logout() { localStorage.removeItem(SESSION); ui.loginMsg = ""; location.hash = "login"; render() },
}
function loginView() {
  const tab = ui.loginTab || "pwd"
  return `<div class="login-card">
    <div class="logo lg">H</div>
    <h1 class="login-title">Connexion</h1>
    <p class="muted" style="text-align:center;margin:0 0 20px">Connecte-toi à HMS · ${esc(D.hotel)}</p>
    <button class="btn ghost block" onclick="AUTH.open(USERS[0])">${ICON_GOOGLE} Continuer avec Google</button>
    <div class="divider">ou</div>
    <div class="seg"><button aria-pressed="${tab === "pwd"}" onclick="AUTH.tab('pwd')">E-mail / Mot de passe</button><button aria-pressed="${tab === "magic"}" onclick="AUTH.tab('magic')">Lien magique</button></div>
    <form onsubmit="event.preventDefault();${tab === "pwd" ? "AUTH.submit()" : "AUTH.magic()"}">
      <label for="lg-email" style="margin-top:16px">E-mail</label>
      <div class="field-ic">${ico("mail", 16)}<input id="lg-email" type="email" autocomplete="username" placeholder="vous@exemple.test"></div>
      ${tab === "pwd" ? `<label for="lg-pwd" style="margin-top:12px">Mot de passe</label>
      <div class="field-ic">${ico("lock", 16)}<input id="lg-pwd" type="password" autocomplete="current-password" placeholder="••••••••"><button type="button" class="peek" aria-label="Afficher le mot de passe" onclick="AUTH.peek()">${ico("eye", 16)}</button></div>
      <div style="text-align:right;margin:8px 0 14px"><button type="button" class="link" onclick="AUTH.forgot()">Mot de passe oublié ?</button></div>` : `<div style="height:14px"></div>`}
      ${ui.loginMsg ? `<div class="${ui.loginOk ? "okmsg" : "err"}" style="margin-bottom:12px">${esc(ui.loginMsg)}${ui.loginMagic && tab === "magic" ? `<div style="margin-top:8px"><button type="button" class="btn sm" onclick="AUTH.open(USERS.find((u) => u.email === '${esc(ui.loginMagic)}'))">Ouvrir le lien</button></div>` : ""}</div>` : ""}
      <button class="btn block" type="submit">${tab === "pwd" ? "Se connecter" : "Recevoir un lien de connexion"}</button>
    </form>
    <div class="divider" style="margin-top:22px">Comptes de démonstration</div>
    <div class="demo">${USERS.map((u) => `<button onclick="AUTH.demo('${u.email}')"><span class="avatar sm">${initials(u.name)}</span><span><strong>${esc(u.role)}</strong><span class="muted" style="display:block">${esc(u.email)}</span></span></button>`).join("")}</div>
    <p class="muted" style="text-align:center;margin:14px 0 0">Mot de passe de démonstration : <strong>${DEMO_PASSWORD}</strong> · prototype, données fictives</p>
  </div>`
}
const ICON_GOOGLE = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`

// ---------- Coque : menu latéral, en-tête, notifications ----------
const notifications = () => {
  const n = []
  ;(D.acc?.alarms || []).filter((a) => a.status === "ouverte").slice(0, 4).forEach((a) => n.push({ text: `${a.type} — ${a.door}`, route: "acc-securite", kind: "Sécurité" }))
  ;(D.mnt?.orders || []).filter((o) => ["critique", "haute"].includes(o.prio) && o.status !== "clos").slice(0, 3).forEach((o) => n.push({ text: `${o.id} · ${o.title} (${o.target})`, route: "mnt-ot", kind: "Maintenance" }))
  arrivals().filter((r) => r.status === "confirmee" && G(r.guest)?.vip).forEach((r) => n.push({ text: `Arrivée VIP : ${G(r.guest).name}`, route: "checkin/" + r.id, kind: "Réception" }))
  return n.filter((x) => canSee(x.route.split("/")[0]))
}
const toggleDD = (id) => { const el = document.getElementById(id); const open = !el.classList.contains("open"); document.querySelectorAll(".dd.open").forEach((d) => d.classList.remove("open")); if (open) el.classList.add("open") }
const toggleSidebar = () => { document.body.classList.toggle("sb-collapsed"); localStorage.setItem("hms-sb", document.body.classList.contains("sb-collapsed") ? "1" : "") }
function renderShell(u, s, nav) {
  $("#tabs").innerHTML = HMS.groups.map((g) => ({ ...g, items: g.items.filter((x) => canSee(x.id, u)) })).filter((g) => g.items.length).map((g) =>
    `<div class="navgroup"><div class="navtitle">${esc(g.name)}</div>${g.items.map((x) => `<button data-id="${esc(x.id)}" aria-current="${x.id === nav}" title="${esc(x.label)}" onclick="go('${esc(x.id)}')">${ico(SCREEN_ICON[x.id])}<span class="lbl">${esc(x.label)}</span></button>`).join("")}</div>`).join("")
  $("#sbuser").innerHTML = `<span class="avatar">${initials(u.name)}</span><span class="lbl"><strong>${esc(u.name)}</strong><span class="muted" style="display:block;font-size:12px">${esc(u.role)}</span></span>`
  const parent = HMS.screens[nav] || s
  $("#crumb").innerHTML = `<span class="muted">${esc(parent.group)}</span><span class="sep">/</span><strong>${esc(parent.label || "")}</strong>`
  $("#ctx").innerHTML = `${ico("calendar", 15)} ${fd(today)}/${today.slice(0, 4)}`
  const notes = notifications()
  $("#bell").innerHTML = ico("bell", 19) + (notes.length ? `<span class="count">${notes.length}</span>` : "")
  $("#bellpop").innerHTML = `<div class="pop-title">Notifications</div>` + (notes.length ? notes.map((x) => `<button onclick="toggleDD('dd-bell');go('${esc(x.route)}')"><span class="pill">${esc(x.kind)}</span><span>${esc(x.text)}</span></button>`).join("") : `<p class="muted" style="padding:8px 10px;margin:0">Aucune notification.</p>`)
  $("#theme").innerHTML = ico(document.documentElement.dataset.theme === "dark" ? "sun" : "moon", 19)
  $("#avatar").textContent = initials(u.name)
  $("#userpop").innerHTML = `<div class="pop-title"><strong>${esc(u.name)}</strong><span class="muted" style="display:block">${esc(u.email)} · ${esc(u.role)}</span></div>
    ${canSee("plt-acces", u) ? `<button onclick="toggleDD('dd-user');go('plt-acces')">${ico("user", 16)} Utilisateurs et droits</button>` : ""}
    ${canSee("plt-params", u) ? `<button onclick="toggleDD('dd-user');go('plt-params')">${ico("sliders", 16)} Paramètres</button>` : ""}
    <button onclick="toggleDD('dd-user');toggleTheme();render()">${ico("moon", 16)} Changer de thème</button>
    <button onclick="toggleDD('dd-user');resetData()">${ico("refresh", 16)} Réinitialiser les données</button>
    <hr><button class="danger" onclick="AUTH.logout()">${ico("logout", 16)} Se déconnecter</button>`
}

// ---------- Navigation ----------
function render() {
  let [name, ...params] = location.hash.slice(1).split("/")
  params = params.map(decodeURIComponent)
  const u = currentUser()
  if (!u) {
    document.body.classList.add("auth")
    $("#login").innerHTML = loginView()
    return
  }
  document.body.classList.remove("auth")
  let s = HMS.screens[name]
  if (!s) (name = firstScreen(u)), (s = HMS.screens[name])
  const r = s.redirect?.(params)
  if (r) return go(r)
  const nav = s.navAs || name
  renderShell(u, s, nav)
  $("#app").innerHTML = canSee(name, u)
    ? s.view(params)
    : pageHead("Accès refusé", `Le rôle « ${u.role} » n'a pas accès à cet écran (permissions simulées, module Utilisateurs et droits).`) + btn("Retour à mon accueil", `go('${firstScreen(u)}')`)
  if (canSee(name, u)) s.after?.(params)
  document.body.classList.remove("menu-open")
  saveState()
}
function startApp() {
  loadState()
  if (localStorage.getItem("hms-sb")) document.body.classList.add("sb-collapsed")
  $("#theme").onclick = () => { toggleTheme(); render() }
  $("#menu").onclick = () => document.body.classList.toggle("menu-open")
  document.addEventListener("click", (e) => { if (!e.target.closest(".dd")) document.querySelectorAll(".dd.open").forEach((d) => d.classList.remove("open")) })
  window.onhashchange = () => { render(); scrollTo(0, 0) }
  render()
}
