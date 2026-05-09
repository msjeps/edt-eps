/**
 * Gestion des dossiers de sauvegarde via File System Access API.
 * Les handles de dossiers sont persistés dans localStorage (sérialisation IDB).
 *
 * Deux dossiers gérés :
 *   PROJET  — fichiers JSON projet  (clé config : fs_projet_dir)
 *   EXPORTS — fichiers export CSV/Excel (clé config : fs_exports_dir)
 *
 * Workflow :
 *   1ère fois → showDirectoryPicker() → l'utilisateur choisit le dossier parent
 *               → sous-dossier créé automatiquement → handle stocké en IDB
 *   Fois suivantes → handle récupéré en IDB → permission re-demandée si expirée
 *                 → sauvegarde directe
 */

const SUPPORTED = 'showDirectoryPicker' in window;

// Stockage des handles dans IDB via un store dédié
// On utilise directement IndexedDB natif (pas Dexie) pour stocker des objets non-clonables
let _handleDb = null;

async function getHandleDb() {
  if (_handleDb) return _handleDb;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('EdtEpsFsHandles', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('handles');
    req.onsuccess = e => { _handleDb = e.target.result; resolve(_handleDb); };
    req.onerror = () => reject(req.error);
  });
}

async function storeHandle(key, handle) {
  const db = await getHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandle(key) {
  const db = await getHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function removeHandle(key) {
  const db = await getHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Vérifie et réactive la permission sur un handle existant.
 * Retourne true si la permission est accordée.
 */
async function ensurePermission(handle) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

/**
 * Retourne le handle du sous-dossier cible.
 * Si aucun handle n'est mémorisé, ouvre le picker.
 * @param {string} key         - clé de stockage ('fs_projet_dir' | 'fs_exports_dir')
 * @param {string} subFolder   - nom du sous-dossier à créer ('PROJET' | 'EXPORTS')
 * @param {boolean} forceReset - force le re-choix même si un handle existe
 * @returns {FileSystemDirectoryHandle}
 */
export async function getOrPickDir(key, subFolder, forceReset = false) {
  if (!SUPPORTED) return null;

  if (!forceReset) {
    const stored = await loadHandle(key);
    if (stored) {
      const ok = await ensurePermission(stored);
      if (ok) return stored;
      // Permission refusée → on repasse par le picker
    }
  }

  // Picker : l'utilisateur choisit le dossier parent
  let parentHandle;
  try {
    parentHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch {
    // L'utilisateur a annulé
    return null;
  }

  // Créer le sous-dossier automatiquement
  const dirHandle = await parentHandle.getDirectoryHandle(subFolder, { create: true });
  await storeHandle(key, dirHandle);
  return dirHandle;
}

/**
 * Écrit un fichier dans un dossier géré.
 * @param {string} key       - clé du dossier ('fs_projet_dir' | 'fs_exports_dir')
 * @param {string} subFolder - nom du sous-dossier ('PROJET' | 'EXPORTS')
 * @param {string} filename  - nom du fichier
 * @param {Blob}   blob      - contenu
 * @returns {{ saved: boolean, path: string|null, fallback: boolean }}
 */
async function saveToDir(key, subFolder, filename, blob) {
  if (!SUPPORTED) {
    // Fallback navigateur non supporté
    _fallbackSave(blob, filename);
    return { saved: true, path: null, fallback: true };
  }

  const dirHandle = await getOrPickDir(key, subFolder);
  if (!dirHandle) {
    // Utilisateur a annulé le picker → fallback Téléchargements
    _fallbackSave(blob, filename);
    return { saved: true, path: null, fallback: true };
  }

  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();

  return { saved: true, path: `${subFolder}/${filename}`, fallback: false };
}

function _fallbackSave(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Sauvegarde un fichier projet JSON dans EDT EPS/PROJET/
 */
export async function saveProjectFile(blob, filename) {
  return saveToDir('fs_projet_dir', 'PROJET', filename, blob);
}

/**
 * Sauvegarde un fichier export dans EDT EPS/EXPORTS/
 */
export async function saveExportFile(blob, filename) {
  return saveToDir('fs_exports_dir', 'EXPORTS', filename, blob);
}

/**
 * Réinitialise le dossier mémorisé (l'utilisateur pourra en choisir un autre).
 * @param {'projet'|'exports'|'all'} which
 */
export async function resetDir(which = 'all') {
  if (which === 'projet' || which === 'all') await removeHandle('fs_projet_dir');
  if (which === 'exports' || which === 'all') await removeHandle('fs_exports_dir');
}

export const fsSupported = SUPPORTED;
