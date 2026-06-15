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
      try {
        const ok = await ensurePermission(stored);
        if (ok) return stored;
      } catch (_e) {
        // Handle invalide ou périmé → on supprime et on repasse par le picker
        await removeHandle(key);
      }
    }
  }

  // Picker : l'utilisateur choisit le dossier parent
  let parentHandle;
  try {
    parentHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (_e) {
    // L'utilisateur a annulé
    return null;
  }

  // Créer le sous-dossier ; si Chrome/macOS bloque la création, on utilise le dossier parent
  let dirHandle;
  try {
    dirHandle = await parentHandle.getDirectoryHandle(subFolder, { create: true });
  } catch (_e) {
    dirHandle = parentHandle;
  }
  await storeHandle(key, dirHandle);
  return dirHandle;
}

/**
 * Écrit un fichier dans un dossier géré.
 * Tout échec de l'API File System → fallback silencieux vers Téléchargements.
 * @param {string} key       - clé du dossier ('fs_projet_dir' | 'fs_exports_dir')
 * @param {string} subFolder - nom du sous-dossier ('PROJET' | 'EXPORTS')
 * @param {string} filename  - nom du fichier
 * @param {Blob}   blob      - contenu
 * @returns {{ saved: boolean, path: string|null, fallback: boolean }}
 */
async function saveToDir(key, subFolder, filename, blob) {
  if (!SUPPORTED) {
    _fallbackSave(blob, filename);
    return { saved: true, path: null, fallback: true };
  }

  try {
    const dirHandle = await getOrPickDir(key, subFolder);
    if (!dirHandle) {
      // Utilisateur a annulé le picker
      _fallbackSave(blob, filename);
      return { saved: true, path: null, fallback: true };
    }

    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return { saved: true, path: `${subFolder}/${filename}`, fallback: false };
  } catch (_e) {
    // Échec API (sandbox macOS, permission révoquée, handle invalide…) → téléchargement
    await removeHandle(key);
    _fallbackSave(blob, filename);
    return { saved: true, path: null, fallback: true };
  }
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
 * Sauvegarde un fichier export directement dans le dossier choisi (sans sous-dossier)
 */
export async function saveExportFile(blob, filename) {
  if (!SUPPORTED) {
    _fallbackSave(blob, filename);
    return { saved: true, path: null, fallback: true };
  }

  const stored = await loadHandle('fs_exports_dir');
  if (!stored) {
    // Aucun dossier mémorisé → afficher picker
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (_e) {
      // Utilisateur a annulé
      _fallbackSave(blob, filename);
      return { saved: true, path: null, fallback: true };
    }
    await storeHandle('fs_exports_dir', dirHandle);

    // Sauvegarder dans ce dossier
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return { saved: true, path: filename, fallback: false };
  }

  // Dossier mémorisé : vérifier permission et sauvegarder
  const ok = await ensurePermission(stored);
  if (!ok) {
    // Permission refusée → fallback
    _fallbackSave(blob, filename);
    return { saved: true, path: null, fallback: true };
  }

  const fileHandle = await stored.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();

  return { saved: true, path: filename, fallback: false };
}

/**
 * Réinitialise le dossier mémorisé (l'utilisateur pourra en choisir un autre).
 * @param {'projet'|'exports'|'all'} which
 */
export async function resetDir(which = 'all') {
  if (which === 'projet' || which === 'all') await removeHandle('fs_projet_dir');
  if (which === 'exports' || which === 'all') await removeHandle('fs_exports_dir');
}

/**
 * Retourne le nom du dossier courant pour les exports (ou null si non configuré).
 * Essaie de récupérer le chemin via le FileSystemHandle.
 */
export async function getExportsDirPath() {
  if (!SUPPORTED) return null;

  const stored = await loadHandle('fs_exports_dir');
  if (!stored) return null;

  try {
    // Essayer d'accéder à la propriété name du handle
    if (stored.name) return `.../${stored.name}`;

    // Fallback : demander la permission et essayer d'accéder au parent
    const ok = await ensurePermission(stored);
    if (!ok) return 'Dossier EXPORTS (permission refusée)';

    return 'Dossier EXPORTS';
  } catch (_e) {
    return 'Dossier EXPORTS';
  }
}

export const fsSupported = SUPPORTED;
