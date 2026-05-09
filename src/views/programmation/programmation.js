/**
 * Vue Programmation Annuelle
 * - Onglet 1 : Matrice Classe × Période (programmation des activités)
 * - Onglet 2 : Matrice Installation × Période (occupation / conflits)
 */
import db from '../../db/schema.js';
import { getConfig } from '../../db/schema.js';
import { captureUndo } from '../../utils/undo.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { JOURS_OUVRES, JOURS_COURTS, NIVEAUX, COULEURS_INSTALLATIONS } from '../../utils/helpers.js';

// ============================
// MODÈLES HORAIRES PRÉDÉFINIS
// ============================

const MODELES_HORAIRES = [
  { code: '2x2h', label: '2 × 2h', desc: '4h/sem – 6e', creneaux: [{ duree: 120 }, { duree: 120 }] },
  { code: '2h1h', label: '2h + 1h', desc: '3h/sem – collège', creneaux: [{ duree: 120 }, { duree: 60 }] },
  { code: '2x1h30', label: '2 × 1h30', desc: '3h/sem – collège', creneaux: [{ duree: 90 }, { duree: 90 }] },
  { code: '2h1h30', label: '2h + 1h30', desc: '3h30/sem', creneaux: [{ duree: 120 }, { duree: 90 }] },
  { code: '1x3h', label: '1 × 3h', desc: '3h/sem – bloc unique', creneaux: [{ duree: 180 }] },
  { code: '1x2h', label: '1 × 2h', desc: '2h/sem – lycée', creneaux: [{ duree: 120 }] },
];

let currentTab = 'classes';
let filtreNiveau = 'tous';
let filtreEnseignant = 'tous';

// ============================
// MAIN RENDER
// ============================

