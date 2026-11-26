// Données d'exemple du prototype (chargées par index.html, y compris ouvert directement depuis le disque). Chaque écran a un type : dashboard, table ou cards. Remplacer par les écrans de l'idée.
window.PROTOTYPE_DATA = {
  "screens": [
    {
      "id": "accueil",
      "label": "Tableau de bord",
      "type": "dashboard",
      "title": "HMS",
      "lead": "Un logiciel de gestion hôtelière en ligne pour gérer les réservations, la réception, les chambres et les clés d'accès d'un hôtel.",
      "kpis": [
        {
          "label": "Demandes du mois",
          "value": "128",
          "hint": "exemple"
        },
        {
          "label": "Traitées",
          "value": "112",
          "hint": "exemple"
        },
        {
          "label": "Temps moyen",
          "value": "2 h 10",
          "hint": "exemple"
        }
      ]
    },
    {
      "id": "liste",
      "label": "Liste",
      "type": "table",
      "status": "Terminé",
      "title": "Dossiers",
      "lead": "Liste type, avec un statut par ligne.",
      "columns": [
        "Référence",
        "Client",
        "Date",
        "Statut"
      ],
      "rows": [
        [
          "D-1042",
          "Client A",
          "24/11",
          "En cours"
        ],
        [
          "D-1041",
          "Client B",
          "23/11",
          "Terminé"
        ],
        [
          "D-1040",
          "Client C",
          "22/11",
          "Terminé"
        ]
      ]
    },
    {
      "id": "offre",
      "label": "Fonctionnement",
      "type": "cards",
      "title": "Comment ça marche",
      "lead": "Trois étapes, à adapter.",
      "items": [
        {
          "title": "1. Connecter",
          "text": "L'utilisateur relie ses outils en quelques minutes."
        },
        {
          "title": "2. Configurer",
          "text": "Il choisit ses règles, sans code."
        },
        {
          "title": "3. Suivre",
          "text": "Il voit l'activité et valide ce qui doit l'être."
        }
      ]
    }
  ]
}
