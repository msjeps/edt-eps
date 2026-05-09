/**
 * Pile d'annulation (Ctrl+Z) — snapshot complet de la base avant chaque action.
 * Utilise exportAllData/importAllData existants pour capturer et restaurer l'état.
 */
import { exportAllData, importAllData } from '../db/store.js';

const MAX_STACK = 20;
const _stack = [];
let _onStackChange = null;

export function onUndoStackChange(fn) {
  _onStackChange = fn;
}

export function canUndo() {
  return _stack.length > 0;
}

export function getUndoLabel() {
  return _stack.length ? _stack[_stack.length - 1].label : null;
}

/**
 * Capture un snapshot de la base AVANT une action.
 * À appeler juste avant chaque écriture DB significative.
 */
export async function captureUndo(label) {
  const snapshot = await exportAllData();
  _stack.push({ label, snapshot });
  if (_stack.length > MAX_STACK) _stack.shift();
  _onStackChange?.();
}

/**
 * Annule la dernière action en restaurant le snapshot.
 * @param {Function} rerenderFn - appelée après restauration pour rafraîchir la vue
 * @returns {string|null} label de l'action annulée, ou null si pile vide
 */
export async function undo(rerenderFn) {
  if (!canUndo()) return null;
  const entry = _stack.pop();
  await importAllData(entry.snapshot);
  _onStackChange?.();
  await rerenderFn?.();
  return entry.label;
}

/**
 * Vide la pile (appelé lors du chargement d'un nouveau projet).
 */
export function clearUndoStack() {
  _stack.length = 0;
  _onStackChange?.();
}