export async function renderProgrammation(container) {
  const data = await loadAllData();
  const niveauxDispos = getNiveauxDispos(data.etabType);

  container.innerHTML = `
    <div class="prog-container">
      <div class="prog-header">
        <h2 style="margin-bottom: var(--sp-1);">Programmation Annuelle</h2>
        <p style="color: var(--c-text-muted); margin-bottom: var(--sp-4);">
          Configurez les créneaux de chaque classe puis assignez activités et installations par période
        </p>
      </div>

      <div class="prog-toolbar">
        <div class="prog-filters">
          <select id="prog-filtre-niveau" class="form-select">
            <option value="tous">Tous les niveaux</option>
            ${niveauxDispos.map(n => `<option value="${n}" ${filtreNiveau === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
          <select id="prog-filtre-enseignant" class="form-select">
            <option value="tous">Tous les enseignants</option>
            ${data.enseignants.map(e => `<option value="${e.id}" ${filtreEnseignant == e.id ? 'selected' : ''}>${e.prenom} ${e.nom}</option>`).join('')}
          </select>
        </div>
        <div class="prog-actions">
          <button class="btn btn-outline" id="btn-bulk-creneaux" title="Configurer tous les créneaux d'un niveau d'un coup (classes alignées)">&#9889; Config. rapide (niveau)</button>
        </div>
      </div>

      <div class="prog-tabs-bar">
        <button class="prog-tab-btn ${currentTab === 'classes' ? 'active' : ''}" data-tab="classes">&#128203; Par Classe</button>
        <button class="prog-tab-btn ${currentTab === 'installations' ? 'active' : ''}" data-tab="installations">&#127959; Par Installation</button>
      </div>

      <div id="prog-content"></div>
    </div>
  `;

  renderCurrentTab(container, data);
  bindMainEvents(container, data);
}

// ============================
// DATA LOADING
// ============================

async function loadAllData() {
  const [classes, periodes, activites, installations, lieux, enseignants, creneauxClasses, programmations, indisponibilites, etabType] = await Promise.all([
    db.classes.toArray(),
    db.periodes.toArray(),
    db.activites.toArray(),
    db.installations.toArray(),
    db.lieux.toArray(),
    db.enseignants.toArray(),
    db.creneauxClasses.toArray(),
    db.programmations.toArray(),
    db.indisponibilites.toArray(),
    getConfig('etablissementType'),
  ]);

  periodes.sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || (a.dateDebut || '').localeCompare(b.dateDebut || ''));

  const niveauOrdre = { '6e': 1, '5e': 2, '4e': 3, '3e': 4, '2nde': 5, '1ere': 6, 'term': 7 };
  classes.sort((a, b) => (niveauOrdre[a.niveau] || 99) - (niveauOrdre[b.niveau] || 99) || a.nom.localeCompare(b.nom));

  return {
    classes, periodes, activites, installations, lieux,
    enseignants, creneauxClasses, programmations, indisponibilites,
    etabType: etabType || 'college',
  };
}

function getNiveauxDispos(etabType) {
  const niveaux = [];
  if (etabType === 'college' || etabType === 'mixte') niveaux.push(...NIVEAUX.college);
  if (etabType === 'lycee' || etabType === 'mixte') niveaux.push(...NIVEAUX.lycee);
  return niveaux;
}

// ============================
// TAB RENDERING + EVENTS
// ============================

function renderCurrentTab(container, data) {
  const content = container.querySelector('#prog-content');
  if (!content) return;
  if (currentTab === 'classes') {
    renderClassesPeriodeMatrix(content, data);
  } else {
    renderInstallationMatrix(content, data);
  }
}

function bindMainEvents(container, data) {
  // Tab switching
  container.querySelectorAll('.prog-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      container.querySelectorAll('.prog-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCurrentTab(container, data);
    });
  });

  // Filters
  container.querySelector('#prog-filtre-niveau')?.addEventListener('change', (e) => {
    filtreNiveau = e.target.value;
    renderCurrentTab(container, data);
  });
  container.querySelector('#prog-filtre-enseignant')?.addEventListener('change', (e) => {
    filtreEnseignant = e.target.value;
    renderCurrentTab(container, data);
  });

  // Bulk créneaux
  container.querySelector('#btn-bulk-creneaux')?.addEventListener('click', () => {
    openBulkCreneauModal(container, data);
  });
}

// ============================
// TAB 1: Matrice Classe × Période
// ============================

function renderClassesPeriodeMatrix(content, data) {
  const { classes, periodes, creneauxClasses, programmations, enseignants, activites, installations, lieux } = data;

  // Filter classes
  let filteredClasses = classes;
  if (filtreNiveau !== 'tous') {
    filteredClasses = classes.filter(c => c.niveau === filtreNiveau);
  }
  if (filtreEnseignant !== 'tous') {
    const ensId = parseInt(filtreEnseignant);
    const classeIdsWithEns = new Set(
      creneauxClasses.filter(cc => cc.enseignantId === ensId).map(cc => cc.classeId)
    );
    filteredClasses = filteredClasses.filter(c => classeIdsWithEns.has(c.id) || c.enseignantId === ensId);
  }

  // Group by niveau
  const byNiveau = {};
  for (const c of filteredClasses) {
    const niv = c.niveau || 'Autre';
    if (!byNiveau[niv]) byNiveau[niv] = [];
    byNiveau[niv].push(c);
  }

  if (periodes.length === 0) {
    content.innerHTML = `
      <div class="prog-empty">
        <div class="prog-empty-icon">&#128197;</div>
        <p><strong>Aucune période configurée</strong></p>
        <p style="color: var(--c-text-muted);">Configurez vos trimestres ou semestres dans Données &#8594; Périodes</p>
      </div>
    `;
    return;
  }

  if (filteredClasses.length === 0) {
    content.innerHTML = `
      <div class="prog-empty">
        <div class="prog-empty-icon">&#128218;</div>
        <p><strong>Aucune classe trouvée</strong></p>
        <p style="color: var(--c-text-muted);">Vérifiez vos filtres ou ajoutez des classes dans Données &#8594; Classes</p>
      </div>
    `;
    return;
  }

  // Build the matrix
  const nbPeriodes = periodes.length;
  let html = `
    <div class="prog-matrix-wrap">
      <table class="prog-table">
        <thead>
          <tr>
            <th class="prog-th-classe">Classe / Créneau</th>
            ${periodes.map(p => `<th class="prog-th-periode">${p.nom}</th>`).join('')}
            <th class="prog-th-actions"></th>
          </tr>
        </thead>
        <tbody>
  `;

  const niveauOrder = ['6e', '5e', '4e', '3e', '2nde', '1ere', 'term'];
  const orderedNiveaux = niveauOrder.filter(n => byNiveau[n]);
  Object.keys(byNiveau).forEach(n => { if (!orderedNiveaux.includes(n)) orderedNiveaux.push(n); });

  for (const niv of orderedNiveaux) {
    const classesNiv = byNiveau[niv];

    // Niveau header
    html += `
      <tr class="prog-niveau-row">
        <td colspan="${nbPeriodes + 2}">
          <strong>${niv}</strong>
          <span class="prog-niveau-count">${classesNiv.length} classe(s)</span>
        </td>
      </tr>
    `;

    for (const classe of classesNiv) {
      const creneaux = creneauxClasses
        .filter(cc => cc.classeId === classe.id)
        .sort((a, b) => {
          const jourOrdre = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5 };
          return (jourOrdre[a.jour] || 99) - (jourOrdre[b.jour] || 99) || a.heureDebut.localeCompare(b.heureDebut);
        });

      const ens = enseignants.find(e => e.id === classe.enseignantId);
      const ensLabel = ens ? `${ens.prenom?.[0] || ''}. ${ens.nom}` : '';

      if (creneaux.length === 0) {
        // ============================================
        // CLASSE SANS CRÉNEAUX → Choix du modèle horaire
        // ============================================
        html += `
          <tr class="prog-classe-row">
            <td class="prog-classe-cell">
              <span class="prog-classe-name">${classe.nom}</span>
              ${ensLabel ? `<span class="prog-ens-badge">${ensLabel}</span>` : ''}
            </td>
            <td colspan="${nbPeriodes}" class="prog-config-cell">
              <div class="prog-model-chooser">
                <span class="prog-model-label">Modèle horaire :</span>
                <div class="prog-model-btns">
                  ${MODELES_HORAIRES.map(m => `
                    <button class="btn-model" data-model="${m.code}" data-classe-id="${classe.id}" title="${m.desc}">
                      ${m.label}
                    </button>
                  `).join('')}
                  <button class="btn-model btn-model-other btn-add-creneau" data-classe-id="${classe.id}" title="Ajouter un créneau manuellement">
                    &#9998; Manuel
                  </button>
                </div>
              </div>
            </td>
            <td></td>
          </tr>
        `;
      } else {
        // ============================================
        // CLASSE AVEC CRÉNEAUX → Lignes par créneau
        // ============================================

        // Compute model label from existing créneaux for display
        const modelLabel = inferModelLabel(creneaux);

        for (let i = 0; i < creneaux.length; i++) {
          const cr = creneaux[i];
          const crEns = enseignants.find(e => e.id === cr.enseignantId);
          const crEnsLabel = crEns ? `${crEns.prenom?.[0] || ''}. ${crEns.nom}` : '';
          const jourCourt = JOURS_COURTS[cr.jour] || cr.jour;
          const dureeCr = computeDureeMinutes(cr.heureDebut, cr.heureFin);
          const dureeLabel = formatDuree(dureeCr);

          html += `<tr class="prog-creneau-row">`;

          // Classe name + créneau detail
          html += `<td class="prog-creneau-cell">`;
          if (i === 0) {
            html += `<span class="prog-classe-name">${classe.nom}</span>`;
            if (modelLabel) {
              html += `<span class="prog-model-tag">${modelLabel}</span>`;
            }
          }
          html += `
            <span class="prog-creneau-detail">
              <span class="prog-creneau-jour">${jourCourt}</span>
              <span class="prog-creneau-heures">${formatHeure(cr.heureDebut)}-${formatHeure(cr.heureFin)}</span>
              <span class="prog-duree-badge">${dureeLabel}</span>
              ${crEnsLabel ? `<span class="prog-ens-badge">${crEnsLabel}</span>` : ''}
            </span>
            <button class="btn-icon-sm btn-edit-creneau" data-creneau-id="${cr.id}" title="Modifier le créneau">&#9998;</button>
          `;
          html += `</td>`;

          // Period cells
          for (const p of periodes) {
            const prog = programmations.find(pr => pr.creneauClasseId === cr.id && pr.periodeId === p.id);
            if (prog) {
              // Cellule normale — programmation propre à cette période
              const act = activites.find(a => a.id === prog.activiteId);
              const inst = installations.find(ins => ins.id === prog.installationId);
              const color = getInstallColor(inst, data);
              const statusCls = prog.statut === 'accepte' ? 'prog-status-ok' :
                prog.statut === 'a_reconsiderer' ? 'prog-status-warn' : '';

              const hasCustomJour = prog.jour && prog.jour !== cr.jour;
              const hasCustomTime = (prog.heureDebut && (prog.heureDebut !== cr.heureDebut || prog.heureFin !== cr.heureFin)) || hasCustomJour;
              const effectiveHDeb = prog.heureDebut || cr.heureDebut;
              const effectiveHFin = prog.heureFin  || cr.heureFin;
              const effectiveJour = prog.jour      || cr.jour;
              html += `
                <td class="prog-cell prog-cell-filled ${statusCls}" data-creneau-id="${cr.id}" data-periode-id="${p.id}" data-prog-id="${prog.id}">
                  <div class="prog-assignment" style="border-left: 3px solid ${color};">
                    <div class="prog-act-name">${act?.nom || '?'}</div>
                    ${inst ? `<div class="prog-inst-badge" style="background: ${color}22; color: ${darkenColor(color)};">${inst.nom}</div>` : ''}
                    ${hasCustomTime ? `<div class="prog-custom-time">${hasCustomJour ? (JOURS_COURTS[effectiveJour] || effectiveJour) + ' ' : ''}${formatHeure(effectiveHDeb)}-${formatHeure(effectiveHFin)}</div>` : ''}
                  </div>
                </td>
              `;
            } else {
              // Chercher une programmation d'une autre période qui chevauche P
              let ghostProg = null, ghostPeriode = null, isFullCover = false;
              for (const pr of programmations) {
                if (pr.creneauClasseId !== cr.id) continue;
                const srcP = periodes.find(pp => pp.id === pr.periodeId);
                if (!srcP || srcP.id === p.id) continue;
                if (periodesOverlap(srcP, p)) {
                  ghostProg = pr;
                  ghostPeriode = srcP;
                  isFullCover = periodeCouvreVue(srcP, p);
                  break;
                }
              }

              if (ghostProg) {
                const act = activites.find(a => a.id === ghostProg.activiteId);
                const inst = installations.find(ins => ins.id === ghostProg.installationId);
                const color = getInstallColor(inst, data);

                if (isFullCover) {
                  // La source couvre toute cette période → affichage identique au normal + badge source
                  html += `
                    <td class="prog-cell prog-cell-overlap-full" data-creneau-id="${cr.id}" data-periode-id="${p.id}" title="Programmé en ${ghostPeriode.nom} (couvre toute cette période)">
                      <div class="prog-assignment" style="border-left: 3px solid ${color};">
                        <div class="prog-act-name">${act?.nom || '?'}</div>
                        ${inst ? `<div class="prog-inst-badge" style="background: ${color}22; color: ${darkenColor(color)};">${inst.nom}</div>` : ''}
                        <div class="prog-overlap-source-badge">↗ ${ghostPeriode.nom}</div>
                      </div>
                    </td>
                  `;
                } else {
                  // Chevauchement partiel → cellule fantôme grisée avec mention de fin
                  const label = overlapLabel(ghostPeriode, p);
                  html += `
                    <td class="prog-cell prog-cell-ghost" data-creneau-id="${cr.id}" data-periode-id="${p.id}" title="Occupé par ${ghostPeriode.nom} (${label})">
                      <div class="prog-ghost-assignment" style="border-left: 3px solid ${color};">
                        <div class="prog-act-name">${act?.nom || '?'}</div>
                        ${inst ? `<div class="prog-inst-badge" style="background: ${color}22; color: ${darkenColor(color)};">${inst.nom}</div>` : ''}
                        <div class="prog-ghost-badge">⌛ ${ghostPeriode.nom} · ${label}</div>
                      </div>
                    </td>
                  `;
                }
              } else {
                html += `
                  <td class="prog-cell prog-cell-empty" data-creneau-id="${cr.id}" data-periode-id="${p.id}">
                    <div class="prog-add-btn" title="Assigner une activité">+</div>
                  </td>
                `;
              }
            }
          }

          // Action cell
          html += `
            <td class="prog-action-cell">
              <button class="btn-icon-sm btn-del-creneau" data-creneau-id="${cr.id}" title="Supprimer le créneau">&times;</button>
            </td>
          `;
          html += `</tr>`;
        }

        // Row for adding more créneaux (visible button)
        html += `
          <tr class="prog-add-creneau-row">
            <td class="prog-add-creneau-td" colspan="${nbPeriodes + 2}">
              <button class="btn-add-more btn-add-creneau" data-classe-id="${classe.id}">
                + Ajouter un créneau
              </button>
            </td>
          </tr>
        `;
      }
    }
  }

  html += `</tbody></table></div>`;

  // Stats bar
  const totalCreneaux = creneauxClasses.length;
  const totalProgs = programmations.length;
  const totalCells = creneauxClasses.length * periodes.length;
  const pctFilled = totalCells > 0 ? Math.round((totalProgs / totalCells) * 100) : 0;

  html += `
    <div class="prog-stats">
      <span>${totalCreneaux} créneau(x)</span>
      <span>${totalProgs} / ${totalCells} assignations</span>
      <span class="prog-progress-wrap">
        <span class="prog-progress-bar" style="width: ${pctFilled}%;"></span>
      </span>
      <span>${pctFilled}% rempli</span>
    </div>
  `;

  // Bannière conflits prof
  const profConflicts = detectProfConflicts(data);
  if (profConflicts.length > 0) {
    const banner = profConflicts.map(c => {
      const jourLabel = JOURS_COURTS[c.crA.jour] || c.crA.jour;
      return `<li><strong>${c.ens ? c.ens.prenom + ' ' + c.ens.nom : 'Prof inconnu'}</strong> — ${jourLabel} : ${formatHeure(c.crA.heureDebut)}–${formatHeure(c.crA.heureFin)} ET ${formatHeure(c.crB.heureDebut)}–${formatHeure(c.crB.heureFin)} se chevauchent</li>`;
    }).join('');
    html = `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:var(--radius);padding:12px 16px;margin-bottom:var(--sp-4);display:flex;gap:12px;align-items:flex-start;">
        <span style="font-size:1.2rem;">🔴</span>
        <div>
          <strong style="color:var(--c-danger);">${profConflicts.length} conflit(s) d'enseignant détecté(s)</strong>
          <ul style="margin:6px 0 0 16px;font-size:var(--fs-sm);color:var(--c-danger);">${banner}</ul>
        </div>
      </div>
    ` + html;
  }

  content.innerHTML = html;
  bindMatrixEvents(content, data);
}

function bindMatrixEvents(content, data) {
  const rootContainer = content.closest('.prog-container')?.parentElement;

  // Model preset buttons (for unconfigured classes)
  content.querySelectorAll('.btn-model[data-model]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const classeId = parseInt(btn.dataset.classeId);
      const modelCode = btn.dataset.model;
      const classe = data.classes.find(c => c.id === classeId);
      if (classe) openModelModal(classe, modelCode, data, rootContainer);
    });
  });

  // Add créneau (manual — for unconfigured classes or adding more)
  content.querySelectorAll('.btn-add-creneau').forEach(btn => {
    // Skip model buttons that also have btn-add-creneau (they have data-model)
    if (btn.dataset.model) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const classeId = parseInt(btn.dataset.classeId);
      openCreneauModal(null, classeId, data, rootContainer);
    });
  });

  // Edit créneau
  content.querySelectorAll('.btn-edit-creneau').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const creneauId = parseInt(btn.dataset.creneauId);
      const creneau = data.creneauxClasses.find(cc => cc.id === creneauId);
      if (creneau) openCreneauModal(creneau, creneau.classeId, data, rootContainer);
    });
  });

  // Delete créneau
  content.querySelectorAll('.btn-del-creneau').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const creneauId = parseInt(btn.dataset.creneauId);
      if (await confirmModal('Supprimer', 'Supprimer ce créneau et ses programmations ?')) {
        await captureUndo('Suppression créneau');
        const progs = data.programmations.filter(p => p.creneauClasseId === creneauId);
        for (const p of progs) await db.programmations.delete(p.id);
        await db.creneauxClasses.delete(creneauId);
        toast.success('Créneau supprimé');
        await refreshView(data, rootContainer);
      }
    });
  });

  // Click filled cell → edit assignment
  content.querySelectorAll('.prog-cell-filled').forEach(cell => {
    cell.addEventListener('click', () => {
      const creneauId = parseInt(cell.dataset.creneauId);
      const periodeId = parseInt(cell.dataset.periodeId);
      const progId = parseInt(cell.dataset.progId);
      const prog = data.programmations.find(p => p.id === progId);
      openAssignmentModal(creneauId, periodeId, prog, data, rootContainer);
    });
  });

  // Click empty cell → add assignment
  content.querySelectorAll('.prog-cell-empty').forEach(cell => {
    cell.addEventListener('click', () => {
      const creneauId = parseInt(cell.dataset.creneauId);
      const periodeId = parseInt(cell.dataset.periodeId);
      openAssignmentModal(creneauId, periodeId, null, data, rootContainer);
    });
  });
}

// ============================
// TAB 2: Matrice Installation × Période
// ============================

function renderInstallationMatrix(content, data) {
  const { installations, lieux, periodes, creneauxClasses, programmations, classes, activites } = data;

  if (periodes.length === 0 || installations.length === 0) {
    content.innerHTML = `
      <div class="prog-empty">
        <div class="prog-empty-icon">&#127959;</div>
        <p><strong>${periodes.length === 0 ? 'Aucune période configurée' : 'Aucune installation configurée'}</strong></p>
        <p style="color: var(--c-text-muted);">Configurez les données dans l'onglet Données</p>
      </div>
    `;
    return;
  }

  // Group installations by lieu
  const byLieu = {};
  for (const inst of installations) {
    const lieu = lieux.find(l => l.id === inst.lieuId);
    const lieuNom = lieu?.nom || 'Sans lieu';
    if (!byLieu[lieuNom]) byLieu[lieuNom] = { lieu, installations: [] };
    byLieu[lieuNom].installations.push(inst);
  }

  const nbPeriodes = periodes.length;
  let html = `
    <div class="prog-status-legend">
      <span class="prog-status-legend-label">Cliquer sur une séance pour changer son statut :</span>
      <span class="prog-status-chip chip-propose">Proposé</span>
      <span class="prog-status-arrow">→</span>
      <span class="prog-status-chip chip-accepte">&#9989; Accepté</span>
      <span class="prog-status-arrow">→</span>
      <span class="prog-status-chip chip-reconsiderer">&#9888; À reconsidérer</span>
      <span class="prog-status-arrow">→</span>
      <span class="prog-status-chip chip-propose">Proposé…</span>
    </div>
    <div class="prog-matrix-wrap">
      <table class="prog-table prog-table-install">
        <thead>
          <tr>
            <th class="prog-th-install">Installation</th>
            <th class="prog-th-cap">Cap.</th>
            ${periodes.map(p => `<th class="prog-th-periode">${p.nom}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  for (const [lieuNom, { lieu, installations: insts }] of Object.entries(byLieu)) {
    // Lieu header
    html += `
      <tr class="prog-lieu-row">
        <td colspan="${nbPeriodes + 2}">
          <strong>${lieuNom}</strong>
          ${lieu?.type === 'extra' ? ' <span class="tag tag-sm tag-warning">extra</span>' : ''}
          ${lieu?.necessiteBus ? ' &#128652;' : ''}
        </td>
      </tr>
    `;

    for (const inst of insts) {
      const color = getInstallColor(inst, data);

      html += `<tr class="prog-install-row">`;
      html += `<td class="prog-install-name" style="border-left: 3px solid ${color};"><strong>${inst.nom}</strong></td>`;
      html += `<td class="prog-install-cap">${inst.capaciteSimultanee || '&#8734;'}</td>`;

      for (const p of periodes) {
        // Programmations natives (période exacte)
        const progsHere = programmations.filter(pr => pr.installationId === inst.id && pr.periodeId === p.id);

        // Programmations fantômes (périodes qui chevauchent P)
        const ghostEntries = [];
        for (const pr of programmations) {
          if (pr.installationId !== inst.id || pr.periodeId === p.id) continue;
          const srcP = periodes.find(pp => pp.id === pr.periodeId);
          if (srcP && periodesOverlap(srcP, p)) {
            ghostEntries.push({ prog: pr, sourcePeriode: srcP, isFullCover: periodeCouvreVue(srcP, p) });
          }
        }

        if (progsHere.length === 0 && ghostEntries.length === 0) {
          html += `<td class="prog-cell prog-cell-libre"><span class="prog-libre">&mdash;</span></td>`;
        } else {
          // Construire la liste unifiée pour le tri et la détection de conflits
          const allEntries = [
            ...progsHere.map(pr => ({ prog: pr, isGhost: false })),
            ...ghostEntries.map(ge => ({ prog: ge.prog, isGhost: true, sourcePeriode: ge.sourcePeriode, isFullCover: ge.isFullCover })),
          ];

          // Group by slot (toutes entrées confondues — les fantômes occupent aussi la capacité)
          const cap = inst.capaciteSimultanee || 999;
          const bySlot = {};
          for (const entry of allEntries) {
            const cr = creneauxClasses.find(cc => cc.id === entry.prog.creneauClasseId);
            if (!cr) continue;
            const key = `${cr.jour}_${cr.heureDebut}`;
            if (!bySlot[key]) bySlot[key] = [];
            bySlot[key].push(entry);
          }
          let hasConflict = false;
          for (const entries of Object.values(bySlot)) {
            if (entries.length > cap) hasConflict = true;
          }

          // Trier par jour puis heure
          const JOUR_ORDRE_SORT = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
          allEntries.sort((a, b) => {
            const crA = creneauxClasses.find(cc => cc.id === a.prog.creneauClasseId);
            const crB = creneauxClasses.find(cc => cc.id === b.prog.creneauClasseId);
            const jourA = JOUR_ORDRE_SORT[crA?.jour] || 99;
            const jourB = JOUR_ORDRE_SORT[crB?.jour] || 99;
            if (jourA !== jourB) return jourA - jourB;
            return (crA?.heureDebut || '').localeCompare(crB?.heureDebut || '');
          });

          html += `<td class="prog-cell prog-cell-install ${hasConflict ? 'prog-cell-conflict' : ''}">`;
          html += `<div class="prog-install-entries">`;

          for (const entry of allEntries) {
            const pr = entry.prog;
            const cr = creneauxClasses.find(cc => cc.id === pr.creneauClasseId);
            const classe = cr ? classes.find(c => c.id === cr.classeId) : null;
            const act = activites.find(a => a.id === pr.activiteId);
            const jourCourt = cr ? (JOURS_COURTS[cr.jour] || cr.jour) : '?';
            const slotKey = cr ? `${cr.jour}_${cr.heureDebut}` : '';
            const isConflicting = bySlot[slotKey]?.length > cap;

            if (entry.isGhost) {
              const overlapBadge = entry.isFullCover
                ? entry.sourcePeriode.nom
                : `⌛ ${overlapLabel(entry.sourcePeriode, p)}`;
              const ghostCls = entry.isFullCover ? 'ghost-full-cover' : 'ghost-partial';
              html += `
                <div class="prog-install-entry ${ghostCls} ${isConflicting ? 'entry-conflict' : ''}"
                     title="${entry.sourcePeriode.nom} — créneau hors période propre, lecture seule">
                  <span class="entry-classe">${classe?.nom || '?'}</span>
                  <span class="entry-act">${act?.nom || '?'}</span>
                  <span class="entry-horaire">${jourCourt} ${cr ? formatHeure(cr.heureDebut) : ''}</span>
                  <span class="entry-ghost-badge">${overlapBadge}</span>
                </div>
              `;
            } else {
              const statusIcon = pr.statut === 'accepte' ? '&#9989;' : pr.statut === 'a_reconsiderer' ? '&#9888;' : '';
              const statusCls = pr.statut === 'accepte' ? 'entry-ok' :
                pr.statut === 'a_reconsiderer' ? 'entry-warn' : '';
              html += `
                <div class="prog-install-entry ${statusCls} ${isConflicting ? 'entry-conflict' : ''}"
                     data-prog-id="${pr.id}" title="Cliquer pour modifier le statut">
                  <span class="entry-classe">${classe?.nom || '?'}</span>
                  <span class="entry-act">${act?.nom || '?'}</span>
                  <span class="entry-horaire">${jourCourt} ${cr ? formatHeure(cr.heureDebut) : ''}</span>
                  ${statusIcon ? `<span class="entry-status">${statusIcon}</span>` : ''}
                </div>
              `;
            }
          }

          html += `</div></td>`;
        }
      }

      html += `</tr>`;
    }
  }

  html += `</tbody></table></div>`;

  // Conflict summary
  const allConflicts = detectInstallConflicts(data);
  if (allConflicts.length > 0) {
    html += `
      <div class="prog-conflict-summary">
        <strong>&#9888; ${allConflicts.length} conflit(s) d'installation détecté(s)</strong>
        <ul>
          ${allConflicts.slice(0, 5).map(c => `<li>${c.installNom} : ${c.count} créneaux simultanés (cap. ${c.cap}) — ${c.jour} ${c.heure}, ${c.periodeNom}</li>`).join('')}
          ${allConflicts.length > 5 ? `<li>... et ${allConflicts.length - 5} autre(s)</li>` : ''}
        </ul>
      </div>
    `;
  }

  content.innerHTML = html;

  // Bind status toggle on entries
  content.querySelectorAll('.prog-install-entry[data-prog-id]').forEach(entry => {
    entry.addEventListener('click', async () => {
      const progId = parseInt(entry.dataset.progId);
      const prog = data.programmations.find(p => p.id === progId);
      if (!prog) return;
      // Cycle: propose → accepte → a_reconsiderer → propose
      const next = prog.statut === 'propose' ? 'accepte' :
        prog.statut === 'accepte' ? 'a_reconsiderer' : 'propose';
      await captureUndo('Changement statut programmation');
      await db.programmations.update(progId, { statut: next });
      await syncProgToReservation(prog.classeId, prog.installationId, prog.periodeId, next);
      const labels = { propose: 'Proposé', accepte: 'Accepté', a_reconsiderer: 'À reconsidérer' };
      toast.info(`Statut : ${labels[next]}`);
      await refreshView(data, content.closest('.prog-container')?.parentElement);
    });
  });
}

// ============================
// DÉTECTION CONFLITS PROF
// ============================

/**
 * Détecte les créneaux en double pour un même enseignant (même jour, chevauchement horaire).
 * Ne signale un conflit que si les programmations associées sont sur des périodes qui se chevauchent
 * dans le calendrier — deux créneaux identiques sur S1 et S2 (dates distinctes) ne sont pas en conflit.
 */
function detectProfConflicts(data) {
  const { creneauxClasses, enseignants, programmations, periodes } = data;
  const conflicts = [];

  const byEns = {};
  for (const cc of creneauxClasses) {
    if (!cc.enseignantId) continue;
    if (!byEns[cc.enseignantId]) byEns[cc.enseignantId] = [];
    byEns[cc.enseignantId].push(cc);
  }

  for (const [ensId, ccs] of Object.entries(byEns)) {
    const ens = enseignants.find(e => e.id === parseInt(ensId));
    for (let i = 0; i < ccs.length; i++) {
      for (let j = i + 1; j < ccs.length; j++) {
        const a = ccs[i], b = ccs[j];
        if (a.jour !== b.jour) continue;
        if (!(a.heureDebut < b.heureFin && b.heureDebut < a.heureFin)) continue;

        // Vérifier si les programmations des deux créneaux coexistent dans le temps.
        // Un créneau sans programmation est ignoré (pas actif = pas de conflit réel).
        const progsA = programmations.filter(p => p.creneauClasseId === a.id);
        const progsB = programmations.filter(p => p.creneauClasseId === b.id);
        if (progsA.length === 0 || progsB.length === 0) continue;

        // Conflit réel seulement si au moins une paire de programmations est sur des périodes
        // qui se chevauchent dans le calendrier (ou dont les dates ne sont pas renseignées).
        let hasRealOverlap = false;
        outer: for (const pA of progsA) {
          const periodeA = periodes.find(p => p.id === pA.periodeId);
          for (const pB of progsB) {
            const periodeB = periodes.find(p => p.id === pB.periodeId);
            if (!periodeA || !periodeB) { hasRealOverlap = true; break outer; }
            if (periodeA.id === periodeB.id || periodesOverlap(periodeA, periodeB)) {
              hasRealOverlap = true;
              break outer;
            }
          }
        }

        if (hasRealOverlap) {
          conflicts.push({ ens, crA: a, crB: b });
        }
      }
    }
  }
  return conflicts;
}

/**
 * Retourne les avertissements pour un créneau donné
 * (indisponibilités prof + conflits avec d'autres créneaux).
 */
function getCreneauWarnings(jour, heureDebut, heureFin, enseignantId, creneauxClasses, indisponibilites, excludeId = null) {
  const warnings = [];
  if (!enseignantId || !jour || !heureDebut || !heureFin) return warnings;

  // Indisponibilités
  for (const ind of indisponibilites) {
    if (ind.type !== 'enseignant' || ind.refId !== enseignantId) continue;
    if (ind.jour && ind.jour !== jour) continue;
    if (ind.heureDebut && ind.heureFin) {
      if (heureDebut < ind.heureFin && ind.heureDebut < heureFin) {
        warnings.push({ level: 'warn', msg: `Indisponibilité : ${ind.motif || ind.heureDebut + '–' + ind.heureFin}` });
      }
    } else {
      warnings.push({ level: 'warn', msg: `Prof indisponible ce jour (${ind.motif || jour})` });
    }
  }

  // Conflits avec d'autres créneaux du même prof
  for (const cc of creneauxClasses) {
    if (cc.id === excludeId) continue;
    if (cc.enseignantId !== enseignantId || cc.jour !== jour) continue;
    if (heureDebut < cc.heureFin && cc.heureDebut < heureFin) {
      warnings.push({ level: 'error', msg: `Conflit : ce prof a déjà un créneau ${formatHeure(cc.heureDebut)}–${formatHeure(cc.heureFin)}` });
    }
  }
  return warnings;
}

function renderWarningBanner(warnings) {
  if (!warnings.length) return '<div id="cr-conflicts"></div>';
  const html = warnings.map(w => `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;color:${w.level === 'error' ? 'var(--c-danger)' : '#b45309'};">
      <span>${w.level === 'error' ? '🔴' : '⚠️'}</span>
      <span style="font-size:var(--fs-sm);">${w.msg}</span>
    </div>
  `).join('');
  return `
    <div id="cr-conflicts" style="background:${warnings.some(w => w.level === 'error') ? '#fef2f2' : '#fffbeb'};
         border:1px solid ${warnings.some(w => w.level === 'error') ? '#fecaca' : '#fde68a'};
         border-radius:var(--radius-sm);padding:8px 12px;margin-top:8px;">
      ${html}
    </div>
  `;
}

function detectInstallConflicts(data) {
  const { installations, periodes, creneauxClasses, programmations } = data;
  const conflicts = [];

  for (const inst of installations) {
    const cap = inst.capaciteSimultanee || 999;

    for (const p of periodes) {
      // Progs natifs + progs fantômes des périodes qui chevauchent P
      const allProgs = programmations.filter(pr => {
        if (pr.installationId !== inst.id) return false;
        if (pr.periodeId === p.id) return true;
        const srcP = periodes.find(pp => pp.id === pr.periodeId);
        return srcP && periodesOverlap(srcP, p);
      });
      if (allProgs.length <= 1) continue;

      // Group by slot
      const bySlot = {};
      for (const pr of allProgs) {
        const cr = creneauxClasses.find(cc => cc.id === pr.creneauClasseId);
        if (!cr) continue;
        const key = `${cr.jour}_${cr.heureDebut}`;
        if (!bySlot[key]) bySlot[key] = { jour: cr.jour, heure: cr.heureDebut, entries: [] };
        bySlot[key].entries.push(pr);
      }

      for (const slot of Object.values(bySlot)) {
        if (slot.entries.length > cap) {
          conflicts.push({
            installNom: inst.nom,
            cap,
            count: slot.entries.length,
            jour: JOURS_COURTS[slot.jour] || slot.jour,
            heure: formatHeure(slot.heure),
            periodeNom: p.nom,
          });
        }
      }
    }
  }

  return conflicts;
}

// ============================
// MODAL: Modèle horaire (config rapide par classe)
// ============================

function openModelModal(classe, modelCode, data, rootContainer) {
  const model = MODELES_HORAIRES.find(m => m.code === modelCode);
  if (!model) return;

  const contentEl = document.createElement('div');

  // Default jours for each créneau
  const defaultJours = ['lundi', 'jeudi', 'mercredi', 'mardi', 'vendredi'];
  const defaultDebuts = ['08:00', '14:00', '10:00'];

  let creneauxHtml = '';
  model.creneaux.forEach((cr, i) => {
    const dureeLabel = formatDuree(cr.duree);
    const defaultDebut = defaultDebuts[i] || '08:00';
    const defaultFin = addMinutesToTime(defaultDebut, cr.duree);

    creneauxHtml += `
      <div class="card" style="padding: var(--sp-3); margin-bottom: var(--sp-2); border: 1px solid var(--c-border-light, #e5e7eb);">
        <div style="display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-2);">
          <strong>Créneau ${i + 1}</strong>
          <span style="color: var(--c-primary); font-weight: 600; background: var(--c-primary-bg, #eff6ff); padding: 2px 8px; border-radius: var(--radius-sm); font-size: 0.8rem;">${dureeLabel}</span>
        </div>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <div class="form-group" style="flex: 1; min-width: 110px; margin-bottom: 0;">
            <label style="font-size: var(--fs-sm);">Jour</label>
            <select class="form-select model-jour" data-index="${i}">
              ${JOURS_OUVRES.map(j => `<option value="${j}" ${j === defaultJours[i] ? 'selected' : ''}>${j.charAt(0).toUpperCase() + j.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="flex: 1; min-width: 90px; margin-bottom: 0;">
            <label style="font-size: var(--fs-sm);">Début</label>
            <select class="form-select model-debut" data-index="${i}" data-duree="${cr.duree}">
              ${genTimeOptions(defaultDebut)}
            </select>
          </div>
          <div class="form-group" style="flex: 0 0 70px; margin-bottom: 0;">
            <label style="font-size: var(--fs-sm);">Fin</label>
            <input type="text" class="form-input model-fin" data-index="${i}" readonly
                   value="${formatHeure(defaultFin)}"
                   style="background: var(--c-bg-subtle, #f8fafc); text-align: center; font-weight: 600;">
          </div>
          <div class="form-group" style="flex: 1.5; min-width: 140px; margin-bottom: 0;">
            <label style="font-size: var(--fs-sm);">Enseignant</label>
            <select class="form-select model-ens" data-index="${i}">
              <option value="">— Non assigné —</option>
              ${data.enseignants.map(e => `<option value="${e.id}" ${classe.enseignantId === e.id ? 'selected' : ''}>${e.prenom} ${e.nom}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="model-conflicts-${i}"></div>
      </div>
    `;
  });

  contentEl.innerHTML = `
    <div class="prog-assign-context" style="margin-bottom: var(--sp-3);">
      <span class="prog-assign-badge">${classe.nom}</span>
      <span class="prog-assign-badge prog-assign-periode">${model.label}</span>
      <span class="prog-assign-badge" style="background: #f0fdf4; color: #166534;">${model.desc}</span>
    </div>
    ${creneauxHtml}
    <p style="color: var(--c-text-muted); font-size: var(--fs-sm); margin-top: var(--sp-2);">
      L'heure de fin est calculée automatiquement selon la durée du créneau.
    </p>
  `;

  // Bind début change → auto-update fin + warnings
  function updateModelWarnings() {
    model.creneaux.forEach((cr, i) => {
      const jour = contentEl.querySelector(`.model-jour[data-index="${i}"]`)?.value;
      const debut = contentEl.querySelector(`.model-debut[data-index="${i}"]`)?.value;
      const duree = cr.duree;
      const fin = debut ? addMinutesToTime(debut, duree) : null;
      const ensVal = contentEl.querySelector(`.model-ens[data-index="${i}"]`)?.value;
      const enseignantId = ensVal ? parseInt(ensVal) : null;
      const warnings = fin ? getCreneauWarnings(jour, debut, fin, enseignantId, data.creneauxClasses, data.indisponibilites) : [];
      const div = contentEl.querySelector(`#model-conflicts-${i}`);
      if (div) div.outerHTML = `<div id="model-conflicts-${i}">${warnings.length ? renderWarningBanner(warnings).replace('id="cr-conflicts"', '') : ''}</div>`;
    });
  }

  setTimeout(() => {
    contentEl.querySelectorAll('.model-debut').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = sel.dataset.index;
        const duree = parseInt(sel.dataset.duree);
        const debut = sel.value;
        const fin = addMinutesToTime(debut, duree);
        const finInput = contentEl.querySelector(`.model-fin[data-index="${idx}"]`);
        if (finInput) finInput.value = formatHeure(fin);
        updateModelWarnings();
      });
    });
    contentEl.querySelectorAll('.model-jour, .model-ens').forEach(sel => {
      sel.addEventListener('change', updateModelWarnings);
    });
    updateModelWarnings();
  }, 0);

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end;';

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn btn-outline';
  btnCancel.textContent = 'Annuler';
  footer.appendChild(btnCancel);

  const btnCreate = document.createElement('button');
  btnCreate.className = 'btn btn-primary';
  btnCreate.textContent = 'Créer les créneaux';
  footer.appendChild(btnCreate);

  const { close } = openModal({
    title: `Configurer ${classe.nom} — ${model.label}`,
    content: contentEl,
    footer,
    wide: true,
  });

  btnCancel.addEventListener('click', close);
  btnCreate.addEventListener('click', async () => {
    await captureUndo('Génération créneaux ' + classe.nom);
    const existing = data.creneauxClasses.filter(cc => cc.classeId === classe.id);
    let count = 0;

    for (let i = 0; i < model.creneaux.length; i++) {
      const jour = contentEl.querySelector(`.model-jour[data-index="${i}"]`).value;
      const heureDebut = contentEl.querySelector(`.model-debut[data-index="${i}"]`).value;
      const duree = model.creneaux[i].duree;
      const heureFin = addMinutesToTime(heureDebut, duree);
      const ensVal = contentEl.querySelector(`.model-ens[data-index="${i}"]`).value;
      const enseignantId = ensVal ? parseInt(ensVal) : null;

      if (heureDebut >= heureFin) {
        toast.error(`Créneau ${i + 1} : heure de fin invalide (dépassement de journée ?)`);
        return;
      }

      // Check duplicates
      const deja = existing.find(cc => cc.jour === jour && cc.heureDebut === heureDebut);
      if (deja) {
        toast.warning(`Créneau ${i + 1} (${JOURS_COURTS[jour]} ${formatHeure(heureDebut)}) déjà existant, ignoré`);
        continue;
      }

      await db.creneauxClasses.add({
        classeId: classe.id,
        enseignantId,
        jour,
        heureDebut,
        heureFin,
      });
      count++;
    }

    if (count > 0) {
      toast.success(`${count} créneau(x) créé(s) pour ${classe.nom}`);
    }
    close();
    await refreshView(data, rootContainer);
  });
}

