// modules/bi.js — Spec §20 Business Intelligence et reporting (BIR)
// Tableau de bord direction (occupation, ADR, RevPAR, TRevPAR, GOPPAR), tendances et pick-up, segments et canaux,
// bibliothèque de rapports (USALI, manager's report), planifications, couche sémantique, connecteurs. Chiffres d'exemple.
;(() => {
  const rnd = (i) => { const x = Math.sin(i * 78.233 + 1.7) * 43758.5453; return x - Math.floor(x) }
  const sellable = () => D.rooms.filter((r) => r.hk !== "hs").length
  const otb = (d) => D.reservations.filter((r) => ["confirmee", "arrivee"].includes(r.status) && r.from <= d && d < r.to)
  const k = (n) => (Math.abs(n) >= 1e6 ? (Math.round(n / 1e5) / 10).toLocaleString("fr-FR") + " M" : Math.round(n / 1000).toLocaleString("fr-FR") + " k")
  const sign = (n) => (n > 0 ? "+" : "") + pct(n)

  // ---------- Historique d'exemple : 30 jours jusqu'à la veille (jour hôtelier de référence, RG-BIR-03) ----------
  const ROOMS = 14
  const hist = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(today, i - 30), dow = day(d).getDay(), wk = dow >= 1 && dow <= 4
    const sold = Math.min(ROOMS - 1, Math.round((wk ? 9.5 : 7) + rnd(i) * 3 - 1))
    const adr = Math.round((55000 + rnd(i + 40) * 8000) / 100) * 100
    const room = sold * adr, fnb = Math.round(sold * (16000 + rnd(i + 80) * 9000)), other = Math.round(sold * (3000 + rnd(i + 120) * 3000))
    const total = room + fnb + other
    return { d, sold, avail: ROOMS, adr, room, fnb, other, total, gop: total * (0.33 + rnd(i + 160) * 0.08),
      lySold: Math.min(ROOMS, Math.round(sold + (rnd(i + 200) * 4 - 1.5))), lyAdr: Math.round(adr * (0.96 + rnd(i + 240) * 0.04)) }
  })
  const agg = (rows) => {
    const sold = rows.reduce((s, r) => s + r.sold, 0), avail = rows.reduce((s, r) => s + r.avail, 0)
    const room = rows.reduce((s, r) => s + r.room, 0), total = rows.reduce((s, r) => s + r.total, 0), gop = rows.reduce((s, r) => s + r.gop, 0)
    const lySold = rows.reduce((s, r) => s + r.lySold, 0), lyRoom = rows.reduce((s, r) => s + r.lySold * r.lyAdr, 0)
    return { sold, avail, occ: (sold / avail) * 100, adr: room / sold, revpar: room / avail, trevpar: total / avail, goppar: gop / avail, room, total, gop,
      lyOcc: (lySold / avail) * 100, lyAdr: lyRoom / lySold, lyRevpar: lyRoom / avail }
  }
  // Jour : calculé sur les réservations de data.js
  const tonight = () => {
    const list = otb(today), n = sellable(), room = list.reduce((s, r) => s + r.rate, 0)
    return { sold: list.length, avail: n, occ: (list.length / n) * 100, adr: list.length ? room / list.length : 0, revpar: room / n, room }
  }

  D.bir = {
    budget: { occ: 68, adr: 58000, revpar: 39500, trevpar: 58000, goppar: 21000 },
    segments: [
      { name: "Affaires individuels", rn: 98, adr: 61500 }, { name: "Loisirs", rn: 52, adr: 54000 }, { name: "Groupes et séminaires", rn: 34, adr: 49500 },
      { name: "Gouvernement et ONG", rn: 31, adr: 57000 }, { name: "Équipages", rn: 21, adr: 42000 },
    ],
    channels: [
      { name: "Direct (réception, téléphone)", rn: 84, cost: 0 }, { name: "Moteur de réservation", rn: 47, cost: 0.03 }, { name: "OTA (canal simulé)", rn: 63, cost: 0.17 },
      { name: "Agences et TMC", rn: 29, cost: 0.1 }, { name: "Contrats entreprises", rn: 13, cost: 0 },
    ],
    cpor: [ // coût par chambre occupée, par service (exemple)
      { label: "Hébergement (housekeeping, linge)", value: 9800 }, { label: "Réception", value: 4200 }, { label: "Maintenance et énergie", value: 6100 },
      { label: "Restauration (rapporté)", value: 3900 }, { label: "Administration", value: 5200 },
    ],
    market: { mpi: 104.2, ari: 97.8, rgi: 101.9 }, // ensemble concurrentiel simulé
    reports: [
      { id: "RPT-MGR", name: "Manager's report (flash quotidien)", cat: "Direction", desc: "Occupation, ADR, RevPAR, revenus du jour, mois et année, comparés au budget et à N-1." },
      { id: "RPT-USALI", name: "Compte de résultat USALI — Hébergement", cat: "Finance", desc: "Revenus et charges du département Hébergement au format USALI." },
      { id: "RPT-AD", name: "Arrivées et départs", cat: "Réception", desc: "Liste du jour hôtelier, VIP et demandes particulières." },
      { id: "RPT-OCC", name: "Occupation et prévisions", cat: "Revenue", desc: "Chambres vendues, en portefeuille et prévues sur 14 jours." },
      { id: "RPT-SEG", name: "Revenus par segment et canal", cat: "Revenue", desc: "Nuitées, ADR et revenus par segment de marché et canal." },
      { id: "RPT-AR", name: "Comptes clients (balance âgée)", cat: "Finance", desc: "Soldes des folios et comptes débiteurs par ancienneté." },
      { id: "RPT-HK", name: "Housekeeping", cat: "Opérations", desc: "Statut des chambres, attributions et chambres hors service." },
      { id: "RPT-ACC", name: "Accès et clés", cat: "Sécurité", desc: "Clés actives et révoquées, événements de porte." },
    ],
    runs: [
      { id: "EX-1", report: "RPT-MGR", at: addDays(today, -1) + " 07:00", by: "Planification", format: "PDF" },
      { id: "EX-2", report: "RPT-SEG", at: addDays(today, -2) + " 16:42", by: "Kouadio Brou", format: "Excel" },
    ],
    schedules: [
      { id: "SC-1", report: "RPT-MGR", freq: "Quotidien 07:00", to: "kouadio.brou@exemple.test", format: "PDF", next: addDays(today, 1), active: true },
      { id: "SC-2", report: "RPT-SEG", freq: "Hebdomadaire lundi 08:00", to: "estelle.yapi@exemple.test, kouadio.brou@exemple.test", format: "Excel", next: "2026-11-30", active: true },
      { id: "SC-3", report: "RPT-AR", freq: "Mensuel le 1er", to: "mariam.toure@exemple.test", format: "Excel", next: "2026-12-01", active: false },
    ],
    metrics: [
      ["occupation", "Taux d'occupation", "chambres vendues ÷ chambres disponibles", "jour hôtelier"],
      ["adr", "Prix moyen (ADR)", "revenu hébergement ÷ chambres vendues", "jour hôtelier"],
      ["revpar", "RevPAR", "revenu hébergement ÷ chambres disponibles", "jour hôtelier"],
      ["trevpar", "TRevPAR", "revenu total ÷ chambres disponibles", "jour hôtelier"],
      ["goppar", "GOPPAR", "résultat brut d'exploitation ÷ chambres disponibles", "mois"],
      ["cpor", "Coût par chambre occupée", "charges du service ÷ chambres vendues", "mois, par service"],
      ["mpi", "Indice de pénétration (MPI)", "occupation hôtel ÷ occupation marché × 100", "mois (données marché)"],
      ["ari", "Indice de prix (ARI)", "ADR hôtel ÷ ADR marché × 100", "mois (données marché)"],
      ["rgi", "Indice de RevPAR (RGI)", "RevPAR hôtel ÷ RevPAR marché × 100", "mois (données marché)"],
    ],
    connectors: [
      { id: "CN-1", name: "Power BI (connecteur simulé)", state: "actif", lastSync: "il y a 6 min", rls: "Établissement : Hôtel Exemple" },
      { id: "CN-2", name: "Tableau (connecteur simulé)", state: "inactif", lastSync: "—", rls: "—" },
      { id: "CN-3", name: "Export lakehouse (Parquet, simulé)", state: "actif", lastSync: "il y a 9 min", rls: "Données personnelles pseudonymisées" },
    ],
    views: [],
  }
  const B = D.bir
  ui.biPer = ui.biPer || "mtd"
  const REP = (id) => B.reports.find((r) => r.id === id)

  // ---------- Écrans ----------
  const views = {
    dash(p) {
      const tab = p[0] || "direction"
      return pageHead("Tableau de bord direction", `${D.hotel} · jour hôtelier du ${fd(today)}/${today.slice(0, 4)} · chiffres d'exemple (définitions USALI de la couche sémantique).`)
        + subtabs("bi-dash", [["direction", "Indicateurs clés"], ["tendances", "Tendances et pick-up"], ["segments", "Segments et canaux"], ["couts", "Coûts et marché"]], tab)
        + ({ direction, tendances, segments, couts }[tab] || direction)()
    },
    reports(p) {
      const tab = p[0] || "bibliotheque"
      return pageHead("Rapports", "Bibliothèque de rapports standards, exécutions, envois planifiés, couche sémantique et connecteurs vers les outils BI tiers. Exports simulés.")
        + subtabs("bi-rapports", [["bibliotheque", "Bibliothèque"], ["planifies", "Rapports planifiés"], ["indicateurs", "Indicateurs et vues"], ["connecteurs", "Connecteurs et données"]], tab)
        + ({ bibliotheque, planifies, indicateurs, connecteurs }[tab] || bibliotheque)(p)
    },
  }

  function direction() {
    const per = ui.biPer
    const t = tonight(), m = agg(hist.filter((h) => h.d.slice(0, 7) === today.slice(0, 7))), w = agg(hist.slice(-7))
    const a = per === "jour" ? null : per === "7j" ? w : m
    const tiles = a
      ? [kpi("Occupation", pct(a.occ), `N-1 ${sign(a.occ - a.lyOcc)} pts · budget ${B.budget.occ} %`),
        kpi("ADR", money(a.adr), `N-1 ${sign(((a.adr - a.lyAdr) / a.lyAdr) * 100)} · budget ${k(B.budget.adr)}`),
        kpi("RevPAR", money(a.revpar), `N-1 ${sign(((a.revpar - a.lyRevpar) / a.lyRevpar) * 100)} · budget ${k(B.budget.revpar)}`),
        kpi("TRevPAR", money(a.trevpar), `budget ${k(B.budget.trevpar)}`),
        kpi("GOPPAR", money(a.goppar), `budget ${k(B.budget.goppar)}`)]
      : [kpi("Occupation ce soir", pct(t.occ), `${t.sold} / ${t.avail} chambres vendables (réservations réelles)`),
        kpi("ADR ce soir", money(t.adr), "tarifs des réservations en portefeuille"),
        kpi("RevPAR ce soir", money(t.revpar), "revenu hébergement ÷ chambres vendables"),
        kpi("Arrivées / départs", `${arrivals().length} / ${departures().length}`, "jour hôtelier")]
    const ref = a || m
    return `${chips("biPer", { jour: "Ce soir", "7j": "7 derniers jours", mtd: "Mois en cours" })}
      <div class="grid">${tiles.join("")}</div>
      ${aiBox("Commentaire automatique des écarts", `Sur le mois, le RevPAR est à ${money(m.revpar)} (${sign(((m.revpar - B.budget.revpar) / B.budget.revpar) * 100)} vs budget). L'écart vient surtout de l'occupation (${pct(m.occ)} contre ${B.budget.occ} % prévus) ; l'ADR tient le budget grâce au segment Affaires. Le segment Groupes recule de 18 nuitées par rapport à N-1.`,
        btn("Demander au copilote", "go('aip-ia/copilote')", "ghost sm"))}
      <div class="cols">
        <section><h2>Comparaison budget et N-1 — ${per === "7j" ? "7 jours" : "mois en cours"}</h2>
          ${tbl(["Indicateur", "#Réalisé", "#Budget", "#N-1", "#Écart budget"], [
            ["Occupation", pct(ref.occ), B.budget.occ + " %", pct(ref.lyOcc), sign(ref.occ - B.budget.occ) + " pts"],
            ["ADR", money(ref.adr), money(B.budget.adr), money(ref.lyAdr), sign(((ref.adr - B.budget.adr) / B.budget.adr) * 100)],
            ["RevPAR", money(ref.revpar), money(B.budget.revpar), money(ref.lyRevpar), sign(((ref.revpar - B.budget.revpar) / B.budget.revpar) * 100)],
            ["TRevPAR", money(ref.trevpar), money(B.budget.trevpar), "—", sign(((ref.trevpar - B.budget.trevpar) / B.budget.trevpar) * 100)],
            ["GOPPAR", money(ref.goppar), money(B.budget.goppar), "—", sign(((ref.goppar - B.budget.goppar) / B.budget.goppar) * 100)],
          ])}</section>
        <section><h2>Revenus — ${per === "7j" ? "7 jours" : "mois en cours"}</h2>
          ${bars([{ label: "Hébergement", value: ref.room }, { label: "Restauration", value: hist.filter((h) => per === "7j" ? hist.slice(-7).includes(h) : h.d.slice(0, 7) === today.slice(0, 7)).reduce((s, h) => s + h.fnb, 0) },
            { label: "Autres (spa, blanchisserie…)", value: ref.total - ref.room - hist.filter((h) => per === "7j" ? hist.slice(-7).includes(h) : h.d.slice(0, 7) === today.slice(0, 7)).reduce((s, h) => s + h.fnb, 0) }, { label: "Résultat brut (GOP)", value: ref.gop }], k)}
          <p class="muted">Jour hôtelier de référence pour les indicateurs quotidiens (RG-BIR-03). Consolidation multi-établissements : un seul établissement dans ce tenant (EF-BIR-003).</p></section>
      </div>`
  }

  function tendances() {
    const occ = hist.map((h) => Math.round((h.sold / h.avail) * 100)), rp = hist.map((h) => Math.round(h.room / h.avail))
    const mean = occ.reduce((s, v) => s + v, 0) / occ.length
    const outlier = hist.map((h, i) => ({ h, v: occ[i] })).sort((a, b) => a.v - b.v)[0]
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i))
    const pick = days.map((d, i) => { const now = otb(d).length; const before = Math.max(0, now - Math.round(rnd(i + 300) * 2.4)); return { d, now, before, pu: now - before } })
    return `<h2>Occupation — 30 derniers jours</h2>
      ${card("", columns(hist.map((h) => fd(h.d)), occ, (v) => v + " %"))}
      <h2>RevPAR — 30 derniers jours</h2>
      ${card("", columns(hist.map((h) => fd(h.d)), rp, (v) => k(v)))}
      ${aiBox("Détection d'anomalies", `Le ${fd(outlier.h.d)} sort de la tendance : occupation ${outlier.v} % contre ${Math.round(mean)} % en moyenne sur 30 jours (−${Math.round(mean - outlier.v)} pts). Cause probable : annulation d'un groupe la veille (à confirmer).`, btn("Ouvrir le rapport d'occupation", "go('bi-rapports/bibliotheque/RPT-OCC')", "ghost sm"))}
      <h2>Pick-up — 14 prochains jours</h2>
      <p class="muted">Chambres en portefeuille aujourd'hui (réservations de la maquette) comparées à il y a 7 jours (historique d'exemple).</p>
      ${card("", columns(pick.map((x) => fd(x.d)), pick.map((x) => x.pu), (v) => "+" + v))}
      ${tbl(["Date", "#En portefeuille", "#Il y a 7 jours", "#Pick-up", "#Occupation en portefeuille"], pick.map((x) => [`${esc(wd(x.d))} ${fd(x.d)}`, x.now, x.before, "+" + x.pu, pct((x.now / sellable()) * 100)]))}`
  }

  function segments() {
    const totalRn = B.segments.reduce((s, x) => s + x.rn, 0), totalCh = B.channels.reduce((s, x) => s + x.rn, 0)
    return `<div class="cols">
        <section><h2>Nuitées par segment — mois</h2>${bars(B.segments.map((s) => ({ label: s.name, value: s.rn })), (v) => v + " n.")}</section>
        <section><h2>Nuitées par canal — mois</h2>${bars(B.channels.map((s) => ({ label: s.name, value: s.rn })), (v) => v + " n.")}</section>
      </div>
      <h2>Détail par segment</h2>
      ${tbl(["Segment", "#Nuitées", "#Part", "#ADR", "#Revenu hébergement"], B.segments.map((s) => [esc(s.name), s.rn, pct((s.rn / totalRn) * 100), money(s.adr), money(s.rn * s.adr)]), "",
        `<tfoot><tr><td>Total</td><td class="num">${totalRn}</td><td class="num">100 %</td><td class="num">${money(B.segments.reduce((s, x) => s + x.rn * x.adr, 0) / totalRn)}</td><td class="num">${money(B.segments.reduce((s, x) => s + x.rn * x.adr, 0))}</td></tr></tfoot>`)}
      <h2>Détail par canal</h2>
      ${tbl(["Canal", "#Nuitées", "#Part", "#Coût d'acquisition"], B.channels.map((c) => [esc(c.name), c.rn, pct((c.rn / totalCh) * 100), c.cost ? pct(c.cost * 100) + " du revenu" : "—"]))}
      <p class="muted">Données clients pseudonymisées dans l'entrepôt (RG-BIR-02). Chiffres d'exemple.</p>`
  }

  function couts() {
    const mk = B.market
    return `<div class="cols">
        <section><h2>Coût par chambre occupée — par service</h2>${bars(B.cpor, money)}
          <p class="muted">Total : ${money(B.cpor.reduce((s, x) => s + x.value, 0))} par chambre occupée (mois, exemple).</p></section>
        <section><h2>Indices de pénétration</h2>
          <div class="grid">${kpi("MPI", mk.mpi.toLocaleString("fr-FR"), "occupation vs marché")}${kpi("ARI", mk.ari.toLocaleString("fr-FR"), "ADR vs marché")}${kpi("RGI", mk.rgi.toLocaleString("fr-FR"), "RevPAR vs marché")}</div>
          <p class="muted">Ensemble concurrentiel de 5 hôtels d'Abidjan, données de marché simulées (EF-BIR-010, « si disponibles »). 100 = part équitable.</p></section>
      </div>`
  }

  function bibliotheque(p) {
    const r = REP(p[1]) || B.reports[0], cats = [...new Set(B.reports.map((x) => x.cat))]
    const f = ui.biRun?.id === r.id ? ui.biRun : null
    return split(`${cats.map((c) => `<h3>${esc(c)}</h3>${listItems(B.reports.filter((x) => x.cat === c).map((x) => ({ id: x.id, title: x.name })), r.id, "bi-rapports/bibliotheque")}`).join("")}`,
      `<div class="card">
        <div class="row between"><span class="big">${esc(r.name)}</span>${badge(r.cat, "outline")}</div>
        <p class="muted">${esc(r.desc)} · EF-BIR-001</p>
        ${form([field("bi-from", "Du", input("bi-from", f?.from || today.slice(0, 8) + "01", `type="date"`)), field("bi-to", "Au", input("bi-to", f?.to || addDays(today, -1), `type="date"`)),
          field("bi-seg", "Segment", select("bi-seg", ["Tous", ...B.segments.map((s) => s.name)], f?.seg || "Tous")),
          field("bi-cmp", "Comparer à", select("bi-cmp", ["Budget", "N-1", "Budget et N-1"], f?.cmp || "Budget et N-1"))])}
        <div id="bi-err"></div>
        <div class="row" style="margin-top:12px">${btn("Exécuter", `A.bir.run(${q(r.id)})`)}${btn("Exporter PDF", `A.bir.exportRep(${q(r.id)},'PDF')`, "ghost")}${btn("Exporter Excel", `A.bir.exportRep(${q(r.id)},'Excel')`, "ghost")}${btn("Planifier", `A.bir.prefill(${q(r.id)})`, "ghost")}</div>
        ${f ? `<h3>Aperçu — ${fd(f.from)} au ${fd(f.to)}${f.seg !== "Tous" ? " · " + esc(f.seg) : ""}</h3>${preview(r.id, f)}` : `<p class="muted" style="margin-top:14px">Choisissez une période puis « Exécuter » pour afficher l'aperçu.</p>`}
      </div>
      <h3>Dernières exécutions</h3>
      ${tbl(["Rapport", "Date", "Par", "Format"], B.runs.slice(0, 6).map((x) => [esc(REP(x.report).name), `${fd(x.at.slice(0, 10))} ${esc(x.at.slice(11))}`, esc(x.by), esc(x.format)]))}`)
  }
  function preview(id, f) {
    const rows = hist.filter((h) => h.d >= f.from && h.d <= f.to)
    if (!rows.length && !["RPT-AD", "RPT-HK", "RPT-ACC", "RPT-AR", "RPT-OCC"].includes(id)) return `<p class="muted">Aucune donnée sur cette période (historique d'exemple : 30 derniers jours).</p>`
    const a = rows.length ? agg(rows) : null, segK = f.seg === "Tous" ? 1 : (B.segments.find((s) => s.name === f.seg)?.rn || 0) / B.segments.reduce((s, x) => s + x.rn, 0)
    if (id === "RPT-MGR") { const t = tonight()
      return tbl(["Indicateur", "#Jour", "#Période", "#Budget", "#N-1"], [
        ["Chambres vendues", t.sold, Math.round(a.sold * segK), "—", "—"], ["Occupation", pct(t.occ), pct(a.occ), B.budget.occ + " %", pct(a.lyOcc)],
        ["ADR", money(t.adr), money(a.adr), money(B.budget.adr), money(a.lyAdr)], ["RevPAR", money(t.revpar), money(a.revpar), money(B.budget.revpar), money(a.lyRevpar)],
        ["Revenu hébergement", money(t.room), money(a.room * segK), "—", "—"], ["Revenu total", "—", money(a.total * segK), "—", "—"]]) }
    if (id === "RPT-USALI") {
      const rev = a.room * segK, pay = rev * 0.21, other = rev * 0.12, comm = rev * 0.06
      return tbl(["Hébergement (USALI)", "#Montant", "#% revenu"], [["Revenus des chambres", money(rev), "100 %"], ["Salaires et charges sociales", money(pay), "21 %"],
        ["Commissions (canaux)", money(comm), "6 %"], ["Autres charges (linge, produits d'accueil, énergie)", money(other), "12 %"]], "",
        `<tfoot><tr><td>Résultat départemental</td><td class="num">${money(rev - pay - other - comm)}</td><td class="num">61 %</td></tr></tfoot>`) }
    if (id === "RPT-AD") return tbl(["Mouvement", "Client", "Réf.", "Type"], [...arrivals().map((r) => ["Arrivée", esc(G(r.guest).name) + vip(G(r.guest)), esc(r.id), esc(T(r.type).label)]), ...departures().map((r) => ["Départ", esc(G(r.guest).name), esc(r.id), esc(r.room || "—")])])
    if (id === "RPT-OCC") return tbl(["Date", "#En portefeuille", "#Occupation"], Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => [fd(d), otb(d).length, pct((otb(d).length / sellable()) * 100)]))
    if (id === "RPT-SEG") return tbl(["Segment", "#Nuitées", "#Revenu"], B.segments.filter((s) => f.seg === "Tous" || s.name === f.seg).map((s) => [esc(s.name), s.rn, money(s.rn * s.adr)]))
    if (id === "RPT-AR") return tbl(["Folio", "Client", "#Solde", "Ancienneté"], inHouse().map((r) => [esc(r.id), esc(G(r.guest).name), money(folio(r).balance), nights(r.from, today) + " j"]))
    if (id === "RPT-HK") return tbl(["Statut", "#Chambres"], Object.entries(HK).map(([kk, [l]]) => [esc(l), D.rooms.filter((r) => r.hk === kk).length]))
    return tbl(["Chambre", "Client", "Clé"], D.reservations.filter((r) => r.key).map((r) => [esc(r.room), esc(G(r.guest).name), badge(r.key === "active" ? "Active" : "Révoquée", r.key === "active" ? "on" : "outline")]))
  }

  function planifies() {
    const pre = ui.biPrefill || B.reports[0].id
    return `${tbl(["Rapport", "Fréquence", "Destinataires", "Format", "Prochain envoi", "Statut", ""], B.schedules.map((s) => [
        `<strong>${esc(REP(s.report).name)}</strong>`, esc(s.freq), esc(s.to), esc(s.format), s.active ? fd(s.next) : "—", s.active ? badge("Actif", "on") : badge("Suspendu", "outline"),
        `<span class="row" style="flex-wrap:nowrap">${btn(s.active ? "Suspendre" : "Activer", `A.bir.toggleSched(${q(s.id)})`, "ghost sm")}${btn("Envoyer maintenant", `A.bir.sendNow(${q(s.id)})`, "ghost sm")}</span>`]))}
      <h2>Nouvelle planification</h2>
      <div class="card">${form([
        field("bi-s-rep", "Rapport", select("bi-s-rep", B.reports.map((r) => [r.id, r.name]), pre)),
        field("bi-s-freq", "Fréquence", select("bi-s-freq", ["Quotidien 07:00", "Hebdomadaire lundi 08:00", "Mensuel le 1er"], "Hebdomadaire lundi 08:00")),
        field("bi-s-fmt", "Format", select("bi-s-fmt", ["PDF", "Excel"], "PDF")),
        field("bi-s-to", "Destinataires (séparés par des virgules)", input("bi-s-to", "", `placeholder="prenom.nom@exemple.test"`), "full"),
        `<div class="full" id="bi-s-err"></div>`,
        `<div class="full">${btn("Planifier l'envoi", "A.bir.addSched()")}</div>`])}
        <p class="muted">Envoi par e-mail simulé (EF-BIR-006). Les destinataires ne reçoivent que les données de leurs droits (sécurité au niveau ligne, EF-BIR-008).</p></div>`
  }

  function indicateurs() {
    const v = ui.biView
    return `<h2>Couche sémantique</h2>
      <p class="muted">Une seule définition par indicateur, utilisée par tous les tableaux de bord, rapports et par le copilote (RG-BIR-01, EF-BIR-005).</p>
      ${tbl(["Code", "Indicateur", "Formule", "Granularité"], B.metrics.map(([c, n, f, g]) => [`<code>${esc(c)}</code>`, esc(n), esc(f), esc(g)]))}
      <h2>Construire une vue</h2>
      <div class="card">${form([
        field("bi-v-m", "Indicateur", select("bi-v-m", [["rn", "Nuitées"], ["rev", "Revenu hébergement"], ["adr", "ADR"]], v?.m || "rev")),
        field("bi-v-d", "Dimension", select("bi-v-d", [["segment", "Segment"], ["canal", "Canal"], ["semaine", "Semaine"]], v?.d || "segment")),
        field("bi-v-n", "Nom de la vue", input("bi-v-n", v?.name || "", `placeholder="Ex. Revenu par segment"`)),
        `<div style="align-self:end">${btn("Afficher", "A.bir.buildView()")}</div>`])}
        ${v ? `<div style="margin-top:14px">${bars(viewData(v), v.m === "rn" ? (x) => x + " n." : money)}</div>
          <div class="row" style="margin-top:10px">${btn("Enregistrer la vue", "A.bir.saveView()", "ghost sm")}</div>` : ""}
      </div>
      ${B.views.length ? `<h3>Mes vues enregistrées</h3>${tbl(["Vue", "Indicateur", "Dimension", ""], B.views.map((x, i) => [esc(x.name), esc(x.m), esc(x.d), btn("Ouvrir", `A.bir.openView(${i})`, "ghost sm")]))}` : ""}
      ${aiBox("Requête en langage naturel", "« Quel segment a le meilleur ADR ce mois ? » → Affaires individuels, 61 500 FCFA (requête : metric=adr · dimension=segment · période=MTD).", btn("Poser une question au copilote", "go('aip-ia/copilote')", "ghost sm"))}`
  }
  function viewData(v) {
    if (v.d === "semaine") {
      const weeks = [0, 1, 2, 3].map((w) => hist.slice(w * 7 + 2, w * 7 + 9))
      return weeks.map((rows, i) => { const a = agg(rows); return { label: `Semaine ${i + 1}`, value: Math.round(v.m === "rn" ? a.sold : v.m === "adr" ? a.adr : a.room) } })
    }
    const src = v.d === "segment" ? B.segments.map((s) => ({ ...s })) : B.channels.map((c, i) => ({ ...c, adr: 52000 + i * 2500 }))
    return src.map((s) => ({ label: s.name, value: v.m === "rn" ? s.rn : v.m === "adr" ? s.adr : s.rn * s.adr }))
  }

  function connecteurs() {
    return `<div class="grid">
        ${kpi("Fraîcheur des données", "9 min", "dernière alimentation du lakehouse (cible < 15 min)")}
        ${kpi("Événements intégrés (24 h)", "18 420", "CDC et événements métier (simulé)")}
        ${kpi("Temps du tableau de bord", "0,8 s", "p95 simulé (cible < 3 s)")}
      </div>
      <h2>Connecteurs BI tiers</h2>
      ${tbl(["Connecteur", "État", "Dernière synchro", "Filtre de sécurité (ligne)", ""], B.connectors.map((c) => [esc(c.name), c.state === "actif" ? badge("Actif", "on") : badge("Inactif", "outline"), esc(c.lastSync), esc(c.rls),
        `<span class="row" style="flex-wrap:nowrap">${btn(c.state === "actif" ? "Désactiver" : "Activer", `A.bir.toggleConn(${q(c.id)})`, "ghost sm")}${c.state === "actif" ? btn("Générer un jeton", `A.bir.token(${q(c.id)})`, "ghost sm") : ""}</span>`]))}
      ${ui.biToken ? `<div class="card" style="margin-top:14px"><strong>Jeton de lecture (exemple, non fonctionnel)</strong><p><code>${esc(ui.biToken)}</code></p><p class="muted">Valable 90 jours, lecture seule, limité à l'établissement Hôtel Exemple. Ce jeton est fictif.</p></div>` : ""}
      <p class="muted">Export vers Power BI ou Tableau via connecteurs sécurisés (EF-BIR-007). Données personnelles pseudonymisées (RG-BIR-02).</p>`
  }

  // ---------- Actions ----------
  const readFilters = (id) => {
    const from = val("bi-from"), to = val("bi-to")
    if (!from || !to || to < from) { $("#bi-err").innerHTML = `<p class="err">Indiquez une période valide (date de fin après la date de début).</p>`; return null }
    return { id, from, to, seg: val("bi-seg"), cmp: val("bi-cmp") }
  }
  const actions = {
    run(id) { const f = readFilters(id); if (!f) return; ui.biRun = f; B.runs.unshift({ id: uid("EX"), report: id, at: today + " " + new Date().toTimeString().slice(0, 5), by: "Kouadio Brou", format: "Écran" }); toast("Rapport exécuté (bir.report.generated)"); render() },
    exportRep(id, fmt) { const f = readFilters(id); if (!f) return; ui.biRun = f; B.runs.unshift({ id: uid("EX"), report: id, at: today + " " + new Date().toTimeString().slice(0, 5), by: "Kouadio Brou", format: fmt }); toast(`Export ${fmt} généré : ${REP(id).name} (simulé, aucun fichier)`); render() },
    prefill(id) { ui.biPrefill = id; go("bi-rapports/planifies") },
    toggleSched(id) { const s = B.schedules.find((x) => x.id === id); s.active = !s.active; toast(s.active ? "Planification activée" : "Planification suspendue"); render() },
    sendNow(id) { const s = B.schedules.find((x) => x.id === id); B.runs.unshift({ id: uid("EX"), report: s.report, at: today + " " + new Date().toTimeString().slice(0, 5), by: "Envoi manuel", format: s.format }); toast(`${REP(s.report).name} envoyé à ${s.to} (e-mail simulé)`) },
    addSched() {
      const to = val("bi-s-to"), err = (m) => ($("#bi-s-err").innerHTML = `<p class="err">${esc(m)}</p>`)
      const list = to.split(",").map((x) => x.trim()).filter(Boolean)
      if (!list.length) return err("Ajoutez au moins un destinataire.")
      const bad = list.find((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))
      if (bad) return err(`Adresse e-mail invalide : ${bad}`)
      const freq = val("bi-s-freq")
      B.schedules.push({ id: uid("SC"), report: val("bi-s-rep"), freq, to: list.join(", "), format: val("bi-s-fmt"), next: freq.startsWith("Quotidien") ? addDays(today, 1) : freq.startsWith("Hebdo") ? "2026-11-30" : "2026-12-01", active: true })
      ui.biPrefill = null
      toast("Envoi planifié"); render()
    },
    buildView() { ui.biView = { m: val("bi-v-m"), d: val("bi-v-d"), name: val("bi-v-n") || "Vue sans nom" }; render() },
    saveView() { B.views.push({ ...ui.biView }); toast(`Vue « ${ui.biView.name} » enregistrée`); render() },
    openView(i) { ui.biView = { ...B.views[i] }; render() },
    toggleConn(id) { const c = B.connectors.find((x) => x.id === id); c.state = c.state === "actif" ? "inactif" : "actif"; c.lastSync = c.state === "actif" ? "à l'instant" : "—"; c.rls = c.state === "actif" ? "Établissement : Hôtel Exemple" : "—"; if (c.state !== "actif") ui.biToken = null; toast(`${c.name} : ${c.state}`); render() },
    token(id) { ui.biToken = "exemple_" + id.toLowerCase() + "_" + Math.random().toString(36).slice(2, 10); toast("Jeton fictif généré"); render() },
  }

  HMS.module({
    code: "bir", group: "Pilotage & IA", title: "Business Intelligence", phase: "—", spec: "§20 BIR",
    screens: [
      { id: "bi-dash", label: "Tableau de bord direction", view: views.dash },
      { id: "bi-rapports", label: "Rapports", view: views.reports },
    ],
    actions,
  })
})()
