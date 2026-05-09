# EDT EPS - Application de gestion d'emploi du temps EPS

## Projet
Application web pour coordonnateurs EPS (utilisée **avec connexion internet**).
Objectif : produire l'emploi du temps EPS, gérer les réservations d'installations sportives et les transports. Stockage 100% local (IndexedDB), pas de serveur externe.

**Dernière mise à jour : 08/05/2026**

## Stack technique
- **Framework** : Vanilla JS + HTML5 + CSS3 (pas de framework lourd, PWA légère)
- **Stockage** : IndexedDB (via Dexie.js) + export/import JSON chiffrable
- **Build** : Vite.js (bundler léger, HMR rapide)
- **Style** : CSS custom properties (thème sobre, professionnel, desktop-first)
- **Export** : SheetJS (xlsx), jsPDF, Papa Parse (CSV)
- **Drag & drop** : SortableJS ou natif HTML5 DnD
- **PWA** : Service Worker + manifest.json pour usage hors-ligne

## Structure du projet
```
/Users/nathalieprenois/CLAUDE IA/EDT EPS/
├── CLAUDE.md                    # Ce fichier
├── index.html                   # Point d'entrée PWA
├── manifest.json                # Manifest PWA
├── sw.js                        # Service Worker
├── src/
│   ├── main.js                  # Bootstrap application
│   ├── app.js                   # Router + shell applicatif
│   ├── db/
│   │   ├── schema.js            # Schéma IndexedDB (Dexie)
│   │   ├── store.js             # CRUD opérations
│   │   └── migrations.js        # Migrations de schéma
│   ├── models/
│   │   ├── etablissement.js     # Établissement
│   │   ├── enseignant.js        # Enseignant (ORS, contraintes, prefs)
│   │   ├── classe.js            # Classe (niveau, effectif, groupes)
│   │   ├── activite.js          # Activité (champ apprentissage, exigences)
│   │   ├── installation.js      # Lieu > Installation > Zone
│   │   ├── periode.js           # Périodes (modèles + custom)
│   │   ├── creneau.js           # Créneaux (slots 30min)
│   │   ├── seance.js            # Séance (bloc EDT = classe+prof+activité+install+créneau)
│   │   ├── reservation.js       # Réservation (statut, demandeur)
│   │   └── transport.js         # Demande transport bus
│   ├── engine/
│   │   ├── constraints.js       # Moteur de contraintes (hard/soft)
│   │   ├── conflicts.js         # Détection + résolution conflits
│   │   ├── validator.js         # Validation temps réel
│   │   └── generator.js         # Générateur automatique (phase 2)
│   ├── views/
│   │   ├── wizard/              # Assistant de configuration
│   │   │   ├── wizard.js
│   │   │   ├── step-etablissement.js
│   │   │   ├── step-periodes.js
│   │   │   ├── step-enseignants.js
│   │   │   ├── step-classes.js
│   │   │   ├── step-activites.js
│   │   │   ├── step-installations.js
│   │   │   └── step-transports.js
│   │   ├── edt/                 # Éditeur EDT
│   │   │   ├── grid.js          # Grille semaine (drag & drop)
│   │   │   ├── bloc.js          # Composant bloc séance
│   │   │   ├── toolbar.js       # Barre d'outils EDT
│   │   │   └── filters.js       # Filtres (par prof, classe, période)
│   │   ├── vues/                # Vues complémentaires
│   │   │   ├── vue-prof.js      # EDT individuel enseignant
│   │   │   ├── vue-classe.js    # EDT par classe
│   │   │   ├── vue-install.js   # Occupation par installation
│   │   │   └── vue-periodes.js  # Vue programmation annuelle
│   │   ├── conflits/            # Tableau conflits
│   │   │   └── conflits.js
│   │   ├── reservations/        # Gestion réservations
│   │   │   └── reservations.js
│   │   ├── exports/             # Écran exports
│   │   │   └── exports.js
│   │   └── donnees/             # Gestion données (CRUD)
│   │       └── donnees.js
│   ├── import/
│   │   ├── excel-import.js      # Import depuis Excel existant
│   │   └── disponibilites.js    # Import créneaux occupés (mairie)
│   ├── export/
│   │   ├── csv-mairie.js        # Export CSV format Direction Sports
│   │   ├── csv-transport.js     # Export transport (1 ligne = 1 bus)
│   │   ├── pdf-edt.js           # Export PDF EDT équipe + individuels
│   │   ├── excel-edt.js         # Export Excel EDT
│   │   └── syntheses.js         # Synthèses intra/extra, occupation
│   ├── versioning/
│   │   ├── snapshots.js         # Gestion versions (snapshots)
│   │   ├── changelog.js         # Journal de modifications
│   │   └── diff.js              # Comparaison entre versions
│   ├── components/              # Composants UI réutilisables
│   │   ├── modal.js
│   │   ├── tabs.js
│   │   ├── toast.js
│   │   ├── color-legend.js
│   │   └── data-table.js
│   └── utils/
│       ├── calendrier-api.js    # API Éducation nationale (vacances) + api.gouv.fr (fériés)
│       ├── dates.js             # Utilitaires dates/calendrier scolaire (fallback hardcodé)
│       ├── colors.js            # Palette couleurs installations
│       ├── crypto.js            # Chiffrement fichier projet
│       ├── filesystem.js        # File System Access API (dossiers projet/exports mémorisés, fallback download)
│       ├── undo.js              # Pile d'annulation Ctrl+Z (snapshot complet, max 20)
│       └── helpers.js           # Utilitaires généraux
├── styles/
│   ├── main.css                 # Variables + reset + layout
│   ├── grid.css                 # Grille EDT
│   ├── wizard.css               # Wizard
│   ├── components.css           # Composants
│   └── print.css                # Styles impression
├── assets/
│   ├── icons/                   # Icônes PWA
│   └── logo.svg
├── data/
│   └── ref/                     # Données de référence
│       ├── activites-eps.json   # Catalogue activités EPS par champ
│       └── academie-nice.json   # Calendrier scolaire zone B
├── extracted_reservations.json  # Données extraites PDF Direction Sports
└── extracted_eps_reservations.json
```

