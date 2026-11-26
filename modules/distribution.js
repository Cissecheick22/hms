// modules/distribution.js — Spec §6 Tarifs, inventaire et distribution (RAT)
// Plans tarifaires, grille de prix, restrictions, inventaire et allotements, canaux (simulés), moteur direct,
// revenue management assisté par IA (simulé), KPI. Réutilise D.roomTypes, D.rooms, D.reservations et available().
;(() => {
  const r500 = (n) => Math.round(n / 500) * 500
  const HORIZON = 14
  const daysFrom = (start, n) => Array.from({ length: n }, (_, i) => addDays(start, i))
  const isWeekend = (d) => [5, 6].includes(day(d).getDay()) // nuits du vendredi et du samedi
  const EVENT = { from: "2026-12-03", to: "2026-12-05", label: "Salon Exemple d'Abidjan (fictif)" }
  const inEvent = (d) => d >= EVENT.from && d <= EVENT.to
  const now = () => { const t = new Date(); return `${fd(today)} ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}` }

  // ---------- Données d'exemple ----------
  D.rat = {
    // Plancher et plafond par type (RG-RAT-01, RG-RAT-02)
    bounds: { STD: [38000, 60000], SUP: [50000, 80000], SUI: [90000, 150000] },
    maxDailyMove: 15, // ± % par jour en mode automatique
    base: { STD: {}, SUP: {}, SUI: {} }, // prix BAR modifiés à la main (sinon calcul par défaut)
    occupancy: { adult2: 5000, adult3: 10000, child0_5: 0, child6_11: 5000 },
    plans: [
      { code: "BAR", name: "Meilleur tarif disponible", type: "Public", parent: null, cancel: "Gratuite jusqu'à J-1 18 h", guarantee: "Carte bancaire", incl: [], segment: "Individuel loisirs", channels: ["direct", "otaA", "otaB", "gds", "meta"], active: true },
      { code: "BB", name: "Chambre et petit-déjeuner", type: "Dérivé", parent: "BAR", deriv: { kind: "montant", value: 8000 }, cancel: "Gratuite jusqu'à J-1 18 h", guarantee: "Carte bancaire", incl: ["Petit-déjeuner"], segment: "Individuel loisirs", channels: ["direct", "otaA", "otaB"], active: true },
      { code: "NR", name: "Non remboursable", type: "Dérivé", parent: "BAR", deriv: { kind: "pct", value: -12 }, cancel: "Non remboursable", guarantee: "Prépaiement", incl: [], segment: "Individuel loisirs", channels: ["direct", "otaA"], active: true },
      { code: "CORP-A", name: "Négocié Société Ivoirienne Exemple", type: "Négocié", parent: "BAR", deriv: { kind: "pct", value: -15 }, cancel: "Gratuite jusqu'à J 14 h", guarantee: "Compte société", incl: ["Petit-déjeuner"], segment: "Entreprise", channels: ["direct", "gds"], company: "Société Ivoirienne Exemple", active: true },
      { code: "GOV", name: "Administration (Direction régionale Exemple, Yamoussoukro)", type: "Négocié", parent: "BAR", deriv: { kind: "pct", value: -25 }, cancel: "Gratuite jusqu'à J-2", guarantee: "Bon de commande", incl: [], segment: "Gouvernement", channels: ["direct"], company: "Direction régionale Exemple", active: false },
      { code: "PKG-SPA", name: "Forfait Détente (chambre + spa + dîner)", type: "Forfait", parent: "BAR", deriv: { kind: "montant", value: 30000 }, cancel: "Gratuite jusqu'à J-3", guarantee: "Carte ou Mobile Money", incl: ["Petit-déjeuner", "Massage 60 min", "Dîner pour 1"], segment: "Loisirs", channels: ["direct", "otaA"], active: true, pkg: "DETENTE" },
    ],
    packages: [
      { code: "DETENTE", name: "Forfait Détente", plan: "PKG-SPA", components: [
        { label: "Hébergement", account: "706100 Hébergement", amount: null },
        { label: "Petit-déjeuner", account: "706200 Restauration", amount: 6000 },
        { label: "Massage 60 min", account: "706400 Spa", amount: 15000 },
        { label: "Dîner pour 1", account: "706200 Restauration", amount: 9000 },
      ], access: ["Accès spa et piscine (transmis au contrôle d'accès)"] },
      { code: "AFFAIRES", name: "Forfait Affaires", plan: "BB", components: [
        { label: "Hébergement", account: "706100 Hébergement", amount: null },
        { label: "Transfert aéroport", account: "706500 Transport", amount: 12000 },
        { label: "Accès salon exécutif", account: "706300 Services", amount: 5000 },
      ], access: ["Salon exécutif 2e étage (transmis au contrôle d'accès)"] },
    ],
    promos: [
      { code: "EARLY30", kind: "Early booking", rule: "−10 % si réservé au moins 30 jours avant l'arrivée", pct: 10, cumul: false, active: true, uses: 14 },
      { code: "DERNIERE", kind: "Dernière minute", rule: "−8 % pour une arrivée sous 48 h", pct: 8, cumul: false, active: true, uses: 6 },
      { code: "LONG7", kind: "Long séjour", rule: "−12 % à partir de 7 nuits", pct: 12, cumul: true, active: true, uses: 3 },
      { code: "BIENVENUE", kind: "Code promo", rule: "−5 % sur saisie du code (site direct)", pct: 5, cumul: true, active: false, uses: 0 },
    ],
    // Restrictions : clé "TYPE|date"
    restr: {
      "STD|2026-11-28": { cta: true },
      "SUI|2026-12-03": { minLOS: 2 }, "SUI|2026-12-04": { minLOS: 2 }, "SUI|2026-12-05": { minLOS: 2 },
      "SUP|2026-12-05": { stop: true },
      "STD|2026-12-06": { ctd: true },
    },
    allotments: [
      { id: "AL-01", holder: "Agence Akwaba Voyages Exemple", type: "STD", from: "2026-12-03", to: "2026-12-06", rooms: 2, picked: 0, release: 7, released: false },
      { id: "AL-02", holder: "Société Ivoirienne Exemple", type: "SUP", from: "2026-12-01", to: "2026-12-04", rooms: 1, picked: 0, release: 3, released: false },
    ],
    overbook: {}, // clé "TYPE|date" → nombre de chambres de surbooking autorisées
    channels: [
      { id: "direct", name: "Site direct (moteur de réservation)", kind: "Direct", commission: 3, status: "ok", lastSync: "26/11 07:58", queue: 0, mapping: { STD: "STD", SUP: "SUP", SUI: "SUI" }, observed: null, revenue: 2860000 },
      { id: "otaA", name: "OTA Exemple A (simulé)", kind: "OTA", commission: 17, status: "ok", lastSync: "26/11 07:58", queue: 0, mapping: { STD: "DBL-STD", SUP: "DBL-SUP", SUI: "STE-JR" }, observed: 45000, revenue: 4120000 },
      { id: "otaB", name: "OTA Exemple B (simulé)", kind: "OTA", commission: 18, status: "echec", failedFor: 7, lastSync: "26/11 07:51", queue: 12, mapping: { STD: "STD-K", SUP: "SUP-K", SUI: "SUITE" }, observed: 42000, revenue: 1980000 },
      { id: "gds", name: "GDS via switch (simulé)", kind: "GDS", commission: 10, status: "ok", lastSync: "26/11 07:57", queue: 0, mapping: { STD: "A1K", SUP: "B1K", SUI: "S1K" }, observed: 45000, revenue: 940000 },
      { id: "meta", name: "Méta-moteur Exemple (simulé)", kind: "Méta", commission: 4, status: "ok", lastSync: "26/11 07:58", queue: 0, mapping: { STD: "STD", SUP: "SUP", SUI: "SUI" }, observed: 45000, revenue: 610000 },
    ],
    // Réservations reçues des canaux, à transmettre au module Réservations (EF-RAT-009)
    inbox: [
      { id: "OTA-A-58213", channel: "otaA", kind: "Création", guest: "Koffi Brou", phone: "+225 07 00 00 00 41", email: "koffi.brou@exemple.test", nationality: "Côte d'Ivoire", type: "STD", from: "2026-12-02", to: "2026-12-04", rate: 45000, status: "recue" },
      { id: "GDS-7731", channel: "gds", kind: "Création", guest: "Mariam Coulibaly", phone: "+225 07 00 00 00 42", email: "mariam.coulibaly@exemple.test", nationality: "Côte d'Ivoire", type: "SUP", from: "2026-11-30", to: "2026-12-02", rate: 51000, status: "recue" },
      { id: "OTA-A-58190", channel: "otaA", kind: "Annulation", ref: "R-2061", type: "SUP", from: "2026-11-29", to: "2026-12-02", rate: 60000, status: "recue" },
    ],
    compset: [
      { name: "Hôtel Lagune Exemple, Plateau (simulé)", d: [47000, 47000, 52000, 52000, 46000, 46000, 46000] },
      { name: "Résidence Cocody Exemple (simulé)", d: [43000, 43000, 45000, 48000, 43000, 43000, 44000] },
      { name: "Hôtel Ébrié Exemple, Marcory (simulé)", d: [50000, 50000, 55000, 55000, 50000, 49000, 49000] },
    ],
    pickup: [3, 1, 4, 2, 0, 5, 3], // réservations nettes des 7 derniers jours (exemple)
    log: [
      { at: "25/11 18:02", who: "Moteur IA (simulé)", source: "IA", what: "Recommandation acceptée : SUP 28/11 → 66 000 FCFA" },
      { at: "25/11 16:40", who: "Aya Konan (revenue manager)", source: "Humain", what: "Fermeture de vente SUP le 05/12 (groupe en option)" },
      { at: "25/11 11:15", who: "OTA Exemple A (simulé)", source: "Canal", what: "Réservation reçue OTA-A-58190 (SUP 29/11 → 02/12)" },
      { at: "24/11 09:30", who: "Serge Yapi (directeur commercial)", source: "Humain", what: "Plan CORP-A renouvelé : −15 % sur BAR jusqu'au 31/12/2027" },
    ],
    recos: [],
    obReco: { type: "SUP", from: EVENT.from, to: EVENT.to, rooms: 1, status: "proposee" },
    seq: 1,
  }
  const S = D.rat

  // ---------- Calculs ----------
  const defaultBase = (type, d) => r500(T(type).rate * (isWeekend(d) ? 1.1 : 1) * (inEvent(d) ? 1.2 : 1))
  const bar = (type, d) => S.base[type][d] ?? defaultBase(type, d)
  const plan = (code) => S.plans.find((p) => p.code === code)
  // Prix d'un plan (dérivé recalculé depuis son parent) ; plancher du parent appliqué (RG-RAT-01)
  const price = (code, type, d) => {
    const p = plan(code)
    if (!p.parent) return { v: bar(type, d), floored: false }
    const parent = price(p.parent, type, d).v
    const raw = r500(p.deriv.kind === "pct" ? parent * (1 + p.deriv.value / 100) : parent + p.deriv.value)
    const floor = S.bounds[type][0]
    return raw < floor ? { v: floor, floored: true, raw } : { v: raw, floored: false }
  }
  const rs = (type, d) => S.restr[`${type}|${d}`] || {}
  const physical = (type) => D.rooms.filter((r) => r.type === type).length
  const ooo = (type) => D.rooms.filter((r) => r.type === type && r.hk === "hs").length
  const booked = (type, d) => physical(type) - ooo(type) - available(type, d)
  const allotted = (type, d) => S.allotments.filter((a) => !a.released && a.type === type && a.from <= d && d < a.to).reduce((s, a) => s + a.rooms - a.picked, 0)
  const ob = (type, d) => S.overbook[`${type}|${d}`] || 0
  // EF-RAT-005 : physique − réservées − hors commande − allotements non libérés + surbooking ; fermeture prévaut (RG-RAT-03)
  const sellable = (type, d) => (rs(type, d).stop ? 0 : Math.max(0, available(type, d) - allotted(type, d) + ob(type, d)))
  const sellableRooms = () => D.rooms.filter((r) => r.hk !== "hs").length
  const occOn = (d) => D.roomTypes.reduce((s, t) => s + booked(t.code, d), 0) / sellableRooms()
  const staysOn = (d) => D.reservations.filter((r) => ["confirmee", "arrivee"].includes(r.status) && r.from <= d && d < r.to)
  const ch = (id) => S.channels.find((c) => c.id === id)
  const releaseDate = (a) => addDays(a.from, -a.release)

  const log = (source, what, who) => S.log.unshift({ at: now(), who: who || (source === "IA" ? "Moteur IA (simulé)" : "Revenue manager (vous)"), source, what })
  const enqueue = (n) => S.channels.forEach((c) => (c.queue += n))

  // Recommandations IA (simulées, déterministes) : dates où le prix recommandé diffère du prix actuel
  const buildRecos = () => {
    daysFrom(today, HORIZON).forEach((d) => D.roomTypes.forEach((t) => {
      const occ = booked(t.code, d) / Math.max(1, physical(t.code) - ooo(t.code))
      const lead = nights(today, d)
      let f = 0
      const factors = []
      if (occ >= 0.5) { f += 0.1; factors.push(`Pick-up soutenu (${Math.round(occ * 100)} % vendu à J-${lead})`) }
      else if (occ === 0 && lead >= 5 && lead <= 9 && !isWeekend(d) && !inEvent(d) && t.code !== "SUI") { f -= 0.07; factors.push(`Pick-up faible (0 % à J-${lead})`) }
      if (inEvent(d) && t.code !== "STD") { f += 0.14; factors.push("Événement local") }
      if (t.code === "STD" && f < 0) { f -= 0.02; factors.push("Concurrence médiane 46 k") }
      const cur = bar(t.code, d), rec = r500(cur * (1 + f))
      if (Math.abs(rec - cur) / cur < 0.03) return
      S.recos.push({ id: "PR-" + S.seq++, type: t.code, date: d, cur, rec, conf: Math.round(68 + Math.abs(f) * 120) % 30 + 65, factors, status: "proposee" })
    }))
  }
  buildRecos()
  // Bornes du mode automatique (RG-RAT-02)
  const bounded = (r) => {
    const [lo, hi] = S.bounds[r.type], m = S.maxDailyMove / 100
    const v = Math.min(hi, Math.max(lo, r.cur * (1 - m), Math.min(r.cur * (1 + m), r.rec)))
    return { v: r500(v), clipped: r500(v) !== r.rec }
  }

  // ---------- Fragments ----------
  const typeOpts = () => D.roomTypes.map((t) => [t.code, t.label])
  const restrTags = (type, d) => {
    const x = rs(type, d), tags = []
    if (x.stop) tags.push(badge("Fermé", "bad"))
    if (x.cta) tags.push(badge("CTA", "outline"))
    if (x.ctd) tags.push(badge("CTD", "outline"))
    if (x.minLOS) tags.push(badge(`Min ${x.minLOS}`, "info"))
    if (x.maxLOS) tags.push(badge(`Max ${x.maxLOS}`, "info"))
    return tags.join(" ")
  }
  const head = (days) => `<th>Type</th>${days.map((d) => `<th class="num">${esc(wd(d))}<br>${fd(d)}${inEvent(d) ? "<br>★" : ""}</th>`).join("")}`
  const syncAlerts = () => S.channels.filter((c) => c.status === "echec" && c.failedFor > 5)
    .map((c) => `<div class="err" style="margin-bottom:10px">Synchronisation en échec avec ${esc(c.name)} depuis ${c.failedFor} min : ${c.queue} message(s) ARI en file, alerte envoyée au distribution manager (RG-RAT-05). ${btn("Rejouer la file", `A.rat.replay(${q(c.id)})`, "ghost sm")}</div>`).join("")

  // ---------- Écrans ----------
  const views = {
    tarifs(p) {
      const tab = p[0] || "grille"
      const body = { grille: grilleTab, plans: plansTab, forfaits: forfaitsTab, restrictions: restrTab, inventaire: invTab, revenue: revenueTab, kpi: kpiTab, journal: journalTab }[tab] || grilleTab
      return pageHead("Tarifs et inventaire", "Prix, plans tarifaires, restrictions et disponibilités par type de chambre (exemple). Chaque modification est poussée vers les canaux.",
        btn("Synchroniser l'ARI", "A.rat.syncAll()", "ghost"))
        + subtabs("rat-tarifs", [["grille", "Grille tarifaire"], ["plans", "Plans tarifaires"], ["forfaits", "Forfaits et promotions"], ["restrictions", "Restrictions"], ["inventaire", "Inventaire et allotements"], ["revenue", "Revenue management IA"], ["kpi", "Indicateurs"], ["journal", "Historique"]], tab)
        + body(p)
    },
    distribution(p) {
      const tab = p[0] || "canaux"
      const body = { canaux: canauxTab, parite: pariteTab, recues: inboxTab, moteur: moteurTab }[tab] || canauxTab
      return pageHead("Distribution et canaux", "Connexions aux OTA, GDS et méta-moteurs : toutes simulées. Propagation ARI visée sous 30 secondes (EF-RAT-008).",
        btn("Synchroniser l'ARI", "A.rat.syncAll()", "ghost"))
        + subtabs("rat-distribution", [["canaux", "Canaux et synchro"], ["parite", "Parité et mapping"], ["recues", "Réservations reçues"], ["moteur", "Moteur direct"]], tab)
        + syncAlerts() + body(p)
    },
  }

  function grilleTab() {
    const days = daysFrom(today, HORIZON)
    const pc = ui.ratPlan || "BB"
    const derived = S.plans.filter((x) => x.parent && x.active)
    const floored = D.roomTypes.some((t) => days.some((d) => price(pc, t.code, d).floored))
    const occ = days.map((d) => Math.round(occOn(d) * 100))
    const open = S.recos.filter((r) => r.status === "proposee").length
    const toSell = D.roomTypes.map((t) => ({ label: t.label, value: sellable(t.code, today) }))
    return `<div class="grid g4" style="margin-bottom:16px">
        ${stat({ label: "BAR Standard ce soir", value: money(bar("STD", today)), icon: "tag", delta: ((bar("STD", addDays(today, 1)) - bar("STD", today)) / bar("STD", today)) * 100, hint: "demain vs ce soir · 14 jours en courbe", trend: days.map((d) => bar("STD", d)) })}
        ${stat({ label: "Occupation ce soir", value: pct(occ[0]), icon: "bed", hint: "réservations fermes · 14 jours en courbe", trend: occ, route: "rat-tarifs/kpi" })}
        ${stat({ label: "Chambres à vendre ce soir", value: String(toSell.reduce((s, x) => s + x.value, 0)), icon: "key", hint: "après allotements et fermetures", route: "rat-tarifs/inventaire" })}
        ${stat({ label: "Recommandations IA", value: String(open), icon: "brain", hint: "prix à valider (simulé)", route: "rat-tarifs/revenue" })}
      </div>
      ${section("Grille BAR · 14 prochaines nuits", `<p class="muted" style="margin-top:0">BAR modifiable case par case (prix de la nuit, 1 ou 2 adultes). ★ = ${esc(EVENT.label)}. Les plans dérivés sont recalculés automatiquement (EF-RAT-002, EF-RAT-013).</p>
      <div class="tablewrap"><table><thead><tr>${head(days)}</tr></thead><tbody>
      ${D.roomTypes.map((t) => `<tr><td><strong>${esc(t.label)}</strong><div class="muted">BAR</div></td>${days.map((d) => `<td class="num">
        <input aria-label="BAR ${esc(t.label)} ${fd(d)}" type="number" step="500" value="${bar(t.code, d)}" style="width:86px;padding:4px 6px;text-align:right" onchange="A.rat.setPrice(${q(t.code)}, ${q(d)}, this.value)">
        <div>${restrTags(t.code, d)}</div></td>`).join("")}</tr>`).join("")}
      </tbody></table></div>`)}
      <div class="dash" style="margin-top:16px">
        <div class="w8">${section("Évolution du BAR par type", lineChart(days.map(fd), D.roomTypes.map((t) => ({ name: t.label, values: days.map((d) => bar(t.code, d)) })), { fmt: shortNum }))}</div>
        <div class="w4">${section("À vendre ce soir", donut(toSell, { fmt: (v) => v + " ch.", center: String(toSell.reduce((s, x) => s + x.value, 0)), sub: "chambres" }))}</div>
        <div class="w12">${section(`Plan dérivé affiché : ${pc}`, `<div class="chips">${derived.map((x) => `<button aria-pressed="${pc === x.code}" onclick="ui.ratPlan=${q(x.code)};render()">${esc(x.code)}</button>`).join("")}</div>
      <div class="tablewrap"><table><thead><tr>${head(days)}</tr></thead><tbody>
      ${D.roomTypes.map((t) => `<tr><td>${esc(t.label)}</td>${days.map((d) => { const x = price(pc, t.code, d); return `<td class="num ${x.floored ? "cell0" : ""}" title="${x.floored ? `Calculé ${money(x.raw)}, relevé au plancher` : ""}">${esc(Math.round(x.v / 1000))} k</td>` }).join("")}</tr>`).join("")}
      </tbody></table></div>
      ${floored ? `<p class="muted">Cases grisées : le prix calculé passait sous le plancher du plan parent, il est relevé au plancher (RG-RAT-01).</p>` : ""}`)}</div>
        <div class="w6">${section("Modification en masse", form([
          field("rat-b-type", "Type de chambre", select("rat-b-type", [["ALL", "Tous les types"], ...typeOpts()], "STD")),
          field("rat-b-from", "Du", input("rat-b-from", addDays(today, 7), 'type="date"')),
          field("rat-b-to", "Au (inclus)", input("rat-b-to", addDays(today, 10), 'type="date"')),
          field("rat-b-mode", "Mode", select("rat-b-mode", [["pct", "Variation en %"], ["amount", "Variation en FCFA"], ["set", "Prix fixe"]], "pct")),
          field("rat-b-val", "Valeur", input("rat-b-val", "5", 'type="number"')),
          `<div class="full row">${btn("Appliquer sur la plage", "A.rat.bulk()")}<span class="muted">Hors bornes : refusé (plancher/plafond du revenue manager).</span></div>`,
        ]))}</div>
        <div class="w6">${section("Prix par occupation", tbl(["Occupation", "#Supplément / nuit"], [
          ["1 adulte", "BAR"], ["2 adultes", money(S.occupancy.adult2)], ["3 adultes", money(S.occupancy.adult3)],
          ["Enfant 0-5 ans", S.occupancy.child0_5 ? money(S.occupancy.child0_5) : "Gratuit"], ["Enfant 6-11 ans", money(S.occupancy.child6_11)],
        ]) + `<p class="muted">Suppléments appliqués à tous les plans (EF-RAT-003). Prix affichés TTC, taxe de séjour incluse pour le marché ivoirien (RG-RAT-07).</p>`)}</div>
      </div>`
  }

  function plansTab(p) {
    const cur = plan(p[1]) || S.plans[0]
    const t = "STD", d = addDays(today, 1)
    const left = listItems(S.plans.map((x) => ({ id: x.code, title: `${x.code} — ${x.name}`, sub: `${x.type}${x.parent ? ` · dérivé de ${x.parent}` : ""} · ${money(price(x.code, t, d).v)} (STD ${fd(d)})`, badge: x.active ? "" : " " + badge("Inactif", "outline") })), cur.code, "rat-tarifs/plans")
    const deriv = cur.parent ? `${cur.deriv.value > 0 ? "+" : ""}${cur.deriv.kind === "pct" ? cur.deriv.value + " %" : money(cur.deriv.value)} sur ${cur.parent}` : "Tarif de référence (saisi dans la grille)"
    const fl = D.roomTypes.filter((x) => price(cur.code, x.code, d).floored)
    return split(left, card("", `<div class="row between"><span class="big">${esc(cur.code)} — ${esc(cur.name)}</span>${cur.active ? badge("Actif", "ok") : badge("Inactif", "outline")}</div>
      <p class="muted">EF-RAT-001 · devise ${esc(D.currency)} · segment ${esc(cur.segment)}</p>
      ${tbl(["Paramètre", "Valeur"], [
        ["Type", esc(cur.type)], ["Dérivation", esc(deriv)], ["Annulation", esc(cur.cancel)], ["Garantie", esc(cur.guarantee)],
        ["Inclusions", esc(cur.incl.join(", ") || "—")], ["Canaux autorisés", cur.channels.map((c) => esc(ch(c).name)).join("<br>")],
        ["Visibilité", cur.company ? `Réservé aux profils liés à ${esc(cur.company)} (RG-RAT-04)` : "Publique"],
      ])}
      ${fl.length ? `<div class="err" style="margin-top:10px">Sous le plancher du plan parent pour ${esc(fl.map((x) => x.label).join(", "))} : le prix est relevé au plancher (RG-RAT-01).</div>` : ""}
      <h3>Prix des 7 prochaines nuits</h3>
      ${tbl(["Type", ...daysFrom(today, 7).map((x) => "#" + fd(x))], D.roomTypes.map((x) => [esc(x.label), ...daysFrom(today, 7).map((y) => money(price(cur.code, x.code, y).v).replace(" FCFA", ""))]))}
      ${cur.parent ? `<h3>Modifier la dérivation</h3>${form([
        field("rat-p-kind", "Mode", select("rat-p-kind", [["pct", "Pourcentage"], ["montant", "Montant FCFA"]], cur.deriv.kind)),
        field("rat-p-val", "Valeur", input("rat-p-val", cur.deriv.value, 'type="number"')),
        `<div style="align-self:end">${btn("Enregistrer", `A.rat.saveDeriv(${q(cur.code)})`)}</div>`,
      ])}` : ""}
      <div class="row" style="margin-top:14px">${btn(cur.active ? "Désactiver le plan" : "Activer le plan", `A.rat.togglePlan(${q(cur.code)})`, "ghost")}</div>`))
  }

  function forfaitsTab() {
    const d = addDays(today, 1)
    return `<h2>Forfaits</h2><p class="muted">Ventilation comptable par composant et droits d'accès transmis au contrôle d'accès (EF-RAT-006). Prix pour une Standard le ${fd(d)}.</p>
      <div class="cols">${S.packages.map((k) => {
        const total = price(k.plan, "STD", d).v
        const extras = k.components.reduce((s, c) => s + (c.amount || 0), 0)
        return card(`${k.name} · ${k.code}`, tbl(["Composant", "Compte de ventilation", "#Montant"], k.components.map((c) => [esc(c.label), esc(c.account), money(c.amount ?? total - extras)]), "", `<tfoot><tr><td>Prix du forfait (plan ${esc(k.plan)})</td><td></td><td class="num">${money(total)}</td></tr></tfoot>`)
          + `<p class="muted" style="margin-top:8px">Droits d'accès : ${esc(k.access.join(", "))}</p>`)
      }).join("")}</div>
      <h2>Promotions</h2>
      ${tbl(["Code", "Type", "Règle", "Cumulable", "#Utilisations", "Statut", ""], S.promos.map((x) => [
        `<strong>${esc(x.code)}</strong>`, esc(x.kind), esc(x.rule), x.cumul ? "Oui" : "Non", x.uses, x.active ? badge("Active", "ok") : badge("Inactive", "outline"),
        btn(x.active ? "Suspendre" : "Activer", `A.rat.togglePromo(${q(x.code)})`, "ghost sm"),
      ]))}
      <p class="muted">Règle de cumul (EF-RAT-007) : une seule promotion non cumulable par séjour ; les promotions cumulables s'ajoutent, dans la limite du plancher du type de chambre.</p>
      ${card("Tester le cumul", form([
        field("rat-c-a", "Promotion 1", select("rat-c-a", S.promos.map((x) => x.code), "EARLY30")),
        field("rat-c-b", "Promotion 2", select("rat-c-b", S.promos.map((x) => x.code), "DERNIERE")),
        `<div style="align-self:end">${btn("Vérifier", "A.rat.testCumul()", "ghost")}</div>`, `<div class="full" id="rat-c-res"></div>`,
      ]))}`
  }

  function restrTab() {
    const days = daysFrom(today, HORIZON)
    return `<p class="muted">CTA = fermé à l'arrivée, CTD = fermé au départ, Min/Max = durée de séjour. Une fermeture de vente prévaut sur toute disponibilité (RG-RAT-03). Cliquez une case pour ouvrir/fermer la vente.</p>
      <div class="tablewrap"><table><thead><tr>${head(days)}</tr></thead><tbody>
      ${D.roomTypes.map((t) => `<tr><td>${esc(t.label)}</td>${days.map((d) => `<td class="num ${rs(t.code, d).stop ? "cell0" : ""}"><button class="link" title="Ouvrir/fermer la vente" onclick="A.rat.toggleStop(${q(t.code)}, ${q(d)})">${sellable(t.code, d)}</button><div>${restrTags(t.code, d)}</div></td>`).join("")}</tr>`).join("")}
      </tbody></table></div>
      <h2>Appliquer une restriction sur une plage</h2>
      ${card("", form([
        field("rat-r-type", "Type", select("rat-r-type", [["ALL", "Tous les types"], ...typeOpts()], "SUI")),
        field("rat-r-from", "Du", input("rat-r-from", addDays(today, 7), 'type="date"')),
        field("rat-r-to", "Au (inclus)", input("rat-r-to", addDays(today, 9), 'type="date"')),
        field("rat-r-min", "Séjour minimum", input("rat-r-min", "", 'type="number" min="0" placeholder="—"')),
        field("rat-r-max", "Séjour maximum", input("rat-r-max", "", 'type="number" min="0" placeholder="—"')),
        `<div style="align-self:end"><label class="row" style="color:var(--ink)"><input type="checkbox" id="rat-r-cta"> CTA</label><label class="row" style="color:var(--ink)"><input type="checkbox" id="rat-r-ctd"> CTD</label><label class="row" style="color:var(--ink)"><input type="checkbox" id="rat-r-stop"> Fermeture de vente</label></div>`,
        `<div class="full" id="rat-r-err"></div>`,
        `<div class="full row">${btn("Appliquer", "A.rat.applyRestr(false)")}${btn("Lever les restrictions sur la plage", "A.rat.applyRestr(true)", "ghost")}<span class="muted">EF-RAT-004</span></div>`,
      ]))}`
  }

  function invTab() {
    const days = daysFrom(today, HORIZON)
    const rows = (t) => [
      ["Physique", (d) => physical(t)], ["Hors commande", (d) => ooo(t)], ["Réservées", (d) => booked(t, d)],
      ["Allotements non libérés", (d) => allotted(t, d)], ["Surbooking autorisé", (d) => ob(t, d)],
    ]
    const o = S.obReco
    return `<p class="muted">Disponibilité calculée en temps réel (EF-RAT-005) : physique − réservées − hors commande − allotements + surbooking. Chambres hors service lues depuis le statut des chambres.</p>
      ${D.roomTypes.map((t) => `<h3>${esc(t.label)}</h3><div class="tablewrap"><table><thead><tr>${head(days).replace("Type", "")}</tr></thead><tbody>
        ${rows(t.code).map(([l, f]) => `<tr><td class="muted">${esc(l)}</td>${days.map((d) => `<td class="num">${f(d) || "·"}</td>`).join("")}</tr>`).join("")}
        <tr><td><strong>À vendre</strong></td>${days.map((d) => { const n = sellable(t.code, d); return `<td class="num ${n <= 0 ? "cell0" : ""}"><strong>${rs(t.code, d).stop ? "Fermé" : n}</strong></td>` }).join("")}</tr>
      </tbody></table></div>`).join("")}
      <h2>Allotements</h2>
      ${tbl(["Réf.", "Bénéficiaire", "Type", "Période", "#Chambres", "#Prises", "Libération", "Statut", ""], S.allotments.map((a) => {
        const rel = releaseDate(a), due = !a.released && rel <= today
        return [esc(a.id), esc(a.holder), esc(T(a.type).label), `${fd(a.from)} → ${fd(a.to)}`, a.rooms, a.picked, `J-${a.release} (${fd(rel)})`,
          a.released ? badge("Libéré", "outline") : due ? badge("À libérer aujourd'hui", "warn") : badge("Bloqué", "info"),
          a.released ? "" : btn("Libérer", `A.rat.release(${q(a.id)})`, "ghost sm")]
      }))}
      <h2>Plafond de surbooking (EF-RAT-012)</h2>
      ${aiBox("Optimisation du surbooking", `Probabilité de no-show estimée à 9 % sur les nuits du ${fd(o.from)} au ${fd(o.to)} (événement, réservations OTA récentes). Recommandation : +${o.rooms} ${T(o.type).label} par nuit, soit ${pct((o.rooms / sellableRooms()) * 100)} de l'inventaire vendable. Au-delà de 5 %, une validation humaine est obligatoire.`,
        o.status === "proposee" ? btn("Valider (revenue manager)", "A.rat.validateOb()", "accent") + btn("Refuser", "A.rat.rejectOb()", "ghost") : badge(o.status === "validee" ? "Validée" : "Refusée", o.status === "validee" ? "ok" : "bad"))}
      ${card("Saisie manuelle", form([
        field("rat-o-type", "Type", select("rat-o-type", typeOpts(), "STD")),
        field("rat-o-from", "Du", input("rat-o-from", addDays(today, 3), 'type="date"')),
        field("rat-o-to", "Au (inclus)", input("rat-o-to", addDays(today, 4), 'type="date"')),
        field("rat-o-n", "Chambres", input("rat-o-n", "1", 'type="number" min="0" max="3"')),
        `<div style="align-self:end">${btn("Appliquer", "A.rat.setOb()")}</div>`,
      ]))}`
  }

  function revenueTab() {
    const open = S.recos.filter((r) => r.status === "proposee")
    const days = daysFrom(today, HORIZON)
    const forecast = days.map((d, i) => Math.round(Math.min(100, occOn(d) * 100 + (inEvent(d) ? 45 : isWeekend(d) ? 22 : 15) - i)))
    return `${aiBox("Recommandations tarifaires du matin", `${open.length} date(s) où le prix recommandé diffère du prix actuel sur les ${HORIZON} prochains jours (US-RAT-01). Mode ${ui.ratAuto ? "automatique borné" : "conseil"} : bornes plancher/plafond par type et variation maximale de ± ${S.maxDailyMove} % par jour (RG-RAT-02).`,
      btn("Tout accepter", "A.rat.acceptAll()", "accent") + btn(ui.ratAuto ? "Repasser en mode conseil" : "Activer le mode automatique borné", "A.rat.toggleAuto()", "ghost"))}
      <div class="chips" style="margin-top:14px">${["ALL", ...D.roomTypes.map((t) => t.code)].map((c) => `<button aria-pressed="${(ui.ratRecoType || "ALL") === c}" onclick="ui.ratRecoType=${q(c)};render()">${c === "ALL" ? "Tous les types" : esc(T(c).label)}</button>`).join("")}</div>
      ${tbl(["Date", "Type", "#Actuel", "#Recommandé", "#Écart", "Confiance", "Facteurs", "Statut", ""], S.recos.filter((r) => (ui.ratRecoType || "ALL") === "ALL" || r.type === ui.ratRecoType).map((r) => {
        const b = bounded(r), diff = ((r.rec - r.cur) / r.cur) * 100
        return [fd(r.date) + (inEvent(r.date) ? " ★" : ""), esc(T(r.type).label), money(r.cur), money(r.rec) + (b.clipped ? `<div class="muted">borné à ${money(b.v)}</div>` : ""),
          (diff > 0 ? "+" : "") + pct(diff), r.conf + " %", `<span class="muted">${esc(r.factors.join(" · "))}</span>`,
          { proposee: badge("Proposée", "warn"), acceptee: badge("Acceptée", "ok"), modifiee: badge("Modifiée", "ok"), rejetee: badge("Rejetée", "bad") }[r.status],
          r.status === "proposee" ? `<span class="row" style="flex-wrap:nowrap">${btn("Accepter", `A.rat.accept(${q(r.id)})`, "sm")}${btn("Modifier", `A.rat.modify(${q(r.id)})`, "ghost sm")}${btn("Rejeter", `A.rat.reject(${q(r.id)})`, "ghost sm")}</span>` : ""]
      }), "Aucune recommandation.")}
      <h2>Bornes du mode automatique</h2>
      ${card("", `<p class="muted" style="margin-top:0">Le mode automatique n'applique un prix qu'entre le plancher et le plafond du type, avec une variation maximale journalière (RG-RAT-02). Une recommandation hors bornes est ramenée à la borne et reste à valider. EF-RAT-014</p>
        ${tbl(["Type", "#Plancher (FCFA)", "#Plafond (FCFA)"], D.roomTypes.map((t) => [esc(t.label),
          `<input id="rat-b-lo-${esc(t.code)}" type="number" step="500" value="${S.bounds[t.code][0]}" aria-label="Plancher ${esc(t.label)}" style="max-width:130px">`,
          `<input id="rat-b-hi-${esc(t.code)}" type="number" step="500" value="${S.bounds[t.code][1]}" aria-label="Plafond ${esc(t.label)}" style="max-width:130px">`]))}
        <div class="row" style="margin-top:10px"><label for="rat-b-move">Variation max. par jour (± %)</label><input id="rat-b-move" type="number" min="1" max="50" value="${S.maxDailyMove}" style="max-width:90px">${btn("Enregistrer les bornes", "A.rat.saveBounds()")}</div>
        <p class="muted">Mode actuel : ${ui.ratAuto ? badge("Automatique borné", "ok") : badge("Conseil (validation humaine)", "outline")} · ${S.recos.filter((r) => r.status === "proposee" && bounded(r).clipped).length} recommandation(s) hors bornes en attente de décision humaine.</p>`)}
      <div class="cols">
        <section><h2>Prévision de la demande — taux d'occupation</h2>${columns(days.map(fd), forecast, (v) => v + " %")}<p class="muted">Modèle de séries temporelles simulé (pick-up, saisonnalité, événements, concurrence). Repli : moyenne historique.</p></section>
        <section><h2>Rate shopping — Standard (fournisseur simulé)</h2>${tbl(["Établissement", ...daysFrom(today, 7).map((d) => "#" + fd(d))], [
          [`<strong>${esc(D.hotel)}</strong>`, ...daysFrom(today, 7).map((d) => `<strong>${Math.round(bar("STD", d) / 1000)} k</strong>`)],
          ...S.compset.map((c) => [esc(c.name), ...c.d.map((v) => Math.round(v / 1000) + " k")]),
        ])}<p class="muted">EF-RAT-015 · données concurrentes fictives.</p></section>
      </div>`
  }

  function kpiTab() {
    const st = staysOn(today), rev = st.reduce((s, r) => s + r.rate, 0), sold = st.length, avail = sellableRooms()
    const totalRev = S.channels.reduce((s, c) => s + c.revenue, 0), direct = ch("direct").revenue
    const gen = S.recos.length, acc = S.recos.filter((r) => ["acceptee", "modifiee"].includes(r.status)).length
    const days = daysFrom(today, HORIZON), occ = days.map((d) => Math.round(occOn(d) * 100))
    const cost = (c) => (c.revenue * c.commission) / 100, totalCost = S.channels.reduce((s, c) => s + cost(c), 0)
    const short = (c) => c.name.replace(" (simulé)", "")
    return `<div class="grid g4" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))">
      ${stat({ label: "ADR", value: money(sold ? rev / sold : 0), icon: "tag", hint: "revenu hébergement / chambres vendues (nuit du jour)" })}
      ${stat({ label: "RevPAR", value: money(rev / avail), icon: "trend", hint: `revenu hébergement / ${avail} chambres disponibles` })}
      ${stat({ label: "Taux d'occupation", value: pct((sold / avail) * 100), icon: "bed", hint: `${sold} chambres vendues ce soir · 14 jours en courbe`, trend: occ })}
      ${stat({ label: "Pick-up 7 jours", value: String(S.pickup.reduce((s, x) => s + x, 0)), icon: "zap", hint: `réservations nettes, dont ${S.pickup[6]} aujourd'hui`, trend: S.pickup })}
      ${stat({ label: "Part de la vente directe", value: pct((direct / totalRev) * 100), icon: "globe", hint: "revenu direct / revenu total du mois", route: "rat-distribution/moteur" })}
      ${stat({ label: "Acceptation des recos IA", value: gen ? pct((acc / gen) * 100) : "—", icon: "brain", hint: `${acc} acceptée(s) sur ${gen} générée(s)`, route: "rat-tarifs/revenue" })}
    </div>
    <div class="dash" style="margin-top:16px">
      <div class="w8">${section("Taux d'occupation à venir (réservations fermes)", lineChart(days.map(fd), [{ name: "Occupation (%)", values: occ }], { fmt: (v) => Math.round(v) + " %", max: 100 }))}</div>
      <div class="w4">${section("Revenu par canal", donut(S.channels.map((c) => ({ label: short(c), value: c.revenue })), { fmt: money, center: shortNum(totalRev), sub: "FCFA · mois" }))}</div>
      <div class="w8">${section("Coût de distribution par canal (mois en cours, exemple)", tbl(["Canal", "#Revenu", "#Commission", "#Coût"], S.channels.map((c) => [esc(c.name), money(c.revenue), c.commission + " %", money(cost(c))]),
        "", `<tfoot><tr><td>Total</td><td class="num">${money(totalRev)}</td><td class="num">${pct((totalCost / totalRev) * 100)}</td><td class="num">${money(totalCost)}</td></tr></tfoot>`))}</div>
      <div class="w4">${section("Commissions payées", bars(S.channels.map((c) => ({ label: short(c), value: cost(c) })).sort((a, b) => b.value - a.value), shortNum))}</div>
    </div>`
  }

  function journalTab() {
    return `<p class="muted">Tous les changements de tarifs, restrictions et inventaire : qui, quand, source (EF-RAT-016).</p>
      ${tbl(["Date", "Auteur", "Source", "Changement"], S.log.map((l) => [esc(l.at), esc(l.who), badge(l.source, l.source === "IA" ? "info" : l.source === "Canal" ? "outline" : "ok"), esc(l.what)]))}`
  }

  function canauxTab() {
    const okN = S.channels.filter((c) => c.status === "ok").length, queue = S.channels.reduce((s, c) => s + c.queue, 0)
    const totalRev = S.channels.reduce((s, c) => s + c.revenue, 0), cost = S.channels.reduce((s, c) => s + (c.revenue * c.commission) / 100, 0)
    const short = (c) => c.name.replace(" (simulé)", "")
    return `<div class="grid g4">
        ${stat({ label: "Canaux à jour", value: `${okN}/${S.channels.length}`, icon: "plug", hint: okN === S.channels.length ? "toutes les connexions répondent" : `${S.channels.length - okN} en échec` })}
        ${stat({ label: "Messages ARI en file", value: String(queue), icon: "refresh", hint: "prix, restrictions, disponibilités" })}
        ${stat({ label: "Revenu des canaux", value: money(totalRev), icon: "coins", hint: "mois en cours (exemple)", route: "rat-tarifs/kpi" })}
        ${stat({ label: "Coût de distribution", value: pct((cost / totalRev) * 100), icon: "wallet", hint: `${money(cost)} de commissions`, good: false })}
      </div>
      <div class="dash" style="margin-top:16px">
        <div class="w12">${section("Canaux et synchronisation", tbl(["Canal", "Type", "#Commission", "Synchro ARI", "Dernière synchro", "#Messages en file", ""], S.channels.map((c) => [
      `<strong>${esc(c.name)}</strong>`, esc(c.kind), c.commission + " %",
      c.status === "ok" ? badge("À jour", "ok") : badge(`Échec depuis ${c.failedFor} min`, "bad"), esc(c.lastSync), c.queue ? badge(String(c.queue), "warn") : "0",
      `<span class="row" style="flex-wrap:nowrap">${c.status === "echec" ? btn("Rejouer", `A.rat.replay(${q(c.id)})`, "sm") : ""}${btn("Resynchro complète", `A.rat.fullSync(${q(c.id)})`, "ghost sm")}</span>`,
    ])) + `<p class="muted">Modifier un prix ou une restriction ajoute des messages ARI dans la file de chaque canal. En cas d'échec, la file est rejouée ; au-delà de 5 minutes, le distribution manager est alerté. Connexions simulées.</p>`)}</div>
        <div class="w4">${section("Revenu par canal", donut(S.channels.map((c) => ({ label: short(c), value: c.revenue })), { fmt: money, center: shortNum(totalRev), sub: "FCFA · mois" }))}</div>
        <div class="w4">${section("Commission par canal", bars(S.channels.map((c) => ({ label: short(c), value: c.commission })).sort((a, b) => b.value - a.value), (v) => v + " %"))}</div>
        <div class="w4">${section("Simuler une panne", `<p class="muted" style="margin-top:0">Pour la démonstration : coupe la connexion de l'OTA Exemple A.</p>${btn("Couper OTA Exemple A", "A.rat.breakChannel('otaA')", "ghost")}`)}</div>
      </div>`
  }

  function pariteTab() {
    const d = addDays(today, 1), ref = bar("STD", d)
    return `<p class="muted">Contrôle de la parité tarifaire contractuelle : prix BAR Standard du ${fd(d)} observé sur chaque canal (RG-RAT-06, observation simulée).</p>
      ${tbl(["Canal", "#Prix de référence", "#Prix observé", "#Écart", "Parité", ""], S.channels.filter((c) => c.observed != null).map((c) => {
        const gap = c.observed - ref
        return [esc(c.name), money(ref), money(c.observed), (gap > 0 ? "+" : "") + money(gap), gap === 0 ? badge("Respectée", "ok") : badge("Écart : alerte", "bad"),
          gap === 0 ? "" : btn("Corriger (resynchro)", `A.rat.fixParity(${q(c.id)})`, "ghost sm")]
      }))}
      <h2>Mapping des types de chambre par canal (EF-RAT-010)</h2>
      ${tbl(["Type HMS", ...S.channels.map((c) => c.name.replace(" (simulé)", ""))], D.roomTypes.map((t) => [`<strong>${esc(t.label)}</strong>`, ...S.channels.map((c) => `<code>${esc(c.mapping[t.code])}</code>`)]))}
      <h3>Plans tarifaires distribués</h3>
      ${tbl(["Plan", ...S.channels.map((c) => c.name.replace(" (simulé)", ""))], S.plans.filter((x) => x.active).map((x) => [esc(x.code), ...S.channels.map((c) => (x.channels.includes(c.id) ? "✓" : "—"))]))}`
  }

  function inboxTab() {
    return `<p class="muted">Réservations, modifications et annulations envoyées par les canaux, transmises au module Réservations (EF-RAT-009). Contrôle d'inventaire avant intégration (ENF-RAT-03).</p>
      ${tbl(["Réf. canal", "Canal", "Nature", "Client", "Type", "Séjour", "#Tarif", "Statut", ""], S.inbox.map((x) => [
        esc(x.id), esc(ch(x.channel).name), esc(x.kind), esc(x.guest || (R(x.ref) ? G(R(x.ref).guest).name : "—")), esc(T(x.type).label), `${fd(x.from)} → ${fd(x.to)}`, money(x.rate),
        x.status === "recue" ? badge("À intégrer", "warn") : x.status === "rejetee" ? badge("Rejetée", "bad") : badge(x.resId ? `Intégrée · ${x.resId}` : "Intégrée", "ok"),
        x.status === "recue" ? btn("Transmettre aux réservations", `A.rat.ingest(${q(x.id)})`, "sm") : x.resId ? `<button class="link" onclick="go('reservations')">Voir</button>` : "",
      ]))}`
  }

  function moteurTab() {
    const from = ui.ratBeFrom || addDays(today, 7), to = ui.ratBeTo || addDays(today, 9), type = ui.ratBeType || "SUP"
    const n = Math.max(0, nights(from, to))
    const stay = daysFrom(from, n)
    const blocks = []
    if (n < 1) blocks.push("La date de départ doit être après l'arrivée.")
    if (rs(type, from).cta) blocks.push(`Arrivée fermée le ${fd(from)} (CTA).`)
    if (n && rs(type, to).ctd) blocks.push(`Départ fermé le ${fd(to)} (CTD).`)
    const minL = Math.max(0, ...stay.map((d) => rs(type, d).minLOS || 0))
    if (n && minL > n) blocks.push(`Séjour minimum de ${minL} nuits sur ces dates.`)
    stay.forEach((d) => { if (sellable(type, d) < 1) blocks.push(`Plus de ${T(type).label} à vendre la nuit du ${fd(d)}.`) })
    const offers = S.plans.filter((x) => x.active && x.channels.includes("direct") && !x.company)
    const body = `<div class="form">
        ${field("rat-be-from", "Arrivée", input("rat-be-from", from, `type="date" onchange="ui.ratBeFrom=this.value;render()"`))}
        ${field("rat-be-to", "Départ", input("rat-be-to", to, `type="date" onchange="ui.ratBeTo=this.value;render()"`))}
        ${field("rat-be-type", "Chambre", select("rat-be-type", typeOpts(), type, `onchange="ui.ratBeType=this.value;render()"`))}
        ${field("rat-be-lang", "Langue / devise", select("rat-be-lang", ["Français · FCFA", "English · EUR", "English · USD"], "Français · FCFA"))}
        ${field("rat-be-name", "Nom complet", input("rat-be-name", ui.ratBeName ?? "Estelle Gnagne", `oninput="ui.ratBeName=this.value"`))}
        ${field("rat-be-phone", "Mobile (WhatsApp)", input("rat-be-phone", ui.ratBePhone ?? "+225 07 00 00 00 43", `oninput="ui.ratBePhone=this.value"`))}
      </div>
      ${blocks.length ? `<div class="err" style="margin-top:10px">${blocks.map(esc).join("<br>")}</div>` : offers.map((x) => {
        const tot = stay.reduce((s, d) => s + price(x.code, type, d).v, 0)
        return `<div class="card" style="margin-top:10px"><div class="row between"><strong>${esc(x.name)}</strong><strong>${money(tot)}</strong></div>
          <div class="muted">${n} nuit(s) · ${esc(x.cancel)}${x.incl.length ? " · " + esc(x.incl.join(", ")) : ""}</div>
          <div class="row" style="margin-top:8px">${btn("Réserver · Mobile Money", `A.rat.book(${q(x.code)}, 'Mobile Money (simulé)')`, "sm")}${btn("Carte", `A.rat.book(${q(x.code)}, 'Carte bancaire (simulé)')`, "ghost sm")}</div></div>`
      }).join("") + `<p class="muted">Ajouts proposés : transfert aéroport 12 000 FCFA, dîner 9 000 FCFA.</p>`}`
    return `<div class="cols"><section>${phone(body, "hotel-exemple.test — Réserver")}</section>
      <section><h2>Moteur de réservation directe</h2><p class="muted">Responsive, multilingue et multi-devises (EF-RAT-011). Seuls les plans publics autorisés sur le site sont affichés ; les tarifs négociés n'apparaissent qu'aux profils de la société (RG-RAT-04). Paiement par carte ou Mobile Money via PSP simulé ; confirmation par e-mail et WhatsApp avec lien de check-in en ligne (US-RAT-02).</p>
      ${ui.ratBooked ? card("Dernière réservation du moteur", `<p style="margin:0">${esc(ui.ratBooked)}</p>`) : ""}</section></div>`
  }

  // ---------- Actions ----------
  const inBounds = (type, v) => v >= S.bounds[type][0] && v <= S.bounds[type][1]
  const actions = {
    setPrice(type, d, v) {
      v = Number(v)
      if (!inBounds(type, v)) { toast(`Refusé : ${money(v)} hors bornes ${money(S.bounds[type][0])} – ${money(S.bounds[type][1])}`); return render() }
      const old = bar(type, d)
      S.base[type][d] = v
      log("Humain", `BAR ${T(type).label} ${fd(d)} : ${money(old)} → ${money(v)}`)
      enqueue(1)
      toast("Prix enregistré, ARI en file pour les canaux")
      render()
    },
    bulk() {
      const types = val("rat-b-type") === "ALL" ? D.roomTypes.map((t) => t.code) : [val("rat-b-type")]
      const from = val("rat-b-from"), to = val("rat-b-to"), mode = val("rat-b-mode"), x = Number(val("rat-b-val"))
      if (!from || !to || to < from) return toast("Plage de dates invalide")
      if (!x && mode !== "pct") return toast("Indiquez une valeur")
      let n = 0, refused = 0
      types.forEach((t) => { for (let d = from; d <= to; d = addDays(d, 1)) {
        const cur = bar(t, d), v = r500(mode === "pct" ? cur * (1 + x / 100) : mode === "amount" ? cur + x : x)
        if (!inBounds(t, v)) { refused++; continue }
        S.base[t][d] = v; n++
      } })
      log("Humain", `Modification en masse ${types.join("/")} du ${fd(from)} au ${fd(to)} (${mode === "pct" ? x + " %" : money(x)}) : ${n} prix`)
      enqueue(n)
      toast(`${n} prix modifié(s)${refused ? `, ${refused} refusé(s) hors bornes` : ""}`)
      render()
    },
    saveDeriv(code) {
      const p = plan(code)
      p.deriv = { kind: val("rat-p-kind"), value: Number(val("rat-p-val")) }
      log("Humain", `Dérivation ${code} : ${p.deriv.value} ${p.deriv.kind === "pct" ? "%" : "FCFA"} sur ${p.parent}`)
      enqueue(3)
      toast(`Plan ${code} recalculé`)
      render()
    },
    togglePlan(code) {
      const p = plan(code)
      p.active = !p.active
      log("Humain", `Plan ${code} ${p.active ? "activé" : "désactivé"}`)
      toast(`Plan ${code} ${p.active ? "activé" : "désactivé"}`)
      render()
    },
    togglePromo(code) {
      const p = S.promos.find((x) => x.code === code)
      p.active = !p.active
      log("Humain", `Promotion ${code} ${p.active ? "activée" : "suspendue"}`)
      toast(`Promotion ${code} ${p.active ? "activée" : "suspendue"}`)
      render()
    },
    testCumul() {
      const a = S.promos.find((x) => x.code === val("rat-c-a")), b = S.promos.find((x) => x.code === val("rat-c-b"))
      const out = $("#rat-c-res")
      if (a === b) out.innerHTML = `<p class="muted">Choisissez deux promotions différentes.</p>`
      else if (!a.active || !b.active) out.innerHTML = `<div class="err">${esc((!a.active ? a : b).code)} est inactive.</div>`
      else if (!a.cumul && !b.cumul) out.innerHTML = `<div class="err">${esc(a.code)} et ${esc(b.code)} ne sont pas cumulables : seule la plus avantageuse (−${Math.max(a.pct, b.pct)} %) s'applique.</div>`
      else out.innerHTML = `<p>${badge("Cumul autorisé", "ok")} Remise totale −${a.pct + b.pct} %, dans la limite du plancher.</p>`
    },
    toggleStop(type, d) {
      const k = `${type}|${d}`, x = (S.restr[k] = S.restr[k] || {})
      x.stop = !x.stop
      log("Humain", `${x.stop ? "Fermeture" : "Réouverture"} de vente ${T(type).label} le ${fd(d)}`)
      enqueue(1)
      toast(`${T(type).label} ${fd(d)} : vente ${x.stop ? "fermée" : "ouverte"}`)
      render()
    },
    applyRestr(clear) {
      const types = val("rat-r-type") === "ALL" ? D.roomTypes.map((t) => t.code) : [val("rat-r-type")]
      const from = val("rat-r-from"), to = val("rat-r-to"), min = Number(val("rat-r-min")) || 0, max = Number(val("rat-r-max")) || 0
      const err = (m) => ($("#rat-r-err").innerHTML = `<div class="err">${esc(m)}</div>`)
      if (!from || !to || to < from) return err("Plage de dates invalide.")
      if (min && max && max < min) return err("Le séjour maximum doit être supérieur ou égal au minimum.")
      const set = { minLOS: min || undefined, maxLOS: max || undefined, cta: $("#rat-r-cta").checked || undefined, ctd: $("#rat-r-ctd").checked || undefined, stop: $("#rat-r-stop").checked || undefined }
      if (!clear && !Object.values(set).some(Boolean)) return err("Choisissez au moins une restriction.")
      let n = 0
      types.forEach((t) => { for (let d = from; d <= to; d = addDays(d, 1)) {
        const k = `${t}|${d}`
        if (clear) delete S.restr[k]
        else S.restr[k] = { ...(S.restr[k] || {}), ...Object.fromEntries(Object.entries(set).filter(([, v]) => v)) }
        n++
      } })
      log("Humain", `${clear ? "Levée des restrictions" : "Restrictions appliquées"} ${types.join("/")} du ${fd(from)} au ${fd(to)}`)
      enqueue(n)
      toast(`${n} jour(s)-type mis à jour`)
      render()
    },
    release(id) {
      const a = S.allotments.find((x) => x.id === id)
      a.released = true
      log("Humain", `Allotement ${id} (${a.holder}) libéré : ${a.rooms - a.picked} ${T(a.type).label} remises en vente`)
      enqueue(nights(a.from, a.to))
      toast(`${a.rooms - a.picked} chambre(s) remise(s) en vente`)
      render()
    },
    validateOb() {
      const o = S.obReco
      for (let d = o.from; d <= o.to; d = addDays(d, 1)) S.overbook[`${o.type}|${d}`] = o.rooms
      o.status = "validee"
      log("Humain", `Surbooking +${o.rooms} ${T(o.type).label} du ${fd(o.from)} au ${fd(o.to)} validé (recommandation IA)`)
      enqueue(3)
      toast("Surbooking validé")
      render()
    },
    rejectOb() { S.obReco.status = "refusee"; log("Humain", "Recommandation de surbooking refusée"); render() },
    setOb() {
      const t = val("rat-o-type"), from = val("rat-o-from"), to = val("rat-o-to"), n = Number(val("rat-o-n"))
      if (!from || !to || to < from) return toast("Plage de dates invalide")
      if ((n / sellableRooms()) * 100 > 5 && !confirm(`${n} chambre(s) = ${pct((n / sellableRooms()) * 100)} de l'inventaire, au-delà de 5 %. Confirmer en tant que revenue manager ?`)) return
      for (let d = from; d <= to; d = addDays(d, 1)) S.overbook[`${t}|${d}`] = n
      log("Humain", `Plafond de surbooking ${T(t).label} du ${fd(from)} au ${fd(to)} : ${n}`)
      toast("Plafond enregistré")
      render()
    },
    accept(id, silent) {
      const r = S.recos.find((x) => x.id === id), b = bounded(r)
      S.base[r.type][r.date] = b.v
      r.status = b.clipped ? "modifiee" : "acceptee"
      log(silent === "auto" ? "IA" : "Humain", `Recommandation ${b.clipped ? "appliquée (bornée)" : "acceptée"} : ${T(r.type).label} ${fd(r.date)} → ${money(b.v)}`)
      enqueue(1)
      if (!silent) { toast("Prix mis à jour, synchronisation des canaux"); render() }
    },
    acceptAll() {
      const open = S.recos.filter((r) => r.status === "proposee")
      open.forEach((r) => actions.accept(r.id, true))
      actions.syncAll(true)
      toast(`${open.length} recommandation(s) appliquée(s) et synchronisée(s)`)
      render()
    },
    modify(id) {
      const r = S.recos.find((x) => x.id === id)
      const v = Number(prompt(`Prix pour ${T(r.type).label} le ${fd(r.date)} (FCFA)`, bounded(r).v))
      if (!v) return
      if (!inBounds(r.type, v)) return toast("Refusé : hors bornes plancher/plafond")
      S.base[r.type][r.date] = v
      r.status = "modifiee"
      log("Humain", `Recommandation modifiée : ${T(r.type).label} ${fd(r.date)} → ${money(v)}`)
      enqueue(1)
      render()
    },
    reject(id) {
      const r = S.recos.find((x) => x.id === id)
      r.status = "rejetee"
      log("Humain", `Recommandation rejetée : ${T(r.type).label} ${fd(r.date)}`)
      render()
    },
    saveBounds() {
      const next = {}
      for (const t of D.roomTypes) {
        const lo = Number(val("rat-b-lo-" + t.code)), hi = Number(val("rat-b-hi-" + t.code))
        if (!lo || !hi || lo >= hi) return toast(`Bornes invalides pour ${t.label} : le plancher doit être inférieur au plafond`)
        next[t.code] = [lo, hi]
      }
      const m = Number(val("rat-b-move"))
      if (!(m >= 1 && m <= 50)) return toast("Variation journalière entre 1 et 50 %")
      S.bounds = next; S.maxDailyMove = m
      log("Humain", `Bornes IA mises à jour : ${D.roomTypes.map((t) => `${t.code} ${Math.round(next[t.code][0] / 1000)}-${Math.round(next[t.code][1] / 1000)} k`).join(", ")}, ± ${m} %/jour`)
      toast("Bornes enregistrées")
      render()
    },
    toggleAuto() {
      ui.ratAuto = !ui.ratAuto
      if (ui.ratAuto) {
        const open = S.recos.filter((r) => r.status === "proposee" && !bounded(r).clipped)
        open.forEach((r) => actions.accept(r.id, "auto"))
        toast(`Mode automatique : ${open.length} prix appliqué(s) dans les bornes, les autres restent à valider`)
      } else toast("Mode conseil")
      render()
    },
    syncAll(silent) {
      let n = 0
      S.channels.forEach((c) => { if (c.status === "ok") { n += c.queue; c.queue = 0; c.lastSync = now() } })
      if (!silent) { toast(`${n} message(s) ARI propagé(s) en 4 s (simulé)`); render() }
    },
    replay(id) {
      const c = ch(id)
      Object.assign(c, { status: "ok", failedFor: 0, queue: 0, lastSync: now() })
      log("Canal", `File ARI rejouée avec succès vers ${c.name}`, "Hub de distribution (simulé)")
      toast(`${c.name} : file rejouée`)
      render()
    },
    fullSync(id) {
      const c = ch(id)
      Object.assign(c, { status: "ok", failedFor: 0, queue: 0, lastSync: now() })
      log("Humain", `Resynchronisation complète ${HORIZON * 25} jours × types vers ${c.name}`)
      toast(`Resynchronisation complète envoyée à ${c.name}`)
      render()
    },
    breakChannel(id) {
      Object.assign(ch(id), { status: "echec", failedFor: 6, queue: ch(id).queue + 4 })
      toast("Panne simulée")
      render()
    },
    fixParity(id) {
      const c = ch(id)
      c.observed = bar("STD", addDays(today, 1))
      Object.assign(c, { status: "ok", failedFor: 0, queue: 0, lastSync: now() })
      log("Humain", `Parité rétablie sur ${c.name}`)
      toast("Parité rétablie (resynchronisation)")
      render()
    },
    ingest(id) {
      const x = S.inbox.find((i) => i.id === id)
      if (x.kind === "Annulation") {
        const r = R(x.ref)
        if (r && r.status === "confirmee") { r.status = "annulee"; x.status = "integree"; x.resId = r.id; S.pickup[6]--; toast(`Réservation ${r.id} annulée`) }
        else { x.status = "rejetee"; toast("Réservation introuvable ou déjà en séjour : à traiter manuellement") }
      } else {
        for (let d = x.from; d < x.to; d = addDays(d, 1))
          if (available(x.type, d) < 1) { x.status = "rejetee"; log("Canal", `${id} rejetée : plus de ${T(x.type).label} le ${fd(d)}`, ch(x.channel).name); toast("Rejetée : inventaire épuisé, le canal est notifié"); return render() }
        let g = D.guests.find((g) => g.name === x.guest)
        if (!g) D.guests.push((g = { id: "G" + (D.guests.length + 1), name: x.guest, phone: x.phone, email: x.email, nationality: x.nationality, idDoc: "À vérifier au check-in", vip: false, prefs: [] }))
        const resId = "R-" + ui.resSeq++
        D.reservations.push({ id: resId, guest: g.id, type: x.type, from: x.from, to: x.to, rate: x.rate, guarantee: `Carte virtuelle ${ch(x.channel).kind}`, status: "confirmee", channel: ch(x.channel).name })
        Object.assign(x, { status: "integree", resId })
        S.pickup[6]++
        toast(`Réservation ${resId} créée`)
      }
      log("Canal", `${x.kind} ${id} transmise aux réservations`, ch(x.channel).name)
      enqueue(nights(x.from, x.to))
      render()
    },
    book(code, pay) {
      const from = ui.ratBeFrom || addDays(today, 7), to = ui.ratBeTo || addDays(today, 9), type = ui.ratBeType || "SUP"
      const n = nights(from, to), tot = daysFrom(from, n).reduce((s, d) => s + price(code, type, d).v, 0)
      const name = val("rat-be-name"), phone = val("rat-be-phone")
      if (!name || !phone) return toast("Indiquez le nom et le mobile du client")
      if (n < 1) return toast("Dates invalides")
      const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")
      let g = D.guests.find((x) => x.name.toLowerCase() === name.toLowerCase() && !x.erased)
      if (!g) D.guests.push((g = { id: "G" + (D.guests.length + 1), name, phone, email: `${slug}@exemple.test`, nationality: "", idDoc: "À vérifier au check-in", vip: false, prefs: [] }))
      const id = g.id
      const resId = "R-" + ui.resSeq++
      D.reservations.push({ id: resId, guest: id, type, from, to, rate: Math.round(tot / n), guarantee: pay, status: "confirmee", channel: "Site direct", request: `Plan ${code}` })
      ch("direct").revenue += tot
      S.pickup[6]++
      enqueue(n)
      ui.ratBooked = `${resId} · ${T(type).label} du ${fd(from)} au ${fd(to)} · plan ${code} · ${money(tot)} payé par ${pay}. Confirmation e-mail et WhatsApp envoyée (simulée).`
      toast(`Réservation ${resId} confirmée`)
      render()
    },
  }

  HMS.module({
    code: "rat", group: "Ventes & clients", title: "Tarifs, inventaire et distribution", phase: "4-6", spec: "§6 RAT",
    screens: [
      { id: "rat-tarifs", label: "Tarifs et inventaire", view: views.tarifs },
      { id: "rat-distribution", label: "Distribution et canaux", view: views.distribution },
    ],
    actions,
  })
})()
