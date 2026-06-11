/**
 * Utilitaires d'import avec gestion robuste des erreurs
 */
import { importAllData } from '../db/store.js';
import { validateExport, formatValidationErrors } from './schema-validator.js';

/**
 * Charge et importe un fichier JSON de projet
 * @param {File} file - Fichier à importer
 * @param {Object} options - { strict: boolean, onValidationWarning?: Function }
 * @returns {Promise<{success: boolean, message: string, details?: Object}>}
 */
export async function importProjectFile(file, options = {}) {
  const { strict = false, onValidationWarning } = options;

  try {
    // Lire le fichier
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return {
        success: false,
        message: `Le fichier n'est pas un JSON valide : ${e.message}`,
      };
    }

    // Vérification basique : c'est bien un export EDT EPS
    if (!data.enseignants && !data.classes && !data.config && !data.seances) {
      return {
        success: false,
        message: 'Ce fichier ne semble pas être un projet EDT EPS valide (tables attendues manquantes)',
      };
    }

    // Valider le schéma
    const validation = validateExport(data);
    if (!validation.valid) {
      const warningMsg = formatValidationErrors(validation);
      console.warn('Validation warnings:', warningMsg);

      if (onValidationWarning) {
        const shouldContinue = onValidationWarning(validation);
        if (!shouldContinue) {
          return {
            success: false,
            message: 'Import annulé par l\'utilisateur (erreurs de validation)',
            validation,
          };
        }
      } else if (strict) {
        return {
          success: false,
          message: `Erreurs de validation détectées :\n${warningMsg}`,
          validation,
        };
      }
    }

    // Importer les données
    await importAllData(data, { strict: false });

    return {
      success: true,
      message: `Projet importé avec succès (${validation.stats.totalRows} entrées)`,
      validation,
    };
  } catch (err) {
    return {
      success: false,
      message: `Erreur lors du chargement du projet : ${err.message}`,
    };
  }
}

/**
 * Valide un fichier sans l'importer
 * @param {File} file - Fichier à valider
 * @returns {Promise<{valid: boolean, message: string, validation?: Object}>}
 */
export async function validateProjectFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    const validation = validateExport(data);
    const message = formatValidationErrors(validation);

    return {
      valid: validation.valid,
      message,
      validation,
    };
  } catch (err) {
    return {
      valid: false,
      message: `Erreur lors de la lecture du fichier : ${err.message}`,
    };
  }
}

/**
 * Formate un rapport détaillé des erreurs pour affichage utilisateur
 */
export function formatErrorReport(validation) {
  const lines = [];
  lines.push('=== Rapport de Validation ===');
  lines.push('');

  if (validation.valid) {
    lines.push('✓ Le fichier est valide');
    lines.push(`  • Tables : ${validation.stats.totalTables}`);
    lines.push(`  • Entrées : ${validation.stats.totalRows}`);
  } else {
    lines.push('✗ Erreurs détectées :');
    lines.push('');

    // Grouper par table
    const byTable = new Map();
    for (const issue of validation.issues) {
      if (!byTable.has(issue.table)) {
        byTable.set(issue.table, []);
      }
      byTable.get(issue.table).push(issue);
    }

    let totalDisplayed = 0;
    for (const [table, tableIssues] of byTable) {
      lines.push(`  📋 ${table}`);
      for (const issue of tableIssues.slice(0, 2)) {
        const loc = issue.rowIndex !== undefined ? ` [ligne ${issue.rowIndex}]` : '';
        const field = issue.field ? `${issue.field}` : '';
        lines.push(`     ✗ ${field}${loc}: ${issue.error}`);
        totalDisplayed++;
      }
      if (tableIssues.length > 2) {
        const remaining = tableIssues.length - 2;
        lines.push(`     … et ${remaining} autre(s) erreur(s)`);
      }
      lines.push('');
    }

    lines.push(`Résumé : ${validation.stats.totalErrors} erreur(s) au total`);
  }

  return lines.join('\n');
}

/**
 * Crée un dialogue de confirmation pour import avec validation
 * Retourne true si l'utilisateur confirme
 */
export function createImportConfirmDialog(validation, filename) {
  const stats = validation.stats;
  let msg = `Charger le projet depuis "${filename}" ?\n\n`;
  msg += `📊 Données : ${stats.totalTables} table(s), ${stats.totalRows} entrée(s)\n\n`;

  if (!validation.valid) {
    msg += `⚠️  ${validation.stats.totalErrors} erreur(s) de validation détectée(s)\n`;
    msg += '➜ L\'import continuera mais certaines données pourraient être incomplètes.\n\n';
  }

  msg += 'Cela remplacera TOUTES les données actuelles.';

  return window.confirm(msg);
}
