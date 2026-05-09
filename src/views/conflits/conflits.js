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
  const [seances, classes, installations, activites, enseignants, indisponibilites,
    maxHeures, ctMax, ctEcart, ct1prof] = await Promise.all([
    db.seances.toArray(),
    db.classes.toArray(),
    db.installations.toArray(),
    db.activites.toArray(),
    db.enseignants.toArray(),
    db.indisponibilites.toArray(),
    getConfig('maxHeuresJourProf'),
    getConfig('contrainte_max_heures_actif'),
    getConfig('contrainte_ecart_24h_actif'),
    getConfig('contrainte_1prof_1classe_actif'),
  ]);

  const context = {
    seances, classes, installations, activites, enseignants, indisponibilites,
    maxHeuresJour: maxHeures ?? 6,
    contrainte_max_heures_actif: ctMax ?? true,
    contrainte_ecart_24h_actif: ctEcart ?? true,
    contrainte_1prof_1classe_actif: ct1prof ?? true,
  };
  const conflits = validerToutesSeances(context);
  updateConflictBadge(conflits.length);

  container.innerHTML = `
    <div style="max-width:900px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4);">
        <h2>Conflits & Alertes</h2>
        <div style="display:flex;gap:var(--sp-2);align-items:center;">
          <button class="btn btn-outline btn-sm" id="btn-refresh-conflits" title="Recalculer les conflits">&#x21bb; Actualiser</button>
          <span class="tag ${conflits.length > 0 ? 'tag-danger' : 'tag-success'}" style="font-size:var(--fs-sm);padding:6px 14px;">
            ${conflits.length} conflit${conflits.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <p style="color:var(--c-text-muted);font-size:var(--fs-xs);margin-bottom:var(--sp-3);">
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
  const { enseignants, classes, installations, activites } = context;

  // Infos sur la séance en conflit
  const seance = conflit.seance;
  const ens = enseignants.find(e => e.id === seance?.enseignantId);
  const cls = classes.find(c => c.id === seance?.classeId);

  // Icône et sévérité
  const icons = {
    conflit_enseignant: '&#129489;',
    conflit_classe: '&#127979;',
    conflit_installation: '&#127963;',
    ecart_24h: '&#9200;',
    max_heures_jour: '&#9888;',
    incompatibilite: '&#10060;',
    indisponibilite: '&#128683;',
  };

  const labels = {
    conflit_enseignant: 'Conflit enseignant',
    conflit_classe: 'Conflit classe',
    conflit_installation: 'Capacité installation',
    ecart_24h: 'Écart 24h (collège)',
    max_heures_jour: 'Dépassement heures/jour',
    incompatibilite: 'Incompatibilité activité',
    indisponibilite: 'Indisponibilité',
  };

  // Générer suggestions
  const suggestions = genererSuggestions(conflit, context);

  return `
    <div class="conflict-item severity-${conflit.severity === 'high' ? 'high' : 'medium'}">
      <div class="conflict-icon" style="background:${conflit.severity === 'high' ? '#fee2e2' : '#fef3c7'};">
        ${icons[conflit.type] || '&#9888;'}
      </div>
      <div class="conflict-body">
        <div class="conflict-title">
          ${labels[conflit.type] || conflit.type}
        </div>
        <div class="conflict-desc">
          ${conflit.message}
          ${seance ? `<br><strong>${cls?.nom || '?'}</strong> — ${ens ? ens.prenom + ' ' + ens.nom : '?'} — ${seance.jour} ${seance.heureDebut}-${seance.heureFin}` : ''}
        </div>
        ${suggestions.length > 0 ? `
          <div class="conflict-actions">
            ${suggestions.map((sug, si) => `
              <button class="conflict-suggestion" data-conflit-idx="${index}" data-sug-idx="${si}"
                      title="Score: ${sug.score}/10">
                ${sug.description}
              </button>
            `).join('')}
          </div>
        ` : '<div style="font-size:var(--fs-xs);color:var(--c-text-muted);margin-top:4px;">Aucune suggestion automatique disponible</div>'}
      </div>
    </div>
  `;
}
