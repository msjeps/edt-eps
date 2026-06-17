/**
 * App Shell — Router et navigation
 */
import db from './db/schema.js';
import { initDefaultConfig, getConfig } from './db/schema.js';
import { refreshCalendrierBackground } from './utils/calendrier-api.js';
import { ANNEES_SCOLAIRES } from './utils/dates.js';
import { renderDashboard } from './views/dashboard.js';
import { renderDonnees } from './views/donnees/donnees.js';
import { renderEdt } from './views/edt/grid.js';
import { renderProgrammation } from './views/programmation/programmation.js';
import { renderConflits } from './views/conflits/conflits.js';
import { renderReservations } from './views/reservations/reservations.js';
import { renderExports } from './views/exports/exports.js';
import { renderVues } from './views/vues/vues.js';
import { renderWizard } from './views/wizard/wizard.js';
import { renderAide } from './views/aide/aide.js';
import { exportAllData, importAllData, hasData } from './db/store.js';
import { importProjectFile, validateProjectFile, createImportConfirmDialog } from './import/import-utils.js';
import { toast } from './components/toast.js';
import { saveProjectFile, getOrPickDir, fsSupported } from './utils/filesystem.js';
import { canUndo, getUndoLabel, undo, clearUndoStack, onUndoStackChange } from './utils/undo.js';
import { openSnapshotsModal } from './versioning/snapshots-modal.js';
import { isConfigComplete } from './engine/config-validator.js';
import { getPeriodeGlobale, setPeriodeGlobale, onPeriodeGlobaleChange } from './utils/period-store.js';
import { getTheme, applyTheme, toggleTheme } from './utils/theme-store.js';

let currentView = 'dashboard';

// Vues filtrées par la période globale (sélecteur du header)
const VUES_PERIODE = ['edt', 'vues'];
// Indicateur : les données ont-elles été modifiées depuis la dernière sauvegarde ?
let dataModifiedSinceLastSave = false;

/**
 * Initialise l'application
 */
