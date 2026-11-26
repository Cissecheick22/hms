// modules/restauration.js — Spec §13 Restauration / point de vente (FNB)
// Points de vente, plan de salle, prise de commande, écran cuisine (KDS), encaissement et imputation chambre,
// room service, minibar, petits-déjeuners inclus, carte et fiches techniques, réservations de tables, KPI et IA.
;(() => {
  const mins = (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b }
  const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
  const muted = (t) => `<span class="muted">${esc(t)}</span>`
  const err = (m) => `<div class="err">${esc(m)}</div>`

  // ---------- Données d'exemple ----------
  D.fnb = {
    now: "13:05", // heure simulée du service de midi
    offline: false,
    outlets: [
      { id: "REST", name: "Restaurant Le Baobab", type: "Restaurant", hours: "06:30–10:30 · 12:00–15:00 · 19:00–23:00", cp: "CP-110", stations: ["Chaud", "Froid", "Pâtisserie"], printer: "Imprimante cuisine IMP-1 (simulée)", tables: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"] },
      { id: "BAR", name: "Bar Lagune", type: "Bar", hours: "10:00–01:00", cp: "CP-120", stations: ["Bar"], printer: "Imprimante bar IMP-2 (simulée)", tables: ["B1", "B2", "B3", "B4", "B5"] },
      { id: "PISC", name: "Snack Piscine", type: "Snack", hours: "10:00–18:00", cp: "CP-130", stations: ["Chaud", "Bar"], printer: "Imprimante IMP-3 (simulée)", tables: ["P1", "P2", "P3", "P4"] },
      { id: "RS", name: "Room service", type: "Room service", hours: "24 h/24 · carte réduite 23:00–06:00", cp: "CP-140", stations: ["Chaud", "Froid"], printer: "KDS cuisine", tables: [] },
      { id: "MB", name: "Minibar", type: "Minibar", hours: "—", cp: "CP-150", stations: [], printer: "—", tables: [] },
    ],
    seats: { T1: 2, T2: 2, T3: 4, T4: 4, T5: 4, T6: 6, T7: 4, T8: 2, T9: 6, T10: 8, B1: 2, B2: 2, B3: 4, B4: 4, B5: 6, P1: 4, P2: 4, P3: 2, P4: 6 },
    items: [
      { id: "M1", name: "Attiéké poisson braisé", en: "Grilled fish, cassava couscous", cat: "Plats", price: 8500, station: "Chaud", allergens: ["Poisson"], outlets: ["REST", "PISC", "RS"], slot: "Midi et soir", mods: ["Piment à part", "Sans oignon"], avail: true, sold: 64 },
      { id: "M2", name: "Poulet kedjenou", en: "Slow-cooked chicken stew", cat: "Plats", price: 9000, station: "Chaud", allergens: [], outlets: ["REST", "RS"], slot: "Midi et soir", mods: ["Riz", "Attiéké"], avail: true, sold: 41 },
      { id: "M3", name: "Capitaine braisé, alloco", en: "Grilled Nile perch, fried plantain", cat: "Plats", price: 12000, station: "Chaud", allergens: ["Poisson"], outlets: ["REST"], slot: "Midi et soir", mods: [], avail: true, sold: 22 },
      { id: "M4", name: "Sauce graine, riz", en: "Palm nut sauce, rice", cat: "Plats", price: 7500, station: "Chaud", allergens: [], outlets: ["REST"], slot: "Midi", mods: [], avail: true, sold: 18 },
      { id: "M5", name: "Salade avocat crevettes", en: "Avocado and shrimp salad", cat: "Entrées", price: 6500, station: "Froid", allergens: ["Crustacés"], outlets: ["REST", "PISC", "RS"], slot: "Midi et soir", mods: ["Sauce à part"], avail: true, sold: 30 },
      { id: "M6", name: "Brochettes de bœuf, alloco", en: "Beef skewers, fried plantain", cat: "Plats", price: 6000, station: "Chaud", allergens: [], outlets: ["BAR", "PISC", "RS"], slot: "Toute la journée", mods: ["Piment à part"], avail: true, sold: 52 },
      { id: "M7", name: "Club sandwich", en: "Club sandwich", cat: "Plats", price: 5500, station: "Froid", allergens: ["Gluten", "Œuf"], outlets: ["BAR", "PISC", "RS"], slot: "Toute la journée", mods: ["Sans mayonnaise"], avail: true, sold: 37 },
      { id: "M8", name: "Tarte à la noix de coco", en: "Coconut tart", cat: "Desserts", price: 3500, station: "Pâtisserie", allergens: ["Gluten", "Lait", "Œuf"], outlets: ["REST", "RS"], slot: "Midi et soir", mods: [], avail: true, sold: 26 },
      { id: "M9", name: "Salade de fruits frais", en: "Fresh fruit salad", cat: "Desserts", price: 3000, station: "Froid", allergens: [], outlets: ["REST", "PISC", "RS"], slot: "Toute la journée", mods: [], avail: false, sold: 19 },
      { id: "D1", name: "Jus de bissap", en: "Hibiscus juice", cat: "Boissons", price: 2000, station: "Bar", allergens: [], outlets: ["REST", "BAR", "PISC", "RS"], slot: "Toute la journée", mods: ["Sans glaçons"], avail: true, sold: 88 },
      { id: "D2", name: "Eau minérale 50 cl", en: "Still water", cat: "Boissons", price: 1500, station: "Bar", allergens: [], outlets: ["REST", "BAR", "PISC", "RS"], slot: "Toute la journée", mods: [], avail: true, sold: 120 },
      { id: "D3", name: "Bière locale 65 cl", en: "Local beer", cat: "Boissons", price: 2500, station: "Bar", allergens: ["Gluten"], outlets: ["REST", "BAR", "PISC"], slot: "Toute la journée", mods: [], avail: true, sold: 95 },
      { id: "D4", name: "Cocktail maison Lagune", en: "House cocktail", cat: "Boissons", price: 5000, station: "Bar", allergens: [], outlets: ["BAR", "PISC"], slot: "À partir de 17:00", mods: ["Sans alcool"], avail: true, sold: 33 },
      { id: "D5", name: "Café expresso", en: "Espresso", cat: "Boissons", price: 1500, station: "Bar", allergens: [], outlets: ["REST", "BAR", "RS"], slot: "Toute la journée", mods: ["Allongé"], avail: true, sold: 74 },
    ],
    // fiches techniques : coût théorique par portion (FCFA), stock décrémenté dans Achats (simulé)
    recipes: {
      M1: { yield: 1, ingr: [["Capitaine frais", "350 g", 1750], ["Attiéké", "250 g", 500], ["Tomate, oignon, piment", "150 g", 350], ["Huile, épices", "—", 300]] },
      M2: { yield: 4, ingr: [["Poulet fermier", "1,6 kg", 6400], ["Aubergine, tomate, oignon", "800 g", 1200], ["Riz", "600 g", 600], ["Épices, gingembre", "—", 400]] },
      M3: { yield: 1, ingr: [["Capitaine entier", "600 g", 3000], ["Banane plantain", "2 pièces", 500], ["Garniture", "—", 500]] },
      M4: { yield: 6, ingr: [["Graine de palme", "1,5 kg", 2400], ["Viande et poisson fumé", "900 g", 6300], ["Riz", "900 g", 900]] },
      M5: { yield: 1, ingr: [["Crevettes décortiquées", "120 g", 1800], ["Avocat", "1 pièce", 400], ["Salade, sauce", "—", 300]] },
      M6: { yield: 1, ingr: [["Bœuf", "200 g", 1600], ["Banane plantain", "1 pièce", 250], ["Huile, épices", "—", 250]] },
      M7: { yield: 1, ingr: [["Pain de mie", "3 tranches", 300], ["Poulet, œuf, bacon", "—", 1300], ["Frites", "150 g", 300]] },
      M8: { yield: 8, ingr: [["Pâte sablée", "400 g", 1600], ["Noix de coco râpée", "300 g", 1200], ["Lait, œufs, sucre", "—", 1500]] },
      M9: { yield: 1, ingr: [["Fruits de saison", "250 g", 900]] },
      D1: { yield: 10, ingr: [["Fleurs de bissap", "200 g", 1000], ["Sucre, menthe", "—", 1500]] },
      D2: { yield: 1, ingr: [["Eau minérale 50 cl", "1", 350]] },
      D3: { yield: 1, ingr: [["Bière 65 cl", "1", 900]] },
      D4: { yield: 1, ingr: [["Rhum, jus, sirop", "—", 1400]] },
      D5: { yield: 1, ingr: [["Café", "8 g", 250]] },
    },
    // tickets ouverts. Statut de ligne : null (non envoyée) | file (hors ligne) | attente | prep | pret | servi | annule
    checks: [
      { id: "C-301", outlet: "REST", table: "T2", covers: 2, waiter: "Kouadio Brou", opened: "12:20", status: "ouvert", lines: [
        { item: "M5", qty: 1, sent: "12:24", st: "servi" }, { item: "M1", qty: 2, sent: "12:24", st: "servi" }, { item: "D2", qty: 2, sent: "12:22", st: "servi" }] },
      { id: "C-302", outlet: "REST", table: "T5", covers: 4, waiter: "Aya Gnagne", opened: "12:42", status: "ouvert", lines: [
        { item: "M2", qty: 2, sent: "12:48", st: "prep" }, { item: "M3", qty: 1, sent: "12:48", st: "prep" }, { item: "M5", qty: 1, sent: "12:48", st: "pret" }, { item: "D1", qty: 4, sent: "12:45", st: "servi" }] },
      { id: "C-303", outlet: "REST", table: "T7", covers: 3, waiter: "Kouadio Brou", opened: "12:58", status: "ouvert", lines: [
        { item: "M4", qty: 1, sent: "13:01", st: "attente" }, { item: "M1", qty: 2, sent: "13:01", st: "attente" }, { item: "D3", qty: 2, sent: null, st: null }] },
      { id: "C-304", outlet: "BAR", table: "B2", covers: 2, waiter: "Seydou Bamba", opened: "12:50", status: "ouvert", lines: [
        { item: "M6", qty: 2, sent: "12:52", st: "prep" }, { item: "D3", qty: 2, sent: "12:51", st: "pret" }] },
    ],
    // tickets clôturés du jour (pour les KPI) : hotel = client de l'hôtel
    closed: [
      { id: "C-288", outlet: "REST", covers: 2, total: 21000, mode: "Imputation ch. 203", hotel: true, cost: 6900 },
      { id: "C-289", outlet: "REST", covers: 4, total: 46500, mode: "Carte bancaire", hotel: false, cost: 14800 },
      { id: "C-290", outlet: "BAR", covers: 3, total: 15500, mode: "Mobile Money", hotel: false, cost: 4300 },
      { id: "C-291", outlet: "REST", covers: 1, total: 12000, mode: "Imputation ch. 202", hotel: true, cost: 4100 },
      { id: "C-292", outlet: "PISC", covers: 2, total: 13000, mode: "Espèces", hotel: true, cost: 3900 },
      { id: "C-293", outlet: "RS", covers: 1, total: 9500, mode: "Imputation ch. 203", hotel: true, cost: 3200 },
    ],
    prep: { Chaud: [14, 16, 12, 18, 15], Froid: [6, 8, 7], Pâtisserie: [4, 5], Bar: [3, 4, 5, 3] },
    blocked: { "R-2046": "départ aujourd'hui, folio soldé : crédit chambre fermé par la réception" },
    allergies: { G4: ["Crustacés"], G7: ["Gluten"] }, // issues des profils CRM (exemple)
    rs: [
      { id: "RS-41", res: "R-2044", lines: [{ item: "M7", qty: 1 }, { item: "D2", qty: 1 }], placed: "12:40", via: "App mobile", status: "livraison" },
      { id: "RS-42", res: "R-2048", lines: [{ item: "M2", qty: 2 }, { item: "D1", qty: 2 }], placed: "12:55", via: "QR code en chambre", status: "preparation" },
    ],
    breakfast: { "R-2044": { pax: 1, incl: true, used: 1 }, "R-2046": { pax: 1, incl: false, used: 0 }, "R-2047": { pax: 1, incl: true, used: 0 }, "R-2048": { pax: 2, incl: true, used: 1 } },
    minibar: [{ id: "MB1", name: "Eau minérale", price: 1500 }, { id: "MB2", name: "Soda", price: 2000 }, { id: "MB3", name: "Bière locale", price: 2500 }, { id: "MB4", name: "Noix de cajou", price: 3000 }, { id: "MB5", name: "Chocolat", price: 2000 }],
    mbDetected: [{ id: "DET-1", room: "302", item: "MB3", qty: 2, at: "08:14" }, { id: "DET-2", room: "202", item: "MB4", qty: 1, at: "10:02" }],
    bookings: [
      { id: "TB-1", outlet: "REST", name: G("G7").name, covers: 2, time: "13:30", table: "T8", note: "Client de l'hôtel, ch. 302" },
      { id: "TB-2", outlet: "REST", name: "Société Ivoirienne Exemple", covers: 6, time: "13:15", table: "T9", note: "Déjeuner d'affaires" },
      { id: "TB-3", outlet: "REST", name: G("G1").name, covers: 2, time: "20:00", table: "T3", note: "VIP — arrivée ce jour" },
    ],
    tpos: [["Bar Lagune", "Terminal tiers BAR-01 via hub d'intégration", "Synchronisé 13:02"], ["Snack Piscine", "Tablette POS native", "En ligne"]],
    ai: {}, seq: 305, rsSeq: 43, tbSeq: 4,
  }
  Object.assign(ui, { fnbOutlet: "REST", fnbRole: "serveur", fnbCarte: "REST", fnbStation: "toutes" })
  const F = D.fnb
  const I = (id) => F.items.find((i) => i.id === id)
  const O = (id) => F.outlets.find((o) => o.id === id)
  const MBI = (id) => F.minibar.find((i) => i.id === id)
  const cost = (id) => { const r = F.recipes[id]; return r ? r.ingr.reduce((s, x) => s + x[2], 0) / r.yield : 0 }
  const live = (c) => c.lines.filter((l) => l.st !== "annule")
  const total = (c) => live(c).reduce((s, l) => s + I(l.item).price * l.qty, 0)
  const checkOf = (table) => F.checks.find((c) => c.table === table && c.status === "ouvert")
  const roomOf = (resId) => R(resId)?.room
  const LST = { attente: ["Envoyée", ""], prep: ["En préparation", "outline"], pret: ["Prête", "on"], servi: ["Servie", ""], annule: ["Annulée", "dark"], file: ["En file (hors ligne)", "outline"] }
  const lineBadge = (l) => (l.st ? badge(LST[l.st][0], LST[l.st][1]) : badge("Non envoyée", "outline"))
  const tableState = (o, t) => {
    const c = checkOf(t)
    if (c) return c.bill ? ["Addition", "dark"] : ["Occupée", "on"]
    const b = F.bookings.find((x) => x.outlet === o.id && x.table === t && mins(x.time) >= mins(F.now) - 15 && mins(x.time) - mins(F.now) <= 60)
    return b ? [`Réservée ${b.time}`, "outline"] : ["Libre", ""]
  }
  // Droit de crédit chambre (RG-FNB-01)
  const creditIssue = (r) => {
    if (!r || r.status !== "arrivee") return "Client non présent : l'imputation exige un séjour en cours."
    if (F.blocked[r.id]) return `Folio bloqué — ${F.blocked[r.id]}.`
    if (r.guarantee === "Aucune") return "Séjour sans crédit autorisé (aucune garantie enregistrée)."
    return null
  }
  const post = (r, label, amount) => { (D.extras[r.id] = D.extras[r.id] || []).push({ label, amount }) }
  const AI_DONE = { forecast: "Prévision transmise aux Achats (commande poisson +30 %) et aux RH (2 extras samedi midi)", buffet: "Bon de production du buffet de demain mis à jour : 2,5 kg de fruits, 40 viennoiseries" }
  const aiAct = (k, label) => (F.ai[k] ? badge("Appliqué", "on") + " " + muted(AI_DONE[k]) : btn(label, `A.fnb.ai(${q(k)})`, "ghost sm"))
  const avgPrep = (s) => { const a = F.prep[s] || []; return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0 }

  // ---------- Écran ----------
  const TABS = [["salle", "Salle et commandes"], ["cuisine", "Écran cuisine"], ["roomservice", "Room service"], ["chambres", "Minibar et petits-déj."], ["carte", "Carte et fiches techniques"], ["pdv", "Points de vente et tables"], ["pilotage", "KPI et IA"]]
  const views = {
    fnb(p) {
      const tab = p[0] || "salle"
      const body = { salle, cuisine, roomservice, chambres, carte, pdv, pilotage }[tab] || salle
      return pageHead("Restauration / POS", `Service de midi en cours (heure simulée ${F.now}). Montants et volumes d'exemple ; TPE, imprimantes et écrans cuisine simulés.`,
        F.offline ? badge("Hors ligne · commandes en file", "dark") + btn("Revenir en ligne", "A.fnb.online()", "sm") : btn("Simuler une coupure réseau", "A.fnb.offline()", "ghost sm"))
        + subtabs("fnb", TABS, tab) + body(p.slice(1))
    },
  }

  function salle(p) {
    const o = O(ui.fnbOutlet), t = p[0] && o.tables.includes(p[0]) ? p[0] : null
    const outs = Object.fromEntries(F.outlets.filter((x) => x.tables.length).map((x) => [x.id, x.name]))
    const plan = `<div class="rooms">${o.tables.map((x) => { const [s, k] = tableState(o, x), c = checkOf(x)
      return `<button class="card" style="text-align:left;cursor:pointer;font:inherit;color:var(--ink);${x === t ? "border-color:var(--ink);box-shadow:inset 3px 0 0 var(--ink)" : ""}" onclick="go('fnb/salle/${esc(x)}')">
        <div class="row between"><span class="roomno">${esc(x)}</span>${badge(s, k)}</div>
        <div class="muted">${F.seats[x]} places${c ? ` · ${c.covers} couv. · ${money(total(c))}` : ""}</div></button>` }).join("")}</div>`
    return `${chips("fnbOutlet", outs)}
      <p class="muted">${esc(o.name)} · ${esc(o.hours)} · EF-FNB-001/003</p>
      ${t ? split(plan, ticket(o, t)) : plan + `<p class="muted" style="margin-top:12px">Sélectionnez une table pour ouvrir ou reprendre un ticket.</p>`}`
  }

  function ticket(o, t) {
    const c = checkOf(t)
    if (!c) return card(`Table ${t}`, `<p class="muted">Table libre · ${F.seats[t]} places.</p>
      ${form([field("fnb-cov", "Couverts", input("fnb-cov", Math.min(2, F.seats[t]), 'type="number" min="1"')), field("fnb-wt", "Serveur", select("fnb-wt", ["Kouadio Brou", "Aya Gnagne", "Seydou Bamba"], "Kouadio Brou"))])}
      <div class="row" style="margin-top:12px">${btn("Ouvrir le ticket", `A.fnb.open(${q(t)})`)}</div>`)
    const menu = F.items.filter((i) => i.outlets.includes(o.id))
    const cats = [...new Set(menu.map((i) => i.cat))]
    const unsent = c.lines.filter((l) => !l.sent).length
    return `<div class="card">
      <div class="row between"><span class="big">Ticket ${esc(c.id)} · table ${esc(t)}</span>${c.bill ? badge("Addition demandée", "dark") : badge("Ouvert", "on")}</div>
      <div class="muted">${c.covers} couverts · ${esc(c.waiter)} · ouvert à ${esc(c.opened)}</div>
      ${tbl(["Article", "#Qté", "#Montant", "Cuisine", ""], c.lines.map((l, i) => [
        l.st === "annule" ? `<s>${esc(I(l.item).name)}</s> ${muted("motif : " + l.motif)}` : esc(I(l.item).name), l.qty, money(I(l.item).price * l.qty), lineBadge(l),
        l.st === "annule" ? "" : btn("Retirer", `A.fnb.removeLine(${q(c.id)}, ${i})`, "ghost sm")]), "Aucun article.",
        `<tfoot><tr><td>Total TTC</td><td></td><td class="num">${money(total(c))}</td><td colspan="2"></td></tr></tfoot>`)}
      <div class="row" style="margin-top:8px"><span class="muted">Rôle :</span>${chips("fnbRole", { serveur: "Serveur", responsable: "Responsable F&B" })}</div>
      <div class="form"><div>${field("fnb-motif", "Motif d'annulation (après envoi, RG-FNB-03)", select("fnb-motif", ["Erreur de saisie", "Client a changé d'avis", "Article indisponible", "Retard excessif"], ""))}</div></div>
      <h3>Ajouter</h3>
      ${cats.map((cat) => `<div class="muted" style="margin-top:6px">${esc(cat)}</div><div class="row" style="margin-top:4px">${menu.filter((i) => i.cat === cat).map((i) =>
        i.avail ? `<button class="btn ghost sm" onclick="A.fnb.add(${q(c.id)}, ${q(i.id)})">${esc(i.name)} · ${esc(money(i.price))}</button>` : `<button class="btn ghost sm" disabled title="Indisponible">${esc(i.name)} (épuisé)</button>`).join("")}</div>`).join("")}
      <div class="row" style="margin-top:14px">${btn(`Envoyer en cuisine${unsent ? ` (${unsent})` : ""}`, `A.fnb.send(${q(c.id)})`, unsent ? "accent" : "")}${c.bill ? "" : btn("Demander l'addition", `A.fnb.bill(${q(c.id)})`, "ghost")}</div>
      <p class="muted">Envoi par poste de préparation (EF-FNB-004) · ${esc(o.printer)}.</p>
      ${settle(c)}
    </div>`
  }

  function settle(c) {
    const rooms = inHouse().sort((a, b) => a.room.localeCompare(b.room))
    return `<h3>Encaissement (EF-FNB-005)</h3>
      <div class="form">
        ${field("fnb-mode", "Moyen de paiement", select("fnb-mode", ["Espèces", "Carte bancaire (TPE simulé)", "Mobile Money (simulé)", "Imputation chambre"], "Espèces", `onchange="document.getElementById('fnb-room-box').style.display=this.value==='Imputation chambre'?'':'none'"`))}
        ${field("fnb-tip", "Pourboire", input("fnb-tip", 0, 'type="number" min="0" step="500"'))}
        ${field("fnb-split", "Partager en", input("fnb-split", 1, `type="number" min="1" max="${c.covers + 2}" oninput="document.getElementById('fnb-per').textContent=(${total(c)}/Math.max(1,this.value)).toLocaleString('fr-FR',{maximumFractionDigits:0})+' FCFA par personne'"`))}
        <div style="align-self:end" class="muted" id="fnb-per">${esc(money(total(c)))} par personne</div>
        <div class="full" id="fnb-room-box" style="display:none">
          <div class="form">${field("fnb-room", "Chambre", select("fnb-room", rooms.map((r) => [r.id, `Ch. ${r.room} — ${G(r.guest).name}`]), rooms[0]?.id))}
            ${field("fnb-name", "Nom annoncé par le client", input("fnb-name", "", 'placeholder="Vérification du nom"'))}
            <div style="align-self:end"><label class="row" style="color:var(--ink)"><input type="checkbox" id="fnb-sign"> Signature recueillie sur tablette (simulée)</label></div></div></div>
        <div class="full" id="fnb-err"></div>
        <div class="full">${btn(`Encaisser ${money(total(c))}`, `A.fnb.settle(${q(c.id)})`, "accent")}</div>
      </div>`
  }

  function cuisine() {
    const stations = [...new Set(F.outlets.flatMap((o) => o.stations))]
    const tickets = []
    F.checks.filter((c) => c.status === "ouvert").forEach((c) => c.lines.forEach((l, i) => {
      if (["attente", "prep", "pret"].includes(l.st)) tickets.push({ c, l, i, where: `${O(c.outlet).name} · table ${c.table}` })
    }))
    F.rs.filter((o) => o.status === "preparation").forEach((o) => o.lines.forEach((l) => tickets.push({ rs: o, l, where: `Room service · ch. ${roomOf(o.res)}` })))
    const shown = stations.filter((s) => ui.fnbStation === "toutes" || ui.fnbStation === s)
    return `${chips("fnbStation", { toutes: "Tous les postes", ...Object.fromEntries(stations.map((s) => [s, s])) })}
      <p class="muted">KDS : chaque article est routé vers son poste. Temps écoulé depuis l'envoi (objectif d'envoi &lt; 1 s, ENF-FNB-02).</p>
      <div class="grid">${shown.map((s) => { const list = tickets.filter((x) => I(x.l.item).station === s)
        return card(`${s} · ${list.length}`, list.map((x) => { const age = x.l.sent ? mins(F.now) - mins(x.l.sent) : mins(F.now) - mins(x.rs.placed)
          return `<div style="border-top:1px solid var(--line);padding:8px 0">
            <div class="row between"><strong>${x.l.qty} × ${esc(I(x.l.item).name)}</strong>${x.rs ? badge("Room service", "outline") : lineBadge(x.l)}</div>
            <div class="muted">${esc(x.where)} · ${age} min${age > 15 ? " · en retard" : ""}</div>
            ${x.rs ? "" : `<div class="row" style="margin-top:6px">${x.l.st === "attente" ? btn("Commencer", `A.fnb.kds(${q(x.c.id)}, ${x.i}, 'prep')`, "sm") : ""}${x.l.st === "prep" ? btn("Prêt à servir", `A.fnb.kds(${q(x.c.id)}, ${x.i}, 'pret')`, "sm") : ""}${x.l.st === "pret" ? btn("Servi", `A.fnb.kds(${q(x.c.id)}, ${x.i}, 'servi')`, "ghost sm") : ""}</div>`}
          </div>` }).join("") || `<p class="muted">Aucun bon en cours.</p>`) }).join("")}</div>`
  }

  function roomservice() {
    const RS = { recue: ["Reçue", "outline"], preparation: ["En préparation", ""], livraison: ["En livraison", "on"], livree: ["Livrée", "dark"] }
    const next = { recue: "preparation", preparation: "livraison", livraison: "livree" }
    const rooms = inHouse().sort((a, b) => a.room.localeCompare(b.room))
    const menu = F.items.filter((i) => i.outlets.includes("RS") && i.avail)
    return `<div class="cols"><section><h2>Commandes en cours</h2>
      ${tbl(["N°", "Chambre", "Commande", "#Montant", "Canal", "Statut", ""], F.rs.map((o) => { const r = R(o.res), amt = o.lines.reduce((s, l) => s + I(l.item).price * l.qty, 0)
        return [esc(o.id), `Ch. ${esc(r.room)}<div class="muted">${esc(G(r.guest).name)}</div>`, esc(o.lines.map((l) => `${l.qty} × ${I(l.item).name}`).join(", ")), money(amt), `${esc(o.via)}<div class="muted">${esc(o.placed)}</div>`, badge(...RS[o.status]),
          next[o.status] ? btn(o.status === "livraison" ? "Livrée" : RS[next[o.status]][0], `A.fnb.rsNext(${q(o.id)})`, "sm") : muted("Imputée au folio")] }), "Aucune commande.")}
      <p class="muted">Le client suit le statut en temps réel dans l'application (US-FNB-01). Paiement sur la chambre à la livraison.</p></section>
      <section><h2>Nouvelle commande (saisie téléphone)</h2><div class="card">
        ${form([field("rs-res", "Chambre", select("rs-res", rooms.map((r) => [r.id, `Ch. ${r.room} — ${G(r.guest).name}`]), rooms[0]?.id, `onchange="A.fnb.rsCheck()"`))])}
        <h3>Carte room service (selon l'heure)</h3>
        ${menu.map((i) => `<label class="row" style="color:var(--ink);margin:4px 0"><input type="checkbox" class="rs-item" value="${esc(i.id)}" onchange="A.fnb.rsCheck()"> ${esc(i.name)} · ${esc(money(i.price))} ${i.allergens.length ? muted("(" + i.allergens.join(", ") + ")") : ""}</label>`).join("")}
        <div id="rs-alert" style="margin-top:8px"></div>
        <div class="row" style="margin-top:10px">${btn("Transmettre en cuisine", "A.fnb.rsCreate()")}</div>
        <p class="muted">Allergènes du profil client signalés à la commande (RG-FNB-02).</p></div></section></div>`
  }

  function chambres() {
    const ih = inHouse().sort((a, b) => a.room.localeCompare(b.room))
    const bk = (r) => F.breakfast[r.id] || (F.breakfast[r.id] = { pax: 1, incl: r.guarantee !== "Aucune", used: 0 })
    return `<h2>Petits-déjeuners — contrôle par chambre (EF-FNB-009)</h2>
      ${tbl(["Chambre", "Client", "Forfait", "#Personnes", "#Servis", ""], ih.map((r) => { const b = bk(r)
        return [`Ch. ${esc(r.room)}`, esc(G(r.guest).name), b.incl ? badge("Inclus", "on") : badge("Non inclus", "outline"), b.pax, b.used, btn("Pointer un couvert", `A.fnb.breakfast(${q(r.id)})`, "sm")] }))}
      <p class="muted">Couverts inclus valorisés à zéro et ventilés ; au-delà du nombre de personnes ou hors forfait : facturé 10 000 FCFA au folio (RG-FNB-04).</p>
      <h2>Minibar (EF-FNB-007)</h2>
      <div class="cols"><section><h3>Détections du minibar connecté (simulé)</h3>
        ${tbl(["Chambre", "Article", "#Qté", "Heure", ""], F.mbDetected.map((d) => [`Ch. ${esc(d.room)}`, esc(MBI(d.item).name), d.qty, esc(d.at), btn("Confirmer et imputer", `A.fnb.mbConfirm(${q(d.id)})`, "sm")]), "Aucune détection à traiter.")}</section>
      <section><h3>Déclaration après contrôle de l'étage</h3><div class="card">
        ${form([field("mb-res", "Chambre", select("mb-res", ih.map((r) => [r.id, `Ch. ${r.room} — ${G(r.guest).name}`]), ih[0]?.id)),
          ...F.minibar.map((i) => field(`mb-${i.id}`, `${i.name} (${money(i.price)})`, input(`mb-${i.id}`, 0, 'type="number" min="0"')))])}
        <div id="mb-err" style="margin-top:8px"></div>
        <div class="row" style="margin-top:10px">${btn("Imputer au folio", "A.fnb.mbPost()")}</div></div></section></div>`
  }

  function carte(p) {
    const sel = I(p[0]) || null
    const items = F.items.filter((i) => ui.fnbCarte === "toutes" || i.outlets.includes(ui.fnbCarte))
    const list = tbl(["Article", "Catégorie", "Allergènes", "Disponibilité horaire", "#Prix", "#Coût", "#Coût %", ""], items.map((i) => { const c = cost(i.id)
      return [`<button class="link" onclick="go('fnb/carte/${esc(i.id)}')">${esc(i.name)}</button><div class="muted">EN : ${esc(i.en)}</div>`, esc(i.cat), esc(i.allergens.join(", ") || "—"), esc(i.slot),
        money(i.price), money(c), pct((c / i.price) * 100), `<label class="row" style="color:var(--ink);flex-wrap:nowrap"><input type="checkbox" ${i.avail ? "checked" : ""} onchange="A.fnb.toggle(${q(i.id)})"> Disponible</label>`] }))
    const r = sel && F.recipes[sel.id]
    const detail = sel ? card(`Fiche technique — ${sel.name}`, `<div class="muted">Rendement : ${r.yield} portion(s) · poste ${esc(sel.station)} · modificateurs : ${esc(sel.mods.join(", ") || "aucun")}</div>
      ${tbl(["Ingrédient", "Quantité", "#Coût"], r.ingr.map((x) => [esc(x[0]), esc(x[1]), money(x[2])]), "", `<tfoot><tr><td>Coût par portion</td><td></td><td class="num">${money(cost(sel.id))}</td></tr></tfoot>`)}
      <div class="form" style="margin-top:12px">${field("fnb-price", "Prix de vente (FCFA)", input("fnb-price", sel.price, 'type="number" min="0" step="500"'))}<div style="align-self:end">${btn("Mettre à jour le prix", `A.fnb.price(${q(sel.id)})`)}</div></div>
      <p class="muted">Chaque vente décrémente le stock théorique des ingrédients dans Achats et stocks (fnb.stock.consumed, simulé). EF-FNB-008.</p>`) : ""
    const stars = F.items.filter((i) => i.sold >= 40 && cost(i.id) / i.price < 0.32).map((i) => i.name)
    const puzzle = F.items.filter((i) => i.sold < 25 && cost(i.id) / i.price < 0.3).map((i) => i.name)
    return `${chips("fnbCarte", { toutes: "Toute la carte", ...Object.fromEntries(F.outlets.filter((o) => o.id !== "MB").map((o) => [o.id, o.name])) })}
      <p class="muted">Carte multilingue (FR/EN) avec allergènes, modificateurs, disponibilité horaire et prix par point de vente (EF-FNB-002). Décocher « Disponible » retire l'article des prises de commande.</p>
      ${detail}${sel ? "<div style='height:14px'></div>" : ""}${list}
      <div style="margin-top:14px">${aiBox("Ingénierie de menu", `Sur 30 jours : « vedettes » (populaires et rentables) : ${stars.join(", ")}. À promouvoir (rentables mais peu vendus) : ${puzzle.join(", ") || "aucun"}. Le capitaine braisé a un coût matière élevé : tester un prix à 13 000 FCFA ou une portion de 500 g.`, btn("Appliquer 13 000 FCFA au capitaine", "A.fnb.applyAi()", "ghost sm"))}</div>`
  }

  function pdv() {
    const o = O("REST")
    return `<h2>Points de vente</h2>
      ${tbl(["Point de vente", "Type", "Horaires", "Centre de profit", "Postes de préparation", "Impression"], F.outlets.map((x) => [`<strong>${esc(x.name)}</strong>`, esc(x.type), esc(x.hours), esc(x.cp), esc(x.stations.join(", ") || "—"), esc(x.printer)]))}
      <div class="cols"><section><h2>Réservations de tables — ${esc(o.name)} (EF-FNB-010)</h2>
        ${tbl(["Heure", "Nom", "#Couverts", "Table", "Note", ""], F.bookings.filter((b) => b.outlet === "REST").sort((a, b) => a.time.localeCompare(b.time)).map((b) => [esc(b.time), esc(b.name), b.covers, esc(b.table), muted(b.note || ""), btn("Annuler", `A.fnb.unbook(${q(b.id)})`, "ghost sm")]), "Aucune réservation.")}
        <div class="card" style="margin-top:12px">${form([field("tb-name", "Nom", input("tb-name", "", 'placeholder="Prénom Nom"')), field("tb-cov", "Couverts", input("tb-cov", 2, 'type="number" min="1"')),
          field("tb-time", "Heure", input("tb-time", "20:30", 'type="time"')), field("tb-table", "Table", select("tb-table", o.tables.map((t) => [t, `${t} (${F.seats[t]} pl.)`]), "T6"))])}
          <div id="tb-err" style="margin-top:8px"></div><div class="row" style="margin-top:10px">${btn("Réserver la table", "A.fnb.book()")}</div></div></section>
      <section><h2>POS tiers et terminaux (EF-FNB-011)</h2>
        ${tbl(["Point de vente", "Terminal", "État"], F.tpos.map((x) => [esc(x[0]), esc(x[1]), badge(x[2], "outline")]))}
        <p class="muted">Interfaces via le hub d'intégration (simulé). En cas de coupure, la prise de commande continue hors ligne et se synchronise au retour (ENF-FNB-01).</p></section></div>`
  }

  function pilotage() {
    const all = [...F.closed]
    const rev = all.reduce((s, c) => s + c.total, 0), cov = all.reduce((s, c) => s + c.covers, 0), cst = all.reduce((s, c) => s + c.cost, 0)
    const occ = inHouse().length || 1
    const guests = inHouse(), captured = guests.filter((r) => (D.extras[r.id] || []).some((l) => /restaurant|bar|room service|snack|minibar|petit/i.test(l.label))).length
    const stations = Object.keys(F.prep)
    const fc = [["Jeu. 26 · dîner", 58, 42], ["Ven. 27 · déjeuner", 74, 61], ["Ven. 27 · dîner", 66, 50], ["Sam. 28 · déjeuner", 92, 70], ["Sam. 28 · dîner", 110, 85]]
    return `<div class="grid">
        ${kpi("Revenu F&B / chambre occupée", money(rev / occ), `${occ} chambres occupées · exemple`)}
        ${kpi("Ticket moyen", money(rev / cov), `${cov} couverts encaissés aujourd'hui`)}
        ${kpi("Coût matière", pct((cst / rev) * 100), "du chiffre d'affaires (fiches techniques)")}
        ${kpi("Temps de préparation", Math.round(stations.reduce((s, x) => s + avgPrep(x), 0) / stations.length) + " min", "moyenne tous postes")}
        ${kpi("Taux de captation", pct((captured / guests.length) * 100), `${captured}/${guests.length} clients en séjour ont consommé`)}
      </div>
      <div class="cols"><section><h2>Chiffre d'affaires du jour par point de vente</h2>
        ${bars(F.outlets.map((o) => ({ label: o.name, value: all.filter((c) => c.outlet === o.id).reduce((s, c) => s + c.total, 0) })), money)}</section>
        <section><h2>Temps de préparation moyen par poste</h2>${bars(stations.map((s) => ({ label: s, value: Math.round(avgPrep(s)) })), (v) => v + " min")}</section></div>
      <h2>Prévision de fréquentation</h2>
      <div class="cols"><section>${tbl(["Service", "#Couverts prévus", "#dont clients hôtel"], fc.map((x) => [esc(x[0]), x[1], x[2]]))}</section>
        <section>${aiBox("Prévision de couverts", "Le déjeuner de samedi est porté par le séminaire de la Société Ivoirienne Exemple et 9 chambres du bloc : prévoir 2 serveurs supplémentaires et augmenter la commande de poisson de 30 %. Estimation à valider par le responsable F&B.", aiAct("forecast", "Transmettre aux Achats et RH"))}
        <div style="height:14px"></div>
        ${aiBox("Réduction du gaspillage — buffet petit-déjeuner", "Demain : 21 couverts attendus (chambres occupées × taux de présence observé de 82 %). Production conseillée : 2,5 kg de fruits, 40 viennoiseries au lieu de 60. Gaspillage estimé de la semaine passée : 18 %.", aiAct("buffet", "Appliquer au bon de production"))}</section></div>`
  }

  // ---------- Actions ----------
  const C = (id) => F.checks.find((c) => c.id === id)
  const actions = {
    offline() { F.offline = true; toast("Réseau coupé : les commandes sont conservées sur la tablette"); render() },
    online() {
      const n = F.checks.reduce((s, c) => s + c.lines.filter((l) => l.st === "file").length, 0)
      F.checks.forEach((c) => c.lines.forEach((l) => { if (l.st === "file") Object.assign(l, { st: "attente", sent: F.now }) }))
      F.offline = false; toast(`Synchronisation terminée : ${n} ligne(s) transmise(s) en cuisine`); render()
    },
    open(t) {
      const cov = Number(val("fnb-cov"))
      if (!(cov > 0)) return toast("Indiquez le nombre de couverts")
      if (cov > F.seats[t]) return toast(`La table ${t} compte ${F.seats[t]} places`)
      F.checks.push({ id: "C-" + F.seq++, outlet: ui.fnbOutlet, table: t, covers: cov, waiter: val("fnb-wt"), opened: F.now, status: "ouvert", lines: [] })
      toast("Ticket ouvert"); render()
    },
    add(cid, item) {
      const c = C(cid), l = c.lines.find((x) => x.item === item && !x.sent)
      if (l) l.qty++
      else c.lines.push({ item, qty: 1, sent: null, st: null })
      render()
    },
    send(cid) {
      const c = C(cid), todo = c.lines.filter((l) => !l.sent)
      if (!todo.length) return toast("Rien à envoyer")
      todo.forEach((l) => Object.assign(l, F.offline ? { st: "file", sent: "file" } : { st: "attente", sent: F.now }))
      toast(F.offline ? `${todo.length} ligne(s) en file, envoi au retour du réseau` : `${todo.length} ligne(s) envoyée(s) aux postes ${[...new Set(todo.map((l) => I(l.item).station))].join(", ")}`)
      render()
    },
    removeLine(cid, i) {
      const c = C(cid), l = c.lines[i]
      if (!l.sent) { c.lines.splice(i, 1); return render() }
      if (ui.fnbRole !== "responsable") return toast("Article déjà envoyé : annulation réservée au responsable F&B (RG-FNB-03)")
      const motif = val("fnb-motif")
      if (!motif) return toast("Choisissez un motif d'annulation")
      Object.assign(l, { st: "annule", motif })
      toast("Article annulé, motif tracé"); render()
    },
    bill(cid) { C(cid).bill = true; toast("Addition imprimée (simulé)"); render() },
    settle(cid) {
      const c = C(cid), mode = val("fnb-mode"), tip = Number(val("fnb-tip")) || 0, amount = total(c) + tip
      const e = (m) => ($("#fnb-err").innerHTML = err(m))
      if (!total(c)) return e("Le ticket est vide.")
      if (c.lines.some((l) => ["attente", "prep", "file"].includes(l.st))) return e("Des articles sont encore en préparation : servez-les ou annulez-les avant d'encaisser.")
      let label = mode
      if (mode === "Imputation chambre") {
        const r = R(val("fnb-room")), issue = creditIssue(r), g = G(r.guest)
        if (issue) return e(`Imputation refusée (RG-FNB-01) : ${issue}`)
        const said = val("fnb-name").toLowerCase()
        if (!said || !g.name.toLowerCase().includes(said)) return e(`Le nom annoncé ne correspond pas à l'occupant de la chambre ${r.room}.`)
        if (!$("#fnb-sign").checked) return e("La signature du client est requise pour imputer en chambre.")
        post(r, `${O(c.outlet).name} — ticket ${c.id}${tip ? " (pourboire inclus)" : ""}`, amount)
        label = `Imputation ch. ${r.room}`
        F.closed.push({ id: c.id, outlet: c.outlet, covers: c.covers, total: amount, mode: label, hotel: true, cost: live(c).reduce((s, l) => s + cost(l.item) * l.qty, 0) })
      } else F.closed.push({ id: c.id, outlet: c.outlet, covers: c.covers, total: amount, mode, hotel: false, cost: live(c).reduce((s, l) => s + cost(l.item) * l.qty, 0) })
      live(c).forEach((l) => (I(l.item).sold += l.qty))
      c.status = "clos"
      toast(`${c.id} réglé : ${money(amount)} · ${label}`)
      go("fnb/salle")
    },
    kds(cid, i, st) {
      const l = C(cid).lines[i]
      if (st === "pret") F.prep[I(l.item).station].push(Math.max(1, mins(F.now) - mins(l.sent)))
      l.st = st; toast(`${I(l.item).name} : ${LST[st][0].toLowerCase()}`); render()
    },
    rsCheck() {
      const r = R(val("rs-res")), al = F.allergies[r?.guest] || []
      const hit = [...document.querySelectorAll(".rs-item:checked")].map((x) => I(x.value)).filter((i) => i.allergens.some((a) => al.includes(a)))
      $("#rs-alert").innerHTML = al.length ? (hit.length
        ? `<div class="err">Allergie déclarée au profil (${esc(al.join(", "))}) : ${esc(hit.map((i) => i.name).join(", "))}.</div><label class="row" style="color:var(--ink);margin-top:6px"><input type="checkbox" id="rs-ack"> Confirmé avec le client par téléphone</label>`
        : `<p class="muted">Profil : allergie ${esc(al.join(", "))} — aucun article concerné.</p>`) : ""
    },
    rsCreate() {
      const r = R(val("rs-res")), ids = [...document.querySelectorAll(".rs-item:checked")].map((x) => x.value)
      if (!ids.length) return toast("Choisissez au moins un article")
      const issue = creditIssue(r)
      if (issue) return ($("#rs-alert").innerHTML = err(`Paiement sur la chambre impossible (RG-FNB-01) : ${issue}`))
      const al = F.allergies[r.guest] || []
      if (ids.some((id) => I(id).allergens.some((a) => al.includes(a))) && !$("#rs-ack")?.checked) return toast("Confirmez l'allergie avec le client avant de transmettre")
      F.rs.push({ id: "RS-" + F.rsSeq++, res: r.id, lines: ids.map((item) => ({ item, qty: 1 })), placed: F.now, via: "Téléphone", status: "preparation" })
      toast("Commande transmise en cuisine"); render()
    },
    rsNext(id) {
      const o = F.rs.find((x) => x.id === id), next = { recue: "preparation", preparation: "livraison", livraison: "livree" }
      o.status = next[o.status]
      if (o.status === "livree") {
        const r = R(o.res), amt = o.lines.reduce((s, l) => s + I(l.item).price * l.qty, 0)
        post(r, `Room service — ${o.id}`, amt)
        F.closed.push({ id: o.id, outlet: "RS", covers: 1, total: amt, mode: `Imputation ch. ${r.room}`, hotel: true, cost: o.lines.reduce((s, l) => s + cost(l.item) * l.qty, 0) })
        toast(`Livrée et imputée au folio ch. ${r.room}`)
      } else toast("Statut mis à jour, client notifié (simulé)")
      render()
    },
    breakfast(resId) {
      const b = F.breakfast[resId], r = R(resId)
      if (b.incl && b.used < b.pax) { b.used++; post(r, "Petit-déjeuner inclus au forfait", 0); toast(`Ch. ${r.room} : couvert inclus (valorisé 0)`) }
      else {
        const issue = creditIssue(r)
        if (issue) return toast(`Couvert hors forfait à encaisser sur place : ${issue}`)
        b.used++; post(r, "Petit-déjeuner (hors forfait)", 10000); toast(`Ch. ${r.room} : hors forfait, 10 000 FCFA imputés`)
      }
      render()
    },
    mbConfirm(id) {
      const d = F.mbDetected.find((x) => x.id === id), r = occupant(d.room)
      const issue = creditIssue(r)
      if (issue) return toast(`Imputation refusée : ${issue}`)
      post(r, `Minibar — ${d.qty} × ${MBI(d.item).name}`, d.qty * MBI(d.item).price)
      F.mbDetected = F.mbDetected.filter((x) => x !== d)
      toast(`Minibar imputé ch. ${d.room}`); render()
    },
    mbPost() {
      const r = R(val("mb-res")), lines = F.minibar.map((i) => [i, Number(val(`mb-${i.id}`)) || 0]).filter((x) => x[1] > 0)
      if (!lines.length) return ($("#mb-err").innerHTML = err("Saisissez au moins une consommation."))
      const issue = creditIssue(r)
      if (issue) return ($("#mb-err").innerHTML = err(`Imputation refusée (RG-FNB-01) : ${issue}`))
      post(r, `Minibar — ${lines.map(([i, n]) => `${n} × ${i.name}`).join(", ")}`, lines.reduce((s, [i, n]) => s + i.price * n, 0))
      toast(`Minibar imputé au folio ch. ${r.room}`); render()
    },
    toggle(id) { const i = I(id); i.avail = !i.avail; toast(`${i.name} : ${i.avail ? "disponible" : "retiré des commandes"}`); render() },
    price(id) {
      const v = Number(val("fnb-price"))
      if (!(v > 0)) return toast("Prix invalide")
      I(id).price = v; toast("Prix mis à jour sur tous les points de vente"); render()
    },
    applyAi() { I("M3").price = 13000; toast("Prix du capitaine braisé : 13 000 FCFA (validé par le responsable)"); render() },
    book() {
      const name = val("tb-name"), cov = Number(val("tb-cov")), time = val("tb-time"), table = val("tb-table")
      const e = (m) => ($("#tb-err").innerHTML = err(m))
      if (!name || !time) return e("Indiquez le nom et l'heure.")
      if (cov > F.seats[table]) return e(`La table ${table} ne compte que ${F.seats[table]} places.`)
      const clash = F.bookings.find((b) => b.outlet === "REST" && b.table === table && Math.abs(mins(b.time) - mins(time)) < 120)
      if (clash) return e(`Table ${table} déjà réservée à ${clash.time} (${clash.name}) : créneau de 2 h.`)
      F.bookings.push({ id: "TB-" + F.tbSeq++, outlet: "REST", name, covers: cov, time, table, note: "" })
      toast("Table réservée"); render()
    },
    ai(k) { F.ai[k] = true; toast(AI_DONE[k]); render() },
    unbook(id) { F.bookings = F.bookings.filter((b) => b.id !== id); toast("Réservation de table annulée"); render() },
  }

  HMS.module({
    code: "fnb", group: "Services", title: "Restauration / POS", phase: "11-15", spec: "§13 FNB",
    screens: [{ id: "fnb", label: "Restaurant / POS", view: views.fnb }],
    actions,
  })
})()
