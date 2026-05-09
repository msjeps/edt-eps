/**
 * Wizard de configuration — 7 étapes
 * 1. Établissement  2. Enseignants  3. Classes  4. Périodes
 * 5. Activités  6. Installations  7. Récapitulatif
 *
 * L'ordre est pensé pour que les classes soient définies AVANT les périodes,
 * afin de pouvoir associer des périodes à des classes/niveaux spécifiques.
 * Ex: 3ème en semestre sur un créneau, en trimestre sur l'autre.
 */
import db from '../../db/schema.js';
import { getConfig, setConfig } from '../../db/schema.js';
import { toast } from '../../components/toast.js';
import { navigateTo } from '../../app.js';
import { JOURS_OUVRES, NIVEAUX, CHAMPS_APPRENTISSAGE, getChampsApprentissage } from '../../utils/helpers.js';
import { helpTip } from '../../components/help-tooltip.js';
import { ANNEES_SCOLAIRES, zoneLabel } from '../../utils/dates.js';

const STEPS = [
  { id: 'etablissement', label: 'Établissement', icon: '&#127979;' },
  { id: 'enseignants', label: 'Enseignants', icon: '&#129489;' },
  { id: 'classes', label: 'Classes', icon: '&#127979;' },
  { id: 'periodes', label: 'Périodes', icon: '&#128197;' },
  { id: 'activites', label: 'Activités', icon: '&#9917;' },
  { id: 'installations', label: 'Installations', icon: '&#127963;' },
  { id: 'recap', label: 'Récapitulatif', icon: '&#9989;' },
];

let currentStep = 0;

export async function renderWizard(container) {
  currentStep = 0;

  container.innerHTML = `
    <div class="wizard-container">
      <div class="wizard-progress" id="wizard-progress"></div>
      <div class="wizard-content" id="wizard-content"></div>
      <div class="wizard-actions" id="wizard-actions"></div>
    </div>
  `;

  renderProgress();
  await renderStep();
}

function renderProgress() {
  const el = document.getElementById('wizard-progress');
  if (!el) return;

  el.innerHTML = `
    <div class="wizard-step-indicator">
      ${STEPS.map((step, i) => `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div class="wizard-step-dot ${i < currentStep ? 'completed' : ''} ${i === currentStep ? 'active' : ''}"
               title="${step.label}">
            ${i < currentStep ? '&#10003;' : i + 1}
          </div>
          <div class="wizard-step-label ${i === currentStep ? 'active' : ''}">${step.label}</div>
        </div>
        ${i < STEPS.length - 1 ? `<div class="wizard-step-line ${i < currentStep ? 'completed' : ''}"></div>` : ''}
      `).join('')}
    </div>
  `;
}

async function renderStep() {
  const content = document.getElementById('wizard-content');
  const actions = document.getElementById('wizard-actions');
  if (!content || !actions) return;

  const step = STEPS[currentStep];

  switch (step.id) {
    case 'etablissement': await renderStepEtablissement(content); break;
    case 'periodes': await renderStepPeriodes(content); break;
    case 'enseignants': await renderStepEnseignants(content); break;
    case 'classes': await renderStepClasses(content); break;
    case 'activites': await renderStepActivites(content); break;
    case 'installations': await renderStepInstallations(content); break;
    case 'recap': await renderStepRecap(content); break;
  }

  // Boutons navigation
  actions.innerHTML = `
    <div>
      ${currentStep > 0 ? '<button class="btn btn-outline" id="wizard-prev">Précédent</button>' : '<span></span>'}
    </div>
    <div style="display:flex;gap:var(--sp-2);">
      ${currentStep < STEPS.length - 1
        ? '<button class="btn btn-primary" id="wizard-next">Suivant</button>'
        : '<button class="btn btn-success" id="wizard-finish">Terminer la configuration</button>'
      }
    </div>
  `;

  document.getElementById('wizard-prev')?.addEventListener('click', async () => {
    if (await saveCurrentStep()) {
      currentStep--;
      renderProgress();
      await renderStep();
    }
  });

  document.getElementById('wizard-next')?.addEventListener('click', async () => {
    if (await saveCurrentStep()) {
      currentStep++;
      renderProgress();
      await renderStep();
    }
  });

  document.getElementById('wizard-finish')?.addEventListener('click', async () => {
    toast.success('Configuration terminée !');
    navigateTo('dashboard');
  });
}

// === Étape 1 : Établissement ===

