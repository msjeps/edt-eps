/**
 * Modale de gestion des snapshots.
 * Écran 1 : liste des versions (avec mode référence pour comparer 2 snapshots).
 * Écran 2 : comparaison détaillée — table résumé + diff séances.
 */
import {
  captureSnapshot,
  getSnapshots,
  deleteSnapshot,
  restoreSnapshot,
  compareWithCurrent,
  compareSnapshots,
} from './snapshots.js';
import { toast } from '../components/toast.js';
import { clearUndoStack } from '../utils/undo.js';

let _rerenderFn = null;
let _referenceId = null;   // ID du snapshot utilisé comme "avant" dans la comparaison

export function openSnapshotsModal(rerenderFn) {
  _rerenderFn = rerenderFn;
  renderList();
}

// ─── Helpers DOM ──────────────────────────────────────────────────────────────

function getOverlay() { return document.getElementById('modal-overlay'); }
function getModal()   { return document.getElementById('snapshots-modal'); }

function ensureModalContainer() {
  if (document.getElementById('snapshots-modal')) return;
  const div = document.createElement('div');
  div.id = 'snapshots-modal';
  div.className = 'snapshots-modal';
  document.body.appendChild(div);
}

function showModal() {
  ensureModalContainer();
  getOverlay()?.classList.remove('hidden');
  getModal()?.classList.add('open');
}

function closeModal() {
  getOverlay()?.classList.add('hidden');
  const m = getModal();
  if (m) {
    m.classList.remove('open');
    m.classList.remove('compare-mode');
  }
}

