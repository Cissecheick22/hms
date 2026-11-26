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

const STATUS = { confirmee: ["Confirmée", ""], arrivee: ["En séjour", "on"], partie: ["Partie", "outline"], annulee: ["Annulée", "dark"], noshow: ["No-show", "dark"], deloge: ["Délogé", "outline"] }
const HK = { propre: ["Propre", "on"], sale: ["Sale", ""], inspection: ["En inspection", "outline"], hs: ["Hors commande", "dark"] } // hs = hors commande : retirée de la vente (RG-ORG-02). Le « hors service » vendable est un statut d'exploitation (org-chambres)
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
const badge = (text, kind = "") => `<span class="pill ${kind}">${esc(text)}</span>` // kind : "" | on | dark | outline
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
    HMS.screens[s.id] = { ...s, code }
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
function render() {
  let [name, ...params] = location.hash.slice(1).split("/")
  params = params.map(decodeURIComponent)
  let s = HMS.screens[name]
  if (!s) (name = HMS.groups.find((g) => g.items.length).items[0].id), (s = HMS.screens[name])
  const r = s.redirect?.(params)
  if (r) return go(r)
  const nav = s.navAs || name
  document.querySelectorAll("#tabs button[data-id]").forEach((b) => b.setAttribute("aria-current", String(b.dataset.id === nav)))
  $("#ctx").textContent = `${D.hotel} · date hôtelière : ${fd(today)}/${today.slice(0, 4)}`
  $("#app").innerHTML = s.view(params)
  s.after?.(params)
  document.body.classList.remove("menu-open")
  saveState()
}
function startApp() {
  loadState()
  $("#theme").onclick = toggleTheme
  $("#reset").onclick = resetData
  $("#menu").onclick = () => document.body.classList.toggle("menu-open")
  $("#tabs").innerHTML = HMS.groups.filter((g) => g.items.length).map((g) =>
    `<div class="navgroup"><div class="navtitle">${esc(g.name)}</div>${g.items.map((s) => `<button data-id="${esc(s.id)}" onclick="go('${esc(s.id)}')">${esc(s.label)}</button>`).join("")}</div>`).join("")
  window.onhashchange = () => { render(); scrollTo(0, 0) }
  render()
}
