// modules/compta.js — Spec §18 Comptabilité et finance (FIN), SYSCOHADA révisé.
// Tous les montants sont des exemples. Banques, opérateurs mobile money, télédéclarations, consolidation et IA sont simulés.
// La facturation client et le city ledger relèvent du module Facturation (fol-*) : ce module n'en reprend que les écritures.
;(() => {
  // ---------- Paramètres et petits utilitaires locaux ----------
  const USERS = { cpt: "Adjoua Koné", chef: "Serge Ouattara", treso: "Mariam Bamba" }
  const ROLE = { [USERS.cpt]: "Comptable", [USERS.chef]: "Chef comptable", [USERS.treso]: "Trésorier" }
  const SEUIL = 1000000 // seuil de validation des écritures manuelles (EF-FIN-006), exemple
  const TVA = 0.18, TAXE_SEJOUR = 1000 // taux d'exemple du moteur fiscal
  const NOV = "2026-11"
  const sum = (a) => a.reduce((s, x) => s + x, 0)
  const mm = (n) => (Math.round(n / 1e5) / 10).toLocaleString("fr-FR") + " M FCFA"
  const num = (n) => (n ? Math.round(n).toLocaleString("fr-FR") : "")
  const ref9 = (s) => `<span class="muted">${esc(s)}</span>`
  const Dr = (a, d, x = {}) => ({ a, d, c: 0, ...x })
  const Cr = (a, c, x = {}) => ({ a, d: 0, c, ...x })
  const htTva = (ttcAmount) => { const ht = Math.round(ttcAmount / (1 + TVA)); return [ht, ttcAmount - ht] }
  const mIdx = (s) => +s.slice(0, 4) * 12 + +s.slice(5, 7) - 1
  const daysBetween = (a, b) => Math.round((day(b) - day(a)) / 864e5)
  ui.finUser = USERS.cpt
  ui.finJ = "tous"
  ui.finCls = "tous"
  ui.finBalCls = "tous"
  ui.finTiers = null
  ui.finEntity = "HEX"

  const SECTIONS = [["HEB", "Hébergement"], ["RES", "Restauration"], ["SPA", "Spa"], ["BLN", "Blanchisserie"], ["ADM", "Administration et général"], ["COM", "Ventes et marketing"], ["MNT", "Maintenance"], ["ENE", "Énergie"]]
  const ANA = { "7061": "HEB", "7062": "RES", "701": "RES", "7063": "SPA", "7064": "BLN", "601": "RES", "602": "RES", "6032": "RES", "604": "HEB", "605": "ENE", "624": "MNT", "625": "ADM", "631": "ADM", "632": "COM", "641": "ADM", "661": "ADM", "664": "ADM" }
  const CLASSES = { 1: "Ressources durables", 2: "Actif immobilisé", 3: "Stocks", 4: "Tiers", 5: "Trésorerie", 6: "Charges des activités ordinaires", 7: "Produits des activités ordinaires", 8: "Charges et produits HAO", 9: "Engagements hors bilan et analytique" }

  // ---------- Données d'exemple ----------
  // Plan SYSCOHADA révisé (extrait). Drapeaux : L lettrable, T tiers obligatoire, A analytique obligatoire (RG-FIN-05).
  const accounts = [
    ["101", "Capital social"], ["111", "Réserve légale"], ["121", "Report à nouveau"], ["131", "Résultat net de l'exercice"], ["162", "Emprunts auprès des établissements de crédit"],
    ["213", "Logiciels et licences"], ["2311", "Bâtiments (approche par composants)"], ["2341", "Installations techniques"], ["244", "Matériel et mobilier"], ["245", "Matériel de transport"],
    ["2813", "Amortissements des logiciels"], ["2831", "Amortissements des bâtiments"], ["2834", "Amortissements des installations techniques"], ["2844", "Amortissements du matériel et mobilier"], ["2845", "Amortissements du matériel de transport"],
    ["311", "Marchandises (boissons)"], ["321", "Matières premières (denrées)"],
    ["401", "Fournisseurs", "LT"], ["4081", "Fournisseurs, factures non parvenues"], ["411", "Clients", "LT"], ["422", "Personnel, rémunérations dues", "L"], ["4281", "Dettes provisionnées pour congés à payer"], ["431", "Sécurité sociale (CNPS)"],
    ["4431", "État, TVA facturée"], ["4441", "État, TVA due"], ["4452", "État, TVA récupérable sur achats"], ["447", "État, impôts retenus à la source"], ["4471", "Taxe de séjour collectée à reverser"],
    ["4711", "Compte d'attente PSP (cartes)", "L"], ["476", "Charges constatées d'avance"], ["491", "Dépréciations des comptes clients"],
    ["5211", "Banque Exemple Plateau — compte courant"], ["5212", "Banque Exemple Cocody — compte courant"], ["5521", "Mobile money — Orange Money (simulé)"], ["5522", "Mobile money — MTN MoMo (simulé)"], ["5523", "Mobile money — Wave (simulé)"], ["571", "Caisse principale"], ["585", "Virements de fonds"],
    ["601", "Achats de marchandises", "A"], ["602", "Achats de matières premières", "A"], ["6032", "Variation des stocks de matières premières", "A"], ["604", "Achats de fournitures (produits d'accueil)", "A"], ["605", "Autres achats (eau, électricité)", "A"],
    ["624", "Entretien, réparations et maintenance", "A"], ["625", "Primes d'assurance", "A"], ["631", "Frais bancaires", "A"], ["632", "Rémunérations d'intermédiaires (commissions OTA)", "A"], ["641", "Impôts et taxes", "A"],
    ["661", "Rémunérations directes du personnel", "A"], ["664", "Charges sociales", "A"], ["671", "Intérêts des emprunts"], ["681", "Dotations aux amortissements d'exploitation"], ["6594", "Charges provisionnées sur créances"],
    ["701", "Ventes de marchandises (boissons)", "A"], ["7061", "Services vendus — hébergement", "A"], ["7062", "Services vendus — restauration", "A"], ["7063", "Services vendus — spa", "A"], ["7064", "Services vendus — blanchisserie et pressing", "A"], ["758", "Produits divers"],
    ["812", "Valeurs comptables des cessions d'immobilisations"], ["822", "Produits des cessions d'immobilisations"],
    ["9061", "Section analytique Hébergement"], ["9062", "Section analytique Restauration"], ["9063", "Section analytique Spa"], ["9064", "Section analytique Blanchisserie"], ["9065", "Section analytique Frais généraux"],
  ].map(([n, label, f = ""]) => ({ num: n, label, cls: n[0], lett: f.includes("L"), tiers: f.includes("T"), ana: f.includes("A"), custom: false }))

  const tiersList = [
    { id: "CL-01", type: "Client", name: "Société Ivoirienne Exemple", acc: "411", terms: "30 jours fin de mois" },
    { id: "CL-02", type: "Client", name: "Agence Akwaba Voyages Exemple", acc: "411", terms: "45 jours" },
    { id: "CL-03", type: "Client", name: "ONG Lagune Solidarité Exemple", acc: "411", terms: "30 jours" },
    { id: "CL-PAS", type: "Client", name: "Clients de passage (folios)", acc: "411", terms: "Comptant" },
    { id: "FO-A", type: "Fournisseur", name: "Ets Kouassi & Fils (exemple)", acc: "401", terms: "30 jours", what: "Denrées et boissons" },
    { id: "FO-B", type: "Fournisseur", name: "Énergie Lagune Exemple", acc: "401", terms: "30 jours", what: "Énergie" },
    { id: "FO-C", type: "Fournisseur", name: "Hygiène Plus Yopougon Exemple", acc: "401", terms: "30 jours", what: "Produits d'accueil et blanchisserie" },
    { id: "FO-D", type: "Fournisseur", name: "Froid Clim Treichville Exemple", acc: "401", terms: "15 jours", what: "Maintenance climatisation" },
  ]

  // Registre des immobilisations (approche par composants pour le bâtiment), amortissement linéaire
  const assets = [
    { id: "IMM-01", label: "Bâtiment principal — gros œuvre", acc: "2311", amo: "2831", base: 300000000, years: 40, start: "2018-01-01", parent: "Bâtiment principal" },
    { id: "IMM-02", label: "Bâtiment principal — toiture et étanchéité", acc: "2311", amo: "2831", base: 60000000, years: 20, start: "2018-01-01", parent: "Bâtiment principal" },
    { id: "IMM-03", label: "Bâtiment principal — aménagements intérieurs", acc: "2311", amo: "2831", base: 60000000, years: 10, start: "2018-01-01", parent: "Bâtiment principal" },
    { id: "IMM-04", label: "Climatisation centrale", acc: "2341", amo: "2834", base: 38000000, years: 10, start: "2020-01-01" },
    { id: "IMM-05", label: "Groupe électrogène", acc: "2341", amo: "2834", base: 26000000, years: 10, start: "2020-01-01" },
    { id: "IMM-06", label: "Mobilier des chambres", acc: "244", amo: "2844", base: 30000000, years: 8, start: "2021-01-01" },
    { id: "IMM-07", label: "Équipement de cuisine", acc: "244", amo: "2844", base: 18000000, years: 8, start: "2022-01-01" },
    { id: "IMM-08", label: "Minibus navette aéroport", acc: "245", amo: "2845", base: 22000000, years: 5, start: "2023-07-01", fiscal: "Dégressif (plan fiscal, simulé)" },
    { id: "IMM-09", label: "Logiciels et licences", acc: "213", amo: "2813", base: 3600000, years: 3, start: "2025-01-01" },
  ].map((a) => ({ ...a, status: "En service" }))
  const monthly = (a) => Math.round(a.base / a.years / 12)
  const cumulAt = (a, d) => Math.min(a.base, Math.max(0, mIdx(d) - mIdx(a.start)) * monthly(a))
  const byAmo = (fn) => { const o = {}; assets.forEach((a) => (o[a.amo] = (o[a.amo] || 0) + fn(a))); return o }

  // Écritures d'exemple
  let eSeq = 1
  const E = (j, date, piece, label, src, lines, x = {}) => ({ id: "E" + eSeq++, j, date, piece, label, src, lines, status: "validee", by: src === "Manuel" ? USERS.cpt : "Système", ...x })
  const bases = {}; assets.forEach((a) => (bases[a.acc] = (bases[a.acc] || 0) + a.base))
  const an = [
    ...Object.entries(bases).map(([a, v]) => Dr(a, v)),
    Dr("311", 1400000), Dr("321", 1900000), Dr("411", 1600000, { t: "CL-03", piece: "FA-0874", ech: "2025-11-30" }),
    Dr("5211", 18500000), Dr("5212", 4200000), Dr("571", 650000), Dr("5521", 380000),
    ...Object.entries(byAmo((a) => cumulAt(a, "2026-01-01"))).map(([a, v]) => Cr(a, v)),
    Cr("101", 200000000), Cr("111", 12000000), Cr("162", 120000000),
  ]
  const gap = sum(an.map((l) => l.d - l.c)); an.push(gap >= 0 ? Cr("121", gap) : Dr("121", -gap))
  const rev = { "7061": 158000000, "7062": 64000000, "7063": 12000000, "7064": 4500000, "701": 18000000 }
  const exp = { "601": 7200000, "602": 23000000, "604": 6500000, "605": 21000000, "624": 8400000, "632": 11800000, "641": 3600000, "661": 68000000, "664": 10900000, "671": 7600000 }
  const amY = byAmo((a) => cumulAt(a, "2026-11-01") - cumulAt(a, "2026-01-01"))
  const cumul = [
    ...Object.entries(rev).map(([a, v]) => Cr(a, v, { ana: ANA[a] })), ...Object.entries(exp).map(([a, v]) => Dr(a, v, { ana: ANA[a] })),
    Dr("681", sum(Object.values(amY))), ...Object.entries(amY).map(([a, v]) => Cr(a, v)),
    Dr("162", 12500000), Dr("5211", sum(Object.values(rev)) - sum(Object.values(exp)) - 12500000),
  ]
  const fa = (ttcAmount, revAcc, t, piece, ech) => { const [ht, tv] = htTva(ttcAmount); return [Dr("411", ttcAmount, { t, piece, ech }), Cr(revAcc, ht, { ana: ANA[revAcc] }), Cr("4431", tv)] }
  const ff = (ttcAmount, chAcc, t, piece, ech) => { const [ht, tv] = htTva(ttcAmount); return [Dr(chAcc, ht, { ana: ANA[chAcc] }), Dr("4452", tv), Cr("401", ttcAmount, { t, piece, ech })] }
  const novRev = { "7061": 13450000, "7062": 5380000, "7063": 920000, "7064": 360000, "701": 1540000 }
  const novHT = sum(Object.values(novRev)), novTva = Math.round(novHT * TVA), novTs = 288000
  const entries = [
    E("AN", "2026-01-01", "AN-2026", "À-nouveaux de l'exercice 2026", "Clôture 2025", an),
    E("OD", "2026-10-31", "CENT-01-10", "Centralisation janvier–octobre (synthèse d'exemple)", "Reprise", cumul),
    E("VT", "2026-09-15", "FA-0998", "Agence Akwaba Voyages Exemple — groupe de septembre", "FOL", fa(850000, "7061", "CL-02", "FA-0998", "2026-10-30")),
    E("VT", "2026-10-08", "FA-1012", "Société Ivoirienne Exemple — séminaire", "FOL", fa(3200000, "7062", "CL-01", "FA-1012", "2026-11-07")),
    E("VT", "2026-10-20", "FA-1027", "Agence Akwaba Voyages Exemple — groupe d'octobre", "FOL", fa(1900000, "7061", "CL-02", "FA-1027", "2026-12-04")),
    E("AC", "2026-10-12", "FC-C-551", "Hygiène Plus Yopougon Exemple — produits d'accueil", "PRC", ff(2400000, "604", "FO-C", "FC-C-551", "2026-11-11")),
    E("VT", "2026-11-24", "AUD-0124", "Audits de nuit du 01 au 24/11 (centralisation)", "FOF", [Dr("411", novHT + novTva + novTs, { t: "CL-PAS", let: "P" }), ...Object.entries(novRev).map(([a, v]) => Cr(a, v, { ana: ANA[a] })), Cr("4431", novTva), Cr("4471", novTs)]),
    E("CA", "2026-11-24", "ENC-0124", "Encaissements des folios du 01 au 24/11", "FOL", [Dr("4711", 14200000), Dr("5521", 3100000), Dr("5522", 1250000), Dr("5523", 980000), Dr("571", novHT + novTva + novTs - 400000 - 19530000), Cr("411", novHT + novTva + novTs - 400000, { t: "CL-PAS", let: "P" })]),
    E("AC", "2026-11-03", "FB-2026-311", "Énergie Lagune Exemple — électricité d'octobre", "PRC", ff(2000000, "605", "FO-B", "FB-2026-311", "2026-12-03")),
    E("AC", "2026-11-18", "FA-A-1187", "Ets Kouassi & Fils (exemple) — denrées", "PRC", ff(1850000, "602", "FO-A", "FA-A-1187", "2026-12-18")),
    E("BQA", "2026-11-05", "PSP-0411", "Remise cartes PSP du 01 au 04/11", "FOL", [Dr("5211", 2350000), Cr("4711", 2350000)]),
    E("BQA", "2026-11-09", "VIR-1109", "Virement reçu Société Ivoirienne Exemple (FA-1012)", "Banque", [Dr("5211", 3200000), Cr("411", 3200000, { t: "CL-01", piece: "FA-1012" })]),
    E("BQA", "2026-11-10", "VIR-1110", "Règlement Hygiène Plus Yopougon Exemple (FC-C-551)", "PRC", [Dr("401", 2400000, { t: "FO-C", piece: "FC-C-551" }), Cr("5211", 2400000)]),
    E("BQA", "2026-11-14", "VIR-1114", "Règlement partiel Agence Akwaba Voyages Exemple (FA-0998)", "Banque", [Dr("5211", 500000), Cr("411", 500000, { t: "CL-02", piece: "FA-0998" })]),
    E("BQA", "2026-11-15", "PRET-11", "Échéance d'emprunt de novembre", "Banque", [Dr("162", 1250000), Dr("671", 580000), Cr("5211", 1830000)]),
    E("BQA", "2026-11-19", "PSP-1911", "Remise cartes PSP du 05 au 18/11", "FOL", [Dr("5211", 8600000), Cr("4711", 8600000)]),
    E("CA", "2026-11-20", "DEP-1120", "Dépôt d'espèces en banque", "Manuel", [Dr("585", 4000000), Cr("571", 4000000)]),
    E("BQA", "2026-11-21", "DEP-1120", "Dépôt d'espèces reçu en banque", "Manuel", [Dr("5211", 4000000), Cr("585", 4000000)]),
    E("OD", "2026-11-22", "OD-PRIME-27", "Prime d'assurance multirisque 2027 payée d'avance", "Manuel", [Dr("476", 1450000), Cr("625", 1450000, { ana: "ADM" })], { status: "a_valider" }),
    E("OD", "2026-11-25", "OD-RECL-01", "Reclassement d'une commission OTA", "Manuel", [Dr("632", 85000, { ana: "COM" }), Cr("631", 85000, { ana: "ADM" })], { status: "brouillard" }),
  ]
  entries.sort((a, b) => a.date.localeCompare(b.date))
  const seqs = {}
  entries.forEach((e) => e.status === "validee" && (e.no = seqs[e.j] = (seqs[e.j] || 0) + 1))

  // Évènements des autres modules en attente de comptabilisation (EF-FIN-004)
  const events = [
    { id: "EV-1", src: "FOF", ev: "fof.night-audit.completed", label: "Audit de nuit du 25/11 — nuitées et taxes", j: "VT", date: "2026-11-25", kind: "night" },
    { id: "EV-2", src: "FOL", ev: "fol.payment.*", label: "Encaissements du 25/11 (carte, mobile money, espèces)", j: "CA", date: "2026-11-25", kind: "pay" },
    { id: "EV-3", src: "PRC", ev: "prc.supplier-invoice.approved", label: "Facture FA-A-1203 approuvée — Ets Kouassi & Fils (exemple) (boissons)", j: "AC", date: "2026-11-25", kind: "prc" },
    { id: "EV-4", src: "PRC", ev: "prc.goods.received", label: "Consommations de stock cuisine — semaine 47", j: "OD", date: "2026-11-25", kind: "stock" },
    { id: "EV-5", src: "BLN", ev: "bln.service.billed", label: "Prestations pressing clients du 25/11", j: "VT", date: "2026-11-25", kind: "bln" },
    { id: "EV-6", src: "HRM", ev: "hrm.payroll.closed", label: "Paie de novembre clôturée", j: "PA", date: "2026-11-30", kind: "paie" },
    { id: "EV-7", src: "FIN", ev: "fin.depreciation.run", label: "Dotations aux amortissements de novembre", j: "OD", date: "2026-11-30", kind: "depr" },
    { id: "EV-8", src: "FOL", ev: "fol.refund.issued", label: "Remboursement carte — séjour R-2046", j: "CA", date: "2026-11-25", kind: "refund", err: "Le schéma ne fournit pas de compte de tiers pour la ligne 411 (RG-FIN-05)." },
  ].map((e) => ({ ...e, status: "en_attente" }))

  // Relevé bancaire importé (format CAMT.053, simulé) — Banque Exemple Plateau
  const stmt = [
    ["S1", "2026-11-06", "REMISE CB PSP EXEMPLE 0411", 2350000], ["S2", "2026-11-09", "VIR RECU SOCIETE IVOIRIENNE EXEMPLE", 3200000],
    ["S3", "2026-11-11", "VIR EMIS HYGIENE PLUS YOPOUGON", -2400000], ["S4", "2026-11-14", "VIR RECU AG AKWABA VOYAGES", 500000],
    ["S5", "2026-11-15", "PRLV ECHEANCE PRET 0042", -1830000], ["S6", "2026-11-20", "REMISE CB PSP EXEMPLE 1911", 8600000],
    ["S7", "2026-11-24", "VERSEMENT ESPECES AG. PLATEAU", 4000000], ["S8", "2026-11-25", "FRAIS TENUE DE COMPTE NOV", -15000],
    ["S9", "2026-11-25", "COMMISSION VIREMENT EMIS", -2500],
  ].map(([id, date, label, amt]) => ({ id, date, label, amt, m: null, how: null, sug: null }))

  const supInv = [
    { id: "FF-01", t: "FO-B", no: "FB-2026-311", date: "2026-11-03", ech: "2026-12-03", ttc: 2000000, check: "Contrat sans commande", ok: true, status: "a_payer" },
    { id: "FF-02", t: "FO-A", no: "FA-A-1187", date: "2026-11-18", ech: "2026-12-18", ttc: 1850000, check: "Conforme (commande, réception, facture)", ok: true, status: "a_payer" },
    { id: "FF-03", t: "FO-C", no: "FC-C-551", date: "2026-10-12", ech: "2026-11-11", ttc: 2400000, check: "Conforme (commande, réception, facture)", ok: true, status: "payee" },
    { id: "FF-04", t: "FO-A", no: "FA-A-1188", date: "2026-11-19", ech: "2026-12-19", ttc: 1850000, check: "Doublon probable de FA-A-1187", ok: false, status: "bloquee" },
  ]

  window.PROTOTYPE_DATA.fin = {
    entities: [
      { code: "HEX", name: "Hôtel Exemple SARL", cur: "XOF", ref: "SYSCOHADA révisé", fy: "Exercice 2026 (janv.–déc.)" },
      { code: "SER", name: "Restauration Lagune Exemple SARL", cur: "XOF", ref: "SYSCOHADA révisé", fy: "Exercice 2026 (janv.–déc.)" },
      { code: "SEP", name: "Société Exemple Paris SAS", cur: "EUR", ref: "PCG français", fy: "Exercice 2026 (janv.–déc.)" },
    ],
    accounts, tiers: tiersList, assets, entries, events, stmt, supInv,
    journals: [
      { code: "VT", label: "Ventes", type: "Ventes" }, { code: "AC", label: "Achats", type: "Achats" },
      { code: "BQA", label: "Banque Exemple Plateau", type: "Banque", must: "5211" }, { code: "BQB", label: "Banque Exemple Cocody", type: "Banque", must: "5212" },
      { code: "CA", label: "Caisse et encaissements", type: "Caisse" }, { code: "MM", label: "Mobile money", type: "Trésorerie", must: "552" },
      { code: "PA", label: "Paie", type: "Paie" }, { code: "OD", label: "Opérations diverses", type: "Opérations diverses" },
      { code: "AN", label: "À-nouveaux", type: "À-nouveaux", auto: true },
    ],
    periods: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`2026-${String(i + 1).padStart(2, "0")}`, i < 10 ? "cloturee" : "ouverte"])),
    closeManual: { lettrage: false, stocks: true, devises: true, budget: false },
    proposals: [
      { id: "P1", label: "Provision pour congés payés de novembre", why: "Droits acquis du mois par 38 salariés (paie HRM)", lines: [Dr("661", 1850000, { ana: "ADM" }), Cr("4281", 1850000)], step: "paie", done: false },
      { id: "P2", label: "Dépréciation de la créance ONG Lagune Solidarité Exemple (FA-0874, échue depuis plus de 360 jours)", why: "Base HT de la créance, aucune réponse aux 3 relances", lines: [Dr("6594", 1355932), Cr("491", 1355932)], step: "provision", done: false },
      { id: "P3", label: "Charge à payer : eau de novembre (facture non parvenue)", why: "Moyenne des 3 derniers mois, extourne automatique au 01/12", lines: [Dr("605", 420000, { ana: "ENE" }), Cr("4081", 420000)], step: "cap", done: false },
    ],
    anomalies: [
      { id: "AN1", text: "Doublon probable : FA-A-1188 (Ets Kouassi & Fils, exemple) reprend le montant de FA-A-1187 à un jour d'écart. Paiement bloqué.", route: "fin-tiers/fournisseurs", open: true },
      { id: "AN2", text: "Écriture manuelle au-dessus du seuil saisie un dimanche à 23 h 40 (pièce OD-PRIME-27).", route: "fin-compta/journaux", open: true },
      { id: "AN3", text: "Imputation inhabituelle : une commission OTA reclassée en frais bancaires (brouillon OD-RECL-01).", route: "fin-compta/journaux", open: true },
      { id: "AN4", text: "Taux de TVA déductible différent de l'historique du fournisseur Énergie Lagune Exemple : à vérifier dans le moteur fiscal.", route: "fin-fiscal/moteur", open: true },
    ],
    taxReturns: [
      { id: "TX-1", type: "TVA", period: "Octobre 2026", amount: 2140000, status: "Déposée", ack: "ACK-EXEMPLE-1015", due: "2026-11-15" },
      { id: "TX-2", type: "Taxe de séjour", period: "Octobre 2026", amount: 296000, status: "Déposée", ack: "ACK-EXEMPLE-1016", due: "2026-11-15" },
      { id: "TX-3", type: "Retenues à la source", period: "Octobre 2026", amount: 690000, status: "Déposée", ack: "ACK-EXEMPLE-1017", due: "2026-11-15" },
    ],
    usali: [
      // dép., recettes, coûts, budget recettes, budget coûts — mois de novembre au 26/11, exemple
      { d: "Hébergement", rev: 14200000, cost: 3900000, brev: 15000000, bcost: 3800000 },
      { d: "Restauration", rev: 7300000, cost: 5100000, brev: 6800000, bcost: 4700000 },
      { d: "Spa", rev: 1000000, cost: 620000, brev: 1300000, bcost: 700000 },
      { d: "Blanchisserie", rev: 400000, cost: 280000, brev: 350000, bcost: 260000 },
    ],
    undistributed: [
      { d: "Administration et général", cost: 2400000, bcost: 2300000 }, { d: "Ventes et marketing", cost: 1100000, bcost: 1200000 },
      { d: "Maintenance", cost: 900000, bcost: 750000 }, { d: "Énergie", cost: 2100000, bcost: 1900000 },
    ],
    budgetVersions: ["V1 initiale (verrouillée)", "V2 révisée en juin"], budgetV: "V2 révisée en juin",
    budgetDec: { "Hébergement": 17500000, "Restauration": 8200000, "Spa": 1400000, "Blanchisserie": 380000 },
    comments: [
      { d: "Restauration", text: "Recettes au-dessus du budget (+7 %) grâce au séminaire Société Ivoirienne Exemple ; coûts matière en hausse de 8,5 %, ratio coût matière à surveiller.", status: "proposé" },
      { d: "Spa", text: "Recettes 23 % sous le budget : deux semaines de fermeture partielle pour maintenance de la cabine 2.", status: "proposé" },
      { d: "Énergie", text: "Dépassement de 10,5 % lié au groupe électrogène pendant les délestages de la semaine 46.", status: "proposé" },
    ],
    conso: null, dsfPreview: null, closedNov: null,
    ocr: { status: "à valider", file: "facture-FD-0457.pdf (reçue par e-mail, exemple)", t: "FO-D", no: "FD-0457", date: "2026-11-22", ech: "2026-12-07", ttc: 708000, acc: "624", ana: "MNT", conf: 94 },
  }
  const F = D.fin

  // ---------- Accès comptables ----------
  const acc = (n) => F.accounts.find((a) => a.num === n)
  const accLabel = (n) => (acc(n) || { label: "Compte inconnu" }).label
  const tiers = (id) => F.tiers.find((t) => t.id === id)
  const tname = (id) => (id ? (tiers(id) || { name: id }).name : "")
  const posted = () => F.entries.filter((e) => e.status === "validee")
  const allLines = (pred = () => true) => posted().flatMap((e) => e.lines.map((l, i) => ({ ...l, e, i }))).filter(pred)
  const bal = (prefix, to = "9999", from = "0000") => sum(allLines((l) => l.a.startsWith(prefix) && l.e.date <= to && l.e.date >= from).map((l) => l.d - l.c))
  const ref = (e) => (e.no ? `${e.j}26-${String(e.no).padStart(4, "0")}` : e.status === "brouillard" ? "Brouillard" : "En attente")
  const total = (e) => sum(e.lines.map((l) => +l.d || 0))
  const nextNo = (j) => Math.max(0, ...F.entries.filter((e) => e.j === j && e.no).map((e) => e.no)) + 1
  const postEntry = (e) => { e.status = "validee"; e.no = nextNo(e.j); return e }
  const addEntry = (o) => { const e = { id: uid("E"), by: ui.finUser, status: "validee", ...o }; F.entries.push(e); if (e.status === "validee") postEntry(e); return e }
  const periodOf = (date) => F.periods[(date || "").slice(0, 7)]
  const ST = { validee: ["Validée", "on"], a_valider: ["À valider", "outline"], brouillard: ["Brouillard", ""] }
  const stBadge = (e) => badge(ST[e.status][0], ST[e.status][1]) + (e.revBy ? " " + badge("Extournée", "dark") : "") + (e.revOf ? " " + badge("Extourne", "outline") : "")
  const accLink = (n) => `<button class="link" onclick="go('fin-compta/grandlivre/${esc(n)}')">${esc(n)}</button>`
  const entryLink = (e) => `<button class="link" onclick="go('fin-compta/journaux/${esc(e.id)}')">${esc(ref(e))}</button>`
  const treasury = () => bal("52") + bal("55") + bal("57")
  const tiersBal = (id) => sum(allLines((l) => l.t === id).map((l) => l.d - l.c))

  // ---------- Rapprochement ----------
  const bankLines = () => allLines((l) => l.a === "5211" && l.e.date >= "2026-11-01")
  const lineKey = (l) => `${l.e.id}:${l.i}`
  const matchedKeys = () => new Set(F.stmt.filter((s) => s.m).map((s) => s.m))
  const autoRate = () => (F.stmt.length ? (F.stmt.filter((s) => s.how === "auto").length / F.stmt.length) * 100 : 0)

  // ---------- Écritures automatiques (schémas paramétrables, §18.14) ----------
  const build = {
    night() {
      const ih = D.reservations.filter((r) => ["arrivee", "partie"].includes(r.status) && r.from <= "2026-11-25" && "2026-11-25" < r.to)
      const ht = sum(ih.map((r) => r.rate)), tv = Math.round(ht * TVA), ts = ih.length * TAXE_SEJOUR
      return [Dr("411", ht + tv + ts, { t: "CL-PAS" }), Cr("7061", ht, { ana: "HEB" }), Cr("4431", tv), Cr("4471", ts)]
    },
    pay: () => [Dr("4711", 186000), Dr("5521", 45000), Dr("571", 60000), Cr("411", 291000, { t: "CL-PAS" })],
    prc: () => ff(849600, "601", "FO-A", "FA-A-1203", "2026-12-26"),
    stock: () => [Dr("6032", 640000, { ana: "RES" }), Cr("321", 640000)],
    bln: () => [Dr("411", 53100, { t: "CL-PAS" }), Cr("7064", 45000, { ana: "BLN" }), Cr("4431", 8100)],
    paie: () => [Dr("661", 6900000, { ana: "ADM" }), Dr("664", 1100000, { ana: "ADM" }), Cr("422", 5600000), Cr("431", 1650000), Cr("447", 750000)],
    depr() {
      const o = {}; F.assets.filter((a) => a.status === "En service" && cumulAt(a, "2026-11-01") < a.base).forEach((a) => (o[a.amo] = (o[a.amo] || 0) + monthly(a)))
      return [Dr("681", sum(Object.values(o))), ...Object.entries(o).map(([a, v]) => Cr(a, v))]
    },
    refund: () => [Dr("411", 10000, { t: "CL-PAS" }), Cr("4711", 10000)],
  }
  const deprDone = () => F.events.find((e) => e.kind === "depr").status === "generee"

  // ---------- Balance âgée (imputation FIFO des règlements non lettrés) ----------
  const aged = (id) => {
    const ls = allLines((l) => l.t === id && !l.let)
    const debits = ls.filter((l) => l.d > 0).map((l) => ({ ech: l.ech || l.e.date, v: l.d })).sort((a, b) => a.ech.localeCompare(b.ech))
    let credit = sum(ls.map((l) => l.c))
    const b = [0, 0, 0, 0, 0]
    debits.forEach((x) => {
      const used = Math.min(credit, x.v); credit -= used
      const rest = x.v - used, late = daysBetween(x.ech, today)
      if (rest > 0) b[late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4] += rest
    })
    b[0] -= credit
    return b
  }

  // ---------- Clôture mensuelle ----------
  const closeSteps = () => {
    const pendEv = F.events.filter((e) => e.status !== "generee").length
    const unmatched = F.stmt.filter((s) => !s.m).length
    const pendMan = F.entries.filter((e) => e.date.startsWith(NOV) && e.status !== "validee").length
    const p = (id) => F.proposals.find((x) => x.id === id).done
    return [
      { k: "audit", label: "Audits de nuit de la période terminés", who: "Système (FOF)", done: true, auto: true, note: "01 au 25/11 terminés" },
      { k: "auto", label: "Écritures automatiques de tous les modules passées", who: "Comptable", done: pendEv === 0, auto: true, note: pendEv ? `${pendEv} évènement(s) en attente` : "Aucun évènement en attente", route: "fin-compta/auto" },
      { k: "rappro", label: "Rapprochements bancaires, mobile money et caisses", who: "Trésorier", done: unmatched === 0, auto: true, note: unmatched ? `${unmatched} ligne(s) de relevé non rapprochée(s)` : "Relevés rapprochés", route: "fin-treso/rappro" },
      { k: "lettrage", label: "Lettrage clients et fournisseurs, revue de la balance âgée", who: "Comptable", done: F.closeManual.lettrage, route: "fin-tiers/clients" },
      { k: "provision", label: "Provisions pour créances douteuses", who: "Chef comptable", done: p("P2"), auto: true, note: "Proposition de l'assistant ci-dessous" },
      { k: "stocks", label: "Inventaire des stocks et valorisation (PRC)", who: "Contrôleur de gestion", done: F.closeManual.stocks },
      { k: "paie", label: "Paie clôturée et provision pour congés payés", who: "Comptable", done: F.events.find((e) => e.kind === "paie").status === "generee" && p("P1"), auto: true, note: "Évènement paie + proposition P1" },
      { k: "depr", label: "Dotations aux amortissements", who: "Comptable", done: deprDone(), auto: true, route: "fin-immo" },
      { k: "cap", label: "Charges à payer, produits à recevoir, constatés d'avance", who: "Comptable", done: p("P3") && pendMan === 0, auto: true, note: pendMan ? `${pendMan} écriture(s) manuelle(s) non validée(s)` : "Écritures manuelles validées", route: "fin-compta/journaux" },
      { k: "devises", label: "Réévaluation des comptes en devises", who: "Comptable", done: F.closeManual.devises, note: "Aucun compte en devise sur l'entité" },
      { k: "budget", label: "Revue analytique et budgétaire", who: "Contrôleur de gestion", done: F.closeManual.budget, route: "fin-gestion/usali" },
    ]
  }

  // ---------- États financiers ----------
  const resultat = (to = "9999", from = "0000") => -(bal("7", to, from) + bal("8", to, from) + bal("6", to, from))
  const accBalances = (filter = () => true) => {
    const o = {}
    allLines(filter).forEach((l) => (o[l.a] = (o[l.a] || 0) + l.d - l.c))
    return o
  }
  const bilan = (filter) => {
    const b = accBalances(filter), A = {}, P = {}
    const add = (m, k, v) => (m[k] = (m[k] || 0) + v)
    Object.entries(b).forEach(([n, v]) => {
      const c = n[0]
      if (c === "2") add(A, n.startsWith("21") || n.startsWith("281") ? "Immobilisations incorporelles" : "Immobilisations corporelles", v)
      else if (c === "3") add(A, "Stocks", v)
      else if (n.startsWith("411") || n.startsWith("491")) add(A, "Créances clients", v)
      else if (c === "4") v >= 0 ? add(A, "Autres créances", v) : add(P, n.startsWith("40") ? "Fournisseurs" : n.startsWith("42") || n.startsWith("43") || n.startsWith("44") ? "Dettes fiscales et sociales" : "Autres dettes", -v)
      else if (c === "5") v >= 0 ? add(A, "Trésorerie — actif", v) : add(P, "Trésorerie — passif", -v)
      else if (n === "101") add(P, "Capital", -v)
      else if (n.startsWith("11")) add(P, "Réserves", -v)
      else if (n.startsWith("12")) add(P, "Report à nouveau", -v)
      else if (n.startsWith("16")) add(P, "Emprunts et dettes financières", -v)
    })
    const res = -sum(Object.entries(b).filter(([n]) => "678".includes(n[0])).map(([, v]) => v))
    if (res) P["Résultat net de l'exercice"] = res
    return { A, P, tA: sum(Object.values(A)), tP: sum(Object.values(P)) }
  }
  const controls = () => {
    const ls = allLines(), d = sum(ls.map((l) => l.d)), c = sum(ls.map((l) => l.c)), b = bilan()
    return { balOk: d === c, bilOk: b.tA === b.tP, d, c, b }
  }

  // ---------- Prévision de trésorerie 13 semaines ----------
  const forecast = () => {
    let solde = treasury()
    const start = "2026-11-30"
    return Array.from({ length: 13 }, (_, w) => {
      const from = addDays(start, w * 7), to = addDays(from, 6)
      const inWeek = (d) => d >= from && d <= to
      const season = from >= "2026-12-14" && from <= "2027-01-03" ? 1.3 : from >= "2027-01-04" ? 0.85 : 1
      const resa = sum(D.reservations.filter((r) => r.status === "confirmee" && inWeek(r.from)).map((r) => r.rate * nights(r.from, r.to) * (1 + TVA)))
      const inflow = Math.round(6200000 * season + resa)
      const sup = sum(F.supInv.filter((s) => ["a_payer", "proposee"].includes(s.status) && inWeek(s.ech)).map((s) => s.ttc))
      let out = 1400000 + sup
      const notes = []
      for (let d = from; d <= to; d = addDays(d, 1)) {
        if (d.endsWith("-15")) { out += 1830000 + 3200000 + 1650000; notes.push("emprunt, TVA, CNPS") }
        if (addDays(d, 1).endsWith("-01")) { out += 5600000; notes.push("salaires") }
      }
      solde += inflow - out
      return { from, inflow, out, solde, notes }
    })
  }

  // ---------- Vues ----------
  const userBar = () => `<div class="row" style="gap:6px"><label for="fin-user" style="margin:0">Profil</label>${select("fin-user", Object.keys(ROLE).map((u) => [u, `${u} (${ROLE[u]})`]), ui.finUser, `onchange="A.fin.setUser(this.value)" style="width:auto"`)}</div>`
  const views = {
    // Tableau de bord financier — KPI §18.12, anomalies (IA §18.11)
    pilotage() {
      const ctl = controls(), fc = forecast()
      const caTTC = -bal("7", "2026-11-30", "2026-11-01") * (1 + TVA)
      const dso = bal("411") / (caTTC / 26), achats = -sum(allLines((l) => l.a === "401" && l.e.date >= "2026-11-01").map((l) => l.c - 0)) || 1
      const dpo = -bal("401") / (-achats / 26)
      const gop = sum(F.usali.map((x) => x.rev - x.cost)) - sum(F.undistributed.map((x) => x.cost))
      const bgop = sum(F.usali.map((x) => x.brev - x.bcost)) - sum(F.undistributed.map((x) => x.bcost))
      const avail = D.rooms.filter((r) => r.hk !== "hs").length * 26
      const ent = F.entities.find((e) => e.code === ui.finEntity)
      const anomalies = F.anomalies.filter((a) => a.open)
      return pageHead("Tableau de bord financier", "Pilotage comptable et financier de l'entité, au 26/11/2026. Montants d'exemple.", btn("Saisir une écriture", "go('fin-compta/saisie')"))
        + `<div class="row" style="margin-bottom:14px">${chips("finEntity", Object.fromEntries(F.entities.map((e) => [e.code, e.name])))}</div>`
        + `<p class="muted" style="margin-top:-6px">${esc(ent.name)} · devise fonctionnelle ${esc(ent.cur)} · ${esc(ent.ref)} · ${esc(ent.fy)} ${ref9("EF-FIN-002")}${ent.code !== "HEX" ? " · maquette : seules les données de Hôtel Exemple SARL sont détaillées." : ""}</p>`
        + cards([
          kpi("GOP de novembre", mm(gop), `GOPPAR ${money(gop / avail)} · format USALI`),
          kpi("Délai de clôture", "4 j ouvrés", "Octobre 2026 · objectif ≤ 5 j"),
          kpi("Rapprochement automatique", pct(autoRate()), "Lignes de relevé · objectif > 90 %"),
          kpi("DSO / DPO", `${Math.round(dso)} j / ${Math.round(dpo)} j`, "Délais clients / fournisseurs"),
          kpi("Trésorerie disponible", mm(treasury()), `Prévue à 13 semaines : ${mm(fc[12].solde)}`),
          kpi("Écart réel / budget (GOP)", pct(((gop - bgop) / bgop) * 100), `Budget ${mm(bgop)}`),
        ])
        + `<div class="cols"><section><h2>Contrôles permanents</h2>${tbl(["Contrôle", "État"], [
          ["Balance générale équilibrée (RG-FIN-01)", ctl.balOk ? badge("OK", "on") : badge("Écart", "dark")],
          ["Total actif = total passif (RG-FIN-06)", ctl.bilOk ? badge("OK", "on") : badge("Écart", "dark")],
          ["Écritures manuelles en attente de validation", String(F.entries.filter((e) => e.status === "a_valider").length)],
          ["Évènements non comptabilisés", String(F.events.filter((e) => e.status !== "generee").length)],
          ["Période de novembre", F.periods[NOV] === "ouverte" ? badge("Ouverte", "outline") : badge("Clôturée", "dark")],
        ])}</section>
        <section><h2>Détection d'anomalies</h2>${anomalies.map((a) => aiBox("Anomalie détectée", a.text, btn("Examiner", `go('${a.route}')`, "ghost sm") + btn("Classer sans suite", `A.fin.dismiss(${q(a.id)})`, "ghost sm"))).join("<div style='height:10px'></div>") || `<p class="muted">Aucune anomalie ouverte.</p>`}</section></div>
        <h2>Dernières écritures validées</h2>
        ${tbl(["N°", "Date", "Journal", "Libellé", "Source", "#Montant"], posted().slice(-6).reverse().map((e) => [entryLink(e), fd(e.date), esc(e.j), esc(e.label), esc(e.src), money(total(e))]))}`
    },

    // Comptabilité générale
    compta(p) {
      const tab = p[0] || "journaux"
      const body = { plan: planView, journaux: journauxView, saisie: saisieView, auto: autoView, grandlivre: glView, balance: balanceView }[tab] || journauxView
      return pageHead("Comptabilité générale", "Plan SYSCOHADA révisé, journaux, écritures manuelles et automatiques, grand livre et balance. Montants d'exemple.", userBar())
        + subtabs("fin-compta", [["plan", "Plan comptable"], ["journaux", "Journaux et écritures"], ["saisie", "Saisie d'écriture"], ["auto", "Écritures automatiques"], ["grandlivre", "Grand livre"], ["balance", "Balance générale"]], tab)
        + body(p.slice(1))
    },

    tiers(p) {
      const tab = p[0] || "clients"
      return pageHead("Tiers et lettrage", "Comptes clients et fournisseurs : lettrage, échéances, balance âgée, paiements. Les relances et le city ledger sont dans le module Facturation.", userBar())
        + subtabs("fin-tiers", [["clients", "Clients"], ["fournisseurs", "Fournisseurs"], ["ocr", "Lecture IA des factures"]], tab)
        + ({ clients: clientsView, fournisseurs: fournisseursView, ocr: ocrView }[tab] || clientsView)()
    },

    treso(p) {
      const tab = p[0] || "comptes"
      return pageHead("Trésorerie", "Banques, caisses et mobile money, rapprochement des relevés et prévision à 13 semaines. Relevés et opérateurs simulés.", userBar())
        + subtabs("fin-treso", [["comptes", "Comptes de trésorerie"], ["rappro", "Rapprochement bancaire"], ["prevision", "Prévision 13 semaines"]], tab)
        + ({ comptes: tresoComptes, rappro: rapproView, prevision: previsionView }[tab] || tresoComptes)()
    },

    immo(p) {
      const a = F.assets.find((x) => x.id === p[0]) || F.assets[0]
      const nb = F.assets.filter((x) => x.status === "En service")
      const cum = (x) => cumulAt(x, "2026-11-01") + (deprDone() && x.status === "En service" && cumulAt(x, "2026-11-01") < x.base ? monthly(x) : 0)
      const ev = F.events.find((e) => e.kind === "depr")
      return pageHead("Immobilisations", "Registre, approche par composants, plans d'amortissement et dotations automatiques. Valeurs d'exemple.", btn(deprDone() ? "Dotations de novembre passées" : "Calculer les dotations de novembre", deprDone() ? "" : "A.fin.genEvent('EV-7')", deprDone() ? "ghost" : ""))
        + cards([
          kpi("Valeur brute", mm(sum(nb.map((x) => x.base))), `${nb.length} immobilisations en service`),
          kpi("Amortissements cumulés", mm(sum(nb.map(cum))), "Au 30/11 si dotation passée"),
          kpi("VNC", mm(sum(nb.map((x) => x.base - cum(x)))), "Valeur nette comptable"),
          kpi("Dotation mensuelle", mm(sum(build.depr().filter((l) => l.d).map((l) => l.d))), ev.status === "generee" ? `Écriture ${ref(F.entries.find((e) => e.id === ev.entry))}` : "Non encore passée"),
        ])
        + split(`<h3>Registre</h3>${listItems(F.assets.map((x) => ({ id: x.id, title: x.label, sub: `${x.id} · ${x.acc} · ${money(x.base)}`, badge: x.status !== "En service" ? " " + badge(x.status, "dark") : "" })), a.id, "fin-immo")}`,
          card(a.label, `<p class="muted">${esc(a.id)} · compte ${accLink(a.acc)} · amortissement ${accLink(a.amo)}${a.parent ? ` · composant de « ${esc(a.parent)} »` : ""}</p>
            ${tbl(["Élément", "#Valeur"], [["Valeur d'acquisition", money(a.base)], ["Mise en service", fd(a.start) + "/" + a.start.slice(0, 4)], ["Méthode (plan comptable)", `Linéaire sur ${a.years} ans`], ["Plan fiscal", esc(a.fiscal || "Identique au plan comptable")], ["Dotation mensuelle", money(monthly(a))], ["Cumul des amortissements", money(cum(a))], ["Valeur nette comptable", `<strong>${money(a.base - cum(a))}</strong>`], ["Statut", esc(a.status)]])}
            <h3>Plan d'amortissement (extrait)</h3>
            ${tbl(["Exercice", "#Dotation", "#Cumul fin", "#VNC fin"], [2025, 2026, 2027, 2028].map((y) => { const c = cumulAt(a, `${y + 1}-01-01`), c0 = cumulAt(a, `${y}-01-01`); return [String(y), money(c - c0), money(c), money(a.base - c)] }))}
            ${a.status === "En service" ? `<h3>Cession ou mise au rebut</h3><div class="form">${field("fin-cess-price", "Prix de cession HT (0 = mise au rebut)", input("fin-cess-price", "0", 'type="number" min="0" step="100000"'))}<div style="align-self:end">${btn("Sortir l'immobilisation", `A.fin.cession(${q(a.id)})`, "ghost")}</div></div>
              <p class="muted">Écriture HAO générée : 812 / 28x / 2x et, en cas de prix, 5211 / 822 ${ref9("EF-FIN-012")}.</p>` : ""}`))
    },

    fiscal(p) {
      const tab = p[0] || "tva"
      return pageHead("Fiscalité", "TVA, taxe de séjour et retenues, déclarations et moteur fiscal. Télédéclarations simulées ; taux d'exemple à faire valider par un expert-comptable local (ENF-FIN-05).", userBar())
        + subtabs("fin-fiscal", [["tva", "TVA et taxe de séjour"], ["declarations", "Déclarations"], ["moteur", "Moteur fiscal"]], tab)
        + ({ tva: tvaView, declarations: declView, moteur: moteurView }[tab] || tvaView)()
    },

    gestion(p) {
      const tab = p[0] || "usali"
      return pageHead("Analytique et budgets", "Compte d'exploitation USALI par département, réel contre budget, versions de budget. Novembre au 26/11, montants d'exemple.")
        + subtabs("fin-gestion", [["usali", "Compte USALI"], ["budget", "Budgets"]], tab)
        + (tab === "budget" ? budgetView() : usaliView())
    },

    cloture(p) {
      const tab = p[0] || "mensuelle"
      return pageHead("Clôtures", "Liste de contrôle de la clôture mensuelle et annuelle, provisions proposées, verrouillage des périodes.", userBar())
        + subtabs("fin-cloture", [["mensuelle", "Clôture mensuelle"], ["annuelle", "Clôture annuelle"]], tab)
        + (tab === "annuelle" ? annuelleView() : mensuelleView())
    },

    etats(p) {
      const tab = p[0] || "bilan"
      const ctl = controls()
      return pageHead("États financiers", "États SYSCOHADA révisé (système normal) générés depuis la balance, DSF et consolidation simulées. Situation provisoire au 26/11/2026.", btn("Exporter (PDF/Excel simulé)", "toast('Export simulé : états_financiers_2026_provisoire.pdf')", "ghost"))
        + subtabs("fin-etats", [["bilan", "Bilan"], ["resultat", "Compte de résultat"], ["flux", "Flux de trésorerie"], ["dsf", "DSF"], ["conso", "Consolidation"]], tab)
        + (ctl.balOk && ctl.bilOk ? `<p class="muted">${badge("Contrôles OK", "on")} Balance équilibrée et actif = passif : publication autorisée ${ref9("RG-FIN-06")}</p>` : `<p class="err">Balance déséquilibrée ou actif ≠ passif : publication bloquée (RG-FIN-06).</p>`)
        + ({ bilan: bilanView, resultat: resultatView, flux: fluxView, dsf: dsfView, conso: consoView }[tab] || bilanView)()
    },
  }

  // ----- Comptabilité : sous-vues -----
  function planView() {
    const list = F.accounts.filter((a) => ui.finCls === "tous" || a.cls === ui.finCls)
    return `<div class="cols"><section>
      ${chips("finCls", { tous: "Toutes", ...Object.fromEntries(Object.keys(CLASSES).map((k) => [k, "Classe " + k])) })}
      ${tbl(["Compte", "Libellé", "Classe", "Contraintes"], list.map((a) => [accLink(a.num), esc(a.label) + (a.custom ? " " + badge("Ajouté", "outline") : ""), esc(a.cls + " · " + CLASSES[a.cls]),
        [a.lett && "Lettrable", a.tiers && "Tiers obligatoire", a.ana && "Analytique obligatoire"].filter(Boolean).map((x) => badge(x, "outline")).join(" ")]))}
      </section><section>
      ${card("Ajouter un compte", `<p class="muted">Plan extensible par l'utilisateur ${ref9("EF-FIN-001")}. Le PCG et un plan IFRS sont disponibles pour les entités hors OHADA.</p>
        ${form([field("fin-acc-num", "Numéro", input("fin-acc-num", "", 'placeholder="ex. 6052"')), field("fin-acc-label", "Libellé", input("fin-acc-label", "", 'placeholder="ex. Eau"')),
          field("fin-acc-flags", "Contrainte", select("fin-acc-flags", [["", "Aucune"], ["A", "Analytique obligatoire"], ["LT", "Lettrable + tiers obligatoire"], ["L", "Lettrable"]], ""))])}
        <div id="fin-acc-err" style="margin-top:10px"></div><div style="margin-top:10px">${btn("Ajouter au plan", "A.fin.addAccount()")}</div>`)}
      <h2>Sections analytiques (axe département USALI)</h2>
      ${tbl(["Code", "Section"], SECTIONS.map(([c, l]) => [esc(c), esc(l)]))}
      </section></div>`
  }

  function journauxView(p) {
    const e = p[0] && F.entries.find((x) => x.id === p[0])
    if (e) return entryDetail(e)
    const list = F.entries.filter((x) => ui.finJ === "tous" || x.j === ui.finJ || (ui.finJ === "attente" && x.status !== "validee")).slice().sort((a, b) => b.date.localeCompare(a.date))
    const pend = F.entries.filter((x) => x.status !== "validee").length
    return `${tbl(["Journal", "Libellé", "Type", "#Dernier n°", "Contrôle"], F.journals.map((j) => [esc(j.code), esc(j.label), esc(j.type), String(Math.max(0, ...F.entries.filter((x) => x.j === j.code && x.no).map((x) => x.no))), esc(j.must ? `Ligne ${j.must} obligatoire` : j.auto ? "Généré par la clôture" : "—")]))}
      <p class="muted">Numérotation chronologique continue par journal et par exercice, attribuée à la validation ${ref9("EF-FIN-003 · RG-FIN-03")}.</p>
      <h2>Écritures</h2>
      ${chips("finJ", { tous: "Toutes", attente: `En attente (${pend})`, ...Object.fromEntries(F.journals.map((j) => [j.code, j.code])) })}
      ${tbl(["N°", "Date", "Jnl", "Pièce", "Libellé", "Source", "#Montant", "Statut", ""], list.map((x) => [entryLink(x), fd(x.date), esc(x.j), esc(x.piece), esc(x.label), esc(x.src), money(total(x)), stBadge(x), entryActions(x)]), "Aucune écriture.")}`
  }
  const entryActions = (x) => `<span class="row" style="flex-wrap:nowrap;gap:4px">${x.status === "a_valider" ? btn("Valider", `A.fin.validate(${q(x.id)})`, "sm") : ""}${x.status === "brouillard" ? btn("Reprendre", `A.fin.resume(${q(x.id)})`, "ghost sm") : ""}${x.status === "validee" && !x.revBy && !x.revOf && x.j !== "AN" ? btn("Extourner", `A.fin.reverse(${q(x.id)})`, "ghost sm") : ""}</span>`
  function entryDetail(e) {
    const ev = F.events.find((x) => x.entry === e.id)
    return `<p>${btn("← Toutes les écritures", "go('fin-compta/journaux')", "ghost sm")}</p>
      ${card(`Écriture ${ref(e)}`, `<div class="row between"><span>${esc(e.label)}</span>${stBadge(e)}</div>
        <p class="muted">Journal ${esc(e.j)} · ${fd(e.date)}/${e.date.slice(0, 4)} · pièce ${esc(e.piece)} · source ${esc(e.src)} · saisie par ${esc(e.by)}${e.vby ? ` · validée par ${esc(e.vby)}` : ""}${e.rec ? " · récurrente" : ""}${e.autoRev ? " · extourne automatique au 1er jour de la période suivante" : ""}</p>
        ${tbl(["Compte", "Libellé", "Tiers", "Analytique", "Lettrage", "#Débit", "#Crédit"], e.lines.map((l) => [accLink(l.a), esc(accLabel(l.a)), esc(tname(l.t)), esc(l.ana || ""), esc(l.let || ""), num(l.d), num(l.c)]), "",
          `<tfoot><tr><td colspan="5">Totaux</td><td class="num">${num(sum(e.lines.map((l) => +l.d || 0)))}</td><td class="num">${num(sum(e.lines.map((l) => +l.c || 0)))}</td></tr></tfoot>`)}
        <div class="row" style="margin-top:12px">${entryActions(e)}${e.status === "brouillard" ? btn("Supprimer le brouillard", `A.fin.delDraft(${q(e.id)})`, "ghost sm") : ""}</div>`)}
      <h2>Piste d'audit ${ref9("EF-FIN-024")}</h2>
      ${tbl(["Étape", "Détail"], [
        ["Transaction source", ev ? `${esc(ev.ev)} — ${esc(ev.label)}` : esc(e.src === "Manuel" ? "Saisie manuelle, pièce jointe " + e.piece + ".pdf (exemple)" : e.src)],
        ["Écriture", `${esc(ref(e))} · ${esc(ST[e.status][0])}`],
        ["Comptes mouvementés", e.lines.map((l) => accLink(l.a)).join(", ")],
        ["Extourne", e.revBy ? `Extournée par ${entryLink(F.entries.find((x) => x.id === e.revBy))}` : e.revOf ? `Extourne de ${entryLink(F.entries.find((x) => x.id === e.revOf))}` : "—"],
      ])}
      <p class="muted">Une écriture validée n'est jamais modifiée ni supprimée : la correction passe par une extourne ${ref9("RG-FIN-02")}.</p>`
  }

  const blankDraft = () => ({ j: "OD", date: today, piece: "", label: "", rec: false, autoRev: false, lines: [{ a: "", t: "", ana: "", d: "", c: "" }, { a: "", t: "", ana: "", d: "", c: "" }] })
  ui.finDraft = blankDraft()
  const TEMPLATES = {
    frais: { j: "BQA", label: "Frais bancaires du mois", lines: [{ a: "631", t: "", ana: "ADM", d: "15000", c: "" }, { a: "5211", t: "", ana: "", d: "", c: "15000" }] },
    depot: { j: "CA", label: "Dépôt d'espèces en banque", lines: [{ a: "585", t: "", ana: "", d: "1000000", c: "" }, { a: "571", t: "", ana: "", d: "", c: "1000000" }] },
    cca: { j: "OD", label: "Charge constatée d'avance", autoRev: true, lines: [{ a: "476", t: "", ana: "", d: "300000", c: "" }, { a: "625", t: "", ana: "ADM", d: "", c: "300000" }] },
  }
  function saisieView() {
    const d = ui.finDraft
    return `<datalist id="fin-acc-list">${F.accounts.map((a) => `<option value="${esc(a.num)}">${esc(a.label)}</option>`).join("")}</datalist>
      <div class="row" style="margin-bottom:12px"><span class="muted">Modèles :</span>${btn("Frais bancaires", "A.fin.tpl('frais')", "ghost sm")}${btn("Dépôt d'espèces", "A.fin.tpl('depot')", "ghost sm")}${btn("Charge constatée d'avance", "A.fin.tpl('cca')", "ghost sm")}${btn("Vider", "A.fin.tpl('')", "ghost sm")}</div>
      ${card("", `${form([
        field("fin-j", "Journal", select("fin-j", F.journals.filter((j) => !j.auto).map((j) => [j.code, `${j.code} — ${j.label}`]), d.j, `onchange="A.fin.df('j',this.value)"`)),
        field("fin-date", "Date de pièce", input("fin-date", d.date, `type="date" oninput="A.fin.df('date',this.value)"`)),
        field("fin-piece", "Pièce justificative", input("fin-piece", d.piece, `placeholder="ex. OD-1126-01" oninput="A.fin.df('piece',this.value)"`)),
        field("fin-label", "Libellé", input("fin-label", d.label, `oninput="A.fin.df('label',this.value)"`)),
      ])}
      <div class="tablewrap" style="margin-top:14px"><table><thead><tr><th>Compte</th><th>Tiers</th><th>Analytique</th><th class="num">Débit</th><th class="num">Crédit</th><th></th></tr></thead><tbody>
      ${d.lines.map((l, i) => `<tr>
        <td><input list="fin-acc-list" value="${esc(l.a)}" placeholder="N° de compte" oninput="A.fin.dl(${i},'a',this.value)" aria-label="Compte ligne ${i + 1}"></td>
        <td>${select(`fin-t-${i}`, [["", "—"], ...F.tiers.map((t) => [t.id, t.name])], l.t, `onchange="A.fin.dl(${i},'t',this.value)" aria-label="Tiers ligne ${i + 1}"`)}</td>
        <td>${select(`fin-a-${i}`, [["", "—"], ...SECTIONS], l.ana, `onchange="A.fin.dl(${i},'ana',this.value)" aria-label="Section ligne ${i + 1}"`)}</td>
        <td><input type="number" min="0" step="1" value="${esc(l.d)}" oninput="A.fin.dl(${i},'d',this.value)" style="text-align:right" aria-label="Débit ligne ${i + 1}"></td>
        <td><input type="number" min="0" step="1" value="${esc(l.c)}" oninput="A.fin.dl(${i},'c',this.value)" style="text-align:right" aria-label="Crédit ligne ${i + 1}"></td>
        <td>${d.lines.length > 2 ? btn("Retirer", `A.fin.delLine(${i})`, "ghost sm") : ""}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="row between" style="margin-top:10px">${btn("Ajouter une ligne", "A.fin.addLine()", "ghost sm")}<span id="fin-tot">${draftTotals()}</span></div>
      <div class="row" style="margin-top:10px"><label style="margin:0;display:flex;gap:6px;align-items:center"><input type="checkbox" ${d.rec ? "checked" : ""} onchange="A.fin.df('rec',this.checked)"> Écriture récurrente (mensuelle)</label>
        <label style="margin:0;display:flex;gap:6px;align-items:center"><input type="checkbox" ${d.autoRev ? "checked" : ""} onchange="A.fin.df('autoRev',this.checked)"> Extourne automatique au 1er jour de la période suivante</label></div>
      <div id="fin-err" style="margin-top:10px"></div>
      <div class="row" style="margin-top:12px">${`<button class="btn" id="fin-submit" onclick="A.fin.submit()" ${draftOk() ? "" : "disabled"}>Enregistrer et soumettre</button>`}${btn("Enregistrer en brouillard", "A.fin.saveDraft()", "ghost")}</div>
      <p class="muted">Contrôles : équilibre débit = crédit (RG-FIN-01), période ouverte (RG-FIN-04, RG-FIN-09), compte au plan, tiers sur 401/411 et section analytique sur les classes 6 et 7 (RG-FIN-05), pièce obligatoire. Au-delà de ${money(SEUIL)}, l'écriture part en validation chez le chef comptable, qui ne peut pas être le saisisseur (EF-FIN-006, RG-FIN-08).</p>`)}`
  }
  const draftSums = () => { const ls = ui.finDraft.lines; return [sum(ls.map((l) => +l.d || 0)), sum(ls.map((l) => +l.c || 0))] }
  const draftOk = () => { const [d, c] = draftSums(); return d > 0 && d === c }
  const draftTotals = () => { const [d, c] = draftSums(); return `Débit <strong>${money(d)}</strong> · Crédit <strong>${money(c)}</strong> · ${d === c && d > 0 ? badge("Équilibrée", "on") : d + c === 0 ? badge("Montants à saisir", "outline") : badge(`Écart ${money(Math.abs(d - c))} — enregistrement bloqué`, "dark")}` }

  function autoView() {
    const pend = F.events.filter((e) => e.status !== "generee")
    return `<div class="row between"><p class="muted" style="margin:0">Évènements publiés par les autres modules, transformés en écritures selon des schémas paramétrables ${ref9("EF-FIN-004")}.</p>${pend.length ? btn(`Générer les ${pend.filter((e) => !e.err).length} écritures prêtes`, "A.fin.genAll()") : ""}</div>
      ${tbl(["Source", "Évènement", "Libellé", "Jnl", "Date", "#Montant", "État", ""], F.events.map((e) => {
        const ls = build[e.kind](), m = sum(ls.map((l) => l.d))
        return [badge(e.src, "outline"), `<span class="muted">${esc(e.ev)}</span>`, esc(e.label) + (e.err ? `<div class="err" style="margin-top:6px">${esc(e.err)}</div>` : ""), esc(e.j), fd(e.date), money(m),
          e.status === "generee" ? entryLink(F.entries.find((x) => x.id === e.entry)) : e.err ? badge("En erreur", "dark") : badge("En attente", "outline"),
          e.status === "generee" ? "" : e.err ? btn("Affecter « Clients de passage » et générer", `A.fin.fixEvent(${q(e.id)})`, "ghost sm") : btn("Générer", `A.fin.genEvent(${q(e.id)})`, "sm")]
      }))}
      <h2>Schémas d'écritures (extrait, paramétrables par entité)</h2>
      ${tbl(["Évènement source", "Débit", "Crédit"], [
        ["Audit de nuit : nuitées du jour", "411 Clients (folio)", "7061 Hébergement · 4431 TVA facturée · 4471 Taxe de séjour"],
        ["Encaissement carte / mobile money / espèces", "4711 Attente PSP · 552x Mobile money · 571 Caisse", "411 Clients"],
        ["Facture fournisseur approuvée (PRC)", "60x Achats · 4452 TVA récupérable", "401 Fournisseurs"],
        ["Clôture de la paie (HRM)", "661 Rémunérations · 664 Charges sociales", "422 Personnel · 431 CNPS · 447 Impôts retenus"],
        ["Dotation mensuelle aux amortissements", "681 Dotations", "28x Amortissements"],
        ["Prestation pressing (BLN)", "411 Clients (folio)", "7064 Blanchisserie · 4431 TVA facturée"],
      ].map((r) => r.map(esc)))}`
  }

  function glView(p) {
    const n = p[0] || "411"
    const used = [...new Set(allLines().map((l) => l.a))].sort()
    let run = 0
    const ls = allLines((l) => l.a === n).sort((a, b) => a.e.date.localeCompare(b.e.date))
    const rows = ls.map((l) => { run += l.d - l.c; return [fd(l.e.date), entryLink(l.e), esc(l.e.label), esc(tname(l.t)), esc(l.let || ""), num(l.d), num(l.c), money(run)] })
    return `<div class="form" style="max-width:520px;margin-bottom:14px">${field("fin-gl-acc", "Compte", select("fin-gl-acc", used.map((u) => [u, `${u} — ${accLabel(u)}`]), n, `onchange="go('fin-compta/grandlivre/'+this.value)"`))}</div>
      <h2>${esc(n)} — ${esc(accLabel(n))}</h2>
      ${tbl(["Date", "N°", "Libellé", "Tiers", "Let.", "#Débit", "#Crédit", "#Solde"], rows, "Aucun mouvement validé sur ce compte.",
        `<tfoot><tr><td colspan="5">Totaux</td><td class="num">${num(sum(ls.map((l) => l.d)))}</td><td class="num">${num(sum(ls.map((l) => l.c)))}</td><td class="num">${money(run)}</td></tr></tfoot>`)}
      <p class="muted">Grand livre, journaux et brouillard éditables à toute date ${ref9("EF-FIN-007")}. Chaque ligne renvoie à son écriture (piste d'audit).</p>`
  }

  function balanceView() {
    const o = {}
    allLines().forEach((l) => { const r = (o[l.a] = o[l.a] || [0, 0, 0, 0]); if (l.e.j === "AN") { r[0] += l.d; r[1] += l.c } else { r[2] += l.d; r[3] += l.c } })
    const rows = Object.entries(o).filter(([n]) => ui.finBalCls === "tous" || n[0] === ui.finBalCls).sort(([a], [b]) => a.localeCompare(b))
    const T = [0, 1, 2, 3].map((k) => sum(rows.map(([, r]) => r[k]))), sd = sum(rows.map(([, r]) => Math.max(0, r[0] + r[2] - r[1] - r[3]))), sc = sum(rows.map(([, r]) => Math.max(0, r[1] + r[3] - r[0] - r[2])))
    const aux = F.tiers.map((t) => { const ls = allLines((l) => l.t === t.id); return [esc(t.type), esc(t.name), num(sum(ls.map((l) => l.d))), num(sum(ls.map((l) => l.c))), money(sum(ls.map((l) => l.d - l.c)))] })
    return `${chips("finBalCls", { tous: "Toutes classes", ...Object.fromEntries(Object.keys(CLASSES).map((k) => [k, "Classe " + k])) })}
      ${tbl(["Compte", "Libellé", "#Ouv. débit", "#Ouv. crédit", "#Mvt débit", "#Mvt crédit", "#Solde débiteur", "#Solde créditeur"], rows.map(([n, r]) => { const s = r[0] + r[2] - r[1] - r[3]; return [accLink(n), esc(accLabel(n)), num(r[0]), num(r[1]), num(r[2]), num(r[3]), num(s > 0 ? s : 0), num(s < 0 ? -s : 0)] }), "Aucun compte.",
        `<tfoot><tr><td colspan="2">Totaux</td>${T.map((v) => `<td class="num">${num(v)}</td>`).join("")}<td class="num">${num(sd)}</td><td class="num">${num(sc)}</td></tr></tfoot>`)}
      <p class="muted">Balance à 8 colonnes, écritures validées uniquement. ${ui.finBalCls === "tous" ? (sd === sc ? badge("Balance équilibrée", "on") : badge("Balance déséquilibrée", "dark")) : ""}</p>
      <h2>Balances auxiliaires</h2>${tbl(["Type", "Tiers", "#Débit", "#Crédit", "#Solde"], aux)}`
  }

  // ----- Tiers -----
  function lettrageBlock(type) {
    const list = F.tiers.filter((t) => t.type === type && t.id !== "CL-PAS")
    const cur = list.find((t) => t.id === ui.finTiers) || list[0]
    const ls = allLines((l) => l.t === cur.id).sort((a, b) => a.e.date.localeCompare(b.e.date))
    const open = ls.filter((l) => !l.let), done = ls.filter((l) => l.let)
    return `<h2>Lettrage ${ref9("EF-FIN-008")}</h2>
      <div class="row" style="margin-bottom:10px">${list.map((t) => `<button class="btn ${t.id === cur.id ? "" : "ghost"} sm" onclick="ui.finTiers=${q(t.id)};render()">${esc(t.name)}</button>`).join("")}<span style="flex:1"></span>${btn("Lettrage automatique", `A.fin.autoLet(${q(type)})`, "ghost sm")}</div>
      ${tbl(["", "Date", "N°", "Pièce", "Libellé", "Échéance", "#Débit", "#Crédit"], open.map((l) => [`<input type="checkbox" class="fin-lt" data-k="${esc(lineKey(l))}" data-v="${l.d - l.c}" onchange="A.fin.ltSum()" aria-label="Sélectionner">`, fd(l.e.date), entryLink(l.e), esc(l.piece || l.e.piece), esc(l.e.label), l.ech ? fd(l.ech) : "", num(l.d), num(l.c)]), "Aucune ligne non lettrée.")}
      <div class="row between" style="margin-top:10px"><span id="fin-ltsum" class="muted">Sélection : 0 FCFA</span>${btn("Lettrer la sélection", "A.fin.letter()")}</div>
      ${done.length ? `<h3>Lignes lettrées</h3>${tbl(["Code", "Date", "N°", "Libellé", "#Débit", "#Crédit", ""], done.map((l) => [badge(l.let, "outline"), fd(l.e.date), entryLink(l.e), esc(l.e.label), num(l.d), num(l.c), btn("Délettrer", `A.fin.unletter(${q(cur.id)}, ${q(l.let)})`, "ghost sm")]))}` : ""}`
  }
  function clientsView() {
    const cl = F.tiers.filter((t) => t.type === "Client")
    const rows = cl.map((t) => [t, aged(t.id)]).filter(([, b]) => sum(b) !== 0)
    const tot = [0, 1, 2, 3, 4].map((k) => sum(rows.map(([, b]) => b[k])))
    const ong = aged("CL-03")[4]
    return `<h2>Balance âgée clients</h2>
      ${tbl(["Client", "Conditions", "#Non échu", "#1–30 j", "#31–60 j", "#61–90 j", "#> 90 j", "#Total"], rows.map(([t, b]) => [esc(t.name), esc(t.terms), ...b.map(num), money(sum(b))]), "Aucune créance ouverte.",
        `<tfoot><tr><td colspan="2">Total</td>${tot.map((v) => `<td class="num">${num(v)}</td>`).join("")}<td class="num">${money(sum(tot))}</td></tr></tfoot>`)}
      ${ong > 0 ? `<div style="margin-top:12px">${aiBox("Créance douteuse", `ONG Lagune Solidarité Exemple : ${money(ong)} échus depuis plus de 360 jours. Dépréciation proposée sur la base HT, à valider à la clôture.`, btn("Voir la proposition", "go('fin-cloture/mensuelle')", "ghost sm"))}</div>` : ""}
      ${lettrageBlock("Client")}`
  }
  function fournisseursView() {
    const sts = { a_payer: ["À payer", "outline"], proposee: ["Proposée au paiement", ""], payee: ["Payée", "on"], bloquee: ["Bloquée", "dark"] }
    const due = F.supInv.filter((s) => s.status === "a_payer" && s.ok && s.ech <= addDays(today, 30))
    const prop = F.supInv.filter((s) => s.status === "proposee")
    return `<h2>Factures fournisseurs ${ref9("EF-FIN-009")}</h2>
      ${tbl(["Fournisseur", "Facture", "Date", "Échéance", "#TTC", "Contrôle à trois voies", "Statut"], F.supInv.map((s) => [esc(tname(s.t)), esc(s.no), fd(s.date), fd(s.ech), money(s.ttc), s.ok ? esc(s.check) : `<strong>${esc(s.check)}</strong>`, badge(sts[s.status][0], sts[s.status][1])]))}
      <div class="cols" style="margin-top:14px"><section>${card("Proposition de paiement", `<p class="muted">Factures conformes échues sous 30 jours : ${due.length} pour ${money(sum(due.map((s) => s.ttc)))}.</p>
        ${btn("Générer la proposition", "A.fin.propose()", due.length ? "" : "ghost")}`)}</section>
      <section>${card("Ordre de virement", prop.length ? `<p>${prop.length} facture(s) · ${money(sum(prop.map((s) => s.ttc)))} · proposée(s) par ${esc(prop[0].by)}</p>
        <p class="muted">Le validateur doit être différent de l'auteur de la proposition (RG-FIN-08). Fichier de virement transmis à Banque Exemple Plateau (simulé).</p>${btn("Valider et émettre l'ordre", "A.fin.pay()", "accent")}` : `<p class="muted">Aucune proposition en attente.</p>`)}</section></div>
      ${lettrageBlock("Fournisseur")}`
  }
  function ocrView() {
    const o = F.ocr, [ht, tv] = htTva(+o.ttc || 0)
    return `<div class="cols"><section>${card("Document reçu", `<p><strong>${esc(o.file)}</strong></p><p class="muted">Lecture OCR + LLM (simulée) · confiance ${o.conf} % · statut ${badge(o.status, o.status === "comptabilisée" ? "on" : "outline")}</p>
      ${o.status === "à valider" ? form([
        field("fin-o-t", "Fournisseur", select("fin-o-t", F.tiers.filter((t) => t.type === "Fournisseur").map((t) => [t.id, t.name]), o.t)),
        field("fin-o-no", "N° de facture", input("fin-o-no", o.no)), field("fin-o-date", "Date", input("fin-o-date", o.date, 'type="date"')), field("fin-o-ech", "Échéance", input("fin-o-ech", o.ech, 'type="date"')),
        field("fin-o-ttc", "Montant TTC", input("fin-o-ttc", o.ttc, 'type="number" min="0"')), field("fin-o-acc", "Compte de charge proposé", select("fin-o-acc", F.accounts.filter((a) => a.cls === "6" && a.ana).map((a) => [a.num, `${a.num} — ${a.label}`]), o.acc)),
        field("fin-o-ana", "Section analytique", select("fin-o-ana", SECTIONS, o.ana)),
      ]) + `<div class="row" style="margin-top:12px">${btn("Valider l'imputation et comptabiliser", "A.fin.ocrValidate()", "accent")}${btn("Rejeter", "A.fin.ocrReject()", "ghost")}</div>` : `<p>Traitée. ${o.entry ? entryLink(F.entries.find((x) => x.id === o.entry)) : ""}</p>`}`)}</section>
      <section>${aiBox("Proposition d'imputation", `Froid Clim Treichville Exemple, maintenance de la climatisation : 624 Entretien (section Maintenance) ${money(ht)}, 4452 TVA récupérable ${money(tv)}, 401 Fournisseurs ${money(+o.ttc || 0)}. Aucune commande associée : contrôle à trois voies non applicable (contrat de maintenance). Aucun doublon trouvé sur 12 mois.`)}
      <p class="muted">La proposition n'est comptabilisée qu'après validation du comptable ${ref9("§18.11")}.</p></section></div>`
  }

  // ----- Trésorerie -----
  function tresoComptes() {
    const S5211 = bal("5211", "2026-10-31") + sum(F.stmt.map((s) => s.amt))
    const rows = [
      ["5211", "Banque Exemple Plateau", "Relevé CAMT.053 du 25/11 (simulé)", S5211],
      ["5212", "Banque Exemple Cocody", "Relevé MT940 du 25/11 (simulé)", bal("5212")],
      ["5521", "Orange Money", "Relevé opérateur du 25/11 (simulé)", bal("5521") - 5000],
      ["5522", "MTN MoMo", "Relevé opérateur du 25/11 (simulé)", bal("5522")],
      ["5523", "Wave", "Relevé opérateur du 25/11 (simulé)", bal("5523")],
      ["571", "Caisse principale", "Comptage du 25/11 au soir", bal("571")],
    ]
    return `${cards([kpi("Trésorerie disponible", mm(treasury()), "Banques, mobile money, caisse"), kpi("Encaissements carte en attente", mm(bal("4711")), "Compte d'attente PSP 4711"), kpi("Rapprochement automatique", pct(autoRate()), "Banque Exemple Plateau, novembre")])}
      <h2>Comptes ${ref9("EF-FIN-010 · EF-FIN-011")}</h2>
      ${tbl(["Compte", "Établissement", "Dernier relevé", "#Solde comptable", "#Solde relevé", "#Écart"], rows.map(([n, l, s, r]) => { const b = bal(n), e = r - b; return [accLink(n), esc(l), esc(s), money(b), money(r), e ? `<strong>${money(e)}</strong>` : "—"] }))}
      <p class="muted">Écarts attendus : opérations du relevé pas encore comptabilisées (frais bancaires, frais d'opérateur mobile money de 5 000 FCFA). À traiter dans le rapprochement.</p>
      <h2>Virement interne</h2>
      ${card("", form([field("fin-vi-from", "De", select("fin-vi-from", [["5211", "Banque Exemple Plateau"], ["5212", "Banque Exemple Cocody"], ["571", "Caisse principale"]], "5211")), field("fin-vi-to", "Vers", select("fin-vi-to", [["5212", "Banque Exemple Cocody"], ["5211", "Banque Exemple Plateau"], ["571", "Caisse principale"]], "5212")),
        field("fin-vi-amt", "Montant", input("fin-vi-amt", "", 'type="number" min="0" step="10000"')), `<div style="align-self:end">${btn("Passer le virement", "A.fin.transfer()")}</div>`]))}`
  }
  function rapproView() {
    const mk = matchedKeys(), book = bankLines().filter((l) => !mk.has(lineKey(l)))
    const hows = { auto: ["Auto", "on"], manuel: ["Manuel", "outline"], suggestion: ["Suggestion acceptée", "outline"], cree: ["Écriture créée", "outline"] }
    return `<div class="row between"><p class="muted" style="margin:0">Banque Exemple Plateau · relevé du 01 au 25/11 importé (CAMT.053, simulé) · ${F.stmt.length} lignes.</p>
      <span class="row">${btn("Importer le relevé du 26/11 (simulé)", "A.fin.importStmt()", "ghost")}${btn("Rapprochement automatique", "A.fin.autoMatch()")}</span></div>
      ${cards([kpi("Lignes rapprochées", `${F.stmt.filter((s) => s.m).length} / ${F.stmt.length}`, "Relevé importé"), kpi("Taux automatique", pct(autoRate()), "Objectif > 90 % (US-FIN-03)"), kpi("Écritures non pointées", String(book.length), "Côté comptabilité")])}
      <h2>Lignes du relevé</h2>
      ${tbl(["Date", "Libellé banque", "#Montant", "Rapprochement", ""], F.stmt.map((s) => {
        let action = ""
        if (!s.m) {
          const cand = book.filter((l) => l.d - l.c === s.amt)
          action = s.sug ? `<span class="row" style="flex-wrap:nowrap;gap:4px">${btn("Accepter la suggestion", `A.fin.acceptSug(${q(s.id)})`, "sm")}</span>`
            : cand.length ? `<span class="row" style="flex-wrap:nowrap;gap:4px">${select(`fin-m-${s.id}`, cand.map((l) => [lineKey(l), `${fd(l.e.date)} ${l.e.label}`]), "", 'style="max-width:220px"')}${btn("Pointer", `A.fin.manualMatch(${q(s.id)})`, "ghost sm")}</span>`
            : btn(s.amt < 0 ? "Comptabiliser (631 Frais bancaires)" : "Comptabiliser (4711 attente PSP)", `A.fin.bookStmt(${q(s.id)})`, "ghost sm")
        }
        const m = s.m && bankLines().find((l) => lineKey(l) === s.m)
        return [fd(s.date), esc(s.label), money(s.amt), s.m ? `${badge(hows[s.how][0], hows[s.how][1])} ${m ? entryLink(m.e) : ""}` : s.sug ? `<span class="muted">Suggestion : ${esc(s.sug)}</span>` : badge("Non rapprochée", ""), action]
      }))}
      <div style="margin-top:14px">${aiBox("Rapprochement intelligent", "Appariement par montant, date (± 2 jours), libellé et tiers. Les cas incertains (date éloignée, libellé ambigu) sont proposés en suggestion et attendent une validation humaine ; les lignes sans contrepartie peuvent être comptabilisées directement.")}</div>`
  }
  function previsionView() {
    const fc = forecast()
    return `${columns(fc.map((w) => fd(w.from)), fc.map((w) => Math.max(0, w.solde / 1e6)), (v) => Math.round(v) + " M")}
      <p class="muted">Solde de fin de semaine projeté, en millions de FCFA. Encaissements : tendance saisonnière + réservations confirmées ; décaissements : échéancier fournisseurs, salaires, CNPS, TVA, emprunt.</p>
      ${tbl(["Semaine du", "#Encaissements", "#Décaissements", "Échéances notables", "#Solde fin"], fc.map((w) => [fd(w.from), money(w.inflow), money(w.out), esc(w.notes.join(", ")), money(w.solde)]))}
      <div style="margin-top:14px">${aiBox("Prévision de trésorerie", `Projection à 13 semaines : point bas la semaine du ${fd(fc.reduce((a, b) => (b.solde < a.solde ? b : a)).from)} (${mm(Math.min(...fc.map((w) => w.solde)))}), porté par les fêtes de fin d'année puis le creux de janvier. Aucun besoin de financement court terme identifié.`)}</div>`
  }

  // ----- Fiscalité -----
  const tvaNov = () => {
    const from = "2026-11-01", to = "2026-11-30"
    const col = -bal("4431", to, from), ded = bal("4452", to, from), ts = -bal("4471", to, from)
    return { col, ded, net: col - ded, ts }
  }
  function tvaView() {
    const t = tvaNov()
    return `${cards([kpi("TVA collectée", money(t.col), "Novembre, au 26/11"), kpi("TVA déductible", money(t.ded), "Novembre, au 26/11"), kpi("TVA nette à payer", money(t.net), "Échéance le 15/12 (exemple)"), kpi("Taxe de séjour collectée", money(t.ts), `${money(TAXE_SEJOUR)} par nuitée (taux d'exemple)`)])}
      <h2>Détail de la TVA ${ref9("EF-FIN-013")}</h2>
      ${tbl(["Compte", "Libellé", "#Base estimée", "#Montant"], [
        [accLink("4431"), "TVA facturée sur nuitées, restauration, spa, pressing", money(t.col / TVA), money(t.col)],
        [accLink("4452"), "TVA récupérable sur achats de biens et services", money(t.ded / TVA), money(t.ded)],
        ["", "<strong>TVA nette due</strong>", "", `<strong>${money(t.net)}</strong>`],
      ])}
      <p class="muted">Prorata de déduction : 100 % (toutes les activités sont taxables). Régularisations : aucune ce mois.</p>
      <div style="margin-top:14px">${aiBox("Contrôle de cohérence TVA", `La TVA collectée représente ${pct((t.col / -bal("7", "2026-11-30", "2026-11-01")) * 100)} du chiffre d'affaires HT de novembre, cohérent avec le taux de 18 % appliqué à toutes les ventes. Un écart sur le fournisseur Énergie Lagune Exemple est signalé dans le moteur fiscal.`, btn("Préparer la déclaration", "go('fin-fiscal/declarations')", "ghost sm"))}</div>`
  }
  function declView() {
    const t = tvaNov(), closed = F.periods[NOV] === "cloturee"
    const sts = { "Brouillon": "", "Validée": "outline", "Déposée": "on" }
    return `<div class="row between"><p class="muted" style="margin:0">Déclarations aux formats de télédéclaration (portail simulé).</p>${F.taxReturns.some((x) => x.period === "Novembre 2026") ? "" : btn("Préparer les déclarations de novembre", "A.fin.prepTax()")}</div>
      ${tbl(["Déclaration", "Période", "#Montant", "Échéance", "Statut", "Accusé", ""], F.taxReturns.map((x) => [esc(x.type), esc(x.period), money(x.amount), fd(x.due), badge(x.status, sts[x.status]), esc(x.ack || "—"),
        x.status === "Brouillon" ? btn("Valider", `A.fin.valTax(${q(x.id)})`, "sm") : x.status === "Validée" ? btn("Télédéclarer (simulé)", `A.fin.fileTax(${q(x.id)})`, closed ? "accent sm" : "ghost sm") : ""]))}
      <p class="muted">${closed ? "Novembre clôturé : dépôt possible." : "Le dépôt des déclarations de novembre n'est possible qu'après la clôture de la période."} TVA estimée à ce jour : ${money(t.net)}. La validation est réservée au chef comptable.</p>`
  }
  function moteurView() {
    return `${tbl(["Taxe", "Pays", "Base", "Taux / montant", "Date d'effet", "Utilisée par"], [
      ["TVA — taux normal", "Côte d'Ivoire", "Prix HT des prestations", "18 %", "01/01/2026", "Facturation, comptabilité"],
      ["TVA — taux réduit", "Côte d'Ivoire", "Biens désignés (exemple)", "9 %", "01/01/2026", "Achats"],
      ["Taxe de séjour", "Côte d'Ivoire", "Nuitée par chambre occupée", `${money(TAXE_SEJOUR)}`, "01/01/2026", "Audit de nuit, facturation"],
      ["Retenue à la source sur prestations", "Côte d'Ivoire", "Prestataires non immatriculés", "Taux d'exemple", "01/01/2026", "Paiements fournisseurs"],
      ["TVA — taux normal", "Sénégal", "Prix HT des prestations", "18 %", "01/01/2026", "Entité régionale (exemple)"],
    ].map((r) => r.map(esc)))}
      <p class="muted">Un seul moteur fiscal paramétrable (taux, bases, exonérations, dates d'effet, par pays) partagé par la facturation et la comptabilité ${ref9("EF-FIN-014")}. Paramètres d'exemple, non contractuels.</p>
      <div style="margin-top:14px">${aiBox("Écart de TVA détecté", "Énergie Lagune Exemple : TVA déductible de 18 % sur la facture FB-2026-311, alors que les 6 factures précédentes portaient un taux différent. À vérifier avec la pièce avant la déclaration.", btn("Marquer comme vérifié", "A.fin.dismiss('AN4')", "ghost sm"))}</div>`
  }

  // ----- Analytique et budgets -----
  function usaliView() {
    const avail = D.rooms.filter((r) => r.hk !== "hs").length * 26
    const dp = F.usali.map((x) => ({ ...x, p: x.rev - x.cost, bp: x.brev - x.bcost }))
    const und = sum(F.undistributed.map((x) => x.cost)), bund = sum(F.undistributed.map((x) => x.bcost))
    const gop = sum(dp.map((x) => x.p)) - und, bgop = sum(dp.map((x) => x.bp)) - bund
    const ec = (r, b) => `${r - b >= 0 ? "+" : ""}${pct(((r - b) / b) * 100)}`
    return `${cards([kpi("Recettes totales", mm(sum(dp.map((x) => x.rev))), "Novembre au 26/11"), kpi("GOP", mm(gop), `Budget ${mm(bgop)} · ${ec(gop, bgop)}`), kpi("GOPPAR", money(gop / avail), `${avail} chambres disponibles sur la période`), kpi("Taux de GOP", pct((gop / sum(dp.map((x) => x.rev))) * 100), "GOP / recettes")])}
      <h2>Compte d'exploitation USALI ${ref9("EF-FIN-020")}</h2>
      ${tbl(["Département", "#Recettes", "#Coûts", "#Résultat", "#Budget", "#Écart"], [
        ...dp.map((x) => [esc(x.d), money(x.rev), money(x.cost), money(x.p), money(x.bp), ec(x.p, x.bp)]),
        ...F.undistributed.map((x) => [esc(x.d) + ' <span class="muted">(non affecté)</span>', "", money(x.cost), money(-x.cost), money(-x.bcost), ec(x.bcost, x.cost)]),
      ], "", `<tfoot><tr><td>GOP</td><td class="num">${money(sum(dp.map((x) => x.rev)))}</td><td class="num">${money(sum(dp.map((x) => x.cost)) + und)}</td><td class="num">${money(gop)}</td><td class="num">${money(bgop)}</td><td class="num">${ec(gop, bgop)}</td></tr></tfoot>`)}
      <p class="muted">Ventilation automatique par section analytique ; l'énergie et la maintenance sont réparties par clés (surface, compteurs) pour le reporting interne ${ref9("EF-FIN-015")}.</p>
      <h2>Commentaires de gestion</h2>
      ${F.comments.map((c, i) => aiBox(`Écart ${c.d}`, c.text, c.status === "proposé" ? btn("Valider le commentaire", `A.fin.comment(${i},'validé')`, "ghost sm") + btn("Rejeter", `A.fin.comment(${i},'rejeté')`, "ghost sm") : badge(`Commentaire ${c.status}`, c.status === "validé" ? "on" : "dark"))).join("<div style='height:10px'></div>")}`
  }
  function budgetView() {
    F.budgetV = ui.finBudgetV
    const locked = F.budgetV.startsWith("V1")
    const months = ["Sept.", "Oct.", "Nov.", "Déc."]
    const real = { "Hébergement": [15800000, 16400000, 14200000], "Restauration": [6100000, 7000000, 7300000], "Spa": [1200000, 1250000, 1000000], "Blanchisserie": [420000, 450000, 400000] }
    const factor = locked ? 1.06 : 1
    return `<div class="row between">${chips("finBudgetV", Object.fromEntries(F.budgetVersions.map((v) => [v, v])))}${btn("Nouvelle version (copie)", "A.fin.newBudget()", "ghost")}</div>
      <p class="muted">Version affichée : ${esc(F.budgetV)}${locked ? " — lecture seule" : ""}. Budget par compte, département et mois ${ref9("EF-FIN-016")}.</p>
      ${tbl(["Recettes par département", ...months.flatMap((m, i) => (i < 3 ? [`#${m} réel`, `#${m} budget`] : [`#${m} budget`]))], F.usali.map((x) => {
        const b = [x.brev * 1.02, x.brev * 0.98, x.brev].map((v) => v * factor)
        return [esc(x.d), ...[0, 1, 2].flatMap((k) => [money(real[x.d][k]), money(b[k])]), locked ? money(F.budgetDec[x.d] * factor) : `<input type="number" id="fin-bd-${esc(x.d)}" value="${F.budgetDec[x.d]}" step="100000" style="text-align:right;min-width:120px" aria-label="Budget décembre ${esc(x.d)}">`]
      }))}
      ${locked ? "" : `<div class="row" style="margin-top:10px">${btn("Enregistrer le budget de décembre", "A.fin.saveBudget()")}</div>`}`
  }

  // ----- Clôtures -----
  function mensuelleView() {
    const steps = closeSteps(), done = steps.filter((s) => s.done).length, closed = F.periods[NOV] === "cloturee"
    return `${tbl(["Période", "Statut"], Object.entries(F.periods).slice(8).map(([k, v]) => [esc(k), v === "cloturee" ? badge("Clôturée", "dark") : badge("Ouverte", "outline")]))}
      <h2>Clôture de novembre 2026 — ${done} / ${steps.length} étapes</h2>
      ${tbl(["Étape", "Responsable", "Détail", "Statut", ""], steps.map((s) => [esc(s.label), esc(s.who), esc(s.note || ""), s.done ? badge("Fait", "on") : badge("À faire", "outline"),
        closed ? "" : s.auto ? (s.route && !s.done ? btn("Ouvrir", `go('${s.route}')`, "ghost sm") : "") : btn(s.done ? "Rouvrir" : "Marquer fait", `A.fin.toggleStep(${q(s.k)})`, "ghost sm")]))}
      <h2>Assistant de clôture</h2>
      ${aiBox("Étapes en retard", steps.filter((s) => !s.done).length ? `Restent : ${steps.filter((s) => !s.done).map((s) => s.label.toLowerCase()).join(" ; ")}.` : "Toutes les étapes sont faites : la période peut être verrouillée.")}
      <div style="height:10px"></div>
      ${F.proposals.map((p) => aiBox(p.label, `${p.why}. Écriture proposée : ${p.lines.map((l) => `${l.d ? "D" : "C"} ${l.a} ${num(l.d || l.c)}`).join(" · ")}.`, p.done ? badge("Écriture passée", "on") : closed ? "" : btn("Valider et passer l'écriture", `A.fin.applyProp(${q(p.id)})`, "ghost sm"))).join("<div style='height:10px'></div>")}
      <div class="row" style="margin-top:16px">${closed ? `<p>${badge("Novembre clôturé", "dark")} le ${esc(F.closedNov)} : aucune écriture ne peut plus y être passée (RG-FIN-04).</p>` : `<button class="btn accent" onclick="A.fin.lockNov()" ${done === steps.length ? "" : "disabled"}>Verrouiller novembre et figer la balance</button><span class="muted">Réservé au chef comptable. Démonstration : en réel, après le 30/11.</span>`}</div>`
  }
  function annuelleView() {
    return `${tbl(["Exercice", "Statut", "#Résultat", "Commentaire"], [
      ["2025", badge("Clôturé", "dark"), money(26400000), "Comptes approuvés le 18/06/2026 : clôture irréversible"],
      ["2026", badge("Ouvert", "outline"), money(resultat()), "Résultat provisoire au 26/11"],
    ])}
      <h2>Affectation du résultat 2025</h2>
      ${tbl(["Affectation", "#Montant"], [["Réserve légale (10 %)", money(2640000)], ["Dividendes", money(15000000)], ["Report à nouveau", money(8760000)]], "", `<tfoot><tr><td>Total</td><td class="num">${money(26400000)}</td></tr></tfoot>`)}
      <h2>Liste de contrôle de la clôture 2026 ${ref9("EF-FIN-017")}</h2>
      ${tbl(["Étape", "Statut"], [
        ["Clôture des 12 périodes mensuelles", `${Object.values(F.periods).filter((v) => v === "cloturee").length} / 12`],
        ["Inventaire physique des stocks et immobilisations", "Planifié le 31/12"],
        ["Provisions et écritures d'inventaire", "À faire"],
        ["États financiers SYSCOHADA et notes annexes", "À faire"],
        ["DSF et télédéclaration", "À faire"],
        ["À-nouveaux 2027 et affectation du résultat", "Après approbation des comptes"],
      ].map(([a, b]) => [esc(a), esc(b)]))}
      <div class="row" style="margin-top:14px"><button class="btn" disabled>Clôturer l'exercice 2026</button>${btn("Rouvrir l'exercice 2025", "A.fin.reopen2025()", "ghost")}<span class="muted">Clôture possible quand les 12 périodes sont clôturées.</span></div>`
  }

  // ----- États financiers -----
  function bilanView() {
    const n = bilan(), n1 = bilan((l) => l.e.j === "AN")
    const side = (k) => { const keys = [...new Set([...Object.keys(n[k]), ...Object.keys(n1[k])])]; return keys.map((x) => [esc(x), money(n[k][x] || 0), money(n1[k][x] || 0)]) }
    const foot = (k, t, t1) => `<tfoot><tr><td>Total ${k}</td><td class="num">${money(t)}</td><td class="num">${money(t1)}</td></tr></tfoot>`
    return `<div class="cols"><section><h2>Actif</h2>${tbl(["Poste", "#N (26/11/2026)", "#N-1 (31/12/2025)"], side("A"), "", foot("actif", n.tA, n1.tA))}</section>
      <section><h2>Passif</h2>${tbl(["Poste", "#N (26/11/2026)", "#N-1 (31/12/2025)"], side("P"), "", foot("passif", n.tP, n1.tP))}</section></div>
      <p class="muted">Postes nets d'amortissements et de dépréciations, issus de la table de correspondance comptes → postes ${ref9("EF-FIN-018")}. Chaque poste est traçable jusqu'à l'écriture via la ${`<button class="link" onclick="go('fin-compta/balance')">balance</button>`}.</p>`
  }
  function resultatView() {
    const f = "2026-01-01", t = "2026-12-31", P = (x) => -bal(x, t, f), C = (x) => bal(x, t, f)
    const marge = P("701") - C("601"), prod = P("706"), conso = C("602") + C("6032") + C("604") + C("605"), serv = C("62") + C("63"), imp = C("64")
    const va = marge + prod + P("758") - conso - serv - imp, ebe = va - C("66"), re = ebe - C("681") - C("659"), rf = -C("671"), hao = P("82") - C("81")
    const rows = [
      ["Ventes de marchandises (701)", P("701"), "701"], ["Achats de marchandises (601)", -C("601"), "601"], ["Marge commerciale", marge, null, 1],
      ["Production vendue — services (706)", prod, "7061"], ["Achats consommés et variation de stocks", -conso, "602"], ["Services extérieurs (62, 63)", -serv, "632"], ["Impôts et taxes (64)", -imp, "641"], ["Valeur ajoutée", va, null, 1],
      ["Charges de personnel (66)", -C("66"), "661"], ["Excédent brut d'exploitation (EBE)", ebe, null, 1],
      ["Dotations aux amortissements et provisions", -(C("681") + C("659")), "681"], ["Résultat d'exploitation", re, null, 1],
      ["Résultat financier", rf, "671"], ["Résultat des activités ordinaires", re + rf, null, 1], ["Résultat hors activités ordinaires (HAO)", hao, "822"],
      ["Impôt sur le résultat", 0, null], ["Résultat net (provisoire)", re + rf + hao, null, 1],
    ]
    return `${tbl(["Soldes significatifs de gestion SYSCOHADA", "#Exercice 2026 au 26/11"], rows.map(([l, v, a, b]) => [b ? `<strong>${esc(l)}</strong>` : `${esc(l)}${a ? " " + accLink(a) : ""}`, b ? `<strong>${money(v)}</strong>` : money(v)]))}
      <p class="muted">Impôt sur le résultat non calculé en cours d'exercice. Les numéros de compte renvoient au grand livre.</p>`
  }
  function fluxView() {
    const res = resultat(), dot = bal("681"), capex = 0, emprunt = -(bal("162", "9999", "2026-01-02"))
    const bfr = -(bal("4", "9999", "2026-01-02") + bal("3", "9999", "2026-01-02"))
    const rows = [["Capacité d'autofinancement globale (résultat + dotations)", res + dot], ["Variation du besoin en fonds de roulement", bfr], ["Flux de trésorerie des activités opérationnelles", res + dot + bfr],
      ["Flux des activités d'investissement", -capex], ["Remboursements d'emprunts", -emprunt], ["Flux des activités de financement", -emprunt],
      ["Variation de trésorerie", res + dot + bfr - capex - emprunt], ["Trésorerie au 31/12/2025", bal("5", "2026-01-01")], ["Trésorerie au 26/11/2026", bal("5")]]
    return `${tbl(["Tableau des flux de trésorerie (simplifié)", "#Montant"], rows.map(([l, v], i) => [[2, 5, 6, 8].includes(i) ? `<strong>${esc(l)}</strong>` : esc(l), money(v)]))}
      <p class="muted">Retraitements paramétrés simplifiés pour la maquette. Le Système minimal de trésorerie est proposé pour les petites entités.</p>`
  }
  function dsfView() {
    const ctl = controls(), p = F.dsfPreview
    return `${tbl(["Exercice", "Document", "Statut", ""], [
      ["2025", "DSF — système normal", badge("Déposée (simulé)", "on"), btn("Exporter le fichier", "toast('Export simulé : DSF_2025_HEX.xml')", "ghost sm")],
      ["2026", "DSF — aperçu provisoire", p ? badge(`Aperçu généré le ${p}`, "outline") : badge("Non générée", ""), btn("Générer l'aperçu", "A.fin.dsf()", "sm")],
    ])}
      <h2>Contrôles de cohérence ${ref9("EF-FIN-019 · US-FIN-02")}</h2>
      ${tbl(["Contrôle", "Résultat"], [
        ["Balance équilibrée", ctl.balOk ? badge("OK", "on") : badge("Écart", "dark")], ["Actif = passif", ctl.bilOk ? badge("OK", "on") : badge("Écart", "dark")],
        ["Résultat du bilan = résultat du compte de résultat", badge("OK", "on")], ["Tableaux des immobilisations = registre", badge("OK", "on")],
        ["Exercice clôturé (requis pour le dépôt)", badge("Non", "dark")],
      ])}
      <p class="muted">Le fichier officiel ne peut être déposé qu'après la clôture annuelle. Format de télédéclaration simulé.</p>`
  }
  function consoView() {
    const rate = 655.957, hexCA = -bal("7"), hexRes = resultat()
    const scope = [
      { n: "Hôtel Exemple SARL", pct: 100, m: "Société mère", cur: "XOF", ca: hexCA, res: hexRes },
      { n: "Restauration Lagune Exemple SARL", pct: 70, m: "Intégration globale", cur: "XOF", ca: 96000000, res: 8400000 },
      { n: "Résidence Assinie Exemple SA", pct: 50, m: "Intégration proportionnelle", cur: "XOF", ca: 142000000, res: 12600000 },
      { n: "Société Exemple Paris SAS", pct: 30, m: "Mise en équivalence", cur: "EUR", ca: 410000 * rate, res: 36000 * rate },
    ]
    const elim = [["Refacturation de frais de gestion (mère → Résidence Assinie Exemple)", 6000000], ["Achats via la centrale (Restauration → mère)", 4200000], ["Prêt intragroupe (mère → Restauration)", 15000000]]
    const r = F.conso
    return `${tbl(["Entité", "#% intérêt", "Méthode", "Devise", "#Chiffre d'affaires (XOF)", "#Résultat (XOF)"], scope.map((s) => [esc(s.n), s.pct + " %", esc(s.m), esc(s.cur), money(s.ca), money(s.res)]))}
      <p class="muted">Conversion EUR → XOF à la parité fixe de 655,957 ${ref9("EF-FIN-023")}.</p>
      <h2>Opérations intercompagnies à éliminer ${ref9("EF-FIN-022")}</h2>${tbl(["Opération", "#Montant"], elim.map(([l, v]) => [esc(l), money(v)]))}
      <div class="row" style="margin-top:12px">${btn(r ? "Relancer la consolidation (simulé)" : "Lancer la consolidation (simulé)", "A.fin.consolidate()")}</div>
      ${r ? `<h2>Résultat de la consolidation</h2>${cards([kpi("Chiffre d'affaires consolidé", mm(r.ca), "Après éliminations"), kpi("Résultat part du groupe", mm(r.pg), "Simulé"), kpi("Intérêts minoritaires", mm(r.mino), "30 % de Restauration Lagune Exemple")])}` : ""}`
  }

  // ---------- Actions ----------
  const err = (id, m) => { const el = document.getElementById(id); if (el) el.innerHTML = `<div class="err">${esc(m)}</div>`; return false }
  const isChef = () => ROLE[ui.finUser] === "Chef comptable"
  const genEntry = (ev, lines) => {
    if (periodOf(ev.date) !== "ouverte") return toast(`Période ${ev.date.slice(0, 7)} clôturée : évènement à comptabiliser sur la période ouverte`), null
    const e = addEntry({ j: ev.j, date: ev.date, piece: ev.id, label: ev.label, src: ev.src, lines, by: "Système" })
    Object.assign(ev, { status: "generee", entry: e.id })
    if (ev.kind === "prc") F.supInv.push({ id: uid("FF"), t: "FO-A", no: "FA-A-1203", date: ev.date, ech: "2026-12-26", ttc: 849600, check: "Conforme (commande, réception, facture)", ok: true, status: "a_payer" })
    return e
  }
  const actions = {
    setUser(u) { ui.finUser = u; toast(`Profil : ${u} (${ROLE[u]})`); render() },
    dismiss(id) { F.anomalies.find((a) => a.id === id).open = false; toast("Anomalie classée"); render() },
    addAccount() {
      const n = val("fin-acc-num"), label = val("fin-acc-label"), f = val("fin-acc-flags")
      if (!/^[1-9]\d{1,7}$/.test(n)) return err("fin-acc-err", "Numéro invalide : 2 à 8 chiffres, commençant par la classe (1 à 9).")
      if (acc(n)) return err("fin-acc-err", `Le compte ${n} existe déjà.`)
      if (!label) return err("fin-acc-err", "Indiquez un libellé.")
      F.accounts.push({ num: n, label, cls: n[0], lett: f.includes("L"), tiers: f.includes("T"), ana: f.includes("A"), custom: true })
      F.accounts.sort((a, b) => a.num.localeCompare(b.num))
      ui.finCls = n[0]; toast(`Compte ${n} ajouté au plan`); render()
    },
    // saisie
    df(k, v) { ui.finDraft[k] = v },
    dl(i, k, v) {
      ui.finDraft.lines[i][k] = v
      if (k === "a" && ANA[v] && !ui.finDraft.lines[i].ana) { ui.finDraft.lines[i].ana = ANA[v]; const s = document.getElementById(`fin-a-${i}`); if (s) s.value = ANA[v] }
      const t = $("#fin-tot"); if (t) t.innerHTML = draftTotals()
      const b = $("#fin-submit"); if (b) b.disabled = !draftOk()
    },
    addLine() { ui.finDraft.lines.push({ a: "", t: "", ana: "", d: "", c: "" }); render() },
    delLine(i) { ui.finDraft.lines.splice(i, 1); render() },
    tpl(k) { const t = TEMPLATES[k]; ui.finDraft = { ...blankDraft(), ...(t ? JSON.parse(JSON.stringify(t)) : {}) }; render() },
    submit() {
      const d = ui.finDraft, ls = d.lines.filter((l) => l.a || +l.d || +l.c)
      const j = F.journals.find((x) => x.code === d.j)
      if (ls.length < 2) return err("fin-err", "Une écriture comporte au moins deux lignes.")
      for (const l of ls) {
        const a = acc(l.a)
        if (!a) return err("fin-err", `Compte « ${l.a} » absent du plan comptable.`)
        if ((+l.d > 0) === (+l.c > 0)) return err("fin-err", `Compte ${l.a} : saisir soit un débit, soit un crédit.`)
        if (a.tiers && !l.t) return err("fin-err", `Le compte collectif ${l.a} exige un compte de tiers (RG-FIN-05).`)
        if (a.ana && !l.ana) return err("fin-err", `Le compte ${l.a} exige une section analytique (RG-FIN-05).`)
      }
      const [dd, cc] = [sum(ls.map((l) => +l.d || 0)), sum(ls.map((l) => +l.c || 0))]
      if (dd !== cc) return err("fin-err", `Écriture déséquilibrée : débit ${money(dd)}, crédit ${money(cc)} (RG-FIN-01).`)
      const per = periodOf(d.date)
      if (per === "cloturee") return err("fin-err", `La période ${d.date.slice(0, 7)} est clôturée : aucune écriture possible. Passez une régularisation sur une période ouverte (RG-FIN-04).`)
      if (!per) return err("fin-err", "La date de pièce n'appartient à aucune période ouverte de l'exercice (RG-FIN-09).")
      if (!d.piece) return err("fin-err", "Référence de la pièce justificative obligatoire.")
      if (!d.label) return err("fin-err", "Indiquez un libellé.")
      if (j.must && !ls.some((l) => l.a.startsWith(j.must))) return err("fin-err", `Le journal ${j.code} exige une ligne sur le compte ${j.must}.`)
      const big = dd > SEUIL
      const e = addEntry({ j: d.j, date: d.date, piece: d.piece, label: d.label, src: "Manuel", rec: d.rec, autoRev: d.autoRev, status: big ? "a_valider" : "validee", lines: ls.map((l) => ({ a: l.a, t: l.t, ana: l.ana, d: +l.d || 0, c: +l.c || 0 })) })
      ui.finDraft = blankDraft()
      toast(big ? `Au-delà de ${money(SEUIL)} : écriture soumise au chef comptable` : `Écriture ${ref(e)} validée`)
      go(`fin-compta/journaux/${e.id}`)
    },
    saveDraft() {
      const d = ui.finDraft
      const e = addEntry({ j: d.j, date: d.date, piece: d.piece || "—", label: d.label || "Brouillard sans libellé", src: "Manuel", status: "brouillard", lines: d.lines.filter((l) => l.a).map((l) => ({ a: l.a, t: l.t, ana: l.ana, d: +l.d || 0, c: +l.c || 0 })) })
      ui.finDraft = blankDraft(); toast("Brouillard enregistré"); go(`fin-compta/journaux/${e.id}`)
    },
    resume(id) {
      const e = F.entries.find((x) => x.id === id)
      ui.finDraft = { j: e.j, date: e.date, piece: e.piece === "—" ? "" : e.piece, label: e.label, rec: false, autoRev: false, lines: e.lines.map((l) => ({ a: l.a, t: l.t || "", ana: l.ana || "", d: l.d ? String(l.d) : "", c: l.c ? String(l.c) : "" })) }
      while (ui.finDraft.lines.length < 2) ui.finDraft.lines.push({ a: "", t: "", ana: "", d: "", c: "" })
      F.entries.splice(F.entries.indexOf(e), 1); toast("Brouillard repris dans la saisie"); go("fin-compta/saisie")
    },
    delDraft(id) { const e = F.entries.find((x) => x.id === id); if (e.status !== "brouillard") return; F.entries.splice(F.entries.indexOf(e), 1); toast("Brouillard supprimé"); go("fin-compta/journaux") },
    validate(id) {
      const e = F.entries.find((x) => x.id === id)
      if (!isChef()) return toast("Validation réservée au chef comptable : changez de profil")
      if (e.by === ui.finUser) return toast("Séparation des tâches : le saisisseur ne peut pas valider (RG-FIN-08)")
      if (periodOf(e.date) !== "ouverte") return toast("Période clôturée : validation impossible (RG-FIN-04)")
      postEntry(e); e.vby = ui.finUser
      F.anomalies.filter((a) => a.id === "AN2").forEach((a) => (a.open = false))
      toast(`Écriture ${ref(e)} validée`); render()
    },
    reverse(id) {
      const e = F.entries.find((x) => x.id === id)
      if (periodOf(today) !== "ouverte") return toast("Aucune période ouverte pour l'extourne")
      const r = addEntry({ j: e.j, date: today, piece: e.piece, label: `Extourne — ${e.label}`, src: "Extourne", revOf: e.id, lines: e.lines.map((l) => ({ a: l.a, t: l.t, ana: l.ana, d: l.c, c: l.d })) })
      e.revBy = r.id; toast(`Extourne ${ref(r)} passée au ${fd(today)}`); go(`fin-compta/journaux/${r.id}`)
    },
    genEvent(id) { const ev = F.events.find((e) => e.id === id); if (ev.status === "generee" || ev.err) return; const e = genEntry(ev, build[ev.kind]()); if (e) toast(`Écriture ${ref(e)} générée`); render() },
    genAll() { const ready = F.events.filter((e) => e.status !== "generee" && !e.err); ready.forEach((ev) => genEntry(ev, build[ev.kind]())); toast(`${ready.length} écriture(s) générée(s)`); render() },
    fixEvent(id) { const ev = F.events.find((e) => e.id === id); ev.err = null; const e = genEntry(ev, build[ev.kind]()); if (e) toast(`Tiers affecté, écriture ${ref(e)} générée`); render() },
    // lettrage
    ltSum() { const v = sum([...document.querySelectorAll(".fin-lt:checked")].map((c) => +c.dataset.v)); $("#fin-ltsum").innerHTML = `Sélection : ${money(v)} ${v === 0 ? "" : "— le lettrage exige un solde nul"}` },
    letter() {
      const sel = [...document.querySelectorAll(".fin-lt:checked")]
      if (sel.length < 2) return toast("Sélectionnez au moins deux lignes")
      const v = sum(sel.map((c) => +c.dataset.v))
      if (v !== 0) return toast(`Lettrage impossible : écart de ${money(v)}. Lettrage partiel non autorisé dans la maquette`)
      const code = "L" + (F.entries.flatMap((e) => e.lines).filter((l) => l.let && l.let !== "P").map((l) => l.let).filter((x, i, a) => a.indexOf(x) === i).length + 1)
      sel.forEach((c) => { const [eid, i] = c.dataset.k.split(":"); F.entries.find((e) => e.id === eid).lines[+i].let = code })
      toast(`Lettrage ${code} : ${sel.length} lignes`); render()
    },
    unletter(t, code) { F.entries.forEach((e) => e.lines.forEach((l) => l.t === t && l.let === code && (l.let = ""))); toast(`Lettrage ${code} annulé`); render() },
    autoLet(type) {
      let n = 0
      F.tiers.filter((t) => t.type === type).forEach((t) => {
        const open = allLines((l) => l.t === t.id && !l.let)
        open.filter((l) => l.d > 0).forEach((dl) => {
          const m = open.find((cl) => cl.c === dl.d && !F.entries.find((e) => e.id === cl.e.id).lines[cl.i].let && (cl.piece || cl.e.piece) === (dl.piece || dl.e.piece))
          if (m && !F.entries.find((e) => e.id === dl.e.id).lines[dl.i].let) {
            const code = "A" + ++n
            F.entries.find((e) => e.id === dl.e.id).lines[dl.i].let = code; F.entries.find((e) => e.id === m.e.id).lines[m.i].let = code
          }
        })
      })
      toast(n ? `${n} paire(s) lettrée(s) automatiquement (montant et pièce identiques)` : "Aucune correspondance exacte trouvée"); render()
    },
    // fournisseurs
    propose() {
      const due = F.supInv.filter((s) => s.status === "a_payer" && s.ok && s.ech <= addDays(today, 30))
      if (!due.length) return toast("Aucune facture conforme à proposer")
      due.forEach((s) => Object.assign(s, { status: "proposee", by: ui.finUser }))
      toast(`Proposition de paiement : ${due.length} facture(s)`); render()
    },
    pay() {
      const prop = F.supInv.filter((s) => s.status === "proposee")
      if (prop.some((s) => s.by === ui.finUser)) return toast("Séparation des tâches : l'auteur de la proposition ne peut pas valider le paiement (RG-FIN-08)")
      if (ROLE[ui.finUser] === "Comptable") return toast("Validation réservée au trésorier ou au chef comptable")
      prop.forEach((s) => {
        const e = addEntry({ j: "BQA", date: today, piece: "VIR-" + s.no, label: `Règlement ${tname(s.t)} (${s.no})`, src: "Paiement", lines: [Dr("401", s.ttc, { t: s.t, piece: s.no }), Cr("5211", s.ttc)] })
        s.status = "payee"; s.entry = e.id
      })
      toast(`Ordre de virement émis (simulé) : ${prop.length} facture(s)`); render()
    },
    ocrValidate() {
      const o = F.ocr, ttcAmount = +val("fin-o-ttc"), t = val("fin-o-t"), no = val("fin-o-no"), date = val("fin-o-date"), ech = val("fin-o-ech"), a = val("fin-o-acc"), ana = val("fin-o-ana")
      if (!(ttcAmount > 0) || !no) return toast("Montant et numéro de facture obligatoires")
      if (periodOf(date) !== "ouverte") return toast("Date de facture sur une période clôturée (RG-FIN-04)")
      if (F.supInv.some((s) => s.no === no && s.t === t)) return toast("Doublon : cette facture est déjà enregistrée")
      const [ht, tv] = htTva(ttcAmount)
      const e = addEntry({ j: "AC", date, piece: no, label: `${tname(t)} — facture ${no} (lecture IA validée)`, src: "PRC", lines: [Dr(a, ht, { ana }), Dr("4452", tv), Cr("401", ttcAmount, { t, piece: no, ech })] })
      F.supInv.push({ id: uid("FF"), t, no, date, ech, ttc: ttcAmount, check: "Contrat de maintenance (sans commande)", ok: true, status: "a_payer" })
      Object.assign(o, { status: "comptabilisée", entry: e.id, t, no, ttc: ttcAmount })
      toast(`Facture ${no} comptabilisée (${ref(e)})`); render()
    },
    ocrReject() { F.ocr.status = "rejetée"; toast("Facture rejetée et renvoyée au fournisseur (simulé)"); render() },
    // trésorerie
    transfer() {
      const from = val("fin-vi-from"), to = val("fin-vi-to"), amt = +val("fin-vi-amt")
      if (from === to) return toast("Choisissez deux comptes différents")
      if (!(amt > 0)) return toast("Indiquez un montant")
      if (amt > bal(from)) return toast("Solde insuffisant sur le compte émetteur")
      addEntry({ j: "OD", date: today, piece: uid("VI"), label: `Virement interne ${accLabel(from)} → ${accLabel(to)}`, src: "Trésorerie", lines: [Dr("585", amt), Cr(from, amt)] })
      addEntry({ j: "OD", date: today, piece: uid("VI"), label: `Virement interne reçu sur ${accLabel(to)}`, src: "Trésorerie", lines: [Dr(to, amt), Cr("585", amt)] })
      toast(`Virement interne de ${money(amt)} passé`); render()
    },
    autoMatch() {
      let a = 0, s = 0
      F.stmt.filter((x) => !x.m).forEach((x) => {
        const mk = matchedKeys(), cand = bankLines().filter((l) => !mk.has(lineKey(l)) && l.d - l.c === x.amt)
        const close = cand.filter((l) => Math.abs(daysBetween(l.e.date, x.date)) <= 2)
        if (close.length === 1) { Object.assign(x, { m: lineKey(close[0]), how: "auto", sug: null }); a++ }
        else if (cand.length) { x.sug = `${ref(cand[0].e)} du ${fd(cand[0].e.date)} — ${cand[0].e.label} (date éloignée de ${Math.abs(daysBetween(cand[0].e.date, x.date))} j)`; x.sugKey = lineKey(cand[0]); s++ }
      })
      toast(`${a} ligne(s) rapprochée(s) automatiquement, ${s} suggestion(s)`); render()
    },
    acceptSug(id) { const x = F.stmt.find((s) => s.id === id); Object.assign(x, { m: x.sugKey, how: "suggestion", sug: null }); toast("Suggestion acceptée"); render() },
    manualMatch(id) { const x = F.stmt.find((s) => s.id === id), k = val(`fin-m-${id}`); if (!k) return; Object.assign(x, { m: k, how: "manuel" }); toast("Ligne pointée manuellement"); render() },
    bookStmt(id) {
      const x = F.stmt.find((s) => s.id === id)
      if (periodOf(x.date) !== "ouverte") return toast("Période clôturée")
      const e = addEntry({ j: "BQA", date: x.date, piece: x.id, label: `Banque : ${x.label.toLowerCase()}`, src: "Relevé", lines: x.amt < 0 ? [Dr("631", -x.amt, { ana: "ADM" }), Cr("5211", -x.amt)] : [Dr("5211", x.amt), Cr("4711", x.amt)] })
      Object.assign(x, { m: `${e.id}:${x.amt < 0 ? 1 : 0}`, how: "cree" })
      toast(`Écriture ${ref(e)} passée et rapprochée`); render()
    },
    importStmt() {
      if (F.stmt.some((s) => s.id === "S10")) return toast("Relevé du 26/11 déjà importé")
      F.stmt.push({ id: "S10", date: "2026-11-26", label: "REMISE CB PSP EXEMPLE 2511", amt: 3450000, m: null, how: null, sug: null })
      toast("Relevé importé : 1 nouvelle ligne"); render()
    },
    // immobilisations
    cession(id) {
      const a = F.assets.find((x) => x.id === id), price = +val("fin-cess-price") || 0
      if (!confirm(`Sortir « ${a.label} » du registre ?`)) return
      const cum = cumulAt(a, "2026-11-01") + (deprDone() ? monthly(a) : 0), vnc = a.base - cum
      const lines = [Dr("812", vnc), Dr(a.amo, cum), Cr(a.acc, a.base), ...(price ? [Dr("5211", price), Cr("822", price)] : [])]
      const e = addEntry({ j: "OD", date: today, piece: "CES-" + a.id, label: `${price ? "Cession" : "Mise au rebut"} — ${a.label}`, src: "Immobilisations", lines })
      a.status = price ? "Cédée" : "Mise au rebut"
      toast(`${a.status} : écriture ${ref(e)}, plus-value ${money(price - vnc)}`); render()
    },
    // fiscalité
    prepTax() {
      const t = tvaNov()
      F.taxReturns.push({ id: uid("TX"), type: "TVA", period: "Novembre 2026", amount: t.net, status: "Brouillon", due: "2026-12-15" }, { id: uid("TX"), type: "Taxe de séjour", period: "Novembre 2026", amount: t.ts, status: "Brouillon", due: "2026-12-15" })
      toast("Déclarations de novembre préparées"); render()
    },
    valTax(id) { if (!isChef()) return toast("Validation réservée au chef comptable"); F.taxReturns.find((x) => x.id === id).status = "Validée"; toast("Déclaration validée"); render() },
    fileTax(id) {
      if (F.periods[NOV] !== "cloturee") return toast("Clôturez novembre avant de télédéclarer")
      const x = F.taxReturns.find((r) => r.id === id), t = tvaNov()
      Object.assign(x, { status: "Déposée", ack: "ACK-EXEMPLE-" + Math.floor(Math.random() * 9000 + 1000) })
      if (x.type === "TVA") addEntry({ j: "OD", date: "2026-12-01", piece: x.ack, label: "Centralisation de la TVA de novembre", src: "Fiscalité", lines: [Dr("4431", t.col), Cr("4452", t.ded), Cr("4441", t.col - t.ded)] })
      toast(`Télédéclaration simulée : accusé ${x.ack}`); render()
    },
    // gestion
    comment(i, s) { F.comments[i].status = s; toast(`Commentaire ${s}`); render() },
    newBudget() { const v = `V${F.budgetVersions.length + 1} révision du ${fd(today)}`; F.budgetVersions.push(v); F.budgetV = ui.finBudgetV = v; toast(`Version ${v} créée`); render() },
    saveBudget() { F.usali.forEach((x) => { const v = +val(`fin-bd-${x.d}`); if (v >= 0) F.budgetDec[x.d] = v }); toast("Budget de décembre enregistré"); render() },
    // clôture
    toggleStep(k) { F.closeManual[k] = !F.closeManual[k]; render() },
    applyProp(id) {
      const p = F.proposals.find((x) => x.id === id)
      if (periodOf("2026-11-30") !== "ouverte") return toast("Période clôturée")
      const e = addEntry({ j: "OD", date: "2026-11-30", piece: "CLO-" + p.id, label: p.label, src: "Assistant de clôture", autoRev: p.id === "P3", lines: p.lines.map((l) => ({ ...l })), by: "Assistant IA (proposition)", vby: ui.finUser })
      p.done = true; toast(`Écriture ${ref(e)} passée`); render()
    },
    lockNov() {
      if (!isChef()) return toast("Verrouillage réservé au chef comptable : changez de profil")
      if (!closeSteps().every((s) => s.done)) return toast("Toutes les étapes doivent être faites")
      F.periods[NOV] = "cloturee"; F.closedNov = fd(today) + "/2026"
      toast("Novembre clôturé : balance définitive figée"); render()
    },
    reopen2025() { toast("Exercice 2025 approuvé : clôture irréversible (RG-FIN-04)") },
    // états
    dsf() { const c = controls(); if (!c.balOk || !c.bilOk) return toast("Contrôles en échec : génération bloquée (RG-FIN-06)"); F.dsfPreview = fd(today); toast("Aperçu DSF 2026 généré (simulé)"); render() },
    consolidate() {
      const rate = 655.957, hexCA = -bal("7"), hexRes = resultat()
      const ca = hexCA + 96000000 + 142000000 * 0.5 - 6000000 * 0.5 - 4200000
      const pg = hexRes + 8400000 * 0.7 + 12600000 * 0.5 + 36000 * rate * 0.3
      F.conso = { ca, pg, mino: 8400000 * 0.3 }
      toast("Consolidation simulée terminée"); render()
    },
  }
  ui.finBudgetV = F.budgetV

  HMS.module({
    code: "fin", group: "Finance", title: "Comptabilité et finance", phase: "18", spec: "§18 FIN",
    screens: [
      { id: "fin-pilotage", label: "Tableau de bord financier", view: views.pilotage },
      { id: "fin-compta", label: "Comptabilité générale", view: views.compta },
      { id: "fin-tiers", label: "Tiers et lettrage", view: views.tiers },
      { id: "fin-treso", label: "Trésorerie", view: views.treso },
      { id: "fin-immo", label: "Immobilisations", view: views.immo },
      { id: "fin-fiscal", label: "Fiscalité", view: views.fiscal },
      { id: "fin-gestion", label: "Analytique et budgets", view: views.gestion },
      { id: "fin-cloture", label: "Clôtures", view: views.cloture },
      { id: "fin-etats", label: "États financiers et DSF", view: views.etats },
    ],
    actions,
  })
})()