## Décisions d'architecture

### MVP (Phase 1) — IMPLÉMENTÉ
1. ✅ Wizard de configuration (7 étapes, générateurs automatiques)
2. ✅ Grille EDT avec drag & drop + auto-sync depuis Programmation
3. ✅ Détection conflits temps réel + suggestions + bannière conflits profs
4. ✅ Exports (CSV mairie, CSV transport, Excel EDT, Excel synthèses, JSON projet)
5. ✅ Programmation annuelle (matrice classe×période + installation×période)
6. ✅ Réservations (workflow statuts proposé→demandé→accepté/refusé)
7. ✅ Calendrier scolaire via API officielle (zones A/B/C/Corse, auto-update)
8. ✅ Chevauchement de périodes dans Programmation (séances semestre visibles en vue trimestre — fantômes grisés)
9. ✅ Sync EDT → Programmation (séance manuelle dans EDT crée creneauClasse + programmation)
10. ✅ Containers jour visuels dans la grille EDT (bandes séparatrices, colonne sticky supprimée)
11. ✅ Avertissement activité déjà utilisée dans modal séance (✓ même période / ○ autre période, bandeau orange/bleu)
12. ✅ Sauvegarde intelligente (28/04/2026) : File System Access API, dossier mémorisé (EDT EPS/PROJET pour JSON, EDT EPS/EXPORTS pour exports), toast "Changer dossier", fallback Téléchargements si API non supportée
13. ✅ Avertissement activité déjà utilisée dans Programmation (28/04/2026) : même comportement ✓/○ que dans EDT
14. ✅ Horaires par période (28/04/2026) : un même créneau peut avoir des heures différentes selon le trimestre (heureDebut/heureFin/jour stockés en override sur la programmation, null = valeur du créneau de base) — badge bleu dans la cellule Programmation, pris en compte dans EDT
15. ✅ Drag cross-day dans EDT (28/04/2026) : déplacement d'un jour à l'autre avec dialogue "Cette période uniquement / Toutes les périodes"
16. ✅ Fonction Annuler (Ctrl+Z) (28/04/2026) : bouton ↶ dans le header, raccourci Ctrl/Cmd+Z, snapshot complet avant chaque écriture DB (max 20 niveaux), couverture totale : Données, EDT, Programmation
17. ✅ Export PDF (02/05/2026) : grille équipe paysage A4 + fiches individuelles portrait par enseignant (ORS + total hebdo dédupliqué) — `src/export/pdf-edt.js`
18. ✅ Vues individuelles (02/05/2026) : onglet "Vues" dans la nav — par enseignant / par classe / par installation, filtre période — `src/views/vues/vues.js`
19. ✅ Print CSS (08/05/2026) : `styles/print.css`, A4 paysage, page-breaks, légende print, header impression, auto-zoom JS via `beforeprint`/`afterprint`
20. ✅ Snapshots / Versioning (08/05/2026) : modale Versions — liste, capture, restauration, comparaison deux snapshots ou vs actuel, diff séances lisible (ajout/suppression/modification) — `src/versioning/snapshots.js`, `src/versioning/snapshots-modal.js`
21. ✅ Indisponibilités UI : colonne compteur dans la liste Enseignants, modal par enseignant (cases "Absent jour entier" + plages horaires par jour), sauvegarde/mise à jour IDB — `src/views/donnees/donnees.js`
22. ✅ Import disponibilités mairie : bouton "Import mairie" dans l'onglet Installations (badge compteur), modal de mapping espaces→installations, parse JSON Direction des Sports, captureUndo — `src/import/disponibilites.js`, `src/views/donnees/donnees.js`
23. ✅ Jeu de données démo : bouton "Charger la démo" dans le dashboard, dataset fictif complet (5 profs, 12 classes, 3 trimestres, 60 séances, Collège-Lycée Les Quatre Vents) — `src/data/demo.js`, `src/views/dashboard.js`

