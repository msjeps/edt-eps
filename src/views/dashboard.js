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
        <!-- ===== LANDING PAGE — état vide ===== -->
        <style>
          .lp-hero{background:linear-gradient(135deg,var(--c-primary-bg) 0%,var(--c-surface) 100%);border:1px solid var(--c-primary-bg-strong);border-radius:var(--radius-xl);padding:var(--sp-10) var(--sp-8);text-align:center;margin-bottom:var(--sp-8);}
          .lp-hero-badge{display:inline-flex;align-items:center;gap:var(--sp-2);background:var(--c-primary-bg-strong);color:var(--c-primary-dark);font-size:var(--fs-sm);font-weight:600;padding:var(--sp-1) var(--sp-3);border-radius:var(--radius-full);margin-bottom:var(--sp-4);}
          .lp-hero h1{font-size:2.5rem;font-weight:800;letter-spacing:-0.03em;color:var(--c-text);margin:0 0 var(--sp-3);}
          .lp-hero-sub{font-size:var(--fs-lg);color:var(--c-text-secondary);max-width:560px;margin:0 auto var(--sp-6);line-height:1.6;}
          .lp-cta{display:flex;gap:var(--sp-3);justify-content:center;flex-wrap:wrap;margin-bottom:var(--sp-3);}
          .lp-hint{font-size:var(--fs-sm);color:var(--c-text-muted);}
          .lp-section-title{font-size:var(--fs-xl);font-weight:700;text-align:center;margin:0 0 var(--sp-2);color:var(--c-text);}
          .lp-section-sub{font-size:var(--fs-base);color:var(--c-text-secondary);text-align:center;margin:0 0 var(--sp-6);}
          .lp-features{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-4);margin-bottom:var(--sp-8);}
          @media(max-width:900px){.lp-features{grid-template-columns:repeat(2,1fr);}}
          .lp-feat{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius-lg);padding:var(--sp-5);transition:box-shadow var(--transition),border-color var(--transition);}
          .lp-feat:hover{box-shadow:var(--shadow-md);border-color:var(--c-primary-light);}
          .lp-feat-icon{width:40px;height:40px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:1.25rem;margin-bottom:var(--sp-3);}
          .lp-feat h3{font-size:var(--fs-base);font-weight:700;margin:0 0 var(--sp-2);color:var(--c-text);}
          .lp-feat p{font-size:var(--fs-sm);color:var(--c-text-secondary);margin:0;line-height:1.55;}
          .lp-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--sp-4);margin-bottom:var(--sp-8);position:relative;}
          @media(max-width:900px){.lp-steps{grid-template-columns:repeat(2,1fr);}}
          .lp-step{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius-lg);padding:var(--sp-5) var(--sp-4);text-align:center;}
          .lp-step-num{width:36px;height:36px;border-radius:var(--radius-full);background:var(--c-primary);color:#fff;font-weight:800;font-size:var(--fs-base);display:flex;align-items:center;justify-content:center;margin:0 auto var(--sp-3);}
          .lp-step h3{font-size:var(--fs-sm);font-weight:700;color:var(--c-text);margin:0 0 var(--sp-2);}
          .lp-step p{font-size:var(--fs-xs);color:var(--c-text-secondary);margin:0;line-height:1.5;}
          .lp-benefits{display:flex;gap:var(--sp-3);justify-content:center;flex-wrap:wrap;margin-bottom:var(--sp-8);}
          .lp-benefit{display:flex;align-items:center;gap:var(--sp-2);background:var(--c-surface-alt);border:1px solid var(--c-border);border-radius:var(--radius-full);padding:var(--sp-2) var(--sp-4);font-size:var(--fs-sm);color:var(--c-text-secondary);}
          .lp-benefit-dot{width:8px;height:8px;border-radius:var(--radius-full);background:var(--c-success);flex-shrink:0;}
          .lp-cta-bottom{background:var(--c-primary-bg);border:1px solid var(--c-primary-bg-strong);border-radius:var(--radius-xl);padding:var(--sp-8);text-align:center;}
          .lp-cta-bottom h2{font-size:var(--fs-2xl);font-weight:700;margin:0 0 var(--sp-2);}
          .lp-cta-bottom p{color:var(--c-text-secondary);margin:0 0 var(--sp-6);}
        </style>

        <!-- HERO -->
        <div class="lp-hero">
          <div class="lp-hero-badge">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7"/><path d="M8 4v4l3 1.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
            Configuration en moins de 10 minutes
          </div>
          <h1>&#127939; EDT EPS</h1>
          <p class="lp-hero-sub">
            L'emploi du temps EPS de votre établissement, enfin simple.<br>
            Fini les tableurs Excel complexes — planifiez, réservez et exportez en quelques clics.
          </p>
          <div class="lp-cta">
            <button class="btn btn-primary btn-lg" id="btn-start-wizard">
              &#9881; Démarrer la configuration
            </button>
            <button class="btn btn-outline btn-lg" id="btn-load-demo" title="Charge un jeu de données fictif pour explorer l'application">
              &#128203; Explorer la démo
            </button>
          </div>
          <p class="lp-hint">La démo charge un collège-lycée fictif avec 5 enseignants, 12 classes et 3 trimestres — aucune donnée effacée si vous rechargez.</p>
        </div>

        <!-- FONCTIONNALITÉS -->
        <p class="lp-section-title">Tout ce dont vous avez besoin</p>
        <p class="lp-section-sub">Une seule application pour gérer l'intégralité de votre coordination EPS.</p>
        <div class="lp-features">
          <div class="lp-feat">
            <div class="lp-feat-icon" style="background:var(--c-primary-bg);">&#9881;</div>
            <h3>Assistant de configuration</h3>
            <p>6 étapes guidées pour saisir enseignants, classes, activités APSA et installations. Générateurs automatiques inclus.</p>
          </div>
          <div class="lp-feat">
            <div class="lp-feat-icon" style="background:var(--c-success-bg);">&#128203;</div>
            <h3>Programmation annuelle</h3>
            <p>Matrice classe × période et installation × période. Affectez activités et installations, avec alerte si une APSA est déjà utilisée.</p>
          </div>
          <div class="lp-feat">
            <div class="lp-feat-icon" style="background:#EDE9FE;">&#128197;</div>
            <h3>EDT drag &amp; drop</h3>
            <p>Grille semaine interactive. Déplacez les blocs d'un jour à l'autre, par période ou sur toute l'année. Blocs verrouillables.</p>
          </div>
          <div class="lp-feat">
            <div class="lp-feat-icon" style="background:var(--c-danger-bg);">&#9888;</div>
            <h3>Conflits en temps réel</h3>
            <p>Détection automatique : doublon prof/classe/installation, ORS dépassé, écart &lt; 24h collège, incompatibilité activité↔lieu. Suggestions de résolution incluses.</p>
          </div>
          <div class="lp-feat">
            <div class="lp-feat-icon" style="background:var(--c-warning-bg);">&#128228;</div>
            <h3>Exports professionnels</h3>
            <p>PDF équipe et fiches individuelles, Excel EDT, CSV mairie (Direction des Sports), CSV transport (1 bus = 1 ligne), JSON projet chiffrable.</p>
          </div>
          <div class="lp-feat">
            <div class="lp-feat-icon" style="background:var(--c-info-bg);">&#127963;</div>
            <h3>Réservations mairie</h3>
            <p>Workflow proposé → demandé → accepté/refusé. Import des disponibilités de la Direction des Sports (Excel, JSON).</p>
          </div>
        </div>

        <!-- COMMENT ÇA MARCHE -->
        <p class="lp-section-title">Comment ça marche</p>
        <p class="lp-section-sub">Quatre étapes, de la configuration à l'export final.</p>
        <div class="lp-steps">
          <div class="lp-step">
            <div class="lp-step-num">1</div>
            <h3>&#9881; Configurer</h3>
            <p>Renseignez votre établissement, vos enseignants, classes, activités et installations via l'assistant guidé.</p>
          </div>
          <div class="lp-step">
            <div class="lp-step-num">2</div>
            <h3>&#128203; Programmer</h3>
            <p>Affectez une APSA et une installation à chaque classe pour chaque trimestre ou semestre.</p>
          </div>
          <div class="lp-step">
            <div class="lp-step-num">3</div>
            <h3>&#128197; Planifier</h3>
            <p>Ajustez la grille EDT par glisser-déposer. Les conflits sont signalés instantanément.</p>
          </div>
          <div class="lp-step">
            <div class="lp-step-num">4</div>
            <h3>&#128228; Exporter</h3>
            <p>Générez le CSV mairie, le bon de commande transport, le PDF EDT équipe et les synthèses Excel.</p>
          </div>
        </div>

        <!-- AVANTAGES -->
        <div class="lp-benefits">
          <div class="lp-benefit"><div class="lp-benefit-dot"></div>Aucune installation</div>
          <div class="lp-benefit"><div class="lp-benefit-dot"></div>Données 100 % locales et privées</div>
          <div class="lp-benefit"><div class="lp-benefit-dot"></div>Gratuit</div>
          <div class="lp-benefit"><div class="lp-benefit-dot"></div>Chrome &amp; Edge recommandés</div>
          <div class="lp-benefit"><div class="lp-benefit-dot"></div>Annuler Ctrl+Z (20 niveaux)</div>
          <div class="lp-benefit"><div class="lp-benefit-dot"></div>Mode sombre inclus</div>
        </div>

        <!-- CTA FINAL -->
        <div class="lp-cta-bottom">
          <h2>Prêt à commencer ?</h2>
          <p>Configurez votre établissement en 10 minutes ou explorez d'abord avec la démo.</p>
          <div class="lp-cta">
            <button class="btn btn-primary btn-lg" id="btn-start-wizard-2">
              &#9881; Démarrer la configuration
            </button>
            <button class="btn btn-outline btn-lg" id="btn-load-demo-2" title="Charge un jeu de données fictif pour explorer l'application">
              &#128203; Explorer la démo
            </button>
          </div>
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
            <button type="button" id="stat-conflits" aria-label="Voir les conflits"
                    style="flex:1;padding:var(--sp-4);cursor:pointer;background:none;border:none;font:inherit;color:inherit;text-align:left;">
              <div class="stat-value" style="color:${nbConflits > 0 ? 'var(--c-danger)' : 'var(--c-success)'}">
                ${nbConflits}
              </div>
              <div class="stat-label">Conflits</div>
            </button>
          </div>
        </div>

        ${renderValidationPanel(validation)}

        <div class="dashboard-grid">
          <button type="button" class="dashboard-card" data-goto="donnees">
            <div class="dashboard-card-icon" aria-hidden="true">&#128218;</div>
            <div class="dashboard-card-title">Données</div>
            <div class="dashboard-card-desc">Gérer enseignants, classes, activités, installations</div>
          </button>
          <button type="button" class="dashboard-card" data-goto="programmation">
            <div class="dashboard-card-icon" aria-hidden="true">&#128203;</div>
            <div class="dashboard-card-title">Programmation</div>
            <div class="dashboard-card-desc">Planifier activités et installations par classe et période</div>
          </button>
          <button type="button" class="dashboard-card" data-goto="edt">
            <div class="dashboard-card-icon" aria-hidden="true">&#128197;</div>
            <div class="dashboard-card-title">Emploi du temps</div>
            <div class="dashboard-card-desc">Visualiser et modifier l'EDT par glisser-déposer</div>
          </button>
          <button type="button" class="dashboard-card" data-goto="reservations">
            <div class="dashboard-card-icon" aria-hidden="true">&#128203;</div>
            <div class="dashboard-card-title">Réservations</div>
            <div class="dashboard-card-desc">Gérer les demandes de réservation d'installations</div>
          </button>
          <button type="button" class="dashboard-card" data-goto="exports">
            <div class="dashboard-card-icon" aria-hidden="true">&#128228;</div>
            <div class="dashboard-card-title">Exports</div>
            <div class="dashboard-card-desc">CSV mairie, transport, PDF EDT, synthèses</div>
          </button>
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
  container.querySelectorAll('#btn-start-wizard, #btn-start-wizard-2').forEach(btn => {
    btn?.addEventListener('click', () => navigateTo('wizard'));
  });

  const handleLoadDemo = async () => {
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
  };
  container.querySelectorAll('#btn-load-demo, #btn-load-demo-2').forEach(btn => {
    btn?.addEventListener('click', handleLoadDemo);
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
      <div class="callout callout--success validation-panel" style="margin-bottom:var(--sp-4);">
        <span class="callout-icon" aria-hidden="true">&#10003;</span>
        <span class="callout-body"><strong>Configuration complète — l'EDT est prêt à l'emploi.</strong></span>
      </div>`;
  }

  const renderItem = (item, isError) => {
    const icon = isError ? '&#9888;' : '&#9432;';
    return `
      <li>
        <span class="vi-icon" aria-hidden="true">${icon}</span>
        <span class="vi-msg">
          <strong>${item.message}</strong>
          ${item.detail ? `<span class="vi-detail">${item.detail}</span>` : ''}
        </span>
        <button class="btn btn-xs validation-goto" data-goto="${item.goto}"
          style="flex-shrink:0;">${item.gotoLabel}</button>
      </li>`;
  };

  const variant = errors.length > 0 ? 'danger' : 'warning';
  const headerIcon = errors.length > 0 ? '&#9888;' : '&#9432;';
  const headerText = errors.length > 0
    ? `${errors.length} problème${errors.length > 1 ? 's' : ''} bloquant${errors.length > 1 ? 's' : ''} — certaines vues sont inaccessibles`
    : `${warnings.length} avertissement${warnings.length > 1 ? 's' : ''} — vérifiez la configuration`;

  return `
    <div class="callout callout--${variant} validation-panel" style="margin-bottom:var(--sp-4);">
      <span class="callout-icon" aria-hidden="true">${headerIcon}</span>
      <div class="callout-body">
        <strong class="callout-title">${headerText}</strong>
        <ul class="validation-list">
          ${errors.map(e => renderItem(e, true)).join('')}
          ${warnings.map(w => renderItem(w, false)).join('')}
        </ul>
      </div>
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
