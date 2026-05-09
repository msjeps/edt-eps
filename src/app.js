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
import { toast } from './components/toast.js';
import { saveProjectFile, fsSupported } from './utils/filesystem.js';
import { canUndo, getUndoLabel, undo, clearUndoStack, onUndoStackChange } from './utils/undo.js';
import { openSnapshotsModal } from './versioning/snapshots-modal.js';
import { isConfigComplete } from './engine/config-validator.js';

let currentView = 'dashboard';
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
      const text = await file.text();
      const data = JSON.parse(text);
      // Vérification basique : le fichier contient des tables connues
      if (!data.enseignants && !data.classes && !data.config) {
        throw new Error('Ce fichier ne semble pas être un projet EDT EPS valide');
      }
      const confirm = window.confirm(
        `Charger le projet depuis "${file.name}" ?\n\nAttention : cela remplacera TOUTES les données actuelles.`
      );
      if (!confirm) {
        e.target.value = ''; // Reset file input
        return;
      }
      await importAllData(data);
      clearUndoStack();
      toast.success('Projet chargé avec succès ! Rechargement...');
      dataModifiedSinceLastSave = false;
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast.error('Erreur de chargement : ' + err.message);
    }
    e.target.value = ''; // Reset file input
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
}

/**
 * Sauvegarde le projet en JSON
 */
async function saveProject() {
  try {
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
  }
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

// Exposer saveProject pour réutilisation depuis exports.js
export { saveProject };

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