export async function initApp() {
  // Initialiser la config par défaut
  await initDefaultConfig();

  // Rafraîchir le calendrier scolaire en arrière-plan (non bloquant)
  refreshCalendrierBackground(ANNEES_SCOLAIRES);

  // Afficher le nom du projet (sidebar + header)
  const nom = await getConfig('etablissementNom');
  ['project-name', 'header-project-name'].forEach(id => {
    const el = document.getElementById(id);
    if (nom && el) el.textContent = nom;
  });

  // Afficher la date de dernière sauvegarde
  updateSaveStatus();

  // Sidebar collapsible (état mémorisé)
  const sidebar = document.getElementById('app-sidebar');
  const sidebarToggle = document.getElementById('btn-sidebar-toggle');
  const SIDEBAR_KEY = 'edteps_sidebar_collapsed';
  if (localStorage.getItem(SIDEBAR_KEY) === '1') {
    sidebar?.classList.add('collapsed');
  }
  sidebarToggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('collapsed');
    localStorage.setItem(SIDEBAR_KEY, sidebar?.classList.contains('collapsed') ? '1' : '0');
  });

  // Vérifier si c'est la première utilisation (pas d'enseignants)
  const nbEnseignants = await db.enseignants.count();
  if (nbEnseignants === 0) {
    // Première utilisation → lancer le wizard
    navigateTo('wizard');
  } else {
    navigateTo('dashboard');
  }

  // Thème clair / sombre (le script inline de index.html a déjà posé data-theme ;
  // on resynchronise meta + bouton, et on câble la bascule).
  applyTheme(getTheme());
  document.getElementById('header-theme-toggle')?.addEventListener('click', () => {
    toggleTheme();
  });

  // Sélecteur de période global (header)
  await refreshHeaderPeriode();
  document.getElementById('header-periode')?.addEventListener('change', (e) => {
    setPeriodeGlobale(e.target.value);
  });
  // Source de vérité unique : à chaque changement, on resynchronise le header
  // et on re-rend la vue courante si elle dépend de la période.
  onPeriodeGlobaleChange((v) => {
    setHeaderPeriodeValue(v);
    if (VUES_PERIODE.includes(currentView)) rerenderCurrentView();
  });

  // Bind navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.view);
    });
  });

  // Bouton paramètres
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    navigateTo('wizard');
  });

  // === Snapshots / Versions ===
  document.getElementById('btn-snapshots')?.addEventListener('click', () => {
    openSnapshotsModal(rerenderCurrentView);
  });

  // === Annuler (Ctrl+Z) ===
  onUndoStackChange(refreshUndoBtn);
  refreshUndoBtn();

  document.getElementById('btn-undo')?.addEventListener('click', async () => {
    const label = await undo(rerenderCurrentView);
    if (label) toast.success(`Annulation : ${label}`);
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
      e.preventDefault();
      document.getElementById('btn-undo')?.click();
    }
  });

  // === Sauvegarde rapide (header) ===
  document.getElementById('btn-save-project')?.addEventListener('click', saveProject);

  // === Chargement rapide (header) ===
  document.getElementById('btn-load-project')?.addEventListener('click', () => {
    document.getElementById('load-project-file')?.click();
  });
  document.getElementById('load-project-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // 1. Valider le fichier SANS rien importer (pas d'écrasement des données actuelles)
      const check = await validateProjectFile(file);
      if (check.validation === undefined) {
        // Fichier illisible / JSON invalide
        toast.error('Erreur : ' + check.message);
        e.target.value = '';
        return;
      }

      // 2. Demander confirmation avant tout remplacement
      const confirm = createImportConfirmDialog(check.validation, file.name);
      if (!confirm) {
        e.target.value = '';
        return;
      }

      // 3. Importer une seule fois, après confirmation
      const result = await importProjectFile(file);
      if (!result.success) {
        toast.error('Erreur : ' + result.message);
        e.target.value = '';
        return;
      }

      clearUndoStack();
      toast.success('Projet chargé avec succès ! Rechargement...');
      dataModifiedSinceLastSave = false;
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast.error('Erreur de chargement : ' + err.message);
    }
    e.target.value = ''; // Reset file input
  });

  // === Mise à jour PWA ===
  window.addEventListener('swUpdateReady', (e) => {
    const btn = document.getElementById('btn-update-available');
    if (btn) btn.hidden = false;
  });

  document.getElementById('btn-update-available')?.addEventListener('click', async () => {
    if (dataModifiedSinceLastSave) {
      const ok = await confirmUpdateDialog();
      if (!ok) return;
    }
    applySwUpdate();
  });

  // === Avertissement avant fermeture du navigateur ===
  window.addEventListener('beforeunload', async (e) => {
    // On vérifie si des données existent dans la base
    // Note : on utilise un flag simple car hasData() est async
    if (dataModifiedSinceLastSave) {
      e.preventDefault();
      e.returnValue = 'Vous avez des données non sauvegardées. Voulez-vous vraiment quitter ?';
      return e.returnValue;
    }
  });

  // Intercepter les modifications de la base pour activer le flag
  trackDatabaseChanges();

  // Alerte périodique si données non sauvegardées
  startSaveReminder();

  // === Sauvegarder sous… ===
  document.getElementById('btn-save-as-project')?.addEventListener('click', saveProjectAs);
}

/**
 * Sauvegarde le projet en JSON
 */
async function saveProject() {
  try {
    // Acquérir le handle en premier pendant que le geste utilisateur est actif.
    // showDirectoryPicker est bloqué par Chrome si appelé après des opérations IDB async.
    if (fsSupported) await getOrPickDir('fs_projet_dir', 'PROJET');

    const data = await exportAllData();
    const nom = await getConfig('etablissementNom') || 'projet';
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const ts = new Date().toISOString().replace('T', '_').split('.')[0].replace(/:/g, '-');
    const filename = `EDT_EPS_${nom.replace(/\s+/g, '_')}_${ts}.json`;

    const result = await saveProjectFile(blob, filename);

    // Enregistrer la date de dernière sauvegarde
    const now = new Date().toISOString();
    localStorage.setItem('edteps_lastSave', now);
    dataModifiedSinceLastSave = false;
    updateSaveStatus();

    if (result.fallback) {
      toast.success(`Projet sauvegardé dans Téléchargements : ${filename}`);
    } else {
      toast.success(
        `Projet sauvegardé dans EDT EPS/PROJET/`,
        { label: 'Changer dossier', fn: saveProjectChooseDir }
      );
    }
  } catch (err) {
    toast.error('Erreur de sauvegarde : ' + err.message);
  }
}

