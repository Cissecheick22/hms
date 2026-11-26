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
    dnd: { "202": "09:40" },
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
  const PRIO = { critique: ["Critique", "on"], haute: ["Haute", "dark"], normale: ["Normale", ""], basse: ["Basse", "outline"] }
  const OST = { ouvert: ["Ouvert", ""], en_cours: ["En cours", "on"], attente_pieces: ["Attente pièces", "outline"], clos: ["Clos", "dark"] }
  const LST = { stocke: ["En stock", ""], restitue: ["Restitué", "on"], detruit: ["Détruit", "dark"], donne: ["Donné", "outline"] }
  const b2 = (map, k) => badge(map[k][0], map[k][1])
  const muted = (t) => `<span class="muted" style="font-size:12px">${esc(t)}</span>`
  const isRoom = (t) => !!room(t)
  const nextDue = (p) => addDays(p.last, p.freq)
  const openBlocking = (no) => M.orders.filter((o) => o.target === no && o.blocking && o.status !== "clos")

  // ---------- Écran 1 : Maintenance technique ----------
  function maintenance(p) {
    const tab = p[0] || "ordres"
    const open = M.orders.filter((o) => o.status !== "clos")
    return pageHead("Maintenance technique", "Ordres de travail, plans préventifs, capteurs IoT et maintenance prédictive. Données d'exemple ; capteurs et serrures simulés.",
      btn("Déclarer une panne", "go('mnt-ot/ordres/new')"))
      + cards([kpi("Ordres ouverts", open.length, `${open.filter((o) => o.prio === "critique" || o.prio === "haute").length} prioritaires`),
        kpi("Chambres hors commande", D.rooms.filter((r) => r.hk === "hs").length, "par ordre bloquant ou manuel"),
        kpi("Préventifs en retard", M.plans.filter((x) => nextDue(x) < today).length, "plans échus"),
        kpi("Alertes capteurs", M.iot.filter((s) => s.leak || s.temp > 29).length, "passerelle edge simulée")])
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
      + listItems(list.map((o) => ({ id: o.id, title: `${o.id} · ${o.title}`, badge: " " + b2(PRIO, o.prio) + (o.blocking ? " " + badge("Bloquant", "dark") : ""), sub: `${isRoom(o.target) ? "Ch. " : ""}${o.target} · ${OST[o.status][0]} · ${o.assignee || "non affecté"}` })), cur && cur.id, "mnt-ot/ordres")
    return split(left, p[0] === "new" ? newOrderForm() : cur ? orderDetail(cur) : `<p class="muted">Aucun ordre.</p>`)
  }

  function newOrderForm() {
    const targets = [...D.rooms.map((r) => [r.no, "Chambre " + r.no]), ...["Hall", "Restaurant", "Piscine", "Spa", "Local technique", "Cuisine"].map((x) => [x, x])]
    return card("Nouvel ordre de travail", form([
      field("o-title", "Problème constaté", input("o-title", "", 'placeholder="Ex. climatisation bruyante"'), "full"),
      field("o-target", "Lieu / cible", select("o-target", targets, "101")),
      field("o-prio", "Priorité", select("o-prio", Object.entries(PRIO).map(([k, [l]]) => [k, l]), "normale")),
      field("o-source", "Déclaré par", select("o-source", ["Employé", "Client", "IoT", "Serrure"], "Employé")),
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
        <h3>Clôture</h3>
        <div class="row" style="flex-wrap:nowrap">${input("o-min", "", 'type="number" min="1" placeholder="Durée (min)" style="max-width:150px"')}${btn("Clôturer l'ordre", `A.mnt.close(${q(o.id)})`, "accent")}</div>` : ""}`)
  }

  function tabPlans() {
    return `<h2>Plans de maintenance préventive ${muted("EF-HKM-009")}</h2>`
      + tbl(["Plan", "Équipement", "#Fréquence", "Dernière", "Prochaine", "Check-list", ""], M.plans.map((x) => {
        const n = nextDue(x), late = n < today, soon = !late && n <= addDays(today, 7)
        const pending = M.orders.find((o) => o.plan === x.id && o.status !== "clos")
        return [esc(x.id), esc(EQ(x.equip).label), `${x.freq} j`, fd(x.last), `${fd(n)} ${late ? badge("En retard", "on") : soon ? badge("Sous 7 j", "outline") : ""}`,
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
        return [esc(s.room), `${s.temp.toFixed(1)} °C`, `${s.hum} %`, s.kwh.toFixed(1), s.presence ? "Oui" : "Non", s.leak ? badge("Oui", "on") : "Non",
          alert ? badge(alert, "on") : badge("Normal", "outline"),
          s.leak ? "" : btn("Simuler une fuite", `A.mnt.simLeak(${q(s.room)})`, "ghost sm")]
      }))
      + `<p class="muted">Une alerte de fuite crée un ordre critique et bloquant ; si la chambre est occupée, le relogement est proposé (US-HKM-02). Les chambres libres sans présence passent la climatisation en mode économie (EF-HKM-014, simulé).</p>`
      + `<h2>Maintenance prédictive</h2>`
      + M.predictions.map((x) => aiBox(`${EQ(x.equip).label} — risque de panne ${Math.round(x.risk * 100)} % sous ${x.horizon}`, x.why + " Proposition : ordre préventif, à valider par le responsable technique.",
        x.done ? badge("Ordre proposé créé", "on") : btn("Créer l'ordre préventif proposé", `A.mnt.fromPrediction(${q(x.equip)})`, "sm") + btn("Ignorer", `A.mnt.ignorePred(${q(x.equip)})`, "ghost sm"))).join("")
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
      + cards([kpi("Minutes par chambre", Math.round(dt0.reduce((s, k) => s + k.minutes, 0) / Math.max(1, dt0.length)) + " min", "crédit moyen des tâches du jour"), kpi("Chambres prêtes à l'heure", "91 %", "valeur d'exemple du mois"),
        kpi("Score d'inspection", Math.round(score) + " / 100", `${M.inspections.length} inspections`), kpi("MTTR", mttr.toFixed(1).replace(".", ",") + " h", `${closed.length} ordres clos`),
        kpi("Taux de maintenance préventive", pct((prev / Math.max(1, M.orders.length)) * 100), "ordres préventifs / total"), kpi("Énergie / chambre occupée", kwhOcc.toFixed(1).replace(".", ",") + " kWh", "sur 24 h")])
      + cards([card("Minutes par type de tâche", bars([{ label: "Départ", value: 44 }, { label: "Recouche", value: 21 }, { label: "Approfondi", value: 86 }, { label: "Couverture", value: 9 }], (v) => v + " min")),
        card("Ordres par source", bars(["Employé", "Client", "IoT", "Serrure", "Plan préventif"].map((s) => ({ label: s, value: M.orders.filter((o) => o.source === s).length })))),
        card("Délai de résolution par ordre clos (h)", columns(closed.map((o) => o.id.replace("OT-", "")), closed.map((o) => Math.round(hoursBetween(o.created, o.closed) * 10) / 10)))])
  }

  // ---------- Écran 2 : Gouvernance (tâches, inspections, objets trouvés) ----------
  function governance(p) {
    const tab = p[0] || "taches"
    return pageHead("Gouvernance et qualité", "Tâches du jour générées depuis les séjours, inspections avec check-list, objets trouvés et produits d'accueil. Statuts et répartition simple : écran « Statut des chambres ».")
      + subtabs("mnt-hk", [["taches", "Tâches du jour"], ["inspections", "Inspections"], ["objets", "Objets trouvés"], ["produits", "Produits d'accueil"]], tab)
      + ({ taches: tabTasks, inspections: tabInspections, objets: tabLost, produits: tabAmenities }[tab] || tabTasks)(p.slice(1))
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
    const rank = (k) => (k.kind === "Couverture du soir" ? 9 : 0) + (k.arrival ? 0 : 2) + (k.vip ? 0 : 1)
    return t.map((k) => ({ ...k, minutes: M.std[k.kind], dnd: M.dnd[k.room], who: D.assignments[k.room] || "" })).sort((a, b) => rank(a) - rank(b) || a.room.localeCompare(b.room))
  }

  function tabTasks() {
    const tasks = dayTasks()
    const load = (h) => tasks.filter((k) => k.who === h).reduce((s, k) => s + k.minutes, 0)
    const prop = M.proposal
    return cards(D.housekeepers.map((h) => kpi(h, load(h) + " min", `${tasks.filter((k) => k.who === h).length} tâche(s) · crédit 420 min`)))
      + `<h2>Tâches du jour ${muted("EF-HKM-002 · priorité : arrivées imminentes et VIP (RG-HKM-03)")}</h2>`
      + tbl(["Chambre", "Tâche", "#Crédit", "Priorité", "Ne pas déranger", "Attribuée à"], tasks.map((k) => [
        `<strong>${esc(k.room)}</strong> ${muted(T(room(k.room).type).label)}`, esc(k.kind) + (k.note ? " " + muted(k.note) : ""), k.minutes + " min",
        (k.arrival ? badge("Arrivée attendue", "on") + " " : "") + (k.vip ? badge("VIP", "dark") : "") || muted("standard"),
        k.dnd ? `${badge("DND depuis " + k.dnd, "outline")} ${muted("replanifiée à 14 h")} ${btn("Levé", `A.mnt.clearDnd(${q(k.room)})`, "ghost sm")}` : btn("Signaler DND", `A.mnt.setDnd(${q(k.room)})`, "ghost sm"),
        esc(k.who || "—"),
      ]))
      + `<p class="muted">Le « Ne pas déranger » remonte normalement des serrures (simulé ici) ; l'entrée du personnel dans une chambre occupée n'est autorisée que pendant une tâche assignée (RG-HKM-04).</p>`
      + aiBox("Optimisation des tâches", prop ? `Proposition : ${prop.map((x) => `${x.room} → ${x.who}`).join(", ")}. Regroupement par étage, arrivées en premier, charge équilibrée. À valider par la gouvernante générale.`
        : "Calcule une affectation qui minimise les déplacements entre étages et traite d'abord les chambres attendues à l'arrivée. Repli sans IA : affectation par secteur (étage).",
        prop ? btn("Valider la proposition", "A.mnt.applyProposal()", "sm") + btn("Rejeter", "A.mnt.dropProposal()", "ghost sm") : btn("Proposer une affectation", "A.mnt.propose()", "sm"))
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
        i.score >= 80 ? badge(i.score + " / 100", "on") : badge(i.score + " / 100", "dark"), esc(i.ko.join(", ") || "—")]))
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
        return [esc(o.id), fd(o.date), esc(o.place), esc(o.desc) + (o.value ? " " + badge("Valeur", "dark") : ""), esc(o.store), o.status === "stocke" ? fd(deadline(o)) + (expired ? " " + badge("Échue", "on") : "") : "—",
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
          low.length ? btn(`Réassort étage ${low.join(", ")}`, `A.mnt.restock(${i})`, "ghost sm") : badge("OK", "outline")]
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
      const o = newOrder({ title, target, prio: val("o-prio"), source: val("o-source"), assignee: val("o-assignee"), desc: val("o-desc"), blocking: $("#o-block").checked })
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
    setDnd(no) { M.dnd[no] = NOW.slice(11); toast(`Chambre ${no} : tâche replanifiée (Ne pas déranger)`); render() },
    clearDnd(no) { delete M.dnd[no]; toast(`Chambre ${no} : Ne pas déranger levé`); render() },
    propose() {
      // regroupement par étage, puis équilibrage de la charge
      const tasks = dayTasks().filter((k) => k.kind !== "Couverture du soir")
      const load = Object.fromEntries(D.housekeepers.map((h) => [h, 0]))
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