// ============================
// MODAL: Créneau (add/edit manual)
// ============================

function openCreneauModal(creneau, classeId, data, rootContainer) {
  const isEdit = creneau !== null;
  const classe = data.classes.find(c => c.id === classeId);

  const contentEl = document.createElement('div');
  contentEl.innerHTML = `
    <div class="form-group">
      <label>Jour</label>
      <select id="cr-jour" class="form-select">
        ${JOURS_OUVRES.map(j => `<option value="${j}" ${creneau?.jour === j ? 'selected' : ''}>${j.charAt(0).toUpperCase() + j.slice(1)}</option>`).join('')}
      </select>
    </div>
    <div style="display: flex; gap: 1rem;">
      <div class="form-group" style="flex:1;">
        <label>Début</label>
        <select id="cr-debut" class="form-select">
          ${genTimeOptions(creneau?.heureDebut || '08:00')}
        </select>
      </div>
      <div class="form-group" style="flex:1;">
        <label>Fin</label>
        <select id="cr-fin" class="form-select">
          ${genTimeOptions(creneau?.heureFin || '10:00')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Enseignant</label>
      <select id="cr-ens" class="form-select">
        <option value="">— Non assigné —</option>
        ${data.enseignants.map(e => `<option value="${e.id}" ${creneau?.enseignantId === e.id ? 'selected' : ''}>${e.prenom} ${e.nom}</option>`).join('')}
      </select>
    </div>
    <div id="cr-conflicts"></div>
  `;

  function updateCreneauConflicts() {
    const jour = contentEl.querySelector('#cr-jour').value;
    const debut = contentEl.querySelector('#cr-debut').value;
    const fin = contentEl.querySelector('#cr-fin').value;
    const ensVal = contentEl.querySelector('#cr-ens').value;
    const enseignantId = ensVal ? parseInt(ensVal) : null;
    const warnings = getCreneauWarnings(jour, debut, fin, enseignantId, data.creneauxClasses, data.indisponibilites, creneau?.id || null);
    const div = contentEl.querySelector('#cr-conflicts');
    if (div) div.outerHTML = renderWarningBanner(warnings);
  }

  setTimeout(() => {
    ['#cr-jour', '#cr-debut', '#cr-fin', '#cr-ens'].forEach(sel => {
      contentEl.querySelector(sel)?.addEventListener('change', updateCreneauConflicts);
    });
    updateCreneauConflicts();
  }, 0);

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end;';

  if (isEdit) {
    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-danger';
    btnDel.textContent = 'Supprimer';
    btnDel.style.marginRight = 'auto';
    footer.appendChild(btnDel);
    btnDel.addEventListener('click', async () => {
      if (await confirmModal('Supprimer', 'Supprimer ce créneau et ses programmations ?')) {
        await captureUndo('Suppression créneau');
        const progs = data.programmations.filter(p => p.creneauClasseId === creneau.id);
        for (const p of progs) await db.programmations.delete(p.id);
        await db.creneauxClasses.delete(creneau.id);
        toast.success('Créneau supprimé');
        close();
        await refreshView(data, rootContainer);
      }
    });
  }

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn btn-outline';
  btnCancel.textContent = 'Annuler';
  footer.appendChild(btnCancel);

  const btnSave = document.createElement('button');
  btnSave.className = 'btn btn-primary';
  btnSave.textContent = isEdit ? 'Modifier' : 'Ajouter';
  footer.appendChild(btnSave);

  const { close } = openModal({
    title: `${isEdit ? 'Modifier' : 'Ajouter'} un créneau — ${classe?.nom || ''}`,
    content: contentEl,
    footer,
  });

  btnCancel.addEventListener('click', close);
  btnSave.addEventListener('click', async () => {
    const jour = contentEl.querySelector('#cr-jour').value;
    const heureDebut = contentEl.querySelector('#cr-debut').value;
    const heureFin = contentEl.querySelector('#cr-fin').value;
    const ensVal = contentEl.querySelector('#cr-ens').value;
    const enseignantId = ensVal ? parseInt(ensVal) : null;

    if (heureDebut >= heureFin) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }

    await captureUndo(isEdit ? 'Modification créneau' : 'Ajout créneau');
    if (isEdit) {
      await db.creneauxClasses.update(creneau.id, { jour, heureDebut, heureFin, enseignantId });
      toast.success('Créneau modifié');
    } else {
      await db.creneauxClasses.add({ classeId, jour, heureDebut, heureFin, enseignantId });
      toast.success('Créneau ajouté');
    }

    close();
    await refreshView(data, rootContainer);
  });
}

