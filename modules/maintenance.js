// modules/maintenance.js — Spec §11 Housekeeping et maintenance (HKM), compléments de l'écran « chambres »
// Ordres de travail correctifs, maintenance préventive, IoT et maintenance prédictive, tâches du jour,
// inspections avec check-list, objets trouvés, produits d'accueil, KPI §11.12.
;(() => {
  const NOW = today + " 10:30" // heure simulée de la maquette
  const dt = (s) => (s ? fd(s.slice(0, 10)) + " " + s.slice(11, 16) : "—")
  const hoursBetween = (a, b) => (new Date(b.replace(" ", "T")) - new Date(a.replace(" ", "T"))) / 36e5
  const room = (no) => D.rooms.find((r) => r.no === no)

  // ---------- Données d'exemple ----------
  D.mnt = {
    techs: ["Kouadio Brou", "Lassina Koné", "Froid Lagune Exemple (prestataire)"],
    inspectors: ["Akissi N'Guessan", "Adjoua Kouamé"],
    equipments: [
      { id: "EQ-CLIM-204", label: "Climatiseur split ch. 204", kind: "Climatisation", loc: "204", age: 7 },
      { id: "EQ-CLIM-303", label: "Climatiseur split ch. 303", kind: "Climatisation", loc: "303", age: 3 },
      { id: "EQ-ASC-1", label: "Ascenseur principal", kind: "Ascenseur", loc: "Hall", age: 9 },
      { id: "EQ-GE-1", label: "Groupe électrogène 250 kVA", kind: "Énergie", loc: "Local technique", age: 6 },
      { id: "EQ-CE-2", label: "Chauffe-eau solaire étage 2", kind: "Plomberie", loc: "Toiture", age: 4 },
      { id: "EQ-PISC", label: "Pompe de filtration piscine", kind: "Piscine", loc: "Piscine", age: 5 },
      { id: "EQ-SER-105", label: "Serrure électronique ch. 105", kind: "Serrure", loc: "105", age: 2 },
    ],
    // statut : ouvert | en_cours | attente_pieces | clos
    orders: [
      { id: "OT-311", type: "correctif", prio: "haute", target: "204", equip: "EQ-CLIM-204", title: "Climatisation en panne", desc: "Ne refroidit plus, bruit anormal du compresseur.", by: "Réception", source: "Employé", assignee: "Froid Lagune Exemple (prestataire)", parts: [{ label: "Condensateur 35 µF", qty: 1, cost: 12000 }], status: "attente_pieces", blocking: true, created: "2026-11-25 19:40" },
      { id: "OT-312", type: "correctif", prio: "normale", target: "201", title: "Robinet de lavabo qui fuit", desc: "Goutte-à-goutte constant.", by: D.housekeepers[1], source: "Employé", assignee: "Kouadio Brou", parts: [], status: "en_cours", blocking: false, created: "2026-11-26 08:15" },
      { id: "OT-313", type: "correctif", prio: "basse", target: "Restaurant", title: "Ampoule grillée terrasse", desc: "Deux appliques côté jardin.", by: "Serge Aka (maître d'hôtel)", source: "Employé", assignee: "", parts: [], status: "ouvert", blocking: false, created: "2026-11-26 09:05" },
      { id: "OT-314", type: "correctif", prio: "normale", target: "105", equip: "EQ-SER-105", title: "Batterie faible serrure", desc: "Alerte remontée par le système de serrures (simulé) : 12 %.", by: "Système serrures", source: "Serrure", assignee: "", parts: [], status: "ouvert", blocking: false, created: "2026-11-26 06:02" },
      { id: "OT-305", type: "correctif", prio: "haute", target: "302", title: "Télévision sans signal", desc: "Signalé par le client via l'application.", by: G("G7").name, source: "Client", assignee: "Lassina Koné", parts: [], status: "clos", blocking: false, created: "2026-11-25 20:10", closed: "2026-11-25 21:05", minutes: 40 },
      { id: "OT-301", type: "preventif", prio: "normale", target: "Local technique", equip: "EQ-GE-1", title: "Vidange groupe électrogène", desc: "Plan PM-03.", by: "Plan préventif", source: "Plan préventif", assignee: "Kouadio Brou", parts: [{ label: "Huile moteur 15W40 (20 L)", qty: 1, cost: 48000 }, { label: "Filtre à huile", qty: 1, cost: 9500 }], status: "clos", blocking: false, created: "2026-11-20 08:00", closed: "2026-11-20 11:30", minutes: 180 },
      { id: "OT-298", type: "correctif", prio: "critique", target: "103", title: "Fuite sous le lavabo", desc: "Alerte capteur de fuite (simulé).", by: "Capteur IoT", source: "IoT", assignee: "Lassina Koné", parts: [{ label: "Flexible inox 40 cm", qty: 1, cost: 3500 }], status: "clos", blocking: true, created: "2026-11-18 14:20", closed: "2026-11-18 16:05", minutes: 75 },
      { id: "OT-296", type: "preventif", prio: "normale", target: "303", equip: "EQ-CLIM-303", title: "Nettoyage filtres climatisation", desc: "Plan PM-01.", by: "Plan préventif", source: "Plan préventif", assignee: "Kouadio Brou", parts: [], status: "clos", blocking: false, created: "2026-11-15 09:00", closed: "2026-11-15 09:50", minutes: 35 },
      { id: "OT-290", type: "correctif", prio: "normale", target: "Hall", equip: "EQ-ASC-1", title: "Porte d'ascenseur lente", desc: "Fermeture en plusieurs temps.", by: "Hervé Gnagne (concierge)", source: "Employé", assignee: "Lassina Koné", parts: [], status: "clos", blocking: false, created: "2026-11-12 10:00", closed: "2026-11-13 15:00", minutes: 120 },
    ],
    plans: [
      { id: "PM-01", equip: "EQ-CLIM-303", freq: 30, last: "2026-10-27", checklist: ["Nettoyer les filtres", "Contrôler l'écoulement des condensats", "Mesurer la température de soufflage"] },
      { id: "PM-02", equip: "EQ-ASC-1", freq: 30, last: "2026-10-30", checklist: ["Visite du prestataire agréé", "Test du dispositif d'alarme", "Contrôle des portes palières"] },
      { id: "PM-03", equip: "EQ-GE-1", freq: 90, last: "2026-11-20", checklist: ["Vidange et filtres", "Essai en charge 30 min", "Niveau de gazole"] },
      { id: "PM-04", equip: "EQ-PISC", freq: 7, last: "2026-11-18", checklist: ["Nettoyage du préfiltre", "Contrôle pression", "Analyse pH et chlore"] },
      { id: "PM-05", equip: "EQ-CE-2", freq: 180, last: "2026-08-02", checklist: ["Détartrage", "Contrôle de l'anode", "Purge du circuit"] },
    ],
    // télémétrie simulée via la passerelle edge
    iot: [
      { room: "101", temp: 24.5, hum: 58, kwh: 9.8, presence: true, leak: false },
      { room: "202", temp: 23.9, hum: 55, kwh: 8.6, presence: true, leak: false },
      { room: "203", temp: 25.1, hum: 61, kwh: 11.2, presence: false, leak: false },
      { room: "204", temp: 31.4, hum: 72, kwh: 2.1, presence: false, leak: false },
      { room: "302", temp: 23.2, hum: 54, kwh: 10.4, presence: true, leak: false },
      { room: "303", temp: 26.8, hum: 63, kwh: 14.9, presence: false, leak: false },
      { room: "105", temp: 27.5, hum: 66, kwh: 6.3, presence: false, leak: false },
    ],
    predictions: [
      { equip: "EQ-CLIM-303", risk: 0.71, horizon: "10 jours", why: "Consommation en hausse de 34 % à occupation égale et température de soufflage qui dérive.", done: false },
      { equip: "EQ-ASC-1", risk: 0.46, horizon: "30 jours", why: "Temps de fermeture des portes en hausse et 2 ordres correctifs en 3 mois.", done: false },
      { equip: "EQ-SER-105", risk: 0.88, horizon: "3 jours", why: "Décharge de la batterie plus rapide que la moyenne du parc.", done: false },
    ],
    // tâches du jour : temps standard (minutes) par type
    std: { "Départ": 45, "Recouche": 20, "Nettoyage approfondi": 90, "Couverture du soir": 10 },
    // Ne pas déranger / mode intimité : remonté par les serrures ou signalé ; la tâche est replanifiée (EF-HKM-006)
    dnd: { "202": { at: "09:40", retry: "14:00", src: "Signalé par l'étage" } },
    // statuts détaillés en complément du statut de base (EF-HKM-001) : nettoyage en cours, inspectée, hors service vendable
    rs: { "201": "en_cours" },
    inspected: { "302": "2026-11-25 11:20" },
    oos: { "203": "Télévision en panne (chambre vendable)" },
    // secteurs (étage → femme de chambre), présence issue du pointage RH (simulé), crédit de temps par poste (EF-HKM-003)
    sectors: { 1: D.housekeepers[0], 2: D.housekeepers[1], 3: D.housekeepers[2] },
    presence: { [D.housekeepers[0]]: "06:58", [D.housekeepers[1]]: "07:04", [D.housekeepers[2]]: null },
    credit: 420,
    // application mobile du personnel (EF-HKM-004) : mode hors ligne et file de synchronisation
    mobUser: D.housekeepers[0],
    offline: false,
    queue: [],
    notifs: [{ at: "09:12", to: "Réception", text: "Chambre 302 inspectée : prête à la vente" }],
    deepClean: ["105"],
    proposal: null,
    checklist: ["Lit fait selon le standard", "Salle de bain propre et sèche", "Sols et poussière", "Produits d'accueil complets", "Minibar contrôlé", "Climatisation et éclairage fonctionnels", "Aucun objet oublié"],
    inspections: [
      { id: "INS-88", room: "302", date: "2026-11-25 11:20", by: "Akissi N'Guessan", hk: D.housekeepers[2], score: 96, photos: 3, ko: [] },
      { id: "INS-87", room: "203", date: "2026-11-25 10:45", by: "Akissi N'Guessan", hk: D.housekeepers[0], score: 82, photos: 4, ko: ["Produits d'accueil complets"] },
      { id: "INS-86", room: "101", date: "2026-11-25 10:05", by: "Adjoua Kouamé", hk: D.housekeepers[1], score: 71, photos: 5, ko: ["Salle de bain propre et sèche", "Sols et poussière"] },
      { id: "INS-85", room: "303", date: "2026-11-24 12:10", by: "Akissi N'Guessan", hk: D.housekeepers[2], score: 100, photos: 3, ko: [] },
    ],
    keepDays: 90, // durée de conservation paramétrée (RG-HKM-05)
    lost: [
      { id: "OBJ-041", date: "2026-11-24", place: "Ch. 204", desc: "Montre bracelet métal", value: true, store: "Coffre réception", status: "stocke", guest: "" },
      { id: "OBJ-040", date: "2026-11-22", place: "Restaurant", desc: "Lunettes de soleil", value: false, store: "Bureau gouvernante", status: "stocke", guest: "" },
      { id: "OBJ-037", date: "2026-11-10", place: "Ch. 303", desc: "Chargeur de téléphone", value: false, store: "Bureau gouvernante", status: "restitue", guest: G("G1").name },
      { id: "OBJ-021", date: "2026-08-14", place: "Piscine", desc: "Serviette de plage personnelle", value: false, store: "Bureau gouvernante", status: "stocke", guest: "" },
      { id: "OBJ-019", date: "2026-08-02", place: "Ch. 105", desc: "Livre de poche", value: false, store: "Bureau gouvernante", status: "donne", guest: "" },
    ],
    amenities: [
      { label: "Savon 30 g", unit: "pièce", perRoom: 2, office: { 1: 40, 2: 18, 3: 35 }, min: 20 },
      { label: "Gel douche 30 ml", unit: "flacon", perRoom: 2, office: { 1: 52, 2: 44, 3: 12 }, min: 20 },
      { label: "Kit dentaire", unit: "kit", perRoom: 1, office: { 1: 25, 2: 30, 3: 22 }, min: 10 },
      { label: "Eau minérale 50 cl", unit: "bouteille", perRoom: 2, office: { 1: 60, 2: 15, 3: 48 }, min: 24 },
    ],
    seq: 315,
    insSeq: 89,
    objSeq: 42,
  }
  const M = D.mnt
  const EQ = (id) => M.equipments.find((e) => e.id === id)
  const OT = (id) => M.orders.find((o) => o.id === id)
  const PRIO = { critique: ["Critique", "bad"], haute: ["Haute", "warn"], normale: ["Normale", "info"], basse: ["Basse", "outline"] }
  const OST = { ouvert: ["Ouvert", "warn"], en_cours: ["En cours", "info"], attente_pieces: ["Attente pièces", "bad"], clos: ["Clos", "ok"] }
  const LST = { stocke: ["En stock", "info"], restitue: ["Restitué", "ok"], detruit: ["Détruit", "bad"], donne: ["Donné", "outline"] }
  const b2 = (map, k) => badge(map[k][0], map[k][1])
  const muted = (t) => `<span class="muted" style="font-size:12px">${esc(t)}</span>`
  const isRoom = (t) => !!room(t)
  const nextDue = (p) => addDays(p.last, p.freq)
  const openBlocking = (no) => M.orders.filter((o) => o.target === no && o.blocking && o.status !== "clos")
  const openFor = (target, source) => M.orders.find((o) => o.target === target && o.source === source && o.status !== "clos")
  const hhmm = (h) => NOW.slice(11, 16).replace(/^(\d\d)/, (x) => String(Math.min(23, Number(x) + h)).padStart(2, "0"))
  // EF-HKM-001 : propreté détaillée et occupation
  const CS = { propre: ["Propre", "ok"], inspectee: ["Inspectée", "ok"], a_inspecter: ["Propre, à inspecter", "warn"], en_cours: ["En cours de nettoyage", "info"], sale: ["Sale", "warn"], hors_commande: ["Hors commande", "bad"] }
  const OCC = { libre: ["Libre", "outline"], occupee: ["Occupée", "info"], depart: ["Départ", "warn"], arrivee: ["Arrivée", "ok"] }
  const cleanState = (r) => r.hk === "hs" ? "hors_commande" : r.hk === "inspection" ? "a_inspecter" : r.hk === "sale" ? (M.rs[r.no] === "en_cours" ? "en_cours" : "sale") : M.inspected[r.no] ? "inspectee" : "propre"
  const occState = (no) => { const o = occupant(no); if (o) return o.to === today ? "depart" : "occupee"; return D.reservations.some((r) => r.room === no && r.from === today && r.status === "confirmee") ? "arrivee" : "libre" }
  const syncStates = () => D.rooms.forEach((r) => { if (r.hk !== "propre") delete M.inspected[r.no]; if (r.hk !== "sale") delete M.rs[r.no] })
  const accLocks = () => (D.acc && D.acc.locks) || []

  // Indicateurs illustrés : séries sur 14 jours calculées sur les ordres (créés, clos, ouverts en fin de journée)
  const days14 = () => Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  const openAt = (d) => M.orders.filter((o) => o.created.slice(0, 10) <= d && (o.status !== "clos" || (o.closed || "").slice(0, 10) > d)).length
  const dlt = (h) => (h.length > 1 && h[h.length - 2] ? ((h[h.length - 1] - h[h.length - 2]) / Math.abs(h[h.length - 2])) * 100 : null)
  const statRow = (items) => `<div class="grid g4" style="margin-bottom:16px">${items.map(stat).join("")}</div>`
  const countBy = (arr, f) => Object.entries(arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m }, {})).map(([label, value]) => ({ label, value }))

  // ---------- Écran 1 : Maintenance technique ----------
  function maintenance(p) {
    const tab = p[0] || "ordres"
    const open = M.orders.filter((o) => o.status !== "clos")
    return pageHead("Maintenance technique", "Ordres de travail, plans préventifs, capteurs IoT et maintenance prédictive. Données d'exemple ; capteurs et serrures simulés.",
      btn("Déclarer une panne", "go('mnt-ot/ordres/new')"))
      + statRow([
        { label: "Ordres ouverts", value: String(open.length), icon: "wrench", hint: `${open.filter((o) => o.prio === "critique" || o.prio === "haute").length} prioritaires · courbe sur 14 jours`, trend: days14().map(openAt), route: "mnt-ot/ordres" },
        { label: "Chambres hors commande", value: String(D.rooms.filter((r) => r.hk === "hs").length), icon: "bed", hint: "par ordre bloquant ou manuel" },
        { label: "Préventifs en retard", value: String(M.plans.filter((x) => nextDue(x) < today).length), icon: "calendar", hint: `${M.plans.length} plans · échus`, route: "mnt-ot/preventif" },
        { label: "Alertes capteurs", value: String(M.iot.filter((s) => s.leak || s.temp > 29).length), icon: "zap", hint: "passerelle edge simulée", route: "mnt-ot/iot" }])
      + subtabs("mnt-ot", [["ordres", "Ordres de travail"], ["preventif", "Maintenance préventive"], ["iot", "IoT et prédictif"], ["kpi", "Indicateurs"]], tab)
      + ({ ordres: tabOrders, preventif: tabPlans, iot: tabIot, kpi: tabKpi }[tab] || tabOrders)(p.slice(1))
  }

  function tabOrders(p) {
    const f = ui.mntFilter || "actifs"
    const filt = { actifs: (o) => o.status !== "clos", clos: (o) => o.status === "clos", tous: () => true }
    const list = M.orders.filter(filt[f]).sort((a, b) => Object.keys(PRIO).indexOf(a.prio) - Object.keys(PRIO).indexOf(b.prio) || b.created.localeCompare(a.created))
    const cur = p[0] === "new" ? null : OT(p[0]) || list[0]
    const left = `<div class="chips">${Object.entries({ actifs: "Actifs", clos: "Clos", tous: "Tous" }).map(([k, l]) =>
      `<button aria-pressed="${f === k}" onclick="ui.mntFilter='${k}';render()">${l}</button>`).join("")}</div>`
      + listItems(list.map((o) => ({ id: o.id, title: `${o.id} · ${o.title}`, badge: " " + b2(PRIO, o.prio) + (o.blocking ? " " + badge("Bloquant", "bad") : ""), sub: `${isRoom(o.target) ? "Ch. " : ""}${o.target} · ${OST[o.status][0]} · ${o.assignee || "non affecté"}` })), cur && cur.id, "mnt-ot/ordres")
    const d14 = days14(), open = M.orders.filter((o) => o.status !== "clos")
    return split(left, p[0] === "new" ? newOrderForm() : cur ? orderDetail(cur) : `<p class="muted">Aucun ordre.</p>`)
      + `<div class="dash" style="margin-top:16px">
          <div class="w4">${section("Ordres par statut", bars(Object.keys(OST).map((k) => ({ label: OST[k][0], value: M.orders.filter((o) => o.status === k).length })), (v) => v))}</div>
          <div class="w4">${section("Ordres ouverts sur 14 jours", columns(d14.filter((_, i) => i % 2 === 1).map((d) => fd(d)), d14.filter((_, i) => i % 2 === 1).map(openAt), (v) => v))}</div>
          <div class="w4">${section("Ordres actifs par priorité", open.length ? donut(Object.keys(PRIO).map((k) => ({ label: PRIO[k][0], value: open.filter((o) => o.prio === k).length })).filter((x) => x.value), { fmt: (v) => v, center: String(open.length), sub: "actifs" }) : `<p class="muted">Aucun ordre actif.</p>`)}</div>
        </div>`
  }

  function newOrderForm() {
    const targets = [...D.rooms.map((r) => [r.no, "Chambre " + r.no]), ...["Hall", "Restaurant", "Piscine", "Spa", "Local technique", "Cuisine"].map((x) => [x, x])]
    return card("Nouvel ordre de travail", `<p class="muted" style="margin-top:0">Déclaration par tout employé ou client, priorité, affectation, pièces, durée et clôture ${muted("EF-HKM-008")}</p>` + form([
      field("o-title", "Problème constaté", input("o-title", "", 'placeholder="Ex. climatisation bruyante"'), "full"),
      field("o-target", "Lieu / cible", select("o-target", targets, "101")),
      field("o-prio", "Priorité", select("o-prio", Object.entries(PRIO).map(([k, [l]]) => [k, l]), "normale")),
      field("o-source", "Déclaré par", select("o-source", ["Employé", "Client", "IoT", "Serrure"], "Employé")),
      field("o-by", "Nom du déclarant (employé ou client)", input("o-by", "", 'placeholder="Ex. Hervé Gnagne, réception"')),
      field("o-assignee", "Affecter à", select("o-assignee", [["", "— plus tard —"], ...M.techs], "")),
      field("o-desc", "Description", input("o-desc", "", 'placeholder="Détails utiles au technicien"'), "full"),
      `<div class="full"><label class="row" style="color:var(--ink)"><input type="checkbox" id="o-block"> Ordre bloquant : la chambre est mise hors commande tant qu'il est ouvert ${muted("EF-HKM-010")}</label></div>`,
      `<div class="full" id="o-err"></div>`,
      `<div class="full row">${btn("Créer l'ordre", "A.mnt.createOrder()")}${btn("Annuler", "go('mnt-ot/ordres')", "ghost")}</div>`,
    ]))
  }

  function orderDetail(o) {
    const e = o.equip && EQ(o.equip), occ = isRoom(o.target) && occupant(o.target)
    const partsTotal = o.parts.reduce((s, x) => s + x.qty * x.cost, 0)
    return card("", `<div class="row between"><span class="big">${esc(o.id)} — ${esc(o.title)}</span><span class="row">${b2(PRIO, o.prio)}${b2(OST, o.status)}</span></div>
      <p class="muted">${o.type === "preventif" ? "Préventif" : "Correctif"} · ${isRoom(o.target) ? "Chambre " : ""}${esc(o.target)}${e ? " · " + esc(e.label) : ""} · source : ${esc(o.source)} (${esc(o.by)}) · ouvert le ${dt(o.created)}</p>
      <p>${esc(o.desc)}</p>
      ${o.blocking ? `<p class="err">Ordre bloquant : chambre ${esc(o.target)} ${o.status === "clos" ? "remise en service à la clôture" : "hors commande tant que l'ordre est ouvert"}.${occ ? ` Chambre occupée par ${esc(G(occ.guest).name)} : relogement à proposer par la réception.` : ""}</p>` : ""}
      <h3>Affectation</h3>
      ${o.status === "clos" ? `<p>${esc(o.assignee)} · clos le ${dt(o.closed)} · ${o.minutes} min de main-d'œuvre</p>` : `<div class="row" style="flex-wrap:nowrap">${select("o-as-" + o.id, [["", "— non affecté —"], ...M.techs], o.assignee)}${btn("Affecter", `A.mnt.assign(${q(o.id)})`, "ghost")}</div>`}
      <h3>Pièces</h3>
      ${tbl(["Pièce", "#Qté", "#Coût"], o.parts.map((x) => [esc(x.label), x.qty, money(x.qty * x.cost)]), "Aucune pièce.", o.parts.length ? `<tfoot><tr><td colspan="2">Total pièces</td><td class="num">${money(partsTotal)}</td></tr></tfoot>` : "")}
      ${o.status !== "clos" ? `<div class="row" style="margin-top:8px;flex-wrap:nowrap">${input("o-part", "", 'placeholder="Pièce nécessaire (ex. joint)"')}${input("o-pcost", "", 'type="number" min="0" step="500" placeholder="Coût" style="max-width:120px"')}${btn("Demander la pièce", `A.mnt.requestPart(${q(o.id)})`, "ghost")}</div>
        <p class="muted" style="font-size:12px">La demande part aux Achats (PRC) et l'ordre passe en « attente pièces ».</p>
        ${D.prc ? `<div class="row" style="margin-top:8px;flex-wrap:nowrap">${select("o-stock", D.prc.items.filter((i) => i.family === "Pièces techniques").map((i) => { const st = D.prc.stock.find((x) => x.item === i.code && x.store === i.store); return [i.code, `${i.name} — stock ${st ? st.qty : 0}`] }), "")}${btn("Prendre en stock", `A.mnt.takePart(${q(o.id)})`, "ghost")}</div>
        <p class="muted" style="font-size:12px">Sortie du magasin technique vers le centre de coût Technique ; en rupture, une demande d'achat est créée ${muted("EF-HKM-008")}</p>` : ""}
        <h3>Clôture</h3>
        <div class="row" style="flex-wrap:nowrap">${input("o-min", "", 'type="number" min="1" placeholder="Durée (min)" style="max-width:150px"')}${btn("Clôturer l'ordre", `A.mnt.close(${q(o.id)})`, "accent")}</div>` : ""}`)
  }

  function tabPlans() {
    return `<h2>Plans de maintenance préventive ${muted("EF-HKM-009")}</h2>`
      + tbl(["Plan", "Équipement", "#Fréquence", "Dernière", "Prochaine", "Check-list", ""], M.plans.map((x) => {
        const n = nextDue(x), late = n < today, soon = !late && n <= addDays(today, 7)
        const pending = M.orders.find((o) => o.plan === x.id && o.status !== "clos")
        return [esc(x.id), esc(EQ(x.equip).label), `${x.freq} j`, fd(x.last), `${fd(n)} ${late ? badge("En retard", "bad") : soon ? badge("Sous 7 j", "warn") : ""}`,
          `<span class="muted">${esc(x.checklist.join(" · "))}</span>`,
          pending ? badge(pending.id + " ouvert", "outline") : btn("Générer l'ordre", `A.mnt.genPlan(${q(x.id)})`, "ghost sm")]
      }))
      + `<h2>Parc d'équipements</h2>`
      + tbl(["Équipement", "Type", "Emplacement", "#Âge", "#Ordres (historique)"], M.equipments.map((e) => [esc(e.label), esc(e.kind), esc(e.loc), `${e.age} ans`, M.orders.filter((o) => o.equip === e.id).length]))
  }

  function tabIot() {
    return `<h2>Capteurs de chambre ${muted("EF-HKM-011 · passerelle edge simulée")}</h2>`
      + tbl(["Chambre", "#Temp.", "#Humidité", "#kWh (24 h)", "Présence", "Fuite", "État", ""], M.iot.map((s) => {
        const alert = s.leak ? "Fuite détectée" : s.temp > 29 ? "Température élevée" : ""
        return [esc(s.room), `${s.temp.toFixed(1)} °C`, `${s.hum} %`, s.kwh.toFixed(1), s.presence ? "Oui" : "Non", s.leak ? badge("Oui", "bad") : "Non",
          alert ? badge(alert, "bad") : badge("Normal", "ok"),
          (s.temp > 29 && !s.leak ? (openFor(s.room, "IoT") ? badge(openFor(s.room, "IoT").id, "outline") : btn("Créer l'ordre", `A.mnt.iotOrder(${q(s.room)})`, "sm")) + " " : "") + (s.leak ? "" : btn("Simuler une fuite", `A.mnt.simLeak(${q(s.room)})`, "ghost sm"))]
      }))
      + `<h2>Événements de serrure ${muted("EF-HKM-012 · batterie faible, serrure hors ligne (simulé)")}</h2>`
      + (() => {
        const ev = accLocks().filter((l) => l.offline || (l.battery != null && l.battery < 20))
        return tbl(["Porte", "Événement", "Ordre de travail"], ev.map((l) => { const t = l.room || l.door, o = openFor(t, "Serrure")
          return [esc(l.door), l.offline ? badge("Serrure hors ligne", "bad") : badge(`Batterie ${l.battery} %`, "warn"), o ? `${badge(o.id, "outline")} ${muted(OST[o.status][0])}` : btn("Créer l'ordre", `A.mnt.lockOrder(${q(l.id)})`, "sm")] }), "Aucun événement de serrure en cours.")
          + `<div class="row" style="margin-top:8px">${btn("Traiter toutes les alertes (IoT et serrures)", "A.mnt.scanAlerts()", "ghost sm")}${muted("Un ordre par alerte ; pas de doublon si un ordre est déjà ouvert sur la même cible.")}</div>`
      })()
      + `<p class="muted">Une alerte de fuite crée un ordre critique et bloquant ; si la chambre est occupée, le relogement est proposé (US-HKM-02). Les chambres libres sans présence passent la climatisation en mode économie (EF-HKM-014, simulé).</p>`
      + `<h2>Maintenance prédictive</h2>`
      + M.predictions.map((x) => aiBox(`${EQ(x.equip).label} — risque de panne ${Math.round(x.risk * 100)} % sous ${x.horizon}`, x.why + " Proposition : ordre préventif, à valider par le responsable technique.",
        x.done ? badge("Ordre proposé créé", "ok") : btn("Créer l'ordre préventif proposé", `A.mnt.fromPrediction(${q(x.equip)})`, "sm") + btn("Ignorer", `A.mnt.ignorePred(${q(x.equip)})`, "ghost sm"))).join("")
  }

  function tabKpi() {
    const closed = M.orders.filter((o) => o.status === "clos")
    const dt0 = dayTasks().filter((k) => k.kind !== "Couverture du soir")
    const mttr = closed.length ? closed.reduce((s, o) => s + hoursBetween(o.created, o.closed), 0) / closed.length : 0
    const prev = M.orders.filter((o) => o.type === "preventif").length
    const score = M.inspections.reduce((s, i) => s + i.score, 0) / Math.max(1, M.inspections.length)
    const occ = M.iot.filter((s) => occupant(s.room))
    const kwhOcc = occ.reduce((s, x) => s + x.kwh, 0) / Math.max(1, occ.length)
    return `<p class="muted">Indicateurs §11.12, calculés sur les données d'exemple de la maquette (temps de nettoyage et ponctualité : valeurs d'exemple du mois).</p>`
      + `<div class="grid g4">${[
        { label: "Minutes par chambre", value: Math.round(dt0.reduce((s, k) => s + k.minutes, 0) / Math.max(1, dt0.length)) + " min", icon: "clock", hint: "crédit moyen des tâches du jour" },
        { label: "Chambres prêtes à l'heure", value: "91 %", icon: "check", delta: 2.1, hint: "valeur d'exemple du mois · vs mois précédent", trend: [86, 88, 87, 89, 90, 89, 91] },
        { label: "Score d'inspection", value: Math.round(score) + " / 100", icon: "star", hint: `${M.inspections.length} inspections`, trend: M.inspections.map((i) => i.score).reverse(), route: "mnt-hk/inspections" },
        { label: "MTTR", value: mttr.toFixed(1).replace(".", ",") + " h", icon: "wrench", hint: `${closed.length} ordres clos · délai moyen de résolution` },
        { label: "Taux de maintenance préventive", value: pct((prev / Math.max(1, M.orders.length)) * 100), icon: "calendar", hint: "ordres préventifs / total" },
        { label: "Énergie / chambre occupée", value: kwhOcc.toFixed(1).replace(".", ",") + " kWh", icon: "zap", hint: "sur 24 h" }].map(stat).join("")}</div>`
      + `<div class="dash" style="margin-top:16px">
          <div class="w8">${section("Délai de résolution par ordre clos (h)", columns(closed.map((o) => o.id.replace("OT-", "")), closed.map((o) => Math.round(hoursBetween(o.created, o.closed) * 10) / 10), (v) => String(v).replace(".", ",")))}</div>
          <div class="w4">${section("Ordres par source", donut(["Employé", "Client", "IoT", "Serrure", "Plan préventif"].map((s) => ({ label: s, value: M.orders.filter((o) => o.source === s).length })).filter((x) => x.value), { fmt: (v) => v, center: String(M.orders.length), sub: "ordres" }))}</div>
          <div class="w6">${section("Minutes par type de tâche (exemple)", bars([{ label: "Départ", value: 44 }, { label: "Recouche", value: 21 }, { label: "Approfondi", value: 86 }, { label: "Couverture", value: 9 }], (v) => v + " min"))}</div>
          <div class="w6">${section("Coût des pièces par équipement", bars(M.equipments.map((e) => ({ label: e.label, value: M.orders.filter((o) => o.equip === e.id).reduce((s, o) => s + o.parts.reduce((t, x) => t + x.qty * x.cost, 0), 0) })).filter((x) => x.value).sort((a, b) => b.value - a.value), money))}</div>
        </div>`
  }

  // ---------- Écran 2 : Gouvernance (tâches, inspections, objets trouvés) ----------
  function governance(p) {
    const tab = p[0] || "taches"
    syncStates()
    const tasks = dayTasks(), sc = M.inspections.map((i) => i.score).reverse(), avg = sc.reduce((s, x) => s + x, 0) / Math.max(1, sc.length)
    const st = D.rooms.map((r) => cleanState(r))
    return pageHead("Gouvernance et qualité", "Statuts détaillés, tâches du jour générées depuis les séjours, application mobile du personnel, inspections avec check-list, objets trouvés et produits d'accueil.")
      + statRow([
        { label: "Tâches du jour", value: String(tasks.length), icon: "list", hint: `${tasks.reduce((s, k) => s + k.minutes, 0)} min de crédit · ${tasks.filter((k) => !k.who).length} non attribuée(s)`, route: "mnt-hk/taches" },
        { label: "Chambres à nettoyer", value: String(st.filter((c) => c === "sale" || c === "en_cours").length), icon: "bed", hint: `${st.filter((c) => c === "en_cours").length} en cours de nettoyage`, route: "mnt-hk/statuts" },
        { label: "À inspecter", value: String(st.filter((c) => c === "a_inspecter").length), icon: "filecheck", hint: "rôle inspecteur requis", route: "mnt-hk/inspections" },
        { label: "Score d'inspection", value: Math.round(avg) + " / 100", icon: "star", delta: dlt(sc), hint: `moyenne de ${sc.length} inspections · vs précédente`, trend: sc }])
      + subtabs("mnt-hk", [["taches", "Tâches du jour"], ["statuts", "Statuts des chambres"], ["mobile", "Application mobile"], ["inspections", "Inspections"], ["objets", "Objets trouvés"], ["produits", "Produits d'accueil"]], tab)
      + ({ taches: tabTasks, statuts: tabStatus, mobile: tabMobile, inspections: tabInspections, objets: tabLost, produits: tabAmenities }[tab] || tabTasks)(p.slice(1))
  }

  // EF-HKM-002 : génération des tâches du jour selon les séjours
  function dayTasks() {
    const t = []
    const arrTypes = arrivals().filter((r) => r.status === "confirmee")
    inHouse().forEach((r) => {
      const g = G(r.guest)
      t.push({ room: r.room, kind: r.to === today ? "Départ" : "Recouche", vip: g.vip, arrival: r.to === today && arrTypes.some((a) => a.type === room(r.room).type) })
      if (g.vip || room(r.room).type === "SUI") t.push({ room: r.room, kind: "Couverture du soir", vip: g.vip })
    })
    D.rooms.filter((x) => x.hk === "sale" && !occupant(x.no) && !t.some((k) => k.room === x.no)).forEach((x) =>
      t.push({ room: x.no, kind: "Départ", arrival: arrTypes.some((a) => a.type === x.type), vip: false, note: "libérée, sale" }))
    M.deepClean.forEach((no) => t.push({ room: no, kind: "Nettoyage approfondi", vip: false }))
    // RG-HKM-03 : arrivées imminentes et VIP d'abord
    const rank = (k) => (k.kind === "Couverture du soir" ? 9 : 0) + (M.dnd[k.room] ? 5 : 0) + (k.arrival ? 0 : 2) + (k.vip ? 0 : 1)
    return t.map((k) => ({ ...k, minutes: M.std[k.kind], dnd: M.dnd[k.room], who: D.assignments[k.room] || "" })).sort((a, b) => rank(a) - rank(b) || a.room.localeCompare(b.room))
  }

  function tabTasks() {
    const tasks = dayTasks()
    const load = (h) => tasks.filter((k) => k.who === h).reduce((s, k) => s + k.minutes, 0)
    const prop = M.proposal
    return `<div class="dash"><div class="w8">${section("Secteurs, crédits de temps et présence", tbl(["Femme de chambre", "Pointage (RH, simulé)", "Secteur", "#Charge", ""], D.housekeepers.map((h) => [esc(h),
          M.presence[h] ? badge("Présente depuis " + M.presence[h], "ok") : badge("Absente / non pointée", "warn"),
          `<span class="row" style="flex-wrap:nowrap">${[1, 2, 3].map((f) => `<label class="row" style="color:var(--ink);margin:0 6px 0 0"><input type="checkbox" ${M.sectors[f] === h ? "checked" : ""} onchange="A.mnt.setSector(${f}, ${q(h)})"> Étage ${f}</label>`).join("")}</span>`,
          `${load(h)} / ${M.credit} min`, btn(M.presence[h] ? "Marquer absente" : "Simuler le pointage", `A.mnt.togglePresence(${q(h)})`, "ghost sm")]))
        + `<div class="row" style="margin-top:8px">${btn("Affecter par secteur", "A.mnt.bySector()", "sm")}${muted("Secteur d'abord ; si la titulaire est absente ou au-delà de son crédit, la collègue présente la moins chargée. Affectation manuelle dans la colonne « Attribuée à ». EF-HKM-003")}</div>`)}</div>
      <div class="w4">${section(`Charge (crédit ${M.credit} min)`, bars(D.housekeepers.map((h) => ({ label: h.split(" ")[0] + (M.presence[h] ? "" : " (absente)"), value: load(h) })), (v) => v + " min" + (v > M.credit ? " · dépassé" : "")))}
        <div style="margin-top:16px">${section("Tâches par type", donut(countBy(tasks, (k) => k.kind), { fmt: (v) => v, center: String(tasks.length), sub: "tâches" }))}</div></div></div>`
      + section("Tâches du jour", `<p class="muted" style="margin-top:0">${esc("EF-HKM-002 · priorité : arrivées imminentes et VIP (RG-HKM-03)")}</p>` + tbl(["Chambre", "Tâche", "#Crédit", "Priorité", "Ne pas déranger", "Attribuée à"], tasks.map((k) => [
        `<strong>${esc(k.room)}</strong> ${muted(T(room(k.room).type).label)}`, esc(k.kind) + (k.note ? " " + muted(k.note) : ""), k.minutes + " min",
        (k.arrival ? badge("Arrivée attendue", "info") + " " : "") + (k.vip ? badge("VIP", "ok") : "") || muted("standard"),
        k.dnd ? `${badge("DND depuis " + k.dnd.at, "outline")} ${muted(k.dnd.src)}<br>${muted("replanifiée à")} ${select("dr-" + k.room, ["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].includes(k.dnd.retry) ? ["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"] : [k.dnd.retry, "12:00", "14:00", "16:00"], k.dnd.retry, `style="max-width:90px;display:inline-block" onchange="A.mnt.retry(${q(k.room)}, this.value)"`)} ${btn("Levé", `A.mnt.clearDnd(${q(k.room)})`, "ghost sm")}` : btn("Signaler DND", `A.mnt.setDnd(${q(k.room)})`, "ghost sm"),
        k.kind === "Couverture du soir" ? esc(k.who || "—") : select("ta-" + k.room, [["", "—"], ...D.housekeepers.map((h) => [h, h + (M.presence[h] ? "" : " (absente)")])], k.who, `style="max-width:200px" onchange="A.mnt.assignTask(${q(k.room)}, this.value)"`),
      ]))
      + `<div class="row" style="margin-top:8px">${btn("Synchroniser « Ne pas déranger » depuis les serrures", "A.mnt.syncDnd()", "ghost sm")}${muted("Ne pas déranger et mode intimité remontés par les serrures (simulé) : la tâche passe en fin de liste, est replanifiée et l'application bloque l'entrée. EF-HKM-006")}</div>`
      + `<p class="muted">L'entrée du personnel dans une chambre occupée n'est autorisée que pendant une tâche assignée (RG-HKM-04).</p>`)
      + `<div style="margin-top:16px"></div>`
      + aiBox("Optimisation des tâches", prop ? `Proposition : ${prop.map((x) => `${x.room} → ${x.who}`).join(", ")}. Regroupement par étage, arrivées en premier, charge équilibrée. À valider par la gouvernante générale.`
        : "Calcule une affectation qui minimise les déplacements entre étages et traite d'abord les chambres attendues à l'arrivée. Repli sans IA : affectation par secteur (étage).",
        prop ? btn("Valider la proposition", "A.mnt.applyProposal()", "sm") + btn("Rejeter", "A.mnt.dropProposal()", "ghost sm") : btn("Proposer une affectation", "A.mnt.propose()", "sm"))
  }

  function tabStatus() {
    const st = D.rooms.map((r) => ({ r, c: cleanState(r), o: occState(r.no) }))
    return `<div class="dash" style="margin-bottom:16px">
        <div class="w6">${section("Propreté", donut(Object.entries(CS).map(([k, [l]]) => ({ label: l, value: st.filter((x) => x.c === k).length })).filter((x) => x.value), { fmt: (v) => v, center: String(D.rooms.length), sub: "chambres" }))}</div>
        <div class="w6">${section("Occupation", donut(Object.entries(OCC).map(([k, [l]]) => ({ label: l, value: st.filter((x) => x.o === k).length })).filter((x) => x.value), { fmt: (v) => v, center: String(D.rooms.length), sub: "chambres" }), badge(`${Object.keys(M.oos).length} hors service (vendables)`, "warn"))}</div></div>`
      + section("Propreté et occupation · EF-HKM-001", tbl(["Chambre", "Propreté", "Occupation", "Technique", "Action"], st.map(({ r, c, o }) => [
        `<strong>${esc(r.no)}</strong> ${muted(T(r.type).label + " · étage " + r.floor)}`,
        b2(CS, c) + (c === "inspectee" ? " " + muted(dt(M.inspected[r.no])) : "") + (M.dnd[r.no] ? " " + badge("Ne pas déranger", "outline") : ""),
        b2(OCC, o),
        c === "hors_commande" ? `${badge("Hors commande", "bad")} ${muted(r.note || "ordre bloquant")}` : M.oos[r.no] ? `${badge("Hors service", "warn")} ${muted(M.oos[r.no])} ${btn("Rétablir", `A.mnt.toggleOos(${q(r.no)})`, "ghost sm")}` : btn("Déclarer hors service", `A.mnt.toggleOos(${q(r.no)})`, "ghost sm"),
        c === "sale" ? btn("Commencer le nettoyage", `A.mnt.roomAct(${q(r.no)}, 'start')`, "ghost sm")
          : c === "en_cours" ? btn("Terminer le nettoyage", `A.mnt.roomAct(${q(r.no)}, 'done')`, "sm")
          : c === "a_inspecter" ? btn("Inspecter", `go('mnt-hk/inspections/${esc(r.no)}')`, "ghost sm")
          : c === "hors_commande" ? btn("Voir les ordres", "go('mnt-ot/ordres')", "ghost sm")
          : c === "propre" ? btn("Remettre à sale", `A.mnt.roomAct(${q(r.no)}, 'dirty')`, "ghost sm") : muted("prête à la vente"),
      ]))
      + `<p class="muted">Cycle : sale → en cours de nettoyage → propre, à inspecter → inspectée (rôle inspecteur, RG-HKM-02). « Hors service » signale un défaut mineur, la chambre reste vendable ; « hors commande » la retire de la vente tant qu'un ordre bloquant est ouvert (EF-HKM-010). Une chambre libérée au check-out passe à sale / départ (RG-HKM-01).</p>`)
  }

  function tabMobile() {
    const h = M.mobUser
    const mine = dayTasks().filter((k) => k.who === h && k.kind !== "Couverture du soir")
    const body = `<div class="row between" style="margin-bottom:8px"><strong>${esc(h)}</strong>${M.offline ? badge("Hors ligne", "warn") : badge("En ligne", "ok")}</div>
      ${M.offline ? `<p class="muted" style="font-size:12px;margin:0 0 8px">Pas de réseau : ${M.queue.length} mise(s) à jour en file, envoyées au retour du réseau.</p>` : ""}
      ${mine.length ? mine.map((k) => { const r = room(k.room), c = cleanState(r), pend = M.queue.filter((x) => x.no === k.room).map((x) => x.act)
        const eff = pend.includes("done") ? "a_inspecter" : pend.includes("start") ? "en_cours" : c
        return `<div class="card" style="padding:10px;margin-bottom:8px"><div class="row between"><strong>Ch. ${esc(k.room)}</strong>${b2(CS, eff)}</div>
          <div class="muted" style="font-size:12px">${esc(k.kind)} · ${k.minutes} min${k.arrival ? " · arrivée attendue" : ""}${k.vip ? " · VIP" : ""}${pend.length ? " · en attente de synchro" : ""}</div>
          ${k.dnd ? `<p class="err" style="margin:6px 0">Ne pas déranger : ne pas entrer avant ${esc(k.dnd.retry)}</p>` : ""}
          <div class="row" style="margin-top:6px">${eff === "sale" ? btn("Commencer", `A.mnt.mob(${q(k.room)}, 'start')`, "sm") : eff === "en_cours" ? btn("Terminé", `A.mnt.mob(${q(k.room)}, 'done')`, "sm") : ""}${k.dnd ? "" : btn("Ne pas déranger", `A.mnt.mob(${q(k.room)}, 'dnd')`, "ghost sm")}</div></div>` }).join("") : `<p class="muted">Aucune chambre attribuée.</p>`}
      <div class="row" style="margin-top:8px">${btn(M.offline ? "Retrouver le réseau (synchroniser)" : "Passer hors ligne", "A.mnt.toggleOffline()", "ghost sm")}</div>`
    return `<p class="muted">Vue de l'application du personnel d'étage : liste ordonnée par priorité, statut mis à jour en un geste, y compris sans réseau ${muted("EF-HKM-004 · US-HKM-01")}</p>`
      + `<div class="row" style="flex-wrap:nowrap;margin-bottom:10px"><label for="mob-user" style="margin:0">Connectée en tant que</label>${select("mob-user", D.housekeepers, h, `onchange="A.mnt.mobUser(this.value)"`)}</div>`
      + split(phone(body, "Étages — mes chambres"), card("Notifications envoyées", tbl(["Heure", "Destinataire", "Message"], M.notifs.map((n) => [esc(n.at), esc(n.to), esc(n.text)]), "Aucune notification."))
        + card("File hors ligne", tbl(["Heure", "Chambre", "Action"], M.queue.map((x) => [esc(x.at), esc(x.no), esc({ start: "Début de nettoyage", done: "Nettoyage terminé", dnd: "Ne pas déranger" }[x.act])]), "File vide : tout est synchronisé.")))
  }

  function tabInspections(p) {
    const toInspect = D.rooms.filter((r) => r.hk === "inspection")
    const cur = p[0] && room(p[0]) && room(p[0]).hk === "inspection" ? p[0] : toInspect[0] && toInspect[0].no
    const role = ui.mntRole || "inspecteur"
    const left = `<h3>À inspecter</h3>` + (toInspect.length ? listItems(toInspect.map((r) => ({ id: r.no, title: "Chambre " + r.no, sub: `${T(r.type).label} · ${D.assignments[r.no] || "femme de chambre non renseignée"}` })), cur, "mnt-hk/inspections")
      : `<p class="muted">Aucune chambre en attente d'inspection.</p>`)
    const right = cur ? card(`Inspection chambre ${cur}`, `
        <label for="i-role">Profil connecté (simulation)</label>${select("i-role", [["inspecteur", "Gouvernante d'étage (rôle inspecteur)"], ["fdc", "Femme de chambre"]], role, `onchange="ui.mntRole=this.value;render()"`)}
        ${role !== "inspecteur" ? `<p class="err">Seul un utilisateur ayant le rôle inspecteur peut passer une chambre en « inspectée » (RG-HKM-02).</p>` : ""}
        <h3>Check-list ${muted("EF-HKM-005")}</h3>
        ${M.checklist.map((c, i) => `<label class="row" style="color:var(--ink);margin:4px 0"><input type="checkbox" id="i-c${i}" checked> ${esc(c)}</label>`).join("")}
        <div class="form" style="margin-top:10px">${field("i-photos", "Photos jointes", input("i-photos", "3", 'type="number" min="0"'))}${field("i-by", "Inspecteur", select("i-by", M.inspectors, M.inspectors[0]))}</div>
        <p class="muted" style="font-size:12px">Score = part des points conformes. Seuil d'acceptation : 80 / 100, sinon la chambre repart en nettoyage.</p>
        <div class="row">${btn("Valider l'inspection", `A.mnt.inspect(${q(cur)})`, "accent")}</div>`)
      + aiBox("Détection par photo", `Analyse des photos de la chambre ${cur} : trace possible sur le miroir de la salle de bain (confiance 0,78). Le contrôle reste à confirmer par l'inspecteur.`) : ""
    return split(left, right)
      + `<h2>Inspections récentes</h2>`
      + tbl(["Réf.", "Chambre", "Date", "Inspecteur", "Femme de chambre", "#Photos", "#Score", "Points non conformes"], M.inspections.map((i) => [esc(i.id), esc(i.room), dt(i.date), esc(i.by), esc(i.hk), i.photos,
        i.score >= 80 ? badge(i.score + " / 100", "ok") : badge(i.score + " / 100", "bad"), esc(i.ko.join(", ") || "—")]))
  }

  function tabLost() {
    const deadline = (o) => addDays(o.date, M.keepDays)
    return `<div class="row between"><h2>Objets trouvés ${muted("EF-HKM-007")}</h2><span class="muted">Conservation paramétrée : ${M.keepDays} jours (RG-HKM-05)</span></div>`
      + card("Enregistrer un objet", form([
        field("l-desc", "Description", input("l-desc", "", 'placeholder="Ex. écharpe bleue"'), "full"),
        field("l-place", "Lieu de découverte", input("l-place", "", 'placeholder="Ex. Ch. 203"')),
        `<div style="align-self:end"><label class="row" style="color:var(--ink)"><input type="checkbox" id="l-value"> Objet de valeur (coffre)</label></div>`,
        `<div class="full row">${btn("Enregistrer", "A.mnt.addLost()")}${muted("Photo : prise depuis l'application mobile (simulée).")}</div>`,
      ]))
      + tbl(["Réf.", "Trouvé le", "Lieu", "Objet", "Stockage", "Échéance", "Statut", ""], M.lost.map((o) => {
        const expired = deadline(o) < today
        return [esc(o.id), fd(o.date), esc(o.place), esc(o.desc) + (o.value ? " " + badge("Valeur", "info") : ""), esc(o.store), o.status === "stocke" ? fd(deadline(o)) + (expired ? " " + badge("Échue", "warn") : "") : "—",
          b2(LST, o.status) + (o.guest ? " " + muted(o.guest) : ""),
          o.status !== "stocke" ? "" : `<span class="row" style="flex-wrap:nowrap">${btn("Restituer", `A.mnt.returnLost(${q(o.id)})`, "ghost sm")}${btn("Détruire / donner", `A.mnt.disposeLost(${q(o.id)})`, "ghost sm")}</span>`]
      }))
  }

  function tabAmenities() {
    const byFloor = (f) => inHouse().filter((r) => room(r.room).floor === f).length + arrivals().filter((r) => r.status === "confirmee").length / 3
    return `<h2>Produits d'accueil par office d'étage ${muted("EF-HKM-013")}</h2>
      <p class="muted">Consommation estimée à partir des chambres occupées et des arrivées. Un stock sous le minimum déclenche une demande de réassort au magasin (Achats).</p>`
      + tbl(["Produit", "#Étage 1", "#Étage 2", "#Étage 3", "#Minimum", "#Besoin du jour", ""], M.amenities.map((a, i) => {
        const need = Math.ceil([1, 2, 3].reduce((s, f) => s + byFloor(f), 0) * a.perRoom)
        const low = [1, 2, 3].filter((f) => a.office[f] < a.min)
        return [esc(a.label), ...[1, 2, 3].map((f) => a.office[f] < a.min ? `<strong>${a.office[f]}</strong>` : a.office[f]), a.min, need,
          low.length ? btn(`Réassort étage ${low.join(", ")}`, `A.mnt.restock(${i})`, "ghost sm") : badge("OK", "ok")]
      }))
  }

  // ---------- Actions ----------
  const setOutOfService = (no, motif) => {
    const r = room(no)
    if (!r) return
    r.hk = "hs"
    r.note = motif
  }
  const releaseRoom = (no) => {
    const r = room(no)
    if (r && r.hk === "hs" && !openBlocking(no).length) { r.hk = "sale"; delete r.note }
  }
  const pushPurchase = (label, cost, service) => {
    if (!D.prc || !A.prc || !A.prc.externalRequest) return false
    A.prc.externalRequest(label, cost, service)
    return true
  }
  const newOrder = (o) => {
    const id = "OT-" + M.seq++
    M.orders.push({ id, type: "correctif", prio: "normale", parts: [], status: o.assignee ? "en_cours" : "ouvert", blocking: false, created: NOW, by: "Utilisateur connecté", assignee: "", desc: "", ...o })
    const x = OT(id)
    if (x.blocking && isRoom(x.target)) setOutOfService(x.target, `${x.title} (${id})`)
    return x
  }

  const actions = {
    // Appelé par d'autres modules (ex. contrôle d'accès) : crée un ordre de travail et renvoie son id
    external(o) { return newOrder({ by: "Autre module", ...o }).id },
    createOrder() {
      const title = val("o-title"), target = val("o-target")
      if (!title) return ($("#o-err").innerHTML = `<div class="err">Décrivez le problème constaté.</div>`)
      const o = newOrder({ title, target, prio: val("o-prio"), source: val("o-source"), assignee: val("o-assignee"), desc: val("o-desc"), blocking: $("#o-block").checked, by: val("o-by") || (val("o-source") === "Client" ? "Client (via l'application)" : "Utilisateur connecté") })
      const occ = o.blocking && occupant(target)
      toast(o.blocking && isRoom(target) ? `${o.id} créé — chambre ${target} hors commande${occ ? ", relogement à proposer" : ""}` : `${o.id} créé`)
      go("mnt-ot/ordres/" + o.id)
    },
    assign(id) {
      const o = OT(id), who = val("o-as-" + id)
      o.assignee = who
      if (who && o.status === "ouvert") o.status = "en_cours"
      if (!who && o.status === "en_cours") o.status = "ouvert"
      toast(who ? `${id} affecté à ${who}` : `${id} désaffecté`)
      render()
    },
    requestPart(id) {
      const o = OT(id), label = val("o-part"), cost = Number(val("o-pcost")) || 0
      if (!label) return toast("Indiquez la pièce nécessaire")
      o.parts.push({ label, qty: 1, cost })
      o.status = "attente_pieces"
      const sent = pushPurchase(`${label} (pour ${id})`, cost, "Technique")
      toast(sent ? "Demande de pièce transmise aux Achats" : "Pièce ajoutée à l'ordre")
      render()
    },
    close(id) {
      const o = OT(id), min = Number(val("o-min"))
      if (!o.assignee) return toast("Affectez l'ordre à un technicien avant de le clôturer")
      if (!(min > 0)) return toast("Indiquez la durée d'intervention")
      Object.assign(o, { status: "clos", closed: NOW, minutes: min })
      if (o.blocking && isRoom(o.target)) releaseRoom(o.target)
      if (o.plan) { const pl = M.plans.find((x) => x.id === o.plan); if (pl) pl.last = today }
      toast(o.blocking && isRoom(o.target) && room(o.target).hk === "sale" ? `${id} clos — chambre ${o.target} remise en service (à nettoyer)` : `${id} clos`)
      render()
    },
    genPlan(pid) {
      const pl = M.plans.find((x) => x.id === pid), e = EQ(pl.equip)
      const o = newOrder({ type: "preventif", plan: pid, target: e.loc, equip: e.id, title: pl.checklist[0], desc: `Plan ${pid} : ${pl.checklist.join(", ")}.`, source: "Plan préventif", by: "Plan préventif" })
      toast(`${o.id} généré depuis ${pid}`)
      render()
    },
    simLeak(no) {
      const s = M.iot.find((x) => x.room === no)
      s.leak = true
      const o = newOrder({ title: "Fuite d'eau détectée", target: no, prio: "critique", source: "IoT", by: "Capteur IoT", blocking: true, desc: "Alerte du capteur de fuite (simulé) : intervention immédiate." })
      const occ = occupant(no)
      toast(`${o.id} critique créé — chambre ${no} hors commande${occ ? " ; client à reloger" : ""}`)
      render()
    },
    fromPrediction(eid) {
      const pr = M.predictions.find((x) => x.equip === eid), e = EQ(eid)
      const o = newOrder({ type: "preventif", target: e.loc, equip: eid, title: "Intervention préventive (prédiction IA)", desc: pr.why, source: "Plan préventif", by: "Maintenance prédictive (simulée)" })
      pr.done = true
      toast(`${o.id} créé et proposé au responsable technique`)
      render()
    },
    ignorePred(eid) {
      M.predictions = M.predictions.filter((x) => x.equip !== eid)
      toast("Prédiction ignorée")
      render()
    },
    setDnd(no) { M.dnd[no] = { at: NOW.slice(11), retry: hhmm(2), src: "Signalé par l'étage" }; toast(`Chambre ${no} : tâche replanifiée à ${hhmm(2)} (Ne pas déranger)`); render() },
    clearDnd(no) { delete M.dnd[no]; toast(`Chambre ${no} : Ne pas déranger levé`); render() },
    retry(no, t) { if (M.dnd[no]) M.dnd[no].retry = t; toast(`Chambre ${no} : passage replanifié à ${t}`); render() },
    syncDnd() {
      let on = 0, off = 0
      accLocks().filter((l) => l.room).forEach((l) => {
        if (l.dnd && !M.dnd[l.room]) { M.dnd[l.room] = { at: NOW.slice(11), retry: hhmm(2), src: "Serrure (mode intimité)" }; on++ }
        if (!l.dnd && M.dnd[l.room] && /^Serrure/.test(M.dnd[l.room].src)) { delete M.dnd[l.room]; off++ }
      })
      toast(on || off ? `${on} « Ne pas déranger » reçu(s) des serrures, ${off} levé(s) — tâches replanifiées` : "Serrures synchronisées : aucun changement")
      render()
    },
    // EF-HKM-003 : secteurs, présence, crédits
    setSector(f, h) { M.sectors[f] = h; toast(`Étage ${f} : secteur de ${h}`); render() },
    togglePresence(h) { M.presence[h] = M.presence[h] ? null : NOW.slice(11); toast(M.presence[h] ? `${h} pointée à ${M.presence[h]} (simulé)` : `${h} marquée absente`); render() },
    assignTask(no, h) {
      if (h && !M.presence[h]) { toast(`${h} n'a pas pointé : affectation impossible`); return render() }
      if (h) D.assignments[no] = h; else delete D.assignments[no]
      const load = dayTasks().filter((k) => k.who === h && k.kind !== "Couverture du soir").reduce((s, k) => s + k.minutes, 0)
      toast(h ? `Chambre ${no} → ${h}${load > M.credit ? ` — attention, crédit dépassé (${load} / ${M.credit} min)` : ""}` : `Chambre ${no} désaffectée`)
      render()
    },
    bySector() {
      const tasks = dayTasks().filter((k) => k.kind !== "Couverture du soir")
      const present = D.housekeepers.filter((h) => M.presence[h])
      if (!present.length) return toast("Aucune femme de chambre pointée")
      const load = Object.fromEntries(present.map((h) => [h, 0]))
      let moved = 0
      tasks.forEach((k) => {
        const owner = M.sectors[room(k.room).floor]
        let who = owner && M.presence[owner] && load[owner] + k.minutes <= M.credit ? owner : present.slice().sort((a, b) => load[a] - load[b])[0]
        load[who] += k.minutes
        if (D.assignments[k.room] !== who) moved++
        D.assignments[k.room] = who
      })
      toast(`${tasks.length} tâche(s) affectée(s) par secteur (${moved} changement(s))`)
      render()
    },
    // EF-HKM-001 / EF-HKM-004 : transitions de propreté (écran et application mobile)
    roomAct(no, act, quiet) {
      const r = room(no)
      if (act === "start") {
        if (r.hk !== "sale") return quiet ? "état changé" : toast("La chambre n'est pas à nettoyer")
        if (M.dnd[no]) return quiet ? "Ne pas déranger" : toast(`Ne pas déranger : entrée interdite avant ${M.dnd[no].retry}`)
        M.rs[no] = "en_cours"
      } else if (act === "done") {
        if (r.hk !== "sale") return quiet ? "état changé" : toast("Aucun nettoyage en cours")
        r.hk = "inspection"; delete M.rs[no]
        M.notifs.unshift({ at: NOW.slice(11), to: "Gouvernante d'étage", text: `Chambre ${no} nettoyée : à inspecter` })
      } else if (act === "dirty") { r.hk = "sale"; delete M.inspected[no] }
      else if (act === "dnd") M.dnd[no] = { at: NOW.slice(11), retry: hhmm(2), src: "Application mobile" }
      if (quiet) return ""
      toast({ start: `Chambre ${no} : nettoyage en cours`, done: `Chambre ${no} : à inspecter — gouvernante notifiée`, dirty: `Chambre ${no} : sale`, dnd: `Chambre ${no} : replanifiée` }[act])
      render()
    },
    toggleOos(no) {
      if (M.oos[no]) { delete M.oos[no]; toast(`Chambre ${no} rétablie`); return render() }
      const why = prompt(`Chambre ${no} hors service (reste vendable) : motif`, "Télévision en panne")
      if (!why) return
      M.oos[no] = why
      toast(`Chambre ${no} hors service — signalée à la maintenance, reste vendable`)
      render()
    },
    mobUser(h) { M.mobUser = h; render() },
    mob(no, act) {
      if (act === "start" && M.dnd[no]) return toast(`Ne pas déranger : ne pas entrer avant ${M.dnd[no].retry}`)
      if (M.offline) { M.queue.push({ no, act, at: NOW.slice(11) }); toast(`Hors ligne : mise à jour en file (${M.queue.length})`); return render() }
      actions.roomAct(no, act)
    },
    toggleOffline() {
      if (!M.offline) { M.offline = true; toast("Application hors ligne (simulé)"); return render() }
      M.offline = false
      const q0 = M.queue.splice(0), ko = q0.map((x) => actions.roomAct(x.no, x.act, true)).filter(Boolean)
      toast(`${q0.length - ko.length} mise(s) à jour synchronisée(s)${ko.length ? `, ${ko.length} rejetée(s) (conflit : ${ko.join(", ")})` : ""}`)
      render()
    },
    // EF-HKM-012 : ordres sur alertes IoT et serrures
    iotOrder(no) {
      if (openFor(no, "IoT")) return toast("Un ordre IoT est déjà ouvert pour cette chambre")
      const s = M.iot.find((x) => x.room === no)
      const o = newOrder({ title: "Température anormale", target: no, prio: "haute", source: "IoT", by: "Capteur IoT", equip: M.equipments.find((e) => e.loc === no && e.kind === "Climatisation")?.id, desc: `Alerte capteur (simulé) : ${s.temp.toFixed(1)} °C, humidité ${s.hum} %.` })
      toast(`${o.id} créé sur alerte de température`)
      render()
    },
    lockOrder(id, quiet) {
      const l = accLocks().find((x) => x.id === id), t = l.room || l.door
      if (openFor(t, "Serrure")) return quiet ? null : toast("Un ordre est déjà ouvert pour cette serrure")
      const o = newOrder({ title: l.offline ? "Serrure hors ligne" : "Batterie faible serrure", target: t, prio: l.offline ? "haute" : "normale", source: "Serrure", by: "Système serrures", desc: l.offline ? `Aucun battement reçu de ${l.door} (simulé).` : `Batterie à ${l.battery} % sur ${l.door} (simulé).` })
      if (quiet) return o
      toast(`${o.id} créé sur événement de serrure`)
      render()
    },
    scanAlerts() {
      let n = 0
      M.iot.filter((s) => s.temp > 29 && !s.leak && !openFor(s.room, "IoT")).forEach((s) => { n++; newOrder({ title: "Température anormale", target: s.room, prio: "haute", source: "IoT", by: "Capteur IoT", desc: `Alerte capteur (simulé) : ${s.temp.toFixed(1)} °C.` }) })
      accLocks().filter((l) => l.offline || (l.battery != null && l.battery < 20)).forEach((l) => { if (actions.lockOrder(l.id, true)) n++ })
      toast(n ? `${n} ordre(s) de travail créé(s) depuis les alertes` : "Toutes les alertes ont déjà un ordre ouvert")
      render()
    },
    takePart(id) {
      const o = OT(id), it = D.prc.items.find((i) => i.code === val("o-stock"))
      if (!it) return
      const st = D.prc.stock.find((x) => x.item === it.code && x.store === it.store)
      if (!st || st.qty < 1) {
        o.parts.push({ label: it.name, qty: 1, cost: it.cost }); o.status = "attente_pieces"
        pushPurchase(`${it.name} (pour ${id})`, it.cost, "Technique")
        toast(`Rupture de ${it.name} : demande d'achat créée, ordre en attente pièces`)
        return render()
      }
      A.prc.consume([{ label: it.name, qty: 1 }], "Technique")
      o.parts.push({ label: it.name, qty: 1, cost: it.cost, fromStock: true })
      toast(`${it.name} sorti du magasin technique pour ${id}`)
      render()
    },
    propose() {
      // regroupement par étage, puis équilibrage de la charge
      const tasks = dayTasks().filter((k) => k.kind !== "Couverture du soir")
      const present = D.housekeepers.filter((h) => M.presence[h])
      if (!present.length) return toast("Aucune femme de chambre pointée")
      const load = Object.fromEntries(present.map((h) => [h, 0]))
      const floorOwner = {}
      M.proposal = []
      tasks.forEach((k) => {
        const f = room(k.room).floor
        let who = floorOwner[f]
        if (!who || load[who] > 300) who = Object.keys(load).sort((a, b) => load[a] - load[b])[0]
        floorOwner[f] = floorOwner[f] || who
        load[who] += k.minutes
        if (!M.proposal.some((x) => x.room === k.room)) M.proposal.push({ room: k.room, who })
      })
      render()
    },
    applyProposal() {
      M.proposal.forEach((x) => (D.assignments[x.room] = x.who))
      toast(`${M.proposal.length} chambre(s) affectée(s) après validation`)
      M.proposal = null
      render()
    },
    dropProposal() { M.proposal = null; toast("Proposition rejetée : affectation par secteur conservée"); render() },
    inspect(no) {
      if ((ui.mntRole || "inspecteur") !== "inspecteur") return toast("Action réservée au rôle inspecteur (RG-HKM-02)")
      const ko = M.checklist.filter((_, i) => !$("#i-c" + i).checked)
      const score = Math.round(((M.checklist.length - ko.length) / M.checklist.length) * 100)
      M.inspections.unshift({ id: "INS-" + M.insSeq++, room: no, date: NOW, by: val("i-by"), hk: D.assignments[no] || "—", score, photos: Number(val("i-photos")) || 0, ko })
      room(no).hk = score >= 80 ? "propre" : "sale"
      if (score >= 80) { M.inspected[no] = NOW; M.notifs.unshift({ at: NOW.slice(11), to: "Réception", text: `Chambre ${no} inspectée : prête à la vente` }) }
      toast(score >= 80 ? `Chambre ${no} inspectée (${score}/100) — prête à la vente` : `Chambre ${no} refusée (${score}/100) — renvoyée en nettoyage`)
      go("mnt-hk/inspections")
    },
    addLost() {
      const desc = val("l-desc"), place = val("l-place")
      if (!desc || !place) return toast("Indiquez l'objet et le lieu")
      const value = $("#l-value").checked
      M.lost.unshift({ id: "OBJ-0" + M.objSeq++, date: today, place, desc, value, store: value ? "Coffre réception" : "Bureau gouvernante", status: "stocke", guest: "" })
      toast(value ? "Objet de valeur enregistré — à déposer au coffre" : "Objet enregistré")
      render()
    },
    returnLost(id) {
      const o = M.lost.find((x) => x.id === id)
      const who = prompt("Restitué à (nom du client, pièce d'identité vérifiée) :", "")
      if (!who) return
      Object.assign(o, { status: "restitue", guest: who })
      toast(`${id} restitué`)
      render()
    },
    disposeLost(id) {
      const o = M.lost.find((x) => x.id === id)
      if (addDays(o.date, M.keepDays) >= today) return toast(`Conservation en cours jusqu'au ${fd(addDays(o.date, M.keepDays))} : destruction ou don impossible`)
      o.status = o.value ? "detruit" : "donne"
      toast(`${id} : ${LST[o.status][0].toLowerCase()}`)
      render()
    },
    restock(i) {
      const a = M.amenities[i]
      const floors = [1, 2, 3].filter((f) => a.office[f] < a.min)
      floors.forEach((f) => (a.office[f] = a.min * 2))
      const sent = pushPurchase(`Réassort ${a.label} (étages ${floors.join(", ")})`, 0, "Hébergement")
      toast(`Réassort ${a.label} servi par le magasin${sent ? " — demande tracée aux Achats" : ""}`)
      render()
    },
  }

  HMS.module({
    code: "mnt", group: "Opérations", title: "Housekeeping et maintenance", phase: "9-10", spec: "§11 HKM",
    screens: [
      { id: "mnt-ot", label: "Maintenance technique", view: maintenance },
      { id: "mnt-hk", label: "Gouvernance et qualité", view: governance },
    ],
    actions,
  })
})()
