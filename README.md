# HMS — prototype

Un logiciel de gestion hôtelière en ligne pour gérer les réservations, la réception, les chambres et les clés d'accès d'un hôtel.

Maquette cliquable de tous les modules de la spécification HMS SaaS : `index.html` (coquille), `core.js` (socle), un fichier par module dans `modules/`. Aucune base de données.

- Voir en local : ouvrir `index.html` dans le navigateur (ou `python3 -m http.server 8080`).
- Publier : GitHub Pages publie la branche `main` (réglage du dépôt, aucun workflow) ; chaque push met le lien à jour.
- Dépôt public : données factices seulement, jamais de vraie donnée ni de secret.
- Modifier ou ajouter des écrans : voir `docs/MAQUETTE.md`.
- Test de fumée : `NODE_PATH=<node_modules avec playwright> node tests/smoke.cjs`.
- Passer au vrai projet : `python3 ~/CascadeProjects/framework-ia/fw.py new --mode complet`.
