// modules/acces.js — Contrôle d'accès aux chambres et serrures (code « acc »). Spec §10 ACC, dont §10.13 architecture SaaS-matériel.
// Tout le matériel (passerelle edge, encodeurs, serrures, clés mobiles) est simulé.
// Les identifiants des séjours suivent D.reservations (key = "active") : check-in, changement de chambre, prolongation
// et check-out faits dans les autres écrans sont répercutés ici à chaque affichage (synchronisation des droits).
;(() => {
  const USER = "Nadège Assi (réception)"
  const ROLES = ["Réceptionniste", "Duty manager", "Agent de sécurité", "Responsable sécurité"]
  const MAX_KEYS = 4 // clés actives par chambre au-delà desquelles le chef de réception valide (RG-FOF-03)
  const CARD_COST = 1500 // coût d'une carte non restituée (exemple)
  const nowT = () => new Date().toTimeString().slice(0, 5)
  const sum = (a, f = (x) => x) => a.reduce((s, x) => s + f(x), 0)
  const ref = (s) => `<span class="muted">${esc(s)}</span>`
  const gname = (r) => (r && G(r.guest) ? G(r.guest).name : "—")
  const err = (id, m) => { const e = document.getElementById(id); if (e) e.innerHTML = `<div class="err">${esc(m)}</div>`; return false }
  const hash = (s) => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, "0") }

  // ---------- Données d'exemple ----------
  const battery = { "101": 64, "102": 71, "103": 58, "104": 77, "105": 18, "201": 88, "202": 82, "203": 69, "204": 9, "205": 74, "301": 91, "302": 66, "303": 80, "304": 85 }
  const roomLocks = D.rooms.map((r) => ({ id: "L-" + r.no, door: "Ch. " + r.no, room: r.no, zone: "Étage " + r.floor, kind: r.floor === 1 ? "hors ligne" : "en ligne",
    battery: battery[r.no] ?? 75, fw: r.floor === 1 ? "4.1.3" : "4.2.0", last: r.floor === 1 ? "2026-11-25 18:10" : "2026-11-26 08:41", state: "verrouillée", dnd: r.no === "302" }))
  const areaLocks = [
    { id: "L-ASC", door: "Ascenseur (contrôleur)", zone: "Espaces communs", kind: "en ligne", battery: null, fw: "2.0.7", last: "2026-11-26 08:42", state: "contrôle actif" },
    { id: "L-GYM", door: "Salle de sport", zone: "Espaces communs", kind: "en ligne", battery: 47, fw: "4.2.0", last: "2026-11-26 06:02", state: "verrouillée", offline: true },
    { id: "L-PISC", door: "Piscine", zone: "Espaces communs", kind: "en ligne", battery: 72, fw: "4.2.0", last: "2026-11-26 08:40", state: "mode bureau" },
    { id: "L-PARK", door: "Parking (barrière)", zone: "Espaces communs", kind: "en ligne", battery: null, fw: "1.9.2", last: "2026-11-26 08:42", state: "verrouillée" },
    { id: "L-SAL", door: "Salon exécutif", zone: "Espaces communs", kind: "en ligne", battery: 63, fw: "4.2.0", last: "2026-11-26 08:39", state: "verrouillée" },
    { id: "L-TECH", door: "Local technique", zone: "Service", kind: "en ligne", battery: 55, fw: "4.2.0", last: "2026-11-26 08:41", state: "verrouillée" },
    { id: "L-LING", door: "Lingerie étage 2", zone: "Service", kind: "hors ligne", battery: 33, fw: "4.1.3", last: "2026-11-25 17:30", state: "verrouillée" },
  ]
  D.acc = {
    role: "Réceptionniste",
    gateway: { id: "GW-ABJ-01", version: "2.8.1", cloud: true, cert: "2026-12-05", certFp: "3F:A2:…:9C", beat: "il y a 4 s", ha: false, queue: [], adapter: "Adaptateur fabricant générique (simulé)", caps: ["Serrures en ligne", "Clé mobile BLE/NFC", "Ouverture à distance", "Collecte des journaux", "Ascenseur"] },
    encoders: [
      { id: "ENC-1", post: "Réception poste 1", status: "prêt", ms: [2100, 1900, 2300, 2050], ok: 412, fail: 6 },
      { id: "ENC-2", post: "Réception poste 2", status: "prêt", ms: [2400, 2600, 2200], ok: 268, fail: 9 },
      { id: "ENC-3", post: "Back-office", status: "hors service", ms: [3100], ok: 40, fail: 5 },
    ],
    enc: "ENC-1",
    failNext: false,
    locks: [...roomLocks, ...areaLocks],
    creds: [],
    seq: {}, // numéro de séquence par chambre (cartes hors ligne)
    passes: [
      { id: "PS-01", type: "Passe général", holder: "Jean-Marc Tanoh (directeur d'exploitation)", from: "2026-11-01", to: "2026-12-31", status: "active", by: "Arsène Gbané (responsable sécurité)", validatedBy: "Kouamé Ahoua (duty manager)" },
      { id: "PS-02", type: "Passe d'étage 2", holder: "Amenan Koffi (femme de chambre)", from: "2026-11-26", to: "2026-11-26", status: "active", by: "Ahou Diabaté (gouvernante)", validatedBy: "Arsène Gbané (responsable sécurité)", hours: "07:00–15:00" },
      { id: "PS-03", type: "Passe de service", holder: "Hervé Ehui (technicien)", from: "2026-11-20", to: "2026-12-20", status: "active", by: "Arsène Gbané (responsable sécurité)", validatedBy: "Kouamé Ahoua (duty manager)" },
      { id: "PS-04", type: "Passe d'urgence", holder: "Coffre de sécurité (sous scellés)", from: "2026-01-01", to: "2026-12-31", status: "sous scellés", by: "Arsène Gbané (responsable sécurité)", validatedBy: "Jean-Marc Tanoh (directeur d'exploitation)" },
      { id: "PS-05", type: "Passe d'étage 3", holder: "Fatou Diabaté (femme de chambre)", from: "2026-11-27", to: "2026-11-27", status: "à valider", by: "Ahou Diabaté (gouvernante)", hours: "07:00–15:00" },
    ],
    profiles: [
      { role: "Femme de chambre", zones: "Chambres de l'étage affecté, lingerie", hours: "Poste + 15 min", privacy: "Refusé en mode intimité" },
      { role: "Technicien maintenance", zones: "Locaux techniques, chambres sur ordre de travail", hours: "Poste + 30 min", privacy: "Refusé en mode intimité" },
      { role: "Bagagiste", zones: "Bagagerie, parking, ascenseurs", hours: "Poste", privacy: "Pas d'accès chambres" },
      { role: "Agent de sécurité", zones: "Toutes portes communes, chambres sur incident", hours: "24 h/24", privacy: "Passe d'urgence journalisé" },
    ],
    staff: [
      { id: "B-11", name: "Amenan Koffi", role: "Femme de chambre", zone: "Étage 2", shift: "07:00–15:00", status: "actif", last: "2026-11-26" },
      { id: "B-12", name: "Akissi Kouamé", role: "Femme de chambre", zone: "Étage 1", shift: "07:00–15:00", status: "actif", last: "2026-11-26" },
      { id: "B-13", name: "Fatou Diabaté", role: "Femme de chambre", zone: "Étage 3", shift: "15:00–23:00", status: "suspendu (hors poste)", last: "2026-11-25" },
      { id: "B-14", name: "Hervé Ehui", role: "Technicien maintenance", zone: "Technique", shift: "08:00–17:00", status: "actif", last: "2026-11-26" },
      { id: "B-15", name: "Yao Assi", role: "Bagagiste", zone: "Bagagerie", shift: "07:00–15:00", status: "suspendu (30 j sans usage)", last: "2026-10-20" },
      { id: "B-16", name: "Lassina Fofana", role: "Agent de sécurité", zone: "Toutes", shift: "19:00–07:00", status: "suspendu (hors poste)", last: "2026-11-26" },
    ],
    events: [],
    alarms: [
      { id: "AL-41", at: "2026-11-26 03:12", type: "Porte forcée", door: "Local technique", detail: "Ouverture détectée sans identifiant valide", status: "ouverte" },
      { id: "AL-42", at: "2026-11-26 05:40", type: "Batterie faible", door: "Ch. 204", detail: "Batterie 9 %", status: "ouverte" },
      { id: "AL-43", at: "2026-11-26 06:02", type: "Serrure hors ligne", door: "Salle de sport", detail: "Aucun battement depuis 06:02", status: "ouverte" },
      { id: "AL-44", at: "2026-11-26 01:20", type: "Refus répétés", door: "Ch. 205", detail: "4 refus en 2 min (carte expirée)", status: "ouverte" },
      { id: "AL-40", at: "2026-11-25 23:05", type: "Porte restée ouverte", door: "Ch. 302", detail: "Ouverte 3 min", status: "traitée", by: "Lassina Fofana (agent de sécurité)", delay: 4 },
      { id: "AL-39", at: "2026-11-25 14:30", type: "Batterie faible", door: "Ch. 105", detail: "Batterie 18 %", status: "traitée", by: "Hervé Ehui (technicien)", delay: 95 },
    ],
    anomalies: [
      { id: "AN-7", text: "Carte de la chambre 205 présentée 4 fois après la date de fin : client parti hier, carte non restituée.", score: 71, status: "ouverte" },
      { id: "AN-8", text: "Badge Hervé Ehui : entrée ch. 303 à 07:52 sans ordre de travail correspondant.", score: 64, status: "ouverte" },
      { id: "AN-9", text: "Passe général utilisé 9 fois en 20 min à l'étage 3 (habituellement 2).", score: 48, status: "ouverte" },
    ],
    workOrders: [],
    cards: { blank: 340, recycle: 52, lost: 7, billed: 3 },
    emergency: null,
    reads: [],
    idSeq: 3021, // compteur des identifiants émis
  }
  const C = D.acc

  // Journal immuable : chaque événement est chaîné au précédent par une empreinte
  const ev = (door, cred, type, result, detail = "", at = `${today} ${nowT()}`) => {
    const prev = C.events[0]?.hash || "00000000"
    const e = { at, door, cred, type, result, detail, hash: hash(prev + at + door + cred + type + result + detail) }
    C.events.unshift(e)
    if (C.gateway && !C.gateway.cloud) C.gateway.queue.push({ at: at.slice(11), text: `${type} · ${door} · ${result}` })
    return e
  }
  ;[
    ["2026-11-26 00:41", "Ch. 302", "Carte K-3021", "ouverture", "accordée", ""],
    ["2026-11-26 01:18", "Ch. 205", "Carte K-1803", "ouverture", "refusée", "carte expirée"],
    ["2026-11-26 01:19", "Ch. 205", "Carte K-1803", "ouverture", "refusée", "carte expirée"],
    ["2026-11-26 03:12", "Local technique", "—", "alarme", "porte forcée", ""],
    ["2026-11-26 06:58", "Lingerie étage 2", "Badge B-11", "ouverture", "accordée", "début de poste"],
    ["2026-11-26 07:05", "Ch. 205", "Badge B-11", "ouverture", "accordée", "ménage planifié"],
    ["2026-11-26 07:31", "Ch. 302", "Badge B-14", "ouverture", "refusée", "mode intimité (RG-ACC-06)"],
    ["2026-11-26 07:40", "Ch. 102", "Badge B-12", "ouverture", "accordée", ""],
    ["2026-11-26 07:52", "Ch. 303", "Badge B-14", "ouverture", "accordée", ""],
    ["2026-11-26 08:02", "Ch. 203", "Clé mobile M-2044", "ouverture", "accordée", "BLE"],
    ["2026-11-26 08:15", "Piscine", "Carte K-2021", "ouverture", "accordée", "espace commun"],
    ["2026-11-26 08:20", "Salon exécutif", "Carte K-2021", "ouverture", "refusée", "catégorie non éligible"],
  ].forEach(([at, ...x]) => ev(...x, at))

  // ---------- Synchronisation avec les séjours (fof.stay.* → acc) ----------
  const lockOf = (no) => C.locks.find((l) => l.room === no)
  const areasFor = (r) => ["Ascenseur", "Piscine", "Salle de sport", "Parking", ...(r.type === "SUI" || (G(r.guest) || {}).vip ? ["Salon exécutif"] : [])]
  const validTo = (r) => `${r.to} 13:00` // départ prévu 12 h + 1 h de grâce (RG-FOF-02)
  const nextSeq = (no) => (C.seq[no] = (C.seq[no] || 0) + 1)
  const mkCred = (r, type, extra = {}) => {
    const c = { id: (type === "mobile" ? "M-" : "K-") + C.idSeq++, resId: r.id, room: r.room, type, seq: type === "carte" ? nextSeq(r.room) : null, from: r.from, to: validTo(r), status: "active", areas: areasFor(r), version: 1, ...extra }
    C.creds.unshift(c)
    return c
  }
  const seedCreds = [["R-2044", ["carte", "carte"]], ["R-2046", ["carte"]], ["R-2047", ["carte", "mobile"]], ["R-2048", ["mobile", "carte"]]]
  seedCreds.forEach(([id, types]) => { const r = R(id); if (r && r.status === "arrivee") types.forEach((t) => mkCred(r, t, { encoder: t === "carte" ? "ENC-1" : "SDK mobile" })) })
  const sync = () => {
    D.reservations.forEach((r) => {
      const mine = C.creds.filter((c) => c.resId === r.id && ["active", "en cours"].includes(c.status))
      if (r.status === "arrivee" && r.key === "active" && !C.creds.some((c) => c.resId === r.id && c.status !== "échec")) {
        const c = mkCred(r, "carte", { encoder: C.enc })
        ev("Ch. " + r.room, "Carte " + c.id, "encodage", "accusé matériel", "check-in (fof.stay.checked-in)")
      }
      if (r.status !== "arrivee") mine.forEach((c) => { c.status = "révoquée"; c.reason = "check-out"; ev("Ch. " + c.room, label(c), "révocation", lockOf(c.room)?.kind === "en ligne" || c.type === "mobile" ? "immédiate" : "à l'expiration encodée", "fof.stay.checked-out") })
      else mine.forEach((c) => {
        if (c.room !== r.room) {
          const old = c.room
          ev("Ch. " + old, label(c), "transfert", "ancienne chambre révoquée", `fof.stay.room-moved → ch. ${r.room}`)
          Object.assign(c, { room: r.room, version: c.version + 1, areas: areasFor(r) })
          if (c.type === "carte") c.status = "à réencoder"
        }
        if (c.to !== validTo(r)) {
          const online = lockOf(r.room)?.kind === "en ligne" || c.type === "mobile"
          ev("Ch. " + r.room, label(c), "prolongation", online ? "mise à jour à distance" : "réencodage requis", `fof.stay.extended → ${fd(r.to)}`)
          Object.assign(c, { to: validTo(r), version: c.version + 1 })
          if (!online) c.status = "à réencoder"
        }
      })
    })
  }
  const label = (c) => (c.type === "mobile" ? "Clé mobile " : "Carte ") + c.id
  const credBadge = (s) => badge(s, s === "active" ? "on" : ["perdue", "échec", "à réencoder"].includes(s) ? "dark" : ["en cours"].includes(s) ? "outline" : "")
  let encodingMsg = null // état transitoire (non sauvegardé)
  const pending = () => C.alarms.filter((a) => a.status === "ouverte")
  const lowBat = () => C.locks.filter((l) => l.battery != null && l.battery < 20)
  const offline = () => C.locks.filter((l) => l.offline)
  const occupied = (l) => l.room && occupant(l.room)
  const cloudBanner = () => (C.gateway.cloud ? "" : `<div class="err" style="margin-bottom:14px">Mode dégradé : la passerelle ${esc(C.gateway.id)} n'a plus de connexion au cloud. Encodage et commandes locales continuent ; ${C.gateway.queue.length} événement(s) en file locale, rejoués à la reconnexion (EF-ACC-023).</div>`)
  const roleBar = () => `<div class="row" style="margin-bottom:12px"><label for="acc-role" style="margin:0">Rôle simulé</label><select id="acc-role" style="max-width:220px" onchange="D.acc.role=this.value;render()">${ROLES.map((r) => `<option ${C.role === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></div>`

  // ---------- Écrans ----------
  const views = {
    cles(p) {
      sync()
      const tab = p[0] || "sejours"
      return pageHead("Clés et identifiants", "Cartes et clés mobiles des séjours, passes et badges du personnel, lecture de carte, stock. Encodeurs et serrures simulés.")
        + cloudBanner()
        + subtabs("acc-cles", [["sejours", "Clés des séjours"], ["passes", "Passes et personnel"], ["lecture", "Lecture et stock de cartes"]], tab)
        + ({ sejours: stayKeys, passes: passesTab, lecture: readTab }[tab] || stayKeys)()
    },
    materiel(p) {
      sync()
      const tab = p[0] || "passerelle"
      return pageHead("Serrures et passerelle", "Supervision de la passerelle edge, des encodeurs et du parc de serrures ; commandes à distance (matériel simulé).")
        + cloudBanner()
        + subtabs("acc-materiel", [["passerelle", "Passerelle et encodeurs"], ["serrures", "Parc de serrures"], ["architecture", "Architecture SaaS-matériel"]], tab)
        + ({ passerelle: gatewayTab, serrures: locksTab, architecture: archTab }[tab] || gatewayTab)()
    },
    securite(p) {
      sync()
      const tab = p[0] || "alarmes"
      return pageHead("Sécurité des accès", "Alarmes en temps réel, journal immuable des accès, actions d'urgence, détection d'anomalies et indicateurs (exemple).")
        + cloudBanner()
        + subtabs("acc-securite", [["alarmes", `Alarmes (${pending().length})`], ["journal", "Journal des accès"], ["urgence", "Lockdown et urgence"], ["ia", "IA sécurité"], ["kpi", "Indicateurs"]], tab)
        + ({ alarmes: alarmsTab, journal: journalTab, urgence: emergencyTab, ia: iaTab, kpi: kpiTab }[tab] || alarmsTab)()
    },
  }

  // ---------- Clés des séjours ----------
  function stayKeys() {
    const stays = inHouse().sort((a, b) => a.room.localeCompare(b.room))
    const r = stays.find((x) => x.id === ui.accStay) || stays[0]
    if (!r) return `<p class="muted">Aucun client en séjour.</p>`
    const creds = C.creds.filter((c) => c.resId === r.id)
    const active = creds.filter((c) => c.status === "active").length
    const lock = lockOf(r.room)
    const encs = C.encoders
    return split(listItems(stays.map((x) => { const n = C.creds.filter((c) => c.resId === x.id && c.status === "active").length; return { id: x.id, title: `Ch. ${x.room} · ${gname(x)}`, sub: `${n} clé(s) active(s) · départ ${fd(x.to)}`, badge: C.creds.some((c) => c.resId === x.id && c.status === "à réencoder") ? " " + badge("À réencoder", "dark") : "" } }), r.id, "acc-cles/sejours").replace(/go\('acc-cles\/sejours\/([^']+)'\)/g, "ui.accStay='$1';render()"),
      `<div class="card"><div class="row between"><span class="big">Ch. ${esc(r.room)} — ${esc(gname(r))}</span>${badge(`Serrure ${lock?.kind || "—"}`, "outline")}</div>
        <div class="muted">${esc(r.id)} · validité jusqu'au ${fd(r.to)} 13:00 (départ + 1 h de grâce, RG-ACC-01) · espaces : ${esc(areasFor(r).join(", "))}</div>
        <h3>Identifiants</h3>
        ${tbl(["Identifiant", "Type", "N° séq.", "Validité", "Version", "Statut", ""], creds.map((c) => [esc(c.id), esc(c.type), c.seq ?? "—", `${fd(c.from)} → ${esc(c.to.slice(8, 10) + "/" + c.to.slice(5, 7) + " " + c.to.slice(11))}`, "v" + c.version, credBadge(c.status) + (c.reason ? ` ${ref(c.reason)}` : ""),
          c.status === "active" ? `<span class="row" style="flex-wrap:nowrap">${btn("Perdue", `A.acc.lost(${q(c.id)})`, "ghost sm")}${btn("Révoquer", `A.acc.revoke(${q(c.id)})`, "ghost sm")}</span>`
          : c.status === "à réencoder" || c.status === "échec" ? btn("Réencoder", `A.acc.reencode(${q(c.id)})`, "sm") : ""]), "Aucun identifiant.")}
        <h3>Émettre</h3>
        <div class="form">
          ${field("acc-enc", "Encodeur", select("acc-enc", encs.map((e) => [e.id, `${e.id} · ${e.post} · ${e.status}`]), C.enc, `onchange="D.acc.enc=this.value"`))}
          ${field("acc-n", "Nombre de cartes", select("acc-n", ["1", "2"], "1"))}
          <div style="align-self:end"><label class="row" style="color:var(--ink)"><input type="checkbox" id="acc-fail" ${C.failNext ? "checked" : ""} onchange="D.acc.failNext=this.checked"> Simuler un échec d'encodage</label></div>
        </div>
        <div id="acc-err"></div>
        ${encodingMsg ? `<div style="margin-top:10px">${esc(encodingMsg)}</div><div class="bar"><i></i></div>` : `<div class="row" style="margin-top:12px">
          ${btn("Dupliquer (garde les clés existantes)", `A.acc.issue(${q(r.id)}, 'duplicate')`)}
          ${btn("Nouvelle clé (annule les précédentes)", `A.acc.issue(${q(r.id)}, 'new')`, "ghost")}
          ${btn("Envoyer une clé mobile", `A.acc.mobile(${q(r.id)})`, "ghost")}</div>`}
        <p class="muted">${active} clé(s) active(s) sur ${MAX_KEYS} autorisées sans validation (RG-FOF-03). Aucun succès affiché sans accusé du matériel ; 3 tentatives puis échec signalé (RG-ACC-10). EF-ACC-001 à 010.</p>
      </div>`)
  }

  // ---------- Passes et personnel ----------
  function passesTab() {
    return `${roleBar()}<div class="cols"><section><h2>Passes (master keys)</h2>
      ${tbl(["Réf.", "Type", "Titulaire", "Validité", "Demandé par", "Statut", ""], C.passes.map((x) => [esc(x.id), esc(x.type), esc(x.holder), `${fd(x.from)} → ${fd(x.to)}${x.hours ? " · " + esc(x.hours) : ""}`, esc(x.by) + (x.validatedBy ? `<div class="muted">validé : ${esc(x.validatedBy)}</div>` : ""),
        badge(x.status, x.status === "active" ? "on" : x.status === "à valider" ? "dark" : "outline"),
        x.status === "à valider" ? btn("Valider (2e personne)", `A.acc.validatePass(${q(x.id)})`, "sm") : x.status === "active" ? btn("Révoquer", `A.acc.revokePass(${q(x.id)})`, "ghost sm") : x.status === "sous scellés" ? btn("Briser les scellés", `A.acc.breakSeal(${q(x.id)})`, "ghost sm") : ""]))}
      ${card("Demander un passe", form([field("ps-type", "Type", select("ps-type", ["Passe d'étage 1", "Passe d'étage 2", "Passe d'étage 3", "Passe de service", "Passe général"], "Passe d'étage 1")),
        field("ps-holder", "Titulaire", select("ps-holder", C.staff.map((s) => [`${s.name} (${s.role.toLowerCase()})`, `${s.name} · ${s.role}`]), "")),
        field("ps-days", "Durée (jours)", input("ps-days", "1", 'type="number" min="1" max="90"')), `<div class="full" id="ps-err"></div>`,
        `<div class="full">${btn("Soumettre à validation", "A.acc.requestPass()", "ghost")}</div>`]) + `<p class="muted">Attribution nominative, durée limitée et double validation (EF-ACC-014). Un passe général exige le rôle Responsable sécurité.</p>`, 'style="margin-top:14px"')}</section>
      <section><h2>Badges du personnel</h2>
      ${tbl(["Badge", "Employé", "Profil", "Poste", "Dernier usage", "Statut", ""], C.staff.map((s) => [esc(s.id), esc(s.name), esc(`${s.role} · ${s.zone}`), esc(s.shift), fd(s.last), badge(s.status, s.status === "actif" ? "on" : /30 j/.test(s.status) ? "dark" : ""),
        s.status === "actif" ? btn("Fin de poste", `A.acc.shift(${q(s.id)}, false)`, "ghost sm") : btn(/30 j/.test(s.status) ? "Réactiver (validation)" : "Début de poste", `A.acc.shift(${q(s.id)}, true)`, "ghost sm")]))}
      <p class="muted">Activation au pointage et suspension en fin de poste (hrm.shift.started / ended, simulés). Badge inutilisé 30 jours suspendu automatiquement (RG-ACC-08).</p>
      <h3>Profils d'accès</h3>${tbl(["Poste", "Zones", "Plages", "Mode intimité"], C.profiles.map((x) => [esc(x.role), esc(x.zones), esc(x.hours), esc(x.privacy)]))}</section></div>`
  }

  // ---------- Lecture de carte et stock ----------
  function readTab() {
    const cards = C.creds.filter((c) => c.type === "carte")
    const last = C.reads[0]
    const inUse = cards.filter((c) => c.status === "active").length
    return `<div class="cols"><section>${card("Lire une carte posée sur l'encodeur", `${form([field("rd-card", "Carte présentée (simulation)", select("rd-card", [["", "Carte vierge"], ...cards.map((c) => [c.id, `${c.id} · ch. ${c.room} · ${c.status}`])], "")),
        field("rd-enc", "Encodeur", select("rd-enc", C.encoders.map((e) => [e.id, `${e.id} · ${e.post}`]), C.enc)), `<div class="full">${btn("Lire la carte", "A.acc.read()")}</div>`])}
      ${last ? `<div class="card" style="margin-top:12px">${last}</div>` : ""}<p class="muted">EF-ACC-022 : chambre, validité et titulaire lus sur la carte.</p>`)}</section>
      <section><h2>Stock de cartes</h2><div class="grid">${kpi("Cartes vierges", C.cards.blank, "en stock")}${kpi("En circulation", inUse, "cartes actives")}${kpi("À recycler", C.cards.recycle, "retournées au check-out")}${kpi("Non restituées", C.cards.lost, `coût ${money(C.cards.lost * CARD_COST)}`)}</div>
        <div class="row" style="margin-top:12px">${btn("Recycler les cartes retournées", "A.acc.recycle()", "ghost")}${btn("Facturer une carte non restituée", "A.acc.billCard()", "ghost")}</div>
        <p class="muted">${C.cards.billed} carte(s) non restituée(s) facturée(s) ce mois (EF-ACC-026). Seuil de réapprovisionnement : 100 cartes.</p></section></div>`
  }

  // ---------- Passerelle et encodeurs ----------
  function gatewayTab() {
    const g = C.gateway, certDays = nights(today, g.cert)
    return `<div class="cols"><section>${card(`Passerelle edge ${g.id}`, `<div class="row between"><strong>${g.cloud ? "Connectée au cloud" : "Autonome (hors ligne)"}</strong>${badge(g.cloud ? "En ligne" : "Mode dégradé", g.cloud ? "on" : "dark")}</div>
        ${tbl(["Élément", "Valeur"], [["Version de l'agent", esc(g.version)], ["Dernier battement", esc(g.cloud ? g.beat : "— (liaison coupée)")], ["Liaison", "Sortante uniquement, TLS 1.3 + mTLS"],
          ["Certificat", `${esc(g.certFp)} · expire le ${fd(g.cert)} (J-${certDays})${certDays <= 10 ? " " + badge("Renouvellement auto", "outline") : ""}`], ["Haute disponibilité", g.ha ? "Passerelle secondaire active" : "Non (passerelle unique)"],
          ["Adaptateur", esc(g.adapter)], ["Capacités", esc(g.caps.join(", "))], ["File locale", `${g.queue.length} événement(s)`]])}
        <div class="row" style="margin-top:12px">${g.cloud ? btn("Simuler une coupure Internet", "A.acc.cloud(false)", "ghost") : btn("Rétablir la connexion et resynchroniser", "A.acc.cloud(true)", "accent")}${btn("Renouveler le certificat", "A.acc.renewCert()", "ghost")}</div>`)}</section>
      <section><h2>Encodeurs</h2>${tbl(["Encodeur", "Poste", "#Temps moyen", "#Réussis", "#Échecs", "Statut", ""], C.encoders.map((e) => [esc(e.id), esc(e.post), (sum(e.ms) / e.ms.length / 1000).toFixed(1) + " s", e.ok, e.fail, badge(e.status, e.status === "prêt" ? "on" : "dark"),
        btn(e.status === "prêt" ? "Simuler une panne" : "Remettre en service", `A.acc.toggleEnc(${q(e.id)})`, "ghost sm")]))}
        <p class="muted">En cas de panne, un autre encodeur prêt du même établissement est proposé automatiquement.</p>
        ${g.queue.length ? `<h3>File locale (en attente de resynchronisation)</h3>${tbl(["Horodatage", "Événement"], g.queue.map((x) => [esc(x.at), esc(x.text)]))}` : ""}</section></div>`
  }

  // ---------- Parc de serrures ----------
  function locksTab() {
    const f = ui.accLockF || "toutes"
    ui.accLockF = f
    const list = C.locks.filter((l) => f === "toutes" || (f === "alerte" ? l.offline || (l.battery != null && l.battery < 20) : f === "ligne" ? l.kind === "en ligne" : l.kind === "hors ligne"))
    return `${roleBar()}${chips("accLockF", { toutes: "Toutes", alerte: "En alerte", ligne: "En ligne", horsligne: "Hors ligne (autonomes)" }, { toutes: C.locks.length, alerte: lowBat().length + offline().length })}
      ${tbl(["Porte", "Zone", "Type", "État", "#Batterie", "Firmware", "Dernier contact", ""], list.map((l) => [esc(l.door) + (l.dnd ? " " + badge("Ne pas déranger", "outline") : "") + (occupied(l) ? ` ${ref("occupée")}` : ""), esc(l.zone), esc(l.kind),
        l.offline ? badge("Injoignable", "dark") : esc(l.state), l.battery == null ? "secteur" : l.battery < 20 ? `<strong>${l.battery} %</strong>` : l.battery + " %", esc(l.fw) + (l.fw < "4.2.0" && l.kind !== "en ligne" ? ` ${ref("maj dispo")}` : ""), esc(l.last.slice(11) ? fd(l.last.slice(0, 10)) + " " + l.last.slice(11) : l.last),
        l.kind === "en ligne" ? `<span class="row" style="flex-wrap:nowrap">${btn("Ouvrir", `A.acc.command(${q(l.id)}, 'open')`, "ghost sm")}${l.room ? "" : btn(l.state === "mode bureau" ? "Fin mode bureau" : "Mode bureau", `A.acc.command(${q(l.id)}, 'office')`, "ghost sm")}${btn("État", `A.acc.command(${q(l.id)}, 'status')`, "ghost sm")}</span>`
        : btn("Collecter le journal", `A.acc.collect(${q(l.id)})`, "ghost sm")]))}
      <div id="cmd-err"></div>
      <p class="muted">Ouvrir à distance une chambre occupée exige un motif et le rôle Agent / Responsable sécurité ou Duty manager (RG-ACC-04). Les serrures hors ligne remontent leur journal via lecteur de collecte (EF-ACC-020). « Ne pas déranger » transmis au housekeeping (EF-ACC-018).</p>`
  }

  // ---------- Architecture §10.13 ----------
  function archTab() {
    const layer = (t, where, items) => `<div class="card"><div class="row between"><strong>${esc(t)}</strong>${badge(where, "outline")}</div><p class="muted" style="margin:6px 0 0">${esc(items)}</p></div>`
    return `<p class="muted">Trois couches : le cœur cloud décide, la passerelle sur site exécute et tient en autonomie, les adaptateurs traduisent vers chaque fabricant.</p>
      <div class="grid">${layer("Module ACC (cœur)", "Cloud", "Règles, cycle de vie des identifiants, calcul des droits, API, audit, IA, supervision.")}
        ${layer("Gateway Connector", "Cloud", "Termine le mTLS des passerelles, file de commandes par établissement, réception des événements.")}
        ${layer("Agent passerelle edge", "Sur site", `Connexion sortante uniquement ; cache des séjours et droits ; journal local chiffré ; 72 h d'autonomie. État actuel : ${C.gateway.cloud ? "connecté" : "autonome"}.`)}
        ${layer("Adaptateurs fabricants", "Passerelle", "Implémentent un contrat unique : ajouter un fabricant ne touche pas au cœur (EF-ACC-024).")}
        ${layer("Encodeurs", "Postes de réception", `${C.encoders.filter((e) => e.status === "prêt").length} prêt(s) sur ${C.encoders.length}.`)}
        ${layer("Serrures et contrôleurs", "Bâtiment", `${C.locks.filter((l) => l.kind === "en ligne").length} en ligne, ${C.locks.filter((l) => l.kind !== "en ligne").length} autonomes.`)}</div>
      <div class="cols"><section><h2>Contrat d'adaptateur</h2>${tbl(["Opération", "Rôle"], [["capabilities()", "Fonctions supportées"], ["encodeCard()", "Encoder chambres, zones, validité, mode nouvelle / duplicata"], ["readCard()", "Lire une carte"], ["issueMobileKey()", "Émettre une clé mobile"], ["updateCredential()", "Modifier validité ou droits"], ["revokeCredential()", "Révoquer"], ["sendCommand()", "Ouvrir, verrouiller, mode bureau, lockdown, levée"], ["getLockStatus()", "État, batterie, firmware"], ["subscribeEvents()", "Flux d'événements normalisés"], ["fetchAuditTrail()", "Récupérer un journal"], ["healthCheck()", "État de la connexion fabricant"]].map(([a, b]) => [`<code>${esc(a)}</code>`, esc(b)]))}
        <h3>Codes d'erreur normalisés</h3><div class="tags">${["ENCODER_NOT_READY", "CARD_NOT_PRESENT", "CARD_WRITE_FAILED", "LOCK_UNREACHABLE", "VENDOR_AUTH_FAILED", "VENDOR_TIMEOUT", "UNSUPPORTED_OPERATION"].map((x) => badge(x, "outline")).join("")}</div></section>
      <section><h2>Cycle de vie d'un identifiant</h2>${tbl(["De", "Événement", "Vers"], [["—", "Demande d'émission", "EN COURS"], ["EN COURS", "Accusé matériel", "ACTIVE"], ["EN COURS", "Échec après 3 tentatives", "ÉCHEC"], ["ACTIVE", "Prolongation / changement de chambre", "ACTIVE (version + 1)"], ["ACTIVE", "Fin de poste (personnel)", "SUSPENDUE"], ["SUSPENDUE", "Début de poste", "ACTIVE"], ["ACTIVE", "Déclaration de perte", "PERDUE"], ["ACTIVE", "Check-out, départ employé", "RÉVOQUÉE"], ["ACTIVE", "Date de fin atteinte", "EXPIRÉE"]].map((r) => r.map(esc)))}
        <h3>Défaillances</h3>${tbl(["Défaillance", "Comportement"], [["Perte du cloud", "Mode hors ligne, bandeau, file locale"], ["Panne de passerelle", "Bascule HA si présente, alerte critique"], ["Panne d'encodeur", "Autre encodeur proposé"], ["Erreur fabricant", "Back-off, disjoncteur, alerte"], ["Batterie vide", "Ordre de travail, clé mécanique sous scellés"], ["Incendie", "Ouverture d'urgence déclenchée par l'alarme"]].map((r) => r.map(esc)))}
        <p class="muted">Sécurité : enrôlement par code à usage unique, clés dans le TPM, commandes signées avec anti-rejeu, certificats de 30 jours, aucune clé de serrure en clair dans le cloud (RG-ACC-09).</p></section></div>`
  }

  // ---------- Alarmes ----------
  function alarmsTab() {
    const list = C.alarms.slice().sort((a, b) => (a.status === "ouverte" ? 0 : 1) - (b.status === "ouverte" ? 0 : 1) || b.at.localeCompare(a.at))
    return `${tbl(["Horodatage", "Type", "Porte", "Détail", "Statut", ""], list.map((a) => [esc(a.at.slice(11) ? fd(a.at.slice(0, 10)) + " " + a.at.slice(11) : a.at), esc(a.type), esc(a.door), esc(a.detail),
        badge(a.status, a.status === "ouverte" ? "dark" : "") + (a.by ? ` ${ref(`${a.by} · ${a.delay} min`)}` : ""),
        a.status === "ouverte" ? `<span class="row" style="flex-wrap:nowrap">${btn("Acquitter", `A.acc.ack(${q(a.id)})`, "sm")}${/Batterie|hors ligne/i.test(a.type) ? btn("Ordre de travail", `A.acc.workOrder(${q(a.door)}, ${q(a.type)})`, "ghost sm") : ""}</span>` : ""]))}
      <p class="muted">Flux temps réel (WebSocket simulé) : porte forcée ou restée ouverte, refus répétés, batterie faible, serrure hors ligne, sabotage (EF-ACC-017). ${btn("Simuler une alarme", "A.acc.simAlarm()", "ghost sm")}</p>
      ${C.workOrders.length ? `<h3>Ordres de travail créés (maintenance)</h3>${tbl(["Réf.", "Porte", "Motif", "Créé"], C.workOrders.map((w) => [esc(w.id), esc(w.door), esc(w.reason), esc(w.at)]))}` : ""}`
  }

  // ---------- Journal ----------
  function journalTab() {
    const doors = [...new Set(C.events.map((e) => e.door))].sort()
    const f = ui.accDoor || ""
    const list = C.events.filter((e) => !f || e.door === f)
    const qr = ui.accQuery
    return `<div class="stack"><section><div class="row"><label for="acc-door" style="margin:0">Porte</label><select id="acc-door" style="max-width:220px" onchange="ui.accDoor=this.value;render()"><option value="">Toutes</option>${doors.map((d) => `<option ${d === f ? "selected" : ""}>${esc(d)}</option>`).join("")}</select></div>
      <div style="margin-top:10px">${tbl(["Horodatage", "Porte", "Identifiant", "Événement", "Résultat", "Détail", "Empreinte"], list.map((e) => [esc(e.at.slice(11)) + ` ${ref(fd(e.at.slice(0, 10)))}`, esc(e.door), esc(e.cred), esc(e.type), e.result === "refusée" ? badge("refusée", "dark") : esc(e.result), ref(e.detail), `<code>${esc(e.hash)}</code>`]))}</div>
      <p class="muted">Journal en ajout seul, chaque ligne chaînée à la précédente : toute modification casserait la chaîne (EF-ACC-019). ${btn("Vérifier l'intégrité", "A.acc.verifyChain()", "ghost sm")}</p></section>
      <section>${card("Interroger une serrure", `<p class="muted" style="margin-top:0">Qui est entré dans une chambre sur une plage horaire ? Droit spécifique et justification obligatoires ; la consultation est elle-même journalisée (EF-ACC-021).</p>
        ${roleBar()}${form([field("qy-door", "Porte", select("qy-door", doors, doors.find((d) => d.startsWith("Ch.")) || doors[0])), field("qy-from", "De", input("qy-from", "00:00", 'type="time"')), field("qy-to", "À", input("qy-to", "23:59", 'type="time"')),
          field("qy-why", "Justification", input("qy-why", "", 'placeholder="Ex. réclamation client, objet disparu"'), "full"), `<div class="full" id="qy-err"></div>`, `<div class="full">${btn("Interroger", "A.acc.query()")}</div>`])}
        ${qr ? `<h3>Résultat — ${esc(qr.door)} de ${esc(qr.from)} à ${esc(qr.to)}</h3>${tbl(["Heure", "Identifiant", "Titulaire", "Résultat"], qr.rows.map((e) => [esc(e.at.slice(11)), esc(e.cred), esc(holderOf(e.cred)), esc(e.result)]), "Aucune entrée sur la plage.")}` : ""}`)}</section></div>`
  }
  const holderOf = (cred) => {
    const id = cred.split(" ").pop()
    const c = C.creds.find((x) => x.id === id)
    if (c) return gname(R(c.resId))
    const s = C.staff.find((x) => x.id === id)
    return s ? `${s.name} (${s.role.toLowerCase()})` : "—"
  }

  // ---------- Urgence ----------
  function emergencyTab() {
    const e = C.emergency
    return `${roleBar()}<div class="cols"><section>${card(e ? `${e.kind} en cours — ${e.zone}` : "Déclencher une action d'urgence", e ? `<p>Déclenché à ${esc(e.at)} par ${esc(e.by)}, validé par ${esc(e.second)}. Motif : ${esc(e.reason)}.</p>
        ${tbl(["Serrure", "Accusé", "Délai"], e.results.map((x) => [esc(x.door), x.ok ? badge("Confirmé", "on") : badge("Non confirmé", "dark"), x.ok ? (x.ms / 1000).toFixed(1) + " s" : ref(x.why)]))}
        <p class="muted">${e.results.filter((x) => !x.ok).length} serrure(s) non confirmée(s) : intervention physique requise.</p>
        <div class="form">${field("em-second2", "Second valideur pour la levée", select("em-second2", ["", "Arsène Gbané (responsable sécurité)", "Kouamé Ahoua (duty manager)", "Jean-Marc Tanoh (directeur d'exploitation)"], ""))}<div style="align-self:end">${btn("Lever l'action d'urgence", "A.acc.release()", "accent")}</div></div><div id="em-err"></div>`
      : form([field("em-kind", "Action", select("em-kind", ["Lockdown", "Ouverture d'urgence (évacuation)"], "Lockdown")),
          field("em-zone", "Zone", select("em-zone", ["Étage 1", "Étage 2", "Étage 3", "Espaces communs", "Établissement"], "Étage 2")),
          field("em-reason", "Motif", input("em-reason", "", 'placeholder="Ex. intrusion signalée aile étage 2"')),
          field("em-second", "Second valideur (quatre yeux)", select("em-second", ["", "Arsène Gbané (responsable sécurité)", "Kouamé Ahoua (duty manager)", "Jean-Marc Tanoh (directeur d'exploitation)"], "")),
          `<div class="full" id="em-err"></div>`, `<div class="full">${btn("Déclencher", "A.acc.emergency()")}</div>`]))}</section>
      <section><h2>Règles</h2><p class="muted">Lockdown et ouverture d'urgence : deux utilisateurs habilités (RG-ACC-05), sauf déclenchement par l'alarme incendie. Rôle exigé : Agent ou Responsable sécurité, ou Duty manager. Accusé de chaque serrure attendu en moins de 5 s ; les serrures autonomes ne reçoivent pas l'ordre et sont listées comme non confirmées (US-ACC-04).</p>
        ${btn("Simuler l'alarme incendie (ouverture automatique)", "A.acc.fire()", "ghost")}</section></div>`
  }

  // ---------- IA ----------
  function iaTab() {
    const pred = C.locks.filter((l) => l.battery != null).map((l) => ({ l, days: Math.round(l.battery * (l.kind === "en ligne" ? 1.6 : 2.4)) })).sort((a, b) => a.days - b.days).slice(0, 5)
    const staffEntries = C.events.filter((e) => /Badge/.test(e.cred) && e.door.startsWith("Ch.") && e.result === "accordée")
        return `<div class="cols"><section><h2>Anomalies d'accès</h2>
      ${C.anomalies.map((a) => aiBox(`Anomalie ${a.id} · score ${a.score}/100${a.status !== "ouverte" ? " · " + a.status : ""}`, a.text + " Alerte au responsable sécurité ; aucune action automatique.", a.status === "ouverte" ? btn("Escalader", `A.acc.anomaly(${q(a.id)}, 'escaladée')`, "sm") + btn("Classer (justifiée)", `A.acc.anomaly(${q(a.id)}, 'classée')`, "ghost sm") : "")).join("")}</section>
      <section><h2>Maintenance prédictive</h2>
      ${aiBox("Fins de batterie prévues", `Prévision d'après la consommation observée et le taux d'échec de lecture (modèle simulé). Première échéance : ${pred[0].l.door} dans ${pred[0].days} jours.`, btn("Créer les ordres préventifs (< 30 j)", "A.acc.predictiveWO()", "sm"))}
      ${tbl(["Serrure", "#Batterie", "#Jours restants"], pred.map((x) => [esc(x.l.door), x.l.battery + " %", x.days < 30 ? `<strong>${x.days}</strong>` : x.days]))}
      <h2>Corrélation sécurité</h2>
      ${tbl(["Heure", "Badge", "Chambre", "Tâche planifiée"], staffEntries.map((e) => { const no = e.door.replace("Ch. ", ""); const s = C.staff.find((x) => e.cred.endsWith(x.id)); const ok = (s && (D.assignments || {})[no] === s.name) || C.workOrders.some((w) => w.door === e.door); return [esc(e.at.slice(11)), esc(holderOf(e.cred)), esc(no), ok ? badge("Justifiée", "on") : badge("Aucune tâche", "dark")] }), "Aucune entrée du personnel.")}
      <p class="muted">Rapprochement des entrées du personnel avec les tâches housekeeping (répartition de l'écran Statut des chambres) et maintenance.</p></section></div>`
  }

  // ---------- KPI §10.12 ----------
  function kpiTab() {
    const ok = sum(C.encoders, (e) => e.ok), fail = sum(C.encoders, (e) => e.fail)
    const ms = C.encoders.flatMap((e) => e.ms)
    const stays = [...new Set(C.creds.map((c) => c.resId))], mob = stays.filter((id) => C.creds.some((c) => c.resId === id && c.type === "mobile"))
    const byType = {}; C.alarms.forEach((a) => (byType[a.type] = (byType[a.type] || 0) + 1))
    const done = C.alarms.filter((a) => a.delay != null)
    const denied = {}; C.events.filter((e) => e.result === "refusée").forEach((e) => (denied[`${e.door} — ${e.detail || "refus"}`] = (denied[`${e.door} — ${e.detail || "refus"}`] || 0) + 1))
    return `<div class="grid">
        ${kpi("Temps moyen d'encodage", (sum(ms) / ms.length / 1000).toFixed(1) + " s", "objectif < 3 s")}
        ${kpi("Taux d'échec d'encodage", pct((fail / (ok + fail)) * 100), `${fail} échecs / ${ok + fail} tentatives`)}
        ${kpi("Adoption clé mobile", pct((mob.length / Math.max(1, stays.length)) * 100), `${mob.length} séjours sur ${stays.length}`)}
        ${kpi("Serrures hors ligne", offline().length, "temps réel")}
        ${kpi("Batterie faible", lowBat().length, "< 20 %")}
        ${kpi("Cartes non restituées", C.cards.lost, money(C.cards.lost * CARD_COST))}
        ${kpi("Délai moyen de traitement", (done.length ? Math.round(sum(done, (a) => a.delay) / done.length) : 0) + " min", `${done.length} alarme(s) traitée(s)`)}</div>
      <div class="cols"><section><h3>Alarmes par type</h3>${bars(Object.entries(byType).map(([label, value]) => ({ label, value })))}</section>
      <section><h3>Accès refusés par porte et motif</h3>${bars(Object.entries(denied).map(([label, value]) => ({ label, value })))}</section></div>
      <h3>Temps moyen par encodeur</h3>${bars(C.encoders.map((e) => ({ label: `${e.id} · ${e.post}`, value: Math.round(sum(e.ms) / e.ms.length) })), (v) => (v / 1000).toFixed(1) + " s")}
      <p class="muted">§10.12 — calculé sur les données d'exemple.</p>`
  }

  // ---------- Actions ----------
  const canSecurity = () => ["Agent de sécurité", "Responsable sécurité", "Duty manager"].includes(C.role)
  const encodeCards = (r, n, mode, done) => {
    let enc = C.encoders.find((e) => e.id === C.enc)
    if (enc.status !== "prêt") {
      const alt = C.encoders.find((e) => e.status === "prêt")
      if (!alt) return err("acc-err", "ENCODER_NOT_READY : aucun encodeur disponible.")
      if (!confirm(`${enc.id} indisponible (ENCODER_NOT_READY). Utiliser ${alt.id} (${alt.post}) ?`)) return
      C.enc = enc.id = alt.id
      enc = alt
    }
    const fail = C.failNext
    encodingMsg = `Posez la carte sur ${enc.id}… ${fail ? "tentative 1/3" : ""}`
    render()
    const rid = r.id, eid = enc.id
    setTimeout(() => {
      encodingMsg = null
      const r = R(rid), enc = C.encoders.find((e) => e.id === eid)
      if (fail) {
        enc.fail += 1
        const c = mkCred(r, "carte", { status: "échec", reason: "CARD_NOT_PRESENT après 3 tentatives", encoder: enc.id })
        ev("Ch. " + r.room, "Carte " + c.id, "encodage", "échec", "CARD_NOT_PRESENT")
        C.failNext = false
        toast("Échec d'encodage : réessayer ou choisir un autre encodeur")
        return render()
      }
      if (mode === "new") C.creds.filter((c) => c.resId === r.id && c.type === "carte" && c.status === "active").forEach((c) => { c.status = "révoquée"; c.reason = "remplacée (n° de séquence)" })
      for (let i = 0; i < n; i++) {
        const c = mkCred(r, "carte", { encoder: enc.id })
        if (mode === "duplicate") c.seq = C.seq[r.room] = Math.max(1, C.seq[r.room] - 1) // duplicata : même séquence
        enc.ok += 1
        enc.ms.push(1800 + Math.floor(Math.random() * 900))
        ev("Ch. " + r.room, "Carte " + c.id, "encodage", "accusé matériel", mode === "new" ? "nouvelle clé" : "duplicata")
      }
      r.key = "active"
      toast(`${n} carte(s) encodée(s) sur ${enc.id}${C.gateway.cloud ? "" : " (mode local)"}`)
      done && done()
      render()
    }, 1200)
  }
  const actions = {
    issue(resId, mode) {
      const r = R(resId), n = Number(val("acc-n")) || 1
      if (r.status !== "arrivee") return err("acc-err", "Clé possible uniquement pour un séjour en maison (RG-ACC-02).")
      const active = C.creds.filter((c) => c.resId === resId && c.status === "active").length
      const after = mode === "new" ? C.creds.filter((c) => c.resId === resId && c.status === "active" && c.type === "mobile").length + n : active + n
      if (after > MAX_KEYS) {
        const who = prompt(`${after} clés actives dépasseraient la limite de ${MAX_KEYS}. Validation du chef de réception (nom) :`, "Kouamé Ahoua (duty manager)")
        if (!who) return
        ev("Ch. " + r.room, "—", "dérogation", "validée", `limite de clés — ${who}`)
      }
      encodeCards(r, n, mode)
    },
    reencode(cid) {
      const c = C.creds.find((x) => x.id === cid), r = R(c.resId)
      c.status = "révoquée"; c.reason = "réencodée"
      encodeCards(r, 1, "duplicate")
    },
    mobile(resId) {
      const r = R(resId)
      if (!G(r.guest).email && !G(r.guest).phone) return err("acc-err", "Aucun contact pour envoyer la clé mobile.")
      const c = mkCred(r, "mobile", { encoder: "SDK mobile" })
      ev("Ch. " + r.room, label(c), "émission clé mobile", "accusé SDK", "application client")
      toast(`Clé mobile envoyée dans l'application de ${gname(r)} (simulé)`)
      render()
    },
    lost(cid) {
      const c = C.creds.find((x) => x.id === cid)
      if (!confirm(`Déclarer ${label(c)} perdue ?`)) return
      const online = lockOf(c.room)?.kind === "en ligne" || c.type === "mobile"
      Object.assign(c, { status: "perdue", reason: online ? "invalidée immédiatement" : "invalidée à la 1re utilisation de la nouvelle carte" })
      ev("Ch. " + c.room, label(c), "déclaration de perte", online ? "invalidation immédiate" : "en attente de nouvelle carte", "acc.credential.lost-reported")
      C.alarms.unshift({ id: uid("AL"), at: `${today} ${nowT()}`, type: "Carte perdue", door: "Ch. " + c.room, detail: `${label(c)} déclarée perdue`, status: "ouverte" })
      C.cards.lost += c.type === "carte" ? 1 : 0
      toast(online ? "Carte invalidée. Encodez une nouvelle clé." : "Serrure autonome : encodez une nouvelle clé (elle annulera l'ancienne)")
      render()
    },
    revoke(cid) {
      const c = C.creds.find((x) => x.id === cid)
      Object.assign(c, { status: "révoquée", reason: "manuelle" })
      ev("Ch. " + c.room, label(c), "révocation", "accusée", USER)
      toast(`${label(c)} révoquée`)
      render()
    },
    requestPass() {
      const type = val("ps-type"), holder = val("ps-holder"), days = Number(val("ps-days")) || 1
      if (!holder) return err("ps-err", "Choisissez un titulaire.")
      if (type === "Passe général" && C.role !== "Responsable sécurité") return err("ps-err", "Un passe général ne peut être demandé que par le Responsable sécurité.")
      C.passes.push({ id: uid("PS"), type, holder, from: today, to: addDays(today, days - 1), status: "à valider", by: `${USER} — rôle ${C.role}` })
      toast("Demande de passe soumise à validation")
      render()
    },
    validatePass(id) {
      const p = C.passes.find((x) => x.id === id)
      const who = prompt("Second valideur (différent du demandeur) :", "Arsène Gbané (responsable sécurité)")
      if (!who) return
      if (p.by.startsWith(who.trim())) return toast("Le valideur doit être différent du demandeur")
      Object.assign(p, { status: "active", validatedBy: who.trim() })
      ev("—", "Passe " + p.id, "émission passe", "validée", `${p.type} · ${p.holder}`)
      toast(`${p.type} activé pour ${p.holder}`)
      render()
    },
    revokePass(id) { const p = C.passes.find((x) => x.id === id); p.status = "révoquée"; ev("—", "Passe " + p.id, "révocation passe", "accusée", p.holder); toast("Passe révoqué"); render() },
    breakSeal(id) {
      if (!canSecurity()) return toast("Rôle sécurité ou duty manager requis")
      const why = prompt("Motif d'utilisation du passe d'urgence :")
      if (!why) return
      const p = C.passes.find((x) => x.id === id)
      p.status = "active"
      ev("—", "Passe " + p.id, "passe d'urgence", "scellés brisés", why)
      C.alarms.unshift({ id: uid("AL"), at: `${today} ${nowT()}`, type: "Passe d'urgence utilisé", door: "—", detail: why, status: "ouverte" })
      toast("Passe d'urgence activé — journalisé et alerté")
      render()
    },
    shift(id, on) {
      const s = C.staff.find((x) => x.id === id)
      if (on && /30 j/.test(s.status) && !canSecurity()) return toast("Réactivation d'un badge suspendu 30 j : rôle sécurité requis")
      Object.assign(s, { status: on ? "actif" : "suspendu (hors poste)", last: on ? today : s.last })
      ev("—", "Badge " + s.id, on ? "début de poste" : "fin de poste", on ? "badge activé" : "badge suspendu", `${on ? "hrm.shift.started" : "hrm.shift.ended"} · ${s.name}`)
      toast(`Badge de ${s.name} ${on ? "activé" : "suspendu"}`)
      render()
    },
    read() {
      const id = val("rd-card"), c = C.creds.find((x) => x.id === id)
      C.reads.unshift(c ? `<strong>${esc(c.id)}</strong> · chambre ${esc(c.room)} · séq. ${c.seq ?? "—"} · valide jusqu'au ${esc(c.to)} · titulaire ${esc(gname(R(c.resId)))} · ${credBadge(c.status)}`
        : `<strong>Carte vierge</strong> · aucune donnée encodée, prête pour l'émission`)
      ev("Encodeur " + val("rd-enc"), c ? "Carte " + c.id : "Carte vierge", "lecture", "lue", "")
      toast("Carte lue")
      render()
    },
    recycle() { if (!C.cards.recycle) return toast("Aucune carte à recycler"); C.cards.blank += C.cards.recycle; toast(`${C.cards.recycle} carte(s) remise(s) en stock`); C.cards.recycle = 0; render() },
    billCard() {
      const r = inHouse()[0]
      if (!r || !C.cards.lost) return toast("Rien à facturer")
      ;(D.extras[r.id] = D.extras[r.id] || []).push({ label: "Carte d'accès non restituée", amount: CARD_COST })
      C.cards.lost -= 1; C.cards.billed += 1
      toast(`${money(CARD_COST)} imputés au folio de la chambre ${r.room}`)
      render()
    },
    cloud(on) {
      const g = C.gateway
      g.cloud = on
      if (on) {
        const n = g.queue.length
        g.queue = []
        g.beat = "il y a 1 s"
        ev("Passerelle " + g.id, "—", "resynchronisation", "terminée", `${n} événement(s) rejoué(s), ordre garanti`)
        toast(`Connexion rétablie : ${n} événement(s) rejoué(s)`)
      } else {
        ev("Passerelle " + g.id, "—", "perte du cloud", "mode autonome", "")
        C.alarms.unshift({ id: uid("AL"), at: `${today} ${nowT()}`, type: "Passerelle hors ligne", door: g.id, detail: "Liaison cloud perdue, mode autonome", status: "ouverte" })
        toast("Coupure simulée : la passerelle passe en autonomie")
      }
      render()
    },
    renewCert() { C.gateway.cert = addDays(today, 30); C.gateway.certFp = hash(String(Date.now())).toUpperCase().replace(/(..)(..).*(..)/, "$1:$2:…:$3"); toast("Certificat renouvelé pour 30 jours"); render() },
    toggleEnc(id) { const e = C.encoders.find((x) => x.id === id); e.status = e.status === "prêt" ? "hors service" : "prêt"; if (e.status !== "prêt" && C.enc === id) C.enc = (C.encoders.find((x) => x.status === "prêt") || e).id; toast(`${id} : ${e.status}`); render() },
    command(lid, cmd) {
      const l = C.locks.find((x) => x.id === lid)
      if (cmd === "open" && occupied(l)) {
        if (!canSecurity()) return err("cmd-err", "Chambre occupée : ouverture à distance réservée à la sécurité ou au duty manager (RG-ACC-04).")
        const why = prompt("Motif de l'ouverture d'une chambre occupée :")
        if (!why) return
        l.pendingWhy = why
      }
      toast(`Commande envoyée à ${l.door}…`)
      setTimeout(() => {
        const l = C.locks.find((x) => x.id === lid)
        if (l.offline) {
          ev(l.door, "—", "commande " + cmd, "échec", "LOCK_UNREACHABLE après 3 tentatives")
          toast(`${l.door} : LOCK_UNREACHABLE après 3 tentatives`)
        } else {
          if (cmd === "office") l.state = l.state === "mode bureau" ? "verrouillée" : "mode bureau"
          if (cmd === "status") l.last = `${today} ${nowT()}`
          ev(l.door, "Commande à distance", cmd === "open" ? "ouverture à distance" : cmd === "office" ? "mode bureau" : "lecture d'état", "accusé matériel", `${C.role}${l.pendingWhy ? " · " + l.pendingWhy : ""}`)
          l.pendingWhy = null
          toast(`${l.door} : ${cmd === "status" ? `verrouillée, batterie ${l.battery ?? "secteur"}${l.battery != null ? " %" : ""}` : "commande acquittée"}`)
        }
        render()
      }, 800)
    },
    collect(lid) {
      const l = C.locks.find((x) => x.id === lid)
      const n = 3 + Math.floor(Math.random() * 6)
      ev(l.door, "Lecteur de collecte", "collecte du journal", "intégrée", `${n} événement(s) récupéré(s)`)
      l.last = `${today} ${nowT()}`
      toast(`${n} événement(s) collecté(s) sur ${l.door}`)
      render()
    },
    ack(id) {
      const a = C.alarms.find((x) => x.id === id)
      const note = prompt("Commentaire de traitement :", "Vérifié sur place")
      if (note == null) return
      const [h, m] = a.at.slice(11).split(":").map(Number), now = new Date()
      const delay = a.at.startsWith(today) ? Math.max(1, now.getHours() * 60 + now.getMinutes() - (h * 60 + m)) : 30
      Object.assign(a, { status: "traitée", by: `${USER} — ${C.role}`, delay, detail: `${a.detail} · ${note}` })
      ev(a.door, "—", "alarme acquittée", "traitée", `${a.type} · ${note}`)
      toast("Alarme acquittée")
      render()
    },
    workOrder(door, reason) {
      if (C.workOrders.some((w) => w.door === door)) return toast("Un ordre de travail existe déjà pour cette porte")
      const no = door.replace("Ch. ", "")
      const id = A.mnt ? A.mnt.external({ title: reason, target: D.rooms.some((r) => r.no === no) ? no : door, desc: `Alerte serrure : ${reason}.`, source: "Serrure", by: "Contrôle d'accès" }) : uid("OT")
      C.workOrders.unshift({ id, door, reason, at: `${today} ${nowT()}` })
      toast(`Ordre de travail ${id} créé pour ${door}, visible dans Maintenance technique`)
      render()
    },
    simAlarm() {
      const types = [["Porte restée ouverte", "Ch. 202", "Ouverte depuis 2 min"], ["Refus répétés", "Ch. 301", "3 refus en 1 min"], ["Sabotage", "Salon exécutif", "Capot de lecteur ouvert"]]
      const [type, door, detail] = types[Math.floor(Math.random() * types.length)]
      C.alarms.unshift({ id: uid("AL"), at: `${today} ${nowT()}`, type, door, detail, status: "ouverte" })
      ev(door, "—", "alarme", type.toLowerCase(), detail)
      toast(`Nouvelle alarme : ${type} — ${door}`)
      render()
    },
    verifyChain() {
      const evs = C.events.slice().reverse()
      let prev = "00000000", ok = true
      for (const e of evs) { if (hash(prev + e.at + e.door + e.cred + e.type + e.result + e.detail) !== e.hash) { ok = false; break } prev = e.hash }
      toast(ok ? `Chaîne intègre : ${evs.length} événements vérifiés` : "Chaîne rompue : journal altéré")
    },
    query() {
      const door = val("qy-door"), from = val("qy-from"), to = val("qy-to"), why = val("qy-why")
      if (!["Responsable sécurité", "Duty manager"].includes(C.role)) return err("qy-err", "Droit spécifique requis : Responsable sécurité ou Duty manager.")
      if (why.length < 5) return err("qy-err", "Justification obligatoire.")
      const rows = C.events.filter((e) => e.door === door && e.at.startsWith(today) && e.at.slice(11) >= from && e.at.slice(11) <= to && ["ouverture", "ouverture à distance"].includes(e.type))
      ui.accQuery = { door, from, to, rows }
      ev(door, "—", "consultation du journal", "autorisée", `${C.role} · ${why}`)
      render()
    },
    emergency() {
      const kind = val("em-kind"), zone = val("em-zone"), reason = val("em-reason"), second = val("em-second")
      if (!canSecurity()) return err("em-err", "Rôle sécurité ou duty manager requis.")
      if (!reason) return err("em-err", "Motif obligatoire.")
      if (!second) return err("em-err", "Second valideur obligatoire (principe des quatre yeux, RG-ACC-05).")
      runEmergency(kind, zone, reason, `${USER} — ${C.role}`, second)
    },
    fire() { runEmergency("Ouverture d'urgence (évacuation)", "Établissement", "Alarme incendie (déclenchement automatique)", "Système incendie", "non requis (alarme incendie)") },
    release() {
      const e = C.emergency, second = val("em-second2")
      if (!canSecurity() && e.by !== "Système incendie") return err("em-err", "Rôle sécurité ou duty manager requis.")
      if (!second) return err("em-err", "Second valideur obligatoire pour lever l'action.")
      C.locks.filter((l) => e.lockIds.includes(l.id)).forEach((l) => { if (!l.offline) l.state = l.prevState || "verrouillée" })
      ev(e.zone, "—", "levée " + e.kind.toLowerCase(), "accusée", `validée par ${second}`)
      C.emergency = null
      toast("Action d'urgence levée")
      render()
    },
    anomaly(id, st) { const a = C.anomalies.find((x) => x.id === id); a.status = st; ev("—", "IA", "anomalie " + id, st, C.role); toast(`Anomalie ${id} ${st}`); render() },
    predictiveWO() {
      const list = C.locks.filter((l) => l.battery != null && Math.round(l.battery * (l.kind === "en ligne" ? 1.6 : 2.4)) < 30 && !C.workOrders.some((w) => w.door === l.door))
      list.forEach((l) => C.workOrders.unshift({ id: uid("OT"), door: l.door, reason: "Remplacement préventif des piles (IA)", at: `${today} ${nowT()}` }))
      toast(list.length ? `${list.length} ordre(s) de travail préventif(s) créé(s)` : "Aucun nouvel ordre nécessaire")
      render()
    },
  }
  function runEmergency(kind, zone, reason, by, second) {
    const locks = C.locks.filter((l) => zone === "Établissement" || l.zone === zone)
    const target = kind === "Lockdown" ? "verrouillage forcé" : "ouverte (évacuation)"
    const results = locks.map((l) => {
      const ok = l.kind === "en ligne" && !l.offline
      if (ok) { l.prevState = l.state; l.state = target }
      return { door: l.door, ok, ms: 600 + Math.floor(Math.random() * 3800), why: l.offline ? "LOCK_UNREACHABLE" : "serrure autonome, ordre non reçu" }
    })
    C.emergency = { kind, zone, reason, by, second, at: nowT(), results, lockIds: locks.map((l) => l.id) }
    ev(zone, "—", kind.toLowerCase(), `${results.filter((x) => x.ok).length}/${results.length} accusés`, `${reason} · ${by} + ${second}`)
    C.alarms.unshift({ id: uid("AL"), at: `${today} ${nowT()}`, type: kind, door: zone, detail: reason, status: "ouverte" })
    toast(`${kind} déclenché sur ${zone}`)
    go("acc-securite/urgence")
  }

  HMS.module({ code: "acc", group: "Opérations", title: "Contrôle d'accès et serrures", phase: "5", spec: "§10 ACC", actions, screens: [
    { id: "acc-cles", label: "Clés et identifiants", spec: "ACC FOF", view: views.cles },
    { id: "acc-materiel", label: "Serrures et passerelle", spec: "ACC", view: views.materiel },
    { id: "acc-securite", label: "Sécurité des accès", spec: "ACC", view: views.securite },
  ] })
})()
