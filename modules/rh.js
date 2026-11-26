// modules/rh.js — Spec §5 Ressources humaines, effectifs et paie (HRM)
// Dossiers du personnel, organigramme, certifications, entrées/sorties ; plannings, pointage, congés ;
// cycle de paie mensuel (§5.13), bulletins (§5.14), virements, pourboires, prêts ; déclarations CNPS/ITS/FDFP/DISA ;
// KPI RH (§5.12) et IA (§5.11). Pack Côte d'Ivoire SIMULÉ : taux et barèmes d'exemple, à valider par un expert local.
;(() => {
  // ---------- Paramètres du pack de paie (exemple) ----------
  const PACK = {
    version: "Pack CI v2026.1 (exemple)", effect: "2026-01-01",
    smig: 75000, transportCap: 30000, capRet: 3375000, capPF: 70000,
    retS: 0.063, retP: 0.077, pf: 0.0575, at: 0.03, cmuS: 1000, cmuP: 1000,
    ce: 0.012, ta: 0.004, fpc: 0.012, quotite: 1 / 3,
    bareme: [[75000, 0], [240000, 0.16], [800000, 0.21], [2400000, 0.24], [8000000, 0.28], [Infinity, 0.32]],
    reduc: { 1: 0, 1.5: 5500, 2: 11000, 2.5: 16500, 3: 22000, 3.5: 27500, 4: 33000, 4.5: 38500, 5: 44000 },
  }
  const CATS = { E1: 75000, E2: 85000, E3: 100000, AM1: 160000, AM2: 220000, C1: 350000, C2: 500000, C3: 800000 }
  const DEPTS = { DIR: "Direction", ADM: "Administration et finance", HEB: "Hébergement (réception)", HK: "Étages", FNB: "Restauration", TEC: "Maintenance", SEC: "Sécurité" }
  const USERS = { PAIE: "Gestionnaire de paie (Seydou Ouattara)", DRH: "Responsable RH (Adjoua Konan)", DAF: "DAF (Jean-Marc Yapi)", TRE: "Trésorière (Nadège Beugré)", DG: "Directeur (Kouadio Brou)" }
  const SH = { M: { l: "Matin 06–14", s: 6, e: 14, h: 8 }, S: { l: "Soir 14–22", s: 14, e: 22, h: 8 }, N: { l: "Nuit 22–06", s: 22, e: 30, h: 8 }, J: { l: "Journée 08–17", s: 8, e: 17, h: 8 }, L: { l: "Longue 07–19", s: 7, e: 19, h: 11 }, R: { l: "Repos", h: 0 } }
  const ORDER = ["M", "S", "N", "J", "L", "R"]
  const WEEK = Array.from({ length: 7 }, (_, i) => addDays("2026-11-23", i))
  const REQ = { "Chef de cuisine": "Hygiène alimentaire (HACCP)", "Commis de cuisine": "Hygiène alimentaire (HACCP)", Serveur: "Hygiène alimentaire (HACCP)", "Agent de sécurité": "Sécurité incendie (SSIAP 1)", "Technicien de maintenance": "Habilitation électrique" }
  const ACCESS = { DIR: "Permanent (direction)", SEC: "Permanent (sécurité)", HK: "Étages + lingerie, sur poste ± 30 min", FNB: "Cuisine + salle, sur poste ± 30 min", HEB: "Réception + bagagerie, sur poste ± 30 min", TEC: "Locaux techniques + étages, sur poste ± 30 min", ADM: "Bureaux administratifs, sur poste ± 30 min" }

  const mail = (n) => n.normalize("NFD").replace(/[\u0300-\u036f']/g, "").toLowerCase().split(" ").join(".") + "@exemple.test"
  const emp = (id, name, dept, job, cat, contract, start, base, o = {}) => ({ id, mat: "HE-" + id.slice(1).padStart(4, "0"), name, dept, job, cat, contract, start, end: null, base, sursal: 0, transport: 30000, logement: 0, panier: 0, aenLog: 0, parts: 1, family: "Célibataire", manager: "E01", pay: { mode: "Virement", ref: "" }, pts: 0, status: "actif", cpAcq: 13.2, cpPris: 4, email: mail(name), phone: `+225 07 00 00 00 ${id.slice(1).padStart(2, "0")}`, history: [],
    entity: "ENT1", prop: "Hôtel Exemple (Abidjan Plateau)", hours: 40, aenNour: 0, addr: "Abidjan, Cocody (exemple)", idDoc: "CNI C00" + id.slice(1).padStart(7, "0") + " (fictive)", access: "actif", ...o })

  D.hrm = {
    emps: [
      emp("E01", "Kouadio Brou", "DIR", "Directeur d'exploitation", "C3", "CDI", "2019-03-01", 1250000, { aenLog: 250000, parts: 3.5, family: "Marié, 3 enfants", manager: null, pay: { mode: "Virement", ref: "Banque Lagune Exemple ••••4521" }, cpPris: 6 }),
      emp("E02", "Adjoua Konan", "ADM", "Responsable RH", "C2", "CDI", "2020-06-15", 680000, { logement: 80000, parts: 3, family: "Mariée, 2 enfants", pay: { mode: "Virement", ref: "Banque Akwaba Exemple ••••1180" } }),
      emp("E03", "Seydou Ouattara", "ADM", "Gestionnaire de paie", "AM2", "CDI", "2021-09-01", 420000, { manager: "E02", pay: { mode: "Virement", ref: "Banque Lagune Exemple ••••3307" }, cpPris: 2 }),
      emp("E04", "Jean-Marc Yapi", "ADM", "Directeur administratif et financier", "C2", "CDI", "2020-01-06", 950000, { logement: 120000, parts: 2.5, family: "Marié, 1 enfant", pay: { mode: "Virement", ref: "Banque Lagune Exemple ••••9012" } }),
      emp("E05", "Estelle Assi", "HEB", "Chef de réception", "AM2", "CDI", "2017-04-03", 390000, { parts: 2.5, family: "Mariée, 1 enfant", pay: { mode: "Virement", ref: "Banque Akwaba Exemple ••••6645" }, pts: 3 }),
      emp("E06", "Hervé Gnagne", "HEB", "Réceptionniste", "E3", "CDI", "2022-02-01", 185000, { parts: 1.5, family: "Célibataire, 1 enfant", manager: "E05", pay: { mode: "Virement", ref: "Banque Lagune Exemple ••••7788" }, pts: 2,
        history: [{ date: "2026-11-01", type: "Augmentation", detail: "175 000 → 185 000 FCFA", by: "PAIE" }] }),
      emp("E07", "Lassina Coulibaly", "HEB", "Réceptionniste de nuit", "E3", "CDD", "2026-03-01", 175000, { end: "2027-02-28", panier: 15000, manager: "E05", pay: { mode: "Virement", ref: "Banque Lagune Exemple ••••7788" }, pts: 2, noClock: true, cpAcq: 13.2, cpPris: 0 }),
      emp("E08", "Amenan Kouamé", "HK", "Gouvernante générale", "AM1", "CDI", "2016-08-01", 270000, { parts: 4, family: "Mariée, 4 enfants", pay: { mode: "Virement", ref: "Banque Akwaba Exemple ••••2290" }, pts: 2, cpPris: 3 }),
      emp("E09", "Akissi N'Guessan", "HK", "Femme de chambre", "E1", "CDI", "2018-05-02", 95000, { transport: 25000, parts: 3, family: "Mariée, 2 enfants", manager: "E08", pay: { mode: "Mobile Money", ref: "Mobile Money ••••0909" }, pts: 1 }),
      emp("E10", "Mariam Bamba", "HK", "Femme de chambre", "E1", "CDI", "2023-01-09", 92000, { transport: 25000, parts: 2, family: "Célibataire, 2 enfants", manager: "E08", pay: { mode: "Mobile Money", ref: "Mobile Money ••••1010" }, payPending: { mode: "Mobile Money", ref: "Mobile Money ••••5566", on: "2026-11-24", src: "Demande via l'app mobile personnel" }, pts: 1 }),
      emp("E11", "Affoué Aka", "HK", "Femme de chambre", "E1", "Saisonnier", "2026-11-03", 90000, { end: "2027-01-31", addr: "Grand-Bassam (exemple)", prop: "Hôtel Exemple Grand-Bassam (exemple)", transport: 25000, manager: "E08", pay: { mode: "Mobile Money", ref: "Mobile Money ••••1111" }, pts: 1, cpAcq: 0, cpPris: 0 }),
      emp("E12", "Konan Tanoh", "FNB", "Chef de cuisine", "AM2", "CDI", "2019-11-04", 480000, { aenNour: 20000, addr: "Abidjan, Marcory (exemple)", parts: 3, family: "Marié, 2 enfants", pay: { mode: "Virement", ref: "Banque Lagune Exemple ••••5120" }, pts: 4 }),
      emp("E13", "Moussa Doumbia", "FNB", "Commis de cuisine", "E2", "CDI", "2024-07-01", 120000, { aenNour: 15000, addr: "Abidjan, Yopougon (exemple)", transport: 25000, panier: 15000, manager: "E12", pay: { mode: "Mobile Money", ref: "Mobile Money ••••1313" }, pts: 2 }),
      emp("E14", "Christelle Séka", "FNB", "Serveur", "E2", "CDD", "2026-05-01", 110000, { end: "2026-12-31", transport: 25000, panier: 15000, parts: 2.5, family: "Marié, 1 enfant", manager: "E12", pay: { mode: "Mobile Money", ref: "" }, pts: 3, cpAcq: 13.2, cpPris: 0 }),
      emp("E15", "Arsène Zadi", "TEC", "Technicien de maintenance", "AM1", "CDI", "2020-10-12", 215000, { addr: "Abidjan, Treichville (exemple)", parts: 3.5, family: "Marié, 3 enfants", pay: { mode: "Virement", ref: "Banque Akwaba Exemple ••••1515" } }),
      emp("E16", "Ibrahim Fofana", "SEC", "Agent de sécurité", "E2", "CDI", "2021-03-15", 135000, { transport: 25000, panier: 15000, parts: 2.5, family: "Marié, 1 enfant", pay: { mode: "Virement", ref: "Banque Lagune Exemple ••••1616" }, cpAcq: 13.2, cpPris: 1 }),
    ],
    certs: [
      { id: "C1", emp: "E12", type: "Hygiène alimentaire (HACCP)", expires: "2027-06-30" },
      { id: "C2", emp: "E13", type: "Hygiène alimentaire (HACCP)", expires: "2026-11-15" },
      { id: "C3", emp: "E14", type: "Hygiène alimentaire (HACCP)", expires: "2026-12-20" },
      { id: "C4", emp: "E16", type: "Sécurité incendie (SSIAP 1)", expires: "2027-03-31" },
      { id: "C5", emp: "E15", type: "Habilitation électrique", expires: "2026-12-05" },
      { id: "C6", emp: "E05", type: "Secourisme (SST)", expires: "2027-09-30" },
      { id: "C7", emp: "E08", type: "Secourisme (SST)", expires: "2026-10-31" },
      { id: "C8", emp: "E06", type: "Secourisme (SST)", expires: "2028-01-15" },
    ],
    trainings: [
      { id: "F-01", title: "Hygiène alimentaire — recyclage", type: "Hygiène alimentaire (HACCP)", date: "2026-12-08", places: 6, inscrits: ["E12"] },
      { id: "F-02", title: "Secourisme (SST) — maintien des acquis", type: "Secourisme (SST)", date: "2026-12-15", places: 8, inscrits: [] },
      { id: "F-03", title: "Habilitation électrique — recyclage", type: "Habilitation électrique", date: "2026-12-03", places: 2, inscrits: [] },
    ],
    moves: [
      { date: "2026-11-03", name: "Affoué Aka", type: "Entrée", detail: "Saisonnier jusqu'au 31/01/2027 · badge activé (ACC simulé)" },
      { date: "2026-11-01", name: "Hervé Gnagne", type: "Avenant", detail: "Augmentation 175 000 → 185 000 FCFA" },
      { date: "2026-10-31", name: "Kadi Diabaté", type: "Sortie", detail: "Fin de CDD · solde de tout compte versé · accès révoqués" },
      { date: "2026-05-01", name: "Christelle Séka", type: "Entrée", detail: "CDD jusqu'au 31/12/2026" },
    ],
    plan: {
      E01: "JJJJJRR", E02: "JJJJJRR", E03: "JJJJJRR", E04: "JJJJJRR", E05: "JJJJJJR", E06: "MMSSMRM", E07: "NNNRNNN", E08: "JJJJJJR",
      E09: "MMMMMMR", E10: "MMMMMMM", E11: "SSRSSSS", E12: "JJJJJRJ", E13: "MMMMRMM", E14: "SSSRSSS", E15: "LLLLLJR", E16: "NNRNNNN",
    },
    planPublished: false,
    clocks: [
      { id: "P1", emp: "E06", date: "2026-11-25", in: "14:12", out: "22:05", src: "Badge", ok: false },
      { id: "P2", emp: "E09", date: "2026-11-25", in: "05:57", out: "", src: "Badge", ok: false },
      { id: "P3", emp: "E15", date: "2026-11-25", in: "06:55", out: "20:40", src: "Borne", ok: false },
      { id: "P4", emp: "E14", date: "2026-11-25", in: "13:55", out: "22:10", src: "Mobile (géoloc.)", geo: "hors zone (2,4 km)", ok: false },
      { id: "P5", emp: "E11", date: "2026-11-25", in: "08:02", out: "12:00", src: "Badge", ok: false },
      { id: "P6", emp: "E16", date: "2026-11-25", in: "21:52", out: "06:04", src: "Borne", ok: true },
      { id: "P7", emp: "E05", date: "2026-11-25", in: "07:56", out: "17:04", src: "Badge", ok: true },
      { id: "P8", emp: "E05", date: "2026-11-26", in: "07:58", out: "", src: "Badge", ok: false },
      { id: "P9", emp: "E13", date: "2026-11-26", in: "06:01", out: "", src: "Badge", ok: false },
      { id: "P10", emp: "E12", date: "2026-11-26", in: "07:40", out: "", src: "Mobile (géoloc.)", ok: false },
    ],
    leaves: [
      { id: "L-01", emp: "E06", type: "Congés payés", from: "2026-12-14", to: "2026-12-19", status: "Demandée" },
      { id: "L-02", emp: "E09", type: "Congés payés", from: "2026-11-27", to: "2026-11-28", status: "Validée chef" },
      { id: "L-03", emp: "E13", type: "Maladie", from: "2026-11-17", to: "2026-11-19", status: "Validée", note: "Certificat médical reçu" },
      { id: "L-04", emp: "E10", type: "Absence injustifiée", from: "2026-11-12", to: "2026-11-12", status: "Validée", note: "Constat du chef de service" },
      { id: "L-05", emp: "E14", type: "Permission (événement familial)", from: "2026-12-05", to: "2026-12-05", status: "Demandée" },
      { id: "L-06", emp: "E08", type: "Congés payés", from: "2026-11-02", to: "2026-11-07", status: "Validée" },
      { id: "L-07", emp: "E16", type: "Congés payés", from: "2027-01-04", to: "2027-01-23", status: "Demandée" },
    ],
    vars: {
      E05: { h15: 4 }, E06: { h15: 6, conso: 8500 }, E07: { h50: 8 }, E09: { h15: 6 }, E12: { prime: 50000 }, E13: { h15: 8, conso: 12000 },
      E14: { h15: 10, h75: 8, prime: 15000, conso: 9500 }, E15: { h15: 8, h50: 16, h75: 8 }, E16: { h15: 8, h75: 8 },
    },
    tronc: { pool: 960000, integrated: false, src: "Service 10 % collecté au POS (fnb, simulé)" },
    loans: [
      { id: "PR-01", emp: "E15", type: "Prêt", amount: 600000, monthly: 50000, remaining: 350000, start: "2026-05" },
      { id: "PR-02", emp: "E09", type: "Prêt", amount: 150000, monthly: 15000, remaining: 90000, start: "2026-07" },
      { id: "AV-03", emp: "E11", type: "Avance sur salaire", amount: 60000, monthly: 60000, remaining: 60000, start: "2026-11" },
      { id: "AV-04", emp: "E06", type: "Avance sur salaire", amount: 40000, monthly: 20000, remaining: 40000, start: "2026-11" },
    ],
    period: null,
    history: [
      { month: "2026-06", f: 0.955, delay: 5, errors: 2 }, { month: "2026-07", f: 0.975, delay: 4, errors: 1 },
      { month: "2026-08", f: 0.99, delay: 6, errors: 1 }, { month: "2026-09", f: 0.97, delay: 4, errors: 0 },
      { month: "2026-10", f: 0.985, delay: 4, errors: 1 },
    ],
    budget: 0, nuitees: 312,
    anoState: {}, regul: [], audit: [], disa: null, pool: "",
    // EF-HRM-009 / 010 : événements publiés vers ACC et profils d'accès par poste (surcharges)
    events: [
      { at: "26/11 06:01", type: "hrm.shift.started", emp: "E13", detail: "Badge activé · Cuisine + salle, sur poste ± 30 min" },
      { at: "26/11 07:58", type: "hrm.shift.started", emp: "E05", detail: "Badge activé · Réception + bagagerie, sur poste ± 30 min" },
    ],
    jobProfile: {},
    // EF-HRM-026 : entités juridiques, établissements et devises (taux de conversion d'exemple vers XOF)
    entities: [
      { id: "ENT1", name: "Hôtel Exemple SARL", country: "Côte d'Ivoire", cur: "XOF", rate: 1, pack: "Pack CI v2026.1 (exemple)", props: ["Hôtel Exemple (Abidjan Plateau)", "Hôtel Exemple Grand-Bassam (exemple)"] },
      { id: "ENT2", name: "Hôtel Exemple Dakar SARL (exemple)", country: "Sénégal", cur: "XOF", rate: 1, pack: "Modèle Sénégal v2026.1 (exemple)", props: ["Hôtel Exemple Dakar"], n: 22, brut: 6150000, status: "Calculée" },
      { id: "ENT3", name: "Hôtel Exemple Douala SA (exemple)", country: "Cameroun", cur: "XAF", rate: 1, pack: "Modèle Cameroun v2026.1 (exemple)", props: ["Hôtel Exemple Douala"], n: 18, brut: 5420000, status: "Ouverte" },
      { id: "ENT4", name: "Hôtel Exemple Accra Ltd (exemple)", country: "Ghana (hors OHADA)", cur: "GHS", rate: 38, pack: "Pack à paramétrer (exemple)", props: ["Hôtel Exemple Accra"], n: 12, brut: 118000, status: "Ouverte" },
    ],
    // EF-HRM-028 : demandes faites depuis l'app mobile du personnel
    attest: [{ id: "AT-01", emp: "E09", type: "Attestation de travail", date: "2026-11-18", status: "Générée" }],
    attSeq: 1, rappSeq: 0,
  }
  const H = D.hrm
  const newPeriod = (month) => ({ month, step: 1, calc: null, validated: null, paid: null, journal: null, decl: {}, editors: [], closed: null, stale: "", recon: {} })
  H.period = newPeriod("2026-11")
  H.period.editors = ["PAIE"] // l'augmentation de E06 a été saisie par le gestionnaire de paie
  Object.assign(ui, { hrDept: ui.hrDept || "all", hrLeave: ui.hrLeave || "attente", hrShow: null, hrSim: null, hrStc: null, hrLoan: null, hrForecast: "ia", hrRef: null, hrMe: ui.hrMe || "E09" })

  // ---------- Utilitaires locaux ----------
  const r0 = Math.round
  const E = (id) => H.emps.find((e) => e.id === id)
  const active = () => H.emps.filter((e) => e.status === "actif")
  const cur = () => H.period
  const ename = (id) => esc(E(id) ? E(id).name : id)
  const elink = (id) => `<button class="link" onclick="go('hr-personnel/dossiers/${esc(id)}')">${ename(id)}</button>`
  const pc = (x) => (Math.round(x * 10000) / 100).toString().replace(".", ",") + " %"
  const fh = (h) => (Math.round(h * 100) / 100).toString().replace(".", ",") + " h"
  const fj = (j) => (Math.round(j * 10) / 10).toString().replace(".", ",") + " j"
  const monthEnd = (m) => { const [y, mo] = m.split("-").map(Number); return iso(new Date(y, mo, 0)) }
  const monthLabel = (m) => { const s = day(m + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); return s[0].toUpperCase() + s.slice(1) }
  const nextMonth = (m) => monthEnd(m).slice(0, 7) === m ? addDays(monthEnd(m), 1).slice(0, 7) : m
  const years = (start, at) => { const a = day(start), b = day(at); let y = b.getFullYear() - a.getFullYear(); if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) y--; return Math.max(0, y) }
  const workDays = (from, to) => { let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) if (day(d).getDay() !== 0) n++; return n }
  const overlap = (l, a, b) => { const f = l.from > a ? l.from : a, t = l.to < b ? l.to : b; return f <= t ? workDays(f, t) : 0 }
  const kv = (pairs) => `<div class="tablewrap"><table><tbody>${pairs.map(([k, v]) => `<tr><td class="muted" style="width:42%">${esc(k)}</td><td>${v}</td></tr>`).join("")}</tbody></table></div>`
  const now = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0)
  const userSel = (id, val) => select(id, Object.entries(USERS), val)
  const muted = (t) => `<span class="muted">${esc(t)}</span>`
  const certOk = (c, at = today) => c.expires >= at
  const soon = (c) => certOk(c) && c.expires <= addDays(today, 60)
  // Contrats : minimum catégoriel au prorata du temps de travail (RG-HRM-05, EF-HRM-002)
  const minFor = (cat, hours = 40) => r0((Math.max(CATS[cat], PACK.smig) * hours) / 40)
  const monthH = (e) => (Math.round(173.33 * (e.hours || 40) / 40 * 100) / 100)
  const TERM = ["CDD", "Saisonnier", "Journalier", "Intérim", "Stage"]
  // Entités et établissements (EF-HRM-026)
  const ENT = (id) => H.entities.find((x) => x.id === id) || H.entities[0]
  const fx = (n, cur) => `${Math.round(n).toLocaleString("fr-FR").replace(/\u202f/g, " ")} ${cur}`
  // Profils d'accès physique par poste et événements vers ACC (EF-HRM-009, EF-HRM-010, RG-HRM-02)
  const profileOf = (e) => H.jobProfile[e.job] || ACCESS[e.dept]
  const permanent = (e) => /^Permanent/.test(profileOf(e))
  const accPush = (e, type, detail) => {
    H.events.unshift({ at: fd(today) + " " + now(), type, emp: e.id, detail })
    if (!D.acc || !Array.isArray(D.acc.staff)) return
    const bid = "B-H" + e.id.slice(1)
    let b = D.acc.staff.find((x) => x.hrm === e.id)
    if (!b) { b = { id: bid, name: e.name, role: e.job, zone: profileOf(e).split(",")[0], shift: "selon planning RH", status: "suspendu (hors poste)", last: today, hrm: e.id }; D.acc.staff.push(b) }
    b.zone = profileOf(e).split(",")[0]
    b.status = type === "hrm.shift.started" || type === "hrm.employee.hired" && permanent(e) ? "actif" : type === "hrm.employee.terminated" ? "révoqué" : type === "hrm.shift.ended" ? (permanent(e) ? "actif" : "suspendu (hors poste)") : b.status
    if (type === "hrm.shift.started") b.last = today
  }

  // Congés et absences
  const monthLeaves = (id, m) => H.leaves.filter((l) => l.emp === id && l.status === "Validée")
  const leaveDaysMonth = (id, m, type) => sum(monthLeaves(id, m).filter((l) => !type || l.type === type), (l) => overlap(l, m + "-01", monthEnd(m)))
  const absDays = (id, m) => leaveDaysMonth(id, m, "Absence injustifiée") + ((H.vars[id] || {}).absJ || 0)
  const cpSolde = (e) => e.cpAcq - e.cpPris - sum(H.leaves.filter((l) => l.emp === e.id && l.type === "Congés payés" && l.status === "Validée"), (l) => workDays(l.from, l.to))
  const onLeave = (id, d) => H.leaves.find((l) => l.emp === id && l.status === "Validée" && l.type !== "Absence injustifiée" && l.from <= d && d <= l.to)

  // Pourboires (tronc commun) : points par poste × jours de présence
  const troncShares = (m = cur().month) => {
    const el = active().filter((e) => e.pts > 0 && ["FNB", "HEB", "HK"].includes(e.dept))
    const w = el.map((e) => { const ms = m + "-01", startPro = e.start > ms ? workDays(e.start, monthEnd(m)) : 26; return { e, pres: Math.max(0, Math.min(26, startPro) - leaveDaysMonth(e.id, m)) } })
    const tot = sum(w, (x) => x.e.pts * x.pres) || 1
    return Object.fromEntries(w.map((x) => [x.e.id, { pres: x.pres, share: r0((H.tronc.pool * x.e.pts * x.pres) / tot) }]))
  }

  // ---------- Moteur de paie (déterministe, RG-HRM-08) ----------
  const bareme = (b) => { let t = 0, prev = 0; for (const [cap, rate] of PACK.bareme) { if (b > prev) t += (Math.min(b, cap) - prev) * rate; prev = cap } return r0(t) }
  const loanDue = (id) => sum(H.loans.filter((l) => l.emp === id && l.remaining > 0), (l) => Math.min(l.monthly, l.remaining))
  const slip = (e, m = cur().month, opts = {}) => {
    const P = PACK, v = opts.vars || H.vars[e.id] || {}, L = []
    const add = (cat, code, label, o) => L.push({ cat, code, label, base: "", rate: "", gain: 0, ret: 0, pat: 0, imp: false, ...o })
    const ms = m + "-01", me = monthEnd(m)
    const pro = e.start > ms && e.start <= me ? (nights(e.start, me) + 1) / 30 : 1
    const base = r0(e.base * pro)
    add("base", "1000", "Salaire de base catégoriel" + (pro < 1 ? " (entrée en cours de mois, prorata)" : ""), { base: pro < 1 ? `${r0(pro * 30)} j / 30` : fh(monthH(e)), rate: e.cat, gain: base, imp: true })
    if (e.sursal) add("base", "1010", "Sursalaire", { gain: r0(e.sursal * pro), imp: true })
    const y = years(e.start, me), ap = y >= 2 ? Math.min(25, y) : 0
    if (ap) add("base", "1020", `Prime d'ancienneté (${y} ans)`, { base: money(base), rate: ap + " %", gain: r0((base * ap) / 100), imp: true })
    const abs = opts.noAbs ? 0 : absDays(e.id, m)
    if (abs) add("base", "1090", "Absence non rémunérée (déduite du brut)", { base: abs + " j", rate: money(r0(e.base / 26)), gain: -r0((e.base / 26) * abs), imp: true })
    const th = e.base / monthH(e)
    ;[["h15", "1100", "Heures supplémentaires +15 %", 1.15], ["h50", "1110", "Heures supplémentaires / nuit +50 %", 1.5], ["h75", "1120", "Heures dimanche et férié +75 %", 1.75]]
      .forEach(([k, c, l, f]) => v[k] && add("var", c, l, { base: fh(v[k]), rate: money(r0(th * f)), gain: r0(th * f * v[k]), imp: true }))
    if (v.prime) add("var", "1150", "Prime de rendement", { gain: v.prime, imp: true })
    if (v.rappel) add("var", "1400", "Rappel sur périodes antérieures (régularisation)", { base: v.rappelInfo || "", gain: v.rappel, imp: true })
    const tr = !opts.noTronc && (H.tronc.integrated || opts.tronc) ? (troncShares(m)[e.id] || {}).share : 0
    if (tr) add("var", "1160", "Service et pourboires (tronc commun)", { base: (troncShares(m)[e.id].pres) + " j × " + e.pts + " pt", gain: tr, imp: true })
    if (e.transport) {
      const ni = Math.min(e.transport, P.transportCap)
      add("ind", "1200", "Indemnité de transport (non imposable)", { base: "plafond " + money(P.transportCap), gain: ni })
      if (e.transport > ni) add("ind", "1201", "Indemnité de transport (part imposable)", { gain: e.transport - ni, imp: true })
    }
    if (e.logement) add("ind", "1210", "Indemnité de logement", { gain: e.logement, imp: true })
    if (e.panier) add("ind", "1220", "Prime de panier (non imposable)", { base: "plafond d'exemple", gain: e.panier })
    if (e.aenLog) add("aen", "1300", "Avantage en nature — logement", { base: "évaluation forfaitaire", gain: e.aenLog, imp: true })
    if (e.aenNour) add("aen", "1310", "Avantage en nature — nourriture (repas du personnel)", { base: "forfait d'exemple", gain: e.aenNour, imp: true })
    const brut = sum(L, (l) => l.gain), brutImp = sum(L.filter((l) => l.imp), (l) => l.gain)
    const bR = Math.min(brutImp, P.capRet), bF = Math.min(brutImp, P.capPF)
    add("cot", "2000", "CNPS — retraite", { base: money(bR), rate: `${pc(P.retS)} / ${pc(P.retP)}`, ret: r0(bR * P.retS), pat: r0(bR * P.retP) })
    add("cot", "2010", "CNPS — prestations familiales", { base: money(bF), rate: pc(P.pf), pat: r0(bF * P.pf) })
    add("cot", "2020", "CNPS — accidents du travail", { base: money(bF), rate: pc(P.at), pat: r0(bF * P.at) })
    add("cot", "2030", "CMU — couverture maladie universelle", { base: "forfait", ret: P.cmuS, pat: P.cmuP })
    const itsB = bareme(brutImp), red = P.reduc[e.parts] || 0, its = Math.max(0, itsB - red)
    add("imp", "3000", "ITS — impôt sur les traitements et salaires", { base: money(brutImp), rate: `barème − ${money(red)} (${String(e.parts).replace(".", ",")} part(s))`, ret: its })
    add("tax", "3100", "Contribution employeur (part patronale)", { base: money(brutImp), rate: pc(P.ce), pat: r0(brutImp * P.ce) })
    add("tax", "3110", "Taxe d'apprentissage (FDFP)", { base: money(brutImp), rate: pc(P.ta), pat: r0(brutImp * P.ta) })
    add("tax", "3120", "Formation professionnelle continue (FDFP)", { base: money(brutImp), rate: pc(P.fpc), pat: r0(brutImp * P.fpc) })
    const salCot = sum(L.filter((l) => l.cat === "cot"), (l) => l.ret), patSoc = sum(L.filter((l) => l.cat === "cot"), (l) => l.pat), patTax = sum(L.filter((l) => l.cat === "tax"), (l) => l.pat)
    const aen = (e.aenLog || 0) + (e.aenNour || 0)
    if (aen) add("ret", "4000", "Reprise des avantages en nature (non versés)", { ret: aen })
    const netAvant = brut - salCot - its - aen
    const due = opts.noLoans ? 0 : loanDue(e.id), conso = v.conso || 0
    const quot = Math.max(0, Math.floor(netAvant * P.quotite))
    const loanApp = Math.min(due, quot), consoApp = Math.min(conso, quot - loanApp), reliquat = due + conso - loanApp - consoApp
    if (due) add("ret", "4010", "Remboursement prêts et avances", { base: "échéance " + money(due), ret: loanApp })
    if (conso) add("ret", "4020", "Consommations du personnel (POS)", { base: money(conso), ret: consoApp })
    const net = Math.max(0, netAvant - loanApp - consoApp), cost = brut + patSoc + patTax
    add("info", "9000", "Coût employeur", { base: money(cost) })
    add("info", "9010", "Congés payés acquis ce mois", { base: "2,2 j" })
    if (reliquat) add("info", "9020", "Reliquat de retenues reporté (quotité saisissable)", { base: money(reliquat) })
    return { id: e.id, lines: L, brut, brutImp, salCot, its, patSoc, patTax, loanApp, consoApp, net, cost, reliquat, version: P.version, aen }
  }
  const calcAll = (o) => Object.fromEntries(active().map((e) => [e.id, slip(e, cur().month, o)]))
  // Aperçu provisoire avant calcul : pourboires du mois inclus par anticipation
  const slips = () => (cur().calc ? cur().calc.slips : calcAll({ tronc: true }))
  const totals = (S) => { const a = Object.values(S); const t = {}; ["brut", "brutImp", "salCot", "its", "patSoc", "patTax", "aen", "loanApp", "consoApp", "net", "cost"].forEach((k) => (t[k] = sum(a, (s) => s[k]))); t.n = a.length; return t }
  // Net du mois précédent (référence de contrôle) : paie d'octobre sans heures ni primes, pourboires inclus
  // Historique d'exemple cohérent avec l'effectif actuel (paie avec pourboires, hors heures)
  ;(() => { const t = totals(Object.fromEntries(active().map((e) => [e.id, slip(e, cur().month, { vars: {}, tronc: true })])))
    H.history.forEach((h) => { if (h.f) { h.brut = Math.round((t.brut * h.f) / 1000) * 1000; h.cost = Math.round((t.cost * h.f) / 1000) * 1000; delete h.f } })
    H.budget = Math.round((t.cost * 1.02) / 100000) * 100000 })()
  H.emps.forEach((e) => { if (e.start < "2026-10-01") e.prevNet = slip(e, "2026-10", { vars: {}, tronc: true, noAbs: true }).net })

  // Toute modification qui impacte la paie invalide un calcul en cours (ou part en régularisation si clôturée)
  const touch = (why) => {
    const p = cur()
    if (p.closed) { H.regul.push({ date: today, why, to: monthLabel(nextMonth(p.month)) }); return "période clôturée : régularisation sur la période suivante (RG-HRM-03)" }
    if (p.step >= 3) { Object.assign(p, { step: 2, calc: null, validated: null, paid: null, journal: null, decl: {}, stale: why }); return "paie à recalculer" }
    return ""
  }
  const say = (msg, t) => toast(msg + (t ? " · " + t : ""))
  const audit = (what) => H.audit.unshift({ at: fd(today) + " " + now(), what })

  // ---------- Planning : règles légales (exemples paramétrés) ----------
  const cell = (id, i) => (onLeave(id, WEEK[i]) ? "C" : (H.plan[id] || "RRRRRRR")[i])
  const certFor = (e) => REQ[e.job] && H.certs.find((c) => c.emp === e.id && c.type === REQ[e.job])
  const violations = (e) => {
    const v = [], codes = WEEK.map((_, i) => cell(e.id, i)), hrs = sum(codes, (c) => (SH[c] || { h: 0 }).h)
    if (hrs > 48) v.push(`${hrs} h planifiées : 48 h max par semaine (règle d'exemple)`)
    if (!codes.some((c) => c === "R" || c === "C")) v.push("Aucun jour de repos dans la semaine")
    for (let i = 0; i < 6; i++) { const a = SH[codes[i]], b = SH[codes[i + 1]]; if (a && b && a.h && b.h && 24 + b.s - a.e < 11) v.push(`Repos de 11 h non respecté entre le ${fd(WEEK[i])} et le ${fd(WEEK[i + 1])}`) }
    const need = REQ[e.job], c = certFor(e)
    if (need && codes.some((x) => SH[x] && SH[x].h) && (!c || !certOk(c, WEEK[0]))) v.push(`${need} expirée : ne peut pas être planifié (RG-HRM-01)`)
    return v
  }
  const optimize = () => {
    const changes = [], plan = { ...H.plan }
    active().forEach((e) => {
      let c = (plan[e.id] || "RRRRRRR").split("")
      const before = c.join("")
      const need = REQ[e.job], ct = certFor(e)
      if (need && (!ct || !certOk(ct, WEEK[0]))) { c = c.map(() => "R"); changes.push(`${e.name} : retiré du planning (certification expirée) — à remplacer`) }
      c = c.map((x) => (x === "L" ? "J" : x))
      for (let i = 0; i < 6; i++) { const a = SH[c[i]], b = SH[c[i + 1]]; if (a && b && a.h && b.h && 24 + b.s - a.e < 11) c[i + 1] = c[i] }
      if (!c.some((x, i) => x === "R" || onLeave(e.id, WEEK[i]))) c[6] = "R"
      if (c.join("") !== before && !changes.some((x) => x.startsWith(e.name))) changes.push(`${e.name} : ${before} → ${c.join("")}`)
      plan[e.id] = c.join("")
    })
    return { plan, changes }
  }

  // ---------- Pointage ----------
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
  const clockIssues = (k) => {
    const e = E(k.emp), i = WEEK.indexOf(k.date), code = i >= 0 ? cell(k.emp, i) : "R", s = SH[code], out = []
    if (!s || !s.h) return { code, issues: ["Pointage sans poste planifié"] }
    const late = toMin(k.in) - s.s * 60
    if (late > 10) out.push(`Retard de ${late} min`)
    if (!k.out && k.date < today) out.push("Sortie non pointée")
    if (k.out) { let o = toMin(k.out); if (o < toMin(k.in)) o += 1440; const extra = o - s.e * 60; if (extra > 30) out.push(`Heures non planifiées : ${fh(extra / 60)}`) }
    if (k.geo) out.push(`Pointage mobile ${k.geo}`)
    return { code, issues: out, e }
  }

  // ---------- Contrôle de la paie : règles + IA ----------
  const anomalies = () => {
    const S = slips(), list = []
    const add = (key, emp, src, sev, text, fix) => list.push({ key, emp, src, sev, text, fix, state: H.anoState[key] })
    Object.values(S).forEach((s) => {
      const e = E(s.id)
      if (e.prevNet && Math.abs(s.net - e.prevNet) / e.prevNet > 0.2) add("var-" + e.id, e.id, "Règle", "À vérifier", `Net ${money(s.net)} contre ${money(e.prevNet)} en octobre (${s.net > e.prevNet ? "+" : ""}${pct(((s.net - e.prevNet) / e.prevNet) * 100)})`)
      if (!e.pay.ref) add("pay-" + e.id, e.id, "Règle", "Bloquant", "Coordonnées de paiement manquantes : aucun virement possible", "dossier")
      if (e.payPending) add("pend-" + e.id, e.id, "Règle", "Bloquant", "Changement de coordonnées de paiement non validé (alerte anti-fraude, RG-HRM-07)", "dossier")
      if (s.reliquat) add("quot-" + e.id, e.id, "Règle", "À vérifier", `Retenues plafonnées à la quotité saisissable : ${money(s.reliquat)} reporté (RG-HRM-06)`)
      if (e.noClock) add("ghost-" + e.id, e.id, "IA", "À vérifier", "Aucun pointage sur le mois alors qu'un salaire est versé (employé fantôme possible)")
    })
    const byRef = {}
    active().forEach((e) => e.pay.ref && (byRef[e.pay.ref] = [...(byRef[e.pay.ref] || []), e.id]))
    Object.entries(byRef).filter(([, ids]) => ids.length > 1).forEach(([ref, ids]) => add("shared-" + ids.join("-"), ids[0], "IA", "Bloquant", `Compte ${ref} partagé par ${ids.map((i) => E(i).name).join(" et ")}`))
    const ot = active().map((e) => { const v = H.vars[e.id] || {}; return [e.id, (v.h15 || 0) + (v.h50 || 0) + (v.h75 || 0)] }).filter(([, h]) => h > 0)
    const avg = sum(ot, (x) => x[1]) / (ot.length || 1)
    ot.filter(([, h]) => h > 2 * avg && h > 20).forEach(([id, h]) => add("ot-" + id, id, "IA", "À vérifier", `${fh(h)} d'heures supplémentaires contre ${fh(avg)} en moyenne : atypique`))
    return list
  }
  const openAno = () => anomalies().filter((a) => !a.state)

  // ---------- Écrans ----------
  const views = {
    // ===== Personnel =====
    "hr-personnel"(p) {
      const tab = p[0] || "dossiers"
      const head = pageHead("Personnel", "Dossiers, contrats, organisation, certifications, entrées et sorties. Données fictives ; salaires et coordonnées de paiement à accès restreint (EF-HRM-029).",
        btn("Nouvelle embauche", "go('hr-personnel/mouvements')"))
      const tabs = subtabs("hr-personnel", [["dossiers", "Dossiers"], ["organigramme", "Organigramme"], ["certifications", "Certifications et formation"], ["mouvements", "Entrées et sorties"]], tab)
      const body = { dossiers: dossiers, organigramme: orga, certifications: certifs, mouvements: mouvements }[tab] || dossiers
      return head + tabs + body(p[1])
    },
    "hr-temps"(p) {
      const tab = p[0] || "planning"
      return pageHead("Plannings et temps", "Plannings par service, pointage, heures majorées, congés et absences. Pointeuses et badges simulés.")
        + subtabs("hr-temps", [["planning", "Planning de la semaine"], ["pointage", "Pointage"], ["conges", "Congés et absences"], ["besoins", "Besoins en effectifs (IA)"]], tab)
        + ({ planning, pointage, conges, besoins }[tab] || planning)()
    },
    "hr-paie"(p) {
      const tab = p[0] || "cycle", per = cur()
      return pageHead(`Paie — ${monthLabel(per.month)}`, `Cycle mensuel de paie de l'entité Hôtel Exemple (FCFA). Moteur et paramètres : ${PACK.version}, taux d'exemple à faire valider.`,
        badge(per.closed ? "Clôturée" : `Étape ${Math.min(per.step + 1, 9)} / 9`, per.closed ? "dark" : "on"))
        + subtabs("hr-paie", [["cycle", "Cycle"], ["variables", "Variables"], ["controle", "Contrôle"], ["bulletins", "Bulletins et livre de paie"], ["virements", "Virements"], ["pourboires", "Pourboires"], ["prets", "Prêts et avances"], ["entites", "Multi-entités"], ["parametres", "Paramètres et rubriques"]], tab)
        + ({ cycle, variables, controle, bulletins, virements, pourboires, prets, entites, parametres }[tab] || cycle)()
    },
    "hr-bulletin"(p) { return bulletin(p[0]) },
    "hr-portail"() { return portail() },
    "hr-declarations"(p) {
      const tab = p[0] || "periodiques"
      return pageHead("Déclarations sociales et fiscales", `Période ${monthLabel(cur().month)}. Fichiers et télédéclarations SIMULÉS (aucun envoi réel à la CNPS ni à l'administration fiscale).`)
        + subtabs("hr-declarations", [["periodiques", "CNPS, ITS, FDFP"], ["disa", "DISA (annuelle)"], ["ecritures", "Écritures comptables"]], tab)
        + ({ periodiques, disa, ecritures }[tab] || periodiques)()
    },
    "hr-pilotage"(p) {
      const tab = p[0] || "kpi"
      return pageHead("Pilotage RH", "Indicateurs du module (§5.12), projection de masse salariale et simulation de coût. Valeurs d'exemple.")
        + subtabs("hr-pilotage", [["kpi", "Indicateurs"], ["simulation", "Simulation de coût"]], tab)
        + (tab === "simulation" ? simulation() : kpis())
    },
  }

  // ----- Personnel : dossiers -----
  function dossiers(id) {
    const e = E(id) || H.emps[0]
    const items = H.emps.map((x) => ({ id: x.id, title: x.name, sub: `${x.job} · ${DEPTS[x.dept]}`, badge: x.status !== "actif" ? " " + badge(x.status === "sorti" ? "Sorti" : "Muté", "dark") : x.contract !== "CDI" ? " " + badge(x.contract, "outline") : "" }))
    const shown = ui.hrShow === e.id, c = H.certs.filter((x) => x.emp === e.id)
    const s = e.status === "actif" ? slip(e) : null
    const minCat = CATS[e.cat]
    return split(listItems(items, e.id, "hr-personnel/dossiers"), `<div class="card">
      <div class="row between"><span class="big">${esc(e.name)}</span><span class="row">${badge(e.contract, "outline")}${badge(e.status === "actif" ? "Actif" : e.status === "sorti" ? "Sorti" : "Muté (autre entité)", e.status === "actif" ? "on" : "dark")}</span></div>
      <div class="muted">${esc(e.mat)} · ${esc(e.job)}${e.alias ? ` (${esc(e.alias)})` : ""} · ${esc(DEPTS[e.dept])} · ${esc(e.prop)} <span class="muted">· EF-HRM-001</span></div>
      <div class="grid" style="margin:14px 0">${kpi("Ancienneté", years(e.start, today) + " an(s)", "entrée le " + fd(e.start) + "/" + e.start.slice(0, 4))}${kpi("Solde congés payés", fj(cpSolde(e)), "2,2 j acquis par mois")}${kpi("Coût employeur mensuel", shown && s ? money(s.cost) : "••••", shown ? "exemple" : "masqué")}</div>
      <h3>Identité et situation <span class="muted" style="font-weight:400">EF-HRM-001</span></h3>
      ${kv([["Pièce d'identité", esc(e.idDoc)], ["Adresse", esc(e.addr)], ["Situation familiale (paie)", esc(e.family) + ` · ${String(e.parts).replace(".", ",")} part(s) ITS`], ["Coordonnées", `${esc(e.email)} · ${esc(e.phone)}`], ["Manager", e.manager ? elink(e.manager) : "—"],
        ["Entité employeuse", `${esc(ENT(e.entity).name)} · ${esc(ENT(e.entity).country)} · devise ${esc(ENT(e.entity).cur)}`], ["Établissement", esc(e.prop)], ["Date d'entrée · ancienneté", `${fd(e.start)}/${e.start.slice(0, 4)} · ${years(e.start, today)} an(s)`],
        ["Profil d'accès physique", esc(profileOf(e)) + " " + badge(e.access === "actif" ? "ACC simulé" : e.access, e.access === "actif" ? "outline" : "dark") + ` <span class="muted">EF-HRM-010</span>`]])}
      ${e.status === "actif" ? `<details style="margin-top:8px"><summary class="muted">Modifier l'identité et la situation</summary><div class="form" style="margin-top:8px">
        ${field("hr-iaddr", "Adresse", input("hr-iaddr", e.addr))}${field("hr-iphone", "Téléphone", input("hr-iphone", e.phone))}${field("hr-imail", "E-mail", input("hr-imail", e.email))}
        ${field("hr-ifam", "Situation familiale", input("hr-ifam", e.family))}${field("hr-iparts", "Parts ITS", select("hr-iparts", Object.keys(PACK.reduc), String(e.parts)))}
        ${field("hr-imgr", "Manager", select("hr-imgr", [["", "—"], ...active().filter((x) => x.id !== e.id).map((x) => [x.id, x.name])], e.manager || ""))}
        <div class="full" id="hr-ierr"></div><div class="full">${btn("Enregistrer", `A.hrm.editId(${q(e.id)})`, "ghost")}</div></div></details>` : ""}
      <h3>Contrat et rémunération <span class="muted" style="font-weight:400">EF-HRM-002</span></h3>
      ${kv([["Contrat", `${esc(e.contract)} depuis le ${fd(e.start)}/${e.start.slice(0, 4)}${e.end ? ` jusqu'au ${fd(e.end)}/${e.end.slice(0, 4)}` : ""}`], ["Catégorie (convention collective, exemple)", `${esc(e.cat)} · minimum ${money(minFor(e.cat, e.hours))}${e.hours < 40 ? " (prorata temps partiel)" : ""}`], ["Temps de travail", `${e.hours} h / semaine · ${fh(monthH(e))} / mois${e.hours < 40 ? " · temps partiel" : ""}`],
        ["Salaire de base", shown ? money(e.base) : `•••• ${btn("Afficher (accès journalisé)", `A.hrm.showSal(${q(e.id)})`, "ghost sm")}`], ["Éléments de rémunération", shown ? `sursalaire ${money(e.sursal)} · transport ${money(e.transport)} · logement ${money(e.logement)} · panier ${money(e.panier)}${e.aenLog ? ` · logement en nature ${money(e.aenLog)}` : ""}${e.aenNour ? ` · nourriture en nature ${money(e.aenNour)}` : ""}` : "••••"]])}
      ${e.status === "actif" && shown ? `<details style="margin-top:8px"><summary class="muted">Modifier les éléments de rémunération (EF-HRM-014)</summary><div class="form" style="margin-top:8px">
        ${[["sursal", "Sursalaire"], ["transport", "Indemnité de transport"], ["logement", "Indemnité de logement"], ["panier", "Prime de panier"], ["aenLog", "Avantage en nature logement"], ["aenNour", "Avantage en nature nourriture"]].map(([k, l]) => field("hr-r" + k, l, input("hr-r" + k, e[k] || 0, 'type="number" step="1000" min="0"'))).join("")}
        ${field("hr-rby", "Saisi par", userSel("hr-rby", "PAIE"))}<div class="full">${btn("Enregistrer", `A.hrm.editPay(${q(e.id)})`, "ghost")}</div></div></details>` : ""}
      <h3>Coordonnées de paiement</h3>
      <p class="muted" style="margin:0 0 8px">Chiffrées au niveau du champ ; tout changement est soumis à validation (RG-HRM-07).</p>
      ${kv([["Mode", esc(e.pay.mode)], ["Compte", e.pay.ref ? esc(e.pay.ref) : badge("À compléter", "dark")]])}
      ${e.payPending ? `<div class="err" style="margin-top:10px">Changement demandé le ${fd(e.payPending.on)} (${esc(e.payPending.src)}) : ${esc(e.payPending.ref)}. Alerte anti-fraude : vérifier l'identité par un autre canal.
        <div class="row" style="margin-top:8px">${btn("Valider le changement (RH)", `A.hrm.payValidate(${q(e.id)}, true)`, "sm")}${btn("Refuser", `A.hrm.payValidate(${q(e.id)}, false)`, "ghost sm")}</div></div>` : ""}
      ${e.status === "actif" ? `<div class="form" style="margin-top:10px">${field("hr-pmode", "Nouveau mode", select("hr-pmode", ["Virement", "Mobile Money"], e.pay.mode))}${field("hr-pref", "Nouveau compte", input("hr-pref", "", 'placeholder="Ex. Banque Lagune Exemple ••••0000"'))}
        <div style="align-self:end">${btn("Demander le changement", `A.hrm.payRequest(${q(e.id)})`, "ghost")}</div></div>` : ""}
      ${e.status === "actif" ? `<h3>Avenant, promotion ou mutation <span class="muted" style="font-weight:400">EF-HRM-003</span></h3>
      <div class="form">${field("hr-atype", "Type", select("hr-atype", ["Augmentation", "Promotion", "Mutation", "Passage en CDI"], "Augmentation"))}${field("hr-adate", "Date d'effet", input("hr-adate", "2026-11-01", 'type="date"'))}
        ${field("hr-abase", "Nouveau salaire de base", input("hr-abase", e.base, 'type="number" step="1000"'))}${field("hr-acat", "Catégorie", select("hr-acat", Object.keys(CATS), e.cat))}
        ${field("hr-aprop", "Établissement (mutation)", select("hr-aprop", H.entities.flatMap((x) => x.props.map((pp) => [x.id + "|" + pp, `${pp} — ${x.name}`])), e.entity + "|" + e.prop))}${field("hr-aby", "Saisi par", userSel("hr-aby", "PAIE"))}
        <div class="full" id="hr-aerr"></div><div class="full">${btn("Enregistrer l'avenant", `A.hrm.amend(${q(e.id)})`)}</div></div>` : ""}
      <h3>Historique du contrat</h3>
      ${tbl(["Date", "Type", "Détail", "Saisi par"], e.history.map((h) => [fd(h.date) + "/" + h.date.slice(2, 4), esc(h.type), esc(h.detail), esc(USERS[h.by] || h.by)]), "Aucun avenant.")}
      <h3>Certifications</h3>
      ${tbl(["Certification", "Expire le", "État"], c.map((x) => [esc(x.type), fd(x.expires) + "/" + x.expires.slice(0, 4), certBadge(x)]), "Aucune certification enregistrée.")}
      ${H.audit.length ? `<h3>Journal d'accès aux données salariales</h3>${tbl(["Quand", "Action"], H.audit.slice(0, 5).map((a) => [esc(a.at), esc(a.what)]))}` : ""}
    </div>`)
  }
  const certBadge = (c) => (!certOk(c) ? badge("Expirée", "dark") : soon(c) ? badge("Expire bientôt", "outline") : badge("Valide", "on"))

  function orga() {
    const dir = E("E01")
    const depts = Object.keys(DEPTS).filter((d) => d !== "DIR")
    return `<p class="muted">Organigramme simplifié de l'établissement (effectif actif ${active().length}).</p>
      <div class="card" style="text-align:center;max-width:360px;margin:0 auto 14px"><strong>${esc(dir.name)}</strong><div class="muted">${esc(dir.job)}</div></div>
      <div class="grid">${depts.map((d) => {
        const ms = active().filter((e) => e.dept === d), mgr = ms.find((e) => !ms.some((x) => x.id === e.manager)) || ms[0]
        return `<div class="card"><div class="muted">${esc(DEPTS[d])}</div><div style="margin:4px 0 8px">${mgr ? `<strong>${elink(mgr.id)}</strong><div class="muted">${esc(mgr.job)}</div>` : ""}</div>
          ${ms.filter((e) => e !== mgr).map((e) => `<div>└ ${elink(e.id)} <span class="muted">${esc(e.alias || e.job)}</span></div>`).join("")}
          <div class="muted" style="margin-top:8px">${ms.length} personne(s)</div></div>`
      }).join("")}</div>
      <h2>Postes et profils d'accès physique <span class="muted" style="font-size:14px;font-weight:400">EF-HRM-010</span></h2>
      <p class="muted">Chaque poste porte un profil d'accès par défaut, attribué à l'embauche et révoqué au départ. Modifier un profil le réapplique aux titulaires (ACC simulé).</p>
      ${tbl(["Poste", "Service", "Titulaires", "Certification requise", "Profil d'accès par défaut", ""], jobsList().map((j, i) => [esc(j.job), esc(DEPTS[j.dept]), j.n, j.cert ? esc(j.cert) : muted("—"),
        select("hr-jp" + i, PROFILES, j.profile), btn("Appliquer", `A.hrm.setProfile(${i})`, "ghost sm")]))}`
  }
  const PROFILES = [...new Set([...Object.values(ACCESS), "Aucun accès physique"])]
  const jobsList = () => { const m = {}; active().forEach((e) => { m[e.job] = m[e.job] || { job: e.job, dept: e.dept, n: 0, cert: REQ[e.job], profile: profileOf(e) }; m[e.job].n++ }); return Object.values(m).sort((a, b) => a.dept.localeCompare(b.dept) || a.job.localeCompare(b.job)) }

  function certifs() {
    const withReq = active().filter((e) => REQ[e.job])
    const okReq = withReq.filter((e) => { const c = certFor(e); return c && certOk(c) })
    const exp = H.certs.filter((c) => !certOk(c)), sn = H.certs.filter(soon)
    return `${cards([kpi("Conformité des certifications", pct((okReq.length / (withReq.length || 1)) * 100), `${okReq.length}/${withReq.length} postes à certification obligatoire`), kpi("Expirées", exp.length, "bloquent la planification"), kpi("Expirent sous 60 jours", sn.length, "événement hrm.certification.expiring")])}
      <h2>Certifications <span class="muted" style="font-size:14px;font-weight:400">EF-HRM-004</span></h2>
      ${tbl(["Employé", "Certification", "Expire le", "État", ""], H.certs.slice().sort((a, b) => a.expires.localeCompare(b.expires)).map((c) => [elink(c.emp), esc(c.type), fd(c.expires) + "/" + c.expires.slice(0, 4), certBadge(c),
        !certOk(c) || soon(c) ? btn("Enregistrer le renouvellement", `A.hrm.renew(${q(c.id)})`, "ghost sm") : ""]))}
      <h2>Sessions de formation <span class="muted" style="font-size:14px;font-weight:400">EF-HRM-027</span></h2>
      ${tbl(["Session", "Date", "#Places", "Inscrits", ""], H.trainings.map((t) => [esc(t.title) + `<div class="muted">Cabinet Akwaba Exemple (formation)</div>`, fd(t.date), `${t.inscrits.length}/${t.places}`, t.inscrits.map((i) => ename(i)).join(", ") || muted("—"),
        btn("Inscrire les employés à renouveler", `A.hrm.enroll(${q(t.id)})`, "ghost sm")]))}`
  }

  function mouvements() {
    const st = ui.hrStc
    return `<div class="cols"><section><h2>Nouvelle embauche</h2><div class="card"><div class="form">
        ${field("hr-nname", "Nom", input("hr-nname", "Awa Koné"))}${field("hr-njob", "Poste", input("hr-njob", "Femme de chambre"))}
        ${field("hr-ndept", "Service", select("hr-ndept", Object.entries(DEPTS), "HK"))}${field("hr-nctr", "Contrat", select("hr-nctr", ["CDI", "CDD", "Saisonnier", "Journalier", "Intérim", "Stage"], "CDD"))}
        ${field("hr-ncat", "Catégorie", select("hr-ncat", Object.keys(CATS), "E1"))}${field("hr-nbase", "Salaire de base", input("hr-nbase", "90000", 'type="number" step="1000"'))}
        ${field("hr-nstart", "Date d'entrée", input("hr-nstart", addDays(today, 5), 'type="date"'))}${field("hr-nend", "Fin de contrat (hors CDI)", input("hr-nend", addDays(today, 95), 'type="date"'))}
        ${field("hr-nhours", "Temps de travail", select("hr-nhours", [["40", "Temps plein 40 h"], ["30", "Temps partiel 30 h"], ["20", "Temps partiel 20 h"]], "40"))}
        <div class="full" id="hr-nerr"></div><div class="full">${btn("Créer le dossier et activer le badge", "A.hrm.hire()")}</div></div>
        <p class="muted" style="margin:10px 0 0">Contrats CDI, CDD, saisonnier, journalier, intérim, stage (EF-HRM-002) ; contrôle du minimum catégoriel au prorata du temps de travail (RG-HRM-05, minimum légal d'exemple ${money(PACK.smig)}). Profil d'accès par défaut du poste attribué (EF-HRM-010). Événement hrm.employee.hired → ACC et comptes (simulé).</p></div></section>
      <section><h2>Départ et solde de tout compte</h2><div class="card"><div class="form">
        ${field("hr-semp", "Employé", select("hr-semp", active().map((e) => [e.id, `${e.name} — ${e.job}`]), st ? st.emp : "E14"))}
        ${field("hr-smot", "Motif", select("hr-smot", ["Fin de CDD", "Démission", "Licenciement", "Rupture d'un commun accord"], st ? st.motif : "Fin de CDD"))}
        ${field("hr-sdate", "Date de sortie", input("hr-sdate", st ? st.date : "2026-11-30", 'type="date"'))}
        <div style="align-self:end">${btn("Calculer le solde", "A.hrm.stc()", "ghost")}</div></div>
        ${st ? stcPanel(st) : `<p class="muted" style="margin:10px 0 0">Indemnités de préavis, de licenciement ou de fin de contrat, compensatrice de congés (EF-HRM-018). Formules d'exemple.</p>`}</div></section></div>
      <h2>Mouvements récents</h2>
      ${tbl(["Date", "Employé", "Mouvement", "Détail"], H.moves.map((m) => [fd(m.date) + "/" + m.date.slice(2, 4), esc(m.name), badge(m.type, m.type === "Sortie" ? "dark" : m.type === "Entrée" ? "on" : "outline"), esc(m.detail)]))}`
  }
  const stcCalc = (st) => {
    const e = E(st.emp), y = years(e.start, st.date), monthly = e.base + (y >= 2 ? r0((e.base * Math.min(25, y)) / 100) : 0)
    const worked = Math.min(30, Number(st.date.slice(8, 10)))
    const L = [["Salaire du mois au prorata", r0((monthly * worked) / 30), `${worked} j / 30`], ["Indemnité compensatrice de congés", r0((cpSolde(e) * monthly) / 26), `${fj(cpSolde(e))} × salaire / 26`]]
    if (st.motif === "Fin de CDD" && e.contract !== "CDI") L.push(["Indemnité de fin de contrat", r0(monthly * Math.max(1, nights(e.start, st.date) / 30) * 0.03), "3 % des salaires du contrat (exemple)"])
    if (st.motif === "Licenciement") {
      L.push(["Indemnité de préavis (non exécuté)", y < 6 ? monthly : 2 * monthly, y < 6 ? "1 mois (exemple)" : "2 mois (exemple)"])
      L.push(["Indemnité de licenciement", r0(monthly * Math.max(1, y) * (y <= 5 ? 0.3 : 0.35)), `${Math.max(1, y)} an(s) × ${y <= 5 ? "30" : "35"} % (exemple)`])
    }
    const loans = sum(H.loans.filter((l) => l.emp === e.id), (l) => l.remaining)
    if (loans) L.push(["Retenue : solde des prêts et avances", -loans, "remboursement anticipé"])
    return { e, L, total: sum(L, (x) => x[1]) }
  }
  function stcPanel(st) {
    const { e, L, total } = stcCalc(st)
    if (st.done) return `<div style="margin-top:12px">${badge("Départ enregistré", "dark")} <strong>${esc(e.name)}</strong>
      <p>Accès physiques et comptes révoqués en 4 s (événement hrm.employee.terminated → ACC, PLT · simulé) <span class="muted">EF-HRM-010</span> : ${(st.revoked || []).map(esc).join(" · ")}. Solde de tout compte : <strong>${money(total)}</strong>.</p>
      <div class="card"><strong>Certificat de travail (aperçu)</strong><p class="muted" style="margin:6px 0 0">Hôtel Exemple certifie que ${esc(e.name)} a été employé(e) en qualité de ${esc(e.job)} du ${fd(e.start)}/${e.start.slice(0, 4)} au ${fd(st.date)}/${st.date.slice(0, 4)}. Document d'exemple, avec reçu pour solde de tout compte.</p></div></div>`
    return `<div style="margin-top:12px">${tbl(["Élément", "Calcul", "#Montant"], L.map(([l, m, c]) => [esc(l), muted(c), money(m)]), "", `<tfoot><tr><td>Solde de tout compte</td><td></td><td class="num">${money(total)}</td></tr></tfoot>`)}
      <div class="row" style="margin-top:10px">${btn("Confirmer le départ et révoquer les accès", "A.hrm.terminate()", "accent")}</div></div>`
  }

  // ----- Temps : planning -----
  function planning() {
    const list = active().filter((e) => ui.hrDept === "all" || e.dept === ui.hrDept)
    const opt = optimize(), viol = active().filter((e) => violations(e).length)
    const counts = Object.fromEntries(Object.keys(DEPTS).map((d) => [d, active().filter((e) => e.dept === d).length]))
    return `<p class="muted">Semaine du ${fd(WEEK[0])} au ${fd(WEEK[6])}. Cliquer sur une case change le poste (${ORDER.map((c) => `${c} = ${SH[c].l}`).join(" · ")} · C = congé validé). EF-HRM-005, RG-HRM-01.</p>
      ${chips("hrDept", { all: "Tous", ...DEPTS }, { all: active().length, ...counts })}
      <div class="tablewrap"><table><thead><tr><th>Employé</th>${WEEK.map((d) => `<th class="num">${esc(wd(d))}<br>${fd(d)}</th>`).join("")}<th class="num">Heures</th><th>Règles</th></tr></thead><tbody>
      ${list.map((e) => { const v = violations(e), hrs = sum(WEEK.map((_, i) => cell(e.id, i)), (c) => (SH[c] || { h: 0 }).h)
        return `<tr><td>${elink(e.id)}<div class="muted">${esc(e.alias || e.job)}</div></td>${WEEK.map((d, i) => { const c = cell(e.id, i)
          return `<td class="num">${c === "C" ? badge("C", "outline") : `<button class="btn ${c === "R" ? "ghost " : ""}sm" title="${esc(SH[c].l)}" onclick="A.hrm.cycle(${q(e.id)}, ${i})">${c}</button>`}</td>` }).join("")}
          <td class="num ${hrs > 48 ? "cell0" : ""}">${hrs} h</td><td>${v.length ? badge(v.length + " écart(s)", "dark") + `<div class="muted">${v.map(esc).join("<br>")}</div>` : badge("OK", "on")}</td></tr>` }).join("")}
      <tr><td class="muted">Présents planifiés</td>${WEEK.map((_, i) => `<td class="num muted">${list.filter((e) => (SH[cell(e.id, i)] || { h: 0 }).h).length}</td>`).join("")}<td></td><td></td></tr>
      </tbody></table></div>
      <div class="row" style="margin:12px 0">${btn(H.planPublished ? "Planning publié" : "Publier le planning", "A.hrm.publish()", H.planPublished ? "ghost" : "")}<span class="muted">${viol.length ? `${viol.length} employé(s) en écart : publication bloquée.` : "Aucun écart : publication possible (hrm.schedule.published → ACC, app mobile)."}</span></div>
      ${aiBox("Planning optimisé", opt.changes.length ? `Proposition sous contraintes légales, certifications et coût : ${opt.changes.length} modification(s). ${opt.changes.slice(0, 4).join(" ; ")}${opt.changes.length > 4 ? "…" : ""}. Le chef de service reste libre de modifier.` : "Le planning respecte les règles ; aucune modification proposée.", opt.changes.length ? btn("Appliquer la proposition", "A.hrm.optimize()", "sm") : "")}`
  }

  function pointage() {
    const rows = H.clocks.slice().sort((a, b) => b.date.localeCompare(a.date) || a.in.localeCompare(b.in))
    const issues = rows.map((k) => ({ k, ...clockIssues(k) }))
    const todo = issues.filter((x) => !x.k.ok)
    const plannedToday = active().filter((e) => (SH[cell(e.id, 3)] || { h: 0 }).h && !H.clocks.some((k) => k.emp === e.id && k.date === today))
    const ot = active().filter((e) => { const v = H.vars[e.id] || {}; return v.h15 || v.h50 || v.h75 })
    return `${cards([kpi("Pointages à valider", todo.length, "par les chefs de service"), kpi("Anomalies", issues.filter((x) => x.issues.length && !x.k.ok).length, "écarts avec le planning"), kpi("Attendus non pointés aujourd'hui", plannedToday.length, "poste planifié, aucun badge")])}
      <h2>Pointages du ${fd(addDays(today, -1))} et du ${fd(today)} <span class="muted" style="font-size:14px;font-weight:400">EF-HRM-006</span></h2>
      ${tbl(["Date", "Employé", "Poste planifié", "Entrée", "Sortie", "Source", "Anomalies", ""], issues.map(({ k, code, issues: is }) => [fd(k.date), elink(k.emp), SH[code] ? esc(SH[code].l) : "Congé", esc(k.in), k.out ? esc(k.out) : k.date === today ? muted("en poste") : "—", esc(k.src) + (k.src !== "Badge" ? " " + badge("simulé", "outline") : ""),
        is.length ? is.map((x) => badge(x, "dark")).join(" ") : badge("Conforme", "on"),
        k.ok ? badge("Validé", "outline") : `<span class="row" style="flex-wrap:nowrap">${!k.out && k.date < today ? btn("Corriger la sortie", `A.hrm.fixOut(${q(k.id)})`, "ghost sm") : ""}${!k.out && k.date === today ? btn("Pointer la sortie", `A.hrm.clockOut(${q(k.id)})`, "ghost sm") : ""}${btn("Valider", `A.hrm.clockOk(${q(k.id)})`, "sm")}</span>`]))}
      <div class="row" style="margin:12px 0">${plannedToday.length ? `<label for="hr-cemp" style="margin:0">Simuler un badge</label>${select("hr-cemp", plannedToday.map((e) => [e.id, `${e.name} (${SH[cell(e.id, 3)].l})`]), plannedToday[0].id)}${btn("Pointer l'entrée", "A.hrm.clockIn()", "ghost")}` : muted("Tous les employés planifiés aujourd'hui ont pointé.")}</div>
      <p class="muted">Le début de poste publie hrm.shift.started : le badge du salarié s'active sur la plage du poste ± 30 min ; la fin de poste publie hrm.shift.ended et le suspend, sauf profil permanent (RG-HRM-02, ACC simulé).</p>
      <h2>Événements publiés vers le contrôle d'accès <span class="muted" style="font-size:14px;font-weight:400">EF-HRM-009</span></h2>
      ${tbl(["Quand", "Événement", "Employé", "Effet côté ACC (simulé)"], H.events.slice(0, 10).map((x) => [esc(x.at), badge(x.type, x.type === "hrm.employee.terminated" ? "dark" : "outline"), ename(x.emp), esc(x.detail)]), "Aucun événement.")}
      <p class="muted">Les badges correspondants apparaissent dans Clés et identifiants › Passes et personnel.</p>
      <h2>Heures majorées du mois <span class="muted" style="font-size:14px;font-weight:400">EF-HRM-007</span></h2>
      ${tbl(["Employé", "#+15 %", "#+50 % / nuit", "#Dim. / férié +75 %", "#Montant estimé"], ot.map((e) => { const v = H.vars[e.id], th = e.base / 173.33
        return [elink(e.id), fh(v.h15 || 0), fh(v.h50 || 0), fh(v.h75 || 0), money(r0(th * (1.15 * (v.h15 || 0) + 1.5 * (v.h50 || 0) + 1.75 * (v.h75 || 0))))] }))}
      <p class="muted">Majorations d'exemple, paramétrables par pays.</p>`
  }

  function conges() {
    const filt = { attente: ["Demandée", "Validée chef"], toutes: ["Demandée", "Validée chef", "Validée", "Refusée"] }
    const list = H.leaves.filter((l) => filt[ui.hrLeave].includes(l.status)).sort((a, b) => a.from.localeCompare(b.from))
    const prov = sum(active(), (e) => Math.max(0, cpSolde(e)) * (e.base / 26))
    const theo = active().length * 26, absent = sum(active(), (e) => leaveDaysMonth(e.id, "2026-11", "Maladie") + leaveDaysMonth(e.id, "2026-11", "Absence injustifiée"))
    const next = (l) => l.status === "Demandée" ? "chef de service" : "RH"
    return `${cards([kpi("Demandes en attente", H.leaves.filter((l) => filt.attente.includes(l.status)).length, "circuit : chef de service puis RH"), kpi("Absentéisme du mois", pct((absent / theo) * 100), "maladie + absences injustifiées (exemple)"), kpi("Provision pour congés", money(prov), "soldes × salaire journalier (EF-HRM-017)")])}
      <h2>Demandes</h2>
      ${chips("hrLeave", { attente: "En attente", toutes: "Toutes" })}
      ${tbl(["Réf.", "Employé", "Type", "Du", "Au", "#Jours", "Statut", ""], list.map((l) => [esc(l.id), elink(l.emp), esc(l.type), fd(l.from), fd(l.to), workDays(l.from, l.to), badge(l.status, l.status === "Validée" ? "on" : l.status === "Refusée" ? "dark" : "outline") + (l.note ? `<div class="muted">${esc(l.note)}</div>` : ""),
        ["Demandée", "Validée chef"].includes(l.status) ? `<span class="row" style="flex-wrap:nowrap">${btn("Valider (" + next(l) + ")", `A.hrm.leave(${q(l.id)}, true)`, "sm")}${btn("Refuser", `A.hrm.leave(${q(l.id)}, false)`, "ghost sm")}</span>` : ""]), "Aucune demande.")}
      <h2>Nouvelle demande</h2>
      <div class="card"><div class="form">${field("hr-lemp", "Employé", select("hr-lemp", active().map((e) => [e.id, e.name]), "E06"))}${field("hr-ltype", "Type", select("hr-ltype", ["Congés payés", "Maladie", "Maternité", "Permission (événement familial)", "Absence injustifiée"], "Congés payés"))}
        ${field("hr-lfrom", "Du", input("hr-lfrom", addDays(today, 10), 'type="date"'))}${field("hr-lto", "Au", input("hr-lto", addDays(today, 12), 'type="date"'))}
        <div class="full" id="hr-lerr"></div><div class="full">${btn("Enregistrer la demande", "A.hrm.leaveNew()")}</div></div></div>
      <h2>Soldes de congés payés</h2>
      ${tbl(["Employé", "#Acquis", "#Pris", "#Solde"], active().map((e) => [elink(e.id), fj(e.cpAcq), fj(e.cpAcq - cpSolde(e)), fj(cpSolde(e))]))}
      <p class="muted">Acquisition mensuelle de 2,2 jours ouvrables (EF-HRM-008). Un congé payé validé apparaît dans le planning (C).</p>`
  }

  function besoins() {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))
    const rows = days.map((d) => {
      const occ = D.reservations.filter((r) => ["confirmee", "arrivee"].includes(r.status) && r.from <= d && d < r.to).length
      const arr = D.reservations.filter((r) => r.from === d && !["annulee", "noshow", "deloge"].includes(r.status)).length, dep = D.reservations.filter((r) => r.to === d && !["annulee", "noshow", "deloge"].includes(r.status)).length
      const ia = ui.hrForecast === "ia"
      const hk = ia ? Math.max(1, Math.ceil((occ * 0.45 + dep * 0.5 + arr * 0.2) / 7)) : Math.max(1, Math.ceil(occ / 12))
      const fo = ia ? 2 + (arr + dep > 6 ? 1 : 0) : 3
      const fnb = ia ? 2 + Math.ceil((occ * 1.4) / 25) : 3
      const i = WEEK.indexOf(d), planned = (dept) => (i >= 0 ? active().filter((e) => e.dept === dept && (SH[cell(e.id, i)] || { h: 0 }).h).length : null)
      return { d, occ, arr, dep, hk, fo, fnb, phk: planned("HK"), pfo: planned("HEB"), pfnb: planned("FNB") }
    })
    const cmp = (need, pl) => (pl == null ? String(need) : `${need} ${pl < need ? badge(`${pl} planifié(s)`, "dark") : muted(`/ ${pl}`)}`)
    return `${aiBox("Prévision des besoins en effectifs", ui.hrForecast === "ia" ? "Heures nécessaires par service calculées à partir de l'occupation prévue, des arrivées et des départs (données du module réservations). Le chef de service décide du planning final." : "Mode de repli : ratios standards (1 femme de chambre pour 12 chambres occupées, effectifs fixes en réception et restauration).",
        btn(ui.hrForecast === "ia" ? "Basculer sur les ratios standards (repli)" : "Revenir à la prévision IA", "A.hrm.forecastMode()", "ghost sm"))}
      ${tbl(["Jour", "#Chambres occupées", "#Arrivées", "#Départs", "Étages (pers.)", "Réception (pers.)", "Restauration (pers.)"], rows.map((x) => [`${esc(wd(x.d))} ${fd(x.d)}`, x.occ, x.arr, x.dep, cmp(x.hk, x.phk), cmp(x.fo, x.pfo), cmp(x.fnb, x.pfnb)]))}
      <p class="muted">Besoin / planifié sur la semaine en cours. Source : événement aip.forecast.workforce-demand (simulé).</p>`
  }

  // ----- Paie -----
  const STEPS = [
    ["Ouverture", "Période créée ; éléments permanents et échéances de prêts repris.", "Système"],
    ["Collecte des variables", "Pointage, heures majorées, absences, congés, primes, pourboires, consommations du personnel.", "Système + chefs de service"],
    ["Calcul", "Application des rubriques et barèmes du pack en vigueur.", "Gestionnaire de paie"],
    ["Contrôle", "Écran d'anomalies (règles et IA), comparaison avec le mois précédent.", "Gestionnaire de paie"],
    ["Validation", "Double validation par deux personnes distinctes (RG-HRM-04).", "DRH + DAF"],
    ["Paiement", "Virements et mobile money, double validation.", "Trésorerie"],
    ["Comptabilisation", "Écritures générées dans le journal de paie (FIN, simulé).", "Système"],
    ["Déclarations", "CNPS, ITS, FDFP ; DISA en fin d'année.", "Gestionnaire de paie"],
    ["Clôture", "Verrouillage, publication des bulletins dans l'app, archivage.", "Système"],
  ]
  function stepAction(i) {
    const p = cur()
    if (i === 1) return btn("Collecter les variables", "A.hrm.collect()")
    if (i === 2) return btn("Calculer la paie", "A.hrm.calc()")
    if (i === 3) { const n = openAno().length; return `${btn("Terminer le contrôle", "A.hrm.control()")} <span class="muted">${n ? `${n} anomalie(s) à traiter` : "aucune anomalie ouverte"}</span> ${btn("Voir les anomalies", "go('hr-paie/controle')", "ghost sm")}` }
    if (i === 4) return `<div class="form" style="max-width:640px">${field("hr-v1", "Première validation", userSel("hr-v1", "DRH"))}${field("hr-v2", "Seconde validation", userSel("hr-v2", "PAIE"))}<div style="align-self:end">${btn("Valider la paie", "A.hrm.validate()")}</div></div>
      <p class="muted" style="margin:6px 0 0">Salaires modifiés ce mois par : ${p.editors.map((x) => esc(USERS[x])).join(", ") || "personne"} — ces personnes ne peuvent pas valider.</p>`
    if (i === 5) return btn("Préparer les virements", "go('hr-paie/virements')")
    if (i === 6) return btn("Générer les écritures (FIN)", "A.hrm.journal()")
    if (i === 7) return btn("Générer les déclarations", "A.hrm.declAll()") + " " + btn("Détail", "go('hr-declarations')", "ghost sm")
    if (i === 8) return btn("Clôturer et publier les bulletins", "A.hrm.close()", "accent")
    return ""
  }
  function cycle() {
    const p = cur(), t = totals(slips())
    return `${cards([kpi("Effectif payé", t.n, "employés actifs"), kpi("Masse salariale brute", money(t.brut), p.calc ? "calculée" : "provisoire"), kpi("Net à payer", money(t.net), "exemple"), kpi("Coût employeur", money(t.cost), "brut + charges patronales")])}
      ${p.stale ? `<div class="err" style="margin-top:14px">Calcul invalidé : ${esc(p.stale)}. Relancez la collecte et le calcul.</div>` : ""}
      ${p.closed ? `<div class="card" style="margin-top:14px">${badge("Période verrouillée", "dark")} Clôturée le ${fd(p.closed)}. Bulletins publiés dans l'application mobile et le coffre-fort électronique (simulé). Toute correction passe par une régularisation (RG-HRM-03).
        <div class="row" style="margin-top:10px">${btn(`Ouvrir la période ${monthLabel(nextMonth(p.month))}`, "A.hrm.openNext()")}</div></div>` : ""}
      <h2>Étapes du cycle <span class="muted" style="font-size:14px;font-weight:400">§5.13 · EF-HRM-013</span></h2>
      ${STEPS.map(([n, d, who], i) => `<div class="step"><b class="n">${i + 1}</b><div><div class="row between"><strong>${esc(n)}</strong>${p.step > i ? badge("Fait", "on") : p.step === i ? badge("En cours", "outline") : muted("à venir")}</div>
        <div class="muted">${esc(d)} · ${esc(who)}${i === 2 && p.calc ? ` · calculé à ${esc(p.calc.at)} avec ${esc(p.calc.version)}` : ""}${i === 4 && p.validated ? ` · ${esc(USERS[p.validated.v1])} et ${esc(USERS[p.validated.v2])}` : ""}</div>
        ${p.step === i && !p.closed ? `<div style="margin-top:8px">${stepAction(i)}</div>` : ""}</div></div>`).join("")}
      ${H.regul.length ? `<h2>Régularisations reportées</h2>${tbl(["Date", "Motif", "Période d'imputation", "#Montant"], H.regul.map((x) => [fd(x.date), esc(x.why), esc(x.to), x.amount ? money(x.amount) : muted("—")]))}` : ""}
      <h2>Périodes précédentes</h2>
      ${tbl(["Période", "#Masse brute", "#Coût employeur", "#Délai de clôture", "Statut"], H.history.slice().reverse().map((h) => [esc(monthLabel(h.month)), money(h.brut), money(h.cost), h.delay + " j", badge("Clôturée", "outline")]))}`
  }

  function variables() {
    const tr = troncShares()
    return `<p class="muted">Variables du mois collectées depuis le pointage, les congés, le POS (consommations du personnel, simulé) et le tronc commun. ${cur().step >= 2 ? badge("Collectées", "on") : badge("Collecte à lancer", "outline")}</p>
      ${tbl(["Employé", "#HS +15 %", "#HS +50 %", "#+75 %", "#Abs. non payées", "#Congés / maladie", "#Prime", "#Pourboires", "#Consommations", "#Prêts"], active().map((e) => { const v = H.vars[e.id] || {}
        return [elink(e.id), fh(v.h15 || 0), fh(v.h50 || 0), fh(v.h75 || 0), absDays(e.id, cur().month) + " j", leaveDaysMonth(e.id, cur().month) + " j", money(v.prime || 0), H.tronc.integrated && tr[e.id] ? money(tr[e.id].share) : "—", money(v.conso || 0), money(loanDue(e.id))] }))}
      <h2>Saisie d'une prime</h2>
      <div class="card"><div class="form">${field("hr-vemp", "Employé", select("hr-vemp", active().map((e) => [e.id, e.name]), "E05"))}${field("hr-vamt", "Prime de rendement", input("hr-vamt", "25000", 'type="number" step="1000"'))}
        <div style="align-self:end">${btn("Enregistrer", "A.hrm.prime()", "ghost")}</div></div></div>
      <h2>Rappel et régularisation rétroactive <span class="muted" style="font-size:14px;font-weight:400">EF-HRM-019</span></h2>
      <div class="card"><p class="muted" style="margin-top:0">Augmentation avec effet antérieur : les périodes clôturées sont recalculées avec le nouveau salaire, l'écart de brut est reporté en rubrique 1400 sur la période ouverte (RG-HRM-03 : aucune période clôturée n'est modifiée).</p>
        <div class="form">${field("hr-remp", "Employé", select("hr-remp", active().map((e) => [e.id, e.name]), "E13"))}${field("hr-rfrom", "Effet à partir de", select("hr-rfrom", H.history.map((h) => [h.month, monthLabel(h.month)]), H.history[Math.max(0, H.history.length - 2)].month))}
        ${field("hr-rbase", "Nouveau salaire de base", input("hr-rbase", "130000", 'type="number" step="1000"'))}${field("hr-rrby", "Saisi par", userSel("hr-rrby", "PAIE"))}
        <div class="full" id="hr-rerr"></div><div class="full">${btn("Recalculer et reporter l'écart", "A.hrm.rappel()")}</div></div>
        ${H.regul.some((x) => x.detail) ? tbl(["Employé", "Période recalculée", "#Ancien brut", "#Nouveau brut", "#Écart"], H.regul.filter((x) => x.detail).flatMap((x) => x.detail.map((d) => [esc(x.name), esc(monthLabel(d.m)), money(d.old), money(d.neu), money(d.neu - d.old)]))) : ""}</div>`
  }

  function controle() {
    const list = anomalies(), open = list.filter((a) => !a.state)
    const ia = list.filter((a) => a.src === "IA")
    return `${aiBox("Contrôle intelligent de la paie", `${ia.length} signal(aux) détecté(s) : variations inhabituelles, employé sans pointage, compte bancaire partagé, heures supplémentaires atypiques. Alerte au gestionnaire uniquement : aucune correction automatique.`)}
      <p class="muted" style="margin-top:14px">${cur().calc ? "Sur la paie calculée." : "Aperçu sur un calcul provisoire (le calcul n'est pas encore lancé)."} Le contrôle ne peut être terminé que lorsque chaque anomalie est corrigée ou justifiée.</p>
      ${tbl(["Employé", "Source", "Gravité", "Anomalie", "État", ""], list.map((a) => [elink(a.emp), badge(a.src, a.src === "IA" ? "outline" : ""), a.sev === "Bloquant" ? badge("Bloquant", "dark") : esc(a.sev), esc(a.text), a.state ? badge(a.state, "on") : "Ouverte",
        a.state ? "" : `<span class="row" style="flex-wrap:nowrap">${a.fix ? btn("Corriger", `go('hr-personnel/dossiers/${esc(a.emp)}')`, "ghost sm") : ""}${btn("Justifier", `A.hrm.justify(${q(a.key)})`, "sm")}</span>`]), "Aucune anomalie.")}
      <p class="muted">${open.length} ouverte(s). Les coordonnées manquantes ou non validées se corrigent dans le dossier ; l'anomalie disparaît d'elle-même.</p>`
  }

  function bulletins() {
    const S = slips(), t = totals(S), p = cur()
    return `<p class="muted">${p.closed ? "Bulletins publiés (app mobile et coffre-fort électronique, simulé)." : p.calc ? "Bulletins calculés, non publiés." : "Calcul provisoire : bulletins indicatifs."} Le tableau sert de livre de paie (EF-HRM-020).</p>
      ${tbl(["Matricule", "Employé", "Service", "#Brut", "#Cotisations sal.", "#ITS", "#Retenues", "#Net à payer", "#Coût employeur", ""], Object.values(S).map((s) => { const e = E(s.id)
        return [esc(e.mat), elink(e.id), esc(DEPTS[e.dept]), money(s.brut), money(s.salCot), money(s.its), money(s.aen + s.loanApp + s.consoApp), `<strong>${money(s.net)}</strong>`, money(s.cost), btn("Bulletin", `go('hr-bulletin/${esc(e.id)}')`, "ghost sm")] }), "Aucun bulletin.",
        `<tfoot><tr><td>Total</td><td>${t.n} bulletins</td><td></td><td class="num">${money(t.brut)}</td><td class="num">${money(t.salCot)}</td><td class="num">${money(t.its)}</td><td class="num">${money(t.aen + t.loanApp + t.consoApp)}</td><td class="num">${money(t.net)}</td><td class="num">${money(t.cost)}</td><td></td></tr></tfoot>`)}`
  }

  const CATL = { base: "Gains de base", var: "Gains variables", ind: "Indemnités", aen: "Avantages en nature", cot: "Cotisations sociales", imp: "Impôts sur salaires", tax: "Taxes patronales", ret: "Retenues", info: "Informatives" }
  function bulletin(id) {
    const e = E(id) || active()[0], S = slips(), s = S[e.id] || slip(e), p = cur()
    const rows = Object.entries(CATL).map(([k, label]) => { const ls = s.lines.filter((l) => l.cat === k); if (!ls.length) return ""
      return `<tr><td colspan="7"><strong>${esc(label)}</strong></td></tr>` + ls.map((l) => `<tr><td class="muted">${esc(l.code)}</td><td>${esc(l.label)}</td><td>${esc(l.base)}</td><td>${esc(l.rate)}</td><td class="num">${l.gain ? money(l.gain) : ""}</td><td class="num">${l.ret ? money(l.ret) : ""}</td><td class="num">${l.pat ? money(l.pat) : ""}</td></tr>`).join("") }).join("")
    const ret = s.aen + s.loanApp + s.consoApp
    const expl = `Votre brut est de ${money(s.brut)} : salaire de base, ancienneté${s.lines.some((l) => l.cat === "var") ? ", heures et primes du mois" : ""} et indemnités. La CNPS retient ${pc(PACK.retS)} pour la retraite et la CMU ${money(PACK.cmuS)}, soit ${money(s.salCot)}. L'ITS est calculé sur ${money(s.brutImp)} (brut imposable, hors indemnités non imposables) selon le barème, diminué de la réduction pour ${String(e.parts).replace(".", ",")} part(s) : ${money(s.its)}. ${ret ? `Sont ensuite retenus ${money(ret)} (avantage en nature non versé, prêts, consommations). ` : ""}Il vous reste ${money(s.net)} net à payer. L'hôtel paie en plus ${money(s.patSoc + s.patTax)} de charges patronales.`
    return `<div class="row between noprint"><h1>Bulletin de paie</h1><span class="row">${btn("Retour aux bulletins", "go('hr-paie/bulletins')", "ghost")}<button class="btn" onclick="print()">Imprimer</button></span></div>
      <p class="lead noprint">${p.closed ? "Publié" : p.calc ? "Calculé, non publié" : "Provisoire"} · ${esc(s.version)} · calcul historisé et reproductible (EF-HRM-025). Du brut au net : base, sursalaire, primes, avantages en nature, indemnités plafonnées, cotisations, ITS, retenues (EF-HRM-014). Taux et barèmes d'exemple.</p>
      <div class="card invoice">
        <div class="row between"><div><div class="big">${esc(D.hotel)}</div><div class="muted">${esc(ENT(e.entity).name)} · ${esc(e.prop)} · n° employeur CNPS 0000000 (fictif) · période ${esc(monthLabel(p.month))} · devise ${esc(ENT(e.entity).cur)}</div></div>
          <div style="text-align:right"><strong>${esc(e.name)}</strong><div class="muted">${esc(e.mat)} · ${esc(e.job)} · ${esc(e.cat)} · ${esc(e.contract)}</div><div class="muted">${esc(e.family)} · entrée le ${fd(e.start)}/${e.start.slice(0, 4)}</div></div></div>
        <div class="tablewrap"><table style="margin-top:12px"><thead><tr><th>Code</th><th>Rubrique</th><th>Base</th><th>Taux</th><th class="num">Gain</th><th class="num">Retenue</th><th class="num">Part patronale</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td></td><td>Salaire brut</td><td></td><td></td><td class="num">${money(s.brut)}</td><td></td><td></td></tr>
            <tr><td></td><td>Total retenues (cotisations, ITS, retenues)</td><td></td><td></td><td></td><td class="num">${money(s.salCot + s.its + ret)}</td><td class="num">${money(s.patSoc + s.patTax)}</td></tr>
            <tr><td></td><td><strong>Net à payer</strong> · ${esc(e.pay.ref || e.pay.mode + " (coordonnées à compléter)")}</td><td></td><td></td><td class="num"><strong>${money(s.net)}</strong></td><td></td><td></td></tr></tfoot></table></div>
        <p class="muted">Document d'exemple. Coût employeur ${money(s.cost)}. Brut imposable ${money(s.brutImp)}.</p>
      </div>
      <div class="noprint" style="margin-top:14px">${aiBox("Explication du bulletin", expl)}</div>`
  }

  function virements() {
    const p = cur(), S = slips()
    if (p.step < 5) return `<p class="muted">Disponible après la validation de la paie (étape 5). Étape actuelle : ${esc(STEPS[Math.min(p.step, 8)][0])}.</p>`
    const lines = Object.values(S).filter((s) => s.net > 0).map((s) => ({ s, e: E(s.id) }))
    const okL = lines.filter((x) => x.e.pay.ref && !x.e.payPending), ko = lines.filter((x) => !x.e.pay.ref || x.e.payPending)
    const grp = (mode) => okL.filter((x) => x.e.pay.mode === mode)
    const block = (mode, file) => { const g = grp(mode); return card(`${mode} — ${g.length} paiement(s) · ${money(sum(g, (x) => x.s.net))}`, `<p class="muted" style="margin-top:0">${esc(file)}</p>${tbl(["Employé", "Compte", "#Net"], g.map((x) => [ename(x.e.id), esc(x.e.pay.ref), money(x.s.net)]))}`) }
    const R = p.recon || {}, nR = okL.filter((x) => /^Rapproché/.test(R[x.e.id] || "")).length
    const file = okL.filter((x) => x.e.pay.mode === "Virement").slice(0, 3).map((x) => `VIR;${x.e.mat};${x.e.pay.ref};${x.s.net};XOF;SALAIRE ${p.month}`).join("\n")
    const recon = p.paid ? `<h2>Rapprochement des paiements <span class="muted" style="font-size:14px;font-weight:400">EF-HRM-021</span></h2>
      ${cards([kpi("Paiements rapprochés", `${nR}/${okL.length}`, "relevé bancaire + état de l'agrégateur (simulés)"), kpi("Montant rapproché", money(sum(okL.filter((x) => /^Rapproché/.test(R[x.e.id] || "")), (x) => x.s.net)), "sur " + money(sum(okL, (x) => x.s.net))), kpi("Rejets", okL.filter((x) => /^Rejeté/.test(R[x.e.id] || "")).length, "à relancer")])}
      <div class="row" style="margin:12px 0">${btn(Object.keys(R).length ? "Réimporter les relevés" : "Importer le relevé bancaire et l'état mobile money (simulé)", "A.hrm.recon()", "ghost")}</div>
      ${Object.keys(R).length ? tbl(["Employé", "Mode", "Compte", "#Net", "Statut", ""], okL.map((x) => { const st = R[x.e.id] || "Non trouvé"
        return [ename(x.e.id), esc(x.e.pay.mode), esc(x.e.pay.ref), money(x.s.net), badge(st, /^Rapproché/.test(st) ? "on" : "dark"), /^Rejeté|Non trouvé/.test(st) ? btn("Relancer le paiement", `A.hrm.retryPay(${q(x.e.id)})`, "ghost sm") : ""] })) : ""}` : ""
    return `${p.paid ? `<div class="card">${badge("Exécuté (simulé)", "on")} Lots validés par ${esc(USERS[p.paid.v1])} et ${esc(USERS[p.paid.v2])}. Confirmation fin.payment.executed reçue (simulé).</div>` : ""}
      <div class="cols" style="margin-top:14px">${block("Virement", "Fichier BANQUE-LAGUNE-EXEMPLE-" + p.month.replace("-", "") + ".txt (format bancaire simulé)")}${block("Mobile Money", "Lot transmis à l'agrégateur mobile money (simulé)")}</div>
      <details style="margin-top:10px"><summary class="muted">Aperçu du fichier de virement (format simulé) · EF-HRM-021</summary><pre style="white-space:pre-wrap;font-size:12px">${esc(file)}\n…</pre></details>
      ${recon}
      ${ko.length ? `<div class="err" style="margin-top:14px">Exclus du lot : ${ko.map((x) => esc(x.e.name) + (x.e.payPending ? " (changement non validé)" : " (coordonnées manquantes)")).join(", ")}. Paiement à régulariser après correction du dossier.</div>` : ""}
      ${p.paid ? "" : `<h2>Double validation des paiements</h2><div class="card"><div class="form">${field("hr-pv1", "Trésorerie", userSel("hr-pv1", "TRE"))}${field("hr-pv2", "Seconde validation", userSel("hr-pv2", "DAF"))}<div style="align-self:end">${btn("Valider et transmettre", "A.hrm.pay()", "accent")}</div></div>
        <p class="muted" style="margin:8px 0 0">Deux personnes distinctes ; celui qui a modifié un salaire ce mois ne peut pas valider le paiement (RG-HRM-04).</p></div>`}`
  }

  function pourboires() {
    const tr = troncShares(), el = Object.keys(tr)
    const dist = sum(el, (id) => tr[id].share)
    return `${cards([kpi("Montant à répartir", money(H.tronc.pool), H.tronc.src), kpi("Bénéficiaires", el.length, "restauration, réception, étages"), kpi("Statut", H.tronc.integrated ? "Intégré à la paie" : "À intégrer", "EF-HRM-015")])}
      <div class="card" style="margin-top:14px"><div class="form">${field("hr-pool", "Montant du tronc (FCFA)", input("hr-pool", H.tronc.pool, 'type="number" step="1000"'))}<div style="align-self:end">${btn("Mettre à jour", "A.hrm.pool()", "ghost")}</div>
        <div style="align-self:end">${btn(H.tronc.integrated ? "Réintégrer à la paie" : "Intégrer à la paie", "A.hrm.troncIn()")}</div></div></div>
      <h2>Répartition (points par poste × jours de présence)</h2>
      ${tbl(["Employé", "Poste", "#Points", "#Jours de présence", "#Part"], el.map((id) => [elink(id), esc(E(id).job), E(id).pts, tr[id].pres, money(tr[id].share)]), "", `<tfoot><tr><td>Total réparti</td><td></td><td></td><td></td><td class="num">${money(dist)}</td></tr></tfoot>`)}
      <p class="muted">Écart d'arrondi éventuel : ${money(H.tronc.pool - dist)} (arrondi au franc, RG-HRM-09).</p>`
  }

  function prets() {
    const l = H.loans.find((x) => x.id === ui.hrLoan) || H.loans[0]
    const sched = []
    if (l) { let rem = l.remaining, m = cur().month; while (rem > 0 && sched.length < 24) { const pay = Math.min(l.monthly, rem); rem -= pay; sched.push([esc(monthLabel(m)), money(pay), money(rem)]); m = nextMonth(m) } }
    return `<p class="muted">Acomptes, avances et prêts au personnel, remboursés par retenue sur salaire selon l'échéancier (EF-HRM-016). Retenue effective à la clôture de chaque période.</p>
      ${tbl(["Réf.", "Employé", "Type", "#Montant", "#Échéance", "#Restant dû", ""], H.loans.map((x) => [esc(x.id), elink(x.emp), esc(x.type), money(x.amount), money(x.monthly), x.remaining ? money(x.remaining) : badge("Soldé", "on"), `<span class="row" style="flex-wrap:nowrap">${btn("Échéancier", `ui.hrLoan=${q(x.id)};render()`, "ghost sm")}${x.remaining ? btn("Remboursement anticipé", `A.hrm.repay(${q(x.id)})`, "ghost sm") : ""}</span>`]))}
      ${l ? `<h2>Échéancier ${esc(l.id)} — ${ename(l.emp)}</h2>${tbl(["Mois", "#Retenue", "#Restant après"], sched, "Soldé.")}` : ""}
      <h2>Nouvelle avance ou nouveau prêt</h2>
      <div class="card"><div class="form">${field("hr-lnemp", "Employé", select("hr-lnemp", active().map((e) => [e.id, e.name]), "E14"))}${field("hr-lntype", "Type", select("hr-lntype", ["Acompte (mois en cours)", "Avance sur salaire", "Prêt"], "Avance sur salaire"))}
        ${field("hr-lnamt", "Montant", input("hr-lnamt", "50000", 'type="number" step="1000"'))}${field("hr-lnn", "Nombre d'échéances", input("hr-lnn", "2", 'type="number" min="1" max="24"'))}
        <div class="full" id="hr-lnerr"></div><div class="full">${btn("Accorder", "A.hrm.loan()")}</div></div>
        <p class="muted" style="margin:8px 0 0">L'échéance ne peut pas dépasser la quotité saisissable (exemple : 1/3 du net) ; le net ne peut jamais être négatif (RG-HRM-06).</p></div>`
  }

  // ----- Portail self-service employé (app mobile personnel, EF-HRM-028) -----
  function portail() {
    const e = E(ui.hrMe) && E(ui.hrMe).status === "actif" ? E(ui.hrMe) : E("E09"), p = cur(), s = slips()[e.id]
    const mine = H.leaves.filter((l) => l.emp === e.id).slice(-4).reverse(), att = H.attest.filter((a) => a.emp === e.id).slice().reverse()
    const plan = WEEK.map((d, i) => { const c = cell(e.id, i); return `<div class="row between"><span>${esc(wd(d))} ${fd(d)}</span>${c === "C" ? badge("Congé", "outline") : c === "R" ? muted("Repos") : `<strong>${esc(SH[c].l)}</strong>`}</div>` }).join("")
    const slipsL = [...(p.closed ? [[p.month, true]] : [[p.month, false]]), ...H.history.slice(-2).reverse().map((h) => [h.month, true])]
    const app = `<p class="muted" style="margin:0">${esc(e.name)} · ${esc(e.mat)}</p>
      <h3>Mon planning ${H.planPublished ? badge("publié", "on") : badge("provisoire", "outline")}</h3>${plan}
      <h3>Mes bulletins</h3>${slipsL.map(([m, pub]) => `<div class="row between"><span>${esc(monthLabel(m))}</span>${pub ? (m === p.month ? btn("Ouvrir", `go('hr-bulletin/${esc(e.id)}')`, "ghost sm") : badge("Coffre-fort", "outline")) : muted("en cours · " + (s ? money(s.net) + " estimé" : "—"))}</div>`).join("")}
      <h3>Mes congés · solde ${fj(cpSolde(e))}</h3>
      ${field("hr-mfrom", "Du", input("hr-mfrom", addDays(today, 14), 'type="date"'))}${field("hr-mto", "Au", input("hr-mto", addDays(today, 15), 'type="date"'))}
      <div id="hr-merr"></div>${btn("Demander un congé", "A.hrm.meLeave()", "sm")}
      ${mine.map((l) => `<div class="row between"><span>${esc(l.type)} ${fd(l.from)}–${fd(l.to)}</span>${badge(l.status, l.status === "Validée" ? "on" : l.status === "Refusée" ? "dark" : "outline")}</div>`).join("")}
      <h3>Attestations</h3><div class="row">${btn("Attestation de travail", "A.hrm.meAttest('Attestation de travail')", "ghost sm")}${btn("Attestation de salaire", "A.hrm.meAttest('Attestation de salaire')", "ghost sm")}</div>
      ${att.map((a) => `<div class="row between"><span>${esc(a.id)} · ${esc(a.type)} · ${fd(a.date)}</span>${badge(a.status, "on")}</div>`).join("")}
      <h3>Mes coordonnées de paiement</h3><p class="muted" style="margin:0">${esc(e.pay.ref || "à compléter")}</p>
      ${e.payPending ? badge("Changement en attente de validation RH", "outline") : `${field("hr-mref", "Nouveau compte", input("hr-mref", "", 'placeholder="Mobile Money ••••0000"'))}${btn("Demander le changement", "A.hrm.mePay()", "ghost sm")}`}`
    const last = att[0]
    return pageHead("Portail employé", "Application mobile du personnel (simulée) : planning, bulletins, attestations et demandes. Données fictives.")
      + `<div class="row" style="margin-bottom:12px"><label for="hr-me" style="margin:0">Connecté en tant que</label>${select("hr-me", active().map((x) => [x.id, x.name]), e.id, `onchange="ui.hrMe=this.value;render()"`)}<span class="muted">EF-HRM-028</span></div>
      <div class="cols"><section>${phone(app, "HMS Personnel")}</section><section>
        ${last ? card(`${last.type} — aperçu`, `<p style="margin-top:0">${esc(ENT(e.entity).name)} atteste que ${esc(e.name)}, matricule ${esc(e.mat)}, est employé(e) en qualité de ${esc(e.job)} (${esc(e.contract)}) depuis le ${fd(e.start)}/${e.start.slice(0, 4)}${last.type === "Attestation de salaire" && s ? `, pour un salaire brut mensuel de ${money(s.brut)}` : ""}.</p><p class="muted">Document d'exemple généré le ${fd(last.date)}, déposé dans le coffre-fort électronique (simulé).</p>`) : ""}
        ${card("Circuit des demandes", `<p class="muted" style="margin-top:0">Congés : chef de service puis RH (Plannings et temps › Congés). Coordonnées de paiement : validation RH et alerte anti-fraude (RG-HRM-07). Bulletins publiés à la clôture de la paie.</p>${btn("Voir les demandes de congés", "go('hr-temps/conges')", "ghost sm")}`)}
      </section></div>`
  }

  // ----- Multi-entités, multi-établissements, multi-devises (EF-HRM-026) -----
  const entRows = () => H.entities.map((x) => {
    if (x.id === "ENT1") { const t = totals(slips()), p = cur(); return { x, n: t.n, brut: t.brut, cost: t.cost, status: p.closed ? "Clôturée" : p.step >= 3 ? "Calculée" : "Ouverte", live: true } }
    const mut = H.emps.filter((e) => e.status === "muté" && e.entity === x.id).map((e) => slip({ ...e, status: "actif" }, cur().month, { vars: {}, noTronc: true, noAbs: true, noLoans: true }))
    const brut = x.brut + r0(sum(mut, (m) => m.brut) / x.rate)
    return { x, n: x.n + mut.length, brut, cost: r0(brut * 1.21), status: x.status, mut: mut.length }
  })
  function entites() {
    const rows = entRows(), cons = sum(rows, (r) => r.cost * r.x.rate)
    const props = ENT("ENT1").props.map((pp) => { const ids = active().filter((e) => e.prop === pp).map((e) => e.id), S = slips(); return [esc(pp), ids.length, money(sum(ids, (i) => (S[i] || { brut: 0 }).brut)), money(sum(ids, (i) => (S[i] || { cost: 0 }).cost))] })
    return `<p class="muted">Chaque entité juridique a sa période de paie, son pack légal et sa devise ; la consolidation groupe se fait en XOF au taux d'exemple (EF-HRM-026). Entités hors Hôtel Exemple SARL : effectifs et montants d'exemple.</p>
      ${cards([kpi("Entités juridiques", H.entities.length, `${new Set(H.entities.map((x) => x.cur)).size} devises`), kpi("Effectif groupe", sum(rows, (r) => r.n), "toutes entités"), kpi("Coût employeur consolidé", money(cons), "contre-valeur XOF · exemple")])}
      ${tbl(["Entité", "Pays · pack", "Devise", "#Effectif", "#Masse brute (devise)", "#Coût employeur (devise)", "#Contre-valeur XOF", "Période", ""], rows.map((r) => [esc(r.x.name) + (r.mut ? `<div class="muted">dont ${r.mut} muté(s) depuis Hôtel Exemple SARL</div>` : ""), `${esc(r.x.country)}<div class="muted">${esc(r.x.pack)}</div>`, esc(r.x.cur) + (r.x.rate !== 1 ? `<div class="muted">1 ${esc(r.x.cur)} = ${r.x.rate} XOF</div>` : ""), r.n, fx(r.brut, r.x.cur), fx(r.cost, r.x.cur), money(r.cost * r.x.rate),
        badge(r.status, r.status === "Clôturée" ? "outline" : r.status === "Calculée" ? "on" : ""), r.live ? btn("Ouvrir le cycle", "go('hr-paie/cycle')", "ghost sm") : r.status !== "Clôturée" ? btn(r.status === "Ouverte" ? "Calculer" : "Clôturer", `A.hrm.entStep(${q(r.x.id)})`, "ghost sm") : ""]), "", `<tfoot><tr><td>Consolidé groupe</td><td></td><td>XOF</td><td class="num">${sum(rows, (r) => r.n)}</td><td></td><td></td><td class="num">${money(cons)}</td><td></td><td></td></tr></tfoot>`)}
      <h2>Établissements de Hôtel Exemple SARL</h2>
      ${tbl(["Établissement", "#Effectif", "#Masse brute", "#Coût employeur"], props)}
      <p class="muted">Une mutation (Dossier › Avenant, promotion ou mutation) vers un autre établissement de la même entité garde la paie ; vers une autre entité, l'employé sort de cette paie et rejoint celle de l'entité cible, dans sa devise.</p>`
  }

  function parametres() {
    const P = PACK
    const rub = [["Gains de base", "1000 Salaire de base · 1010 Sursalaire · 1020 Ancienneté (2 % à 2 ans puis +1 %/an, plafond 25 %)"], ["Gains variables", "1100–1120 Heures majorées · 1150 Prime de rendement · 1160 Service et pourboires · 1400 Rappel sur périodes antérieures"], ["Indemnités", "1200 Transport (non imposable ≤ plafond) · 1210 Logement · 1220 Panier"], ["Avantages en nature", "1300 Logement · 1310 Nourriture (véhicule paramétrable)"],
      ["Cotisations sociales", "2000 Retraite · 2010 Prestations familiales · 2020 Accidents du travail · 2030 CMU"], ["Impôts sur salaires", "3000 ITS selon barème et parts"], ["Taxes patronales", "3100 Contribution employeur · 3110 Taxe d'apprentissage · 3120 FPC"], ["Retenues", "4000 Reprise avantage en nature · 4010 Prêts et avances · 4020 Consommations · absences"], ["Informatives", "9000 Coût employeur · 9010 Congés acquis · 9020 Reliquat reporté"]]
    return `<p class="muted">${esc(P.version)} · date d'effet ${fd(P.effect)}/${P.effect.slice(0, 4)} · ${badge("Taux d'exemple", "outline")} à faire valider par un expert local avant tout usage (EF-HRM-011, EF-HRM-012).</p>
      <div class="cols"><section><h2>Taux et plafonds</h2>
        ${tbl(["Paramètre", "Salarié", "Employeur", "Base / plafond"], [["CNPS retraite", pc(P.retS), pc(P.retP), "plafond " + money(P.capRet)], ["Prestations familiales", "—", pc(P.pf), "plafond " + money(P.capPF)], ["Accidents du travail", "—", pc(P.at), "plafond " + money(P.capPF)], ["CMU", money(P.cmuS), money(P.cmuP), "forfait mensuel"], ["Contribution employeur", "—", pc(P.ce), "brut imposable"], ["Taxe d'apprentissage", "—", pc(P.ta), "brut imposable"], ["Formation continue", "—", pc(P.fpc), "brut imposable"], ["Indemnité transport", "non imposable", "", "≤ " + money(P.transportCap)], ["Minimum légal (exemple)", money(P.smig), "", "mensuel"]].map((r) => r.map(esc)))}</section>
      <section><h2>Barème ITS mensuel (exemple)</h2>
        ${tbl(["Tranche", "Taux"], P.bareme.map(([cap, rate], i) => [`${i ? money(P.bareme[i - 1][0] + 1) : "0"} → ${cap === Infinity ? "au-delà" : money(cap)}`, pc(rate)]))}
        <p class="muted">Réduction pour charges de famille : ${Object.entries(P.reduc).filter(([, v]) => v).map(([k, v]) => `${k.replace(".", ",")} p. ${money(v)}`).join(" · ")}.</p>
        <h3>Minima catégoriels (exemple)</h3>${tbl(["Catégorie", "#Minimum"], Object.entries(CATS).map(([k, v]) => [esc(k), money(v)]))}</section></div>
      <h2>Catégories de rubriques <span class="muted" style="font-size:14px;font-weight:400">§5.14</span></h2>
      ${tbl(["Catégorie", "Rubriques du pack"], rub.map((r) => r.map(esc)))}
      <h2>Non-régression</h2>
      <div class="card"><p style="margin-top:0">Relance du calcul sur les bulletins de référence : même données + mêmes paramètres = même résultat (RG-HRM-08, ENF-HRM-02).</p>
        ${btn("Rejouer les bulletins de référence", "A.hrm.replay()", "ghost")} ${ui.hrRef ? `<span class="muted">${esc(ui.hrRef)}</span>` : ""}</div>`
  }

  // ----- Déclarations -----
  const declData = () => {
    const S = slips(), a = Object.values(S), line = (code) => sum(a, (s) => { const l = s.lines.find((x) => x.code === code); return l ? l.ret + l.pat : 0 })
    return [
      { k: "CNPS", label: "Déclaration CNPS mensuelle", due: "15/" + nextMonth(cur().month).slice(5, 7), detail: [["Retraite (parts salariale et patronale)", line("2000")], ["Prestations familiales", line("2010")], ["Accidents du travail", line("2020")], ["CMU", line("2030")]] },
      { k: "ITS", label: "État de l'impôt sur salaires", due: "15/" + nextMonth(cur().month).slice(5, 7), detail: [["ITS retenu", line("3000")], ["Contribution employeur", line("3100")]] },
      { k: "FDFP", label: "Taxes FDFP", due: "15/" + nextMonth(cur().month).slice(5, 7), detail: [["Taxe d'apprentissage", line("3110")], ["Formation professionnelle continue", line("3120")]] },
    ]
  }
  function periodiques() {
    const p = cur(), can = p.step >= 5
    return `${can ? "" : `<div class="err">La paie doit être validée (étape 5) avant de générer les déclarations. Les montants ci-dessous sont provisoires.</div>`}
      <div class="grid" style="margin-top:14px">${declData().map((d) => { const tot = sum(d.detail, (x) => x[1]), st = p.decl[d.k]
        return card(d.label, `<div class="kpi">${money(tot)}</div><div class="muted">Échéance d'exemple : ${d.due} · ${st ? badge(st, st === "Télédéclarée" ? "on" : "outline") : "à générer"}</div>
          ${tbl(["Élément", "#Montant"], d.detail.map(([l, v]) => [esc(l), money(v)]))}
          <div class="row" style="margin-top:10px">${!st ? btn("Générer le fichier", `A.hrm.decl(${q(d.k)})`, "sm") : st === "Fichier généré" ? btn("Télédéclarer (simulé)", `A.hrm.declSend(${q(d.k)})`, "sm") : muted("Accusé de réception simulé n° " + d.k + "-" + p.month.replace("-", ""))}</div>`) }).join("")}</div>
      <p class="muted">Formats de télédéclaration en vigueur non reproduits : fichiers d'exemple (EF-HRM-022).</p>`
  }
  function disa() {
    const S = slips()
    const rows = Object.values(S).map((s) => { const e = E(s.id), months = e.start > "2026-01-01" ? 12 - Number(e.start.slice(5, 7)) : 11
      return { e, months, brut: s.brutImp * months, cnps: (s.lines.find((l) => l.code === "2000") || {}).ret * months, its: s.its * months } })
    return `<p class="muted">Déclaration annuelle des salaires 2026, à déposer en début d'année suivante. Brouillon : cumuls janvier–octobre estimés à partir de novembre (exemple), novembre calculé ; décembre ajouté à la clôture annuelle.</p>
      ${tbl(["Matricule", "Employé", "#Mois", "#Brut imposable cumulé", "#CNPS salariale", "#ITS"], rows.map((x) => [esc(x.e.mat), ename(x.e.id), x.months, money(x.brut), money(x.cnps), money(x.its)]), "", `<tfoot><tr><td>Total</td><td></td><td></td><td class="num">${money(sum(rows, (x) => x.brut))}</td><td class="num">${money(sum(rows, (x) => x.cnps))}</td><td class="num">${money(sum(rows, (x) => x.its))}</td></tr></tfoot>`)}
      <div class="row" style="margin-top:12px">${H.disa ? badge("Brouillon DISA généré (" + H.disa + ")", "on") : btn("Générer le brouillon DISA", "A.hrm.disa()")}</div>`
  }
  const journalLines = () => {
    const S = slips(), a = Object.values(S), t = totals(S), L = []
    Object.keys(DEPTS).forEach((d) => { const v = sum(a.filter((s) => E(s.id).dept === d), (s) => s.brut - s.aen); if (v) L.push(["661", "Rémunérations du personnel", DEPTS[d], v, 0]) })
    L.push(["664", "Charges sociales patronales", "", t.patSoc, 0], ["641", "Impôts et taxes sur salaires (contribution, FDFP)", "", t.patTax, 0])
    const sal = sum(a, (s) => s.lines.find((l) => l.code === "2000").ret + s.lines.find((l) => l.code === "2030").ret)
    L.push(["431", "CNPS", "", 0, sal + t.patSoc], ["447", "État, ITS et taxes sur salaires", "", 0, t.its + t.patTax], ["421", "Personnel, prêts et avances", "", 0, t.loanApp], ["4711", "Consommations du personnel (exemple)", "", 0, t.consoApp], ["422", "Personnel, rémunérations dues", "", 0, t.net])
    return L.filter((l) => l[3] || l[4])
  }
  function ecritures() {
    const p = cur(), L = journalLines(), dr = sum(L, (l) => l[3]), cr = sum(L, (l) => l[4])
    return `<p class="muted">${p.journal ? `Écritures transmises au journal de paie le ${fd(p.journal)} (FIN, simulé).` : "Aperçu : les écritures sont générées à l'étape Comptabilisation."} Plan de comptes de type SYSCOHADA (exemple), ventilation analytique par service (EF-HRM-023).</p>
      ${tbl(["Compte", "Libellé", "Analytique", "#Débit", "#Crédit"], L.map((l) => [esc(l[0]), esc(l[1]), esc(l[2]), l[3] ? money(l[3]) : "", l[4] ? money(l[4]) : ""]), "", `<tfoot><tr><td></td><td>Total</td><td>${dr === cr ? badge("Équilibré", "on") : badge("Déséquilibre", "dark")}</td><td class="num">${money(dr)}</td><td class="num">${money(cr)}</td></tr></tfoot>`)}
      <p class="muted">Chaque ligne renvoie aux bulletins du service concerné (paie → hrm.payroll.closed → FIN).</p>`
  }

  // ----- Pilotage -----
  function kpis() {
    const S = slips(), t = totals(S), last = H.history[H.history.length - 1]
    const withReq = active().filter((e) => REQ[e.job]), okReq = withReq.filter((e) => { const c = certFor(e); return c && certOk(c) })
    const absent = sum(active(), (e) => leaveDaysMonth(e.id, "2026-11", "Maladie") + leaveDaysMonth(e.id, "2026-11", "Absence injustifiée"))
    const exits = 2 + H.emps.filter((e) => e.status === "sorti").length
    const byDept = Object.keys(DEPTS).map((d) => ({ label: DEPTS[d], value: sum(Object.values(S).filter((s) => E(s.id).dept === d), (s) => s.cost) })).filter((x) => x.value)
    const proj = Array.from({ length: 12 }, (_, i) => { let m = cur().month; for (let k = 0; k <= i; k++) m = nextMonth(m); const mo = Number(m.slice(5, 7)); return { m, v: r0(t.cost * (mo >= 1 && i >= 1 ? 1.03 : 1) * ([12, 1, 2].includes(mo) ? 1.06 : [7, 8].includes(mo) ? 1.04 : 1)) } })
    const mshort = (m) => day(m + "-01").toLocaleDateString("fr-FR", { month: "short" })
    return `<div class="grid">${kpi("Masse salariale brute", money(t.brut), monthLabel(cur().month) + " · exemple")}${kpi("Coût employeur", money(t.cost), "brut + charges patronales")}
      ${kpi("Coût de personnel / chambre occupée", money(t.cost / H.nuitees), H.nuitees + " nuitées du mois (exemple)")}${kpi("Écart vs budget", (t.cost > H.budget ? "+" : "") + pct(((t.cost - H.budget) / H.budget) * 100), "budget " + money(H.budget))}
      ${kpi("Délai de clôture de paie", last.delay + " j", "après fin de mois (octobre)")}${kpi("Taux d'erreurs de paie", pct((last.errors / t.n) * 100), "bulletins corrigés / émis (octobre)")}
      ${kpi("Absentéisme", pct((absent / (active().length * 26)) * 100), "maladie + absences injustifiées")}${kpi("Rotation (12 mois)", pct((exits / active().length) * 100), exits + " sorties / effectif")}
      ${kpi("Conformité des certifications", pct((okReq.length / (withReq.length || 1)) * 100), "employés à jour")}</div>
      <div class="cols"><section><h2>Coût employeur par service</h2>${bars(byDept, money)}</section>
      <section><h2>Historique du coût employeur</h2>${columns([...H.history.map((h) => mshort(h.month)), mshort(cur().month)], [...H.history.map((h) => h.cost), t.cost], (v) => Math.round(v / 1e5) / 10 + " M")}</section></div>
      <h2>Projection de masse salariale — 12 mois</h2>
      ${aiBox("Projection de masse salariale", `Coût de personnel prévu sur 12 mois : ${money(sum(proj, (x) => x.v))}. Hypothèses : revalorisation d'exemple de 3 % en janvier, renforts saisonniers en haute saison (décembre–février) et en juillet–août. Transmis au budget (FIN) après validation du DAF.`)}
      ${columns(proj.map((x) => mshort(x.m)), proj.map((x) => x.v), (v) => Math.round(v / 1e5) / 10 + " M")}`
  }
  function simulation() {
    const s = ui.hrSim
    return `<p class="muted">Coût employeur d'une embauche, d'une augmentation ou d'un passage en CDI, avec le même moteur que la paie (EF-HRM-024).</p>
      <div class="card"><div class="form">${field("hr-sbase", "Salaire de base", input("hr-sbase", s ? s.base : 150000, 'type="number" step="1000"'))}${field("hr-scat", "Catégorie", select("hr-scat", Object.keys(CATS), s ? s.cat : "E3"))}
        ${field("hr-strans", "Indemnité de transport", input("hr-strans", s ? s.transport : 30000, 'type="number" step="1000"'))}${field("hr-slog", "Indemnité de logement", input("hr-slog", s ? s.logement : 0, 'type="number" step="1000"'))}
        ${field("hr-sparts", "Parts ITS", select("hr-sparts", Object.keys(PACK.reduc), s ? String(s.parts) : "1"))}${field("hr-sstart", "Date d'entrée", input("hr-sstart", s ? s.start : today, 'type="date"'))}
        <div class="full" id="hr-serr"></div><div class="full">${btn("Simuler", "A.hrm.simulate()")}</div></div></div>
      ${s && s.res ? `<div class="grid" style="margin-top:14px">${kpi("Brut mensuel", money(s.res.brut), "exemple")}${kpi("Net à payer", money(s.res.net), "après CNPS, CMU et ITS")}${kpi("Coût employeur mensuel", money(s.res.cost), "charges patronales " + money(s.res.patSoc + s.res.patTax))}${kpi("Coût annuel", money(s.res.cost * 12), "12 mois, hors primes")}</div>` : ""}`
  }

  // ---------- Actions ----------
  const err = (id, m) => { const el = document.getElementById(id); if (el) el.innerHTML = `<div class="err">${esc(m)}</div>`; return false }
  const actions = {
    editId(id) {
      const e = E(id), parts = Number(val("hr-iparts")), mail = val("hr-imail")
      if (mail && !/^[^@\s]+@[^@\s]+$/.test(mail)) return err("hr-ierr", "E-mail invalide.")
      const t = parts !== e.parts ? touch(`parts ITS de ${e.name}`) : ""
      Object.assign(e, { addr: val("hr-iaddr"), phone: val("hr-iphone"), email: mail, family: val("hr-ifam"), parts, manager: val("hr-imgr") || null })
      e.history.unshift({ date: today, type: "Dossier", detail: "Identité / situation mise à jour", by: "DRH" })
      say("Dossier mis à jour", t); render()
    },
    editPay(id) {
      const e = E(id), by = val("hr-rby"), ks = ["sursal", "transport", "logement", "panier", "aenLog", "aenNour"]
      const nv = Object.fromEntries(ks.map((k) => [k, Math.max(0, Number(val("hr-r" + k)) || 0)]))
      const ch = ks.filter((k) => nv[k] !== (e[k] || 0))
      if (!ch.length) return toast("Aucun changement")
      Object.assign(e, nv)
      e.history.unshift({ date: today, type: "Rémunération", detail: ch.join(", ") + " modifié(s)", by })
      if (!cur().editors.includes(by)) cur().editors.push(by)
      say("Éléments de rémunération enregistrés", touch(`rémunération de ${e.name}`)); render()
    },
    rappel() {
      const p = cur(), e = E(val("hr-remp")), from = val("hr-rfrom"), base = Number(val("hr-rbase")), by = val("hr-rrby")
      if (p.closed) return err("hr-rerr", "La période courante est clôturée : ouvrez la période suivante pour y reporter le rappel (RG-HRM-03).")
      if (!(base > e.base)) return err("hr-rerr", `Le nouveau salaire doit dépasser le salaire actuel (${money(e.base)}).`)
      if (base < minFor(e.cat, e.hours)) return err("hr-rerr", `Inférieur au minimum de la catégorie ${e.cat} (RG-HRM-05).`)
      const months = H.history.map((h) => h.month).filter((m) => m >= from && m >= e.start.slice(0, 7))
      const o = { vars: {}, noTronc: true, noAbs: true, noLoans: true }
      const detail = months.map((m) => ({ m, old: slip(e, m, o).brut, neu: slip({ ...e, base }, m, o).brut }))
      const amount = sum(detail, (d) => d.neu - d.old)
      const v = (H.vars[e.id] = { ...(H.vars[e.id] || {}) })
      v.rappel = (v.rappel || 0) + amount; v.rappelInfo = `${months.length} mois (${months.map((m) => monthLabel(m).split(" ")[0]).join(", ")})`
      const old = e.base; e.base = base
      e.history.unshift({ date: today, type: "Augmentation rétroactive", detail: `${money(old)} → ${money(base)} effet ${monthLabel(from)}`, by })
      if (!cur().editors.includes(by)) cur().editors.push(by)
      H.regul.push({ date: today, why: `Rappel de salaire ${e.name} (${months.length} mois recalculés)`, to: monthLabel(p.month), amount, name: e.name, detail })
      say(`Rappel de ${money(amount)} reporté sur ${monthLabel(p.month)}`, touch(`rappel de ${e.name}`)); render()
    },
    repay(lid) {
      const l = H.loans.find((x) => x.id === lid), amt = l.remaining
      l.remaining = 0; l.early = today
      say(`${lid} soldé par remboursement anticipé de ${money(amt)}`, touch("remboursement anticipé")); render()
    },
    recon() {
      const p = cur(), S = slips(); p.recon = {}
      Object.values(S).forEach((s) => { const e = E(s.id); if (s.net > 0 && e.pay.ref && !e.payPending) p.recon[e.id] = e.id === "E13" ? "Rejeté : numéro mobile money inactif (simulé)" : "Rapproché" })
      toast("Relevés importés · paiements rapprochés automatiquement (simulé)"); render()
    },
    retryPay(id) { cur().recon[id] = "Rapproché (relance)"; toast(`Paiement de ${E(id).name} relancé et rapproché (simulé)`); render() },
    entStep(id) { const x = ENT(id); x.status = x.status === "Ouverte" ? "Calculée" : "Clôturée"; toast(`${x.name} : paie ${x.status.toLowerCase()} (${x.pack})`); render() },
    meLeave() {
      const e = E(ui.hrMe) || E("E09"), from = val("hr-mfrom"), to = val("hr-mto")
      if (!from || !to || to < from) return err("hr-merr", "Dates incorrectes.")
      if (workDays(from, to) > cpSolde(e)) return err("hr-merr", `Solde insuffisant : ${fj(cpSolde(e))}.`)
      H.leaves.push({ id: "L-" + String(H.leaves.length + 1).padStart(2, "0"), emp: e.id, type: "Congés payés", from, to, status: "Demandée", note: "Demande via l'app mobile" })
      toast("Demande envoyée au chef de service"); render()
    },
    meAttest(type) {
      const e = E(ui.hrMe) || E("E09")
      H.attSeq = (H.attSeq || 1) + 1
      H.attest.push({ id: "AT-" + String(H.attSeq).padStart(2, "0"), emp: e.id, type, date: today, status: "Générée" })
      toast(`${type} générée et déposée dans le coffre-fort (simulé)`); render()
    },
    mePay() {
      const e = E(ui.hrMe) || E("E09"), ref = val("hr-mref")
      if (!ref) return toast("Indiquez le nouveau compte")
      e.payPending = { mode: /mobile/i.test(ref) ? "Mobile Money" : "Virement", ref, on: today, src: "Demande via l'app mobile personnel" }
      audit(`Demande de changement de coordonnées (app mobile) pour ${e.name}`)
      say("Demande transmise aux RH · alerte anti-fraude émise (RG-HRM-07)", touch("coordonnées de paiement modifiées")); render()
    },
    showSal(id) { ui.hrShow = id; audit(`Affichage du salaire de ${E(id).name} (Responsable RH)`); render() },
    payRequest(id) {
      const ref = val("hr-pref")
      if (!ref) return toast("Indiquez le nouveau compte")
      E(id).payPending = { mode: val("hr-pmode"), ref, on: today, src: "Saisie RH" }
      audit(`Demande de changement de coordonnées de paiement pour ${E(id).name}`)
      say("Changement soumis à validation · alerte anti-fraude émise", touch("coordonnées de paiement modifiées")); render()
    },
    payValidate(id, ok) {
      const e = E(id)
      if (ok) e.pay = { mode: e.payPending.mode, ref: e.payPending.ref }
      delete e.payPending
      audit(`${ok ? "Validation" : "Refus"} du changement de coordonnées de ${e.name}`)
      toast(ok ? "Coordonnées validées" : "Changement refusé"); render()
    },
    amend(id) {
      const e = E(id), base = Number(val("hr-abase")), cat = val("hr-acat"), type = val("hr-atype"), date = val("hr-adate"), by = val("hr-aby"), [entId, prop] = val("hr-aprop").split("|")
      if (!(base > 0) || !date) return err("hr-aerr", "Indiquez la date d'effet et le salaire.")
      if (base < minFor(cat, e.hours)) return err("hr-aerr", `Salaire inférieur au minimum de la catégorie ${cat} (${money(minFor(cat, e.hours))}, paramètre daté) : refusé (RG-HRM-05).`)
      if (type === "Mutation" && prop === e.prop) return err("hr-aerr", "Choisissez un autre établissement pour une mutation.")
      const detail = [e.base !== base ? `${money(e.base)} → ${money(base)}` : "", e.cat !== cat ? `catégorie ${e.cat} → ${cat}` : "", type === "Passage en CDI" ? `${e.contract} → CDI` : "", type === "Mutation" ? `vers ${prop}${entId !== e.entity ? ` (${ENT(entId).name})` : ""}` : ""].filter(Boolean).join(" · ") || "sans changement de rémunération"
      if (type === "Mutation") {
        const inter = entId !== e.entity
        e.history.unshift({ date, type: inter ? "Mutation inter-entités" : "Mutation", detail, by }); e.prop = prop
        H.moves.unshift({ date, name: e.name, type: "Avenant", detail: `Mutation : ${detail}` })
        if (inter) {
          e.entity = entId; e.status = "muté"; e.base = base; e.cat = cat; e.access = "révoqué"
          accPush(e, "hrm.employee.terminated", `Mutation vers ${ENT(entId).name} : accès de l'établissement révoqués`)
          return say(`Mutation enregistrée · ${e.name} rejoint ${ENT(entId).name} (paie en ${ENT(entId).cur})`, touch(`mutation de ${e.name}`)), render()
        }
        const t0 = e.base !== base ? touch(`mutation de ${e.name}`) : ""
        e.base = base; e.cat = cat
        return say(`Mutation vers ${prop} enregistrée (même entité, même paie)`, t0), render()
      }
      e.history.unshift({ date, type, detail, by })
      H.moves.unshift({ date, name: e.name, type: "Avenant", detail: `${type} : ${detail}` })
      const t = e.base !== base ? touch(`avenant de ${e.name}`) : ""
      if (e.base !== base && !cur().editors.includes(by)) cur().editors.push(by)
      e.base = base; e.cat = cat
      if (type === "Passage en CDI") { e.contract = "CDI"; e.end = null }
      say(`Avenant enregistré (effet ${fd(date)})`, t); render()
    },
    renew(cid) { const c = H.certs.find((x) => x.id === cid); c.expires = addDays(today, 730); toast(`${c.type} renouvelée jusqu'au ${fd(c.expires)}/${c.expires.slice(0, 4)}`); render() },
    enroll(tid) {
      const t = H.trainings.find((x) => x.id === tid)
      const add = H.certs.filter((c) => c.type === t.type && (!certOk(c) || soon(c)) && !t.inscrits.includes(c.emp)).map((c) => c.emp).slice(0, t.places - t.inscrits.length)
      t.inscrits.push(...add); toast(add.length ? `${add.length} inscription(s)` : "Aucun employé à inscrire"); render()
    },
    hire() {
      const base = Number(val("hr-nbase")), cat = val("hr-ncat"), name = val("hr-nname"), ctr = val("hr-nctr"), hours = Number(val("hr-nhours")) || 40, start = val("hr-nstart"), end = val("hr-nend")
      if (!name) return err("hr-nerr", "Indiquez un nom.")
      if (!start) return err("hr-nerr", "Indiquez la date d'entrée.")
      if (TERM.includes(ctr) && (!end || end <= start)) return err("hr-nerr", `Un contrat ${ctr} exige une date de fin postérieure à l'entrée (EF-HRM-002).`)
      if (ctr === "Stage" && base < r0(PACK.smig * 0.3)) return err("hr-nerr", `Gratification de stage inférieure au minimum d'exemple (${money(r0(PACK.smig * 0.3))}).`)
      if (ctr !== "Stage" && base < minFor(cat, hours)) return err("hr-nerr", `Salaire inférieur au minimum de la catégorie ${cat} pour ${hours} h (${money(minFor(cat, hours))}) : refusé (RG-HRM-05).`)
      const id = "E" + String(H.emps.length + 1).padStart(2, "0"), dept = val("hr-ndept")
      const ne = emp(id, name, dept, val("hr-njob") || "Employé", cat, ctr, start, base, { end: ctr === "CDI" ? null : end, hours, transport: 25000, pay: { mode: "Mobile Money", ref: "" }, pts: ["FNB", "HEB", "HK"].includes(dept) ? 1 : 0, cpAcq: 0, cpPris: 0, noClock: false })
      H.emps.push(ne)
      H.plan[id] = "RRRRRRR"
      accPush(ne, "hrm.employee.hired", `Badge créé · profil par défaut « ${profileOf(ne)} »`)
      H.moves.unshift({ date: start, name, type: "Entrée", detail: `${ctr}${hours < 40 ? ` ${hours} h` : ""}${ctr !== "CDI" ? ` jusqu'au ${fd(end)}/${end.slice(0, 4)}` : ""} · profil d'accès « ${profileOf(ne)} » (ACC simulé) · prorata en paie` })
      const t = start <= monthEnd(cur().month) ? touch(`embauche de ${name}`) : ""
      say(`Dossier ${id} créé · hrm.employee.hired publié`, t); go("hr-personnel/dossiers/" + id)
    },
    stc() { ui.hrStc = { emp: val("hr-semp"), motif: val("hr-smot"), date: val("hr-sdate") || today }; render() },
    terminate() {
      const st = ui.hrStc, e = E(st.emp), { total } = stcCalc(st)
      e.status = "sorti"; e.end = st.date; st.done = true; e.access = "révoqué"
      st.revoked = [`Badge ${"B-H" + e.id.slice(1)} (${profileOf(e)})`, "Compte applicatif HMS et app mobile personnel", ...((D.acc && D.acc.passes || []).filter((x) => x.holder.startsWith(e.name) && x.status === "active").map((x) => x.type))]
      if (D.acc && D.acc.passes) D.acc.passes.filter((x) => x.holder.startsWith(e.name) && x.status === "active").forEach((x) => (x.status = "révoqué"))
      accPush(e, "hrm.employee.terminated", `Départ (${st.motif}) : ${st.revoked.length} accès révoqués`)
      H.loans.filter((l) => l.emp === e.id).forEach((l) => (l.remaining = 0))
      H.moves.unshift({ date: st.date, name: e.name, type: "Sortie", detail: `${st.motif} · solde ${money(total)} · accès révoqués (ACC simulé) · certificat de travail généré` })
      say(`Départ de ${e.name} enregistré · accès révoqués`, touch(`départ de ${e.name}`)); render()
    },
    cycle(id, i) {
      const c = H.plan[id].split(""); c[i] = ORDER[(ORDER.indexOf(c[i]) + 1) % ORDER.length]; H.plan[id] = c.join(""); H.planPublished = false; render()
    },
    publish() {
      const v = active().filter((e) => violations(e).length)
      if (v.length) return toast(`Publication bloquée : ${v.length} employé(s) hors règles (${v.map((e) => e.name).slice(0, 2).join(", ")}…)`)
      H.planPublished = true; toast("Planning publié · app mobile et plages d'accès ACC mises à jour (simulé)"); render()
    },
    optimize() { const o = optimize(); H.plan = o.plan; H.planPublished = false; toast(`${o.changes.length} modification(s) appliquée(s) — à relire avant publication`); render() },
    clockOk(id) { H.clocks.find((k) => k.id === id).ok = true; toast("Pointage validé"); render() },
    fixOut(id) { const k = H.clocks.find((x) => x.id === id), s = SH[cell(k.emp, WEEK.indexOf(k.date))]; k.out = s && s.h ? String(s.e % 24).padStart(2, "0") + ":00" : "17:00"; k.note = "corrigé"; toast("Sortie corrigée sur l'heure planifiée"); render() },
    clockIn() {
      const id = val("hr-cemp"), s = SH[cell(id, 3)]
      H.clocks.push({ id: uid("P"), emp: id, date: today, in: String(s.s).padStart(2, "0") + ":03", out: "", src: "Badge", ok: false })
      accPush(E(id), "hrm.shift.started", `Badge activé · ${profileOf(E(id))}`)
      toast(`Entrée pointée · hrm.shift.started → badge de ${E(id).name} actif (simulé)`); render()
    },
    clockOut(id) {
      const k = H.clocks.find((x) => x.id === id), e = E(k.emp), s = SH[cell(k.emp, WEEK.indexOf(k.date))]
      k.out = s && s.h ? String(s.e % 24).padStart(2, "0") + ":04" : now()
      accPush(e, "hrm.shift.ended", permanent(e) ? "Profil permanent : badge maintenu (RG-HRM-02)" : "Badge suspendu hors poste (marge 30 min)")
      toast(`Sortie pointée · hrm.shift.ended → ${permanent(e) ? "badge maintenu (profil permanent)" : "badge de " + e.name + " suspendu"} (simulé)`); render()
    },
    setProfile(i) {
      const job = jobsList()[i].job, v = val("hr-jp" + i)
      H.jobProfile[job] = v
      active().filter((e) => e.job === job).forEach((e) => accPush(e, "hrm.access.profile.changed", `Profil « ${v} » appliqué au poste ${job}`))
      toast(`Profil d'accès du poste ${job} mis à jour · ACC synchronisé (simulé)`); render()
    },
    leave(id, ok) {
      const l = H.leaves.find((x) => x.id === id), e = E(l.emp)
      if (!ok) { l.status = "Refusée"; toast(`Demande ${id} refusée`); return render() }
      if (l.status === "Demandée") { l.status = "Validée chef"; toast("Validée par le chef de service · en attente RH"); return render() }
      if (l.type === "Congés payés" && workDays(l.from, l.to) > cpSolde(e)) return toast(`Solde insuffisant : ${fj(cpSolde(e))} disponibles pour ${workDays(l.from, l.to)} demandés`)
      l.status = "Validée"
      const t = l.from <= monthEnd(cur().month) && l.to >= cur().month + "-01" ? touch(`absence de ${e.name} validée`) : ""
      say(`Demande ${id} validée${WEEK.some((d) => l.from <= d && d <= l.to) ? " · planning mis à jour" : ""}`, t); render()
    },
    leaveNew() {
      const from = val("hr-lfrom"), to = val("hr-lto"), id = val("hr-lemp"), type = val("hr-ltype")
      if (!from || !to || to < from) return err("hr-lerr", "Dates incorrectes.")
      if (type === "Congés payés" && workDays(from, to) > cpSolde(E(id))) return err("hr-lerr", `Solde insuffisant : ${fj(cpSolde(E(id)))} disponibles.`)
      H.leaves.push({ id: "L-" + String(H.leaves.length + 1).padStart(2, "0"), emp: id, type, from, to, status: "Demandée" })
      ui.hrLeave = "attente"; toast("Demande enregistrée · notification au chef de service"); render()
    },
    forecastMode() { ui.hrForecast = ui.hrForecast === "ia" ? "ratios" : "ia"; render() },
    collect() {
      const p = cur(), pend = H.clocks.filter((k) => !k.ok && k.date < today).length
      H.tronc.integrated = true; p.step = 2; p.stale = ""
      toast(`Variables collectées · pourboires intégrés${pend ? ` · ${pend} pointage(s) non validé(s) repris tels quels` : ""}`); render()
    },
    calc() {
      const p = cur(), t0 = performance.now(), S = calcAll()
      p.calc = { slips: S, at: now(), version: PACK.version }; p.step = 3
      toast(`${Object.keys(S).length} bulletins calculés en ${Math.max(1, Math.round(performance.now() - t0))} ms · hrm.payroll.calculated`); render()
    },
    control() {
      const n = openAno().length
      if (n) { toast(`${n} anomalie(s) ouverte(s) : à corriger ou justifier`); return go("hr-paie/controle") }
      cur().step = 4; toast("Contrôle terminé"); render()
    },
    justify(key) { H.anoState[key] = "Justifiée"; toast("Anomalie justifiée (trace conservée)"); render() },
    validate() {
      const p = cur(), v1 = val("hr-v1"), v2 = val("hr-v2")
      if (v1 === v2) return toast("Double validation : deux personnes distinctes sont requises (RG-HRM-04)")
      const bad = [v1, v2].find((v) => p.editors.includes(v))
      if (bad) return toast(`${USERS[bad]} a modifié un salaire ce mois : validation refusée (RG-HRM-04)`)
      p.validated = { v1, v2 }; p.step = 5; toast("Paie validée"); render()
    },
    pay() {
      const p = cur(), v1 = val("hr-pv1"), v2 = val("hr-pv2")
      if (v1 === v2) return toast("Deux validateurs distincts sont requis")
      const bad = [v1, v2].find((v) => p.editors.includes(v))
      if (bad) return toast(`${USERS[bad]} a modifié un salaire : ne peut pas valider le paiement (RG-HRM-04)`)
      p.paid = { v1, v2 }; if (p.step === 5) p.step = 6
      toast("Fichiers transmis · hrm.payroll.paid (simulé)"); render()
    },
    journal() { const p = cur(); p.journal = today; p.step = 7; toast("Écritures de paie générées dans FIN (simulé) · équilibre contrôlé"); render() },
    decl(k) {
      const p = cur(); if (p.step < 5) return toast("Validez d'abord la paie")
      p.decl[k] = "Fichier généré"; if (p.step === 7 && ["CNPS", "ITS", "FDFP"].every((x) => p.decl[x])) p.step = 8
      toast(`Fichier ${k} généré (simulé)`); render()
    },
    declSend(k) { cur().decl[k] = "Télédéclarée"; toast(`${k} télédéclarée (simulé)`); render() },
    declAll() { ["CNPS", "ITS", "FDFP"].forEach((k) => (cur().decl[k] = cur().decl[k] || "Fichier généré")); cur().step = 8; toast("Déclarations CNPS, ITS et FDFP générées (simulé)"); render() },
    disa() { H.disa = fd(today); toast("Brouillon DISA généré (simulé)"); render() },
    close() {
      const p = cur()
      Object.values(p.calc.slips).forEach((s) => { let left = s.loanApp; H.loans.filter((l) => l.emp === s.id && l.remaining > 0).forEach((l) => { const x = Math.min(left, l.monthly, l.remaining); l.remaining -= x; left -= x }) })
      p.closed = today; p.step = 9
      toast("Paie clôturée · bulletins publiés dans l'app (simulé) · hrm.payroll.closed"); render()
    },
    openNext() {
      const p = cur(), t = totals(p.calc.slips)
      H.history.push({ month: p.month, brut: t.brut, cost: t.cost, delay: 0, errors: 0 })
      Object.values(p.calc.slips).forEach((s) => (E(s.id).prevNet = s.net))
      H.period = newPeriod(nextMonth(p.month)); H.tronc.integrated = false; H.anoState = {}
      toast(`Période ${monthLabel(H.period.month)} ouverte · éléments permanents et échéances repris`); render()
    },
    prime() {
      const id = val("hr-vemp"), v = Number(val("hr-vamt")) || 0
      H.vars[id] = { ...(H.vars[id] || {}), prime: v }
      say(`Prime de ${money(v)} enregistrée pour ${E(id).name}`, touch("prime saisie")); render()
    },
    pool() { H.tronc.pool = Math.max(0, Number(val("hr-pool")) || 0); say("Montant du tronc mis à jour", H.tronc.integrated ? touch("tronc modifié") : ""); render() },
    troncIn() { H.tronc.integrated = true; say("Pourboires intégrés aux variables de paie", touch("pourboires intégrés")); render() },
    loan() {
      const typ = val("hr-lntype"), id = val("hr-lnemp"), amt = Number(val("hr-lnamt")), n = typ.startsWith("Acompte") ? 1 : Math.max(1, Number(val("hr-lnn")) || 1), monthly = Math.ceil(amt / n)
      if (cur().closed) return err("hr-lnerr", "Période clôturée : ouvrez la période suivante avant d'accorder une retenue.")
      if (!(amt > 0)) return err("hr-lnerr", "Indiquez un montant.")
      const s = slip(E(id)), quot = Math.floor((s.net + s.loanApp + s.consoApp) * PACK.quotite) - s.loanApp
      if (monthly > quot) return err("hr-lnerr", `Échéance ${money(monthly)} supérieure à la quotité disponible (${money(Math.max(0, quot))}) : allongez la durée.`)
      const lid = (typ === "Prêt" ? "PR-" : typ.startsWith("Acompte") ? "AC-" : "AV-") + String(H.loans.length + 1).padStart(2, "0")
      H.loans.push({ id: lid, emp: id, type: typ, amount: amt, monthly, remaining: amt, start: cur().month })
      ui.hrLoan = lid; say(`${lid} accordé · ${n} échéance(s) de ${money(monthly)}`, touch("nouvelle retenue")); render()
    },
    replay() {
      const a = calcAll(), b = calcAll(), same = Object.keys(a).filter((k) => JSON.stringify(a[k]) === JSON.stringify(b[k])).length
      ui.hrRef = `${same}/${Object.keys(a).length} bulletins identiques au centime près · ${PACK.version} · ${now()}`; render()
    },
    simulate() {
      const base = Number(val("hr-sbase")), cat = val("hr-scat")
      const s = { base, cat, transport: Number(val("hr-strans")) || 0, logement: Number(val("hr-slog")) || 0, parts: Number(val("hr-sparts")), start: val("hr-sstart") || today }
      if (base < Math.max(CATS[cat], PACK.smig)) { ui.hrSim = s; render(); return err("hr-serr", `Inférieur au minimum de la catégorie ${cat} (${money(CATS[cat])}) : embauche impossible à ce salaire (RG-HRM-05).`) }
      s.res = slip(emp("SIM", "Simulation", "HK", "Simulation", cat, "CDI", s.start < cur().month + "-01" ? s.start : "2020-01-01", base, { transport: s.transport, logement: s.logement, parts: s.parts }), cur().month, { vars: {}, noTronc: true, noAbs: true, noLoans: true })
      ui.hrSim = s; render()
    },
  }

  HMS.module({
    code: "hrm", group: "Personnel", title: "Ressources humaines et paie", phase: "", spec: "§5 HRM",
    screens: [
      { id: "hr-personnel", label: "Personnel", view: views["hr-personnel"] },
      { id: "hr-temps", label: "Plannings et temps", view: views["hr-temps"] },
      { id: "hr-paie", label: "Paie", view: views["hr-paie"] },
      { id: "hr-bulletin", hidden: true, navAs: "hr-paie", view: views["hr-bulletin"] },
      { id: "hr-portail", label: "Portail employé (app)", view: views["hr-portail"], spec: "EF-HRM-028" },
      { id: "hr-declarations", label: "Déclarations sociales", view: views["hr-declarations"] },
      { id: "hr-pilotage", label: "Pilotage RH", view: views["hr-pilotage"] },
    ],
    actions,
  })
})()