### Reste à implémenter
- Aucune fonctionnalité MVP en attente. Le MVP Phase 1 est complet.

### Choix confirmés
- **1 projet = 1 établissement** (pas de multi-établissement)
- **Desktop-first** (sobre, fonctionnel, type tableur amélioré)
- **Pas d'import Excel** — le wizard avec générateurs auto est suffisant (~10 min de config)
- **Application web avec connexion internet** (pas de mode hors-ligne strict)
- **Calendrier scolaire** : API Éducation nationale + api.gouv.fr, cache localStorage 7 jours
- **Périodes** : modèles prédéfinis (3 trimestres, 2 semestres, mixte) + personnalisation
- **Installations** : gestion propre + import optionnel des disponibilités mairie
- **Format export mairie** : inspiré du PDF Direction des Sports d'Antibes (27 espaces, 7 complexes)
- **Transport** : 1 ligne = 1 classe, pas de mutualisation

## Modèle de données

### Entités principales
```
Etablissement {id, nom, type[college|lycee|mixte], joursOuvres[], creneauxBase[]}
Periode {id, nom, type[trimestre|semestre|custom], dateDebut, dateFin, parentId?, niveau[college|lycee|tous]}
Enseignant {id, nom, prenom, ors, maxHeuresJour(6), indisponibilites[], preferences[], contraintesHard[]}
Classe {id, nom, niveau[6e|5e|4e|3e|2nde|1ere|term], effectif, enseignantId, groupes[]}
Activite {id, nom, champApprentissage[CA1|CA2|CA3|CA4], exigenceInstallation?, periodes[], duree}
Lieu {id, nom, type[intra|extra], adresse, necessiteBus, tempsTrajet}
Installation {id, lieuId, nom, capaciteSimultanee, activitesCompatibles[], indisponibilites[]}
Zone {id, installationId, nom, description}
Seance {id, classeId, enseignantId, activiteId, installationId, zoneId?, jour, heureDebut, heureFin, periodeId, verrouille, notes}
Reservation {id, seanceId, installationId, statut[propose|demande|accepte|refuse], periodeId, dates[]}
Transport {id, seanceId, jour, dates[], lieuId, departEtablissement, retourInstallation, classeId, effectif, enseignantId, nbRotations}
```