async function renderStepEtablissement(container) {
  const nom = await getConfig('etablissementNom') || '';
  const type = await getConfig('etablissementType') || 'mixte';
  const zone = await getConfig('etablissementZone') || 'B';
  const annee = await getConfig('anneeScolaire') || '2025-2026';
  const heureDebut = await getConfig('heureDebut') || '08:00';
  const heureFin = await getConfig('heureFin') || '17:00';

  container.innerHTML = `
    <h3 class="wizard-step-title">Établissement</h3>
    <p class="wizard-step-desc">Informations de base sur votre établissement scolaire.</p>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nom de l'établissement <span class="required">*</span></label>
        <input type="text" class="form-input" id="wiz-etab-nom" value="${nom}" placeholder="Ex: Collège-Lycée Mont Saint Jean">
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" id="wiz-etab-type">
          <option value="college" ${type === 'college' ? 'selected' : ''}>Collège</option>
          <option value="lycee" ${type === 'lycee' ? 'selected' : ''}>Lycée</option>
          <option value="mixte" ${type === 'mixte' ? 'selected' : ''}>Collège-Lycée (mixte)</option>
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Zone vacances scolaires <span class="required">*</span></label>
        <select class="form-select" id="wiz-etab-zone">
          ${['A', 'B', 'C', 'CORSE'].map(z => `<option value="${z}" ${zone === z ? 'selected' : ''}>${zoneLabel(z)}</option>`).join('')}
        </select>
        <span style="font-size:var(--fs-xs);color:var(--c-text-muted);margin-top:4px;display:block;">
          Détermine les dates de vacances et jours fériés exclus des exports.
        </span>
      </div>
      <div class="form-group">
        <label class="form-label">Année scolaire <span class="required">*</span></label>
        <select class="form-select" id="wiz-etab-annee">
          ${ANNEES_SCOLAIRES.map(a => `<option value="${a}" ${annee === a ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
        <span style="font-size:var(--fs-xs);color:var(--c-text-muted);margin-top:4px;display:block;">
          Les exclusions de vacances et jours fériés sont pré-configurées pour chaque année.
        </span>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Heure début journée</label>
        <input type="time" class="form-input" id="wiz-etab-hdebut" value="${heureDebut}">
      </div>
      <div class="form-group">
        <label class="form-label">Heure fin journée</label>
        <input type="time" class="form-input" id="wiz-etab-hfin" value="${heureFin}">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Jours ouvrés</label>
      <div class="chip-group" id="wiz-jours">
        ${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'].map(j => `
          <span class="chip ${JOURS_OUVRES.includes(j) ? 'selected' : ''}" data-jour="${j}">
            ${j.charAt(0).toUpperCase() + j.slice(1)}
          </span>
        `).join('')}
      </div>
    </div>
  `;

  // Toggle chips jours
  container.querySelectorAll('#wiz-jours .chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });
}

// === Étape Périodes (maintenant étape 4, après Classes) ===

/**
 * Calcule le label résumé des cibles d'une période.
 * cibles peut être :
 * - 'tous' ou undefined → "Toutes les classes"
 * - { niveaux: ['3e','4e'], classesIds: [12,13] } → "3e, 4e, 3A, 3B"
 */
function ciblesLabel(cibles, classesMap) {
  if (!cibles || cibles === 'tous') return 'Toutes les classes';
  const parts = [];
  if (cibles.niveaux && cibles.niveaux.length > 0) {
    parts.push(...cibles.niveaux);
  }
  if (cibles.classesIds && cibles.classesIds.length > 0) {
    for (const id of cibles.classesIds) {
      const c = classesMap[id];
      if (c) parts.push(c.nom);
    }
  }
  return parts.length > 0 ? parts.join(', ') : 'Toutes les classes';
}

async function renderStepPeriodes(container) {
  const periodes = await db.periodes.toArray();
  const classes = await db.classes.toArray();
  const etabType = await getConfig('etablissementType') || 'mixte';

  // Map des classes pour résoudre les IDs
  const classesMap = {};
  classes.forEach(c => { classesMap[c.id] = c; });

  // Niveaux disponibles selon le type d'établissement
  const niveauxDisponibles = etabType === 'college' ? NIVEAUX.college
    : etabType === 'lycee' ? NIVEAUX.lycee
    : [...NIVEAUX.college, ...NIVEAUX.lycee];

  // Grouper les classes par niveau
  const classesByNiveau = {};
  classes.forEach(c => {
    if (!classesByNiveau[c.niveau]) classesByNiveau[c.niveau] = [];
    classesByNiveau[c.niveau].push(c);
  });

  container.innerHTML = `
    <h3 class="wizard-step-title">Périodes ${helpTip('periodes')}</h3>
    <p class="wizard-step-desc">
      Définissez les périodes de l'année scolaire. Chaque période peut concerner <strong>toutes les classes</strong>
      ou un <strong>sous-ensemble</strong> (niveaux ou classes spécifiques).<br>
      <em style="color:var(--c-text-muted);font-size:var(--fs-sm);">
        Ex: les 3èmes en semestre sur un créneau et en trimestre sur l'autre.
      </em>
    </p>

    <div class="form-group">
      <label class="form-label">Modèle de base</label>
      <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-4);">
        <button class="btn btn-outline btn-sm" id="wiz-per-tri">3 Trimestres</button>
        <button class="btn btn-outline btn-sm" id="wiz-per-sem">2 Semestres</button>
        <button class="btn btn-outline btn-sm" id="wiz-per-add-one">+ Période</button>
        <button class="btn btn-outline btn-sm" id="wiz-per-tri-sem" title="3 trimestres + 2 semestres (personnalisez les cibles ensuite)">
          Trimestres + Semestres
        </button>
      </div>
    </div>

    <div class="editable-list">
      <div class="editable-list-header">
        <h4>Périodes (${periodes.length})</h4>
        <button class="btn btn-sm btn-primary" id="wiz-per-add">+ Ajouter</button>
      </div>
      <div class="editable-list-body" id="wiz-per-list">
        ${periodes.length === 0
          ? '<div class="editable-list-empty">Aucune période. Choisissez un modèle ou ajoutez manuellement.</div>'
          : periodes.map(p => periodeItemHtml(p, classesMap)).join('')}
      </div>
    </div>
  `;

  // === Modèles prédéfinis ===
  // Dates calculées depuis l'année scolaire configurée (ex: 2026-2027 → y1=2026, y2=2027)
  async function getAnneeDates() {
    const annee = await getConfig('anneeScolaire') || '2025-2026';
    const y1 = annee.split('-')[0];
    const y2 = String(parseInt(y1) + 1);
    return { y1, y2 };
  }

  document.getElementById('wiz-per-tri')?.addEventListener('click', async () => {
    const { y1, y2 } = await getAnneeDates();
    await db.periodes.clear();
    await db.periodes.bulkAdd([
      { nom: 'Trimestre 1', type: 'trimestre', dateDebut: `${y1}-09-02`, dateFin: `${y1}-11-29`, niveau: 'tous', cibles: 'tous', ordre: 1 },
      { nom: 'Trimestre 2', type: 'trimestre', dateDebut: `${y1}-12-02`, dateFin: `${y2}-03-13`, niveau: 'tous', cibles: 'tous', ordre: 2 },
      { nom: 'Trimestre 3', type: 'trimestre', dateDebut: `${y2}-03-16`, dateFin: `${y2}-06-12`, niveau: 'tous', cibles: 'tous', ordre: 3 },
    ]);
    toast.success('3 trimestres créés');
    await renderStepPeriodes(container);
  });

  document.getElementById('wiz-per-sem')?.addEventListener('click', async () => {
    const { y1, y2 } = await getAnneeDates();
    await db.periodes.clear();
    await db.periodes.bulkAdd([
      { nom: 'Semestre 1', type: 'semestre', dateDebut: `${y1}-09-02`, dateFin: `${y2}-01-17`, niveau: 'tous', cibles: 'tous', ordre: 1 },
      { nom: 'Semestre 2', type: 'semestre', dateDebut: `${y2}-01-19`, dateFin: `${y2}-06-12`, niveau: 'tous', cibles: 'tous', ordre: 2 },
    ]);
    toast.success('2 semestres créés');
    await renderStepPeriodes(container);
  });

  // Ajouter une seule période (bouton raccourci dans la barre de modèles)
  document.getElementById('wiz-per-add-one')?.addEventListener('click', async () => {
    const { y1 } = await getAnneeDates();
    const nb = await db.periodes.count();
    await db.periodes.add({
      nom: `Période ${nb + 1}`,
      type: 'custom',
      dateDebut: `${y1}-09-02`,
      dateFin: '',
      niveau: 'tous',
      cibles: 'tous',
      ordre: nb + 1,
    });
    toast.success('Période ajoutée');
    await renderStepPeriodes(container);
  });

  // Modèle combiné : Trimestres + Semestres (générique, l'utilisateur personnalise les cibles)
  document.getElementById('wiz-per-tri-sem')?.addEventListener('click', async () => {
    const { y1, y2 } = await getAnneeDates();
    await db.periodes.clear();
    await db.periodes.bulkAdd([
      { nom: 'Trimestre 1', type: 'trimestre', dateDebut: `${y1}-09-02`, dateFin: `${y1}-11-29`, niveau: 'tous', cibles: 'tous', ordre: 1 },
      { nom: 'Trimestre 2', type: 'trimestre', dateDebut: `${y1}-12-02`, dateFin: `${y2}-03-13`, niveau: 'tous', cibles: 'tous', ordre: 2 },
      { nom: 'Trimestre 3', type: 'trimestre', dateDebut: `${y2}-03-16`, dateFin: `${y2}-06-12`, niveau: 'tous', cibles: 'tous', ordre: 3 },
      { nom: 'Semestre 1', type: 'semestre', dateDebut: `${y1}-09-02`, dateFin: `${y2}-01-17`, niveau: 'tous', cibles: 'tous', ordre: 4 },
      { nom: 'Semestre 2', type: 'semestre', dateDebut: `${y2}-01-19`, dateFin: `${y2}-06-12`, niveau: 'tous', cibles: 'tous', ordre: 5 },
    ]);
    toast.success('3 trimestres + 2 semestres créés — personnalisez les cibles si nécessaire');
    await renderStepPeriodes(container);
  });

  // Ajouter une période
  document.getElementById('wiz-per-add')?.addEventListener('click', async () => {
    const nb = await db.periodes.count();
    await db.periodes.add({
      nom: `Période ${nb + 1}`,
      type: 'custom',
      dateDebut: '',
      dateFin: '',
      niveau: 'tous',
      cibles: 'tous',
      ordre: nb + 1,
    });
    await renderStepPeriodes(container);
  });

  // === Bind édition et suppression ===
  bindPeriodesActions(container, classesMap, classesByNiveau, niveauxDisponibles, () => renderStepPeriodes(container));
}

/**
 * Bind spécifique pour les périodes : édition + suppression + sélecteur cibles
 */
function bindPeriodesActions(container, classesMap, classesByNiveau, niveauxDisponibles, rerender) {
  // Met à jour le label affiché sans rerender toute la liste
  async function refreshCiblesLabel(selector, periodeId) {
    const periode = await db.periodes.get(periodeId);
    if (!periode) return;
    const label = ciblesLabel(periode.cibles, classesMap);
    const isTous = !periode.cibles || periode.cibles === 'tous';
    const labelEl = selector.querySelector('.cibles-label');
    if (labelEl) {
      labelEl.textContent = isTous ? '🔵 Tous' : '🎯 ' + label;
      labelEl.className = 'cibles-label ' + (isTous ? 'cibles-tous' : 'cibles-custom');
    }
    const cbAll = selector.querySelector('.cb-tous');
    if (cbAll) cbAll.checked = isTous;
  }

  // Sauvegarde auto sur changement (inputs nom, dates)
  container.querySelectorAll('.editable-list-item input[data-field], .editable-list-item select[data-field]').forEach(input => {
    input.addEventListener('change', async () => {
      const item = input.closest('.editable-list-item');
      const id = parseInt(item.dataset.id);
      const field = input.dataset.field;
      if (!field || isNaN(id)) return;
      let value = input.type === 'number' ? parseInt(input.value) : input.value;
      await db.periodes.update(id, { [field]: value });
    });
  });

  // Suppression
  container.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.editable-list-item');
      const id = parseInt(item.dataset.id);
      if (!isNaN(id)) {
        await db.periodes.delete(id);
        rerender();
      }
    });
  });

  // Sélecteur de cibles (dropdown multi-select)
  container.querySelectorAll('.cibles-selector').forEach(selector => {
    const id = parseInt(selector.dataset.periodeId);
    const display = selector.querySelector('.cibles-display');
    const dropdown = selector.querySelector('.cibles-dropdown');

    // Toggle dropdown (position: fixed pour éviter le clip par overflow)
    display.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll('.cibles-dropdown.open').forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
      });
      dropdown.classList.toggle('open');
      if (dropdown.classList.contains('open')) {
        const rect = display.getBoundingClientRect();
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = (rect.bottom + 4) + 'px';
        const dropRect = dropdown.getBoundingClientRect();
        if (dropRect.bottom > window.innerHeight - 20) {
          dropdown.style.top = (rect.top - dropRect.height - 4) + 'px';
        }
      }
    });

    // Bouton Fermer — ferme sans rerender
    dropdown.querySelector('.cibles-fermer')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.remove('open');
    });

    // Sélection "Toutes les classes"
    const cbAll = dropdown.querySelector('.cb-tous');
    if (cbAll) {
      cbAll.addEventListener('change', async () => {
        if (cbAll.checked) {
          await db.periodes.update(id, { niveau: 'tous', cibles: 'tous' });
          dropdown.querySelectorAll('.cb-niveau, .cb-classe').forEach(cb => { cb.checked = false; });
        } else {
          await db.periodes.update(id, { niveau: 'custom', cibles: { niveaux: [], classesIds: [] } });
        }
        await refreshCiblesLabel(selector, id);
      });
    }

    // Sélection d'un niveau — auto-uncheck "Tous"
    dropdown.querySelectorAll('.cb-niveau').forEach(cb => {
      cb.addEventListener('change', async () => {
        const periode = await db.periodes.get(id);
        let cibles = (periode.cibles && periode.cibles !== 'tous')
          ? { ...periode.cibles }
          : { niveaux: [], classesIds: [] };
        const niv = cb.dataset.niveau;
        if (cb.checked) {
          if (!cibles.niveaux.includes(niv)) cibles.niveaux.push(niv);
          // Retirer les classes individuelles de ce niveau (redondant)
          const classesOfNiv = (classesByNiveau[niv] || []).map(c => c.id);
          cibles.classesIds = cibles.classesIds.filter(cid => !classesOfNiv.includes(cid));
          // Décocher les classes individuelles de ce niveau dans le DOM
          classesOfNiv.forEach(cid => {
            const cbCls = dropdown.querySelector(`.cb-classe[data-classe-id="${cid}"]`);
            if (cbCls) cbCls.checked = false;
          });
        } else {
          cibles.niveaux = cibles.niveaux.filter(n => n !== niv);
        }
        const isEmpty = cibles.niveaux.length === 0 && cibles.classesIds.length === 0;
        await db.periodes.update(id, {
          niveau: isEmpty ? 'tous' : 'custom',
          cibles: isEmpty ? 'tous' : cibles,
        });
        await refreshCiblesLabel(selector, id);
      });
    });

    // Sélection d'une classe individuelle — auto-uncheck "Tous"
    dropdown.querySelectorAll('.cb-classe').forEach(cb => {
      cb.addEventListener('change', async () => {
        const periode = await db.periodes.get(id);
        let cibles = (periode.cibles && periode.cibles !== 'tous')
          ? { ...periode.cibles }
          : { niveaux: [], classesIds: [] };
        const clsId = parseInt(cb.dataset.classeId);
        if (cb.checked) {
          if (!cibles.classesIds.includes(clsId)) cibles.classesIds.push(clsId);
        } else {
          cibles.classesIds = cibles.classesIds.filter(cid => cid !== clsId);
        }
        const isEmpty = cibles.niveaux.length === 0 && cibles.classesIds.length === 0;
        await db.periodes.update(id, {
          niveau: isEmpty ? 'tous' : 'custom',
          cibles: isEmpty ? 'tous' : cibles,
        });
        await refreshCiblesLabel(selector, id);
      });
    });
  });

  // Fermer les dropdowns quand on clique ailleurs
  const closeHandler = (e) => {
    if (e.target.closest('.cibles-dropdown')) return;
    container.querySelectorAll('.cibles-dropdown.open').forEach(d => d.classList.remove('open'));
  };
  document.addEventListener('click', closeHandler);
  container._cleanupCibles = () => document.removeEventListener('click', closeHandler);
}

