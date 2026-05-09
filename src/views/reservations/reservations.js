/**
 * Vue Réservations — Gestion des demandes de réservation d'installations
 * Statuts : PROPOSÉ → DEMANDÉ → ACCEPTÉ / REFUSÉ
 * Filtres : par lieu, par période, par jour
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

  // Grouper les séances par installation et période pour créer les réservations
  const installationsAvecSeances = {};
  for (const s of seances) {
    if (!s.installationId) continue;
    const key = `${s.installationId}-${s.periodeId || 'all'}`;
    if (!installationsAvecSeances[key]) {
      installationsAvecSeances[key] = {
        installationId: s.installationId,
        periodeId: s.periodeId,
        seances: [],
      };
    }
    installationsAvecSeances[key].seances.push(s);
  }

  // Stats par statut
  const stats = { propose: 0, demande: 0, accepte: 0, refuse: 0 };
  for (const r of reservations) {
    stats[r.statut] = (stats[r.statut] || 0) + 1;
  }

  // Lieux uniques (qui ont des installations)
  const lieuxUtilises = lieux.filter(l =>
    installations.some(i => i.lieuId === l.id)
  );

  // Jours disponibles dans les réservations
  const joursOrdre = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
  const joursDisponibles = [...new Set(
    reservations.map(r => {
      const seance = seances.find(s => s.id === r.seanceId);
      return seance?.jour;
    }).filter(Boolean)
  )].sort((a, b) => joursOrdre.indexOf(a) - joursOrdre.indexOf(b));

  container.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4);">
        <h2>Réservations d'installations</h2>
        <button class="btn btn-sm btn-primary" id="resa-generate">Générer depuis l'EDT</button>
      </div>

      <div class="stats-grid" style="margin-bottom:var(--sp-4);">
        <div class="stat-card">
          <div class="stat-value">${stats.propose}</div>
          <div class="stat-label">Proposées</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--c-info);">${stats.demande}</div>
          <div class="stat-label">Demandées</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--c-success);">${stats.accepte}</div>
          <div class="stat-label">Acceptées</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--c-danger);">${stats.refuse}</div>
          <div class="stat-label">Refusées</div>
        </div>
      </div>

      ${reservations.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">&#128203;</div>
          <div class="empty-state-title">Aucune réservation</div>
          <div class="empty-state-text">Cliquez sur "Générer depuis l'EDT" pour créer les réservations à partir des séances planifiées.</div>
        </div>
      ` : `
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
                <th>Lieu</th><th>Installation</th><th>Période</th><th>Jour</th>
                <th>Créneau</th><th>Classe</th><th>Activité</th><th>Statut ${helpTip('reservationStatut')}</th><th>Actions</th>
              </tr>
            </thead>
            <tbody id="resa-tbody">
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  // Pré-calculer les données enrichies pour chaque réservation
  const enriched = reservations.map(r => {
    const seance = seances.find(s => s.id === r.seanceId);
    const inst = installations.find(i => i.id === r.installationId);
    const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;
    const per = periodes.find(p => p.id === r.periodeId);
    const cls = seance ? classes.find(c => c.id === seance.classeId) : null;
    const act = seance ? activites.find(a => a.id === seance.activiteId) : null;
    return { r, seance, inst, lieu, per, cls, act };
  });

  // Fonction de rendu filtré
  function renderFiltered() {
    const filterLieu = container.querySelector('#resa-filter-lieu')?.value || '';
    const filterPeriode = container.querySelector('#resa-filter-periode')?.value || '';
    const filterJour = container.querySelector('#resa-filter-jour')?.value || '';

    let filtered = enriched;

    if (filterLieu) {
      filtered = filtered.filter(e => e.lieu?.id === parseInt(filterLieu));
    }
    if (filterPeriode) {
      filtered = filtered.filter(e => e.r.periodeId === parseInt(filterPeriode));
    }
    if (filterJour) {
      filtered = filtered.filter(e => e.seance?.jour === filterJour);
    }

    // Tri par lieu → installation → jour → heure
    filtered.sort((a, b) => {
      const lieuA = (a.lieu?.nom || '').toLowerCase();
      const lieuB = (b.lieu?.nom || '').toLowerCase();
      if (lieuA !== lieuB) return lieuA.localeCompare(lieuB);

      const instA = (a.inst?.nom || '').toLowerCase();
      const instB = (b.inst?.nom || '').toLowerCase();
      if (instA !== instB) return instA.localeCompare(instB);

      const jourOrdre = { lundi: 0, mardi: 1, mercredi: 2, jeudi: 3, vendredi: 4 };
      const jA = jourOrdre[a.seance?.jour] ?? 9;
      const jB = jourOrdre[b.seance?.jour] ?? 9;
      if (jA !== jB) return jA - jB;

      const hA = a.seance?.heureDebut || '';
      const hB = b.seance?.heureDebut || '';
      return hA.localeCompare(hB);
    });

    const tbody = container.querySelector('#resa-tbody');
    if (!tbody) return;

    tbody.innerHTML = filtered.map(({ r, seance, inst, lieu, per, cls, act }) => `
      <tr>
        <td><strong>${lieu?.nom || '-'}</strong></td>
        <td>${inst?.nom || '-'}</td>
        <td>${per?.nom || '-'}</td>
        <td>${seance?.jour ? seance.jour.charAt(0).toUpperCase() + seance.jour.slice(1) : '-'}</td>
        <td>${seance ? seance.heureDebut + '-' + seance.heureFin : '-'}</td>
        <td>${cls?.nom || '-'}</td>
        <td>${act?.nom || '-'}</td>
        <td>
          <span class="reservation-status ${r.statut}">${statusLabel(r.statut)}</span>
        </td>
        <td>
          <select class="form-select resa-status-change" data-id="${r.id}"
                  style="padding:2px 6px;font-size:var(--fs-xs);width:110px;">
            <option value="propose" ${r.statut === 'propose' ? 'selected' : ''}>Proposé</option>
            <option value="demande" ${r.statut === 'demande' ? 'selected' : ''}>Demandé</option>
            <option value="accepte" ${r.statut === 'accepte' ? 'selected' : ''}>Accepté</option>
            <option value="refuse" ${r.statut === 'refuse' ? 'selected' : ''}>Refusé</option>
          </select>
        </td>
      </tr>
    `).join('');

    // Compteur
    const countEl = container.querySelector('#resa-count');
    if (countEl) {
      countEl.textContent = `${filtered.length} / ${reservations.length} réservation(s)`;
    }

    // Rebind changements de statut
    container.querySelectorAll('.resa-status-change').forEach(select => {
      select.addEventListener('change', async () => {
        const id = parseInt(select.dataset.id);
        const newStatut = select.value;
        await db.reservations.update(id, { statut: newStatut });

        // Sync vers la programmation correspondante
        const resa = reservations.find(r => r.id === id);
        if (resa) {
          const seance = seances.find(s => s.id === resa.seanceId);
          if (seance && seance.classeId && resa.installationId && resa.periodeId) {
            const progStatut = newStatut === 'accepte' ? 'accepte' :
              newStatut === 'refuse' ? 'a_reconsiderer' : 'propose';
            await db.programmations
              .filter(p => p.classeId === seance.classeId &&
                           p.installationId === resa.installationId &&
                           p.periodeId === resa.periodeId)
              .modify({ statut: progStatut });
          }
        }

        toast.info(`Statut → ${statusLabel(newStatut)}`);
        renderReservations(container);
      });
    });
  }

  // Premier rendu
  renderFiltered();

  // Bind filtres
  ['resa-filter-lieu', 'resa-filter-periode', 'resa-filter-jour'].forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener('change', renderFiltered);
  });

  // Réinitialiser filtres
  container.querySelector('#resa-clear-filters')?.addEventListener('click', () => {
    container.querySelector('#resa-filter-lieu').value = '';
    container.querySelector('#resa-filter-periode').value = '';
    container.querySelector('#resa-filter-jour').value = '';
    renderFiltered();
  });

  // Générer réservations depuis l'EDT
  container.querySelector('#resa-generate')?.addEventListener('click', async () => {
    let count = 0;
    const existingKeys = new Set(reservations.map(r => `${r.seanceId}-${r.installationId}`));

    for (const s of seances) {
      if (!s.installationId) continue;
      const key = `${s.id}-${s.installationId}`;
      if (existingKeys.has(key)) continue;

      await db.reservations.add({
        seanceId: s.id,
        installationId: s.installationId,
        statut: 'propose',
        periodeId: s.periodeId,
        dates: [],
      });
      count++;
    }

    if (count > 0) {
      toast.success(`${count} réservation(s) générée(s)`);
    } else {
      toast.info('Toutes les réservations sont déjà à jour');
    }
    renderReservations(container);
  });
}

function statusLabel(statut) {
  return { propose: 'Proposé', demande: 'Demandé', accepte: 'Accepté', refuse: 'Refusé' }[statut] || statut;
}