### Contraintes hard (jamais violées)
- Pas de conflit ressource (même prof, même classe, même installation au même créneau)
- Max 6h EPS/jour/enseignant (AS exclue)
- Écart min 24h entre 2 séances d'une même classe collège
- Compatibilité activité ↔ installation (natation → piscine obligatoire)
- Périodes autorisées par activité
- Indisponibilités (prof/installation/transport)
- Capacité installation ≥ effectif

### Contraintes soft (optimisées, négociables)
- Desideratas enseignants (jour libre, commencer à 10h...)
- Équilibrage des journées / minimiser les trous
- Regrouper extra-muros pour limiter les bus
- Minimiser trajets

## Règles métier spécifiques

### Créneaux collège
- 6e : 2×2h (4h/semaine)
- 5e, 4e, 3e : 2×1h30 ou 2h+1h ou 2h+1h30 (3h/semaine)
- Contrainte 24h min entre 2 séances d'une même classe

### Créneaux lycée
- 2nde : 2h (1 seul bloc)
- 1ère/Term : 2h (groupes EPS inter-classes)
- Pas de contrainte 24h

### Transport
- Temps trajet ignoré dans le planning (géré en interne)
- 2h de cours en déplacement = 1h sur l'installation
- Export : départ MSJ = heure cours + 15min trajet (configurable)

### Association Sportive
- Hors ORS 6h/jour mais peut bloquer ressources si activé
- Créneaux midday (12h-14h) typiquement

### Périodes spéciales
- Piscine Antibes : P1 (avec primaires) / P1bis (sans) / P2 / P3 (sans primaires) / P3bis (avec)
- Possibilité de dates à dates pour installations spécifiques

## Conventions de code
- Noms de fichiers : kebab-case
- Fonctions/variables : camelCase
- Classes/constructeurs : PascalCase
- Commentaires en français pour le domaine métier
- Pas de TypeScript (vanilla JS pour simplicité)
- Modules ES6 (import/export)
- Pas de dépendances inutiles

## Palette couleurs installations (issue de l'Excel existant)
```
FORT CARRE    : #FF99CC (rose)
BEACH FC      : #CC0000 (rouge foncé)
AUVERGNE      : #FFFF00 (jaune)
FOCH          : #CCFFCC (vert clair)
FONTONNE      : #B4A7D6 (violet)
PISCINE       : #66FFFF (cyan)
GYMNASE       : #108080 (teal foncé)
TERR MSJ      : #C0C0C0 (gris)
PARC EXFLORA  : #E0E0E0 (gris clair)
```

## Fichiers de référence analysés
- `EDT 2025 2026 V2 (1).xlsx` : EDT complet MSJ (5 profs, 28 classes, 11 feuilles)
- `exemple.xlsx` : Même structure, version exemple (6 feuilles)
- `T2_EPS_COLL_MSJ_2025_2026 (1).pdf` : Export transport T2 (10 lignes, 3 lieux)
- `INSTALL RESERVEES MI JUIN_Vision_Hebdo_Org_2025_2026.pdf` : Réservations Direction Sports Antibes (242 entrées, 27 espaces, 7 complexes)
