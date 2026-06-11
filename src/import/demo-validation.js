/**
 * Démo de validation de schéma
 * À utiliser pour tester le validateur dans la console du navigateur
 */

export async function demoValidation() {
  const { validateExport, formatValidationErrors } = await import('./schema-validator.js');

  console.log('%c=== Démo Validation de Schéma ===', 'font-size: 16px; font-weight: bold; color: #0066cc;');

  // Exemple 1 : Données valides
  console.log('\n%c1️⃣ Export valide', 'font-size: 14px; font-weight: bold;');
  const validExport = {
    _meta: {
      version: 2,
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0',
    },
    config: [
      { cle: 'etablissementNom', valeur: 'Collège Test' },
      { cle: 'etablissementType', valeur: 'college' },
    ],
    enseignants: [
      { id: 1, nom: 'Dupont', prenom: 'Jean', ors: false, maxHeuresJour: 6 },
      { id: 2, nom: 'Martin', prenom: 'Marie', ors: true, maxHeuresJour: 4 },
    ],
    classes: [
      { id: 1, nom: '6e A', niveau: '6e', effectif: 25 },
      { id: 2, nom: '6e B', niveau: '6e', effectif: 24 },
    ],
    periodes: [
      { id: 1, nom: 'Trimestre 1', type: 'trimestre', dateDebut: '2025-09-01', dateFin: '2025-12-15' },
    ],
    seances: [],
    activites: [],
    lieux: [],
    installations: [],
    zones: [],
  };

  const result1 = validateExport(validExport);
  console.log('✓ Résultat:', result1.valid);
  console.log('  Tables:', result1.stats.totalTables);
  console.log('  Entrées:', result1.stats.totalRows);
  console.log('  Erreurs:', result1.stats.totalErrors);

  // Exemple 2 : Données avec erreurs
  console.log('\n%c2️⃣ Export avec erreurs', 'font-size: 14px; font-weight: bold;');
  const invalidExport = {
    _meta: { version: 2 },
    enseignants: [
      { id: 1, nom: 'Dupont' },  // OK
      { id: 2 },  // ✗ nom manquant
      { id: 3, nom: 'Test', maxHeuresJour: 'invalide' },  // ✗ type incorrect
    ],
    classes: [
      { id: 1, nom: '6e A' },  // OK
      { id: 2, niveau: '5e' },  // ✗ nom manquant
    ],
    periodes: [
      { id: 1, nom: 'T1', type: 'trimestre', dateDebut: '2025-13-45' },  // ✗ date invalide
    ],
  };

  const result2 = validateExport(invalidExport);
  console.log('✓ Résultat:', result2.valid ? 'VALIDE' : 'INVALIDE');
  console.log('  Erreurs trouvées:', result2.stats.totalErrors);
  console.log('\n' + formatValidationErrors(result2));

  // Exemple 3 : Énumérations
  console.log('\n%c3️⃣ Validation des énumérations', 'font-size: 14px; font-weight: bold;');
  const enumExport = {
    lieux: [
      { id: 1, nom: 'Piscine', type: 'intra' },  // OK
      { id: 2, nom: 'Parc', type: 'extra' },  // OK
      { id: 3, nom: 'Gymnase', type: 'aquatique' },  // ✗ invalide
    ],
    activites: [
      { id: 1, nom: 'Natation', champApprentissage: 'CA1' },  // OK
      { id: 2, nom: 'Football', champApprentissage: 'CA5' },  // ✗ invalide
    ],
  };

  const result3 = validateExport(enumExport);
  console.log('✓ Résultat:', result3.valid ? 'VALIDE' : 'INVALIDE');
  if (!result3.valid) {
    console.log('Erreurs:');
    for (const issue of result3.issues) {
      console.log(`  - ${issue.table}[${issue.rowIndex}] ${issue.field}: ${issue.error}`);
    }
  }

  // Exemple 4 : Limites numériques
  console.log('\n%c4️⃣ Validation des limites', 'font-size: 14px; font-weight: bold;');
  const limitExport = {
    enseignants: [
      { id: 1, nom: 'Test1', maxHeuresJour: 6 },  // OK
      { id: 2, nom: 'Test2', maxHeuresJour: 25 },  // ✗ > 24
      { id: 3, nom: 'Test3', maxHeuresJour: -1 },  // ✗ < 0
    ],
  };

  const result4 = validateExport(limitExport);
  console.log('✓ Résultat:', result4.valid ? 'VALIDE' : 'INVALIDE');
  if (!result4.valid) {
    console.log('Erreurs:', result4.stats.totalErrors);
  }

  // Afficher les résultats
  console.log('\n%c=== Fin de la démo ===', 'font-size: 14px; color: #666;');
  console.log('Pour tester avec vos propres données, utilisez:');
  console.log('  import { validateExport } from "./src/import/schema-validator.js";');
  console.log('  const result = validateExport(vosData);');

  return { result1, result2, result3, result4 };
}

// Export pour utilisation en navigateur
if (typeof window !== 'undefined') {
  window.demoValidation = demoValidation;
  console.log('💡 Astuce : exécutez demoValidation() dans la console pour voir la démo');
}
