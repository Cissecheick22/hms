// modules/evenements.js — Spec §15 Événements, banquets et MICE (EVT)
// Pipeline et devis, salles et configurations, agenda des espaces avec détection de conflits (salles divisibles),
// fiche événement (programme, BEO, couverts garantis, bloc de chambres et cut-off, contrat et acomptes), facturation, KPI et IA.
;(() => {
  const mins = (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b }
  const muted = (t) => `<span class="muted">${esc(t)}</span>`
  const err = (m) => `<div class="err">${esc(m)}</div>`
  const fdy = (s) => `${fd(s)}/${s.slice(0, 4)}`
  const CONF = { theatre: "Théâtre", classe: "Classe", banquet: "Banquet", cocktail: "Cocktail", conseil: "Conseil" }

  // ---------- Données d'exemple ----------
  D.evt = {
    rooms: [
      { id: "AKW", name: "Salle Akwaba (entière)", m2: 240, caps: { theatre: 220, classe: 120, banquet: 180, cocktail: 300 }, parts: ["AKA", "AKB"], equip: "2 vidéoprojecteurs, sonorisation, scène modulable", day: 900000 },
      { id: "AKA", name: "Akwaba A", m2: 120, caps: { theatre: 110, classe: 60, banquet: 90, cocktail: 150 }, parent: "AKW", equip: "Vidéoprojecteur, sonorisation", day: 500000 },
      { id: "AKB", name: "Akwaba B", m2: 120, caps: { theatre: 110, classe: 60, banquet: 90, cocktail: 150 }, parent: "AKW", equip: "Vidéoprojecteur, sonorisation", day: 500000 },
      { id: "LAG", name: "Salon Lagune", m2: 60, caps: { theatre: 50, classe: 24, banquet: 40, cocktail: 70 }, equip: "Écran 75 pouces, visioconférence", day: 250000 },
      { id: "JAR", name: "Terrasse Jardin", m2: 300, caps: { banquet: 150, cocktail: 250 }, equip: "Éclairage d'ambiance, prises extérieures", day: 600000 },
      { id: "CON", name: "Salle du conseil", m2: 40, caps: { conseil: 16 }, equip: "Écran, visioconférence, paperboard", day: 150000 },
    ],
    // status : prospect | option | definitif | annule ; quote : brouillon | envoye | signe | refuse
    events: [
      { id: "E-301", name: "Séminaire annuel", org: "Société Ivoirienne Exemple", contact: "kouame.assi@exemple.test", type: "Séminaire", status: "definitif", quote: "signe", signed: "2026-10-28", master: "CM-301",
        guaranteed: 55, actual: null, menu: 18000,
        fns: [
          { id: "F1", room: "AKA", date: "2026-11-27", start: "08:30", end: "17:30", config: "classe", covers: 60, label: "Plénière jour 1" },
          { id: "F2", room: "JAR", date: "2026-11-27", start: "19:00", end: "22:00", config: "cocktail", covers: 60, label: "Cocktail dînatoire" },
          { id: "F3", room: "AKA", date: "2026-11-28", start: "08:30", end: "12:30", config: "classe", covers: 60, label: "Ateliers jour 2" }],
        lines: [{ label: "Location Akwaba A — 1,5 jour", qty: 1, unit: 750000, kind: "Location" }, { label: "Location Terrasse Jardin — soirée", qty: 1, unit: 400000, kind: "Location" },
          { label: "Forfait journée d'étude (pauses + déjeuner)", qty: 0, unit: 18000, kind: "F&B", perCover: 2 }, { label: "Cocktail dînatoire", qty: 0, unit: 15000, kind: "F&B", perCover: 1 },
          { label: "Technicien son et lumière", qty: 2, unit: 75000, kind: "Technique" }],
        deposits: [{ label: "Acompte 30 % à la signature", due: "2026-10-30", pct: 0.3, paid: true }, { label: "Acompte 40 % à J-15", due: "2026-11-12", pct: 0.4, paid: true }, { label: "Solde à la fin de l'événement", due: "2026-11-28", pct: 0.3, paid: false }],
        block: { type: "STD", rooms: 4, from: "2026-11-27", to: "2026-11-29", rate: 40000, cutoff: "2026-11-20", picked: 3, created: true, released: false },
        beo: true, access: [] },
      { id: "E-302", name: "Mariage", org: "Famille Kouassi (exemple)", contact: "estelle.kouassi@exemple.test", type: "Mariage", status: "option", due: "2026-11-28", quote: "envoye", master: null,
        guaranteed: 170, actual: null, menu: 32000,
        fns: [
          { id: "F1", room: "JAR", date: "2026-12-12", start: "17:00", end: "19:00", config: "cocktail", covers: 180, label: "Vin d'honneur" },
          { id: "F2", room: "AKW", date: "2026-12-12", start: "19:30", end: "23:59", config: "banquet", covers: 170, label: "Dîner et soirée dansante" }],
        lines: [{ label: "Location Salle Akwaba entière — soirée", qty: 1, unit: 900000, kind: "Location" }, { label: "Location Terrasse Jardin", qty: 1, unit: 450000, kind: "Location" },
          { label: "Menu de mariage", qty: 0, unit: 32000, kind: "F&B", perCover: 1 }, { label: "Sonorisation et DJ (prestataire)", qty: 1, unit: 350000, kind: "Technique" }],
        deposits: [{ label: "Acompte 50 % à la signature", due: "2026-11-28", pct: 0.5, paid: false }, { label: "Solde à J-7", due: "2026-12-05", pct: 0.5, paid: false }],
        block: { type: "SUP", rooms: 3, from: "2026-12-12", to: "2026-12-13", rate: 55000, cutoff: "2026-11-28", picked: 0, created: false, released: false },
        beo: false, access: [] },
      { id: "E-303", name: "Conférence régionale", org: "Association Entreprendre Lagune Exemple", contact: "mariam.coulibaly@exemple.test", type: "Conférence", status: "prospect", quote: "brouillon", master: null,
        guaranteed: 200, actual: null, menu: 15000,
        fns: [{ id: "F1", room: "AKW", date: "2027-01-15", start: "08:00", end: "18:00", config: "theatre", covers: 200, label: "Conférence plénière" }],
        lines: [{ label: "Location Salle Akwaba entière — journée", qty: 1, unit: 900000, kind: "Location" }, { label: "Pause-café et déjeuner buffet", qty: 0, unit: 15000, kind: "F&B", perCover: 1 }],
        deposits: [{ label: "Acompte 40 % à la signature", due: "2026-12-15", pct: 0.4, paid: false }, { label: "Solde à J-3", due: "2027-01-12", pct: 0.6, paid: false }],
        block: null, beo: false, access: [] },
      { id: "E-304", name: "Lancement produit", org: "Cabinet Akwaba Exemple", contact: "jean-marc.ehui@exemple.test", type: "Cocktail", status: "option", due: "2026-11-24", quote: "envoye", master: null,
        guaranteed: 120, actual: null, menu: 15000,
        fns: [{ id: "F1", room: "JAR", date: "2026-12-03", start: "18:30", end: "22:00", config: "cocktail", covers: 120, label: "Cocktail de lancement" }],
        lines: [{ label: "Location Terrasse Jardin — soirée", qty: 1, unit: 450000, kind: "Location" }, { label: "Cocktail 12 pièces", qty: 0, unit: 15000, kind: "F&B", perCover: 1 }],
        deposits: [{ label: "Acompte 50 %", due: "2026-11-24", pct: 0.5, paid: false }], block: null, beo: false, access: [] },
      { id: "E-305", name: "Déjeuner d'affaires", org: "Banque Ivoirienne Exemple", contact: "awa.toure@exemple.test", type: "Banquet", status: "definitif", quote: "signe", signed: "2026-11-10", master: "CM-305",
        guaranteed: 20, actual: 26, menu: 22000,
        fns: [{ id: "F1", room: "LAG", date: "2026-11-26", start: "12:00", end: "15:00", config: "banquet", covers: 24, label: "Déjeuner assis" }],
        lines: [{ label: "Location Salon Lagune — demi-journée", qty: 1, unit: 150000, kind: "Location" }, { label: "Menu affaires 3 plats", qty: 0, unit: 22000, kind: "F&B", perCover: 1 }],
        deposits: [{ label: "Acompte 50 % à la signature", due: "2026-11-12", pct: 0.5, paid: true }, { label: "Solde", due: "2026-11-26", pct: 0.5, paid: false }],
        block: null, beo: true, access: [{ who: "Organisateur — Awa Touré", zone: "Salon Lagune", until: "26/11 16:00" }] },
      { id: "E-306", name: "Formation interne", org: "Transports Lagune Exemple", contact: "serge.konan@exemple.test", type: "Formation", status: "definitif", quote: "signe", signed: "2026-11-05", master: "CM-306",
        guaranteed: 30, actual: null, menu: 16000,
        fns: [{ id: "F1", room: "AKB", date: "2026-11-27", start: "09:00", end: "17:00", config: "classe", covers: 30, label: "Formation" }],
        lines: [{ label: "Location Akwaba B — journée", qty: 1, unit: 500000, kind: "Location" }, { label: "Forfait journée d'étude", qty: 0, unit: 16000, kind: "F&B", perCover: 1 }],
        deposits: [{ label: "Acompte 30 %", due: "2026-11-10", pct: 0.3, paid: true }, { label: "Solde", due: "2026-11-27", pct: 0.7, paid: false }],
        block: null, beo: true, access: [] },
      { id: "E-307", name: "Gala de fin d'année", org: "Ets Kouassi & Fils (exemple)", contact: "arsene.kouassi@exemple.test", type: "Gala", status: "option", due: "2026-12-01", quote: "envoye", master: null,
        guaranteed: 160, actual: null, menu: 35000,
        fns: [{ id: "F1", room: "AKW", date: "2026-12-05", start: "19:00", end: "23:59", config: "banquet", covers: 160, label: "Dîner de gala" }],
        lines: [{ label: "Location Salle Akwaba entière — soirée", qty: 1, unit: 900000, kind: "Location" }, { label: "Dîner de gala 4 plats", qty: 0, unit: 35000, kind: "F&B", perCover: 1 }, { label: "Scène et éclairage", qty: 1, unit: 300000, kind: "Technique" }],
        deposits: [{ label: "Acompte 40 %", due: "2026-12-01", pct: 0.4, paid: false }, { label: "Solde", due: "2026-12-05", pct: 0.6, paid: false }],
        block: { type: "STD", rooms: 3, from: "2026-12-05", to: "2026-12-06", rate: 40000, cutoff: "2026-11-28", picked: 0, created: false, released: false }, beo: false, access: [] },
    ],
    history: { issued: 9, signed: 4 }, // devis des 90 jours précédents (exemple)
    seq: 308, draft: {}, rule: null,
  }
  Object.assign(ui, { evtSel: "E-301" })
  const V = D.evt
  const E = (id) => V.events.find((e) => e.id === id)
  const RM = (id) => V.rooms.find((r) => r.id === id)
  const STS = { prospect: ["Prospect", "outline"], option: ["Option", ""], definitif: ["Définitif", "on"], annule: ["Annulé", "dark"] }
  const QST = { brouillon: "Brouillon", envoye: "Envoyé", signe: "Signé", refuse: "Refusé" }
  const billed = (e) => Math.max(e.guaranteed, e.actual || 0) // RG-EVT-03
  const lineQty = (e, l) => (l.perCover ? l.perCover * billed(e) : l.qty)
  const amount = (e) => e.lines.reduce((s, l) => s + lineQty(e, l) * l.unit, 0)
  const depAmt = (e, d) => (d.paid ? d.amt : Math.round(amount(e) * d.pct)) // montant figé à l'encaissement
  const paid = (e) => e.deposits.filter((d) => d.paid).reduce((s, d) => s + d.amt, 0)
  const firstDate = (e) => e.fns.map((f) => f.date).sort()[0]
  const related = (a, b) => a === b || RM(a).parent === b || RM(b).parent === a // RG-EVT-02 : salle divisible

  V.events.forEach((e) => e.deposits.forEach((d) => { if (d.paid && d.amt == null) d.amt = Math.round(amount(e) * d.pct) }))
  // RG-EVT-01 : les options échues expirent automatiquement (au chargement, date hôtelière)
  V.events.forEach((e) => { if (e.status === "option" && e.due < today) Object.assign(e, { status: "annule", reason: `Option expirée le ${fdy(e.due)} (automatique)` }) })

  // Conflits d'une fonction avec les événements qui bloquent l'espace (option ou définitif)
  function clashes(f, exceptEvt, exceptFn) {
    const out = []
    V.events.filter((e) => ["option", "definitif"].includes(e.status)).forEach((e) => e.fns.forEach((g) => {
      if (e.id === exceptEvt && g.id === exceptFn) return
      if (g.date === f.date && related(g.room, f.room) && mins(g.start) < mins(f.end) && mins(f.start) < mins(g.end))
        out.push(`${RM(g.room).name} est déjà pris(e) par « ${e.name} — ${e.org} » de ${g.start} à ${g.end}${g.room !== f.room ? " (division de salle)" : ""}.`)
    }))
    return out
  }
  const allClashes = () => V.events.filter((e) => e.status !== "annule").flatMap((e) => e.fns.filter((f) => clashes(f, e.id, f.id).length).map((f) => ({ e, f })))

  // ---------- Écran ----------
  const TABS = [["pipeline", "Pipeline et devis"], ["agenda", "Agenda des espaces"], ["fiche", "Fiche événement"], ["salles", "Salles"], ["facturation", "Facturation"], ["pilotage", "KPI et IA"]]
  const views = {
    evt(p) {
      const tab = p[0] || "pipeline"
      return pageHead("Événements et MICE", "Séminaires, banquets, mariages : du devis à la facture. Montants d'exemple ; signature électronique et accès aux salles simulés.", btn("Nouvelle demande", "go('evt/pipeline');setTimeout(()=>document.getElementById('ev-name')?.focus(),50)"))
        + subtabs("evt", TABS, tab) + ({ pipeline, agenda, fiche, salles, facturation, pilotage }[tab] || pipeline)(p.slice(1))
    },
  }

  function pipeline() {
    const cols = ["prospect", "option", "definitif", "annule"]
    return `<div class="grid">${cols.map((s) => { const list = V.events.filter((e) => e.status === s)
        return `<div><h3 style="margin-top:0">${esc(STS[s][0])} · ${list.length} · ${esc(money(list.reduce((t, e) => t + amount(e), 0)))}</h3><div class="list">${list.map((e) => `<button onclick="ui.evtSel=${q(e.id)};go('evt/fiche')">
          <strong>${esc(e.name)} — ${esc(e.org)}</strong><div class="muted">${esc(e.type)} · ${fdy(firstDate(e))} · ${e.guaranteed} pers. · ${esc(money(amount(e)))}</div>
          <div class="muted">Devis : ${esc(QST[e.quote])}${e.status === "option" ? ` · option jusqu'au ${fdy(e.due)}` : ""}${e.reason ? ` · ${esc(e.reason)}` : ""}</div></button>`).join("") || `<p class="muted">—</p>`}</div></div>` }).join("")}</div>
      <p class="muted">EF-EVT-002 : prospect → option (avec date d'échéance) → définitif. Une option échue passe automatiquement en annulé (RG-EVT-01).</p>
      <h2>Nouvelle demande</h2><div class="card">${form([
        field("ev-name", "Intitulé", input("ev-name", "", 'placeholder="Séminaire de direction"')), field("ev-org", "Organisateur", input("ev-org", "", 'placeholder="Société … Exemple"')),
        field("ev-mail", "E-mail du contact", input("ev-mail", "", 'placeholder="prenom.nom@exemple.test"')),
        field("ev-type", "Type", select("ev-type", ["Séminaire", "Conférence", "Banquet", "Mariage", "Cocktail", "Formation", "Gala"], "Séminaire")),
        field("ev-date", "Date", input("ev-date", addDays(today, 21), 'type="date"')), field("ev-pax", "Participants", input("ev-pax", 40, 'type="number" min="1"')),
        field("ev-room", "Salle souhaitée", select("ev-room", V.rooms.map((r) => [r.id, r.name]), "LAG")), field("ev-conf", "Configuration", select("ev-conf", Object.entries(CONF), "classe")),
        `<div class="full" id="ev-err"></div>`, `<div class="full">${btn("Créer le prospect et le devis brouillon", "A.evt.create()")}</div>`])}</div>`
  }

  function agenda() {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i))
    const cx = allClashes()
    return `<p class="muted">Occupation des espaces sur 14 jours (EF-EVT-007). Réserver la salle entière bloque ses sous-salles et inversement (RG-EVT-02). Les prospects ne bloquent pas l'espace.</p>
      ${cx.length ? err(`Conflit détecté : ${cx.map((x) => `${x.e.name} (${RM(x.f.room).name}, ${fd(x.f.date)})`).join(" ; ")}`) : ""}
      <div class="tablewrap"><table><thead><tr><th>Espace</th>${days.map((d) => `<th class="num" style="font-size:11px">${esc(wd(d))}<br>${fd(d)}</th>`).join("")}</tr></thead>
      <tbody>${V.rooms.map((r) => `<tr><td><strong>${esc(r.name)}</strong><div class="muted">${r.m2} m²</div></td>${days.map((d) => {
        const own = [], inherited = []
        V.events.filter((e) => e.status !== "annule").forEach((e) => e.fns.filter((f) => f.date === d).forEach((f) => { if (f.room === r.id) own.push([e, f]); else if (related(f.room, r.id) && e.status !== "prospect") inherited.push([e, f]) }))
        return `<td style="font-size:11px;min-width:84px;vertical-align:top;padding:6px">${own.map(([e, f]) => `<button class="link" onclick="ui.evtSel=${q(e.id)};go('evt/fiche')">${esc(e.org.length > 18 ? e.org.slice(0, 17) + "…" : e.org)}</button><div>${badge(STS[e.status][0], STS[e.status][1])}</div><div class="muted">${f.start}–${f.end}</div>`).join("")}${inherited.length && !own.length ? muted("Indisponible (division)") : ""}</td>` }).join("")}</tr>`).join("")}</tbody></table></div>
      <div class="cols"><section><h2>Vérifier la disponibilité</h2><div class="card">${form([
        field("av-room", "Salle", select("av-room", V.rooms.map((r) => [r.id, r.name]), "AKW")), field("av-date", "Date", input("av-date", "2026-11-27", 'type="date"')),
        field("av-start", "Début", input("av-start", "09:00", 'type="time"')), field("av-end", "Fin", input("av-end", "17:00", 'type="time"')),
        `<div class="full" id="av-out"></div>`, `<div class="full">${btn("Vérifier", "A.evt.check()")}</div>`])}</div></section></div>`
  }

  function fiche() {
    const e = E(ui.evtSel) || V.events[0]
    const left = listItems(V.events.map((x) => ({ id: x.id, title: `${x.name} — ${x.org}`, sub: `${fdy(firstDate(x))} · ${x.guaranteed} pers.`, badge: " " + badge(STS[x.status][0], STS[x.status][1]) })), e.id, "evt/fiche").replace(/go\('evt\/fiche\/([^']+)'\)/g, "ui.evtSel='$1';go('evt/fiche')")
    return split(left, detail(e))
  }

  function detail(e) {
    const total = amount(e), editable = e.status !== "annule"
    const actions = [
      e.status === "prospect" ? btn("Poser une option (7 jours)", `A.evt.option(${q(e.id)})`) : "",
      e.status === "option" ? btn("Confirmer en définitif", `A.evt.confirm(${q(e.id)})`, "accent") : "",
      editable ? btn("Annuler / perdu", `A.evt.cancel(${q(e.id)})`, "ghost") : "",
    ].join("")
    const b = e.block
    return `<div class="card">
      <div class="row between"><span class="big">${esc(e.name)} — ${esc(e.org)}</span>${badge(STS[e.status][0], STS[e.status][1])}</div>
      <div class="muted">${esc(e.id)} · ${esc(e.type)} · ${esc(e.contact)}${e.master ? ` · compte maître ${esc(e.master)}` : ""}${e.status === "option" ? ` · option jusqu'au ${fdy(e.due)}` : ""}${e.reason ? ` · ${esc(e.reason)}` : ""}</div>
      <div class="row" style="margin-top:10px">${actions}</div><div id="ev-msg" style="margin-top:8px"></div>

      <h3>Programme</h3>
      ${tbl(["Date", "Horaire", "Espace", "Configuration", "#Couverts", ""], e.fns.map((f) => { const c = clashes(f, e.id, f.id)
        return [fdy(f.date), `${f.start}–${f.end}`, `${esc(RM(f.room).name)}<div class="muted">${esc(f.label)}</div>`, esc(CONF[f.config]), f.covers, c.length ? badge("Conflit", "dark") : ""] }))}
      ${editable ? `<div class="form" style="margin-top:10px">${field("fn-label", "Nouvelle fonction", input("fn-label", "", 'placeholder="Pause-café, dîner…"'))}${field("fn-room", "Espace", select("fn-room", V.rooms.map((r) => [r.id, r.name]), "LAG"))}
        ${field("fn-date", "Date", input("fn-date", firstDate(e), 'type="date"'))}${field("fn-start", "Début", input("fn-start", "12:30", 'type="time"'))}${field("fn-end", "Fin", input("fn-end", "14:00", 'type="time"'))}
        ${field("fn-conf", "Configuration", select("fn-conf", Object.entries(CONF), "banquet"))}${field("fn-cov", "Couverts", input("fn-cov", e.guaranteed, 'type="number" min="1"'))}
        <div style="align-self:end">${btn("Ajouter", `A.evt.addFn(${q(e.id)})`, "ghost")}</div><div class="full" id="fn-err"></div></div>` : ""}

      <h3>Fiches de fonction (BEO)</h3>
      ${e.beo ? e.fns.map((f) => `<div class="card" style="margin-bottom:8px"><div class="row between"><strong>BEO ${esc(e.id)}-${esc(f.id)} · ${esc(f.label)}</strong>${badge(`Version ${e.beoV || 1} diffusée`, "outline")}</div>
        <div class="muted">${fdy(f.date)} · ${f.start}–${f.end} · ${esc(RM(f.room).name)} en ${esc(CONF[f.config].toLowerCase())} · ${f.covers} couverts</div>
        <p style="margin:6px 0 0"><strong>Installation :</strong> ${esc(CONF[f.config])}, pupitre, signalétique à l'entrée. <strong>Technique :</strong> ${esc(RM(f.room).equip)}.<br>
        <strong>Restauration :</strong> ${f.config === "cocktail" ? "pièces salées et sucrées, bar à jus" : f.config === "banquet" ? `menu à ${money(e.menu)} par couvert, service à l'assiette` : "pauses café 10:30 et 15:30, déjeuner buffet"}. <strong>Personnel :</strong> ${Math.ceil(f.covers / 20)} serveurs, 1 maître d'hôtel${f.config !== "cocktail" ? ", 1 technicien" : ""}.</p></div>`).join("")
        + btn("Republier les BEO aux services", `A.evt.beo(${q(e.id)})`, "ghost sm")
        : `<p class="muted">Générés à la confirmation en définitif (US-EVT-01).</p>`}

      <h3>Couverts (EF-EVT-006)</h3>
      <div class="form">${field("ev-gar", "Minimum garanti", input("ev-gar", e.guaranteed, 'type="number" min="0"'))}${field("ev-act", "Réel constaté", input("ev-act", e.actual ?? "", 'type="number" min="0" placeholder="après service"'))}
        <div style="align-self:end">${btn("Mettre à jour", `A.evt.covers(${q(e.id)})`, "ghost")}</div><div style="align-self:end" class="muted">Couverts facturés : <strong>${billed(e)}</strong> = max(garanti, réel) · RG-EVT-03</div></div>

      <h3>Bloc de chambres (EF-EVT-005)</h3>
      ${b ? `<p style="margin:0">${b.rooms} × ${esc(T(b.type).label)} du ${fd(b.from)} au ${fd(b.to)} à ${money(b.rate)}/nuit · cut-off ${fdy(b.cutoff)} ${b.created ? badge("Bloc créé dans Réservations", "on") : badge("Prévu, créé à la confirmation", "outline")}</p>
        ${b.created ? `<p class="muted" style="margin:4px 0">Pick-up : ${b.picked}/${b.rooms} chambres nominatives${b.released ? " · chambres non prises remises en vente" : ""}.</p>
          ${!b.released && b.picked < b.rooms ? (b.cutoff < today ? btn(`Cut-off dépassé : remettre ${b.rooms - b.picked} chambre(s) en vente`, `A.evt.release(${q(e.id)})`, "sm") : muted("Les chambres non prises seront libérées au cut-off.")) : ""}` : ""}`
        : `<p class="muted">Aucun bloc de chambres.</p>`}

      <h3>Devis et contrat (EF-EVT-003)</h3>
      ${tbl(["Ligne", "Nature", "#Qté", "#P.U.", "#Montant"], e.lines.map((l) => [esc(l.label), esc(l.kind), lineQty(e, l), money(l.unit), money(lineQty(e, l) * l.unit)]), "", `<tfoot><tr><td colspan="4">Total TTC</td><td class="num">${money(total)}</td></tr></tfoot>`)}
      <div class="row" style="margin-top:8px"><span>Devis : <strong>${esc(QST[e.quote])}</strong>${e.signed ? ` le ${fdy(e.signed)}` : ""}</span>
        ${e.quote === "brouillon" && editable ? btn("Envoyer le devis", `A.evt.sendQuote(${q(e.id)})`, "sm") : ""}${e.quote === "envoye" && editable ? btn("Signature électronique reçue (simulée)", `A.evt.sign(${q(e.id)})`, "sm") : ""}</div>
      ${tbl(["Échéance", "Date", "#Montant", ""], e.deposits.map((d, i) => [esc(d.label), fdy(d.due), money(depAmt(e, d)), d.paid ? badge("Encaissé", "on") : e.quote === "signe" ? btn("Encaisser", `A.evt.pay(${q(e.id)}, ${i})`, "ghost sm") : muted(d.due < today ? "En retard" : "À venir")]))}
      ${e.quote !== "signe" && editable ? `<div style="margin-top:12px">${V.draft[e.id] ? aiBox("Proposition commerciale (brouillon IA)", V.draft[e.id], btn("Valider et joindre au devis", `A.evt.validateDraft(${q(e.id)})`, "sm"))
        : aiBox("Rédaction de proposition", "Générer une proposition commerciale personnalisée à partir de la demande (programme, salles, menus, bloc de chambres). Le texte est relu et validé par le commercial avant envoi.", btn("Générer la proposition", `A.evt.draft(${q(e.id)})`, "ghost sm"))}</div>` : ""}

      <h3>Accès temporaires aux salles (EF-EVT-010)</h3>
      ${tbl(["Bénéficiaire", "Espace", "Jusqu'au"], e.access.map((a) => [esc(a.who), esc(a.zone), esc(a.until)]), "Aucun accès accordé.")}
      ${e.status === "definitif" ? `<div class="row" style="margin-top:8px">${btn("Badge organisateur pour la durée de l'événement", `A.evt.access(${q(e.id)})`, "ghost sm")}</div>` : ""}
    </div>`
  }

  function salles() {
    const cfgs = Object.keys(CONF)
    return `<p class="muted">Capacités par configuration, divisibilité et équipements (EF-EVT-001). Tarifs journée d'exemple.</p>
      ${tbl(["Espace", "#m²", ...cfgs.map((c) => "#" + CONF[c]), "Divisible", "Équipements", "#Tarif journée"], V.rooms.map((r) => [`<strong>${esc(r.name)}</strong>`, r.m2, ...cfgs.map((c) => r.caps[c] ?? "—"),
        r.parts ? esc("En " + r.parts.map((x) => RM(x).name).join(" + ")) : r.parent ? esc("Partie de " + RM(r.parent).name) : "Non", esc(r.equip), money(r.day)]))}
      ${aiBox("Tarification des salles", "Vendredi 5/12 : forte demande sur l'Akwaba (2 demandes en option), taux d'occupation des chambres prévu à 86 %. Recommandation : tarif journée Akwaba entière à 1 050 000 FCFA (+17 %), sauf si le client prend un bloc d'au moins 3 chambres — le revenu global (hébergement + F&B) reste alors supérieur au tarif plein.", RM("AKW").day === 1050000 ? badge("Appliqué", "on") : btn("Appliquer 1 050 000 FCFA à l'Akwaba", "A.evt.applyPrice()", "ghost sm"))}
      ${V.rule ? `<h2>Règles tarifaires</h2>${tbl(["Règle", "Statut", ""], [[esc(V.rule.label), badge(V.rule.status === "validée" ? "Validée" : "Brouillon", V.rule.status === "validée" ? "on" : "outline"), V.rule.status === "validée" ? "" : btn("Valider", "A.evt.ruleOk()", "sm")]])}` : ""}`
  }

  function facturation() {
    const list = V.events.filter((e) => e.status === "definitif")
    return `<p class="muted">Facturation de l'événement par nature (location, F&B, technique), acomptes et solde sur le compte maître (EF-EVT-008). Les couverts F&B sont facturés au maximum entre garanti et réel.</p>
      ${tbl(["Événement", "Compte maître", "#Location", "#F&B", "#Technique", "#Total", "#Acomptes", "#Solde", ""], list.map((e) => {
        const by = (k) => e.lines.filter((l) => l.kind === k).reduce((s, l) => s + lineQty(e, l) * l.unit, 0), tot = amount(e), pd = paid(e)
        return [`<button class="link" onclick="ui.evtSel=${q(e.id)};go('evt/fiche')">${esc(e.name)} — ${esc(e.org)}</button><div class="muted">${billed(e)} couverts facturés</div>`, esc(e.master || "—"), money(by("Location")), money(by("F&B")), money(by("Technique")), money(tot), money(pd), `<strong>${money(tot - pd)}</strong>`,
          e.invoice ? badge(`Facture ${e.invoice}`, "outline") : btn("Émettre la facture de solde", `A.evt.invoice(${q(e.id)})`, "sm")] }), "Aucun événement définitif.")}`
  }

  function pilotage() {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i))
    const conf = V.events.filter((e) => ["definitif", "option"].includes(e.status))
    const hoursOf = (r) => conf.flatMap((e) => e.fns).filter((f) => f.room === r.id && days.includes(f.date)).reduce((s, f) => s + (mins(f.end) - mins(f.start)) / 60, 0)
    const base = V.rooms.filter((r) => !r.parent)
    const sold = base.reduce((s, r) => s + hoursOf(r) + (r.parts ? r.parts.reduce((t, x) => t + hoursOf(RM(x)), 0) : 0), 0), avail = base.length * 14 * 14
    const m2 = base.reduce((s, r) => s + r.m2, 0)
    const rev = V.events.filter((e) => e.status === "definitif").reduce((s, e) => s + amount(e), 0)
    const issued = V.history.issued + V.events.filter((e) => ["envoye", "signe", "refuse"].includes(e.quote)).length, signed = V.history.signed + V.events.filter((e) => e.quote === "signe").length
    return `<div class="grid">
        ${kpi("Revenu par m² de salle", money(rev / m2), `événements définitifs · ${m2} m² commercialisables`)}
        ${kpi("Conversion des devis", pct((signed / issued) * 100), `${signed} signés / ${issued} émis (90 jours, exemple)`)}
        ${kpi("Occupation des salles", pct((sold / avail) * 100), "heures vendues / disponibles, 14 jours (14 h/jour)")}
        ${kpi("Pipeline pondéré", money(V.events.filter((e) => e.status === "option").reduce((s, e) => s + amount(e), 0) * 0.6 + V.events.filter((e) => e.status === "prospect").reduce((s, e) => s + amount(e), 0) * 0.2), "options × 60 % + prospects × 20 %")}
      </div>
      <div class="cols"><section><h2>Heures vendues par espace (14 jours)</h2>${bars(V.rooms.map((r) => ({ label: r.name, value: hoursOf(r) })), (v) => Math.round(v) + " h")}</section>
      <section><h2>Valeur du pipeline par statut</h2>${bars(Object.keys(STS).map((s) => ({ label: STS[s][0], value: V.events.filter((e) => e.status === s).reduce((t, e) => t + amount(e), 0) })), money)}</section></div>
      ${aiBox("Tarification des salles", "Les samedis de décembre sont demandés à 3 fois la moyenne : appliquer un minimum de dépense F&B de 4 500 000 FCFA pour l'Akwaba entière ces soirs-là et proposer les jeudis à -15 % aux séminaires.", V.rule ? badge("Règle créée", "on") + " " + muted("Brouillon en attente de validation, visible dans l'onglet Salles") : btn("Créer la règle tarifaire (à valider)", "A.evt.rule()", "ghost sm"))}`
  }

  // ---------- Actions ----------
  const msg = (m, ok) => { const x = $("#ev-msg"); if (x) x.innerHTML = ok ? `<p class="muted">${esc(m)}</p>` : err(m) }
  holdRooms((type, date) => D.evt.events.reduce((n, e) => {
    const b = e.block
    if (!b || !b.created || e.status === "annule" || b.type !== type || !(b.from <= date && date < b.to)) return n
    return n + (b.released ? b.picked : b.rooms)
  }, 0))

  const actions = {
    create() {
      const name = val("ev-name"), org = val("ev-org"), date = val("ev-date"), pax = Number(val("ev-pax")), room = val("ev-room"), config = val("ev-conf")
      const e = (m) => ($("#ev-err").innerHTML = err(m))
      if (!name || !org) return e("Indiquez l'intitulé et l'organisateur.")
      if (!date || date < today) return e("La date doit être à venir.")
      const cap = RM(room).caps[config]
      if (!cap) return e(`${RM(room).name} ne se configure pas en ${CONF[config].toLowerCase()}.`)
      if (pax > cap) return e(`${RM(room).name} en ${CONF[config].toLowerCase()} : ${cap} personnes maximum.`)
      const id = "E-" + V.seq++
      V.events.push({ id, name, org, contact: val("ev-mail") || "—", type: val("ev-type"), status: "prospect", quote: "brouillon", master: null, guaranteed: pax, actual: null, menu: 18000,
        fns: [{ id: "F1", room, date, start: "09:00", end: "17:00", config, covers: pax, label: name }],
        lines: [{ label: `Location ${RM(room).name} — journée`, qty: 1, unit: RM(room).day, kind: "Location" }, { label: "Forfait journée d'étude", qty: 0, unit: 18000, kind: "F&B", perCover: 1 }],
        deposits: [{ label: "Acompte 30 % à la signature", due: addDays(today, 7), pct: 0.3, paid: false }, { label: "Solde", due: date, pct: 0.7, paid: false }], block: null, beo: false, access: [] })
      ui.evtSel = id; toast("Prospect créé avec un devis brouillon"); go("evt/fiche")
    },
    check() {
      const f = { room: val("av-room"), date: val("av-date"), start: val("av-start"), end: val("av-end") }
      const c = clashes(f)
      $("#av-out").innerHTML = c.length ? err(c.join(" ")) : `<p>${badge("Disponible", "on")} ${esc(RM(f.room).name)} le ${esc(fdy(f.date))} de ${esc(f.start)} à ${esc(f.end)}.</p>`
    },
    option(id) { const e = E(id); Object.assign(e, { status: "option", due: addDays(today, 7) }); toast(`Option posée jusqu'au ${fd(e.due)}`); render() },
    confirm(id) {
      const e = E(id)
      if (e.quote !== "signe") return msg("Le devis doit être signé avant de passer en définitif (US-EVT-01).")
      const c = e.fns.flatMap((f) => clashes(f, e.id, f.id))
      if (c.length) return msg("Conflit d'espace : " + c[0])
      const b = e.block
      if (b && !b.created) {
        for (let d = b.from; d < b.to; d = addDays(d, 1)) if (available(b.type, d) < b.rooms) return msg(`Bloc impossible : ${available(b.type, d)} chambre(s) ${T(b.type).label} disponible(s) la nuit du ${fd(d)} pour ${b.rooms} demandées.`)
        b.created = true
      }
      Object.assign(e, { status: "definitif", beo: true, master: e.master || "CM-" + e.id.slice(2) })
      toast(`Définitif : ${b ? "bloc créé dans Réservations, " : ""}BEO générés, compte maître ouvert`); render()
    },
    cancel(id) {
      if (!confirm("Annuler cet événement ? Les espaces et le bloc de chambres seront libérés.")) return
      const e = E(id); Object.assign(e, { status: "annule", reason: "Annulé par le commercial" }); if (e.block) e.block.released = true
      toast("Événement annulé, espaces libérés"); render()
    },
    addFn(id) {
      const e = E(id), f = { id: "F" + (e.fns.length + 1), label: val("fn-label") || "Fonction", room: val("fn-room"), date: val("fn-date"), start: val("fn-start"), end: val("fn-end"), config: val("fn-conf"), covers: Number(val("fn-cov")) }
      const x = (m) => ($("#fn-err").innerHTML = err(m))
      if (!f.date || !f.start || !f.end || f.end <= f.start) return x("Horaires invalides.")
      const cap = RM(f.room).caps[f.config]
      if (!cap) return x(`${RM(f.room).name} ne propose pas la configuration ${CONF[f.config].toLowerCase()}.`)
      if (f.covers > cap) return x(`Capacité dépassée : ${cap} personnes en ${CONF[f.config].toLowerCase()}.`)
      const c = clashes(f, e.id)
      if (c.length) return x("Conflit (EF-EVT-007) : " + c.join(" "))
      e.fns.push(f); toast(e.beo ? "Fonction ajoutée, BEO mis à jour (evt.beo.updated)" : "Fonction ajoutée au programme"); render()
    },
    beo(id) { const e = E(id); e.beoV = (e.beoV || 1) + 1; toast(`BEO version ${e.beoV} diffusés : Restauration, technique, housekeeping notifiés (simulé)`); render() },
    covers(id) {
      const e = E(id), g = Number(val("ev-gar")), a = val("ev-act")
      if (!(g >= 0)) return toast("Minimum garanti invalide")
      e.guaranteed = g; e.actual = a === "" ? null : Number(a)
      toast(`Couverts facturés : ${billed(e)}`); render()
    },
    release(id) { const b = E(id).block; b.released = true; toast(`${b.rooms - b.picked} chambre(s) remise(s) en vente`); render() },
    sendQuote(id) { E(id).quote = "envoye"; toast("Devis envoyé à l'organisateur (e-mail simulé)"); render() },
    sign(id) { Object.assign(E(id), { quote: "signe", signed: today }); toast("Contrat signé électroniquement (simulé)"); render() },
    pay(id, i) { const e = E(id), d = e.deposits[i]; d.amt = Math.round(amount(e) * d.pct); d.paid = true; toast(`${money(d.amt)} encaissés sur le compte maître`); render() },
    draft(id) {
      const e = E(id), f = e.fns[0]
      V.draft[id] = `Madame, Monsieur, pour votre ${e.type.toLowerCase()} du ${fdy(f.date)}, nous vous proposons ${RM(f.room).name} en configuration ${CONF[f.config].toLowerCase()} pour ${e.guaranteed} participants, avec ${e.lines.filter((l) => l.kind === "F&B").map((l) => l.label.toLowerCase()).join(" et ") || "une restauration sur mesure"}. Budget estimé : ${money(amount(e))} TTC. Un bloc de chambres à tarif préférentiel peut être ajouté pour vos invités.`
      render()
    },
    validateDraft(id) { const e = E(id); delete V.draft[id]; if (e.quote === "brouillon") e.quote = "envoye"; toast("Proposition validée et envoyée avec le devis"); render() },
    access(id) { E(id).access.push({ who: "Organisateur — badge temporaire", zone: E(id).fns.map((f) => RM(f.room).name).join(", "), until: `${fd(E(id).fns.map((f) => f.date).sort().pop())} 23:59` }); toast("Badge temporaire encodé (Contrôle d'accès simulé)"); render() },
    invoice(id) { const e = E(id); e.invoice = "FE-" + (2400 + V.seq++); toast(`Facture ${e.invoice} émise : solde ${money(amount(e) - paid(e))}`); render() },
    rule() { V.rule = { label: "Samedis de décembre : minimum F&B 4 500 000 FCFA (Akwaba entière) · jeudis -15 % séminaires", status: "brouillon" }; toast("Règle tarifaire créée en brouillon"); render() },
    ruleOk() { V.rule.status = "validée"; toast("Règle tarifaire validée"); render() },
    applyPrice() { RM("AKW").day = 1050000; toast("Tarif de l'Akwaba mis à jour (validé par le commercial)"); render() },
  }

  HMS.module({
    code: "evt", group: "Services", title: "Événements, banquets et MICE", phase: "11-15", spec: "§15 EVT",
    screens: [{ id: "evt", label: "Événements et MICE", view: views.evt }],
    actions,
  })
})()
