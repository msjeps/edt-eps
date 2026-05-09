/**
 * Vue Dashboard — Tableau de bord principal
 */
import db from '../db/schema.js';
import { getConfig } from '../db/schema.js';
import { navigateTo, updateConflictBadge } from '../app.js';
import { validerToutesSeances } from '../engine/constraints.js';
import { validateProjectConfig } from '../engine/config-validator.js';
import { importAllData } from '../db/store.js';
import { getDemoData } from '../data/demo.js';
import { toast } from '../components/toast.js';
import { clearUndoStack } from '../utils/undo.js';


export async function renderDashboard(container) {
  const [
    enseignants, classes, activites, installations, seances,
    periodes, lieux, indisponibilites, nom, type, zone,
    ctMax, ctEcart, ct1prof,
    validation,
  ] = await Promise.all([
    db.enseignants.toArray(),
    db.classes.toArray(),
    db.activites.toArray(),
    db.installations.toArray(),
    db.seances.toArray(),
    db.periodes.toArray(),
    db.lieux.toArray(),
    db.indisponibilites.toArray(),
    getConfig('etablissementNom'),
    getConfig('etablissementType'),
    getConfig('etablissementZone'),
    getConfig('contrainte_max_heures_actif'),
    getConfig('contrainte_ecart_24h_actif'),
    getConfig('contrainte_1prof_1classe_actif'),
    validateProjectConfig(),
  ]);

  // Classes ayant au moins une séance
  const classesAvecSeance = new Set(seances.map(s => s.classeId).filter(Boolean));
  const nbClassesPlacees = classes.filter(c => classesAvecSeance.has(c.id)).length;

  // Calcul des conflits
  let nbConflits = 0;
  if (seances.length > 0) {
    const conflits = validerToutesSeances({
      seances, classes, installations, activites, indisponibilites,
      contrainte_max_heures_actif: ctMax ?? true,
      contrainte_ecart_24h_actif: ctEcart ?? true,
      contrainte_1prof_1classe_actif: ct1prof ?? true,
    });
    nbConflits = conflits.length;
  }
  updateConflictBadge(nbConflits);

  const estVide = enseignants.length === 0;

  container.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto;">
      ${nom ? `<h2 style="margin-bottom: var(--sp-2);">${nom}</h2>` : ''}
      ${type ? `<p style="color: var(--c-text-muted); margin-bottom: var(--sp-6); text-transform: capitalize;">${type}${zone ? ` — Zone ${zone}` : ''}</p>` : ''}

      ${estVide ? `
        <div class="card" style="text-align: center; padding: var(--sp-8);">
          <div style="font-size: 3rem; margin-bottom: var(--sp-4);">&#127939;</div>
          <h3 style="margin-bottom: var(--sp-2);">Bienvenue dans EDT EPS</h3>
          <p style="color: var(--c-text-secondary); margin-bottom: var(--sp-6); max-width: 500px; margin-left: auto; margin-right: auto;">
            Commencez par configurer votre établissement, vos enseignants, classes, activités et installations sportives.
          </p>
          <div style="display:flex;gap:var(--sp-3);justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-primary btn-lg" id="btn-start-wizard">
              Démarrer la configuration
            </button>
            <button class="btn btn-outline btn-lg" id="btn-load-demo" title="Charge un jeu de données fictif pour explorer l'application">
              &#128203; Charger la démo
            </button>
          </div>
          <p style="margin-top:var(--sp-3);font-size:var(--fs-sm);color:var(--c-text-muted);">
            La démo charge un collège-lycée fictif avec 5 enseignants, 12 classes et 3 trimestres.
          </p>
        </div>
      ` : `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${enseignants.length}</div>
            <div class="stat-label">Enseignants</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${classes.length}</div>
            <div class="stat-label">Classes</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${seances.length}</div>
            <div class="stat-label">Séances planifiées</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${lieux.length}</div>
            <div class="stat-label">Lieux</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${installations.length}</div>
            <div class="stat-label">Installations</div>
          </div>
          <div class="stat-card" style="display:flex;gap:0;padding:0;overflow:hidden;grid-column:span 2;">
            <div style="flex:1;padding:var(--sp-4);">
              <div class="stat-value" style="color:${nbClassesPlacees === classes.length && classes.length > 0 ? 'var(--c-success)' : nbClassesPlacees > 0 ? 'var(--c-warning,#b45309)' : 'inherit'}">
                ${nbClassesPlacees}<span style="font-size:1rem;font-weight:400;color:var(--c-text-muted);">/${classes.length}</span>
              </div>
              <div class="stat-label">Classes placées</div>
            </div>
            <div style="width:1px;background:var(--c-border);margin:var(--sp-3) 0;"></div>
            <div style="flex:1;padding:var(--sp-4);cursor:pointer;" id="stat-conflits">
              <div class="stat-value" style="color:${nbConflits > 0 ? 'var(--c-danger)' : 'var(--c-success)'}">
                ${nbConflits}
              </div>
              <div class="stat-label">Conflits</div>
            </div>
          </div>
        </div>

        ${renderValidationPanel(validation)}

        <div class="dashboard-grid">
          <div class="dashboard-card" data-goto="donnees">
            <div class="dashboard-card-icon">&#128218;</div>
            <div class="dashboard-card-title">Données</div>
            <div class="dashboard-card-desc">Gérer enseignants, classes, activités, installations</div>
          </div>
          <div class="dashboard-card" data-goto="programmation">
            <div class="dashboard-card-icon">&#128203;</div>
            <div class="dashboard-card-title">Programmation</div>
            <div class="dashboard-card-desc">Planifier activités et installations par classe et période</div>
          </div>
          <div class="dashboard-card" data-goto="edt">
            <div class="dashboard-card-icon">&#128197;</div>
            <div class="dashboard-card-title">Emploi du temps</div>
            <div class="dashboard-card-desc">Visualiser et modifier l'EDT par glisser-déposer</div>
          </div>
          <div class="dashboard-card" data-goto="reservations">
            <div class="dashboard-card-icon">&#128203;</div>
            <div class="dashboard-card-title">Réservations</div>
            <div class="dashboard-card-desc">Gérer les demandes de réservation d'installations</div>
          </div>
          <div class="dashboard-card" data-goto="exports">
            <div class="dashboard-card-icon">&#128228;</div>
            <div class="dashboard-card-title">Exports</div>
            <div class="dashboard-card-desc">CSV mairie, transport, PDF EDT, synthèses</div>
          </div>
        </div>

        <div style="margin-top: var(--sp-6);">
          <h3 style="margin-bottom: var(--sp-3);">Périodes</h3>
          <div style="display: flex; gap: var(--sp-3); flex-wrap: wrap;">
            ${periodes.map(p => `
              <div class="tag tag-primary" style="padding: 6px 12px;">
                <strong>${p.nom}</strong>
                <span style="margin-left: 8px; opacity: 0.7;">${formatPeriodeDates(p)}</span>
              </div>
            `).join('')}
            ${periodes.length === 0 ? '<span style="color: var(--c-text-muted);">Aucune période configurée</span>' : ''}
          </div>
        </div>
      `}
    </div>
  `;

  // Bind events
  container.querySelector('#btn-start-wizard')?.addEventListener('click', () => {
    navigateTo('wizard');
  });

  container.querySelector('#btn-load-demo')?.addEventListener('click', async () => {
    const ok = window.confirm(
      'Charger le jeu de données démo ?\n\nCela remplacera toutes les données actuelles avec un établissement fictif (Collège-Lycée Les Quatre Vents).'
    );
    if (!ok) return;
    try {
      await importAllData(getDemoData());
      clearUndoStack();
      toast.success('Démo chargée ! Rechargement...');
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast.error('Erreur lors du chargement de la démo : ' + err.message);
    }
  });

  container.querySelectorAll('.dashboard-card[data-goto]').forEach(card => {
    card.addEventListener('click', () => {
      navigateTo(card.dataset.goto);
    });
  });

  container.querySelector('#stat-conflits')?.addEventListener('click', () => {
    navigateTo('conflits');
  });

  // Liens "Corriger / Configurer" dans le panneau de validation
  container.querySelectorAll('.validation-goto').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.goto));
  });
}

function renderValidationPanel({ errors, warnings }) {
  if (errors.length === 0 && warnings.length === 0) {
    return `
      <div class="validation-panel validation-ok" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:8px;background:var(--c-success-bg,#f0fdf4);border:1px solid var(--c-success-border,#bbf7d0);margin-bottom:var(--sp-4);color:var(--c-success-text,#166534);">
        <span style="font-size:1.2rem;">&#10003;</span>
        <span style="font-weight:500;">Configuration complète — l'EDT est prêt à l'emploi.</span>
      </div>`;
  }

  const renderItem = (item, isError) => {
    const icon = isError ? '&#9888;' : '&#9432;';
    const color = isError ? 'var(--c-danger,#dc2626)' : 'var(--c-warning-text,#92400e)';
    return `
      <li style="display:flex;align-items:baseline;gap:10px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.06);">
        <span style="color:${color};font-size:1rem;flex-shrink:0;">${icon}</span>
        <span style="flex:1;">
          <strong>${item.message}</strong>
          ${item.detail ? `<span style="margin-left:6px;opacity:.75;font-size:.85em;">${item.detail}</span>` : ''}
        </span>
        <button class="btn btn-xs validation-goto" data-goto="${item.goto}"
          style="flex-shrink:0;font-size:.8em;padding:2px 10px;">${item.gotoLabel}</button>
      </li>`;
  };

  const errorsBg = errors.length > 0
    ? 'var(--c-danger-bg,#fef2f2)'
    : 'var(--c-warning-bg,#fffbeb)';
  const errorsBorder = errors.length > 0
    ? 'var(--c-danger-border,#fecaca)'
    : 'var(--c-warning-border,#fde68a)';
  const headerColor = errors.length > 0 ? 'var(--c-danger,#dc2626)' : 'var(--c-warning-text,#92400e)';
  const headerIcon = errors.length > 0 ? '&#9888;' : '&#9432;';
  const headerText = errors.length > 0
    ? `${errors.length} problème${errors.length > 1 ? 's' : ''} bloquant${errors.length > 1 ? 's' : ''} — certaines vues sont inaccessibles`
    : `${warnings.length} avertissement${warnings.length > 1 ? 's' : ''} — vérifiez la configuration`;

  return `
    <div class="validation-panel" style="margin-bottom:var(--sp-4);border-radius:8px;border:1px solid ${errorsBorder};background:${errorsBg};overflow:hidden;">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid ${errorsBorder};">
        <span style="color:${headerColor};font-size:1.1rem;">${headerIcon}</span>
        <strong style="color:${headerColor};">${headerText}</strong>
      </div>
      <ul style="margin:0;padding:4px 16px 8px;list-style:none;">
        ${errors.map(e => renderItem(e, true)).join('')}
        ${warnings.map(w => renderItem(w, false)).join('')}
      </ul>
    </div>`;
}

function formatPeriodeDates(p) {
  if (!p.dateDebut || !p.dateFin) return '';
  const fmt = (d) => {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };
  return `${fmt(p.dateDebut)} - ${fmt(p.dateFin)}`;
}
