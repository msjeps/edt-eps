# Validation de Schéma pour Imports JSON

Date : 11 juin 2026 — Status : ✅ Implémenté et intégré

Le système de validation de schéma vérifie l'intégrité des fichiers JSON importés
avant de les charger dans IndexedDB. Il garantit que :

- ✅ Tous les champs obligatoires sont présents
- ✅ Les types de données sont corrects (string, number, boolean, array, object)
- ✅ Les énumérations respectent les valeurs autorisées
- ✅ Les formats de date (`YYYY-MM-DD`, ISO 8601) et d'heure (`HH:MM`) sont valides
- ✅ Les limites numériques (min/max) sont respectées

Validation **non-bloquante par défaut** (mode lenient) : un import continue malgré
des avertissements, l'utilisateur en est informé dans le dialogue de confirmation.

---

## Architecture et fichiers

```
src/import/
├── schema-validator.js          # Moteur de validation + schémas (25+ tables)
├── import-utils.js              # Utilitaires d'import avec UI
├── demo-validation.js           # Démo interactive console
└── __tests__/
    └── schema-validator.test.js # Tests unitaires (npm test)
```

| Fichier | Rôle |
|---------|------|
| `schema-validator.js` | Moteur : `validateValue` / `validateObject` / `validateTable` / `validateExport` / `formatValidationErrors`. Schémas pour 25+ tables. |
| `import-utils.js` | `importProjectFile` (lit + valide + importe), `validateProjectFile` (valide sans importer), `formatErrorReport`, `createImportConfirmDialog`. |
| `demo-validation.js` | `demoValidation()` à appeler dans la console pour voir le validateur en action. |

### Intégrations

- **`src/db/store.js`** — `importAllData(data, options)` valide le schéma via
  `validateExport()`. Options : `strict` (rejette si erreurs), `validateOnly`
  (valide sans écrire).
- **`src/app.js`** — chargement du fichier projet. Le flux **valide d'abord sans
  rien écrire**, demande confirmation, **puis importe une seule fois** :

  ```javascript
  // 1. Valider sans toucher aux données actuelles
  const check = await validateProjectFile(file);
  if (check.validation === undefined) { /* JSON illisible */ return; }

  // 2. Confirmer (avec statistiques du fichier)
  if (!createImportConfirmDialog(check.validation, file.name)) return;

  // 3. Importer une seule fois, après confirmation
  const result = await importProjectFile(file);
  ```

  > Ce séquencement est important : importer avant la confirmation écraserait les
  > données actuelles même si l'utilisateur annule (perte de données).

---

## Usage

### Valider un export complet

```javascript
import { validateExport, formatValidationErrors } from './import/schema-validator.js';

const result = validateExport(JSON.parse(jsonString));
if (!result.valid) {
  console.warn(formatValidationErrors(result));  // result.issues = détails
}
```

### Valider une table ou un objet

```javascript
import { validateTable, validateObject } from './import/schema-validator.js';

validateTable('seances', seancesArray);              // result.errors par ligne
validateObject({ id: 1, nom: 'Dupont' }, 'enseignants');
```

### Importer avec validation

```javascript
import { importProjectFile } from './import/import-utils.js';

const result = await importProjectFile(file, {
  strict: false,  // false = continuer malgré les erreurs (lenient)
  onValidationWarning: (validation) =>
    window.confirm('Continuer malgré les avertissements ?'),
});

if (result.success) console.log('Import réussi');
else console.error(result.message);
```

### Modes de validation

| Mode | Comportement |
|------|--------------|
| **Lenient** (`strict: false`, défaut) | Avertit en console mais charge les données. Idéal UI. |
| **Strict** (`strict: true`) | Rejette l'import (exception) si erreurs. Idéal tests/automatisation. |
| **Validation seule** (`validateOnly: true`) | Retourne le rapport sans importer. Prévisualisation. |

---

## Structure du résultat

```javascript
{
  valid: boolean,
  issues: Array<{ table: string, rowIndex?: number, field?: string, error: string }>,
  stats: { totalTables, validTables, totalRows, totalErrors }
}
```

`formatValidationErrors(result)` → résumé court. `formatErrorReport(result)` → rapport détaillé.

### Exemple de rapport

