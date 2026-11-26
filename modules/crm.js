// modules/crm.js — Spec §7 CRM client et fidélité (CRM)
// Au-delà de la fiche client (écran "clients" de reception.js) : segments, fidélité, campagnes, avis,
// réclamations, dédoublonnage, consentements et RGPD, comptes entreprises. Réutilise D.guests et D.reservations.
;(() => {
  const now = () => { const t = new Date(); return `${fd(today)} ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}` }
  const CHANNELS = [["email", "E-mail"], ["sms", "SMS"], ["whatsapp", "WhatsApp"]]

  // Variantes de noms pour simuler des doublons (calculées sur les noms actuels de D.guests)
  const dupName = (id, kind) => {
    const n = G(id).name, parts = n.split(" ")
    if (kind === "abbr") return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : n.slice(0, -1)
    if (kind === "upper") return n.toUpperCase()
    return parts.length > 1 ? `Akissi ${parts.slice(1).join(" ")}` : "Akissi " + n
  }

  // ---------- Données d'exemple ----------
  D.crm = {
    tiers: [
      { code: "Classic", min: 0, perks: ["Wi-Fi premium", "Offres membres"] },
      { code: "Argent", min: 3000, perks: ["Départ tardif 14 h selon disponibilité", "Boisson de bienvenue"] },
      { code: "Or", min: 8000, perks: ["Surclassement selon disponibilité", "Départ tardif 16 h", "Accès salon exécutif (transmis au contrôle d'accès)"] },
      { code: "Platine", min: 15000, perks: ["Surclassement garanti à la réservation", "Accès salon exécutif et spa", "Petit-déjeuner offert"] },
    ],
    earn: 1, // point par tranche de 100 FCFA d'hébergement (RG-CRM-03 : après check-out et folio soldé)
    expiryMonths: 24,
    rewards: [
      { code: "LATE", label: "Départ tardif 16 h", pts: 500 },
      { code: "BKF", label: "Petit-déjeuner pour 2", pts: 900 },
      { code: "SPA", label: "Massage 60 min", pts: 1600 },
      { code: "NIGHT", label: "Nuit en Standard", pts: 5000 },
    ],
    accounts: {
      G1: { no: "FX-000101", tier: "Or", points: 9200, ytd: 9900, last: "2026-09-13", tx: [
        { date: "2026-09-13", label: "Séjour R-2012 crédité", pts: 3300 }, { date: "2026-06-02", label: "Échange : massage 60 min", pts: -1600 }, { date: "2026-03-20", label: "Séjour (historique)", pts: 4200 }] },
      G2: { no: "FX-000102", tier: "Classic", points: 450, ytd: 450, last: "2026-05-11", tx: [{ date: "2026-05-11", label: "Séjour (historique)", pts: 450 }] },
      G3: { no: "FX-000103", tier: "Argent", points: 3400, ytd: 0, last: "2024-12-18", tx: [{ date: "2024-12-18", label: "Séjour (historique)", pts: 3400 }] },
      G4: { no: "FX-000104", tier: "Argent", points: 5100, ytd: 5100, last: "2026-07-05", tx: [{ date: "2026-07-05", label: "Séjour R-1980 crédité", pts: 1800 }, { date: "2026-02-14", label: "Séjour (historique)", pts: 3300 }] },
      G6: { no: "FX-000106", tier: "Classic", points: 0, ytd: 0, last: "2026-11-25", tx: [] },
      G7: { no: "FX-000107", tier: "Classic", points: 1200, ytd: 1200, last: "2026-04-09", tx: [{ date: "2026-04-09", label: "Séjour (historique)", pts: 1200 }] },
    },
    credited: ["R-2012", "R-1980"],
    // Consentements (EF-CRM-007) : statut, date, source
    consents: {
      G1: { email: true, sms: true, whatsapp: true, groupe: true, ia: true, date: "2025-03-20", source: "Formulaire de check-in signé" },
      G2: { email: true, sms: false, whatsapp: true, groupe: false, ia: true, date: "2026-05-09", source: "Moteur de réservation (case cochée)" },
      G3: { email: false, sms: false, whatsapp: false, groupe: false, ia: false, date: "2024-12-15", source: "OTA (aucun consentement transmis)" },
      G4: { email: true, sms: false, whatsapp: true, groupe: true, ia: true, date: "2026-02-12", source: "Application mobile" },
      G5: { email: false, sms: false, whatsapp: false, groupe: false, ia: false, date: "2026-11-24", source: "Check-in (refus)" },
      G6: { email: true, sms: true, whatsapp: false, groupe: true, ia: false, date: "2026-11-25", source: "Check-in" },
      G7: { email: true, sms: true, whatsapp: true, groupe: true, ia: true, date: "2026-04-07", source: "Site direct" },
    },
    segments: [
      { id: "SEG-1", name: "VIP fidèles", crit: { vip: "oui", tier: "Argent", minStays: 0, nat: "" } },
      { id: "SEG-2", name: "Clientèle régionale", crit: { vip: "", tier: "", minStays: 0, nat: "CEDEAO" } },
      { id: "SEG-3", name: "Clients récurrents", crit: { vip: "", tier: "", minStays: 2, nat: "" } },
    ],
    campaigns: [
      { id: "CMP-07", name: "Offre fêtes de fin d'année", segment: "SEG-2", channel: "whatsapp", status: "envoyee", date: "2026-11-15", sent: 3, excluded: 1, opens: 3, bookings: 1 },
      { id: "CMP-08", name: "Week-end spa membres Or", segment: "SEG-1", channel: "email", status: "brouillon", date: null, sent: 0, excluded: 0, opens: 0, bookings: 0 },
    ],
    reviews: [
      { id: "AV-31", guest: "G4", res: "R-1980", source: "Site direct", date: "2026-07-06", nps: 9, text: "Accueil chaleureux et chambre impeccable. Le petit-déjeuner pourrait être plus varié.", sentiment: "Positif", reply: "Merci pour votre retour, nous transmettons votre remarque à l'équipe du restaurant." },
      { id: "AV-32", guest: "G1", res: "R-2012", source: "OTA Exemple A (simulé)", date: "2026-09-14", nps: 10, text: "Suite superbe, personnel attentionné, surclassement très apprécié.", sentiment: "Positif", reply: "" },
      { id: "AV-33", guest: "G3", res: null, source: "Plateforme d'avis Exemple (simulé)", date: "2026-10-02", nps: 4, text: "Climatisation bruyante la nuit et attente longue au check-in.", sentiment: "Négatif", reply: "" },
      { id: "AV-34", guest: "G7", res: null, source: "Enquête post-séjour", date: "2026-04-10", nps: 8, text: "Bon rapport qualité-prix, Wi-Fi un peu lent.", sentiment: "Neutre", reply: "" },
    ],
    complaints: [
      { id: "REC-12", guest: "G6", res: "R-2047", cat: "Bruit", desc: "Travaux bruyants à l'étage le matin.", status: "ouverte", comp: 0, opened: "2026-11-26" },
      { id: "REC-11", guest: "G4", res: "R-2044", cat: "Restauration", desc: "Commande en chambre arrivée froide.", status: "en cours", comp: 0, opened: "2026-11-25" },
      { id: "REC-09", guest: "G3", res: null, cat: "Équipement", desc: "Climatisation bruyante (lié à l'avis AV-33).", status: "resolue", comp: 10000, opened: "2026-10-02" },
    ],
    // Profils entrants (OTA, import, saisie) qui ressemblent à des profils existants (EF-CRM-005)
    dupes: [
      { id: "P-501", name: dupName("G1", "abbr"), email: G("G1").email, phone: G("G1").phone, source: "OTA Exemple A (simulé)", match: "G1", score: 96, reasons: ["E-mail identique", "Téléphone identique", "Nom proche"], points: 0, tier: "Classic", status: "a-traiter" },
      { id: "P-502", name: dupName("G4", "upper"), email: "ancien." + G("G4").email, phone: G("G4").phone, source: "Import fichier groupe", match: "G4", score: 88, reasons: ["Téléphone identique", "Nom identique (casse)"], points: 2600, tier: "Or", status: "a-traiter" },
      { id: "P-503", name: dupName("G7", "other"), email: "akissi.ehui@exemple.test", phone: "+225 07 00 00 00 70", source: "Saisie réception", match: "G7", score: 54, reasons: ["Nom proche"], points: 0, tier: "Classic", status: "a-traiter" },
    ],
    merges: [],
    gdpr: [
      { id: "RGPD-04", guest: "G6", type: "Accès", received: "2026-11-20", status: "a-traiter", idOk: false },
      { id: "RGPD-05", guest: "G3", type: "Effacement", received: "2026-11-22", status: "a-traiter", idOk: false },
      { id: "RGPD-02", guest: "G2", type: "Portabilité", received: "2026-10-30", status: "traitee", idOk: true, closed: "2026-11-03" },
    ],
    companies: [
      { id: "ENT-1", name: "Société Ivoirienne Exemple", kind: "Entreprise", taxId: "CI-0000000-A", contract: "Plan CORP-A (−15 % sur BAR)", members: ["G4", "G7"], ca: 4350000 },
      { id: "ENT-2", name: "Agence Akwaba Voyages Exemple", kind: "Agence de voyage", taxId: "IATA 00-0 0000 0", contract: "Commission 10 %, allotement 2 STD", members: ["G2", "G5"], ca: 1890000 },
      { id: "ENT-3", name: "Séminaire Transports Lagune Exemple", kind: "Groupe", taxId: "—", contract: "Bloc 6 chambres 03-05/12 (option), Grand-Bassam", members: ["G3"], ca: 0 },
    ],
    // Profil unique au niveau du tenant (EF-CRM-001) : établissements du groupe et séjours qui y ont eu lieu
    tenant: "Groupe Exemple",
    props: [
      { id: "P1", name: D.hotel, city: "Abidjan" },
      { id: "P3", name: "Hôtel Exemple Yamoussoukro", city: "Yamoussoukro" },
      { id: "P2", name: "Hôtel Exemple Plage", city: "Assinie" },
    ],
    groupStays: [
      { id: "Y-0412", guest: "G1", prop: "P3", from: "2026-06-12", to: "2026-06-14", room: "Suite", amount: 236000, extras: 41000 },
      { id: "Y-0388", guest: "G4", prop: "P3", from: "2026-03-02", to: "2026-03-05", room: "Supérieure", amount: 171000, extras: 18500 },
      { id: "Y-0371", guest: "G3", prop: "P3", from: "2026-01-20", to: "2026-01-21", room: "Standard", amount: 42000, extras: 0 },
      { id: "Y-0425", guest: "G6", prop: "P3", from: "2026-08-08", to: "2026-08-10", room: "Standard", amount: 84000, extras: 12000 },
    ],
    // Préférences structurées (EF-CRM-003), recopiées dans la fiche réception pour être signalées aux arrivées
    prefs: {
      G1: { boisson: "Eau de coco fraîche", langue: "Français" },
      G2: { langue: "Français" },
      G4: { allergies: "Arachides", oreiller: "Moelleux", langue: "Français" },
      G6: { etage: "Bas", allergies: "Fruits de mer", langue: "Bambara, français" },
    },
    prefSent: {},
    // Statuts VIP et consignes d'accueil (EF-CRM-006)
    vip: {
      G1: { level: "VIP 2", welcome: "Accueil par le directeur de l'hébergement", gift: "Corbeille de fruits et mot du directeur" },
      G4: { level: "VIP 1", welcome: "Accueil personnalisé par le chef de réception", gift: "Bouteille d'eau et assortiment de fruits" },
    },
    vipTasks: {},
  }
  const S = D.crm

  // ---------- Calculs ----------
  const acct = (id) => S.accounts[id]
  const tierOf = (code) => S.tiers.find((t) => t.code === code)
  const tierRank = (code) => S.tiers.findIndex((t) => t.code === code)
  const tierFor = (ytd) => [...S.tiers].reverse().find((t) => ytd >= t.min).code
  const cons = (id) => S.consents[id] || { email: false, sms: false, whatsapp: false, groupe: false, ia: false, date: "—", source: "Aucun" }
  const staysOf = (id) => D.reservations.filter((r) => r.guest === id && !["annulee", "noshow", "deloge"].includes(r.status))
  const doneStays = (id) => D.reservations.filter((r) => r.guest === id && r.status === "partie")
  const revenueOf = (id) => staysOf(id).reduce((s, r) => s + folio(r).total, 0)
  const CEDEAO = ["Côte d'Ivoire", "Sénégal", "Ghana", "Mali", "Burkina Faso", "Togo", "Bénin", "Niger", "Guinée", "Nigeria"]
  const inSegment = (g, c) => (c.vip === "" || (c.vip === "oui") === !!g.vip)
    && (!c.tier || (acct(g.id) && tierRank(acct(g.id).tier) >= tierRank(c.tier)))
    && staysOf(g.id).length >= (c.minStays || 0)
    && (!c.nat || (c.nat === "CEDEAO" ? CEDEAO.includes(g.nationality) : c.nat === "Hors CEDEAO" ? !CEDEAO.includes(g.nationality) : g.nationality === c.nat))
  const members = (seg) => D.guests.filter((g) => !g.erased && inSegment(g, seg.crit))
  const seg = (id) => S.segments.find((s) => s.id === id)
  const critText = (c) => [c.vip && `VIP : ${c.vip}`, c.tier && `niveau ≥ ${c.tier}`, c.minStays && `≥ ${c.minStays} séjours`, c.nat && `nationalité : ${c.nat}`].filter(Boolean).join(" · ") || "Tous les profils"
  const expiring = (a) => nights(a.last, today) > 30.4 * (S.expiryMonths - 2)
  const due = (g) => addDays(g.received, 30)
  const pointsFor = (r) => Math.floor((nights(r.from, r.to) * r.rate) / 100) * S.earn
  // Valeur client et attrition (IA simulée, déterministe)
  const predict = (g) => {
    const rev = revenueOf(g.id), n = staysOf(g.id).length, a = acct(g.id)
    const clv = Math.round((rev * (1.6 + n * 0.4) + (a ? a.points * 20 : 0)) / 1000) * 1000
    const since = a ? nights(a.last, today) : 400
    const churn = Math.min(92, Math.max(6, Math.round(since / 8) - n * 6 + (g.vip ? -8 : 10)))
    return { clv, churn }
  }

  const PREF_CATS = [
    ["oreiller", "Oreiller", ["", "Ferme", "Moelleux", "Hypoallergénique"]],
    ["etage", "Étage", ["", "Bas", "Élevé", "Proche ascenseur"]],
    ["lit", "Type de lit", ["", "Double", "Twin", "King", "Lit bébé"]],
    ["allergies", "Allergies alimentaires déclarées", null],
    ["boisson", "Boissons", null],
    ["langue", "Langue", ["", "Français", "English", "Español", "العربية", "Bambara, français"]],
  ]
  const VIP_LEVELS = ["VIP 1", "VIP 2", "VIP 3"]
  const prefsOf = (id) => S.prefs[id] || {}
  const prefLabel = (k) => PREF_CATS.find((c) => c[0] === k)[1]
  const PREF_RE = new RegExp("^(" + PREF_CATS.map((c) => c[1]).join("|") + ") : ")
  // Recopie dans G(id).prefs (lu par la réception, le check-in et l'arrivée) ; idempotent
  const syncPrefs = (id) => {
    const g = G(id)
    if (!g) return
    g.prefs = g.prefs.filter((x) => !PREF_RE.test(x)).concat(Object.entries(prefsOf(id)).filter(([, v]) => v).map(([k, v]) => `${prefLabel(k)} : ${v}`))
  }
  Object.keys(S.prefs).forEach(syncPrefs)
  const prefTags = (id) => {
    const p = prefsOf(id), e = Object.entries(p).filter(([, v]) => v)
    return e.length ? e.map(([k, v]) => badge(`${prefLabel(k)} : ${v}`, k === "allergies" ? "bad" : "info")).join(" ") : `<span class="muted">Aucune préférence structurée</span>`
  }
  const prop = (pid) => S.props.find((x) => x.id === pid)
  const tenantId = (id) => "CLI-" + String(1000 + Number(String(id).replace(/\D/g, "") || 0)).padStart(5, "0")
  // Séjours du client dans tout le groupe : ceux de cet établissement (D.reservations) et ceux des autres (S.groupStays)
  const groupStaysOf = (id) => [
    ...D.reservations.filter((r) => r.guest === id).map((r) => { const f = folio(r), lodging = nights(r.from, r.to) * r.rate
      return { id: r.id, prop: "P1", from: r.from, to: r.to, room: T(r.type).label, amount: ["annulee", "noshow", "deloge"].includes(r.status) ? 0 : f.total, extras: f.total - lodging, status: r.status } }),
    ...S.groupStays.filter((x) => x.guest === id).map((x) => ({ ...x, amount: x.amount + x.extras, status: "partie" })),
  ].sort((a, b) => (a.from < b.from ? 1 : -1))
  // RG-CRM-01 : un séjour d'un autre établissement n'est visible que si le partage groupe est consenti
  const visibleFrom = (row, viewer, id) => row.prop === viewer || cons(id).groupe
  const upcoming = (id) => D.reservations.filter((r) => r.guest === id && ["confirmee", "arrivee"].includes(r.status))
  const soonArrivals = () => D.reservations.filter((r) => r.status === "confirmee" && r.from >= today && r.from <= addDays(today, 3) || r.status === "arrivee" && r.from === today)
  const vipTask = (rid) => (S.vipTasks[rid] = S.vipTasks[rid] || { gift: false, welcome: false })

  // ---------- Écrans ----------
  const views = {
    crm(p) {
      const tab = p[0] || "synthese"
      const body = { synthese: syntheseTab, profil: profilTab, arrivees: arriveesTab, segments: segmentsTab, fidelite: fideliteTab, campagnes: campagnesTab, avis: avisTab }[tab] || syntheseTab
      return pageHead("Fidélité et marketing", "Programme de fidélité, segments, campagnes et avis clients (données d'exemple). Les profils détaillés restent dans Fiches clients.",
        btn("Fiches clients", "go('clients')", "ghost"))
        + subtabs("crm", [["synthese", "Synthèse et IA"], ["profil", "Profil 360"], ["arrivees", "VIP et préférences des arrivées"], ["segments", "Segments"], ["fidelite", "Programme de fidélité"], ["campagnes", "Campagnes"], ["avis", "Avis clients"]], tab)
        + body(p)
    },
    relation(p) {
      const tab = p[0] || "reclamations"
      const body = { reclamations: reclamTab, doublons: doublonsTab, rgpd: rgpdTab, comptes: comptesTab }[tab] || reclamTab
      return pageHead("Relation client et conformité", "Réclamations, doublons de profils, consentements et demandes RGPD, comptes entreprises et agences.")
        + subtabs("crm-relation", [["reclamations", "Réclamations"], ["doublons", "Doublons"], ["rgpd", "Consentements et RGPD"], ["comptes", "Entreprises et agences"]], tab)
        + body(p)
    },
  }

  function syntheseTab() {
    const gs = D.guests.filter((g) => !g.erased)
    const recurring = gs.filter((g) => staysOf(g.id).length >= 2).length
    const active = Object.entries(S.accounts).filter(([, a]) => nights(a.last, today) <= 365).length
    const optin = gs.filter((g) => CHANNELS.some(([c]) => cons(g.id)[c])).length
    const scores = S.reviews.map((r) => r.nps)
    const nps = Math.round(((scores.filter((s) => s >= 9).length - scores.filter((s) => s <= 6).length) / scores.length) * 100)
    const preds = gs.map((g) => ({ g, ...predict(g) }))
    const clvAvg = preds.reduce((s, x) => s + x.clv, 0) / preds.length
    // Next-best-offer : clients en séjour ou arrivant, avec consentement au profilage (RG-CRM-06)
    const targets = D.reservations.filter((r) => ["arrivee", "confirmee"].includes(r.status) && r.from <= addDays(today, 3))
    const offer = (r) => {
      const g = G(r.guest), a = acct(g.id)
      if (r.type !== "SUI" && a && tierRank(a.tier) >= 2) return "Surclassement en Suite offert (niveau " + a.tier + ")"
      if (g.prefs.some((x) => /bébé/i.test(x))) return "Formule famille : dîner enfant offert"
      if (nights(r.from, r.to) >= 3) return "Forfait Détente : massage 60 min à −20 %"
      return "Petit-déjeuner pour 9 000 FCFA au lieu de 12 000"
    }
    const tiers = S.tiers.map((t) => ({ label: t.code, value: Object.values(S.accounts).filter((a) => a.tier === t.code).length })).filter((x) => x.value)
    const scored = preds.filter((x) => cons(x.g.id).ia)
    const bucket = (x) => (x.churn >= 50 ? "Réactivation" : x.clv > 1000000 ? "Fidéliser" : "Développer")
    const buckets = ["Fidéliser", "Développer", "Réactivation"].map((label) => ({ label, value: scored.filter((x) => bucket(x) === label).length })).filter((x) => x.value)
    const npsSeries = [...S.reviews].sort((a, b) => (a.date < b.date ? -1 : 1)).map((r) => r.nps)
    return `<div class="grid g4" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))">
      ${stat({ label: "Clients récurrents", value: pct((recurring / gs.length) * 100), icon: "refresh", hint: `${recurring} clients avec au moins 2 séjours`, route: "crm/segments" })}
      ${stat({ label: "Valeur vie client (CLV)", value: money(clvAvg), icon: "coins", hint: "moyenne prévisionnelle (exemple)" })}
      ${stat({ label: "Membres fidélité actifs", value: String(active), icon: "heart", hint: `séjour sur 12 mois, ${Object.keys(S.accounts).length} membres`, route: "crm/fidelite" })}
      ${stat({ label: "Opt-in marketing", value: pct((optin / gs.length) * 100), icon: "mail", hint: "au moins un canal consenti", route: "crm-relation/rgpd" })}
      ${stat({ label: "NPS post-séjour", value: (nps > 0 ? "+" : "") + nps, icon: "star", hint: `${scores.length} réponses · notes en courbe`, trend: npsSeries, route: "crm/avis" })}
    </div>
    <div class="dash" style="margin-top:16px">
      <div class="w8">${section("Personnalisation et next-best-offer", aiBox("Offres recommandées pour les séjours en cours et à venir", "Recommandations calculées à partir du profil, du séjour et du niveau de fidélité. Les clients sans consentement au profilage IA reçoivent les règles marketing standard (repli).")
      + tbl(["Client", "Séjour", "Profilage IA", "Offre proposée", ""], targets.map((r) => {
        const g = G(r.guest), ok = cons(g.id).ia, sent = (ui.crmOffers || []).includes(r.id)
        return [guestLink(g.id) + vip(g), `${esc(r.id)} · ${fd(r.from)} → ${fd(r.to)}`, ok ? badge("Consenti", "ok") : badge("Refusé", "outline"),
          ok ? esc(offer(r)) : `<span class="muted">Règle standard : boisson de bienvenue</span>`,
          sent ? badge("Proposée", "ok") : btn("Proposer", `A.crm.offer(${q(r.id)})`, "ghost sm")]
      }), "Aucun séjour."))}</div>
      <div class="w4">${section("Membres par niveau", donut(tiers, { fmt: (v) => v + " membre(s)", center: String(Object.keys(S.accounts).length), sub: "membres" }), btn("Programme", "go('crm/fidelite')", "ghost sm"))}</div>
      <div class="w8">${section("Valeur client et risque d'attrition", aiBox("Prédiction (modèle simulé)", "Valeur vie prévisionnelle et probabilité de non-retour sous 12 mois, utilisées pour cibler les campagnes de réactivation. Calcul limité aux profils ayant consenti au profilage.")
      + tbl(["Client", "Niveau", "#CA cumulé", "#CLV prévisionnelle", "#Risque d'attrition", "Segment suggéré"], scored.sort((a, b) => b.clv - a.clv).map((x) => [
        guestLink(x.g.id) + vip(x.g), esc(acct(x.g.id)?.tier || "Non membre"), money(revenueOf(x.g.id)), money(x.clv), x.churn + " %",
        x.churn >= 50 ? badge("Réactivation", "warn") : x.clv > 1000000 ? badge("Fidéliser", "ok") : badge("Développer", "info")])))}</div>
      <div class="w4">${section("Segments suggérés par l'IA", donut(buckets, { fmt: (v) => v + " client(s)", center: String(scored.length), sub: "profils" }) + `<p class="muted" style="margin:8px 0 0">Profils ayant consenti au profilage (simulé).</p>`)}</div>
    </div>`
  }

  function profilTab(p) {
    const gs = D.guests.filter((g) => !g.erased)
    const g = gs.find((x) => x.id === p[1]) || gs[0]
    const id = g.id, c = cons(id), a = acct(id), viewer = ui.crmViewer || "P1"
    const rows = groupStaysOf(id), vis = rows.filter((r) => visibleFrom(r, viewer, id)), hidden = rows.length - vis.length
    const ca = vis.reduce((s, r) => s + r.amount, 0), spend = vis.reduce((s, r) => s + Math.max(0, r.extras), 0)
    const revs = S.reviews.filter((r) => r.guest === id), comps = S.complaints.filter((x) => x.guest === id)
    const v = S.vip[id] || {}, up = upcoming(id)
    const left = `<h3>Profils</h3>` + listItems(gs.map((x) => ({ id: x.id, title: x.name, sub: `${tenantId(x.id)} · ${x.nationality || "—"}`, badge: vip(x) })), id, "crm/profil")
    const right = card("", `<div class="row between"><span class="big">${esc(g.name)}</span><span class="row">${vip(g)}${btn("Fiche réception", `go('clients/${esc(id)}')`, "ghost sm")}</span></div>
      <div class="muted">Profil unique ${esc(tenantId(id))} au niveau du tenant « ${esc(S.tenant)} », partagé entre ${S.props.length} établissements selon les consentements · EF-CRM-001</div>
      <div class="row" style="margin-top:10px"><label for="crm-viewer">Consulter depuis</label>${select("crm-viewer", S.props.map((x) => [x.id, `${x.name} (${x.city})`]), viewer, `onchange="ui.crmViewer=this.value;render()"`)}
        ${c.groupe ? badge("Partage groupe consenti", "ok") : badge("Partage groupe refusé", "outline")}
        ${btn(c.groupe ? "Retirer le partage groupe" : "Enregistrer le consentement « partage groupe »", `A.crm.consent(${q(id)}, 'groupe', ${!c.groupe})`, "ghost sm")}</div>
      ${hidden ? `<div class="err" style="margin-top:10px">${hidden} séjour(s) dans d'autres établissements masqué(s) : consentement « partage groupe » absent (RG-CRM-01).</div>` : ""}

      <h3>Historique et valeur client</h3>
      <div class="grid g4">${stat({ label: "CA cumulé", value: money(ca), icon: "coins", hint: "séjours visibles, extras inclus", trend: vis.length > 1 ? [...vis].reverse().map((r) => r.amount) : null })}${stat({ label: "Dépenses annexes", value: money(spend), icon: "utensils", hint: "restaurant, bar, services" })}${stat({ label: "Séjours", value: String(vis.filter((r) => !["annulee", "noshow", "deloge"].includes(r.status)).length), icon: "bed", hint: "valides, tous établissements visibles" })}${stat({ label: "Fidélité", value: a ? `${a.tier} · ${a.points.toLocaleString("fr-FR")} pts` : "Non membre", icon: "heart", hint: a ? a.no : "" })}</div>
      ${tbl(["Séjour", "Établissement", "Dates", "Chambre", "Statut", "#Dépenses annexes", "#Total"], vis.map((r) => [esc(r.id), esc(prop(r.prop).name), `${fd(r.from)}/${r.from.slice(2, 4)} → ${fd(r.to)}`, esc(r.room), pill(STATUS, r.status), money(Math.max(0, r.extras)), money(r.amount)]), "Aucun séjour visible.")}
      <h3>Avis et réclamations</h3>
      ${tbl(["Date", "Nature", "Détail", "Suite"], [
        ...revs.map((r) => [fd(r.date) + "/" + r.date.slice(2, 4), badge("Avis NPS " + r.nps, r.nps >= 9 ? "ok" : r.nps <= 6 ? "bad" : "warn"), esc(r.text), r.reply ? "Réponse publiée" : `<button class="link" onclick="go('crm/avis')">Répondre</button>`]),
        ...comps.map((x) => [fd(x.opened) + "/" + x.opened.slice(2, 4), badge("Réclamation " + x.cat, "outline"), esc(x.desc), x.status === "resolue" ? `Résolue${x.comp ? " · " + money(x.comp) : ""}` : `<button class="link" onclick="go('crm-relation/reclamations')">${esc(x.status)}</button>`]),
      ], "Aucun avis ni réclamation.")}
      <p class="muted">EF-CRM-004</p>

      <h3>Préférences</h3>
      <div class="tags">${prefTags(id)}</div>
      ${form([...PREF_CATS.map(([k, l, opts]) => field("crm-p-" + k, l, opts ? select("crm-p-" + k, opts.map((o) => [o, o || "—"]), prefsOf(id)[k] || "") : input("crm-p-" + k, prefsOf(id)[k] || "", k === "allergies" ? 'placeholder="Ex. arachides, gluten"' : ""))),
        `<div class="full row">${btn("Enregistrer les préférences", `A.crm.savePrefs(${q(id)})`)}<span class="muted">Signalées sur chaque réservation, au check-in et au housekeeping · EF-CRM-003</span></div>`])}
      ${up.length ? tbl(["Réservation à venir", "Dates", "Signalement"], up.map((r) => [esc(r.id), `${fd(r.from)} → ${fd(r.to)}`, prefTags(id) + (S.prefSent[r.id] ? " " + badge("Transmis HK et cuisine", "ok") : "")])) : ""}

      <h3>Statut VIP et consignes</h3>
      ${form([
        `<div style="align-self:end"><label class="row" style="color:var(--ink)"><input type="checkbox" id="crm-v-on" ${g.vip ? "checked" : ""}> Client VIP</label></div>`,
        field("crm-v-level", "Niveau", select("crm-v-level", VIP_LEVELS, v.level || "VIP 1")),
        field("crm-v-welcome", "Consigne d'accueil", input("crm-v-welcome", v.welcome || "", 'placeholder="Ex. accueil par le directeur"'), "full"),
        field("crm-v-gift", "Cadeau d'arrivée", input("crm-v-gift", v.gift || "", 'placeholder="Ex. corbeille de fruits"'), "full"),
        `<div class="full row">${btn("Enregistrer le statut VIP", `A.crm.saveVip(${q(id)})`)}<span class="muted">Génère les alertes accueil et cadeau des arrivées · EF-CRM-006</span></div>`])}`)
    return split(left, right)
  }

  function arriveesTab() {
    const list = soonArrivals().sort((a, b) => (a.from < b.from ? -1 : 1))
    const vips = list.filter((r) => G(r.guest).vip)
    const late = vips.filter((r) => r.from === today && (!vipTask(r.id).gift || !vipTask(r.id).welcome))
    const allergies = list.filter((r) => prefsOf(r.guest).allergies)
    return `<div class="grid g4">${stat({ label: "Arrivées J à J+3", value: String(list.length), icon: "key", hint: "réservations confirmées" })}${stat({ label: "Arrivées VIP", value: String(vips.length), icon: "star", hint: "alertes accueil et cadeau" })}${stat({ label: "Allergies déclarées", value: String(allergies.length), icon: "alert", hint: "à signaler à la cuisine" })}</div>`
      + late.map((r) => `<div class="err" style="margin-top:10px">Alerte VIP : ${esc(G(r.guest).name)} (${esc(S.vip[r.guest]?.level || "VIP")}) arrive aujourd'hui, ${[!vipTask(r.id).gift && "cadeau non préparé", !vipTask(r.id).welcome && "accueil non confirmé"].filter(Boolean).join(" et ")}.</div>`).join("")
      + `<h2>Alertes VIP</h2>`
      + tbl(["Arrivée", "Client", "Niveau", "Consigne d'accueil", "Cadeau", "Cadeau prêt", "Accueil fait"], vips.map((r) => {
        const v = S.vip[r.guest] || {}, t = vipTask(r.id)
        return [`${fd(r.from)} · ${esc(r.id)}`, guestLink(r.guest) + vip(G(r.guest)), esc(v.level || "À définir"), v.welcome ? esc(v.welcome) : `<button class="link" onclick="go('crm/profil/${esc(r.guest)}')">À configurer</button>`, esc(v.gift || "—"),
          `<input type="checkbox" aria-label="Cadeau prêt ${esc(r.id)}" ${t.gift ? "checked" : ""} onchange="A.crm.vipTask(${q(r.id)}, 'gift', this.checked)">`,
          `<input type="checkbox" aria-label="Accueil fait ${esc(r.id)}" ${t.welcome ? "checked" : ""} onchange="A.crm.vipTask(${q(r.id)}, 'welcome', this.checked)">`]
      }), "Aucune arrivée VIP sur la période.")
      + `<p class="muted">Le bandeau VIP apparaît aussi sur l'arrivée et le check-in (US-CRM-01). EF-CRM-006</p>`
      + `<h2>Préférences à signaler</h2>`
      + tbl(["Arrivée", "Client", "Type", "Préférences", ""], list.map((r) => [`${fd(r.from)} · ${esc(r.id)}`, guestLink(r.guest) + vip(G(r.guest)), esc(T(r.type).label), prefTags(r.guest) + (G(r.guest).prefs.filter((x) => !PREF_RE.test(x)).length ? `<div class="muted">Notes : ${esc(G(r.guest).prefs.filter((x) => !PREF_RE.test(x)).join(", "))}</div>` : ""),
        S.prefSent[r.id] ? badge("Transmis", "ok") : btn("Transmettre au HK et à la cuisine", `A.crm.sendPrefs(${q(r.id)})`, "ghost sm")]), "Aucune arrivée.")
      + `<p class="muted">Préférences transmises au housekeeping avant l'arrivée ; une allergie déclarée est signalée à la cuisine (simulé). EF-CRM-003</p>`
  }

  function segmentsTab(p) {
    const cur = seg(p[1]) || S.segments[0]
    const ms = members(cur)
    const left = listItems(S.segments.map((s) => ({ id: s.id, title: s.name, sub: `${members(s).length} membre(s) · ${critText(s.crit)}` })), cur.id, "crm/segments")
      + card("Nouveau segment", form([
        field("crm-s-name", "Nom", input("crm-s-name", "", 'placeholder="Ex. Clients ivoiriens VIP"')),
        field("crm-s-vip", "VIP", select("crm-s-vip", [["", "Indifférent"], ["oui", "Oui"], ["non", "Non"]], "")),
        field("crm-s-tier", "Niveau minimum", select("crm-s-tier", [["", "Indifférent"], ...S.tiers.map((t) => t.code)], "")),
        field("crm-s-nat", "Nationalité", select("crm-s-nat", [["", "Indifférente"], "CEDEAO", "Hors CEDEAO", ...new Set(D.guests.map((g) => g.nationality).filter(Boolean))], "")),
        field("crm-s-min", "Séjours minimum", input("crm-s-min", "0", 'type="number" min="0"')),
        `<div class="full">${btn("Créer le segment", "A.crm.addSegment()")}</div>`,
      ]), 'style="margin-top:14px"')
    return `<p class="muted">Segmentation dynamique : les membres sont recalculés à chaque affichage (EF-CRM-011).</p>` + split(left, card("", `
      <div class="row between"><span class="big">${esc(cur.name)}</span>${badge(ms.length + " membre(s)", "info")}</div>
      <p class="muted">Critères : ${esc(critText(cur.crit))}</p>
      ${tbl(["Client", "Nationalité", "Niveau", "#Séjours", "Consentements marketing"], ms.map((g) => [guestLink(g.id) + vip(g), esc(g.nationality || "—"), esc(acct(g.id)?.tier || "—"), staysOf(g.id).length,
        CHANNELS.map(([c, l]) => (cons(g.id)[c] ? badge(l, "ok") : badge(l, "outline"))).join(" ")]), "Aucun profil ne correspond.")}
      <div class="row" style="margin-top:12px">${btn("Créer une campagne sur ce segment", `ui.crmCmpSeg=${q(cur.id)};go('crm/campagnes')`)}${btn("Exporter (CSV simulé)", `toast('Export : ${ms.filter((g) => CHANNELS.some(([c]) => cons(g.id)[c])).length} profil(s) consentant(s) sur ${ms.length}, les autres sont exclus (simulé)')`, "ghost")}</div>`))
  }

  function fideliteTab(p) {
    const ids = Object.keys(S.accounts).filter((id) => G(id) && !G(id).erased)
    const id = S.accounts[p[1]] ? p[1] : ids[0]
    const a = acct(id), g = G(id), t = tierOf(a.tier), next = S.tiers[tierRank(a.tier) + 1]
    const toCredit = D.reservations.filter((r) => r.guest === id && ["arrivee", "partie"].includes(r.status) && !S.credited.includes(r.id))
    const left = `<h3>Membres</h3>` + listItems(ids.map((x) => ({ id: x, title: G(x).name, sub: `${acct(x).no} · ${acct(x).points.toLocaleString("fr-FR")} pts`, badge: " " + badge(acct(x).tier, tierRank(acct(x).tier) >= 2 ? "info" : "outline") })), id, "crm/fidelite")
      + `<p class="muted">Règle d'accumulation : ${S.earn} point par tranche de 100 FCFA d'hébergement, crédité après check-out et folio soldé (RG-CRM-03) ; expiration après ${S.expiryMonths} mois d'inactivité. EF-CRM-009</p>`
      + `<h3>Niveaux</h3>` + tbl(["Niveau", "#Seuil 12 mois", "Avantages"], S.tiers.map((x) => [`<strong>${esc(x.code)}</strong>`, x.min.toLocaleString("fr-FR") + " pts", `<span class="muted">${esc(x.perks.join(" · "))}</span>`]))
    const right = card("", `<div class="row between"><span class="big">${guestLink(id)}</span>${badge(a.tier, tierRank(a.tier) >= 2 ? "info" : "outline")}</div>
      <div class="muted">Carte ${esc(a.no)} · dernière activité ${fd(a.last)}/${a.last.slice(2, 4)}</div>
      <div class="grid" style="margin:14px 0">${stat({ label: "Solde", value: a.points.toLocaleString("fr-FR") + " pts", icon: "coins", hint: "points échangeables" })}${stat({ label: "Cumul 12 mois", value: a.ytd.toLocaleString("fr-FR") + " pts", icon: "trend", hint: next ? `${(next.min - a.ytd).toLocaleString("fr-FR")} pts avant ${next.code}` : "niveau maximal" })}</div>
      ${expiring(a) ? `<div class="err">Aucune activité depuis le ${fd(a.last)}/${a.last.slice(0, 4)} : ${a.points.toLocaleString("fr-FR")} points expirent après ${S.expiryMonths} mois d'inactivité (RG-CRM-04).</div>` : ""}
      <h3>Avantages du niveau</h3><div class="tags">${t.perks.map((x) => badge(x, "outline")).join(" ")}</div>
      ${tierRank(a.tier) >= 2 ? `<p class="muted">Droit d'accès « salon exécutif » transmis au contrôle d'accès pour les séjours en cours (EF-CRM-010).</p>` : ""}
      <h3>Séjours à créditer</h3>
      ${tbl(["Séjour", "Dates", "#Points", "État du folio", ""], toCredit.map((r) => {
        const settled = r.status === "partie" && folio(r).balance <= 0
        return [esc(r.id), `${fd(r.from)} → ${fd(r.to)}`, pointsFor(r).toLocaleString("fr-FR"), r.status === "arrivee" ? badge("En séjour", "info") : settled ? badge("Soldé", "ok") : badge("Solde dû", "warn"),
          settled ? btn("Créditer", `A.crm.credit(${q(r.id)})`, "sm") : `<span class="muted">Crédit après check-out et folio soldé (RG-CRM-03)</span>`]
      }), "Aucun séjour en attente de crédit.")}
      <h3>Échanger des points</h3>
      <div class="row" style="flex-wrap:nowrap">${select("crm-rw", S.rewards.map((r) => [r.code, `${r.label} — ${r.pts.toLocaleString("fr-FR")} pts`]), "LATE")}${btn("Échanger", `A.crm.redeem(${q(id)})`)}</div>
      <h3>Mouvements</h3>
      ${tbl(["Date", "Opération", "#Points"], a.tx.map((x) => [fd(x.date) + "/" + x.date.slice(2, 4), esc(x.label), (x.pts > 0 ? "+" : "") + x.pts.toLocaleString("fr-FR")]), "Aucun mouvement.")}
      <div class="row" style="margin-top:12px">${btn("Ajustement manuel +500 pts (geste commercial)", `A.crm.adjust(${q(id)}, 500)`, "ghost")}</div>`)
    const nonMembers = D.guests.filter((x) => !S.accounts[x.id] && !x.erased)
    return split(left, right) + (nonMembers.length ? `<h2>Clients non membres</h2>${tbl(["Client", "Nationalité", ""], nonMembers.map((x) => [guestLink(x.id), esc(x.nationality || "—"), btn("Inscrire au programme", `A.crm.enroll(${q(x.id)})`, "ghost sm")]))}` : "")
  }

  function campagnesTab() {
    const segOpt = S.segments.map((s) => [s.id, `${s.name} (${members(s).length})`])
    return tbl(["Réf.", "Campagne", "Segment", "Canal", "Statut", "#Envoyés", "#Exclus (consentement)", "#Ouvertures", "#Réservations", ""], S.campaigns.map((c) => [
      esc(c.id), `<strong>${esc(c.name)}</strong>`, esc(seg(c.segment)?.name || "—"), esc(Object.fromEntries(CHANNELS)[c.channel]),
      c.status === "envoyee" ? badge(`Envoyée ${fd(c.date)}`, "ok") : badge("Brouillon", "outline"), c.sent, c.excluded, c.opens, c.bookings,
      c.status === "brouillon" ? btn("Envoyer (simulé)", `A.crm.send(${q(c.id)})`, "sm") : "",
    ])) + `<p class="muted">Envoi par plateformes e-mail, SMS et WhatsApp simulées. Seuls les profils ayant consenti au canal choisi reçoivent le message ; les autres sont exclus et comptés (EF-CRM-007, EF-CRM-011).</p>
      <h2>Nouvelle campagne</h2>
      ${card("", form([
        field("crm-c-name", "Nom", input("crm-c-name", "", 'placeholder="Ex. Relance clients inactifs"')),
        field("crm-c-seg", "Segment", select("crm-c-seg", segOpt, ui.crmCmpSeg || S.segments[0].id)),
        field("crm-c-ch", "Canal", select("crm-c-ch", CHANNELS, "email")),
        field("crm-c-msg", "Message", input("crm-c-msg", "Profitez de −15 % sur votre prochain séjour avec le code MEMBRE15.")),
        `<div class="full row">${btn("Enregistrer en brouillon", "A.crm.addCampaign()")}</div>`,
      ]))}`
  }

  function avisTab() {
    const byNps = (min, max) => S.reviews.filter((r) => r.nps >= min && r.nps <= max).length
    const tot = S.reviews.length || 1, npsVal = Math.round(((byNps(9, 10) - byNps(0, 6)) / tot) * 100)
    return `<div class="dash"><div class="w8"><div class="grid g4">${stat({ label: "Promoteurs (9-10)", value: String(byNps(9, 10)), icon: "star", hint: "avis post-séjour" })}${stat({ label: "Passifs (7-8)", value: String(byNps(7, 8)), icon: "message", hint: pct((byNps(7, 8) / tot) * 100) + " des avis" })}${stat({ label: "Détracteurs (0-6)", value: String(byNps(0, 6)), icon: "alert", hint: "à traiter en priorité" })}</div></div>
      <div class="w4">${section("NPS post-séjour", `<div class="row" style="gap:16px;flex-wrap:nowrap">${gauge(Math.max(0, npsVal), "NPS")}<div><div class="stat-val">${npsVal > 0 ? "+" : ""}${npsVal}</div><div class="muted">${S.reviews.length} avis (exemple)</div></div></div>`)}</div></div>`
      + `<p class="muted">Avis collectés après le séjour et reliés au profil (EF-CRM-014). Sentiment analysé par l'IA (simulé). Plateformes d'avis simulées.</p>`
      + S.reviews.map((r) => card("", `<div class="row between"><span>${guestLink(r.guest)} <span class="muted">· ${esc(r.source)} · ${fd(r.date)}/${r.date.slice(2, 4)}</span></span>
          <span class="row">${badge("NPS " + r.nps, r.nps >= 9 ? "ok" : r.nps <= 6 ? "bad" : "warn")}${badge("Sentiment : " + r.sentiment + " · IA", "outline")}</span></div>
        <p>${esc(r.text)}</p>
        ${r.reply ? `<p class="muted"><strong>Réponse de l'hôtel :</strong> ${esc(r.reply)}</p>` : `
          ${aiBox("Réponse proposée", draftReply(r))}
          <div class="row" style="margin-top:8px;flex-wrap:nowrap"><input id="crm-rep-${esc(r.id)}" value="${esc(draftReply(r))}" aria-label="Réponse">${btn("Publier la réponse", `A.crm.reply(${q(r.id)})`)}</div>
          ${r.nps <= 6 && !S.complaints.some((c) => c.review === r.id) ? `<div class="row" style="margin-top:8px">${btn("Ouvrir une réclamation", `A.crm.fromReview(${q(r.id)})`, "ghost sm")}</div>` : ""}`}`, 'style="margin-bottom:12px"')).join("")
  }
  const draftReply = (r) => r.nps <= 6
    ? `Nous sommes désolés pour ces désagréments. Votre remarque a été transmise à la maintenance et à la réception ; nous serions heureux de vous accueillir à nouveau dans de meilleures conditions.`
    : `Merci pour votre avis chaleureux. Toute l'équipe de ${D.hotel} se réjouit de vous accueillir à nouveau.`

  function reclamTab() {
    const STAT = { ouverte: ["Ouverte", "warn"], "en cours": ["En cours", "info"], resolue: ["Résolue", "ok"] }
    const open = S.complaints.filter((c) => c.status !== "resolue")
    const byCat = Object.entries(S.complaints.reduce((m, c) => ((m[c.cat] = (m[c.cat] || 0) + 1), m), {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
    const byStatus = Object.entries(STAT).map(([k, [label]]) => ({ label, value: S.complaints.filter((c) => c.status === k).length }))
    return `<div class="grid g4">
        ${stat({ label: "Réclamations ouvertes", value: String(open.length), icon: "alert", hint: `${S.complaints.filter((c) => c.status === "ouverte").length} non prises en charge` })}
        ${stat({ label: "Résolues", value: String(S.complaints.filter((c) => c.status === "resolue").length), icon: "check", hint: `sur ${S.complaints.length} réclamations` })}
        ${stat({ label: "Compensations accordées", value: money(S.complaints.reduce((s, c) => s + c.comp, 0)), icon: "wallet", hint: "gestes commerciaux (exemple)" })}
        ${stat({ label: "Avis négatifs", value: String(S.reviews.filter((r) => r.nps <= 6).length), icon: "message", hint: "NPS 0 à 6", route: "crm/avis" })}
      </div>
      <div class="dash" style="margin-top:16px">
      <div class="w12">${section("Suivi", tbl(["Réf.", "Client", "Séjour", "Catégorie", "Description", "Statut", "#Compensation", ""], S.complaints.map((c) => {
        const r = c.res && R(c.res)
        return [esc(c.id), guestLink(c.guest) + vip(G(c.guest)), r ? `${esc(r.id)}${r.status === "arrivee" ? ` · ch. ${esc(r.room)}` : ""}` : "—", esc(c.cat), esc(c.desc), badge(...STAT[c.status]), c.comp ? money(c.comp) : "—",
          c.status === "resolue" ? "" : `<span class="row" style="flex-wrap:nowrap">${c.status === "ouverte" ? btn("Prendre en charge", `A.crm.cStatus(${q(c.id)}, 'en cours')`, "ghost sm") : ""}
            ${btn("Résoudre + geste", `A.crm.resolve(${q(c.id)})`, "sm")}</span>`]
      })) + `<p class="muted">Une compensation sur un séjour en cours est imputée au folio du client (ligne négative) ; sinon un avoir est émis (EF-CRM-012).</p>`)}</div>
      <div class="w4">${section("Par statut", donut(byStatus, { fmt: (v) => v, center: String(S.complaints.length), sub: "réclamations" }))}</div>
      <div class="w4">${section("Par catégorie", bars(byCat, (v) => v))}</div>
      <div class="w4">${section("Nouvelle réclamation", form([
        field("crm-r-guest", "Client", select("crm-r-guest", D.guests.filter((g) => !g.erased).map((g) => [g.id, g.name]), "G5")),
        field("crm-r-cat", "Catégorie", select("crm-r-cat", ["Bruit", "Propreté", "Équipement", "Restauration", "Facturation", "Accueil"], "Propreté")),
        field("crm-r-desc", "Description", input("crm-r-desc", "", 'placeholder="Ce que le client signale"'), "full"),
        `<div class="full">${btn("Enregistrer", "A.crm.addComplaint()")}</div>`,
      ]))}</div>
      </div>`
  }

  function doublonsTab() {
    const todo = S.dupes.filter((d) => d.status === "a-traiter")
    return aiBox("Déduplication intelligente", `${todo.length} profil(s) entrant(s) ressemblent à des profils existants. Score de similarité calculé sur nom, e-mail, téléphone et pièce d'identité ; la fusion est toujours validée par un humain.`)
      + tbl(["Profil entrant", "Source", "Profil existant", "#Score", "Raisons", ""], S.dupes.map((d) => [
        `<strong>${esc(d.name)}</strong><div class="muted">${esc(d.email)} · ${esc(d.phone)}${d.points ? ` · ${d.points} pts ${esc(d.tier)}` : ""}</div>`, esc(d.source),
        guestLink(d.match) + `<div class="muted">${esc(acct(d.match)?.tier || "non membre")}${acct(d.match) ? ` · ${acct(d.match).points.toLocaleString("fr-FR")} pts` : ""}</div>`,
        d.score + " %", `<span class="muted">${esc(d.reasons.join(", "))}</span>`,
        d.status === "a-traiter" ? `<span class="row" style="flex-wrap:nowrap">${btn("Fusionner", `A.crm.merge(${q(d.id)})`, d.score >= 80 ? "sm" : "ghost sm")}${btn("Distincts", `A.crm.distinct(${q(d.id)})`, "ghost sm")}</span>`
          : d.status === "fusionne" ? badge("Fusionné", "ok") : badge("Profils distincts", "outline"),
      ]))
      + `<p class="muted">Une fusion conserve le niveau de fidélité le plus élevé et cumule les points (RG-CRM-05).</p>
      <h2>Historique des fusions (réversible)</h2>
      ${tbl(["Date", "Fusion", "Effet", ""], S.merges.map((m) => [esc(m.at), `${esc(m.from)} → ${esc(G(m.into).name)}`, esc(m.effect), m.undone ? badge("Annulée", "outline") : btn("Annuler la fusion", `A.crm.unmerge(${q(m.id)})`, "ghost sm")]), "Aucune fusion effectuée dans cette session.")}`
  }

  function rgpdTab() {
    const STAT = { "a-traiter": ["À traiter", "warn"], traitee: ["Traitée", "ok"], bloquee: ["Bloquée", "bad"] }
    const gs = D.guests.filter((g) => !g.erased)
    return `<h2>Demandes RGPD</h2>
      ${tbl(["Réf.", "Client", "Type", "Reçue", "Échéance légale", "Identité vérifiée", "Statut", ""], S.gdpr.map((x) => {
        const g = G(x.guest), left = nights(today, due(x))
        return [esc(x.id), g.erased ? esc(g.name) : guestLink(g.id), esc(x.type), fd(x.received), `${fd(due(x))}${x.status === "a-traiter" ? ` <span class="muted">(J-${left})</span>` : ""}`,
          x.idOk ? badge("Oui", "ok") : x.status === "a-traiter" ? `<label class="row" style="color:var(--ink)"><input type="checkbox" onchange="A.crm.idCheck(${q(x.id)}, this.checked)"> Vérifiée</label>` : "—",
          badge(...STAT[x.status]) + (x.note ? `<div class="muted">${esc(x.note)}</div>` : ""),
          x.status === "traitee" ? (x.closed ? `<span class="muted">Clôturée le ${fd(x.closed)}</span>` : "") : btn("Traiter", `A.crm.gdpr(${q(x.id)})`, "sm")]
      }))}
      <p class="muted">Traitement sous 30 jours, avec vérification d'identité et confirmation envoyée au client (EF-CRM-008, US-CRM-02). L'effacement anonymise le profil et ne garde que les factures exigées par la loi (RG-CRM-02).</p>
      <h2>Consentements</h2>
      <p class="muted">Par canal, partage entre établissements du groupe (RG-CRM-01) et profilage IA (RG-CRM-06). Chaque changement est horodaté avec sa source.</p>
      ${tbl(["Client", "E-mail", "SMS", "WhatsApp", "Partage groupe", "Profilage IA", "Date · source"], gs.map((g) => {
        const c = cons(g.id)
        return [guestLink(g.id), ...["email", "sms", "whatsapp", "groupe", "ia"].map((k) => `<input type="checkbox" aria-label="${k} ${esc(g.name)}" ${c[k] ? "checked" : ""} onchange="A.crm.consent(${q(g.id)}, '${k}', this.checked)">`),
          `<span class="muted">${esc(c.date.length === 10 ? fd(c.date) + "/" + c.date.slice(2, 4) : c.date)} · ${esc(c.source)}</span>`]
      }))}
      ${card("Nouvelle demande", form([
        field("crm-g-guest", "Client", select("crm-g-guest", gs.map((g) => [g.id, g.name]), "G7")),
        field("crm-g-type", "Type", select("crm-g-type", ["Accès", "Rectification", "Portabilité", "Effacement"], "Portabilité")),
        `<div style="align-self:end">${btn("Enregistrer la demande", "A.crm.addGdpr()")}</div>`,
      ]), 'style="margin-top:14px"')}`
  }

  function comptesTab() {
    return `<p class="muted">Profils entreprise, agence de voyage et groupe liés aux profils individuels (EF-CRM-002). Les tarifs négociés ne sont proposés qu'aux profils rattachés.</p>`
      + tbl(["Compte", "Nature", "N° fiscal / IATA", "Contrat", "Profils rattachés", "#CA 12 mois"], S.companies.map((c) => [
        `<strong>${esc(c.name)}</strong>`, esc(c.kind), esc(c.taxId), esc(c.contract), c.members.map((m) => guestLink(m)).join(", "), money(c.ca)]))
      + card("Rattacher un client", form([
        field("crm-k-comp", "Compte", select("crm-k-comp", S.companies.map((c) => [c.id, c.name]), "ENT-1")),
        field("crm-k-guest", "Client", select("crm-k-guest", D.guests.filter((g) => !g.erased).map((g) => [g.id, g.name]), "G1")),
        `<div style="align-self:end">${btn("Rattacher", "A.crm.link()")}</div>`,
      ]), 'style="margin-top:14px"')
  }

  // ---------- Actions ----------
  const actions = {
    offer(resId) { (ui.crmOffers = ui.crmOffers || []).push(resId); toast("Offre envoyée au client et notée pour la réception"); render() },
    addSegment() {
      const name = val("crm-s-name")
      if (!name) return toast("Donnez un nom au segment")
      const s = { id: "SEG-" + (S.segments.length + 1), name, crit: { vip: val("crm-s-vip"), tier: val("crm-s-tier"), nat: val("crm-s-nat"), minStays: Number(val("crm-s-min")) || 0 } }
      S.segments.push(s)
      toast(`Segment créé : ${members(s).length} membre(s)`)
      go("crm/segments/" + s.id)
    },
    credit(resId) {
      const r = R(resId), a = acct(r.guest)
      if (!(r.status === "partie" && folio(r).balance <= 0)) return toast("Crédit impossible : séjour non clôturé ou folio non soldé")
      const pts = pointsFor(r), before = a.tier
      a.points += pts; a.ytd += pts; a.last = r.to
      a.tx.unshift({ date: today, label: `Séjour ${resId} crédité`, pts })
      S.credited.push(resId)
      a.tier = S.tiers[Math.max(tierRank(a.tier), tierRank(tierFor(a.ytd)))].code
      toast(`${pts} points crédités${a.tier !== before ? ` — passage au niveau ${a.tier}` : ""}`)
      render()
    },
    redeem(id) {
      const a = acct(id), rw = S.rewards.find((r) => r.code === val("crm-rw"))
      if (a.points < rw.pts) return toast(`Solde insuffisant : ${a.points} pts pour ${rw.pts} requis`)
      a.points -= rw.pts
      a.tx.unshift({ date: today, label: `Échange : ${rw.label}`, pts: -rw.pts })
      toast(`Bon émis : ${rw.label} (code ${uid("BON")})`)
      render()
    },
    adjust(id, n) {
      const a = acct(id)
      a.points += n
      a.tx.unshift({ date: today, label: "Ajustement manuel (geste commercial)", pts: n })
      toast(`+${n} points`)
      render()
    },
    enroll(id) {
      const no = "FX-" + String(100100 + Object.keys(S.accounts).length * 7).padStart(6, "0")
      S.accounts[id] = { no, tier: "Classic", points: 0, ytd: 0, last: today, tx: [{ date: today, label: "Inscription au programme", pts: 0 }] }
      toast(`${G(id).name} inscrit (carte ${no})`)
      go("crm/fidelite/" + id)
    },
    addCampaign() {
      const name = val("crm-c-name")
      if (!name) return toast("Donnez un nom à la campagne")
      S.campaigns.push({ id: "CMP-" + String(S.campaigns.length + 7).padStart(2, "0"), name, segment: val("crm-c-seg"), channel: val("crm-c-ch"), status: "brouillon", date: null, sent: 0, excluded: 0, opens: 0, bookings: 0 })
      toast("Campagne enregistrée en brouillon")
      render()
    },
    send(id) {
      const c = S.campaigns.find((x) => x.id === id), ms = members(seg(c.segment))
      const ok = ms.filter((g) => cons(g.id)[c.channel])
      if (!ok.length) return toast("Aucun membre du segment n'a consenti à ce canal : envoi bloqué")
      Object.assign(c, { status: "envoyee", date: today, sent: ok.length, excluded: ms.length - ok.length, opens: 0, bookings: 0 })
      toast(`${ok.length} message(s) envoyé(s), ${ms.length - ok.length} exclu(s) faute de consentement (simulé)`)
      render()
    },
    reply(id) {
      const r = S.reviews.find((x) => x.id === id), v = $(`#crm-rep-${id}`).value.trim()
      if (!v) return toast("Réponse vide")
      r.reply = v
      toast("Réponse publiée sur la plateforme (simulé)")
      render()
    },
    fromReview(id) {
      const r = S.reviews.find((x) => x.id === id)
      S.complaints.unshift({ id: "REC-" + (13 + S.complaints.length), guest: r.guest, res: r.res, cat: "Avis négatif", desc: r.text, status: "ouverte", comp: 0, opened: today, review: id })
      toast("Réclamation ouverte")
      go("crm-relation/reclamations")
    },
    cStatus(id, st) { S.complaints.find((c) => c.id === id).status = st; toast("Réclamation prise en charge"); render() },
    resolve(id) {
      const c = S.complaints.find((x) => x.id === id)
      const v = prompt("Montant du geste commercial (FCFA, 0 si aucun)", "5000")
      if (v === null) return
      const amount = Math.max(0, Number(v) || 0), r = c.res && R(c.res)
      Object.assign(c, { status: "resolue", comp: amount })
      if (amount && r && r.status === "arrivee") { (D.extras[r.id] = D.extras[r.id] || []).push({ label: `Geste commercial (${c.id})`, amount: -amount }); toast(`Résolue — ${money(amount)} déduits du folio ${r.id}`) }
      else toast(amount ? `Résolue — avoir de ${money(amount)} émis` : "Réclamation résolue")
      render()
    },
    addComplaint() {
      const desc = val("crm-r-desc")
      if (!desc) return toast("Décrivez la réclamation")
      const guest = val("crm-r-guest"), res = D.reservations.find((r) => r.guest === guest && r.status === "arrivee")
      S.complaints.unshift({ id: "REC-" + (13 + S.complaints.length), guest, res: res?.id || null, cat: val("crm-r-cat"), desc, status: "ouverte", comp: 0, opened: today })
      toast("Réclamation enregistrée")
      render()
    },
    merge(id) {
      const d = S.dupes.find((x) => x.id === id), g = G(d.match)
      if (d.score < 80 && !confirm(`Score de similarité faible (${d.score} %). Fusionner quand même ?`)) return
      const a = acct(g.id), snapshot = { phone: g.phone, email: g.email, account: a ? { ...a, tx: [...a.tx] } : null }
      let effect = "Coordonnées complétées"
      if (d.points || d.tier !== "Classic") {
        if (!a) S.accounts[g.id] = { no: "FX-" + d.id.slice(2).padStart(6, "0"), tier: d.tier, points: d.points, ytd: d.points, last: today, tx: [] }
        else {
          a.points += d.points; a.ytd += d.points
          if (tierRank(d.tier) > tierRank(a.tier)) a.tier = d.tier
          a.tx.unshift({ date: today, label: `Fusion du profil ${d.id}`, pts: d.points })
        }
        effect = `${d.points} pts cumulés, niveau conservé : ${acct(g.id).tier}`
      }
      if (!g.email) g.email = d.email
      if (!g.phone) g.phone = d.phone
      d.status = "fusionne"
      S.merges.unshift({ id: uid("FUS"), at: now(), from: `${d.name} (${d.id})`, into: g.id, dupe: d.id, effect, snapshot })
      toast(`Profils fusionnés dans ${g.name}`)
      render()
    },
    distinct(id) { S.dupes.find((x) => x.id === id).status = "distinct"; toast("Marqués comme distincts"); render() },
    unmerge(mid) {
      const m = S.merges.find((x) => x.id === mid), g = G(m.into)
      g.phone = m.snapshot.phone; g.email = m.snapshot.email
      if (m.snapshot.account) S.accounts[g.id] = m.snapshot.account
      else delete S.accounts[g.id]
      S.dupes.find((x) => x.id === m.dupe).status = "a-traiter"
      m.undone = true
      toast("Fusion annulée, profils restaurés")
      render()
    },
    idCheck(id, v) { S.gdpr.find((x) => x.id === id).idOk = v; render() },
    gdpr(id) {
      const x = S.gdpr.find((y) => y.id === id), g = G(x.guest)
      if (!x.idOk) return toast("Vérifiez d'abord l'identité du demandeur")
      if (x.type === "Effacement") {
        const active = D.reservations.filter((r) => r.guest === g.id && ["confirmee", "arrivee"].includes(r.status))
        if (active.length) {
          Object.assign(x, { status: "bloquee", note: `Réservation(s) active(s) : ${active.map((r) => r.id).join(", ")}. Effacement après le dernier départ ou leur annulation.` })
          toast("Effacement bloqué : réservations actives")
          return render()
        }
        Object.assign(g, { name: `Profil anonymisé ${g.id}`, phone: "", email: "", nationality: "", idDoc: "Purgé", prefs: [], vip: false, erased: true })
        delete S.consents[g.id]
        Object.assign(x, { status: "traitee", closed: today, note: "Profil anonymisé, factures conservées" })
        toast("Profil anonymisé, confirmation envoyée (simulé)")
      } else {
        Object.assign(x, { status: "traitee", closed: today, note: x.type === "Rectification" ? "Fiche mise à jour" : "Export JSON transmis par lien sécurisé (simulé)" })
        toast(`Demande ${id} traitée, confirmation envoyée (simulé)`)
      }
      render()
    },
    consent(id, k, v) {
      const c = (S.consents[id] = { ...cons(id) })
      c[k] = v; c.date = today; c.source = "Modification réception (vous)"
      toast(`Consentement ${k} ${v ? "accordé" : "retiré"} — horodaté`)
      render()
    },
    addGdpr() {
      S.gdpr.unshift({ id: "RGPD-" + String(S.gdpr.length + 4).padStart(2, "0"), guest: val("crm-g-guest"), type: val("crm-g-type"), received: today, status: "a-traiter", idOk: false })
      toast("Demande enregistrée, échéance dans 30 jours")
      render()
    },
    savePrefs(id) {
      const p = {}
      PREF_CATS.forEach(([k]) => { const v = val("crm-p-" + k); if (v) p[k] = v })
      if (p.allergies && p.allergies.length < 3) return toast("Précisez l'allergie déclarée")
      S.prefs[id] = p
      syncPrefs(id)
      const up = upcoming(id)
      up.forEach((r) => delete S.prefSent[r.id])
      toast(`Préférences enregistrées${up.length ? ` et signalées sur ${up.length} réservation(s)` : ""}${p.allergies ? " — allergie à transmettre à la cuisine" : ""}`)
      render()
    },
    sendPrefs(rid) {
      const r = R(rid), p = prefsOf(r.guest)
      S.prefSent[rid] = today
      toast(`Préférences de ${G(r.guest).name} transmises au housekeeping${p.allergies ? " et allergie signalée à la cuisine" : ""} (simulé)`)
      render()
    },
    saveVip(id) {
      const g = G(id), on = $("#crm-v-on").checked, welcome = val("crm-v-welcome"), gift = val("crm-v-gift")
      if (on && !welcome) return toast("Un client VIP doit avoir une consigne d'accueil")
      g.vip = on
      if (on) S.vip[id] = { level: val("crm-v-level"), welcome, gift }
      else delete S.vip[id]
      toast(on ? `${g.name} : statut ${S.vip[id].level} enregistré, alertes générées pour ses arrivées` : `${g.name} n'est plus VIP`)
      render()
    },
    vipTask(rid, k, v) {
      vipTask(rid)[k] = v
      toast(k === "gift" ? (v ? "Cadeau prêt" : "Cadeau à préparer") : (v ? "Accueil VIP confirmé" : "Accueil VIP à faire"))
      render()
    },
    link() {
      const c = S.companies.find((x) => x.id === val("crm-k-comp")), g = val("crm-k-guest")
      if (c.members.includes(g)) return toast("Déjà rattaché")
      c.members.push(g)
      toast(`${G(g).name} rattaché à ${c.name}`)
      render()
    },
  }

  HMS.module({
    code: "crm", group: "Ventes & clients", title: "CRM client et fidélité", phase: "4-6", spec: "§7 CRM",
    screens: [
      { id: "crm", label: "Fidélité et marketing", view: views.crm },
      { id: "crm-relation", label: "Relation client", view: views.relation },
    ],
    actions,
  })
})()