function fmtDate(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Écran 1 : liste ──────────────────────────────────────────────────────────

async function renderList() {
  ensureModalContainer();
  const modal = getModal();
  modal.classList.remove('compare-mode');
  const snaps = await getSnapshots();

  const refSnap = _referenceId ? snaps.find(s => s.id === _referenceId) : null;

  modal.innerHTML = `
    <div class="snapshots-header">
      <h2 class="snapshots-title">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="10" cy="10" r="8"/>
          <path d="M10 6v4l2.5 2.5"/>
        </svg>
        Versions du projet
      </h2>
      <button class="snapshots-close" id="btn-snap-close" title="Fermer">✕</button>
    </div>

    <div class="snapshots-capture-bar">
      <input id="snap-name-input" class="snapshots-name-input" type="text"
             placeholder="Nom de la version (ex. Avant réunion T2)" maxlength="60">
      <input id="snap-desc-input" class="snapshots-desc-input" type="text"
             placeholder="Description optionnelle" maxlength="120">
      <button id="btn-snap-capture" class="btn btn-primary snapshots-capture-btn">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 2v16M2 10h16"/>
        </svg>
        Prendre une version
      </button>
    </div>

    ${refSnap ? `
    <div class="snap-ref-banner">
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="10" cy="10" r="8"/><path d="M10 6v4l2.5 2.5"/>
      </svg>
      Référence : <strong>${escHtml(refSnap.nom)}</strong>
      <span class="snap-ref-date">(${fmtDate(refSnap.date)})</span>
      <button class="snap-ref-clear" id="btn-ref-clear">Effacer</button>
      <span class="snap-ref-hint">→ Cliquez « Comparer » sur une autre version pour voir les différences</span>
    </div>` : ''}

    <div class="snapshots-list" id="snapshots-list">
      ${snaps.length === 0
        ? '<p class="snapshots-empty">Aucune version sauvegardée. Cliquez sur « Prendre une version » pour commencer.</p>'
        : snaps.map(s => renderSnapRow(s, refSnap)).join('')
      }
    </div>
  `;

  showModal();
  bindListEvents(snaps);
}

function renderSnapRow(s, refSnap) {
  const isRef = refSnap && s.id === refSnap.id;
  return `
    <div class="snap-row${isRef ? ' is-reference' : ''}" data-id="${s.id}">
      <div class="snap-row-info">
        ${isRef ? '<span class="snap-ref-badge">Référence</span>' : ''}
        <span class="snap-row-name">${escHtml(s.nom)}</span>
        <span class="snap-row-date">${fmtDate(s.date)}</span>
        ${s.description ? `<span class="snap-row-desc">${escHtml(s.description)}</span>` : ''}
      </div>
      <div class="snap-row-actions">
        ${isRef
          ? `<button class="btn btn-sm btn-ghost snap-btn-ref-clear" data-id="${s.id}" title="Retirer comme référence">
               Retirer référence
             </button>`
          : `<button class="btn btn-sm ${refSnap ? 'btn-primary' : 'btn-outline'} snap-btn-compare" data-id="${s.id}" title="${refSnap ? `Comparer avec « ${refSnap.nom} »` : 'Comparer avec l\'état actuel'}">
               <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                 <path d="M3 10h14M3 5h7M3 15h7M14 7l3 3-3 3"/>
               </svg>
               ${refSnap ? 'Comparer' : 'Comparer'}
             </button>
             <button class="btn btn-sm btn-ghost snap-btn-set-ref" data-id="${s.id}" title="Définir comme version de référence (avant)">
               <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <circle cx="10" cy="10" r="8"/><path d="M10 6v4l2.5 2.5"/>
               </svg>
               Référence
             </button>`
        }
        <button class="btn btn-sm btn-outline snap-btn-restore" data-id="${s.id}" title="Restaurer cette version">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3.5 9a5.5 5.5 0 109 4.2"/>
            <path d="M3.5 4v5h5"/>
          </svg>
          Restaurer
        </button>
        <button class="btn btn-sm btn-ghost snap-btn-delete" data-id="${s.id}" title="Supprimer cette version">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 6h12M8 6V4h4v2M9 10v5M11 10v5M5 6l1 11h8l1-11"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function bindListEvents(snaps) {
  document.getElementById('btn-snap-close')?.addEventListener('click', closeModal);
  getOverlay()?.addEventListener('click', closeModal, { once: true });

  document.getElementById('btn-snap-capture')?.addEventListener('click', async () => {
    const nom = document.getElementById('snap-name-input').value.trim();
    if (!nom) {
      toast.error('Donnez un nom à cette version avant de la sauvegarder.');
      document.getElementById('snap-name-input').focus();
      return;
    }
    const desc = document.getElementById('snap-desc-input').value.trim();
    try {
      await captureSnapshot(nom, desc);
      toast.success(`Version « ${nom} » sauvegardée`);
      renderList();
    } catch (err) {
      toast.error('Erreur : ' + err.message);
    }
  });

  document.getElementById('snap-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-snap-capture')?.click();
  });

  // Effacer la référence (banner)
  document.getElementById('btn-ref-clear')?.addEventListener('click', () => {
    _referenceId = null;
    renderList();
  });

  // Définir comme référence
  document.querySelectorAll('.snap-btn-set-ref').forEach(btn => {
    btn.addEventListener('click', () => {
      _referenceId = Number(btn.dataset.id);
      renderList();
    });
  });

  // Retirer référence (depuis la ligne elle-même)
  document.querySelectorAll('.snap-btn-ref-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      _referenceId = null;
      renderList();
    });
  });

  // Comparer
  document.querySelectorAll('.snap-btn-compare').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      renderCompare(id, _referenceId || null);
    });
  });

  // Restaurer
  document.querySelectorAll('.snap-btn-restore').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const snap = snaps.find(s => s.id === id);
      if (!window.confirm(`Restaurer la version « ${snap?.nom} » ?\n\nL'état actuel sera écrasé (pensez à sauvegarder d'abord).`)) return;
      try {
        const restored = await restoreSnapshot(id);
        clearUndoStack();
        closeModal();
        toast.success(`Version « ${restored.nom} » restaurée. Rechargement…`);
        setTimeout(() => location.reload(), 800);
      } catch (err) {
        toast.error('Erreur : ' + err.message);
      }
    });
  });

  // Supprimer
  document.querySelectorAll('.snap-btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const snap = snaps.find(s => s.id === id);
      if (!window.confirm(`Supprimer définitivement la version « ${snap?.nom} » ?`)) return;
      try {
        await deleteSnapshot(id);
        if (_referenceId === id) _referenceId = null;
        toast.success(`Version « ${snap?.nom} » supprimée`);
        renderList();
      } catch (err) {
        toast.error('Erreur : ' + err.message);
      }
    });
  });
}

// ─── Écran 2 : comparaison ────────────────────────────────────────────────────

/**
 * @param {number} snapId  — snapshot à analyser (version "après")
 * @param {number|null} refId — référence (version "avant"), null = état actuel comme "après"
 */
async function renderCompare(snapId, refId) {
  const modal = getModal();
  modal.classList.add('compare-mode');
  modal.innerHTML = `<div class="snapshots-loading">Calcul des différences…</div>`;

  let result;
  try {
    result = refId
      ? await compareSnapshots(refId, snapId)   // refId = avant, snapId = après
      : await compareWithCurrent(snapId);        // snapId = avant, actuel = après
  } catch (err) {
    toast.error('Erreur comparaison : ' + err.message);
    renderList();
    return;
  }

  const { snapA, snapB, diff, seanceDiff } = result;
  const labelA = snapA.nom;
  const labelB = snapB ? snapB.nom : 'état actuel';
  const hasChanges = diff.some(d => d.added || d.removed || d.changed);
  const hasSeanceChanges = seanceDiff.added.length || seanceDiff.removed.length || seanceDiff.changed.length;

  modal.innerHTML = `
    <div class="snapshots-header">
      <h2 class="snapshots-title">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M3 10h14M3 5h7M3 15h7M14 7l3 3-3 3"/>
        </svg>
        Comparaison avant / après
      </h2>
      <button class="snapshots-close" id="btn-comp-close" title="Fermer">✕</button>
    </div>

    <div class="compare-meta">
      <span class="compare-meta-chip compare-meta-chip--a">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="10" cy="10" r="8"/><path d="M10 6v4l2.5 2.5"/>
        </svg>
        ${escHtml(labelA)} — ${fmtDate(snapA.date)}
      </span>
      <span class="compare-meta-arrow">→</span>
      <span class="compare-meta-chip compare-meta-chip--b">
        ${snapB
          ? `<svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l2.5 2.5"/></svg>
             ${escHtml(labelB)} — ${fmtDate(snapB.date)}`
          : `<svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10" cy="10" r="3"/><path d="M10 3v4M10 13v4M3 10h4M13 10h4"/></svg>
             État actuel`
        }
      </span>
      ${snapA.description ? `<span class="compare-meta-desc">${escHtml(snapA.description)}</span>` : ''}
    </div>

    <div class="compare-body">

      ${!hasChanges
        ? '<p class="compare-identical">✓ Aucune différence — les deux versions sont identiques.</p>'
        : `
          <!-- Tableau résumé -->
          <div class="compare-summary-section">
            <div class="compare-section-title">Résumé des modifications</div>
            <table class="compare-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th class="col-num">Avant</th>
                  <th class="col-num">Après</th>
                  <th class="col-delta">Ajouts</th>
                  <th class="col-delta">Suppressions</th>
                  <th class="col-delta">Modifs</th>
                </tr>
              </thead>
              <tbody>
                ${diff.filter(d => d.added || d.removed || d.changed || d.snapCount !== d.currCount)
                      .map(d => renderDiffRow(d)).join('')}
              </tbody>
            </table>
          </div>

          <!-- Section séances EDT -->
          ${hasSeanceChanges ? renderSeanceDiffSection(seanceDiff) : ''}
        `
      }

    </div>

    <div class="compare-footer">
      <button id="btn-comp-back" class="btn btn-outline">← Retour à la liste</button>
      <button id="btn-comp-restore" class="btn btn-primary">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3.5 9a5.5 5.5 0 109 4.2"/><path d="M3.5 4v5h5"/>
        </svg>
        Restaurer « ${escHtml(labelA)} »
      </button>
    </div>
  `;

  document.getElementById('btn-comp-close')?.addEventListener('click', closeModal);
  document.getElementById('btn-comp-back')?.addEventListener('click', renderList);
  document.getElementById('btn-comp-restore')?.addEventListener('click', async () => {
    if (!window.confirm(`Restaurer la version « ${snapA.nom} » ?\n\nL'état actuel sera écrasé.`)) return;
    try {
      await restoreSnapshot(snapA.id);
      clearUndoStack();
      closeModal();
      toast.success(`Version « ${snapA.nom} » restaurée. Rechargement…`);
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast.error('Erreur : ' + err.message);
    }
  });
}

