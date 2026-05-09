# Skill : Générateur d'Application EPS (PWA)

## Description
Ce skill génère et maintient l'application PWA "EDT EPS" pour les coordonnateurs EPS.
L'application permet de produire l'emploi du temps des enseignants d'EPS, gérer les réservations d'installations sportives et les demandes de transport.

## Déclenchement
Utiliser ce skill quand l'utilisateur demande de :
- Créer, modifier ou améliorer l'application EDT EPS
- Ajouter un module, une vue, un export
- Corriger un bug dans l'application
- Ajouter une fonctionnalité de gestion EDT, réservations ou transports

## Instructions

### Avant de coder
1. Toujours lire le fichier `CLAUDE.md` à la racine du projet pour connaître l'architecture, les décisions et les conventions
2. Vérifier les fichiers existants avant d'en créer de nouveaux
3. Respecter la structure de dossiers définie dans CLAUDE.md

### Architecture
- **PWA vanilla JS** : pas de React/Vue/Angular. Modules ES6, CSS custom properties, IndexedDB via Dexie.js
- **Desktop-first** : interface sobre type tableur amélioré, optimisée pour écrans larges
- **Zéro serveur** : tout est local (IndexedDB), partage via export/import fichiers JSON
- **Build** : Vite.js

### Modèle de données
Les entités principales sont : Etablissement, Periode, Enseignant, Classe, Activite, Lieu, Installation, Zone, Seance, Reservation, Transport.
Voir CLAUDE.md pour le schéma complet.

### Contraintes métier critiques
- **24h min** entre 2 séances EPS d'une même classe collège
- **6h max/jour/enseignant** (AS exclue de ce décompte)
- **Natation → piscine obligatoire**
- **Pas de conflit** : un prof, une classe, une installation ne peuvent être à deux endroits en même temps
- **Transport** : 1 ligne = 1 classe, pas de mutualisation de bus entre classes
- **Périodes** : modèles (trimestre, semestre, 6 périodes) + sous-périodes personnalisables avec dates libres

### Conventions de code
- Fichiers : kebab-case
- Variables/fonctions : camelCase
- Classes : PascalCase
- Commentaires métier en français
- Modules ES6 (import/export)
- Pas de TypeScript

### Exports à supporter
1. **CSV mairie** : format inspiré Direction des Sports Antibes (jour, période, créneau, lieu, installation, établissement, classe, activité)
2. **CSV transport** : JOUR, DATES, LIEU, DEPART_ETABLISSEMENT, RETOUR_DEPUIS_INSTALL, CLASSE, EFFECTIF, ENSEIGNANT, NB_ROTATIONS
3. **PDF/Excel EDT** : emploi du temps équipe + individuels
4. **Synthèses** : occupation installations, intra/extra-muros par période et niveau

### Couleurs installations (palette existante)
```
FORT CARRE=#FF99CC, BEACH FC=#CC0000, AUVERGNE=#FFFF00, FOCH=#CCFFCC
FONTONNE=#B4A7D6, PISCINE=#66FFFF, GYMNASE=#108080, TERR MSJ=#C0C0C0
```

### Workflow de développement
1. Lire les fichiers existants pertinents
2. Planifier les modifications (modules affectés, impacts)
3. Implémenter en respectant l'architecture modulaire
4. Vérifier la cohérence avec le moteur de contraintes
5. Tester via le serveur de preview si disponible

### Fichiers de référence
Les fichiers suivants dans le dossier Downloads contiennent des exemples réels :
- `EDT 2025 2026 V2 (1).xlsx` : EDT complet du collège-lycée Mont Saint Jean
- `exemple.xlsx` : Version exemple avec structure identique
- `T2_EPS_COLL_MSJ_2025_2026 (1).pdf` : Export transport T2
- `INSTALL RESERVEES MI JUIN_Vision_Hebdo_Org_2025_2026.pdf` : Réservations Direction des Sports Antibes
- `extracted_reservations.json` / `extracted_eps_reservations.json` : Données extraites du PDF installations
