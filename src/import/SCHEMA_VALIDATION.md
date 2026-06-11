# Validation de Schéma pour Imports JSON

## Vue d'ensemble

Le système de validation de schéma vérifie l'intégrité des fichiers JSON importés avant de les charger dans la base de données IndexedDB. Cela garantit que :

- ✅ Tous les champs obligatoires sont présents
- ✅ Les types de données sont corrects
- ✅ Les énumérations respectent les valeurs autorisées
- ✅ Les formats de date sont valides
- ✅ Les limites numériques (min, max) sont respectées

## Architecture

```
src/import/
├── schema-validator.js      # Moteur de validation
├── import-utils.js          # Utilitaires d'import avec UI
└── __tests__/
    └── schema-validator.test.js
```

## Usage

### Valider un export complet

```javascript
import { validateExport, formatValidationErrors } from './import/schema-validator.js';

const data = JSON.parse(jsonString);
const result = validateExport(data);

if (!result.valid) {
  console.warn(formatValidationErrors(result));
  // Issues contient les détails : result.issues
}
```

### Valider une table spécifique

```javascript
import { validateTable } from './import/schema-validator.js';

const result = validateTable('seances', seancesArray);
// result.errors contient les erreurs détaillées par ligne
```

### Valider un objet individuel

```javascript
import { validateObject } from './import/schema-validator.js';

const enseignant = { id: 1, nom: 'Dupont', ... };
const result = validateObject(enseignant, 'enseignants');
```

### Importer avec validation

```javascript
import { importProjectFile } from './import/import-utils.js';

const file = fileInput.files[0];
const result = await importProjectFile(file, { 
  strict: false,  // false = continuer malgré les erreurs
  onValidationWarning: (validation) => {
    // Retourner true pour continuer, false pour annuler
    return window.confirm('Continuer malgré les avertissements ?');
  }
});

if (result.success) {
  console.log('Import réussi');
} else {
  console.error(result.message);
}
```

## Schémas supportés

### Établissement
```javascript
{
  id: number
  nom: string (required)
  type: 'college' | 'lycee' | 'mixte'
  joursOuvres: string[]
  tempsTrajetDefautMin: number (>= 0)
  previsionsTransport: object
}
```

### Enseignant
```javascript
{
  id: number
  nom: string (required)
  prenom: string
  initiales: string
  ors: boolean
  maxHeuresJour: number (0-24)
  indisponibilites: any[]
  preferences: any[]
  contraintesHard: any[]
}
```

### Classe
```javascript
{
  id: number
  nom: string (required)
  niveau: string
  effectif: number (>= 0)
  enseignantId: number
  groupes: any[]
}
```

### Activité
```javascript
{
  id: number
  nom: string (required)
  champApprentissage: 'CA1' | 'CA2' | 'CA3' | 'CA4'
  code: string
  niveaux: string[]
  exigenceInstallation: string
  periodes: any[]
  duree: number (>= 0)
  heuresHebdo: number (>= 0)
  dureeSlot: number (>= 0)
}
```

### Séance
```javascript
{
  id: number
  classeId: number (required)
  enseignantId: number (required)
  activiteId: number (required)
  installationId: number (required)
  zoneId: number
  jour: string (required)
  heureDebut: string (required) - format HH:MM
  heureFin: string (required) - format HH:MM
  periodeId: number (required)
  verrouille: boolean
  notes: string
}
```

### Période
```javascript
{
  id: number
  nom: string (required)
  type: 'trimestre' | 'semestre' | 'custom'
  dateDebut: string (format YYYY-MM-DD)
  dateFin: string (format YYYY-MM-DD)
  parentId: number
  niveau: string
  ordre: number
}
```

### Lieu
```javascript
{
  id: number
  nom: string (required)
  type: 'intra' | 'extra'
  adresse: string
  necessiteBus: boolean
  tempsTrajet: number (>= 0)
  couleur: string
}
```

### Installation
```javascript
{
  id: number
  lieuId: number (required)
  nom: string (required)
  capaciteSimultanee: number (>= 1)
  activitesCompatibles: number[]
  indisponibilites: any[]
}
```

### Zone
```javascript
{
  id: number
  installationId: number (required)
  nom: string (required)
  description: string
}
```

### Réservation
```javascript
{
  id: number
  seanceId: number (required)
  installationId: number (required)
  statut: 'propose' | 'demande' | 'accepte' | 'refuse'
  periodeId: number
  dates: string[] (format YYYY-MM-DD)
}
```

### Transport
```javascript
{
  id: number
  seanceId: number (required)
  jour: string
  dates: string[]
  lieuId: number
  classeId: number
  enseignantId: number
  departEtablissement: string
  retourInstallation: string
  effectif: number (>= 0)
  nbRotations: number (>= 1)
}
```

### Config
```javascript
{
  cle: string (required)
  valeur: string (required)
}
```

## Modes de validation

### Mode strict (strict: true)
- Rejette l'import si des erreurs de validation sont détectées
- Lève une exception Error
- Idéal pour les tests et l'automatisation

### Mode lenient (strict: false, défaut)
- Affiche un avertissement mais continue l'import
- Les données partiellement invalides sont chargées
- Idéal pour l'interface utilisateur

### Mode validation uniquement (validateOnly: true)
- Valide sans importer
- Retourne le résultat de validation
- Utile pour les prévisualisation avant import

## Rapport d'erreurs

### Structure de result

```javascript
{
  valid: boolean,
  issues: Array<{
    table: string,
    rowIndex?: number,
    field?: string,
    error: string
  }>,
  stats: {
    totalTables: number,
    validTables: number,
    totalRows: number,
    totalErrors: number
  }
}
```

### Formatage pour affichage utilisateur

```javascript
import { formatValidationErrors, formatErrorReport } from './import/schema-validator.js';

const validation = validateExport(data);
console.log(formatValidationErrors(validation));   // Résumé court
console.log(formatErrorReport(validation));        // Rapport détaillé
```

## Exemples

### Exemple 1 : Import simple

```javascript
const file = document.getElementById('file-input').files[0];
const result = await importProjectFile(file);

if (result.success) {
  location.reload();  // Recharger l'app
} else {
  alert('Erreur : ' + result.message);
}
```

### Exemple 2 : Validation avant import

```javascript
const validation = validateExport(data);

if (!validation.valid) {
  alert(`⚠️ ${validation.stats.totalErrors} erreur(s) détectée(s)`);
  
  if (!window.confirm('Continuer quand même ?')) {
    return;
  }
}

await importProjectFile(file);
```

### Exemple 3 : Ajouter un schéma personnalisé

```javascript
import { validateObject, getSchemas } from './import/schema-validator.js';

const schemas = getSchemas();
schemas.customTable = {
  id: { type: 'number' },
  nom: { type: 'string', required: true },
  custom: { type: 'boolean' }
};

const result = validateObject(obj, 'customTable', schemas);
```

## Maintenance

- Les schémas sont définis dans `schema-validator.js`
- Pour ajouter une nouvelle table : ajouter une clé dans `SCHEMAS`
- Pour modifier une contrainte : éditer la définition du schéma
- Exécuter les tests : `node src/import/__tests__/schema-validator.test.js`

## Notes

- La validation est **non-bloquante** par défaut (mode lenient)
- Les champs non-indexés (non documentés dans le schéma) sont acceptés
- Les tables inconnues sont ignorées
- Les dates vides/nulles sont acceptées pour les champs optionnels
- Les enums sont case-sensitive
