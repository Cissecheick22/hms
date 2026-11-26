# HMS — prototype

Un logiciel de gestion hôtelière en ligne pour gérer les réservations, la réception, les chambres et les clés d'accès d'un hôtel.

Maquette cliquable : `index.html` + données d'exemple dans `data.js`. Aucune base de données.

- Voir en local : ouvrir `index.html` dans le navigateur (ou `python3 -m http.server 8080`).
- Publier : GitHub Pages publie la branche `main` (réglage du dépôt, aucun workflow) ; chaque push met le lien à jour.
- Dépôt public : données factices seulement, jamais de vraie donnée ni de secret.
- Modifier les écrans : éditer `data.js` (types `dashboard`, `table`, `cards`) ; ajouter un type dans `views` de `index.html` si besoin.
- Passer au vrai projet : `python3 ~/CascadeProjects/framework-ia/fw.py new --mode complet`.
