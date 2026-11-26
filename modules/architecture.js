// modules/architecture.js — Spec §2 Architecture globale : décisions (ADR), conteneurs (C4 niveau 2),
// propriété des données, catalogue d'événements inter-modules, exigences non fonctionnelles globales.
// Écran de référence pour l'équipe : rien n'est exécuté, les flux d'événements sont illustrés.
;(() => {
  const MODULES = ["PLT", "ORG", "HRM", "RAT", "CRM", "RES", "FOF", "ACC", "HKM", "FOL", "FNB", "SPA", "EVT", "PRC", "BLN", "FIN", "AIP", "BIR", "MOB", "INT", "OPS"]
  const ADR = [
    ["ADR-01", "Cœur en Java / Spring Boot, services IA en Python", "Intégrité transactionnelle d'un côté, écosystème ML de l'autre ; contrats OpenAPI/AsyncAPI entre les deux."],
    ["ADR-02", "Monolithe modulaire, extraction progressive", "Moins d'exploitation au départ ; frontières de modules vérifiées automatiquement."],
    ["ADR-03", "Services séparés dès la V1", "Plateforme IA, passerelle edge, connecteurs de canaux, notifications : cycles de vie différents."],
    ["ADR-04", "Kafka comme bus d'événements", "Rejeu, partitionnement par tenant et établissement, débit pour les serrures et l'IoT."],
    ["ADR-05", "PostgreSQL, schéma par module, isolation par tenant", "Colonne tenant_id + Row-Level Security ; base dédiée en option."],
    ["ADR-06", "Keycloak, un realm par tenant", "SSO OIDC/SAML, fédération d'annuaires, MFA."],
    ["ADR-07", "Back-office Angular, mobile Flutter", "Structure forte pour une grosse application métier ; BLE/NFC pour la clé mobile."],
    ["ADR-08", "Transactional Outbox", "Écriture en base et publication d'événement cohérentes."],
    ["ADR-09", "Lakehouse alimenté par CDC", "Analytique séparée du transactionnel, alimente BI et IA."],
  ]
  // Couches du schéma de conteneurs (C4 niveau 2)
  const LAYERS = [
    ["Utilisateurs", [["Personnel", "Back-office web"], ["Clients", "Site de réservation, WhatsApp/SMS"], ["Clients et personnel", "Applications mobiles"], ["Éditeur", "Console d'exploitation"]]],
    ["Entrée", [["API Gateway", "Authentification, routage, quotas"]]],
    ["Applications", [["HMS Core", "Monolithe modulaire : tous les modules métier"], ["Plateforme IA", "Modèles, inférence, RAG, agents"], ["Connecteurs de canaux", "OTA, GDS, synchro ARI"], ["Notifications", "E-mail, SMS, WhatsApp, push"]]],
    ["Sur site (hôtel)", [["Passerelle edge", "Encodeurs, serrures, IoT, mode hors ligne"]]],
    ["Données et sécurité", [["PostgreSQL", "Transactionnel"], ["Kafka", "Bus d'événements"], ["Redis", "Cache, verrous"], ["Stockage objet", "Documents, exports, lakehouse"], ["Keycloak", "IAM, SSO"], ["Vault / KMS", "Secrets, clés, PKI edge"]]],
  ]
  const OWNERSHIP = [
    ["Tenant, utilisateurs, rôles, paramètres", "PLT", "Tous"],
    ["Établissements, chambres, types, espaces", "ORG", "RAT, RES, FOF, ACC, HKM, BIR"],
    ["Employés, plannings, paie", "HRM", "ACC, HKM, FNB, FIN, BIR, AIP"],
    ["Plans tarifaires, disponibilités (ARI)", "RAT", "RES, MOB, INT, AIP"],
    ["Profils clients, consentements, fidélité", "CRM", "RES, FOF, FOL, MOB, AIP"],
    ["Réservations", "RES", "FOF, FOL, HKM, RAT, BIR"],
    ["Séjours, affectations de chambres", "FOF", "ACC, HKM, FOL"],
    ["Identifiants d'accès, événements de porte", "ACC", "FOF, AIP, BIR, HRM"],
    ["Statut des chambres, tâches, ordres de travail", "HKM", "FOF, BIR, AIP"],
    ["Folios, paiements, factures", "FOL", "FIN, BIR"],
    ["Comptabilité, trésorerie, états financiers", "FIN", "BIR, OPS"],
    ["Linge, lots de lavage, pressing", "BLN", "HKM, FOL, FIN"],
  ]
  const EVENTS = [
    ["res.reservation.created", "RES", "RAT FOF HKM CRM FOL AIP BIR", "Une réservation est créée, modifiée ou annulée."],
    ["fof.stay.checked-in", "FOF", "ACC FOL HKM CRM MOB AIP", "Arrivée enregistrée : le contrôle d'accès émet la clé."],
    ["fof.stay.extended", "FOF", "ACC RAT HKM FOL", "Séjour prolongé : la clé est prolongée."],
    ["fof.stay.room-moved", "FOF", "ACC HKM FOL", "Changement de chambre : la clé est transférée."],
    ["fof.stay.checked-out", "FOF", "ACC HKM FOL CRM AIP", "Départ : la clé est révoquée, la chambre passe à faire."],
    ["acc.credential.issued", "ACC", "FOF MOB AIP BIR", "Carte ou clé mobile émise, révoquée ou déclarée perdue."],
    ["acc.door.forced", "ACC", "AIP HKM BIR PLT", "Événement de porte : ouverture, refus, effraction, porte restée ouverte."],
    ["hrm.shift.started", "HRM", "ACC HKM", "Prise de poste : droits d'accès du personnel activés."],
    ["hkm.room.status-changed", "HKM", "FOF RAT MOB", "Statut d'une chambre modifié (propre, sale, inspection, hors service)."],
    ["fol.payment.captured", "FOL", "FIN AIP BIR", "Paiement encaissé ou remboursé : écriture comptable, contrôle de fraude."],
    ["fol.night-audit.completed", "FOL", "FIN BIR RAT AIP", "Audit de nuit terminé : la date hôtelière avance."],
    ["hrm.payroll.closed", "HRM", "FIN BIR", "Paie clôturée : écritures de paie en comptabilité."],
    ["bln.guest-order.delivered", "BLN", "FOL", "Pressing livré : imputation au folio du client."],
    ["fin.period.closed", "FIN", "BIR OPS", "Période comptable clôturée, états financiers générés."],
    ["rat.availability.changed", "RAT", "INT MOB AIP", "Disponibilités ou tarifs modifiés : diffusion aux canaux."],
  ]
  const ENF = [
    ["ENF-G-01", "Disponibilité", "99,95 % par mois hors maintenance annoncée"],
    ["ENF-G-02", "Temps de réponse API", "p95 < 300 ms en lecture, < 600 ms en écriture"],
    ["ENF-G-03", "Encodage de carte", "< 3 s du clic à la carte prête, y compris hors ligne"],
    ["ENF-G-04", "Ouverture à distance", "< 2 s p95"],
    ["ENF-G-05", "Charge", "5 000 requêtes/s, 1 000 check-ins/minute sur la plateforme"],
    ["ENF-G-06", "Reprise", "RPO 5 min, RTO 1 h ; RPO 0 pour les paiements confirmés"],
    ["ENF-G-07", "Accessibilité", "WCAG 2.1 AA"],
    ["ENF-G-08", "Dates et montants", "UTC en base, fuseau de l'établissement à l'affichage ; montants décimaux, devise ISO 4217"],
    ["ENF-G-09", "Compatibilité API", "12 mois après dépréciation"],
  ]

  const box = (title, sub, kind = "") => `<div class="card" style="padding:10px 12px;${kind === "on" ? "border-color:var(--ink);box-shadow:inset 0 -3px 0 var(--accent)" : kind === "dim" ? "opacity:.45" : ""}"><strong>${esc(title)}</strong>${sub ? `<div class="muted">${esc(sub)}</div>` : ""}</div>`

  const views = {
    architecture(p) {
      const tab = p[0] || "conteneurs"
      const prod = [...new Set(EVENTS.map((e) => e[1]))].map((m) => ({ label: m, value: EVENTS.filter((e) => e[1] === m).length })).sort((a, b) => b.value - a.value)
      const consumed = MODULES.map((m) => ({ label: m, value: EVENTS.filter((e) => e[2].split(" ").includes(m)).length })).filter((x) => x.value).sort((a, b) => b.value - a.value)
      let body = ""
      if (tab === "conteneurs")
        body = `<div class="dash"><div class="w8">` + section("Conteneurs (C4 niveau 2)", `<p class="muted" style="margin-top:0">Vue simplifiée. Les flèches indiquent le sens des appels.</p>`
          + LAYERS.map(([name, boxes], i) => `${i ? `<div style="text-align:center;color:var(--ink2);margin:6px 0">↓</div>` : ""}
            <h3 style="margin:0 0 6px">${esc(name)}</h3><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:8px">${boxes.map(([t, s]) => box(t, s)).join("")}</div>`).join("")
          + `<p class="muted" style="margin-top:14px">Hiérarchie multi-tenant : groupe (tenant) → marque → établissement. Offres d'isolation : mutualisée, base dédiée, déploiement régional dédié.</p>`)
          + `</div><div class="w4">`
          + section("Conteneurs par couche", donut(LAYERS.map(([n, b]) => ({ label: n, value: b.length })), { fmt: (v) => v, center: String(LAYERS.reduce((n, l) => n + l[1].length, 0)), sub: "conteneurs" }))
          + `<div style="margin-top:16px">` + section("Événements publiés par module", bars(prod), btn("Catalogue", "go('architecture/evenements')", "ghost sm")) + `</div>`
          + `<div style="margin-top:16px">` + section("Modules les plus abonnés", bars(consumed.slice(0, 6)), "") + `</div></div></div>`
      else if (tab === "adr")
        body = tbl(["ADR", "Décision", "Pourquoi"], ADR.map(([id, d, w]) => [`<strong>${esc(id)}</strong>`, esc(d), esc(w)]))
      else if (tab === "donnees")
        body = tbl(["Donnée maîtresse", "Module propriétaire", "Modules consommateurs"], OWNERSHIP.map(([d, o, c]) => [esc(d), badge(o, "info"), esc(c)]))
          + `<p class="muted">Chaque module possède ses données ; les autres les lisent par son interface publique ou par ses événements.</p>`
      else if (tab === "evenements") {
        const ev = EVENTS.find((e) => e[0] === ui.archEvent) || EVENTS[1]
        const cons = ev[2].split(" ")
        body = split(
          `<div class="list">${EVENTS.map((e) => `<button aria-current="${e === ev}" onclick="ui.archEvent=${q(e[0])};render()"><strong style="font-family:ui-monospace,monospace;font-size:13px">${esc(e[0])}</strong><div class="muted">${esc(e[1])} → ${esc(e[2].split(" ").length)} module(s)</div></button>`).join("")}</div>`,
          card("", `<div class="big" style="font-family:ui-monospace,monospace;font-size:17px">${esc(ev[0])}</div><p>${esc(ev[3])}</p>
            <div class="row" style="margin:10px 0">${badge("Producteur : " + ev[1], "info")} ${badge(cons.length + " consommateur(s)", "ok")}</div>
            <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:6px">${MODULES.map((m) => box(m, "", m === ev[1] ? "on" : cons.includes(m) ? "" : "dim")).join("")}</div>
            <p class="muted" style="margin-top:12px">Publication par outbox puis Kafka, enveloppe CloudEvents (tenant, établissement, corrélation). Consommateurs idempotents.</p>`))
      } else body = tbl(["ID", "Exigence", "Cible"], ENF.map((r) => [`<strong>${esc(r[0])}</strong>`, esc(r[1]), esc(r[2])]))
      return pageHead("Architecture", "Référence technique de la spécification : décisions, conteneurs, données, événements entre modules et exigences non fonctionnelles.")
        + `<div class="grid g4">
            ${stat({ label: "Décisions (ADR)", value: ADR.length, icon: "filecheck", hint: "décisions d'architecture", route: "architecture/adr" })}
            ${stat({ label: "Modules métier", value: MODULES.length, icon: "layers", hint: `${OWNERSHIP.length} données maîtresses attribuées`, route: "architecture/donnees" })}
            ${stat({ label: "Événements inter-modules", value: EVENTS.length, icon: "zap", hint: `${EVENTS.reduce((n, e) => n + e[2].split(" ").length, 0)} abonnements`, route: "architecture/evenements" })}
            ${stat({ label: "Exigences non fonctionnelles", value: ENF.length, icon: "sliders", hint: "disponibilité 99,95 %", route: "architecture/enf" })}
          </div>`
        + `<div style="margin-top:16px">${subtabs("architecture", [["conteneurs", "Conteneurs"], ["adr", "Décisions (ADR)"], ["donnees", "Propriété des données"], ["evenements", "Événements"], ["enf", "Exigences non fonctionnelles"]], tab)}</div>`
        + body
    },
  }

  HMS.module({
    code: "arc", group: "Projet", title: "Architecture", phase: "toutes", spec: "§2 ARC",
    screens: [{ id: "architecture", label: "Architecture", view: views.architecture }],
  })
})()
