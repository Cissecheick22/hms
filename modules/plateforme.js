// modules/plateforme.js — Spec §3 Socle plateforme (PLT) et §4 Organisation et données de référence (ORG)
// Utilisateurs, rôles et permissions, SSO/MFA simulés, journal d'audit chaîné, paramètres hiérarchiques,
// devises, langues, notifications, documents ; groupe, établissements, structure physique, chambres,
// types, équipements, services, codes de référence et taxes. Tout est fictif.
;(() => {
  // ---------- Utilitaires locaux ----------
  const ME = "Kouadio Yapi"
  const clock = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` }
  const ts = () => `${today} ${clock()}`
  // Empreinte factice (djb2) pour illustrer le chaînage du journal d'audit
  const hash = (s) => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, "0") }
  const entryHash = (e) => hash([e.prev, e.ts, e.actor, e.action, e.entity, e.entityId, e.before, e.after].join("|"))
  const st = (map, k) => badge(map[k][0], map[k][1])
  const daysAgo = (s) => nights(s, today)
  const errBox = (id, m) => { const el = document.getElementById(id); if (el) el.innerHTML = `<div class="err">${esc(m)}</div>`; else toast(m) }
  const mutedRef = (s) => `<span class="muted">${esc(s)}</span>`

  // ---------- Données PLT ----------
  const PERMS = [
    ["reservation:create", "Créer une réservation"], ["reservation:cancel", "Annuler une réservation"], ["reservation:discount", "Accorder une remise"],
    ["folio:post", "Imputer au folio"], ["folio:refund", "Rembourser"], ["room:status", "Changer le statut d'une chambre"], ["key:encode", "Encoder une clé"],
    ["supplier:create", "Créer un fournisseur"], ["payment:approve", "Approuver un paiement"], ["report:read", "Consulter les rapports"],
    ["audit:read", "Consulter le journal d'audit"], ["user:manage", "Gérer les utilisateurs"], ["role:manage", "Gérer les rôles"], ["setting:edit", "Modifier les paramètres"],
  ]
  const SOD = [["supplier:create", "payment:approve"]] // séparation des tâches (RG-PLT-08)
  D.plt = {
    roles: [
      { code: "ADM", label: "Administrateur tenant", priv: true, system: true, perms: ["reservation:create", "reservation:cancel", "reservation:discount", "folio:post", "room:status", "report:read", "audit:read", "user:manage", "role:manage", "setting:edit", "payment:approve"] },
      { code: "MGR", label: "Manager de service", priv: false, system: true, perms: ["reservation:create", "reservation:cancel", "reservation:discount", "folio:post", "folio:refund", "room:status", "key:encode", "report:read"] },
      { code: "REC", label: "Réceptionniste", priv: false, system: true, perms: ["reservation:create", "reservation:cancel", "folio:post", "key:encode", "room:status"] },
      { code: "HKP", label: "Gouvernante", priv: false, system: true, perms: ["room:status"] },
      { code: "FIN", label: "Finance", priv: true, system: true, perms: ["folio:refund", "payment:approve", "report:read"] },
      { code: "TEC", label: "Technique", priv: false, system: false, perms: ["room:status", "report:read"] },
      { code: "AUD", label: "Auditeur / DPO", priv: false, system: true, perms: ["audit:read", "report:read"] },
      { code: "SEC", label: "Sécurité et contrôle d'accès", priv: true, system: true, perms: ["key:encode", "audit:read"] },
      { code: "ACH", label: "Acheteur", priv: false, system: false, perms: ["supplier:create", "report:read"] },
    ],
    users: [
      { id: "U1", name: "Kouadio Yapi", email: "kouadio.yapi@exemple.test", job: "Directeur d'hôtel", status: "actif", mfa: "TOTP", last: "2026-11-26", lang: "fr", roles: [{ role: "ADM", scope: "Groupe Exemple" }] },
      { id: "U2", name: "Aya Kouassi", email: "aya.kouassi@exemple.test", job: "Chef de réception", status: "actif", mfa: "TOTP", last: "2026-11-26", lang: "fr", roles: [{ role: "MGR", scope: "Hôtel Exemple · Réception" }] },
      { id: "U3", name: "Ibrahim Ouattara", email: "ibrahim.ouattara@exemple.test", job: "Réceptionniste", status: "actif", mfa: "aucun", last: "2026-11-25", lang: "fr", roles: [{ role: "REC", scope: "Hôtel Exemple · Réception" }] },
      { id: "U4", name: "Adjoua N'Guessan", email: "adjoua.nguessan@exemple.test", job: "Comptable", status: "actif", mfa: "Passkey", last: "2026-11-24", lang: "fr", roles: [{ role: "FIN", scope: "Hôtel Exemple" }] },
      { id: "U5", name: "Akissi Brou", email: "akissi.brou@exemple.test", job: "Gouvernante générale", status: "actif", mfa: "aucun", last: "2026-11-26", lang: "fr", roles: [{ role: "HKP", scope: "Hôtel Exemple · Housekeeping" }] },
      { id: "U6", name: "Seydou Bamba", email: "seydou.bamba@exemple.test", job: "Responsable technique", status: "actif", mfa: "aucun", last: "2026-08-20", lang: "fr", roles: [{ role: "TEC", scope: "Hôtel Exemple · Technique" }] },
      { id: "U7", name: "Estelle Tanoh", email: "estelle.tanoh@exemple.test", job: "Auditrice interne / DPO", status: "actif", mfa: "TOTP", last: "2026-11-20", lang: "fr", roles: [{ role: "AUD", scope: "Groupe Exemple" }] },
      { id: "U8", name: "Moussa Koné", email: "moussa.kone@exemple.test", job: "Agent de sécurité", status: "actif", mfa: "aucun", last: "2026-11-26", lang: "fr", roles: [{ role: "SEC", scope: "Hôtel Exemple" }] },
      { id: "U9", name: "Hervé Gnagne", email: "herve.gnagne@exemple.test", job: "Acheteur", status: "actif", mfa: "TOTP", last: "2026-11-23", lang: "en", roles: [{ role: "ACH", scope: "Hôtel Exemple" }] },
      { id: "U10", name: "Mariam Diabaté", email: "mariam.diabate@exemple.test", job: "Réceptionniste (saisonnier)", status: "desactive", mfa: "aucun", last: "2026-06-30", lang: "fr", roles: [] },
    ],
    delegations: [
      { id: "DL-1", from: "U1", to: "U2", perm: "reservation:discount", du: "2026-11-20", au: "2026-11-24", status: "expiree" },
      { id: "DL-2", from: "U4", to: "U1", perm: "payment:approve", du: "2026-11-25", au: "2026-12-05", status: "active" },
    ],
    abac: [
      { id: "AB-1", rule: "Remise supérieure à 20 % : réservée aux managers en poste (horaire de travail en cours)", on: true },
      { id: "AB-2", rule: "Remboursement supérieur à 100 000 FCFA : double validation Finance + Direction", on: true },
      { id: "AB-3", rule: "Consultation d'une pièce d'identité : réception en poste uniquement, consultation journalisée", on: true },
      { id: "AB-4", rule: "Encodage de clé passe-partout : sécurité, avec motif obligatoire", on: false },
    ],
    logins: [
      { id: "L1", ts: "2026-11-26 07:58", user: "U2", country: "Côte d'Ivoire", device: "Poste réception 1", score: 8, decision: "autorise" },
      { id: "L2", ts: "2026-11-26 03:12", user: "U4", country: "Pays inhabituel", device: "Navigateur inconnu", score: 91, decision: "bloque" },
      { id: "L3", ts: "2026-11-26 06:40", user: "U8", country: "Côte d'Ivoire", device: "Téléphone personnel", score: 64, decision: "mfa" },
      { id: "L4", ts: "2026-11-25 22:05", user: "U3", country: "Côte d'Ivoire", device: "Poste réception 2", score: 22, decision: "autorise" },
      { id: "L5", ts: "2026-11-25 14:31", user: "U9", country: "Ghana", device: "Ordinateur portable connu", score: 35, decision: "autorise" },
    ],
    failed: { "Hôtel Exemple": [3, 5, 2, 7, 4, 6, 9] }, // 7 derniers jours
    sso: { provider: "Azure AD (simulé)", tenantRef: "annuaire-exemple.test", status: "configure", lastSync: "2026-11-26 08:00", test: null,
      mapping: [{ group: "HMS-Direction", role: "ADM" }, { group: "HMS-Reception", role: "REC" }, { group: "HMS-Finance", role: "FIN" }] },
    // Fournisseurs d'identité fédérés derrière le serveur OIDC (Keycloak simulé) — EF-PLT-003
    idps: [
      { id: "AZ", name: "Azure AD", proto: "SAML 2.0", domain: "exemple.test", status: "configure" },
      { id: "GW", name: "Google Workspace", proto: "OIDC", domain: "exemple.test", status: "a_configurer" },
    ],
    isoTest: null, // dernier test d'isolation des tenants (EF-PLT-002)
    sent: [], // envois de notifications (EF-PLT-015)
    refImport: null, // import de données de référence en cours (EF-PLT-019)
    services: [
      { id: "SA-1", name: "svc-audit-nuit", scope: "night-audit:run", key: "sk_ex_••••a41f", rotated: "2026-10-01", expires: "2027-01-01" },
      { id: "SA-2", name: "svc-encodeur-cles", scope: "key:encode", key: "sk_ex_••••77c2", rotated: "2026-08-15", expires: "2026-12-01" },
      { id: "SA-3", name: "svc-export-compta", scope: "report:read", key: "sk_ex_••••0be9", rotated: "2026-11-02", expires: "2027-02-02" },
    ],
    rightsChanges: [["Juin", 4], ["Juil.", 6], ["Août", 3], ["Sept.", 9], ["Oct.", 5], ["Nov.", 7]],
    audit: [],
    // Paramètres hiérarchiques : valeur par niveau, verrouillage éventuel (RG-PLT-04)
    settings: [
      { key: "checkin.heure", label: "Heure de check-in", values: { plateforme: "15:00", tenant: "14:00" }, lock: null },
      { key: "checkout.heure", label: "Heure de check-out", values: { plateforme: "11:00", etab: "12:00" }, lock: null },
      { key: "langue.defaut", label: "Langue par défaut", values: { plateforme: "en", tenant: "fr" }, lock: null },
      { key: "devise.base", label: "Devise de base", values: { plateforme: "EUR", tenant: "XOF" }, lock: "tenant" },
      { key: "fuseau", label: "Fuseau horaire", values: { plateforme: "UTC", etab: "Africa/Abidjan" }, lock: null },
      { key: "mfa.privileges", label: "MFA obligatoire pour les rôles à privilèges", values: { plateforme: "oui" }, lock: "plateforme" },
      { key: "remise.max", label: "Remise maximale sans validation (%)", values: { plateforme: "10", tenant: "20" }, lock: "tenant" },
      { key: "inactivite.jours", label: "Désactivation après inactivité (jours)", values: { plateforme: "90" }, lock: null },
      { key: "retention.identite", label: "Conservation des pièces d'identité (mois)", values: { plateforme: "12", tenant: "24" }, lock: null },
    ],
    rates: [
      { from: "EUR", to: "XOF", rate: 655.957, date: "2026-11-26", source: "Parité fixe (BCEAO)" },
      { from: "USD", to: "XOF", rate: 598.4, date: "2026-11-26", source: "Flux automatique (simulé)" },
      { from: "GBP", to: "XOF", rate: 761.2, date: "2026-11-26", source: "Flux automatique (simulé)" },
      { from: "GHS", to: "XOF", rate: 38.6, date: "2026-11-25", source: "Saisie manuelle" },
      { from: "NGN", to: "XOF", rate: 0.39, date: "2026-11-25", source: "Saisie manuelle" },
    ],
    fxTx: [
      { ref: "PAI-8812", date: "2026-11-24", amount: 180, cur: "EUR", rate: 655.957 },
      { ref: "PAI-8820", date: "2026-11-25", amount: 250, cur: "USD", rate: 601.1 },
      { ref: "PAI-8831", date: "2026-11-26", amount: 900, cur: "GHS", rate: 38.6 },
    ],
    langs: [["fr", "Français"], ["en", "Anglais"], ["ar", "Arabe (droite-à-gauche)"]],
    contents: [
      { id: "C1", label: "E-mail de confirmation de réservation", tr: { fr: "valide", en: "valide", ar: "manquant" } },
      { id: "C2", label: "Description du type « Suite »", tr: { fr: "valide", en: "brouillon", ar: "manquant" } },
      { id: "C3", label: "Carte du restaurant", tr: { fr: "valide", en: "manquant", ar: "manquant" } },
      { id: "C4", label: "SMS de rappel d'arrivée", tr: { fr: "valide", en: "valide", ar: "valide" } },
    ],
    templates: [
      { code: "RES_CONFIRM", label: "Confirmation de réservation", channel: "E-mail", langs: "fr, en", version: 4, updated: "2026-10-12" },
      { code: "ARR_RAPPEL", label: "Rappel d'arrivée J-1", channel: "SMS", langs: "fr, en, ar", version: 2, updated: "2026-09-03" },
      { code: "CLE_MOBILE", label: "Clé mobile disponible", channel: "WhatsApp", langs: "fr, en", version: 1, updated: "2026-11-02" },
      { code: "CHK_FACTURE", label: "Facture après départ", channel: "E-mail", langs: "fr", version: 3, updated: "2026-08-19" },
      { code: "HK_ALERTE", label: "Chambre prête (interne)", channel: "Push", langs: "fr", version: 1, updated: "2026-07-01" },
      { code: "OFFRE_WE", label: "Offre week-end Assinie", channel: "SMS", langs: "fr", version: 1, updated: "2026-11-15", marketing: true },
      { code: "WIFI_INAPP", label: "Code Wi-Fi du séjour", channel: "In-app", langs: "fr, en", version: 2, updated: "2026-10-01" },
    ],
    delivery: [["E-mail", 1240, 1198], ["SMS", 860, 842], ["WhatsApp", 410, 405], ["Push", 2300, 2190], ["In-app", 3100, 3100]],
    optouts: [
      { who: "G3", channel: "SMS", since: "2026-10-02" },
      { who: "G6", channel: "E-mail marketing", since: "2026-11-11" },
      { who: "G2", channel: "WhatsApp", since: "2026-09-20" },
    ],
    documents: [
      { id: "DOC-501", type: "Pièce d'identité", owner: "G4", until: "2028-11-23" },
      { id: "DOC-488", type: "Pièce d'identité", owner: "Lassina Cissé (ancien client)", until: "2026-11-10" },
      { id: "DOC-412", type: "Contrat fournisseur", owner: "Ets Kouassi & Fils (exemple)", until: "2031-03-01" },
      { id: "DOC-397", type: "Facture", owner: "F-1032", until: "2036-11-02" },
      { id: "DOC-350", type: "Pièce d'identité", owner: "Amenan Zadi (ancien client)", until: "2026-10-30" },
    ],
  }
  const P = D.plt
  const role = (c) => P.roles.find((r) => r.code === c)
  const user = (id) => P.users.find((u) => u.id === id)
  const userPerms = (u) => new Set(u.roles.flatMap((a) => role(a.role).perms))
  const isPriv = (u) => u.roles.some((a) => role(a.role).priv)
  const sodConflict = (perms) => SOD.find(([a, b]) => perms.has(a) && perms.has(b))
  const permLabel = (p) => (PERMS.find((x) => x[0] === p) || [p, p])[1]

  // Journal d'audit : ajout uniquement (RG-PLT-03), chaque entrée référence l'empreinte de la précédente
  const log = (action, entity, entityId, before = "", after = "", actor = ME) => {
    const prev = P.audit.length ? P.audit[P.audit.length - 1].hash : "00000000"
    const e = { id: "AU-" + (1000 + P.audit.length), ts: P.audit.seeding || ts(), actor, action, entity, entityId, before, after, ip: actor.startsWith("svc") ? "interne" : "10.0.0." + (P.audit.length % 20 + 10), prev }
    e.hash = entryHash(e)
    P.audit.push(e)
  }
  ;[
    ["2026-11-24 09:12", "Ibrahim Ouattara", "modification", "Réservation", "R-2051", "Tarif 120 000", "Tarif 110 000"],
    ["2026-11-24 09:13", "Ibrahim Ouattara", "modification", "Réservation", "R-2051", "Garantie : Aucune", "Garantie : Carte bancaire"],
    ["2026-11-25 07:55", "Aya Kouassi", "connexion", "Session", "U2", "", "MFA TOTP validé"],
    ["2026-11-25 10:02", "Kouadio Yapi", "droits", "Utilisateur", "U9", "Rôles : —", "Rôles : ACH @ Hôtel Exemple"],
    ["2026-11-25 11:40", "Ibrahim Ouattara", "consultation sensible", "Pièce d'identité", "G4", "", "CNI ••••04 affichée"],
    ["2026-11-25 23:59", "svc-audit-nuit", "modification", "Date hôtelière", "Hôtel Exemple", "2026-11-25", "2026-11-26"],
    ["2026-11-26 07:58", "Aya Kouassi", "connexion", "Session", "U2", "", "MFA TOTP validé"],
    ["2026-11-26 08:20", "Kouadio Yapi", "paramètre", "Paramètre", "checkout.heure", "11:00 (plateforme)", "12:00 (établissement)"],
  ].forEach(([t, actor, a, en, id, b, af]) => { P.audit.seeding = t; log(a, en, id, b, af, actor) })
  delete P.audit.seeding

  // ---------- Données ORG ----------
  D.org = {
    brands: [
      // Charte graphique, standards de service (obligatoires ou recommandés) et gamme — EF-ORG-001
      { code: "EXB", name: "Exemple Business", range: "Milieu de gamme (3-4 étoiles)", charter: { color: "#1f6f5c", font: "Inter", logo: "exb-logo.svg" },
        standards: [{ label: "Check-in en moins de 5 min", mandatory: true }, { label: "Wi-Fi gratuit", mandatory: true }, { label: "Petit-déjeuner dès 6 h 30", mandatory: false }] },
      { code: "EXR", name: "Exemple Resort", range: "Haut de gamme (5 étoiles)", charter: { color: "#8a5a2b", font: "Playfair Display", logo: "exr-logo.svg" },
        standards: [{ label: "Accueil personnalisé", mandatory: true }, { label: "Spa sur site", mandatory: true }, { label: "Service en chambre 24 h/24", mandatory: false }] },
    ],
    // Sociétés juridiques distinctes des établissements — EF-ORG-002
    entities: [
      { id: "LE1", name: "Société Ivoirienne Exemple d'Hôtellerie SA", tax: "NCC 0000000 X (fictif)", rccm: "RCCM CI-EXE-0000-B-00000 (fictif)", currency: "XOF", ledger: "SYSCOHADA" },
      { id: "LE2", name: "Assinie Loisirs Exemple SARL", tax: "NCC 0000001 Y (fictif)", rccm: "RCCM CI-EXE-0000-B-00001 (fictif)", currency: "XOF", ledger: "SYSCOHADA" },
    ],
    // Établissements — EF-ORG-003 ; classement officiel, positionnement commercial et labels — EF-ORG-011
    properties: [
      { id: "P1", code: "HEX-ABJ", name: D.hotel, brand: "EXB", entity: "LE1", city: "Abidjan", address: "Boulevard de la République, Plateau, Abidjan", geo: [5.3197, -4.0189], stars: 4, palace: false, commercial: "", labels: ["Clef Verte (exemple)"],
        status: "exploitation", tz: "Africa/Abidjan", currency: "XOF", langs: "fr, en", checkin: "14:00", checkout: "12:00", policies: { children: true, pets: false, smoking: false } },
      { id: "P2", code: "HEX-ASN", name: "Hôtel Exemple Plage", brand: "EXR", entity: "LE2", city: "Assinie", address: "Route d'Assinie-Mafia, Assinie", geo: [5.1333, -3.2833], stars: 5, palace: false, commercial: "", labels: [],
        status: "preouverture", tz: "Africa/Abidjan", currency: "XOF", langs: "fr, en", checkin: "15:00", checkout: "12:00", policies: { children: true, pets: true, smoking: false },
        checklist: { type: true, chambre: true, tarif: false, taxe: true, paiement: false } },
    ],
    buildings: [{ code: "BP", name: "Bâtiment principal", floors: [0, 1, 2, 3] }],
    spaces: [
      { id: "S1", type: "Restaurant", name: "Restaurant Le Fromager", floor: 0, hours: "6 h 30 – 23 h", doors: [{ ref: "SER-0101", maker: "Fabricant Exemple", mode: "en ligne" }] },
      { id: "S2", type: "Piscine", name: "Piscine extérieure", floor: 0, hours: "7 h – 20 h", doors: [{ ref: "SER-0102", maker: "Fabricant Exemple", mode: "en ligne" }] },
      { id: "S3", type: "Salle de sport", name: "Salle de sport", floor: 0, hours: "24 h/24", doors: [{ ref: "SER-0103", maker: "Fabricant Exemple", mode: "en ligne" }] },
      { id: "S4", type: "Salle de réunion", name: "Salle Baobab", floor: 0, hours: "Sur réservation", doors: [{ ref: "SER-0104", maker: "Fabricant Exemple", mode: "hors ligne" }] },
      { id: "S5", type: "Parking", name: "Parking sous-sol", floor: 0, hours: "24 h/24", doors: [{ ref: "BAR-0001", maker: "Fabricant Exemple B", mode: "en ligne" }] },
      { id: "S6", type: "Local technique", name: "Local technique", floor: 0, hours: "Personnel habilité", doors: [] },
    ],
    // Statut d'exploitation : service | hs (hors service, vendable mais non attribuée) | hc (hors commande, retirée de l'inventaire)
    roomOps: Object.fromEntries(D.rooms.map((r) => [r.no, r.hk === "hs" ? "hc" : "service"])),
    roomAttr: { "101": { link: "102" }, "102": { link: "101" }, "105": { pmr: true }, "303": { connected: true, link: "304" }, "304": { connected: true, link: "303" } },
    // Portes contrôlées des chambres (référence serrure, fabricant, mode en ligne / hors ligne), lues par ACC — EF-ORG-008
    roomDoors: Object.fromEntries(D.rooms.map((r) => [r.no, [{ ref: "CH-" + r.no, maker: "Fabricant Exemple", model: "Serrure RFID Exemple", mode: r.floor === 1 ? "hors ligne" : "en ligne" }]])),
    // Suites composées de plusieurs chambres physiques — EF-ORG-009
    suites: [{ id: "SU-1", name: "Suite présidentielle Lagune", rooms: ["303", "304"], sale: "les deux", rate: 290000 }],
    archived: [],
    typeInfo: {
      STD: { adults: 2, children: 1, extra: 0, area: 22, beds: "1 lit double ou 2 lits simples", view: "Ville", equip: ["Climatisation", "TV", "Coffre"], photos: 6, desc: { fr: "Chambre lumineuse de 22 m², idéale pour un court séjour d'affaires.", en: "Bright 22 m² room, ideal for a short business stay.", ar: "" } },
      SUP: { adults: 2, children: 2, extra: 1, area: 28, beds: "1 lit king size", view: "Jardin", equip: ["Climatisation", "TV", "Coffre", "Minibar"], photos: 4, desc: { fr: "Chambre spacieuse avec coin bureau et vue sur le jardin.", en: "", ar: "" } },
      SUI: { adults: 3, children: 2, extra: 1, area: 55, beds: "1 lit king size + canapé-lit", view: "Lagune", equip: ["Climatisation", "TV", "Coffre", "Minibar", "Machine à café"], photos: 0, desc: { fr: "", en: "", ar: "" } },
    },
    draft: null,
    photoTags: null,
    equipment: [
      { id: "EQ-1", room: "204", kind: "Climatisation", model: "Modèle Exemple C-12", serial: "SN-EX-0204-CL", state: "en panne" },
      { id: "EQ-2", room: "204", kind: "TV", model: "Modèle Exemple T-43", serial: "SN-EX-0204-TV", state: "ok" },
      { id: "EQ-3", room: "303", kind: "Minibar", model: "Modèle Exemple M-40", serial: "SN-EX-0303-MB", state: "ok" },
      { id: "EQ-4", room: "303", kind: "Coffre", model: "Modèle Exemple S-20", serial: "SN-EX-0303-CF", state: "ok" },
      { id: "EQ-5", room: "101", kind: "Climatisation", model: "Modèle Exemple C-09", serial: "SN-EX-0101-CL", state: "entretien prévu" },
      { id: "EQ-6", room: "302", kind: "TV", model: "Modèle Exemple T-43", serial: "SN-EX-0302-TV", state: "ok" },
    ],
    departments: [
      { code: "REC", name: "Réception", pc: "CP-HEB", account: "706100" },
      { code: "HKP", name: "Housekeeping", pc: "CP-HEB", account: "706100" },
      { code: "FNB", name: "Restauration et bar", pc: "CP-FNB", account: "706200" },
      { code: "SPA", name: "Spa et bien-être", pc: "CP-SPA", account: "706300" },
      { code: "TEC", name: "Technique et maintenance", pc: "CC-TEC", account: "615000" },
      { code: "ADM", name: "Administration", pc: "CC-ADM", account: "622000" },
    ],
    codes: {
      segments: [["LOI", "Loisirs", true], ["AFF", "Affaires individuel", true], ["GRP", "Groupe", true], ["COR", "Entreprise sous contrat", true], ["ONG", "ONG et institutions", true], ["EQP", "Équipages", false]],
      origines: [["DIR", "Direct (comptoir)", true], ["WEB", "Site web de l'hôtel", true], ["OTA", "Agence en ligne (simulée)", true], ["AGV", "Agence de voyage", true], ["TEL", "Téléphone", true], ["WLK", "Sans réservation (walk-in)", true]],
      transactions: [["HEB", "Hébergement", true], ["PDJ", "Petit-déjeuner", true], ["RST", "Restaurant", true], ["MNB", "Minibar", true], ["BLA", "Blanchisserie", true], ["TXS", "Taxe de séjour", true], ["ESP", "Paiement espèces", true], ["CB", "Paiement carte (PSP simulé)", true], ["MOM", "Paiement mobile money (simulé)", true]],
    },
    taxes: [
      { code: "TVA18", label: "TVA", base: "Prestations", rate: "18 %", account: "443100", on: true },
      { code: "TXS", label: "Taxe de séjour", base: "Par nuitée et par adulte", rate: "1 000 FCFA (exemple)", account: "447100", on: true },
      { code: "TDT", label: "Taxe de développement touristique", base: "Hébergement HT", rate: "1,5 % (exemple)", account: "447200", on: false },
    ],
    importReport: null,
  }
  const O = D.org
  const OPS = { service: ["En service", "on"], hs: ["Hors service", "outline"], hc: ["Hors commande", "dark"] }
  const hasHistory = (no) => D.reservations.some((r) => r.room === no)

  // ====================================================================
  // Écrans PLT
  // ====================================================================
  const views = {
    acces(p) {
      const tab = p[0] || "utilisateurs"
      return pageHead("Utilisateurs et droits", "Comptes, rôles, périmètres, délégations et authentification de l'Hôtel Exemple. Connexions SSO et MFA simulées, indicateurs d'exemple.")
        + subtabs("plt-acces", [["utilisateurs", "Utilisateurs"], ["roles", "Rôles et permissions"], ["delegations", "Délégations"], ["authentification", "SSO, MFA et connexions"], ["isolation", "Isolation des tenants"]], tab)
        + ({ utilisateurs: usersTab, roles: rolesTab, delegations: delegTab, authentification: authTab, isolation: isoTab }[tab] || usersTab)(p.slice(1))
    },
    audit() {
      const f = ui.pltAudit || (ui.pltAudit = { entity: "", actor: "", action: "" })
      const opts = (k) => [["", "Tous"], ...[...new Set(P.audit.map((e) => e[k]))].map((v) => [v, v])]
      const rows = P.audit.filter((e) => (!f.entity || e.entity === f.entity) && (!f.actor || e.actor === f.actor) && (!f.action || e.action === f.action)).slice().reverse()
      const chk = ui.pltChain
      return pageHead("Journal d'audit", "Toutes les actions sensibles, avec valeurs avant/après. Les entrées sont chaînées par empreinte : elles ne peuvent être ni modifiées ni supprimées.",
        btn("Vérifier l'intégrité", "A.plt.verifyChain()", "ghost") + btn("Export signé (CSV)", "A.plt.exportAudit()"))
        + cards([kpi("Entrées", P.audit.length, "journal du tenant"), kpi("Conservation", "10 ans", "paramétrable (ENF-PLT-03)"), kpi("Dernière empreinte", P.audit[P.audit.length - 1].hash, "chaînage (EF-PLT-010)")])
        + (chk ? `<p class="${chk.ok ? "" : "err"}" style="margin-top:14px">${chk.ok ? badge("Chaîne intègre", "on") : badge("Altération détectée", "dark")} ${esc(chk.msg)}</p>` : "")
        + `<h2>Filtres</h2>` + form([
          field("au-ent", "Entité", select("au-ent", opts("entity"), f.entity, `onchange="ui.pltAudit.entity=this.value;render()"`)),
          field("au-act", "Utilisateur", select("au-act", opts("actor"), f.actor, `onchange="ui.pltAudit.actor=this.value;render()"`)),
          field("au-typ", "Type d'action", select("au-typ", opts("action"), f.action, `onchange="ui.pltAudit.action=this.value;render()"`)),
        ])
        + `<div style="margin-top:14px">${tbl(["Horodatage", "Acteur", "Action", "Entité", "Avant", "Après", "IP", "Empreinte"], rows.map((e) => [
          esc(e.ts), esc(e.actor), badge(e.action, e.action === "consultation sensible" || e.action === "droits" ? "outline" : ""), `${esc(e.entity)} <span class="muted">${esc(e.entityId)}</span>`,
          `<span class="muted">${esc(e.before || "—")}</span>`, esc(e.after || "—"), `<span class="muted">${esc(e.ip)}</span>`, `<span class="muted" title="précédente : ${esc(e.prev)}">${esc(e.hash)}</span>`,
        ]), "Aucune entrée pour ces filtres.")}</div>`
        + `<p class="muted">EF-PLT-009 : créations, modifications, suppressions, consultations de données sensibles, connexions et changements de droits sont tracés avec valeurs avant/après (${["création", "modification", "suppression", "consultation sensible", "connexion", "droits"].map((a) => a + " : " + P.audit.filter((e) => e.action === a).length).join(" · ")}). Exemple US-PLT-02 : filtrez l'entité « Réservation » pour voir qui a modifié le tarif de R-2051. RG-PLT-03 : aucune action de modification ou de suppression n'est proposée, y compris pour l'éditeur.</p>`
    },
    params(p) {
      const tab = p[0] || "parametres"
      return pageHead("Paramètres et langues", "Paramétrage hiérarchique, devises et taux, traductions, notifications, documents et recherche globale. Exemples fictifs.")
        + subtabs("plt-params", [["parametres", "Paramètres"], ["devises", "Devises et taux"], ["langues", "Langues"], ["notifications", "Notifications"], ["documents", "Documents"], ["recherche", "Recherche globale"], ["import", "Import / export"]], tab)
        + ({ parametres: settingsTab, devises: fxTab, langues: langTab, notifications: notifTab, documents: docsTab, recherche: searchTab, import: refTab }[tab] || settingsTab)()
    },
  }

  function usersTab(p) {
    const u = user(p[0])
    const active30 = P.users.filter((x) => x.status === "actif" && daysAgo(x.last) <= 30).length
    const actives = P.users.filter((x) => x.status === "actif")
    const mfaRate = actives.filter((x) => x.mfa !== "aucun").length / actives.length * 100
    const rows = P.users.map((x) => {
      const alerts = []
      if (x.status === "actif" && isPriv(x) && x.mfa === "aucun") alerts.push(badge("MFA requis", "dark"))
      if (x.status === "actif" && daysAgo(x.last) > 90) alerts.push(badge(`Inactif ${daysAgo(x.last)} j`, "outline"))
      return [`<button class="link" onclick="go('plt-acces/utilisateurs/${esc(x.id)}')">${esc(x.name)}</button><div class="muted">${esc(x.email)}</div>`, esc(x.job),
        x.roles.map((a) => `${badge(a.role, role(a.role).priv ? "outline" : "")} <span class="muted">${esc(a.scope)}</span>`).join("<br>") || mutedRef("aucun rôle"),
        x.mfa === "aucun" ? mutedRef("—") : esc(x.mfa), fd(x.last), x.status === "actif" ? badge("Actif", "on") : badge("Désactivé", "dark"), alerts.join(" ")]
    })
    return cards([kpi("Utilisateurs actifs (30 j)", active30, "Hôtel Exemple, exemple"), kpi("Adoption MFA", pct(mfaRate), "utilisateurs actifs avec MFA"),
      kpi("Connexions échouées", P.failed["Hôtel Exemple"].slice(-1)[0], "aujourd'hui"), kpi("Changements de droits", P.rightsChanges.slice(-1)[0][1], "novembre")])
      + (u ? userDetail(u) : `<div class="row between"><h2>Comptes (${P.users.length})</h2>${btn("Nouvel utilisateur", "ui.pltNewUser=!ui.pltNewUser;render()", "sm")}</div>`)
      + (!u && ui.pltNewUser ? card("Nouvel utilisateur", form([
        field("nu-name", "Nom", input("nu-name", "", `placeholder="Awa Fofana"`)),
        field("nu-email", "E-mail", input("nu-email", "", `placeholder="awa.fofana@exemple.test"`)),
        field("nu-job", "Fonction", input("nu-job", "", `placeholder="Réceptionniste"`)),
        field("nu-role", "Rôle initial", select("nu-role", P.roles.map((r) => [r.code, r.label]), "REC")),
        field("nu-scope", "Périmètre", select("nu-scope", scopeOpts(), "Hôtel Exemple · Réception")),
        `<div class="full" id="nu-err"></div>`,
        `<div class="full row">${btn("Créer le compte", "A.plt.createUser()")}${btn("Annuler", "ui.pltNewUser=false;render()", "ghost")}</div>`,
      ])) : "")
      + (!u ? `<div style="margin-top:12px">${tbl(["Utilisateur", "Fonction", "Rôles et périmètres", "MFA", "Dernière connexion", "Statut", "Alertes"], rows)}</div>`
        + `<p class="muted">RG-PLT-07 : désactivation automatique après 90 jours sans connexion · EF-PLT-004 : MFA imposé aux rôles à privilèges (ADM, FIN, SEC) · RG-PLT-01 : un compte appartient à un seul tenant.</p>`
        + (P.users.some((x) => x.status === "actif" && daysAgo(x.last) > 90) ? btn("Appliquer la règle d'inactivité (90 j)", "A.plt.applyInactivity()", "ghost") : "") : "")
  }
  // Périmètres d'attribution : groupe, marque, établissement ou service (EF-PLT-006)
  const scopeType = (s) => (s.startsWith("Groupe") ? "Groupe" : s.startsWith("Marque") ? "Marque" : s.includes("·") ? "Service" : "Établissement")
  const scopes = () => ["Groupe Exemple", ...(D.org ? D.org.brands.map((b) => "Marque " + b.name) : []), "Hôtel Exemple", "Hôtel Exemple Plage", "Hôtel Exemple · Réception", "Hôtel Exemple · Housekeeping", "Hôtel Exemple · Restauration", "Hôtel Exemple · Technique"]
  const scopeOpts = () => scopes().map((s) => [s, scopeType(s) + " — " + s])

  function userDetail(u) {
    const perms = userPerms(u)
    const deleg = P.delegations.filter((d) => d.to === u.id && d.status === "active")
    const hist = P.audit.filter((e) => e.entityId === u.id).slice(-5).reverse()
    return `<div class="row between"><h2>${esc(u.name)}</h2>${btn("Retour à la liste", "go('plt-acces/utilisateurs')", "ghost sm")}</div>`
      + split(card("Compte", `<p style="margin:0">${esc(u.job)} · ${esc(u.email)}</p>
          <p class="muted">Langue ${esc(u.lang)} · dernière connexion ${fd(u.last)} · MFA : ${esc(u.mfa)}</p>
          <p>${u.status === "actif" ? badge("Actif", "on") : badge("Désactivé", "dark")} ${isPriv(u) ? badge("Rôle à privilèges", "outline") : ""}</p>
          ${isPriv(u) && u.mfa === "aucun" ? `<p class="err">MFA obligatoire pour ce rôle : la connexion est refusée tant que l'enrôlement n'est pas fait (EF-PLT-004).</p>` : ""}
          <div class="row">${u.status === "actif" ? btn("Désactiver le compte", `A.plt.deactivate(${q(u.id)})`, "ghost") : btn("Réactiver", `A.plt.reactivate(${q(u.id)})`, "ghost")}
            ${u.mfa === "aucun" ? btn("Envoyer l'enrôlement MFA", `A.plt.enrollMfa(${q(u.id)})`, "ghost") : btn("Réinitialiser le MFA", `A.plt.resetMfa(${q(u.id)})`, "ghost")}</div>
          <p class="muted">La désactivation révoque les sessions et les accès liés en moins de 60 s (EF-PLT-021).</p>`),
        card("Attributions de rôle", tbl(["Rôle", "Type de périmètre", "Périmètre", ""], u.roles.map((a, i) => [esc(role(a.role).label), badge(scopeType(a.scope), "outline"), esc(a.scope), btn("Retirer", `A.plt.revoke(${q(u.id)}, ${i})`, "ghost sm")]), "Aucun rôle attribué.")
          + `<div class="form" style="margin-top:12px">${field("ra-role", "Rôle", select("ra-role", P.roles.map((r) => [r.code, r.label]), "REC"))}${field("ra-scope", "Périmètre (groupe, marque, établissement ou service)", select("ra-scope", scopeOpts(), "Hôtel Exemple"))}
            <div class="full" id="ra-err"></div><div class="full">${btn("Attribuer", `A.plt.assign(${q(u.id)})`)}</div></div>
            <p class="muted">EF-PLT-006 : chaque attribution porte un périmètre. Un rôle à privilèges sur un service seul est refusé : il s'attribue au niveau établissement, marque ou groupe.</p>`
          + (deleg.length ? `<p class="muted">Droits délégués actifs : ${deleg.map((d) => esc(permLabel(d.perm)) + " jusqu'au " + fd(d.au)).join(", ")}</p>` : "")))
      + card("Permissions effectives", `<div class="tags">${[...perms].map((x) => badge(x, "outline")).join("") || mutedRef("Aucune permission.")}</div>`, `style="margin-top:16px"`)
      + `<h3>Historique d'audit du compte</h3>` + tbl(["Horodatage", "Acteur", "Action", "Après"], hist.map((e) => [esc(e.ts), esc(e.actor), esc(e.action), esc(e.after)]), "Aucune entrée.")
  }

  function rolesTab() {
    const unused = P.roles.filter((r) => !P.users.some((u) => u.status === "actif" && u.roles.some((a) => a.role === r.code)))
    return `<h2>Matrice des permissions</h2><p class="muted">Permissions atomiques ressource:action (EF-PLT-005). Cocher ou décocher modifie le rôle ; les rôles système sont modifiables mais tracés. La combinaison « créer un fournisseur » + « approuver un paiement » est refusée (RG-PLT-08).</p>`
      + `<div class="tablewrap"><table><thead><tr><th>Permission</th>${P.roles.map((r) => `<th title="${esc(r.label)}">${esc(r.code)}${r.priv ? " *" : ""}</th>`).join("")}</tr></thead><tbody>`
      + PERMS.map(([k, l]) => `<tr><td>${esc(l)}<div class="muted">${esc(k)}</div></td>${P.roles.map((r) => `<td><input type="checkbox" aria-label="${esc(r.code + " " + k)}" ${r.perms.includes(k) ? "checked" : ""} onchange="A.plt.togglePerm(${q(r.code)}, ${q(k)}, this.checked)"></td>`).join("")}</tr>`).join("")
      + `</tbody></table></div><p class="muted">* rôle à privilèges : MFA obligatoire.</p>`
      + `<div class="cols"><section><h2>Rôles</h2>${tbl(["Code", "Libellé", "Type", "#Utilisateurs"], P.roles.map((r) => [esc(r.code), esc(r.label), r.system ? "Système" : badge("Personnalisé", "outline"), P.users.filter((u) => u.roles.some((a) => a.role === r.code)).length]))}
          <div class="row" style="margin-top:10px;flex-wrap:nowrap">${input("nr-code", "", `placeholder="Code (ex. NIGHT)" style="max-width:150px"`)}${input("nr-label", "", `placeholder="Libellé (ex. Auditeur de nuit)"`)}${btn("Créer le rôle", "A.plt.createRole()", "ghost")}</div></section>
        <section><h2>Règles ABAC</h2>${tbl(["Règle", "Active"], P.abac.map((r) => [esc(r.rule), `<input type="checkbox" aria-label="Activer la règle" ${r.on ? "checked" : ""} onchange="A.plt.toggleAbac(${q(r.id)}, this.checked)">`]))}<p class="muted">Évaluées à chaque requête en plus des rôles (EF-PLT-007).</p></section></div>`
      + `<h2>Campagne de revue des droits</h2>`
      + aiBox("Revue des droits", `${unused.length} rôle(s) sans titulaire actif (${unused.map((r) => r.code).join(", ") || "aucun"}). ${user("U6").name} n'a pas utilisé ses droits depuis ${daysAgo(user("U6").last)} jours : révocation suggérée. ${user("U2").name} cumule « remboursement » et « remise » sans usage du remboursement sur 90 jours. Décision humaine requise.`,
        btn("Révoquer les droits de " + user("U6").name, "A.plt.revokeAll('U6')", "sm") + btn("Ignorer", "toast('Suggestion ignorée, conservée dans la campagne')", "ghost sm"))
      + `<h3>Changements de droits par mois</h3>` + columns(P.rightsChanges.map((x) => x[0]), P.rightsChanges.map((x) => x[1]))
  }

  function delegTab() {
    const actives = P.users.filter((u) => u.status === "actif")
    return `<h2>Délégations temporaires</h2><p class="muted">Délégation d'une permission avec date de fin ; expiration automatique et actions du délégué tracées « au nom de » (EF-PLT-008, US-PLT-03).</p>`
      + tbl(["Réf.", "Délégant", "Délégué", "Permission", "Du", "Au", "Statut", ""], P.delegations.map((d) => [esc(d.id), esc(user(d.from).name), esc(user(d.to).name), esc(permLabel(d.perm)), fd(d.du), fd(d.au),
        d.status === "active" ? badge("Active", "on") : d.status === "expiree" ? badge("Expirée", "outline") : badge("Révoquée", "dark"),
        d.status === "active" ? btn("Révoquer", `A.plt.endDeleg(${q(d.id)})`, "ghost sm") : ""]))
      + card("Nouvelle délégation", form([
        field("dg-from", "Délégant", select("dg-from", actives.map((u) => [u.id, u.name]), "U1")),
        field("dg-to", "Délégué", select("dg-to", actives.map((u) => [u.id, u.name]), "U2")),
        field("dg-perm", "Permission déléguée", select("dg-perm", PERMS.map(([k, l]) => [k, l]), "payment:approve")),
        field("dg-au", "Jusqu'au", input("dg-au", addDays(today, 14), `type="date"`)),
        `<div class="full" id="dg-err"></div>`, `<div class="full">${btn("Déléguer", "A.plt.createDeleg()")}</div>`,
      ]) + `<p class="muted">Le délégant doit détenir la permission ; la délégation ne peut pas créer de conflit de séparation des tâches.</p>`, `style="margin-top:16px"`)
  }

  function authTab() {
    const s = P.sso
    const fails = P.failed["Hôtel Exemple"]
    return `<div class="cols"><section>${card("Fédération d'identité (SSO)", `<p style="margin:0"><strong>${esc(s.provider)}</strong> · SAML 2.0 / OIDC ${badge(s.status === "configure" ? "Configuré" : "À configurer", s.status === "configure" ? "on" : "")}</p>
          <p class="muted">Annuaire : ${esc(s.tenantRef)} · dernière synchronisation SCIM ${esc(s.lastSync)} · un compte désactivé dans l'annuaire perd l'accès à la synchronisation suivante (&lt; 15 min).</p>
          ${s.test ? `<div class="step"><b class="n">✓</b><div>${s.test.map((t) => `<div>${esc(t)}</div>`).join("")}</div></div>` : ""}
          <div class="row">${btn("Tester la connexion", "A.plt.testSso()", "ghost")}${btn("Synchroniser maintenant", "A.plt.syncSso()", "ghost")}</div>
          <h3>Groupes de l'annuaire → rôles HMS</h3>${tbl(["Groupe annuaire", "Rôle HMS", ""], s.mapping.map((m, i) => [esc(m.group), esc(role(m.role).label), btn("Retirer", `A.plt.delMap(${i})`, "ghost sm")]))}
          <div class="row" style="margin-top:8px;flex-wrap:nowrap">${input("mp-group", "", `placeholder="HMS-Housekeeping"`)}${select("mp-role", P.roles.map((r) => [r.code, r.code]), "HKP", `style="max-width:110px"`)}${btn("Ajouter", "A.plt.addMap()", "ghost")}</div>`)}
        ${card("Comptes de service", tbl(["Compte", "Portée", "Clé", "Rotation", ""], P.services.map((x) => [esc(x.name), `<span class="muted">${esc(x.scope)}</span>`, esc(x.key), `${fd(x.rotated)}${x.expires <= addDays(today, 10) ? " " + badge("expire " + fd(x.expires), "dark") : ""}`, btn("Rotation", `A.plt.rotate(${q(x.id)})`, "ghost sm")]))
          + `<p class="muted">Clés factices, stockées dans un coffre de secrets (simulé) · EF-PLT-020.</p>`, `style="margin-top:16px"`)}</section>
      <section>${idpCard()}${card("Politique d'authentification", `<p style="margin:0">Mot de passe + MFA (TOTP, passkey). MFA <strong>imposé</strong> aux rôles à privilèges — paramètre verrouillé au niveau plateforme.</p>
          <h3>Connexions échouées — 7 jours</h3>${columns(["J-6", "J-5", "J-4", "J-3", "J-2", "J-1", "Auj."], fails)}`)}
        ${aiBox("Détection d'anomalies de connexion", `Connexion de ${user("U4").name} à 03:12 depuis un pays inhabituel avec un navigateur inconnu : score 91/100, bloquée automatiquement. L'équipe sécurité doit confirmer ou lever le blocage. Repli : règles statiques (pays, horaires).`)}
        <h3>Connexions récentes</h3>${tbl(["Heure", "Utilisateur", "Contexte", "#Risque", "Décision", ""], P.logins.map((l) => [esc(l.ts.slice(5)), esc(user(l.user).name), `<span class="muted">${esc(l.country)} · ${esc(l.device)}</span>`, l.score,
          { autorise: badge("Autorisée", ""), mfa: badge("MFA renforcé", "outline"), bloque: badge("Bloquée", "dark"), confirme: badge("Blocage confirmé", "dark"), leve: badge("Débloquée", "on") }[l.decision],
          l.decision === "bloque" ? `<span class="row" style="flex-wrap:nowrap">${btn("Confirmer", `A.plt.login(${q(l.id)}, 'confirme')`, "ghost sm")}${btn("Lever", `A.plt.login(${q(l.id)}, 'leve')`, "ghost sm")}</span>` : ""]))}</section></div>`
  }

  // Authentification OIDC (Keycloak simulé) : mot de passe, MFA TOTP / passkey, SSO fédéré SAML 2.0 ou OIDC — EF-PLT-003
  const METHODS = [["pwd", "Mot de passe seul"], ["totp", "Mot de passe + code TOTP"], ["passkey", "Passkey (WebAuthn)"], ["sso-AZ", "SSO Azure AD (SAML 2.0)"], ["sso-GW", "SSO Google Workspace (OIDC)"]]
  function idpCard() {
    const r = ui.pltLoginRes
    return card("Connexion OIDC et fournisseurs d'identité", `<p class="muted" style="margin-top:0">Serveur d'identité OIDC (Keycloak, simulé) : mot de passe, MFA TOTP ou passkey WebAuthn, SSO fédéré. ${mutedRef("EF-PLT-003")}</p>`
      + tbl(["Fournisseur", "Protocole", "Domaine", "Statut", ""], P.idps.map((x) => [esc(x.name), esc(x.proto), mutedRef(x.domain), x.status === "configure" ? badge("Configuré", "on") : badge("À configurer", "outline"),
        x.status === "configure" ? btn("Désactiver", `A.plt.setIdp(${q(x.id)}, false)`, "ghost sm") : btn("Configurer", `A.plt.setIdp(${q(x.id)}, true)`, "ghost sm")]))
      + `<h3>Simuler une connexion</h3><div class="form">${field("lg-user", "Utilisateur", select("lg-user", P.users.map((u) => [u.id, u.name]), ui.pltLoginUser || "U2"))}
        ${field("lg-meth", "Méthode", select("lg-meth", METHODS, ui.pltLoginMeth || "totp"))}
        ${field("lg-code", "Code TOTP (6 chiffres)", input("lg-code", "", `inputmode="numeric" placeholder="123456"`))}
        <div style="align-self:end">${btn("Se connecter", "A.plt.simLogin()", "ghost")}</div></div>`
      + (r ? `<p class="${r.ok ? "" : "err"}">${r.ok ? badge("Connexion acceptée", "on") : badge("Connexion refusée", "dark")} ${esc(r.msg)}</p>` : ""), `style="margin-bottom:16px"`)
  }

  // Isolation stricte des données par tenant, à chaque couche — EF-PLT-002
  const LAYERS = [["API", "Claim tenant_id du jeton comparé à la ressource demandée"], ["Base de données", "Politique de sécurité par ligne (RLS) sur tenant_id"], ["Cache", "Clés préfixées par le tenant"],
    ["Événements", "Sujets partitionnés par tenant, en-tête signé"], ["Stockage de fichiers", "Préfixe par tenant et clé de chiffrement propre"], ["Index de recherche", "Filtre tenant obligatoire injecté côté serveur"],
    ["IA", "Contexte et mémoire filtrés par tenant, aucun entraînement croisé"]]
  const otherTenants = () => (D.ops ? D.ops.tenants.filter((t) => t.id !== "T1").map((t) => [t.id, t.name]) : [["T3", "Groupe Atlantique Exemple"]])
  function isoTab() {
    const t = P.isoTest
    return `<h2>Isolation des données par tenant</h2><p class="muted">Chaque requête est scopée au tenant du jeton (Groupe Exemple). Toute tentative d'accès à un autre tenant est refusée et journalisée. Tests simulés. ${mutedRef("EF-PLT-002")}</p>`
      + tbl(["Couche", "Mécanisme", "Dernier test"], LAYERS.map(([l, m]) => { const r = t && t.results.find((x) => x.layer === l)
        return [esc(l), mutedRef(m), r ? (r.leak ? badge("Fuite détectée", "dark") : badge("Accès refusé", "on")) + ` <span class="muted">${esc(r.detail)}</span>` : mutedRef("non testé")] }))
      + `<div class="form" style="margin-top:12px">${field("iso-t", "Tenant cible", select("iso-t", otherTenants(), "T3"))}${field("iso-l", "Couche", select("iso-l", LAYERS.map((x) => [x[0], x[0]]), "API"))}
        <div style="align-self:end" class="row">${btn("Tenter un accès croisé", "A.plt.crossTenant()", "ghost")}${btn("Lancer le test complet", "A.plt.isoRun()")}</div></div>`
      + (t ? `<p>${t.results.every((x) => !x.leak) ? badge("0 fuite", "on") : badge("Fuite", "dark")} Test du ${esc(t.ts)} contre ${esc(t.target)} : ${t.results.length} couche(s) vérifiée(s).</p>` : "")
  }

  // ---------- Paramètres ----------
  const LEVELS = [["plateforme", "Plateforme"], ["tenant", "Groupe Exemple"], ["etab", "Hôtel Exemple"]]
  const effective = (s) => { let v, from; LEVELS.forEach(([k]) => { if (s.values[k] != null) (v = s.values[k]), (from = k) }); return [v, from] }
  function settingsTab() {
    return `<h2>Paramétrage hiérarchique</h2><p class="muted">Plateforme → groupe → établissement, avec héritage et surcharge (EF-PLT-011). Un paramètre verrouillé à un niveau ne peut pas être surchargé en dessous (RG-PLT-04).</p>`
      + `<div class="tablewrap"><table><thead><tr><th>Paramètre</th>${LEVELS.map(([, l]) => `<th>${esc(l)}</th>`).join("")}<th>Valeur effective</th><th>Surcharge établissement</th></tr></thead><tbody>`
      + P.settings.map((s, i) => { const [v, from] = effective(s)
        return `<tr><td>${esc(s.label)}<div class="muted">${esc(s.key)}</div></td>${LEVELS.map(([k]) => `<td>${s.values[k] != null ? esc(s.values[k]) : `<span class="muted">hérité</span>`}${s.lock === k ? " " + badge("verrouillé", "dark") : ""}</td>`).join("")}
          <td><strong>${esc(v)}</strong><div class="muted">${esc(LEVELS.find((x) => x[0] === from)[1])}</div></td>
          <td><span class="row" style="flex-wrap:nowrap">${input("st-" + i, s.values.etab ?? "", `aria-label="Valeur établissement" style="max-width:120px"`)}${btn("OK", `A.plt.setSetting(${i})`, "ghost sm")}</span></td></tr>` }).join("")
      + `</tbody></table></div>`
      + cards([card("Date hôtelière", `<div class="kpi">${fd(today)}/${today.slice(0, 4)}</div><p class="muted">Distincte de la date calendaire (EF-PLT-014). Elle ne change que par l'audit de nuit (RG-PLT-06) : aucun bouton ici.</p>`),
        card("Fuseau et région", `<p style="margin:0">Africa/Abidjan (UTC+0)</p><p class="muted">Région de résidence des données : Afrique de l'Ouest · devise XOF · langue fr (EF-PLT-001).</p>`)])
  }
  function fxTab() {
    return `<div class="cols"><section><h2>Taux du jour (vers XOF)</h2>${tbl(["Devise", "#Taux", "Date", "Source"], P.rates.map((r) => [esc(r.from), esc(String(r.rate).replace(".", ",")), fd(r.date), esc(r.source)]))}
        <div class="row" style="margin-top:10px;flex-wrap:nowrap">${select("fx-cur", ["EUR", "USD", "GBP", "GHS", "NGN", "MAD"], "USD", `style="max-width:100px"`)}${input("fx-rate", "", `type="number" step="0.001" placeholder="Taux manuel"`)}${btn("Enregistrer", "A.plt.setRate()", "ghost")}</div>
        <p class="muted">Source automatique simulée + saisie manuelle (EF-PLT-013). Le franc CFA est arrimé à l'euro.</p></section>
      <section><h2>Taux figés sur les transactions</h2>${tbl(["Transaction", "Date", "#Montant", "#Taux appliqué", "#Contre-valeur"], P.fxTx.map((t) => [esc(t.ref), fd(t.date), `${t.amount} ${esc(t.cur)}`, esc(String(t.rate).replace(".", ",")), money(t.amount * t.rate)]))}
        <p class="muted">RG-PLT-05 : un nouveau taux ne recalcule jamais une transaction passée.</p></section></div>`
  }
  const TR = { valide: ["Validé", "on"], brouillon: ["Brouillon IA", "outline"], manquant: ["Manquant", ""] }
  function langTab() {
    const total = P.contents.length * P.langs.length, done = P.contents.reduce((s, c) => s + Object.values(c.tr).filter((x) => x === "valide").length, 0)
    return cards([kpi("Langues actives", P.langs.length, "dont 1 droite-à-gauche"), kpi("Traductions validées", pct(done / total * 100), `${done} sur ${total}`)])
      + `<h2>Contenus à traduire</h2>` + tbl(["Contenu", ...P.langs.map((l) => l[1]), ""], P.contents.map((c) => [esc(c.label),
        ...P.langs.map(([k]) => `${st(TR, c.tr[k])}${c.tr[k] === "brouillon" ? " " + btn("Valider", `A.plt.validateTr(${q(c.id)}, ${q(k)})`, "ghost sm") : ""}`),
        Object.values(c.tr).includes("manquant") ? btn("Proposer (IA)", `A.plt.aiTranslate(${q(c.id)})`, "ghost sm") : ""]))
      + aiBox("Traduction assistée", "Les traductions proposées par le modèle de langue restent en « Brouillon IA » : une validation humaine est obligatoire avant publication. Repli : saisie manuelle.")
      + card("Aperçu droite-à-gauche (SMS de rappel, arabe)", `<p dir="rtl" lang="ar" style="margin:0;font-size:17px">مرحبا بكم في فندق المثال. نحن في انتظاركم غدا.</p><p class="muted">Mise en page inversée automatiquement (EF-PLT-012).</p>`, `style="margin-top:16px"`)
  }
  function notifTab() {
    return `<h2>Délivrabilité par canal (30 j)</h2>` + bars(P.delivery.map(([c, s, d]) => ({ label: c, value: Math.round(d / s * 1000) / 10 })), (v) => v + " %")
      + `<p class="muted">Messages délivrés / envoyés · fournisseurs e-mail, SMS, WhatsApp et push simulés.</p>`
      + `<h2>Modèles versionnés</h2>` + tbl(["Code", "Modèle", "Canal", "Langues", "#Version", "Mis à jour", ""], P.templates.map((t) => [esc(t.code) + (t.marketing ? " " + badge("marketing", "outline") : ""), esc(t.label), esc(t.channel), esc(t.langs), "v" + t.version, fd(t.updated), btn("Publier v" + (t.version + 1), `A.plt.bumpTpl(${q(t.code)})`, "ghost sm")]))
      + card("Envoyer une notification", `<p class="muted" style="margin-top:0">Envoi multicanal (e-mail, SMS, WhatsApp, push, in-app) depuis la dernière version du modèle, dans la langue du destinataire ; repli en français si la traduction manque. Fournisseurs simulés. ${mutedRef("EF-PLT-015")}</p>
        <div class="form">${field("nt-tpl", "Modèle", select("nt-tpl", P.templates.map((t) => [t.code, `${t.code} · ${t.channel}`]), "ARR_RAPPEL"))}
        ${field("nt-to", "Destinataire", select("nt-to", D.guests.map((g) => [g.id, g.name]), "G3"))}
        ${field("nt-lang", "Langue", select("nt-lang", P.langs.map(([k, l]) => [k, l]), "fr"))}
        <div style="align-self:end">${btn("Envoyer", "A.plt.sendNotif()")}</div></div>`
        + (P.sent.length ? tbl(["Heure", "Modèle", "Canal", "Langue", "Destinataire", "Résultat"], P.sent.slice(-6).reverse().map((x) => [esc(x.ts.slice(11)), `${esc(x.code)} v${x.version}`, esc(x.channel), esc(x.lang), esc((G(x.to) || { name: x.to }).name), x.ok ? badge("Délivré", "on") + (x.note ? ` <span class="muted">${esc(x.note)}</span>` : "") : badge("Bloqué", "dark") + ` <span class="muted">${esc(x.note)}</span>`]))
          : `<p class="muted">Aucun envoi depuis cet écran.</p>`), `style="margin-top:16px"`)
      + `<h2>Désinscriptions</h2>` + tbl(["Destinataire", "Canal", "Depuis"], P.optouts.map((o) => [esc((G(o.who) || { name: o.who }).name), esc(o.channel), fd(o.since)]))
      + `<p class="muted">Respectées automatiquement pour tous les envois non transactionnels (EF-PLT-016).</p>`
  }
  function docsTab() {
    const expired = P.documents.filter((d) => d.until < today)
    return `<h2>Documents chiffrés</h2><p class="muted">Chiffrement par clé du tenant (simulé), durée de conservation et purge automatique (EF-PLT-017).</p>`
      + tbl(["Réf.", "Type", "Propriétaire", "Conservation jusqu'au", "Chiffré", ""], P.documents.map((d) => [esc(d.id), esc(d.type), esc((G(d.owner) || { name: d.owner }).name), `${d.until.split("-").reverse().join("/")}${d.until < today ? " " + badge("échu", "dark") : ""}`, badge("AES-256", "outline"), btn("Consulter", `A.plt.viewDoc(${q(d.id)})`, "ghost sm")]))
      + `<p class="muted">Toute consultation d'une pièce d'identité est inscrite au journal d'audit (« consultation sensible », EF-PLT-009).</p>`
      + (expired.length ? `<div class="row" style="margin-top:10px">${btn(`Purger ${expired.length} document(s) échu(s)`, "A.plt.purgeDocs()")}</div>` : `<p class="muted">Aucun document échu.</p>`)
  }
  // Import / export des données de référence — EF-PLT-019
  const REFS = {
    segments: { label: "Segments de marché", head: "code;libelle", sample: "LOI;Loisirs (mis à jour)\nSPT;Sport et compétitions\nmice;Séminaires\nSPT;Doublon de la ligne 2\nCUL;\nDIP;Corps diplomatique" },
    transactions: { label: "Codes de transaction", head: "code;libelle", sample: "SPA;Soins spa\nPKG;Parking\nHEB;Hébergement\nTRF;Transfert aéroport\n;Ligne sans code" },
    taux: { label: "Taux de change vers XOF", head: "devise;taux", sample: "USD;600,5\nGHS;39,1\nEUR;650\nMAD;-3\nZAR;32,8\nXX;10" },
  }
  const refRows = (k) => (k === "taux" ? P.rates.map((r) => [r.from, String(r.rate).replace(".", ",")]) : D.org ? D.org.codes[k].map((c) => [c[0], c[1]]) : [])
  function refTab() {
    const k = ui.pltRef || "segments", r = REFS[k], rep = P.refImport && P.refImport.kind === k ? P.refImport : null
    return `<h2>Import / export des données de référence</h2><p class="muted">Fichier CSV ou Excel (simulé) : validation ligne par ligne, rapport d'erreurs, puis import des seules lignes valides. ${mutedRef("EF-PLT-019")}</p>`
      + `<div class="form">${field("rf-kind", "Référentiel", select("rf-kind", Object.entries(REFS).map(([x, v]) => [x, v.label]), k, `onchange="ui.pltRef=this.value;D.plt.refImport=null;render()"`))}
        ${field("rf-fmt", "Format", select("rf-fmt", [["csv", "CSV (;)"], ["xlsx", "Excel .xlsx (simulé)"]], ui.pltRefFmt || "csv", `onchange="ui.pltRefFmt=this.value"`))}
        <div class="full"><label for="rf-data">Contenu du fichier (en-tête : ${esc(r.head)})</label><textarea id="rf-data" rows="6" style="width:100%;font:inherit">${esc(rep ? rep.raw : r.sample)}</textarea></div>
        <div class="full row">${btn("Valider le fichier", "A.plt.refValidate()")}${btn("Exporter " + r.label.toLowerCase(), "A.plt.refExport()", "ghost")}</div></div>`
      + (rep ? `<h3>Rapport de validation</h3>` + tbl(["Ligne", "Valeur 1", "Valeur 2", "Résultat"], rep.rows.map((x) => [x.line, esc(x.a || "—"), esc(x.b || "—"),
        x.err ? `<span class="err">${esc(x.err)}</span>` : x.done ? badge("Importée", "on") : badge(x.update ? "Mise à jour" : "Création", "outline")]))
        + `<p class="muted">${rep.rows.filter((x) => !x.err).length} ligne(s) valide(s), ${rep.rows.filter((x) => x.err).length} en erreur.</p>`
        + (rep.rows.some((x) => !x.err && !x.done) ? btn(`Importer les ${rep.rows.filter((x) => !x.err && !x.done).length} lignes valides`, "A.plt.refImport()") : "") : "")
      + (ui.pltExport && ui.pltExport.kind === k ? `<h3>Export (${esc(ui.pltExport.fmt)})</h3><pre style="white-space:pre-wrap;font-size:12px">${esc(ui.pltExport.text)}</pre>` : "")
      + `<p class="muted">Export actuel : ${refRows(k).length} ligne(s).</p>`
  }

  function searchTab() {
    return `<h2>Recherche globale</h2><p class="muted">Clients, réservations, chambres et factures, dans la limite de vos droits (EF-PLT-018).</p>
      <input id="gs" placeholder="Nom, référence, n° de chambre…" aria-label="Recherche globale" oninput="A.plt.search(this.value)" value="${esc(ui.pltSearch || "")}">
      <div id="gs-res" style="margin-top:12px">${searchResults(ui.pltSearch || "")}</div>`
  }
  function searchResults(s) {
    s = s.toLowerCase().trim()
    if (s.length < 2) return `<p class="muted">Saisissez au moins 2 caractères.</p>`
    const res = [
      ...D.guests.filter((g) => g.name.toLowerCase().includes(s) || g.email.includes(s)).map((g) => ["Client", esc(g.name), `go('clients/${esc(g.id)}')`]),
      ...D.reservations.filter((r) => r.id.toLowerCase().includes(s) || G(r.guest).name.toLowerCase().includes(s)).map((r) => ["Réservation", `${esc(r.id)} · ${esc(G(r.guest).name)} · ${fd(r.from)}`, `go('reservations')`]),
      ...D.rooms.filter((r) => r.no.includes(s)).map((r) => ["Chambre", `${esc(r.no)} · ${esc(T(r.type).label)}`, `go('org-chambres/chambres')`]),
      ...D.reservations.filter((r) => r.invoice && r.invoice.toLowerCase().includes(s)).map((r) => ["Facture", esc(r.invoice), `go('facture/${esc(r.id)}')`]),
    ]
    return tbl(["Type", "Résultat", ""], res.slice(0, 15).map(([t, l, o]) => [badge(t, "outline"), l, `<button class="btn ghost sm" onclick="${o}">Ouvrir</button>`]), "Aucun résultat.")
  }

  // ====================================================================
  // Écrans ORG
  // ====================================================================
  const oviews = {
    etab(p) {
      const tab = p[0] || "groupe"
      return pageHead("Établissements et structure", "Groupe, marques, sociétés, établissements, bâtiments, espaces communs, portes contrôlées et services. Données fictives.")
        + subtabs("org-etab", [["groupe", "Groupe et établissements"], ["structure", "Bâtiments et espaces"], ["services", "Services et centres de profit"]], tab)
        + ({ groupe: groupTab, structure: structTab, services: deptTab }[tab] || groupTab)()
    },
    chambres(p) {
      const tab = p[0] || "chambres"
      const sellable = D.rooms.filter((r) => O.roomOps[r.no] !== "hc").length
      const hc = D.rooms.filter((r) => O.roomOps[r.no] === "hc").length
      const complete = D.roomTypes.filter((t) => { const i = O.typeInfo[t.code]; return i.photos > 0 && ["fr", "en", "ar"].every((l) => i.desc[l]) }).length
      return pageHead("Chambres et types", "Inventaire physique de l'Hôtel Exemple, types vendables, équipements et import en masse. Relié au statut des chambres de la réception.")
        + cards([kpi("Chambres", D.rooms.length, `${sellable} vendables`), kpi("Hors commande", hc, `taux ${pct(hc / D.rooms.length * 100)} des nuitées du jour`), kpi("Complétude des contenus", pct(complete / D.roomTypes.length * 100), "types avec photos et 3 langues")])
        + subtabs("org-chambres", [["chambres", "Chambres"], ["types", "Types de chambres"], ["equipements", "Équipements"], ["import", "Import"]], tab)
        + ({ chambres: roomsTab, types: typesTab, equipements: equipTab, import: importTab }[tab] || roomsTab)()
    },
    codes(p) {
      const tab = p[0] || "segments"
      return pageHead("Codes de référence et taxes", "Référentiels partagés par tous les modules : segments, origines, codes de transaction et taxes. Taux d'exemple, à valider par le comptable.")
        + subtabs("org-codes", [["segments", "Segments"], ["origines", "Origines"], ["transactions", "Codes de transaction"], ["taxes", "Taxes"]], tab)
        + (tab === "taxes" ? taxTab() : codeTab(tab))
    },
  }

  const POL = [["children", "Enfants acceptés", "Enfants non admis"], ["pets", "Animaux admis", "Animaux non admis"], ["smoking", "Chambres fumeurs", "Non-fumeur"]]
  const polText = (p) => POL.map(([k, y, n]) => (p[k] ? y : n)).join(" · ")
  const classText = (x) => `${x.palace ? "Palace · " : ""}${x.stars} étoile${x.stars > 1 ? "s" : ""} (officiel)${x.commercial ? ` · positionnement commercial ${x.commercial}` : ""}`
  const entity = (id) => O.entities.find((e) => e.id === id)
  function groupTab() {
    const CK = [["type", "Au moins un type de chambre"], ["chambre", "Au moins une chambre"], ["tarif", "Un plan tarifaire"], ["taxe", "Un compte de taxe"], ["paiement", "Un mode de paiement"]]
    const ed = O.properties.find((x) => x.id === ui.orgEditProp)
    return `<div class="cols"><section><div class="row between"><h2>Marques</h2>${btn("Nouvelle marque", "ui.orgNewBrand=!ui.orgNewBrand;render()", "ghost sm")}</div>
      <p class="muted">Charte graphique, standards de service et gamme par marque ${mutedRef("· EF-ORG-001")}</p>`
      + (ui.orgNewBrand ? card("", form([field("br-code", "Code (3 lettres)", input("br-code", "", `placeholder="EXL"`)), field("br-name", "Nom", input("br-name", "", `placeholder="Exemple Lodge"`)),
        field("br-range", "Gamme", select("br-range", ["Économique (2 étoiles)", "Milieu de gamme (3-4 étoiles)", "Haut de gamme (5 étoiles)", "Luxe (Palace)"], "Milieu de gamme (3-4 étoiles)")),
        field("br-color", "Couleur de charte", input("br-color", "#2b4c7e", `type="color"`)), field("br-font", "Police de charte", select("br-font", ["Inter", "Playfair Display", "Source Sans", "Montserrat"], "Inter")),
        `<div class="full" id="br-err"></div>`, `<div class="full">${btn("Créer la marque", "A.org.addBrand()")}</div>`]), `style="margin-bottom:12px"`) : "")
      + O.brands.map((b) => card(b.name, `<p class="muted" style="margin:0">${esc(b.code)} · ${esc(b.range)}</p>
        <p style="margin:8px 0" class="row"><span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${esc(b.charter.color)}" title="Couleur de charte"></span> <span class="muted">Charte : ${esc(b.charter.color)} · police ${esc(b.charter.font)} · logo ${esc(b.charter.logo)}</span></p>
        ${tbl(["Standard de service", "Application", ""], b.standards.map((s, i) => [esc(s.label), s.mandatory ? badge("Obligatoire", "on") : badge("Recommandé", "outline"), btn(s.mandatory ? "Rendre recommandé" : "Rendre obligatoire", `A.org.toggleStd(${q(b.code)}, ${i})`, "ghost sm")]))}
        <div class="row" style="margin-top:8px;flex-wrap:nowrap">${input("bs-" + b.code, "", `placeholder="Nouveau standard" aria-label="Nouveau standard ${esc(b.name)}"`)}${btn("Ajouter (obligatoire)", `A.org.addStandard(${q(b.code)})`, "ghost sm")}</div>
        <p class="muted">RG-ORG-06 : ${b.standards.filter((s) => s.mandatory).length} standard(s) obligatoire(s) appliqué(s) à ${O.properties.filter((x) => x.brand === b.code).length} établissement(s).</p>`, `style="margin-bottom:12px"`)).join("")
      + `</section><section><div class="row between"><h2>Sociétés juridiques</h2>${btn("Nouvelle société", "ui.orgNewEnt=!ui.orgNewEnt;render()", "ghost sm")}</div>
      <p class="muted">Entités distinctes des établissements, avec identifiants fiscaux et devise fonctionnelle ${mutedRef("· EF-ORG-002")}</p>`
      + (ui.orgNewEnt ? card("", form([field("le-name", "Raison sociale", input("le-name", "", `placeholder="Yamoussoukro Hôtellerie Exemple SA"`)), field("le-tax", "N° de compte contribuable (NCC)", input("le-tax", "", `placeholder="0000002Z"`)),
        field("le-rccm", "RCCM", input("le-rccm", "", `placeholder="CI-EXE-0000-B-00002"`)), field("le-cur", "Devise fonctionnelle", select("le-cur", ["XOF", "EUR", "USD", "GHS"], "XOF")),
        field("le-led", "Référentiel comptable", select("le-led", ["SYSCOHADA", "IFRS"], "SYSCOHADA")), `<div class="full" id="le-err"></div>`, `<div class="full">${btn("Créer la société", "A.org.addEntity()")}</div>`]), `style="margin-bottom:12px"`) : "")
      + O.entities.map((e) => card(e.name, `<p class="muted" style="margin:0">${esc(e.tax)}<br>${esc(e.rccm)}<br>Devise fonctionnelle ${esc(e.currency)} · référentiel ${esc(e.ledger)}</p>
        <p style="margin:8px 0 0">Établissements : ${O.properties.filter((x) => x.entity === e.id).map((x) => badge(x.name, "outline")).join(" ") || mutedRef("aucun")}</p>`, `style="margin-bottom:12px"`)).join("") + `</section></div>`
      + `<div class="row between"><h2>Établissements</h2>${btn("Créer depuis le modèle de marque", "ui.orgClone=!ui.orgClone;render()", "sm")}</div>`
      + (ui.orgClone ? card("Nouvel établissement (US-ORG-01)", form([
        field("cl-name", "Nom", input("cl-name", "", `placeholder="Hôtel Exemple Bouaké"`)),
        field("cl-city", "Ville", input("cl-city", "", `placeholder="Bouaké"`)),
        field("cl-src", "Modèle", select("cl-src", O.properties.map((x) => [x.id, x.name + " (" + x.code + ")"]), "P1")),
        `<div class="full"><label>Éléments à copier</label><div class="row">${["Types de chambres", "Codes et taxes", "Paramètres", "Modèles de notification"].map((x, i) => `<label class="row" style="color:var(--ink)"><input type="checkbox" id="cl-c${i}" checked> ${esc(x)}</label>`).join("")}</div></div>`,
        `<div class="full" id="cl-err"></div>`, `<div class="full row">${btn("Dupliquer", "A.org.clone()")}${btn("Annuler", "ui.orgClone=false;render()", "ghost")}</div>`,
        `<p class="full muted">Duplication de la configuration d'un établissement existant ; le nouvel établissement démarre en préouverture avec sa liste de contrôle d'activation · EF-ORG-012.</p>`,
      ]), `style="margin-bottom:16px"`) : "")
      + (ed ? card(`Modifier — ${ed.name}`, form([
        field("pe-addr", "Adresse", input("pe-addr", ed.address), "full"),
        field("pe-lat", "Latitude", input("pe-lat", ed.geo[0], `type="number" step="0.0001"`)), field("pe-lng", "Longitude", input("pe-lng", ed.geo[1], `type="number" step="0.0001"`)),
        field("pe-tz", "Fuseau", select("pe-tz", ["Africa/Abidjan", "Africa/Accra", "Africa/Lagos", "Europe/Paris"], ed.tz)), field("pe-cur", "Devise", select("pe-cur", ["XOF", "EUR", "USD", "GHS"], ed.currency)),
        field("pe-langs", "Langues (séparées par des virgules)", input("pe-langs", ed.langs)), field("pe-ent", "Société juridique", select("pe-ent", O.entities.map((e) => [e.id, e.name]), ed.entity)),
        field("pe-in", "Heure de check-in", input("pe-in", ed.checkin, `placeholder="14:00"`)), field("pe-out", "Heure de check-out", input("pe-out", ed.checkout, `placeholder="12:00"`)),
        `<div class="full"><label>Politiques</label><div class="row">${POL.map(([k, y]) => `<label class="row" style="color:var(--ink)"><input type="checkbox" id="pe-${k}" ${ed.policies[k] ? "checked" : ""}> ${esc(y)}</label>`).join("")}</div></div>`,
        field("pe-stars", "Classement officiel", select("pe-stars", ["1", "2", "3", "4", "5"].map((x) => [x, x + " étoile" + (x > 1 ? "s" : "")]), String(ed.stars))),
        `<div style="align-self:end"><label class="row" style="color:var(--ink)"><input type="checkbox" id="pe-palace" ${ed.palace ? "checked" : ""}> Distinction « Palace »</label></div>`,
        field("pe-com", "Positionnement commercial", select("pe-com", [["", "Aucun"], ["6 étoiles", "6 étoiles (commercial)"], ["7 étoiles", "7 étoiles (commercial)"]], ed.commercial)),
        field("pe-labels", "Labels (séparés par des virgules)", input("pe-labels", ed.labels.join(", "))),
        `<div class="full" id="pe-err"></div>`, `<div class="full row">${btn("Enregistrer", `A.org.saveProp(${q(ed.id)})`)}${btn("Annuler", "ui.orgEditProp=null;render()", "ghost")}</div>`,
        `<p class="full muted">EF-ORG-003 : adresse, géolocalisation, fuseau, devise, langues, horaires et politiques. EF-ORG-011 : « Palace » et le positionnement 6-7 étoiles (commercial, non officiel) exigent un classement officiel 5 étoiles.</p>`,
      ]), `style="margin-bottom:16px"`) : "")
      + `<div class="grid">${O.properties.map((x) => {
        const ck = x.checklist, e = entity(x.entity)
        return card(x.name, `<p class="muted" style="margin:0">${esc(x.code)} · ${esc(x.city)} · ${"★".repeat(x.stars)} · marque ${esc(O.brands.find((b) => b.code === x.brand).name)}</p>
          <p style="margin:8px 0">${x.status === "exploitation" ? badge("En exploitation", "on") : badge("Préouverture", "outline")} ${x.palace ? badge("Palace", "dark") : ""}</p>
          <p class="muted">${esc(x.address)} · géo ${esc(x.geo.join(", "))}<br>${esc(x.tz)} · ${esc(x.currency)} · langues ${esc(x.langs)} · check-in ${esc(x.checkin)} / check-out ${esc(x.checkout)}<br>${esc(polText(x.policies))}<br>Société : ${esc(e ? e.name : "—")}</p>
          <p style="margin:6px 0">Classement : ${esc(classText(x))}</p><div class="tags">${x.labels.map((l) => badge(l, "outline")).join("") || mutedRef("aucun label")}</div>
          <p class="muted">EF-ORG-003 · EF-ORG-011</p>
          <div class="row">${btn("Modifier la fiche", `ui.orgEditProp=${q(x.id)};render()`, "ghost sm")}</div>
          ${ck ? `<h3>Liste de contrôle d'activation</h3>${CK.map(([k, l]) => `<div>${ck[k] ? badge("OK", "on") : badge("À faire", "")} ${esc(l)} ${ck[k] ? "" : btn("Marquer fait", `A.org.check(${q(x.id)}, ${q(k)})`, "ghost sm")}</div>`).join("")}
            <div class="row" style="margin-top:10px">${btn("Activer l'établissement", `A.org.activate(${q(x.id)})`)}</div><p class="muted">RG-ORG-05 : activation refusée tant qu'un élément manque.</p>` : ""}`)
      }).join("")}</div>`
  }
  function structTab() {
    const b = O.buildings[0]
    return `<h2>${esc(b.name)}</h2><p class="muted">Établissement → bâtiment → étage → chambre / espace (EF-ORG-004).</p>`
      + tbl(["Étage", "Chambres", "Espaces"], b.floors.map((f) => [f === 0 ? "Rez-de-chaussée" : "Étage " + f,
        D.rooms.filter((r) => r.floor === f).map((r) => `${esc(r.no)}${O.roomOps[r.no] === "hc" ? "*" : ""}`).join(", ") || mutedRef("—"),
        O.spaces.filter((s) => s.floor === f).map((s) => esc(s.name)).join(", ") || mutedRef("—")]))
      + `<p class="muted">* chambre hors commande.</p>`
      + `<h2>Espaces communs et portes contrôlées</h2>` + tbl(["Espace", "Type", "Horaires", "Portes (serrure)", ""], O.spaces.map((s) => [esc(s.name), esc(s.type), esc(s.hours),
        s.doors.map((d) => `${esc(d.ref)} <span class="muted">${esc(d.maker)} · ${esc(d.mode)}</span>`).join("<br>") || badge("Aucune porte", "dark"),
        btn("Ajouter une porte", `A.org.addDoor(${q(s.id)})`, "ghost sm")]))
      + `<div class="row" style="margin-top:10px;flex-wrap:nowrap">${select("dr-maker", ["Fabricant Exemple", "Fabricant Exemple B"], "Fabricant Exemple", `aria-label="Fabricant" style="max-width:190px"`)}${select("dr-mode", ["en ligne", "hors ligne"], "en ligne", `aria-label="Type de serrure" style="max-width:130px"`)}<span class="muted">fabricant et type appliqués aux portes ajoutées</span></div>`
      + `<h2>Portes des chambres</h2>` + tbl(["Chambre", "Étage", "Portes (référence · fabricant · modèle)", "Type", ""], D.rooms.map((r) => { const ds = O.roomDoors[r.no] || []
        return [`<strong>${esc(r.no)}</strong>`, r.floor, ds.map((d) => `${esc(d.ref)} <span class="muted">${esc(d.maker)} · ${esc(d.model)}</span>`).join("<br>") || badge("Aucune porte", "dark"),
          ds.map((d, i) => select(`dm-${r.no}-${i}`, ["en ligne", "hors ligne"], d.mode, `aria-label="Mode de la porte ${esc(d.ref)}" style="max-width:120px" onchange="A.org.setDoorMode(${q(r.no)}, ${i}, this.value)"`)).join("<br>"),
          btn("Ajouter une porte", `A.org.addRoomDoor(${q(r.no)})`, "ghost sm")] }))
      + `<p class="muted">Chaque chambre et chaque espace est associé à une ou plusieurs portes contrôlées, lues par le module Contrôle d'accès (serrures simulées). Une serrure hors ligne est encodée par carte, sans liaison temps réel. EF-ORG-007 · EF-ORG-008.</p>`
  }
  function deptTab() {
    return `<h2>Services et centres de profit</h2>` + tbl(["Code", "Service", "Centre", "Compte analytique"], O.departments.map((d) => [esc(d.code), esc(d.name), badge(d.pc, d.pc.startsWith("CP") ? "outline" : ""), esc(d.account)]))
      + `<p class="muted">CP = centre de profit, CC = centre de coût. Utilisés pour l'imputation financière (EF-ORG-010).</p>`
      + `<div class="row" style="margin-top:10px;flex-wrap:nowrap">${input("dp-code", "", `placeholder="Code" style="max-width:100px"`)}${input("dp-name", "", `placeholder="Service (ex. Boutique)"`)}${select("dp-pc", ["CP-HEB", "CP-FNB", "CP-SPA", "CP-BTQ", "CC-TEC", "CC-ADM"], "CP-BTQ", `style="max-width:120px"`)}${btn("Ajouter", "A.org.addDept()", "ghost")}</div>`
  }
  function roomsTab() {
    const nos = new Set(D.rooms.map((r) => r.no))
    return `<p class="muted" style="margin-top:14px">RG-ORG-02 : « hors commande » retire la chambre de l'inventaire vendable ; « hors service » la laisse vendable mais elle n'est pas attribuée. RG-ORG-04 : pas de changement de type pour une chambre occupée. EF-ORG-014 : une chambre avec historique s'archive, elle ne se supprime pas.</p>`
      + tbl(["N°", "Type", "Étage", "Attributs", "Statut d'exploitation", "Ménage", ""], D.rooms.map((r) => {
        const a = O.roomAttr[r.no] || {}
        const attrs = [a.pmr && "PMR", a.connected && "Connectée", a.smoke && "Fumeur", a.link && "Communique avec " + a.link].filter(Boolean)
        return [`<strong>${esc(r.no)}</strong>`, select("rt-" + r.no, D.roomTypes.map((t) => [t.code, t.label]), r.type, `aria-label="Type" onchange="A.org.setType(${q(r.no)}, this.value)" style="max-width:140px"`), r.floor,
          attrs.map((x) => badge(x, "outline")).join(" ") || mutedRef("—"),
          select("ro-" + r.no, Object.entries(OPS).map(([k, [l]]) => [k, l]), O.roomOps[r.no], `aria-label="Statut d'exploitation" onchange="A.org.setOps(${q(r.no)}, this.value)" style="max-width:150px"`),
          pill(HK, r.hk), btn(hasHistory(r.no) ? "Archiver" : "Supprimer", `A.org.removeRoom(${q(r.no)})`, "ghost sm")]
      }))
      + (O.archived.length ? `<p class="muted">Archivées : ${O.archived.map((r) => esc(r.no)).join(", ")}</p>` : "")
      + attrCard() + suitesCard()
      + card("Ajouter une chambre", `<div class="form">${field("nr-no", "Numéro", input("nr-no", "", `placeholder="305"`))}${field("nr-type", "Type", select("nr-type", D.roomTypes.map((t) => [t.code, t.label]), "STD"))}
          ${field("nr-floor", "Étage", select("nr-floor", [["1", "1"], ["2", "2"], ["3", "3"]], "3"))}<div style="align-self:end"><label class="row" style="color:var(--ink)"><input type="checkbox" id="nr-pmr"> Accessible PMR</label></div>
          <div class="full" id="nr-err"></div><div class="full">${btn("Ajouter", "A.org.addRoom()")}</div></div><p class="muted">Numéro unique dans l'établissement (RG-ORG-01) · ${nos.size} numéros utilisés.</p>`, `style="margin-top:16px"`)
  }
  // Caractéristiques d'une chambre : PMR, connectée, fumeur, communicante — EF-ORG-006
  function attrCard() {
    const no = ui.orgAttrRoom && D.rooms.some((r) => r.no === ui.orgAttrRoom) ? ui.orgAttrRoom : D.rooms[0].no
    const r = D.rooms.find((x) => x.no === no), a = O.roomAttr[no] || {}
    return card("Caractéristiques d'une chambre", `<p class="muted" style="margin-top:0">Numéro, type, étage, caractéristiques, chambre communicante et statut d'exploitation (tableau ci-dessus) · EF-ORG-006.</p>
      <div class="form">${field("at-no", "Chambre", select("at-no", D.rooms.map((x) => x.no), no, `onchange="ui.orgAttrRoom=this.value;render()"`))}
      <div class="full row">${[["pmr", "Accessible PMR"], ["connected", "Connectée (domotique)"], ["smoke", "Fumeur"]].map(([k, l]) => `<label class="row" style="color:var(--ink)"><input type="checkbox" id="at-${k}" ${a[k] ? "checked" : ""}> ${esc(l)}</label>`).join("")}</div>
      ${field("at-link", "Communique avec", select("at-link", [["", "Aucune"], ...D.rooms.filter((x) => x.no !== no && x.floor === r.floor).map((x) => [x.no, x.no])], a.link || ""))}
      <div class="full" id="at-err"></div><div class="full">${btn("Enregistrer", "A.org.saveAttr()")}</div></div>`, `style="margin-top:16px"`)
  }
  // Suites composées de plusieurs chambres physiques, vendables ensemble ou séparément — EF-ORG-009
  const SALE = { ensemble: "Ensemble uniquement", separe: "Séparément uniquement", "les deux": "Ensemble ou séparément" }
  const suiteFree = (su) => su.rooms.every((no) => !occupant(no) && O.roomOps[no] !== "hc")
  function suitesCard() {
    const used = new Set(O.suites.flatMap((x) => x.rooms))
    const cand = D.rooms.filter((r) => !used.has(r.no) && (O.roomAttr[r.no] || {}).link && !used.has(O.roomAttr[r.no].link) && r.no < O.roomAttr[r.no].link)
    return card("Suites composées", `<p class="muted" style="margin-top:0">Une suite regroupe des chambres communicantes, vendue comme un tout ou chambre par chambre · EF-ORG-009.</p>`
      + tbl(["Suite", "Chambres", "Vente", "#Tarif suite", "Ce soir", ""], O.suites.map((su) => [`<strong>${esc(su.name)}</strong><div class="muted">${esc(su.id)}</div>`, su.rooms.map(esc).join(" + "),
        select("sv-" + su.id, Object.entries(SALE), su.sale, `aria-label="Mode de vente" style="max-width:200px" onchange="A.org.setSale(${q(su.id)}, this.value)"`), money(su.rate),
        su.sale === "separe" ? mutedRef("vendue par chambre") : suiteFree(su) ? badge("Vendable en suite", "on") : badge("Indisponible (chambre occupée ou hors commande)", "dark"),
        btn("Dissocier", `A.org.delSuite(${q(su.id)})`, "ghost sm")]), "Aucune suite.")
      + (cand.length ? `<div class="row" style="margin-top:10px;flex-wrap:nowrap">${select("su-pair", cand.map((r) => [r.no, `${r.no} + ${O.roomAttr[r.no].link}`]), cand[0].no, `aria-label="Chambres communicantes" style="max-width:140px"`)}${input("su-name", "", `placeholder="Nom de la suite" aria-label="Nom de la suite"`)}${input("su-rate", "", `type="number" placeholder="Tarif" aria-label="Tarif" style="max-width:120px"`)}${btn("Créer la suite", "A.org.addSuite()", "ghost")}</div>`
        : `<p class="muted">Aucune paire de chambres communicantes libre : déclarez-en une dans « Caractéristiques d'une chambre ».</p>`), `style="margin-top:16px"`)
  }
  function typesTab() {
    const dr = O.draft
    return `<h2>Types de chambres</h2>` + tbl(["Type", "Capacité", "#Surface", "Lits", "Vue", "Équipements", "#Photos", "Descriptions", ""], D.roomTypes.map((t) => {
      const i = O.typeInfo[t.code]
      return [`<strong>${esc(t.label)}</strong><div class="muted">${esc(t.code)} · ${money(t.rate)}</div>`, `${i.adults} ad. + ${i.children} enf.<div class="muted">${i.extra} lit d'appoint</div>`, i.area + " m²", esc(i.beds), esc(i.view),
        `<span class="muted">${esc(i.equip.join(", "))}</span>`, i.photos || badge("0", "dark"),
        ["fr", "en", "ar"].map((l) => badge(l, i.desc[l] ? "on" : "")).join(" "), `<span class="row" style="flex-wrap:nowrap">${btn("Modifier", `ui.orgTypeEdit=${q(t.code)};render()`, "ghost sm")}${btn("Générer (IA)", `A.org.genDesc(${q(t.code)})`, "ghost sm")}</span>`]
    }))
      + typeEditCard()
      + (dr ? aiBox(`Description proposée — ${T(dr.code).label} (${dr.lang})`, dr.text, btn("Valider et publier", "A.org.acceptDesc()", "sm") + btn("Rejeter", "D.org.draft=null;render()", "ghost sm"))
        : aiBox("Génération de descriptions", "Rédaction des descriptions manquantes à partir des attributs du type (surface, lits, vue, équipements). Validation humaine obligatoire ; repli : saisie manuelle. Choisissez « Générer (IA) » sur une ligne."))
      + `<h2>Étiquetage des photos</h2>` + (O.photoTags ? tbl(["Photo", "Étiquette proposée", "#Confiance"], O.photoTags.map((x) => [esc(x[0]), badge(x[1], "outline"), x[2] + " %"]))
        + `<div class="row" style="margin-top:8px">${btn("Valider les étiquettes", "D.org.photoTags=null;toast('Étiquettes validées et transmises aux canaux (simulé)');render()", "ghost")}</div>`
        : `<p class="muted">Classement automatique (vue, salle de bain, lit) pour les canaux de distribution.</p>${btn("Étiqueter les photos du type Standard (IA)", "A.org.tagPhotos()", "ghost")}`)
  }
  // Fiche d'un type : capacités, surface, lits, vue, équipements, photos et descriptions multilingues — EF-ORG-005
  function typeEditCard() {
    const code = ui.orgTypeEdit, t = code && T(code)
    if (!t) return `<p class="muted">EF-ORG-005 : choisissez « Modifier » pour éditer capacités, surface, lits, vue, équipements, photos et descriptions (fr, en, ar).</p>`
    const i = O.typeInfo[code]
    return card(`Type ${t.label} (${code})`, form([
      field("ty-ad", "Adultes", input("ty-ad", i.adults, `type="number" min="1"`)), field("ty-ch", "Enfants", input("ty-ch", i.children, `type="number" min="0"`)), field("ty-ex", "Lits d'appoint", input("ty-ex", i.extra, `type="number" min="0"`)),
      field("ty-area", "Surface (m²)", input("ty-area", i.area, `type="number" min="1"`)), field("ty-beds", "Configuration de lits", input("ty-beds", i.beds)), field("ty-view", "Vue", select("ty-view", ["Ville", "Jardin", "Lagune", "Mer", "Piscine"], i.view)),
      field("ty-eq", "Équipements (séparés par des virgules)", input("ty-eq", i.equip.join(", ")), "full"),
      field("ty-fr", "Description (fr)", input("ty-fr", i.desc.fr), "full"), field("ty-en", "Description (en)", input("ty-en", i.desc.en), "full"), field("ty-ar", "Description (ar)", input("ty-ar", i.desc.ar, `dir="rtl" lang="ar"`), "full"),
      `<div class="full">${i.photos} photo(s) ${btn("Ajouter une photo (simulé)", `A.org.addPhoto(${q(code)})`, "ghost sm")}</div>`,
      `<div class="full" id="ty-err"></div>`, `<div class="full row">${btn("Enregistrer", `A.org.saveType(${q(code)})`)}${btn("Fermer", "ui.orgTypeEdit=null;render()", "ghost")}</div>`,
      `<p class="full muted">EF-ORG-005 · RG-ORG-03 : la capacité adultes + enfants doit rester entre 1 et 8 personnes.</p>`,
    ]), `style="margin-top:16px"`)
  }
  function equipTab() {
    return `<h2>Équipements par chambre</h2><p class="muted">Avec numéro de série pour la maintenance (EF-ORG-013).</p>`
      + tbl(["Chambre", "Équipement", "Modèle", "N° de série", "État"], O.equipment.map((e) => [esc(e.room), esc(e.kind), esc(e.model), `<span class="muted">${esc(e.serial)}</span>`,
        select("eq-" + e.id, ["ok", "entretien prévu", "en panne"], e.state, `aria-label="État" onchange="A.org.setEquip(${q(e.id)}, this.value)" style="max-width:160px"`)]))
      + `<div class="row" style="margin-top:10px;flex-wrap:nowrap">${select("eq-room", D.rooms.map((r) => r.no), "101", `style="max-width:90px" aria-label="Chambre"`)}${select("eq-kind", ["Climatisation", "TV", "Minibar", "Coffre", "Machine à café"], "TV", `style="max-width:160px" aria-label="Équipement"`)}${input("eq-serial", "", `placeholder="N° de série" aria-label="Numéro de série"`)}${btn("Ajouter", "A.org.addEquip()", "ghost")}</div>`
  }
  const IMPORT_ROWS = [["306", "SUP", "3"], ["307", "SUP", "3"], ["203", "SUP", "2"], ["308", "DLX", "3"], ["309", "STD", "3"], ["", "STD", "3"]]
  function importTab() {
    const rep = O.importReport
    return `<h2>Import des chambres et portes (US-ORG-02)</h2><p class="muted">Fichier simulé « chambres_aile_est.xlsx » (6 lignes). Modèle téléchargeable, validation des doublons et des types inconnus, rapport ligne par ligne.</p>
      <div class="row">${btn("Télécharger le modèle", "toast('Modèle chambres.xlsx téléchargé (simulé)')", "ghost")}${btn("Analyser le fichier", "A.org.analyse()")}</div>`
      + (rep ? `<h3>Rapport de validation</h3>` + tbl(["Ligne", "N°", "Type", "Étage", "Résultat"], rep.map((x, i) => [i + 2, esc(x.row[0] || "—"), esc(x.row[1]), esc(x.row[2]), x.err ? `<span class="err">${esc(x.err)}</span>` : badge(x.done ? "Importée" : "Valide", "on")]))
        + (rep.some((x) => !x.err && !x.done) ? `<div class="row" style="margin-top:10px">${btn(`Importer les ${rep.filter((x) => !x.err && !x.done).length} lignes valides`, "A.org.doImport()")}</div>` : "") : "")
  }
  // Utilisations calculées sur les réservations et folios de data.js (segments/origines : attribution déterministe des réservations d'exemple)
  const TX_LABEL = { PDJ: "Petit-déjeuner", RST: "Restaurant", MNB: "Minibar", BLA: "Blanchisserie" }
  const PAY = { ESP: "Espèces", CB: "Carte bancaire", MOM: "Mobile Money" }
  function codeUse(k, code) {
    const res = D.reservations.filter((r) => r.status !== "annulee")
    if (k === "transactions") {
      if (code === "HEB" || code === "TXS") return res.filter((r) => r.status !== "confirmee").reduce((s, r) => s + nights(r.from, r.to), 0)
      if (TX_LABEL[code]) return Object.values(D.extras).flat().filter((l) => l.label === TX_LABEL[code]).length
      if (PAY[code]) return res.filter((r) => r.payMode === PAY[code] || (code === "CB" && r.guarantee === "Carte bancaire")).length
      return 0
    }
    const active = O.codes[k].filter((c) => c[2])
    const i = active.findIndex((c) => c[0] === code)
    return i < 0 ? 0 : res.filter((r) => Number(r.id.replace(/\D/g, "")) % active.length === i).length
  }
  function codeTab(kind) {
    const list = O.codes[kind] || O.codes.segments
    const k = O.codes[kind] ? kind : "segments"
    return `<h2>${{ segments: "Segments de marché", origines: "Origines de réservation", transactions: "Codes de transaction" }[k]}</h2>`
      + tbl(["Code", "Libellé", "Actif", "#Réservations / lignes"], list.map((c, i) => [esc(c[0]), esc(c[1]), `<input type="checkbox" aria-label="Actif" ${c[2] ? "checked" : ""} onchange="A.org.toggleCode(${q(k)}, ${i}, this.checked)">`, codeUse(k, c[0])]))
      + `<div class="row" style="margin-top:10px;flex-wrap:nowrap">${input("cd-code", "", `placeholder="Code" style="max-width:110px" aria-label="Code"`)}${input("cd-label", "", `placeholder="Libellé" aria-label="Libellé"`)}${btn("Ajouter", `A.org.addCode(${q(k)})`, "ghost")}</div>`
      + `<p class="muted">Un code utilisé ne se supprime pas : il se désactive. Les codes sont aussi la cible du mapping lors d'une migration.</p>`
  }
  function taxTab() {
    return `<h2>Taxes</h2>` + tbl(["Code", "Taxe", "Assiette", "Taux", "Compte", "Active"], O.taxes.map((t, i) => [esc(t.code), esc(t.label), esc(t.base), esc(t.rate), esc(t.account),
      `<input type="checkbox" aria-label="Active" ${t.on ? "checked" : ""} onchange="A.org.toggleTax(${i}, this.checked)">`]))
      + `<p class="muted">Taux et montants d'exemple, non contractuels : à confirmer avec la réglementation en vigueur. Une modification s'applique aux transactions futures uniquement.</p>`
  }

  // ====================================================================
  // Actions
  // ====================================================================
  const actions = {
    log,
    createUser() {
      const name = val("nu-name"), email = val("nu-email").toLowerCase()
      if (!name || !email) return errBox("nu-err", "Nom et e-mail obligatoires.")
      if (!/^[^@\s]+@[^@\s]+\.[a-z]+$/.test(email)) return errBox("nu-err", "E-mail invalide.")
      if (P.users.some((u) => u.email === email)) return errBox("nu-err", "Cet e-mail existe déjà dans le tenant (RG-PLT-01).")
      if (role(val("nu-role")).priv && scopeType(val("nu-scope")) === "Service") return errBox("nu-err", "Un rôle à privilèges ne s'attribue pas sur un service seul (EF-PLT-006).")
      const id = "U" + (P.users.length + 1)
      P.users.push({ id, name, email, job: val("nu-job") || "—", status: "actif", mfa: "aucun", last: today, lang: "fr", roles: [{ role: val("nu-role"), scope: val("nu-scope") }] })
      log("création", "Utilisateur", id, "", `${name} · ${val("nu-role")} @ ${val("nu-scope")}`)
      ui.pltNewUser = false
      toast(`Compte créé, invitation envoyée à ${email} (simulé)`)
      go("plt-acces/utilisateurs/" + id)
    },
    deactivate(id) {
      const u = user(id)
      const admins = P.users.filter((x) => x.status === "actif" && x.roles.some((a) => a.role === "ADM"))
      if (u.roles.some((a) => a.role === "ADM") && admins.length <= 1) return toast("Refusé : dernier administrateur tenant actif (RG-PLT-02)")
      u.status = "desactive"
      log("modification", "Utilisateur", id, "Statut : actif", "Statut : désactivé · sessions révoquées")
      toast(`${u.name} désactivé — sessions et accès révoqués (< 60 s)`)
      render()
    },
    reactivate(id) { const u = user(id); u.status = "actif"; u.last = today; log("modification", "Utilisateur", id, "Statut : désactivé", "Statut : actif"); toast("Compte réactivé"); render() },
    enrollMfa(id) { const u = user(id); u.mfa = "TOTP"; log("modification", "Utilisateur", id, "MFA : aucun", "MFA : TOTP enrôlé"); toast("Enrôlement MFA réalisé (simulé)"); render() },
    resetMfa(id) { const u = user(id); log("modification", "Utilisateur", id, "MFA : " + u.mfa, "MFA : aucun"); u.mfa = "aucun"; toast("MFA réinitialisé : nouvel enrôlement requis"); render() },
    assign(id) {
      const u = user(id), r = val("ra-role"), scope = val("ra-scope")
      const perms = userPerms(u); role(r).perms.forEach((x) => perms.add(x))
      const c = sodConflict(perms)
      if (c) return errBox("ra-err", `Refusé : « ${permLabel(c[0])} » et « ${permLabel(c[1])} » sont incompatibles (séparation des tâches, RG-PLT-08).`)
      if (u.roles.some((a) => a.role === r && a.scope === scope)) return errBox("ra-err", "Ce rôle est déjà attribué sur ce périmètre.")
      if (role(r).priv && scopeType(scope) === "Service") return errBox("ra-err", `Refusé : ${role(r).label} est un rôle à privilèges, il s'attribue au niveau établissement, marque ou groupe (EF-PLT-006).`)
      u.roles.push({ role: r, scope })
      P.rightsChanges[P.rightsChanges.length - 1][1]++
      log("droits", "Utilisateur", id, "", `+ ${r} @ ${scope}`)
      toast(`Rôle ${role(r).label} attribué${role(r).priv && u.mfa === "aucun" ? " — MFA requis avant connexion" : ""}`)
      render()
    },
    revoke(id, i) {
      const u = user(id), a = u.roles[i]
      if (a.role === "ADM" && P.users.filter((x) => x.status === "actif" && x.roles.some((y) => y.role === "ADM")).length <= 1) return toast("Refusé : dernier administrateur tenant actif (RG-PLT-02)")
      u.roles.splice(i, 1)
      P.rightsChanges[P.rightsChanges.length - 1][1]++
      log("droits", "Utilisateur", id, `${a.role} @ ${a.scope}`, "révoqué")
      toast("Rôle retiré")
      render()
    },
    revokeAll(id) {
      const u = user(id)
      if (!u.roles.length) return toast("Aucun droit à révoquer")
      log("droits", "Utilisateur", id, u.roles.map((a) => a.role).join(", "), "révoqués (revue des droits)")
      u.roles = []
      P.rightsChanges[P.rightsChanges.length - 1][1]++
      toast(`Droits de ${u.name} révoqués`)
      render()
    },
    applyInactivity() {
      const list = P.users.filter((x) => x.status === "actif" && daysAgo(x.last) > 90)
      list.forEach((u) => { u.status = "desactive"; log("modification", "Utilisateur", u.id, "Statut : actif", "Désactivé (inactivité > 90 j)", "svc-audit-nuit") })
      toast(`${list.length} compte(s) désactivé(s)`)
      render()
    },
    togglePerm(code, perm, on) {
      const r = role(code)
      if (on) {
        const c = sodConflict(new Set([...r.perms, perm]))
        if (c) { toast(`Refusé : ${c[0]} et ${c[1]} incompatibles (RG-PLT-08)`); return render() }
        r.perms.push(perm)
      } else r.perms = r.perms.filter((x) => x !== perm)
      P.rightsChanges[P.rightsChanges.length - 1][1]++
      log("droits", "Rôle", code, on ? "" : perm, on ? "+ " + perm : "retirée")
      toast(`${code} : ${perm} ${on ? "ajoutée" : "retirée"}`)
      render()
    },
    createRole() {
      const code = val("nr-code").toUpperCase(), label = val("nr-label")
      if (!code || !label) return toast("Code et libellé obligatoires")
      if (role(code)) return toast("Ce code de rôle existe déjà")
      P.roles.push({ code, label, priv: false, system: false, perms: [] })
      log("création", "Rôle", code, "", label)
      toast(`Rôle ${label} créé — cochez ses permissions dans la matrice`)
      render()
    },
    toggleAbac(id, on) { const r = P.abac.find((x) => x.id === id); r.on = on; log("paramètre", "Règle ABAC", id, on ? "inactive" : "active", on ? "active" : "inactive"); toast(on ? "Règle activée" : "Règle désactivée"); render() },
    createDeleg() {
      const from = val("dg-from"), to = val("dg-to"), perm = val("dg-perm"), au = val("dg-au")
      if (from === to) return errBox("dg-err", "Le délégué doit être différent du délégant.")
      if (!au || au <= today) return errBox("dg-err", "La date de fin doit être postérieure à aujourd'hui.")
      if (!userPerms(user(from)).has(perm)) return errBox("dg-err", `${user(from).name} ne détient pas « ${permLabel(perm)} » : il ne peut pas la déléguer.`)
      const p2 = userPerms(user(to)); p2.add(perm)
      const c = sodConflict(p2)
      if (c) return errBox("dg-err", "Refusé : la délégation créerait un conflit de séparation des tâches (RG-PLT-08).")
      const id = "DL-" + (P.delegations.length + 1)
      P.delegations.push({ id, from, to, perm, du: today, au, status: "active" })
      log("droits", "Délégation", id, "", `${user(from).name} → ${user(to).name} : ${perm} jusqu'au ${au}`)
      toast(`Délégation créée, expiration automatique le ${fd(au)}`)
      render()
    },
    endDeleg(id) { const d = P.delegations.find((x) => x.id === id); d.status = "revoquee"; log("droits", "Délégation", id, "active", "révoquée"); toast("Délégation révoquée"); render() },
    testSso() {
      P.sso.test = ["Métadonnées de l'annuaire lues (simulé)", "Certificat de signature valide jusqu'au 12/2027", `Connexion test de ${user("U2").name} : réussie, groupe HMS-Reception → REC`]
      toast("Test de connexion SSO réussi (simulé)")
      render()
    },
    syncSso() { P.sso.lastSync = ts(); log("modification", "SSO", "annuaire", "", "Synchronisation SCIM : 0 création, 0 désactivation", "svc-scim"); toast("Synchronisation terminée : aucun changement"); render() },
    addMap() {
      const g = val("mp-group")
      if (!g) return toast("Indiquez le groupe de l'annuaire")
      P.sso.mapping.push({ group: g, role: val("mp-role") })
      log("paramètre", "SSO", "mapping", "", `${g} → ${val("mp-role")}`)
      toast("Correspondance ajoutée")
      render()
    },
    delMap(i) { const m = P.sso.mapping.splice(i, 1)[0]; log("paramètre", "SSO", "mapping", `${m.group} → ${m.role}`, "supprimé"); render() },
    rotate(id) {
      const s = P.services.find((x) => x.id === id)
      const old = s.key
      s.key = "sk_ex_••••" + hash(id + Date.now()).slice(0, 4); s.rotated = today; s.expires = addDays(today, 90)
      log("modification", "Compte de service", s.name, old, s.key)
      toast(`Clé de ${s.name} renouvelée — l'ancienne reste valide 24 h (simulé)`)
      render()
    },
    login(id, d) {
      const l = P.logins.find((x) => x.id === id); l.decision = d
      log("sécurité", "Connexion", l.user, "bloquée (IA)", d === "confirme" ? "blocage confirmé" : "débloquée")
      toast(d === "confirme" ? "Blocage confirmé, compte à réinitialiser" : "Blocage levé")
      render()
    },
    verifyChain() {
      let prev = "00000000", bad = null
      P.audit.forEach((e) => { if (!bad && (e.prev !== prev || entryHash(e) !== e.hash)) bad = e; prev = e.hash })
      ui.pltChain = bad ? { ok: false, msg: `Entrée ${bad.id} incohérente.` } : { ok: true, msg: `${P.audit.length} entrées vérifiées, aucune altération.` }
      render()
    },
    exportAudit() { log("export", "Journal d'audit", "CSV", "", "Export signé, empreinte " + P.audit[P.audit.length - 1].hash); toast("Export signé généré (simulé)"); render() },
    setSetting(i) {
      const s = P.settings[i], v = val("st-" + i)
      if (s.lock && s.lock !== "etab") return toast(`Refusé : « ${s.label} » est verrouillé au niveau ${LEVELS.find((x) => x[0] === s.lock)[1]} (RG-PLT-04)`)
      const before = effective(s)[0]
      if (v) s.values.etab = v; else delete s.values.etab
      log("paramètre", "Paramètre", s.key, before, effective(s)[0] + (v ? " (établissement)" : " (hérité)"))
      toast(v ? "Surcharge enregistrée" : "Surcharge retirée : valeur héritée")
      render()
    },
    setRate() {
      const cur = val("fx-cur"), rate = Number(val("fx-rate"))
      if (!(rate > 0)) return toast("Indiquez un taux positif")
      if (cur === "EUR") return toast("Refusé : parité fixe EUR/XOF")
      const ex = P.rates.find((r) => r.from === cur)
      const before = ex ? ex.rate : "—"
      if (ex) Object.assign(ex, { rate, date: today, source: "Saisie manuelle" })
      else P.rates.push({ from: cur, to: "XOF", rate, date: today, source: "Saisie manuelle" })
      log("modification", "Taux de change", cur + "/XOF", String(before), String(rate))
      toast(`Taux ${cur}/XOF enregistré — transactions passées inchangées`)
      render()
    },
    aiTranslate(id) {
      const c = P.contents.find((x) => x.id === id)
      Object.keys(c.tr).forEach((k) => { if (c.tr[k] === "manquant") c.tr[k] = "brouillon" })
      toast("Traductions proposées (simulé) : validation requise")
      render()
    },
    validateTr(id, l) { const c = P.contents.find((x) => x.id === id); c.tr[l] = "valide"; log("modification", "Traduction", c.label, "brouillon IA", "validée (" + l + ")"); toast("Traduction validée et publiée"); render() },
    bumpTpl(code) { const t = P.templates.find((x) => x.code === code); t.version++; t.updated = today; log("modification", "Modèle de notification", code, "v" + (t.version - 1), "v" + t.version); toast(`${code} v${t.version} publiée — la v${t.version - 1} reste consultable`); render() },
    purgeDocs() {
      const ex = P.documents.filter((d) => d.until < today)
      P.documents = P.documents.filter((d) => d.until >= today)
      ex.forEach((d) => log("suppression", "Document", d.id, d.type, "purgé (fin de conservation)", "svc-retention"))
      toast(`${ex.length} document(s) purgé(s), trace conservée au journal`)
      render()
    },
    setIdp(id, on) {
      const x = P.idps.find((y) => y.id === id)
      x.status = on ? "configure" : "a_configurer"
      log("paramètre", "Fournisseur d'identité", x.name, on ? "à configurer" : "configuré", on ? `configuré (${x.proto})` : "désactivé")
      toast(on ? `${x.name} configuré : métadonnées ${x.proto} importées (simulé)` : `${x.name} désactivé`)
      render()
    },
    simLogin() {
      const u = user(val("lg-user")), m = val("lg-meth"), code = val("lg-code")
      ui.pltLoginUser = u.id; ui.pltLoginMeth = m
      const label = METHODS.find((x) => x[0] === m)[1]
      const refuse = (msg) => { ui.pltLoginRes = { ok: false, msg }; log("connexion", "Session", u.id, "", "refusée : " + msg, u.name); render() }
      if (u.status !== "actif") return refuse(`${u.name} : compte désactivé, sessions révoquées.`)
      if (m.startsWith("sso-")) {
        const idp = P.idps.find((x) => x.id === m.slice(4))
        if (idp.status !== "configure") return refuse(`${idp.name} n'est pas configuré pour ce tenant.`)
        if (!u.email.endsWith("@" + idp.domain)) return refuse(`Domaine de l'e-mail non rattaché à ${idp.name}.`)
      } else if (m === "pwd") {
        if (isPriv(u)) return refuse(`${u.name} a un rôle à privilèges : MFA obligatoire (EF-PLT-004).`)
      } else if (m === "totp") {
        if (u.mfa !== "TOTP") return refuse(`${u.name} n'a pas enrôlé de TOTP (MFA actuel : ${u.mfa}).`)
        if (!/^\d{6}$/.test(code)) return refuse("Code TOTP invalide : 6 chiffres attendus.")
      } else if (m === "passkey" && u.mfa !== "Passkey") return refuse(`${u.name} n'a pas de passkey enregistrée.`)
      if (m.startsWith("sso-") && isPriv(u) && u.mfa === "aucun") return refuse(`${u.name} : MFA imposé par la politique du tenant, même en SSO (EF-PLT-004).`)
      u.last = today
      P.logins.unshift({ id: "L" + (P.logins.length + 1) + "-" + seq++, ts: ts(), user: u.id, country: "Côte d'Ivoire", device: "Simulation", score: 5, decision: "autorise" })
      ui.pltLoginRes = { ok: true, msg: `${u.name} connecté (${label}) — jeton OIDC émis (simulé), tenant Groupe Exemple.` }
      log("connexion", "Session", u.id, "", label, u.name)
      render()
    },
    crossTenant() {
      const t = val("iso-t"), layer = val("iso-l"), name = (otherTenants().find((x) => x[0] === t) || [t, t])[1]
      log("sécurité", "Isolation tenant", layer, "", `accès à ${name} refusé`)
      toast(`${layer} : accès aux données de ${name} refusé (403, jeton du tenant Groupe Exemple) — tentative journalisée`)
      P.isoTest = P.isoTest && P.isoTest.target === name ? P.isoTest : { ts: ts(), target: name, results: [] }
      P.isoTest.results = P.isoTest.results.filter((x) => x.layer !== layer).concat([{ layer, leak: false, detail: "403 Forbidden" }])
      render()
    },
    isoRun() {
      const t = val("iso-t") || "T3", name = (otherTenants().find((x) => x[0] === t) || [t, t])[1]
      const det = { API: "403 Forbidden", "Base de données": "0 ligne (RLS)", Cache: "clé absente", "Événements": "abonnement refusé", "Stockage de fichiers": "déchiffrement impossible", "Index de recherche": "0 résultat", IA: "contexte vide" }
      P.isoTest = { ts: ts(), target: name, results: LAYERS.map(([l]) => ({ layer: l, leak: false, detail: det[l] })) }
      log("sécurité", "Isolation tenant", "test complet", "", `${LAYERS.length} couches, 0 fuite (cible ${name})`, "svc-tests-securite")
      toast(`Test d'isolation terminé : ${LAYERS.length} couches, aucune fuite`)
      render()
    },
    sendNotif() {
      const t = P.templates.find((x) => x.code === val("nt-tpl")), to = val("nt-to")
      let lang = val("nt-lang"), note = ""
      const langs = t.langs.split(",").map((x) => x.trim())
      if (!langs.includes(lang)) { note = `traduction « ${lang} » absente, repli en français`; lang = "fr" }
      const opt = P.optouts.find((o) => o.who === to && (o.channel === t.channel || (t.marketing && o.channel === t.channel + " marketing")))
      const ok = !(opt && t.marketing)
      if (!ok) note = `désinscrit du canal ${opt.channel} depuis le ${fd(opt.since)} (EF-PLT-016)`
      else if (opt) note = (note ? note + " · " : "") + "message transactionnel : désinscription marketing non applicable"
      P.sent.push({ ts: ts(), code: t.code, version: t.version, channel: t.channel, lang, to, ok, note })
      if (ok) { const d = P.delivery.find((x) => x[0] === t.channel); if (d) { d[1]++; d[2]++ } }
      toast(ok ? `${t.code} v${t.version} envoyé par ${t.channel} en ${lang} (simulé)` : "Envoi bloqué : destinataire désinscrit")
      render()
    },
    viewDoc(id) {
      const d = P.documents.find((x) => x.id === id)
      log(d.type === "Pièce d'identité" ? "consultation sensible" : "consultation", "Document", id, "", `${d.type} déchiffré et affiché`)
      toast(`${id} affiché 60 s puis masqué — consultation journalisée`)
      render()
    },
    refValidate() {
      const k = ui.pltRef || "segments", raw = (document.getElementById("rf-data")?.value || "").trim()
      const existing = new Set(refRows(k).map((x) => x[0])), seen = new Set()
      const rows = raw.split(/\n/).filter((l) => l.trim()).map((l, i) => {
        const [a = "", b = ""] = l.split(";").map((x) => x.trim())
        let err = null
        if (k === "taux") {
          const v = Number(b.replace(",", "."))
          if (!/^[A-Z]{3}$/.test(a)) err = "Code devise ISO à 3 lettres attendu"
          else if (a === "EUR") err = "Parité fixe EUR/XOF : non modifiable"
          else if (!(v > 0)) err = "Taux positif attendu"
        } else {
          if (!a) err = "Code manquant"
          else if (!/^[A-Z0-9]{2,5}$/.test(a)) err = "Code : 2 à 5 caractères majuscules ou chiffres"
          else if (!b) err = "Libellé manquant"
        }
        if (!err && seen.has(a)) err = "Doublon dans le fichier"
        if (a) seen.add(a)
        return { line: i + 2, a, b, err, update: existing.has(a), done: false }
      })
      if (!rows.length) return toast("Fichier vide")
      P.refImport = { kind: k, raw, rows }
      toast(`${rows.filter((x) => !x.err).length} ligne(s) valide(s), ${rows.filter((x) => x.err).length} en erreur`)
      render()
    },
    refImport() {
      const r = P.refImport, ok = r.rows.filter((x) => !x.err && !x.done)
      ok.forEach((x) => {
        if (r.kind === "taux") {
          const v = Number(x.b.replace(",", ".")), ex = P.rates.find((y) => y.from === x.a)
          if (ex) Object.assign(ex, { rate: v, date: today, source: "Import de fichier" }); else P.rates.push({ from: x.a, to: "XOF", rate: v, date: today, source: "Import de fichier" })
        } else {
          const list = D.org.codes[r.kind], ex = list.find((c) => c[0] === x.a)
          if (ex) ex[1] = x.b; else list.push([x.a, x.b, true])
        }
        x.done = true
      })
      log("import", "Données de référence", REFS[r.kind].label, "", `${ok.length} ligne(s) importée(s), ${r.rows.filter((x) => x.err).length} rejetée(s)`)
      toast(`${ok.length} ligne(s) importée(s) dans ${REFS[r.kind].label.toLowerCase()}`)
      render()
    },
    refExport() {
      const k = ui.pltRef || "segments", fmt = val("rf-fmt") || "csv"
      const text = [REFS[k].head, ...refRows(k).map((x) => x.join(";"))].join("\n")
      ui.pltExport = { kind: k, fmt: fmt === "csv" ? "CSV" : "Excel, aperçu", text }
      if (fmt === "csv") { try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = k + ".csv"; a.click() } catch (e) {} }
      log("export", "Données de référence", REFS[k].label, "", `${refRows(k).length} ligne(s), format ${fmt}`)
      toast(`Export ${fmt.toUpperCase()} généré : ${refRows(k).length} ligne(s)${fmt === "xlsx" ? " (simulé)" : ""}`)
      render()
    },
    search(v) { ui.pltSearch = v; const el = $("#gs-res"); if (el) el.innerHTML = searchResults(v) },
  }

  const oactions = {
    clone() {
      const name = val("cl-name"), city = val("cl-city")
      if (!name || !city) return errBox("cl-err", "Nom et ville obligatoires.")
      if (O.properties.some((x) => x.name.toLowerCase() === name.toLowerCase())) return errBox("cl-err", "Un établissement porte déjà ce nom.")
      const src = O.properties.find((x) => x.id === val("cl-src"))
      const id = "P" + (O.properties.length + 1)
      const copyTypes = document.getElementById("cl-c0")?.checked, copyTax = document.getElementById("cl-c1")?.checked
      O.properties.push({ ...JSON.parse(JSON.stringify(src)), id, code: "HEX-" + city.slice(0, 3).toUpperCase(), name, city, status: "preouverture", checklist: { type: !!copyTypes, chambre: false, tarif: false, taxe: !!copyTax, paiement: false } })
      log("création", "Établissement", id, "", `${name} dupliqué depuis ${src.code}`)
      ui.orgClone = false
      toast(`${name} créé en préouverture`)
      render()
    },
    check(id, k) { O.properties.find((x) => x.id === id).checklist[k] = true; render() },
    activate(id) {
      const x = O.properties.find((y) => y.id === id)
      const miss = Object.entries(x.checklist).filter(([, v]) => !v)
      if (miss.length) return toast(`Activation refusée : ${miss.length} élément(s) manquant(s) (RG-ORG-05)`)
      x.status = "exploitation"; delete x.checklist
      log("modification", "Établissement", id, "préouverture", "en exploitation")
      toast(`${x.name} passé en exploitation`)
      render()
    },
    addDoor(sid) {
      const s = O.spaces.find((x) => x.id === sid)
      const ref = "SER-0" + (200 + O.spaces.reduce((n, y) => n + y.doors.length, 0))
      s.doors.push({ ref, maker: val("dr-maker") || "Fabricant Exemple", mode: val("dr-mode") || "en ligne" })
      log("création", "Porte", ref, "", s.name)
      toast(`Porte ${ref} enregistrée, à associer à une serrure (simulé)`)
      render()
    },
    addDept() {
      const code = val("dp-code").toUpperCase(), name = val("dp-name")
      if (!code || !name) return toast("Code et nom obligatoires")
      if (O.departments.some((d) => d.code === code)) return toast("Ce code de service existe déjà")
      O.departments.push({ code, name, pc: val("dp-pc"), account: "706900" })
      toast("Service ajouté")
      render()
    },
    setType(no, type) {
      const r = D.rooms.find((x) => x.no === no)
      if (occupant(no)) { toast(`Refusé : chambre ${no} occupée, réaffectation préalable requise (RG-ORG-04)`); return render() }
      log("modification", "Chambre", no, "Type " + r.type, "Type " + type)
      r.type = type
      toast(`Chambre ${no} : type ${T(type).label}`)
      render()
    },
    setOps(no, v) {
      const r = D.rooms.find((x) => x.no === no), before = O.roomOps[no]
      if (v === "hc" && occupant(no)) { toast(`Refusé : chambre ${no} occupée`); return render() }
      O.roomOps[no] = v
      // Synchronisation avec le statut des chambres de la réception : hors commande = « hors service » côté ménage
      if (v === "hc") r.hk = "hs"
      else if (r.hk === "hs") r.hk = "inspection"
      log("modification", "Chambre", no, OPS[before][0], OPS[v][0])
      toast(`Chambre ${no} : ${OPS[v][0].toLowerCase()}${v === "hc" ? " — retirée de l'inventaire vendable" : ""}`)
      render()
    },
    removeRoom(no) {
      if (occupant(no)) return toast(`Refusé : chambre ${no} occupée`)
      const su = O.suites.find((x) => x.rooms.includes(no))
      if (su) return toast(`Refusé : la chambre ${no} fait partie de la suite ${su.name}, dissociez-la d'abord (EF-ORG-009)`)
      const i = D.rooms.findIndex((x) => x.no === no)
      const r = D.rooms.splice(i, 1)[0]
      if (hasHistory(no)) { O.archived.push(r); log("modification", "Chambre", no, "active", "archivée (historique conservé)"); toast(`Chambre ${no} archivée : elle a un historique (EF-ORG-014)`) }
      else { log("suppression", "Chambre", no, T(r.type).label, ""); toast(`Chambre ${no} supprimée`) }
      render()
    },
    addRoom() {
      const no = val("nr-no")
      if (!/^\d{3,4}$/.test(no)) return errBox("nr-err", "Numéro attendu : 3 ou 4 chiffres.")
      if (D.rooms.some((r) => r.no === no) || O.archived.some((r) => r.no === no)) return errBox("nr-err", `La chambre ${no} existe déjà (RG-ORG-01).`)
      D.rooms.push({ no, type: val("nr-type"), floor: Number(val("nr-floor")), hk: "inspection" })
      O.roomOps[no] = "service"
      O.roomDoors[no] = [{ ref: "CH-" + no, maker: "Fabricant Exemple", model: "Serrure RFID Exemple", mode: "en ligne" }]
      if (document.getElementById("nr-pmr")?.checked) O.roomAttr[no] = { pmr: true }
      log("création", "Chambre", no, "", T(val("nr-type")).label)
      toast(`Chambre ${no} créée (en inspection avant première vente)`)
      render()
    },
    genDesc(code) {
      const i = O.typeInfo[code], t = T(code)
      const lang = ["fr", "en", "ar"].find((l) => !i.desc[l]) || "en"
      const txt = {
        fr: `${t.label} de ${i.area} m² avec ${i.beds.toLowerCase()}, vue ${i.view.toLowerCase()}. Équipements : ${i.equip.join(", ").toLowerCase()}. Jusqu'à ${i.adults} adultes et ${i.children} enfants.`,
        en: `${i.area} m² ${t.label} room with ${i.view.toLowerCase() === "lagune" ? "lagoon" : i.view.toLowerCase() === "jardin" ? "garden" : "city"} view, air conditioning and safe. Sleeps up to ${i.adults} adults and ${i.children} children.`,
        ar: `غرفة ${i.area} م² مع إطلالة جميلة وتكييف هواء.`,
      }[lang]
      O.draft = { code, lang, text: txt }
      render()
    },
    acceptDesc() {
      const d = O.draft
      O.typeInfo[d.code].desc[d.lang] = d.text
      log("modification", "Type de chambre", d.code, "description " + d.lang + " vide", "description validée")
      O.draft = null
      toast("Description validée et publiée")
      render()
    },
    tagPhotos() { O.photoTags = [["std_01.jpg", "Lit", 96], ["std_02.jpg", "Salle de bain", 92], ["std_03.jpg", "Vue ville", 81], ["std_04.jpg", "Bureau", 74], ["std_05.jpg", "Lit", 88], ["std_06.jpg", "Entrée", 63]]; render() },
    setEquip(id, v) { const e = O.equipment.find((x) => x.id === id); log("modification", "Équipement", e.serial, e.state, v); e.state = v; toast(v === "en panne" ? "Panne signalée à la maintenance (simulé)" : "État mis à jour"); render() },
    addEquip() {
      const serial = val("eq-serial")
      if (!serial) return toast("Le numéro de série est obligatoire")
      if (O.equipment.some((e) => e.serial === serial)) return toast("Ce numéro de série existe déjà")
      O.equipment.push({ id: uid("EQ"), room: val("eq-room"), kind: val("eq-kind"), model: "Modèle Exemple", serial, state: "ok" })
      toast("Équipement ajouté")
      render()
    },
    analyse() {
      const seen = new Set(D.rooms.map((r) => r.no))
      O.importReport = IMPORT_ROWS.map((row) => {
        let err = null
        if (!row[0]) err = "Numéro manquant"
        else if (seen.has(row[0])) err = `Doublon : la chambre ${row[0]} existe déjà`
        else if (!T(row[1])) err = `Type inconnu « ${row[1]} »`
        if (row[0]) seen.add(row[0])
        return { row, err, done: false }
      })
      render()
    },
    doImport() {
      const ok = O.importReport.filter((x) => !x.err && !x.done)
      ok.forEach((x) => { D.rooms.push({ no: x.row[0], type: x.row[1], floor: Number(x.row[2]), hk: "inspection" }); O.roomOps[x.row[0]] = "service"; O.roomDoors[x.row[0]] = [{ ref: "CH-" + x.row[0], maker: "Fabricant Exemple", model: "Serrure RFID Exemple", mode: "en ligne" }]; x.done = true })
      log("import", "Chambres", "chambres_aile_est.xlsx", "", `${ok.length} chambres importées, ${O.importReport.filter((x) => x.err).length} rejetées`)
      toast(`${ok.length} chambres importées`)
      render()
    },
    toggleCode(k, i, on) { O.codes[k][i][2] = on; log("modification", "Code de référence", O.codes[k][i][0], on ? "inactif" : "actif", on ? "actif" : "inactif"); render() },
    addCode(k) {
      const code = val("cd-code").toUpperCase(), label = val("cd-label")
      if (!code || !label) return toast("Code et libellé obligatoires")
      if (O.codes[k].some((c) => c[0] === code)) return toast("Ce code existe déjà")
      O.codes[k].push([code, label, true])
      log("création", "Code de référence", code, "", label)
      toast("Code ajouté")
      render()
    },
    addBrand() {
      const code = val("br-code").toUpperCase(), name = val("br-name")
      if (!/^[A-Z]{3}$/.test(code)) return errBox("br-err", "Code de marque : 3 lettres.")
      if (!name) return errBox("br-err", "Nom obligatoire.")
      if (O.brands.some((b) => b.code === code)) return errBox("br-err", "Ce code de marque existe déjà.")
      O.brands.push({ code, name, range: val("br-range"), charter: { color: val("br-color") || "#2b4c7e", font: val("br-font"), logo: code.toLowerCase() + "-logo.svg" }, standards: [] })
      log("création", "Marque", code, "", `${name} · ${val("br-range")}`)
      ui.orgNewBrand = false
      toast(`Marque ${name} créée — ajoutez ses standards de service`)
      render()
    },
    toggleStd(code, i) {
      const s = O.brands.find((b) => b.code === code).standards[i]
      s.mandatory = !s.mandatory
      log("modification", "Standard de marque", code, s.label + (s.mandatory ? " : recommandé" : " : obligatoire"), s.mandatory ? "obligatoire" : "recommandé")
      toast(s.mandatory ? `« ${s.label} » obligatoire pour tous les établissements de la marque (RG-ORG-06)` : `« ${s.label} » devient recommandé`)
      render()
    },
    addStandard(code) {
      const b = O.brands.find((x) => x.code === code), label = val("bs-" + code)
      if (!label) return toast("Indiquez le standard")
      if (b.standards.some((s) => s.label.toLowerCase() === label.toLowerCase())) return toast("Ce standard existe déjà")
      b.standards.push({ label, mandatory: true })
      log("création", "Standard de marque", code, "", label)
      toast(`Standard ajouté à ${b.name}, appliqué à ${O.properties.filter((x) => x.brand === code).length} établissement(s)`)
      render()
    },
    addEntity() {
      const name = val("le-name"), tax = val("le-tax").toUpperCase(), rccm = val("le-rccm").toUpperCase()
      if (!name || !tax || !rccm) return errBox("le-err", "Raison sociale, NCC et RCCM obligatoires.")
      if (!/^\d{7}[A-Z]$/.test(tax)) return errBox("le-err", "NCC attendu : 7 chiffres suivis d'une lettre (ex. 0000002Z).")
      if (!/^CI-[A-Z]{3}-\d{4}-[A-Z]-\d{5}$/.test(rccm)) return errBox("le-err", "RCCM attendu au format CI-XXX-0000-B-00000.")
      if (O.entities.some((e) => e.tax.includes(tax))) return errBox("le-err", "Ce NCC est déjà enregistré.")
      const id = "LE" + (O.entities.length + 1)
      O.entities.push({ id, name, tax: `NCC ${tax} (fictif)`, rccm: `RCCM ${rccm} (fictif)`, currency: val("le-cur"), ledger: val("le-led") })
      log("création", "Société juridique", id, "", `${name} · ${val("le-cur")}`)
      ui.orgNewEnt = false
      toast(`Société ${name} créée — rattachez-lui un établissement`)
      render()
    },
    saveProp(id) {
      const x = O.properties.find((y) => y.id === id)
      const hh = /^([01]\d|2[0-3]):[0-5]\d$/, lat = Number(val("pe-lat")), lng = Number(val("pe-lng")), stars = Number(val("pe-stars"))
      const palace = !!document.getElementById("pe-palace")?.checked, com = val("pe-com")
      if (!val("pe-addr")) return errBox("pe-err", "Adresse obligatoire.")
      if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180) || val("pe-lat") === "" || val("pe-lng") === "") return errBox("pe-err", "Géolocalisation invalide (latitude -90 à 90, longitude -180 à 180).")
      if (!hh.test(val("pe-in")) || !hh.test(val("pe-out"))) return errBox("pe-err", "Heures au format HH:MM.")
      if ((palace || com) && stars < 5) return errBox("pe-err", "« Palace » et le positionnement 6-7 étoiles exigent un classement officiel 5 étoiles (EF-ORG-011).")
      const pol = Object.fromEntries(POL.map(([k]) => [k, !!document.getElementById("pe-" + k)?.checked]))
      if (!pol.smoking && id === "P1" && Object.values(O.roomAttr).some((a) => a.smoke)) return errBox("pe-err", "Des chambres sont déclarées fumeur : retirez l'attribut avant de passer l'établissement non-fumeur.")
      const before = `${x.stars}★ · ${x.checkin}/${x.checkout} · ${polText(x.policies)}`
      Object.assign(x, { address: val("pe-addr"), geo: [lat, lng], tz: val("pe-tz"), currency: val("pe-cur"), langs: val("pe-langs"), entity: val("pe-ent"), checkin: val("pe-in"), checkout: val("pe-out"),
        policies: pol, stars, palace, commercial: com, labels: val("pe-labels").split(",").map((l) => l.trim()).filter(Boolean) })
      log("modification", "Établissement", id, before, `${x.stars}★ · ${x.checkin}/${x.checkout} · ${polText(x.policies)}`)
      ui.orgEditProp = null
      toast(`Fiche de ${x.name} enregistrée`)
      render()
    },
    addRoomDoor(no) {
      const list = O.roomDoors[no] || (O.roomDoors[no] = [])
      const ref = `CH-${no}-${String.fromCharCode(65 + list.length)}`
      list.push({ ref, maker: val("dr-maker") || "Fabricant Exemple", model: "Serrure RFID Exemple", mode: val("dr-mode") || "en ligne" })
      log("création", "Porte", ref, "", `Chambre ${no} · ${val("dr-mode") || "en ligne"}`)
      toast(`Porte ${ref} ajoutée à la chambre ${no}, transmise au contrôle d'accès (simulé)`)
      render()
    },
    setDoorMode(no, i, mode) {
      const d = O.roomDoors[no][i]
      log("modification", "Porte", d.ref, d.mode, mode)
      d.mode = mode
      toast(`Porte ${d.ref} : serrure ${mode}`)
      render()
    },
    saveAttr() {
      const no = val("at-no"), link = val("at-link"), a = O.roomAttr[no] || (O.roomAttr[no] = {})
      const smoke = !!document.getElementById("at-smoke")?.checked
      if (smoke && !O.properties[0].policies.smoking) return errBox("at-err", "Refusé : l'établissement est non-fumeur (politique de la fiche établissement, EF-ORG-003).")
      if (link && (O.roomAttr[link] || {}).link && O.roomAttr[link].link !== no) return errBox("at-err", `La chambre ${link} communique déjà avec la ${O.roomAttr[link].link}.`)
      if (a.link && a.link !== link && O.suites.some((su) => su.rooms.includes(no))) return errBox("at-err", "Refusé : cette chambre appartient à une suite, dissociez la suite d'abord (EF-ORG-009).")
      const before = JSON.stringify(a)
      if (a.link && a.link !== link && O.roomAttr[a.link]) delete O.roomAttr[a.link].link
      Object.assign(a, { pmr: !!document.getElementById("at-pmr")?.checked, connected: !!document.getElementById("at-connected")?.checked, smoke })
      if (link) { a.link = link; (O.roomAttr[link] || (O.roomAttr[link] = {})).link = no } else delete a.link
      log("modification", "Chambre", no, before, JSON.stringify(a))
      toast(`Chambre ${no} : caractéristiques enregistrées`)
      render()
    },
    addSuite() {
      const a = val("su-pair"), b = (O.roomAttr[a] || {}).link, name = val("su-name"), rate = Number(val("su-rate"))
      if (!b) return toast("Choisissez une paire de chambres communicantes")
      if (!name) return toast("Indiquez le nom de la suite")
      if (!(rate > 0)) return toast("Indiquez un tarif positif")
      const id = "SU-" + (O.suites.length + 1) + "-" + a
      O.suites.push({ id, name, rooms: [a, b], sale: "les deux", rate })
      log("création", "Suite", id, "", `${name} : ${a} + ${b}`)
      toast(`Suite ${name} créée (${a} + ${b}), vendable ensemble ou séparément`)
      render()
    },
    setSale(id, v) { const su = O.suites.find((x) => x.id === id); log("modification", "Suite", id, su.sale, v); su.sale = v; toast(`${su.name} : ${SALE[v].toLowerCase()}`); render() },
    delSuite(id) { const su = O.suites.find((x) => x.id === id); O.suites = O.suites.filter((x) => x.id !== id); log("suppression", "Suite", id, su.rooms.join(" + "), "dissociée"); toast(`${su.name} dissociée : chambres vendues séparément`); render() },
    saveType(code) {
      const i = O.typeInfo[code], n = (id) => Number(val(id))
      const ad = n("ty-ad"), ch = n("ty-ch"), ex = n("ty-ex"), area = n("ty-area")
      if (!(ad >= 1) || ch < 0 || ex < 0 || ad + ch > 8) return errBox("ty-err", "Capacité invalide : au moins 1 adulte, 8 personnes au maximum (RG-ORG-03).")
      if (!(area > 0)) return errBox("ty-err", "Surface invalide.")
      if (!val("ty-beds")) return errBox("ty-err", "Configuration de lits obligatoire.")
      const before = `${i.adults}+${i.children}, ${i.area} m²`
      Object.assign(i, { adults: ad, children: ch, extra: ex, area, beds: val("ty-beds"), view: val("ty-view"), equip: val("ty-eq").split(",").map((x) => x.trim()).filter(Boolean),
        desc: { fr: val("ty-fr"), en: val("ty-en"), ar: val("ty-ar") } })
      log("modification", "Type de chambre", code, before, `${ad}+${ch}, ${area} m²`)
      toast(`Type ${T(code).label} enregistré`)
      render()
    },
    addPhoto(code) { const i = O.typeInfo[code]; i.photos++; log("création", "Photo", code, "", `photo n°${i.photos}`); toast(`Photo ${i.photos} ajoutée au type ${T(code).label} (simulé)`); render() },
    toggleTax(i, on) { const t = O.taxes[i]; t.on = on; log("modification", "Taxe", t.code, on ? "inactive" : "active", on ? "active" : "inactive"); toast(`${t.label} ${on ? "activée" : "désactivée"} pour les transactions futures`); render() },
  }

  HMS.module({ code: "plt", group: "Plateforme", title: "Socle plateforme", phase: "1", spec: "§3 PLT", actions, screens: [
    { id: "plt-acces", label: "Utilisateurs et droits", view: views.acces },
    { id: "plt-audit", label: "Journal d'audit", view: views.audit },
    { id: "plt-params", label: "Paramètres et langues", view: views.params },
  ] })
  HMS.module({ code: "org", group: "Plateforme", title: "Organisation et référentiels", phase: "1", spec: "§4 ORG", actions: oactions, screens: [
    { id: "org-etab", label: "Établissements et structure", view: oviews.etab },
    { id: "org-chambres", label: "Chambres et types", view: oviews.chambres },
    { id: "org-codes", label: "Codes et taxes", view: oviews.codes },
  ] })
})()
