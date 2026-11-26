// Écrans du cadrage initial : tableau de bord de la réception, réservations, check-in avec clé,
// check-out et facture, housekeeping (statut des chambres), fiche client.
// Spec : §8 Réservations, §9 Réception, §10 Contrôle d'accès, §11 Housekeeping, §12 Facturation, §7 CRM.
;(() => {
  const USER = "Nadège Assi (réception)"
  const nowT = () => new Date().toTimeString().slice(0, 5)
  const ef = (s) => ` <span class="muted">${esc(s)}</span>`
  const sumA = (a, f = (x) => x) => a.reduce((s, x) => s + f(x), 0)
  const FX = { FCFA: 1, EUR: 655.957, USD: 610 } // EUR : parité fixe ; USD : cours d'exemple
  const PLANS = [["BAR", "Meilleur tarif du jour (BAR)"], ["NR", "Non remboursable (−10 %)"], ["CORP", "Contrat entreprise"]]
  const GUARANTEES = ["Carte bancaire", "Acompte", "Mobile Money", "Compte société", "Aucune"]
  const SOURCES = ["Direct (téléphone)", "Direct (e-mail)", "Comptoir", "Moteur de réservation", "OTA (simulé)", "Société", "Agence"]
  const SEGMENTS = ["Loisirs", "Affaires", "Séminaire / groupe", "Gouvernement", "Équipage"]
  const NATS = ["Côte d'Ivoire", "Burkina Faso", "Ghana", "Mali", "Sénégal", "Guinée", "Nigeria", "France", "Liban", "Autre"]
  const ROLES = ["Réceptionniste", "Chef de réception", "Duty manager", "Directeur"]
  const isForeign = (g) => !!(g && g.nationality && g.nationality !== "Côte d'Ivoire")
  const cashOpen = () => (D.sej?.shifts || []).some((s) => s.status === "ouverte")
  const nightList = (a, b) => { const l = []; for (let d = a; d < b; d = addDays(d, 1)) l.push(d); return l }
  const round500 = (n) => Math.round(n / 500) * 500

  // ---------- Données d'exemple propres à la réception (fof) ----------
  D.fof = {
    // Moteur fiscal (paramétrable par pays) : TVA incluse dans les prix, taxe de séjour par personne et par nuit
    fisc: { tva: 18, taxeSejour: 1000, cardFee: 1500, caution: 20000 },
    comms: [
      { id: "MSG-3", at: "2026-11-24 10:02", resId: "R-2051", kind: "Rappel pré-arrivée", channel: "E-mail", text: "Arrivée le 26/11 : check-in en ligne sur https://exemple.test/checkin/R-2051 (lien simulé)" },
      { id: "MSG-2", at: "2026-11-22 16:40", resId: "R-2060", kind: "Confirmation", channel: "SMS", text: "Réservation R-2060 confirmée du 28/11 au 01/12." },
      { id: "MSG-1", at: "2026-11-10 09:15", resId: "R-2052", kind: "Confirmation", channel: "E-mail", text: "Réservation R-2052 confirmée du 26/11 au 28/11, acompte reçu." },
    ],
    msgSeq: 4,
    // Check-in en ligne complété par le client avant l'arrivée
    online: { "R-2052": { at: "2026-11-25 21:10", eta: "16:00", how: "Lien e-mail", signed: true } },
    police: [
      { id: "FP-0117", date: "2026-11-25", at: "18:32", resId: "R-2047", guest: "G6", nationality: "Mali", birth: "1984-03-12", place: "Bamako", prof: "Commerçant", addr: "Bamako, Mali", doc: "Passeport ••••06", issued: "2022-05-10", entry: "2026-11-25", from: "Bamako", to: "Abidjan", status: "transmise", sentAt: "2026-11-25 23:50" },
    ],
    policeSeq: 118,
    offline: false, cacheAt: "", queue: [],
    // Copie des réservations telle que connue des canaux (simulé), pour la réconciliation
    channelCopy: [
      { ext: "OTA-A-57902", channel: "OTA Exemple A (simulé)", resId: "R-2053", type: "STD", from: "2026-11-26", to: "2026-11-28", rate: 45000, note: "Séjour prolongé d'une nuit par le client sur l'OTA" },
      { ext: "OTA-A-57955", channel: "OTA Exemple A (simulé)", resId: "R-2046", type: "STD", from: "2026-11-24", to: "2026-11-26", rate: 45000 },
      { ext: "GDS-7702", channel: "GDS via switch (simulé)", resId: null, guest: "Hervé Séka", nationality: "Côte d'Ivoire", email: "herve.seka@exemple.test", type: "STD", from: "2026-12-01", to: "2026-12-03", rate: 45000, note: "Réservation reçue pendant une coupure, absente du PMS" },
    ],
  }
  const F = D.fof
  let lock = null // verrou d'inventaire pendant l'écriture d'une réservation (EF-RES-003)

  // ---------- Règles partagées ----------
  const msg = (resId, kind, channel, text) => { F.comms.unshift({ id: "MSG-" + F.msgSeq++, at: `${today} ${nowT()}`, resId, kind, channel, text }) }
  const contactOf = (g) => (g.email ? "E-mail" : g.phone ? "SMS" : "E-mail")
  const extOf = (r) => r.ext || F.channelCopy.find((x) => x.resId === r.id)?.ext
  const olSent = (id) => F.comms.some((m) => m.resId === id && /pré-arrivée|check-in en ligne/i.test(m.kind))
  const taxes = (lines) => {
    const sej = sumA(lines.filter((l) => l.code === "TAXE"), (l) => l.amount)
    const base = sumA(lines.filter((l) => l.code !== "TAXE"), (l) => l.amount)
    const ht = Math.round(base / (1 + F.fisc.tva / 100))
    return { ht, tva: base - ht, sej, ttc: base + sej }
  }
  const taxTable = (lines) => { const x = taxes(lines)
    return tbl(["Ventilation fiscale", "#Montant"], [["Prestations hors taxes", money(x.ht)], [`TVA ${F.fisc.tva} % (incluse dans les prix)`, money(x.tva)],
      [`Taxe de séjour (${money(F.fisc.taxeSejour)} par personne et par nuit, hors champ TVA)`, money(x.sej)], ["<strong>Total TTC</strong>", `<strong>${money(x.ttc)}</strong>`]])
      + `<p class="muted" style="margin:4px 0 0">Moteur fiscal (FIN, simulé) : taux paramétrables par pays, service inclus. EF-FOL-013</p>` }
  // Taxe de séjour des nuits pas encore publiées par l'audit de nuit (postée au check-out)
  const pendingTaxes = (r, to = r.to) => nightList(r.from, to).filter((d) => !(D.extras[r.id] || []).some((l) => l.code === "TAXE" && l.night === d))
    .map((d) => ({ label: `Taxe de séjour — nuit du ${fd(d)} (${r.adults || 1} pers.)`, amount: F.fisc.taxeSejour * (r.adults || 1), code: "TAXE", night: d }))
  const earlyFee = (r) => round500(r.rate * 0.5)
  const preauthAmount = (r) => Math.max(0, folio(r).balance) + F.fisc.caution
  const riskOf = (id) => A.sej?.riskOf?.(id)
  // Attribution proposée (IA simulée) : chambre pré-attribuée, propreté, préférences, demandes
  const bestRoom = (r) => {
    const g = G(r.guest) || { prefs: [] }
    const c = D.rooms.filter((x) => x.type === r.type && x.hk === "propre" && !occupant(x.no))
    if (!c.length) return null
    const pre = c.find((x) => x.no === r.preRoom)
    if (pre) return { room: pre, why: "chambre pré-attribuée sur le plan des chambres, propre" }
    const high = g.prefs.some((x) => /élevé|calme/i.test(x)), baby = /bébé/i.test((r.request || "") + g.prefs.join(" "))
    c.sort((a, b) => (high || g.vip ? b.floor - a.floor : a.floor - b.floor))
    const room = c[0]
    return { room, why: ["propre et libre", high ? "étage élevé / calme demandé" : g.vip ? "client VIP : meilleur étage" : "proche de l'ascenseur", baby ? "lit bébé à installer (transmis au housekeeping)" : ""].filter(Boolean).join(", ") }
  }
  // Clés émises dans le contrôle d'accès (ACC) en une seule action
  const issueKeys = (r, cards, mobile, encoder) => {
    const C = D.acc
    if (!C || !Array.isArray(C.creds)) return []
    const areas = ["Ascenseur", "Piscine", "Salle de sport", "Parking", ...(r.type === "SUI" || G(r.guest)?.vip ? ["Salon exécutif"] : [])]
    const out = []
    const mk = (type) => { const c = { id: (type === "mobile" ? "M-" : "K-") + C.idSeq++, resId: r.id, room: r.room, type, seq: type === "carte" ? (C.seq[r.room] = (C.seq[r.room] || 0) + 1) : null, from: r.from, to: `${r.to} 13:00`, status: "active", areas, version: 1, encoder: type === "mobile" ? "SDK mobile" : encoder }; C.creds.unshift(c); out.push(c.id) }
    for (let i = 0; i < cards; i++) mk("carte")
    if (mobile) mk("mobile")
    return out
  }
  const addPolice = (data) => {
    const x = { id: "FP-0" + F.policeSeq++, date: today, at: nowT(), status: F.offline ? "en file (mode dégradé)" : "à transmettre", ...data }
    F.police.unshift(x)
    return x
  }
  const policeFields = (g) => {
    const prev = F.police.find((x) => x.guest === g.id) || {}
    return `<div class="form" style="margin-top:6px">
      ${field("fp-birth", "Date de naissance", input("fp-birth", prev.birth || "", 'type="date" oninput="A.fof.ckReady()"'))}
      ${field("fp-place", "Lieu de naissance", input("fp-place", prev.place || "", 'oninput="A.fof.ckReady()"'))}
      ${field("fp-prof", "Profession", input("fp-prof", prev.prof || "", 'oninput="A.fof.ckReady()"'))}
      ${field("fp-addr", "Adresse habituelle", input("fp-addr", prev.addr || "", 'oninput="A.fof.ckReady()"'))}
      ${field("fp-doc", "Passeport / pièce (n°)", input("fp-doc", prev.doc || g.idDoc || "", 'oninput="A.fof.ckReady()"'))}
      ${field("fp-issued", "Délivrée le", input("fp-issued", prev.issued || "", 'type="date" oninput="A.fof.ckReady()"'))}
      ${field("fp-entry", "Entrée en Côte d'Ivoire le", input("fp-entry", today, 'type="date" oninput="A.fof.ckReady()"'))}
      ${field("fp-from", "Provenance", input("fp-from", prev.from || "", 'oninput="A.fof.ckReady()"'))}
      ${field("fp-to", "Destination", input("fp-to", "Abidjan", 'oninput="A.fof.ckReady()"'))}
    </div>`
  }
  const POLICE_KEYS = ["birth", "place", "prof", "addr", "doc", "issued", "entry", "from", "to"]
  const readPolice = () => { const o = {}; for (const k of POLICE_KEYS) { o[k] = val("fp-" + k); if (!o[k]) return null } return o }

  const views = {
    // #1 Tableau de bord de la réception
    accueil() {
      const arr = arrivals(), pend = arr.filter((r) => r.status === "confirmee"), dep = departures(), ih = inHouse()
      const sellable = D.rooms.filter((r) => r.hk !== "hs").length
      const free = D.rooms.filter((r) => r.hk !== "hs" && !occupant(r.no)).length
      const special = [...ih, ...pend].filter((r) => G(r.guest).vip || r.request)
      // Risques du jour (EF-FOF-001)
      const risks = []
      pend.forEach((r) => { const x = riskOf(r.id); if (x && x.noshow >= 30) risks.push([`${G(r.guest).name} (${r.id}) : risque de no-show ${x.noshow} %${r.guarantee === "Aucune" ? ", sans garantie (option jusqu'à 18 h)" : ""}`, "sej-mouv/noshow", "Traiter"]) })
      D.roomTypes.forEach((t) => { const need = pend.filter((r) => r.type === t.code).length, ready = readyRooms().filter((x) => x.type === t.code).length
        if (need > ready) risks.push([`${t.label} : ${need} arrivée(s) pour ${ready} chambre(s) prête(s) — prioriser le ménage`, "chambres", "Chambres"]) })
      dep.filter((r) => r.status === "arrivee" && folio(r).balance > 0 && r.guarantee === "Aucune").forEach((r) => risks.push([`Ch. ${r.room} : solde ${money(folio(r).balance)} sans garantie`, `checkout/${r.id}`, "Check-out"]))
      pend.filter((r) => isForeign(G(r.guest))).forEach((r) => risks.push([`${G(r.guest).name} (${G(r.guest).nationality}) : fiche de police à remplir au check-in`, `checkin/${r.id}`, "Check-in"]))
      const mm = (D.sej?.payLog || []).filter((p) => p.status === "à vérifier").length
      if (mm) risks.push([`${mm} paiement(s) mobile money à vérifier auprès de l'opérateur`, "fol-paiements", "Paiements"])
      if (F.offline) risks.push(["Mode dégradé : connexion perdue, opérations en file d'attente", "checkin", "Check-in"])
      return `<h1>Réception — ${esc(fdLong(today))}</h1><p class="lead">${esc(D.hotel)} · vue du jour (exemple).</p>
        <div class="grid">
          ${kpi("Arrivées", arr.length, `${pend.length} à enregistrer`)}
          ${kpi("Départs", dep.length, `${dep.filter((r) => r.status === "arrivee").length} à facturer`)}
          ${kpi("Clients présents", ih.length, `occupation ${Math.round((ih.length / sellable) * 100)} %`)}
          ${kpi("Chambres prêtes", readyRooms().length, `sur ${free} libres`)}
        </div>
        <div class="cols">
          <section><h2>Arrivées du jour</h2>${tbl(["Client", "Type", "#Nuits", "Risque IA", ""], arr.map((r) => { const x = r.status === "confirmee" ? riskOf(r.id) : null
            return [guestLink(r.guest) + vip(G(r.guest)) + (F.online[r.id] ? " " + badge("En ligne", "outline") : ""), esc(T(r.type).label), nights(r.from, r.to), x ? badge(`no-show ${x.noshow} %`, x.noshow >= 30 ? "dark" : x.noshow >= 15 ? "outline" : "") : "—",
            r.status === "arrivee" ? `<span class="pill on">Ch. ${esc(r.room)}</span>` : `<button class="btn sm" onclick="go('checkin/${esc(r.id)}')">Check-in</button>`] }), "Aucune arrivée prévue.")}</section>
          <section><h2>Départs du jour</h2>${tbl(["Client", "Chambre", "#Solde", ""], dep.map((r) => [
            guestLink(r.guest) + vip(G(r.guest)), esc(r.room), r.status === "partie" ? "—" : money(folio(r).balance),
            r.status === "partie" ? pill(STATUS, "partie") : `<button class="btn sm" onclick="go('checkout/${esc(r.id)}')">Check-out</button>`,
          ]), "Aucun départ prévu.")}</section>
        </div>
        <h2>Risques du jour</h2>
        ${risks.length ? `<div class="stack">${risks.map(([t, route, l]) => `<div class="card row between"><span>${esc(t)}</span>${btn(l, `go('${route}')`, "ghost sm")}</div>`).join("")}</div>` : `<p class="muted">Aucun risque détecté.</p>`}
        <p class="muted">Risques calculés sur les données du jour (IA de no-show simulée). EF-FOF-001</p>
        <h2>VIP et demandes spéciales</h2>
        ${special.length ? `<div class="grid">${special.map((r) => `<div class="card">
            <div class="row between"><strong>${guestLink(r.guest)}</strong>${vip(G(r.guest))}</div>
            <div class="muted">${r.status === "arrivee" ? `En séjour · ch. ${esc(r.room)}` : `Arrive aujourd'hui · ${esc(T(r.type).label)}`}</div>
            ${r.request ? `<p style="margin:8px 0 0">${esc(r.request)}</p>` : ""}
            ${G(r.guest).prefs.length ? `<p class="muted" style="margin:6px 0 0">Préférences : ${esc(G(r.guest).prefs.join(", "))}</p>` : ""}
          </div>`).join("")}</div>` : `<p class="muted">Rien de particulier aujourd'hui.</p>`}`
    },

    // #2 Réservations
    reservations(p) {
      const mode = p[0]
      const editing = mode === "new" ? {} : mode === "edit" ? R(p[1]) : null
      const cancelling = mode === "cancel" ? R(p[1]) : null
      const tab = ["canaux", "messages"].includes(mode) ? mode : "liste"
      const head = `<div class="row between"><h1>Réservations</h1>${editing ? "" : `<button class="btn" onclick="go('reservations/new')">Nouvelle réservation</button>`}</div>
        <p class="lead">Créer, modifier ou annuler une réservation. La saisie est bloquée si le type de chambre est complet sur une des nuits.</p>
        ${subtabs("reservations", [["liste", "Liste et planning"], ["canaux", "Canaux : import et réconciliation"], ["messages", "Messages aux clients"]], tab)}`
      if (tab === "canaux") return head + channelsTab()
      if (tab === "messages") return head + messagesTab()
      const filters = { actives: ["confirmee", "arrivee"], toutes: Object.keys(STATUS), annulee: ["annulee", "noshow", "deloge"] }
      const list = D.reservations.filter((r) => filters[ui.resFilter].includes(r.status)).sort((a, b) => a.from.localeCompare(b.from))
      const days = Array.from({ length: 14 }, (_, i) => addDays(today, i))
      const plan = (r) => (PLANS.find((x) => x[0] === r.plan) || [, ""])[1]
      return head + `
        ${editing ? resForm(editing) : ""}
        ${cancelling ? cancelPanel(cancelling) : ""}
        ${ui.race ? card("Saisies simultanées sur la dernière chambre (simulation)", ui.race.map((s) => `<div class="step"><b class="n">${s[0]}</b><div>${esc(s[1])}</div></div>`).join("") + btn("Fermer", "ui.race=null;render()", "ghost sm"), 'style="margin-bottom:16px"') : ""}
        <div class="chips">${Object.entries({ actives: "À venir et en séjour", toutes: "Toutes", annulee: "Annulées, no-shows, délogés" }).map(([k, l]) =>
          `<button aria-pressed="${ui.resFilter === k}" onclick="ui.resFilter='${k}';render()">${l}</button>`).join("")}</div>
        ${tbl(["Réf.", "Client", "Arrivée", "Départ", "#Nuits", "Type", "Occupants", "#Tarif/nuit", "Garantie", "Risque IA annul. / no-show", "Statut", ""], list.map((r) => { const x = r.status === "confirmee" ? riskOf(r.id) : null
          return [esc(r.id) + (extOf(r) ? `<div class="muted">${esc(extOf(r))}</div>` : "") + (r.multi ? `<div>${badge("Multi " + r.multi, "outline")}</div>` : ""),
          guestLink(r.guest) + vip(G(r.guest)), fd(r.from), fd(r.to), nights(r.from, r.to), esc(T(r.type).label), `${r.adults || 1} ad.${r.children ? ` + ${r.children} enf.` : ""}`,
          money(r.rate) + (plan(r) ? `<div class="muted">${esc(plan(r))}</div>` : ""),
          esc(r.guarantee) + (r.guarantee === "Aucune" && r.status === "confirmee" ? `<div class="muted">option jusqu'à 18 h</div>` : r.token ? `<div class="muted">${esc(r.token)}</div>` : ""),
          x ? `${badge(x.cancel + " %", x.cancel >= 30 ? "dark" : x.cancel >= 15 ? "outline" : "")} ${badge(x.noshow + " %", x.noshow >= 30 ? "dark" : x.noshow >= 15 ? "outline" : "")}` : "—",
          pill(STATUS, r.status) + (r.cancel ? `<div class="muted">frais ${money(r.cancel.fee)}${r.cancel.waived ? " (dérogation)" : ""}</div>` : ""),
          ["confirmee", "arrivee"].includes(r.status) ? `<span class="row" style="flex-wrap:nowrap">
            <button class="btn ghost sm" onclick="go('reservations/edit/${esc(r.id)}')">Modifier</button>
            ${r.status === "confirmee" ? `<button class="btn ghost sm" onclick="A.fof.cancelRes(${q(r.id)})">Annuler</button>` : ""}</span>` : ""] }), "Aucune réservation.")}
        <div class="row" style="margin-top:10px">${btn("Envoyer les rappels pré-arrivée (J-2)", "A.fof.reminders()", "ghost sm")}${btn("Simuler deux saisies simultanées", "A.fof.race()", "ghost sm")}</div>
        <p class="muted">Réservation complète : occupants, plan tarifaire, source, segment, garantie (EF-RES-001) · multi-chambres (EF-RES-002) · verrou d'inventaire à la création (EF-RES-003) · politique d'annulation et dérogation (EF-RES-011) · confirmations et rappels (EF-RES-013) · probabilités d'annulation et de no-show par IA simulée (EF-RES-015).</p>
        <h2>Planning des disponibilités — 14 jours</h2>
        <p class="muted">Chambres libres par type et par nuit (hors chambres hors commande).</p>
        <div class="tablewrap"><table><thead><tr><th>Type</th>${days.map((d) => `<th class="num">${esc(wd(d))}<br>${fd(d)}</th>`).join("")}</tr></thead>
          <tbody>${D.roomTypes.map((t) => `<tr><td>${esc(t.label)}</td>${days.map((d) => { const n = available(t.code, d); return `<td class="num ${n <= 0 ? "cell0" : ""}">${n <= 0 ? "Complet" : n}</td>` }).join("")}</tr>`).join("")}</tbody></table></div>`
    },

    // #3 Check-in avec émission de clé
    checkin(p) {
      const pend = D.reservations.filter((r) => r.from === today && r.status === "confirmee")
      const r = p[0] ? R(p[0]) : pend[0]
      const ol = D.reservations.filter((x) => x.status === "confirmee" && x.from >= today && x.from <= addDays(today, 2)).sort((a, b) => a.from.localeCompare(b.from))
      return `<div class="row between"><h1>Check-in</h1>${F.offline ? btn(`Connexion rétablie : resynchroniser (${F.queue.length})`, "A.fof.resync()", "accent") : btn("Simuler une perte de connexion", "A.fof.offline()", "ghost")}</div>
        <p class="lead">Attribuer une chambre, vérifier l'identité, encoder la carte : une seule action (encodeur simulé).</p>
        ${F.offline ? `<div class="err">Mode dégradé : connexion au cloud perdue. Arrivées lues dans le cache local (synchronisé le ${esc(F.cacheAt)}), clés encodées via la passerelle edge locale, pré-autorisations carte différées. ${F.queue.length} opération(s) en file. EF-FOF-016</div>` : ""}
        <div class="split">
          <div><h3>Arrivées à enregistrer${F.offline ? " (cache local)" : ""}</h3><div class="list">${pend.map((x) => `<button aria-current="${x === r}" onclick="go('checkin/${esc(x.id)}')">
            <strong>${esc(G(x.guest).name)}</strong>${vip(G(x.guest))}${F.online[x.id] ? " " + badge("En ligne", "outline") : ""}${isForeign(G(x.guest)) ? " " + badge("Fiche de police", "dark") : ""}<div class="muted">${esc(x.id)} · ${esc(T(x.type).label)} · ${nights(x.from, x.to)} nuit(s)</div></button>`).join("") || `<p class="muted">Toutes les arrivées du jour sont enregistrées.</p>`}</div>
            <h3>Check-in en ligne et mobile</h3>
            ${tbl(["Client", "État", ""], ol.map((x) => { const o = F.online[x.id]
              return [esc(G(x.guest).name) + `<div class="muted">arrivée ${fd(x.from)}</div>`, o ? badge(`Complété · arrivée ${o.eta}`, "on") : olSent(x.id) ? badge("Lien envoyé", "outline") : "—",
                !o && !olSent(x.id) ? btn("Envoyer le lien", `A.fof.olLink(${q(x.id)})`, "ghost sm") : !o ? btn("Le client complète", `A.fof.olDone(${q(x.id)})`, "ghost sm") : x.from === today ? btn("Chambre prête : clé mobile", `A.fof.mobileCheckin(${q(x.id)})`, "sm") : ef("clé le jour J")] }), "Aucune arrivée sous 48 h.")}
            <p class="muted">Le client remplit pièce, fiche de police et signature en ligne ; le jour J, la clé mobile est activée dès qu'une chambre est prête, sans passage au comptoir. EF-FOF-005</p>
          </div>
          <div>${r ? checkinPanel(r) : ""}</div>
        </div>
        <h2>Fiches de police</h2>
        ${tbl(["N°", "Date", "Client", "Nationalité", "Pièce", "Séjour", "Provenance → destination", "Statut", ""], F.police.map((x) => [esc(x.id), `${fd(x.date)} ${esc(x.at || "")}`, esc(G(x.guest)?.name || x.name || "—"), esc(x.nationality), esc(x.doc), esc(x.resId || "—"), `${esc(x.from)} → ${esc(x.to)}`,
          badge(x.status, x.status === "transmise" ? "on" : "outline"), x.status === "transmise" ? ef(x.sentAt || "") : btn("Transmettre", `A.fof.sendPolice(${q(x.id)})`, "ghost sm")]), "Aucune fiche.")}
        ${F.police.some((x) => x.status !== "transmise") ? `<div class="row" style="margin-top:8px">${btn("Transmettre toutes les fiches (télédéclaration simulée)", "A.fof.sendPolice()", "ghost sm")}</div>` : ""}
        <p class="muted">Fiche obligatoire pour tout voyageur étranger, au check-in comme au walk-in (RG-FOF-07). Télédéclaration aux services de police simulée. EF-CRM-013</p>`
    },

    // #4 Check-out et facture
    checkout(p) {
      const list = inHouse().sort((a, b) => a.to.localeCompare(b.to))
      const r = p[0] ? R(p[0]) : list[0]
      return `<h1>Check-out</h1><p class="lead">Contrôler le folio, encaisser, éditer la facture et révoquer la clé du client.</p>
        <div class="split">
          <div><h3>Clients en séjour</h3><div class="list">${list.map((x) => `<button aria-current="${x === r}" onclick="go('checkout/${esc(x.id)}')">
            <strong>Ch. ${esc(x.room)} · ${esc(G(x.guest).name)}</strong>
            <div class="muted">${x.to === today ? "Départ aujourd'hui" : `Départ prévu le ${fd(x.to)}`} · solde ${money(folio(x).balance)}</div></button>`).join("") || `<p class="muted">Aucun client en séjour.</p>`}</div></div>
          <div>${r && r.status === "arrivee" ? checkoutPanel(r) : ""}</div>
        </div>`
    },
    facture(p) {
      const r = R(p[0]), f = folio(r), g = G(r.guest)
      const code = String(Math.abs([...(r.invoice + r.id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))).padStart(8, "0").slice(0, 8)
      const sent = r.invoiceSent || []
      return `<div class="row between noprint"><h1>Facture ${esc(r.invoice)}</h1>
          <span class="row"><button class="btn ghost" onclick="go('checkout')">Check-out suivant</button><button class="btn" onclick="print()">Imprimer</button></span></div>
        <p class="lead noprint">Séjour clôturé${r.express ? " en express check-out (garantie prélevée)" : ""}. <span class="pill on">Clé révoquée</span> La carte de la chambre ${esc(r.room)} n'ouvre plus la porte (simulation). Chambre passée en « sale ».</p>
        <div class="card noprint" style="margin-bottom:14px"><div class="row between"><span>${sent.length ? `Facture envoyée par ${esc(sent.join(" et "))} à ${esc(g.name)} (simulé)` : "Facture remise imprimée, non envoyée"}</span>
          <span class="row">${btn("Envoyer par e-mail", `A.fof.resend(${q(r.id)}, 'E-mail')`, "ghost sm")}${btn("Envoyer par WhatsApp", `A.fof.resend(${q(r.id)}, 'WhatsApp')`, "ghost sm")}</span></div>
          <p class="muted" style="margin:4px 0 0">Envoi de la facture au départ (EF-FOL-016, EF-FOF-009).</p></div>
        <div class="card invoice">
          <div class="row between"><div><div class="big">${esc(D.hotel)}</div><div class="muted">${esc(D.city)} · SARL au capital de 10 000 000 FCFA (exemple) · RCCM CI-ABJ-0000-B-00000 · NCC 0000000 A (fictifs) · régime réel normal</div>
            <div class="muted">Facture n° ${esc(r.invoice)} (série F, numérotation continue) · ${fd(today)}/${today.slice(0, 4)} · document d'exemple</div></div>
            <div style="text-align:right"><strong>${esc(g.name)}</strong><div class="muted">${esc(g.email)}</div></div></div>
          <p class="muted">Réservation ${esc(r.id)} · chambre ${esc(r.room)} · du ${fd(r.from)} au ${fd(r.to)} · ${r.adults || 1} adulte(s)</p>
          ${tbl(["Désignation", "#Montant"], f.lines.map((l) => [esc(l.label), money(l.amount)]), "", `<tfoot><tr><td>Total TTC</td><td class="num">${money(f.total)}</td></tr>
            <tr><td class="muted" style="font-weight:400">Réglé (${esc(r.payMode)})</td><td class="num" style="font-weight:400">${money(f.paid)}</td></tr></tfoot>`)}
          <div class="cols" style="margin-top:12px"><section>${taxTable(f.lines)}</section>
          <section><div class="row" style="gap:12px;align-items:flex-start"><div aria-hidden="true" style="width:72px;height:72px;flex:none;background:repeating-conic-gradient(var(--ink) 0 25%, transparent 0 50%) 0 0/12px 12px;border:4px solid var(--ink)"></div>
            <div><strong>Facture normalisée électronique</strong><div class="muted">Certifiée par la plateforme fiscale (simulation) · code de vérification ${esc(code)} · mentions légales, TVA et numérotation conformes au pays de l'établissement. EF-FOL-009</div></div></div></section></div>
        </div>`
    },

    // #5 Statut des chambres (housekeeping)
    chambres() {
      const counts = Object.fromEntries(Object.keys(HK).map((k) => [k, D.rooms.filter((r) => r.hk === k).length]))
      const rooms = D.rooms.filter((r) => ui.hkFilter === "toutes" || r.hk === ui.hkFilter)
      return `<div class="row between"><h1>Chambres</h1><button class="btn" onclick="A.fof.autoAssign()">Répartir les chambres sales</button></div>
        <p class="lead">État de chaque chambre et répartition des tâches entre les femmes de chambre.</p>
        <div class="grid">${D.housekeepers.map((h) => { const nos = D.rooms.filter((r) => D.assignments[r.no] === h).map((r) => r.no)
          return `<div class="card"><div class="muted">${esc(h)}</div><div class="kpi">${nos.length}</div><div class="muted">${nos.length ? "Chambres " + esc(nos.join(", ")) : "Aucune chambre attribuée"}</div></div>` }).join("")}</div>
        <h2>État des chambres</h2>
        <div class="chips"><button aria-pressed="${ui.hkFilter === "toutes"}" onclick="ui.hkFilter='toutes';render()">Toutes (${D.rooms.length})</button>
          ${Object.entries(HK).map(([k, [l]]) => `<button aria-pressed="${ui.hkFilter === k}" onclick="ui.hkFilter='${k}';render()">${l} (${counts[k]})</button>`).join("")}</div>
        <div class="grid">${rooms.map((r) => { const o = occupant(r.no)
          return `<div class="card">
            <div class="row between"><span class="roomno">${esc(r.no)}</span>${pill(HK, r.hk)}</div>
            <div class="muted">${esc(T(r.type).label)} · étage ${r.floor}</div>
            <div style="margin:6px 0 10px;font-size:14px">${o ? `Occupée · ${o.to === today ? "<strong>départ aujourd'hui</strong>" : "départ " + fd(o.to)}` : "Libre"}${r.note ? `<div class="muted">${esc(r.note)}</div>` : ""}</div>
            <label for="hk-${esc(r.no)}">Statut</label>
            <select id="hk-${esc(r.no)}" onchange="A.fof.setHk(${q(r.no)}, this.value)">${Object.entries(HK).map(([k, [l]]) => `<option value="${k}" ${r.hk === k ? "selected" : ""}>${l}</option>`).join("")}</select>
            <label for="as-${esc(r.no)}" style="margin-top:8px">Attribuée à</label>
            <select id="as-${esc(r.no)}" onchange="A.fof.assign(${q(r.no)}, this.value)"><option value="">— personne —</option>
              ${D.housekeepers.map((h) => `<option ${D.assignments[r.no] === h ? "selected" : ""}>${esc(h)}</option>`).join("")}</select>
          </div>` }).join("") || `<p class="muted">Aucune chambre dans cet état.</p>`}</div>`
    },

    // #6 Fiche client
    clients(p) {
      const g = G(p[0]) || D.guests[0]
      const stays = D.reservations.filter((r) => r.guest === g.id).sort((a, b) => b.from.localeCompare(a.from))
      const done = stays.filter((r) => r.status === "partie")
      return `<h1>Clients</h1><p class="lead">Coordonnées, historique des séjours et préférences.</p>
        <div class="split">
          <div><input placeholder="Rechercher un client" aria-label="Rechercher un client" oninput="A.fof.filterGuests(this.value)" style="margin-bottom:10px">
            <div class="list" id="glist">${D.guests.map((x) => `<button data-name="${esc(x.name.toLowerCase())}" aria-current="${x === g}" onclick="go('clients/${esc(x.id)}')">
              <strong>${esc(x.name)}</strong>${vip(x)}<div class="muted">${esc(x.phone)}</div></button>`).join("")}</div></div>
          <div class="card">
            <div class="row between"><span class="big">${esc(g.name)}</span>${vip(g)}</div>
            <div class="grid" style="margin:14px 0">${kpi("Séjours effectués", done.length, "historique")}${kpi("Nuitées", done.reduce((s, r) => s + nights(r.from, r.to), 0), "séjours effectués")}${kpi("Dépense hébergement", money(done.reduce((s, r) => s + nights(r.from, r.to) * r.rate, 0)), "exemple")}</div>
            <h3>Coordonnées</h3>
            <div class="form">
              <div><label for="c-name">Nom</label><input id="c-name" value="${esc(g.name)}"></div>
              <div><label for="c-phone">Téléphone</label><input id="c-phone" value="${esc(g.phone)}"></div>
              <div><label for="c-email">E-mail</label><input id="c-email" type="email" value="${esc(g.email)}"></div>
              <div><label for="c-nat">Nationalité</label><input id="c-nat" value="${esc(g.nationality)}"></div>
              <div><label>Pièce d'identité</label><input value="${esc(g.idDoc)}" disabled></div>
              <div style="align-self:end"><label class="row" style="color:var(--ink)"><input type="checkbox" id="c-vip" ${g.vip ? "checked" : ""}> Client VIP</label></div>
            </div>
            <h3>Préférences</h3>
            <div class="tags">${g.prefs.map((pr, i) => `<span class="pill">${esc(pr)}<button aria-label="Retirer" onclick="A.fof.delPref(${q(g.id)}, ${i})">×</button></span>`).join("") || `<span class="muted">Aucune préférence notée.</span>`}</div>
            <div class="row" style="margin-top:10px;flex-wrap:nowrap"><input id="c-pref" placeholder="Ajouter une préférence (ex. étage élevé)" onkeydown="if(event.key==='Enter')A.fof.addPref(${q(g.id)})"><button class="btn ghost" onclick="A.fof.addPref(${q(g.id)})">Ajouter</button></div>
            <div class="row" style="margin-top:16px"><button class="btn" onclick="A.fof.saveGuest(${q(g.id)})">Enregistrer</button><button class="btn ghost" onclick="go('reservations/new');setTimeout(()=>{$('#f-guest').value=${q(g.id)}})">Nouvelle réservation</button></div>
            <h3>Historique des séjours</h3>
            ${tbl(["Réf.", "Dates", "Type", "Chambre", "#Hébergement", "Statut"], stays.map((r) => [esc(r.id), `${fd(r.from)}/${r.from.slice(2, 4)} → ${fd(r.to)}`, esc(T(r.type).label), esc(r.room || "—"), money(nights(r.from, r.to) * r.rate), pill(STATUS, r.status)]), "Aucun séjour.")}
          </div>
        </div>`
    },
  }

  function resForm(r) {
    const isNew = !r.id, locked = r.status === "arrivee"
    const t = r.type || "STD", plan = r.plan || "BAR", guar = r.guarantee || "Carte bancaire"
    const contracts = D.sej?.contracts || [], accounts = D.sej?.ar?.accounts || []
    return `<div class="card" style="margin-bottom:20px"><h2 style="margin-top:0">${isNew ? "Nouvelle réservation" : `Modifier ${esc(r.id)}`}</h2>
      <div class="form">
        <div><label for="f-guest">Client</label><select id="f-guest">${D.guests.map((g) => `<option value="${esc(g.id)}" ${r.guest === g.id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></div>
        ${isNew ? `<div><label for="f-newname">ou nouveau client (nom)</label><input id="f-newname" placeholder="Laisser vide si client existant"></div>
          ${field("f-newnat", "Nationalité du nouveau client", select("f-newnat", NATS, "Côte d'Ivoire"))}` : ""}
        <div><label for="f-from">Arrivée</label><input id="f-from" type="date" value="${esc(r.from || today)}" ${locked ? "disabled" : ""} onchange="A.fof.price()"></div>
        <div><label for="f-to">Départ</label><input id="f-to" type="date" value="${esc(r.to || addDays(today, 1))}" onchange="A.fof.price()"></div>
        ${isNew ? field("f-rooms", "Nombre de chambres", select("f-rooms", ["1", "2", "3", "4"], "1", 'onchange="A.fof.price()"')) : ""}
        <div><label for="f-type">Type de chambre</label><select id="f-type" ${locked ? "disabled" : ""} onchange="A.fof.syncRate()">${D.roomTypes.map((x) => `<option value="${x.code}" ${t === x.code ? "selected" : ""}>${esc(x.label)} — ${money(x.rate)}</option>`).join("")}</select></div>
        ${field("f-adults", "Adultes", input("f-adults", r.adults || 1, 'type="number" min="1" max="4" oninput="A.fof.price()"'))}
        ${field("f-children", "Enfants", input("f-children", r.children || 0, 'type="number" min="0" max="3" oninput="A.fof.price()"'))}
        ${field("f-plan", "Plan tarifaire", select("f-plan", PLANS, plan, 'onchange="A.fof.syncRate()"'))}
        <div id="f-contract-box" style="${plan === "CORP" ? "" : "display:none"}">${field("f-contract", "Contrat", select("f-contract", contracts.map((c) => [c.id, `${c.id} · ${c.name}`]), r.contract, 'onchange="A.fof.syncRate()"'))}</div>
        <div><label for="f-rate">Tarif par nuit (${D.currency})</label><input id="f-rate" type="number" min="0" step="500" value="${r.rate ?? T(t).rate}" oninput="A.fof.price()"></div>
        ${field("f-source", "Source", select("f-source", SOURCES, r.source || "Direct (téléphone)"))}
        ${field("f-segment", "Segment", select("f-segment", SEGMENTS, r.segment || "Loisirs"))}
        <div><label for="f-guar">Garantie</label><select id="f-guar" onchange="A.fof.guarUi()">${GUARANTEES.map((x) => `<option ${guar === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div id="f-acc-box" style="${guar === "Compte société" ? "" : "display:none"}">${field("f-acc", "Compte société", select("f-acc", accounts.map((a) => [a.id, a.name]), r.account))}</div>
        ${field("f-cur", "Devise du client", select("f-cur", Object.keys(FX), r.currency || "FCFA", 'onchange="A.fof.price()"'))}
        <div class="full muted" id="f-guar-hint"></div>
        <div class="full"><label for="f-req">Demande spéciale</label><input id="f-req" value="${esc(r.request || "")}" placeholder="Ex. arrivée tardive, lit bébé…"></div>
        <div class="full" id="f-price"></div>
        <div class="full" id="f-err"></div>
        <div class="full row"><button class="btn" onclick="A.fof.saveRes(${isNew ? "null" : q(r.id)})">${isNew ? "Créer la réservation" : "Enregistrer"}</button><button class="btn ghost" onclick="go('reservations')">Fermer</button></div>
      </div><p class="muted">EF-RES-001 · EF-RES-002 · EF-RES-004 (prix détaillé par nuit, taxes, deux devises) · EF-RES-005 (garanties)</p></div>`
  }

  // Politique d'annulation : sans frais jusqu'à 48 h, puis 1re nuit ; non remboursable : 100 % (EF-RES-011)
  const cancelFee = (r) => {
    const lead = nights(today, r.from), n = nights(r.from, r.to)
    let fee = 0, why = "sans frais jusqu'à 48 h avant l'arrivée"
    if (r.plan === "NR") (fee = n * r.rate), (why = "tarif non remboursable : 100 % du séjour")
    else if (lead < 2) (fee = r.rate), (why = "annulation à moins de 48 h : 1re nuit due")
    if (fee && r.guarantee === "Aucune") return { fee: 0, why: why + " — réservation non garantie, aucun frais recouvrable" }
    if (fee && r.guarantee === "Acompte") return { fee: Math.min(fee, D.payments[r.id] || 0), why: why + " — retenu sur l'acompte" }
    return { fee, why }
  }
  function cancelPanel(r) {
    if (r.status !== "confirmee") return ""
    const c = cancelFee(r)
    return card(`Annuler ${r.id} — ${G(r.guest).name}`, `<p style="margin-top:0">Frais selon la politique : <strong>${money(c.fee)}</strong> <span class="muted">(${esc(c.why)})</span></p>
      ${form([`<div class="full"><label class="row" style="color:var(--ink)"><input type="checkbox" id="cx-waive"> Dérogation : annuler sans frais</label></div>`,
        field("cx-why", "Motif de la dérogation", input("cx-why", "", 'placeholder="Ex. décès dans la famille, vol annulé"')),
        field("cx-role", "Agent (droit requis : chef de réception ou plus)", select("cx-role", ROLES, "Réceptionniste")),
        `<div class="full" id="cx-err"></div>`,
        `<div class="full row">${btn("Confirmer l'annulation", `A.fof.confirmCancel(${q(r.id)})`, "accent")}${btn("Fermer", "go('reservations')", "ghost")}</div>`])}
      <p class="muted">EF-RES-011 : frais calculés et prélevés sur la garantie ; dérogation tracée avec motif et droit.</p>`, 'style="margin-bottom:20px"')
  }
  function channelsTab() {
    const rows = F.channelCopy.map((x) => {
      const r = x.resId && R(x.resId)
      const diffs = r ? ["from", "to", "type", "rate"].filter((k) => r[k] !== x[k]) : []
      const st = !r ? badge("Absente du PMS", "dark") : diffs.length ? badge("Écart : " + diffs.map((k) => ({ from: "arrivée", to: "départ", type: "type", rate: "tarif" })[k]).join(", "), "outline") : badge("Rapprochée", "on")
      return [esc(x.ext), esc(x.channel), r ? esc(r.id) : "—", esc(r ? G(r.guest).name : x.guest), `${fd(x.from)} → ${fd(x.to)} · ${esc(x.type)} · ${money(x.rate)}`,
        r ? `${fd(r.from)} → ${fd(r.to)} · ${esc(r.type)} · ${money(r.rate)}` : "—", st + (x.note ? ef(x.note) : ""),
        !r ? btn("Importer", `A.fof.importExt(${q(x.ext)})`, "sm") : diffs.length ? btn("Aligner sur le canal", `A.fof.alignExt(${q(x.ext)})`, "ghost sm") : ""]
    })
    return `<p class="muted">Réservations des canaux (OTA, GDS) importées avec leur identifiant externe, puis comparées à la copie du canal. Le canal fait foi sur les champs contractuels (RG-RES-05). EF-RES-016</p>
      ${tbl(["Réf. externe", "Canal", "Réf. PMS", "Client", "Version du canal", "Version PMS", "État", ""], rows)}
      <div class="row" style="margin-top:10px">${btn("Tout réconcilier", "A.fof.reconcileAll()")}</div>`
  }
  function messagesTab() {
    return `<p class="muted">Confirmations, modifications, annulations et rappels pré-arrivée avec lien de check-in en ligne. E-mail, SMS et WhatsApp simulés. EF-RES-013</p>
      ${tbl(["Réf.", "Envoyé le", "Réservation", "Type", "Canal", "Message"], F.comms.map((m) => [esc(m.id), esc(m.at), esc(m.resId || "—"), esc(m.kind), esc(m.channel), esc(m.text)]), "Aucun message.")}
      <div class="row" style="margin-top:10px">${btn("Envoyer les rappels pré-arrivée (J-2)", "A.fof.reminders()", "ghost")}</div>`
  }

  function checkinPanel(r) {
    const g = G(r.guest)
    if (ui.done && ui.done.id === r.id) { const d = R(r.id)
      return `<div class="card"><span class="pill on">Clé encodée</span>
      <div class="big" style="margin:10px 0 4px">Chambre ${esc(d.room)} — ${esc(g.name)}</div>
      <p class="muted">${esc(ui.done.card)} valable jusqu'au ${fd(d.to)} à 13 h (départ 12 h + 1 h de grâce, simulation). Séjour ouvert, folio créé.</p>
      <p class="muted">CGV signées (${esc(d.cgv?.how || "tablette")}) · ${esc(d.preauth?.mode || "")} ${d.preauth ? money(d.preauth.amount) : ""}${ui.done.police ? ` · fiche de police ${esc(ui.done.police)}` : ""}${F.offline ? " · en file de resynchronisation" : ""}</p>
      <div class="row"><button class="btn" onclick="ui.done=null;go('checkin')">Arrivée suivante</button><button class="btn ghost" onclick="go('accueil')">Tableau de bord</button></div></div>` }
    if (ui.encFail === r.id && ui.ckJob) return `<div class="card"><span class="pill dark">Échec d'encodage</span>
      <p>La carte n'a pas été détectée sur ${esc(ui.ckJob.enc)} (CARD_NOT_PRESENT). Le séjour n'est pas encore ouvert.</p>
      <div class="row">${btn("Réessayer", `A.fof.encode(${q(r.id)}, 'retry')`, "accent")}${btn("Autre encodeur", `A.fof.encode(${q(r.id)}, 'other')`, "ghost")}${btn("Abandonner", "ui.encFail=null;ui.ckJob=null;render()", "ghost")}</div></div>`
    if (r.status !== "confirmee") return `<div class="card"><p>${esc(r.id)} n'est pas une arrivée à enregistrer (${esc(STATUS[r.status][0])}).</p></div>`
    const candidates = D.rooms.filter((x) => x.type === r.type && !occupant(x.no))
    const enc = ui.encoding === r.id, best = bestRoom(r)
    const encs = (D.acc?.encoders || [{ id: "ENC-1", status: "prêt", post: "Réception poste 1" }]).filter((e) => e.status === "prêt")
    const paDef = r.guarantee === "Compte société" ? "Compte société (sans dépôt)" : r.guarantee === "Mobile Money" ? "Dépôt Mobile Money" : "Pré-autorisation carte (TPE simulé)"
    return `<div class="card">
      <div class="row between"><span class="big">${esc(g.name)}</span>${vip(g)}</div>
      <div class="muted">${esc(r.id)} · ${esc(T(r.type).label)} · du ${fd(r.from)} au ${fd(r.to)} · ${nights(r.from, r.to)} nuit(s) · ${money(r.rate)}/nuit · garantie : ${esc(r.guarantee)}</div>
      ${r.request ? `<p style="margin:8px 0 0"><strong>Demande :</strong> ${esc(r.request)}</p>` : ""}
      ${g.prefs.length ? `<p class="muted" style="margin:4px 0 0">Préférences : ${esc(g.prefs.join(", "))}</p>` : ""}
      ${F.online[r.id] ? `<p style="margin:6px 0 0">${badge("Check-in en ligne complété", "on")} ${ef(`le ${F.online[r.id].at}, pièce et signature reçues`)}</p>` : ""}
      ${best && !enc ? `<div style="margin-top:10px">${aiBox("Attribution proposée", `Ch. ${best.room.no} : ${best.why}. EF-FOF-002`, btn("Choisir cette chambre", `A.fof.pick(${q(best.room.no)})`, "sm"))}</div>` : ""}
      <div class="step"><b class="n">1</b><div><strong>Chambre</strong><p class="muted" style="margin:2px 0 8px">Seules les chambres propres et libres peuvent être attribuées (RG-FOF-01).</p>
        <div class="rooms">${candidates.map((x) => `<label class="${x.hk !== "propre" ? "dis" : ""}"><input type="radio" name="room" value="${esc(x.no)}" ${x.hk !== "propre" || enc ? "disabled" : ""} onchange="A.fof.ckReady()">
          <span><strong>${esc(x.no)}</strong><br>${pill(HK, x.hk)}</span></label>`).join("") || `<p class="muted">Aucune chambre libre de ce type.</p>`}</div></div></div>
      <div class="step"><b class="n">2</b><div><strong>Identité</strong><p class="muted" style="margin:2px 0 8px">Pièce enregistrée : ${esc(g.idDoc)} · ${esc(g.nationality || "nationalité à préciser")}</p>
        ${enc ? "" : `<div class="row" style="margin-bottom:8px">${btn("Scanner la pièce (OCR simulé)", `A.fof.ocr(${q(r.id)})`, "ghost sm")}<span id="ocr-out" class="muted"></span></div>`}
        ${!g.nationality && !enc ? field("ck-nat", "Nationalité", select("ck-nat", [["", "— préciser —"], ...NATS], "", `onchange="A.fof.setNat(${q(g.id)}, this.value)"`)) : ""}
        <label class="row" style="color:var(--ink)"><input type="checkbox" id="id-ok" onchange="A.fof.ckReady()" ${enc ? "disabled checked" : ""}> Pièce d'identité présentée et conforme</label>
        ${isForeign(g) && !enc ? `<div style="margin-top:10px"><strong>Fiche de police</strong> ${badge("Obligatoire", "dark")}<p class="muted" style="margin:2px 0 0">Voyageur étranger (${esc(g.nationality)}) : tous les champs sont exigés avant l'encodage (RG-FOF-07). EF-CRM-013</p>${policeFields(g)}</div>` : ""}</div></div>
      <div class="step"><b class="n">3</b><div><strong>Conditions et garantie</strong><p class="muted" style="margin:2px 0 8px">Conditions générales signées électroniquement et pré-autorisation (estimation du séjour + caution ${money(F.fisc.caution)} = ${money(preauthAmount(r))}).</p>
        ${enc ? "" : form([field("ck-sign", "Signature des CGV", select("ck-sign", ["Tablette du comptoir", "Lien e-mail au client", "Papier scanné"], F.online[r.id] ? "Lien e-mail au client" : "Tablette du comptoir")),
          field("ck-pa", "Garantie du séjour", select("ck-pa", [F.offline ? "Pré-autorisation carte (différée, mode dégradé)" : "Pré-autorisation carte (TPE simulé)", "Dépôt espèces", "Dépôt Mobile Money", "Compte société (sans dépôt)"], paDef, 'onchange="A.fof.ckReady()"')),
          r.from === today ? `<div class="full"><label class="row" style="color:var(--ink)"><input type="checkbox" id="ck-early"> Arrivée anticipée (avant 14 h) : supplément ${money(earlyFee(r))} (50 % d'une nuit, EF-FOF-011)</label></div>` : ""])}
        <p class="muted" style="margin:4px 0 0">EF-FOF-003 : identité (OCR), fiche de police, CGV signées, pré-autorisation ou dépôt, attribution.</p></div></div>
      <div class="step"><b class="n">4</b><div><strong>Clé d'accès</strong><p class="muted" style="margin:2px 0 8px">Posez une carte vierge sur l'encodeur puis validez : cartes et clé mobile émises en une seule action via le contrôle d'accès (EF-FOF-004).</p>
        ${enc ? `<div>Encodage de ${esc(String(ui.ckJob?.cards || 1))} carte(s) sur ${esc(ui.ckJob?.enc || "ENC-1")}${F.offline ? " via la passerelle edge (mode local)" : ""}…</div><div class="bar"><i></i></div>` : `${form([
          field("ck-cards", "Cartes", select("ck-cards", ["1", "2", "3", "4"], "1")),
          field("ck-enc", "Encodeur", select("ck-enc", encs.map((e) => [e.id, `${e.id} · ${e.post || ""}`]), encs[0]?.id)),
          `<div class="full"><label class="row" style="color:var(--ink)"><input type="checkbox" id="ck-mobile"> Ajouter une clé mobile (application client)</label></div>`,
          `<div class="full"><label class="row" style="color:var(--ink)"><input type="checkbox" id="ck-fail"> Simuler un échec d'encodage (démonstration)</label></div>`])}
          <div id="ck-hint" class="muted" style="margin:6px 0"></div>
          <button class="btn accent" id="enc" disabled onclick="A.fof.encode(${q(r.id)})">Attribuer la chambre et encoder la clé</button>`}</div></div>
    </div>`
  }

  function checkoutPanel(r) {
    const g = G(r.guest), early = r.to > today
    // départ anticipé : le folio est calculé sur les nuits réellement passées
    const end = early ? (nights(r.from, today) > 0 ? today : addDays(r.from, 1)) : r.to
    const tx = pendingTaxes(r, end)
    const base = folio(early ? { ...r, to: end } : r)
    const f = { lines: [...base.lines, ...tx], total: base.total + sumA(tx, (l) => l.amount), paid: base.paid }
    f.balance = f.total - f.paid
    const ex = D.extras[r.id] || [], lateLine = ex.find((l) => l.code === "LATE"), cardsOut = ex.some((l) => l.code === "CARD")
    const canExpress = ["Carte bancaire", "Compte société"].includes(r.guarantee)
    return `<div class="card">
      <div class="row between"><span class="big">Ch. ${esc(r.room)} — ${esc(g.name)}</span>${vip(g)}</div>
      <div class="muted">${esc(r.id)} · du ${fd(r.from)} au ${fd(r.to)} · clé active${r.keys ? ` · ${r.keys.cards} carte(s)${r.keys.mobile ? " + clé mobile" : ""}` : ""}</div>
      ${early ? `<p class="err">Départ anticipé : le séjour sera écourté au ${fd(today)} et les nuits restantes ne seront pas facturées.</p>` : ""}
      <h3>Folio</h3>
      ${tbl(["Désignation", "#Montant"], f.lines.map((l) => [esc(l.label) + (tx.includes(l) ? ef("publiée au départ") : ""), money(l.amount)]))}
      <div class="row" style="margin-top:10px;flex-wrap:nowrap"><input id="x-label" placeholder="Prestation (ex. minibar)"><input id="x-amount" type="number" min="0" step="500" placeholder="Montant" style="max-width:140px"><button class="btn ghost" onclick="A.fof.addExtra(${q(r.id)})">Ajouter</button></div>
      <div class="form" style="margin-top:12px">
        ${field("co-late", "Heure de départ", select("co-late", [["", "À l'heure (12 h)"], ["14", "Départ tardif jusqu'à 14 h (offert)"], ["18", `Jusqu'à 18 h (+${money(round500(r.rate * 0.5))})`], ["nuit", `Après 18 h (+${money(r.rate)})`]], lateLine?.late || r.late || "", `onchange="A.fof.late(${q(r.id)}, this.value)"`))}
        <div style="align-self:end"><label class="row" style="color:var(--ink)"><input type="checkbox" id="co-card" ${cardsOut ? "" : "checked"} onchange="A.fof.cardBack(${q(r.id)}, this.checked)"> Carte(s) restituée(s)</label></div>
      </div>
      <p class="muted" style="margin:4px 0 0">Départ tardif facturé selon l'heure (EF-FOF-011) ; carte non rendue facturée ${money(F.fisc.cardFee)} l'unité.</p>
      <table style="margin-top:14px"><tbody><tr><td>Total</td><td class="num">${money(f.total)}</td></tr><tr><td>Déjà réglé</td><td class="num">${money(f.paid)}</td></tr>
          <tr><td><strong>Reste à encaisser</strong></td><td class="num"><strong>${money(Math.max(0, f.balance))}</strong></td></tr></tbody></table>
        <div class="form" style="margin-top:14px"><div><label for="pay">Mode de paiement</label><select id="pay">${["Espèces", "Carte bancaire", "Mobile Money", "Virement"].map((m) => `<option>${m}</option>`).join("")}</select></div>
          ${field("co-send", "Envoi de la facture", select("co-send", ["E-mail", "WhatsApp", "E-mail et WhatsApp", "Aucun (imprimée)"], "E-mail"))}
          <div class="full"><button class="btn accent" style="width:100%" onclick="A.fof.checkout(${q(r.id)})">Encaisser ${money(Math.max(0, f.balance))}, facturer et révoquer la clé</button></div></div>
      ${canExpress ? `<div class="row" style="margin-top:10px">${btn("Express check-out : prélever la garantie et envoyer la facture par e-mail", `A.fof.express(${q(r.id)})`, "ghost")}</div><p class="muted" style="margin:4px 0 0">Sans passage en caisse : solde prélevé sur ${esc(r.guarantee === "Carte bancaire" ? "le jeton de carte (PSP simulé)" : "le compte société")}. EF-FOF-010</p>` : ""}
      <p class="muted">EF-FOF-009 : contrôle du folio, encaissement, facture, révocation des clés, retour de carte, envoi de la facture électronique.</p>
    </div>`
  }

  // ---------- Actions ----------
  const actions = {
    riskOf, taxes, taxTable, addPolice, msg,
    syncRate() {
      const type = val("f-type"), plan = val("f-plan")
      $("#f-contract-box").style.display = plan === "CORP" ? "" : "none"
      let rate = T(type).rate
      if (plan === "NR") rate = round500(rate * 0.9)
      if (plan === "CORP") {
        const c = (D.sej?.contracts || []).find((x) => x.id === val("f-contract"))
        if (c) { rate = c.rates[type] || rate; $("#f-guar").value = "Compte société"; $("#f-acc").value = c.account; $("#f-segment").value = "Affaires"; $("#f-source").value = "Société" }
      }
      $("#f-rate").value = rate
      A.fof.guarUi()
    },
    guarUi() {
      const gu = val("f-guar"), box = $("#f-acc-box"), hint = $("#f-guar-hint")
      if (box) box.style.display = gu === "Compte société" ? "" : "none"
      if (hint) hint.textContent = {
        "Carte bancaire": "Carte saisie sur le terminal sécurisé du PSP : seul un jeton est conservé, jamais le numéro (RG-FOL-01, simulé).",
        Acompte: "Acompte de 30 % demandé par lien de paiement, échéancier suivi dans Finance › Paiements.",
        "Mobile Money": "Garantie par paiement mobile money (Orange Money, MTN MoMo, Wave, Moov) : confirmation asynchrone de l'opérateur.",
        "Compte société": "Débit sur le compte société (city ledger), dans la limite de son plafond.",
        Aucune: "Option tenue jusqu'à 18 h le jour d'arrivée, puis libérée automatiquement sans frais (RG-RES-01).",
      }[gu] || ""
      A.fof.price()
    },
    price() {
      const out = $("#f-price")
      if (!out) return
      const from = val("f-from"), to = val("f-to"), rate = Number(val("f-rate")), ad = Math.max(1, Number(val("f-adults")) || 1), n = Number(val("f-rooms")) || 1, cur = val("f-cur") || "FCFA"
      if (!from || !to || to <= from || !(rate > 0)) { out.innerHTML = ""; return }
      const ns = nightList(from, to), tax = F.fisc.taxeSejour * ad
      const total = (rate + tax) * ns.length * n, tva = Math.round(rate * ns.length * n * (F.fisc.tva / (100 + F.fisc.tva)))
      const rows = ns.slice(0, 7).map((d) => [`${esc(wd(d))} ${fd(d)}`, money(rate), money(tax), money((rate + tax) * n)])
      out.innerHTML = `<strong>Détail du prix</strong>${tbl(["Nuit", "#Tarif chambre", "#Taxe de séjour", `#Total (${n} ch.)`], rows, "", `<tfoot><tr><td>Total ${ns.length} nuit(s)${ns.length > 7 ? " (7 premières affichées)" : ""}</td><td></td><td></td><td class="num">${money(total)}</td></tr></tfoot>`)}
        <div class="muted">Dont TVA ${F.fisc.tva} % incluse : ${money(tva)} · taxe de séjour ${money(F.fisc.taxeSejour)} × ${ad} adulte(s) × nuit${cur !== "FCFA" ? ` · soit ${(total / FX[cur]).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${cur} pour le client (cours ${FX[cur]} FCFA, exemple)` : ""}</div>`
    },
    saveRes(id) {
      const v = (s) => $(s)?.value.trim()
      const err = (m) => ($("#f-err").innerHTML = `<div class="err">${esc(m)}</div>`)
      const r = id ? R(id) : null
      const from = r && r.status === "arrivee" ? r.from : v("#f-from"), to = v("#f-to"), type = r && r.status === "arrivee" ? r.type : v("#f-type")
      const rate = Number(v("#f-rate")), n = Number(v("#f-rooms")) || 1, adults = Number(v("#f-adults")) || 1, children = Number(v("#f-children")) || 0
      const guarantee = v("#f-guar"), plan = v("#f-plan") || "BAR"
      if (!from || !to) return err("Indiquez les dates d'arrivée et de départ.")
      if (to <= from) return err("La date de départ doit être après la date d'arrivée.")
      if (!r && from < today) return err("La date d'arrivée ne peut pas être dans le passé.")
      if (!(rate > 0)) return err("Indiquez un tarif par nuit.")
      if (adults < 1 || adults > 4 || children < 0) return err("Occupants : 1 à 4 adultes.")
      if (plan === "CORP" && !v("#f-contract")) return err("Choisissez le contrat entreprise.")
      if (guarantee === "Compte société" && !v("#f-acc")) return err("Choisissez le compte société.")
      // Verrou d'inventaire : une seule écriture à la fois, disponibilité relue sous verrou (EF-RES-003)
      if (lock) return err(`Inventaire verrouillé par ${lock} : réessayez dans un instant.`)
      lock = USER
      try {
        for (let d = from; d < to; d = addDays(d, 1))
          if (available(type, d, id) < n) return err(`${n > 1 ? `Pas assez de chambres (${n})` : "Aucune chambre"} ${T(type).label} disponible la nuit du ${fd(d)} : la réservation créerait une surréservation. Changez les dates ou le type.`)
        let guest = v("#f-guest")
        const newName = v("#f-newname")
        if (newName) {
          let k = D.guests.length + 1
          while (G("G" + k)) k++
          guest = "G" + k
          D.guests.push({ id: guest, name: newName, phone: "", email: "", nationality: v("#f-newnat") || "", idDoc: "À vérifier au check-in", vip: false, prefs: [] })
        }
        const fields = { guest, from, to, type, rate, guarantee, request: v("#f-req"), adults, children, plan, contract: plan === "CORP" ? v("#f-contract") : undefined,
          source: v("#f-source"), segment: v("#f-segment"), account: guarantee === "Compte société" ? v("#f-acc") : undefined, currency: v("#f-cur") || "FCFA" }
        if (guarantee === "Carte bancaire" && !(r && r.token)) fields.token = "tok_" + uid("").toLowerCase().replace("-", "")
        const g = G(guest)
        if (r) {
          Object.assign(r, fields)
          msg(r.id, "Modification", contactOf(g), `Réservation ${r.id} modifiée : du ${fd(from)} au ${fd(to)}, ${T(type).label}, ${money(rate)}/nuit.`)
        } else {
          const ids = []
          const multi = n > 1 ? "MR-" + ui.resSeq : undefined
          for (let i = 0; i < n; i++) { const rid = "R-" + ui.resSeq++; ids.push(rid); D.reservations.push({ id: rid, status: "confirmee", booked: today, multi, ...fields }) }
          msg(ids[0], "Confirmation", contactOf(g), `Réservation ${ids.join(", ")} confirmée du ${fd(from)} au ${fd(to)} (${n} ch. ${T(type).label}). Check-in en ligne : https://exemple.test/checkin/${ids[0]} (simulé)`)
        }
      } finally { lock = null }
      toast(r ? `Réservation ${r.id} modifiée` : n > 1 ? `${n} réservations créées (multi-chambres)` : "Réservation créée")
      go("reservations")
    },
    race() {
      let slot = null
      for (const d of Array.from({ length: 14 }, (_, i) => addDays(today, i))) { const t = D.roomTypes.find((x) => available(x.code, d) === 1); if (t) { slot = [t, d]; break } }
      if (!slot) return toast("Aucune nuit avec une seule chambre libre sur 14 jours")
      const [t, d] = slot
      lock = "Agent A (poste 1)"
      const steps = [["1", `Agent A ouvre une réservation ${t.label} pour la nuit du ${fd(d)} : il reste 1 chambre, l'inventaire est verrouillé.`]]
      steps.push(["2", `Agent B (poste 2) valide au même moment : refusé, « inventaire verrouillé par ${lock} ».`])
      lock = null
      steps.push(["3", `Agent A valide : la disponibilité relue sous verrou passe à 0. Agent B réessaie : refusé, plus de ${t.label} le ${fd(d)}. Aucune survente (simulation sans enregistrement).`])
      ui.race = steps
      render()
    },
    cancelRes(id) { go(`reservations/cancel/${id}`) },
    confirmCancel(id) {
      const r = R(id), c = cancelFee(r), waive = $("#cx-waive").checked, why = val("cx-why"), role = val("cx-role")
      const e = (m) => ($("#cx-err").innerHTML = `<div class="err">${esc(m)}</div>`)
      if (waive && role === "Réceptionniste") return e("Dérogation réservée au chef de réception, au duty manager ou au directeur.")
      if (waive && !why) return e("Motif de dérogation obligatoire.")
      const fee = waive ? 0 : c.fee
      r.status = "annulee"
      r.cancel = { at: `${today} ${nowT()}`, fee, waived: waive && c.fee > 0, reason: why || c.why, by: role }
      if (fee && ["Carte bancaire", "Compte société", "Mobile Money"].includes(r.guarantee) && D.sej?.payLog) {
        D.sej.payLog.unshift({ id: uid("P"), at: `${today} ${nowT()}`, resId: id, mode: r.guarantee === "Carte bancaire" ? "Carte (jeton PSP)" : r.guarantee === "Compte société" ? "City ledger" : "Mobile Money", amount: fee, status: "confirmé", by: USER, note: "Frais d'annulation" })
        D.payments[id] = (D.payments[id] || 0) + fee
      }
      msg(id, "Annulation", contactOf(G(r.guest)), `Réservation ${id} annulée${fee ? `, frais ${money(fee)}` : " sans frais"}.`)
      toast(`Réservation ${id} annulée${fee ? ` — frais ${money(fee)}` : waive ? " — dérogation enregistrée" : ""}`)
      go("reservations")
    },
    reminders() {
      const l = D.reservations.filter((r) => r.status === "confirmee" && r.from >= today && r.from <= addDays(today, 2) && !olSent(r.id))
      l.forEach((r) => msg(r.id, "Rappel pré-arrivée", contactOf(G(r.guest)), `Arrivée le ${fd(r.from)} : check-in en ligne sur https://exemple.test/checkin/${r.id} (lien simulé)`))
      toast(l.length ? `${l.length} rappel(s) pré-arrivée envoyé(s) avec lien de check-in en ligne` : "Tous les rappels J-2 sont déjà envoyés")
      render()
    },
    importExt(ext) {
      const x = F.channelCopy.find((c) => c.ext === ext)
      for (let d = x.from; d < x.to; d = addDays(d, 1)) if (available(x.type, d) < 1) return toast(`Import refusé : plus de ${T(x.type).label} le ${fd(d)}, le canal est notifié`)
      let g = D.guests.find((y) => y.name === x.guest)
      if (!g) { let k = D.guests.length + 1; while (G("G" + k)) k++; D.guests.push((g = { id: "G" + k, name: x.guest, phone: "", email: x.email || "", nationality: x.nationality || "", idDoc: "À vérifier au check-in", vip: false, prefs: [] })) }
      const id = "R-" + ui.resSeq++
      D.reservations.push({ id, guest: g.id, type: x.type, from: x.from, to: x.to, rate: x.rate, guarantee: "Carte bancaire", token: "tok_" + ext.toLowerCase(), status: "confirmee", ext, source: x.channel, segment: "Affaires", booked: today })
      x.resId = id
      toast(`${ext} importée en ${id}`)
      render()
    },
    alignExt(ext, silent) {
      const x = F.channelCopy.find((c) => c.ext === ext), r = R(x.resId)
      if (r.status !== "confirmee" && (x.from !== r.from || x.type !== r.type)) { if (!silent) toast(`${r.id} est en séjour : arrivée et type non modifiables, à traiter avec le canal`); return false }
      for (let d = x.from; d < x.to; d = addDays(d, 1)) if (available(x.type, d, r.id) < 1) { if (!silent) toast(`Plus de ${T(x.type).label} le ${fd(d)} : alignement impossible`); return false }
      Object.assign(r, { from: x.from, to: x.to, type: x.type, rate: x.rate, ext })
      msg(r.id, "Modification", contactOf(G(r.guest)), `Réservation ${r.id} mise à jour depuis ${x.channel} : du ${fd(x.from)} au ${fd(x.to)}.`)
      if (!silent) { toast(`${r.id} alignée sur ${x.channel}`); render() }
      return true
    },
    reconcileAll() {
      let n = 0
      F.channelCopy.forEach((x) => { const r = x.resId && R(x.resId)
        if (!r) { A.fof.importExt(x.ext); n++ } else if (["from", "to", "type", "rate"].some((k) => r[k] !== x[k]) && A.fof.alignExt(x.ext, true)) n++ })
      toast(n ? `${n} réservation(s) réconciliée(s)` : "Rien à réconcilier")
      render()
    },
    pick(no) {
      const i = document.querySelector(`input[name=room][value="${no}"]`)
      if (i && !i.disabled) { i.checked = true; A.fof.ckReady() }
    },
    ocr(id) {
      const g = G(R(id).guest)
      const out = $("#ocr-out")
      if (out) out.textContent = `Lu : ${g.name} · ${g.idDoc} · ${g.nationality || "nationalité non lue"} · expire le 12/2031 (OCR simulé)`
      const ok = $("#id-ok")
      if (ok) ok.checked = true
      const doc = $("#fp-doc")
      if (doc && !doc.value) doc.value = g.idDoc
      A.fof.ckReady()
    },
    setNat(gid, v) { if (!v) return; G(gid).nationality = v; render() },
    ckReady() {
      const b = $("#enc")
      if (!b) return
      const room = document.querySelector("input[name=room]:checked"), id = $("#id-ok")?.checked
      const police = !$("#fp-doc") || POLICE_KEYS.every((k) => val("fp-" + k))
      const cash = val("ck-pa") !== "Dépôt espèces" || cashOpen()
      b.disabled = !(room && id && police && cash)
      const h = $("#ck-hint")
      if (h) h.textContent = !police ? "Fiche de police incomplète (voyageur étranger)." : !cash ? "Aucune caisse ouverte : dépôt espèces impossible (Finance › Caisses)." : ""
    },
    encode(id, how) {
      let job = how && ui.ckJob && ui.ckJob.id === id ? ui.ckJob : null
      if (!job) {
        const roomEl = document.querySelector("input[name=room]:checked")
        if (!roomEl) return
        const g = G(R(id).guest)
        job = { id, room: roomEl.value, cards: Number(val("ck-cards")) || 1, mobile: !!$("#ck-mobile")?.checked, enc: val("ck-enc") || "ENC-1", fail: !!$("#ck-fail")?.checked,
          early: !!$("#ck-early")?.checked, pa: val("ck-pa") || "Pré-autorisation carte (TPE simulé)", sign: val("ck-sign") || "Tablette du comptoir", police: isForeign(g) ? readPolice() : null }
        if (isForeign(g) && !job.police) return toast("Fiche de police obligatoire pour un voyageur étranger (RG-FOF-07)")
        const total = job.cards + (job.mobile ? 1 : 0)
        if (total > 4) { const who = prompt(`${total} clés dépassent la limite de 4 par chambre. Validation du chef de réception (nom) :`, "Kouamé Ahoua (duty manager)"); if (!who) return; job.override = who }
      }
      if (how === "other") { const o = (D.acc?.encoders || []).find((e) => e.status === "prêt" && e.id !== job.enc); if (o) job.enc = o.id }
      if (how) job.fail = false
      ui.ckJob = job; ui.encFail = null; ui.encoding = id
      render()
      document.querySelectorAll(`input[name=room][value="${job.room}"]`).forEach((i) => (i.checked = true))
      setTimeout(() => {
        ui.encoding = null
        if (job.fail) { ui.encFail = id; toast("Échec d'encodage : réessayer ou choisir un autre encodeur"); return render() }
        const r = R(id), g = G(r.guest)
        Object.assign(r, { status: "arrivee", room: job.room, key: "active", keys: { cards: job.cards, mobile: job.mobile, encoder: job.enc }, cgv: { at: `${today} ${nowT()}`, how: job.sign } })
        r.preauth = { mode: job.pa, amount: preauthAmount(r), ref: uid("PA") }
        D.extras[id] = D.extras[id] || []
        if (job.early) D.extras[id].push({ label: "Arrivée anticipée (avant 14 h)", amount: earlyFee(r), code: "EARLY" })
        const fp = job.police ? addPolice({ ...job.police, resId: id, guest: g.id, nationality: g.nationality }) : null
        const keys = issueKeys(r, job.cards, job.mobile, F.offline ? "Passerelle edge (local)" : job.enc)
        A.fol?.autoRoute?.(id)
        if (F.offline) { F.queue.push({ at: nowT(), what: `Check-in ${id} ch. ${job.room}, ${keys.length || job.cards} clé(s) encodée(s) localement` }); r.sync = "en attente" }
        ui.done = { id, card: keys.length ? (keys.length > 1 ? "Clés " : "Carte ") + keys.join(", ") : "Carte K-" + String(Math.floor(Math.random() * 9000) + 1000), police: fp?.id }
        ui.ckJob = null
        toast(`Check-in terminé — chambre ${job.room}`)
        render()
      }, 1400)
    },
    olLink(id) {
      const r = R(id)
      msg(id, "Lien de check-in en ligne", contactOf(G(r.guest)), `Gagnez du temps : check-in en ligne sur https://exemple.test/checkin/${id} (lien simulé)`)
      toast("Lien de check-in en ligne envoyé (simulé)")
      render()
    },
    olDone(id) {
      const r = R(id), g = G(r.guest)
      F.online[id] = { at: `${today} ${nowT()}`, eta: "15:00", how: "Lien e-mail", signed: true }
      if (isForeign(g) && !F.police.some((x) => x.resId === id)) addPolice({ resId: id, guest: g.id, nationality: g.nationality, birth: "1990-01-01", place: "—", prof: "—", addr: "Saisie en ligne", doc: g.idDoc, issued: "2023-01-01", entry: r.from, from: "—", to: "Abidjan", online: true })
      toast(`${g.name} a complété son check-in en ligne (pièce, signature${isForeign(g) ? ", fiche de police" : ""})`)
      render()
    },
    mobileCheckin(id) {
      const r = R(id), b = bestRoom(r)
      if (!b) return toast(`Aucune ${T(r.type).label} propre : la clé mobile sera activée dès la validation du ménage`)
      Object.assign(r, { status: "arrivee", room: b.room.no, key: "active", keys: { cards: 0, mobile: true, encoder: "SDK mobile" }, cgv: { at: F.online[id].at, how: "Application (signature en ligne)" } })
      r.preauth = { mode: "Pré-autorisation carte (en ligne)", amount: preauthAmount(r), ref: uid("PA") }
      D.extras[id] = D.extras[id] || []
      issueKeys(r, 0, true)
      if (D.sej?.meta) D.sej.meta[id] = { ...(D.sej.meta[id] || { source: r.source || "Réception", segment: r.segment || "Individuel", booked: r.booked || r.from }), mode: "mobile" }
      msg(id, "Chambre prête", "Notification application", `Votre chambre ${b.room.no} est prête : la clé mobile est active, allez directement en chambre.`)
      A.fol?.autoRoute?.(id)
      toast(`Ch. ${b.room.no} attribuée, clé mobile active — sans passage au comptoir`)
      render()
    },
    offline() { F.offline = true; F.cacheAt = `${fd(today)} ${nowT()}`; toast("Connexion perdue : passage en mode dégradé (simulé)"); render() },
    resync() {
      const n = F.queue.length
      F.queue = []; F.offline = false
      D.reservations.forEach((r) => delete r.sync)
      F.police.forEach((x) => { if (x.status === "en file (mode dégradé)") x.status = "à transmettre" })
      toast(`Connexion rétablie : ${n} opération(s) resynchronisée(s) avec le cloud`)
      render()
    },
    sendPolice(fid) {
      if (F.offline) return toast("Mode dégradé : transmission impossible, les fiches restent en file")
      const l = F.police.filter((x) => x.status !== "transmise" && (!fid || x.id === fid))
      l.forEach((x) => Object.assign(x, { status: "transmise", sentAt: `${fd(today)} ${nowT()}` }))
      toast(`${l.length} fiche(s) de police transmise(s) (télédéclaration simulée)`)
      render()
    },
    late(id, v) {
      const r = R(id), ex = (D.extras[id] = D.extras[id] || [])
      const i = ex.findIndex((l) => l.code === "LATE")
      if (i >= 0) ex.splice(i, 1)
      r.late = v
      const amt = v === "18" ? round500(r.rate * 0.5) : v === "nuit" ? r.rate : 0
      if (v) ex.push({ label: v === "14" ? "Départ tardif jusqu'à 14 h (offert)" : v === "18" ? "Départ tardif jusqu'à 18 h" : "Départ après 18 h (nuit supplémentaire)", amount: amt, code: "LATE", late: v })
      render()
    },
    cardBack(id, ok) {
      const r = R(id), ex = (D.extras[id] = D.extras[id] || [])
      const i = ex.findIndex((l) => l.code === "CARD")
      if (i >= 0) ex.splice(i, 1)
      const n = r.keys ? r.keys.cards : 1
      if (!ok && n) ex.push({ label: `Carte(s) non restituée(s) (${n})`, amount: F.fisc.cardFee * n, code: "CARD" })
      render()
    },
    addExtra(id) {
      const label = $("#x-label").value.trim(), amount = Number($("#x-amount").value)
      if (!label || !(amount > 0)) return toast("Indiquez la prestation et son montant")
      ;(D.extras[id] = D.extras[id] || []).push({ label, amount })
      render()
    },
    checkout(id, express) {
      const r = R(id)
      if (r.to > today) r.to = nights(r.from, today) > 0 ? today : addDays(r.from, 1)
      ;(D.extras[id] = D.extras[id] || []).push(...pendingTaxes(r))
      r.payMode = express ? (r.guarantee === "Carte bancaire" ? `Prélèvement sur la garantie (jeton ${r.token || "PSP"})` : "Débit du compte société") : $("#pay").value
      const send = express ? "E-mail" : val("co-send") || "E-mail"
      D.payments[id] = folio(r).total
      Object.assign(r, { status: "partie", key: "revoquee", invoice: "F-" + ui.invoiceSeq++, express: !!express })
      D.rooms.find((x) => x.no === r.room).hk = "sale"
      r.invoiceSent = send === "Aucun (imprimée)" ? [] : send === "E-mail et WhatsApp" ? ["E-mail", "WhatsApp"] : [send]
      r.invoiceSent.forEach((c) => msg(id, `Facture ${r.invoice}`, c, `Facture ${r.invoice} de ${money(folio(r).total)} (PDF et facture normalisée électronique, simulé).`))
      toast(express ? `Express check-out : ${money(folio(r).total)} prélevés, facture envoyée par e-mail` : `Clé de la chambre ${r.room} révoquée`)
      go(`facture/${id}`)
    },
    express(id) {
      if (!confirm(`Express check-out : prélever le solde sur la garantie et envoyer la facture par e-mail ?`)) return
      A.fof.checkout(id, true)
    },
    resend(id, c) {
      const r = R(id)
      r.invoiceSent = [...new Set([...(r.invoiceSent || []), c])]
      msg(id, `Facture ${r.invoice}`, c, `Facture ${r.invoice} renvoyée (simulé).`)
      toast(`Facture ${r.invoice} envoyée par ${c} (simulé)`)
      render()
    },
    setHk(no, v) {
      D.rooms.find((x) => x.no === no).hk = v
      toast(`Chambre ${no} : ${HK[v][0].toLowerCase()}`)
      render()
    },
    assign(no, h) {
      if (h) D.assignments[no] = h
      else delete D.assignments[no]
      render()
    },
    autoAssign() {
      const todo = D.rooms.filter((r) => r.hk === "sale" && !D.assignments[r.no])
      if (!todo.length) return toast("Toutes les chambres sales sont déjà attribuées")
      const load = (h) => Object.values(D.assignments).filter((x) => x === h).length
      todo.forEach((r) => (D.assignments[r.no] = [...D.housekeepers].sort((a, b) => load(a) - load(b))[0]))
      toast(`${todo.length} chambre(s) attribuée(s)`)
      render()
    },
    filterGuests(s) {
      s = s.toLowerCase()
      document.querySelectorAll("#glist button").forEach((b) => (b.style.display = b.dataset.name.includes(s) ? "" : "none"))
    },
    saveGuest(id, silent) {
      const g = G(id)
      const name = $("#c-name").value.trim()
      if (!name) return toast("Le nom est obligatoire")
      Object.assign(g, { name, phone: $("#c-phone").value.trim(), email: $("#c-email").value.trim(), nationality: $("#c-nat").value.trim(), vip: $("#c-vip").checked })
      if (!silent) toast("Fiche client enregistrée")
      render()
    },
    addPref(id) {
      const v = $("#c-pref").value.trim()
      if (!v) return
      G(id).prefs.push(v)
      A.fof.saveGuest(id, true)
    },
    delPref(id, i) {
      G(id).prefs.splice(i, 1)
      A.fof.saveGuest(id, true)
    },
  }

  const common = { code: "fof", phase: "4-10", actions }
  HMS.module({ ...common, group: "Réception & séjour", title: "Réception et séjour", spec: "§8 RES, §9 FOF, §10 ACC, §12 FOL", screens: [
    { id: "accueil", label: "Tableau de bord", spec: "FOF", view: views.accueil },
    { id: "reservations", label: "Réservations", spec: "RES", view: views.reservations, after: () => { if ($("#f-price")) A.fof.guarUi() } },
    { id: "checkin", label: "Check-in et clé", spec: "FOF ACC CRM", view: views.checkin },
    { id: "checkout", label: "Check-out et facture", spec: "FOF FOL ACC", view: views.checkout },
    { id: "facture", hidden: true, navAs: "checkout", view: views.facture, redirect: (p) => ((R(p[0]) || {}).invoice ? null : "checkout") },
  ] })
  HMS.module({ ...common, group: "Opérations", title: "Statut des chambres", spec: "§11 HKM", screens: [{ id: "chambres", label: "Statut des chambres", view: views.chambres }] })
  HMS.module({ ...common, group: "Ventes & clients", title: "Fiche client", spec: "§7 CRM", screens: [{ id: "clients", label: "Fiches clients", view: views.clients }] })
})()
