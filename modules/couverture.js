// modules/couverture.js — Spec §1.4 (codes des modules), §1.6 (décisions en suspens), §30 (plan de livraison).
// Relie chaque module de la spécification aux écrans de la maquette. Chargé en dernier : lit HMS.modules.
;(() => {
  // Modules de la spécification, dans l'ordre du document
  const SPEC = [
    ["ARC", "Architecture globale", "§2", "toutes"],
    ["PLT", "Socle plateforme", "§3", "1-2"],
    ["ORG", "Organisation et établissements", "§4", "1-2"],
    ["HRM", "RH, effectifs et paie", "§5", "3a-3b"],
    ["RAT", "Tarifs, inventaire, distribution", "§6", "4-6"],
    ["CRM", "CRM client et fidélité", "§7", "4-6"],
    ["RES", "Réservations", "§8", "4-6"],
    ["FOF", "Réception (Front Office)", "§9", "7-8"],
    ["ACC", "Contrôle d'accès et serrures", "§10", "7-8"],
    ["HKM", "Housekeeping et maintenance", "§11", "9-10"],
    ["FOL", "Facturation, folios et paiements", "§12", "9-10"],
    ["FNB", "Restauration / POS", "§13", "11-15"],
    ["SPA", "Spa, loisirs, services annexes", "§14", "11-15"],
    ["EVT", "Événements, banquets, MICE", "§15", "11-15"],
    ["PRC", "Achats, stocks, fournisseurs", "§16", "11-15"],
    ["BLN", "Buanderie et linge", "§17", "11-15"],
    ["FIN", "Comptabilité et finance (SYSCOHADA)", "§18", "16"],
    ["AIP", "Plateforme IA", "§19", "17-18"],
    ["BIR", "BI et reporting", "§20", "17-18"],
    ["MOB", "Applications mobiles", "§21", "19-21"],
    ["INT", "Hub d'intégration", "§22", "19-21"],
    ["OPS", "Exploitation SaaS", "§23", "19-21"],
    ["SEC", "Sécurité, conformité, migration (transverse)", "§24-§29", "toutes"],
  ]
  // Codes de module de la maquette qui couvrent chaque code de la spec (en plus du champ spec des modules)
  const ALIAS = { sej: ["RES", "FOF", "FOL"], fol: ["FOL"], mnt: ["HKM"], bir: ["BIR"], ops: ["OPS", "SEC"], int: ["INT"] }
  const PHASES = [
    ["1-2", "Socle plateforme, Organisation", "Tenant de démonstration opérationnel"],
    ["3a", "RH : dossiers, plannings, pointage, congés", "Profils d'accès du personnel prêts"],
    ["3b", "RH : moteur de paie, pack légal Côte d'Ivoire, déclarations", "Première paie parallèle validée par un expert local"],
    ["4-6", "Tarifs, CRM, Réservations", "Réservation directe possible"],
    ["7-8", "Réception, Contrôle d'accès", "MVP hôtelier : check-in avec émission de clé"],
    ["9-10", "Housekeeping, Facturation", "Cycle complet jusqu'à la facture"],
    ["11-15", "Restauration, Spa, Événements, Achats, Buanderie", "Hôtel full-service"],
    ["16", "Comptabilité et finance (SYSCOHADA complet)", "Clôture mensuelle, états financiers et DSF"],
    ["17-18", "Plateforme IA, BI", "Revenue management et copilote"],
    ["19-21", "Mobile, Hub d'intégration, Exploitation SaaS", "Commercialisation multi-tenant"],
  ]
  const DECISIONS = [
    ["OD-01", "Langage du backend cœur", "Java/Spring Boot (recommandé) ou Python", "Avant phase 1"],
    ["OD-02", "Fournisseur cloud principal", "AWS, Azure, GCP, cloud souverain/régional", "Avant phase 1"],
    ["OD-03", "Broker de messages", "Kafka (recommandé) ou RabbitMQ", "Avant phase 1"],
    ["OD-04", "Premier fabricant de serrures intégré", "Vingcard, dormakaba, Salto, Onity", "Avant phase 8"],
    ["OD-05", "PSP de référence", "PSP internationaux, régionaux, agrégateurs mobile money", "Avant phase 10"],
    ["OD-06", "Fournisseurs LLM", "Commerciaux via passerelle ou open-weight auto-hébergés", "Avant phase 16"],
    ["OD-07", "Mobile natif ou multiplateforme", "Flutter (recommandé), React Native, natif", "Avant phase 18"],
    ["OD-08", "Régions de résidence des données", "UE, Afrique de l'Ouest, autres", "Avant le premier client hors UE"],
    ["OD-09", "Pays des packs légaux V1", "Côte d'Ivoire (retenu) ; autres pays OHADA ; France", "Avant phase 3b"],
    ["OD-10", "Experts partenaires des packs légaux", "Cabinets locaux par pays", "Avant phase 3b"],
  ]

  // Un écran couvre un code de la spec selon son champ spec, sinon celui de son module, sinon le code du module
  const screensFor = (code) =>
    HMS.modules.filter((m) => m.code !== "cov").flatMap((m) => m.screens.filter((s) => {
      if (s.hidden) return false
      const tag = s.spec || m.spec
      return tag ? tag.includes(code) || (ALIAS[m.code] || []).includes(code) : m.code.toUpperCase() === code
    }))

  const views = {
    couverture(p) {
      const tab = p[0] || "modules"
      const rows = SPEC.map(([code, title, sec, phase]) => {
        const screens = screensFor(code)
        return { code, title, sec, phase, screens }
      })
      const covered = rows.filter((r) => r.screens.length).length
      const nbScreens = Object.values(HMS.screens).filter((s) => !s.hidden && s.code !== "cov").length
      let body = ""
      if (tab === "modules")
        body = tbl(["Code", "Module de la spec", "Section", "Phase", "Écrans de la maquette"], rows.map((r) => [
          `<strong>${esc(r.code)}</strong>`, esc(r.title), esc(r.sec), esc(r.phase),
          r.screens.length ? r.screens.map((s) => `<button class="link" onclick="go('${esc(s.id)}')">${esc(s.label)}</button>`).join(" · ") : badge("À faire", "dark"),
        ]))
      else if (tab === "phases")
        body = tbl(["Phase", "Modules", "Jalon"], PHASES.map(([ph, mods, jalon]) => [`<strong>${esc(ph)}</strong>`, esc(mods), esc(jalon)]))
          + `<p class="muted">Chaque phase livre un module autonome dans l'ordre des dépendances. La maquette montre toutes les phases d'un coup.</p>`
      else
        body = `<p class="muted">Décisions d'architecture du vrai projet, à trancher avant les phases indiquées. Elles n'affectent pas la maquette.</p>`
          + tbl(["ID", "Décision", "Options", "Échéance"], DECISIONS.map((d) => d.map(esc)))
      return pageHead("Couverture de la spécification", "Chaque module de la spécification HMS SaaS et les écrans qui le représentent dans cette maquette.")
        + cards([kpi("Modules de la spec", SPEC.length, "§2 à §29"), kpi("Modules représentés", covered, covered === SPEC.length ? "couverture complète" : `${SPEC.length - covered} restant(s)`), kpi("Écrans", nbScreens, "hors pages de détail")])
        + `<div style="margin-top:20px">${subtabs("couverture", [["modules", "Modules"], ["phases", "Plan de livraison"], ["decisions", "Décisions en suspens"]], tab)}</div>`
        + body
    },
  }

  HMS.module({
    code: "cov", group: "Projet", title: "Couverture de la spec", phase: "—", spec: "§1.4, §1.6, §30",
    screens: [{ id: "couverture", label: "Couverture de la spec", view: views.couverture }],
  })
})()
