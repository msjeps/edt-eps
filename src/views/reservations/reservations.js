/**
 * Vue Réservations — Gestion des demandes de réservation d'installations
 * Statuts : PROPOSÉ → DEMANDÉ → ACCEPTÉ / REFUSÉ
 * Filtres : par lieu, par période, par jour, par statut
 * Phase 2 : notes, barre de progression, tri colonnes
 */
import db from '../../db/schema.js';
import { toast } from '../../components/toast.js';
import { helpTip } from '../../components/help-tooltip.js';

export async function renderReservations(container) {
  const [seances, reservations, installations, lieux, classes, enseignants, periodes, activites] = await Promise.all([
    db.seances.toArray(),
    db.reservations.toArray(),
    db.installations.toArray(),
    db.lieux.toArray(),
    db.classes.toArray(),
    db.enseignants.toArray(),
    db.periodes.toArray(),
    db.activites.toArray(),
  ]);

  // Stats par statut
  const stats = { propose: 0, demande: 0, accepte: 0, refuse: 0 };
  for (const r of reservations) stats[r.statut] = (stats[r.statut] || 0) + 1;

  const total = reservations.length;
  const pctAccepte = total > 0 ? Math.round((stats.accepte / total) * 100) : 0;
  const progressColor = pctAccepte >= 80 ? 'var(--c-success)'
    : pctAccepte >= 50 ? 'var(--c-warning)'
    : 'var(--c-danger)';

  const lieuxUtilises = lieux.filter(l => installations.some(i => i.lieuId === l.id));
  const joursOrdre = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
  const joursDisponibles = [...new Set(
    reservations.map(r => seances.find(s => s.id === r.seanceId)?.jour).filter(Boolean)
  )].sort((a, b) => joursOrdre.indexOf(a) - joursOrdre.indexOf(b));

  // État de tri (persiste entre les changements de filtre)
  let sortCol = 'lieu';
  let sortDir = 1;

  container.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4);">
        <h2>Réservations d'installations</h2>
        <button class="btn btn-sm btn-primary" id="resa-generate">Générer depuis l'EDT</button>
      </div>

      <!-- Compteurs cliquables -->
      <div class="stats-grid" style="margin-bottom:var(--sp-3);">
        <button class="stat-card resa-stat-btn" data-statut="propose" title="Filtrer sur Proposées">
          <div class="stat-value">${stats.propose}</div>
          <div class="stat-label">Proposées</div>
        </button>
        <button class="stat-card resa-stat-btn" data-statut="demande" title="Filtrer sur Demandées">
          <div class="stat-value" style="color:var(--c-info);">${stats.demande}</div>
          <div class="stat-label">Demandées</div>
        </button>
        <button class="stat-card resa-stat-btn" data-statut="accepte" title="Filtrer sur Acceptées">
          <div class="stat-value" style="color:var(--c-success);">${stats.accepte}</div>
          <div class="stat-label">Acceptées</div>
        </button>
        <button class="stat-card resa-stat-btn" data-statut="refuse" title="Filtrer sur Refusées">
          <div class="stat-value" style="color:var(--c-danger);">${stats.refuse}</div>
          <div class="stat-label">Refusées</div>
        </button>
      </div>

      <!-- Barre de progression globale -->
      ${total > 0 ? `
      <div style="margin-bottom:var(--sp-4);">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--sp-1);">
          <span style="font-size:var(--fs-xs);color:var(--c-text-muted);font-weight:500;text-transform:uppercase;letter-spacing:.05em;">Progression</span>
          <span id="resa-progress-label" style="font-size:var(--fs-xs);color:var(--c-text-muted);">${stats.accepte} / ${total} acceptées (${pctAccepte} %)</span>
        </div>
        <div style="height:6px;background:var(--c-border);border-radius:99px;overflow:hidden;">
          <div id="resa-progress-fill" style="height:100%;width:${pctAccepte}%;background:${progressColor};border-radius:99px;transition:width .3s ease;"></div>
        </div>
      </div>
      ` : ''}

      ${reservations.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">&#128203;</div>
          <div class="empty-state-title">Aucune réservation</div>
          <div class="empty-state-text">Cliquez sur "Générer depuis l'EDT" pour créer les réservations à partir des séances planifiées.</div>
        </div>
      ` : `
        <!-- Barre d'actions groupées (masquée par défaut) -->
        <div id="resa-bulk-bar" class="card" style="display:none;margin-bottom:var(--sp-2);padding:var(--sp-2) var(--sp-3);background:var(--c-primary-bg);border-color:var(--c-primary-light);">
          <div style="display:flex;gap:var(--sp-3);align-items:center;">
            <span id="resa-bulk-count" style="font-weight:600;font-size:var(--fs-sm);"></span>
            <select class="form-select" id="resa-bulk-statut" style="min-width:130px;">
              <option value="">Changer vers…</option>
              <option value="propose">Proposé</option>
              <option value="demande">Demandé</option>
              <option value="accepte">Accepté</option>
              <option value="refuse">Refusé</option>
            </select>
            <button class="btn btn-sm btn-primary" id="resa-bulk-apply">Appliquer</button>
            <button class="btn btn-sm btn-outline" id="resa-bulk-deselect">Désélectionner tout</button>
          </div>
        </div>

        <!-- Filtres -->
        <div class="card" style="margin-bottom:var(--sp-3);padding:var(--sp-3);">
          <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap;">
            <span style="font-weight:600;font-size:var(--fs-sm);color:var(--c-text-muted);">Filtres :</span>

            <select class="form-select" id="resa-filter-lieu" style="min-width:140px;">
              <option value="">Tous les lieux</option>
              ${lieuxUtilises.map(l => `<option value="${l.id}">${l.nom}</option>`).join('')}
            </select>

            <select class="form-select" id="resa-filter-periode" style="min-width:140px;">
              <option value="">Toutes les périodes</option>
              ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
            </select>

            <select class="form-select" id="resa-filter-jour" style="min-width:120px;">
              <option value="">Tous les jours</option>
              ${joursDisponibles.map(j => `<option value="${j}">${j.charAt(0).toUpperCase() + j.slice(1)}</option>`).join('')}
            </select>

            <select class="form-select" id="resa-filter-statut" style="min-width:130px;">
              <option value="">Tous les statuts</option>
              <option value="propose">Proposé</option>
              <option value="demande">Demandé</option>
              <option value="accepte">Accepté</option>
              <option value="refuse">Refusé</option>
            </select>

            <button class="btn btn-sm btn-outline" id="resa-tout-demander"
                    title="Passer toutes les réservations Proposées en Demandées">
              Tout demander
            </button>

            <button class="btn btn-outline btn-sm" id="resa-clear-filters" title="Réinitialiser les filtres"
                    style="padding:4px 10px;">&#10006; Réinitialiser</button>

            <span id="resa-count" style="margin-left:auto;font-size:var(--fs-xs);color:var(--c-text-muted);">
              ${reservations.length} réservation(s)
            </span>
          </div>
        </div>

        <div class="card">
          <table class="data-table" id="resa-table">
            <thead>
              <tr>
                <th style="width:32px;padding-left:var(--sp-3);">
                  <input type="checkbox" id="resa-check-all" title="Tout sélectionner / désélectionner">
                </th>
                <th class="resa-th-sort" data-col="lieu">Lieu</th>
                <th class="resa-th-sort" data-col="installation">Installation</th>
                <th class="resa-th-sort" data-col="periode">Période</th>
                <th class="resa-th-sort" data-col="jour">Jour</th>
                <th class="resa-th-sort" data-col="creneau">Créneau</th>
                <th class="resa-th-sort" data-col="classe">Classe</th>
                <th class="resa-th-sort" data-col="activite">Activité</th>
                <th class="resa-th-sort" data-col="statut">Statut ${helpTip('reservationStatut')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="resa-tbody"></tbody>
          </table>
        </div>
      `}
    </div>
  `;

  // Données enrichies (calculées une fois)
  const enriched = reservations.map(r => {
    const seance = seances.find(s => s.id === r.seanceId);
    const inst = installations.find(i => i.id === r.installationId);
    const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;
    const per = periodes.find(p => p.id === r.periodeId);
    const cls = seance ? classes.find(c => c.id === seance.classeId) : null;
    const act = seance ? activites.find(a => a.id === seance.activiteId) : null;
    return { r, seance, inst, lieu, per, cls, act };
  });

  // Sync statut vers la programmation associée
  async function syncProgrammation(resaId, newStatut) {
    const resa = reservations.find(r => r.id === resaId);
    if (!resa) return;
    const seance = seances.find(s => s.id === resa.seanceId);
    if (seance && seance.classeId && resa.installationId && resa.periodeId) {
      const progStatut = newStatut === 'accepte' ? 'accepte'
        : newStatut === 'refuse' ? 'a_reconsiderer' : 'propose';
      await db.programmations
        .filter(p => p.classeId === seance.classeId &&
                     p.installationId === resa.installationId &&
                     p.periodeId === resa.periodeId)
        .modify({ statut: progStatut });
    }
  }

  // Met à jour la visibilité et le compteur de la barre bulk
  function updateBulkBar() {
    const checked = container.querySelectorAll('.resa-check:checked');
    const bar = container.querySelector('#resa-bulk-bar');
    const countEl = container.querySelector('#resa-bulk-count');
    if (!bar) return;
    bar.style.display = checked.length === 0 ? 'none' : '';
    if (countEl) countEl.textContent = `${checked.length} sélectionnée(s)`;
  }

  // Valeur de tri pour une colonne donnée
  function sortValue(e, col) {
    switch (col) {
      case 'lieu':         return (e.lieu?.nom || '').toLowerCase();
      case 'installation': return (e.inst?.nom || '').toLowerCase();
      case 'periode':      return (e.per?.nom || '').toLowerCase();
      case 'jour':         return joursOrdre.indexOf(e.seance?.jour ?? '') ?? 9;
      case 'creneau':      return e.seance?.heureDebut || '';
      case 'classe':       return (e.cls?.nom || '').toLowerCase();
      case 'activite':     return (e.act?.nom || '').toLowerCase();
      case 'statut':       return ['propose', 'demande', 'accepte', 'refuse'].indexOf(e.r.statut);
      default:             return '';
    }
  }

  // Met à jour les indicateurs de tri dans les en-têtes
  function updateSortIndicators() {
    container.querySelectorAll('.resa-th-sort').forEach(th => {
      const col = th.dataset.col;
      const base = th.dataset.label || th.textContent.replace(/[▲▼\s]+$/, '').trimEnd();
      th.dataset.label = base;
      if (col === sortCol) {
        th.innerHTML = `${base} <span class="resa-sort-icon resa-sort-icon--active">${sortDir === 1 ? '▲' : '▼'}</span>`;
      } else {
        th.innerHTML = `${base} <span class="resa-sort-icon">▲</span>`;
      }
    });
  }

  // Ouvre l'édition inline d'une note
  function openNoteEdit(resaId, noteDisplayEl) {
    const currentNote = noteDisplayEl.dataset.note || '';
    noteDisplayEl.innerHTML = `
      <div style="display:flex;gap:4px;align-items:center;margin-top:4px;">
        <input class="form-input resa-note-input" type="text" value="${currentNote.replace(/"/g, '&quot;')}"
               placeholder="Ajouter une note…"
               style="flex:1;padding:2px 6px;font-size:var(--fs-xs);">
        <button class="btn-icon-sm resa-note-save" title="Enregistrer">✓</button>
        <button class="btn-icon-sm resa-note-cancel" title="Annuler">✕</button>
      </div>
    `;
    const input = noteDisplayEl.querySelector('.resa-note-input');
    const saveBtn = noteDisplayEl.querySelector('.resa-note-save');
    const cancelBtn = noteDisplayEl.querySelector('.resa-note-cancel');

    input.focus();
    input.select();

    async function saveNote() {
      const newNote = input.value.trim();
      await db.reservations.update(resaId, { note: newNote });
      const e = enriched.find(e => e.r.id === resaId);
      if (e) e.r.note = newNote;
      renderNoteDisplay(noteDisplayEl, newNote);
    }

    function cancelEdit() {
      renderNoteDisplay(noteDisplayEl, currentNote);
    }

    saveBtn.addEventListener('click', saveNote);
    cancelBtn.addEventListener('click', cancelEdit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); saveNote(); }
      if (e.key === 'Escape') cancelEdit();
    });
  }

  function renderNoteDisplay(el, note) {
    el.dataset.note = note || '';
    if (note) {
      el.innerHTML = `<div class="resa-note-text">${note}</div>`;
    } else {
      el.innerHTML = '';
    }
  }

  // Rendu du tableau selon les filtres et le tri actifs
  function renderFiltered() {
    const filterLieu = container.querySelector('#resa-filter-lieu')?.value || '';
    const filterPeriode = container.querySelector('#resa-filter-periode')?.value || '';
    const filterJour = container.querySelector('#resa-filter-jour')?.value || '';
    const filterStatut = container.querySelector('#resa-filter-statut')?.value || '';

    container.querySelectorAll('.resa-stat-btn').forEach(btn => {
      btn.classList.toggle('resa-stat-btn--active', btn.dataset.statut === filterStatut);
    });

    let filtered = enriched;
    if (filterLieu) filtered = filtered.filter(e => e.lieu?.id === parseInt(filterLieu));
    if (filterPeriode) filtered = filtered.filter(e => e.r.periodeId === parseInt(filterPeriode));
    if (filterJour) filtered = filtered.filter(e => e.seance?.jour === filterJour);
    if (filterStatut) filtered = filtered.filter(e => e.r.statut === filterStatut);

    // Tri dynamique
    filtered = [...filtered].sort((a, b) => {
      const vA = sortValue(a, sortCol);
      const vB = sortValue(b, sortCol);
      if (vA < vB) return -sortDir;
      if (vA > vB) return sortDir;
      // Tri secondaire stable : lieu → installation → jour → heure
      const lieuCmp = (a.lieu?.nom || '').localeCompare(b.lieu?.nom || '');
      if (lieuCmp !== 0) return lieuCmp;
      const jA = joursOrdre.indexOf(a.seance?.jour ?? '');
      const jB = joursOrdre.indexOf(b.seance?.jour ?? '');
      if (jA !== jB) return jA - jB;
      return (a.seance?.heureDebut || '').localeCompare(b.seance?.heureDebut || '');
    });

    updateSortIndicators();

    const tbody = container.querySelector('#resa-tbody');
    if (!tbody) return;

    tbody.innerHTML = filtered.map(({ r, seance, inst, lieu, per, cls, act }) => `
      <tr>
        <td style="padding-left:var(--sp-3);">
          <input type="checkbox" class="resa-check" data-id="${r.id}">
        </td>
        <td><strong>${lieu?.nom || '-'}</strong></td>
        <td>${inst?.nom || '-'}</td>
        <td>${per?.nom || '-'}</td>
        <td>${seance?.jour ? seance.jour.charAt(0).toUpperCase() + seance.jour.slice(1) : '-'}</td>
        <td>${seance ? seance.heureDebut + '-' + seance.heureFin : '-'}</td>
        <td>${cls?.nom || '-'}</td>
        <td>${act?.nom || '-'}</td>
        <td>
          <span class="reservation-status ${r.statut}">${statusLabel(r.statut)}</span>
          <div class="resa-note-display" data-id="${r.id}" data-note="${(r.note || '').replace(/"/g, '&quot;')}">
            ${r.note ? `<div class="resa-note-text">${r.note}</div>` : ''}
          </div>
        </td>
        <td style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
          <select class="form-select resa-status-change" data-id="${r.id}"
                  style="padding:2px 6px;font-size:var(--fs-xs);width:110px;">
            <option value="propose" ${r.statut === 'propose' ? 'selected' : ''}>Proposé</option>
            <option value="demande" ${r.statut === 'demande' ? 'selected' : ''}>Demandé</option>
            <option value="accepte" ${r.statut === 'accepte' ? 'selected' : ''}>Accepté</option>
            <option value="refuse" ${r.statut === 'refuse' ? 'selected' : ''}>Refusé</option>
          </select>
          <button class="btn-icon-sm resa-note-btn" data-id="${r.id}" title="${r.note ? 'Modifier la note' : 'Ajouter une note'}">✏️</button>
        </td>
      </tr>
    `).join('');

    const countEl = container.querySelector('#resa-count');
    if (countEl) countEl.textContent = `${filtered.length} / ${reservations.length} réservation(s)`;

    // Bouton "Tout demander" : proposées dans le contexte lieu/période/jour actuel
    const proposeesCtx = enriched.filter(e => {
      if (filterLieu && e.lieu?.id !== parseInt(filterLieu)) return false;
      if (filterPeriode && e.r.periodeId !== parseInt(filterPeriode)) return false;
      if (filterJour && e.seance?.jour !== filterJour) return false;
      return e.r.statut === 'propose';
    });
    const btnTD = container.querySelector('#resa-tout-demander');
    if (btnTD) {
      btnTD.disabled = proposeesCtx.length === 0;
      btnTD.textContent = `Tout demander (${proposeesCtx.length})`;
    }

    const checkAll = container.querySelector('#resa-check-all');
    if (checkAll) checkAll.checked = false;
    updateBulkBar();

    // Bind : changement de statut individuel
    container.querySelectorAll('.resa-status-change').forEach(select => {
      select.addEventListener('change', async () => {
        const id = parseInt(select.dataset.id);
        const newStatut = select.value;
        await db.reservations.update(id, { statut: newStatut });
        await syncProgrammation(id, newStatut);
        toast.info(`Statut → ${statusLabel(newStatut)}`);
        renderReservations(container);
      });
    });

    // Bind : cases à cocher individuelles
    container.querySelectorAll('.resa-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const all = container.querySelectorAll('.resa-check');
        const checked = container.querySelectorAll('.resa-check:checked');
        const checkAll = container.querySelector('#resa-check-all');
        if (checkAll) checkAll.checked = all.length > 0 && checked.length === all.length;
        updateBulkBar();
      });
    });

    // Bind : boutons note (crayon)
    container.querySelectorAll('.resa-note-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const noteDisplayEl = container.querySelector(`.resa-note-display[data-id="${id}"]`);
        if (noteDisplayEl) openNoteEdit(id, noteDisplayEl);
      });
    });
  }

  // Premier rendu
  renderFiltered();

  // Bind filtres
  ['resa-filter-lieu', 'resa-filter-periode', 'resa-filter-jour', 'resa-filter-statut'].forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener('change', renderFiltered);
  });

  // Réinitialiser tous les filtres
  container.querySelector('#resa-clear-filters')?.addEventListener('click', () => {
    container.querySelector('#resa-filter-lieu').value = '';
    container.querySelector('#resa-filter-periode').value = '';
    container.querySelector('#resa-filter-jour').value = '';
    container.querySelector('#resa-filter-statut').value = '';
    renderFiltered();
  });

  // Stat cards cliquables — toggle le filtre statut
  container.querySelectorAll('.resa-stat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const select = container.querySelector('#resa-filter-statut');
      if (!select) return;
      select.value = select.value === btn.dataset.statut ? '' : btn.dataset.statut;
      renderFiltered();
    });
  });

  // En-têtes triables
  container.querySelectorAll('.resa-th-sort').forEach(th => {
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = -sortDir;
      } else {
        sortCol = col;
        sortDir = 1;
      }
      renderFiltered();
    });
  });

  // Tout sélectionner / désélectionner via la case d'en-tête
  container.querySelector('#resa-check-all')?.addEventListener('change', e => {
    container.querySelectorAll('.resa-check').forEach(cb => { cb.checked = e.target.checked; });
    updateBulkBar();
  });

  // Barre bulk — désélectionner tout
  container.querySelector('#resa-bulk-deselect')?.addEventListener('click', () => {
    container.querySelectorAll('.resa-check').forEach(cb => { cb.checked = false; });
    const checkAll = container.querySelector('#resa-check-all');
    if (checkAll) checkAll.checked = false;
    updateBulkBar();
  });

  // Barre bulk — appliquer le changement de statut
  container.querySelector('#resa-bulk-apply')?.addEventListener('click', async () => {
    const newStatut = container.querySelector('#resa-bulk-statut')?.value;
    if (!newStatut) { toast.warning('Choisissez un statut cible'); return; }
    const checked = [...container.querySelectorAll('.resa-check:checked')];
    if (checked.length === 0) return;
    for (const cb of checked) {
      const id = parseInt(cb.dataset.id);
      await db.reservations.update(id, { statut: newStatut });
      await syncProgrammation(id, newStatut);
    }
    toast.success(`${checked.length} réservation(s) → ${statusLabel(newStatut)}`);
    renderReservations(container);
  });

  // Tout demander — proposées du contexte filtré → demandées
  container.querySelector('#resa-tout-demander')?.addEventListener('click', async () => {
    const filterLieu = container.querySelector('#resa-filter-lieu')?.value || '';
    const filterPeriode = container.querySelector('#resa-filter-periode')?.value || '';
    const filterJour = container.querySelector('#resa-filter-jour')?.value || '';
    const proposeesCtx = enriched.filter(e => {
      if (filterLieu && e.lieu?.id !== parseInt(filterLieu)) return false;
      if (filterPeriode && e.r.periodeId !== parseInt(filterPeriode)) return false;
      if (filterJour && e.seance?.jour !== filterJour) return false;
      return e.r.statut === 'propose';
    });
    if (proposeesCtx.length === 0) return;
    if (!confirm(`${proposeesCtx.length} réservation(s) vont passer en "Demandé". Confirmer ?`)) return;
    for (const e of proposeesCtx) {
      await db.reservations.update(e.r.id, { statut: 'demande' });
      await syncProgrammation(e.r.id, 'demande');
    }
    toast.success(`${proposeesCtx.length} réservation(s) passées en Demandé`);
    renderReservations(container);
  });

  // Générer les réservations depuis les séances de l'EDT
  container.querySelector('#resa-generate')?.addEventListener('click', async () => {
    let count = 0;
    const existingKeys = new Set(reservations.map(r => `${r.seanceId}-${r.installationId}`));
    for (const s of seances) {
      if (!s.installationId) continue;
      if (existingKeys.has(`${s.id}-${s.installationId}`)) continue;
      await db.reservations.add({
        seanceId: s.id,
        installationId: s.installationId,
        statut: 'propose',
        periodeId: s.periodeId,
        dates: [],
      });
      count++;
    }
    toast[count > 0 ? 'success' : 'info'](
      count > 0 ? `${count} réservation(s) générée(s)` : 'Toutes les réservations sont déjà à jour'
    );
    renderReservations(container);
  });
}

function statusLabel(statut) {
  return { propose: 'Proposé', demande: 'Demandé', accepte: 'Accepté', refuse: 'Refusé' }[statut] || statut;
}