// ============================
// MODAL: Assignment (activité + installation)
// ============================

function openAssignmentModal(creneauId, periodeId, existingProg, data, rootContainer) {
  const { activites, installations, lieux } = data;
  const creneau = data.creneauxClasses.find(cc => cc.id === creneauId);
  const periode = data.periodes.find(p => p.id === periodeId);
  const classe = creneau ? data.classes.find(c => c.id === creneau.classeId) : null;
  const isEdit = existingProg !== null;

  const contentEl = document.createElement('div');

  // === Filtrer activités par niveau de la classe ===
  const classeNiveau = classe?.niveau;
  const activitesFiltrees = activites.filter(a => {
    // Si pas de niveaux configurés, l'activité est pour tous
    if (!a.niveaux || a.niveaux.length === 0) return true;
    return classeNiveau && a.niveaux.includes(classeNiveau);
  });

  // Calcul activités déjà utilisées pour cette classe (même logique que dans la grille EDT)
  const usedSamePeriod = new Set();
  const usedOtherPeriod = new Set();
  const usedDetails = {};
  if (classe?.id) {
    for (const prog of data.programmations) {
      if (prog.classeId !== classe.id || !prog.activiteId) continue;
      if (isEdit && prog.id === existingProg.id) continue;
      if (prog.periodeId === periodeId) {
        usedSamePeriod.add(prog.activiteId);
      } else {
        usedOtherPeriod.add(prog.activiteId);
      }
      if (!usedDetails[prog.activiteId]) usedDetails[prog.activiteId] = [];
      const pNom = data.periodes.find(p => p.id === prog.periodeId)?.nom || '(sans période)';
      if (!usedDetails[prog.activiteId].find(d => d.periodeNom === pNom)) {
        usedDetails[prog.activiteId].push({ periodeNom: pNom });
      }
    }
  }

  // Build activités grouped by CA (filtrées par niveau)
  let actOptions = '<option value="">— Choisir une activité —</option>';
  const champsNames = { CA1: 'Performance', CA2: 'Environnement', CA3: 'Artistique', CA4: 'Affrontement', CA5: 'Entretien de soi' };
  const actsByCA = {};
  for (const a of activitesFiltrees) {
    const ca = a.champApprentissage || 'Autre';
    if (!actsByCA[ca]) actsByCA[ca] = [];
    actsByCA[ca].push(a);
  }
  for (const [ca, acts] of Object.entries(actsByCA)) {
    actOptions += `<optgroup label="${ca} — ${champsNames[ca] || ca}">`;
    for (const a of acts) {
      const inSame = usedSamePeriod.has(a.id);
      const inOther = !inSame && usedOtherPeriod.has(a.id);
      const suffix = inSame ? ' ✓' : inOther ? ' ○' : '';
      actOptions += `<option value="${a.id}" ${existingProg?.activiteId === a.id ? 'selected' : ''}>${a.nom}${suffix}</option>`;
    }
    actOptions += `</optgroup>`;
  }

  // === Fonction pour construire les options installation (filtrées par activité) ===
  function buildInstOptions(selectedActId) {
    let opts = '<option value="">— Sans installation —</option>';
    const instsByLieu = {};
    for (const inst of installations) {
      // Filtrer par activité compatible si l'installation a des activitesCompatibles configurées
      if (selectedActId && inst.activitesCompatibles && inst.activitesCompatibles.length > 0) {
        if (!inst.activitesCompatibles.includes(selectedActId)) continue;
      }
      const lieu = lieux.find(l => l.id === inst.lieuId);
      const lieuNom = lieu?.nom || 'Sans lieu';
      if (!instsByLieu[lieuNom]) instsByLieu[lieuNom] = [];
      instsByLieu[lieuNom].push(inst);
    }
    for (const [lieuNom, insts] of Object.entries(instsByLieu)) {
      opts += `<optgroup label="${lieuNom}">`;
      for (const inst of insts) {
        opts += `<option value="${inst.id}" ${existingProg?.installationId === inst.id ? 'selected' : ''}>${inst.nom} (cap. ${inst.capaciteSimultanee || '&#8734;'})</option>`;
      }
      opts += `</optgroup>`;
    }
    return opts;
  }

  const selectedActId = existingProg?.activiteId || null;
  let instOptions = buildInstOptions(selectedActId);

  const jourLabel = creneau ? `${JOURS_COURTS[creneau.jour] || creneau.jour} ${formatHeure(creneau.heureDebut)}-${formatHeure(creneau.heureFin)}` : '';

  const defaultHDeb = existingProg?.heureDebut || creneau?.heureDebut || '08:00';
  const defaultHFin = existingProg?.heureFin  || creneau?.heureFin  || '10:00';

  contentEl.innerHTML = `
    <div class="prog-assign-context">
      <span class="prog-assign-badge">${classe?.nom || '?'}</span>
      <span class="prog-assign-badge">${jourLabel}</span>
      <span class="prog-assign-badge prog-assign-periode">${periode?.nom || '?'}</span>
    </div>
    <div style="display:flex;gap:1rem;">
      <div class="form-group" style="flex:1;">
        <label>Début <span style="font-weight:400;color:var(--c-text-muted);font-size:var(--fs-xs);">(cette période)</span></label>
        <select id="assign-hdeb" class="form-select">${genTimeOptions(defaultHDeb)}</select>
      </div>
      <div class="form-group" style="flex:1;">
        <label>Fin <span style="font-weight:400;color:var(--c-text-muted);font-size:var(--fs-xs);">(cette période)</span></label>
        <select id="assign-hfin" class="form-select">${genTimeOptions(defaultHFin)}</select>
      </div>
    </div>
    <div class="form-group">
      <label>Activité</label>
      <select id="assign-act" class="form-select">${actOptions}</select>
      <div id="assign-act-warning" class="md-act-warning" style="display:none;"></div>
    </div>
    <div class="form-group">
      <label>Installation</label>
      <select id="assign-inst" class="form-select">${instOptions}</select>
    </div>
    ${isEdit ? `
    <div class="form-group">
      <label>Statut</label>
      <select id="assign-statut" class="form-select">
        <option value="propose" ${existingProg.statut === 'propose' ? 'selected' : ''}>Proposé</option>
        <option value="accepte" ${existingProg.statut === 'accepte' ? 'selected' : ''}>Accepté</option>
        <option value="a_reconsiderer" ${existingProg.statut === 'a_reconsiderer' ? 'selected' : ''}>À reconsidérer</option>
      </select>
    </div>
    <div style="border-top:1px solid var(--c-border);margin-top:var(--sp-4);padding-top:var(--sp-3);">
      <label style="font-weight:600;font-size:var(--fs-sm);color:var(--c-text-muted);text-transform:uppercase;letter-spacing:.5px;">
        Déplacer / Intervertir
      </label>
      <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-2);">
        <select id="assign-move-target" class="form-select" style="flex:1;">
          <option value="">— Choisir une autre période —</option>
          ${data.periodes.filter(p => p.id !== periodeId).map(p => {
            const hasExisting = data.programmations.find(pr => pr.creneauClasseId === creneauId && pr.periodeId === p.id);
            return `<option value="${p.id}" data-has-prog="${hasExisting ? hasExisting.id : ''}">${p.nom}${hasExisting ? ' ↔ intervertir' : ' → déplacer'}</option>`;
          }).join('')}
        </select>
        <button id="btn-move-prog" class="btn btn-outline" disabled>Appliquer</button>
      </div>
      <div id="move-preview" style="font-size:var(--fs-sm);color:var(--c-text-muted);margin-top:4px;min-height:18px;"></div>
    </div>
    ` : ''}
  `;

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end;';

  if (isEdit) {
    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-danger';
    btnDel.textContent = 'Retirer';
    btnDel.style.marginRight = 'auto';
    footer.appendChild(btnDel);
    btnDel.addEventListener('click', async () => {
      await captureUndo('Suppression programmation');
      await db.programmations.delete(existingProg.id);
      toast.success('Programmation retirée');
      close();
      await refreshView(data, rootContainer);
    });
  }

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn btn-outline';
  btnCancel.textContent = 'Annuler';
  footer.appendChild(btnCancel);

  const btnSave = document.createElement('button');
  btnSave.className = 'btn btn-primary';
  btnSave.textContent = isEdit ? 'Modifier' : 'Assigner';
  footer.appendChild(btnSave);

  const { close } = openModal({
    title: isEdit ? "Modifier l'assignation" : 'Assigner activité + installation',
    content: contentEl,
    footer,
  });

  // === Avertissement activité déjà utilisée ===
  function checkAssignActWarning() {
    const warning = contentEl.querySelector('#assign-act-warning');
    if (!warning) return;
    const actId = parseInt(contentEl.querySelector('#assign-act')?.value) || null;
    if (!actId) { warning.style.display = 'none'; warning.className = 'md-act-warning'; return; }
    if (usedSamePeriod.has(actId)) {
      warning.className = 'md-act-warning md-act-warning--conflict';
      warning.textContent = '⚠ Cette activité est déjà programmée sur un autre créneau pour cette classe dans cette période.';
      warning.style.display = 'block';
    } else if (usedOtherPeriod.has(actId)) {
      const periodes = (usedDetails[actId] || []).map(d => d.periodeNom).join(', ');
      warning.className = 'md-act-warning md-act-warning--info';
      warning.textContent = `ℹ Activité déjà utilisée pour cette classe dans une autre période : ${periodes}.`;
      warning.style.display = 'block';
    } else {
      warning.style.display = 'none';
      warning.className = 'md-act-warning';
    }
  }
  contentEl.querySelector('#assign-act')?.addEventListener('change', checkAssignActWarning);
  checkAssignActWarning(); // affichage initial si édition

  // === Déplacer / Intervertir ===
  if (isEdit) {
    const moveSelect = contentEl.querySelector('#assign-move-target');
    const moveBtn = contentEl.querySelector('#btn-move-prog');
    const movePreview = contentEl.querySelector('#move-preview');

    moveSelect?.addEventListener('change', () => {
      const targetId = parseInt(moveSelect.value);
      if (!targetId) { moveBtn.disabled = true; movePreview.textContent = ''; return; }
      moveBtn.disabled = false;
      const opt = moveSelect.options[moveSelect.selectedIndex];
      const existingProgId = opt.dataset.hasProg;
      if (existingProgId) {
        const ep = data.programmations.find(p => p.id === parseInt(existingProgId));
        const epAct = ep ? data.activites.find(a => a.id === ep.activiteId) : null;
        movePreview.textContent = `Intervertir avec "${epAct?.nom || '?'}"`;
        movePreview.style.color = 'var(--c-warning, #b45309)';
      } else {
        movePreview.textContent = 'La période actuelle deviendra vide';
        movePreview.style.color = 'var(--c-text-muted)';
      }
    });

    moveBtn?.addEventListener('click', async () => {
      const targetPeriodeId = parseInt(moveSelect.value);
      if (!targetPeriodeId) return;
      const opt = moveSelect.options[moveSelect.selectedIndex];
      const existingProgId = opt.dataset.hasProg ? parseInt(opt.dataset.hasProg) : null;

      await captureUndo(existingProgId ? 'Interversion programmations' : 'Déplacement programmation');
      if (existingProgId) {
        // Intervertir : échanger les periodeId
        await db.programmations.update(existingProg.id, { periodeId: targetPeriodeId });
        await db.programmations.update(existingProgId, { periodeId: periodeId });
        toast.success('Activités interverties entre les périodes');
      } else {
        // Déplacer
        await db.programmations.update(existingProg.id, { periodeId: targetPeriodeId });
        toast.success('Activité déplacée vers la nouvelle période');
      }
      close();
      await refreshView(data, rootContainer);
    });
  }

  // === Filtre dynamique : quand l'activité change, filtrer les installations ===
  contentEl.querySelector('#assign-act')?.addEventListener('change', (e) => {
    const actId = e.target.value ? parseInt(e.target.value) : null;
    const instSelect = contentEl.querySelector('#assign-inst');
    if (instSelect) {
      const prevVal = instSelect.value;
      instSelect.innerHTML = buildInstOptions(actId);
      // Restaurer la valeur si toujours disponible
      if (prevVal && instSelect.querySelector(`option[value="${prevVal}"]`)) {
        instSelect.value = prevVal;
      }
    }
  });

  btnCancel.addEventListener('click', close);
  btnSave.addEventListener('click', async () => {
    const actVal = contentEl.querySelector('#assign-act').value;
    const instVal = contentEl.querySelector('#assign-inst').value;
    const activiteId = actVal ? parseInt(actVal) : null;
    const installationId = instVal ? parseInt(instVal) : null;
    const heureDebut = contentEl.querySelector('#assign-hdeb').value;
    const heureFin  = contentEl.querySelector('#assign-hfin').value;

    if (!activiteId) {
      toast.error('Veuillez choisir une activité');
      return;
    }
    if (heureDebut >= heureFin) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }

    const statut = isEdit ? (contentEl.querySelector('#assign-statut')?.value || 'propose') : 'propose';

    // Stocker les horaires seulement s'ils diffèrent du créneau par défaut
    const hDeb = heureDebut !== creneau?.heureDebut ? heureDebut : null;
    const hFin = heureFin  !== creneau?.heureFin  ? heureFin  : null;

    await captureUndo(isEdit ? 'Modification programmation' : 'Assignation activité');
    if (isEdit) {
      await db.programmations.update(existingProg.id, { activiteId, installationId, statut, heureDebut: hDeb, heureFin: hFin });
      await syncProgToReservation(creneau?.classeId || null, installationId, periodeId, statut);
      toast.success('Programmation modifiée');
    } else {
      await db.programmations.add({
        creneauClasseId: creneauId,
        periodeId,
        activiteId,
        installationId,
        classeId: creneau?.classeId || null,
        statut,
        heureDebut: hDeb,
        heureFin: hFin,
      });
      toast.success('Activité assignée');
    }

    close();
    await refreshView(data, rootContainer);
  });
}

