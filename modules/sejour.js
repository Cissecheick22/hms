// modules/sejour.js — Compléments séjour et facturation : groupes, liste d'attente, no-shows, walk-in,
// changement de chambre, délogement, plan des chambres, audit de nuit, main courante (codes « sej ») ;
// folios multiples, routage, transferts, paiements, acomptes, remboursements, avoirs, city ledger, caisse (« fol »).
// Spec : §8 Réservations (RES), §9 Réception (FOF), §12 Facturation, folios et paiements (FOL).
// S'appuie sur le cœur partagé (D.reservations, D.extras, D.payments, D.rooms) utilisé par modules/reception.js.
;(() => {
  const USER = "Nadège Assi (réception)"
  const TAXE = 1000 // taxe de séjour par chambre et par nuit (exemple, paramétrable)
  const REFUND_LIMIT = 100000 // seuil de double validation des remboursements (exemple)
  const CASH_GAP_LIMIT = 5000 // écart de caisse au-delà duquel un motif est exigé (exemple)
  const muted = (s) => ` <span class="muted">${esc(s)}</span>`
  const ref = (s) => `<span class="muted">${esc(s)}</span>`
  const nowT = () => new Date().toTimeString().slice(0, 5)
  const sum = (a, f = (x) => x) => a.reduce((s, x) => s + f(x), 0)
  const gname = (r) => (G(r.guest) || { name: "—" }).name
  const newGuest = (name, extra = {}) => {
    let n = D.guests.length + 1
    while (G("G" + n)) n++
    D.guests.push({ id: "G" + n, name, phone: "", email: "", nationality: "", idDoc: "À vérifier au check-in", vip: false, prefs: [], ...extra })
    return "G" + n
  }
  const err = (id, m) => { const e = document.getElementById(id); if (e) e.innerHTML = `<div class="err">${esc(m)}</div>`; return false }

  // Acompte déjà versé pour R-2052 (garantie « Acompte ») : cohérent avec le folio de reception.js
  if (D.payments["R-2052"] == null) D.payments["R-2052"] = 60000

  // ---------- Données d'exemple du module ----------
  D.sej = {
    biz: today, // date hôtelière simulée de ce module (avancée par l'audit de nuit)
    meta: {
      "R-2051": { source: "Direct (téléphone)", segment: "Loisirs", booked: "2026-10-02", mode: "comptoir" },
      "R-2052": { source: "Moteur de réservation", segment: "Loisirs", booked: "2026-11-10", mode: "mobile" },
      "R-2053": { source: "OTA (simulé)", segment: "Affaires", booked: "2026-11-24", mode: "comptoir" },
      "R-2044": { source: "Société", segment: "Affaires", booked: "2026-11-02", mode: "comptoir" },
      "R-2046": { source: "OTA (simulé)", segment: "Loisirs", booked: "2026-11-18", mode: "mobile" },
      "R-2047": { source: "Direct (téléphone)", segment: "Affaires", booked: "2026-11-20", mode: "comptoir" },
      "R-2048": { source: "Société", segment: "Affaires", booked: "2026-11-05", mode: "mobile" },
      "R-2060": { source: "Moteur de réservation", segment: "Loisirs", booked: "2026-11-22" },
      "R-2061": { source: "OTA (simulé)", segment: "Loisirs", booked: "2026-11-25" },
      "R-2012": { source: "Direct (téléphone)", segment: "Loisirs", booked: "2026-08-01", mode: "comptoir" },
      "R-1980": { source: "Société", segment: "Affaires", booked: "2026-06-10", mode: "comptoir" },
    },
    partners: [
      { name: "Hôtel Lagune Exemple (Plateau)", dist: "1,2 km", rate: 50000 },
      { name: "Résidence Cocody Exemple", dist: "3,5 km", rate: 42000 },
    ],
    walks: [{ id: "W-07", date: "2026-11-12", name: "Didier Gnagne", hotel: "Hôtel Lagune Exemple (Plateau)", nights: 1, cost: 55000, comp: "Nuit offerte au prochain séjour" }],
    moves: [{ at: "2026-11-25 18:20", resId: "R-2047", from: "201", to: "202", reason: "Bruit (climatisation)", by: "Konan Yao (réception)" }],
    noshows: [],
    upsells: [{ date: "2026-11-23", resId: "R-2044", label: "Standard → Supérieure", amount: 45000 }],
    groups: [
      { id: "GRP-01", name: "Séminaire Société Ivoirienne Exemple", account: "AC1", from: "2026-12-03", to: "2026-12-05", cutoff: "2026-11-28",
        rate: { STD: 40000, SUP: 52000, SUI: 95000 }, block: { STD: 4, SUP: 2, SUI: 0 }, released: false,
        rooming: [{ name: "Kouadio Aka", type: "STD" }, { name: "Moussa Traoré", type: "STD" }, { name: "Akissi Zadi", type: "SUP" }] },
      { id: "GRP-02", name: "Délégation Transports Lagune Exemple", account: "AC3", from: "2026-12-10", to: "2026-12-13", cutoff: "2026-12-01",
        rate: { STD: 42000, SUP: 55000, SUI: 98000 }, block: { STD: 3, SUP: 0, SUI: 1 }, released: false, rooming: [] },
    ],
    waitlist: [
      { id: "WL-1", name: "Adjoua Koné", contact: "adjoua.kone@exemple.test", type: "SUI", from: "2026-11-27", to: "2026-11-29", prio: "Haute", status: "en attente" },
      { id: "WL-2", name: "Lassina Dosso", contact: "+225 07 00 00 00 19", type: "STD", from: "2026-11-28", to: "2026-11-30", prio: "Normale", status: "en attente" },
      { id: "WL-3", name: "Christelle Tanoh", contact: "christelle.tanoh@exemple.test", type: "SUP", from: "2026-12-03", to: "2026-12-05", prio: "Normale", status: "en attente" },
    ],
    log: [
      { id: "MC-6", at: "2026-11-26 08:05", author: "Moussa Cissé (concierge)", type: "Demande client", room: "203", text: "Taxi pour l'aéroport Félix-Houphouët-Boigny à 14 h.", due: "13:45", status: "ouverte" },
      { id: "MC-5", at: "2026-11-26 07:40", author: "Nadège Assi (réception)", type: "Demande client", room: "302", text: "Repassage de deux chemises avant 11 h.", due: "11:00", status: "ouverte" },
      { id: "MC-4", at: "2026-11-26 06:55", author: "Serge N'Guessan (audit de nuit)", type: "Consigne", room: "204", text: "Chambre hors service (climatisation) : ne pas attribuer, technicien attendu à 10 h.", status: "ouverte" },
      { id: "MC-3", at: "2026-11-25 22:10", author: "Fatou Bamba (réception)", type: "Incident", room: "", text: "Bruit signalé au 2e étage, ronde effectuée, rien à signaler.", status: "traitée", doneMin: 20 },
      { id: "MC-2", at: "2026-11-25 19:30", author: "Moussa Cissé (concierge)", type: "Demande client", room: "202", text: "Table pour deux au restaurant à 20 h.", status: "traitée", doneMin: 12 },
      { id: "MC-1", at: "2026-11-25 15:00", author: "Konan Yao (réception)", type: "Message client", room: "302", text: "Message pour le client de la 302 : rappeler son bureau au Plateau.", status: "traitée", doneMin: 35 },
    ],
    audits: [{ date: "2026-11-25", at: "02:14", by: "Serge N'Guessan (audit de nuit)", noshows: 0, tax: 4000, rooms: 4 }],
    // ---- Facturation (fol) ----
    routing: { "R-2048": { what: "Hébergement", to: "AC1" } },
    transferred: {},
    payLog: [
      { id: "P-1001", at: "2026-11-23 15:12", resId: "R-2044", mode: "Carte (jeton PSP)", amount: 60000, status: "confirmé", by: "Konan Yao (réception)", note: "Pré-autorisation capturée" },
      { id: "P-1002", at: "2026-11-24 13:40", resId: "R-2046", mode: "Espèces", amount: 45000, status: "confirmé", by: "Konan Yao (réception)", note: "Acompte" },
      { id: "P-1003", at: "2026-11-20 10:05", resId: "R-2052", mode: "Mobile Money (Orange Money)", amount: 60000, status: "confirmé", by: "Moteur de réservation", note: "Acompte en ligne" },
      { id: "P-1004", at: "2026-11-26 06:40", resId: "R-2047", mode: "Mobile Money (Wave)", amount: 20000, status: "à vérifier", by: "Serge N'Guessan (audit de nuit)", note: "Sans confirmation de l'opérateur depuis plus de 15 min" },
    ],
    deposits: [
      { id: "AC-31", resId: "R-2052", amount: 60000, due: "2026-11-20", status: "reçu" },
      { id: "AC-32", resId: "R-2060", amount: 45000, due: "2026-11-27", status: "attendu" },
      { id: "AC-33", group: "GRP-01", label: "Séminaire Société Ivoirienne Exemple (acompte 30 %)", amount: 108000, due: "2026-11-20", status: "en retard", reminders: 1 },
    ],
    refunds: [{ id: "RB-08", resId: "R-1980", note: "F-0874", amount: 120000, reason: "Dérogation : annulation tardive d'une nuit", by: "Konan Yao (réception)", status: "à valider", at: "2026-11-25" }],
    invoices: [
      { id: "F-0874", date: "2026-07-05", resId: "R-1980", amount: 180000 },
      { id: "F-0962", date: "2026-09-13", resId: "R-2012", amount: 330000 },
      { id: "F-1040", date: "2026-11-25", client: "Société Ivoirienne Exemple", amount: 420000 },
    ],
    credits: [{ id: "AV-0011", invoice: "F-0962", date: "2026-09-15", amount: 15000, reason: "Minibar contesté" }],
    creditSeq: 12,
    disputes: [{ id: "CB-03", pay: "P-1001", opened: "2026-11-24", amount: 18500, reason: "Prestation restaurant contestée", status: "en cours" }],
    ar: {
      accounts: [
        { id: "AC1", name: "Société Ivoirienne Exemple", limit: 3000000, terms: 30, contact: "comptabilite@societe-ivoirienne.exemple.test", late: 18 },
        { id: "AC2", name: "Agence Voyages Assinie Exemple", limit: 1500000, terms: 45, contact: "facturation@voyages-assinie.exemple.test", late: 41 },
        { id: "AC3", name: "Transports Lagune Exemple", limit: 2000000, terms: 30, contact: "finance@transports-lagune.exemple.test", late: 72 },
      ],
      invoices: [
        { id: "CL-0412", acc: "AC1", date: "2026-11-25", amount: 420000, paid: 0, ref: "F-1040" },
        { id: "CL-0377", acc: "AC1", date: "2026-10-18", amount: 265000, paid: 0, ref: "F-0998" },
        { id: "CL-0350", acc: "AC2", date: "2026-09-30", amount: 540000, paid: 200000, ref: "F-0981" },
        { id: "CL-0389", acc: "AC3", date: "2026-10-28", amount: 310000, paid: 0, ref: "F-1012" },
        { id: "CL-0298", acc: "AC3", date: "2026-08-12", amount: 180000, paid: 0, ref: "F-0915", reminders: 2 },
      ],
      receipts: [
        { id: "VIR-5521", acc: "AC1", date: "2026-11-24", amount: 265000, label: "VIREMENT SOCIETE IVOIRIENNE EXEMPLE FACT 0998" },
        { id: "VIR-5530", acc: "AC2", date: "2026-11-25", amount: 340000, label: "VIR VOYAGES ASSINIE EXEMPLE SOLDE" },
      ],
      seq: 413,
    },
    shifts: [
      { id: "CS-12", user: USER, post: "Réception poste 1", date: "2026-11-26", opened: "07:02", float: 50000, status: "ouverte" },
      { id: "CS-11", user: "Konan Yao (réception)", post: "Réception poste 1", date: "2026-11-25", opened: "14:58", float: 50000, status: "fermée", expected: 312000, counted: 309500, gap: -2500, reason: "Rendu monnaie" },
      { id: "CS-10", user: "Serge N'Guessan (audit de nuit)", post: "Réception poste 2", date: "2026-11-25", opened: "22:55", float: 30000, status: "fermée", expected: 85000, counted: 85000, gap: 0 },
    ],
    coShift: {},
    ckTimes: [98, 125, 104, 140, 92, 117, 131], // durées de check-in mesurées (secondes, exemple)
  }
  const S = D.sej

  // ---------- Règles et calculs ----------
  const meta = (r) => S.meta[r.id] || { source: "Réception", segment: "Individuel", booked: r.from }
  // IA (simulée) : probabilité de no-show / annulation — garantie, canal, délai, profil ; repli sur taux historiques
  const risk = (r) => {
    const m = meta(r), lead = nights(m.booked, r.from)
    let v = { Aucune: 34, Acompte: 12, "Carte bancaire": 9, "Compte société": 5 }[r.guarantee] ?? 15
    if (/OTA/.test(m.source)) v += 9
    if (lead > 45) v += 6
    if (lead <= 2) v += 4
    if (G(r.guest)?.vip) v -= 4
    return Math.max(2, Math.min(90, v))
  }
  const riskBadge = (r) => { const v = risk(r); return badge(v + " %", v >= 30 ? "dark" : v >= 15 ? "outline" : "") }
  const penalty = (r) => ({ "Carte bancaire": r.rate, "Compte société": r.rate, Acompte: D.payments[r.id] || 0 }[r.guarantee] || 0)
  const penaltyText = (r) => ({ "Carte bancaire": "1re nuit prélevée (jeton PSP)", "Compte société": "1re nuit facturée à la société", Acompte: "acompte conservé" }[r.guarantee] || "libérée sans frais (RG-RES-01)")
  const pendingArr = (d = S.biz) => D.reservations.filter((r) => r.from === d && r.status === "confirmee")
  const stayEnd = (r) => (r.status === "arrivee" && r.to <= S.biz ? addDays(S.biz, 1) : r.to)
  const roomOf = (r) => (r.status === "arrivee" ? r.room : r.preRoom)
  const resAt = (no, d) => D.reservations.find((r) => ["arrivee", "confirmee"].includes(r.status) && roomOf(r) === no && r.from <= d && d < stayEnd(r))
  const busy = (no, a, b, except) => D.reservations.some((r) => r.id !== except && ["arrivee", "confirmee"].includes(r.status) && roomOf(r) === no && r.from < b && a < stayEnd(r))
  const freeRooms = (type, a, b, except) => D.rooms.filter((x) => (!type || x.type === type) && x.hk !== "hs" && !busy(x.no, a, b, except))
  const nightsOk = (type, a, b, except, need = 1) => { for (let d = a; d < b; d = addDays(d, 1)) if (available(type, d, except) < need) return d; return null }
  const blockHeld = (type, d, exceptG) => sum(S.groups.filter((g) => g.id !== exceptG && !g.released && g.from <= d && d < g.to), (g) => Math.max(0, g.block[type] - g.rooming.filter((x) => x.type === type && x.resId).length))
  const typeOrder = ["STD", "SUP", "SUI"]
  const accName = (id) => (S.ar.accounts.find((a) => a.id === id) || { name: id }).name
  const openShift = () => S.shifts.find((s) => s.status === "ouverte")
  const logPay = (p) => { const x = { id: uid("P"), at: `${today} ${nowT()}`, by: USER, status: "confirmé", shift: openShift()?.id, ...p }; S.payLog.unshift(x); return x }

  // Paiements connus : journal + encaissements faits au check-out par reception.js (rapprochés depuis D.payments)
  const allPayments = () => {
    const synth = D.reservations.filter((r) => D.payments[r.id] != null).map((r) => {
      const logged = sum(S.payLog.filter((p) => p.resId === r.id && p.status === "confirmé"), (p) => p.amount) - sum(S.refunds.filter((x) => x.resId === r.id && x.status === "effectué" && x.counted), (x) => x.amount)
      const diff = D.payments[r.id] - logged
      if (diff <= 0) return null
      if (!(r.id in S.coShift)) S.coShift[r.id] = openShift()?.id
      return { id: "CO-" + r.id.slice(2), at: `${today} —`, resId: r.id, mode: r.payMode || "Non précisé", amount: diff, status: "confirmé", by: "Check-out", note: "Encaissement au check-out", shift: S.coShift[r.id] }
    }).filter(Boolean)
    return [...synth, ...S.payLog]
  }
  // IA (simulée) : score de fraude sur paiements et remboursements
  const fraud = (x) => {
    let v = 6
    if (x.amount > REFUND_LIMIT) v += 22
    if (x.refund) v += 10
    if (x.refund && R(x.resId)?.status === "partie") v += 24
    if (x.refund && S.refunds.filter((y) => y.by === x.by).length > 1) v += 15
    if (/Carte/.test(x.mode || "") && x.amount > 250000) v += 12
    return Math.min(95, v)
  }
  const fraudBadge = (v) => badge(v + "/100", v >= 60 ? "dark" : v >= 30 ? "outline" : "")
  const payStatus = (s) => badge(s, s === "confirmé" ? "on" : s === "à vérifier" ? "dark" : "outline")

  // Folio en fenêtres : A = client, B = société / compte maître (selon le routage)
  const windows = (r) => {
    const f = folio(r), rt = S.routing[r.id]
    const ex = D.extras[r.id] || []
    const lines = f.lines.map((l, i) => ({ ...l, idx: i - 1, win: i === 0 ? (rt ? "B" : "A") : ex[i - 1].win || (rt && rt.what === "Tout le folio" ? "B" : "A") }))
    const A_ = lines.filter((l) => l.win === "A"), B_ = lines.filter((l) => l.win === "B")
    const tB = sum(B_, (l) => l.amount), tr = S.transferred[r.id] || 0
    return { f, A: A_, B: B_, tA: sum(A_, (l) => l.amount), tB, tr, restB: tB - tr }
  }
  const arOpen = (i) => i.amount - i.paid
  const age = (i) => nights(i.date, today)
  const accOpen = (id) => sum(S.ar.invoices.filter((i) => i.acc === id), arOpen)
  const allInvoices = () => [...S.invoices.map((i) => ({ ...i, client: i.client || (R(i.resId) ? gname(R(i.resId)) : "—") })), ...D.reservations.filter((r) => r.invoice && !S.invoices.some((i) => i.id === r.invoice))
    .map((r) => ({ id: r.invoice, date: today, client: gname(r), resId: r.id, amount: folio(r).total, live: true }))]
  const credited = (id) => sum(S.credits.filter((c) => c.invoice === id), (c) => c.amount)

  // ---------- Écrans « Réception & séjour » ----------
  const views = {
    // Plan des chambres (room rack), pré-attribution, attribution optimisée et upsell (IA)
    rack() {
      const days = Array.from({ length: 10 }, (_, i) => addDays(S.biz, i))
      const rows = D.rooms.map((room) => {
        let cells = "", i = 0
        while (i < days.length) {
          if (room.hk === "hs") { cells += `<td colspan="${days.length - i}" style="padding:4px"><span class="pill dark" style="display:block">Hors commande${room.note ? " — " + esc(room.note) : ""}</span></td>`; break }
          const r = resAt(room.no, days[i])
          if (!r) { cells += "<td></td>"; i++; continue }
          let span = 1
          while (i + span < days.length && resAt(room.no, days[i + span]) === r) span++
          cells += `<td colspan="${span}" style="padding:4px"><span class="pill ${r.status === "arrivee" ? "on" : "outline"}" style="display:block;overflow:hidden;text-overflow:ellipsis" title="${esc(r.id + " · " + gname(r))}">${esc(gname(r))}</span></td>`
          i += span
        }
        return `<tr><td style="white-space:nowrap"><strong>${esc(room.no)}</strong> <span class="muted">${esc(room.type)}</span></td><td>${pill(HK, room.hk)}</td>${cells}</tr>`
      }).join("")
      const unassigned = D.reservations.filter((r) => r.status === "confirmee" && !r.preRoom && r.to > S.biz).sort((a, b) => a.from.localeCompare(b.from))
      const props = proposals(unassigned)
      const ups = upsellOffers()
      return pageHead("Plan des chambres", `Occupation par chambre sur 10 nuits à partir du ${fd(S.biz)} (exemple). En séjour en vert, pré-attribuées en contour, hors commande en noir.`)
        + `<div class="tablewrap"><table style="min-width:980px"><thead><tr><th>Ch.</th><th>Ménage</th>${days.map((d) => `<th>${esc(wd(d))} ${fd(d)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`
        + `<div class="cols"><section><h2>Réservations sans chambre</h2><p class="muted">Pré-attribution d'une chambre libre sur tout le séjour (EF-RES-014).</p>`
        + tbl(["Réf.", "Client", "Dates", "Type", "Chambre"], unassigned.map((r) => {
          const c = freeRooms(r.type, r.from, r.to, r.id)
          return [esc(r.id), esc(gname(r)) + vip(G(r.guest)), `${fd(r.from)} → ${fd(r.to)}`, esc(T(r.type).label),
            `<select aria-label="Chambre pour ${esc(r.id)}" onchange="A.sej.preassign(${q(r.id)}, this.value)"><option value="">— choisir —</option>${c.map((x) => `<option value="${esc(x.no)}">${esc(x.no)} · ${esc(HK[x.hk][0])}</option>`).join("")}</select>`]
        }), "Toutes les réservations à venir ont une chambre pré-attribuée.")
        + `${D.reservations.some((r) => r.preRoom && r.status === "confirmee") ? `<p class="muted" style="margin-top:8px">Pré-attributions : ${D.reservations.filter((r) => r.preRoom && r.status === "confirmee").map((r) => `${esc(r.id)} → ${esc(r.preRoom)} <button class="link" onclick="A.sej.preassign(${q(r.id)}, '')">retirer</button>`).join(" · ")}</p>` : ""}</section>`
        + `<section><h2>Suggestions</h2><div class="stack">`
        + aiBox("Attribution optimisée des chambres", props.length ? props.map((p) => `${p.r.id} (${gname(p.r)}) → ${p.room.no} : ${p.why}`).join(" · ") : "Aucune réservation à attribuer.", props.length ? btn("Appliquer la proposition", "A.sej.applyProps()", "sm") : "")
        + ups.map((u) => aiBox("Upsell au check-in", `${gname(u.r)} (${u.r.id}, ${T(u.r.type).label}) : proposer ${T(u.to).label} pour ${money(u.price)} de plus par nuit, soit ${money(u.price * nights(u.r.from, u.r.to))} sur le séjour. Prix recommandé par le modèle (simulé).`, btn("Surclassement accepté", `A.sej.upsell(${q(u.r.id)}, ${q(u.to)}, ${u.price})`, "sm"))).join("")
        + `</div></section></div>`
    },

    // Mouvements de séjour : walk-in, changement de chambre / prolongation, délogement, no-shows
    mouv(p) {
      const tab = p[0] || "walkin"
      return pageHead("Mouvements de séjour", "Clients sans réservation, changements de chambre, prolongations, délogements et no-shows (exemple).")
        + subtabs("sej-mouv", [["walkin", "Walk-in"], ["chambre", "Changement de chambre et prolongation"], ["delogement", "Délogement"], ["noshow", "No-shows et pénalités"]], tab)
        + ({ walkin: walkinTab, chambre: moveTab, delogement: walkTab, noshow: noshowTab }[tab] || walkinTab)()
    },

    // Groupes, liste d'attente, copilote de réservation
    groupes(p) {
      const tab = p[0] || "groupes"
      return pageHead("Groupes et liste d'attente", "Blocs de groupes avec cut-off et rooming list, liste d'attente, saisie assistée des demandes (exemple).")
        + subtabs("sej-groupes", [["groupes", "Groupes et blocs"], ["attente", "Liste d'attente"], ["copilote", "Copilote de réservation"]], tab)
        + ({ groupes: groupsTab, attente: waitTab, copilote: copilotTab }[tab] || groupsTab)()
    },

    // Audit de nuit, main courante, indicateurs
    audit(p) {
      const tab = p[0] || "audit"
      return pageHead("Audit de nuit et main courante", `Date hôtelière simulée : ${fdLong(S.biz)}.`)
        + subtabs("sej-audit", [["audit", "Audit de nuit"], ["journal", "Main courante et demandes"], ["kpi", "Indicateurs"]], tab)
        + ({ audit: auditTab, journal: journalTab, kpi: kpiTab }[tab] || auditTab)()
    },

    // ---------- Écrans « Finance » ----------
    folios(p) {
      const list = inHouse().sort((a, b) => a.room.localeCompare(b.room))
      const r = R(p[0]) && R(p[0]).status === "arrivee" ? R(p[0]) : list[0]
      return pageHead("Folios et routage", "Folio par séjour en deux fenêtres (client / société), routage, imputations, transferts et encaissements. Montants d'exemple.")
        + split(listItems(list.map((x) => ({ id: x.id, title: `Ch. ${x.room} · ${gname(x)}`, sub: `${x.id} · solde ${money(folio(x).balance)}`, badge: S.routing[x.id] ? " " + badge("Routage", "outline") : "" })), r?.id, "fol-folios"),
          r ? folioPanel(r) : `<p class="muted">Aucun client en séjour.</p>`)
    },
    paiements(p) {
      const tab = p[0] || "journal"
      return pageHead("Paiements", "Encaissements (cartes tokenisées, mobile money, espèces, virements), acomptes, remboursements et avoirs. PSP et opérateurs simulés.")
        + subtabs("fol-paiements", [["journal", "Journal des paiements"], ["acomptes", "Acomptes"], ["remboursements", "Remboursements"], ["avoirs", "Factures et avoirs"]], tab)
        + ({ journal: payJournal, acomptes: depositsTab, remboursements: refundsTab, avoirs: creditsTab }[tab] || payJournal)()
    },
    ledger(p) {
      const tab = p[0] || "comptes"
      return pageHead("City ledger", "Comptes débiteurs des sociétés et agences : encours, âge des créances, lettrage et relances (exemple).")
        + subtabs("fol-ledger", [["comptes", "Comptes débiteurs"], ["lettrage", "Lettrage"], ["relances", "Relances"]], tab)
        + ({ comptes: arAccounts, lettrage: arMatch, relances: arRemind }[tab] || arAccounts)()
    },
    caisse(p) {
      const tab = p[0] || "caisse"
      return pageHead("Caisses et clôture", "Caisse par utilisateur et par poste : ouverture, encaissements, clôture et écarts (EF-FOL-012).")
        + subtabs("fol-caisse", [["caisse", "Caisse du poste"], ["kpi", "Indicateurs"]], tab)
        + (tab === "kpi" ? folKpi() : cashTab())
    },
  }

  // ---------- Plan des chambres : IA ----------
  function proposals(list) {
    const taken = new Set()
    return list.filter((r) => r.from <= addDays(S.biz, 3)).map((r) => {
      const g = G(r.guest) || { prefs: [] }
      const c = freeRooms(r.type, r.from, r.to, r.id).filter((x) => !taken.has(x.no))
      if (!c.length) return null
      const high = g.prefs.some((x) => /élevé/i.test(x)), calm = g.prefs.some((x) => /calme/i.test(x))
      c.sort((a, b) => (b.hk === "propre") - (a.hk === "propre") || (high || calm ? b.floor - a.floor : a.floor - b.floor))
      const room = c[0]
      taken.add(room.no)
      const why = [room.hk === "propre" ? "déjà propre" : "en préparation", high ? "étage élevé demandé" : calm ? "chambre calme demandée" : "proche de l'ascenseur"].join(", ")
      return { r, room, why }
    }).filter(Boolean)
  }
  function upsellOffers() {
    return pendingArr().filter((r) => r.type !== "SUI").map((r) => {
      const to = typeOrder[typeOrder.indexOf(r.type) + 1]
      if (nightsOk(to, r.from, r.to)) return null
      return { r, to, price: Math.round(((T(to).rate - r.rate) * 0.6) / 500) * 500 }
    }).filter(Boolean).slice(0, 2)
  }

  // ---------- Walk-in ----------
  function walkinTab() {
    const free = D.rooms.filter((x) => x.hk === "propre" && !occupant(x.no) && !busy(x.no, S.biz, addDays(S.biz, 1)))
    const recent = D.reservations.filter((r) => r.walkin)
    return `<div class="cols"><section>${card("Client sans réservation", `<p class="muted" style="margin-top:0">Tarif comptoir du type, garantie immédiate obligatoire (au moins la 1re nuit). Fiche de police exigée pour un voyageur étranger (RG-FOF-07). EF-FOF-006</p>
      ${form([
        field("wi-name", "Nom du client", input("wi-name", "", 'placeholder="Ex. Nadège Yapi"')),
        field("wi-phone", "Téléphone", input("wi-phone", "", 'placeholder="+225 07 …"')),
        field("wi-nat", "Nationalité", select("wi-nat", ["Côte d'Ivoire", "Burkina Faso", "Ghana", "Mali", "Sénégal", "France", "Autre"], "Côte d'Ivoire", `onchange="document.getElementById('wi-police-row').style.display=this.value==='Côte d\\'Ivoire'?'none':''"`)),
        field("wi-room", "Chambre (propre et libre)", select("wi-room", free.map((x) => [x.no, `${x.no} · ${T(x.type).label} · ${money(T(x.type).rate)}`]), free[0]?.no)),
        field("wi-nights", "Nuits", input("wi-nights", "1", 'type="number" min="1" max="30"')),
        field("wi-pay", "Garantie immédiate", select("wi-pay", ["Espèces", "Carte (jeton PSP)", "Mobile Money (Orange Money)", "Mobile Money (MTN MoMo)", "Mobile Money (Wave)"], "Espèces")),
        field("wi-amount", "Montant encaissé", input("wi-amount", free[0] ? String(T(free[0].type).rate) : "0", 'type="number" min="0" step="500"')),
        `<div class="full" id="wi-police-row" style="display:none"><label class="row" style="color:var(--ink)"><input type="checkbox" id="wi-police"> Fiche de police remplie (voyageur étranger)</label></div>`,
        `<div class="full"><label class="row" style="color:var(--ink)"><input type="checkbox" id="wi-id"> Pièce d'identité présentée et conforme</label></div>`,
        `<div class="full" id="wi-err"></div>`,
        `<div class="full row">${btn("Enregistrer l'arrivée et encoder la clé", "A.sej.walkin()", "accent")}</div>`,
      ])}`)}</section>
      <section><h2>Walk-ins du jour</h2>${tbl(["Réf.", "Client", "Ch.", "#Nuits", "#Encaissé"], recent.map((r) => [esc(r.id), esc(gname(r)), esc(r.room), nights(r.from, r.to), money(D.payments[r.id] || 0)]), "Aucun walk-in enregistré pour l'instant.")}
      <p class="muted">Chambres propres et libres maintenant : ${free.length}. La disponibilité par type est vérifiée nuit par nuit pour ne pas prendre la chambre d'une arrivée prévue.</p></section></div>`
  }

  // ---------- Changement de chambre et prolongation ----------
  function moveTab() {
    const list = inHouse().sort((a, b) => a.room.localeCompare(b.room))
    if (!list.length) return `<p class="muted">Aucun client en séjour.</p>`
    const r = list.find((x) => x.id === ui.sejMove) || list[0]
    const targets = D.rooms.filter((x) => x.no !== r.room && x.hk === "propre" && !occupant(x.no) && !busy(x.no, S.biz, r.to, r.id))
    return `${form([field("mv-res", "Séjour", select("mv-res", list.map((x) => [x.id, `Ch. ${x.room} · ${gname(x)} · ${x.id}`]), r.id, `onchange="ui.sejMove=this.value;render()"`))])}
      <div class="cols" style="margin-top:14px"><section>${card("Changement de chambre", `<p class="muted" style="margin-top:0">Actuellement ch. ${esc(r.room)} (${esc(T(r.type).label)}, ${money(r.rate)}/nuit). Le folio suit le séjour ; l'ancienne carte est révoquée immédiatement (RG-FOF-04, contrôle d'accès simulé). EF-FOF-007</p>
        ${form([
          field("mv-to", "Nouvelle chambre", select("mv-to", targets.map((x) => [x.no, `${x.no} · ${T(x.type).label}`]), targets[0]?.no)),
          field("mv-why", "Motif", select("mv-why", ["Problème technique", "Bruit", "Demande du client", "Surclassement", "Regroupement familial"], "Demande du client")),
          field("mv-rate", "Tarif", select("mv-rate", [["keep", "Conserver le tarif"], ["new", "Appliquer le tarif du nouveau type"]], "keep")),
          `<div class="full" id="mv-err"></div>`,
          `<div class="full">${btn("Changer de chambre et transférer l'accès", `A.sej.move(${q(r.id)})`)}</div>`,
        ])}`)}</section>
      <section>${card("Prolonger ou écourter", `<p class="muted" style="margin-top:0">Départ prévu le ${fd(r.to)}. Les nuits ajoutées sont contrôlées contre la disponibilité ; la validité de la clé suit la nouvelle date (EF-FOF-008).</p>
        ${form([field("ex-to", "Nouvelle date de départ", input("ex-to", addDays(r.to, 1), 'type="date"')), `<div class="full" id="ex-err"></div>`, `<div class="full">${btn("Modifier le départ", `A.sej.extend(${q(r.id)})`, "ghost")}</div>`])}`)}</section></div>
      <h2>Historique des changements</h2>${tbl(["Horodatage", "Séjour", "De", "Vers", "Motif", "Par"], S.moves.map((m) => [esc(m.at), esc(m.resId), esc(m.from), esc(m.to), esc(m.reason), esc(m.by)]))}`
  }

  // ---------- Délogement (walk) ----------
  function walkTab() {
    const days = Array.from({ length: 14 }, (_, i) => addDays(S.biz, i))
    const over = []
    D.roomTypes.forEach((t) => days.forEach((d) => { const n = available(t.code, d); if (n < 0) over.push(`${t.label} le ${fd(d)} (${-n} de trop)`) }))
    const cands = pendingArr()
    return `${over.length ? `<div class="err">Surréservation détectée : ${esc(over.join(", "))}. Limite autorisée par le revenue management (RG-RES-04).</div>` : `<p class="muted">Aucune surréservation sur 14 jours. Le délogement reste possible en cas de chambre devenue indisponible (panne, dégât).</p>`}
      <div class="cols"><section>${card("Déloger un client arrivant", cands.length ? form([
        field("wk-res", "Réservation", select("wk-res", cands.map((r) => [r.id, `${r.id} · ${gname(r)} · ${T(r.type).label}`]), cands[0].id)),
        field("wk-hotel", "Hôtel partenaire", select("wk-hotel", S.partners.map((h) => [h.name, `${h.name} · ${h.dist} · ${money(h.rate)}`]), S.partners[0].name)),
        field("wk-taxi", "Transport (aller-retour)", input("wk-taxi", "5000", 'type="number" min="0" step="500"')),
        field("wk-comp", "Compensation", select("wk-comp", ["Nuit offerte au prochain séjour", "Dîner offert", "Bon d'achat 20 000 FCFA", "Aucune"], "Nuit offerte au prochain séjour")),
        `<div class="full muted">Décision du chef de réception / duty manager. La 1re nuit chez le partenaire est à la charge de l'hôtel (EF-FOF-012).</div>`,
        `<div class="full">${btn("Déloger et réserver chez le partenaire", "A.sej.walk()")}</div>`,
      ]) : `<p class="muted">Aucune arrivée en attente pour la date hôtelière.</p>`)}</section>
      <section><h2>Délogements</h2><div class="grid">${kpi("Délogements (mois)", S.walks.length, "exemple")}${kpi("Coût total", money(sum(S.walks, (w) => w.cost)), "nuitées partenaires + transport")}</div>
      ${tbl(["Date", "Client", "Hôtel partenaire", "#Coût", "Compensation"], S.walks.map((w) => [fd(w.date), esc(w.name), esc(w.hotel), money(w.cost), esc(w.comp)]))}</section></div>`
  }

  // ---------- No-shows ----------
  function noshowTab() {
    const list = pendingArr()
    return `<p class="muted">Arrivées non présentées pour le ${fd(S.biz)}. Pénalité selon la garantie ; une réservation non garantie est libérée à 18 h sans frais. Normalement traité par l'audit de nuit (EF-RES-012), possible ici à la main.</p>
      ${tbl(["Réf.", "Client", "Type", "Garantie", "Risque IA", "Pénalité prévue", ""], list.map((r) => [esc(r.id), esc(gname(r)) + vip(G(r.guest)), esc(T(r.type).label), esc(r.guarantee), riskBadge(r),
        `${money(penalty(r))}${muted(penaltyText(r))}`,
        `<span class="row" style="flex-wrap:nowrap">${btn("Relancer", `A.sej.remind(${q(r.id)})`, "ghost sm")}${btn("Déclarer no-show", `A.sej.noshow(${q(r.id)})`, "sm")}</span>`]), "Aucune arrivée en attente.")}
      ${list.some((r) => risk(r) >= 30) ? aiBox("Prédiction de no-show", `${list.filter((r) => risk(r) >= 30).map((r) => `${gname(r)} (${r.id}) : ${risk(r)} % de risque — ${r.guarantee === "Aucune" ? "réservation sans garantie" : "profil à risque"}.`).join(" ")} Action suggérée : demander une garantie par lien de paiement. Aucune annulation automatique.`, list.filter((r) => risk(r) >= 30 && r.guarantee === "Aucune").map((r) => btn(`Demander une garantie à ${gname(r)}`, `A.sej.askGuarantee(${q(r.id)})`, "sm")).join("")) : ""}
      <h2>No-shows traités</h2>${tbl(["Date", "Réf.", "Client", "Garantie", "#Pénalité", "Traitement"], S.noshows.map((n) => [fd(n.date), esc(n.resId), esc(n.name), esc(n.guarantee), money(n.amount), esc(n.how)]), "Aucun no-show traité dans cette session.")}`
  }

  // ---------- Groupes ----------
  function groupsTab() {
    const g = S.groups.find((x) => x.id === ui.sejGroup) || S.groups[0]
    const picked = (t) => g.rooming.filter((x) => x.type === t && x.resId).length
    const listed = (t) => g.rooming.filter((x) => x.type === t).length
    const total = sum(typeOrder, (t) => g.block[t])
    const left = nights(S.biz, g.cutoff)
    return split(`<div class="list">${S.groups.map((x) => `<button aria-current="${x === g}" onclick="ui.sejGroup=${q(x.id)};render()"><strong>${esc(x.name)}</strong>${x.released ? " " + badge("Cut-off appliqué", "outline") : ""}<div class="muted">${fd(x.from)} → ${fd(x.to)} · ${sum(typeOrder, (t) => x.block[t])} ch. · cut-off ${fd(x.cutoff)}</div></button>`).join("")}</div>
      <h3>Nouveau bloc</h3>${form([field("gr-name", "Nom", input("gr-name", "", 'placeholder="Ex. Mariage Kouamé (exemple)"')), field("gr-acc", "Payeur", select("gr-acc", S.ar.accounts.map((a) => [a.id, a.name]), "AC1")),
        field("gr-from", "Arrivée", input("gr-from", addDays(S.biz, 14), 'type="date"')), field("gr-to", "Départ", input("gr-to", addDays(S.biz, 16), 'type="date"')),
        ...typeOrder.map((t) => field("gr-" + t, `${T(t).label} (nb)`, input("gr-" + t, t === "STD" ? "2" : "0", 'type="number" min="0"'))),
        `<div class="full" id="gr-err"></div>`, `<div class="full">${btn("Créer le bloc", "A.sej.newGroup()", "ghost")}</div>`])}`,
      `<div class="card"><div class="row between"><span class="big">${esc(g.name)}</span>${badge(accName(g.account), "outline")}</div>
        <div class="muted">${esc(g.id)} · du ${fd(g.from)} au ${fd(g.to)} · cut-off le ${fd(g.cutoff)} ${g.released ? "(appliqué)" : left >= 0 ? `(J-${left})` : "(dépassé)"} · facturation : hébergement au compte maître, extras à chaque participant</div>
        <div class="grid" style="margin:14px 0">${kpi("Chambres bloquées", total, "bloc")}${kpi("Reprises", sum(typeOrder, picked), "réservations générées")}${kpi("Noms reçus", g.rooming.length, "rooming list")}</div>
        ${tbl(["Type", "#Bloquées", "#Noms", "#Reprises", "#Tarif groupe"], typeOrder.filter((t) => g.block[t] || listed(t)).map((t) => [esc(T(t).label), g.block[t], listed(t), picked(t), money(g.rate[t])]))}
        <h3>Rooming list</h3>
        ${tbl(["Participant", "Type", "Réservation"], g.rooming.map((x) => [esc(x.name), esc(T(x.type).label), x.resId ? badge(x.resId, "on") : ref("à générer")]), "Aucun nom reçu.")}
        <label for="gr-import" style="margin-top:12px">Importer des noms (une ligne « Nom;Type », copier-coller depuis le tableur de l'organisateur)</label>
        <textarea id="gr-import" rows="3" placeholder="Hervé Séka;STD&#10;Mariam Doumbia;SUP"></textarea>
        <div id="gr-ierr"></div>
        <div class="row" style="margin-top:10px">${btn("Importer", `A.sej.importRooming(${q(g.id)})`, "ghost")}${btn("Générer les réservations", `A.sej.genGroup(${q(g.id)})`)}${g.released ? "" : btn("Appliquer le cut-off", `A.sej.cutoff(${q(g.id)})`, "ghost")}</div>
        <p class="muted">Au cut-off, les chambres non reprises retournent à l'inventaire général (RG-RES-03). EF-RES-007</p></div>`)
  }
  function waitTab() {
    return `<div class="row between"><p class="muted" style="margin:0">Notification automatique dès qu'une disponibilité se libère (EF-RES-010, message simulé).</p>${btn("Vérifier les disponibilités", "A.sej.checkWait()")}</div>
      <div style="margin-top:12px">${tbl(["Réf.", "Client", "Contact", "Type", "Dates", "Priorité", "Disponible", "Statut", ""], S.waitlist.map((w) => {
        const ok = !nightsOk(w.type, w.from, w.to)
        return [esc(w.id), esc(w.name), esc(w.contact), esc(T(w.type).label), `${fd(w.from)} → ${fd(w.to)}`, esc(w.prio), ok ? badge("Oui", "on") : ref("Complet"),
          badge(w.status, w.status === "convertie" ? "on" : w.status === "notifiée" ? "outline" : ""),
          w.status === "convertie" ? esc(w.resId) : ok ? btn("Convertir en réservation", `A.sej.convertWait(${q(w.id)})`, "sm") : ""]
      }))}</div>
      <h3>Ajouter à la liste d'attente</h3>${form([field("wl-name", "Client", input("wl-name", "", 'placeholder="Nom"')), field("wl-contact", "Contact", input("wl-contact", "", 'placeholder="e-mail ou téléphone"')),
        field("wl-type", "Type", select("wl-type", D.roomTypes.map((t) => [t.code, t.label]), "SUI")), field("wl-from", "Arrivée", input("wl-from", addDays(S.biz, 2), 'type="date"')), field("wl-to", "Départ", input("wl-to", addDays(S.biz, 4), 'type="date"')),
        field("wl-prio", "Priorité", select("wl-prio", ["Haute", "Normale"], "Normale")), `<div class="full" id="wl-err"></div>`, `<div class="full">${btn("Ajouter", "A.sej.addWait()", "ghost")}</div>`])}`
  }
  const SAMPLE_MAIL = "Bonjour, je souhaiterais réserver une chambre supérieure du 04/12 au 07/12 pour deux adultes, avec arrivée tardive vers 23 h. Pouvez-vous me confirmer le tarif ? Cordialement, Arsène Beugré"
  function parseMail(t) {
    const ds = [...t.matchAll(/(\d{1,2})\/(\d{1,2})/g)].map((m) => { const mo = Number(m[2]), y = mo < Number(today.slice(5, 7)) ? 2027 : 2026; return `${y}-${String(mo).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}` })
    const type = /suite/i.test(t) ? "SUI" : /sup[ée]rieure/i.test(t) ? "SUP" : "STD"
    const name = (t.match(/(?:Cordialement|Merci|Bien à vous)[,.]?\s*([^\n.,]+)\s*$/i) || [])[1] || ""
    const req = (t.match(/arriv[ée]e tardive[^.,?]*/i) || t.match(/lit b[ée]b[ée]/i) || [""])[0]
    const adults = /deux adultes|2 adultes/i.test(t) ? 2 : 1
    return { from: ds[0] || "", to: ds[1] || "", type, name: name.trim(), req, adults }
  }
  function copilotTab() {
    const text = ui.sejMail ?? SAMPLE_MAIL, d = parseMail(text)
    const ok = d.from && d.to && d.to > d.from
    const full = ok && nightsOk(d.type, d.from, d.to)
    return `<div class="cols"><section><label for="cp-mail">E-mail reçu du client</label><textarea id="cp-mail" rows="7">${esc(text)}</textarea>
      <div class="row" style="margin-top:10px">${btn("Analyser la demande", "ui.sejMail=document.getElementById('cp-mail').value;render()")}</div></section>
      <section>${aiBox("Copilote de réservation — brouillon", ok ? `${d.name || "Client non identifié"} · ${T(d.type).label} · du ${fd(d.from)} au ${fd(d.to)} (${nights(d.from, d.to)} nuit(s)) · ${d.adults} adulte(s)${d.req ? " · demande : " + d.req : ""}. ${full ? `Complet le ${fd(full)} : proposer la liste d'attente.` : `Disponible, tarif public ${money(T(d.type).rate)}/nuit.`} Brouillon à valider par l'agent.` : "Dates introuvables dans le message : compléter à la main.",
        ok && !full ? btn("Ouvrir le brouillon dans « Réservations »", "A.sej.openDraft()", "sm") : "")}
      <p class="muted">Aucune réservation n'est créée sans validation humaine (§8.11).</p></section></div>`
  }

  // ---------- Audit de nuit ----------
  function auditChecks() {
    const pend = pendingArr(), deps = inHouse().filter((r) => r.to <= S.biz), mm = S.payLog.filter((p) => p.status === "à vérifier" || p.status === "en attente")
    return [
      { label: "Aucun check-in en cours d'encodage", ok: !ui.encoding, block: true, hint: ui.encoding ? `Check-in ${ui.encoding} en cours (RG-FOF-06)` : "" },
      { label: "Paiements mobile money rapprochés", ok: !mm.length, block: true, hint: mm.length ? `${mm.length} paiement(s) à vérifier auprès de l'opérateur — voir Finance › Paiements (RG-FOL-05)` : "" },
      { label: "Arrivées du jour traitées", ok: !pend.length, block: false, hint: pend.length ? `${pend.length} arrivée(s) non présentée(s) seront traitées en no-show` : "" },
      { label: "Départs du jour clôturés", ok: !deps.length, block: false, hint: deps.length ? `${deps.map((r) => "ch. " + r.room).join(", ")} : départ prévu non enregistré (nuit supplémentaire si le client reste)` : "" },
      { label: "Caisses fermées", ok: !openShift(), block: false, hint: openShift() ? `Caisse ${openShift().id} (${openShift().user}) encore ouverte` : "" },
    ]
  }
  let auditRun = null // audit en cours : état transitoire, non sauvegardé
  const AUDIT_STEPS = ["Contrôles préalables", "Traitement des no-shows", "Publication de la taxe de séjour sur les folios", "Édition et archivage des rapports", "Changement de date hôtelière"]
  function auditTab() {
    const checks = auditChecks(), blocked = checks.some((c) => c.block && !c.ok), run = auditRun
    return `<div class="cols"><section><h2>Contrôles préalables</h2>
      ${tbl(["Contrôle", "État", "Détail"], checks.map((c) => [esc(c.label), c.ok ? badge("OK", "on") : badge(c.block ? "Bloquant" : "Avertissement", c.block ? "dark" : "outline"), esc(c.hint)]))}
      <div class="row" style="margin-top:12px">${run ? "" : btn(`Lancer l'audit du ${fd(S.biz)}`, "A.sej.runAudit()", blocked ? "" : "accent")}${blocked ? `<span class="muted">Audit bloqué tant qu'un contrôle bloquant n'est pas levé.</span>` : ""}</div></section>
      <section><h2>Étapes</h2>${AUDIT_STEPS.map((s, i) => `<div class="step"><b class="n">${i + 1}</b><div><strong>${esc(s)}</strong> ${run ? (run.step > i ? badge("Fait", "on") : run.step === i ? badge("En cours", "outline") : "") : ""}${run && run.notes[i] ? `<div class="muted">${esc(run.notes[i])}</div>` : ""}</div></div>`).join("")}
      ${run && run.step >= AUDIT_STEPS.length ? `<p style="margin-top:14px">${badge("Audit terminé", "on")} Nouvelle date hôtelière : <strong>${esc(fdLong(S.biz))}</strong> (simulation : les autres écrans restent au ${fd(today)}).</p>${btn("Fermer le compte rendu", "A.sej.closeAudit()", "ghost sm")}` : ""}</section></div>
      <h2>Audits archivés</h2>${tbl(["Date hôtelière", "Terminé à", "Par", "#No-shows", "#Taxe publiée", "#Chambres"], S.audits.map((a) => [fd(a.date), esc(a.at), esc(a.by), a.noshows, money(a.tax), a.rooms]))}`
  }

  // ---------- Main courante ----------
  function journalTab() {
    const open = S.log.filter((e) => e.status === "ouverte")
    const filt = ui.sejLog || "toutes"
    const list = S.log.filter((e) => filt === "toutes" || (filt === "ouvertes" ? e.status === "ouverte" : e.type === "Demande client"))
    ui.sejLog = filt
    return `<div class="cols"><section>${aiBox("Synthèse de la main courante (copilote)", open.length ? `${open.length} point(s) ouvert(s) : ${open.map((e) => `${e.type.toLowerCase()}${e.room ? " ch. " + e.room : ""}${e.due ? " avant " + e.due : ""}`).join(" ; ")}. Priorité : ${open.find((e) => e.due) ? `la demande avant ${open.filter((e) => e.due).sort((a, b) => a.due.localeCompare(b.due))[0].due}` : "aucune échéance"}.` : "Rien d'ouvert : bonne relève.")}</section>
      <section>${card("Nouvelle entrée", form([field("lg-type", "Type", select("lg-type", ["Consigne", "Demande client", "Message client", "Incident"], "Demande client")), field("lg-room", "Chambre", input("lg-room", "", 'placeholder="Ex. 302"')),
        field("lg-due", "Échéance", input("lg-due", "", 'type="time"')), field("lg-text", "Texte", input("lg-text", "", 'placeholder="Ex. réveil à 6 h"'), "full"), `<div class="full">${btn("Ajouter à la main courante", "A.sej.addLog()", "ghost")}</div>`]))}</section></div>
      ${chips("sejLog", { toutes: "Toutes", ouvertes: "Ouvertes", demandes: "Demandes clients" }, { toutes: S.log.length, ouvertes: open.length, demandes: S.log.filter((e) => e.type === "Demande client").length })}
      ${tbl(["Horodatage", "Type", "Ch.", "Texte", "Auteur", "Échéance", "Statut", ""], list.map((e) => [esc(e.at), esc(e.type), esc(e.room || "—"), esc(e.text), esc(e.author), esc(e.due || "—"),
        badge(e.status, e.status === "ouverte" ? "outline" : ""), e.status === "ouverte" ? btn("Marquer traité", `A.sej.doneLog(${q(e.id)})`, "ghost sm") : ref(e.doneMin ? `${e.doneMin} min` : "")]))}
      <p class="muted">EF-FOF-014 / EF-FOF-015 : main courante, messages et demandes avec suivi des délais.</p>`
  }

  // ---------- Indicateurs §8.12 et §9.12 ----------
  function kpiTab() {
    const all = D.reservations, canc = all.filter((r) => r.status === "annulee" && !r.noShow && !r.walked), ns = all.filter((r) => r.noShow)
    const expected = all.filter((r) => r.from <= S.biz && (r.status !== "annulee" || r.noShow))
    const lead = all.map((r) => nights(meta(r).booked, r.from)).filter((n) => n >= 0)
    const valid = all.filter((r) => r.status !== "annulee")
    const rev = (k) => { const m = {}; valid.forEach((r) => { const key = meta(r)[k]; m[key] = (m[key] || 0) + nights(r.from, r.to) * r.rate }); return Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value) }
    const stays = all.filter((r) => meta(r).mode), mob = stays.filter((r) => meta(r).mode === "mobile")
    const done = S.log.filter((e) => e.type === "Demande client" && e.doneMin).map((e) => e.doneMin).sort((a, b) => a - b)
    const median = done.length ? done[Math.floor(done.length / 2)] : 0
    return `<h2>Réservations (§8.12)</h2><div class="grid">
        ${kpi("Taux d'annulation", pct((canc.length / all.length) * 100), `${canc.length} sur ${all.length} réservations`)}
        ${kpi("Taux de no-show", pct(expected.length ? (ns.length / expected.length) * 100 : 0), `${ns.length} sur ${expected.length} arrivées prévues`)}
        ${kpi("Délai moyen de réservation", Math.round(sum(lead) / lead.length) + " j", "entre réservation et arrivée")}
        ${kpi("Durée moyenne de séjour", (Math.round((sum(valid, (r) => nights(r.from, r.to)) / valid.length) * 10) / 10) + " nuits", "nuitées / réservations")}</div>
      <div class="cols"><section><h3>Revenu hébergement par source</h3>${bars(rev("source"), money)}</section><section><h3>Revenu hébergement par segment</h3>${bars(rev("segment"), money)}</section></div>
      <h2>Réception (§9.12)</h2><div class="grid">
        ${(() => { const a = Math.round(sum(S.ckTimes) / S.ckTimes.length); return kpi("Durée moyenne de check-in", `${Math.floor(a / 60)} min ${String(a % 60).padStart(2, "0")} s`, `${S.ckTimes.length} check-ins mesurés (ouverture → clé)`) })()}
        ${kpi("Taux de check-in mobile", pct((mob.length / Math.max(1, stays.length)) * 100), `${mob.length} sur ${stays.length} séjours`)}
        ${kpi("Revenu upsell au comptoir", money(sum(S.upsells, (u) => u.amount)), `${S.upsells.length} surclassement(s)`)}
        ${kpi("Délogements", `${S.walks.length} · ${money(sum(S.walks, (w) => w.cost))}`, "nombre et coût")}
        ${kpi("Délai médian des demandes", median + " min", `${done.length} demande(s) traitée(s)`)}</div>
      <p class="muted">Valeurs calculées sur les données d'exemple de la maquette.</p>`
  }

  // ---------- Folio ----------
  function folioPanel(r) {
    const w = windows(r), rt = S.routing[r.id], others = inHouse().filter((x) => x.id !== r.id)
    const lineRows = (lines) => lines.map((l) => [esc(l.label) + (l.reversed ? " " + badge("Annulée", "outline") : ""), money(l.amount),
      l.idx < 0 || l.reversed || l.amount < 0 ? ref(l.idx < 0 ? "nuitées" : "") : `<span class="row" style="flex-wrap:nowrap">
        ${btn(l.win === "A" ? "→ B" : "→ A", `A.fol.swap(${q(r.id)}, ${l.idx})`, "ghost sm")}
        ${others.length ? btn("Transférer", `A.fol.transfer(${q(r.id)}, ${l.idx})`, "ghost sm") : ""}
        ${btn("Écriture inverse", `A.fol.reverse(${q(r.id)}, ${l.idx})`, "ghost sm")}</span>`])
    const pays = allPayments().filter((p) => p.resId === r.id)
    return `<div class="card"><div class="row between"><span class="big">Ch. ${esc(r.room)} — ${esc(gname(r))}</span>${rt ? badge(`Routage : ${rt.what} → ${accName(rt.to)}`, "outline") : ""}</div>
      <div class="muted">${esc(r.id)} · du ${fd(r.from)} au ${fd(r.to)} · garantie ${esc(r.guarantee)}</div>
      <div class="grid" style="margin:14px 0">${kpi("Total folio", money(w.f.total), "toutes fenêtres")}${kpi("Réglé", money(w.f.paid), "paiements + transferts")}${kpi("Solde", money(w.f.balance), w.f.balance > 0 ? "à encaisser avant départ" : "soldé")}</div>
      <h3>Fenêtre A — client</h3>${tbl(["Désignation", "#Montant", ""], lineRows(w.A), "Aucune imputation.", `<tfoot><tr><td>Sous-total A</td><td class="num">${money(w.tA)}</td><td></td></tr></tfoot>`)}
      <h3>Fenêtre B — ${rt ? esc(accName(rt.to)) : "société / compte maître"}</h3>${tbl(["Désignation", "#Montant", ""], lineRows(w.B), "Fenêtre vide : définir un routage ou basculer une ligne.", `<tfoot><tr><td>Sous-total B${w.tr ? ` (dont ${money(w.tr)} transférés au city ledger)` : ""}</td><td class="num">${money(w.tB)}</td><td></td></tr></tfoot>`)}
      ${rt && w.restB > 0 ? `<div class="row" style="margin-top:10px">${btn(`Transférer ${money(w.restB)} au city ledger (${accName(rt.to)})`, `A.fol.toLedger(${q(r.id)})`)}<span class="muted">Le check-out exige un solde nul, sauf transfert city ledger autorisé (RG-FOL-02).</span></div>` : ""}
      ${others.length ? `<div class="row" style="margin-top:10px"><label for="fol-target" style="margin:0">Folio cible des transferts</label><select id="fol-target" style="max-width:280px">${others.map((x) => `<option value="${esc(x.id)}">Ch. ${esc(x.room)} · ${esc(gname(x))}</option>`).join("")}</select></div>` : ""}
      <div class="cols" style="margin-top:6px"><section><h3>Imputer une prestation</h3>${form([
        field("po-code", "Code", select("po-code", ["Restaurant", "Bar", "Minibar", "Blanchisserie", "Spa", "Téléphone", "Frais divers"], "Restaurant")),
        field("po-amount", "Montant", input("po-amount", "", 'type="number" min="0" step="500"')),
        field("po-win", "Fenêtre", select("po-win", [["A", "A — client"], ["B", "B — société"]], "A")),
        `<div class="full">${btn("Imputer", `A.fol.post(${q(r.id)})`, "ghost")}</div>`])}
        <h3>Routage</h3>${form([field("rt-what", "Prestations", select("rt-what", ["Hébergement", "Tout le folio"], rt?.what || "Hébergement")), field("rt-to", "Vers", select("rt-to", S.ar.accounts.map((a) => [a.id, a.name]), rt?.to || "AC1")),
          `<div class="full row">${btn("Définir le routage", `A.fol.route(${q(r.id)})`, "ghost")}${rt ? btn("Supprimer", `A.fol.unroute(${q(r.id)})`, "ghost") : ""}</div>`])}</section>
      <section><h3>Encaisser</h3>${form([
        field("py-mode", "Moyen", select("py-mode", ["Espèces", "Carte (jeton PSP)", "Mobile Money (Orange Money)", "Mobile Money (MTN MoMo)", "Mobile Money (Wave)", "Mobile Money (Moov)", "Virement", "Chèque"], "Mobile Money (Orange Money)")),
        field("py-amount", "Montant", input("py-amount", String(Math.max(0, w.f.balance)), 'type="number" min="0" step="500"')),
        field("py-phone", "N° mobile money", input("py-phone", (G(r.guest) || {}).phone || "+225 07 ", 'placeholder="+225 07 …"')),
        `<div class="full" id="py-err"></div>`,
        `<div class="full">${btn("Encaisser", `A.fol.pay(${q(r.id)})`, "accent")}</div>`])}
        <p class="muted">Aucun numéro de carte n'est saisi ni stocké : seul un jeton PSP est conservé (RG-FOL-01). Mobile money : confirmation asynchrone de l'opérateur (simulée).</p>
        ${tbl(["Réf.", "Moyen", "#Montant", "Statut"], pays.map((p) => [esc(p.id), esc(p.mode), money(p.amount), payStatus(p.status)]), "Aucun paiement.")}</section></div></div>`
  }

  // ---------- Paiements ----------
  function payJournal() {
    const ps = allPayments()
    return `${tbl(["Réf.", "Date", "Folio", "Moyen", "#Montant", "Statut", "Risque IA", "Note", ""], ps.map((p) => [esc(p.id), esc(p.at), p.resId ? `${esc(p.resId)}${muted(R(p.resId) ? gname(R(p.resId)) : "")}` : "—", esc(p.mode), money(p.amount), payStatus(p.status), fraudBadge(fraud(p)), ref(p.note || ""),
        p.status === "à vérifier" || p.status === "en attente" ? btn("Interroger l'opérateur", `A.fol.verifyMM(${q(p.id)})`, "sm") : ""]))}
      ${aiBox("Détection de fraude", "Scores en temps réel (vélocité, montant, carte étrangère, remboursement après départ, remboursements répétés par un même agent). Au-delà de 60/100, l'opération est bloquée pour revue humaine. Aucun paiement actuel ne dépasse le seuil.")}
      <h2>Rétrofacturations et litiges</h2>${tbl(["Réf.", "Ouvert le", "Paiement", "#Montant", "Motif", "Statut", ""], S.disputes.map((d) => [esc(d.id), fd(d.opened), esc(d.pay), money(d.amount), esc(d.reason), badge(d.status, d.status === "en cours" ? "dark" : "outline"),
        d.status === "en cours" ? btn("Envoyer les justificatifs", `A.fol.dispute(${q(d.id)})`, "ghost sm") : ""]))}
      <p class="muted">EF-FOL-005 à EF-FOL-007, EF-FOL-015. PSP et agrégateur mobile money simulés.</p>`
  }
  function depositsTab() {
    const st = (d) => (d.status === "attendu" && d.due < S.biz ? "en retard" : d.status)
    return `${tbl(["Réf.", "Réservation / groupe", "#Montant", "Échéance", "Statut", ""], S.deposits.map((d) => [esc(d.id), `${esc(d.resId || d.group)}${muted(d.label || (R(d.resId) ? gname(R(d.resId)) : ""))}`, money(d.amount), fd(d.due),
        badge(st(d), st(d) === "reçu" ? "on" : st(d) === "en retard" ? "dark" : "outline") + (d.reminders ? muted(`${d.reminders} relance(s)`) : ""),
        st(d) === "reçu" ? "" : `<span class="row" style="flex-wrap:nowrap">${btn("Relancer", `A.fol.remindDeposit(${q(d.id)})`, "ghost sm")}${btn("Encaisser", `A.fol.cashDeposit(${q(d.id)})`, "sm")}</span>`]))}
      <p class="muted">Échéanciers d'acompte et relance automatique des impayés (EF-RES-006) ; l'encaissement crédite le folio de la réservation.</p>`
  }
  function refundsTab() {
    const ps = allPayments().filter((p) => p.status === "confirmé" && p.amount > 0 && !/City ledger/.test(p.mode))
    return `<div class="cols"><section>${card("Demander un remboursement", form([
      field("rf-pay", "Paiement d'origine", select("rf-pay", ps.map((p) => [p.id, `${p.id} · ${p.resId || ""} · ${p.mode} · ${money(p.amount)}`]), ps[0]?.id)),
      field("rf-amount", "Montant", input("rf-amount", "", 'type="number" min="0" step="500"')),
      field("rf-why", "Motif", input("rf-why", "", 'placeholder="Ex. geste commercial"'), "full"),
      `<div class="full" id="rf-err"></div>`,
      `<div class="full">${btn("Soumettre", "A.fol.refund()")}</div>`]) + `<p class="muted">Au-delà de ${money(REFUND_LIMIT)}, deux validations sont exigées (RG-FOL-04).</p>`)}</section>
      <section><h2>Demandes</h2>${tbl(["Réf.", "Folio", "#Montant", "Motif", "Demandé par", "Risque IA", "Statut", ""], S.refunds.map((x) => [esc(x.id), esc(x.label || `${x.resId} · ${R(x.resId) ? gname(R(x.resId)) : ""}${x.note ? " (" + x.note + ")" : ""}`), money(x.amount), esc(x.reason), esc(x.by), fraudBadge(fraud({ ...x, refund: true })),
        badge(x.status, x.status === "effectué" ? "on" : x.status === "refusé" ? "" : "dark"),
        x.status === "à valider" ? `<span class="row" style="flex-wrap:nowrap">${btn("2e validation", `A.fol.approve(${q(x.id)})`, "sm")}${btn("Refuser", `A.fol.reject(${q(x.id)})`, "ghost sm")}</span>` : ref(x.approvedBy ? "validé par " + x.approvedBy : "")]))}</section></div>`
  }
  function creditsTab() {
    const inv = allInvoices(), cur = inv.find((i) => i.id === ui.sejCredit)
    return `<p class="muted">Une facture émise n'est jamais modifiée ni supprimée : la correction passe par un avoir (EF-FOL-010). Numérotation continue par série (RG-FOL-06). Transmission à la plateforme fiscale simulée.</p>
      ${tbl(["Facture", "Date", "Client", "#Montant TTC", "#Avoirs", "Transmission", ""], inv.map((i) => [esc(i.id), fd(i.date), esc(i.client), money(i.amount), credited(i.id) ? money(credited(i.id)) : "—", badge("Transmise (simulé)", "outline"),
        credited(i.id) < i.amount ? btn("Émettre un avoir", `ui.sejCredit=${q(i.id)};render()`, "ghost sm") : badge("Annulée par avoir", "")]))}
      ${cur ? card(`Avoir sur la facture ${cur.id}`, form([field("cr-amount", `Montant (max ${money(cur.amount - credited(cur.id))})`, input("cr-amount", String(cur.amount - credited(cur.id)), 'type="number" min="0" step="500"')),
        field("cr-why", "Motif", input("cr-why", "", 'placeholder="Ex. prestation non rendue"')), `<div class="full" id="cr-err"></div>`,
        `<div class="full row">${btn("Émettre l'avoir", `A.fol.credit(${q(cur.id)})`)}${btn("Fermer", "ui.sejCredit=null;render()", "ghost")}</div>`]), 'style="margin-top:14px"') : ""}
      <h2>Avoirs émis</h2>${tbl(["Avoir", "Date", "Facture", "#Montant", "Motif"], S.credits.map((c) => [esc(c.id), fd(c.date), esc(c.invoice), money(c.amount), esc(c.reason)]))}`
  }

  // ---------- City ledger ----------
  const BUCKETS = [["0-30 j", 0, 30], ["31-60 j", 31, 60], ["61-90 j", 61, 90], ["> 90 j", 91, 1e9]]
  function arAccounts() {
    const a = S.ar.accounts.find((x) => x.id === ui.sejAcc) || S.ar.accounts[0]
    const inv = S.ar.invoices.filter((i) => i.acc === a.id)
    return `${tbl(["Compte", "#Plafond", "#Encours", "#Disponible", "Échéance", ...BUCKETS.map((b) => "#" + b[0]), ""], S.ar.accounts.map((x) => {
        const open = S.ar.invoices.filter((i) => i.acc === x.id && arOpen(i) > 0)
        return [esc(x.name), money(x.limit), money(accOpen(x.id)), money(x.limit - accOpen(x.id)), `${x.terms} j`,
          ...BUCKETS.map(([, lo, hi]) => { const v = sum(open.filter((i) => age(i) >= lo && age(i) <= hi), arOpen); return v ? money(v) : "—" }),
          btn("Relevé", `ui.sejAcc=${q(x.id)};render()`, x.id === a.id ? "sm" : "ghost sm")]
      }))}
      <h2>Relevé — ${esc(a.name)}</h2><p class="muted">${esc(a.contact)} · paiement à ${a.terms} jours</p>
      ${tbl(["Pièce", "Date", "Réf.", "#Montant", "#Réglé", "#Reste", "Âge", "Statut"], inv.map((i) => [esc(i.id), fd(i.date), esc(i.ref), money(i.amount), money(i.paid), money(arOpen(i)), age(i) + " j",
        arOpen(i) <= 0 ? badge("Lettrée", "on") : age(i) > a.terms ? badge("Échue", "dark") : badge("Non échue", "outline")]), "Aucune pièce.")}`
  }
  function arMatch() {
    const open = S.ar.receipts.filter((x) => !x.matched)
    return `<p class="muted">Paiements reçus (relevé bancaire importé, simulé) à rapprocher des factures city ledger (EF-FOL-011).</p>
      ${tbl(["Encaissement", "Date", "Compte", "Libellé bancaire", "#Montant", "Suggestion IA", ""], open.map((x) => {
        const sug = S.ar.invoices.find((i) => i.acc === x.acc && arOpen(i) === x.amount)
        const cand = S.ar.invoices.filter((i) => i.acc === x.acc && arOpen(i) > 0)
        return [esc(x.id), fd(x.date), esc(accName(x.acc)), ref(x.label), money(x.amount), sug ? badge(`${sug.id} (montant exact)`, "on") : ref("aucune correspondance exacte"),
          `<span class="row" style="flex-wrap:nowrap"><select id="lt-${esc(x.id)}" aria-label="Pièce à lettrer" style="min-width:120px">${cand.map((i) => `<option value="${esc(i.id)}" ${sug === i ? "selected" : ""}>${esc(i.id)} · ${money(arOpen(i))}</option>`).join("")}</select>${btn("Lettrer", `A.fol.match(${q(x.id)})`, "sm")}</span>`]
      }), "Tous les encaissements sont lettrés.")}
      ${aiBox("Rapprochement automatique", open.length ? `${open.filter((x) => S.ar.invoices.some((i) => i.acc === x.acc && arOpen(i) === x.amount)).length} encaissement(s) sur ${open.length} correspondent exactement à une facture ouverte ; les autres sont proposés par ordre d'ancienneté. Validation humaine requise.` : "Rien à rapprocher.")}
      <h2>Lettrés</h2>${tbl(["Encaissement", "Compte", "#Montant", "Pièce"], S.ar.receipts.filter((x) => x.matched).map((x) => [esc(x.id), esc(accName(x.acc)), money(x.amount), esc(x.matched)]), "Aucun lettrage dans cette session.")}`
  }
  function arRemind() {
    const due = S.ar.invoices.filter((i) => arOpen(i) > 0).map((i) => ({ i, a: S.ar.accounts.find((x) => x.id === i.acc) })).filter((x) => age(x.i) > x.a.terms)
      .sort((x, y) => y.a.late - x.a.late || age(y.i) - age(x.i))
    return `${aiBox("Prédiction de retard de paiement", due.length ? `Relancer en priorité ${due[0].a.name} : retard probable de ${due[0].a.late} jours d'après l'historique de règlement (modèle simulé).` : "Aucune créance échue.")}
      ${tbl(["Pièce", "Compte", "#Reste", "Âge", "Retard prédit", "Relances", ""], due.map(({ i, a }) => [esc(i.id), esc(a.name), money(arOpen(i)), age(i) + " j", badge(a.late + " j", a.late > 45 ? "dark" : "outline"), i.reminders || 0,
        btn("Relancer (e-mail simulé)", `A.fol.remindAr(${q(i.id)})`, "ghost sm")]), "Aucune créance échue.")}`
  }

  // ---------- Caisse ----------
  function shiftCash(s) {
    const cash = allPayments().filter((p) => p.shift === s.id && p.mode === "Espèces" && p.status === "confirmé")
    const out = S.refunds.filter((x) => x.shift === s.id && x.status === "effectué" && x.mode === "Espèces")
    return { cash, inSum: sum(cash, (p) => p.amount), outSum: sum(out, (x) => x.amount), expected: s.float + sum(cash, (p) => p.amount) - sum(out, (x) => x.amount) }
  }
  function cashTab() {
    const s = openShift()
    const byMode = (sh) => { const m = {}; allPayments().filter((p) => p.shift === sh.id && p.status === "confirmé").forEach((p) => (m[p.mode] = (m[p.mode] || 0) + p.amount)); return Object.entries(m).map(([label, value]) => ({ label, value })) }
    return `<div class="cols"><section>${s ? card(`Caisse ${s.id} — ouverte`, `<div class="muted">${esc(s.user)} · ${esc(s.post)} · ouverte à ${esc(s.opened)}</div>
        <div class="grid" style="margin:14px 0">${kpi("Fonds de caisse", money(s.float), "à l'ouverture")}${kpi("Espèces encaissées", money(shiftCash(s).inSum), `${shiftCash(s).cash.length} opération(s)`)}${kpi("Attendu en caisse", money(shiftCash(s).expected), "fonds + espèces − sorties")}</div>
        ${byMode(s).length ? `<h3>Encaissements du service par moyen</h3>${bars(byMode(s), money)}` : `<p class="muted">Aucun encaissement sur ce service pour l'instant.</p>`}
        <h3>Clôture</h3>${form([field("cs-count", "Espèces comptées", input("cs-count", "", 'type="number" min="0" step="500"')), field("cs-why", "Motif d'écart (si > " + money(CASH_GAP_LIMIT) + ")", input("cs-why", "")),
          `<div class="full" id="cs-err"></div>`, `<div class="full">${btn("Clôturer la caisse", "A.fol.closeShift()")}</div>`])}`)
      : card("Aucune caisse ouverte", `<p class="muted">Les encaissements en espèces sont bloqués tant qu'aucune caisse n'est ouverte sur le poste.</p>${form([field("cs-float", "Fonds de caisse", input("cs-float", "50000", 'type="number" min="0" step="500"')), `<div class="full">${btn("Ouvrir la caisse", "A.fol.openShift()")}</div>`])}`)}</section>
      <section><h2>Services clôturés</h2>${tbl(["Service", "Date", "Caissier", "#Attendu", "#Compté", "#Écart", "Motif"], S.shifts.filter((x) => x.status === "fermée").map((x) => [esc(x.id), fd(x.date), esc(x.user), money(x.expected), money(x.counted), x.gap ? `<strong>${money(x.gap)}</strong>` : money(0), esc(x.reason || "")]))}</section></div>`
  }
  function folKpi() {
    const open = S.ar.invoices.filter((i) => arOpen(i) > 0), totalOpen = sum(open, arOpen)
    const billed90 = sum(S.ar.invoices.filter((i) => age(i) <= 90), (i) => i.amount)
    const ps = allPayments().filter((p) => p.status === "confirmé")
    const modes = {}
    ps.forEach((p) => { const k = /Mobile/.test(p.mode) ? "Mobile money" : /Carte/.test(p.mode) ? "Carte" : /City/.test(p.mode) ? "City ledger" : p.mode; modes[k] = (modes[k] || 0) + p.amount })
    const tot = sum(Object.values(modes))
    const gaps = S.shifts.filter((x) => x.status === "fermée")
    return `<div class="grid">
        ${kpi("DSO", Math.round((totalOpen / Math.max(1, billed90)) * 90) + " j", "encours / facturé 90 j × 90")}
        ${kpi("Créances ouvertes", money(totalOpen), `${open.length} pièce(s)`)}
        ${kpi("Écarts de caisse", money(sum(gaps, (x) => x.gap)), `${gaps.length} service(s) clôturé(s)`)}
        ${kpi("Taux de rétrofacturations", pct((S.disputes.length / Math.max(1, ps.length)) * 100), `${S.disputes.length} litige(s) / ${ps.length} transactions`)}</div>
      <div class="cols"><section><h3>Âge des créances</h3>${bars(BUCKETS.map(([label, lo, hi]) => ({ label, value: sum(open.filter((i) => age(i) >= lo && age(i) <= hi), arOpen) })), money)}</section>
      <section><h3>Répartition des moyens de paiement</h3>${bars(Object.entries(modes).map(([label, v]) => ({ label: `${label} (${Math.round((v / tot) * 100)} %)`, value: v })), money)}</section></div>
      <p class="muted">§12.12 — valeurs calculées sur les données d'exemple.</p>`
  }

  // ---------- Actions séjour (sej) ----------
  // Conversion d'un bloc de groupe en réservations nominatives (appelée par A.sej.genGroup)
  const genGroupRun = (g) => {
    const todo = g.rooming.filter((x) => !x.resId)
    if (!todo.length) return toast("Toutes les lignes ont déjà une réservation")
    let made = 0
    for (const x of todo) {
      const full = nightsOk(x.type, g.from, g.to)
      if (full) { toast(`${x.name} : plus de ${T(x.type).label} le ${fd(full)}`); break }
      const id = "R-" + ui.resSeq++
      D.reservations.push({ id, guest: newGuest(x.name), type: x.type, from: g.from, to: g.to, rate: g.rate[x.type], guarantee: "Compte société", status: "confirmee", group: g.id, request: g.name })
      S.meta[id] = { source: "Groupe", segment: "Séminaire / groupe", booked: S.biz }
      S.routing[id] = { what: "Hébergement", to: g.account }
      x.resId = id
      made++
    }
    if (made) toast(`${made} réservation(s) générée(s) pour ${g.name}, hébergement routé vers le compte société`)
    render()
  }
  // Un bloc de groupe retient ses chambres non encore converties en réservations, jusqu'au cut-off
  holdRooms((type, date) => S.groups.reduce((n, g) => {
    if (g.released || ui.holdSkip === g.id || !(g.from <= date && date < g.to)) return n
    const made = D.reservations.filter((r) => r.group === g.id && r.type === type && r.status !== "annulee").length
    return n + Math.max(0, (g.block[type] || 0) - made)
  }, 0))

  const sej = {
    preassign(id, no) {
      const r = R(id)
      if (no && busy(no, r.from, r.to, id)) return toast(`Chambre ${no} déjà prise sur ces dates`)
      r.preRoom = no || undefined
      toast(no ? `${id} : chambre ${no} pré-attribuée` : `${id} : pré-attribution retirée`)
      render()
    },
    applyProps() {
      const props = proposals(D.reservations.filter((r) => r.status === "confirmee" && !r.preRoom && r.to > S.biz))
      props.forEach((p) => (p.r.preRoom = p.room.no))
      toast(`${props.length} chambre(s) pré-attribuée(s), modifiables`)
      render()
    },
    upsell(id, to, price) {
      const r = R(id)
      const full = nightsOk(to, r.from, r.to, id)
      if (full) return toast(`Plus de ${T(to).label} disponible le ${fd(full)}`)
      S.upsells.unshift({ date: S.biz, resId: id, label: `${T(r.type).label} → ${T(to).label}`, amount: price * nights(r.from, r.to) })
      Object.assign(r, { type: to, rate: r.rate + price, preRoom: undefined })
      toast(`${id} surclassée en ${T(to).label} (+${money(price)}/nuit)`)
      render()
    },
    walkin() {
      const name = val("wi-name"), no = val("wi-room"), n = Number(val("wi-nights")), amount = Number(val("wi-amount")), nat = val("wi-nat"), mode = val("wi-pay")
      if (!name) return err("wi-err", "Indiquez le nom du client.")
      if (!no) return err("wi-err", "Aucune chambre propre et libre.")
      if (!(n >= 1)) return err("wi-err", "Nombre de nuits invalide.")
      if (!$("#wi-id").checked) return err("wi-err", "Vérifiez la pièce d'identité.")
      if (nat !== "Côte d'Ivoire" && !$("#wi-police").checked) return err("wi-err", "Fiche de police obligatoire pour un voyageur étranger (RG-FOF-07).")
      const room = D.rooms.find((x) => x.no === no), rate = T(room.type).rate, to = addDays(S.biz, n)
      if (amount < rate) return err("wi-err", `Garantie immédiate d'au moins une nuit (${money(rate)}).`)
      if (mode === "Espèces" && !openShift()) return err("wi-err", "Aucune caisse ouverte : impossible d'encaisser des espèces.")
      const full = nightsOk(room.type, S.biz, to)
      if (full) return err("wi-err", `Plus de ${T(room.type).label} disponible la nuit du ${fd(full)} : chambre réservée pour une arrivée. Réduisez le séjour ou changez de chambre.`)
      if (busy(no, S.biz, to)) return err("wi-err", `La chambre ${no} est pré-attribuée sur une partie du séjour.`)
      const guest = newGuest(name, { phone: val("wi-phone"), nationality: nat, idDoc: "Pièce vérifiée au comptoir" })
      const id = "R-" + ui.resSeq++
      D.reservations.push({ id, guest, type: room.type, from: S.biz, to, rate, guarantee: mode === "Espèces" ? "Acompte" : "Carte bancaire", status: "arrivee", room: no, key: "active", walkin: true })
      S.meta[id] = { source: "Walk-in", segment: "Individuel", booked: S.biz, mode: "comptoir" }
      D.extras[id] = []
      D.payments[id] = amount
      logPay({ resId: id, mode, amount, note: "Garantie walk-in" })
      S.ckTimes.push(150)
      toast(`Walk-in enregistré — chambre ${no}, clé encodée (simulé)`)
      render()
    },
    move(id) {
      const r = R(id), to = val("mv-to")
      if (!to) return err("mv-err", "Aucune chambre propre et libre disponible.")
      const room = D.rooms.find((x) => x.no === to)
      if (room.type !== r.type && nightsOk(room.type, S.biz, r.to, id)) return err("mv-err", `Type ${T(room.type).label} complet sur une des nuits restantes.`)
      const from = r.room
      if (val("mv-rate") === "new") r.rate = T(room.type).rate
      Object.assign(r, { room: to, type: room.type })
      D.rooms.find((x) => x.no === from).hk = "sale"
      S.moves.unshift({ at: `${today} ${nowT()}`, resId: id, from, to, reason: val("mv-why"), by: USER })
      toast(`Ch. ${from} → ${to} : ancienne clé révoquée, accès transféré (simulé)`)
      render()
    },
    extend(id) {
      const r = R(id), to = val("ex-to")
      if (!to || to <= S.biz || to <= r.from) return err("ex-err", "La date de départ doit être après la date hôtelière.")
      if (to > r.to) {
        const full = nightsOk(r.type, r.to, to, id)
        if (full) return err("ex-err", `Plus de ${T(r.type).label} disponible la nuit du ${fd(full)}.`)
        if (busy(r.room, r.to, to, id)) return err("ex-err", `La chambre ${r.room} est pré-attribuée à une autre réservation : changer de chambre d'abord.`)
      }
      const old = r.to
      r.to = to
      toast(`${id} : départ ${fd(old)} → ${fd(to)}, validité de la clé ajustée (simulé)`)
      render()
    },
    walk() {
      const r = R(val("wk-res")), h = S.partners.find((x) => x.name === val("wk-hotel")), taxi = Number(val("wk-taxi")) || 0
      if (!confirm(`Déloger ${gname(r)} vers ${h.name} ?`)) return
      Object.assign(r, { status: "annulee", walked: true })
      S.walks.unshift({ id: uid("W"), date: S.biz, name: gname(r), hotel: h.name, nights: 1, cost: h.rate + taxi, comp: val("wk-comp") })
      toast(`${gname(r)} délogé — réservation transmise à ${h.name} (simulé)`)
      render()
    },
    remind(id) {
      toast(`Rappel pré-arrivée envoyé à ${gname(R(id))} (SMS simulé)`)
      S.log.unshift({ id: uid("MC"), at: `${today} ${nowT()}`, author: USER, type: "Message client", room: "", text: `Rappel pré-arrivée envoyé pour ${id}.`, status: "traitée", doneMin: 1 })
    },
    askGuarantee(id) {
      toast(`Lien de paiement de garantie envoyé pour ${id} (simulé)`)
      S.deposits.push({ id: uid("AC"), resId: id, amount: R(id).rate, due: S.biz, status: "attendu" })
    },
    noshow(id, silent) {
      const r = R(id), amount = penalty(r)
      if (!silent && !confirm(`Déclarer ${id} en no-show ? Pénalité : ${money(amount)} (${penaltyText(r)}).`)) return
      Object.assign(r, { status: "annulee", noShow: true })
      if (["Carte bancaire", "Compte société"].includes(r.guarantee)) {
        logPay({ resId: id, mode: r.guarantee === "Carte bancaire" ? "Carte (jeton PSP)" : "City ledger", amount, note: "Pénalité no-show", shift: undefined })
        D.payments[id] = (D.payments[id] || 0) + amount
      }
      S.noshows.unshift({ date: S.biz, resId: id, name: gname(r), guarantee: r.guarantee, amount, how: penaltyText(r) })
      if (!silent) { toast(`${id} : no-show enregistré`); render() }
    },
    newGroup() {
      const name = val("gr-name"), from = val("gr-from"), to = val("gr-to")
      const block = Object.fromEntries(typeOrder.map((t) => [t, Number(val("gr-" + t)) || 0]))
      if (!name) return err("gr-err", "Nom du groupe obligatoire.")
      if (!from || !to || to <= from) return err("gr-err", "Dates invalides.")
      if (!sum(typeOrder, (t) => block[t])) return err("gr-err", "Bloc vide.")
      for (const t of typeOrder) for (let d = from; d < to; d = addDays(d, 1))
        if (block[t] && available(t, d) - blockHeld(t, d) < block[t]) return err("gr-err", `Pas assez de ${T(t).label} libres la nuit du ${fd(d)} (en tenant compte des autres blocs).`)
      const id = uid("GRP")
      S.groups.push({ id, name, account: val("gr-acc"), from, to, cutoff: addDays(from, -5), rate: Object.fromEntries(typeOrder.map((t) => [t, Math.round(T(t).rate * 0.9)])), block, released: false, rooming: [] })
      ui.sejGroup = id
      toast("Bloc créé, cut-off à J-5")
      render()
    },
    importRooming(gid) {
      const g = S.groups.find((x) => x.id === gid)
      const rows = val("gr-import").split("\n").map((l) => l.split(/[;,\t]/).map((s) => s.trim())).filter((x) => x[0])
      if (!rows.length) return err("gr-ierr", "Collez au moins une ligne « Nom;Type ».")
      const add = rows.map(([name, t]) => ({ name, type: typeOrder.includes((t || "").toUpperCase()) ? t.toUpperCase() : "STD" }))
      for (const t of typeOrder) { const n = g.rooming.filter((x) => x.type === t).length + add.filter((x) => x.type === t).length; if (n > g.block[t]) return err("gr-ierr", `${n} noms en ${T(t).label} pour ${g.block[t]} chambre(s) bloquée(s) : augmenter le bloc d'abord.`) }
      g.rooming.push(...add)
      toast(`${add.length} nom(s) importé(s)`)
      render()
    },
    genGroup(gid) {
      const g = S.groups.find((x) => x.id === gid)
      ui.holdSkip = gid // les réservations générées consomment le bloc du groupe, pas le reste de l'inventaire
      try { return genGroupRun(g) } finally { delete ui.holdSkip }
    },
    cutoff(gid) {
      const g = S.groups.find((x) => x.id === gid)
      const freed = sum(typeOrder, (t) => g.block[t] - g.rooming.filter((x) => x.type === t && x.resId).length)
      if (!confirm(`Appliquer le cut-off : ${freed} chambre(s) non reprise(s) retournent à l'inventaire ?`)) return
      typeOrder.forEach((t) => (g.block[t] = g.rooming.filter((x) => x.type === t && x.resId).length))
      g.released = true
      toast(`${freed} chambre(s) rendue(s) à l'inventaire`)
      render()
    },
    checkWait() {
      let n = 0
      S.waitlist.filter((w) => w.status === "en attente" && !nightsOk(w.type, w.from, w.to)).forEach((w) => { w.status = "notifiée"; n++ })
      toast(n ? `${n} client(s) notifié(s) d'une disponibilité (simulé)` : "Aucune nouvelle disponibilité")
      render()
    },
    convertWait(wid) {
      const w = S.waitlist.find((x) => x.id === wid)
      const full = nightsOk(w.type, w.from, w.to)
      if (full) return toast(`Complet le ${fd(full)}`)
      const id = "R-" + ui.resSeq++
      D.reservations.push({ id, guest: newGuest(w.name, { email: w.contact.includes("@") ? w.contact : "", phone: w.contact.includes("@") ? "" : w.contact }), type: w.type, from: w.from, to: w.to, rate: T(w.type).rate, guarantee: "Aucune", status: "confirmee" })
      S.meta[id] = { source: "Liste d'attente", segment: "Loisirs", booked: S.biz }
      Object.assign(w, { status: "convertie", resId: id })
      toast(`Réservation ${id} créée depuis la liste d'attente`)
      render()
    },
    addWait() {
      const name = val("wl-name"), from = val("wl-from"), to = val("wl-to")
      if (!name || !from || !to || to <= from) return err("wl-err", "Nom et dates valides obligatoires.")
      S.waitlist.push({ id: uid("WL"), name, contact: val("wl-contact"), type: val("wl-type"), from, to, prio: val("wl-prio"), status: "en attente" })
      toast("Ajouté à la liste d'attente")
      render()
    },
    openDraft() {
      const d = parseMail(ui.sejMail ?? SAMPLE_MAIL)
      go("reservations/new")
      setTimeout(() => {
        const set = (s, v) => { const e = $(s); if (e) e.value = v }
        set("#f-newname", d.name); set("#f-from", d.from); set("#f-to", d.to); set("#f-type", d.type); set("#f-rate", T(d.type).rate); set("#f-req", d.req)
        toast("Brouillon prérempli : à vérifier puis valider")
      }, 50)
    },
    runAudit() {
      if (auditRun) return
      const blk = auditChecks().filter((c) => c.block && !c.ok)
      if (blk.length) return toast("Audit bloqué : " + blk[0].hint)
      const date = S.biz, run = (auditRun = { step: 0, notes: [] }), res = { noshows: 0, tax: 0, rooms: 0 }
      const work = [
        () => "Aucune anomalie bloquante.",
        () => { const l = pendingArr(date); l.forEach((r) => sej.noshow(r.id, true)); res.noshows = l.length; return l.length ? `${l.length} no-show(s) : ${l.map((r) => r.id).join(", ")}` : "Aucun no-show." },
        () => { const l = inHouse().filter((r) => r.to > date); l.forEach((r) => (D.extras[r.id] = D.extras[r.id] || []).push({ label: `Taxe de séjour — nuit du ${fd(date)}`, amount: TAXE, code: "TAXE" })); res.rooms = l.length; res.tax = l.length * TAXE; return `${money(res.tax)} sur ${l.length} folio(s) (nuitées déjà valorisées au folio)` },
        () => "Rapport d'occupation, main courante, balance des folios et caisses archivés (PDF simulé).",
        () => { S.biz = addDays(date, 1); S.audits.unshift({ date, at: nowT(), by: USER, ...res }); return `Date hôtelière : ${fd(S.biz)}` },
      ]
      const next = () => {
        run.notes[run.step] = work[run.step]()
        run.step++
        if (location.hash.startsWith("#sej-audit")) render()
        if (run.step < work.length) setTimeout(next, 450)
        else toast(`Audit terminé — date hôtelière ${fd(S.biz)}`)
      }
      render()
      setTimeout(next, 300)
    },
    closeAudit() { auditRun = null; render() },
    addLog() {
      const text = val("lg-text")
      if (!text) return toast("Saisissez un texte")
      S.log.unshift({ id: uid("MC"), at: `${today} ${nowT()}`, author: USER, type: val("lg-type"), room: val("lg-room"), text, due: val("lg-due") || undefined, status: "ouverte", t0: Date.now() })
      toast("Ajouté à la main courante")
      render()
    },
    doneLog(id) {
      const e = S.log.find((x) => x.id === id)
      Object.assign(e, { status: "traitée", doneMin: e.t0 ? Math.max(1, Math.round((Date.now() - e.t0) / 60000)) : 25 })
      toast("Entrée marquée traitée")
      render()
    },
  }

  // ---------- Actions facturation (fol) ----------
  const fol = {
    post(id) {
      const amount = Number(val("po-amount"))
      if (!(amount > 0)) return toast("Indiquez un montant")
      ;(D.extras[id] = D.extras[id] || []).push({ label: val("po-code"), amount, win: val("po-win"), code: val("po-code") })
      toast("Prestation imputée")
      render()
    },
    swap(id, i) { const l = D.extras[id][i]; const w = windows(R(id)); const cur = w.A.concat(w.B).find((x) => x.idx === i).win; l.win = cur === "A" ? "B" : "A"; render() },
    reverse(id, i) {
      const l = D.extras[id][i]
      if (!confirm(`Annuler « ${l.label} » (${money(l.amount)}) par une écriture inverse ?`)) return
      l.reversed = true
      D.extras[id].push({ label: `Écriture inverse : ${l.label}`, amount: -l.amount, win: l.win, reversalOf: l.label })
      toast("Écriture inverse passée (RG-FOL-03)")
      render()
    },
    transfer(id, i) {
      const to = val("fol-target")
      if (!to) return
      const [l] = D.extras[id].splice(i, 1)
      ;(D.extras[to] = D.extras[to] || []).push({ ...l, label: `${l.label} (transféré de la ch. ${R(id).room})`, win: "A" })
      toast(`Ligne transférée vers la chambre ${R(to).room}`)
      render()
    },
    route(id) {
      S.routing[id] = { what: val("rt-what"), to: val("rt-to") }
      toast(`Routage enregistré : ${S.routing[id].what} → ${accName(S.routing[id].to)}`)
      render()
    },
    unroute(id) { delete S.routing[id]; (D.extras[id] || []).forEach((l) => (l.win = "A")); toast("Routage supprimé"); render() },
    toLedger(id) {
      const r = R(id), w = windows(r), rt = S.routing[id], acc = S.ar.accounts.find((a) => a.id === rt.to)
      if (accOpen(acc.id) + w.restB > acc.limit) return toast(`Plafond de ${acc.name} dépassé : validation du contrôleur financier requise`)
      const inv = { id: "CL-0" + S.ar.seq++, acc: acc.id, date: today, amount: w.restB, paid: 0, ref: `${id} ch. ${r.room}` }
      S.ar.invoices.unshift(inv)
      S.transferred[id] = (S.transferred[id] || 0) + w.restB
      logPay({ resId: id, mode: `City ledger (${acc.name})`, amount: w.restB, note: `Transfert ${inv.id}` })
      D.payments[id] = (D.payments[id] || 0) + w.restB
      toast(`${money(w.restB)} transférés au compte ${acc.name} (${inv.id})`)
      render()
    },
    pay(id) {
      const mode = val("py-mode"), amount = Number(val("py-amount"))
      if (!(amount > 0)) return err("py-err", "Montant invalide.")
      if (mode === "Espèces" && !openShift()) return err("py-err", "Aucune caisse ouverte : ouvrez une caisse (Finance › Caisses).")
      if (/Mobile/.test(mode)) {
        if (val("py-phone").replace(/\D/g, "").length < 12) return err("py-err", "Numéro mobile money incomplet.")
        const p = logPay({ resId: id, mode, amount, status: "en attente", note: "Demande envoyée à l'opérateur (simulé)" })
        toast("Demande envoyée : le client valide sur son téléphone…")
        const pid = p.id
        setTimeout(() => { const p = S.payLog.find((x) => x.id === pid); if (!p || p.status !== "en attente") return; p.status = "confirmé"; p.note = "Confirmé par l'opérateur (simulé)"; D.payments[id] = (D.payments[id] || 0) + amount; toast(`Paiement ${p.id} confirmé par l'opérateur`); render() }, 2500)
      } else {
        logPay({ resId: id, mode, amount, note: /Carte/.test(mode) ? `Capture PSP, jeton ${uid("tok").toLowerCase()} (simulé)` : "" })
        D.payments[id] = (D.payments[id] || 0) + amount
        toast(`${money(amount)} encaissés (${mode})`)
      }
      render()
    },
    verifyMM(pid) {
      const p = S.payLog.find((x) => x.id === pid)
      Object.assign(p, { status: "confirmé", note: "Rapproché par interrogation de l'opérateur (simulé)" })
      if (p.resId) D.payments[p.resId] = (D.payments[p.resId] || 0) + p.amount
      toast(`Paiement ${pid} confirmé par l'opérateur`)
      render()
    },
    dispute(did) { S.disputes.find((x) => x.id === did).status = "justificatifs envoyés"; toast("Justificatifs transmis au PSP (simulé)"); render() },
    remindDeposit(did) { const d = S.deposits.find((x) => x.id === did); d.reminders = (d.reminders || 0) + 1; toast(`Relance envoyée — ${d.label || (R(d.resId) ? gname(R(d.resId)) : d.resId)} (simulé)`); render() },
    cashDeposit(did) {
      const d = S.deposits.find((x) => x.id === did)
      d.status = "reçu"
      logPay({ resId: d.resId, mode: "Mobile Money (MTN MoMo)", amount: d.amount, note: `Acompte ${d.id}` })
      if (d.resId) D.payments[d.resId] = (D.payments[d.resId] || 0) + d.amount
      toast(`Acompte ${d.id} encaissé`)
      render()
    },
    refund() {
      const p = allPayments().find((x) => x.id === val("rf-pay")), amount = Number(val("rf-amount")), reason = val("rf-why")
      if (!p) return err("rf-err", "Choisissez un paiement.")
      const already = sum(S.refunds.filter((x) => x.pay === p.id && x.status !== "refusé"), (x) => x.amount)
      if (!(amount > 0) || amount > p.amount - already) return err("rf-err", `Montant entre 1 et ${money(p.amount - already)}.`)
      if (!reason) return err("rf-err", "Motif obligatoire.")
      const x = { id: uid("RB"), pay: p.id, resId: p.resId, label: `${p.resId || ""} ${p.resId && R(p.resId) ? gname(R(p.resId)) : ""}`.trim(), amount, reason, by: USER, mode: p.mode, at: today }
      const score = fraud({ ...x, refund: true })
      x.status = score >= 60 ? "à valider" : amount > REFUND_LIMIT ? "à valider" : "effectué"
      S.refunds.unshift(x)
      if (x.status === "effectué") execRefund(x)
      toast(x.status === "effectué" ? `Remboursement ${money(amount)} effectué` : score >= 60 ? "Bloqué par la détection de fraude : revue humaine requise" : "Au-delà du seuil : 2e validation requise")
      render()
    },
    approve(rid) {
      const x = S.refunds.find((y) => y.id === rid)
      const who = prompt("2e validation — identifiant du valideur (différent du demandeur) :", "Estelle Brou (contrôle financier)")
      if (!who) return
      if (who.trim() === x.by) return toast("Le valideur doit être différent du demandeur (RG-FOL-04)")
      x.approvedBy = who.trim()
      x.status = "effectué"
      execRefund(x)
      toast(`Remboursement ${x.id} validé et exécuté (PSP simulé)`)
      render()
    },
    reject(rid) { S.refunds.find((y) => y.id === rid).status = "refusé"; toast("Demande refusée"); render() },
    credit(invId) {
      const inv = allInvoices().find((i) => i.id === invId), amount = Number(val("cr-amount")), reason = val("cr-why")
      if (!(amount > 0) || amount > inv.amount - credited(invId)) return err("cr-err", "Montant invalide.")
      if (!reason) return err("cr-err", "Motif obligatoire.")
      const id = "AV-" + String(S.creditSeq++).padStart(4, "0")
      S.credits.unshift({ id, invoice: invId, date: today, amount, reason })
      ui.sejCredit = null
      toast(`Avoir ${id} émis — la facture ${invId} reste inchangée`)
      render()
    },
    match(rcId) {
      const rc = S.ar.receipts.find((x) => x.id === rcId), inv = S.ar.invoices.find((i) => i.id === val("lt-" + rcId))
      if (!inv) return toast("Aucune pièce ouverte sur ce compte")
      const used = Math.min(rc.amount, arOpen(inv))
      inv.paid += used
      rc.matched = inv.id + (used < rc.amount ? ` (reste ${money(rc.amount - used)} non affecté)` : "")
      toast(`${rcId} lettré avec ${inv.id}`)
      render()
    },
    remindAr(iid) { const i = S.ar.invoices.find((x) => x.id === iid); i.reminders = (i.reminders || 0) + 1; toast(`Relance n° ${i.reminders} envoyée pour ${iid} (simulé)`); render() },
    openShift() {
      if (openShift()) return
      S.shifts.unshift({ id: uid("CS"), user: USER, post: "Réception poste 1", date: today, opened: nowT(), float: Number(val("cs-float")) || 0, status: "ouverte" })
      toast("Caisse ouverte")
      render()
    },
    closeShift() {
      const s = openShift(), counted = Number(val("cs-count"))
      if (val("cs-count") === "" || !(counted >= 0)) return err("cs-err", "Saisissez le montant compté.")
      const expected = shiftCash(s).expected, gap = counted - expected
      if (Math.abs(gap) > CASH_GAP_LIMIT && !val("cs-why")) return err("cs-err", `Écart de ${money(gap)} : motif obligatoire au-delà de ${money(CASH_GAP_LIMIT)}.`)
      Object.assign(s, { status: "fermée", expected, counted, gap, reason: val("cs-why") })
      toast(gap ? `Caisse clôturée — écart ${money(gap)}` : "Caisse clôturée sans écart")
      render()
    },
  }
  function execRefund(x) {
    x.shift = openShift()?.id
    const r = R(x.resId)
    if (r && D.payments[r.id] != null && r.status !== "partie") { D.payments[r.id] -= x.amount; x.counted = true }
  }

  HMS.module({ code: "sej", group: "Réception & séjour", title: "Séjour : compléments", phase: "4-6", spec: "§8 RES, §9 FOF", actions: sej, screens: [
    { id: "sej-rack", label: "Plan des chambres", spec: "FOF RES", view: views.rack },
    { id: "sej-mouv", label: "Mouvements de séjour", spec: "FOF RES", view: views.mouv },
    { id: "sej-groupes", label: "Groupes et attente", spec: "RES", view: views.groupes },
    { id: "sej-audit", label: "Audit de nuit", spec: "FOF RES", view: views.audit },
  ] })
  HMS.module({ code: "fol", group: "Finance", title: "Facturation, folios et paiements", phase: "6-8", spec: "§12 FOL", actions: fol, screens: [
    { id: "fol-folios", label: "Folios et routage", spec: "FOL", view: views.folios },
    { id: "fol-paiements", label: "Paiements", spec: "FOL RES", view: views.paiements },
    { id: "fol-ledger", label: "City ledger", spec: "FOL", view: views.ledger },
    { id: "fol-caisse", label: "Caisses", spec: "FOL", view: views.caisse },
  ] })
})()