function periodeItemHtml(p, classesMap) {
  const label = ciblesLabel(p.cibles, classesMap);
  const isTous = !p.cibles || p.cibles === 'tous';
  const selectedNiveaux = (!isTous && p.cibles.niveaux) ? p.cibles.niveaux : [];
  const selectedClassesIds = (!isTous && p.cibles.classesIds) ? p.cibles.classesIds : [];

  // Construire les options du dropdown
  const allClasses = Object.values(classesMap);
  const niveaux = [...new Set(allClasses.map(c => c.niveau))].sort();

  // Grouper classes par niveau
  const classesByNiv = {};
  allClasses.forEach(c => {
    if (!classesByNiv[c.niveau]) classesByNiv[c.niveau] = [];
    classesByNiv[c.niveau].push(c);
  });

  let dropdownContent = `
    <label class="cibles-option cibles-option-tous">
      <input type="checkbox" class="cb-tous" ${isTous ? 'checked' : ''}> <strong>Toutes les classes</strong>
    </label>
    <div class="cibles-separator"></div>
  `;

  for (const niv of niveaux) {
    const isNivChecked = selectedNiveaux.includes(niv);
    const classesOfNiv = classesByNiv[niv] || [];
    dropdownContent += `
      <label class="cibles-option cibles-option-niveau">
        <input type="checkbox" class="cb-niveau" data-niveau="${niv}" ${isNivChecked ? 'checked' : ''}>
        <strong>Tout le niveau ${niv}</strong>
      </label>
    `;
    for (const cls of classesOfNiv) {
      const isClsChecked = selectedClassesIds.includes(cls.id);
      dropdownContent += `
        <label class="cibles-option cibles-option-classe">
          <input type="checkbox" class="cb-classe" data-classe-id="${cls.id}" ${isClsChecked ? 'checked' : ''}>
          ${cls.nom}
        </label>
      `;
    }
  }

  return `
    <div class="editable-list-item" data-id="${p.id}" style="flex-wrap:wrap;gap:8px;">
      <div style="flex:1;min-width:120px;">
        <input type="text" class="form-input" value="${p.nom}" data-field="nom"
               style="padding:2px 6px;font-size:var(--fs-sm);border:1px solid transparent;background:transparent;width:100%;"
               onfocus="this.style.border='1px solid var(--c-border)';this.style.background='white'"
               onblur="this.style.border='1px solid transparent';this.style.background='transparent'">
      </div>
      <div style="display:flex;gap:var(--sp-2);align-items:center;">
        <input type="date" class="form-input" value="${p.dateDebut || ''}" data-field="dateDebut"
               style="padding:2px 6px;font-size:var(--fs-xs);width:130px;">
        <span style="color:var(--c-text-muted);">→</span>
        <input type="date" class="form-input" value="${p.dateFin || ''}" data-field="dateFin"
               style="padding:2px 6px;font-size:var(--fs-xs);width:130px;">
      </div>
      <div class="cibles-selector" data-periode-id="${p.id}" style="position:relative;">
        <div class="cibles-display" title="${label}">
          <span class="cibles-label ${isTous ? 'cibles-tous' : 'cibles-custom'}">${isTous ? '🔵 Tous' : '🎯 ' + label}</span>
          <span class="cibles-chevron">▾</span>
        </div>
        <div class="cibles-dropdown" onclick="event.stopPropagation();">
          ${dropdownContent}
          <div class="cibles-dropdown-footer">
            <button class="btn btn-sm btn-outline cibles-fermer">Fermer ✓</button>
          </div>
        </div>
      </div>
      <div class="item-actions">
        <button class="btn-del" title="Supprimer">&times;</button>
      </div>
    </div>
  `;
}

