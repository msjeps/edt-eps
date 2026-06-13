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
