// modules/spa.js — Spec §14 Spa, loisirs et services annexes (SPA)
// Catalogue de soins, agenda praticiens/cabines avec contrôle de conflit, rendez-vous, imputation au folio,
// accès spa sur la clé (ACC simulé), forfaits et abonnements, boutique, loisirs et navettes, KPI et IA.
;(() => {
  const mins = (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b }
  const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
  const muted = (t) => `<span class="muted">${esc(t)}</span>`
  const err = (m) => `<div class="err">${esc(m)}</div>`
  const OPEN = 9 * 60, CLOSE = 19 * 60

  // ---------- Données d'exemple ----------
  D.spa = {
    now: "13:05",
    practitioners: [
      { id: "P1", name: "Akissi Yapi", skills: ["massage", "visage"], commission: 0.1 },
      { id: "P2", name: "Hervé Gbané", skills: ["massage", "hammam"], commission: 0.1 },
      { id: "P3", name: "Nadège Tanoh", skills: ["visage", "beaute"], commission: 0.08 },
    ],
    cabins: [
      { id: "CAB1", name: "Cabine Iroko", type: "simple" },
      { id: "CAB2", name: "Cabine Fromager (duo)", type: "duo" },
      { id: "CAB3", name: "Cabine beauté", type: "beaute" },
      { id: "HAM", name: "Hammam", type: "hammam" },
    ],
    equipment: [{ id: "KIT", name: "Kit pierres chaudes", qty: 1 }],
    treatments: [
      { id: "S1", name: "Massage relaxant", cat: "Massages", dur: 60, prep: 15, price: 35000, skill: "massage", cabins: ["simple", "duo"], equip: null, health: true, contra: "Grossesse (1er trimestre), phlébite", onSale: true },
      { id: "S2", name: "Massage aux pierres chaudes", cat: "Massages", dur: 75, prep: 15, price: 45000, skill: "massage", cabins: ["simple", "duo"], equip: "KIT", health: true, contra: "Troubles circulatoires, diabète", onSale: true },
      { id: "S3", name: "Rituel Lagune (90 min)", cat: "Rituels", dur: 90, prep: 15, price: 55000, skill: "massage", cabins: ["duo", "simple"], equip: null, health: true, contra: "Grossesse", onSale: true },
      { id: "S4", name: "Gommage au beurre de karité", cat: "Soins du corps", dur: 45, prep: 15, price: 25000, skill: "massage", cabins: ["simple", "duo"], equip: null, health: false, contra: "Peau lésée", onSale: true },
      { id: "S5", name: "Soin visage éclat", cat: "Soins du visage", dur: 45, prep: 15, price: 30000, skill: "visage", cabins: ["beaute", "simple"], equip: null, health: false, contra: "Allergie aux huiles essentielles", onSale: true },
      { id: "S6", name: "Hammam et gommage", cat: "Hammam", dur: 45, prep: 15, price: 20000, skill: "hammam", cabins: ["hammam"], equip: null, health: true, contra: "Hypertension, grossesse", onSale: true },
      { id: "S7", name: "Manucure", cat: "Beauté", dur: 30, prep: 0, price: 12000, skill: "beaute", cabins: ["beaute"], equip: null, health: false, contra: "—", onSale: true },
    ],
    // pay : folio | direct | forfait | abonnement. status : confirme | arrive | termine | annule
    bookings: [
      { id: "SB-101", res: "R-2044", client: null, t: "S1", pr: "P1", cab: "CAB1", start: "10:00", pay: "folio", status: "termine", health: true },
      { id: "SB-102", res: "R-2048", client: null, t: "S6", pr: "P2", cab: "HAM", start: "11:00", pay: "forfait", status: "termine", health: true },
      { id: "SB-103", res: null, client: "Amenan Séka", t: "S5", pr: "P3", cab: "CAB3", start: "11:30", pay: "abonnement", status: "termine", health: false },
      { id: "SB-104", res: "R-2047", client: null, t: "S2", pr: "P2", cab: "CAB2", start: "14:00", pay: "folio", status: "confirme", health: true },
      { id: "SB-105", res: null, client: "Didier Zadi", t: "S7", pr: "P3", cab: "CAB3", start: "14:30", pay: "direct", status: "confirme", health: false },
      { id: "SB-106", res: "R-2048", client: null, t: "S3", pr: "P1", cab: "CAB1", start: "16:00", pay: "forfait", status: "confirme", health: true },
      { id: "SB-107", res: "R-2051", client: null, t: "S5", pr: "P3", cab: "CAB3", start: "17:00", pay: "folio", status: "confirme", health: false },
    ],
    access: [{ room: "203", res: "R-2044", until: "26/11 23:59", zone: "Spa, piscine" }, { room: "302", res: "R-2048", until: "28/11 12:00", zone: "Spa, piscine, gym (forfait)" }],
    accessLog: [], // droits retirés au check-out (carte #61)
    packages: [
      { id: "PK1", name: "Forfait Détente Lagune", rat: "Package tarifaire DETENTE-2N", incl: ["S6", "S3"], access: "Spa, piscine, gym pendant le séjour", stays: ["R-2048"] },
      { id: "PK2", name: "Escapade bien-être 1 nuit", rat: "Package tarifaire BIEN-1N", incl: ["S1"], access: "Spa et piscine le jour du soin", stays: [] },
      { id: "PK3", name: "Journée spa (externes)", rat: "Vente directe", incl: ["S4", "S6"], access: "Spa et piscine 09:00–19:00", stays: [] },
    ],
    members: [
      { id: "MB-01", name: "Amenan Séka", formula: "Annuelle — piscine, gym, 1 soin/mois", fee: 360000, until: "2027-03-31", badge: "active", card: "BADGE-4101" },
      { id: "MB-02", name: "Lassina Fofana", formula: "Mensuelle — piscine et gym", fee: 35000, until: "2026-11-20", badge: "suspendu", card: "BADGE-4102" },
      { id: "MB-03", name: "Christelle Ehui", formula: "Trimestrielle — piscine, gym", fee: 95000, until: "2026-12-05", badge: "active", card: "BADGE-4103" },
    ],
    formulas: [["Mensuelle — piscine et gym", 35000, 30], ["Trimestrielle — piscine, gym", 95000, 90], ["Annuelle — piscine, gym, 1 soin/mois", 360000, 365]],
    products: [
      { id: "PR1", name: "Huile de massage au karité 100 ml", price: 8000, stock: 12, min: 5 },
      { id: "PR2", name: "Savon noir artisanal", price: 3500, stock: 4, min: 6 },
      { id: "PR3", name: "Crème visage hydratante", price: 15000, stock: 7, min: 3 },
      { id: "PR4", name: "Beurre de karité pur 200 g", price: 6000, stock: 20, min: 8 },
    ],
    sales: [{ product: "PR1", qty: 1, amount: 8000, mode: "Folio ch. 203" }],
    fees: [],
    activities: [
      { id: "AC1", name: "Excursion Grand-Bassam (quartier historique)", kind: "Excursion", date: "2026-11-27", time: "09:00", cap: 12, booked: 9, price: 25000, partner: "Agence Bassam Évasion Exemple" },
      { id: "AC2", name: "Sortie en pirogue sur la lagune", kind: "Loisir", date: "2026-11-26", time: "16:00", cap: 8, booked: 8, price: 15000, partner: "Interne" },
      { id: "AC3", name: "Location de vélos (journée)", kind: "Location", date: "2026-11-26", time: "09:00", cap: 10, booked: 3, price: 5000, partner: "Interne" },
      { id: "AC4", name: "Navette aéroport", kind: "Navette", date: "2026-11-26", time: "14:00", cap: 7, booked: 2, price: 15000, partner: "Transports Lagune Exemple" },
      { id: "AC5", name: "Navette aéroport", kind: "Navette", date: "2026-11-27", time: "06:00", cap: 7, booked: 0, price: 15000, partner: "Transports Lagune Exemple" },
      { id: "AC6", name: "Initiation golf (club partenaire)", kind: "Golf", date: "2026-11-28", time: "08:00", cap: 4, booked: 1, price: 30000, partner: "Golf Club Riviera Exemple" },
    ],
    regs: [
      { act: "AC4", res: "R-2044", pax: 1, pay: "folio" },
      { act: "AC1", res: "R-2047", pax: 2, pay: "folio" },
    ],
    ai: {}, seq: 108, mSeq: 4,
  }
  Object.assign(ui, { spaRole: "reception", spaHealth: null })
  const S = D.spa
  const TR = (id) => S.treatments.find((t) => t.id === id)
  const PR = (id) => S.practitioners.find((p) => p.id === id)
  const CB = (id) => S.cabins.find((c) => c.id === id)
  const AC = (id) => S.activities.find((a) => a.id === id)
  const who = (b) => (b.res ? G(R(b.res).guest).name : b.client)
  const span = (b) => { const t = TR(b.t), s = mins(b.start); return [s, s + t.dur + t.prep] }
  const activeB = () => S.bookings.filter((b) => b.status !== "annule")
  const BST = { confirme: ["Confirmé", "info"], arrive: ["En soin", "warn"], termine: ["Terminé", "ok"], annule: ["Annulé", "bad"] }
  const PAY = { folio: "Folio chambre", direct: "Encaissement direct", forfait: "Inclus au forfait", abonnement: "Abonnement membre" }
  const stayOptions = () => [...inHouse(), ...arrivals().filter((r) => r.status === "confirmee")].map((r) => [r.id, r.room ? `Ch. ${r.room} — ${G(r.guest).name}` : `${G(r.guest).name} (arrivée ce jour)`])
  const AI_DONE = { promo: "Créneaux soin visage 15:00 et 16:00 mis en avant dans l'application client", grid: "Grille de demain recalée sur 75 min pour les massages" }
  const aiAct = (k, label) => (S.ai[k] ? badge("Appliqué", "ok") + " " + muted(AI_DONE[k]) : btn(label, `A.spa.ai(${q(k)})`, "ghost sm"))
  const pkgOf = (resId) => S.packages.find((p) => p.stays.includes(resId))
  // Décrément des stocks dans Achats (carte #61) : sans effet si l'API n'est pas chargée
  const consume = (lines) => { A.prc && A.prc.consume && A.prc.consume(lines, "Spa") }
  // Droits spa retirés quand le séjour n'est plus en cours (check-out, no-show, annulation, délogement)
  const purgeAccess = () => {
    if (!S.accessLog) S.accessLog = []
    const keep = []
    S.access.forEach((a) => {
      const r = a.res ? R(a.res) : occupant(a.room)
      if (r && ["arrivee", "confirmee"].includes(r.status)) keep.push(a)
      else S.accessLog.unshift({ room: a.room, zone: a.zone, at: fd(today), reason: r ? `séjour ${r.id} : ${STATUS[r.status][0].toLowerCase()}` : "plus de séjour en cours" })
    })
    if (keep.length !== S.access.length) S.access.splice(0, S.access.length, ...keep)
  }
  purgeAccess()

  // Contrôle de disponibilité simultanée praticien + cabine + équipement (EF-SPA-002, RG-SPA-01)
  function conflicts(tId, start, prId, cabId, exceptId) {
    const t = TR(tId), s = mins(start), e = s + t.dur + t.prep, out = []
    if (s < OPEN || s + t.dur > CLOSE) out.push("Hors des horaires du spa (09:00–19:00).")
    const pr = PR(prId), cab = CB(cabId)
    if (!pr.skills.includes(t.skill)) out.push(`${pr.name} n'est pas habilité(e) pour ce soin.`)
    if (!t.cabins.includes(cab.type)) out.push(`${cab.name} ne convient pas à ce soin.`)
    activeB().filter((b) => b.id !== exceptId).forEach((b) => {
      const [bs, be] = span(b)
      if (bs < e && s < be) {
        if (b.pr === prId) out.push(`${pr.name} est occupé(e) de ${b.start} à ${hm(be)} (préparation incluse).`)
        if (b.cab === cabId) out.push(`${cab.name} est occupée de ${b.start} à ${hm(be)}.`)
        if (t.equip && TR(b.t).equip === t.equip) out.push(`${S.equipment.find((x) => x.id === t.equip).name} déjà utilisé à ${b.start}.`)
      }
    })
    return out
  }
  function autoPick(tId, start) {
    const t = TR(tId)
    for (const p of S.practitioners.filter((x) => x.skills.includes(t.skill)))
      for (const c of S.cabins.filter((x) => t.cabins.includes(x.type)))
        if (!conflicts(tId, start, p.id, c.id).length) return [p.id, c.id]
    return null
  }
  const slotsFor = (tId) => { const out = []; for (let m = Math.max(OPEN, Math.ceil((mins(S.now) + 10) / 30) * 30); m < CLOSE; m += 30) { const r = autoPick(tId, hm(m)); if (r) out.push([hm(m), ...r]) } return out }

  // ---------- Écrans ----------
  const TABS = [["agenda", "Agenda"], ["rdv", "Rendez-vous"], ["catalogue", "Catalogue"], ["forfaits", "Forfaits et abonnements"], ["boutique", "Boutique"], ["pilotage", "KPI et IA"]]
  const views = {
    spa(p) {
      purgeAccess()
      const tab = p[0] || "agenda"
      return pageHead("Spa", `${fdLong(today)} · heure simulée ${S.now}. Données d'exemple ; badges et clés d'accès simulés (Contrôle d'accès).`, btn("Nouveau rendez-vous", "go('spa/rdv')"))
        + subtabs("spa", TABS, tab) + ({ agenda, rdv, catalogue, forfaits, boutique, pilotage }[tab] || agenda)(p.slice(1))
    },
    loisirs() {
      purgeAccess()
      const ih = inHouse().sort((a, b) => a.room.localeCompare(b.room))
      const acts = [...S.activities].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      return pageHead("Loisirs et services annexes", "Excursions, locations, navettes et golf avec gestion de capacité (EF-SPA-009). Prestataires partenaires et tarifs d'exemple.")
        + `<div class="grid g4">
          ${stat({ label: "Départs à venir", value: String(acts.length), icon: "calendar", hint: "7 prochains jours" })}
          ${stat({ label: "Places vendues", value: String(acts.reduce((s, a) => s + a.booked, 0)), icon: "users", hint: `sur ${acts.reduce((s, a) => s + a.cap, 0)} offertes · remplissage en courbe`, trend: acts.map((a) => (a.booked / a.cap) * 100) })}
          ${stat({ label: "Complets", value: String(acts.filter((a) => a.booked >= a.cap).length), icon: "alert", hint: "liste d'attente proposée" })}
          ${stat({ label: "Chiffre d'affaires prévu", value: money(acts.reduce((s, a) => s + a.booked * a.price, 0)), icon: "coins", hint: "places vendues × prix · exemple" })}
        </div>
        <div class="dash" style="margin-top:16px">
        <div class="w8">${section("Programme", tbl(["Date", "Activité", "Type", "Prestataire", "#Prix/pers.", "Remplissage", ""], acts.map((a) => [`${wd(a.date)} ${fd(a.date)} · ${esc(a.time)}`, esc(a.name), esc(a.kind), esc(a.partner), money(a.price),
          `${a.booked}/${a.cap} ${a.booked >= a.cap ? badge("Complet", "warn") : ""}<span class="track" style="display:block;margin-top:4px"><i style="width:${(a.booked / a.cap) * 100}%"></i></span>`,
          a.booked >= a.cap ? muted("—") : btn("Inscrire", `document.getElementById('ls-act').value=${q(a.id)};document.getElementById('ls-act').scrollIntoView()`, "ghost sm")])))}</div>
        <div class="w4">${section("Places vendues par type", donut(Object.entries(acts.reduce((o, a) => ((o[a.kind] = (o[a.kind] || 0) + a.booked), o), {})).map(([label, value]) => ({ label, value })).filter((x) => x.value), { fmt: (v) => v + " place(s)", center: String(acts.reduce((s, a) => s + a.booked, 0)), sub: "places" }))}</div>
        </div>
        <div class="cols"><section><h2>Inscription</h2><div class="card">
          ${form([field("ls-act", "Activité", select("ls-act", acts.map((a) => [a.id, `${fd(a.date)} ${a.time} — ${a.name}`]), acts.find((a) => a.booked < a.cap)?.id)),
            field("ls-res", "Client", select("ls-res", ih.map((r) => [r.id, `Ch. ${r.room} — ${G(r.guest).name}`]), ih[0]?.id)),
            field("ls-pax", "Personnes", input("ls-pax", 1, 'type="number" min="1"')),
            field("ls-pay", "Règlement", select("ls-pay", [["folio", "Folio chambre"], ["direct", "Encaissement direct"]], "folio"))])}
          <div id="ls-err" style="margin-top:8px"></div><div class="row" style="margin-top:10px">${btn("Inscrire", "A.spa.register()")}</div></div></section>
        <section><h2>Inscriptions</h2>${tbl(["Activité", "Client", "#Pers.", "Règlement"], S.regs.map((x) => { const a = AC(x.act), r = R(x.res)
          return [`${esc(a.name)}<div class="muted">${fd(a.date)} ${esc(a.time)}</div>`, `Ch. ${esc(r.room || "—")} · ${esc(G(r.guest).name)}`, x.pax, esc(x.pay === "folio" ? "Folio" : "Direct")] }), "Aucune inscription.")}</section></div>`
    },
  }

  function agenda() {
    const slots = []; for (let m = OPEN; m < CLOSE; m += 30) slots.push(m)
    const row = (label, key, id) => {
      const list = activeB().filter((b) => b[key] === id)
      let html = `<td><strong>${esc(label)}</strong></td>`, skip = 0
      slots.forEach((m) => {
        if (skip) return skip--
        const b = list.find((x) => mins(x.start) === m)
        if (b) { const t = TR(b.t), n = Math.max(1, Math.ceil((t.dur + t.prep) / 30)); skip = n - 1
          html += `<td colspan="${n}" style="background:var(--line);border-left:2px solid var(--ink);font-size:12px;line-height:1.3;min-width:${n * 40}px"><button class="link" onclick="go('spa/rdv/${esc(b.id)}')">${esc(who(b))}</button><div class="muted">${esc(t.name)} · ${b.start}${t.prep ? ` + ${t.prep} min prép.` : ""}</div>${b.status === "termine" ? badge("Terminé", "outline") : b.status === "arrive" ? badge("En soin", "ok") : ""}</td>` }
        else html += `<td style="min-width:34px;${m === Math.floor(mins(S.now) / 30) * 30 ? "border-left:2px dashed var(--ink2)" : ""}"></td>`
      })
      return `<tr>${html}</tr>`
    }
    const act = activeB(), hours = act.reduce((s, b) => s + TR(b.t).dur, 0) / 60, avail = S.cabins.length * (CLOSE - OPEN) / 60
    const ca = act.filter((b) => b.pay !== "forfait" && b.pay !== "abonnement").reduce((s, b) => s + TR(b.t).price, 0)
    const next = act.filter((b) => b.status === "confirme" && b.start >= S.now).sort((x, y) => x.start.localeCompare(y.start))[0]
    const byHour = []; for (let m = OPEN; m < CLOSE; m += 60) byHour.push(m)
    const load = byHour.map((m) => act.filter((b) => { const [bs, be] = span(b); return bs < m + 60 && m < be }).length)
    const byCat = Object.entries(act.reduce((o, b) => { const c = TR(b.t).cat; o[c] = (o[c] || 0) + 1; return o }, {})).map(([label, value]) => ({ label, value }))
    return `<div class="grid g4" style="margin-bottom:16px">
        ${stat({ label: "Rendez-vous du jour", value: String(act.length), icon: "calendar", hint: `${act.filter((b) => b.status === "termine").length} terminé(s) · ${act.filter((b) => b.status === "arrive").length} en soin`, route: "spa/rdv" })}
        ${stat({ label: "Utilisation des cabines", value: pct((hours / avail) * 100), icon: "sparkle", hint: `${(Math.round(hours * 10) / 10).toLocaleString("fr-FR")} h vendues / ${avail} h · charge horaire en courbe`, trend: load, route: "spa/pilotage" })}
        ${stat({ label: "Chiffre d'affaires soins", value: money(ca), icon: "coins", hint: "hors forfaits et abonnements · exemple" })}
        ${stat({ label: "Prochain soin", value: next ? next.start : "—", icon: "clock", hint: next ? `${who(next)} · ${TR(next.t).name}` : "plus de rendez-vous aujourd'hui" })}
      </div>
      ${section("Agenda du jour", `<p class="muted" style="margin-top:0">Grille de la journée par praticien et par cabine. Un soin bloque la ressource pendant sa durée plus le temps de préparation (RG-SPA-01). Trait pointillé : heure actuelle.</p>
      <div class="tablewrap"><table><thead><tr><th>Ressource</th>${slots.map((m) => `<th style="font-size:11px;padding:6px 4px">${m % 60 ? "" : hm(m)}</th>`).join("")}</tr></thead>
      <tbody><tr><td colspan="${slots.length + 1}" class="muted">Praticiens</td></tr>${S.practitioners.map((p) => row(p.name, "pr", p.id)).join("")}
      <tr><td colspan="${slots.length + 1}" class="muted">Cabines</td></tr>${S.cabins.map((c) => row(c.name, "cab", c.id)).join("")}</tbody></table></div>`, btn("Nouveau rendez-vous", "go('spa/rdv')", "ghost sm"))}
      <div class="dash" style="margin-top:16px">
        <div class="w8">${section("Soins en cours par heure", columns(byHour.map((m) => hm(m).slice(0, 2) + " h"), load, (v) => v))}</div>
        <div class="w4">${section("Rendez-vous par catégorie", donut(byCat, { fmt: (v) => v + " rdv", center: String(act.length), sub: "rendez-vous" }))}</div>
      </div>
      <div style="height:16px"></div>
      ${aiBox("Optimisation du planning", "La cabine beauté est libre de 15:00 à 17:00 et la demande du soir sur les massages est forte : proposer deux soins visage de 45 min à 15:00 et 16:00 aux clients en séjour ayant consenti aux offres permet de porter l'utilisation des cabines de 38 % à 50 %.", aiAct("promo", "Publier les créneaux dans l'application"))}`
  }

  function rdv(p) {
    const sel = S.bookings.find((b) => b.id === p[0])
    const list = [...S.bookings].sort((a, b) => a.start.localeCompare(b.start))
    const stays = stayOptions()
    return `${sel ? detail(sel) : ""}
      <div class="cols"><section><h2>Nouveau rendez-vous</h2><div class="card">
        ${form([
          field("sb-res", "Client de l'hôtel", select("sb-res", [["", "— client externe / membre —"], ...stays], stays[0]?.[0] || "")),
          field("sb-ext", "ou nom du client externe", input("sb-ext", "", 'placeholder="Prénom Nom"')),
          field("sb-t", "Soin", select("sb-t", S.treatments.filter((t) => t.onSale).map((t) => [t.id, `${t.name} · ${t.dur} min · ${money(t.price)}`]), "S1", `onchange="A.spa.slots()"`)),
          field("sb-start", "Heure", select("sb-start", Array.from({ length: 20 }, (_, i) => hm(OPEN + i * 30)), "17:00")),
          field("sb-pr", "Praticien", select("sb-pr", [["auto", "Automatique (premier libre)"], ...S.practitioners.map((x) => [x.id, x.name])], "auto")),
          field("sb-cab", "Cabine", select("sb-cab", [["auto", "Automatique"], ...S.cabins.map((x) => [x.id, x.name])], "auto")),
          field("sb-pay", "Règlement (EF-SPA-007)", select("sb-pay", Object.entries(PAY), "folio")),
          `<div class="full"><label class="row" style="color:var(--ink)"><input type="checkbox" id="sb-health"> Questionnaire santé rempli et consentement signé (EF-SPA-006)</label></div>`,
          `<div class="full" id="sb-err"></div>`,
          `<div class="full row">${btn("Réserver", "A.spa.book()")}${btn("Voir les créneaux disponibles", "A.spa.slots()", "ghost")}</div>`,
          `<div class="full" id="sb-slots"></div>`])}
        </div></section>
      <section><h2>Recommandation</h2>${aiBox("Recommandation de soins", `${G("G6").name} (ch. 202, consentement marketing donné) : séjour d'affaires de 3 nuits, a réservé un massage aux pierres chaudes. Proposer le gommage au beurre de karité demain à 18:00, créneau peu demandé.`, btn("Préremplir la réservation", "A.spa.prefill()", "ghost sm"))}
        <p class="muted">La recommandation n'utilise que les profils ayant consenti ; la proposition est validée par la réceptionniste.</p></section></div>
      <h2>Rendez-vous du jour</h2>
      <div class="row"><span class="muted">Profil connecté :</span>${chips("spaRole", { reception: "Réceptionniste spa", praticien: "Praticien" })}</div>
      ${tbl(["Heure", "Client", "Soin", "Praticien · cabine", "Règlement", "Questionnaire", "Statut", ""], list.map((b) => { const t = TR(b.t)
        return [esc(b.start), `<button class="link" onclick="go('spa/rdv/${esc(b.id)}')">${esc(who(b))}</button>${b.res && R(b.res).room ? `<div class="muted">ch. ${esc(R(b.res).room)}</div>` : ""}`, esc(t.name), `${esc(PR(b.pr).name)}<div class="muted">${esc(CB(b.cab).name)}</div>`, esc(PAY[b.pay]),
          t.health ? (b.health ? (ui.spaRole === "praticien" ? btn("Consulter", `ui.spaHealth=${q(b.id)};render()`, "ghost sm") : badge("Rempli · accès praticien", "outline")) : badge("Manquant", "warn")) : muted("Non requis"),
          badge(...BST[b.status]),
          `<span class="row" style="flex-wrap:nowrap">${b.status === "confirme" ? btn("Arrivé", `A.spa.status(${q(b.id)}, 'arrive')`, "sm") + btn("Annuler", `A.spa.cancel(${q(b.id)})`, "ghost sm") : ""}${b.status === "arrive" ? btn("Terminer et facturer", `A.spa.finish(${q(b.id)})`, "sm") : ""}</span>`] }))}
      ${ui.spaHealth && ui.spaRole === "praticien" ? card("Questionnaire santé — " + who(S.bookings.find((b) => b.id === ui.spaHealth)), `<p>Aucune contre-indication déclarée. Pression souhaitée : moyenne. Zones à éviter : aucune. (Contenu fictif.)</p><p class="muted">Donnée sensible : visible uniquement par les praticiens, consultation journalisée (RG-SPA-03).</p>`) : ""}
      <p class="muted">Annulation à moins de 24 h : 50 % du prix facturé selon la politique (RG-SPA-02).</p>`
  }

  function detail(b) {
    const t = TR(b.t), [, e] = span(b), r = b.res && R(b.res)
    return card(`Rendez-vous ${b.id}`, `<div class="row between"><span class="big">${esc(who(b))}</span>${badge(...BST[b.status])}</div>
      <div class="muted">${esc(t.name)} · ${b.start}–${hm(mins(b.start) + t.dur)} (ressources libérées à ${hm(e)}) · ${esc(PR(b.pr).name)} · ${esc(CB(b.cab).name)}${t.equip ? " · " + esc(S.equipment.find((x) => x.id === t.equip).name) : ""}</div>
      <p style="margin:8px 0 0">Prix : ${money(t.price)} · ${esc(PAY[b.pay])}${r ? ` · séjour ${esc(r.id)}` : ""} · contre-indications : ${esc(t.contra)}</p>
      <div class="row" style="margin-top:10px">${btn("Fermer", "go('spa/rdv')", "ghost sm")}</div>`) + "<div style='height:6px'></div>"
  }

  function catalogue() {
    return `<p class="muted">Durée, temps de préparation, ressources requises, prix et contre-indications (EF-SPA-001). Décocher « En vente » retire le soin de l'application et de la réception.</p>
      ${tbl(["Soin", "Catégorie", "#Durée", "#Prép.", "Ressources", "Contre-indications", "#Prix", ""], S.treatments.map((t) => [
        `<strong>${esc(t.name)}</strong>${t.health ? `<div class="muted">Questionnaire santé requis</div>` : ""}`, esc(t.cat), `${t.dur} min`, `${t.prep} min`,
        esc(`Praticien « ${t.skill} » · cabine ${t.cabins.join(" ou ")}${t.equip ? " · " + S.equipment.find((x) => x.id === t.equip).name : ""}`), esc(t.contra), money(t.price),
        `<label class="row" style="color:var(--ink);flex-wrap:nowrap"><input type="checkbox" ${t.onSale ? "checked" : ""} onchange="A.spa.toggle(${q(t.id)})"> En vente</label>`]))}
      <div class="cols"><section><h2>Praticiens</h2>${tbl(["Nom", "Compétences", "#Commission"], S.practitioners.map((x) => [esc(x.name), esc(x.skills.join(", ")), pct(x.commission * 100)]))}</section>
      <section><h2>Cabines et équipements</h2>${tbl(["Ressource", "Type"], [...S.cabins.map((c) => [esc(c.name), esc(c.type)]), ...S.equipment.map((x) => [esc(x.name), `équipement · ${x.qty} unité`])])}</section></div>`
  }

  function forfaits() {
    return `<h2>Forfaits et packages (EF-SPA-003)</h2>
      <p class="muted">Les soins inclus dans un package tarifaire sont valorisés à zéro sur le folio et décomptés du forfait.</p>
      <div class="grid">${S.packages.map((p) => card(p.name, `<div class="muted">${esc(p.rat)}</div>
        <p style="margin:8px 0">${esc(p.incl.map((x) => TR(x).name).join(" + "))}</p><div class="muted">Accès : ${esc(p.access)}</div>
        ${p.stays.map((s) => { const r = R(s), used = S.bookings.filter((b) => b.res === s && b.pay === "forfait" && b.status !== "annule")
          return `<p style="margin:8px 0 0">Ch. ${esc(r.room)} · ${esc(G(r.guest).name)} : ${used.length}/${p.incl.length} soins planifiés (${used.filter((b) => b.status === "termine").length} effectué)</p>` }).join("") || `<p class="muted" style="margin-top:8px">Aucun séjour en cours avec ce forfait.</p>`}`)).join("")}</div>
      <h2>Accès aux installations (EF-SPA-005)</h2>
      ${tbl(["Chambre", "Zones", "Valable jusqu'au"], S.access.map((a) => [`Ch. ${esc(a.room)}`, esc(a.zone), esc(a.until)]))}
      <p class="muted">Droits ajoutés automatiquement à la clé du client à la réservation d'un soin ou d'un forfait, retirés dès que le séjour n'est plus en cours (check-out, no-show, annulation). Contrôle d'accès simulé.</p>
      ${S.accessLog.length ? tbl(["Chambre", "Zones retirées", "Date", "Motif"], S.accessLog.slice(0, 8).map((x) => [`Ch. ${esc(x.room)}`, esc(x.zone), esc(x.at), esc(x.reason)])) : ""}
      <h2>Abonnements membres externes (EF-SPA-004)</h2>
      ${tbl(["Membre", "Formule", "#Cotisation", "Validité", "Badge", ""], S.members.map((m) => { const exp = m.until < today, soon = !exp && nights(today, m.until) <= 15
        return [`${esc(m.name)}<div class="muted">${esc(m.card)}</div>`, esc(m.formula), money(m.fee), `${fd(m.until)}/${m.until.slice(0, 4)} ${exp ? badge("Expiré", "bad") : soon ? badge("Expire bientôt", "warn") : ""}`,
          m.badge === "active" ? badge("Actif", "ok") : badge("Suspendu", "bad"),
          `<span class="row" style="flex-wrap:nowrap">${btn("Renouveler", `A.spa.renew(${q(m.id)})`, "sm")}${m.badge === "active" ? btn("Suspendre le badge", `A.spa.suspend(${q(m.id)})`, "ghost sm") : ""}</span>`] }))}
      <div class="card" style="margin-top:12px">${form([field("mb-name", "Nouveau membre", input("mb-name", "", 'placeholder="Prénom Nom"')), field("mb-f", "Formule", select("mb-f", S.formulas.map((f) => [f[0], `${f[0]} — ${money(f[1])}`]), S.formulas[0][0])),
        `<div style="align-self:end">${btn("Créer l'abonnement et le badge", "A.spa.addMember()")}</div>`])}</div>`
  }

  function boutique() {
    const ih = inHouse().sort((a, b) => a.room.localeCompare(b.room))
    return `<p class="muted">Vente de produits et suivi du stock (EF-SPA-008). Alerte quand le stock passe sous le seuil ; réapprovisionnement via Achats et stocks.</p>
      ${tbl(["Produit", "#Prix", "#Stock", "#Seuil", ""], S.products.map((x) => [esc(x.name), money(x.price), x.stock, x.min, x.stock < x.min ? badge("Sous le seuil", "warn") : ""]))}
      <div class="card" style="margin-top:12px">${form([field("bt-p", "Produit", select("bt-p", S.products.map((x) => [x.id, x.name]), "PR1")), field("bt-q", "Quantité", input("bt-q", 1, 'type="number" min="1"')),
        field("bt-m", "Règlement", select("bt-m", [["direct", "Encaissement direct"], ...ih.map((r) => [r.id, `Folio ch. ${r.room} — ${G(r.guest).name}`])], "direct")), `<div style="align-self:end">${btn("Vendre", "A.spa.sell()")}</div>`])}</div>
      <h2>Ventes du jour</h2>${tbl(["Produit", "#Qté", "#Montant", "Règlement"], S.sales.map((s) => [esc(S.products.find((x) => x.id === s.product).name), s.qty, money(s.amount), esc(s.mode)]))}`
  }

  function pilotage() {
    const act = activeB(), hours = act.reduce((s, b) => s + TR(b.t).dur, 0) / 60, avail = S.cabins.length * (CLOSE - OPEN) / 60
    const rev = act.filter((b) => b.pay !== "forfait" && b.pay !== "abonnement").reduce((s, b) => s + TR(b.t).price, 0) + S.fees.reduce((s, f) => s + f, 0)
    const ih = inHouse(), cap = ih.filter((r) => S.bookings.some((b) => b.res === r.id && b.status !== "annule")).length
    const comm = S.practitioners.map((p) => { const l = act.filter((b) => b.pr === p.id), ca = l.reduce((s, b) => s + TR(b.t).price, 0); return { p, n: l.length, ca } })
    return `<div class="grid g4">
        ${stat({ label: "Utilisation des cabines", value: pct((hours / avail) * 100), icon: "sparkle", hint: `${Math.round(hours * 10) / 10} h vendues / ${avail} h disponibles` })}
        ${stat({ label: "Revenu par heure de praticien", value: money(rev / Math.max(1, hours)), icon: "wallet", hint: "soins facturés, hors forfaits" })}
        ${stat({ label: "Taux de captation", value: pct((cap / Math.max(1, ih.length)) * 100), icon: "users", hint: `${cap}/${ih.length} clients en séjour au spa` })}
        ${stat({ label: "Chiffre d'affaires spa du jour", value: money(rev + S.sales.reduce((s, x) => s + x.amount, 0)), icon: "coins", hint: "soins + boutique · exemple" })}
      </div>
      <div class="dash" style="margin-top:16px">
        <div class="w4">${section("Taux d'utilisation", `<div class="row" style="gap:16px;flex-wrap:nowrap">${gauge((hours / avail) * 100, "Utilisation des cabines")}<div><div class="stat-val">${pct((hours / avail) * 100)}</div><div class="muted">des heures cabine vendues</div></div></div>`)}</div>
        <div class="w8">${section("Heures vendues par cabine", bars(S.cabins.map((c) => ({ label: c.name, value: act.filter((b) => b.cab === c.id).reduce((s, b) => s + TR(b.t).dur, 0) / 60 })), (v) => Math.round(v * 10) / 10 + " h"))}</div>
        <div class="w6">${section("CA généré par praticien", donut(comm.filter((x) => x.ca).map((x) => ({ label: x.p.name, value: x.ca })), { fmt: money, center: shortNum(comm.reduce((s, x) => s + x.ca, 0)), sub: "FCFA" }))}</div>
        <div class="w6">${section("Commissions des praticiens", tbl(["Praticien", "#Soins", "#CA généré", "#Commission"], comm.map((x) => [esc(x.p.name), x.n, money(x.ca), money(x.ca * x.p.commission)])))}</div>
      </div>
      <div style="height:16px"></div>
      ${aiBox("Optimisation du planning", "Les soins de 60 min démarrant à l'heure pile laissent des trous de 15 min. Décaler la grille des massages sur 75 min (soin + préparation) libère 1 créneau par cabine et par jour.", aiAct("grid", "Appliquer à la grille de demain"))}`
  }

  // ---------- Actions ----------
  const B = (id) => S.bookings.find((b) => b.id === id)
  const post = (r, label, amount) => (D.extras[r.id] = D.extras[r.id] || []).push({ label, amount })
  const actions = {
    slots() {
      const t = val("sb-t"), list = slotsFor(t)
      $("#sb-slots").innerHTML = `<div class="muted" style="margin-bottom:6px">Créneaux libres aujourd'hui pour ${esc(TR(t).name)} :</div><div class="row">${list.map(([h, p, c]) =>
        `<button class="btn ghost sm" onclick="A.spa.pick('${h}', '${p}', '${c}')">${h} · ${esc(PR(p).name.split(" ")[0])}</button>`).join("") || muted("Aucun créneau libre.")}</div>`
    },
    pick(h, p, c) { $("#sb-start").value = h; $("#sb-pr").value = p; $("#sb-cab").value = c; toast(`Créneau ${h} sélectionné`) },
    prefill() { $("#sb-res").value = "R-2047"; $("#sb-t").value = "S4"; $("#sb-start").value = "18:00"; $("#sb-pay").value = "folio"; toast("Réservation préremplie, à valider") },
    book() {
      const resId = val("sb-res"), ext = val("sb-ext"), tId = val("sb-t"), start = val("sb-start"), pay = val("sb-pay"), t = TR(tId)
      const e = (m) => ($("#sb-err").innerHTML = err(m))
      if (!resId && !ext) return e("Choisissez un client de l'hôtel ou saisissez le nom du client externe.")
      if (mins(start) < mins(S.now)) return e(`Créneau passé : il est ${S.now}.`)
      if (t.health && !$("#sb-health").checked) return e("Ce soin exige un questionnaire santé et un consentement signés.")
      const r = resId ? R(resId) : null
      if (pay === "folio" && !r) return e("L'imputation au folio exige un client de l'hôtel.")
      if (pay === "forfait" && !(r && pkgOf(r.id)?.incl.includes(tId))) return e("Ce soin n'est pas inclus dans un forfait du client.")
      if (pay === "abonnement") { const m = S.members.find((x) => x.name === ext); if (!m || m.badge !== "active" || m.until < today) return e("Aucun abonnement actif à ce nom.") }
      let pr = val("sb-pr"), cab = val("sb-cab")
      if (pr === "auto" || cab === "auto") {
        const pick = autoPick(tId, start)
        if (!pick) return e(`Aucune combinaison praticien + cabine libre à ${start} pour ce soin.`)
        if (pr === "auto") pr = pick[0]
        if (cab === "auto") cab = pick[1]
      }
      const c = conflicts(tId, start, pr, cab)
      if (c.length) return e("Conflit (EF-SPA-002) : " + c.join(" "))
      const id = "SB-" + S.seq++
      S.bookings.push({ id, res: resId || null, client: resId ? null : ext, t: tId, pr, cab, start, pay, status: "confirme", health: !!$("#sb-health").checked })
      let msg = `Rendez-vous ${start} confirmé`
      if (r && r.room) { S.access.push({ room: r.room, res: r.id, until: `${fd(today)} 23:59`, zone: "Spa, piscine" }); msg += ` · accès spa ajouté à la clé ch. ${r.room} (simulé)` }
      toast(msg); go("spa/rdv/" + id)
    },
    ai(k) { S.ai[k] = true; toast(AI_DONE[k]); render() },
    status(id, st) { B(id).status = st; toast(`${id} : ${BST[st][0].toLowerCase()}`); render() },
    finish(id) {
      const b = B(id), t = TR(b.t), r = b.res && R(b.res)
      if (b.pay === "folio") {
        if (!r || r.status !== "arrivee") return toast("Client non présent : passez le règlement en encaissement direct")
        post(r, `Spa — ${t.name}`, t.price)
      }
      if (b.pay === "forfait") post(r, `Spa — ${t.name} (inclus au forfait)`, 0)
      b.status = "termine"
      consume([{ label: t.name, qty: 1 }])
      toast(b.pay === "folio" ? `${money(t.price)} imputés au folio ch. ${r.room}` : b.pay === "direct" ? `${money(t.price)} encaissés (TPE simulé)` : "Soin décompté du forfait / de l'abonnement")
      render()
    },
    cancel(id) {
      const b = B(id), t = TR(b.t)
      if (!confirm(`Annuler ${id} ? Moins de 24 h avant le soin : 50 % facturés.`)) return
      const fee = b.pay === "forfait" || b.pay === "abonnement" ? 0 : t.price / 2
      b.status = "annule"
      if (fee) { S.fees.push(fee); const r = b.res && R(b.res); if (r && r.status === "arrivee") post(r, `Spa — frais d'annulation tardive (${t.name})`, fee) }
      toast(fee ? `Annulé · frais de ${money(fee)} (RG-SPA-02)` : "Annulé · soin recrédité au forfait")
      render()
    },
    toggle(id) { const t = TR(id); t.onSale = !t.onSale; toast(`${t.name} : ${t.onSale ? "en vente" : "retiré de la vente"}`); render() },
    renew(id) {
      const m = S.members.find((x) => x.id === id), f = S.formulas.find((x) => x[0] === m.formula)
      m.until = addDays(m.until < today ? today : m.until, f[2]); m.badge = "active"
      toast(`Cotisation ${money(m.fee)} encaissée · badge ${m.card} actif jusqu'au ${fd(m.until)}`); render()
    },
    suspend(id) { const m = S.members.find((x) => x.id === id); m.badge = "suspendu"; toast(`Badge ${m.card} désactivé sur les lecteurs (simulé)`); render() },
    addMember() {
      const name = val("mb-name"), f = S.formulas.find((x) => x[0] === val("mb-f"))
      if (!name) return toast("Indiquez le nom du membre")
      const n = S.mSeq++
      S.members.push({ id: `MB-0${n}`, name, formula: f[0], fee: f[1], until: addDays(today, f[2]), badge: "active", card: `BADGE-41${String(n).padStart(2, "0")}` })
      toast("Abonnement créé, badge encodé (simulé)"); render()
    },
    sell() {
      const p = S.products.find((x) => x.id === val("bt-p")), n = Number(val("bt-q")), m = val("bt-m")
      if (!(n > 0)) return toast("Quantité invalide")
      if (n > p.stock) return toast(`Stock insuffisant : ${p.stock} en rayon`)
      p.stock -= n
      let mode = "Direct"
      if (m !== "direct") { const r = R(m); post(r, `Boutique spa — ${n} × ${p.name}`, n * p.price); mode = `Folio ch. ${r.room}` }
      S.sales.push({ product: p.id, qty: n, amount: n * p.price, mode })
      consume([{ label: p.name, qty: n }])
      toast(p.stock < p.min ? `Vendu · stock sous le seuil, alerte envoyée aux Achats` : "Vente enregistrée"); render()
    },
    register() {
      const a = AC(val("ls-act")), r = R(val("ls-res")), pax = Number(val("ls-pax")), pay = val("ls-pay")
      const e = (m) => ($("#ls-err").innerHTML = err(m))
      if (!r) return e("Aucun client en séjour sélectionné.")
      if (!(pax > 0)) return e("Nombre de personnes invalide.")
      if (a.booked + pax > a.cap) return e(`Capacité atteinte : ${a.cap - a.booked} place(s) restante(s) sur ce départ.`)
      a.booked += pax
      S.regs.push({ act: a.id, res: r.id, pax, pay })
      if (pay === "folio") post(r, `${a.name} — ${fd(a.date)} (${pax} pers.)`, pax * a.price)
      toast(`Inscription confirmée${pay === "folio" ? ` · ${money(pax * a.price)} au folio ch. ${r.room}` : ""}`); render()
    },
  }

  HMS.module({
    code: "spa", group: "Services", title: "Spa, loisirs et services annexes", phase: "11-15", spec: "§14 SPA",
    screens: [{ id: "spa", label: "Spa", view: views.spa }, { id: "spa-loisirs", label: "Loisirs et navettes", view: views.loisirs }],
    actions,
  })
})()