function refreshUndoBtn() {
  const btn = document.getElementById('btn-undo');
  if (!btn) return;
  const label = getUndoLabel();
  btn.disabled = !canUndo();
  btn.title = label ? `Annuler : ${label} (Ctrl+Z)` : 'Rien à annuler (Ctrl+Z)';
}

async function rerenderCurrentView() {
  const viewEl = document.getElementById(`view-${currentView}`);
  if (!viewEl) return;
  switch (currentView) {
    case 'donnees':       await renderDonnees(viewEl); break;
    case 'programmation': await renderProgrammation(viewEl); break;
    case 'edt':           await renderEdt(viewEl); break;
    case 'conflits':      await renderConflits(viewEl); break;
    case 'reservations':  await renderReservations(viewEl); break;
    case 'vues':          await renderVues(viewEl); break;
  }
}

/**
 * Sélecteur de période global (header) — remplit les options, valide la
 * valeur mémorisée et la synchronise avec l'affichage.
 */
async function refreshHeaderPeriode() {
  const sel = document.getElementById('header-periode');
  if (!sel) return;
  const all = await db.periodes.toArray();
  const main = all.filter(p => !p.parentId).sort((a, b) => (a.ordre ?? a.id) - (b.ordre ?? b.id));

  let val = getPeriodeGlobale();
  const validIds = new Set(all.map(p => String(p.id)));
  // Période mémorisée qui n'existe plus (autre projet chargé) → repli sur Toutes
  if (val !== 'all' && !validIds.has(val)) { setPeriodeGlobale('all'); val = 'all'; }

  // Si la période active est une sous-période, l'ajouter pour pouvoir l'afficher
  let opts = main;
  if (val !== 'all' && !main.some(p => String(p.id) === val)) {
    const extra = all.find(p => String(p.id) === val);
    if (extra) opts = [...main, extra];
  }

  sel.innerHTML = `<option value="all">Toutes les périodes</option>` +
    opts.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
  sel.value = val;
}

function setHeaderPeriodeValue(v) {
  const sel = document.getElementById('header-periode');
  if (sel && sel.value !== v) sel.value = v;
}

async function saveProjectChooseDir() {
  const { resetDir } = await import('./utils/filesystem.js');
  await resetDir('projet');
  await saveProject();
}

/**
 * Met à jour l'indicateur de dernière sauvegarde dans le header
 */
function updateSaveStatus() {
  const el = document.getElementById('save-status');
  if (!el) return;
  const lastSave = localStorage.getItem('edteps_lastSave');
  if (lastSave) {
    const d = new Date(lastSave);
    const formatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    el.textContent = `Sauvé ${formatted}`;
    el.title = `Dernière sauvegarde : ${d.toLocaleString('fr-FR')}`;
  } else {
    el.textContent = 'Non sauvegardé';
    el.title = 'Aucune sauvegarde effectuée — cliquez 💾 pour sauvegarder';
  }
}

/**
 * Intercepte les changements dans IndexedDB pour activer l'indicateur de modifications.
 * Utilise le hook Dexie on('creating'/'updating'/'deleting').
 */
function trackDatabaseChanges() {
  // Observer les tables principales pour détecter les modifications
  const tablesToWatch = ['enseignants', 'classes', 'activites', 'installations',
    'lieux', 'zones', 'periodes', 'seances', 'programmations', 'reservations',
    'transports', 'creneaux', 'config', 'creneauxClasses', 'modelesNiveau'];

  for (const tableName of tablesToWatch) {
    if (db[tableName]) {
      db[tableName].hook('creating', () => { markModified(); });
      db[tableName].hook('updating', () => { markModified(); });
      db[tableName].hook('deleting', () => { markModified(); });
    }
  }
}

/**
 * Marque les données comme modifiées depuis la dernière sauvegarde
 */
function markModified() {
  dataModifiedSinceLastSave = true;
  const el = document.getElementById('save-status');
  if (el && !el.textContent.includes('●')) {
    el.textContent = '● ' + el.textContent;
    el.style.color = '#fbbf24'; // jaune d'avertissement
    el.title = 'Modifications non sauvegardées — cliquez 💾 pour sauvegarder';
  }
}

/**
 * Alerte périodique toutes les 20 min si modifications non sauvegardées.
 */
