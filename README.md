# HMS — prototype

Un logiciel de gestion hôtelière en ligne pour gérer les réservations, la réception, les chambres et les clés d'accès d'un hôtel, destiné aux hôtels de Côte d'Ivoire.

Maquette cliquable de **tous les modules de la spécification HMS SaaS** (§2 à §30) : 23 modules, 61 écrans, sans backend.
En ligne : https://cissecheick22.github.io/hms/ — la page **Projet › Couverture de la spec** relie chaque module de la spec à ses écrans.

| Groupe | Modules (fichier) |
|---|---|
| Réception & séjour | tableau de bord, réservations, check-in avec clé, check-out et facture (`reception.js`) ; plan des chambres, walk-in, délogement, no-show, groupes, audit de nuit (`sejour.js`) |
| Ventes & clients | fiches clients (`reception.js`) ; tarifs, inventaire, canaux (`distribution.js`) ; fidélité, campagnes, avis, RGPD (`crm.js`) |
| Opérations | statut des chambres (`reception.js`) ; clés, serrures, sécurité (`acces.js`) ; maintenance et qualité (`maintenance.js`) ; achats et stocks (`achats.js`) ; linge et pressing (`buanderie.js`) |
| Services | restaurant / POS (`restauration.js`), spa et loisirs (`spa.js`), événements et MICE (`evenements.js`) |
| Personnel | RH, plannings, paie Côte d'Ivoire simulée (`rh.js`) |
| Finance | folios, paiements, city ledger, caisse (`sejour.js`) ; comptabilité SYSCOHADA (`compta.js`) |
| Pilotage & IA | plateforme IA (`ia.js`), BI et reporting (`bi.js`) |
| Plateforme | utilisateurs, audit, établissements (`plateforme.js`) ; intégrations, console SaaS, conformité, migration (`exploitation.js`) ; applications mobiles (`mobile.js`) |
| Projet | couverture de la spec (`couverture.js`), architecture (`architecture.js`) |

- **Données** : entièrement fictives (noms ivoiriens inventés, `exemple.test`, +225 07 00 00 00 NN). Les actions modifient vraiment les données et sont gardées dans le navigateur ; le bouton « Réinitialiser » revient aux données d'origine.
- **Simulé** : serrures et encodeurs, canaux OTA/GDS, PSP et mobile money, déclarations fiscales et sociales, IA. Les taux, barèmes et seuils sont des exemples à faire valider.
- Voir en local : ouvrir `index.html` dans le navigateur (ou `python3 -m http.server 8080`).
- Publier : GitHub Pages publie la branche `main` (réglage du dépôt, aucun workflow) ; chaque push met le lien à jour.
- Dépôt public : jamais de vraie donnée ni de secret.
- Modifier ou ajouter des écrans : voir `docs/MAQUETTE.md`.
- Tests (Playwright requis) : `NODE_PATH=<node_modules avec playwright> node tests/smoke.cjs` (tous les écrans) et `node tests/parcours.cjs` (parcours entre modules).
- Le hors-périmètre de `docs/cadrage.json` concerne l'ordre de livraison du vrai projet ; la maquette, elle, montre toute la spec.
- Passer au vrai projet : `python3 ~/CascadeProjects/framework-ia/fw.py new --mode complet`.
