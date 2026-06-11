/**
 * Validation de schéma pour les imports JSON
 * Définie les structures attendues pour chaque entité et valide les données importées
 */

/**
 * Schémas de validation pour chaque table
 * Structure : { type, required?, enum?, min?, max?, items? }
 */
const SCHEMAS = {
  _meta: {
    version: { type: 'number' },
    exportDate: { type: 'string' },
    appVersion: { type: 'string' },
  },
  config: {
    cle: { type: 'string', required: true },
    valeur: { type: 'string', required: true },
  },
  etablissement: {
    id: { type: 'number' },
    nom: { type: 'string', required: true },
    type: { type: 'string', enum: ['college', 'lycee', 'mixte'] },
    joursOuvres: { type: 'array', items: { type: 'string' } },
    tempsTrajetDefautMin: { type: 'number', min: 0 },
    previsionsTransport: { type: 'object' },
  },
  periodes: {
    id: { type: 'number' },
    nom: { type: 'string', required: true },
    type: { type: 'string', enum: ['trimestre', 'semestre', 'custom'] },
    dateDebut: { type: 'string', format: 'date' },
    dateFin: { type: 'string', format: 'date' },
    parentId: { type: 'number' },
    niveau: { type: 'string' },
    ordre: { type: 'number' },
  },
  enseignants: {
    id: { type: 'number' },
    nom: { type: 'string', required: true },
    prenom: { type: 'string' },
    initiales: { type: 'string' },
    ors: { type: 'boolean' },
    maxHeuresJour: { type: 'number', min: 0, max: 24 },
    indisponibilites: { type: 'array' },
    preferences: { type: 'array' },
    contraintesHard: { type: 'array' },
  },
  classes: {
    id: { type: 'number' },
    nom: { type: 'string', required: true },
    niveau: { type: 'string' },
    effectif: { type: 'number', min: 0 },
    enseignantId: { type: 'number' },
    groupes: { type: 'array' },
  },
  activites: {
    id: { type: 'number' },
    nom: { type: 'string', required: true },
    champApprentissage: { type: 'string', enum: ['CA1', 'CA2', 'CA3', 'CA4'] },
    code: { type: 'string' },
    niveaux: { type: 'array', items: { type: 'string' } },
    exigenceInstallation: { type: 'string' },
    periodes: { type: 'array' },
    duree: { type: 'number', min: 0 },
    heuresHebdo: { type: 'number', min: 0 },
    dureeSlot: { type: 'number', min: 0 },
  },
  lieux: {
    id: { type: 'number' },
    nom: { type: 'string', required: true },
    type: { type: 'string', enum: ['intra', 'extra'] },
    adresse: { type: 'string' },
    necessiteBus: { type: 'boolean' },
    tempsTrajet: { type: 'number', min: 0 },
    couleur: { type: 'string' },
  },
  installations: {
    id: { type: 'number' },
    lieuId: { type: 'number', required: true },
    nom: { type: 'string', required: true },
    capaciteSimultanee: { type: 'number', min: 1 },
    activitesCompatibles: { type: 'array', items: { type: 'number' } },
    indisponibilites: { type: 'array' },
  },
  zones: {
    id: { type: 'number' },
    installationId: { type: 'number', required: true },
    nom: { type: 'string', required: true },
    description: { type: 'string' },
  },
  creneaux: {
    id: { type: 'number' },
    jour: { type: 'string', required: true },
    heureDebut: { type: 'string', required: true },
    heureFin: { type: 'string', required: true },
    label: { type: 'string' },
    ordre: { type: 'number' },
  },
  creneauxClasses: {
    id: { type: 'number' },
    classeId: { type: 'number', required: true },
    enseignantId: { type: 'number' },
    jour: { type: 'string', required: true },
    heureDebut: { type: 'string', required: true },
    heureFin: { type: 'string', required: true },
  },
  programmations: {
    id: { type: 'number' },
    classeId: { type: 'number', required: true },
    activiteId: { type: 'number', required: true },
    periodeId: { type: 'number', required: true },
    installationId: { type: 'number' },
    zoneId: { type: 'number' },
    creneauClasseId: { type: 'number' },
    statut: { type: 'string', enum: ['propose', 'accepte', 'a_reconsiderer'] },
  },
  seances: {
    id: { type: 'number' },
    classeId: { type: 'number', required: true },
    enseignantId: { type: 'number', required: true },
    activiteId: { type: 'number', required: true },
    installationId: { type: 'number', required: true },
    zoneId: { type: 'number' },
    jour: { type: 'string', required: true },
    heureDebut: { type: 'string', required: true },
    heureFin: { type: 'string', required: true },
    periodeId: { type: 'number', required: true },
    verrouille: { type: 'boolean' },
    notes: { type: 'string' },
  },
  reservations: {
    id: { type: 'number' },
    seanceId: { type: 'number', required: true },
    installationId: { type: 'number', required: true },
    statut: { type: 'string', enum: ['propose', 'demande', 'accepte', 'refuse'] },
    periodeId: { type: 'number' },
    dates: { type: 'array', items: { type: 'string', format: 'date' } },
  },
  transports: {
    id: { type: 'number' },
    seanceId: { type: 'number', required: true },
    jour: { type: 'string' },
    dates: { type: 'array', items: { type: 'string', format: 'date' } },
    lieuId: { type: 'number' },
    classeId: { type: 'number' },
    enseignantId: { type: 'number' },
    departEtablissement: { type: 'string' },
    retourInstallation: { type: 'string' },
    effectif: { type: 'number', min: 0 },
    nbRotations: { type: 'number', min: 1 },
  },
  indisponibilites: {
    id: { type: 'number' },
    type: { type: 'string', enum: ['enseignant', 'installation', 'transport'] },
    refId: { type: 'number', required: true },
    jour: { type: 'string' },
    heureDebut: { type: 'string' },
    heureFin: { type: 'string' },
    periodeId: { type: 'number' },
    motif: { type: 'string' },
    dateDebut: { type: 'string', format: 'date' },
    dateFin: { type: 'string', format: 'date' },
    source: { type: 'string' },
  },
  preferences: {
    id: { type: 'number' },
    enseignantId: { type: 'number', required: true },
    type: { type: 'string' },
    valeur: { type: ['string', 'number', 'boolean'] },
    poids: { type: 'number' },
  },
  contraintes: {
    id: { type: 'number' },
    nom: { type: 'string', required: true },
    type: { type: 'string' },
    niveau: { type: 'string' },
    params: { type: 'object' },
    actif: { type: 'boolean' },
  },
  snapshots: {
    id: { type: 'number' },
    nom: { type: 'string', required: true },
    date: { type: 'string', format: 'date-time' },
    description: { type: 'string' },
    data: { type: 'object', required: true },
  },
  changelog: {
    id: { type: 'number' },
    date: { type: 'string', format: 'date-time' },
    action: { type: 'string' },
    entite: { type: 'string' },
    entiteId: { type: 'number' },
    details: { type: 'string' },
  },
  modelesNiveau: {
    id: { type: 'number' },
    niveau: { type: 'string', required: true },
    nom: { type: 'string', required: true },
  },
};

