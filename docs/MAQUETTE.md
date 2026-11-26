# Maquette HMS — conventions

But : une maquette cliquable qui représente **tous les modules** de la spécification
(`HMS_SaaS_Specification_FR.docx`, §3 à §23, plus le plan de livraison §30). Pas de backend, pas de build.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Coquille : styles, en-tête, menu latéral, liste des `<script>` des modules |
| `data.js` | Données d'exemple du cœur hôtelier (chambres, clients, réservations, folios) |
| `core.js` | Utilitaires partagés, composants d'interface, registre des modules, routeur |
| `modules/<module>.js` | Un fichier par module de la spec : ses données d'exemple, ses écrans, ses actions |
| `tests/smoke.cjs` | Test de fumée : visite chaque écran et sous-onglet, échoue sur erreur JS ou écran vide |

## Écrire un module

```js
// modules/restauration.js — Spec §13 Restauration / POS (FNB)
;(() => {
  // 1. Données d'exemple du module, rangées sous D.<code>
  D.fnb = { outlets: [...], tickets: [...] }

  // 2. Écrans : fonctions (params) => HTML. params = segments de l'URL après l'id (#pos/ticket/T-12)
  const views = {
    pos(p) {
      const tab = p[0] || "salle"
      return pageHead("Restaurant / POS", "Prise de commande et encaissement.", btn("Nouveau ticket", "A.fnb.newTicket()"))
        + subtabs("pos", [["salle", "Plan de salle"], ["cuisine", "Cuisine"]], tab)
        + (tab === "salle" ? "..." : "...")
    },
  }

  // 3. Actions appelées depuis le HTML : A.<code>.<action>(...)
  const actions = {
    newTicket() { D.fnb.tickets.push({ id: uid("T") }); toast("Ticket créé"); render() },
  }

  HMS.module({
    code: "fnb", group: "Services", title: "Restauration / POS", phase: "11", spec: "§13 FNB",
    screens: [{ id: "pos", label: "Restaurant / POS", view: views.pos }],
    actions,
  })
})()
```

Puis ajouter `<script src="modules/restauration.js"></script>` dans `index.html`.

- **Groupes du menu** (dans cet ordre) : Réception & séjour, Ventes & clients, Opérations, Services, Personnel, Finance, Pilotage & IA, Plateforme.
- **Ids d'écran uniques** dans toute la maquette : préfixer si besoin (`fin-journal`, `hr-paie`). Ids déjà pris : `accueil`, `reservations`, `checkin`, `checkout`, `facture`, `chambres`, `clients`.
- Écran caché (détail, impression) : `{ id, hidden: true, navAs: "<écran parent>", view }`.
- Sous-pages : `subtabs(base, [[id, label]], courant)`, route `#base/id`, ce qui permet au test de fumée de les visiter.
- Après une action : modifier `D`, puis `render()` ou `go(route)`, et `toast("…")` pour confirmer.

## Utilitaires (`core.js`)

- Mise en page : `pageHead(titre, chapeau, actionsHtml)`, `card(titre, html)`, `cards([html])`, `split(gauche, droite)`, `listItems(items, idCourant, route)`, `subtabs`, `chips(cléUi, options, compteurs)`.
- Données : `tbl(colonnes, lignes, vide, pied)` (préfixer une colonne par `#` pour l'aligner à droite, cellules = HTML déjà échappé), `kpi(libellé, valeur, aide)`, `badge(texte, "on"|"dark"|"outline"|"")`, `bars(items, fmt)`, `columns(libellés, valeurs, fmt)`.
- Formulaires : `form([field(id, libellé, input(id, valeur) | select(id, options, valeur))])`, `val(id)`, `btn(libellé, onclick, "ghost"|"accent"|"sm")`.
- IA : `aiBox(titre, texte, actionsHtml)` pour toute fonction d'IA (toujours marquée « simulé »).
- Mobile : `phone(html, titre)` dessine un cadre de téléphone.
- Formats : `money(n)` (FCFA), `fd("2026-11-26")` → 26/11, `fdLong`, `addDays`, `nights`, `pct`, `uid(préfixe)`.
- Sécurité : tout texte issu des données passe par `esc()` ; argument chaîne dans un `onclick` : `q(valeur)`.
- Cœur hôtelier partagé : `D.rooms`, `D.guests`, `D.reservations`, `G(id)`, `R(id)`, `T(code)`, `inHouse()`, `occupant(no)`, `folio(r)`, `today`.

## Règles

- Français. Sobre : un seul accent de couleur (`badge(..., "on")`), clair et sombre, lisible sur mobile.
- **Dépôt public : données fictives uniquement** (« Client Exemple 3 », « Employé Exemple 2 », `exemple.test`). Aucun vrai nom, aucun numéro réel, aucun secret.
- Les montants et indicateurs sont des exemples : le dire dans le chapeau ou l'aide d'un KPI.
- Le matériel (serrures, encodeurs, TPE), les canaux (OTA, GDS), les PSP, les déclarations fiscales et les LLM sont **simulés** et doivent apparaître comme tels.
- Chaque module montre au moins : la liste principale, une fiche ou un détail, une action qui modifie l'état, ses KPI (§x.12 de la spec) et sa fonction d'IA (§x.11).

## Tester

```bash
NODE_PATH=<node_modules contenant playwright> node tests/smoke.cjs [dossier-captures]
```
