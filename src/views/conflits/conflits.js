/**
 * Vue Conflits — Tableau actionnable avec suggestions de résolution
 */
import db from '../../db/schema.js';
import { getConfig } from '../../db/schema.js';
import { validerToutesSeances } from '../../engine/constraints.js';
import { genererSuggestions, appliquerSuggestion } from '../../engine/conflicts.js';
import { toast } from '../../components/toast.js';
import { updateConflictBadge } from '../../app.js';
import { seanceStore } from '../../db/store.js';

export async function renderConflits(container) {
  const [seances, classes, installations, lieux, periodes, activites, enseignants, indisponibilites,
    reservations, maxHeures, ctMax, ctEcart, ct1prof] = await Promise.all([
    db.seances.toArray(),
    db.classes.toArray(),
    db.installations.toArray(),
    db.lieux.toArray(),
    db.periodes.toArray(),
    db.activites.toArray(),
    db.enseignants.toArray(),
    db.indisponibilites.toArray(),
    db.reservations.toArray(),
    getConfig('maxHeuresJourProf'),
    getConfig('contrainte_max_heures_actif'),
    getConfig('contrainte_ecart_24h_actif'),
    getConfig('contrainte_1prof_1classe_actif'),
  ]);

  const context = {
    seances, classes, installations, lieux, periodes, activites, enseignants, indisponibilites,
    reservations,
    maxHeuresJour: maxHeures ?? 6,
    contrainte_max_heures_actif: ctMax ?? true,
    contrainte_ecart_24h_actif: ctEcart ?? true,
    contrainte_1prof_1classe_actif: ct1prof ?? true,
  };
  const conflits = validerToutesSeances(context);
  updateConflictBadge(conflits.length);

  container.innerHTML = `
    <div class="conflits-content">
      <div class="conflits-header-row">
        <h2>Conflits & Alertes</h2>
        <div class="conflits-actions">
          <button class="btn btn-outline btn-sm" id="btn-refresh-conflits" title="Recalculer les conflits">&#x21bb; Actualiser</button>
          <span class="tag tag-count ${conflits.length > 0 ? 'tag-danger' : 'tag-success'}">
            ${conflits.length} conflit${conflits.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <p class="conflits-hint">
        Les conflits sont détectés <strong>par période</strong> : deux séances au même créneau mais sur des périodes différentes ne sont pas en conflit.
      </p>

      ${conflits.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">&#9989;</div>
          <div class="empty-state-title">Aucun conflit</div>
          <div class="empty-state-text">Toutes les séances respectent les contraintes.</div>
        </div>
      ` : `
        <div id="conflits-list">
          ${conflits.map((c, idx) => renderConflit(c, idx, context)).join('')}
        </div>
      `}
    </div>
  `;

  // Bind refresh
  container.querySelector('#btn-refresh-conflits')?.addEventListener('click', () => {
    renderConflits(container);
  });

  // Bind suggestions
  container.querySelectorAll('.conflict-suggestion').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.conflitIdx);
      const sugIdx = parseInt(btn.dataset.sugIdx);
      const conflit = conflits[idx];
      if (!conflit) return;

      const suggestions = genererSuggestions(conflit, context);
      const suggestion = suggestions[sugIdx];
      if (!suggestion) return;

      try {
        await appliquerSuggestion(suggestion, seanceStore);
        toast.success('Suggestion appliquée');
        renderConflits(container);
      } catch (e) {
        toast.error('Erreur: ' + e.message);
      }
    });
  });
}

function renderConflit(conflit, index, context) {
  const { enseignants, classes, installations, lieux = [], periodes = [], activites } = context;

  const seance = conflit.seance;
  const ens = enseignants.find(e => e.id === seance?.enseignantId);
  const cls = classes.find(c => c.id === seance?.classeId);
  const act = activites.find(a => a.id === seance?.activiteId);
  const periode = periodes.find(p => p.id === seance?.periodeId);

  // Installation principale (multi-install : prendre la première)
  const instId = seance?.installationsIds?.[0] || seance?.installationId || null;
  const inst = instId ? installations.find(i => i.id === instId) : null;
  const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;

  const icons = {
    conflit_enseignant:         '&#129489;',
    conflit_classe:             '&#127979;',
    conflit_installation:       '&#127963;',
    ecart_24h:                  '&#9200;',
    max_heures_jour:            '&#9888;',
    incompatibilite:            '&#10060;',
    indisponibilite_enseignant: '&#128683;',
    indisponibilite_installation:'&#127963;',
    installation_manquante:     '&#128204;',
    reservation_refusee:        '&#128683;',
  };

  const labels = {
    conflit_enseignant:         'Conflit enseignant',
    conflit_classe:             'Conflit classe',
    conflit_installation:       'Capacité installation',
    ecart_24h:                  'Écart 24h (collège)',
    max_heures_jour:            'Dépassement heures/jour',
    incompatibilite:            'Incompatibilité activité',
    indisponibilite_enseignant: 'Absence prof',
    indisponibilite_installation:'Indisponibilité installation',
    installation_manquante:     'Installation non affectée',
    reservation_refusee:        'Installation non disponible',
  };

  // Ligne de détail principale
  let detail = '';
  if (seance) {
    const classLabel = cls?.nom || '?';
    const ensLabel   = ens ? `${ens.prenom} ${ens.nom}` : '?';
    const creneauLabel = `${seance.jour} ${seance.heureDebut}–${seance.heureFin}`;
    const actLabel   = act ? ` — <em>${act.nom}</em>` : '';
    const perLabel   = periode ? ` <span class="u-muted">(${periode.nom})</span>` : '';
    detail = `<br><strong>${classLabel}</strong> — ${ensLabel} — ${creneauLabel}${actLabel}${perLabel}`;

    // Ligne installation pour les conflits qui la concernent
    if (['conflit_installation', 'indisponibilite_installation', 'incompatibilite', 'reservation_refusee'].includes(conflit.type) && inst) {
      const lieuLabel = lieu ? `${lieu.nom} › ` : '';
      detail += `<br><span class="conflict-inst-label">📍 ${lieuLabel}${inst.nom}</span>`;
    }
  }

  const suggestions = genererSuggestions(conflit, context);

  return `
    <div class="conflict-item severity-${conflit.severity === 'high' ? 'high' : 'medium'}">
      <div class="conflict-icon" style="background:${conflit.severity === 'high' ? '#fee2e2' : '#fef3c7'};">
        ${icons[conflit.type] || '&#9888;'}
      </div>
      <div class="conflict-body">
        <div class="conflict-title">${labels[conflit.type] || conflit.type}</div>
        <div class="conflict-desc">
          ${conflit.message}${detail}
        </div>
        ${suggestions.length > 0 ? `
          <div class="conflict-actions">
            ${suggestions.map((sug, si) => `
              <button class="conflict-suggestion" data-conflit-idx="${index}" data-sug-idx="${si}"
                      title="Score: ${sug.score}/10">
                ${sug.description} <span class="sug-score">(${sug.score}/10)</span>
              </button>
            `).join('')}
          </div>
        ` : '<div class="sug-empty">Aucune suggestion automatique disponible</div>'}
      </div>
    </div>
  `;
}
