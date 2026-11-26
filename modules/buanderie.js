// modules/buanderie.js — Spec §17 Buanderie et gestion du linge (BLN)
// Linge hôtelier (stocks par lieu, pars, besoin du jour, distribution), production (lots, machines),
// sous-traitance, pertes et réformes, uniformes, pressing client imputé au folio, KPI et IA.
;(() => {
  const NOW = today + " 10:30"
  const dt = (s) => (s ? fd(s.slice(0, 10)) + " " + s.slice(11, 16) : "—")
  const muted = (t) => `<span class="muted" style="font-size:12px">${esc(t)}</span>`
  const room = (no) => D.rooms.find((r) => r.no === no)

  // ---------- Données d'exemple ----------
  D.bln = {
    items: [
      { code: "DRP", label: "Drap 2 places", cat: "Chambre", kg: 0.9, cost: 9500, maxWash: 200 },
      { code: "HSC", label: "Housse de couette", cat: "Chambre", kg: 1.3, cost: 16000, maxWash: 180 },
      { code: "TAI", label: "Taie d'oreiller", cat: "Chambre", kg: 0.2, cost: 2500, maxWash: 200 },
      { code: "SBN", label: "Serviette de bain", cat: "Chambre", kg: 0.6, cost: 6500, maxWash: 150 },
      { code: "SMN", label: "Serviette de main", cat: "Chambre", kg: 0.25, cost: 3000, maxWash: 150 },
      { code: "PGN", label: "Peignoir", cat: "Chambre", kg: 1.1, cost: 18000, maxWash: 120 },
      { code: "NAP", label: "Nappe ronde", cat: "Restauration", kg: 1.0, cost: 14000, maxWash: 150 },
      { code: "STB", label: "Serviette de table", cat: "Restauration", kg: 0.1, cost: 1500, maxWash: 150 },
      { code: "SSP", label: "Drap de massage spa", cat: "Spa", kg: 0.7, cost: 8000, maxWash: 160 },
    ],
    // dotation d'une chambre selon la tâche (départ = changement complet, recouche = serviettes)
    kit: { "Départ": { DRP: 2, HSC: 1, TAI: 2, SBN: 2, SMN: 2 }, "Recouche": { SBN: 2, SMN: 2 } },
    locations: ["Lingerie centrale", "Office étage 1", "Office étage 2", "Office étage 3", "Restaurant", "Spa", "En lavage", "Chez le prestataire", "Réserve neuve"],
    // stock propre par lieu et par article ; par = dotation cible, min = seuil de réassort (RG-BLN-06)
    stock: {
      "Lingerie centrale": { DRP: 120, HSC: 46, TAI: 140, SBN: 110, SMN: 130, PGN: 30, NAP: 40, STB: 260, SSP: 30 },
      "Office étage 1": { DRP: 12, HSC: 5, TAI: 12, SBN: 10, SMN: 14 },
      "Office étage 2": { DRP: 6, HSC: 3, TAI: 8, SBN: 6, SMN: 9 },
      "Office étage 3": { DRP: 10, HSC: 4, TAI: 10, SBN: 4, SMN: 10, PGN: 8 },
      "Restaurant": { NAP: 22, STB: 140 },
      "Spa": { SSP: 14, SBN: 20 },
      "En lavage": { DRP: 34, HSC: 12, TAI: 40, SBN: 46, SMN: 38, NAP: 12, STB: 90 },
      "Chez le prestataire": { PGN: 18, NAP: 10 },
      "Réserve neuve": { DRP: 40, SBN: 60, TAI: 50 },
    },
    par: { "Office étage 1": { DRP: 14, HSC: 6, TAI: 14, SBN: 14, SMN: 14 }, "Office étage 2": { DRP: 14, HSC: 6, TAI: 14, SBN: 14, SMN: 14 }, "Office étage 3": { DRP: 12, HSC: 5, TAI: 12, SBN: 12, SMN: 12, PGN: 8 }, "Restaurant": { NAP: 30, STB: 160 }, "Spa": { SSP: 20, SBN: 20 } },
    collect: [
      { date: "2026-11-26 07:30", loc: "Office étage 1", pcs: 26, kg: 14.2, back: 0 },
      { date: "2026-11-26 07:45", loc: "Office étage 2", pcs: 31, kg: 17.0, back: 0 },
      { date: "2026-11-25 22:10", loc: "Restaurant", pcs: 118, kg: 19.5, back: 114 },
      { date: "2026-11-25 07:40", loc: "Office étage 3", pcs: 22, kg: 12.4, back: 22 },
    ],
    machines: [
      { id: "LAV-1", type: "Laveuse", cap: 23, state: "en_cycle", kwh: 0 },
      { id: "LAV-2", type: "Laveuse", cap: 13, state: "disponible", kwh: 0 },
      { id: "SEC-1", type: "Séchoir", cap: 25, state: "disponible", kwh: 0 },
      { id: "CAL-1", type: "Calandre", cap: 0, state: "maintenance", note: "Courroie à remplacer — ordre de travail en cours (maintenance)" },
    ],
    programs: [
      { id: "P60", label: "Draps blancs 60 °C", min: 55, litres: 9, kwh: 0.18, chem: "Lessive 18 ml/kg + oxygéné 6 ml/kg" },
      { id: "P40", label: "Éponge 40 °C", min: 50, litres: 10, kwh: 0.14, chem: "Lessive 20 ml/kg + adoucissant 5 ml/kg" },
      { id: "PNA", label: "Nappage détachage 60 °C", min: 65, litres: 11, kwh: 0.2, chem: "Lessive 22 ml/kg + détachant 8 ml/kg" },
      { id: "PDL", label: "Délicat 30 °C", min: 40, litres: 12, kwh: 0.09, chem: "Lessive douce 15 ml/kg" },
    ],
    // résultat : conforme | relaver | tache | reforme
    batches: [
      { id: "LOT-5530", machine: "LAV-1", prog: "P60", kg: 21, op: "Aminata Coulibaly", start: "2026-11-26 09:50", status: "en_cours" },
      { id: "LOT-5529", machine: "LAV-2", prog: "P40", kg: 12, op: "Yao Gbané", start: "2026-11-26 08:40", end: "2026-11-26 09:30", status: "termine", result: "conforme" },
      { id: "LOT-5528", machine: "LAV-1", prog: "PNA", kg: 18, op: "Aminata Coulibaly", start: "2026-11-26 07:30", end: "2026-11-26 08:35", status: "termine", result: "relaver" },
      { id: "LOT-5527", machine: "LAV-1", prog: "P60", kg: 22, op: "Yao Gbané", start: "2026-11-25 15:10", end: "2026-11-25 16:05", status: "termine", result: "conforme" },
      { id: "LOT-5526", machine: "LAV-2", prog: "P40", kg: 13, op: "Yao Gbané", start: "2026-11-25 14:00", end: "2026-11-25 14:50", status: "termine", result: "conforme" },
      { id: "LOT-5525", machine: "LAV-1", prog: "P60", kg: 20, op: "Aminata Coulibaly", start: "2026-11-25 09:00", end: "2026-11-25 09:55", status: "termine", result: "tache" },
    ],
    // sous-traitance : statut envoye | controle | litige
    shipments: [
      { id: "ENV-208", provider: "Blanchisserie Akwaba Exemple", sent: "2026-11-24", due: "2026-11-27", lines: { PGN: [18, null], NAP: [10, null] }, invoice: 52000, status: "envoye" },
      { id: "ENV-207", provider: "Blanchisserie Akwaba Exemple", sent: "2026-11-20", due: "2026-11-23", lines: { PGN: [20, 20], NAP: [12, 11] }, invoice: 61000, status: "litige" },
      { id: "ENV-206", provider: "Blanchisserie Akwaba Exemple", sent: "2026-11-16", due: "2026-11-19", lines: { PGN: [16, 16], SSP: [24, 24] }, invoice: 58000, status: "controle", paid: true },
    ],
    tolerance: 1, // % d'écart toléré au comptage (RG-BLN-04)
    losses: [
      { date: "2026-11-25", item: "SBN", qty: 3, reason: "Réforme (usure)", loc: "Lingerie centrale" },
      { date: "2026-11-24", item: "PGN", qty: 1, reason: "Perte / vol", loc: "Office étage 3" },
      { date: "2026-11-22", item: "NAP", qty: 2, reason: "Tache irrécupérable", loc: "Restaurant" },
      { date: "2026-11-18", item: "DRP", qty: 6, reason: "Nombre de lavages maximal atteint", loc: "Lingerie centrale" },
      { date: "2026-11-12", item: "SMN", qty: 4, reason: "Perte / vol", loc: "Office étage 2" },
    ],
    // pièces suivies RFID (simulé) proches du nombre maximal de lavages (RG-BLN-05)
    worn: [{ item: "DRP", tag: "RFID ••41A2", washes: 198 }, { item: "DRP", tag: "RFID ••41B7", washes: 200 }, { item: "SBN", tag: "RFID ••52C1", washes: 150 }],
    uniforms: [
      { emp: "Christelle Assi", dept: "Réception", items: [["Veste", "M", 2], ["Chemise", "M", 4]], issued: "2026-02-01", status: "actif" },
      { emp: "Konan Séka", dept: "Restaurant", items: [["Tablier", "U", 3], ["Chemise", "L", 3]], issued: "2026-04-15", status: "actif" },
      { emp: "Awa Diabaté", dept: "Étages", items: [["Tunique", "S", 3]], issued: "2025-11-03", status: "a_restituer", leave: "2026-11-30" },
      { emp: "N'Dri Gnahoré", dept: "Cuisine", items: [["Veste de cuisine", "XL", 3], ["Pantalon", "XL", 2]], issued: "2026-06-10", status: "actif" },
    ],
    // pressing client : tarifs TTC (TVA 18 % incluse, exemple) ; express : +50 % si délai < 4 h (RG-BLN-03)
    prices: [
      { art: "Chemise", lavage: 2000, repassage: 1000, sec: 3500 },
      { art: "Pantalon", lavage: 2500, repassage: 1200, sec: 4000 },
      { art: "Robe", lavage: 3500, repassage: 2000, sec: 6000 },
      { art: "Costume (2 pièces)", lavage: 0, repassage: 3500, sec: 9000 },
      { art: "Boubou / tenue traditionnelle", lavage: 4000, repassage: 2500, sec: 7500 },
    ],
    expressHours: 4,
    expressRate: 0.5,
    // statut : prise | traitement | prete | livree
    orders: [
      { id: "PR-0412", res: "R-2044", lines: [{ art: "Chemise", svc: "lavage", qty: 3 }], express: false, taken: "2026-11-25 08:30", promised: "2026-11-25 18:00", delivered: "2026-11-25 17:10", status: "livree", charged: true, amount: 4500 },
      { id: "PR-0418", res: "R-2048", lines: [{ art: "Costume (2 pièces)", svc: "sec", qty: 1 }, { art: "Chemise", svc: "repassage", qty: 2 }], express: false, taken: "2026-11-26 07:50", promised: "2026-11-26 19:00", status: "traitement" },
      { id: "PR-0419", res: "R-2047", lines: [{ art: "Pantalon", svc: "lavage", qty: 2 }], express: true, taken: "2026-11-26 09:15", promised: "2026-11-26 12:00", status: "prise" },
    ],
    claims: [],
    seq: { pr: 420, lot: 5531, env: 209 },
  }
  const B = D.bln
  const IT = (c) => B.items.find((i) => i.code === c)
  const MA = (id) => B.machines.find((m) => m.id === id)
  const PG = (id) => B.programs.find((p) => p.id === id)
  const PO = (id) => B.orders.find((o) => o.id === id)
  const SVC = { lavage: "Lavage", repassage: "Repassage", sec: "Nettoyage à sec" }
  const OST = { prise: ["Prise", ""], traitement: ["En traitement", "outline"], prete: ["Prête", "on"], livree: ["Livrée", "dark"] }
  const RES = { conforme: ["Conforme", "on"], relaver: ["À relaver", "outline"], tache: ["Taché", ""], reforme: ["Réformé", "dark"] }
  const MST = { disponible: ["Disponible", "on"], en_cycle: ["En cycle", "outline"], maintenance: ["Maintenance", "dark"] }
  const b2 = (m, k) => badge(m[k][0], m[k][1])
  const qty = (loc, c) => (B.stock[loc] || {})[c] || 0
  const unitPrice = (art, svc) => (B.prices.find((p) => p.art === art) || {})[svc] || 0
  const orderAmount = (o) => Math.round(o.lines.reduce((s, l) => s + unitPrice(l.art, l.svc) * l.qty, 0) * (o.express ? 1 + B.expressRate : 1))
  const lossValue = (l) => l.qty * IT(l.item).cost
  const offices = ["Office étage 1", "Office étage 2", "Office étage 3"]

  // EF-BLN-003 : besoin du jour par étage depuis les départs et recouches
  const requirement = () => {
    const need = Object.fromEntries(offices.map((o) => [o, {}]))
    const add = (floor, kind) => Object.entries(B.kit[kind]).forEach(([c, n]) => { const o = need["Office étage " + floor]; o[c] = (o[c] || 0) + n })
    inHouse().forEach((r) => add(room(r.room).floor, r.to === today ? "Départ" : "Recouche"))
    D.rooms.filter((x) => x.hk === "sale" && !occupant(x.no)).forEach((x) => add(x.floor, "Départ"))
    return need
  }

  // ---------- Écran 1 : Linge et buanderie ----------
  function linge(p) {
    const tab = p[0] || "stocks"
    const inUse = Object.values(B.stock).reduce((s, l) => s + Object.values(l).reduce((t, n) => t + n, 0), 0)
    const below = offices.flatMap((o) => Object.keys(B.par[o]).filter((c) => qty(o, c) < Math.ceil(B.par[o][c] * 0.6)))
    return pageHead("Linge et buanderie", "Stocks et dotations par lieu, besoin du jour, production interne, sous-traitance, pertes et uniformes. Données d'exemple ; compteurs et RFID simulés.")
      + cards([kpi("Pièces en circulation", inUse.toLocaleString("fr-FR"), "tous lieux"), kpi("Lots en cours", B.batches.filter((b) => b.status === "en_cours").length, `${B.machines.filter((m) => m.state === "disponible").length} machine(s) disponible(s)`),
        kpi("Offices sous le minimum", below.length, "réassort à servir"), kpi("Pertes du mois", money(B.losses.filter((l) => l.date >= "2026-11-01").reduce((s, l) => s + lossValue(l), 0)), "valorisées au coût")])
      + subtabs("bln-linge", [["stocks", "Stocks et pars"], ["besoin", "Besoin du jour"], ["production", "Production"], ["soustraitance", "Sous-traitance"], ["pertes", "Pertes et réformes"], ["uniformes", "Uniformes"], ["kpi", "Indicateurs"]], tab)
      + ({ stocks: tabStock, besoin: tabNeed, production: tabProd, soustraitance: tabOut, pertes: tabLoss, uniformes: tabUniforms, kpi: tabKpi }[tab] || tabStock)(p.slice(1))
  }

  function tabStock() {
    const cols = B.items.map((i) => i.code)
    return `<p class="muted">Stock propre par lieu ; entre parenthèses la dotation cible (par). En gras : sous 60 % du par, ce qui déclenche une demande de réassort ${muted("EF-BLN-002 · RG-BLN-06")}</p>`
      + `<div class="tablewrap"><table><thead><tr><th>Lieu</th>${B.items.map((i) => `<th class="num" title="${esc(i.label)}">${esc(i.label)}</th>`).join("")}</tr></thead><tbody>`
      + B.locations.map((loc) => `<tr><td>${esc(loc)}</td>${cols.map((c) => {
        const n = qty(loc, c), par = B.par[loc] && B.par[loc][c]
        if (!n && !par) return `<td class="num muted">—</td>`
        const low = par && n < Math.ceil(par * 0.6)
        return `<td class="num">${low ? `<strong>${n}</strong>` : n}${par ? ` <span class="muted">(${par})</span>` : ""}</td>`
      }).join("")}</tr>`).join("")
      + `<tr><td><strong>Total</strong></td>${cols.map((c) => `<td class="num"><strong>${B.locations.reduce((s, l) => s + qty(l, c), 0)}</strong></td>`).join("")}</tr></tbody></table></div>`
      + `<h2>Collecte du linge sale et retour propre ${muted("EF-BLN-004")}</h2>`
      + tbl(["Collecte", "Lieu", "#Pièces sorties", "#Poids", "#Rentrées propres", "Écart"], B.collect.map((c, i) => [dt(c.date), esc(c.loc), c.pcs, c.kg.toFixed(1).replace(".", ",") + " kg", c.back || "en cours",
        c.back ? (c.back === c.pcs ? badge("0", "outline") : badge(`${c.back - c.pcs} pièce(s)`, "on")) : btn("Retour propre", `A.bln.collectBack(${i})`, "ghost sm")]))
      + card("Enregistrer une collecte", `<div class="row" style="flex-wrap:nowrap">${select("c-loc", [...offices, "Restaurant", "Spa"], "Office étage 3")}${input("c-pcs", "", 'type="number" min="1" placeholder="Pièces" style="max-width:110px"')}${input("c-kg", "", 'type="number" min="0" step="0.1" placeholder="kg" style="max-width:90px"')}${btn("Enregistrer", "A.bln.collect()", "ghost")}</div>`)
  }

  function tabNeed() {
    const need = requirement()
    const items = ["DRP", "HSC", "TAI", "SBN", "SMN"]
    return `<p class="muted">Besoin calculé depuis les départs et recouches du jour (${inHouse().length} chambres occupées) et les chambres libérées sales ; à préparer depuis la lingerie centrale ${muted("US-BLN-02 · EF-BLN-003")}</p>`
      + tbl(["Office", ...items.map((c) => "#" + IT(c).label)], offices.map((o) => [esc(o), ...items.map((c) => {
        const n = need[o][c] || 0, have = qty(o, c), give = Math.max(0, n - have)
        return `${n} ${muted(`stock ${have}`)}${give ? ` → <strong>+${give}</strong>` : ""}`
      })]))
      + `<div class="row" style="margin-top:12px">${btn("Valider le bon de distribution", "A.bln.distribute()", "accent")}${btn("Imprimer", "print()", "ghost")}</div>`
      + aiBox("Prévision du besoin en linge", "Pour demain : 6 départs et 5 arrivées prévus, banquet de 80 couverts (événements). Besoin estimé : 18 draps, 9 housses, 22 serviettes de bain, 85 serviettes de table. Par conseillé à l'office étage 2 : 16 serviettes de bain au lieu de 14. Repli sans IA : ratios par chambre occupée.")
  }

  function tabProd() {
    const free = B.machines.filter((m) => m.type === "Laveuse" && m.state === "disponible")
    return `<h2>Machines ${muted("EF-BLN-007")}</h2>`
      + cards(B.machines.map((m) => card("", `<div class="row between"><strong>${esc(m.id)} · ${esc(m.type)}</strong>${b2(MST, m.state)}</div>
        <div class="muted">${m.cap ? `Capacité ${m.cap} kg` : "Repassage en continu"}</div>${m.note ? `<p class="muted" style="margin:6px 0 0">${esc(m.note)}</p>` : ""}`)))
      + card("Nouveau lot de lavage", free.length ? form([
        field("b-mach", "Machine", select("b-mach", free.map((m) => [m.id, `${m.id} (${m.cap} kg)`]), free[0].id)),
        field("b-prog", "Programme", select("b-prog", B.programs.map((x) => [x.id, x.label]), "P60")),
        field("b-kg", "Poids trié (kg)", input("b-kg", "12", 'type="number" min="1" step="0.5"')),
        field("b-op", "Opérateur", select("b-op", ["Aminata Coulibaly", "Yao Gbané"], "Yao Gbané")),
        `<div class="full" id="b-err"></div>`,
        `<div class="full row">${btn("Lancer le lot", "A.bln.startBatch()")}${muted("Dosage lessiviel calculé et sorti du stock (Achats), simulé.")}</div>`,
      ]) : `<p class="muted">Aucune laveuse disponible.</p>`)
      + `<h2>Lots de production ${muted("EF-BLN-005 · EF-BLN-006")}</h2>`
      + tbl(["Lot", "Machine", "Programme", "#Poids", "Produits dosés", "#Eau", "#Énergie", "Opérateur", "Début", "Résultat"], B.batches.map((b) => {
        const pr = PG(b.prog)
        return [esc(b.id), esc(b.machine), esc(pr.label), b.kg + " kg", `<span class="muted">${esc(pr.chem)}</span>`, Math.round(pr.litres * b.kg) + " L", (pr.kwh * b.kg).toFixed(1).replace(".", ",") + " kWh", esc(b.op), dt(b.start),
          b.status === "en_cours" ? `<span class="row" style="flex-wrap:nowrap">${select("r-" + b.id, Object.entries(RES).map(([k, [l]]) => [k, l]), "conforme")}${btn("Terminer", `A.bln.endBatch(${q(b.id)})`, "ghost sm")}</span>` : b2(RES, b.result)]
      }))
      + aiBox("Optimisation des lots", "Le linge en attente (34 draps, 12 housses, 46 serviettes) peut être regroupé en 3 lots au lieu de 5 : draps + housses en 60 °C sur LAV-1 (23 kg), éponge en 40 °C sur LAV-2. Gain estimé : 140 L d'eau et 1,2 h de machine.")
  }

  function tabOut() {
    return `<p class="muted">Bons d'envoi et de retour, comptage contradictoire. Un écart supérieur à ${B.tolerance} % bloque la validation de la facture du prestataire ${muted("EF-BLN-008 · RG-BLN-04")}</p>`
      + B.shipments.map((s) => {
        const sent = Object.values(s.lines).reduce((t, [a]) => t + a, 0)
        const back = Object.values(s.lines).every(([, b]) => b != null) ? Object.values(s.lines).reduce((t, [, b]) => t + b, 0) : null
        const gapPct = back == null ? 0 : ((sent - back) / sent) * 100
        return card("", `<div class="row between"><strong>${esc(s.id)} · ${esc(s.provider)}</strong>${s.status === "envoye" ? badge("Chez le prestataire", "outline") : s.status === "litige" ? badge("Litige", "dark") : badge(s.paid ? "Facture validée" : "Contrôlé", "on")}</div>
          <p class="muted" style="margin:4px 0">Envoyé le ${fd(s.sent)} · retour attendu le ${fd(s.due)} · facture ${money(s.invoice)}</p>
          ${tbl(["Article", "#Envoyé", "#Retourné"], Object.entries(s.lines).map(([c, [a, b]], i) => [esc(IT(c).label), a, s.status === "envoye" ? input(`sh-${s.id}-${i}`, a, 'type="number" min="0" style="max-width:90px"') : b]))}
          ${s.status === "envoye" ? `<div class="row" style="margin-top:8px">${btn("Enregistrer le retour", `A.bln.receiveShipment(${q(s.id)})`, "sm")}</div>`
            : s.status === "litige" ? `<p class="err">Écart de ${pct(gapPct)} (${sent - back} pièce(s)) au-delà de la tolérance : facture bloquée, litige ouvert auprès du prestataire.</p><div class="row">${btn("Accepter un avoir et débloquer", `A.bln.settle(${q(s.id)})`, "ghost sm")}</div>`
            : s.paid ? "" : `<div class="row" style="margin-top:8px">${btn("Valider la facture du prestataire", `A.bln.payShipment(${q(s.id)})`, "sm")}</div>`}`)
      }).join("")
  }

  function tabLoss() {
    return card("Déclarer une perte ou une réforme", form([
      field("ls-item", "Article", select("ls-item", B.items.map((i) => [i.code, i.label]), "SBN")),
      field("ls-qty", "Quantité", input("ls-qty", "1", 'type="number" min="1"')),
      field("ls-reason", "Motif", select("ls-reason", ["Réforme (usure)", "Tache irrécupérable", "Perte / vol", "Nombre de lavages maximal atteint", "Abîmé par un client"], "Réforme (usure)")),
      field("ls-loc", "Lieu", select("ls-loc", B.locations, "Lingerie centrale")),
      `<div class="full row">${btn("Enregistrer et valoriser", "A.bln.addLoss()")}${muted("Sortie du stock, perte transmise à la comptabilité (simulé). EF-BLN-009")}</div>`,
    ]))
      + `<h2>Pièces à réformer (suivi RFID, simulé) ${muted("RG-BLN-05")}</h2>`
      + tbl(["Pièce", "Puce", "#Lavages", "#Max", ""], B.worn.map((w, i) => [esc(IT(w.item).label), esc(w.tag), w.washes, IT(w.item).maxWash, w.washes >= IT(w.item).maxWash ? btn("Réformer", `A.bln.retire(${i})`, "ghost sm") : badge("Bientôt", "outline")]), "Aucune pièce en fin de vie.")
      + `<h2>Historique</h2>`
      + tbl(["Date", "Article", "#Qté", "Motif", "Lieu", "#Valeur"], B.losses.map((l) => [fd(l.date), esc(IT(l.item).label), l.qty, esc(l.reason), esc(l.loc), money(lossValue(l))]))
      + aiBox("Détection de pertes anormales", "Office étage 2 : 3 déclarations de perte de serviettes en 15 jours, soit 2,4 fois la moyenne des autres étages. Écart de comptage répété chez Blanchisserie Akwaba Exemple (nappes). Alerte transmise au responsable buanderie.")
  }

  function tabUniforms() {
    return `<p class="muted">Dotation par employé, échanges et restitution au départ (lien RH) ${muted("EF-BLN-016 · RG-BLN-07")}</p>`
      + tbl(["Employé", "Service", "Dotation", "Remis le", "Statut", ""], B.uniforms.map((u, i) => [esc(u.emp), esc(u.dept), esc(u.items.map(([a, t, n]) => `${a} ${t} × ${n}`).join(", ")) + (u.exchanges ? " " + muted(`${u.exchanges} échange(s)`) : ""), fd(u.issued) + "/" + u.issued.slice(2, 4),
        u.status === "actif" ? badge("Actif", "outline") : u.status === "a_restituer" ? badge(`Départ le ${fd(u.leave)} — à restituer`, "on") : badge(u.missing ? `Restitué, ${u.missing} manquant(s)` : "Restitué", "dark"),
        u.status === "actif" ? btn("Échanger", `A.bln.exchange(${i})`, "ghost sm") : u.status === "a_restituer" ? btn("Enregistrer la restitution", `A.bln.restitute(${i})`, "ghost sm") : ""]))
      + `<p class="muted">Un manquant peut donner lieu à retenue uniquement si la loi et le contrat le permettent : décision RH, pas automatique.</p>`
  }

  function tabKpi() {
    const occ = Math.max(1, inHouse().length)
    const done = B.batches.filter((b) => b.status === "termine")
    const rewash = done.filter((b) => b.result !== "conforme").length
    const lossM = B.losses.filter((l) => l.date >= "2026-11-01")
    const circ = Object.values(B.stock).reduce((s, l) => s + Object.values(l).reduce((t, n) => t + n, 0), 0)
    const delivered = B.orders.filter((o) => o.status === "livree")
    const onTime = delivered.filter((o) => o.delivered <= o.promised).length
    const revenue = delivered.reduce((s, o) => s + o.amount, 0)
    return `<p class="muted">Indicateurs §17.12 sur les données d'exemple (coûts de production : valeurs d'exemple du mois).</p>`
      + cards([kpi("Coût du linge / chambre occupée", money(2350), "production + pertes + prestataire"), kpi("Coût par kg lavé", money(410), "main-d'œuvre, produits, énergie, eau, amortissement"),
        kpi("Taux de perte et de réforme", pct((lossM.reduce((s, l) => s + l.qty, 0) / circ) * 100), "pièces du mois / en circulation"), kpi("Taux de relavage", pct((rewash / Math.max(1, done.length)) * 100), `${rewash} lot(s) sur ${done.length}`),
        kpi("Délai pressing respecté", delivered.length ? pct((onTime / delivered.length) * 100) : "—", `${delivered.length} commande(s) livrée(s)`), kpi("Revenu pressing", money(revenue), `${money(revenue / occ)} par chambre occupée`)])
      + cards([card("Pertes valorisées par motif", bars([...new Set(B.losses.map((l) => l.reason))].map((r) => ({ label: r, value: B.losses.filter((l) => l.reason === r).reduce((s, l) => s + lossValue(l), 0) })), money)),
        card("Kg lavés par jour", columns(["22/11", "23/11", "24/11", "25/11", "26/11"], [148, 162, 139, 175, B.batches.filter((b) => b.start.startsWith(today)).reduce((s, b) => s + b.kg, 0)], (v) => v + " kg"))])
  }

  // ---------- Écran 2 : Pressing client ----------
  function pressing(p) {
    const tab = p[0] || "commandes"
    return pageHead("Pressing client", "Commandes de pressing des clients, suivi jusqu'à la livraison en chambre, imputation au folio à la livraison. Tarifs d'exemple TTC.",
      btn("Nouvelle commande", "go('bln-pressing/nouvelle')"))
      + subtabs("bln-pressing", [["commandes", "Commandes"], ["nouvelle", "Nouvelle commande"], ["tarifs", "Tarifs"], ["reclamations", "Réclamations"]], tab)
      + ({ commandes: tabOrders, nouvelle: tabNew, tarifs: tabPrices, reclamations: tabClaims }[tab] || tabOrders)(p.slice(1))
  }

  function tabOrders() {
    const next = { prise: ["traitement", "Mettre en traitement"], traitement: ["prete", "Marquer prête"], prete: ["livree", "Livrer et imputer au folio"] }
    return tbl(["Ticket", "Chambre / client", "Articles", "Option", "Promis pour", "#Montant", "Statut", ""], B.orders.map((o) => {
      const r = R(o.res), late = o.status !== "livree" && o.promised < NOW
      return [`<strong>${esc(o.id)}</strong>`, r ? `Ch. ${esc(r.room)} · ${esc(G(r.guest).name)}` : `${esc(o.ext)} ${muted("externe, payé")}`, esc(o.lines.map((l) => `${l.art} × ${l.qty} (${SVC[l.svc].toLowerCase()})`).join(", ")),
        o.express ? badge("Express", "on") : "Normal", dt(o.promised) + (late ? " " + badge("En retard", "dark") : ""), money(o.amount ?? orderAmount(o)),
        b2(OST, o.status) + (o.charged ? " " + muted("imputé au folio") : o.ext ? " " + muted(`encaissé ${o.payMode}`) : ""),
        next[o.status] ? btn(next[o.status][1], `A.bln.advance(${q(o.id)})`, o.status === "prete" ? "sm" : "ghost sm") : btn("Réclamation", `A.bln.claim(${q(o.id)})`, "ghost sm")]
    }))
      + `<p class="muted">La prestation est imputée au folio à la livraison, jamais à la prise de commande (RG-BLN-02). Étiquetage par ticket ou code-barres (EF-BLN-012).</p>`
  }

  function tabNew() {
    const ih = inHouse()
    const art = B.prices.map((x) => x.art)
    return card("Commande de pressing", form([
      field("pr-res", "Client en séjour", select("pr-res", [...ih.map((r) => [r.id, `Ch. ${r.room} · ${G(r.guest).name}`]), ["ext", "Client externe (paiement immédiat)"]], ih[0] && ih[0].id)),
      field("pr-due", "Retour souhaité dans", select("pr-due", [["2", "2 h"], ["3", "3 h"], ["6", "6 h"], ["8", "8 h (le soir)"], ["24", "24 h"]], "8", `onchange="A.bln.quote()"`)),
      ...[0, 1, 2].map((i) => field("pr-art" + i, `Article ${i + 1}`, select("pr-art" + i, [["", "—"], ...art], i === 0 ? "Chemise" : "", `onchange="A.bln.quote()"`))
        + field("pr-svc" + i, "Service", select("pr-svc" + i, Object.entries(SVC), "lavage", `onchange="A.bln.quote()"`))
        + field("pr-qty" + i, "Quantité", input("pr-qty" + i, i === 0 ? "2" : "1", `type="number" min="1" oninput="A.bln.quote()"`))),
      field("pr-ext", "Client externe : nom et téléphone", input("pr-ext", "", 'placeholder="Ex. Kadi Ouattara, +225 07 00 00 00 41"')),
      field("pr-pay", "Paiement immédiat (externe)", select("pr-pay", ["Espèces", "Mobile Money", "Carte bancaire"], "Mobile Money")),
      `<div class="full" id="pr-quote"></div>`,
      `<div class="full row">${btn("Confirmer la commande", "A.bln.createOrder()", "accent")}${muted("RG-BLN-01 : client en séjour, ou externe identifié avec paiement immédiat")}</div>`,
    ]))
      + aiBox("Prise de commande par le concierge IA", "Message du client (ch. 202) : « Pouvez-vous laver et repasser deux chemises pour ce soir ? » Proposition : 2 chemises, lavage, retour 19 h, 4 000 FCFA. Le prix est confirmé au client avant validation.",
        btn("Créer la commande proposée", "A.bln.fromConcierge()", "sm"))
  }

  function tabPrices() {
    return tbl(["Article", "#Lavage", "#Repassage", "#Nettoyage à sec"], B.prices.map((x) => [esc(x.art), x.lavage ? money(x.lavage) : "—", money(x.repassage), money(x.sec)]))
      + `<p class="muted">Express : +${B.expressRate * 100} % si le délai demandé est inférieur à ${B.expressHours} h (RG-BLN-03). Prix TTC, TVA 18 % incluse (exemple, taux à paramétrer).</p>`
  }

  function tabClaims() {
    return `<p class="muted">Article abîmé ou perdu : dédommagement validé par le responsable, puis imputé en avoir sur le folio ${muted("EF-BLN-014")}</p>`
      + tbl(["Ticket", "Client", "Motif", "#Dédommagement", "Statut", ""], B.claims.map((c, i) => {
        const r = R(PO(c.order).res)
        return [esc(c.order), esc(r ? G(r.guest).name : PO(c.order).ext), esc(c.reason), money(c.amount), c.ok ? badge("Validé, imputé", "on") : badge("À valider", "outline"),
          c.ok ? "" : btn("Valider le dédommagement", `A.bln.validateClaim(${i})`, "ghost sm")]
      }), "Aucune réclamation. Une réclamation se déclare depuis une commande livrée.")
  }

  // ---------- Actions ----------
  const readOrderForm = () => {
    const lines = [0, 1, 2].map((i) => ({ art: val("pr-art" + i), svc: val("pr-svc" + i), qty: Number(val("pr-qty" + i)) })).filter((l) => l.art && l.qty > 0)
    const hours = Number(val("pr-due"))
    return { lines, hours, express: hours < B.expressHours }
  }
  const promisedAt = (h) => { const d = new Date(NOW.replace(" ", "T")); d.setHours(d.getHours() + h); return iso(d) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") }
  const actions = {
    quote() {
      const f = readOrderForm(), el = $("#pr-quote")
      if (!el) return
      const bad = f.lines.find((l) => !unitPrice(l.art, l.svc))
      if (bad) return (el.innerHTML = `<div class="err">${esc(SVC[bad.svc])} non proposé pour : ${esc(bad.art)}.</div>`)
      const total = orderAmount({ lines: f.lines, express: f.express })
      el.innerHTML = `<div class="card"><strong>Prix : ${esc(money(total))}</strong> ${f.express ? badge("Express +" + B.expressRate * 100 + " %", "on") : ""} <span class="muted">· retour promis ${esc(dt(promisedAt(f.hours)))}</span></div>`
    },
    createOrder() {
      const f = readOrderForm(), res = val("pr-res")
      if (!f.lines.length) return toast("Ajoutez au moins un article")
      if (f.lines.some((l) => !unitPrice(l.art, l.svc))) return toast("Un service choisi n'est pas proposé pour cet article")
      if (res === "ext") {
        const ext = val("pr-ext")
        if (!ext) return toast("Client externe : identité obligatoire et paiement immédiat (RG-BLN-01)")
        const o = { id: "PR-0" + B.seq.pr++, res: null, ext, payMode: val("pr-pay"), lines: f.lines, express: f.express, taken: NOW, promised: promisedAt(f.hours), status: "prise" }
        o.amount = orderAmount(o)
        B.orders.unshift(o)
        toast(`${o.id} : ${money(o.amount)} encaissés (${o.payMode}, simulé)`)
        return go("bln-pressing/commandes")
      }
      const r = R(res)
      if (!r || r.status !== "arrivee") return toast("Commande refusée : le client n'est pas en séjour (RG-BLN-01)")
      const o = { id: "PR-0" + B.seq.pr++, res, lines: f.lines, express: f.express, taken: NOW, promised: promisedAt(f.hours), status: "prise" }
      B.orders.unshift(o)
      toast(`${o.id} enregistré — ticket imprimé (simulé), ${money(orderAmount(o))}`)
      go("bln-pressing/commandes")
    },
    fromConcierge() {
      const r = inHouse().find((x) => x.room === "202") || inHouse()[0]
      if (!r) return toast("Aucun client en séjour")
      const o = { id: "PR-0" + B.seq.pr++, res: r.id, lines: [{ art: "Chemise", svc: "lavage", qty: 2 }], express: false, taken: NOW, promised: today + " 19:00", status: "prise" }
      B.orders.unshift(o)
      toast(`${o.id} créée depuis le concierge IA (simulé)`)
      go("bln-pressing/commandes")
    },
    advance(id) {
      const o = PO(id), r = R(o.res)
      const next = { prise: "traitement", traitement: "prete", prete: "livree" }[o.status]
      if (next === "livree" && !r) { o.delivered = NOW; toast(`${id} remis au client externe`) }
      else if (next === "livree") {
        if (r.status !== "arrivee") return toast("Le client a quitté l'hôtel : imputation impossible sur un folio clos")
        o.amount = orderAmount(o)
        o.delivered = NOW
        ;(D.extras[o.res] = D.extras[o.res] || []).push({ label: `Pressing ${o.id}${o.express ? " (express)" : ""}`, amount: o.amount })
        o.charged = true
        toast(`${id} livré en chambre ${r.room} — ${money(o.amount)} imputés au folio`)
      } else toast(`${id} : ${OST[next][0].toLowerCase()}`)
      o.status = next
      render()
    },
    claim(id) {
      const o = PO(id)
      if (B.claims.some((c) => c.order === id)) return toast("Une réclamation existe déjà pour ce ticket")
      const reason = prompt("Motif de la réclamation :", "Chemise abîmée au repassage")
      if (!reason) return
      B.claims.push({ order: id, reason, amount: Math.round((o.amount || orderAmount(o)) / 2), ok: false })
      toast("Réclamation enregistrée — dédommagement à valider")
      go("bln-pressing/reclamations")
    },
    validateClaim(i) {
      const c = B.claims[i], o = PO(c.order), r = R(o.res)
      if (!r) { c.ok = true; toast(`Dédommagement de ${money(c.amount)} remboursé au client externe (${o.payMode})`); return render() }
      if (r.status !== "arrivee") return toast("Folio clos : dédommagement à traiter en avoir par la facturation")
      ;(D.extras[o.res] = D.extras[o.res] || []).push({ label: `Dédommagement pressing ${o.id}`, amount: -c.amount })
      c.ok = true
      toast(`Dédommagement de ${money(c.amount)} imputé en avoir au folio`)
      render()
    },
    collect() {
      const pcs = Number(val("c-pcs")), kg = Number(val("c-kg"))
      if (!(pcs > 0)) return toast("Indiquez le nombre de pièces")
      B.collect.unshift({ date: NOW, loc: val("c-loc"), pcs, kg: kg || pcs * 0.55, back: 0 })
      toast("Collecte enregistrée")
      render()
    },
    collectBack(i) {
      const c = B.collect[i], n = Number(prompt(`Pièces rentrées propres pour ${c.loc} (sorties : ${c.pcs})`, String(c.pcs)))
      if (!(n >= 0) || n > c.pcs) return
      c.back = n
      toast(n === c.pcs ? "Retour complet" : `Écart de ${c.pcs - n} pièce(s) signalé`)
      render()
    },
    distribute() {
      const need = requirement(), central = B.stock["Lingerie centrale"]
      let moved = 0
      for (const o of offices) for (const [c, n] of Object.entries(need[o])) {
        const give = Math.min(Math.max(0, n - qty(o, c)), central[c] || 0)
        if (give) { central[c] -= give; B.stock[o][c] = qty(o, c) + give; moved += give }
      }
      toast(moved ? `${moved} pièces distribuées aux offices` : "Les offices couvrent déjà le besoin du jour")
      render()
    },
    startBatch() {
      const m = MA(val("b-mach")), kg = Number(val("b-kg"))
      const err = (t) => ($("#b-err").innerHTML = `<div class="err">${esc(t)}</div>`)
      if (!(kg > 0)) return err("Indiquez le poids trié.")
      if (kg > m.cap) return err(`Surcharge : ${m.id} accepte ${m.cap} kg au plus.`)
      B.batches.unshift({ id: "LOT-" + B.seq.lot++, machine: m.id, prog: val("b-prog"), kg, op: val("b-op"), start: NOW, status: "en_cours" })
      m.state = "en_cycle"
      toast(`Lot lancé sur ${m.id}`)
      render()
    },
    endBatch(id) {
      const b = B.batches.find((x) => x.id === id)
      Object.assign(b, { status: "termine", result: val("r-" + id), end: NOW })
      MA(b.machine).state = "disponible"
      toast(`${id} terminé : ${RES[b.result][0].toLowerCase()}`)
      render()
    },
    receiveShipment(id) {
      const s = B.shipments.find((x) => x.id === id)
      Object.keys(s.lines).forEach((c, i) => (s.lines[c][1] = Number(val(`sh-${id}-${i}`)) || 0))
      const sent = Object.values(s.lines).reduce((t, [a]) => t + a, 0), back = Object.values(s.lines).reduce((t, [, b]) => t + b, 0)
      const gap = ((sent - back) / sent) * 100
      s.status = gap > B.tolerance ? "litige" : "controle"
      Object.entries(s.lines).forEach(([c, [a, b]]) => { B.stock["Chez le prestataire"][c] = Math.max(0, qty("Chez le prestataire", c) - a); B.stock["Lingerie centrale"][c] = qty("Lingerie centrale", c) + b })
      toast(s.status === "litige" ? `Écart de ${pct(gap)} : facture du prestataire bloquée` : "Retour contrôlé, conforme")
      render()
    },
    settle(id) { const s = B.shipments.find((x) => x.id === id); s.status = "controle"; s.invoice = Math.round(s.invoice * 0.92); toast("Avoir accepté — facture ramenée à " + money(s.invoice)); render() },
    payShipment(id) { B.shipments.find((x) => x.id === id).paid = true; toast("Facture du prestataire validée pour paiement (Achats / Finance)"); render() },
    addLoss() {
      const item = val("ls-item"), n = Number(val("ls-qty")), loc = val("ls-loc")
      if (!(n > 0)) return toast("Indiquez une quantité")
      if (qty(loc, item) < n) return toast(`Stock insuffisant à ${loc} : ${qty(loc, item)} pièce(s)`)
      B.stock[loc][item] -= n
      B.losses.unshift({ date: today, item, qty: n, reason: val("ls-reason"), loc })
      toast(`Perte valorisée : ${money(n * IT(item).cost)} — réassort à prévoir`)
      render()
    },
    retire(i) {
      const w = B.worn[i]
      B.worn.splice(i, 1)
      B.stock["Lingerie centrale"][w.item] = Math.max(0, qty("Lingerie centrale", w.item) - 1)
      B.losses.unshift({ date: today, item: w.item, qty: 1, reason: "Nombre de lavages maximal atteint", loc: "Lingerie centrale" })
      toast(`${IT(w.item).label} ${w.tag} réformé et valorisé en perte`)
      render()
    },
    exchange(i) {
      const u = B.uniforms[i], size = prompt(`Échange pour ${u.emp} : nouvelle taille (actuelle ${u.items[0][1]})`, u.items[0][1])
      if (!size) return
      u.items = u.items.map(([a, , n]) => [a, size.toUpperCase(), n])
      u.exchanges = (u.exchanges || 0) + 1
      toast(`Échange enregistré pour ${u.emp} — taille ${size.toUpperCase()}`)
      render()
    },
    restitute(i) {
      const u = B.uniforms[i]
      const total = u.items.reduce((s, [, , n]) => s + n, 0)
      const back = Number(prompt(`Pièces restituées (sur ${total}) :`, String(total)))
      if (!(back >= 0) || back > total) return
      Object.assign(u, { status: "restitue", missing: total - back })
      toast(total - back ? `${total - back} pièce(s) manquante(s) signalée(s) aux RH` : "Uniformes restitués en totalité")
      render()
    },
  }

  HMS.module({
    code: "bln", group: "Opérations", title: "Buanderie et gestion du linge", phase: "11-15", spec: "§17 BLN",
    screens: [
      { id: "bln-linge", label: "Linge et buanderie", view: linge },
      { id: "bln-pressing", label: "Pressing client", view: pressing, after: (p) => (p[0] === "nouvelle" ? A.bln.quote() : null) },
    ],
    actions,
  })
})()
