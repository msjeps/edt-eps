/**
 * CRUD opérations centralisées pour la base IndexedDB
 * Chaque entité a : getAll, getById, add, update, remove
 */
import db from './schema.js';

// === Helpers génériques ===

function createStore(tableName) {
  return {
    async getAll() {
      return db[tableName].toArray();
    },

    async getById(id) {
      return db[tableName].get(id);
    },

    async add(item) {
      const id = await db[tableName].add(item);
      await logChange('add', tableName, id, item);
      return id;
    },

    async bulkAdd(items) {
      const ids = await db[tableName].bulkAdd(items, { allKeys: true });
      return ids;
    },

    async update(id, changes) {
      await db[tableName].update(id, changes);
      await logChange('update', tableName, id, changes);
    },

    async put(item) {
      const id = await db[tableName].put(item);
      await logChange('put', tableName, id, item);
      return id;
    },

    async remove(id) {
      await db[tableName].delete(id);
      await logChange('delete', tableName, id);
    },

    async clear() {
      await db[tableName].clear();
    },

    async count() {
      return db[tableName].count();
    },

    async where(index, value) {
      return db[tableName].where(index).equals(value).toArray();
    },
  };
}

// === Journal de modifications ===

async function logChange(action, entite, entiteId, details = null) {
  try {
    await db.changelog.add({
      date: new Date().toISOString(),
      action,
      entite,
      entiteId,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (e) {
    // Ne pas bloquer les opérations si le log échoue
    console.warn('Changelog write failed:', e);
  }
}

// === Stores par entité ===

export const etablissementStore = createStore('etablissement');
export const periodeStore = createStore('periodes');
export const enseignantStore = createStore('enseignants');
export const classeStore = createStore('classes');
export const activiteStore = createStore('activites');
export const lieuStore = createStore('lieux');
export const installationStore = createStore('installations');
export const zoneStore = createStore('zones');
export const programmationStore = createStore('programmations');
export const seanceStore = createStore('seances');
export const reservationStore = createStore('reservations');
export const transportStore = createStore('transports');
export const indisponibiliteStore = createStore('indisponibilites');
export const preferenceStore = createStore('preferences');
export const contrainteStore = createStore('contraintes');
export const creneauStore = createStore('creneaux');
export const snapshotStore = createStore('snapshots');
export const changelogStore = createStore('changelog');
export const configStore = createStore('config');
export const creneauClasseStore = createStore('creneauxClasses');
export const modeleNiveauStore = createStore('modelesNiveau');

// === Requêtes métier ===

/**
 * Récupère toutes les séances d'une période donnée
 */
export async function getSeancesByPeriode(periodeId) {
  return db.seances.where('periodeId').equals(periodeId).toArray();
}

/**
 * Récupère les séances d'un enseignant pour un jour donné
 */
export async function getSeancesEnseignantJour(enseignantId, jour) {
  return db.seances
    .where('enseignantId').equals(enseignantId)
    .filter(s => s.jour === jour)
    .toArray();
}

/**
 * Récupère les séances d'une classe
 */
export async function getSeancesClasse(classeId) {
  return db.seances.where('classeId').equals(classeId).toArray();
}

/**
 * Récupère les séances sur une installation
 */
export async function getSeancesInstallation(installationId) {
  return db.seances.where('installationId').equals(installationId).toArray();
}

/**
 * Récupère les installations d'un lieu
 */
export async function getInstallationsLieu(lieuId) {
  return db.installations.where('lieuId').equals(lieuId).toArray();
}

/**
 * Récupère les indisponibilités d'une ressource
 */
export async function getIndisponibilites(type, refId) {
  return db.indisponibilites
    .where('type').equals(type)
    .filter(i => i.refId === refId)
    .toArray();
}

/**
 * Liste dynamique de toutes les tables exportables.
 * Détecte automatiquement les tables de la base (sauf changelog/snapshots).
 */
function getExportableTables() {
  return db.tables
    .map(t => t.name)
    .filter(name => name !== 'changelog' && name !== 'snapshots');
}

/**
 * Export complet de la base pour sauvegarde/snapshot.
 * Détecte automatiquement toutes les tables (y compris futures).
 * Inclut métadonnées de version pour compatibilité future.
 */
export async function exportAllData() {
  const data = {
    _meta: {
      version: 2,
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0',
    },
  };
  const tables = getExportableTables();
  for (const table of tables) {
    try {
      data[table] = await db[table].toArray();
    } catch (e) {
      console.warn(`Export table ${table} skipped:`, e);
      data[table] = [];
    }
  }
  return data;
}

/**
 * Import complet (remplace toutes les données).
 * Compatible avec les anciens exports (sans _meta) et les nouveaux.
 * Ignore les tables inconnues et gère les tables manquantes.
 */
export async function importAllData(data) {
  // Toutes les tables de la base actuelle
  const allTables = db.tables.map(t => t.name);
  // Tables de données à importer (exclure _meta et tables système)
  const tablesToImport = Object.keys(data).filter(
    key => key !== '_meta' && key !== 'changelog' && key !== 'snapshots' && allTables.includes(key)
  );

  // Construire la liste des tables Dexie pour la transaction
  const dexieTables = tablesToImport.map(name => db[name]);
  if (dexieTables.length === 0) {
    throw new Error('Aucune donnée valide trouvée dans le fichier');
  }

  await db.transaction('rw', ...dexieTables, async () => {
    for (const tableName of tablesToImport) {
      const rows = data[tableName];
      await db[tableName].clear();
      if (Array.isArray(rows) && rows.length > 0) {
        await db[tableName].bulkAdd(rows);
      }
    }
  });
}

// === Suppressions en cascade ===

/**
 * Supprime un enseignant et toutes ses données liées :
 * séances (+ leurs réservations/transports), transports directs,
 * préférences, indisponibilités. Désassocie les classes et créneaux-classes.
 * Retourne le nombre de séances supprimées.
 */
export async function cascadeDeleteEnseignant(enseignantId) {
  return db.transaction('rw',
    db.enseignants, db.seances, db.reservations, db.transports,
    db.preferences, db.indisponibilites, db.classes, db.creneauxClasses,
    async () => {
      const seances = await db.seances.where('enseignantId').equals(enseignantId).toArray();
      const seanceIds = seances.map(s => s.id);

      for (const sid of seanceIds) {
        await db.reservations.where('seanceId').equals(sid).delete();
        await db.transports.where('seanceId').equals(sid).delete();
      }

      await db.seances.where('enseignantId').equals(enseignantId).delete();
      await db.transports.where('enseignantId').equals(enseignantId).delete();
      await db.preferences.where('enseignantId').equals(enseignantId).delete();
      await db.indisponibilites.filter(i => i.type === 'enseignant' && i.refId === enseignantId).delete();
      await db.classes.where('enseignantId').equals(enseignantId).modify({ enseignantId: null });
      await db.creneauxClasses.where('enseignantId').equals(enseignantId).modify({ enseignantId: null });
      await db.enseignants.delete(enseignantId);

      return seanceIds.length;
    }
  );
}

/**
 * Supprime une installation et toutes ses données liées :
 * séances (+ leurs réservations/transports), réservations directes,
 * zones, indisponibilités. Désassocie les programmations.
 * Retourne le nombre de séances supprimées.
 */
export async function cascadeDeleteInstallation(installationId) {
  return db.transaction('rw',
    db.installations, db.seances, db.reservations, db.transports,
    db.programmations, db.zones, db.indisponibilites,
    async () => {
      const seances = await db.seances.where('installationId').equals(installationId).toArray();
      const seanceIds = seances.map(s => s.id);

      for (const sid of seanceIds) {
        await db.reservations.where('seanceId').equals(sid).delete();
        await db.transports.where('seanceId').equals(sid).delete();
      }

      await db.seances.where('installationId').equals(installationId).delete();
      await db.reservations.where('installationId').equals(installationId).delete();
      await db.programmations.where('installationId').equals(installationId).modify({ installationId: null, zoneId: null });
      await db.zones.where('installationId').equals(installationId).delete();
      await db.indisponibilites.filter(i => i.type === 'installation' && i.refId === installationId).delete();
      await db.installations.delete(installationId);

      return seanceIds.length;
    }
  );
}

/**
 * Supprime un lieu et toutes ses installations (cascade complète).
 * Retourne le nombre total de séances supprimées.
 */
export async function cascadeDeleteLieu(lieuId) {
  const installations = await db.installations.where('lieuId').equals(lieuId).toArray();
  let totalSeances = 0;
  for (const inst of installations) {
    totalSeances += await cascadeDeleteInstallation(inst.id);
  }
  await db.lieux.delete(lieuId);
  return totalSeances;
}

/**
 * Compte les séances liées à un enseignant (pour le message de confirmation).
 */
export async function countSeancesEnseignant(enseignantId) {
  return db.seances.where('enseignantId').equals(enseignantId).count();
}

/**
 * Compte les séances liées à une installation (pour le message de confirmation).
 */
export async function countSeancesInstallation(installationId) {
  return db.seances.where('installationId').equals(installationId).count();
}

/**
 * Compte les séances liées à un lieu (toutes installations confondues).
 */
export async function countSeancesLieu(lieuId) {
  const installs = await db.installations.where('lieuId').equals(lieuId).toArray();
  let total = 0;
  for (const inst of installs) {
    total += await db.seances.where('installationId').equals(inst.id).count();
  }
  return total;
}

/**
 * Vérifie si la base contient des données (pour l'avertissement avant fermeture)
 */
export async function hasData() {
  const counts = await Promise.all([
    db.enseignants.count(),
    db.classes.count(),
    db.seances.count(),
    db.activites.count(),
  ]);
  return counts.some(c => c > 0);
}
