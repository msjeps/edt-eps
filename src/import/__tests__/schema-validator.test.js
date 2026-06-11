/**
 * Tests du validateur de schéma JSON
 * À exécuter avec : npm test  (ou node src/import/__tests__/schema-validator.test.js)
 */

import { validateObject, validateTable, validateExport, formatValidationErrors } from '../schema-validator.js';

let passed = 0;
let failed = 0;

/**
 * Vérifie une condition et journalise le résultat.
 * @param {string} label - Description du test
 * @param {boolean} condition - Doit être vrai pour passer
 */
function check(label, condition) {
  if (condition) {
    passed++;
    console.log(`✓ PASS  ${label}`);
  } else {
    failed++;
    console.log(`✗ FAIL  ${label}`);
  }
}

console.log('🧪 Tests du validateur de schéma\n');

// Test 1 : Objet valide
check('Objet enseignant valide',
  validateObject({ id: 1, nom: 'Dupont', prenom: 'Jean', ors: false, maxHeuresJour: 6 }, 'enseignants').valid === true);

// Test 2 : Objet avec champ obligatoire manquant
check('Objet sans nom (requis) rejeté',
  validateObject({ id: 1, prenom: 'Jean' }, 'enseignants').valid === false);

// Test 3 : Objet avec mauvais type
check('Type invalide pour maxHeuresJour rejeté',
  validateObject({ id: 1, nom: 'Dupont', maxHeuresJour: 'six' }, 'enseignants').valid === false);

// Test 4 : Énumération invalide
check('Type de lieu hors énumération rejeté',
  validateObject({ id: 1, nom: 'Piscine', type: 'aquatique' }, 'lieux').valid === false);

// Test 5 : Période valide
check('Période valide acceptée',
  validateObject({ id: 1, nom: 'Trimestre 1', type: 'trimestre', dateDebut: '2025-09-01', dateFin: '2025-12-15' }, 'periodes').valid === true);

// Test 6 : Date invalide
check('Date au mauvais format (YYYY/MM/DD) rejetée',
  validateObject({ id: 1, nom: 'Trimestre 1', type: 'trimestre', dateDebut: '2025/09/01' }, 'periodes').valid === false);

// Test 7 : Table avec plusieurs lignes valides
const tableSeances = [
  { id: 1, classeId: 10, enseignantId: 2, activiteId: 5, installationId: 3, jour: 'lundi', heureDebut: '08:00', heureFin: '10:00', periodeId: 1 },
  { id: 2, classeId: 10, enseignantId: 2, activiteId: 6, installationId: 4, jour: 'mardi', heureDebut: '10:00', heureFin: '12:00', periodeId: 1 },
];
check('Table de séances valide',
  validateTable('seances', tableSeances).valid === true);

// Test 8 : Export complet valide + stats
const result8 = validateExport({
  _meta: { version: 2, exportDate: new Date().toISOString(), appVersion: '1.0.0' },
  config: [{ cle: 'etablissementNom', valeur: 'Collège Test' }],
  enseignants: [{ id: 1, nom: 'Dupont', ors: false }],
  classes: [{ id: 1, nom: '6e A', niveau: '6e', effectif: 25 }],
  seances: [],
  activites: [],
  lieux: [],
  installations: [],
});
check('Export complet valide', result8.valid === true);
check('Stats export correctes (tables/lignes)',
  result8.stats.totalTables > 0 && result8.stats.totalErrors === 0);

// Test 9 : Export invalide + formatage
const result9 = validateExport({
  _meta: { version: 2 },
  enseignants: [
    { id: 1 },                                  // nom manquant
    { id: 2, nom: 'Test', maxHeuresJour: 'invalid' }, // type invalide
  ],
});
check('Export invalide détecté', result9.valid === false);
check('Deux erreurs comptées', result9.stats.totalErrors === 2);
const formatted = formatValidationErrors(result9);
check('Rapport d\'erreurs non vide', typeof formatted === 'string' && formatted.length > 0);

// Résumé
console.log('\n=== Résumé ===');
console.log(`${passed} réussi(s), ${failed} échec(s)`);
if (failed > 0) {
  console.error('❌ Des tests ont échoué');
  process.exit(1);
}
console.log('✅ Tous les tests passent');