// ============================
// MODAL: Bulk créneau configuration (par niveau)
// ============================

function openBulkCreneauModal(container, data) {
  const niveauxDispos = getNiveauxDispos(data.etabType);

  if (niveauxDispos.length === 0) {
    toast.error('Aucun niveau disponible');
    return;
  }

  const contentEl = document.createElement('div');
  contentEl.innerHTML = `
    <p style="color: var(--c-text-muted); margin-bottom: var(--sp-4);">
      Configurez les créneaux pour <strong>toutes</strong> les classes d'un même niveau
      (idéal pour les classes alignées, ex: 1ères/Terminales).
    </p>
    <div class="form-group">
      <label>Niveau</label>
      <select id="bulk-niveau" class="form-select">
        ${niveauxDispos.map(n => `<option value="${n}">${n}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Modèle horaire</label>
      <select id="bulk-model" class="form-select">
        ${MODELES_HORAIRES.map(m => `<option value="${m.code}">${m.label} — ${m.desc}</option>`).join('')}
      </select>
    </div>
    <div id="bulk-creneaux-config"></div>
    <p style="color: var(--c-text-muted); font-size: var(--fs-sm); margin-top: var(--sp-2);">
      Les créneaux existants ne seront pas modifiés. Seuls les nouveaux seront ajoutés.
    </p>
  `;

  function updateCreneauxConfig() {
    const modelCode = contentEl.querySelector('#bulk-model').value;
    const model = MODELES_HORAIRES.find(m => m.code === modelCode);
    if (!model) return;

    const configDiv = contentEl.querySelector('#bulk-creneaux-config');
    const defaultJours = ['lundi', 'jeudi', 'mercredi', 'mardi', 'vendredi'];
    const defaultDebuts = ['08:00', '14:00', '10:00'];

    let html = '';
    model.creneaux.forEach((cr, i) => {
      const dureeLabel = formatDuree(cr.duree);
      const defaultDebut = defaultDebuts[i] || '08:00';
      const defaultFin = addMinutesToTime(defaultDebut, cr.duree);

      html += `
        <div class="card" style="padding: var(--sp-3); margin-bottom: var(--sp-2); border: 1px solid var(--c-border-light, #e5e7eb);">
          <div style="display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-2);">
            <strong>Créneau ${i + 1}</strong>
            <span style="color: var(--c-primary); font-weight: 600; font-size: 0.8rem;">${dureeLabel}</span>
          </div>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <div class="form-group" style="flex:1; min-width: 110px; margin-bottom: 0;">
              <label style="font-size: var(--fs-sm);">Jour</label>
              <select class="form-select bulk-jour" data-index="${i}">
                ${JOURS_OUVRES.map(j => `<option value="${j}" ${j === defaultJours[i] ? 'selected' : ''}>${j.charAt(0).toUpperCase() + j.slice(1)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="flex:1; min-width: 90px; margin-bottom: 0;">
              <label style="font-size: var(--fs-sm);">Début</label>
              <select class="form-select bulk-debut" data-index="${i}" data-duree="${cr.duree}">
                ${genTimeOptions(defaultDebut)}
              </select>
            </div>
            <div class="form-group" style="flex: 0 0 70px; margin-bottom: 0;">
              <label style="font-size: var(--fs-sm);">Fin</label>
              <input type="text" class="form-input bulk-fin" data-index="${i}" readonly
                     value="${formatHeure(defaultFin)}"
                     style="background: var(--c-bg-subtle, #f8fafc); text-align: center; font-weight: 600;">
            </div>
          </div>
        </div>
      `;
    });
    configDiv.innerHTML = html;

    // Bind début change → auto-update fin
    configDiv.querySelectorAll('.bulk-debut').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = sel.dataset.index;
        const duree = parseInt(sel.dataset.duree);
        const debut = sel.value;
        const fin = addMinutesToTime(debut, duree);
        const finInput = configDiv.querySelector(`.bulk-fin[data-index="${idx}"]`);
        if (finInput) finInput.value = formatHeure(fin);
      });
    });
  }

  setTimeout(updateCreneauxConfig, 0);

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end;';

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn btn-outline';
  btnCancel.textContent = 'Annuler';
  footer.appendChild(btnCancel);

  const btnGen = document.createElement('button');
  btnGen.className = 'btn btn-primary';
  btnGen.textContent = 'Générer';
  footer.appendChild(btnGen);

  const { close } = openModal({
    title: 'Configuration rapide des créneaux (par niveau)',
    content: contentEl,
    footer,
    wide: true,
  });

  // Bind model change
  contentEl.querySelector('#bulk-model').addEventListener('change', updateCreneauxConfig);

  btnCancel.addEventListener('click', close);
  btnGen.addEventListener('click', async () => {
    await captureUndo('Génération créneaux par niveau');
    const niveau = contentEl.querySelector('#bulk-niveau').value;
    const modelCode = contentEl.querySelector('#bulk-model').value;
    const model = MODELES_HORAIRES.find(m => m.code === modelCode);
    if (!model) return;

    const classesNiv = data.classes.filter(c => c.niveau === niveau);
    if (classesNiv.length === 0) {
      toast.error(`Aucune classe de ${niveau} trouvée`);
      return;
    }

    // Get créneau configs
    const configs = [];
    for (let i = 0; i < model.creneaux.length; i++) {
      const jour = contentEl.querySelector(`.bulk-jour[data-index="${i}"]`).value;
      const debut = contentEl.querySelector(`.bulk-debut[data-index="${i}"]`).value;
      const duree = model.creneaux[i].duree;
      const fin = addMinutesToTime(debut, duree);
      if (debut >= fin) {
        toast.error(`Créneau ${i + 1} : heure de fin invalide`);
        return;
      }
      configs.push({ jour, heureDebut: debut, heureFin: fin });
    }

    // Generate créneaux for all classes
    let count = 0;
    for (const classe of classesNiv) {
      const existing = data.creneauxClasses.filter(cc => cc.classeId === classe.id);

      for (const config of configs) {
        // Check duplicates
        const deja = existing.find(cc => cc.jour === config.jour && cc.heureDebut === config.heureDebut);
        if (deja) continue;

        await db.creneauxClasses.add({
          classeId: classe.id,
          enseignantId: classe.enseignantId || null,
          jour: config.jour,
          heureDebut: config.heureDebut,
          heureFin: config.heureFin,
        });
        count++;
      }
    }

    toast.success(`${count} créneau(x) créé(s) pour ${classesNiv.length} classes de ${niveau}`);
    close();
    await refreshView(data, container);
  });
}