/**
 * Valide une valeur contre un schéma de propriété
 * @returns { valid: boolean, error?: string }
 */
function validateValue(value, schema) {
  if (value === null || value === undefined) {
    if (schema.required) {
      return { valid: false, error: 'Valeur requise' };
    }
    return { valid: true };
  }

  // Vérifier le type
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (!expectedTypes.includes(actualType)) {
    return { valid: false, error: `Type invalide : attendu ${expectedTypes.join('|')}, reçu ${actualType}` };
  }

  // Vérifier les énumérations
  if (schema.enum && !schema.enum.includes(value)) {
    return { valid: false, error: `Valeur invalide : ${value} ∉ {${schema.enum.join(', ')}}` };
  }

  // Vérifier les limites numériques
  if (schema.min !== undefined && value < schema.min) {
    return { valid: false, error: `Valeur trop petite : ${value} < ${schema.min}` };
  }
  if (schema.max !== undefined && value > schema.max) {
    return { valid: false, error: `Valeur trop grande : ${value} > ${schema.max}` };
  }

  // Vérifier le format (date, date-time)
  if (schema.format === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { valid: false, error: `Format date invalide : ${value} (attendu YYYY-MM-DD)` };
    }
    if (isNaN(Date.parse(value))) {
      return { valid: false, error: `Date invalide : ${value}` };
    }
  }
  if (schema.format === 'date-time') {
    if (isNaN(Date.parse(value))) {
      return { valid: false, error: `Date-heure invalide : ${value}` };
    }
  }

  // Vérifier les éléments du tableau
  if (actualType === 'array' && schema.items) {
    for (let i = 0; i < value.length; i++) {
      const itemResult = validateValue(value[i], schema.items);
      if (!itemResult.valid) {
        return { valid: false, error: `Élément ${i} : ${itemResult.error}` };
      }
    }
  }

  return { valid: true };
}