// === Étape 3 : Enseignants ===

async function renderStepEnseignants(container) {
  const enseignants = await db.enseignants.toArray();

  container.innerHTML = `
    <h3 class="wizard-step-title">Enseignants EPS</h3>
    <p class="wizard-step-desc">Ajoutez les enseignants de l'équipe avec leurs heures de service.</p>

    <div class="editable-list">
      <div class="editable-list-header">
        <h4>Enseignants (${enseignants.length})</h4>
        <button class="btn btn-sm btn-primary" id="wiz-ens-add">+ Ajouter</button>
      </div>
      <div class="editable-list-body" id="wiz-ens-list">
        ${enseignants.length === 0 ? '<div class="editable-list-empty">Aucun enseignant. Ajoutez les membres de l\'équipe EPS.</div>' : ''}
        ${enseignants.map(e => `
          <div class="editable-list-item" data-id="${e.id}">
            <input type="text" class="form-input" value="${e.prenom || ''}" data-field="prenom" placeholder="Prénom"
                   style="padding:2px 6px;font-size:var(--fs-sm);width:100px;border:1px solid var(--c-border);border-radius:var(--radius-sm);">
            <input type="text" class="form-input" value="${e.nom || ''}" data-field="nom" placeholder="Nom"
                   style="padding:2px 6px;font-size:var(--fs-sm);width:120px;border:1px solid var(--c-border);border-radius:var(--radius-sm);">
            <input type="text" class="form-input" value="${e.initiales || ''}" data-field="initiales" placeholder="Init."
                   style="padding:2px 6px;font-size:var(--fs-sm);width:50px;border:1px solid var(--c-border);border-radius:var(--radius-sm);text-transform:uppercase;">
            <div style="display:flex;align-items:center;gap:4px;">
              <label style="font-size:var(--fs-xs);color:var(--c-text-muted);">ORS ${helpTip('ors')}</label>
              <input type="number" class="form-input" value="${e.ors || 18}" data-field="ors" min="1" max="20"
                     style="padding:2px 6px;font-size:var(--fs-sm);width:50px;border:1px solid var(--c-border);border-radius:var(--radius-sm);">
              <label style="font-size:var(--fs-xs);color:var(--c-text-muted);">h</label>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
              <label style="font-size:var(--fs-xs);color:var(--c-text-muted);">AS ${helpTip('as')}</label>
              <input type="number" class="form-input" value="${e.heuresAS || 0}" data-field="heuresAS" min="0" max="6"
                     style="padding:2px 6px;font-size:var(--fs-sm);width:50px;border:1px solid var(--c-border);border-radius:var(--radius-sm);">
              <label style="font-size:var(--fs-xs);color:var(--c-text-muted);">h</label>
            </div>
            <div class="item-actions">
              <button class="btn-del" title="Supprimer">&times;</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('wiz-ens-add')?.addEventListener('click', async () => {
    await db.enseignants.add({
      nom: '', prenom: '', initiales: '', ors: 18, heuresAS: 0,
      maxHeuresJour: 6, indisponibilites: [],
    });
    await renderStepEnseignants(container);
  });

  bindListActions(container, 'ens', db.enseignants, () => renderStepEnseignants(container));
}