// ============================
// HELPERS
// ============================

function genTimeOptions(selected) {
  const options = [];
  for (let h = 7; h <= 19; h++) {
    for (const m of ['00', '30']) {
      const val = `${String(h).padStart(2, '0')}:${m}`;
      const label = m === '00' ? `${h}h` : `${h}h${m}`;
      options.push(`<option value="${val}" ${val === selected ? 'selected' : ''}>${label}</option>`);
    }
  }
  return options.join('');
}

function formatHeure(str) {
  if (!str) return '';
  const [h, m] = str.split(':');
  return m === '00' ? `${parseInt(h)}h` : `${parseInt(h)}h${m}`;
}

function formatDuree(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function addMinutesToTime(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function computeDureeMinutes(heureDebut, heureFin) {
  const [h1, m1] = heureDebut.split(':').map(Number);
  const [h2, m2] = heureFin.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

function inferModelLabel(creneaux) {
  if (creneaux.length === 0) return '';
  const durees = creneaux.map(cr => computeDureeMinutes(cr.heureDebut, cr.heureFin));
  const labels = durees.map(d => formatDuree(d));
  return labels.join(' + ');
}

function getInstallColor(inst, data) {
  if (!inst) return '#999';
  const idx = data.installations.indexOf(inst);
  if (idx === -1) {
    const i = data.installations.findIndex(ins => ins.id === inst.id);
    return COULEURS_INSTALLATIONS[i >= 0 ? i % COULEURS_INSTALLATIONS.length : 0].hex;
  }
  return COULEURS_INSTALLATIONS[idx % COULEURS_INSTALLATIONS.length].hex;
}

function darkenColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const factor = 0.6;
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

// --- Chevauchement de périodes ---

function periodesOverlap(p1, p2) {
  if (!p1 || !p2 || p1.id === p2.id) return false;
  if (!p1.dateDebut || !p1.dateFin || !p2.dateDebut || !p2.dateFin) return false;
  return p1.dateDebut <= p2.dateFin && p2.dateDebut <= p1.dateFin;
}

// La source couvre-t-elle entièrement la période vue ? (séance active pendant toute la vue)
function periodeCouvreVue(source, vue) {
  if (!source.dateDebut || !source.dateFin || !vue.dateDebut || !vue.dateFin) return false;
  return source.dateDebut <= vue.dateDebut && source.dateFin >= vue.dateFin;
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}`;
}

// Produit un libellé "jusqu'au JJ/MM" ou "à partir du JJ/MM" selon le type de chevauchement
function overlapLabel(sourcePeriode, vuePeriode) {
  if (sourcePeriode.dateFin < vuePeriode.dateFin) {
    return `jusqu'au ${formatDateShort(sourcePeriode.dateFin)}`;
  }
  if (sourcePeriode.dateDebut > vuePeriode.dateDebut) {
    return `à partir du ${formatDateShort(sourcePeriode.dateDebut)}`;
  }
  return sourcePeriode.nom;
}

// Mappe un statut programmation vers un statut réservation
function progStatutToResaStatut(progStatut) {
  if (progStatut === 'accepte') return 'accepte';
  return 'propose'; // propose et a_reconsiderer → propose
}

// Synchronise le statut de la réservation correspondant à une programmation
async function syncProgToReservation(classeId, installationId, periodeId, progStatut) {
  if (!classeId || !installationId || !periodeId) return;
  const resaStatut = progStatutToResaStatut(progStatut);
  const seances = await db.seances
    .where('periodeId').equals(periodeId)
    .filter(s => s.classeId === classeId && s.installationId === installationId)
    .toArray();
  for (const seance of seances) {
    await db.reservations
      .where('seanceId').equals(seance.id)
      .filter(r => r.installationId === installationId)
      .modify({ statut: resaStatut });
  }
}

async function refreshView(data, rootContainer) {
  const newData = await loadAllData();
  Object.assign(data, newData);
  if (rootContainer) {
    await renderProgrammation(rootContainer);
  }
}