```
✗ Export invalide : 3 erreur(s) détectée(s)

  📋 enseignants : 2 erreur(s)
     • nom [1]: Valeur requise
     • maxHeuresJour [2]: Type invalide : attendu number, reçu string

  📋 lieux : 1 erreur(s)
     • type [0]: Valeur invalide : aquatique ∉ {intra, extra}

Résumé : 3 table(s), 15 ligne(s), 3 erreur(s)
```

---

## Définition des schémas

Types supportés : `string`, `number`, `boolean`, `array` (avec `items`), `object`.
Contraintes : `required`, `enum`, `min`, `max`, `format` (`date` = `YYYY-MM-DD`,
`date-time` = ISO 8601). Les énumérations sont **sensibles à la casse**.

```javascript
nom:        { type: 'string', required: true }
type:       { type: 'string', enum: ['college', 'lycee', 'mixte'] }
effectif:   { type: 'number', min: 0 }
maxHeures:  { type: 'number', min: 0, max: 24 }
dateDebut:  { type: 'string', format: 'date' }        // YYYY-MM-DD
groupes:    { type: 'array', items: { type: 'string' } }
```

### Tables principales (champs requis en **gras**)

| Table | Champs notables |
|-------|-----------------|
| **etablissement** | **nom**, type `college\|lycee\|mixte`, joursOuvres[], tempsTrajetDefautMin ≥ 0, previsionsTransport |
| **enseignant** | **nom**, prenom, initiales, ors (bool), maxHeuresJour 0–24, indisponibilites[], preferences[], contraintesHard[] |
| **classe** | **nom**, niveau, effectif ≥ 0, enseignantId, groupes[] |
| **activite** | **nom**, champApprentissage `CA1..CA4`, code, niveaux[], exigenceInstallation, periodes[], duree ≥ 0, heuresHebdo ≥ 0, dureeSlot ≥ 0 |
| **periode** | **nom**, type `trimestre\|semestre\|custom`, dateDebut/dateFin (`YYYY-MM-DD`), parentId, niveau, ordre |
| **seance** | **classeId, enseignantId, activiteId, installationId, jour, heureDebut, heureFin, periodeId**, zoneId, verrouille, notes |
| **lieu** | **nom**, type `intra\|extra`, adresse, necessiteBus, tempsTrajet ≥ 0, couleur |
| **installation** | **lieuId, nom**, capaciteSimultanee ≥ 1, activitesCompatibles[], indisponibilites[] |
| **zone** | **installationId, nom**, description |
| **reservation** | **seanceId, installationId**, statut `propose\|demande\|accepte\|refuse`, periodeId, dates[] |
| **transport** | **seanceId**, jour, dates[], lieuId, classeId, enseignantId, departEtablissement, retourInstallation, effectif ≥ 0, nbRotations ≥ 1 |
| **config** | **cle, valeur** |

Tables également couvertes : créneaux, créneaux-classes, programmations,
indisponibilités, snapshots, changelog, modèles-niveaux.

---

## Tests et démo

```bash
npm test          # ou : node src/import/__tests__/schema-validator.test.js
```

La suite (auto-vérifiante, `exit 1` en cas d'échec) couvre : objets valides/invalides,
champs requis manquants, types, énumérations, formats de date, tables et exports
complets, formatage des rapports.

Démo interactive dans la console navigateur : `demoValidation()` (export valide,
export avec erreurs, énumérations, limites min/max).

---

## Compatibilité et performance

- **Rétrocompatible** : accepte les exports sans `_meta`, ignore les tables inconnues,
  tolère les champs additionnels et les valeurs nulles pour les champs optionnels.
- **Performance** : < 50 ms pour valider un export complet, impact bundle négligeable
  (~15 KB gzippé), aucune dépendance externe.

## Maintenance

1. Ajouter/modifier un schéma dans l'objet `SCHEMAS` de `schema-validator.js`.
2. Ajouter un cas dans `__tests__/schema-validator.test.js` puis `npm test`.
3. Mettre à jour ce document.

### Pistes d'extension

- Validations conditionnelles (ex. `type=extra` → `lieuId` requis)
- Validateurs métier (cohérence dates/périodes)
- Suggestions de correction automatiques