// === Étape 4 : Classes ===

async function renderStepClasses(container) {
  const classes = await db.classes.toArray();
  const enseignants = await db.enseignants.toArray();
  const etabType = await getConfig('etablissementType') || 'mixte';

  const niveaux = etabType === 'college' ? NIVEAUX.college
    : etabType === 'lycee' ? NIVEAUX.lycee
    : [...NIVEAUX.college, ...NIVEAUX.lycee];

  container.innerHTML = `
    <h3 class="wizard-step-title">Classes</h3>
    <p class="wizard-step-desc">Ajoutez les classes avec leur niveau, effectif et enseignant référent EPS. ${helpTip('niveauClasse')}</p>

    <div style="margin-bottom:var(--sp-4);display:flex;gap:var(--sp-2);">
      <button class="btn btn-outline btn-sm" id="wiz-cls-gen-college">Générer collège type</button>
      <button class="btn btn-outline btn-sm" id="wiz-cls-gen-lycee">Générer lycée type</button>
    </div>

    <div class="editable-list">
      <div class="editable-list-header">
        <h4>Classes (${classes.length})</h4>
        <button class="btn btn-sm btn-primary" id="wiz-cls-add">+ Ajouter</button>
      </div>
      <div class="editable-list-body" id="wiz-cls-list">
        ${classes.length === 0 ? '<div class="editable-list-empty">Aucune classe. Utilisez les boutons ci-dessus ou ajoutez manuellement.</div>' : ''}
        ${classes.map(c => `
          <div class="editable-list-item" data-id="${c.id}">
            <input type="text" class="form-input" value="${c.nom || ''}" data-field="nom" placeholder="Nom"
                   style="padding:2px 6px;font-size:var(--fs-sm);width:80px;border:1px solid var(--c-border);border-radius:var(--radius-sm);">
            <select class="form-select" data-field="niveau" style="padding:2px 6px;font-size:var(--fs-xs);width:80px;">
              ${niveaux.map(n => `<option value="${n}" ${c.niveau === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
            <div style="display:flex;align-items:center;gap:4px;">
              <input type="number" class="form-input" value="${c.effectif || 30}" data-field="effectif" min="1" max="40"
                     style="padding:2px 6px;font-size:var(--fs-sm);width:50px;border:1px solid var(--c-border);border-radius:var(--radius-sm);">
              <label style="font-size:var(--fs-xs);color:var(--c-text-muted);">élèves</label>
            </div>
            <select class="form-select" data-field="enseignantId" style="padding:2px 6px;font-size:var(--fs-xs);width:140px;">
              <option value="">-- Enseignant --</option>
              ${enseignants.map(e => `<option value="${e.id}" ${c.enseignantId == e.id ? 'selected' : ''}>${e.prenom} ${e.nom}</option>`).join('')}
            </select>
            <div class="item-actions">
              <button class="btn-del" title="Supprimer">&times;</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Générer classes type collège
  document.getElementById('wiz-cls-gen-college')?.addEventListener('click', async () => {
    const existing = (await db.classes.toArray()).map(c => c.nom);
    const toAdd = [];
    for (const niv of ['6e', '5e', '4e', '3e']) {
      for (const lettre of ['A', 'B', 'C']) {
        const nom = `${niv.replace('e', '')}${lettre}`;
        if (!existing.includes(nom)) {
          toAdd.push({ nom, niveau: niv, effectif: 30, enseignantId: null });
        }
      }
    }
    if (toAdd.length > 0) {
      await db.classes.bulkAdd(toAdd);
      toast.success(`${toAdd.length} classes ajoutées`);
    }
    await renderStepClasses(container);
  });

  // Générer classes type lycée
  document.getElementById('wiz-cls-gen-lycee')?.addEventListener('click', async () => {
    const existing = (await db.classes.toArray()).map(c => c.nom);
    const toAdd = [];
    for (const lettre of ['A', 'B', 'C', 'D', 'E']) {
      const nom = `2${lettre}`;
      if (!existing.includes(nom)) toAdd.push({ nom, niveau: '2nde', effectif: 35, enseignantId: null });
    }
    for (let i = 1; i <= 5; i++) {
      if (!existing.includes(`1EPS${i}`)) toAdd.push({ nom: `1EPS${i}`, niveau: '1ere', effectif: 30, enseignantId: null });
      if (!existing.includes(`TEPS${i}`)) toAdd.push({ nom: `TEPS${i}`, niveau: 'term', effectif: 30, enseignantId: null });
    }
    if (toAdd.length > 0) {
      await db.classes.bulkAdd(toAdd);
      toast.success(`${toAdd.length} classes ajoutées`);
    }
    await renderStepClasses(container);
  });

  document.getElementById('wiz-cls-add')?.addEventListener('click', async () => {
    await db.classes.add({ nom: '', niveau: niveaux[0], effectif: 30, enseignantId: null });
    await renderStepClasses(container);
  });

  bindListActions(container, 'cls', db.classes, () => renderStepClasses(container));
}

// === Étape 5 : Activités ===

async function renderStepActivites(container) {
  const activites = await db.activites.toArray();

  container.innerHTML = `
    <h3 class="wizard-step-title">Activités EPS</h3>
    <p class="wizard-step-desc">Catalogue des activités enseignées, classées par champ d'apprentissage. ${helpTip('champApprentissage')}</p>

    <div style="margin-bottom:var(--sp-4);">
      <button class="btn btn-outline btn-sm" id="wiz-act-default">Charger le catalogue par défaut</button>
    </div>

    <div class="editable-list">
      <div class="editable-list-header">
        <h4>Activités (${activites.length})</h4>
        <button class="btn btn-sm btn-primary" id="wiz-act-add">+ Ajouter</button>
      </div>
      <div class="editable-list-body" id="wiz-act-list">
        ${activites.length === 0 ? '<div class="editable-list-empty">Aucune activité. Chargez le catalogue par défaut ou ajoutez manuellement.</div>' : ''}
        ${activites.map(a => `
          <div class="editable-list-item" data-id="${a.id}">
            <input type="text" class="form-input" value="${a.nom || ''}" data-field="nom" placeholder="Nom"
                   style="padding:2px 6px;font-size:var(--fs-sm);width:150px;border:1px solid var(--c-border);border-radius:var(--radius-sm);">
            <select class="form-select" data-field="champApprentissage" style="padding:2px 6px;font-size:var(--fs-xs);width:120px;">
              ${CHAMPS_APPRENTISSAGE.map(ca => `
                <option value="${ca.code}" ${a.champApprentissage === ca.code ? 'selected' : ''}>${ca.code} - ${ca.nom}</option>
              `).join('')}
            </select>
            <input type="text" class="form-input" value="${a.code || ''}" data-field="code" placeholder="Code court"
                   style="padding:2px 6px;font-size:var(--fs-xs);width:60px;border:1px solid var(--c-border);border-radius:var(--radius-sm);text-transform:uppercase;">
            <div class="item-actions">
              <button class="btn-del" title="Supprimer">&times;</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Catalogue par défaut (issu des fichiers Excel analysés)
  document.getElementById('wiz-act-default')?.addEventListener('click', async () => {
    const existing = (await db.activites.toArray()).map(a => a.nom.toLowerCase());
    const catalogue = [
      { nom: 'Athlétisme', champApprentissage: 'CA1', code: 'ATH' },
      { nom: 'Relais Vitesse', champApprentissage: 'CA1', code: 'REL' },
      { nom: 'Biathlon', champApprentissage: 'CA1', code: 'BIATHL' },
      { nom: 'Demi-fond', champApprentissage: 'CA1', code: '1/2FD' },
      { nom: 'Pentabond', champApprentissage: 'CA1', code: 'PTABD' },
      { nom: 'Course en durée', champApprentissage: 'CA1', code: 'DUREE' },
      { nom: 'Épreuves combinées', champApprentissage: 'CA1', code: 'EPCOMB' },
      { nom: 'Natation', champApprentissage: 'CA1', code: 'NAT', exigenceInstallation: 'piscine' },
      { nom: 'Sauvetage', champApprentissage: 'CA1', code: 'SAUV', exigenceInstallation: 'piscine' },
      { nom: 'Course d\'orientation', champApprentissage: 'CA2', code: 'CO' },
      { nom: 'Laser Fit', champApprentissage: 'CA2', code: 'LASER' },
      { nom: 'Gymnastique', champApprentissage: 'CA3', code: 'GYM' },
      { nom: 'Acrosport', champApprentissage: 'CA3', code: 'ACRO' },
      { nom: 'Danse', champApprentissage: 'CA3', code: 'DANSE' },
      { nom: 'Arts du cirque', champApprentissage: 'CA3', code: 'CIRQUE' },
      { nom: 'Step', champApprentissage: 'CA3', code: 'STEP' },
      { nom: 'Musculation', champApprentissage: 'CA3', code: 'MUSCU' },
      { nom: 'Volley-ball', champApprentissage: 'CA4', code: 'VB' },
      { nom: 'Basket-ball', champApprentissage: 'CA4', code: 'BB' },
      { nom: 'Handball', champApprentissage: 'CA4', code: 'HB' },
      { nom: 'Football', champApprentissage: 'CA4', code: 'FOOT' },
      { nom: 'Rugby', champApprentissage: 'CA4', code: 'RUGBY' },
      { nom: 'Ultimate', champApprentissage: 'CA4', code: 'ULTI' },
      { nom: 'Tennis de table', champApprentissage: 'CA4', code: 'TT' },
      { nom: 'Lutte', champApprentissage: 'CA4', code: 'LUTTE' },
      { nom: 'Balle ovale', champApprentissage: 'CA4', code: 'BF' },
    ];
    const toAdd = catalogue.filter(a => !existing.includes(a.nom.toLowerCase()));
    if (toAdd.length > 0) {
      await db.activites.bulkAdd(toAdd);
      toast.success(`${toAdd.length} activités ajoutées`);
    } else {
      toast.info('Catalogue déjà chargé');
    }
    await renderStepActivites(container);
  });

  document.getElementById('wiz-act-add')?.addEventListener('click', async () => {
    await db.activites.add({ nom: '', champApprentissage: 'CA1', code: '' });
    await renderStepActivites(container);
  });

  bindListActions(container, 'act', db.activites, () => renderStepActivites(container));
}

// === Étape 6 : Installations ===

async function renderStepInstallations(container) {
  const lieux = await db.lieux.toArray();
  const installations = await db.installations.toArray();

  container.innerHTML = `
    <h3 class="wizard-step-title">Lieux & Installations sportives</h3>
    <p class="wizard-step-desc">
      Un <strong>lieu</strong> regroupe plusieurs <strong>installations</strong> (ex: Stade Fort Carré → piste, synthétique, beach).
      Indiquez si le lieu nécessite un transport en bus.
    </p>

    <div style="margin-bottom:var(--sp-4);">
      <button class="btn btn-outline btn-sm" id="wiz-inst-default">Charger les installations MSJ/Antibes</button>
    </div>

    <div class="editable-list" style="margin-bottom:var(--sp-4);">
      <div class="editable-list-header">
        <h4>Lieux (${lieux.length})</h4>
        <button class="btn btn-sm btn-primary" id="wiz-lieu-add">+ Lieu</button>
      </div>
      <div class="editable-list-body" id="wiz-lieu-list">
        ${lieux.length === 0 ? '<div class="editable-list-empty">Aucun lieu. Chargez les valeurs par défaut ou ajoutez manuellement.</div>' : ''}
        ${lieux.map(l => `
          <div class="editable-list-item" data-id="${l.id}" data-table="lieux">
            <input type="text" class="form-input" value="${l.nom || ''}" data-field="nom" placeholder="Nom du lieu"
                   style="padding:2px 6px;font-size:var(--fs-sm);width:160px;border:1px solid var(--c-border);border-radius:var(--radius-sm);">
                    <select class="form-select" data-field="type" style="padding:2px 6px;font-size:var(--fs-xs);width:80px;" title="Intra ou extra-muros">
              <option value="intra" ${l.type === 'intra' ? 'selected' : ''}>Intra</option>
              <option value="extra" ${l.type === 'extra' ? 'selected' : ''}>Extra</option>
            </select>
            ${helpTip('intraExtra')}
            <label style="font-size:var(--fs-xs);display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="checkbox" data-field="necessiteBus" ${l.necessiteBus ? 'checked' : ''}> Bus
            </label>
            <span style="font-size:var(--fs-xs);color:var(--c-text-muted);">
              ${installations.filter(i => i.lieuId === l.id).length} install.
            </span>
            <div class="item-actions">
              <button class="btn-add-sub" title="+ Installation" style="font-size:11px;">+inst</button>
              <button class="btn-del" title="Supprimer">&times;</button>
            </div>
          </div>
          ${installations.filter(i => i.lieuId === l.id).map(inst => `
            <div class="editable-list-item" data-id="${inst.id}" data-table="installations" style="padding-left:40px;background:var(--c-surface-alt);">
              <span style="color:var(--c-text-muted);font-size:10px;">&#8627;</span>
              <input type="text" class="form-input" value="${inst.nom || ''}" data-field="nom" placeholder="Nom installation"
                     style="padding:2px 6px;font-size:var(--fs-xs);width:160px;border:1px solid var(--c-border);border-radius:var(--radius-sm);">
              <div style="display:flex;align-items:center;gap:4px;">
                <label style="font-size:var(--fs-xs);color:var(--c-text-muted);">Cap.</label>
                <input type="number" class="form-input" value="${inst.capaciteSimultanee || 1}" data-field="capaciteSimultanee" min="1" max="10"
                       style="padding:2px 6px;font-size:var(--fs-xs);width:40px;border:1px solid var(--c-border);border-radius:var(--radius-sm);">
              </div>
              <div class="item-actions">
                <button class="btn-del" title="Supprimer">&times;</button>
              </div>
            </div>
          `).join('')}
        `).join('')}
      </div>
    </div>
  `;

  // Charger les installations MSJ par défaut
  document.getElementById('wiz-inst-default')?.addEventListener('click', async () => {
    const existingLieux = (await db.lieux.toArray()).map(l => l.nom.toLowerCase());
    const data = [
      { lieu: { nom: 'Fort Carré', type: 'extra', necessiteBus: true, slug: 'fort-carre' }, installs: [
        { nom: 'Piste athlé', capaciteSimultanee: 2 },
        { nom: 'Synthétique', capaciteSimultanee: 2 },
        { nom: 'Beach', capaciteSimultanee: 1 },
        { nom: 'Terrains 3x3', capaciteSimultanee: 2 },
      ]},
      { lieu: { nom: 'Stade Auvergne', type: 'extra', necessiteBus: true, slug: 'auvergne' }, installs: [
        { nom: 'Synthétique A', capaciteSimultanee: 2 },
        { nom: 'Synthétique B', capaciteSimultanee: 2 },
      ]},
      { lieu: { nom: 'Stade Foch', type: 'extra', necessiteBus: true, slug: 'foch' }, installs: [
        { nom: 'Piste athlé Foch', capaciteSimultanee: 2 },
        { nom: 'Plateau central', capaciteSimultanee: 2 },
        { nom: 'Salle Foch', capaciteSimultanee: 1 },
      ]},
      { lieu: { nom: 'Fontonne', type: 'extra', necessiteBus: true, slug: 'fontonne' }, installs: [
        { nom: 'Terrains hockey', capaciteSimultanee: 2 },
      ]},
      { lieu: { nom: 'Piscine', type: 'extra', necessiteBus: true, slug: 'piscine' }, installs: [
        { nom: 'Bassin', capaciteSimultanee: 2 },
      ]},
      { lieu: { nom: 'Gymnase', type: 'intra', necessiteBus: false, slug: 'gymnase' }, installs: [
        { nom: 'Gymnase principal', capaciteSimultanee: 2 },
      ]},
      { lieu: { nom: 'Terrain MSJ', type: 'intra', necessiteBus: false, slug: 'terr-msj' }, installs: [
        { nom: 'Terrain extérieur MSJ', capaciteSimultanee: 2 },
      ]},
      { lieu: { nom: 'Parc Exflora', type: 'extra', necessiteBus: false, slug: 'parc-exflora' }, installs: [
        { nom: 'Parc Exflora', capaciteSimultanee: 3 },
      ]},
    ];

    let added = 0;
    for (const item of data) {
      if (!existingLieux.includes(item.lieu.nom.toLowerCase())) {
        const lieuId = await db.lieux.add(item.lieu);
        for (const inst of item.installs) {
          await db.installations.add({ ...inst, lieuId });
        }
        added++;
      }
    }
    toast.success(`${added} lieux ajoutés avec leurs installations`);
    await renderStepInstallations(container);
  });

  // Ajouter un lieu
  document.getElementById('wiz-lieu-add')?.addEventListener('click', async () => {
    await db.lieux.add({ nom: '', type: 'extra', necessiteBus: false });
    await renderStepInstallations(container);
  });

  // Ajouter une installation sous un lieu
  container.querySelectorAll('.btn-add-sub').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lieuId = parseInt(btn.closest('.editable-list-item').dataset.id);
      await db.installations.add({ nom: '', lieuId, capaciteSimultanee: 1 });
      await renderStepInstallations(container);
    });
  });

  // Suppression
  container.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.editable-list-item');
      const id = parseInt(item.dataset.id);
      const table = item.dataset.table || 'lieux';
      await db[table].delete(id);
      if (table === 'lieux') {
        // Supprimer les installations du lieu
        const installs = await db.installations.where('lieuId').equals(id).toArray();
        for (const inst of installs) {
          await db.installations.delete(inst.id);
        }
      }
      await renderStepInstallations(container);
    });
  });

  // Sauvegarde auto sur changement
  container.querySelectorAll('.editable-list-item input, .editable-list-item select').forEach(input => {
    input.addEventListener('change', async () => {
      const item = input.closest('.editable-list-item');
      const id = parseInt(item.dataset.id);
      const table = item.dataset.table || 'lieux';
      const field = input.dataset.field;
      if (!field) return;
      let value = input.type === 'checkbox' ? input.checked
        : input.type === 'number' ? parseInt(input.value)
        : input.value;
      await db[table].update(id, { [field]: value });
    });
  });
}

// === Étape 7 : Récapitulatif ===

async function renderStepRecap(container) {
  const [ens, cls, act, lieux, inst, per] = await Promise.all([
    db.enseignants.toArray(),
    db.classes.toArray(),
    db.activites.toArray(),
    db.lieux.toArray(),
    db.installations.toArray(),
    db.periodes.toArray(),
  ]);
  const nom = await getConfig('etablissementNom') || '(non défini)';
  const type = await getConfig('etablissementType') || 'mixte';

  container.innerHTML = `
    <h3 class="wizard-step-title">Récapitulatif</h3>
    <p class="wizard-step-desc">Vérifiez les données avant de terminer la configuration.</p>

    <div class="stats-grid" style="margin-bottom:var(--sp-6);">
      <div class="stat-card">
        <div class="stat-value">${nom}</div>
        <div class="stat-label">${type}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${per.length}</div>
        <div class="stat-label">Périodes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${ens.length}</div>
        <div class="stat-label">Enseignants</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${cls.length}</div>
        <div class="stat-label">Classes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${act.length}</div>
        <div class="stat-label">Activités</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${lieux.length} / ${inst.length}</div>
        <div class="stat-label">Lieux / Installations</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:var(--sp-4);">
      <h4 style="margin-bottom:var(--sp-3);">Enseignants</h4>
      <table class="data-table">
        <thead><tr><th>Nom</th><th>Nb Heures</th><th>AS</th></tr></thead>
        <tbody>
          ${ens.map(e => `<tr><td>${e.prenom} ${e.nom}</td><td>${e.ors}h</td><td>${e.heuresAS}h</td></tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h4 style="margin-bottom:var(--sp-3);">Classes par niveau</h4>
      ${Object.entries(groupBy(cls, 'niveau')).map(([niv, items]) => `
        <div style="margin-bottom:var(--sp-2);">
          <strong>${niv}</strong> : ${items.map(c => c.nom).join(', ')}
        </div>
      `).join('')}
    </div>
  `;
}

// === Helpers ===

function groupBy(arr, key) {
  return arr.reduce((groups, item) => {
    const val = item[key] || 'autre';
    (groups[val] = groups[val] || []).push(item);
    return groups;
  }, {});
}

/**
 * Sauvegarde l'étape courante
 */
async function saveCurrentStep() {
  const step = STEPS[currentStep];

  if (step.id === 'etablissement') {
    const nom = document.getElementById('wiz-etab-nom')?.value?.trim();
    const type = document.getElementById('wiz-etab-type')?.value;
    const zone = document.getElementById('wiz-etab-zone')?.value;
    const annee = document.getElementById('wiz-etab-annee')?.value?.trim();
    const hDebut = document.getElementById('wiz-etab-hdebut')?.value;
    const hFin = document.getElementById('wiz-etab-hfin')?.value;

    await setConfig('etablissementNom', nom || '');
    await setConfig('etablissementType', type || 'mixte');
    await setConfig('etablissementZone', zone || 'B');
    await setConfig('anneeScolaire', annee || '2025-2026');
    await setConfig('heureDebut', hDebut || '08:00');
    await setConfig('heureFin', hFin || '17:00');

    // Jours ouvrés
    const joursSelected = [];
    document.querySelectorAll('#wiz-jours .chip.selected').forEach(chip => {
      joursSelected.push(chip.dataset.jour);
    });
    await setConfig('joursOuvres', joursSelected);

    // Mettre à jour le badge
    const projectBadge = document.getElementById('project-name');
    if (projectBadge) projectBadge.textContent = nom || '';
  }

  // Pour les autres étapes, la sauvegarde est faite en temps réel via les events
  // sur les inputs (onChange)
  return true;
}

/**
 * Bind les actions de liste (édition en temps réel + suppression)
 */
function bindListActions(container, prefix, table, rerender) {
  // Sauvegarde auto sur changement
  container.querySelectorAll('.editable-list-item input, .editable-list-item select').forEach(input => {
    input.addEventListener('change', async () => {
      const item = input.closest('.editable-list-item');
      const id = parseInt(item.dataset.id);
      const field = input.dataset.field;
      if (!field || isNaN(id)) return;
      let value = input.type === 'checkbox' ? input.checked
        : input.type === 'number' ? parseInt(input.value)
        : (field.endsWith('Id') && input.value && !isNaN(input.value)) ? parseInt(input.value)
        : input.value;
      await table.update(id, { [field]: value });
    });
  });

  // Suppression
  container.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.editable-list-item');
      const id = parseInt(item.dataset.id);
      if (!isNaN(id)) {
        await table.delete(id);
        rerender();
      }
    });
  });
}
