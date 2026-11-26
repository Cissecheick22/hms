// modules/achats.js — Spec §16 Achats, stocks et fournisseurs (PRC)
// Demandes d'achat avec circuit d'approbation, bons de commande, réceptions partielles, rapprochement
// à trois voies des factures, fournisseurs, stocks multi-magasins, transferts, inventaire, KPI et IA.
;(() => {
  // ---------- Données d'exemple ----------
  D.prc = {
    stores: ["Magasin central", "Économat cuisine", "Cave / bar", "Magasin technique", "Réserve spa"],
    items: [
      { code: "ART-101", name: "Riz parfumé (sac 25 kg)", unit: "sac", family: "Denrées", account: "6011", cost: 18500, store: "Économat cuisine", supplier: "F-A" },
      { code: "ART-102", name: "Huile végétale (bidon 20 L)", unit: "bidon", family: "Denrées", account: "6011", cost: 26000, store: "Économat cuisine", supplier: "F-A" },
      { code: "ART-103", name: "Filet de poulet (kg)", unit: "kg", family: "Denrées", account: "6011", cost: 3200, store: "Économat cuisine", supplier: "F-B", perishable: true, keys: ["poulet"], perSale: 0.4 },
      { code: "ART-104", name: "Tomates fraîches (kg)", unit: "kg", family: "Denrées", account: "6011", cost: 900, store: "Économat cuisine", supplier: "F-B", perishable: true },
      { code: "ART-201", name: "Eau minérale 50 cl (pack 12)", unit: "pack", family: "Boissons", account: "6012", cost: 2400, store: "Cave / bar", supplier: "F-C" },
      { code: "ART-202", name: "Jus de fruits 1 L", unit: "bouteille", family: "Boissons", account: "6012", cost: 1500, store: "Cave / bar", supplier: "F-C", keys: ["jus de fruits", "jus"], perSale: 0.25 },
      // articles vendus à l'unité par le restaurant, le bar et le minibar (keys : mots-clés de correspondance, perSale : quantité de stock par unité vendue)
      { code: "ART-203", name: "Eau minérale 50 cl (bouteille)", unit: "bouteille", family: "Boissons", account: "6012", cost: 200, store: "Cave / bar", supplier: "F-C", keys: ["eau minerale", "eau"] },
      { code: "ART-204", name: "Bière locale 65 cl", unit: "bouteille", family: "Boissons", account: "6012", cost: 900, store: "Cave / bar", supplier: "F-C", keys: ["biere"] },
      { code: "ART-205", name: "Soda 33 cl", unit: "canette", family: "Boissons", account: "6012", cost: 450, store: "Cave / bar", supplier: "F-C", keys: ["soda"] },
      { code: "ART-206", name: "Fleurs de bissap (sachet 200 g)", unit: "sachet", family: "Boissons", account: "6012", cost: 1000, store: "Cave / bar", supplier: "F-B", keys: ["bissap"], perSale: 0.1 },
      { code: "ART-207", name: "Café en grains (kg)", unit: "kg", family: "Boissons", account: "6012", cost: 9000, store: "Cave / bar", supplier: "F-A", keys: ["cafe", "expresso"], perSale: 0.01 },
      { code: "ART-208", name: "Noix de cajou (sachet)", unit: "sachet", family: "Boissons", account: "6012", cost: 1200, store: "Cave / bar", supplier: "F-A", keys: ["cajou"] },
      { code: "ART-209", name: "Chocolat (tablette)", unit: "tablette", family: "Boissons", account: "6012", cost: 800, store: "Cave / bar", supplier: "F-A", keys: ["chocolat"] },
      { code: "ART-105", name: "Capitaine frais (kg)", unit: "kg", family: "Denrées", account: "6011", cost: 5000, store: "Économat cuisine", supplier: "F-B", perishable: true, keys: ["capitaine", "poisson"], perSale: 0.4 },
      { code: "ART-106", name: "Crevettes décortiquées (kg)", unit: "kg", family: "Denrées", account: "6011", cost: 15000, store: "Économat cuisine", supplier: "F-B", perishable: true, keys: ["crevette"], perSale: 0.12 },
      { code: "ART-107", name: "Viande de bœuf (kg)", unit: "kg", family: "Denrées", account: "6011", cost: 8000, store: "Économat cuisine", supplier: "F-B", perishable: true, keys: ["boeuf"], perSale: 0.2 },
      { code: "ART-301", name: "Savon d'accueil 30 g", unit: "pièce", family: "Produits d'accueil", account: "6022", cost: 150, store: "Magasin central", supplier: "F-D" },
      { code: "ART-302", name: "Gel douche 30 ml", unit: "flacon", family: "Produits d'accueil", account: "6022", cost: 220, store: "Magasin central", supplier: "F-D" },
      { code: "ART-401", name: "Lessive liquide (bidon 20 L)", unit: "bidon", family: "Lessiviels", account: "6022", cost: 32000, store: "Magasin central", supplier: "F-D" },
      { code: "ART-501", name: "Condensateur 35 µF", unit: "pièce", family: "Pièces techniques", account: "6052", cost: 12000, store: "Magasin technique", supplier: "F-E", keys: ["condensateur"] },
      { code: "ART-502", name: "Ampoule LED E27", unit: "pièce", family: "Pièces techniques", account: "6052", cost: 1800, store: "Magasin technique", supplier: "F-E", keys: ["ampoule"] },
      { code: "ART-503", name: "Joint de robinet (lot de 10)", unit: "lot", family: "Pièces techniques", account: "6052", cost: 2500, store: "Magasin technique", supplier: "F-E", keys: ["joint"] },
      { code: "ART-504", name: "Flexible inox 40 cm", unit: "pièce", family: "Pièces techniques", account: "6052", cost: 3500, store: "Magasin technique", supplier: "F-E", keys: ["flexible"] },
      { code: "ART-505", name: "Piles serrure (lot de 4)", unit: "lot", family: "Pièces techniques", account: "6052", cost: 4000, store: "Magasin technique", supplier: "F-E", keys: ["piles", "pile", "batterie"] },
      // spa : produits de soin (cabine) et produits revendus en boutique
      { code: "ART-601", name: "Huile de massage professionnelle (litre)", unit: "litre", family: "Produits spa", account: "6022", cost: 14000, store: "Réserve spa", supplier: "F-D", keys: ["massage", "rituel"], perSale: 0.05 },
      { code: "ART-602", name: "Huile de massage au karité 100 ml (boutique)", unit: "flacon", family: "Produits spa", account: "6022", cost: 3500, store: "Réserve spa", supplier: "F-D", keys: ["huile de massage"] },
      { code: "ART-603", name: "Savon noir artisanal", unit: "pain", family: "Produits spa", account: "6022", cost: 1500, store: "Réserve spa", supplier: "F-D", keys: ["savon noir", "hammam"] },
      { code: "ART-604", name: "Crème visage hydratante (boutique)", unit: "pot", family: "Produits spa", account: "6022", cost: 7000, store: "Réserve spa", supplier: "F-D", keys: ["creme visage"] },
      { code: "ART-605", name: "Crème de soin professionnelle (pot 500 ml)", unit: "pot", family: "Produits spa", account: "6022", cost: 18000, store: "Réserve spa", supplier: "F-D", keys: ["soin visage", "visage", "manucure"], perSale: 0.05 },
      { code: "ART-606", name: "Beurre de karité pur 200 g", unit: "pot", family: "Produits spa", account: "6022", cost: 2500, store: "Réserve spa", supplier: "F-D", keys: ["beurre de karite", "gommage"] },
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
      { item: "ART-203", store: "Cave / bar", qty: 64, min: 48, max: 240 },
      { item: "ART-204", store: "Cave / bar", qty: 30, min: 24, max: 120 },
      { item: "ART-205", store: "Cave / bar", qty: 40, min: 24, max: 96 },
      { item: "ART-206", store: "Cave / bar", qty: 6, min: 3, max: 20 },
      { item: "ART-207", store: "Cave / bar", qty: 4, min: 2, max: 10 },
      { item: "ART-208", store: "Cave / bar", qty: 18, min: 12, max: 48 },
      { item: "ART-209", store: "Cave / bar", qty: 13, min: 12, max: 48 },
      { item: "ART-105", store: "Économat cuisine", qty: 8, min: 5, max: 25, lots: [{ lot: "L-2611C", exp: "2026-11-28", qty: 8 }] },
      { item: "ART-106", store: "Économat cuisine", qty: 3, min: 2, max: 8, lots: [{ lot: "L-2511K", exp: "2026-11-29", qty: 3 }] },
      { item: "ART-107", store: "Économat cuisine", qty: 10, min: 6, max: 25, lots: [{ lot: "L-2611D", exp: "2026-11-30", qty: 10 }] },
      { item: "ART-503", store: "Magasin technique", qty: 4, min: 2, max: 10 },
      { item: "ART-504", store: "Magasin technique", qty: 3, min: 2, max: 8 },
      { item: "ART-505", store: "Magasin technique", qty: 6, min: 4, max: 20 },
      { item: "ART-601", store: "Réserve spa", qty: 3, min: 2, max: 10 },
      { item: "ART-602", store: "Réserve spa", qty: 12, min: 5, max: 30 },
      { item: "ART-603", store: "Réserve spa", qty: 4, min: 6, max: 24 },
      { item: "ART-604", store: "Réserve spa", qty: 7, min: 3, max: 15 },
      { item: "ART-605", store: "Réserve spa", qty: 2, min: 1, max: 6 },
      { item: "ART-606", store: "Réserve spa", qty: 20, min: 8, max: 40 },
    ],
    // alertes de seuil levées par les sorties (ventes POS, spa, minibar, maintenance)
    alerts: [],
    suppliers: [
      { id: "F-A", name: "Ets Kouassi & Fils (exemple)", nif: "CI-0000000A", family: "Épicerie sèche", terms: "30 jours fin de mois", lead: 3, rating: 4.4, email: "commandes@kouassi-fils.exemple.test", docs: [["RCCM", "valide"], ["Attestation de régularité fiscale", "2027-03-31"]], createdBy: "Moussa Traoré", iban: "CI•• •••• •••• 4412" },
      { id: "F-B", name: "Marché Frais Treichville Exemple", nif: "CI-0000000B", family: "Produits frais", terms: "Comptant à la livraison", lead: 1, rating: 3.9, email: "ventes@marche-treichville.exemple.test", docs: [["RCCM", "valide"], ["Attestation de régularité fiscale", "2026-12-15"]], createdBy: "Estelle Yapi", iban: "CI•• •••• •••• 7781",
        bankChange: { iban: "CI•• •••• •••• 9050", by: "Estelle Yapi", first: "Estelle Yapi", date: "2026-11-25" } },
      { id: "F-C", name: "Boissons Lagune Exemple", nif: "CI-0000000C", family: "Boissons", terms: "45 jours", lead: 5, rating: 4.1, email: "adv@boissons-lagune.exemple.test", docs: [["RCCM", "valide"], ["Attestation de régularité fiscale", "2026-11-20"]], createdBy: "Moussa Traoré", iban: "CI•• •••• •••• 1203" },
      { id: "F-D", name: "Société Ivoirienne Hygiène Exemple", nif: "CI-0000000D", family: "Hygiène et accueil", terms: "30 jours", lead: 7, rating: 4.6, email: "pro@sih.exemple.test", docs: [["RCCM", "valide"], ["Attestation de régularité fiscale", "2027-01-31"]], createdBy: "Moussa Traoré", iban: "CI•• •••• •••• 3388", contract: "Contrat-cadre groupe 2026" },
      { id: "F-E", name: "Quincaillerie Yopougon Exemple", nif: "CI-0000000E", family: "Pièces techniques", terms: "30 jours", lead: 4, rating: 3.6, email: "service@quincaillerie-yopougon.exemple.test", docs: [["RCCM", "valide"], ["Attestation de régularité fiscale", "2027-02-28"]], createdBy: "Estelle Yapi", iban: "CI•• •••• •••• 5530" },
    ],
    // contrats-cadres négociés par le groupe : prix appliqués automatiquement aux commandes (EF-PRC-002)
    contracts: [
      { id: "CC-2026-01", supplier: "F-D", title: "Contrat-cadre groupe 2026 — hygiène et accueil", scope: "Groupe, tous établissements", from: "2026-01-01", to: "2026-12-31", prices: [{ item: "ART-301", price: 140 }, { item: "ART-302", price: 200 }, { item: "ART-401", price: 30000 }] },
      { id: "CC-2026-02", supplier: "F-C", title: "Accord boissons 2026", scope: "Groupe, 3 établissements", from: "2026-02-01", to: "2027-01-31", prices: [{ item: "ART-201", price: 2300 }, { item: "ART-203", price: 190 }] },
      { id: "CC-2025-04", supplier: "F-E", title: "Accord pièces techniques 2025", scope: "Établissement", from: "2025-01-01", to: "2025-12-31", prices: [{ item: "ART-502", price: 1600 }] },
    ],
    budgets: { Cuisine: [3500000, 2610000], Bar: [1200000, 640000], Hébergement: [900000, 520000], Technique: [800000, 705000], Buanderie: [600000, 310000], Spa: [700000, 280000] },
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
    seq: { da: 120, bc: 452, br: 313, ff: 2293, tr: 119, inv: 32, sup: 6, bs: 900 },
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
  const r2 = (n) => Math.round(n * 100) / 100
  // Correspondance libellé de vente → article de stock (A.prc.consume) : mot-clé en début de mot, insensible à la casse et aux accents ;
  // le mot-clé le plus long l'emporte ; à défaut, la catégorie (famille) citée dans le libellé ou passée dans la ligne.
  const norm = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
  const hasKey = (label, key) => (" " + label + " ").includes(" " + key)
  const findItem = (label, cat) => {
    const l = norm(label)
    let best = null, len = 0
    P.items.forEach((it) => (it.keys || []).forEach((k) => { const nk = norm(k); if (nk && nk.length > len && hasKey(l, nk)) { best = it; len = nk.length } }))
    if (best) return best
    const c = norm(cat)
    return P.items.find((it) => it.keys && (c ? norm(it.family) === c : hasKey(l, norm(it.family)))) || null
  }
  const contractPrice = (sup, item) => {
    const c = P.contracts.find((x) => x.supplier === sup && x.from <= today && today <= x.to && x.prices.some((y) => y.item === item))
    return c ? { id: c.id, price: c.prices.find((y) => y.item === item).price } : null
  }
  const expiredDocs = (sup) => sup.docs.filter(([, v]) => v !== "valide" && v < today)
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
      ${r.status === "approuvee" ? `<h3>Transformer en commande</h3><div class="row" style="flex-wrap:nowrap">${select("da-sup", P.suppliers.map((s) => [s.id, s.name + (expiredDocs(s).length ? " (documents expirés)" : "")]), IT(r.lines[0].item).supplier)}${btn("Créer et envoyer le bon de commande", `A.prc.toOrder(${q(r.id)})`)}</div>
        <p class="muted" style="font-size:12px">Prix du contrat-cadre groupe appliqué s'il existe ; commande refusée à un fournisseur dont un document légal est expiré (EF-PRC-002).</p><div id="da-order-err"></div>` : ""}`)
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

  function supplierForm() {
    return card("Nouveau fournisseur", form([
      field("ns-name", "Raison sociale", input("ns-name", "", 'placeholder="Ex. Transports Lagune Exemple"'), "full"),
      field("ns-nif", "N° contribuable", input("ns-nif", "", 'placeholder="CI-0000000X"')),
      field("ns-family", "Famille d'achat", input("ns-family", "", 'placeholder="Ex. Produits frais"')),
      field("ns-terms", "Conditions de paiement", select("ns-terms", ["Comptant à la livraison", "30 jours", "30 jours fin de mois", "45 jours", "60 jours"], "30 jours")),
      field("ns-lead", "Délai de livraison (j)", input("ns-lead", "3", 'type="number" min="0"')),
      field("ns-mail", "E-mail commandes", input("ns-mail", "", 'placeholder="commandes@fournisseur.exemple.test"')),
      field("ns-by", "Créé par", select("ns-by", ["Moussa Traoré", "Estelle Yapi", "Nadège Beugré"], "Nadège Beugré")),
      field("ns-rccm", "RCCM reçu", select("ns-rccm", [["valide", "Oui, valide"], ["", "Non, à fournir"]], "valide")),
      field("ns-fisc", "Attestation fiscale valable jusqu'au", input("ns-fisc", addDays(today, 180), 'type="date"')),
      `<div class="full" id="ns-err"></div>`,
      `<div class="full row">${btn("Créer le fournisseur", "A.prc.createSupplier()")}${btn("Annuler", "go('prc-achats/fournisseurs')", "ghost")}${muted("Le créateur ne pourra pas valider les paiements ni le RIB de ce fournisseur (RG-PRC-01).")}</div>`,
    ]))
  }

  function tabSuppliers(p) {
    const cur = p[0] === "new" ? null : SUP(p[0]) || P.suppliers[0]
    const left = `<div class="row" style="margin-bottom:8px">${btn("Nouveau fournisseur", "go('prc-achats/fournisseurs/new')", "ghost sm")}${muted("EF-PRC-002")}</div>`
      + listItems(P.suppliers.map((s) => ({ id: s.id, title: s.name, badge: (s.bankChange ? " " + badge("RIB à valider", "on") : "") + (expiredDocs(s).length ? " " + badge("Document expiré", "dark") : ""), sub: `${s.family} · note ${s.rating.toFixed(1).replace(".", ",")} / 5` })), cur && cur.id, "prc-achats/fournisseurs")
    if (!cur) return split(left, supplierForm())
    const po = P.orders.filter((o) => o.supplier === cur.id)
    const late = po.filter((o) => o.received && o.received > o.expected).length
    const ctr = P.contracts.filter((c) => c.supplier === cur.id)
    return split(left, card("", `<div class="row between"><span class="big">${esc(cur.name)}</span>${cur.contract ? badge(cur.contract, "outline") : ""}</div>
      <div class="form" style="margin:12px 0">
        ${field("s-nif", "N° contribuable", input("s-nif", cur.nif, "disabled"))}${field("s-terms", "Conditions de paiement", input("s-terms", cur.terms))}
        ${field("s-mail", "E-mail commandes", input("s-mail", cur.email))}${field("s-lead", "Délai de livraison (j)", input("s-lead", cur.lead, 'type="number" min="0"'))}
      </div>
      <div class="row">${btn("Enregistrer", `A.prc.saveSupplier(${q(cur.id)})`)}</div>
      <h3>Documents légaux</h3>
      ${tbl(["Document", "Validité", ""], cur.docs.map(([d, v], i) => [esc(d), v === "valide" ? badge("Valide", "outline") : !v ? badge("À fournir", "on") : v < today ? badge(`Expirée le ${fd(v)}`, "on") : `jusqu'au ${fd(v)}/${v.slice(0, 4)}`,
        v === "valide" || (v && v >= addDays(today, 30)) ? "" : btn("Enregistrer le document renouvelé", `A.prc.renewDoc(${q(cur.id)}, ${i})`, "ghost sm")]))}
      ${expiredDocs(cur).length ? `<p class="err">Document légal expiré : aucune nouvelle commande ne peut être envoyée à ce fournisseur.</p>` : ""}
      <h3>Évaluation</h3>
      ${cards([kpi("Note", cur.rating.toFixed(1).replace(".", ",") + " / 5", "qualité, délai, prix"), kpi("Commandes", po.length, "sur la période"), kpi("Livraisons en retard", late, `délai annoncé ${cur.lead} j`)])}
      <div class="row" style="margin-top:8px;flex-wrap:nowrap">${[["ev-q", "Qualité"], ["ev-d", "Délai"], ["ev-p", "Prix"]].map(([id, l]) => `<label for="${id}" style="margin:0">${l}</label>${select(id, ["1", "2", "3", "4", "5"], "4", 'style="max-width:70px"')}`).join("")}${btn("Enregistrer l'évaluation", `A.prc.evaluate(${q(cur.id)})`, "ghost sm")}</div>
      ${(cur.evals || []).length ? `<p class="muted" style="font-size:12px">${cur.evals.map((e) => `${fd(e.date)} : qualité ${e.q}, délai ${e.d}, prix ${e.p}`).join(" · ")}</p>` : ""}
      <h3>Contrats-cadres groupe</h3>
      ${tbl(["Contrat", "Portée", "Période", "Prix négociés", "État"], ctr.map((c) => [esc(c.id) + " " + muted(c.title), esc(c.scope), `${fd(c.from)}/${c.from.slice(2, 4)} → ${fd(c.to)}/${c.to.slice(2, 4)}`,
        esc(c.prices.map((x) => `${IT(x.item).name} : ${money(x.price)}`).join(" ; ")), c.to < today ? badge("Échu", "dark") : c.from > today ? badge("À venir", "outline") : badge("Actif", "on")]), "Aucun contrat-cadre pour ce fournisseur.")}
      <p class="muted" style="font-size:12px">Les prix d'un contrat actif remplacent le prix de référence à la création du bon de commande.</p>
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
        kpi("Lots à consommer sous 3 j", expSoon.length, "denrées périssables"), kpi("Alertes de seuil", P.alerts.filter((a) => !a.done).length, "levées par les ventes et sorties")])
      + subtabs("prc-stocks", [["niveaux", "Niveaux et alertes"], ["mouvements", "Mouvements et transferts"], ["inventaire", "Inventaire"], ["articles", "Articles"], ["kpi", "Indicateurs"]], tab)
      + ({ niveaux: tabLevels, mouvements: tabMoves, inventaire: tabCount, articles: tabItems, kpi: tabKpi }[tab] || tabLevels)(p.slice(1))
  }

  const reorderProposal = () => P.stock.filter((x) => x.min > 0 && x.qty < x.min).map((x) => ({ item: x.item, store: x.store, qty: Math.ceil(x.max - x.qty) }))

  function tabLevels() {
    const store = ui.prcStore || "tous"
    const rows = P.stock.filter((x) => (store === "tous" || x.store === store) && (x.max > 0 || x.qty > 0))
    const prop = reorderProposal()
    const alerts = P.alerts.filter((a) => !a.done)
    return (alerts.length ? card(`Alertes de seuil (${alerts.length})`, tbl(["Date", "Article", "Magasin", "#Stock", "#Seuil", "Origine"], alerts.slice(0, 8).map((a) => [fd(a.date), esc(IT(a.item).name), esc(a.store), a.qty, a.min, esc(a.centre)]))
        + `<div class="row" style="margin-top:8px">${btn("Créer les demandes proposées", "A.prc.reorder()", "sm")}${btn("Marquer comme vues", "A.prc.ackAlerts()", "ghost sm")}</div>`) : "")
      + `<div class="chips">${[["tous", "Tous les magasins"], ...P.stores.map((s) => [s, s])].map(([k, l]) => `<button aria-pressed="${store === k}" onclick="ui.prcStore=${q(k)};render()">${esc(l)}</button>`).join("")}</div>`
      + tbl(["Article", "Magasin", "#Stock", "#Seuil", "#Max", "#Valeur", "Lots / péremption", "État"], rows.map((x) => {
        const it = IT(x.item), low = x.qty < x.min
        return [esc(it.name), esc(x.store), `${x.qty} ${esc(it.unit)}`, x.min, x.max, money(x.qty * it.cost),
          (x.lots || []).map((l) => `${esc(l.lot)} : ${l.qty} au ${fd(l.exp)}${l.exp <= addDays(today, 3) ? " " + badge("Bientôt périmé", "on") : ""}`).join("<br>") || "—",
          x.qty === 0 ? badge("Rupture", "dark") : low ? badge("Sous le seuil", "on") : badge("OK", "outline")]
      }))
      + `<p class="muted">Règle de sortie des denrées : premier périmé, premier sorti ${muted("EF-PRC-010")}</p>`
      + card("Seuils de réapprovisionnement", `<div class="row" style="flex-wrap:nowrap">${select("th-row", P.stock.map((x, i) => [String(i), `${IT(x.item).name} — ${x.store}`]).filter((_, i) => P.stock[i].max > 0 || P.stock[i].qty > 0), ui.prcTh || "0", `onchange="ui.prcTh=this.value;render()"`)}
          ${input("th-min", (P.stock[Number(ui.prcTh || 0)] || {}).min ?? 0, 'type="number" min="0" style="max-width:90px" aria-label="Seuil"')}${input("th-max", (P.stock[Number(ui.prcTh || 0)] || {}).max ?? 0, 'type="number" min="0" style="max-width:90px" aria-label="Maximum"')}${btn("Enregistrer", "A.prc.setThreshold()", "ghost")}</div>
          <p class="muted" style="font-size:12px;margin-bottom:0">Sous le seuil, l'article est proposé à la commande pour revenir au maximum (quantité = max − stock) ${muted("EF-PRC-009")}</p><div id="th-err"></div>`)
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
      + card("Sortie par vente (restaurant, bar, minibar, spa)", `<p class="muted" style="margin-top:0">Les ventes des points de vente appellent <code>A.prc.consume(lignes, centre)</code> : chaque libellé vendu est rapproché d'un article (mot-clé ou catégorie), puis sorti vers le centre de coût, avec alerte de seuil. Sans article correspondant, la ligne est ignorée.</p>
        <div class="row" style="flex-wrap:nowrap">${input("cs-label", "Bière locale 65 cl", 'aria-label="Libellé vendu"')}${input("cs-qty", "2", 'type="number" min="1" style="max-width:80px" aria-label="Quantité"')}${select("cs-cc", ["Restaurant", "Bar", "Minibar", "Spa"], "Bar", 'style="max-width:130px"')}${btn("Simuler la vente", "A.prc.saleTest()", "ghost")}</div>`)
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
      const r = DA(id), sup = val("da-sup"), exp = expiredDocs(SUP(sup))
      if (exp.length) { const el = $("#da-order-err"); if (el) el.innerHTML = `<div class="err">Commande refusée : ${esc(exp.map(([d]) => d).join(", "))} expiré(e) chez ${esc(SUP(sup).name)}. Enregistrez le document renouvelé dans la fiche fournisseur.</div>`; return toast("Fournisseur non conforme : document légal expiré") }
      const lines = r.lines.map((l) => { const c = contractPrice(sup, l.item); return { item: l.item, qty: l.qty, price: c ? c.price : l.price ?? IT(l.item).cost, received: 0, ...(c ? { contract: c.id } : {}) } })
      const o = { id: "BC-0" + P.seq.bc++, supplier: sup, da: id, date: today, expected: addDays(today, SUP(sup).lead), lines, status: "envoyee" }
      P.orders.unshift(o)
      r.status = "commandee"
      const b = P.budgets[r.service]; if (b) b[1] += daTotal(r)
      const nc = lines.filter((l) => l.contract).length
      toast(`${o.id} envoyé à ${SUP(sup).name} (e-mail simulé)${nc ? ` — prix contrat-cadre sur ${nc} ligne(s)` : ""}`)
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
      P.alerts.forEach((a) => (a.done = true))
      const prop = reorderProposal()
      const bySvc = {}
      const svc = (store) => ({ "Économat cuisine": "Cuisine", "Cave / bar": "Bar", "Magasin technique": "Technique", "Réserve spa": "Spa" }[store] || "Hébergement")
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
    createSupplier() {
      const name = val("ns-name"), nif = val("ns-nif"), mail = val("ns-mail")
      const err = (m) => ($("#ns-err").innerHTML = `<div class="err">${esc(m)}</div>`)
      if (!name || !nif) return err("Raison sociale et numéro de contribuable obligatoires.")
      if (P.suppliers.some((x) => x.nif.toLowerCase() === nif.toLowerCase())) return err("Un fournisseur porte déjà ce numéro de contribuable (doublon).")
      if (mail && !/^[^@\s]+@[^@\s]+\.[a-z]+$/i.test(mail)) return err("E-mail invalide.")
      const id = "F-" + String.fromCharCode(64 + P.seq.sup++)
      P.suppliers.push({ id, name, nif, family: val("ns-family") || "Divers", terms: val("ns-terms"), lead: Number(val("ns-lead")) || 0, rating: 3, email: mail, docs: [["RCCM", val("ns-rccm")], ["Attestation de régularité fiscale", val("ns-fisc")]], createdBy: val("ns-by"), iban: "à renseigner (double validation)" })
      toast(`${name} créé — RIB à saisir puis valider par une autre personne`)
      go("prc-achats/fournisseurs/" + id)
    },
    renewDoc(id, i) {
      const s = SUP(id), d = s.docs[i]
      const until = prompt(`${d[0]} renouvelé : valable jusqu'au (AAAA-MM-JJ)`, addDays(today, 365))
      if (!until) return
      if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until <= today) return toast("Date de validité invalide ou déjà passée")
      d[1] = d[0] === "RCCM" ? "valide" : until
      toast(`${d[0]} enregistré pour ${s.name}`)
      render()
    },
    evaluate(id) {
      const s = SUP(id), e = { date: today, q: Number(val("ev-q")), d: Number(val("ev-d")), p: Number(val("ev-p")) }
      ;(s.evals = s.evals || []).unshift(e)
      const all = s.evals.map((x) => (x.q + x.d + x.p) / 3)
      s.rating = Math.round(((s.rating + all.reduce((a, b) => a + b, 0)) / (all.length + 1)) * 10) / 10
      toast(`Évaluation enregistrée — note ${s.rating.toFixed(1).replace(".", ",")} / 5`)
      render()
    },
    setThreshold() {
      const x = P.stock[Number(val("th-row"))], min = Number(val("th-min")), max = Number(val("th-max"))
      if (!x) return
      if (!(min >= 0) || !(max > 0) || min > max) return ($("#th-err").innerHTML = `<div class="err">Le seuil doit être positif et inférieur ou égal au maximum.</div>`)
      Object.assign(x, { min, max })
      toast(`${IT(x.item).name} : seuil ${min}, maximum ${max}${x.qty < min ? " — article proposé à la commande" : ""}`)
      render()
    },
    ackAlerts() { P.alerts.forEach((a) => (a.done = true)); toast("Alertes marquées comme vues"); render() },
    saleTest() {
      const n = A.prc.consume([{ label: val("cs-label"), qty: Number(val("cs-qty")) || 1 }], val("cs-cc"))
      toast(n ? "Vente déstockée : mouvement de sortie enregistré" : "Aucun article de stock ne correspond : ligne ignorée")
      render()
    },
    // API inter-modules (#61) : ventes restaurant, bar, minibar et spa → sortie de stock vers le centre de coût.
    // lines = [{ label, qty, cat? }], centre = "Restaurant" | "Spa" | "Centre de coût …". Renvoie le nombre de lignes déstockées.
    consume(lines, centre) {
      const cc = /^centre de co/i.test(centre || "") ? centre : "Centre de coût " + (centre || "Divers")
      let n = 0
      ;(Array.isArray(lines) ? lines : []).forEach((ln) => {
        const qty = Number(ln && ln.qty) || 0
        const it = ln && qty > 0 ? findItem(ln.label, ln.cat) : null
        if (!it) return
        const s = stockOf(it.code, it.store) || P.stock.find((x) => x.item === it.code)
        if (!s) return
        const out = r2(qty * (it.perSale || 1)), before = s.qty
        s.qty = Math.max(0, r2(s.qty - out))
        if (s.lots) { // premier périmé, premier sorti (EF-PRC-010)
          let rest = out
          s.lots.sort((a, b) => a.exp.localeCompare(b.exp)).forEach((l) => { const t = Math.min(l.qty, rest); l.qty = r2(l.qty - t); rest = r2(rest - t) })
          s.lots = s.lots.filter((l) => l.qty > 0)
        }
        pushMove({ type: "Sortie", item: it.code, qty: out, from: s.store, to: cc, ref: `Vente : ${ln.label} × ${qty}` })
        if ((s.min > 0 && before >= s.min && s.qty < s.min) || (before > 0 && s.qty === 0))
          P.alerts.unshift({ date: today, item: it.code, store: s.store, qty: s.qty, min: s.min, centre: cc, done: false })
        n++
      })
      return n
    },
    // utilisé par d'autres modules (ex. maintenance) pour tracer un besoin
    // recherche d'un article par libellé (utilisée par la maintenance pour les pièces) : null si aucun
    find(label) { const it = findItem(label); if (!it) return null; const s = stockOf(it.code, it.store); return { code: it.code, name: it.name, cost: it.cost, qty: s ? s.qty : 0 } },
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