function startSaveReminder() {
  setInterval(() => {
    if (!dataModifiedSinceLastSave) return;
    toast.warning('Vous n\'avez pas sauvegardé depuis 20 min ou plus — pensez à sauvegarder 💾', {
      label: 'Sauvegarder',
      fn: saveProject,
    });
  }, 20 * 60 * 1000);
}

/**
 * Sauvegarde une copie nommée du projet (ex. "avant_réunion_T2").
 */
async function saveProjectAs() {
  const label = await askSaveName();
  if (label === null) return;

  try {
    if (fsSupported) await getOrPickDir('fs_projet_dir', 'PROJET');

    const data = await exportAllData();
    const nom = await getConfig('etablissementNom') || 'projet';
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const safeLabel = label.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const date = new Date().toISOString().split('T')[0];
    const filename = `EDT_EPS_${nom.replace(/\s+/g, '_')}_${safeLabel}_${date}.json`;

    const result = await saveProjectFile(blob, filename);

    localStorage.setItem('edteps_lastSave', new Date().toISOString());
    dataModifiedSinceLastSave = false;
    updateSaveStatus();

    if (result.fallback) {
      toast.success(`Copie nommée sauvegardée dans Téléchargements : ${filename}`);
    } else {
      toast.success(`Copie « ${label} » sauvegardée dans EDT EPS/PROJET/`);
    }
  } catch (err) {
    toast.error('Erreur de sauvegarde : ' + err.message);
  }
}

/**
 * Affiche une mini-modale pour saisir le nom de la copie.
 * Retourne le nom saisi, ou null si annulé.
 */
function askSaveName() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const dialog = document.createElement('div');
    dialog.className = 'modal save-as-modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'save-as-title');
    dialog.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title" id="save-as-title">Sauvegarder sous…</h2>
      </div>
      <div class="modal-body">
        <p style="color:var(--c-text-muted);font-size:var(--fs-sm);margin-bottom:.75rem">
          Donnez un nom à cette copie pour l'identifier facilement.
          Le fichier sera nommé&nbsp;: <em>EDT_EPS_ETABLISSEMENT_<strong>votre-nom</strong>_date.json</em>
        </p>
        <input id="save-as-name" class="form-input" type="text"
               placeholder="ex : avant_réunion_T2, sans_install…" maxlength="50"
               style="width:100%">
        <div class="modal-actions" style="margin-top:1rem;display:flex;gap:.5rem;justify-content:flex-end">
          <button id="save-as-cancel" class="btn btn-secondary">Annuler</button>
          <button id="save-as-confirm" class="btn btn-primary">
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:4px">
              <path d="M2 2.5A.5.5 0 012.5 2h8l3.5 3.5V13.5a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-11z"/>
              <path d="M5 2v4h6V2M5 10.5h6"/>
            </svg>
            Sauvegarder
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    overlay?.classList.remove('hidden');

    const input = dialog.querySelector('#save-as-name');
    input.focus();

    const close = (value) => {
      dialog.remove();
      overlay?.classList.add('hidden');
      resolve(value);
    };

    dialog.querySelector('#save-as-cancel').addEventListener('click', () => close(null));
    dialog.querySelector('#save-as-confirm').addEventListener('click', () => {
      const val = input.value.trim();
      if (!val) { input.focus(); return; }
      close(val);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') dialog.querySelector('#save-as-confirm').click();
      if (e.key === 'Escape') close(null);
    });
  });
}

// Exposer saveProject et saveProjectAs pour réutilisation depuis exports.js
export { saveProject, saveProjectAs };

const VIEW_LABELS = {
  dashboard: 'Accueil',
  donnees: 'Données',
  programmation: 'Programmation annuelle',
  edt: 'Emploi du temps',
  conflits: 'Conflits',
  reservations: 'Réservations',
  vues: 'Vues individuelles',
  exports: 'Exports',
  aide: 'Aide',
  wizard: 'Configuration',
};

/**
 * Navigation entre vues
 */
