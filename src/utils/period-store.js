/**
 * Période active partagée entre les vues (EDT, Vues).
 * Évite de re-choisir la période dans chaque écran : un seul état,
 * piloté par le sélecteur du header, mémorisé dans localStorage.
 *
 * Valeur : 'all' (toutes les périodes) ou l'id (string) d'une période.
 */
const KEY = 'edteps-periode-globale';
let value = (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || 'all';
const listeners = new Set();

/** Valeur brute : 'all' ou "<id>". */
export function getPeriodeGlobale() {
  return value;
}

/** Id numérique de la période active, ou null si « Toutes ». */
export function getPeriodeGlobaleId() {
  return value === 'all' ? null : parseInt(value, 10);
}

/** Définit la période active et notifie les abonnés (si la valeur change). */
export function setPeriodeGlobale(v) {
  const next = (v == null || v === '') ? 'all' : String(v);
  if (next === value) return;
  value = next;
  try { localStorage.setItem(KEY, value); } catch { /* navigation privée */ }
  listeners.forEach(fn => { try { fn(value); } catch (e) { console.error(e); } });
}

/** Abonnement aux changements. Renvoie une fonction de désabonnement. */
export function onPeriodeGlobaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Retourne un Set de tous les IDs de périodes dont les dates chevauchent
 * celles de la période sélectionnée (la période elle-même incluse).
 * Permet d'afficher les séances semestre dans une vue trimestre et vice-versa.
 *
 * @param {number|null} periodeId - ID de la période sélectionnée, ou null = toutes
 * @param {Array} allPeriodes     - tableau complet des périodes
 * @returns {Set<number>|null}    - Set d'IDs, ou null si periodeId est null
 */
export function getOverlappingPeriodeIds(periodeId, allPeriodes) {
  if (periodeId == null) return null;
  const selected = allPeriodes.find(p => p.id === periodeId);
  if (!selected || !selected.dateDebut || !selected.dateFin) return new Set([periodeId]);
  const result = new Set();
  for (const p of allPeriodes) {
    if (!p.dateDebut || !p.dateFin) continue;
    // Deux intervalles [d1,f1] et [d2,f2] se chevauchent si d1 <= f2 && d2 <= f1
    if (selected.dateDebut <= p.dateFin && p.dateDebut <= selected.dateFin) {
      result.add(p.id);
    }
  }
  return result;
}
