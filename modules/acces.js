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
    { id: "L-SPA", door: "Spa", zone: "Espaces communs", kind: "en ligne", battery: 81, fw: "4.2.0", last: "2026-11-26 08:38", state: "verrouillée" },
    { id: "L-BAR", door: "Bar lounge", zone: "Espaces communs", kind: "en ligne", battery: 76, fw: "4.2.0", last: "2026-11-26 08:37", state: "verrouillée" },
    { id: "L-TECH", door: "Local technique", zone: "Service", kind: "en ligne", battery: 55, fw: "4.2.0", last: "2026-11-26 08:41", state: "verrouillée", doorOpen: true },
    { id: "L-LING", door: "Lingerie étage 2", zone: "Service", kind: "hors ligne", battery: 33, fw: "4.1.3", last: "2026-11-25 17:30", state: "verrouillée" },
    // Portes de communication entre chambres communicantes (EF-ACC-027) : ouvertes seulement par une clé couvrant les deux chambres
    { id: "L-COM-202", door: "Porte communicante 202↔203", zone: "Étage 2", kind: "hors ligne", battery: 70, fw: "4.1.3", last: "2026-11-25 18:00", state: "verrouillée", pair: ["202", "203"] },
    { id: "L-COM-303", door: "Porte communicante 303↔304", zone: "Étage 3", kind: "hors ligne", battery: 68, fw: "4.1.3", last: "2026-11-25 18:00", state: "verrouillée", pair: ["303", "304"] },
  ]
  // Espaces communs : serrure, horaires d'ouverture encodés sur la carte (EF-ACC-011)
  const AREAS = [
    { name: "Ascenseur", lock: "L-ASC", hours: ["00:00", "23:59"] },
    { name: "Piscine", lock: "L-PISC", hours: ["07:00", "21:00"] },
    { name: "Salle de sport", lock: "L-GYM", hours: ["06:00", "22:00"] },
    { name: "Parking", lock: "L-PARK", hours: ["00:00", "23:59"] },
    { name: "Spa", lock: "L-SPA", hours: ["09:00", "20:00"] },
    { name: "Salon exécutif", lock: "L-SAL", hours: ["06:30", "23:00"] },
    { name: "Bar lounge", lock: "L-BAR", hours: ["11:00", "23:59"] },
    { name: "Minibar", lock: null, hours: ["00:00", "23:59"] },
  ]
  const HOLDERS = { principal: "Occupant principal", adulte: "Accompagnant adulte", enfant: "Accompagnant enfant (restreint)" }
  const CHILD_DENY = ["Minibar", "Bar lounge", "Salon exécutif"] // EF-ACC-004 : enfant sans minibar ni bar
  const DOOR_TOKENS = { ROOMS_FLOOR: "Chambres de l'étage affecté", ROOMS_WO: "Chambres sur ordre de travail" }
  const DAYS = { "Tous les jours": [0, 1, 2, 3, 4, 5, 6], "Lun–Sam": [1, 2, 3, 4, 5, 6], "Lun–Ven": [1, 2, 3, 4, 5] }
  const GW_LATEST = "2.9.0", FW_LATEST = "4.2.0"
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
    // Profils d'accès du personnel, associés aux postes RH (EF-ACC-012)
    profiles: [
      { role: "Femme de chambre", post: "Femme de chambre", doors: ["ROOMS_FLOOR", "L-LING", "L-ASC"], margin: 15, days: "Tous les jours", privacy: "Refusé en mode intimité" },
      { role: "Technicien maintenance", post: "Technicien de maintenance", doors: ["ROOMS_WO", "L-TECH", "L-LING", "L-ASC"], margin: 30, days: "Lun–Sam", privacy: "Refusé en mode intimité" },
      { role: "Bagagiste", post: "Bagagiste", doors: ["L-PARK", "L-ASC"], margin: 0, days: "Tous les jours", privacy: "Pas d'accès chambres" },
      { role: "Agent de sécurité", post: "Agent de sécurité", doors: ["L-ASC", "L-GYM", "L-PISC", "L-PARK", "L-SPA", "L-SAL", "L-BAR", "L-TECH", "L-LING"], margin: 0, days: "Tous les jours", privacy: "Chambres : passe d'urgence journalisé" },
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
    sims: [], // essais d'accès du simulateur
    lockSeq: {}, // plus haut n° de séquence vu par chaque serrure autonome
    pkgs: { "R-2048": "DETENTE" }, // forfaits achetés (rat.package) par séjour
    mobileAuto: true, // clé mobile émise automatiquement au check-in (EF-ACC-005)
    emOtp: null, // code à usage unique du second valideur (EF-ACC-016)
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
  // Droits aux espaces communs : catégorie, fidélité (CRM), forfait (RAT), horaires ; restrictions des accompagnants (EF-ACC-011, EF-ACC-004)
  const tierOf = (r) => (D.crm && D.crm.accounts && D.crm.accounts[r.guest] ? D.crm.accounts[r.guest].tier : "—")
  const pkgOf = (r) => { const code = C.pkgs[r.id]; return code ? ((D.rat && D.rat.packages) || []).find((x) => x.code === code) || { code, name: code, components: [] } : null }
  const rights = (r, holder = "principal") => AREAS.map((a) => {
    let ok = true, why = "Tous les séjours"
    const t = tierOf(r), g = G(r.guest) || {}
    if (a.name === "Ascenseur") why = `Étage ${String(r.room || "").charAt(0)} et rez-de-chaussée`
    if (a.name === "Spa") { const k = pkgOf(r), spa = k && /spa|massage|d[ée]tente/i.test(k.name + JSON.stringify(k.components || [])); ok = spa || t === "Platine"; why = spa ? `Forfait ${k.name} (RAT)` : t === "Platine" ? "Fidélité Platine (CRM)" : "Ni forfait spa ni niveau Platine" }
    if (a.name === "Salon exécutif") { ok = r.type === "SUI" || ["Or", "Platine"].includes(t) || !!g.vip; why = r.type === "SUI" ? "Catégorie Suite" : ["Or", "Platine"].includes(t) ? `Fidélité ${t} (CRM)` : g.vip ? "Client VIP" : `Catégorie ${T(r.type).label}, fidélité ${t} : non éligible` }
    if (holder === "enfant" && CHILD_DENY.includes(a.name)) { ok = false; why = "Accompagnant enfant : accès restreint" }
    return { ...a, ok, why }
  })
  const areasFor = (r, holder) => rights(r, holder).filter((x) => x.ok).map((x) => x.name)
  const roomsOf = (c) => c.rooms || [c.room]
  const inWin = (t, a, b) => (a <= b ? t >= a && t <= b : t >= a || t <= b)
  const shiftMin = (hm, m) => { const [h, mm] = hm.split(":").map(Number), x = (((h * 60 + mm + m) % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0") }
  const doorLabel = (d) => DOOR_TOKENS[d] || (C.locks.find((l) => l.id === d) || {}).door || d
  const validTo = (r) => `${r.to} 13:00` // départ prévu 12 h + 1 h de grâce (RG-FOF-02)
  const nextSeq = (no) => (C.seq[no] = (C.seq[no] || 0) + 1)
  const mkCred = (r, type, extra = {}) => {
    const holder = extra.holder || "principal"
    const c = { id: (type === "mobile" ? "M-" : "K-") + C.idSeq++, resId: r.id, room: r.room, rooms: [r.room], holder, type, seq: type === "carte" ? nextSeq(r.room) : null, from: r.from, to: validTo(r), status: "active", areas: areasFor(r, holder), version: 1, ...extra }
    C.creds.unshift(c)
    return c
  }
  const seedCreds = [["R-2044", ["carte", "carte"]], ["R-2046", ["carte"]], ["R-2047", ["carte", "mobile"]], ["R-2048", ["mobile", "carte"]]]
  seedCreds.forEach(([id, types]) => { const r = R(id); if (r && r.status === "arrivee") types.forEach((t) => mkCred(r, t, { encoder: t === "carte" ? "ENC-1" : "SDK mobile" })) })
  const sync = () => {
    D.reservations.forEach((r) => {
      const mine = C.creds.filter((c) => c.resId === r.id && ["active", "en cours"].includes(c.status))
      if (r.status === "arrivee") {
        const fresh = !C.creds.some((c) => c.resId === r.id)
        // fof.stay.checked-in : carte associée au séjour, clé mobile émise automatiquement (EF-ACC-005)
        if (r.key === "active" && !C.creds.some((c) => c.resId === r.id && c.type === "carte" && c.status !== "échec")) {
          const c = mkCred(r, "carte", { encoder: C.enc })
          ev("Ch. " + r.room, "Carte " + c.id, "encodage", "accusé matériel", "fof.stay.checked-in · carte associée au séjour")
        }
        const g = G(r.guest) || {}
        if (fresh && C.mobileAuto && (g.email || g.phone)) {
          const c = mkCred(r, "mobile", { encoder: "SDK mobile" })
          ev("Ch. " + r.room, label(c), "émission clé mobile", "accusé SDK", "fof.stay.checked-in · émission automatique")
        }
      }
      // Recalcul des droits aux espaces communs (RG-ACC-07) : forfait, fidélité ou catégorie modifiés
      if (r.status === "arrivee") C.creds.filter((c) => c.resId === r.id && ["active", "à réencoder"].includes(c.status)).forEach((c) => {
        const now = areasFor(r, c.holder)
        if (now.join() === (c.areas || []).join()) return
        const was = c.areas || []
        c.areas = now
        if (!C.areasReady) return
        c.version += 1
        const plus = now.filter((x) => !was.includes(x)), minus = was.filter((x) => !now.includes(x))
        ev("Ch. " + c.room, label(c), "recalcul des droits", "mise à jour à distance", "RG-ACC-07 · " + [plus.length ? "+" + plus.join(", +") : "", minus.length ? "−" + minus.join(", −") : ""].filter(Boolean).join(" "))
      })
      // Clé partagée : une chambre secondaire libérée est retirée de la clé (EF-ACC-027)
      C.creds.filter((c) => c.resId === r.id && c.rooms && c.rooms.length > 1 && ["active", "à réencoder"].includes(c.status)).forEach((c) => {
        const keep = c.rooms.filter((no, i) => i === 0 || occupant(no))
        if (keep.length !== c.rooms.length) { ev("Ch. " + c.rooms.filter((x) => !keep.includes(x)).join(", "), label(c), "retrait de chambre", "mise à jour", "clé partagée : chambre secondaire libérée"); c.rooms = keep; c.version += 1 }
      })
      if (r.status !== "arrivee") mine.forEach((c) => { c.status = "révoquée"; c.reason = "check-out"; ev("Ch. " + c.room, label(c), "révocation", lockOf(c.room)?.kind === "en ligne" || c.type === "mobile" ? "immédiate" : "à l'expiration encodée", "fof.stay.checked-out") })
      else mine.forEach((c) => {
        if (c.room !== r.room) {
          const old = c.room
          ev("Ch. " + old, label(c), "transfert", "ancienne chambre révoquée", `fof.stay.room-moved → ch. ${r.room}`)
          Object.assign(c, { room: r.room, rooms: [r.room, ...roomsOf(c).filter((x) => x !== old && x !== r.room)], version: c.version + 1, areas: areasFor(r, c.holder) })
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
    C.areasReady = true
  }

  // Décision d'une serrure face à un identifiant (simulateur d'accès, EF-ACC-004/009/011/012/027)
  const decideStaff = (s, l, t) => {
    if (s.status !== "actif") return [false, `badge ${s.status} (hrm.shift / RG-ACC-08)`]
    const p = C.profiles.find((x) => x.role === s.role)
    if (!p) return [false, "aucun profil d'accès pour ce poste"]
    if (!(DAYS[p.days] || DAYS["Tous les jours"]).includes(day(today).getDay())) return [false, `jour non autorisé par le profil (${p.days})`]
    const [a, b] = s.shift.split("–")
    if (!inWin(t, shiftMin(a, -p.margin), shiftMin(b, p.margin))) return [false, `hors poste (${s.shift}, marge ${p.margin} min)`]
    if (l.room) {
      const ok = (p.doors.includes("ROOMS_FLOOR") && l.zone === s.zone) || (p.doors.includes("ROOMS_WO") && C.workOrders.some((w) => w.door === l.door))
      if (!ok) return [false, "chambre hors périmètre du profil"]
      if (occupant(l.room) && l.dnd) return [false, "chambre occupée en mode intimité (RG-ACC-06)"]
      return [true, `profil ${p.role}`]
    }
    if (!p.doors.includes(l.id)) return [false, `porte hors profil ${p.role}`]
    return [true, `profil ${p.role}`]
  }
  const decide = (who, l, t) => {
    if (/verrouillage forcé/.test(l.state)) return [false, "lockdown en cours"]
    const s = C.staff.find((x) => x.id === who)
    if (s) return decideStaff(s, l, t)
    const c = C.creds.find((x) => x.id === who)
    if (!c) return [false, "identifiant inconnu"]
    if (["échec", "à réencoder"].includes(c.status)) return [false, `carte ${c.status}`]
    const autonomous = (l.room || l.pair) && l.kind === "hors ligne" && c.type === "carte"
    // Une serrure en ligne ou une clé mobile connaît l'état cloud ; une serrure autonome ne lit que la carte
    if (!autonomous && c.status !== "active") return [false, c.status === "perdue" ? "identifiant déclaré perdu : invalidé (EF-ACC-009)" : `identifiant ${c.status}`]
    if (`${today} ${t}` > c.to || today < c.from) return [false, "hors période de validité (RG-ACC-01)"]
    if (l.pair) return l.pair.every((no) => roomsOf(c).includes(no)) ? [true, "chambres communicantes sur la même clé"] : [false, "porte de communication condamnée : les deux chambres ne sont pas sur la clé"]
    if (l.room) {
      if (!roomsOf(c).includes(l.room)) return [false, "chambre non encodée sur l'identifiant"]
      if (autonomous) {
        const seen = C.lockSeq[l.room] || 0
        if (c.seq < seen) return [false, `n° de séquence ${c.seq} < ${seen} : carte annulée par une carte plus récente`]
        if (c.seq > seen) {
          C.lockSeq[l.room] = c.seq
          C.creds.filter((x) => roomsOf(x).includes(l.room) && x.type === "carte" && x.seq < c.seq && x.status === "perdue").forEach((x) => { x.reason = `invalidée à la serrure par la séquence ${c.seq}`; ev(l.door, label(x), "invalidation par séquence", "carte perdue annulée", `1re utilisation de ${c.id}`) })
        }
        if (c.status === "perdue") return [true, "serrure autonome : la carte perdue reste valable jusqu'à la 1re utilisation de la nouvelle"]
      }
      return [true, roomsOf(c).length > 1 ? "clé partagée" : "chambre encodée"]
    }
    const a = AREAS.find((x) => x.lock === l.id)
    if (!a) return [false, "porte de service : non accessible aux clients"]
    if (!(c.areas || []).includes(a.name)) return [false, `${a.name} non inclus : ${rights(R(c.resId), c.holder).find((x) => x.name === a.name).why}`]
    if (!inWin(t, a.hours[0], a.hours[1])) return [false, `${a.name} fermé (horaires ${a.hours.join("–")})`]
    return [true, `${a.name} autorisé`]
  }
  const label = (c) => (c.type === "mobile" ? "Clé mobile " : "Carte ") + c.id
  const credBadge = (s) => badge(s, s === "active" ? "ok" : s === "à réencoder" ? "warn" : ["perdue", "échec"].includes(s) ? "bad" : s === "en cours" ? "info" : "outline")
  let encodingMsg = null // état transitoire (non sauvegardé)
  const pending = () => C.alarms.filter((a) => a.status === "ouverte")
  const lowBat = () => C.locks.filter((l) => l.battery != null && l.battery < 20)
  const offline = () => C.locks.filter((l) => l.offline)
  const occupied = (l) => l.room && occupant(l.room)
  const cloudBanner = () => (C.gateway.cloud ? "" : `<div class="err" style="margin-bottom:14px">Mode dégradé : la passerelle ${esc(C.gateway.id)} n'a plus de connexion au cloud. Encodage et commandes locales continuent ; ${C.gateway.queue.length} événement(s) en file locale, rejoués à la reconnexion (EF-ACC-023).</div>`)
  // Historique d'exemple (14 jours, déterministe) raccordé à la valeur du jour : mini-courbes et évolutions des indicateurs
  const rnd = (i) => { const x = Math.sin(i * 57.31 + 1.7) * 43758.5453; return x - Math.floor(x) }
  const hist = (seed, base, spread, last) => Array.from({ length: 14 }, (_, i) => (i === 13 ? last : Math.max(0, Math.round((base + (rnd(seed + i) - 0.5) * spread) * 10) / 10)))
  const dlt = (h) => (h[12] ? ((h[13] - h[12]) / Math.abs(h[12])) * 100 : null)
  const statRow = (items) => `<div class="grid g4" style="margin-bottom:16px">${items.map(stat).join("")}</div>`
  const countBy = (arr, f) => Object.entries(arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m }, {})).map(([label, value]) => ({ label, value }))
  const cardsLine = () => { const cards = C.creds.filter((c) => c.type === "carte"); return [{ label: "Vierges en stock", value: C.cards.blank }, { label: "En circulation", value: cards.filter((c) => c.status === "active").length }, { label: "À recycler", value: C.cards.recycle }, { label: "Non restituées", value: C.cards.lost }] }
  const headCles = () => {
    const act = C.creds.filter((c) => c.status === "active"), stays = inHouse()
    const mob = stays.filter((r) => C.creds.some((c) => c.resId === r.id && c.type === "mobile" && c.status === "active")).length
    const todo = C.creds.filter((c) => ["à réencoder", "échec"].includes(c.status)).length
    const hA = hist(3, Math.max(4, act.length), 6, act.length), hM = hist(11, 40, 20, Math.round((mob / Math.max(1, stays.length)) * 100))
    return statRow([
      { label: "Clés actives", value: String(act.length), icon: "key", delta: dlt(hA), hint: `${stays.length} séjour(s) en cours · vs hier`, trend: hA, route: "acc-cles/sejours" },
      { label: "Adoption clé mobile", value: pct(hM[13]), icon: "phone", delta: dlt(hM), hint: `${mob} séjour(s) sur ${stays.length}`, trend: hM },
      { label: "À réencoder ou en échec", value: String(todo), icon: "alert", hint: todo ? "à traiter à la réception" : "rien à traiter" },
      { label: "Cartes vierges", value: String(C.cards.blank), icon: "layers", hint: `seuil de réassort 100 · ${C.cards.recycle} à recycler`, route: "acc-cles/lecture" },
    ])
  }
  const headMateriel = () => {
    const g = C.gateway, reach = C.locks.filter((l) => !l.offline).length, hB = hist(23, 2, 2, lowBat().length)
    return statRow([
      { label: "Passerelle edge", value: g.cloud ? "En ligne" : "Dégradée", icon: "server", hint: `${g.id} · agent ${g.version}${g.cloud ? " · " + g.beat : " · file " + g.queue.length}` },
      { label: "Serrures joignables", value: `${reach}/${C.locks.length}`, icon: "lock", hint: `${C.locks.filter((l) => l.kind === "en ligne").length} en ligne, ${C.locks.filter((l) => l.kind !== "en ligne").length} autonomes`, route: "acc-materiel/serrures" },
      { label: "Batteries faibles", value: String(lowBat().length), icon: "zap", delta: dlt(hB), good: false, hint: "sous 20 % · vs hier", trend: hB },
      { label: "Encodeurs prêts", value: `${C.encoders.filter((e) => e.status === "prêt").length}/${C.encoders.length}`, icon: "plug", hint: `${supervisionIssues().length} anomalie(s) de supervision` },
    ])
  }
  const headSecurite = () => {
    const done = C.alarms.filter((a) => a.delay != null), denied = C.events.filter((e) => e.result === "refusée").length
    const hA = hist(41, 4, 4, pending().length), hD = hist(53, Math.max(3, denied), 5, denied)
    return statRow([
      { label: "Alarmes ouvertes", value: String(pending().length), icon: "bell", delta: dlt(hA), good: false, hint: "temps réel · vs hier", trend: hA, route: "acc-securite/alarmes" },
      { label: "Accès refusés", value: String(denied), icon: "shield", delta: dlt(hD), good: false, hint: "au journal · vs hier", trend: hD, route: "acc-securite/journal" },
      { label: "Délai moyen de traitement", value: (done.length ? Math.round(sum(done, (a) => a.delay) / done.length) : 0) + " min", icon: "clock", hint: `${done.length} alarme(s) traitée(s)` },
      { label: "Anomalies IA ouvertes", value: String(C.anomalies.filter((a) => a.status === "ouverte").length), icon: "brain", hint: "à examiner (simulé)", route: "acc-securite/ia" },
    ])
  }
  const roleBar = () => `<div class="row" style="margin-bottom:12px"><label for="acc-role" style="margin:0">Rôle simulé</label><select id="acc-role" style="max-width:220px" onchange="D.acc.role=this.value;render()">${ROLES.map((r) => `<option ${C.role === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></div>`

  // ---------- Écrans ----------
  const views = {
    cles(p) {
      sync()
      const tab = p[0] || "sejours"
      return pageHead("Clés et identifiants", "Cartes et clés mobiles des séjours, passes et badges du personnel, lecture de carte, stock. Encodeurs et serrures simulés.")
        + cloudBanner() + headCles()
        + subtabs("acc-cles", [["sejours", "Clés des séjours"], ["passes", "Passes et personnel"], ["simul", "Tester un accès"], ["lecture", "Lecture et stock de cartes"]], tab)
        + ({ sejours: stayKeys, passes: passesTab, simul: simTab, lecture: readTab }[tab] || stayKeys)()
    },
    materiel(p) {
      sync()
      const tab = p[0] || "passerelle"
      return pageHead("Serrures et passerelle", "Supervision de la passerelle edge, des encodeurs et du parc de serrures ; commandes à distance (matériel simulé).")
        + cloudBanner() + headMateriel()
        + subtabs("acc-materiel", [["passerelle", "Passerelle et encodeurs"], ["serrures", "Parc de serrures"], ["architecture", "Architecture SaaS-matériel"]], tab)
        + ({ passerelle: gatewayTab, serrures: locksTab, architecture: archTab }[tab] || gatewayTab)()
    },
    securite(p) {
      sync()
      const tab = p[0] || "alarmes"
      return pageHead("Sécurité des accès", "Alarmes en temps réel, journal immuable des accès, actions d'urgence, détection d'anomalies et indicateurs (exemple).")
        + cloudBanner() + headSecurite()
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
    const others = stays.filter((x) => x.id !== r.id)
    const ids = creds.map((c) => c.id)
    const stayEv = C.events.filter((e) => /^fof\.stay/.test(e.detail) && ids.some((id) => e.cred.endsWith(" " + id))).slice(0, 8)
    const mob = creds.filter((c) => c.type === "mobile")
    return split(listItems(stays.map((x) => { const n = C.creds.filter((c) => c.resId === x.id && c.status === "active").length; return { id: x.id, title: `Ch. ${x.room} · ${gname(x)}`, sub: `${n} clé(s) active(s) · départ ${fd(x.to)}`, badge: C.creds.some((c) => c.resId === x.id && c.status === "à réencoder") ? " " + badge("À réencoder", "warn") : "" } }), r.id, "acc-cles/sejours").replace(/go\('acc-cles\/sejours\/([^']+)'\)/g, "ui.accStay='$1';render()"),
      `<div class="stack">${section(`Ch. ${r.room} — ${gname(r)}`, `<div class="muted" style="margin-bottom:10px">${esc(r.id)} · validité jusqu'au ${fd(r.to)} 13:00 (départ + 1 h de grâce, RG-ACC-01) · espaces : ${esc(areasFor(r).join(", "))}</div>
        ${tbl(["Identifiant", "Type", "Titulaire", "Contenu encodé", "N° séq.", "Validité", "Version", "Statut", ""], creds.map((c) => [esc(c.id), esc(c.type), esc(HOLDERS[c.holder] || HOLDERS.principal),
          `ch. ${esc(roomsOf(c).join(" + "))}${connects(roomsOf(c)).map((l) => ` · ${esc(l.door)}`).join("")}<div class="muted">${esc((c.areas || []).join(", ") || "aucun espace")}</div>`,
          c.seq ?? "—", `${fd(c.from)} → ${esc(c.to.slice(8, 10) + "/" + c.to.slice(5, 7) + " " + c.to.slice(11))}`, "v" + c.version, credBadge(c.status) + (c.reason ? ` ${ref(c.reason)}` : ""),
          c.status === "active" ? `<span class="row" style="flex-wrap:nowrap">${btn("Perdue", `A.acc.lost(${q(c.id)})`, "ghost sm")}${btn("Révoquer", `A.acc.revoke(${q(c.id)})`, "ghost sm")}</span>`
          : c.status === "à réencoder" || c.status === "échec" ? btn("Réencoder", `A.acc.reencode(${q(c.id)})`, "sm") : ""]), "Aucun identifiant.")}
        <p class="muted">Encodé sur la carte : chambre(s), espaces communs autorisés, début et fin de validité, n° de séquence (une « nouvelle clé » annule les précédentes) — EF-ACC-002.</p>
`, badge(`Serrure ${lock?.kind || "—"}`, "outline"))}
        ${section("Émettre des clés", `<div class="form">
          ${field("acc-enc", "Encodeur", select("acc-enc", encs.map((e) => [e.id, `${e.id} · ${e.post} · ${e.status}`]), C.enc, `onchange="D.acc.enc=this.value"`))}
          ${field("acc-n", "Nombre de cartes", select("acc-n", ["1", "2"], "1"))}
          ${field("acc-holder", "Titulaire", select("acc-holder", Object.entries(HOLDERS), "principal"))}
          <div style="align-self:end"><label class="row" style="color:var(--ink)"><input type="checkbox" id="acc-fail" ${C.failNext ? "checked" : ""} onchange="D.acc.failNext=this.checked"> Simuler un échec d'encodage</label></div>
          <div class="full"><label>Chambres supplémentaires sur la même clé (famille, groupe, suite)</label><div class="row">${others.length ? others.map((x) => `<label class="row" style="color:var(--ink);margin:0"><input type="checkbox" id="acc-sh-${esc(x.room)}"> Ch. ${esc(x.room)} · ${esc(gname(x))}${pairOf(r.room) === x.room ? " (communicante)" : ""}</label>`).join("") : ref("Aucune autre chambre en séjour.")}</div>
            <p class="muted" style="margin:4px 0 0">${pairOf(r.room) ? `Ch. ${esc(r.room)} communique avec la ${esc(pairOf(r.room))} : la porte de communication n'est encodée que si les deux chambres sont sur la clé.` : "Pas de chambre communicante."} EF-ACC-027</p></div>
        </div>
        <p class="muted">Accompagnant enfant : ni minibar, ni bar, ni salon exécutif. Une clé par personne, droits propres (EF-ACC-004).</p>
        <div id="acc-err"></div>
        ${encodingMsg ? `<div style="margin-top:10px">${esc(encodingMsg)}</div><div class="bar"><i></i></div>` : `<div class="row" style="margin-top:12px">
          ${btn("Dupliquer (garde les clés existantes)", `A.acc.issue(${q(r.id)}, 'duplicate')`)}
          ${btn("Nouvelle clé (annule les précédentes)", `A.acc.issue(${q(r.id)}, 'new')`, "ghost")}
          ${btn("Envoyer une clé mobile", `A.acc.mobile(${q(r.id)})`, "ghost")}</div>`}
        <p class="muted">${active} clé(s) active(s) sur ${MAX_KEYS} autorisées sans validation (RG-FOF-03). Duplicata : même n° de séquence, les clés existantes restent valides ; nouvelle clé : séquence + 1, les précédentes sont annulées (EF-ACC-003). Aucun succès affiché sans accusé du matériel ; 3 tentatives puis échec signalé (RG-ACC-10). Émission en une action (EF-ACC-001). Perte : invalidation immédiate en ligne, par n° de séquence hors ligne, journal et alerte (EF-ACC-009).</p>
`)}
        ${section("Droits aux espaces communs", `<div class="form">${field("acc-pkg", "Forfait acheté (RAT / SPA)", select("acc-pkg", [["", "Aucun"], ...((D.rat && D.rat.packages) || []).map((k) => [k.code, k.name])], C.pkgs[r.id] || "", `onchange="A.acc.setPkg(${q(r.id)}, this.value)"`))}
          ${field("acc-tier", "Niveau de fidélité (CRM)", `<input id="acc-tier" value="${esc(tierOf(r))}" disabled>`)}${field("acc-cat", "Catégorie", `<input id="acc-cat" value="${esc(T(r.type).label)}" disabled>`)}</div>
        ${tbl(["Espace", "Horaires", "Droit", "Motif"], rights(r).map((a) => [esc(a.name), esc(a.hours.join("–")), a.ok ? badge("Autorisé", "ok") : badge("Refusé", "bad"), ref(a.why)]))}
        <p class="muted">Calculés selon la catégorie, le niveau de fidélité (CRM), le forfait (RAT/SPA) et les horaires ; recalculés à chaque changement (RG-ACC-07) et poussés aux serrures en ligne. EF-ACC-011</p>
`)}
        ${section("Événements de séjour reçus", `${tbl(["Horodatage", "Identifiant", "Événement", "Effet"], stayEv.map((e) => [esc(e.at.slice(11)) + ` ${ref(fd(e.at.slice(0, 10)))}`, esc(e.cred), esc(e.detail.split(" ")[0]), esc(e.type + " · " + e.result)]), "Aucun événement fof.stay.* pour ce séjour.")}
        <p class="muted">fof.stay.checked-in : carte associée et clé mobile émise automatiquement ${C.mobileAuto ? "(activé)" : "(désactivé)"} ${btn(C.mobileAuto ? "Désactiver" : "Activer", "D.acc.mobileAuto=!D.acc.mobileAuto;render()", "ghost sm")} (EF-ACC-005). fof.stay.extended : prolongation à distance en ligne, réencodage signalé hors ligne (EF-ACC-006). fof.stay.room-moved : ancienne chambre révoquée, nouvelle attribuée (EF-ACC-007). fof.stay.checked-out : tous les identifiants révoqués (EF-ACC-008). ${btn("Prolonger / changer de chambre", "go('sej-mouv/chambre')", "ghost sm")}</p>
`)}
        ${mob.length ? section("Clé mobile dans l'application client", `<div class="row" style="align-items:flex-start">${phone(mob.map((c) => `<div class="card" style="margin-bottom:8px"><strong>Chambre ${esc(roomsOf(c).join(" + "))}</strong><div class="muted">${esc(c.id)} · jusqu'au ${esc(c.to.slice(8, 10) + "/" + c.to.slice(5, 7) + " " + c.to.slice(11))}</div>
          ${c.status === "active" ? `<div style="margin-top:8px">${btn("Approcher le téléphone (BLE/NFC)", `A.acc.tap(${q(c.id)})`, "sm")}</div>` : `<div style="margin-top:8px">${badge(c.status === "révoquée" ? "Clé révoquée à distance" : c.status, "bad")}</div>`}</div>`).join(""), "Application client")}
          <p class="muted" style="max-width:280px">Clé émise via le SDK du fabricant (simulé), ouverture en BLE ou NFC. « Révoquer » la retire à distance du téléphone, immédiatement. EF-ACC-010</p></div>`) : ""}
      </div>`)
      + `<div class="dash" style="margin-top:16px">
          <div class="w4">${section("Identifiants par statut", donut(countBy(C.creds, (c) => c.status), { fmt: (v) => v, center: String(C.creds.length), sub: "identifiants" }))}</div>
          <div class="w4">${section("Cartes et clés mobiles", donut([{ label: "Cartes", value: C.creds.filter((c) => c.type === "carte" && c.status === "active").length }, { label: "Clés mobiles", value: C.creds.filter((c) => c.type === "mobile" && c.status === "active").length }], { fmt: (v) => v, center: String(C.creds.filter((c) => c.status === "active").length), sub: "actives" }))}</div>
          <div class="w4">${section("Encodages réussis par encodeur", bars(C.encoders.map((e) => ({ label: e.id, value: e.ok })), (v) => v.toLocaleString("fr-FR")))}</div>
        </div>`
  }
  const pairOf = (no) => { const l = C.locks.find((x) => x.pair && x.pair.includes(no)); return l ? l.pair.find((x) => x !== no) : null }
  const connects = (rooms) => C.locks.filter((l) => l.pair && l.pair.every((no) => rooms.includes(no)))

  // ---------- Passes et personnel ----------
  function passesTab() {
    return `${roleBar()}<div class="cols"><section><h2>Passes (master keys)</h2>
      ${tbl(["Réf.", "Type", "Titulaire", "Validité", "Demandé par", "Statut", ""], C.passes.map((x) => [esc(x.id), esc(x.type), esc(x.holder), `${fd(x.from)} → ${fd(x.to)}${x.hours ? " · " + esc(x.hours) : ""}`, esc(x.by) + (x.validatedBy ? `<div class="muted">validé : ${esc(x.validatedBy)}</div>` : ""),
        badge(x.status, x.status === "active" ? "ok" : x.status === "à valider" ? "warn" : "outline"),
        x.status === "à valider" ? btn("Valider (2e personne)", `A.acc.validatePass(${q(x.id)})`, "sm") : x.status === "active" ? btn("Révoquer", `A.acc.revokePass(${q(x.id)})`, "ghost sm") : x.status === "sous scellés" ? btn("Briser les scellés", `A.acc.breakSeal(${q(x.id)})`, "ghost sm") : ""]))}
      ${card("Demander un passe", form([field("ps-type", "Type", select("ps-type", ["Passe d'étage 1", "Passe d'étage 2", "Passe d'étage 3", "Passe de service", "Passe général"], "Passe d'étage 1")),
        field("ps-holder", "Titulaire", select("ps-holder", C.staff.map((s) => [`${s.name} (${s.role.toLowerCase()})`, `${s.name} · ${s.role}`]), "")),
        field("ps-days", "Durée (jours)", input("ps-days", "1", 'type="number" min="1" max="90"')), `<div class="full" id="ps-err"></div>`,
        `<div class="full">${btn("Soumettre à validation", "A.acc.requestPass()", "ghost")}</div>`]) + `<p class="muted">Attribution nominative, durée limitée et double validation (EF-ACC-014). Un passe général exige le rôle Responsable sécurité.</p>`, 'style="margin-top:14px"')}</section>
      <section><h2>Badges du personnel</h2>
      ${tbl(["Badge", "Employé", "Profil", "Poste", "Dernier usage", "Statut", ""], C.staff.map((s) => [esc(s.id), esc(s.name), esc(`${s.role} · ${s.zone}`), esc(s.shift), fd(s.last), badge(s.status, s.status === "actif" ? "ok" : /30 j/.test(s.status) ? "warn" : "outline"),
        /révoqué/.test(s.status) ? "" : `<span class="row" style="flex-wrap:nowrap">${s.status === "actif" ? btn("Fin de poste", `A.acc.shift(${q(s.id)}, false)`, "ghost sm") : btn(/30 j/.test(s.status) ? "Réactiver (validation)" : "Début de poste", `A.acc.shift(${q(s.id)}, true)`, "ghost sm")}${btn("Départ", `A.acc.terminate(${q(s.id)})`, "ghost sm")}</span>`]))}
      <p class="muted">Activation au pointage et suspension en fin de poste (hrm.shift.started / ended), révocation définitive au départ (hrm.employee.terminated), événements RH simulés — EF-ACC-013. Badge inutilisé 30 jours suspendu automatiquement (RG-ACC-08). ${btn("Appliquer la règle des 30 jours", "A.acc.idleRule()", "ghost sm")}</p>
      <h3>Profils d'accès</h3>${tbl(["Profil", "Poste RH", "Portes et zones", "Plages", "Jours", "Mode intimité"], C.profiles.map((x) => { const n = ((D.hrm && D.hrm.emps) || []).filter((e) => e.job === x.post).length; return [esc(x.role), esc(x.post) + ` ${ref(n + " employé(s) RH")}`, esc(x.doors.map(doorLabel).join(", ")), esc(`Poste ± ${x.margin} min`), esc(x.days), esc(x.privacy)] }))}
      ${profileEditor()}</section></div>`
  }
  function profileEditor() {
    const p = C.profiles.find((x) => x.role === ui.accProf) || C.profiles[0]
    const opts = [...Object.keys(DOOR_TOKENS), ...C.locks.filter((l) => !l.room && !l.pair).map((l) => l.id)]
    return card(`Modifier le profil « ${p.role} »`, `${form([field("pf-role", "Profil", select("pf-role", C.profiles.map((x) => x.role), p.role, `onchange="ui.accProf=this.value;render()"`)),
        field("pf-days", "Jours", select("pf-days", Object.keys(DAYS), p.days)), field("pf-margin", "Marge autour du poste (min)", input("pf-margin", String(p.margin), 'type="number" min="0" max="120"')),
        `<div class="full"><label>Portes et zones</label><div class="row">${opts.map((d) => `<label class="row" style="color:var(--ink);margin:0"><input type="checkbox" id="pf-${esc(d)}" ${p.doors.includes(d) ? "checked" : ""}> ${esc(doorLabel(d))}</label>`).join("")}</div></div>`,
        `<div class="full" id="pf-err"></div>`, `<div class="full">${btn("Enregistrer le profil", `A.acc.saveProfile(${q(p.role)})`)}</div>`])}
      <p class="muted">Zones, portes, plages horaires et jours par poste RH ; vérifiés à chaque présentation de badge (onglet « Tester un accès »). EF-ACC-012</p>`, 'style="margin-top:14px"')
  }

  // ---------- Simulateur d'accès ----------
  function simTab() {
    const creds = C.creds.filter((c) => c.status !== "échec")
    const who = [...creds.map((c) => [c.id, `${label(c)} · ch. ${roomsOf(c).join("+")} · ${HOLDERS[c.holder] || ""} · ${c.status}`]), ...C.staff.map((s) => [s.id, `Badge ${s.id} · ${s.name} · ${s.role} · ${s.status}`])]
    return `<div class="cols"><section>${card("Présenter un identifiant à une porte", `${form([field("sim-who", "Carte, clé mobile ou badge", select("sim-who", who, ui.accSimWho || who[0]?.[0])),
        field("sim-door", "Porte", select("sim-door", C.locks.map((l) => [l.id, `${l.door} · ${l.kind}`]), ui.accSimDoor || "L-PISC")), field("sim-time", "Heure", input("sim-time", ui.accSimTime || nowT(), 'type="time"')),
        `<div class="full" id="sim-err"></div>`, `<div class="full">${btn("Présenter", "A.acc.present()")}</div>`])}
      <p class="muted">La serrure applique : validité (RG-ACC-01), chambres encodées et clés partagées (EF-ACC-027), porte communicante, espaces et horaires (EF-ACC-011), restrictions enfant (EF-ACC-004), n° de séquence des serrures autonomes (EF-ACC-009), profils du personnel et poste en cours (EF-ACC-012, EF-ACC-013), mode intimité (RG-ACC-06), lockdown. Chaque essai est journalisé.</p>`)}</section>
      <section><h2>Derniers essais</h2>${tbl(["Heure", "Identifiant", "Porte", "Résultat", "Motif"], C.sims.map((x) => [esc(x.t), esc(x.who), esc(x.door), x.ok ? badge("Accordé", "ok") : badge("Refusé", "bad"), ref(x.why)]), "Aucun essai.")}</section></div>`
  }

  // ---------- Lecture de carte et stock ----------
  function readTab() {
    const cards = C.creds.filter((c) => c.type === "carte")
    const last = C.reads[0]
    const inUse = cards.filter((c) => c.status === "active").length
    return `<div class="cols"><section>${card("Lire une carte posée sur l'encodeur", `${form([field("rd-card", "Carte présentée (simulation)", select("rd-card", [["", "Carte vierge"], ...cards.map((c) => [c.id, `${c.id} · ch. ${c.room} · ${c.status}`])], "")),
        field("rd-enc", "Encodeur", select("rd-enc", C.encoders.map((e) => [e.id, `${e.id} · ${e.post}`]), C.enc)), `<div class="full">${btn("Lire la carte", "A.acc.read()")}</div>`])}
      ${last ? `<div class="card" style="margin-top:12px">${last}</div>` : ""}<p class="muted">EF-ACC-022 : chambre, validité et titulaire lus sur la carte.</p>`)}</section>
      <section class="stack"><div class="grid g4">${stat({ label: "Cartes vierges", value: String(C.cards.blank), icon: "layers", hint: "en stock" })}${stat({ label: "En circulation", value: String(inUse), icon: "key", hint: "cartes actives" })}${stat({ label: "À recycler", value: String(C.cards.recycle), icon: "refresh", hint: "retournées au check-out" })}${stat({ label: "Non restituées", value: String(C.cards.lost), icon: "alert", hint: `coût ${money(C.cards.lost * CARD_COST)}` })}</div>
        ${section("Stock de cartes", donut(cardsLine(), { fmt: (v) => v, center: String(sum(cardsLine(), (x) => x.value)), sub: "cartes" })
          + `<div class="row" style="margin-top:12px">${btn("Recycler les cartes retournées", "A.acc.recycle()", "ghost")}${btn("Facturer une carte non restituée", "A.acc.billCard()", "ghost")}</div>
        <p class="muted">${C.cards.billed} carte(s) non restituée(s) facturée(s) ce mois (EF-ACC-026). Seuil de réapprovisionnement : 100 cartes.</p>`)}</section></div>`
  }

  // ---------- Passerelle et encodeurs ----------
  function gatewayTab() {
    const g = C.gateway, certDays = nights(today, g.cert)
    const issues = supervisionIssues()
    const lockMix = [{ label: "En ligne, joignables", value: C.locks.filter((l) => l.kind === "en ligne" && !l.offline).length }, { label: "Autonomes (hors ligne)", value: C.locks.filter((l) => l.kind !== "en ligne" && !l.offline).length }, { label: "Injoignables", value: offline().length }]
    return `<div class="dash"><div class="w8">${section(`Passerelle edge ${g.id}`, `<div class="row between"><strong>${g.cloud ? "Connectée au cloud" : "Autonome (hors ligne)"}</strong>${badge(g.cloud ? "En ligne" : "Mode dégradé", g.cloud ? "ok" : "bad")}</div>
        ${tbl(["Élément", "Valeur"], [["Version de l'agent", esc(g.version)], ["Dernier battement", esc(g.cloud ? g.beat : "— (liaison coupée)")], ["Liaison", "Sortante uniquement, TLS 1.3 + mTLS"],
          ["Certificat", `${esc(g.certFp)} · expire le ${fd(g.cert)} (J-${certDays})${certDays <= 10 ? " " + badge("Renouvellement auto", "info") : ""}`], ["Haute disponibilité", g.ha ? "Passerelle secondaire active" : "Non (passerelle unique)"],
          ["Adaptateur", esc(g.adapter)], ["Capacités", esc(g.caps.join(", "))], ["File locale", `${g.queue.length} événement(s)`]])}
        <div class="row" style="margin-top:12px">${g.cloud ? btn("Simuler une coupure Internet", "A.acc.cloud(false)", "ghost") : btn("Rétablir la connexion et resynchroniser", "A.acc.cloud(true)", "accent")}${btn("Renouveler le certificat", "A.acc.renewCert()", "ghost")}</div>`)}</div>
      <div class="w4">${section("Parc de serrures", donut(lockMix, { fmt: (v) => v, center: String(C.locks.length), sub: "serrures" }), btn("Voir le parc", "go('acc-materiel/serrures')", "ghost sm"))}</div>
      <div class="w6">${section("Supervision du parc", `${tbl(["Élément", "Contrôle", "Constat"], issues.map((x) => [esc(x.what), esc(x.check), badge(x.text, "warn")]), "Aucune anomalie.")}
        <p class="muted">${issues.length} anomalie(s) : connectivité, version, batterie et certificats de la passerelle, des encodeurs et des serrures. ${btn("Lancer la supervision et alerter", "A.acc.supervise()", "ghost sm")} EF-ACC-025</p>`)}</div>
      <div class="w6">${section("Encodeurs", `${tbl(["Encodeur", "Poste", "#Temps moyen", "#Réussis", "#Échecs", "Statut", ""], C.encoders.map((e) => [esc(e.id), esc(e.post), (sum(e.ms) / e.ms.length / 1000).toFixed(1) + " s", e.ok, e.fail, badge(e.status, e.status === "prêt" ? "ok" : "bad"),
        btn(e.status === "prêt" ? "Simuler une panne" : "Remettre en service", `A.acc.toggleEnc(${q(e.id)})`, "ghost sm")]))}
        <p class="muted">En cas de panne, un autre encodeur prêt du même établissement est proposé automatiquement.</p>
        <h3>Temps moyen d'encodage (objectif &lt; 3 s)</h3>${bars(C.encoders.map((e) => ({ label: e.id, value: Math.round(sum(e.ms) / e.ms.length) })), (v) => (v / 1000).toFixed(1).replace(".", ",") + " s")}
        ${g.queue.length ? `<h3>File locale (en attente de resynchronisation)</h3>${tbl(["Horodatage", "Événement"], g.queue.map((x) => [esc(x.at), esc(x.text)]))}` : ""}`)}</div></div>`
  }

  function supervisionIssues() {
    const g = C.gateway, out = [], certDays = nights(today, g.cert)
    if (!g.cloud) out.push({ what: "Passerelle " + g.id, check: "Connectivité", text: "liaison cloud perdue", type: "Passerelle hors ligne", door: g.id })
    if (g.version < GW_LATEST) out.push({ what: "Passerelle " + g.id, check: "Version", text: `agent ${g.version} (${GW_LATEST} disponible)`, type: "Version obsolète", door: g.id })
    if (certDays <= 10) out.push({ what: "Passerelle " + g.id, check: "Certificat", text: `expire dans ${certDays} j`, type: "Certificat à renouveler", door: g.id })
    C.encoders.filter((e) => e.status !== "prêt").forEach((e) => out.push({ what: e.id + " · " + e.post, check: "Connectivité", text: e.status, type: "Encodeur hors service", door: e.id }))
    offline().forEach((l) => out.push({ what: l.door, check: "Connectivité", text: "injoignable", type: "Serrure hors ligne", door: l.door }))
    lowBat().forEach((l) => out.push({ what: l.door, check: "Batterie", text: l.battery + " %", type: "Batterie faible", door: l.door }))
    const old = C.locks.filter((l) => l.fw < FW_LATEST)
    if (old.length) out.push({ what: `${old.length} serrure(s)`, check: "Firmware", text: `${old[0].fw} (${FW_LATEST} disponible)`, type: "Firmware obsolète", door: `${old.length} serrures` })
    return out
  }

  // ---------- Parc de serrures ----------
  function locksTab() {
    const f = ui.accLockF || "toutes"
    ui.accLockF = f
    const list = C.locks.filter((l) => f === "toutes" || (f === "alerte" ? l.offline || (l.battery != null && l.battery < 20) : f === "ligne" ? l.kind === "en ligne" : l.kind === "hors ligne"))
    const bat = C.locks.filter((l) => l.battery != null).sort((a, b) => a.battery - b.battery).slice(0, 12)
    return `<div class="dash" style="margin-bottom:16px"><div class="w8">${section("Batteries les plus faibles", columns(bat.map((l) => l.door.replace("Ch. ", "")), bat.map((l) => l.battery), (v) => v + " %"))}</div>
      <div class="w4">${section("Firmware", donut(countBy(C.locks.filter((l) => l.fw), (l) => l.fw < FW_LATEST ? `${l.fw} (à mettre à jour)` : `${l.fw} (à jour)`), { fmt: (v) => v, center: FW_LATEST, sub: "dernière version" }))}</div></div>
      ${roleBar()}${chips("accLockF", { toutes: "Toutes", alerte: "En alerte", ligne: "En ligne", horsligne: "Hors ligne (autonomes)" }, { toutes: C.locks.length, alerte: lowBat().length + offline().length })}
      ${tbl(["Porte", "Zone", "Type", "État", "#Batterie", "Firmware", "Dernier contact", ""], list.map((l) => [esc(l.door) + (l.dnd ? " " + badge("Ne pas déranger", "outline") : "") + (occupied(l) ? ` ${ref("occupée")}` : ""), esc(l.zone), esc(l.kind),
        l.offline ? badge("Injoignable", "bad") : esc(l.state) + (l.doorOpen ? ` ${badge("porte ouverte", "warn")}` : ""), l.battery == null ? "secteur" : l.battery < 20 ? `<strong>${l.battery} %</strong>` : l.battery + " %", esc(l.fw) + (l.fw < "4.2.0" && l.kind !== "en ligne" ? ` ${ref("maj dispo")}` : ""), esc(l.last.slice(11) ? fd(l.last.slice(0, 10)) + " " + l.last.slice(11) : l.last),
        l.kind === "en ligne" ? `<span class="row" style="flex-wrap:nowrap">${btn("Ouvrir", `A.acc.command(${q(l.id)}, 'open')`, "ghost sm")}${btn("Verrouiller", `A.acc.command(${q(l.id)}, 'lock')`, "ghost sm")}${l.room ? "" : btn(l.state === "mode bureau" ? "Fin mode bureau" : "Mode bureau", `A.acc.command(${q(l.id)}, 'office')`, "ghost sm")}${btn("État", `A.acc.command(${q(l.id)}, 'status')`, "ghost sm")}</span>`
        : btn("Collecter le journal", `A.acc.collect(${q(l.id)})`, "ghost sm")]))}
      <div id="cmd-err"></div>
      <p class="muted">Ouvrir à distance une chambre occupée exige un motif et le rôle Agent / Responsable sécurité ou Duty manager (RG-ACC-04). Les serrures hors ligne remontent leur journal via lecteur de collecte (EF-ACC-020). « Ne pas déranger » transmis au housekeeping (EF-ACC-018). Commandes à distance des serrures en ligne : ouvrir, verrouiller, mode bureau (passage libre), état (verrouillage, porte, batterie), succès affiché seulement sur accusé matériel — EF-ACC-015.</p>`
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
    return `<div class="dash"><div class="w12">${section(`Alarmes (${pending().length} ouverte(s))`, `${tbl(["Horodatage", "Type", "Porte", "Détail", "Statut", ""], list.map((a) => [esc(a.at.slice(11) ? fd(a.at.slice(0, 10)) + " " + a.at.slice(11) : a.at), esc(a.type), esc(a.door), esc(a.detail),
        badge(a.status, a.status === "ouverte" ? "bad" : "ok") + (a.by ? ` ${ref(`${a.by} · ${a.delay} min`)}` : ""),
        a.status === "ouverte" ? `<span class="row" style="flex-wrap:nowrap">${btn("Acquitter", `A.acc.ack(${q(a.id)})`, "sm")}${/Batterie|hors ligne/i.test(a.type) ? btn("Ordre de travail", `A.acc.workOrder(${q(a.door)}, ${q(a.type)})`, "ghost sm") : ""}</span>` : ""]))}
      <p class="muted">Flux temps réel (WebSocket simulé) : porte forcée ou restée ouverte, refus répétés, batterie faible, serrure hors ligne, sabotage (EF-ACC-017).</p>`, btn("Simuler une alarme", "A.acc.simAlarm()", "ghost sm"))}</div>
      <div class="w6">${section("Alarmes par type", donut(countBy(C.alarms, (a) => a.type), { fmt: (v) => v, center: String(C.alarms.length), sub: "alarmes" }))}</div>
        <div class="w6">${section("Ouvertes par heure de déclenchement", columns(["0-6 h", "6-12 h", "12-18 h", "18-24 h"], [0, 6, 12, 18].map((h) => pending().filter((a) => { const x = Number(a.at.slice(11, 13)); return x >= h && x < h + 6 }).length), (v) => v))}</div>
      ${C.workOrders.length ? `<div class="w12">${section("Ordres de travail créés (maintenance)", tbl(["Réf.", "Porte", "Motif", "Créé"], C.workOrders.map((w) => [esc(w.id), esc(w.door), esc(w.reason), esc(w.at)])))}</div>` : ""}</div>`
  }

  // ---------- Journal ----------
  function journalTab() {
    const doors = [...new Set(C.events.map((e) => e.door))].sort()
    const f = ui.accDoor || ""
    const list = C.events.filter((e) => !f || e.door === f)
    const qr = ui.accQuery
    return `<div class="stack"><section><div class="row"><label for="acc-door" style="margin:0">Porte</label><select id="acc-door" style="max-width:220px" onchange="ui.accDoor=this.value;render()"><option value="">Toutes</option>${doors.map((d) => `<option ${d === f ? "selected" : ""}>${esc(d)}</option>`).join("")}</select></div>
      <div style="margin-top:10px">${tbl(["Horodatage", "Porte", "Identifiant", "Événement", "Résultat", "Détail", "Empreinte"], list.map((e) => [esc(e.at.slice(11)) + ` ${ref(fd(e.at.slice(0, 10)))}`, esc(e.door), esc(e.cred), esc(e.type), e.result === "refusée" ? badge("refusée", "bad") : esc(e.result), ref(e.detail), `<code>${esc(e.hash)}</code>`]))}</div>
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
        ${tbl(["Serrure", "Accusé", "Délai"], e.results.map((x) => [esc(x.door), x.ok ? badge("Confirmé", "ok") : badge("Non confirmé", "bad"), x.ok ? (x.ms / 1000).toFixed(1) + " s" : ref(x.why)]))}
        <p class="muted">${e.results.filter((x) => !x.ok).length} serrure(s) non confirmée(s) : intervention physique requise.</p>
        <div class="form">${field("em-second2", "Second valideur pour la levée", select("em-second2", ["", "Arsène Gbané (responsable sécurité)", "Kouamé Ahoua (duty manager)", "Jean-Marc Tanoh (directeur d'exploitation)"], ""))}<div style="align-self:end">${btn("Lever l'action d'urgence", "A.acc.release()", "accent")}</div></div><div id="em-err"></div>`
      : form([field("em-kind", "Action", select("em-kind", ["Lockdown", "Ouverture d'urgence (évacuation)"], (ui.accEm || {}).kind || "Lockdown")),
          field("em-zone", "Zone", select("em-zone", ["Étage 1", "Étage 2", "Étage 3", "Espaces communs", "Établissement"], (ui.accEm || {}).zone || "Étage 2")),
          field("em-reason", "Motif", input("em-reason", (ui.accEm || {}).reason || "", 'placeholder="Ex. intrusion signalée aile étage 2"')),
          field("em-second", "Second valideur (quatre yeux)", select("em-second", ["", "Arsène Gbané (responsable sécurité)", "Kouamé Ahoua (duty manager)", "Jean-Marc Tanoh (directeur d'exploitation)"], (ui.accEm || {}).second || "")),
          field("em-otp", "Code à usage unique du second valideur", input("em-otp", "", 'inputmode="numeric" placeholder="6 chiffres"')),
          `<div class="full">${C.emOtp ? ref(`Code envoyé à ${C.emOtp.to} à ${C.emOtp.at} (simulé : ${C.emOtp.code})`) : ref("Envoyez d'abord un code au second valideur.")}</div>`,
          `<div class="full" id="em-err"></div>`, `<div class="full row">${btn("Envoyer le code au second valideur", "A.acc.sendOtp()", "ghost")}${btn("Déclencher", "A.acc.emergency()")}</div>`]))}
        <p class="muted">Double authentification : rôle habilité de l'initiateur + code à usage unique du second valideur ; zone ou établissement entier ; tout est tracé au journal immuable. EF-ACC-016</p></section>
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
      ${tbl(["Heure", "Badge", "Chambre", "Tâche planifiée"], staffEntries.map((e) => { const no = e.door.replace("Ch. ", ""); const s = C.staff.find((x) => e.cred.endsWith(x.id)); const ok = (s && (D.assignments || {})[no] === s.name) || C.workOrders.some((w) => w.door === e.door); return [esc(e.at.slice(11)), esc(holderOf(e.cred)), esc(no), ok ? badge("Justifiée", "ok") : badge("Aucune tâche", "warn")] }), "Aucune entrée du personnel.")}
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
    const encT = sum(ms) / ms.length / 1000, hE = hist(61, 2.4, 0.5, Math.round(encT * 10) / 10), failR = (fail / (ok + fail)) * 100, hF = hist(67, 2, 1.2, Math.round(failR * 10) / 10)
    const mobR = (mob.length / Math.max(1, stays.length)) * 100, hM = hist(71, 40, 18, Math.round(mobR))
    return `<div class="grid g4">
        ${stat({ label: "Temps moyen d'encodage", value: encT.toFixed(1).replace(".", ",") + " s", icon: "clock", delta: dlt(hE), good: false, hint: "objectif < 3 s · vs hier", trend: hE })}
        ${stat({ label: "Taux d'échec d'encodage", value: pct(failR), icon: "alert", delta: dlt(hF), good: false, hint: `${fail} échecs / ${ok + fail} tentatives`, trend: hF })}
        ${stat({ label: "Adoption clé mobile", value: pct(mobR), icon: "phone", delta: dlt(hM), hint: `${mob.length} séjours sur ${stays.length}`, trend: hM })}
        ${stat({ label: "Serrures hors ligne", value: String(offline().length), icon: "lock", hint: "temps réel", route: "acc-materiel/serrures" })}
        ${stat({ label: "Batterie faible", value: String(lowBat().length), icon: "zap", hint: "< 20 %", route: "acc-materiel/serrures" })}
        ${stat({ label: "Cartes non restituées", value: String(C.cards.lost), icon: "layers", hint: money(C.cards.lost * CARD_COST) })}
        ${stat({ label: "Délai moyen de traitement", value: (done.length ? Math.round(sum(done, (a) => a.delay) / done.length) : 0) + " min", icon: "bell", hint: `${done.length} alarme(s) traitée(s)` })}</div>
      <div class="dash" style="margin-top:16px">
        <div class="w8">${section("Temps moyen d'encodage sur 14 jours (exemple)", lineChart(hE.map((_, i) => fd(addDays(today, i - 13))), [{ name: "Temps moyen (s)", values: hE }], { fmt: (v) => v.toFixed(1).replace(".", ",") + " s" }))}</div>
        <div class="w4">${section("Alarmes par type", donut(Object.entries(byType).map(([label, value]) => ({ label, value })), { fmt: (v) => v, center: String(C.alarms.length), sub: "alarmes" }))}</div>
        <div class="w6">${section("Accès refusés par porte et motif", Object.keys(denied).length ? bars(Object.entries(denied).map(([label, value]) => ({ label, value }))) : `<p class="muted">Aucun refus.</p>`)}</div>
        <div class="w6">${section("Temps moyen par encodeur", bars(C.encoders.map((e) => ({ label: `${e.id} · ${e.post}`, value: Math.round(sum(e.ms) / e.ms.length) })), (v) => (v / 1000).toFixed(1) + " s"))}</div>
      </div>
      <p class="muted">§10.12 — calculé sur les données d'exemple ; historiques sur 14 jours : exemple.</p>`
  }

  // ---------- Actions ----------
  const canSecurity = () => ["Agent de sécurité", "Responsable sécurité", "Duty manager"].includes(C.role)
  const encodeCards = (r, n, mode, done, opts = {}) => {
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
      const extra = { encoder: enc.id, holder: opts.holder || "principal", ...(opts.rooms && opts.rooms.length ? { rooms: [r.room, ...opts.rooms] } : {}) }
      let seqNew = null
      for (let i = 0; i < n; i++) {
        const c = mkCred(r, "carte", extra)
        if (mode === "duplicate") c.seq = C.seq[r.room] = Math.max(1, C.seq[r.room] - 1) // duplicata : même séquence
        else if (seqNew) c.seq = C.seq[r.room] = seqNew // les cartes d'une même « nouvelle clé » partagent la séquence
        seqNew = c.seq
        enc.ok += 1
        enc.ms.push(1800 + Math.floor(Math.random() * 900))
        ev("Ch. " + roomsOf(c).join("+"), "Carte " + c.id, "encodage", "accusé matériel", `${mode === "new" ? "nouvelle clé" : "duplicata"} · séq. ${c.seq} · ${HOLDERS[c.holder]}${roomsOf(c).length > 1 ? " · clé partagée" : ""}`)
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
      const holder = val("acc-holder") || "principal"
      const rooms = inHouse().filter((x) => x.id !== r.id && document.getElementById("acc-sh-" + x.room)?.checked).map((x) => x.room)
      if (rooms.length && !confirm(`Les chambres ${rooms.join(", ")} seront aussi ouvertes par cette clé. Confirmer la clé partagée ?`)) return
      encodeCards(r, n, mode, null, { holder, rooms })
    },
    setPkg(resId, code) {
      if (code) C.pkgs[resId] = code; else delete C.pkgs[resId]
      toast(code ? "Forfait enregistré : droits recalculés (RG-ACC-07)" : "Forfait retiré : droits recalculés (RG-ACC-07)")
      render()
    },
    tap(cid) {
      const c = C.creds.find((x) => x.id === cid), l = lockOf(c.room)
      const [ok, why] = decide(cid, l, nowT())
      ev(l.door, label(c), "ouverture", ok ? "accordée" : "refusée", `BLE · ${why}`)
      toast(ok ? `${l.door} ouverte (clé mobile)` : `Refus : ${why}`)
      render()
    },
    present() {
      const who = val("sim-who"), l = C.locks.find((x) => x.id === val("sim-door")), t = val("sim-time") || nowT()
      if (!who || !l) return err("sim-err", "Choisissez un identifiant et une porte.")
      const [ok, why] = decide(who, l, t)
      const credLabel = C.staff.some((x) => x.id === who) ? "Badge " + who : label(C.creds.find((x) => x.id === who))
      ev(l.door, credLabel, "ouverture", ok ? "accordée" : "refusée", `${why} · essai ${t}`)
      C.sims.unshift({ t, who: credLabel, door: l.door, ok, why })
      C.sims = C.sims.slice(0, 8)
      ui.accSimWho = who; ui.accSimDoor = l.id; ui.accSimTime = t
      toast(ok ? `Accès accordé : ${l.door}` : `Accès refusé : ${why}`)
      render()
    },
    saveProfile(role) {
      const p = C.profiles.find((x) => x.role === role)
      const doors = [...Object.keys(DOOR_TOKENS), ...C.locks.filter((l) => !l.room && !l.pair).map((l) => l.id)].filter((d) => document.getElementById("pf-" + d)?.checked)
      if (!doors.length) return err("pf-err", "Au moins une porte ou zone.")
      Object.assign(p, { doors, margin: Math.max(0, Number(val("pf-margin")) || 0), days: val("pf-days") })
      ev("—", "Profil " + p.role, "modification du profil d'accès", "enregistrée", `${doors.length} porte(s)/zone(s) · ${p.days} · marge ${p.margin} min · ${C.role}`)
      toast(`Profil ${p.role} enregistré, appliqué aux badges du poste`)
      render()
    },
    terminate(id) {
      const s = C.staff.find((x) => x.id === id)
      if (!confirm(`Départ de ${s.name} (hrm.employee.terminated) : révoquer définitivement le badge ?`)) return
      s.status = "révoqué (départ)"
      C.passes.filter((x) => x.holder.startsWith(s.name) && x.status === "active").forEach((x) => { x.status = "révoquée" })
      ev("—", "Badge " + s.id, "révocation", "badge révoqué", `hrm.employee.terminated · ${s.name}`)
      toast(`Badge de ${s.name} révoqué et passes retirés`)
      render()
    },
    idleRule() {
      const lim = addDays(today, -30)
      const hit = C.staff.filter((x) => x.last < lim && !/30 j|révoqué/.test(x.status))
      hit.forEach((x) => { x.status = "suspendu (30 j sans usage)"; ev("—", "Badge " + x.id, "suspension", "automatique", "RG-ACC-08 · 30 jours sans usage") })
      toast(hit.length ? `${hit.length} badge(s) suspendu(s)` : "Aucun badge inutilisé depuis 30 jours à suspendre")
      render()
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
      ev("Ch. " + c.room, label(c), "révocation", c.type === "mobile" ? "révocation à distance (SDK fabricant)" : "accusée", USER)
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
      C.reads.unshift(c ? `<strong>${esc(c.id)}</strong> · chambre ${esc(c.room)} · séq. ${c.seq ?? "—"} · valide jusqu'au ${esc(c.to)} · titulaire ${esc(gname(R(c.resId)))} (${esc(HOLDERS[c.holder] || HOLDERS.principal)}) · chambres ${esc(roomsOf(c).join(" + "))} · espaces ${esc((c.areas || []).join(", "))} · ${credBadge(c.status)}`
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
    supervise() {
      const list = supervisionIssues()
      let n = 0
      list.forEach((x) => { if (!C.alarms.some((a) => a.status === "ouverte" && a.type === x.type && a.door === x.door)) { C.alarms.unshift({ id: uid("AL"), at: `${today} ${nowT()}`, type: x.type, door: x.door, detail: `Supervision : ${x.check.toLowerCase()} — ${x.text}`, status: "ouverte" }); n++ } })
      ev("Passerelle " + C.gateway.id, "Supervision", "contrôle du parc", `${list.length} anomalie(s)`, `${n} nouvelle(s) alerte(s)`)
      toast(`${list.length} anomalie(s), ${n} nouvelle(s) alerte(s) créée(s)`)
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
          if (cmd === "open") l.state = "déverrouillée (ouverture à distance)"
          if (cmd === "lock") { if (l.doorOpen) { ev(l.door, "Commande à distance", "verrouillage", "refusé", "porte ouverte : pêne bloqué"); toast(`${l.door} : porte ouverte, verrouillage impossible`); return render() } l.state = "verrouillée" }
          l.last = `${today} ${nowT()}`
          ev(l.door, "Commande à distance", { open: "ouverture à distance", office: "mode bureau", lock: "verrouillage", status: "lecture d'état" }[cmd], "accusé matériel", `${C.role}${l.pendingWhy ? " · " + l.pendingWhy : ""}`)
          l.pendingWhy = null
          toast(`${l.door} : ${cmd === "status" ? `${l.state}, porte ${l.doorOpen ? "ouverte" : "fermée"}, batterie ${l.battery ?? "secteur"}${l.battery != null ? " %" : ""}` : "commande acquittée"}`)
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
      if (!C.emOtp || C.emOtp.to !== second) return err("em-err", "Envoyez un code au second valideur sélectionné.")
      if (val("em-otp") !== C.emOtp.code) { ev(zone, "—", kind.toLowerCase(), "refusé", `code du second valideur invalide · ${C.role}`); return err("em-err", "Code du second valideur invalide : tentative journalisée.") }
      C.emOtp = null
      ui.accEm = null
      runEmergency(kind, zone, reason, `${USER} — ${C.role}`, `${second} (code vérifié)`)
    },
    sendOtp() {
      const second = val("em-second")
      ui.accEm = { kind: val("em-kind"), zone: val("em-zone"), reason: val("em-reason"), second }
      if (!second) return err("em-err", "Choisissez le second valideur.")
      C.emOtp = { to: second, code: String(100000 + Math.floor(Math.random() * 900000)), at: nowT() }
      ev("—", "—", "code second valideur", "envoyé", second)
      toast(`Code envoyé à ${second} (simulé)`)
      render()
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
