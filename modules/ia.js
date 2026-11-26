// modules/ia.js — Spec §19 Plateforme IA et services d'intelligence (AIP)
// Revenue management, prévisions, copilote du personnel, concierge client, anomalies, maintenance prédictive,
// catalogue des modèles et gouvernance. Tout est simulé : aucun appel réseau, aucun LLM réel.
;(() => {
  const rnd = (i) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x) }
  const sellable = () => D.rooms.filter((r) => r.hk !== "hs").length
  const otb = (d) => D.reservations.filter((r) => ["confirmee", "arrivee"].includes(r.status) && r.from <= d && d < r.to).length
  const BOUNDS = { STD: [35000, 60000], SUP: [48000, 80000], SUI: [90000, 150000] }
  const MAXVAR = 0.2 // variation maximale sans validation du directeur

  // ---------- Données d'exemple ----------
  D.aip = {
    rmMode: "conseil",
    recos: [
      { id: "RC-301", type: "SUI", from: today, to: addDays(today, 1), current: 110000, proposed: 120000, status: "proposee",
        factors: [["Arrivée VIP et suite unique restante", 0.42], ["Pick-up 7 jours : +2 nuitées", 0.27], ["Concurrents : +6 % (données simulées)", 0.18]] },
      { id: "RC-302", type: "SUP", from: addDays(today, 1), to: addDays(today, 3), current: 60000, proposed: 66000, status: "proposee",
        factors: [["Salon professionnel à Abidjan (événement local d'exemple)", 0.48], ["Prévision d'occupation 85 %", 0.31], ["Concurrents : +8 % (simulé)", 0.12]] },
      { id: "RC-303", type: "STD", from: addDays(today, 5), to: addDays(today, 8), current: 45000, proposed: 41000, status: "proposee",
        factors: [["Prévision d'occupation 46 %", 0.44], ["Pick-up faible sur 14 jours", 0.29], ["Concurrents : −5 % (simulé)", 0.15]] },
      { id: "RC-304", type: "SUP", from: addDays(today, 9), to: addDays(today, 11), current: 60000, proposed: 78000, status: "proposee",
        factors: [["Conférence régionale (exemple) : forte demande", 0.55], ["Historique N-1 : complet", 0.25], ["Saisonnalité fin d'année", 0.11]] },
      { id: "RC-298", type: "STD", from: addDays(today, -3), to: addDays(today, -1), current: 45000, proposed: 48000, status: "acceptee", by: "Kouadio Brou",
        factors: [["Prévision d'occupation 88 %", 0.5]] },
      { id: "RC-297", type: "SUP", from: addDays(today, -6), to: addDays(today, -4), current: 60000, proposed: 52000, status: "refusee", by: "Kouadio Brou",
        factors: [["Pick-up faible", 0.4]] },
    ],
    relances: {},
    role: "dir",
    chat: [],
    convs: [
      { id: "CV-81", channel: "WhatsApp", lang: "Anglais", guest: "G7", room: "302", at: "25/11 23:04", status: "resolue", escal: false, rating: 5,
        msgs: [["ia", "Hello, I am the virtual concierge of Hôtel Exemple (AI assistant). You can ask for a staff member at any time."],
          ["client", "Hi, could I get two extra towels and a wake-up call at 6 am please?"],
          ["ia", "Of course. I can create a housekeeping request for 2 towels to room 302 and schedule a wake-up call at 6:00. Shall I confirm?"],
          ["client", "Yes please"], ["ia", "Done: towels on their way (about 15 min) and wake-up call set for 6:00. Good night!"]],
        tools: [{ label: "Demande housekeeping : 2 serviettes — ch. 302", status: "confirmee" }, { label: "Réveil programmé 27/11 à 06:00 — ch. 302", status: "confirmee" }], sources: ["Catalogue des services v5"] },
      { id: "CV-82", channel: "App client", lang: "Français", guest: "G6", room: "202", at: "26/11 01:12", status: "escaladee", escal: true, reason: "Réclamation détectée", rating: null,
        msgs: [["ia", "Bonjour, je suis le concierge virtuel de l'hôtel (assistant IA). Vous pouvez demander un membre du personnel à tout moment."],
          ["client", "La climatisation fait un bruit énorme, impossible de dormir."],
          ["ia", "Je suis désolé. Je transmets votre réclamation à la réception, qui vous recontacte immédiatement."]],
        tools: [{ label: "Escalade vers la réception de nuit (réclamation)", status: "confirmee" }], sources: [] },
      { id: "CV-83", channel: "Web", lang: "Français", guest: null, room: null, at: "26/11 08:40", status: "resolue", escal: false, rating: 4,
        msgs: [["ia", "Bonjour, je suis le concierge virtuel de l'hôtel (assistant IA)."], ["client", "À quelle heure est servi le petit-déjeuner ? La piscine est-elle ouverte le soir ?"],
          ["ia", "Le petit-déjeuner est servi de 6 h 30 à 10 h 30. La piscine est ouverte de 7 h à 20 h."]],
        tools: [], sources: ["FAQ établissement v3", "Horaires spa et piscine"] },
      { id: "CV-84", channel: "SMS", lang: "Français", guest: "G2", room: null, at: "26/11 09:55", status: "encours", escal: false, rating: null,
        msgs: [["ia", "Bonjour, je suis le concierge virtuel de l'hôtel (assistant IA). Répondez HUMAIN pour joindre la réception."],
          ["client", "Je voudrais réserver un massage demain vers 15 h."],
          ["ia", "Un créneau « Massage relaxant 60 min » est libre le 27/11 à 15 h (35 000 FCFA, imputé sur votre séjour). Je confirme la réservation ?"]],
        tools: [{ label: "Réserver un soin spa — 27/11 15:00, massage 60 min", status: "attente" }], sources: ["Carte des soins spa"] },
      { id: "CV-85", channel: "WhatsApp", lang: "Anglais", guest: "G5", room: "101", at: "26/11 07:20", status: "resolue", escal: true, reason: "Confiance faible", rating: 4,
        msgs: [["ia", "Hello, I am the virtual concierge (AI assistant)."], ["client", "I need an invoice in my company's name with our tax number."],
          ["ia", "I will pass you to a receptionist who can edit your invoice details."], ["humain", "Good morning, this is the front desk. Please send me the company name and tax number, I will update your invoice."]],
        tools: [], sources: [] },
    ],
    knowledge: [
      { id: "KD-1", title: "FAQ établissement v3", src: "Saisie manuelle", chunks: 42, at: addDays(today, -12) },
      { id: "KD-2", title: "Horaires spa et piscine", src: "Module Spa", chunks: 8, at: addDays(today, -3) },
      { id: "KD-3", title: "Carte des soins spa", src: "Module Spa", chunks: 15, at: addDays(today, -3) },
      { id: "KD-4", title: "Menus restaurant et room service", src: "Module Restauration", chunks: 27, at: addDays(today, -1) },
      { id: "KD-5", title: "Catalogue des services v5", src: "Saisie manuelle", chunks: 19, at: addDays(today, -20) },
      { id: "KD-6", title: "Procédure objets trouvés", src: "Procédures internes", chunks: 6, at: addDays(today, -45) },
    ],
    anomalies: [
      { id: "AN-41", module: "FOL", title: "Remboursement de 85 000 FCFA sur un folio clôturé sans facture d'origine", who: "Serge Gnagne (réception de nuit)", at: "26/11 02:14", score: 0.91, status: "nouvelle",
        reasons: ["Opération hors horaires habituels de l'utilisateur", "Montant 6 × supérieur à la moyenne des remboursements", "Aucune facture d'origine liée"] },
      { id: "AN-42", module: "ACC", title: "6 badges refusés en 3 minutes sur la porte de la chambre 304", who: "Carte K-7781", at: "26/11 03:40", score: 0.97, status: "bloquee",
        reasons: ["Seuil critique paramétré : 5 refus en 5 min", "Chambre inoccupée", "Carte émise pour une autre chambre"] },
      { id: "AN-43", module: "PLT", title: "Connexion depuis un nouvel appareil et un pays inhabituel", who: "Nadège Ahoua (comptabilité)", at: "26/11 06:05", score: 0.74, status: "nouvelle",
        reasons: ["Appareil jamais vu", "Géolocalisation IP inhabituelle (simulée)", "Connexion 2 h avant le début du service"] },
      { id: "AN-44", module: "FOL", title: "3 tickets restaurant annulés après encaissement par le même caissier", who: "Lassina Fofana (caisse restaurant)", at: "25/11 21:30", score: 0.66, status: "analyse",
        reasons: ["Taux d'annulation 4 × la moyenne du point de vente", "Annulations en fin de service"] },
      { id: "AN-45", module: "PRC", title: "Facture de Ets Kouassi & Fils (exemple) en double (même montant, même date)", who: "Ets Kouassi & Fils (exemple)", at: "25/11 15:12", score: 0.88, status: "nouvelle",
        reasons: ["Même montant 412 000 FCFA", "Même date de facture", "Numéros de facture voisins"] },
      { id: "AN-39", module: "ACC", title: "Porte de service ouverte 12 minutes", who: "Porte cuisine", at: "24/11 22:10", score: 0.58, status: "faux",
        reasons: ["Durée d'ouverture inhabituelle"] },
    ],
    equipment: [
      { id: "EQ-1", name: "Climatisation ch. 202", zone: "Chambres", risk: 0.68, horizon: "7 jours", signals: ["Vibrations du compresseur +35 %", "Consommation électrique +18 %", "Réclamation bruit (conversation CV-82)"], action: "Contrôle du compresseur et des fixations", status: "proposee" },
      { id: "EQ-2", name: "Chambre froide cuisine", zone: "Restauration", risk: 0.54, horizon: "14 jours", signals: ["Température moyenne +1,4 °C sur 5 jours", "Cycles de dégivrage plus longs"], action: "Vérifier le joint de porte et le gaz", status: "proposee" },
      { id: "EQ-3", name: "Groupe électrogène", zone: "Technique", risk: 0.31, horizon: "30 jours", signals: ["Temps de démarrage +2 s", "Dernière vidange il y a 410 h"], action: "Vidange et test de charge", status: "proposee" },
      { id: "EQ-4", name: "Pompe de la piscine", zone: "Loisirs", risk: 0.22, horizon: "30 jours", signals: ["Pression stable", "Bruit légèrement en hausse"], action: "Surveillance", status: "proposee" },
      { id: "EQ-5", name: "Climatisation ch. 204", zone: "Chambres", risk: 1, horizon: "Panne en cours", signals: ["Panne survenue — signal précurseur détecté 4 jours avant (non traité)"], action: "Réparation en cours (chambre hors service)", status: "ot" },
    ],
    staffing: [
      { service: "Housekeeping", slot: "Demain 8 h – 15 h", need: 3, planned: 2, factors: "9 départs, 6 recouches prévus" },
      { service: "Restaurant", slot: "Demain midi", need: 4, planned: 3, factors: "Séminaire de 25 couverts (exemple)" },
      { service: "Réception", slot: "Demain 7 h – 15 h", need: 2, planned: 2, factors: "8 arrivées, 9 départs" },
      { service: "Réception", slot: "Nuit 23 h – 7 h", need: 1, planned: 1, factors: "Ratio standard" },
    ],
    staffingValidated: false,
    useCases: [
      { code: "rm.pricing", label: "Tarification dynamique", module: "RAT", model: "M-DEM v3.2", modes: ["desactive", "conseil", "auto"], mode: "conseil", budget: 30000, used: 12400 },
      { code: "res.noshow", label: "Prédiction no-show / annulation", module: "RES", model: "M-NSH v2.1", modes: ["desactive", "conseil"], mode: "conseil", budget: 10000, used: 3100 },
      { code: "crm.nbo", label: "Offres personnalisées", module: "CRM / MOB", model: "M-NBO v1.4", modes: ["desactive", "conseil", "auto"], mode: "auto", budget: 15000, used: 6900 },
      { code: "concierge", label: "Concierge client", module: "MOB / FOF", model: "LLM A (passerelle) + RAG", modes: ["desactive", "conseil", "auto"], mode: "auto", budget: 90000, used: 71200 },
      { code: "copilote", label: "Copilote du personnel", module: "Back-office", model: "LLM A (passerelle)", modes: ["desactive", "conseil"], mode: "conseil", budget: 50000, used: 31800 },
      { code: "fraude", label: "Fraude et anomalies", module: "FOL / ACC / PLT", model: "M-ANO v1.1", modes: ["desactive", "conseil"], mode: "conseil", budget: 15000, used: 8800 },
      { code: "maint", label: "Maintenance prédictive", module: "HKM", model: "M-SRV v0.9", modes: ["desactive", "conseil"], mode: "conseil", budget: 10000, used: 2600 },
      { code: "sentiment", label: "Analyse de sentiment", module: "CRM / BIR", model: "M-SEN v2.0", modes: ["desactive", "conseil"], mode: "conseil", budget: 20000, used: 9400 },
      { code: "effectifs", label: "Planification des effectifs", module: "HRM", model: "M-DEM v3.2 + optimiseur", modes: ["desactive", "conseil"], mode: "desactive", budget: 10000, used: 0 },
    ],
    models: [
      { id: "M-DEM", name: "Prévision de demande", type: "Séries temporelles + gradient boosting", version: "3.2", metric: "MAPE 8,4 %", evalAt: addDays(today, -6), status: "production", scope: "Tenant" },
      { id: "M-NSH", name: "No-show et annulation", type: "Classification (gradient boosting)", version: "2.1", metric: "AUC 0,81", evalAt: addDays(today, -8), status: "production", scope: "Tenant" },
      { id: "M-NBO", name: "Next-best-offer", type: "Recommandation + règles", version: "1.4", metric: "Conversion 6,2 %", evalAt: addDays(today, -4), status: "canari 10 %", scope: "Tenant" },
      { id: "M-ANO", name: "Détection d'anomalies", type: "Non supervisé + règles expertes", version: "1.1", metric: "Précision 72 %", evalAt: addDays(today, -15), status: "production", scope: "Tenant" },
      { id: "M-SEN", name: "Sentiment multilingue", type: "Classification par thème", version: "2.0", metric: "F1 0,86", evalAt: addDays(today, -30), status: "production", scope: "Mutualisé (anonymisé, accord)" },
      { id: "M-SRV", name: "Maintenance prédictive", type: "Survie + anomalies IoT", version: "0.9", metric: "Rappel 64 %", evalAt: addDays(today, -2), status: "validation", scope: "Tenant" },
    ],
    gateway: [
      { name: "Fournisseur LLM A (simulé)", role: "Principal", state: "Disponible", latency: "1,4 s" },
      { name: "Fournisseur LLM B (simulé)", role: "Bascule automatique", state: "Disponible", latency: "1,9 s" },
      { name: "Modèle interne léger (simulé)", role: "Dégradé au-delà du budget", state: "Disponible", latency: "0,6 s" },
    ],
    prompts: [
      { code: "concierge.system", versions: [["v5", 0.88], ["v6", 0.91], ["v7", 0.94]], active: "v7" },
      { code: "copilote.query", versions: [["v3", 0.86], ["v4", 0.9]], active: "v4" },
      { code: "avis.reponse", versions: [["v2", 0.82], ["v3", 0.87]], active: "v3" },
    ],
    guards: { pii: 214, injection: 3, content: 1, actions: 2 },
    budget: 250000,
    capPolicy: "degrader", // au-delà du plafond : dégrader vers le modèle interne léger, ou bloquer (EF-AIP-012)
    // Feature store (EF-AIP-003) : fraîcheur en minutes, objectif de fraîcheur (sla)
    features: [
      { id: "F-OCC7", name: "occupation_prevue_j7", entity: "Établissement × date", src: "Lakehouse (réservations)", online: true, offline: true, fresh: 12, sla: 60, used: ["M-DEM"] },
      { id: "F-PICK", name: "pickup_7_jours", entity: "Établissement × date", src: "Événements res.reservation.*", online: true, offline: true, fresh: 4, sla: 15, used: ["M-DEM"] },
      { id: "F-STAY", name: "nb_sejours_precedents", entity: "Client", src: "Lakehouse (séjours)", online: true, offline: true, fresh: 600, sla: 1440, used: ["M-NSH", "M-NBO"] },
      { id: "F-GUAR", name: "type_garantie", entity: "Réservation", src: "Événement res.reservation.created", online: true, offline: false, fresh: 2, sla: 15, used: ["M-NSH"] },
      { id: "F-VIB", name: "vibration_compresseur_moy_24h", entity: "Équipement", src: "Capteurs IoT (simulé)", online: true, offline: true, fresh: 95, sla: 30, used: ["M-SRV"] },
      { id: "F-RFD", name: "remboursement_vs_moyenne", entity: "Utilisateur", src: "Événement fol.refund.issued", online: true, offline: true, fresh: 6, sla: 15, used: ["M-ANO"] },
    ],
    // Pipeline MLOps (EF-AIP-004) : entraîné → validé → canari → production, ou rejeté
    runs: [
      { id: "RUN-12", model: "M-SRV", version: "1.0", stage: "entraine", score: 0.71, base: 0.64, unit: "Rappel", scope: "Tenant", data: "IoT 90 jours + ordres de travail", at: addDays(today, -1) },
      { id: "RUN-11", model: "M-NSH", version: "2.2", stage: "rejete", score: 0.79, base: 0.81, unit: "AUC", scope: "Tenant", data: "Réservations 24 mois", at: addDays(today, -9), why: "Régression : AUC 0,79 < 0,81 en production" },
    ],
    runSeq: 13,
    consent: false, // accord du tenant pour l'entraînement mutualisé anonymisé (RG-AIP-01)
    roomNights: 236, // nuitées du mois (exemple)
    log: [
      { at: "26/11 09:55", uc: "concierge", model: "LLM A", pv: "v7", cost: 38, ms: 1850, result: "Proposition de réservation spa", decision: "En attente client", user: "Client (SMS)", fb: null },
      { at: "26/11 08:40", uc: "concierge", model: "LLM A", pv: "v7", cost: 24, ms: 1420, result: "Réponse FAQ (2 sources)", decision: "—", user: "Visiteur web", fb: "utile" },
      { at: "26/11 06:00", uc: "rm.pricing", model: "M-DEM 3.2", pv: "—", cost: 4, ms: 140, result: "4 recommandations de prix", decision: "À valider", user: "Batch nocturne", fb: null },
      { at: "26/11 03:40", uc: "fraude", model: "M-ANO 1.1", pv: "—", cost: 1, ms: 60, result: "Seuil critique : carte K-7781 suspendue", decision: "Blocage auto borné", user: "Système", fb: null },
      { at: "26/11 01:12", uc: "concierge", model: "LLM A", pv: "v7", cost: 19, ms: 1300, result: "Réclamation détectée, escalade", decision: "Escaladé", user: "Client (app)", fb: null },
      { at: "25/11 18:22", uc: "copilote", model: "LLM A", pv: "v4", cost: 52, ms: 2400, result: "Brouillon de réponse à un avis", decision: "Envoyé après relecture", user: "Kouadio Brou", fb: "utile" },
    ],
  }
  const X = D.aip
  ui.aipConv = ui.aipConv || "CV-82"

  const now = () => "26/11 " + new Date().toTimeString().slice(0, 5)
  const UC = (c) => X.useCases.find((u) => u.code === c)
  const logIt = (uc, model, result, decision, cost = 2, ms = 150, pv = "—") => {
    const u = UC(uc); if (u) u.used += cost
    X.log.unshift({ at: now(), uc, model, pv, cost, ms, result, decision, user: X.role === "dir" ? "Kouadio Brou" : "Aya Koffi", fb: null })
  }
  // Plafonds de coût par tenant et par cas d'usage (EF-AIP-012) : ok, dégradé (modèle interne léger) ou bloqué
  const capState = (code) => {
    const u = UC(code), over = spent() >= X.budget ? "tenant" : u && u.used >= u.budget ? "cas d'usage" : null
    if (!over) return { ok: true, degraded: false }
    return X.capPolicy === "bloquer" ? { ok: false, why: `plafond ${over} atteint` } : { ok: true, degraded: true, why: `plafond ${over} atteint` }
  }
  const MODE = { desactive: "Désactivé", conseil: "Conseil (validation humaine)", auto: "Automatique borné" }
  const st = (label, value, hint, icon = "brain", extra = {}) => stat({ label, value: String(value), hint, icon, ...extra })
  const pctTxt = (n) => Math.round(n * 100) + " %"
  const disabledNote = (c) => UC(c).mode === "desactive"
    ? `<div class="err" style="margin-bottom:14px">Fonction IA désactivée pour cet établissement : repli non-IA actif (${esc(FALLBACK[c])}). Réactivation dans « Modèles et gouvernance ».</div>` : ""
  const FALLBACK = { "rm.pricing": "dernier prix validé et règles saisonnières", "res.noshow": "taux historiques par segment", concierge: "message de transfert vers la réception", copilote: "rapports standards", fraude: "règles statiques", maint: "maintenance calendaire", effectifs: "ratios standards", "crm.nbo": "offres standard par segment", sentiment: "notes brutes" }

  // ---------- Calculs ----------
  const forecast = () => Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i), n = sellable(), o = Math.min(n, otb(d))
    const dow = day(d).getDay(), weekday = dow >= 1 && dow <= 4
    const pickup = Math.round((n - o) * (i < 3 ? 0.35 : 0.55) * (weekday ? 1 : 0.7) * (0.8 + rnd(i) * 0.4))
    const fc = Math.min(n, o + pickup)
    const ly = Math.min(n, Math.round(n * (weekday ? 0.72 : 0.58) + rnd(i + 20) * 3 - 1))
    return { d, otb: o, fc, occ: (fc / n) * 100, ly: (ly / n) * 100, low: Math.max(o, fc - 1), high: Math.min(n, fc + 1) }
  })
  const recoVar = (r) => (r.proposed - r.current) / r.current
  const recoIssues = (r) => {
    const [lo, hi] = BOUNDS[r.type], out = []
    if (r.proposed < lo || r.proposed > hi) out.push(`hors bornes ${money(lo)} – ${money(hi)}`)
    if (Math.abs(recoVar(r)) > MAXVAR) out.push(`variation ${pct(recoVar(r) * 100)} > ${MAXVAR * 100} %`)
    return out
  }
  const noshow = (r) => {
    const lead = nights(today, r.from), f = []
    let s = 6
    if (r.guarantee === "Aucune") { s += 28; f.push("Aucune garantie") } else if (r.guarantee === "Acompte") { s += 4; f.push("Acompte versé (réduit le risque)") } else f.push("Garantie carte (réduit le risque)")
    if (lead <= 1) { s += 6; f.push("Arrivée imminente sans pré-check-in") }
    const prev = D.reservations.filter((x) => x.guest === r.guest && x.status === "partie").length
    if (prev) { s -= 4; f.push(`${prev} séjour(s) déjà effectué(s)`) } else { s += 8; f.push("Premier séjour") }
    if (nights(r.from, r.to) === 1) { s += 5; f.push("Séjour d'une nuit") }
    return { score: Math.max(2, Math.min(90, s)), factors: f }
  }
  const acceptRate = () => { const d = X.recos.filter((r) => r.status !== "proposee"); return d.length ? d.filter((r) => r.status === "acceptee").length / d.length : 0 }
  const concierge = () => { const t = X.convs.length, ok = X.convs.filter((c) => c.status === "resolue" && !c.escal).length, rated = X.convs.filter((c) => c.rating)
    return { rate: ok / t, sat: rated.reduce((s, c) => s + c.rating, 0) / (rated.length || 1) } }
  const spent = () => X.useCases.reduce((s, u) => s + u.used, 0)

  // ---------- Écrans ----------
  const views = {
    rm(p) {
      const tab = p[0] || "recommandations"
      return pageHead("Revenue management", "Prévision d'occupation et recommandations de prix proposées par le modèle de demande. Chiffres d'exemple, modèle simulé.",
        `<span class="muted">Mode</span>${select("aip-rmmode", [["conseil", "Conseil"], ["auto", "Automatique borné"]], X.rmMode, `onchange="A.aip.setRmMode(this.value)" style="width:auto"`)}`)
        + subtabs("aip-rm", [["recommandations", "Recommandations de prix"], ["prevision", "Prévision d'occupation"], ["noshow", "No-show et annulations"]], tab)
        + ({ recommandations: rmRecos, prevision: rmForecast, noshow: rmNoshow }[tab] || rmRecos)()
    },
    ia(p) {
      const tab = p[0] || "synthese"
      return pageHead("Services IA", "Couche IA partagée par tous les modules : copilote, concierge, détection d'anomalies, maintenance prédictive et gouvernance des modèles. Tout est simulé.")
        + subtabs("aip-ia", [["synthese", "Synthèse"], ["copilote", "Copilote"], ["concierge", "Concierge client"], ["anomalies", "Fraude et anomalies"], ["predictif", "Prédictif"], ["modeles", "Modèles et gouvernance"], ["mlops", "Données et MLOps"], ["journal", "Journal des décisions"]], tab)
        + ({ synthese, copilote, concierge: conciergeTab, anomalies, predictif, modeles, mlops, journal }[tab] || synthese)(p)
    },
  }

  function rmRecos() {
    const pend = X.recos.filter((r) => r.status === "proposee")
    const done = X.recos.filter((r) => r.status !== "proposee")
    const f = forecast(), acc = done.filter((r) => r.status === "acceptee").length
    return disabledNote("rm.pricing") + `<div class="grid g4">
        ${st("Recommandations à traiter", pend.length, "proposées ce matin", "tag")}
        ${st("Taux d'acceptation", pctTxt(acceptRate()), "acceptées / traitées", "check")}
        ${st("Précision de la prévision", "MAPE 8,4 %", "modèle M-DEM v3.2 (exemple)", "chart", { trend: [11.2, 10.4, 9.8, 9.1, 8.7, 8.4] })}
        ${st("RevPAR vs concurrents", "+4,1 %", "ensemble concurrentiel simulé", "trend", { delta: 4.1 })}
      </div>
      <div class="dash" style="margin-top:16px">
        <div class="w8">${section("Occupation prévue et portefeuille — 14 jours", lineChart(f.map((x) => fd(x.d)), [{ name: "Prévision", values: f.map((x) => x.occ) }, { name: "En portefeuille", values: f.map((x) => (x.otb / sellable()) * 100) }, { name: "N-1", values: f.map((x) => x.ly) }], { fmt: (v) => Math.round(v) + " %", max: 100 }), btn("Prévision", "go('aip-rm/prevision')", "ghost sm"))}</div>
        <div class="w4">${section("Décisions sur les recommandations", donut([{ label: "Acceptées", value: acc }, { label: "Refusées", value: done.length - acc }, { label: "En attente", value: pend.length }], { fmt: (v) => v, center: String(X.recos.length), sub: "propositions" }))}</div>
      </div>
      <p class="muted">Mode ${esc(X.rmMode === "auto" ? "automatique borné : les propositions dans les bornes et ≤ 10 % sont appliquées seules, les autres restent à valider" : "conseil : chaque prix est validé par un humain, ici le directeur (RG-AIP-03)")}. Bornes plancher/plafond par type, variation maximale ${MAXVAR * 100} %. Repli : dernier prix validé.</p>
      <h2>À valider ${pend.length ? badge(pend.length + " en attente", "warn") : ""}</h2>
      ${pend.length ? `<div class="grid">${pend.map(recoCard).join("")}</div>` : `<p class="muted">Aucune recommandation en attente.</p>`}
      <h2>Historique</h2>
      ${tbl(["Réf.", "Type", "Période", "#Prix actuel", "#Proposé", "Décision", "Par"], done.map((r) => [esc(r.id), esc(T(r.type).label), `${fd(r.from)} → ${fd(r.to)}`, money(r.current), money(r.proposed),
        badge(r.status === "acceptee" ? "Acceptée" : "Refusée", r.status === "acceptee" ? "ok" : "bad"), esc(r.by || "—")]))}
      <p class="muted">EF-AIP-013 explicabilité · RG-AIP-03 validation humaine · événement aip.pricing.recommendation-generated</p>`
  }
  function recoCard(r) {
    const issues = recoIssues(r), v = recoVar(r)
    return `<div class="card">
      <div class="row between"><strong>${esc(T(r.type).label)} · ${fd(r.from)} → ${fd(r.to)}</strong>${badge(v > 0 ? "Hausse" : "Baisse", "info")}</div>
      <div class="row" style="margin:8px 0"><span class="big">${money(r.proposed)}</span><span class="muted">au lieu de ${money(r.current)} (${v > 0 ? "+" : ""}${pct(v * 100)})</span></div>
      <div class="muted">Facteurs principaux (contribution)</div>
      ${bars(r.factors.map(([l, w]) => ({ label: l, value: Math.round(w * 100) })), (x) => x + " %")}
      ${issues.length ? `<p class="err" style="margin:10px 0 0">Validation du directeur requise : ${esc(issues.join(", "))}.</p>` : ""}
      <div class="row" style="margin-top:10px">${btn(issues.length ? "Accepter (validation directeur)" : "Accepter", `A.aip.reco(${q(r.id)},'acceptee')`, "sm")}${btn("Refuser", `A.aip.reco(${q(r.id)},'refusee')`, "ghost sm")}</div>
    </div>`
  }
  function rmForecast() {
    const f = forecast(), n = sellable()
    return disabledNote("rm.pricing") + `<div class="grid">
        ${st("Occupation prévue 7 j", pct(f.slice(0, 7).reduce((s, x) => s + x.occ, 0) / 7), "moyenne, exemple", "bed", { trend: f.slice(0, 7).map((x) => x.occ) })}
        ${st("Occupation prévue 14 j", pct(f.reduce((s, x) => s + x.occ, 0) / 14), "moyenne, exemple", "calendar", { trend: f.map((x) => x.occ) })}
        ${st("Nuitées en portefeuille", f.reduce((s, x) => s + x.otb, 0), "réservations confirmées (data.js)", "moon")}
        ${st("Chambres vendables", n, "hors chambres hors commande", "key")}
      </div>
      <div style="margin:16px 0">${section("Occupation prévue — 14 jours", lineChart(f.map((x) => fd(x.d)), [{ name: "Prévision", values: f.map((x) => x.occ) }, { name: "N-1", values: f.map((x) => x.ly) }], { fmt: (v) => Math.round(v) + " %", max: 100 }))}</div>
      ${tbl(["Date", "#En portefeuille", "#Prévision", "#Intervalle", "#Occupation prévue", "#N-1"], f.map((x) => [`${esc(wd(x.d))} ${fd(x.d)}`, x.otb, x.fc, `${x.low} – ${x.high}`, pct(x.occ), pct(x.ly)]))}
      ${aiBox("Lecture de la prévision", "La demande remonte en fin de semaine prochaine (événement local d'exemple). Le portefeuille est en retard sur N-1 en début de période : une baisse ciblée sur les Standard est proposée.", btn("Voir les recommandations", "go('aip-rm/recommandations')", "ghost sm"))}`
  }
  function rmNoshow() {
    const list = D.reservations.filter((r) => r.status === "confirmee").map((r) => ({ r, ...noshow(r) })).sort((a, b) => b.score - a.score)
    const expected = list.filter((x) => x.r.from === today).reduce((s, x) => s + x.score / 100, 0)
    return disabledNote("res.noshow") + `<div class="grid">
        ${st("No-shows attendus ce soir", expected.toFixed(1).replace(".", ","), "somme des probabilités", "moon")}
        ${st("Réservations à risque", list.filter((x) => x.score >= 30).length, "probabilité ≥ 30 %", "alert")}
        ${st("AUC du modèle", "0,81", "M-NSH v2.1 (exemple)", "chart")}
      </div>
      <p class="muted">Information uniquement : aucun refus ni annulation automatique. La nationalité est exclue des variables du modèle. Repli : taux historiques par segment.</p>
      ${tbl(["Réf.", "Client", "Arrivée", "Garantie", "#Risque", "Facteurs", ""], list.map(({ r, score, factors }) => [
        esc(r.id), guestLink(r.guest), fd(r.from), esc(r.guarantee), score >= 30 ? badge(score + " %", "warn") : score + " %", `<span class="muted">${esc(factors.join(" · "))}</span>`,
        X.relances[r.id] ? badge("Relancé", "ok") : btn("Relancer (SMS simulé)", `A.aip.relance(${q(r.id)})`, "ghost sm")]))}`
  }

  function synthese() {
    const c = concierge(), s = spent()
    const bud = X.useCases.reduce((t, u) => t + u.budget, 0), modes = Object.keys(MODE).map((m) => ({ label: MODE[m], value: X.useCases.filter((u) => u.mode === m).length })).filter((x) => x.value)
    return `<div class="grid g4">
        ${st("Résolution concierge sans humain", pctTxt(c.rate), "conversations résolues / total", "message", { route: "aip-ia/concierge" })}
        ${st("Satisfaction des conversations", c.sat.toFixed(1).replace(".", ",") + " / 5", "note moyenne", "star")}
        ${st("Précision des prévisions", "MAPE 8,4 %", "modèle de demande (exemple)", "chart", { trend: [11.2, 10.4, 9.8, 9.1, 8.7, 8.4], route: "aip-rm/prevision" })}
        ${st("Coût IA par chambre occupée", money(s / X.roomNights), `${money(s)} ce mois`, "coins")}
        ${st("Acceptation des recommandations", pctTxt(acceptRate()), "acceptées / proposées traitées", "check", { route: "aip-rm/recommandations" })}
        ${st("Alertes d'anomalie ouvertes", X.anomalies.filter((a) => ["nouvelle", "analyse", "bloquee"].includes(a.status)).length, "fraude et anomalies", "shield", { route: "aip-ia/anomalies" })}
        ${st("Équipements à risque", X.equipment.filter((e) => e.status === "proposee" && e.risk >= 0.5).length, "maintenance prédictive", "wrench", { route: "aip-ia/predictif" })}
        ${st("Budget IA consommé", pctTxt(s / (bud || 1)), `${money(s)} / ${money(bud)}`, "wallet")}
      </div>
      <div class="dash" style="margin-top:16px">
        <div class="w8">${section("Consommation par cas d'usage", bars(X.useCases.map((u) => ({ label: u.label, value: u.used })).sort((a, b) => b.value - a.value), money))}</div>
        <div class="w4">${section("Modes de fonctionnement", donut(modes, { fmt: (v) => v + " cas", center: String(X.useCases.length), sub: "cas d'usage" }))}</div>
      </div>
      <h2>Cas d'usage actifs</h2>
      ${tbl(["Cas d'usage", "Module", "Mode", "#Consommé"], X.useCases.map((u) => [esc(u.label), esc(u.module), u.mode === "desactive" ? badge("Désactivé", "outline") : badge(MODE[u.mode], u.mode === "auto" ? "ok" : "info"), `${money(u.used)} / ${money(u.budget)}`]))}
      <div class="cols">
        <section><h2>À traiter</h2>
          <div class="list">
            <button onclick="go('aip-rm/recommandations')"><strong>${X.recos.filter((r) => r.status === "proposee").length} recommandation(s) de prix</strong><div class="muted">Revenue management</div></button>
            <button onclick="go('aip-ia/concierge')"><strong>${X.convs.filter((x) => x.status === "escaladee").length} conversation(s) escaladée(s)</strong><div class="muted">Concierge client</div></button>
            <button onclick="go('aip-ia/anomalies')"><strong>${X.anomalies.filter((a) => a.status === "nouvelle").length} alerte(s) d'anomalie nouvelles</strong><div class="muted">Fraude et anomalies</div></button>
            <button onclick="go('aip-ia/predictif')"><strong>${X.equipment.filter((e) => e.status === "proposee" && e.risk >= 0.5).length} équipement(s) à risque élevé</strong><div class="muted">Maintenance prédictive</div></button>
          </div></section>
        <section><h2>Passerelle de modèles</h2>
          ${tbl(["Fournisseur", "Rôle", "État", "#Latence p95"], X.gateway.map((g) => [esc(g.name), esc(g.role), badge(g.state, "ok"), esc(g.latency)]))}
          <p class="muted">Routage par cas d'usage, bascule automatique, cache sémantique, masquage des données personnelles (EF-AIP-001, EF-AIP-009). Aucune donnée client n'est utilisée par les fournisseurs pour leur entraînement (RG-AIP-02).</p></section>
      </div>
      ${aiBox("Résumé du jour", "Le concierge a traité 5 conversations cette nuit, dont 1 réclamation escaladée (climatisation ch. 202). La même climatisation présente un risque de panne de 68 % : un ordre préventif est proposé.", btn("Voir la maintenance prédictive", "go('aip-ia/predictif')", "ghost sm"))}`
  }

  // Copilote : échanges pré-écrits, aucun appel réseau
  const QA = [
    { id: "revpar", q: "Pourquoi le RevPAR de la semaine dernière a baissé par rapport à l'an dernier ?", dir: true,
      a: () => "RevPAR S47 : 38 400 FCFA contre 42 100 FCFA en N-1 (−8,8 %). L'occupation recule de 6 points (64 % contre 70 %) : le séminaire de 18 chambres de N-1 n'a pas été reconduit. L'ADR progresse légèrement (+1,2 %). Hors segment groupes, le RevPAR est stable.",
      sources: ["Rapport d'occupation hebdomadaire", "Revenus par segment (S47)"], query: "metric=revpar,occupation,adr · période=S47 vs S47 N-1 · dimension=segment · périmètre=Hôtel Exemple",
      chart: [["S44", 41200], ["S45", 40100], ["S46", 39800], ["S47", 38400], ["S47 N-1", 42100]] },
    { id: "vip", q: "Quelles arrivées VIP aujourd'hui ?", dir: false,
      a: () => { const v = arrivals().filter((r) => G(r.guest).vip); return v.length ? v.map((r) => `${G(r.guest).name} (${T(r.type).label}${r.request ? ", demande : " + r.request : ""})`).join(" ; ") + "." : "Aucune arrivée VIP aujourd'hui." },
      sources: ["Arrivées du jour (réception)"], query: "entité=réservation · filtre=arrivée=jour, vip=oui" },
    { id: "hk", q: "Combien de chambres restent à nettoyer ?", dir: false,
      a: () => { const s = D.rooms.filter((r) => r.hk === "sale"); return `${s.length} chambre(s) sale(s) : ${s.map((r) => r.no).join(", ") || "aucune"}. ${D.rooms.filter((r) => r.hk === "inspection").length} en attente d'inspection.` },
      sources: ["Statut des chambres (housekeeping)"], query: "entité=chambre · filtre=statut in (sale, inspection)" },
    { id: "ca", q: "Quel est le chiffre d'affaires hébergement du mois ?", dir: true,
      a: () => "Chiffre d'affaires hébergement au 26/11 : 13,9 M FCFA pour 236 nuitées (ADR 58 900 FCFA), soit 94 % du budget à date.",
      sources: ["Manager's report (mois en cours)"], query: "metric=ca_hebergement,nuitees,adr · période=MTD" },
    { id: "rapport", q: "Génère le rapport d'occupation des 7 prochains jours", dir: false,
      a: () => { const f = forecast().slice(0, 7); return `Rapport généré : occupation prévue moyenne ${pct(f.reduce((s, x) => s + x.occ, 0) / 7)} sur 7 jours, point bas le ${fd(f.reduce((a, b) => (b.occ < a.occ ? b : a)).d)}.` },
      table: () => [["Date", "#En portefeuille", "#Prévision", "#Occupation"], forecast().slice(0, 7).map((x) => [`${wd(x.d)} ${fd(x.d)}`, x.otb, x.fc, pct(x.occ)])],
      sources: ["Réservations (réception)", "Modèle de demande M-DEM v3.2"], query: "rapport=occupation · période=J..J+6 · métriques=otb,prevision,occupation", report: true },
    { id: "avis", q: "Rédige une réponse à l'avis négatif sur le bruit de la climatisation", dir: false,
      a: () => "Brouillon : « Madame, Monsieur, merci d'avoir pris le temps de nous écrire. Nous sommes désolés que le bruit de la climatisation ait perturbé votre nuit. Notre équipe technique est intervenue et nous serions heureux de vous accueillir à nouveau dans de meilleures conditions. La direction de l'Hôtel Exemple. »",
      sources: ["Avis du 24/11 (plateforme simulée)", "Conversation CV-82"], query: "modèle=avis.reponse v3 · ton=professionnel", draft: true },
  ]
  function copilote() {
    const role = X.role
    return disabledNote("copilote") + `<div class="split">
      <div>
        <label for="aip-role">Je suis connecté en tant que</label>
        ${select("aip-role", [["dir", "Kouadio Brou, directeur (tous droits)"], ["rec", "Aya Koffi, réceptionniste (droits réception)"]], role, `onchange="A.aip.setRole(this.value)"`)}
        <h3>Questions suggérées</h3>
        <div class="list">${QA.map((x) => `<button onclick="A.aip.ask(${q(x.id)})"><strong>${esc(x.q)}</strong>${x.dir ? `<div class="muted">Données de direction</div>` : ""}</button>`).join("")}</div>
        <p class="muted">Le copilote interroge une couche sémantique contrôlée (pas de requête libre sur la base) et applique les droits de l'utilisateur (RG-AIP-04). Il répond en langage naturel, génère des rapports et rédige des brouillons, jamais envoyés sans l'utilisateur. <span style="font-size:12px">EF-AIP-008</span></p>
      </div>
      <div class="card">
        <div class="row between"><strong>Copilote</strong>${badge("IA · simulé", "outline")}</div>
        <div class="stack" style="margin-top:12px">${X.chat.length ? X.chat.map(chatMsg).join("") : `<p class="muted">Posez une question ou choisissez une suggestion. Les réponses de la maquette sont pré-écrites.</p>`}</div>
        <div class="row" style="margin-top:14px;flex-wrap:nowrap">${input("aip-q", "", `placeholder="Votre question…" onkeydown="if(event.key==='Enter')A.aip.askFree()"`)}${btn("Envoyer", "A.aip.askFree()")}</div>
        ${X.chat.length ? `<div class="row" style="margin-top:8px">${btn("Effacer la conversation", "A.aip.clearChat()", "ghost sm")}</div>` : ""}
      </div></div>`
  }
  function chatMsg(m, i) {
    if (m.who === "user") return `<div style="text-align:right"><span class="pill">${esc(m.text)}</span></div>`
    return `<div class="card" style="padding:12px">
      <p style="margin:0">${esc(m.text)}</p>
      ${m.table ? `<div style="margin-top:8px">${tbl(m.table[0], m.table[1].map((r) => r.map((c) => esc(c))))}</div>` : ""}
      ${m.chart ? `<div style="margin-top:8px">${columns(m.chart.map((c) => c[0]), m.chart.map((c) => c[1]), (v) => Math.round(v / 100) / 10 + " k")}</div>` : ""}
      ${m.sources?.length ? `<p class="muted" style="margin:8px 0 0">Sources : ${esc(m.sources.join(" · "))}</p>` : ""}
      ${m.query ? `<p class="muted" style="margin:2px 0 0">Requête : <code>${esc(m.query)}</code></p>` : ""}
      <div class="row" style="margin-top:8px">${m.draft ? btn("Copier le brouillon", `A.aip.copyDraft()`, "sm") : ""}${m.table ? btn("Exporter en PDF (simulé)", `A.aip.exportReport()`, "sm") + btn("Planifier l'envoi", "A.bir ? A.bir.prefill('RPT-OCC') : go('bi-rapports/planifies')", "ghost sm") : ""}
        ${m.fb ? badge(m.fb === "utile" ? "Retour : utile" : "Retour : pas utile", "outline") : btn("Utile", `A.aip.chatFb(${i},'utile')`, "ghost sm") + btn("Pas utile", `A.aip.chatFb(${i},'inutile')`, "ghost sm")}</div>
    </div>`
  }

  function conciergeTab() {
    const c = X.convs.find((x) => x.id === ui.aipConv) || X.convs[0], k = concierge()
    const ST = { resolue: ["Résolue", "ok"], escaladee: ["Escaladée", "warn"], encours: ["En cours", "info"] }
    return disabledNote("concierge") + `<div class="grid">
        ${st("Taux de résolution sans humain", pctTxt(k.rate), "résolues / total", "check")}
        ${st("Satisfaction", k.sat.toFixed(1).replace(".", ",") + " / 5", "note moyenne des clients", "star")}
        ${st("Délai de première réponse", "1,6 s", "p95 simulé (cible < 2 s)", "zap")}
        ${st("Escalades", X.convs.filter((x) => x.escal).length, "réclamation, urgence ou confiance faible", "alert")}
      </div>
      <h2>Simuler un message entrant</h2>
      <div class="card">${form([
        field("aip-in-ch", "Canal", select("aip-in-ch", ["WhatsApp", "SMS", "App client", "Web"], "WhatsApp")),
        field("aip-in-lang", "Langue du client", select("aip-in-lang", ["Français", "Anglais", "Espagnol"], "Anglais")),
        field("aip-in-res", "Client en séjour", select("aip-in-res", inHouse().map((r) => [r.id, `${G(r.guest).name} · ch. ${r.room}`]), inHouse()[0]?.id)),
        field("aip-in-msg", "Message", input("aip-in-msg", "", `placeholder="ex. Could I get two extra towels and a wake-up call at 6 am?"`), "full"),
      ])}
        <div class="row" style="margin-top:8px"><span class="muted">Exemples :</span>${[["Anglais", "Could I get two extra towels and a wake-up call at 6 am?"], ["Français", "La climatisation fait un bruit énorme, impossible de dormir."], ["Espagnol", "¿A qué hora es el desayuno?"], ["Français", "Je voudrais parler à un humain."]].map(([l, t]) => btn(t.slice(0, 28) + "…", `document.getElementById('aip-in-lang').value=${q(l)};document.getElementById('aip-in-msg').value=${q(t)}`, "ghost sm")).join("")}</div>
        <div class="row" style="margin-top:10px">${btn("Envoyer au concierge", "A.aip.incoming()")}</div>
        <p class="muted">Le concierge détecte l'intention, répond dans la langue du client sur le canal d'origine, propose des actions à confirmer et escalade vers un humain (réclamation, demande explicite, confiance faible). <span style="font-size:12px">EF-AIP-006</span></p></div>
      <div class="split" style="margin-top:20px">
        <div><h3>Conversations</h3><div class="list">${X.convs.map((x) => `<button aria-current="${x === c}" onclick="ui.aipConv=${q(x.id)};render()">
          <strong>${esc(x.guest ? G(x.guest).name : "Visiteur anonyme")}</strong> ${badge(ST[x.status][0], ST[x.status][1])}
          <div class="muted">${esc(x.channel)} · ${esc(x.lang)} · ${esc(x.at)}</div></button>`).join("")}</div></div>
        <div class="card">
          <div class="row between"><strong>${esc(c.id)} · ${esc(c.channel)} · ${esc(c.lang)}</strong>${badge(ST[c.status][0], ST[c.status][1])}</div>
          <div class="muted">${c.guest ? `${esc(G(c.guest).name)}${c.room ? " · ch. " + esc(c.room) : ""}` : "Visiteur non identifié"}${c.reason ? " · escalade : " + esc(c.reason) : ""}</div>
          <div class="stack" style="margin-top:12px">${c.msgs.map(([who, t]) => `<div style="${who === "client" ? "text-align:right" : ""}">
            <div class="muted">${who === "ia" ? "Concierge IA" : who === "humain" ? "Réception (humain)" : "Client"}</div>
            <span class="pill ${who === "humain" ? "dark" : who === "ia" ? "outline" : ""}" style="white-space:normal;text-align:left">${esc(t)}</span></div>`).join("")}</div>
          ${c.tools.length ? `<h3>Actions via outils contrôlés</h3>${tbl(["Action", "Statut", ""], c.tools.map((t, i) => [esc(t.label),
            t.status === "confirmee" ? badge("Confirmée par le client", "ok") : badge("En attente de confirmation client", "warn"),
            t.status === "attente" ? btn("Simuler la confirmation", `A.aip.confirmTool(${q(c.id)},${i})`, "ghost sm") : ""]))}` : ""}
          ${c.sources.length ? `<p class="muted">Sources citées : ${esc(c.sources.join(" · "))}</p>` : ""}
          <div class="row" style="margin-top:12px;flex-wrap:nowrap">${input("aip-reply", "", `placeholder="Répondre en tant que réception…"`)}${btn("Prendre la main", `A.aip.humanReply(${q(c.id)})`)}</div>
          <div class="row" style="margin-top:8px">${c.status !== "resolue" ? btn("Marquer résolue", `A.aip.closeConv(${q(c.id)})`, "ghost sm") : ""}${!c.escal ? btn("Escalader vers la réception", `A.aip.escalate(${q(c.id)})`, "ghost sm") : ""}</div>
          <p class="muted">Chaque conversation annonce l'IA et propose un humain (RG-AIP-05). Aucune action sans confirmation du client (EF-AIP-007).</p>
        </div>
      </div>
      <h2>Base de connaissances (RAG)</h2>
      <p class="muted">Documents indexés pour l'établissement ${esc(D.hotel)} uniquement (isolation par tenant et établissement, EF-AIP-005).</p>
      ${tbl(["Document", "Source", "#Fragments", "Indexé le", ""], X.knowledge.map((k) => [esc(k.title), esc(k.src), k.chunks, fd(k.at), btn("Réindexer", `A.aip.reindex(${q(k.id)})`, "ghost sm")]))}
      <div class="row" style="margin-top:10px;flex-wrap:nowrap">${input("aip-kd", "", `placeholder="Titre d'un nouveau document (ex. Règlement intérieur)"`)}${btn("Ajouter et indexer", "A.aip.addDoc()", "ghost")}</div>`
  }

  function anomalies() {
    const ST = { nouvelle: ["Nouvelle", "warn"], analyse: ["En analyse", "info"], confirmee: ["Fraude confirmée", "bad"], faux: ["Faux positif", "outline"], bloquee: ["Bloquée automatiquement", "bad"] }
    const treated = X.anomalies.filter((a) => ["confirmee", "faux"].includes(a.status))
    return disabledNote("fraude") + `<div class="grid">
        ${st("Alertes ouvertes", X.anomalies.filter((a) => ["nouvelle", "analyse", "bloquee"].includes(a.status)).length, "à analyser par un humain", "alert")}
        ${st("Fraudes confirmées", X.anomalies.filter((a) => a.status === "confirmee").length, "ce mois (exemple)", "shield")}
        ${st("Taux de faux positifs", treated.length ? pctTxt(treated.filter((a) => a.status === "faux").length / treated.length) : "—", "sur alertes traitées", "filecheck")}
      </div>
      <p class="muted">Blocage automatique uniquement au-delà des seuils critiques paramétrés ; toutes les autres alertes sont analysées par un humain. Le personnel est informé de cette surveillance. Repli : règles statiques.</p>
      <div class="grid">${X.anomalies.map((a) => `<div class="card">
        <div class="row between"><span class="muted">${esc(a.id)} · ${esc(a.module)} · ${esc(a.at)}</span>${badge(ST[a.status][0], ST[a.status][1])}</div>
        <p style="margin:8px 0 4px"><strong>${esc(a.title)}</strong></p>
        <div class="muted">Concerné : ${esc(a.who)} · score ${Math.round(a.score * 100)} %</div>
        <ul style="margin:8px 0;padding-left:18px;font-size:14px">${a.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
        <div class="row">${a.status === "nouvelle" ? btn("Analyser", `A.aip.anomaly(${q(a.id)},'analyse')`, "ghost sm") : ""}
          ${["nouvelle", "analyse", "bloquee"].includes(a.status) ? btn("Confirmer la fraude", `A.aip.anomaly(${q(a.id)},'confirmee')`, "sm") + btn("Faux positif", `A.aip.anomaly(${q(a.id)},'faux')`, "ghost sm") : ""}</div>
      </div>`).join("")}</div>`
  }

  function predictif() {
    const hkTime = 31, planned = X.staffing
    return disabledNote("maint") + `<h2>Maintenance prédictive</h2>
      <div class="grid">
        ${st("Équipements surveillés", X.equipment.length, "capteurs IoT simulés", "plug")}
        ${st("Risque élevé", X.equipment.filter((e) => e.risk >= 0.5 && e.status === "proposee").length, "probabilité ≥ 50 %", "alert")}
        ${st("Pannes évitées", 3, "sur 90 jours (exemple)", "check")}
        ${st("MTTR", "5,2 h", "temps moyen de réparation (exemple)", "wrench")}
      </div>
      <div style="margin:16px 0">${section("Probabilité de panne par équipement", bars([...X.equipment].sort((a, b) => b.risk - a.risk).map((e) => ({ label: e.name, value: Math.round(e.risk * 100) })), (v) => v + " %"))}</div>
      ${tbl(["Équipement", "Zone", "#Risque", "Horizon", "Signaux capteurs", "Action proposée", ""], [...X.equipment].sort((a, b) => b.risk - a.risk).map((e) => [
        `<strong>${esc(e.name)}</strong>`, esc(e.zone), e.risk >= 0.5 ? badge(pctTxt(e.risk), "bad") : pctTxt(e.risk), esc(e.horizon),
        `<span class="muted">${esc(e.signals.join(" · "))}</span>`, esc(e.action),
        e.status === "ot" ? badge("Ordre créé", "ok") : btn("Créer un ordre préventif", `A.aip.workOrder(${q(e.id)})`, "ghost sm")]))}
      <p class="muted">Propositions validées par le responsable technique. Repli : maintenance calendaire.</p>
      <h2>Housekeeping et effectifs</h2>
      <div class="grid">
        ${st("Minutes par chambre", hkTime + " min", "moyenne 7 jours (exemple)", "clock")}
        ${st("Écart besoin / planifié", planned.reduce((s, x) => s + x.need - x.planned, 0) + " pers.", "demain", "users")}
        ${st("Coût de personnel / chambre", money(9800), "exemple", "wallet")}
      </div>
      ${UC("effectifs").mode === "desactive" ? `<p class="muted">La planification des effectifs par IA est désactivée : le planning suit les ratios standards (repli). Elle s'active dans « Modèles et gouvernance ».</p>` : ""}
      ${tbl(["Service", "Tranche", "#Besoin prévu", "#Planifié", "Facteurs"], planned.map((x) => [esc(x.service), esc(x.slot), x.need, x.need > x.planned ? `<strong>${x.planned}</strong>` : x.planned, `<span class="muted">${esc(x.factors)}</span>`]))}
      ${aiBox("Planning proposé", X.staffingValidated ? "Planning validé par le chef de service : 1 femme de chambre et 1 serveur ajoutés demain." : "Ajouter 1 femme de chambre (8 h – 15 h) et 1 serveur pour le service du midi demain. Proposition soumise à la validation du chef de service, dans le respect des contraintes légales de temps de travail.",
        X.staffingValidated ? "" : btn("Valider le planning proposé", "A.aip.validateStaffing()", "sm"))}`
  }

  function modeles() {
    const s = spent(), ratio = s / X.budget
    return `<h2>Cas d'usage et niveau d'automatisation</h2>
      <p class="muted">Chaque fonction IA s'active ou se désactive par établissement, avec un repli non-IA (EF-AIP-014, EF-AIP-015). Les actions financières ou de sécurité restent en mode conseil.</p>
      ${tbl(["Cas d'usage", "Module", "Modèle", "Mode", "#Budget mensuel", "#Consommé", "Repli"], X.useCases.map((u) => [
        `<strong>${esc(u.label)}</strong><div class="muted">${esc(u.code)}</div>`, esc(u.module), esc(u.model),
        select("aip-m-" + u.code.replace(".", "-"), u.modes.map((m) => [m, MODE[m]]), u.mode, `onchange="A.aip.setMode(${q(u.code)},this.value)" aria-label="Mode ${esc(u.label)}"`),
        `<input type="number" id="aip-b-${esc(u.code.replace(".", "-"))}" value="${u.budget}" min="0" step="1000" style="text-align:right;min-width:100px" aria-label="Budget ${esc(u.label)}">`,
        `${money(u.used)} ${u.used >= u.budget ? badge("Plafond atteint", "bad") : u.used / u.budget >= 0.8 ? badge(pctTxt(u.used / u.budget), "warn") : pctTxt(u.used / u.budget)}`, `<span class="muted">${esc(FALLBACK[u.code])}</span>`]))}
      <div class="cols">
        <section><h2>Maîtrise des coûts</h2>
          ${card("", `<div class="row between"><span>Plafond du tenant (Hôtel Exemple) ce mois</span><strong>${money(s)} / ${money(X.budget)}</strong></div>
            <div class="track" style="margin:10px 0"><i style="width:${Math.min(100, ratio * 100)}%"></i></div>
            ${s >= X.budget ? `<p class="err">Plafond du tenant atteint : ${X.capPolicy === "bloquer" ? "fonctions IA bloquées, repli non-IA" : "toutes les fonctions basculent sur le modèle interne léger"}.</p>` : ""}
            ${form([field("aip-tenant-b", "Plafond mensuel du tenant (FCFA)", input("aip-tenant-b", X.budget, 'type="number" min="0" step="10000"')),
              field("aip-cap", "Au-delà d'un plafond", select("aip-cap", [["degrader", "Dégrader vers le modèle interne léger"], ["bloquer", "Bloquer et passer au repli non-IA"]], X.capPolicy))])}
            <div class="row" style="margin-top:10px">${btn("Enregistrer les plafonds", "A.aip.saveBudgets()")}${btn("Simuler un pic de 40 conversations", "A.aip.spike()", "ghost sm")}${btn("Nouveau mois (remise à zéro)", "A.aip.resetCosts()", "ghost sm")}</div>
            <div class="muted" style="margin-top:8px">Coût mesuré à chaque inférence (journal) et cumulé par cas d'usage ; alerte à 80 %. Concierge à ${pctTxt(UC("concierge").used / UC("concierge").budget)} de son budget. <span style="font-size:12px">EF-AIP-012</span></div>`)}
          <h2>Garde-fous (30 jours)</h2>
          ${tbl(["Contrôle", "#Déclenchements"], [["Données personnelles masquées avant envoi", X.guards.pii], ["Tentatives d'injection de prompt bloquées", X.guards.injection], ["Contenus filtrés", X.guards.content], ["Actions refusées (hors liste blanche)", X.guards.actions]])}
        </section>
        <section><h2>Prompts versionnés</h2>
          ${tbl(["Prompt", "Version active", "#Score d'évaluation", ""], X.prompts.map((pr) => { const i = pr.versions.findIndex((v) => v[0] === pr.active)
            return [esc(pr.code), badge(pr.active, "ok"), pctTxt(pr.versions[i][1]), i > 0 ? btn(`Revenir à ${pr.versions[i - 1][0]}`, `A.aip.rollback(${q(pr.code)})`, "ghost sm") : `<span class="muted">première version</span>`] }))}
          <p class="muted">Jeux d'évaluation exécutés à chaque nouvelle version (EF-AIP-002).</p>
        </section>
      </div>
      <h2>Registre des modèles</h2>
      ${tbl(["Modèle", "Type", "Version", "Métrique", "Dernière évaluation", "Statut", "Périmètre de données", ""], X.models.map((m) => [
        `<strong>${esc(m.name)}</strong><div class="muted">${esc(m.id)}</div>`, esc(m.type), esc(m.version), esc(m.metric), fd(m.evalAt),
        badge(m.status, m.status === "production" ? "ok" : "info"), esc(m.scope), btn("Réévaluer", `A.aip.evalModel(${q(m.id)})`, "ghost sm")]))}
      <p class="muted">Aucune donnée de ce tenant n'entraîne un modèle d'un autre tenant sans accord et anonymisation (RG-AIP-01). Supervision de la dérive et des retours utilisateurs (EF-AIP-011).</p>`
  }

  // Feature store et pipeline MLOps (EF-AIP-003, EF-AIP-004)
  const featureValue = (id) => {
    const f = forecast(), g = D.reservations.find((r) => r.status === "confirmee")
    return { "F-OCC7": pct(f[7].occ), "F-PICK": String(f.slice(0, 7).reduce((s, x) => s + x.otb, 0)) + " nuitées", "F-STAY": g ? `${D.reservations.filter((x) => x.guest === g.guest && x.status === "partie").length} (${G(g.guest).name})` : "—",
      "F-GUAR": g ? `${g.guarantee} (${g.id})` : "—", "F-VIB": "+35 % (EQ-1)", "F-RFD": "6,0 × (AN-41)" }[id] || "—"
  }
  const freshTxt = (m) => (m < 60 ? m + " min" : m < 1440 ? Math.round(m / 60) + " h" : Math.round(m / 1440) + " j")
  const RUNST = { entraine: ["Entraîné", "outline"], valide: ["Validé", "info"], canari: ["Canari 10 %", "warn"], production: ["En production", "ok"], rejete: ["Rejeté", "bad"], retire: ["Retiré", "outline"] }
  function mlops() {
    const stale = X.features.filter((f) => f.fresh > f.sla)
    return `<h2>Feature store <span class="muted" style="font-size:12px">EF-AIP-003</span></h2>
      <p class="muted">Variables calculées une fois et partagées par les modèles : stockage hors ligne (entraînement, lakehouse) et en ligne (prédiction en temps réel, alimenté par les événements). Valeurs servies calculées sur les données de la maquette.</p>
      ${stale.length ? `<p class="err">${stale.length} variable(s) au-delà de leur objectif de fraîcheur : ${esc(stale.map((f) => f.name).join(", "))}. Les prédictions qui les utilisent sont marquées « données anciennes ».</p>` : ""}
      ${tbl(["Variable", "Entité", "Source", "En ligne", "Hors ligne", "Fraîcheur", "Valeur servie", "Modèles", ""], X.features.map((f) => [`<code>${esc(f.name)}</code>`, esc(f.entity), esc(f.src), f.online ? badge("Oui", "ok") : "—", f.offline ? badge("Oui", "ok") : "—",
        f.fresh > f.sla ? badge(`${freshTxt(f.fresh)} > ${freshTxt(f.sla)}`, "bad") : `${freshTxt(f.fresh)} <span class="muted">/ ${freshTxt(f.sla)}</span>`, esc(featureValue(f.id)), esc(f.used.join(", ")), btn("Rematérialiser", `A.aip.refreshFeature(${q(f.id)})`, "ghost sm")]))}
      <div class="row" style="margin-top:10px">${btn("Rematérialiser tout le store", "A.aip.refreshFeature('*')", "ghost")}</div>
      <h2>Pipeline MLOps <span class="muted" style="font-size:12px">EF-AIP-004</span></h2>
      <div class="card">${form([
        field("aip-tr-model", "Modèle à réentraîner", select("aip-tr-model", X.models.map((m) => [m.id, `${m.name} (v${m.version})`]), "M-DEM")),
        field("aip-tr-scope", "Données d'entraînement", select("aip-tr-scope", [["Tenant", "Données de ce tenant uniquement"], ["Mutualisé", "Mutualisé, anonymisé, avec accord"]], "Tenant")),
        `<div style="align-self:end">${btn("Lancer l'entraînement (simulé)", "A.aip.train()")}</div>`])}
        <label style="display:flex;gap:6px;align-items:center;margin-top:10px"><input type="checkbox" ${X.consent ? "checked" : ""} onchange="A.aip.consent(this.checked)"> Le tenant accepte l'entraînement mutualisé sur données anonymisées (RG-AIP-01)</label></div>
      ${tbl(["Exécution", "Modèle", "Version", "Données", "Métrique", "#Candidat", "#Production", "Étape", ""], X.runs.map((r) => {
        const m = X.models.find((x) => x.id === r.model)
        const act = r.stage === "entraine" ? btn("Valider sur le jeu de test", `A.aip.validateRun(${q(r.id)})`, "sm")
          : r.stage === "valide" ? btn("Déployer en canari", `A.aip.deployRun(${q(r.id)})`, "sm")
          : r.stage === "canari" ? btn("Promouvoir en production", `A.aip.promoteRun(${q(r.id)})`, "accent sm") + btn("Annuler", `A.aip.retireRun(${q(r.id)})`, "ghost sm")
          : r.stage === "production" && r.prev ? btn("Revenir à la version précédente", `A.aip.retireRun(${q(r.id)})`, "ghost sm") : ""
        return [esc(r.id) + `<div class="muted">${fd(r.at)}</div>`, esc(m ? m.name : r.model), "v" + esc(r.version), `${esc(r.scope)}<div class="muted">${esc(r.data)}</div>`, esc(r.unit), r.score.toFixed(3).replace(".", ","), r.base.toFixed(3).replace(".", ","),
          badge(RUNST[r.stage][0], RUNST[r.stage][1]) + (r.why ? `<div class="muted">${esc(r.why)}</div>` : ""), `<span class="row" style="flex-wrap:nowrap;gap:4px">${act}</span>`]
      }))}
      <p class="muted">Chaque version est validée contre la version en production (aucune régression admise), déployée en canari puis promue ; retour arrière possible. Registre des modèles dans « Modèles et gouvernance ».</p>`
  }

  function journal() {
    const f = ui.aipLog || "tous"
    const list = X.log.filter((l) => f === "tous" || l.uc === f)
    return `<p class="muted">Chaque inférence est journalisée : cas d'usage, modèle, version du prompt, coût, latence, résultat et décision humaine, sans donnée sensible inutile (EF-AIP-010). Les décisions à effet significatif sur une personne ne sont jamais entièrement automatisées (RG-AIP-06).</p>
      <div class="chips">${[["tous", "Tous"], ["rm.pricing", "Prix"], ["concierge", "Concierge"], ["copilote", "Copilote"], ["fraude", "Anomalies"], ["maint", "Maintenance"]].map(([k, l]) =>
        `<button aria-pressed="${f === k}" onclick="ui.aipLog='${k}';render()">${l}</button>`).join("")}</div>
      ${tbl(["Heure", "Cas d'usage", "Modèle", "Prompt", "#Coût", "#Latence", "Résultat", "Décision", "Utilisateur", "Retour"], list.map((l) => [
        esc(l.at), esc(l.uc), esc(l.model), esc(l.pv), money(l.cost), l.ms + " ms", esc(l.result), esc(l.decision), esc(l.user),
        l.fb ? badge(l.fb === "utile" ? "Utile" : "Pas utile", "outline") : btn("Utile", `A.aip.logFb(${X.log.indexOf(l)},'utile')`, "ghost sm")]), "Aucune inférence pour ce filtre.")}`
  }

  // ---------- Actions ----------
  const actions = {
    setRmMode(m) {
      X.rmMode = m
      UC("rm.pricing").mode = m
      if (m === "auto") {
        const auto = X.recos.filter((r) => r.status === "proposee" && !recoIssues(r).length && Math.abs(recoVar(r)) <= 0.1)
        auto.forEach((r) => applyReco(r, "Automatique borné"))
        toast(`Mode automatique borné : ${auto.length} prix appliqué(s), les autres restent à valider`)
      } else toast("Mode conseil : chaque prix est validé par un humain")
      render()
    },
    reco(id, status) {
      const r = X.recos.find((x) => x.id === id)
      if (status === "acceptee" && recoIssues(r).length && !confirm(`Le prix ${money(r.proposed)} dépasse les règles (${recoIssues(r).join(", ")}). Confirmer en tant que directeur ?`)) return
      if (status === "acceptee") applyReco(r, "Kouadio Brou")
      else { r.status = "refusee"; r.by = "Kouadio Brou"; logIt("rm.pricing", "M-DEM 3.2", `${r.id} refusée`, "Refusée", 0, 0) }
      toast(status === "acceptee" ? `Prix ${T(r.type).label} accepté : ${money(r.proposed)}` + (r.from === today ? " (tarif public mis à jour)" : "") : "Recommandation refusée, dernier prix validé conservé")
      render()
    },
    relance(id) { X.relances[id] = true; logIt("res.noshow", "M-NSH 2.1", `Relance pré-arrivée ${id}`, "Envoyée par l'utilisateur", 1, 80); toast(`SMS de confirmation envoyé pour ${id} (simulé)`); render() },
    setRole(r) { X.role = r; X.chat = []; toast(r === "dir" ? "Connecté : Kouadio Brou (directeur)" : "Connecté : Aya Koffi (réceptionniste)"); render() },
    ask(id, text) {
      if (UC("copilote").mode === "desactive") return toast("Copilote désactivé : consultez les rapports standards")
      const x = QA.find((k) => k.id === id), cap = capState("copilote")
      X.chat.push({ who: "user", text: text || x.q })
      if (!cap.ok) {
        X.chat.push({ who: "ia", text: `Copilote indisponible : ${cap.why} ce mois. Repli : ${FALLBACK.copilote}.`, sources: ["Bibliothèque de rapports"], query: "aucun appel au modèle (plafond de coût)" })
        logIt("copilote", "—", "Bloqué par le plafond de coût", "Repli non-IA", 0, 5, "v4"); return render()
      }
      if (x.dir && X.role !== "dir") X.chat.push({ who: "ia", text: "Je ne peux pas répondre : ces données (revenus de l'établissement) ne font pas partie de vos droits. Le copilote n'accède qu'aux données que vous pouvez consulter.", sources: [], query: "refus · droits insuffisants (RG-AIP-04)" })
      else X.chat.push({ who: "ia", text: (cap.degraded ? "[Modèle interne léger, réponse abrégée] " : "") + x.a(), sources: x.sources, query: x.query, chart: x.chart, draft: x.draft, table: x.table && x.table() })
      const c0 = 30 + Math.round(rnd(X.chat.length) * 30)
      logIt("copilote", cap.degraded ? "Interne léger" : "LLM A", x.dir && X.role !== "dir" ? "Refus (droits)" : x.report ? "Rapport généré" : "Réponse générée", cap.degraded ? "Dégradé (plafond)" : "Brouillon / information", cap.degraded ? Math.round(c0 / 5) : c0, 1500 + Math.round(rnd(X.chat.length + 3) * 900), "v4")
      render()
    },
    askFree() {
      const t = val("aip-q")
      if (!t) return
      const s = t.toLowerCase()
      const hit = QA.find((x) => (x.id === "revpar" && s.includes("revpar")) || (x.id === "vip" && s.includes("vip")) || (x.id === "hk" && (s.includes("nettoy") || s.includes("sale"))) || (x.id === "ca" && (s.includes("chiffre") || s.includes("ca "))) || (x.id === "avis" && s.includes("avis")) || (x.id === "rapport" && (s.includes("rapport") || s.includes("occupation"))))
      if (hit) return actions.ask(hit.id, t)
      X.chat.push({ who: "user", text: t }, { who: "ia", text: "Cette maquette ne contient pas de réponse pré-écrite pour cette question. Repli : consultez les rapports standards du module Business Intelligence.", sources: ["Bibliothèque de rapports"], query: "aucune correspondance sur la couche sémantique" })
      render()
    },
    clearChat() { X.chat = []; render() },
    chatFb(i, v) { X.chat[i].fb = v; toast("Merci, retour enregistré pour la supervision de la qualité"); render() },
    copyDraft() { toast("Brouillon copié : relisez-le avant envoi (envoi par l'utilisateur uniquement)") },
    confirmTool(cid, i) {
      const c = X.convs.find((x) => x.id === cid), t = c.tools[i]
      t.status = "confirmee"
      if (t.kind) {
        if (D.sej && D.sej.log) D.sej.log.unshift({ id: uid("MC"), at: `${today} ${new Date().toTimeString().slice(0, 5)}`, author: `Concierge IA (${c.channel})`, type: "Demande client", room: t.room || "", text: t.text, due: t.due, status: "ouverte", t0: Date.now() })
        const L = { "Français": 0, "Anglais": 1, "Espagnol": 2 }[c.lang] ?? 0
        c.msgs.push(["client", ["Oui, je confirme.", "Yes please.", "Sí, confirmo."][L]], ["ia", ["C'est fait, la demande est transmise à l'équipe.", "Done, your request has been passed to the team.", "Hecho, su solicitud ha sido transmitida al equipo."][L]])
        if (c.tools.every((x) => x.status === "confirmee")) { c.status = "resolue"; c.rating = 5 }
        logIt("concierge", "LLM A", `${t.label} (main courante)`, "Confirmé par le client", 12, 900, "v7")
      } else {
        c.msgs.push(["client", "Oui, je confirme."], ["ia", "C'est réservé : massage 60 min le 27/11 à 15 h. À demain !"])
        c.status = "resolue"; c.rating = 5
        logIt("concierge", "LLM A", "Soin spa réservé via outil contrôlé", "Confirmé par le client", 22, 1600, "v7")
      }
      toast("Action exécutée après confirmation du client (simulé)"); render()
    },
    humanReply(cid) {
      const t = val("aip-reply")
      if (!t) return toast("Saisissez une réponse")
      const c = X.convs.find((x) => x.id === cid)
      c.msgs.push(["humain", t]); c.escal = true
      if (c.status === "encours") c.status = "escaladee"
      toast("Réponse envoyée au client (canal simulé)"); render()
    },
    closeConv(cid) { const c = X.convs.find((x) => x.id === cid); c.status = "resolue"; toast(`${cid} marquée résolue`); render() },
    escalate(cid) {
      const c = X.convs.find((x) => x.id === cid)
      Object.assign(c, { escal: true, status: "escaladee", reason: "Demande de l'opérateur" })
      c.msgs.push(["ia", "Je vous mets en relation avec un membre de la réception."])
      logIt("concierge", "LLM A", "Escalade manuelle", "Escaladé", 0, 0, "v7")
      toast("Conversation transférée à la réception (aip.conversation.escalated)"); render()
    },
    reindex(id) { const k = X.knowledge.find((x) => x.id === id); k.at = today; toast(`« ${k.title} » réindexé (simulé)`); render() },
    addDoc() {
      const t = val("aip-kd")
      if (!t) return toast("Indiquez le titre du document")
      X.knowledge.unshift({ id: uid("KD"), title: t, src: "Saisie manuelle", chunks: 5 + Math.round(rnd(X.knowledge.length) * 20), at: today })
      toast("Document ajouté et indexé pour cet établissement uniquement"); render()
    },
    anomaly(id, st) {
      const a = X.anomalies.find((x) => x.id === id)
      a.status = st
      logIt("fraude", "M-ANO 1.1", `${a.id} : ${st === "faux" ? "faux positif" : st === "confirmee" ? "fraude confirmée" : "en analyse"}`, "Décision humaine", 0, 0)
      toast(st === "confirmee" ? `${id} confirmée : dossier ouvert` : st === "faux" ? `${id} classée faux positif (retour au modèle)` : `${id} en cours d'analyse`)
      render()
    },
    workOrder(id) {
      const e = X.equipment.find((x) => x.id === id)
      e.status = "ot"
      logIt("maint", "M-SRV 0.9", `Ordre préventif : ${e.name}`, "Validé par le responsable technique", 1, 90)
      toast(`Ordre de travail préventif créé pour ${e.name} (simulé)`); render()
    },
    validateStaffing() {
      X.staffing.forEach((s) => (s.planned = Math.max(s.planned, s.need)))
      X.staffingValidated = true
      logIt("effectifs", "M-DEM 3.2", "Planning du lendemain ajusté", "Validé par le chef de service", 2, 300)
      toast("Planning validé et transmis aux RH (simulé)"); render()
    },
    setMode(code, m) {
      const u = UC(code)
      u.mode = m
      if (code === "rm.pricing") X.rmMode = m === "auto" ? "auto" : "conseil"
      toast(`${u.label} : ${MODE[m]}${m === "desactive" ? " — repli : " + FALLBACK[code] : ""}`); render()
    },
    rollback(code) {
      const pr = X.prompts.find((x) => x.code === code), i = pr.versions.findIndex((v) => v[0] === pr.active)
      if (!confirm(`Revenir à la version ${pr.versions[i - 1][0]} de ${code} ?`)) return
      pr.active = pr.versions[i - 1][0]
      toast(`${code} : retour à ${pr.active}`); render()
    },
    evalModel(id) { const m = X.models.find((x) => x.id === id); m.evalAt = today; toast(`${m.name} : jeu d'évaluation relancé, métriques stables (simulé)`); render() },
    logFb(i, v) { X.log[i].fb = v; toast("Retour enregistré"); render() },
    exportReport() { logIt("copilote", "—", "Rapport exporté en PDF", "Export utilisateur", 0, 0); toast("rapport_occupation_7j.pdf généré (simulé)") },
    // concierge : message entrant simulé (EF-AIP-006)
    incoming() {
      const ch = val("aip-in-ch"), lang = val("aip-in-lang"), rid = val("aip-in-res"), msg = val("aip-in-msg")
      if (!msg) return toast("Saisissez le message du client")
      const r = R(rid), room = r ? r.room : null, s = msg.toLowerCase(), cap = capState("concierge")
      const L = { "Français": 0, "Anglais": 1, "Espagnol": 2 }[lang] ?? 0
      const T3 = (a) => a[L]
      const intro = T3(["Bonjour, je suis le concierge virtuel de l'hôtel (assistant IA). Vous pouvez demander un membre du personnel à tout moment.", "Hello, I am the hotel's virtual concierge (AI assistant). You can ask for a staff member at any time.", "Hola, soy el conserje virtual del hotel (asistente de IA). Puede pedir hablar con una persona en cualquier momento."])
      const c = { id: uid("CV"), channel: ch, lang, guest: r ? r.guest : null, room, at: fd(today) + " " + new Date().toTimeString().slice(0, 5), status: "encours", escal: false, rating: null, msgs: [["ia", intro], ["client", msg]], tools: [], sources: [] }
      if (UC("concierge").mode === "desactive" || !cap.ok) {
        c.msgs.push(["ia", T3(["Je transmets votre message à la réception, qui vous répond rapidement.", "I am forwarding your message to the front desk, who will reply shortly.", "Transmito su mensaje a la recepción, que le responderá en breve."])])
        Object.assign(c, { status: "escaladee", escal: true, reason: UC("concierge").mode === "desactive" ? "Concierge désactivé (repli)" : "Plafond de coût atteint (repli)" })
      } else {
        const hk = /serviette|towel|toalla|oreiller|pillow|almohada|savon|soap|jab[oó]n/.test(s)
        const wake = /r[ée]veil|wake|despert/.test(s), hm = s.match(/(\d{1,2})\s*(?:h|am|:00|de la ma)/), hour = hm ? String(+hm[1]).padStart(2, "0") + ":00" : "06:00"
        const complaint = /bruit|noise|ruido|sale\b|dirty|sucio|plainte|complain|queja|cass[ée]|broken|panne|clim/.test(s)
        const human = /humain|human|humano|personne|person/.test(s)
        const info = /d[ée]jeuner|breakfast|desayuno|piscine|pool|piscina|horaire|hours|horario|wifi/.test(s)
        if (complaint || human) {
          c.msgs.push(["ia", T3(["Je suis désolé. Je vous mets en relation avec la réception, qui vous recontacte immédiatement.", "I am sorry. I am connecting you with the front desk, who will contact you right away.", "Lo siento. Le pongo en contacto con la recepción, que le llamará de inmediato."])])
          Object.assign(c, { status: "escaladee", escal: true, reason: complaint ? "Réclamation détectée" : "Demande d'un humain" })
          c.tools.push({ label: `Escalade vers la réception${room ? " — ch. " + room : ""}`, status: "confirmee" })
          if (D.sej && D.sej.log) D.sej.log.unshift({ id: uid("MC"), at: `${today} ${new Date().toTimeString().slice(0, 5)}`, author: `Concierge IA (${ch})`, type: complaint ? "Incident" : "Message client", room: room || "", text: `${complaint ? "Réclamation" : "Demande d'un humain"} reçue par le concierge : « ${msg} »`, status: "ouverte" })
        } else if (hk || wake) {
          if (hk) c.tools.push({ kind: "hk", label: `Demande housekeeping : ${msg.slice(0, 60)} — ch. ${room}`, status: "attente", room, text: `Demande client via concierge IA : ${msg}` })
          if (wake) c.tools.push({ kind: "wake", label: `Réveil programmé ${fd(addDays(today, 1))} à ${hour} — ch. ${room}`, status: "attente", room, text: `Réveil à ${hour}`, due: hour })
          c.msgs.push(["ia", T3([`Je peux ${hk ? "créer une demande au service des étages" : ""}${hk && wake ? " et " : ""}${wake ? `programmer un réveil à ${hour}` : ""} pour la chambre ${room}. Je confirme ?`, `I can ${hk ? "send a housekeeping request" : ""}${hk && wake ? " and " : ""}${wake ? `schedule a wake-up call at ${hour}` : ""} for room ${room}. Shall I confirm?`, `Puedo ${hk ? "enviar una solicitud al servicio de pisos" : ""}${hk && wake ? " y " : ""}${wake ? `programar un despertador a las ${hour}` : ""} para la habitación ${room}. ¿Confirmo?`])])
          c.sources.push("Catalogue des services v5")
        } else if (info) {
          c.msgs.push(["ia", T3(["Le petit-déjeuner est servi de 6 h 30 à 10 h 30. La piscine est ouverte de 7 h à 20 h.", "Breakfast is served from 6:30 to 10:30 am. The pool is open from 7 am to 8 pm.", "El desayuno se sirve de 6:30 a 10:30. La piscina abre de 7:00 a 20:00."])])
          c.status = "resolue"; c.sources.push("FAQ établissement v3", "Horaires spa et piscine")
        } else {
          c.msgs.push(["ia", T3(["Je ne suis pas certain de comprendre : je transmets à la réception.", "I am not sure I understand: I am passing you to the front desk.", "No estoy seguro de entender: le paso con la recepción."])])
          Object.assign(c, { status: "escaladee", escal: true, reason: "Confiance faible" })
        }
      }
      X.convs.unshift(c); ui.aipConv = c.id
      if (cap.ok && UC("concierge").mode !== "desactive") logIt("concierge", cap.degraded ? "Interne léger" : "LLM A", `Message ${ch} (${lang}) : ${c.status === "escaladee" ? "escalade" : c.tools.length ? "action proposée" : "réponse"}`, c.status === "escaladee" ? "Escaladé" : "—", cap.degraded ? 5 : 26, 1400, "v7")
      toast(`Message ${ch} traité par le concierge (${lang})`); render()
    },
    // plafonds de coût (EF-AIP-012)
    saveBudgets() {
      X.useCases.forEach((u) => { const v = +val("aip-b-" + u.code.replace(".", "-")); if (v >= 0) u.budget = v })
      const t = +val("aip-tenant-b"); if (t > 0) X.budget = t
      X.capPolicy = val("aip-cap") || X.capPolicy
      toast("Plafonds enregistrés"); render()
    },
    spike() { for (let i = 0; i < 40; i++) logIt("concierge", "LLM A", "Conversation (pic simulé)", "—", 38, 1500, "v7"); toast(`Pic simulé : concierge à ${money(UC("concierge").used)} / ${money(UC("concierge").budget)}`); render() },
    resetCosts() { X.useCases.forEach((u) => (u.used = 0)); toast("Compteurs de coût remis à zéro (nouveau mois)"); render() },
    // feature store et MLOps
    refreshFeature(id) { X.features.filter((f) => id === "*" || f.id === id).forEach((f) => (f.fresh = 0)); toast(id === "*" ? "Feature store rematérialisé (simulé)" : "Variable rematérialisée"); render() },
    consent(v) { X.consent = v; toast(v ? "Accord d'entraînement mutualisé enregistré" : "Accord retiré : entraînement sur les données du tenant uniquement"); render() },
    train() {
      const mid = val("aip-tr-model"), scope = val("aip-tr-scope"), m = X.models.find((x) => x.id === mid)
      if (scope === "Mutualisé" && !X.consent) return toast("Entraînement mutualisé impossible sans accord explicite du tenant (RG-AIP-01)")
      const unit = (m.metric.match(/^[A-Za-zéÉ]+/) || ["Score"])[0], base = +(m.metric.match(/[\d,]+/) || ["0,8"])[0].replace(",", ".") / (/%/.test(m.metric) ? 100 : 1)
      const lower = unit === "MAPE", delta = (rnd(X.runSeq) - 0.35) * 0.06
      const n = X.runSeq++, ver = (+m.version + 0.1).toFixed(1)
      X.runs.unshift({ id: "RUN-" + n, model: mid, version: ver, stage: "entraine", score: Math.max(0.01, +(base + (lower ? -delta : delta)).toFixed(3)), base, unit, lower, scope, data: scope === "Tenant" ? "Données du tenant, 24 mois" : "Mutualisé anonymisé (accord)", at: today })
      logIt(m.id === "M-DEM" ? "rm.pricing" : "maint", m.id, `Entraînement ${m.id} v${ver}`, "Lancé par l'utilisateur", 0, 0)
      toast(`${m.name} v${ver} entraîné (simulé)`); render()
    },
    validateRun(id) {
      const r = X.runs.find((x) => x.id === id), better = r.lower ? r.score <= r.base : r.score >= r.base
      r.stage = better ? "valide" : "rejete"
      if (!better) r.why = `Régression : ${r.unit} ${String(r.score).replace(".", ",")} contre ${String(r.base).replace(".", ",")} en production`
      toast(better ? "Validation réussie : aucune régression" : "Version rejetée : régression sur le jeu de test"); render()
    },
    deployRun(id) { const r = X.runs.find((x) => x.id === id); r.stage = "canari"; X.models.find((m) => m.id === r.model).status = "canari 10 %"; toast("Déployé en canari sur 10 % du trafic"); render() },
    promoteRun(id) {
      const r = X.runs.find((x) => x.id === id), m = X.models.find((x) => x.id === r.model)
      r.prev = { version: m.version, metric: m.metric }
      X.runs.filter((x) => x.model === r.model && x.stage === "production" && x !== r).forEach((x) => (x.stage = "retire"))
      Object.assign(m, { version: r.version, metric: `${r.unit} ${r.unit === "MAPE" ? (r.score * 100).toFixed(1).replace(".", ",") + " %" : r.score.toFixed(2).replace(".", ",")}`, status: "production", evalAt: today })
      r.stage = "production"; toast(`${m.name} v${r.version} en production`); render()
    },
    retireRun(id) {
      const r = X.runs.find((x) => x.id === id), m = X.models.find((x) => x.id === r.model)
      if (r.stage === "production" && r.prev) Object.assign(m, r.prev)
      m.status = "production"; r.stage = "retire"
      toast(`Retour à ${m.name} v${m.version}`); render()
    },
  }
  function applyReco(r, by) {
    r.status = "acceptee"; r.by = by
    if (r.from === today) T(r.type).rate = r.proposed
    logIt("rm.pricing", "M-DEM 3.2", `${r.id} : ${T(r.type).label} ${money(r.current)} → ${money(r.proposed)}`, by === "Automatique borné" ? "Appliquée (auto borné)" : "Acceptée par le directeur", 0, 0)
  }

  HMS.module({
    code: "aip", group: "Pilotage & IA", title: "Plateforme IA", phase: "—", spec: "§19 AIP",
    screens: [
      { id: "aip-rm", label: "Revenue management", view: views.rm },
      { id: "aip-ia", label: "Services IA", view: views.ia },
    ],
    actions,
  })
})()