function renderDiffRow(d) {
  const rowClass = (d.added || d.removed || d.changed) ? 'diff-row-changed' : 'diff-row-ok';
  return `
    <tr class="${rowClass}">
      <td>${d.label}</td>
      <td class="col-num">${d.snapCount}</td>
      <td class="col-num">${d.currCount}</td>
      <td class="col-delta">${d.added   ? `<span class="delta-add">+${d.added}</span>`   : '—'}</td>
      <td class="col-delta">${d.removed ? `<span class="delta-del">-${d.removed}</span>` : '—'}</td>
      <td class="col-delta">${d.changed ? `<span class="delta-chg">~${d.changed}</span>` : '—'}</td>
    </tr>
  `;
}

function renderSeanceDiffSection(seanceDiff) {
  const { added, removed, changed } = seanceDiff;
  const total = added.length + removed.length + changed.length;

  return `
    <div class="seance-diff-section">
      <div class="compare-section-title">
        Séances EDT
        <span class="seance-diff-total">${total} modification${total > 1 ? 's' : ''}</span>
      </div>

      ${added.length ? `
        <div class="seance-diff-group seance-diff-group--add">
          <div class="seance-diff-group-label">
            <span class="delta-add">+${added.length}</span> ajoutée${added.length > 1 ? 's' : ''}
          </div>
          ${added.map(s => `
            <div class="seance-item seance-item--add">
              <span class="seance-item-class">${escHtml(s.classe)}</span>
              <span class="seance-item-sep">·</span>
              <span class="seance-item-prof">${escHtml(s.prof)}</span>
              <span class="seance-item-sep">—</span>
              <span class="seance-item-act">${escHtml(s.activite)}</span>
              <span class="seance-item-sep">·</span>
              <span class="seance-item-inst">${escHtml(s.install)}</span>
              <span class="seance-item-sep">·</span>
              <span class="seance-item-time">${escHtml(s.jour)} ${escHtml(s.heureDebut)}–${escHtml(s.heureFin)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${removed.length ? `
        <div class="seance-diff-group seance-diff-group--del">
          <div class="seance-diff-group-label">
            <span class="delta-del">-${removed.length}</span> supprimée${removed.length > 1 ? 's' : ''}
          </div>
          ${removed.map(s => `
            <div class="seance-item seance-item--del">
              <span class="seance-item-class">${escHtml(s.classe)}</span>
              <span class="seance-item-sep">·</span>
              <span class="seance-item-prof">${escHtml(s.prof)}</span>
              <span class="seance-item-sep">—</span>
              <span class="seance-item-act">${escHtml(s.activite)}</span>
              <span class="seance-item-sep">·</span>
              <span class="seance-item-inst">${escHtml(s.install)}</span>
              <span class="seance-item-sep">·</span>
              <span class="seance-item-time">${escHtml(s.jour)} ${escHtml(s.heureDebut)}–${escHtml(s.heureFin)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${changed.length ? `
        <div class="seance-diff-group seance-diff-group--chg">
          <div class="seance-diff-group-label">
            <span class="delta-chg">~${changed.length}</span> modifiée${changed.length > 1 ? 's' : ''}
          </div>
          ${changed.map(c => `
            <div class="seance-item seance-item--chg">
              <div class="seance-item-header">
                <span class="seance-item-class">${escHtml(c.from.classe)}</span>
                <span class="seance-item-sep">·</span>
                <span class="seance-item-prof">${escHtml(c.from.prof)}</span>
                <span class="seance-item-sep">—</span>
                <span class="seance-item-act">${escHtml(c.from.activite)}</span>
              </div>
              ${c.changes.length ? `
                <div class="seance-item-changes">
                  ${c.changes.map(ch => `
                    <div class="seance-change-row">
                      <span class="seance-change-field">${escHtml(ch.field)}</span>
                      <span class="seance-change-from">${escHtml(ch.from)}</span>
                      <span class="seance-change-arrow">→</span>
                      <span class="seance-change-to">${escHtml(ch.to)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}
