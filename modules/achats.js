// modules/achats.js — Spec §16 Achats, stocks et fournisseurs (PRC)
// Demandes d'achat avec circuit d'approbation, bons de commande, réceptions partielles, rapprochement
// à trois voies des factures, fournisseurs, stocks multi-magasins, transferts, inventaire, KPI et IA.
;(() => {
  // ---------- Données d'exemple ----------
  D.prc = {
    stores: ["Magasin central", "Économat cuisine", "Cave / bar", "Magasin technique"],
    items: [
      { code: "ART-101", name: "Riz parfumé (sac 25 kg)", unit: "sac", family: "Denrées", account: "6011", cost: 18500, store: "Économat cuisine", supplier: "F-A" },
      { code: "ART-102", name: "Huile végétale (bidon 20 L)", unit: "bidon", family: "Denrées", account: "6011", cost: 26000, store: "Économat cuisine", supplier: "F-A" },
      { code: "ART-103", name: "Filet de poulet (kg)", unit: "kg", family: "Denrées", account: "6011", cost: 3200, store: "Économat cuisine", supplier: "F-B", perishable: true },
      { code: "ART-104", name: "Tomates fraîches (kg)", unit: "kg", family: "Denrées", account: "6011", cost: 900, store: "Économat cuisine", supplier: "F-B", perishable: true },
      { code: "ART-201", name: "Eau minérale 50 cl (pack 12)", unit: "pack", family: "Boissons", account: "6012", cost: 2400, store: "Cave / bar", supplier: "F-C" },
      { code: "ART-202", name: "Jus de fruits 1 L", unit: "bouteille", family: "Boissons", account: "6012", cost: 1500, store: "Cave / bar", supplier: "F-C" },
      { code: "ART-301", name: "Savon d'accueil 30 g", unit: "pièce", family: "Produits d'accueil", account: "6022", cost: 150, store: "Magasin central", supplier: "F-D" },
      { code: "ART-302", name: "Gel douche 30 ml", unit: "flacon", family: "Produits d'accueil", account: "6022", cost: 220, store: "Magasin central", supplier: "F-D" },
      { code: "ART-401", name: "Lessive liquide (bidon 20 L)", unit: "bidon", family: "Lessiviels", account: "6022", cost: 32000, store: "Magasin central", supplier: "F-D" },
      { code: "ART-501", name: "Condensateur 35 µF", unit: "pièce", family: "Pièces techniques", account: "6052", cost: 12000, store: "Magasin technique", supplier: "F-E" },
      { code: "ART-502", name: "Ampoule LED E27", unit: "pièce", family: "Pièces techniques", account: "6052", cost: 1800, store: "Magasin technique", supplier: "F-E" },
    ],
    // stock par magasin ; lots et péremption pour les denrées (EF-PRC-010)
    stock: [
      { item: "ART-101", store: "Économat cuisine", qty: 6, min: 4, max: 12 },
      { item: "ART-102", store: "Économat cuisine", qty: 2, min: 3, max: 8 },
      { item: "ART-103", store: "Économat cuisine", qty: 18, min: 15, max: 60, lots: [{ lot: "L-2611A", exp: "2026-11-28", qty: 10 }, { lot: "L-2611B", exp: "2026-12-02", qty: 8 }] },
      { item: "ART-104", store: "Économat cuisine", qty: 9, min: 10, max: 40, lots: [{ lot: "L-2511T", exp: "2026-11-27", qty: 9 }] },
      { item: "ART-201", store: "Cave / bar", qty: 14, min: 20, max: 80 },
      { item: "ART-202", store: "Cave / bar", qty: 36, min: 24, max: 96 },
      { item: "ART-301", store: "Magasin central", qty: 420, min: 300, max: 1500 },
      { item: "ART-302", store: "Magasin central", qty: 180, min: 300, max: 1500 },
      { item: "ART-401", store: "Magasin central", qty: 3, min: 2, max: 8 },
      { item: "ART-501", store: "Magasin technique", qty: 0, min: 1, max: 4 },
      { item: "ART-502", store: "Magasin technique", qty: 25, min: 10, max: 50 },
      { item: "ART-301", store: "Économat cuisine", qty: 0, min: 0, max: 0 },
    ],
    suppliers: [
      { id: "F-A", name: "Ets Kouassi & Fils (exemple)", nif: "CI-0000000A", family: "Épicerie sèche", terms: "30 jours fin de mois", lead: 3, rating: 4.4, email: "commandes@kouassi-fils.exemple.test", docs: [["RCCM", "valide"], ["Attestation de régularité fiscale", "2027-03-31"]], createdBy: "Moussa Traoré", iban: "CI•• •••• •••• 4412" },
      { id: "F-B", name: "Marché Frais Treichville Exemple", nif: "CI-0000000B", family: "Produits frais", terms: "Comptant à la livraison", lead: 1, rating: 3.9, email: "ventes@marche-treichville.exemple.test", docs: [["RCCM", "valide"], ["Attestation de régularité fiscale", "2026-12-15"]], createdBy: "Estelle Yapi", iban: "CI•• •••• •••• 7781",
        bankChange: { iban: "CI•• •••• •••• 9050", by: "Estelle Yapi", first: "Estelle Yapi", date: "2026-11-25" } },
      { id: "F-C", name: "Boissons Lagune Exemple", nif: "CI-0000000C", family: "Boissons", terms: "45 jours", lead: 5, rating: 4.1, email: "adv@boissons-lagune.exemple.test", docs: [["RCCM", "valide"], ["Attestation de régularité fiscale", "2026-11-20"]], createdBy: "Moussa Traoré", iban: "CI•• •••• •••• 1203" },
      { id: "F-D", name: "Société Ivoirienne Hygiène Exemple", nif: "CI-0000000D", family: "Hygiène et accueil", terms: "30 jours", lead: 7, rating: 4.6, email: "pro@sih.exemple.test", docs: [["RCCM", "valide"], ["Attestation de régularité fiscale", "2027-01-31"]], createdBy: "Moussa Traoré", iban: "CI•• •••• •••• 3388", contract: "Contrat-cadre groupe 2026" },
      { id: "F-E", name: "Quincaillerie Yopougon Exemple", nif: "CI-0000000E", family: "Pièces techniques", terms: "30 jours", lead: 4, rating: 3.6, email: "service@quincaillerie-yopougon.exemple.test", docs: [["RCCM", "valide"], ["Attestation de régularité fiscale", "2027-02-28"]], createdBy: "Estelle Yapi", iban: "CI•• •••• •••• 5530" },
    ],
    budgets: { Cuisine: [3500000, 2610000], Bar: [1200000, 640000], Hébergement: [900000, 520000], Technique: [800000, 705000], Buanderie: [600000, 310000] },
    // statut DA : brouillon | soumise | approuvee | rejetee | commandee
    requests: [
      { id: "DA-118", service: "Cuisine", by: "Didier Zadi", date: "2026-11-25", lines: [{ item: "ART-102", qty: 6 }, { item: "ART-101", qty: 4 }], status: "soumise", approvals: [{ role: "Chef de service", who: "Didier Zadi" }] },
      { id: "DA-119", service: "Bar", by: "Ibrahim Fofana", date: "2026-11-26", lines: [{ item: "ART-201", qty: 60 }], status: "approuvee", approvals: [{ role: "Chef de service", who: "Ibrahim Fofana" }] },
      { id: "DA-117", service: "Hébergement", by: "Adjoua Kouamé", date: "2026-11-24", lines: [{ item: "ART-302", qty: 2000 }, { item: "ART-301", qty: 1500 }], status: "soumise", approvals: [{ role: "Chef de service", who: "Adjoua Kouamé" }] },
      { id: "DA-115", service: "Technique", by: "Seydou Bamba", date: "2026-11-22", lines: [{ item: "ART-502", qty: 20 }], status: "commandee", approvals: [{ role: "Chef de service", who: "Seydou Bamba" }] },
    ],
    // statut BC : envoyee | partielle | recue
    orders: [
      { id: "BC-0451", supplier: "F-B", da: "", date: "2026-11-25", expected: "2026-11-26", lines: [{ item: "ART-103", qty: 30, price: 3200, received: 0 }, { item: "ART-104", qty: 25, price: 900, received: 0 }], status: "envoyee" },
      { id: "BC-0448", supplier: "F-E", da: "DA-115", date: "2026-11-22", expected: "2026-11-26", lines: [{ item: "ART-502", qty: 20, price: 1800, received: 12 }], status: "partielle" },
      { id: "BC-0440", supplier: "F-D", da: "", date: "2026-11-12", expected: "2026-11-19", received: "2026-11-20", lines: [{ item: "ART-301", qty: 1000, price: 150, received: 1000 }, { item: "ART-401", qty: 4, price: 32000, received: 4 }], status: "recue" },
      { id: "BC-0437", supplier: "F-C", da: "", date: "2026-11-08", expected: "2026-11-13", received: "2026-11-14", lines: [{ item: "ART-202", qty: 48, price: 1500, received: 48 }], status: "recue" },
    ],
    receipts: [
      { id: "BR-0312", po: "BC-0448", date: "2026-11-25", lines: [{ item: "ART-502", qty: 12, ok: true }], note: "8 pièces en reliquat" },
      { id: "BR-0305", po: "BC-0440", date: "2026-11-20", lines: [{ item: "ART-301", qty: 1000, ok: true }, { item: "ART-401", qty: 4, ok: true }], note: "" },
      { id: "BR-0301", po: "BC-0437", date: "2026-11-14", lines: [{ item: "ART-202", qty: 48, ok: true }], note: "" },
    ],
    // statut : a_rapprocher | bloquee | approuvee | a_valider (OCR)
    invoices: [
      { id: "FF-2290", supplier: "F-D", po: "BC-0440", ref: "FD-11872", date: "2026-11-21", lines: [{ item: "ART-301", qty: 1000, price: 150 }, { item: "ART-401", qty: 4, price: 32000 }], status: "a_rapprocher" },
      { id: "FF-2291", supplier: "F-C", po: "BC-0437", ref: "FC-55120", date: "2026-11-15", lines: [{ item: "ART-202", qty: 48, price: 1650 }], status: "a_rapprocher" },
      { id: "FF-2292", supplier: "F-E", po: "BC-0448", ref: "FE-0907", date: "2026-11-25", lines: [{ item: "ART-502", qty: 20, price: 1800 }], status: "a_rapprocher" },
      { id: "FF-2288", supplier: "F-A", po: "", ref: "FA-3001", date: "2026-11-18", lines: [{ item: "ART-101", qty: 5, price: 18500 }], status: "a_rapprocher" },
    ],
    movements: [
      { date: "2026-11-26", type: "Sortie", item: "ART-103", qty: 12, from: "Économat cuisine", to: "Centre de coût Restaurant", ref: "Bon de sortie BS-771" },
      { date: "2026-11-25", type: "Entrée", item: "ART-502", qty: 12, from: "Quincaillerie Yopougon Exemple", to: "Magasin technique", ref: "BR-0312" },
      { date: "2026-11-25", type: "Transfert", item: "ART-302", qty: 120, from: "Magasin central", to: "Office étage 2", ref: "TR-118" },
      { date: "2026-11-24", type: "Sortie", item: "ART-401", qty: 1, from: "Magasin central", to: "Centre de coût Buanderie", ref: "Consommation lot LOT-5521" },
    ],
    counts: [{ id: "INV-031", store: "Cave / bar", date: "2026-10-31", gap: -18400 }, { id: "INV-030", store: "Économat cuisine", date: "2026-10-31", gap: -42500 }, { id: "INV-029", store: "Magasin central", date: "2026-10-31", gap: 3600 }],
    tolerance: 2, // % d'écart toléré au rapprochement (EF-PRC-006)
    thresholds: { daf: 500000, dg: 2000000 }, // RG-PRC-02
    seq: { da: 120, bc: 452, br: 313, ff: 2293, tr: 119, inv: 32 },
  }
  const P = D.prc
  // article hors catalogue (demande venant d'un autre module) : libellé libre
  const IT = (c) => P.items.find((i) => i.code === c) || { code: c, name: c, unit: "u", family: "Hors catalogue", account: "6052", cost: 0, store: "Magasin technique", supplier: "F-E" }
  const SUP = (id) => P.suppliers.find((s) => s.id === id)
  const DA = (id) => P.requests.find((r) => r.id === id)
  const BC = (id) => P.orders.find((o) => o.id === id)
  const FF = (id) => P.invoices.find((f) => f.id === id)
  const muted = (t) => `<span class="muted" style="font-size:12px">${esc(t)}</span>`
  const daTotal = (r) => r.lines.reduce((s, l) => s + l.qty * (l.price ?? IT(l.item).cost), 0)
  const required = (r) => { const t = daTotal(r); return ["Chef de service", ...(t >= P.thresholds.daf ? ["DAF"] : []), ...(t >= P.thresholds.dg ? ["Directeur"] : [])] }
  const stockOf = (item, store) => P.stock.find((s) => s.item === item && s.store === store)
  const DST = { brouillon: ["Brouillon", "outline"], soumise: ["À approuver", ""], approuvee: ["Approuvée", "on"], rejetee: ["Rejetée", "dark"], commandee: ["Commandée", "outline"] }
  const OST = { envoyee: ["Envoyée", ""], partielle: ["Reçue partiellement", "outline"], recue: ["Reçue", "on"] }
  const FST = { a_rapprocher: ["À rapprocher", ""], bloquee: ["Bloquée", "dark"], approuvee: ["Bon à payer", "on"], a_valider: ["OCR à valider", "outline"] }
  const b2 = (m, k) => badge(m[k][0], m[k][1])
  const itemOpts = () => P.items.map((i) => [i.code, `${i.name} — ${money(i.cost)}/${i.unit}`])

  // Rapprochement à trois voies : commande / réception / facture (EF-PRC-006, RG-PRC-03)
  const match = (f) => {
    const o = f.po && BC(f.po)
    if (!o) return { ok: false, issues: ["Aucune commande ni réception correspondante : facture bloquée (RG-PRC-03)."], gap: 0 }
    const issues = []
    let gap = 0
    f.lines.forEach((l) => {
      const ol = o.lines.find((x) => x.item === l.item)
      if (!ol) { issues.push(`${IT(l.item).name} : absent de la commande.`); gap += l.qty * l.price; return }
      if (l.qty > ol.received) { issues.push(`${IT(l.item).name} : ${l.qty} facturé(s), ${ol.received} reçu(s).`); gap += (l.qty - ol.received) * l.price }
      if (l.price !== ol.price) { const d = ((l.price - ol.price) / ol.price) * 100; issues.push(`${IT(l.item).name} : prix ${money(l.price)} au lieu de ${money(ol.price)} (${d > 0 ? "+" : ""}${pct(d)}).`); gap += (l.price - ol.price) * Math.min(l.qty, ol.received) }
    })
    const base = f.lines.reduce((s, l) => s + l.qty * l.price, 0)
    return { ok: Math.abs(gap) <= (base * P.tolerance) / 100, issues, gap }
  }

  // ---------- Écran 1 : Achats ----------
  function achats(p) {
    const tab = p[0] || "demandes"
    return pageHead("Achats", "Du besoin au bon à payer : demandes, approbations, commandes, réceptions et rapprochement des factures. Montants d'exemple ; envois aux fournisseurs simulés.",
      btn("Nouvelle demande", "go('prc-achats/demandes/new')"))
      + cards([kpi("Demandes à approuver", P.requests.filter((r) => r.status === "soumise").length, "circuit par montant"),
        kpi("Commandes en attente", P.orders.filter((o) => o.status !== "recue").length, "envoyées ou partielles"),
        kpi("Factures bloquées", P.invoices.filter((f) => f.status === "bloquee" || (f.status === "a_rapprocher" && !match(f).ok)).length, `tolérance ${P.tolerance} %`),
        kpi("Engagé ce mois", money(P.orders.filter((o) => o.date >= "2026-11-01").reduce((s, o) => s + o.lines.reduce((t, l) => t + l.qty * l.price, 0), 0)), "commandes de novembre")])
      + subtabs("prc-achats", [["demandes", "Demandes d'achat"], ["commandes", "Commandes"], ["receptions", "Réceptions"], ["factures", "Factures fournisseurs"], ["fournisseurs", "Fournisseurs"]], tab)
      + ({ demandes: tabRequests, commandes: tabOrders, receptions: tabReceipts, factures: tabInvoices, fournisseurs: tabSuppliers }[tab] || tabRequests)(p.slice(1))
  }

  function tabRequests(p) {
    const list = [...P.requests].sort((a, b) => b.date.localeCompare(a.date))
    const cur = p[0] === "new" ? null : DA(p[0]) || list[0]
    const left = listItems(list.map((r) => ({ id: r.id, title: `${r.id} · ${r.service}`, badge: " " + b2(DST, r.status), sub: `${money(daTotal(r))} · ${r.by}` })), cur && cur.id, "prc-achats/demandes")
    return split(left, p[0] === "new" ? requestForm() : cur ? requestDetail(cur) : "")
      + aiBox("Détection d'anomalies d'achat", "DA-117 : 2 demandes Hébergement en 3 jours pour les mêmes articles, total juste sous le seuil DAF (fractionnement possible). Boissons Lagune Exemple : prix facturé 10 % au-dessus du prix de commande. À examiner par le contrôle de gestion.")
  }

  function requestForm() {
    return card("Nouvelle demande d'achat", form([
      field("da-service", "Service demandeur", select("da-service", Object.keys(P.budgets), "Cuisine")),
      field("da-by", "Demandeur", input("da-by", "Nadège Beugré")),
      ...[0, 1, 2].map((i) => field("da-item" + i, `Article ${i + 1}`, select("da-item" + i, [["", "—"], ...itemOpts()], i === 0 ? "ART-104" : ""), "full")
        + field("da-qty" + i, "Quantité", input("da-qty" + i, i === 0 ? "20" : "", 'type="number" min="0"'))),
      `<div class="full" id="da-err"></div>`,
      `<div class="full row">${btn("Soumettre pour approbation", "A.prc.createRequest()")}${btn("Annuler", "go('prc-achats/demandes')", "ghost")}</div>`,
    ]))
  }

  function requestDetail(r) {
    const total = daTotal(r), req = required(r), done = r.approvals.map((a) => a.role)
    const [budget, used] = P.budgets[r.service] || [0, 0]
    const over = used + total > budget
    const nextRole = req.find((x) => !done.includes(x))
    return card("", `<div class="row between"><span class="big">${esc(r.id)} — ${esc(r.service)}</span>${b2(DST, r.status)}</div>
      <p class="muted">Demandée par ${esc(r.by)} le ${fd(r.date)} ${muted("EF-PRC-003")}</p>
      ${tbl(["Article", "#Qté", "#Prix réf.", "#Montant"], r.lines.map((l) => { const it = IT(l.item); return [esc(it.name), `${l.qty} ${esc(it.unit)}`, money(l.price ?? it.cost), money(l.qty * (l.price ?? it.cost))] }), "", `<tfoot><tr><td colspan="3">Total</td><td class="num">${money(total)}</td></tr></tfoot>`)}
      <p class="${over ? "err" : "muted"}">Budget ${esc(r.service)} : ${money(used)} engagés sur ${money(budget)}${over ? ` — cette demande dépasse le budget de ${money(used + total - budget)} (EF-PRC-011).` : "."}</p>
      <h3>Circuit d'approbation</h3>
      <p class="muted" style="font-size:12px">Chef de service ; DAF à partir de ${money(P.thresholds.daf)} ; Directeur à partir de ${money(P.thresholds.dg)} (RG-PRC-02).</p>
      <div class="row">${req.map((x) => { const a = r.approvals.find((y) => y.role === x); return a ? badge(`${x} : ${a.who}`, "on") : badge(`${x} : en attente`, "outline") }).join(" ")}</div>
      ${r.status === "soumise" ? `<div class="row" style="margin-top:12px">${btn(`Approuver (${nextRole})`, `A.prc.approve(${q(r.id)})`, "accent")}${btn("Rejeter", `A.prc.reject(${q(r.id)})`, "ghost")}</div>` : ""}
      ${r.status === "brouillon" ? `<div class="row" style="margin-top:12px">${btn("Soumettre", `A.prc.submit(${q(r.id)})`)}</div>` : ""}
      ${r.status === "approuvee" ? `<h3>Transformer en commande</h3><div class="row" style="flex-wrap:nowrap">${select("da-sup", P.suppliers.map((s) => [s.id, s.name]), IT(r.lines[0].item).supplier)}${btn("Créer et envoyer le bon de commande", `A.prc.toOrder(${q(r.id)})`)}</div>` : ""}`)
  }

  function tabOrders(p) {
    const cur = BC(p[0]) || P.orders[0]
    const left = listItems(P.orders.map((o) => ({ id: o.id, title: `${o.id} · ${SUP(o.supplier).name}`, badge: " " + b2(OST, o.status), sub: `${money(o.lines.reduce((s, l) => s + l.qty * l.price, 0))} · livraison ${fd(o.expected)}` })), cur.id, "prc-achats/commandes")
    const total = cur.lines.reduce((s, l) => s + l.qty * l.price, 0)
    return split(left, card("", `<div class="row between"><span class="big">${esc(cur.id)}</span>${b2(OST, cur.status)}</div>
      <p class="muted">${esc(SUP(cur.supplier).name)} · émise le ${fd(cur.date)}${cur.da ? " depuis " + esc(cur.da) : ""} · livraison attendue le ${fd(cur.expected)} · envoyée par e-mail à ${esc(SUP(cur.supplier).email)} (simulé)${cur.reminded ? ` · relancé le ${fd(cur.reminded)}` : ""} ${muted("EF-PRC-004")}</p>
      ${tbl(["Article", "#Commandé", "#Reçu", "#Reliquat", "#Prix", "#Montant"], cur.lines.map((l) => [esc(IT(l.item).name), l.qty, l.received, l.qty - l.received, money(l.price), money(l.qty * l.price)]), "", `<tfoot><tr><td colspan="5">Total HT</td><td class="num">${money(total)}</td></tr></tfoot>`)}
      ${cur.status !== "recue" ? `<div class="row" style="margin-top:12px">${btn("Réceptionner", `go('prc-achats/receptions/${esc(cur.id)}')`)}${btn("Relancer le fournisseur", `A.prc.remind(${q(cur.id)})`, "ghost")}</div>` : ""}`))
  }

  function tabReceipts(p) {
    const pending = P.orders.filter((o) => o.status !== "recue")
    const cur = BC(p[0]) && BC(p[0]).status !== "recue" ? BC(p[0]) : pending[0]
    const left = `<h3>Commandes à réceptionner</h3>` + (pending.length ? listItems(pending.map((o) => ({ id: o.id, title: `${o.id} · ${SUP(o.supplier).name}`, sub: `attendue le ${fd(o.expected)}` })), cur && cur.id, "prc-achats/receptions") : `<p class="muted">Rien à réceptionner.</p>`)
    const right = cur ? card(`Réception de ${cur.id}`, `<p class="muted">Saisir les quantités livrées. Une ligne non conforme est refusée et ne rentre pas en stock ${muted("EF-PRC-005")}</p>
        ${tbl(["Article", "#Reliquat", "Quantité livrée", "Conforme", ...(cur.lines.some((l) => IT(l.item).perishable) ? ["Lot / péremption"] : [])], cur.lines.map((l, i) => {
          const rest = l.qty - l.received
          return [esc(IT(l.item).name), rest, input("rc-q" + i, rest, `type="number" min="0" max="${rest}" style="max-width:100px"`), `<input type="checkbox" id="rc-ok${i}" checked aria-label="Conforme">`,
            ...(cur.lines.some((x) => IT(x.item).perishable) ? [IT(l.item).perishable ? input("rc-exp" + i, addDays(today, 5), 'type="date" style="max-width:160px"') : "—"] : [])]
        }))}
        <div style="margin-top:10px">${field("rc-note", "Observation", input("rc-note", "", 'placeholder="Ex. 2 cartons abîmés"'))}</div>
        <div class="row" style="margin-top:12px">${btn("Valider la réception", `A.prc.receive(${q(cur.id)})`, "accent")}</div>`) : ""
    return split(left, right) + `<h2>Réceptions enregistrées</h2>`
      + tbl(["Bon", "Commande", "Date", "Lignes", "Observation"], P.receipts.map((r) => [esc(r.id), esc(r.po), fd(r.date), esc(r.lines.map((l) => `${IT(l.item).name} × ${l.qty}${l.ok ? "" : " (refusé)"}`).join(", ")), esc(r.note || "—")]))
  }

  function tabInvoices() {
    return `<p class="muted">Rapprochement commande / réception / facture avant bon à payer. Écart toléré : ${P.tolerance} % ${muted("EF-PRC-006")}</p>`
      + P.invoices.map((f) => {
        const m = match(f), total = f.lines.reduce((s, l) => s + l.qty * l.price, 0)
        const st = f.status === "a_rapprocher" ? (m.ok ? "a_rapprocher" : "bloquee") : f.status
        return card("", `<div class="row between"><strong>${esc(f.id)} · ${esc(SUP(f.supplier).name)} · réf. ${esc(f.ref)}</strong><span class="row">${b2(FST, st)}<span class="kpi" style="font-size:18px">${money(total)}</span></span></div>
          <p class="muted" style="margin:4px 0">Reçue le ${fd(f.date)} · commande ${esc(f.po || "aucune")}${f.credit ? ` · avoir de ${money(f.credit)} déduit` : ""}</p>
          ${m.issues.length ? `<div class="err">${m.issues.map(esc).join("<br>")}${m.gap ? `<br>Écart : ${money(m.gap)}` : ""}</div>` : `<p style="margin:4px 0">${badge("3 voies concordantes", "on")}</p>`}
          ${f.status === "approuvee" ? `<p class="muted" style="margin:4px 0">Transmise à la comptabilité fournisseurs (FIN).</p>` : `<div class="row" style="margin-top:8px">${btn(f.status === "a_valider" ? "Valider la lecture OCR" : "Approuver (bon à payer)", `A.prc.approveInvoice(${q(f.id)})`, m.ok ? "sm" : "ghost sm")}${!m.ok && f.po ? btn("Appliquer l'avoir fournisseur", `A.prc.creditNote(${q(f.id)})`, "ghost sm") : ""}</div>`}`)
      }).join("")
      + aiBox("Extraction de factures", "Déposez un PDF fournisseur : le texte est lu (OCR + modèle de langage, simulés), puis fournisseur, commande, lignes et montants sont proposés. Un humain valide avant rapprochement.",
        btn("Lire une facture d'exemple", "A.prc.ocr()", "sm"))
  }

  function tabSuppliers(p) {
    const cur = SUP(p[0]) || P.suppliers[0]
    const left = listItems(P.suppliers.map((s) => ({ id: s.id, title: s.name, badge: s.bankChange ? " " + badge("RIB à valider", "on") : "", sub: `${s.family} · note ${s.rating.toFixed(1).replace(".", ",")} / 5` })), cur.id, "prc-achats/fournisseurs")
    const po = P.orders.filter((o) => o.supplier === cur.id)
    const late = po.filter((o) => o.received && o.received > o.expected).length
    return split(left, card("", `<div class="row between"><span class="big">${esc(cur.name)}</span>${cur.contract ? badge(cur.contract, "outline") : ""}</div>
      <div class="form" style="margin:12px 0">
        ${field("s-nif", "N° contribuable", input("s-nif", cur.nif, "disabled"))}${field("s-terms", "Conditions de paiement", input("s-terms", cur.terms))}
        ${field("s-mail", "E-mail commandes", input("s-mail", cur.email))}${field("s-lead", "Délai de livraison (j)", input("s-lead", cur.lead, 'type="number" min="0"'))}
      </div>
      <div class="row">${btn("Enregistrer", `A.prc.saveSupplier(${q(cur.id)})`)}</div>
      <h3>Documents légaux</h3>
      ${tbl(["Document", "Validité"], cur.docs.map(([d, v]) => [esc(d), v === "valide" ? badge("Valide", "outline") : v < today ? badge(`Expirée le ${fd(v)}`, "on") : `jusqu'au ${fd(v)}/${v.slice(0, 4)}`]))}
      <h3>Évaluation</h3>
      ${cards([kpi("Note", cur.rating.toFixed(1).replace(".", ",") + " / 5", "qualité, délai, prix"), kpi("Commandes", po.length, "sur la période"), kpi("Livraisons en retard", late, `délai annoncé ${cur.lead} j`)])}
      <h3>Coordonnées bancaires</h3>
      <p>RIB actuel : ${esc(cur.iban)} ${muted("chiffré, affichage masqué")}</p>
      ${cur.bankChange ? `<div class="card"><p class="err" style="margin-top:0">Modification demandée le ${fd(cur.bankChange.date)} par ${esc(cur.bankChange.by)} : nouveau RIB ${esc(cur.bankChange.iban)}. Double validation obligatoire, par une autre personne (RG-PRC-04, RG-PRC-01).</p>
        <div class="row" style="flex-wrap:nowrap">${select("s-val", ["Estelle Yapi", "Arsène Tanoh", "Jean-Marc Ehui"], "Estelle Yapi")}${btn("Valider la modification", `A.prc.validateBank(${q(cur.id)})`, "ghost")}${btn("Refuser", `A.prc.refuseBank(${q(cur.id)})`, "ghost")}</div></div>`
        : btn("Demander un changement de RIB", `A.prc.askBank(${q(cur.id)})`, "ghost sm")}`))
  }

  // ---------- Écran 2 : Stocks ----------
  function stocks(p) {
    const tab = p[0] || "niveaux"
    const value = P.stock.reduce((s, x) => s + x.qty * IT(x.item).cost, 0)
    const low = P.stock.filter((x) => x.min > 0 && x.qty < x.min)
    const expSoon = P.stock.flatMap((x) => (x.lots || []).map((l) => ({ ...l, item: x.item }))).filter((l) => l.exp <= addDays(today, 3))
    return pageHead("Stocks", "Niveaux par magasin, seuils, lots et péremption, mouvements, transferts et inventaires. Valorisation au coût moyen pondéré (CMUP). Données d'exemple.")
      + cards([kpi("Valeur du stock", money(value), "au CMUP"), kpi("Articles sous le seuil", low.length, "réapprovisionnement à lancer"),
        kpi("Lots à consommer sous 3 j", expSoon.length, "denrées périssables"), kpi("Magasins", P.stores.length, "par établissement")])
      + subtabs("prc-stocks", [["niveaux", "Niveaux et alertes"], ["mouvements", "Mouvements et transferts"], ["inventaire", "Inventaire"], ["articles", "Articles"], ["kpi", "Indicateurs"]], tab)
      + ({ niveaux: tabLevels, mouvements: tabMoves, inventaire: tabCount, articles: tabItems, kpi: tabKpi }[tab] || tabLevels)(p.slice(1))
  }

  const reorderProposal = () => P.stock.filter((x) => x.min > 0 && x.qty < x.min).map((x) => ({ item: x.item, store: x.store, qty: x.max - x.qty }))

  function tabLevels() {
    const store = ui.prcStore || "tous"
    const rows = P.stock.filter((x) => (store === "tous" || x.store === store) && (x.max > 0 || x.qty > 0))
    const prop = reorderProposal()
    return `<div class="chips">${[["tous", "Tous les magasins"], ...P.stores.map((s) => [s, s])].map(([k, l]) => `<button aria-pressed="${store === k}" onclick="ui.prcStore=${q(k)};render()">${esc(l)}</button>`).join("")}</div>`
      + tbl(["Article", "Magasin", "#Stock", "#Seuil", "#Max", "#Valeur", "Lots / péremption", "État"], rows.map((x) => {
        const it = IT(x.item), low = x.qty < x.min
        return [esc(it.name), esc(x.store), `${x.qty} ${esc(it.unit)}`, x.min, x.max, money(x.qty * it.cost),
          (x.lots || []).map((l) => `${esc(l.lot)} : ${l.qty} au ${fd(l.exp)}${l.exp <= addDays(today, 3) ? " " + badge("Bientôt périmé", "on") : ""}`).join("<br>") || "—",
          x.qty === 0 ? badge("Rupture", "dark") : low ? badge("Sous le seuil", "on") : badge("OK", "outline")]
      }))
      + `<p class="muted">Règle de sortie des denrées : premier périmé, premier sorti ${muted("EF-PRC-010")}</p>`
      + aiBox("Prévision des besoins", prop.length ? `Proposition selon consommation des 30 derniers jours, prévision d'occupation et délais fournisseurs : ${prop.map((x) => `${IT(x.item).name} × ${x.qty}`).join(" ; ")}. Les quantités sont modifiables avant envoi pour approbation.` : "Aucun article sous le seuil : pas de commande à proposer.",
        prop.length ? btn("Créer les demandes proposées", "A.prc.reorder()", "sm") : "")
  }

  function tabMoves() {
    return card("Transfert entre magasins ou sortie par centre de coût", form([
      field("tr-item", "Article", select("tr-item", itemOpts(), "ART-302"), "full"),
      field("tr-from", "Depuis", select("tr-from", P.stores, "Magasin central")),
      field("tr-to", "Vers", select("tr-to", [...P.stores, "Centre de coût Restaurant", "Centre de coût Hébergement", "Centre de coût Buanderie", "Centre de coût Technique"], "Économat cuisine")),
      field("tr-qty", "Quantité", input("tr-qty", "50", 'type="number" min="1"')),
      `<div class="full" id="tr-err"></div>`,
      `<div class="full row">${btn("Enregistrer le mouvement", "A.prc.transfer()")}${muted("EF-PRC-007")}</div>`,
    ]))
      + `<h2>Derniers mouvements</h2>`
      + tbl(["Date", "Type", "Article", "#Qté", "De", "Vers", "Référence"], P.movements.map((m) => [fd(m.date), esc(m.type), esc(IT(m.item).name), m.qty, esc(m.from), esc(m.to), esc(m.ref)]))
  }

  function tabCount() {
    const store = ui.prcCount || "Cave / bar"
    const rows = P.stock.filter((x) => x.store === store && (x.max > 0 || x.qty > 0))
    return `<div class="row" style="flex-wrap:nowrap;margin-bottom:10px"><label for="inv-store" style="margin:0">Magasin</label>${select("inv-store", P.stores, store, `onchange="ui.prcCount=this.value;render()"`)}</div>`
      + tbl(["Article", "#Théorique", "Compté", "#CMUP"], rows.map((x, i) => [esc(IT(x.item).name), x.qty, input("inv-" + i, x.qty, 'type="number" min="0" style="max-width:110px"'), money(IT(x.item).cost)]))
      + `<div class="row" style="margin-top:12px">${btn("Valider l'inventaire et ajuster le stock", `A.prc.count(${q(store)})`, "accent")}${muted("Inventaire tournant ; ajustements passés en comptabilité (simulé). EF-PRC-008")}</div>`
      + `<h2>Inventaires précédents</h2>`
      + tbl(["Réf.", "Magasin", "Date", "#Écart valorisé"], P.counts.map((c) => [esc(c.id), esc(c.store), fd(c.date), money(c.gap)]))
  }

  function tabItems() {
    return `<p class="muted">Catalogue : unité, famille, compte comptable, fournisseur habituel ${muted("EF-PRC-001")}</p>`
      + tbl(["Code", "Article", "Unité", "Famille", "Compte", "#CMUP", "Fournisseur", "Magasin"], P.items.map((i) => [esc(i.code), esc(i.name) + (i.perishable ? " " + badge("Périssable", "outline") : ""), esc(i.unit), esc(i.family), esc(i.account), money(i.cost), esc(SUP(i.supplier).name), esc(i.store)]))
  }

  function tabKpi() {
    const delays = P.orders.filter((o) => o.received).map((o) => nights(o.date, o.received))
    const gaps = P.counts.reduce((s, c) => s + c.gap, 0)
    return `<p class="muted">Indicateurs §16.12 sur les données d'exemple (rotation et économies : valeurs d'exemple du mois).</p>`
      + cards([kpi("Rotation des stocks", "2,6", "consommation / stock moyen, sur 30 j"), kpi("Écarts d'inventaire", money(gaps), "dernier inventaire, tous magasins"),
        kpi("Délai fournisseur", (delays.reduce((s, d) => s + d, 0) / Math.max(1, delays.length)).toFixed(1).replace(".", ",") + " j", "commande → réception"), kpi("Économies achats", money(412000), "prix négocié vs référence")])
      + cards([card("Engagé / budget par service", bars(Object.entries(P.budgets).map(([k, [b, u]]) => ({ label: k, value: Math.round((u / b) * 100) })), (v) => v + " %")),
        card("Valeur de stock par magasin", bars(P.stores.map((s) => ({ label: s, value: P.stock.filter((x) => x.store === s).reduce((t, x) => t + x.qty * IT(x.item).cost, 0) })), money))])
  }

  // ---------- Actions ----------
  const pushMove = (m) => P.movements.unshift({ date: today, ...m })
  const addStock = (item, store, qty) => {
    let s = stockOf(item, store)
    if (!s) P.stock.push((s = { item, store, qty: 0, min: 0, max: 0 }))
    s.qty += qty
    return s
  }
  const actions = {
    createRequest() {
      const lines = [0, 1, 2].map((i) => ({ item: val("da-item" + i), qty: Number(val("da-qty" + i)) })).filter((l) => l.item && l.qty > 0)
      if (!lines.length) return ($("#da-err").innerHTML = `<div class="err">Ajoutez au moins un article avec une quantité.</div>`)
      const by = val("da-by") || "Nadège Beugré"
      const r = { id: "DA-" + P.seq.da++, service: val("da-service"), by, date: today, lines, status: "soumise", approvals: [{ role: "Chef de service", who: by }] }
      P.requests.push(r)
      toast(`${r.id} soumise — ${required(r).length > 1 ? "approbation " + required(r).slice(1).join(" puis ") + " requise" : "approuvée par le chef de service"}`)
      if (required(r).length === 1) r.status = "approuvee"
      go("prc-achats/demandes/" + r.id)
    },
    submit(id) { const r = DA(id); r.status = "soumise"; if (!r.approvals.length) r.approvals.push({ role: "Chef de service", who: "Nadège Beugré" }); if (required(r).every((x) => r.approvals.some((a) => a.role === x))) r.status = "approuvee"; toast(`${id} soumise`); render() },
    approve(id) {
      const r = DA(id), role = required(r).find((x) => !r.approvals.some((a) => a.role === x))
      if (!role) return
      r.approvals.push({ role, who: { DAF: "Arsène Tanoh", Directeur: "Jean-Marc Ehui" }[role] || "Nadège Beugré" })
      if (required(r).every((x) => r.approvals.some((a) => a.role === x))) r.status = "approuvee"
      toast(r.status === "approuvee" ? `${id} approuvée` : `${id} : visa ${role} enregistré`)
      render()
    },
    reject(id) { DA(id).status = "rejetee"; toast(`${id} rejetée`); render() },
    toOrder(id) {
      const r = DA(id), sup = val("da-sup")
      const o = { id: "BC-0" + P.seq.bc++, supplier: sup, da: id, date: today, expected: addDays(today, SUP(sup).lead), lines: r.lines.map((l) => ({ item: l.item, qty: l.qty, price: l.price ?? IT(l.item).cost, received: 0 })), status: "envoyee" }
      P.orders.unshift(o)
      r.status = "commandee"
      const b = P.budgets[r.service]; if (b) b[1] += daTotal(r)
      toast(`${o.id} envoyé à ${SUP(sup).name} (e-mail simulé)`)
      go("prc-achats/commandes/" + o.id)
    },
    receive(id) {
      const o = BC(id), lines = []
      for (let i = 0; i < o.lines.length; i++) {
        const l = o.lines[i], qty = Number(val("rc-q" + i)), ok = $("#rc-ok" + i).checked
        if (qty < 0 || qty > l.qty - l.received) return toast(`Quantité invalide pour ${IT(l.item).name} : au plus ${l.qty - l.received}`)
        if (!qty) continue
        lines.push({ item: l.item, qty, ok })
        if (!ok) continue
        l.received += qty
        const it = IT(l.item), s = addStock(l.item, it.store, qty)
        if (it.perishable) (s.lots = s.lots || []).push({ lot: "L-" + today.slice(5).replace("-", "") + String.fromCharCode(65 + (s.lots.length % 26)), exp: val("rc-exp" + i) || addDays(today, 5), qty })
        pushMove({ type: "Entrée", item: l.item, qty, from: SUP(o.supplier).name, to: it.store, ref: "BR-0" + P.seq.br })
      }
      if (!lines.length) return toast("Aucune quantité saisie")
      const note = val("rc-note") || (lines.some((l) => !l.ok) ? "Lignes non conformes refusées" : "")
      P.receipts.unshift({ id: "BR-0" + P.seq.br++, po: id, date: today, lines, note })
      o.status = o.lines.every((l) => l.received >= l.qty) ? "recue" : "partielle"
      if (o.status === "recue") o.received = today
      toast(o.status === "recue" ? `${id} reçue en totalité — stock mis à jour` : `${id} reçue partiellement — reliquat en attente`)
      go("prc-achats/receptions")
    },
    approveInvoice(id) {
      const f = FF(id), m = match(f)
      if (!m.ok) { f.status = "bloquee"; toast("Écart hors tolérance : facture bloquée"); return render() }
      f.status = "approuvee"
      toast(`${id} : bon à payer transmis à la comptabilité`)
      render()
    },
    creditNote(id) {
      const f = FF(id), o = BC(f.po)
      const before = f.lines.reduce((s, l) => s + l.qty * l.price, 0)
      f.lines = f.lines.map((l) => { const ol = o.lines.find((x) => x.item === l.item); return ol ? { ...l, qty: Math.min(l.qty, ol.received), price: ol.price } : null }).filter(Boolean)
      f.credit = (f.credit || 0) + before - f.lines.reduce((s, l) => s + l.qty * l.price, 0)
      if (f.status === "bloquee") f.status = "a_rapprocher"
      toast(`Avoir de ${money(f.credit)} appliqué : facture alignée sur la commande et la réception`)
      render()
    },
    remind(id) { BC(id).reminded = today; toast(`Relance envoyée à ${SUP(BC(id).supplier).name} (e-mail simulé)`); render() },
    ocr() {
      const f = { id: "FF-" + P.seq.ff++, supplier: "F-B", po: "BC-0451", ref: "FB-" + (7000 + P.seq.ff), date: today, lines: [{ item: "ART-103", qty: 30, price: 3200 }, { item: "ART-104", qty: 25, price: 900 }], status: "a_valider" }
      P.invoices.unshift(f)
      toast(`${f.id} extraite (OCR simulé) — à valider`)
      render()
    },
    saveSupplier(id) {
      const s = SUP(id)
      Object.assign(s, { terms: val("s-terms"), email: val("s-mail"), lead: Number(val("s-lead")) || s.lead })
      toast("Fiche fournisseur enregistrée")
      render()
    },
    askBank(id) {
      const s = SUP(id)
      s.bankChange = { iban: "CI•• •••• •••• " + String(1000 + Math.floor(Math.random() * 8999)), by: "Moussa Traoré", first: "Moussa Traoré", date: today }
      toast("Demande enregistrée : une seconde personne doit la valider")
      render()
    },
    validateBank(id) {
      const s = SUP(id), who = val("s-val")
      if (who === s.bankChange.by || who === s.createdBy) return toast("Validation refusée : le demandeur ou le créateur du fournisseur ne peut pas valider (séparation des tâches)")
      s.iban = s.bankChange.iban
      delete s.bankChange
      toast(`Nouveau RIB validé par ${who}`)
      render()
    },
    refuseBank(id) { delete SUP(id).bankChange; toast("Modification de RIB refusée"); render() },
    reorder() {
      const prop = reorderProposal()
      const bySvc = {}
      const svc = (store) => ({ "Économat cuisine": "Cuisine", "Cave / bar": "Bar", "Magasin technique": "Technique" }[store] || "Hébergement")
      prop.forEach((x) => (bySvc[svc(x.store)] = bySvc[svc(x.store)] || []).push({ item: x.item, qty: x.qty }))
      Object.entries(bySvc).forEach(([service, lines]) => P.requests.push({ id: "DA-" + P.seq.da++, service, by: "Proposition IA (simulée)", date: today, lines, status: "brouillon", approvals: [] }))
      toast(`${Object.keys(bySvc).length} demande(s) en brouillon, à vérifier puis soumettre`)
      go("prc-achats/demandes")
    },
    transfer() {
      const item = val("tr-item"), from = val("tr-from"), to = val("tr-to"), qty = Number(val("tr-qty"))
      const err = (m) => ($("#tr-err").innerHTML = `<div class="err">${esc(m)}</div>`)
      if (!(qty > 0)) return err("Indiquez une quantité.")
      if (from === to) return err("Choisissez deux emplacements différents.")
      const s = stockOf(item, from)
      if (!s || s.qty < qty) return err(`Stock insuffisant : ${s ? s.qty : 0} ${IT(item).unit} disponible(s) au ${from}.`)
      s.qty -= qty
      const isStore = P.stores.includes(to)
      if (isStore) addStock(item, to, qty)
      pushMove({ type: isStore ? "Transfert" : "Sortie", item, qty, from, to, ref: (isStore ? "TR-" : "BS-") + P.seq.tr++ })
      toast(isStore ? "Transfert enregistré" : "Sortie imputée au centre de coût")
      render()
    },
    count(store) {
      const rows = P.stock.filter((x) => x.store === store && (x.max > 0 || x.qty > 0))
      let gap = 0
      rows.forEach((x, i) => {
        const c = Number(val("inv-" + i))
        if (c !== x.qty) { gap += (c - x.qty) * IT(x.item).cost; pushMove({ type: "Ajustement", item: x.item, qty: c - x.qty, from: store, to: store, ref: "INV-0" + P.seq.inv }); x.qty = c }
      })
      P.counts.unshift({ id: "INV-0" + P.seq.inv++, store, date: today, gap })
      toast(gap ? `Inventaire validé — écart ${money(gap)}` : "Inventaire validé — aucun écart")
      render()
    },
    // utilisé par d'autres modules (ex. maintenance) pour tracer un besoin
    externalRequest(label, cost, service) {
      P.requests.push({ id: "DA-" + P.seq.da++, service: P.budgets[service] ? service : "Technique", by: "Demande automatique (autre module)", date: today, lines: [{ item: label, qty: 1, price: cost || 0 }], status: "brouillon", approvals: [] })
    },
  }

  HMS.module({
    code: "prc", group: "Opérations", title: "Achats, stocks et fournisseurs", phase: "11-15", spec: "§16 PRC",
    screens: [
      { id: "prc-achats", label: "Achats", view: achats },
      { id: "prc-stocks", label: "Stocks", view: stocks },
    ],
    actions,
  })
})()
