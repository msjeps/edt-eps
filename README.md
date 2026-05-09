# EDT EPS

Application web de gestion de l'emploi du temps EPS pour coordonnateurs d'établissements scolaires (collège, lycée, mixte).

**Fonctionnalités principales :**
- Planification des séances EPS par classe, enseignant, activité et installation
- Gestion des réservations d'installations sportives (intra / extra-muros)
- Gestion des demandes de transport
- Exports PDF, Excel et CSV (format Direction des Sports)
- Stockage 100 % local via IndexedDB — aucune donnée envoyée sur un serveur

---

## Utilisation

L'application est disponible en ligne, sans installation :

**[https://msjeps.github.io/edt-eps](https://msjeps.github.io/edt-eps)**

Un navigateur moderne suffit (Chrome ou Edge recommandés pour la sauvegarde de fichiers).  
Aucune installation, aucun compte, aucune donnée envoyée sur internet.

---

## Développement local

> Réservé aux contributeurs. Node.js ≥ 18 et npm ≥ 9 requis.

```bash
git clone https://github.com/msjeps/edt-eps.git
cd edt-eps
npm install
npm run dev        # http://localhost:5173
npm run build      # génère dist/
```

Le site est déployé automatiquement sur GitHub Pages à chaque push sur `main`.

---

## Fonctionnalités

### Configuration (Wizard)
Assistant en 7 étapes pour configurer rapidement un établissement :
établissement → périodes → enseignants → classes → activités → installations → transports.

### Emploi du temps
- Grille semaine avec drag & drop (déplacement d'un jour à l'autre, par période ou toutes périodes)
- Détection de conflits en temps réel (enseignant, classe, installation)
- Bannière conflits avec suggestions de résolution
- Sync automatique grille EDT ↔ Programmation annuelle
- Annulation (Ctrl+Z, 20 niveaux)

### Programmation annuelle
- Matrice classe × période et installation × période
- Horaires spécifiques par période
- Avertissement activité déjà utilisée (même période / autre période)
- Chevauchement de périodes (séances semestre visibles en vue trimestre)

### Vues complémentaires
- Par enseignant, par classe, par installation
- Filtre par période

### Réservations
Workflow statuts : *proposé → demandé → accepté / refusé*

### Exports
| Format | Contenu |
|--------|---------|
| PDF | Grille équipe (A4 paysage) + fiches individuelles par enseignant |
| Excel EDT | Emploi du temps complet |
| Excel synthèses | Synthèses intra / extra, occupation installations |
| CSV mairie | Format Direction des Sports (réservations installations) |
| CSV transport | 1 ligne = 1 bus (format mairie) |
| JSON projet | Export / import du projet entier (chiffrable) |

### Calendrier scolaire
Récupération automatique via l'API Éducation nationale (zones A / B / C / Corse), avec cache localStorage 7 jours et fallback sur données intégrées.

### Import disponibilités mairie
Import des créneaux réservés par d'autres établissements, enregistrés comme indisponibilités sur vos installations.  
Trois sources acceptées :

| Source | Description |
|--------|-------------|
| Données intégrées | Réservations EPS 2025-2026 pré-chargées (Antibes) |
| Fichier JSON | JSON extrait du PDF Direction des Sports |
| **Fichier Excel `.xlsx`** | Fichiers fournis directement par la Direction des Sports |

Deux formats Excel sont reconnus automatiquement :
- **Par lieu / période** — onglets `T1` / `T2` / `T3`, colonnes = créneaux horaires (ex : Auvergne, Fort Carré)
- **Par lieu / jour** — onglets `Lundi`…`Vendredi`, 1 fichier = 1 période (ex : Piscine)

Dans les deux cas : détection automatique du format, pré-remplissage du nom du complexe depuis le nom de fichier, mapping espaces → installations locales.

### Versioning / Snapshots
Capture, restauration et comparaison de versions (diff séances lisible : ajout / suppression / modification).

### Jeu de données démo
Bouton « Charger la démo » dans le dashboard : dataset fictif complet (Collège-Lycée Les Quatre Vents — 5 profs, 12 classes, 3 trimestres, 60 séances).

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Vanilla JS + HTML5 + CSS3 |
| Build | [Vite](https://vitejs.dev/) |
| Stockage | [Dexie.js](https://dexie.org/) (IndexedDB) |
| Export / Import Excel | [ExcelJS](https://github.com/exceljs/exceljs) |
| Export PDF | [jsPDF](https://github.com/parallax/jsPDF) |
| Import CSV | [Papa Parse](https://www.papaparse.com/) |
| Drag & drop | [SortableJS](https://sortablejs.github.io/Sortable/) |

---

## Structure du projet

```
├── index.html
├── manifest.json          # Manifest PWA
├── sw.js                  # Service Worker
├── vite.config.js
├── src/
│   ├── main.js            # Bootstrap
│   ├── app.js             # Router + shell
│   ├── db/                # Schéma IndexedDB, CRUD, migrations
│   ├── models/            # Entités métier
│   ├── engine/            # Moteur de contraintes, détection conflits
│   ├── views/             # Wizard, grille EDT, vues complémentaires
│   ├── export/            # CSV, Excel, PDF
│   ├── import/            # Import Excel, disponibilités mairie
│   ├── versioning/        # Snapshots, journal, diff
│   ├── components/        # Composants UI (modal, toast, tabs…)
│   └── utils/             # Dates, couleurs, crypto, File System API…
├── styles/                # CSS (main, grid, wizard, components, print)
├── assets/                # Icônes PWA, logo
└── data/
    └── ref/               # Catalogue activités EPS, calendrier académie
```

---

## Modèle de données (résumé)

```
Etablissement → Periodes → Enseignants + Classes + Activites + Installations
Seance = Classe + Enseignant + Activite + Installation + Créneau + Période
Reservation → liée à une Séance (installation extra-muros)
Transport → liée à une Séance extra-muros
```

### Contraintes métier

**Hard (jamais violées)**
- Pas de conflit ressource (même créneau : même prof, même classe, même installation)
- Max 6 h EPS / jour / enseignant (AS exclue)
- Écart min 24 h entre 2 séances d'une même classe collège
- Compatibilité activité ↔ installation

**Soft (optimisées)**
- Desideratas enseignants, équilibrage journées, regroupement extra-muros

---

## Sauvegarde / Dossiers projet

L'application utilise la **File System Access API** (Chrome / Edge) pour mémoriser deux dossiers :
- `EDT EPS/PROJET` → sauvegarde JSON du projet
- `EDT EPS/EXPORTS` → fichiers exportés

Sur les navigateurs sans cette API (Firefox, Safari), les fichiers sont téléchargés via le dossier Téléchargements habituel.

---

## Licence

Usage interne — établissement scolaire. Pas de licence open source définie à ce stade.