export async function navigateTo(viewName) {
  // Masquer toutes les vues
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  // Désactiver tous les boutons nav
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  // Activer la vue cible
  const viewEl = document.getElementById(`view-${viewName}`);
  if (viewEl) {
    viewEl.classList.add('active');
    currentView = viewName;
  }

  // Activer le bouton nav correspondant
  const navBtn = document.querySelector(`.nav-btn[data-view="${viewName}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Mettre à jour le titre dans le header
  const titleEl = document.getElementById('view-title');
  if (titleEl) titleEl.textContent = VIEW_LABELS[viewName] || viewName;

  // Sélecteur de période : visible seulement sur les vues filtrées par période
  const periodeWrap = document.getElementById('header-periode-wrap');
  if (periodeWrap) periodeWrap.hidden = !VUES_PERIODE.includes(viewName);

  // Vues nécessitant une configuration complète
  const VUES_PROTEGEES = ['edt'];
  if (VUES_PROTEGEES.includes(viewName)) {
    const ok = await isConfigComplete();
    if (!ok) {
      toast.warning('Configuration incomplète — corrigez les erreurs avant d\'accéder à cette vue.', {
        label: 'Voir',
        fn: () => navigateTo('dashboard'),
      });
      navigateTo('dashboard');
      return;
    }
  }

  // Rendre le contenu de la vue
  try {
    switch (viewName) {
      case 'dashboard':
        await renderDashboard(viewEl);
        break;
      case 'donnees':
        await renderDonnees(viewEl);
        break;
      case 'programmation':
        await renderProgrammation(viewEl);
        break;
      case 'edt':
        await renderEdt(viewEl);
        break;
      case 'conflits':
        await renderConflits(viewEl);
        break;
      case 'reservations':
        await renderReservations(viewEl);
        break;
      case 'vues':
        await renderVues(viewEl);
        break;
      case 'exports':
        await renderExports(viewEl);
        break;
      case 'aide':
        renderAide(viewEl);
        break;
      case 'wizard':
        await renderWizard(viewEl);
        break;
    }
  } catch (err) {
    console.error(`Erreur lors du rendu de la vue ${viewName}:`, err);
    viewEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#9888;</div>
        <div class="empty-state-title">Erreur</div>
        <div class="empty-state-text">${err.message}</div>
      </div>
    `;
  }
}

/**
 * Met à jour le badge de conflits
 */
export function updateConflictBadge(count) {
  const badge = document.getElementById('conflict-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

export function getCurrentView() {
  return currentView;
}

/**
 * Demande confirmation à l'utilisateur avant d'appliquer une mise à jour
 * quand il y a des données non sauvegardées.
 * Retourne true si l'utilisateur accepte de continuer quand même.
 */
function confirmUpdateDialog() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const dialog = document.createElement('div');
    dialog.className = 'modal update-confirm-modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'update-confirm-title');
    dialog.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title" id="update-confirm-title">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--c-warning);vertical-align:-3px;margin-right:6px">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Données non sauvegardées
        </h2>
      </div>
      <div class="modal-body">
        <p>Vous avez des modifications non sauvegardées.</p>
        <p><strong>Sauvegardez votre projet avant d'appliquer la mise à jour</strong>, sinon les changements en cours seront perdus au rechargement.</p>
        <div class="modal-actions" style="margin-top:1.25rem;display:flex;gap:.625rem;justify-content:flex-end">
          <button id="upd-cancel" class="btn btn-secondary">Annuler — je sauvegarde d'abord</button>
          <button id="upd-save-then-update" class="btn btn-primary">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:4px">
              <path d="M2 2.5A.5.5 0 012.5 2h8l3.5 3.5V13.5a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-11z"/>
              <path d="M5 2v4h6V2M5 10.5h6"/>
            </svg>
            Sauvegarder puis mettre à jour
          </button>
          <button id="upd-force" class="btn" style="color:var(--c-text-muted)">Mettre à jour sans sauvegarder</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    if (overlay) overlay.classList.remove('hidden');

    const close = (result) => {
      dialog.remove();
      if (overlay) overlay.classList.add('hidden');
      resolve(result);
    };

    dialog.querySelector('#upd-cancel').addEventListener('click', () => close(false));
    dialog.querySelector('#upd-force').addEventListener('click', () => close(true));
    dialog.querySelector('#upd-save-then-update').addEventListener('click', async () => {
      await saveProject();
      close(true);
    });
  });
}

/**
 * Envoie le signal SKIP_WAITING au SW en attente.
 * Le rechargement est déclenché par l'événement controllerchange dans main.js.
 */
function applySwUpdate() {
  const reg = window.__swRegistration;
  if (reg?.waiting) {
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    // Fallback : simple rechargement (le SW sera activé au prochain cycle)
    window.location.reload();
  }
}
