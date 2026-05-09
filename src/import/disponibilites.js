/**
 * Import des disponibilités mairie (Direction des Sports)
 * Source : JSON extrait du PDF hebdomadaire (Vision_Hebdo_Org)
 *
 * Format JSON attendu :
 * [{ facility, space, day, organizer, date_range, time_range, activity }]
 *
 * Chaque entrée importée devient une indisponibilité sur une installation locale.
 */
import db from '../db/schema.js';
import { captureUndo } from '../utils/undo.js';

const JOURS_MAP = {
  'lundi': 'lundi', 'mardi': 'mardi', 'mercredi': 'mercredi',
  'jeudi': 'jeudi', 'vendredi': 'vendredi', 'samedi': 'samedi', 'dimanche': 'dimanche',
};

/**
 * Normalise un jour en minuscules
 */
function normaliserJour(jour) {
  return JOURS_MAP[jour?.toLowerCase()] || null;
}

/**
 * Parse "08:30 - 11:30" ou "08:30 - 11:30 / 13:30 - 16:30"
 * Retourne un tableau de { heureDebut, heureFin }
 */
function parseTimeRanges(timeRange) {
  if (!timeRange) return [];
  return timeRange.split('/').map(s => {
    const parts = s.trim().split(' - ');
    if (parts.length !== 2) return null;
    return { heureDebut: parts[0].trim(), heureFin: parts[1].trim() };
  }).filter(Boolean);
}

/**
 * Parse "08/09/2025 - 24/11/2025" → { dateDebut: '2025-09-08', dateFin: '2025-11-24' }
 */
function parseDateRange(dateRange) {
  if (!dateRange) return { dateDebut: null, dateFin: null };
  const parts = dateRange.split(' - ');
  const toIso = (str) => {
    const [d, m, y] = str.trim().split('/');
    return `${y}-${m}-${d}`;
  };
  return {
    dateDebut: toIso(parts[0]),
    dateFin: parts[1] ? toIso(parts[1]) : null,
  };
}

/**
 * Retourne true si l'entrée est valide (pas un artefact d'extraction PDF)
 */
function isEntreeValide(entry) {
  const jour = normaliserJour(entry.day);
  if (!jour) return false;
  if (!entry.space || !entry.time_range) return false;
  // Filtre les artefacts d'extraction (ex: facility = "Jeudi")
  if (!entry.facility || entry.facility.length < 5) return false;
  if (/^\d{2}:\d{2}/.test(entry.facility)) return false;
  return true;
}

/**
 * Extrait la liste des espaces uniques depuis le JSON
 * Retourne : [{ facility, space, count }] triés par facility puis space
 */
export function getUniqueSpaces(data) {
  const map = new Map();
  for (const entry of data) {
    if (!isEntreeValide(entry)) continue;
    const key = `${entry.facility}|||${entry.space}`;
    if (!map.has(key)) {
      map.set(key, { facility: entry.facility, space: entry.space, count: 0 });
    }
    map.get(key).count++;
  }
  return [...map.values()].sort((a, b) =>
    a.facility.localeCompare(b.facility) || a.space.localeCompare(b.space)
  );
}

/**
 * Filtre les entrées selon les options
 * @param {string} excludeKeyword - Mot-clé à exclure dans activity (ex: "MSJ")
 */
export function filtrerEntrees(data, excludeKeyword) {
  return data.filter(entry => {
    if (!isEntreeValide(entry)) return false;
    if (excludeKeyword) {
      const kw = excludeKeyword.trim().toUpperCase();
      if (kw && entry.activity?.toUpperCase().includes(kw)) return false;
    }
    return true;
  });
}

/**
 * Importe les disponibilités mairie dans IndexedDB
 *
 * @param {Array} data         - JSON brut Direction des Sports
 * @param {Object} mappings    - { "facility|||space": installationId | null }
 * @param {Object} options     - { excludeKeyword, remplacerExistantes }
 * @returns {{ importees: number, ignorees: number }}
 */
export async function importerDisponibilitesMairie(data, mappings, options = {}) {
  const { excludeKeyword = '', remplacerExistantes = true } = options;

  const entrees = filtrerEntrees(data, excludeKeyword);

  // Regrouper les entrées par installationId cible
  const parInstallation = new Map();
  for (const entry of entrees) {
    const key = `${entry.facility}|||${entry.space}`;
    const installId = mappings[key];
    if (!installId) continue; // espace ignoré
    if (!parInstallation.has(installId)) parInstallation.set(installId, []);
    parInstallation.get(installId).push(entry);
  }

  if (parInstallation.size === 0) return { importees: 0, ignorees: entrees.length };

  await captureUndo('Import disponibilités mairie');

  let importees = 0;
  let ignorees = 0;

  for (const [installId, entries] of parInstallation) {
    if (remplacerExistantes) {
      // Supprimer les anciennes indisponibilités mairie pour cette installation
      await db.indisponibilites
        .filter(i => i.type === 'installation' && i.refId === installId && i.source === 'mairie')
        .delete();
    }

    for (const entry of entries) {
      const jour = normaliserJour(entry.day);
      const plages = parseTimeRanges(entry.time_range);
      const { dateDebut, dateFin } = parseDateRange(entry.date_range);

      for (const { heureDebut, heureFin } of plages) {
        await db.indisponibilites.add({
          type: 'installation',
          refId: installId,
          jour,
          heureDebut,
          heureFin,
          periodeId: null,
          motif: entry.activity || '',
          // Champs non-indexés pour traçabilité
          dateDebut,
          dateFin,
          source: 'mairie',
          complexe: entry.facility,
          espace: entry.space,
        });
        importees++;
      }
    }
  }

  ignorees = entrees.length - importees;
  return { importees, ignorees };
}

/**
 * Supprime toutes les indisponibilités importées depuis la mairie
 * @returns {number} Nombre supprimées
 */
export async function supprimerDisponibilitesMairie() {
  const count = await db.indisponibilites
    .filter(i => i.source === 'mairie')
    .count();
  await db.indisponibilites
    .filter(i => i.source === 'mairie')
    .delete();
  return count;
}

/**
 * Compte les indisponibilités importées depuis la mairie par installation
 * @returns {Object} { installationId: count }
 */
export async function compterIndisposMairie() {
  const all = await db.indisponibilites
    .filter(i => i.source === 'mairie')
    .toArray();
  const counts = {};
  for (const i of all) {
    counts[i.refId] = (counts[i.refId] || 0) + 1;
  }
  return counts;
}