/**
 * Valide un objet (document) contre un schéma de table
 * @returns { valid: boolean, errors: Array<{field, error}> }
 */
export function validateObject(obj, tableName, schemas = SCHEMAS) {
  const schema = schemas[tableName];
  if (!schema) {
    return { valid: true, errors: [] }; // Table inconnue : accept
  }

  const errors = [];

  for (const [field, fieldSchema] of Object.entries(schema)) {
    const result = validateValue(obj[field], fieldSchema);
    if (!result.valid) {
      errors.push({ field, error: result.error });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valide une table entière (tableau d'objets)
 * @returns { valid: boolean, errors: Array<{rowIndex, field, error}>, skipCount: number }
 */
export function validateTable(tableName, data, schemas = SCHEMAS) {
  if (!Array.isArray(data)) {
    return {
      valid: false,
      errors: [{ error: 'Attendu un tableau' }],
      skipCount: 0,
    };
  }

  const errors = [];
  let skipCount = 0;

  for (let i = 0; i < data.length; i++) {
    const result = validateObject(data[i], tableName, schemas);
    for (const err of result.errors) {
      errors.push({ rowIndex: i, field: err.field, error: err.error });
    }
    if (!result.valid) {
      skipCount++;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    skipCount,
  };
}

/**
 * Valide l'export complet (toutes les tables)
 * @param {Object} data - Export JSON
 * @param {Object} schemas - Schémas de validation
 * @returns { valid: boolean, issues: Array<{table, rowIndex?, field?, error}>, stats: Object }
 */
export function validateExport(data, schemas = SCHEMAS) {
  const issues = [];
  const stats = {
    totalTables: 0,
    validTables: 0,
    totalRows: 0,
    totalErrors: 0,
  };

  for (const [tableName, tableData] of Object.entries(data)) {
    if (tableName === '_meta') continue;
    if (!Array.isArray(tableData)) continue;

    stats.totalTables++;
    stats.totalRows += tableData.length;

    const result = validateTable(tableName, tableData, schemas);

    if (result.valid) {
      stats.validTables++;
    } else {
      stats.totalErrors += result.errors.length;
      for (const err of result.errors) {
        issues.push({
          table: tableName,
          rowIndex: err.rowIndex,
          field: err.field,
          error: err.error,
        });
      }
    }
  }

  return {
    valid: stats.totalErrors === 0,
    issues,
    stats,
  };
}

/**
 * Retourne un résumé lisible des erreurs de validation
 */
export function formatValidationErrors(result) {
  const lines = [];

  if (result.valid) {
    lines.push('✓ Export valide');
  } else {
    lines.push(`✗ Export invalide : ${result.stats.totalErrors} erreur(s) détectée(s)`);
    lines.push('');

    // Grouper par table
    const byTable = new Map();
    for (const issue of result.issues) {
      if (!byTable.has(issue.table)) {
        byTable.set(issue.table, []);
      }
      byTable.get(issue.table).push(issue);
    }

    for (const [table, tableIssues] of byTable) {
      lines.push(`  📋 ${table} : ${tableIssues.length} erreur(s)`);
      for (const issue of tableIssues.slice(0, 3)) {
        const loc = issue.rowIndex !== undefined ? `[${issue.rowIndex}]` : '';
        lines.push(`     • ${issue.field || ''} ${loc}: ${issue.error}`);
      }
      if (tableIssues.length > 3) {
        lines.push(`     … et ${tableIssues.length - 3} autre(s)`);
      }
    }
  }

  lines.push('');
  lines.push(`Résumé : ${result.stats.totalTables} table(s), ${result.stats.totalRows} ligne(s), ${result.stats.totalErrors} erreur(s)`);

  return lines.join('\n');
}

/**
 * Export du schéma pour utilisation dans d'autres modules
 */
export function getSchemas() {
  return SCHEMAS;
}
