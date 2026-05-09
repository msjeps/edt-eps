/**
 * Vue Données — Gestion CRUD de toutes les entités
 * Onglets : Enseignants | Classes | Activités | Installations | Périodes
 */
import db from '../../db/schema.js';
import { toast } from '../../components/toast.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { NIVEAUX, CHAMPS_APPRENTISSAGE, getChampsApprentissage, JOURS_OUVRES, JOURS_COURTS } from '../../utils/helpers.js';
import { getConfig, setConfig } from '../../db/schema.js';
import { captureUndo } from '../../utils/undo.js';
import {
  cascadeDeleteEnseignant,
  cascadeDeleteInstallation,
  cascadeDeleteLieu,
  countSeancesEnseignant,
  countSeancesInstallation,
  countSeancesLieu,
} from '../../db/store.js';
import {
  getUniqueSpaces,
  importerDisponibilitesMairie,
  supprimerDisponibilitesMairie,
  compterIndisposMairie,
} from '../../import/disponibilites.js';
import { buildMiniGrid, seancesHebdo, totalHStr } from '../vues/vues.js';
import { helpTip } from '../../components/help-tooltip.js';

const TABS = [
  { id: 'enseignants', label: 'Enseignants', icon: '&#129489;' },
  { id: 'contraintes', label: 'Contraintes', icon: '&#9881;&#65039;' },
  { id: 'classes', label: 'Classes', icon: '&#127979;' },
  { id: 'activites', label: 'Activités', icon: '&#9917;' },
  { id: 'installations', label: 'Installations', icon: '&#127963;' },
  { id: 'periodes', label: 'Périodes', icon: '&#128197;' },
];

let activeTab = 'enseignants';

export async function renderDonnees(container) {
  container.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4);">
        <h2>Données</h2>
      </div>
      <div class="tabs" id="donnees-tabs">
        ${TABS.map(t => `
          <button class="tab-btn ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">
            <span>${t.icon}</span> ${t.label}
          </button>
        `).join('')}
      </div>
      <div id="donnees-content"></div>
    </div>
  `;

  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTabContent(container);
    });
  });

  await renderTabContent(container);
}

async function renderTabContent(container) {
  const content = container.querySelector('#donnees-content');
  if (!content) return;

  switch (activeTab) {
    case 'enseignants': await renderEnseignantsTab(content); break;
    case 'contraintes': await renderContraintesTab(content); break;
    case 'classes': await renderClassesTab(content); break;
    case 'activites': await renderActivitesTab(content); break;
    case 'installations': await renderInstallationsTab(content); break;
    case 'periodes': await renderPeriodesTab(content); break;
  }
}

// === Enseignants ===
async function renderEnseignantsTab(container) {
  const enseignants = await db.enseignants.toArray();
  const seances = await db.seances.toArray();
  const toutesIndispos = await db.indisponibilites.where('type').equals('enseignant').toArray();

  const indisposParEns = {};
  for (const i of toutesIndispos) {
    indisposParEns[i.refId] = (indisposParEns[i.refId] || 0) + 1;
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Enseignants EPS (${enseignants.length})</span>
        <button class="btn btn-sm btn-primary" id="btn-add-ens">+ Ajouter</button>
      </div>
      ${enseignants.length === 0 ? '<div class="empty-state"><p>Aucun enseignant</p></div>' : `
        <table class="data-table">
          <thead>
            <tr>
              <th>Nom</th><th>Prénom</th><th>Initiales</th>
              <th>ORS ${helpTip('ors')}</th>
              <th>AS ${helpTip('as')}</th>
              <th>Séances</th>
              <th>Indisponibilités ${helpTip('indisponibilite')}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${enseignants.map(e => {
              const nbSeances = seances.filter(s => s.enseignantId === e.id).length;
              const nbIndispos = indisposParEns[e.id] || 0;
              return `
                <tr data-id="${e.id}">
                  <td><strong>${e.nom || '-'}</strong></td>
                  <td>${e.prenom || '-'}</td>
                  <td><span class="tag tag-primary">${e.initiales || '?'}</span></td>
                  <td>${e.ors || 0}h</td>
                  <td>${e.heuresAS || 0}h</td>
                  <td>${nbSeances}</td>
                  <td>
                    ${nbIndispos > 0
                      ? `<span class="tag tag-warning" title="${nbIndispos} jour(s) bloqué(s)">${nbIndispos} jour(s)</span>`
                      : '<span style="color:var(--c-text-muted);font-size:var(--fs-xs);">—</span>'}
                  </td>
                  <td>
                    <button class="btn btn-sm btn-outline btn-vue-ens" data-id="${e.id}" title="Voir l'emploi du temps hebdomadaire">Semaine type</button>
                    <button class="btn btn-sm btn-outline btn-edit-ens" data-id="${e.id}">Modifier</button>
                    <button class="btn btn-sm btn-danger btn-del-ens" data-id="${e.id}">Suppr.</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;

  container.querySelector('#btn-add-ens')?.addEventListener('click', () => openEnseignantModal());
  container.querySelectorAll('.btn-vue-ens').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ens = await db.enseignants.get(parseInt(btn.dataset.id));
      if (ens) openSemaineTypeModal(ens);
    });
  });
  container.querySelectorAll('.btn-edit-ens').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ens = await db.enseignants.get(parseInt(btn.dataset.id));
      if (ens) openEnseignantModal(ens);
    });
  });
  container.querySelectorAll('.btn-del-ens').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ensId = parseInt(btn.dataset.id);
      const nbSeances = await countSeancesEnseignant(ensId);
      const msg = nbSeances > 0
        ? `Supprimer cet enseignant ? ${nbSeances} séance(s) associée(s) seront également supprimées.`
        : 'Supprimer cet enseignant ?';
      if (await confirmModal('Supprimer', msg)) {
        await captureUndo('Suppression enseignant');
        await cascadeDeleteEnseignant(ensId);
        toast.success('Enseignant supprimé');
        renderTabContent(container.closest('#donnees-content')?.parentElement || container);
      }
    });
  });
}

async function openSemaineTypeModal(ens) {
  const [seancesAll, classes, enseignants, activites, installations, lieux, periodes] = await Promise.all([
    db.seances.toArray(),
    db.classes.toArray(),
    db.enseignants.toArray(),
    db.activites.toArray(),
    db.installations.toArray(),
    db.lieux.toArray(),
    db.periodes.toArray(),
  ]);

  const refs = { classes, enseignants, activites, installations, lieux };
  const seancesEns = seancesAll.filter(s => s.enseignantId === ens.id);
  const periodesPrincipales = periodes
    .filter(p => !p.parentId)
    .sort((a, b) => (a.ordre ?? a.id) - (b.ordre ?? b.id));

  const nom = [ens.prenom, ens.nom].filter(Boolean).join(' ');

  const { close, modal } = openModal({
    title: `Semaine type — ${nom}`,
    content: `
      <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-4);">
        <select class="form-select" id="md-semtype-periode" style="width:auto;min-width:180px;">
          <option value="">Toutes les périodes</option>
          ${periodesPrincipales.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
        </select>
        <span id="md-semtype-total" style="font-size:var(--fs-sm);color:var(--c-text-secondary);font-weight:500;"></span>
      </div>
      <div id="md-semtype-grid" style="overflow-x:auto;min-height:80px;"></div>
    `,
    footer: `<button class="btn btn-outline" id="md-semtype-close">Fermer</button>`,
    wide: true,
  });

  function refreshGrid() {
    const val = modal.querySelector('#md-semtype-periode')?.value;
    const filtered = val ? seancesEns.filter(s => s.periodeId === parseInt(val)) : seancesEns;
    const gridEl = modal.querySelector('#md-semtype-grid');
    const totalEl = modal.querySelector('#md-semtype-total');
    if (gridEl) gridEl.innerHTML = buildMiniGrid(filtered, refs, { showClasse: true, showInstallation: true });
    if (totalEl) {
      const h = totalHStr(filtered);
      totalEl.textContent = `${h} / sem.${ens.ors ? ` · ORS : ${ens.ors}h` : ''}`;
    }
  }

  modal.querySelector('#md-semtype-periode')?.addEventListener('change', refreshGrid);
  modal.querySelector('#md-semtype-close')?.addEventListener('click', close);

  refreshGrid();
}

async function openEnseignantModal(ens = null) {
  const isEdit = ens !== null;
  const existingIndispos = isEdit
    ? await db.indisponibilites.filter(i => i.type === 'enseignant' && i.refId === ens.id).toArray()
    : [];

  const { close, modal } = openModal({
    title: isEdit ? 'Modifier l\'enseignant' : 'Nouvel enseignant',
    content: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Prénom</label>
          <input type="text" class="form-input" id="md-ens-prenom" value="${ens?.prenom || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Nom</label>
          <input type="text" class="form-input" id="md-ens-nom" value="${ens?.nom || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Initiales</label>
          <input type="text" class="form-input" id="md-ens-init" value="${ens?.initiales || ''}" maxlength="4"
                 style="text-transform:uppercase;width:80px;">
        </div>
        <div class="form-group">
          <label class="form-label">ORS ${helpTip('ors')}</label>
          <input type="number" class="form-input" id="md-ens-ors" value="${ens?.ors || 18}" min="1" max="20" style="width:80px;">
        </div>
        <div class="form-group">
          <label class="form-label">AS (heures) ${helpTip('as')}</label>
          <input type="number" class="form-input" id="md-ens-as" value="${ens?.heuresAS || 0}" min="0" max="6" style="width:80px;">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Indisponibilités ${helpTip('indisponibilite')}</label>
        <div style="border:1px solid var(--c-border);border-radius:var(--radius-md);overflow:hidden;">
          ${buildIndispoRowHtml(existingIndispos, 'Absent')}
        </div>
        <div class="form-hint">Absent = journée entière bloquée. Plage = créneau horaire indisponible.</div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" id="md-ens-cancel">Annuler</button>
      <button class="btn btn-primary" id="md-ens-save">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
    `,
  });

  bindIndispoToggle(modal);

  modal.querySelector('#md-ens-cancel')?.addEventListener('click', close);
  modal.querySelector('#md-ens-save')?.addEventListener('click', async () => {
    const data = {
      prenom: modal.querySelector('#md-ens-prenom').value.trim(),
      nom: modal.querySelector('#md-ens-nom').value.trim(),
      initiales: modal.querySelector('#md-ens-init').value.trim().toUpperCase(),
      ors: parseInt(modal.querySelector('#md-ens-ors').value) || 18,
      heuresAS: parseInt(modal.querySelector('#md-ens-as').value) || 0,
      maxHeuresJour: 6,
    };

    if (!data.nom) {
      toast.warning('Le nom est obligatoire');
      return;
    }

    const nouvellesIndispos = collectIndisposFromModal(modal, 'enseignant', null);

    await captureUndo(isEdit ? 'Modification enseignant' : 'Ajout enseignant');

    let ensId;
    if (isEdit) {
      await db.enseignants.update(ens.id, data);
      ensId = ens.id;
      toast.success('Enseignant mis à jour');
    } else {
      ensId = await db.enseignants.add(data);
      toast.success('Enseignant ajouté');
    }

    // Mettre à jour les indisponibilités : supprimer les anciennes, insérer les nouvelles
    await db.indisponibilites.filter(i => i.type === 'enseignant' && i.refId === ensId).delete();
    for (const indispo of nouvellesIndispos) {
      indispo.refId = ensId;
      await db.indisponibilites.add(indispo);
    }

    close();
    const donneesContent = document.getElementById('donnees-content');
    if (donneesContent) await renderEnseignantsTab(donneesContent);
  });
}

// === Contraintes ===
async function renderContraintesTab(container) {
  const [ctMax, ctEcart, ct1prof] = await Promise.all([
    getConfig('contrainte_max_heures_actif'),
    getConfig('contrainte_ecart_24h_actif'),
    getConfig('contrainte_1prof_1classe_actif'),
  ]);

  const regles = [
    {
      cle: 'contrainte_max_heures_actif',
      val: ctMax ?? true,
      titre: 'Limite max heures enseignement / jour',
      desc: 'Un enseignant ne peut pas dépasser 6h d\'EPS par jour (AS non compris).',
    },
    {
      cle: 'contrainte_ecart_24h_actif',
      val: ctEcart ?? true,
      titre: 'Écart minimum 24h entre 2 cours (collège)',
      desc: 'Pour les classes de collège, deux séances de la même classe doivent être séparées d\'au moins 24h.',
    },
    {
      cle: 'contrainte_1prof_1classe_actif',
      val: ct1prof ?? true,
      titre: '1 enseignant = 1 classe par créneau',
      desc: 'Un enseignant ne peut pas être assigné à deux classes différentes au même moment.',
    },
  ];

  container.innerHTML = `
    <div class="card" style="max-width:700px;">
      <div class="card-header">
        <span class="card-title">Règles globales</span>
      </div>
      <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
        Ces contraintes institutionnelles sont actives par défaut. Désactivez-les uniquement si votre organisation le permet.
      </p>
      <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
        ${regles.map(r => `
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);
                      padding:var(--sp-4);border:1px solid var(--c-border);border-radius:var(--radius-md);
                      background:var(--c-surface);">
            <div>
              <div style="font-weight:600;margin-bottom:4px;">${r.titre}</div>
              <div style="font-size:var(--fs-sm);color:var(--c-text-secondary);">${r.desc}</div>
            </div>
            <label class="toggle-switch" style="flex-shrink:0;margin-top:2px;">
              <input type="checkbox" class="contrainte-toggle" data-cle="${r.cle}" ${r.val ? 'checked' : ''}>
              <span class="toggle-track">
                <span class="toggle-thumb"></span>
              </span>
            </label>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('.contrainte-toggle').forEach(toggle => {
    toggle.addEventListener('change', async () => {
      await setConfig(toggle.dataset.cle, toggle.checked);
      toast.success(toggle.checked ? 'Contrainte activée' : 'Contrainte désactivée');
    });
  });
}

// === Classes ===
async function renderClassesTab(container) {
  const classes = await db.classes.toArray();
  const enseignants = await db.enseignants.toArray();
  const etabType = await getConfig('etablissementType') || 'mixte';

  const niveaux = etabType === 'college' ? NIVEAUX.college
    : etabType === 'lycee' ? NIVEAUX.lycee
    : [...NIVEAUX.college, ...NIVEAUX.lycee];

  // Grouper par niveau
  const parNiveau = {};
  for (const niv of niveaux) parNiveau[niv] = [];
  for (const c of classes) {
    const niv = c.niveau || 'autre';
    if (!parNiveau[niv]) parNiveau[niv] = [];
    parNiveau[niv].push(c);
  }

  // Niveaux actifs (qui ont au moins une classe)
  const niveauxActifs = niveaux.filter(n => parNiveau[n].length > 0);

  container.innerHTML = `
    <div class="card" style="margin-bottom:var(--sp-4);">
      <div class="card-header">
        <span class="card-title">Niveaux de classes</span>
      </div>
      <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-3);">
        Sélectionnez les niveaux présents dans votre établissement :
      </p>
      <div style="display:flex;flex-wrap:wrap;gap:var(--sp-3);">
        ${niveaux.map(niv => {
          const actif = parNiveau[niv].length > 0;
          return `
            <label style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer;
                          padding:var(--sp-2) var(--sp-3);border:1px solid ${actif ? 'var(--c-primary-light)' : 'var(--c-border)'};
                          border-radius:var(--radius-md);background:${actif ? '#dbeafe' : 'var(--c-surface)'};">
              <input type="checkbox" class="niv-check" data-niveau="${niv}" ${actif ? 'checked' : ''}>
              <strong>${niv}</strong>
              <span style="font-size:var(--fs-xs);color:var(--c-text-muted);">${parNiveau[niv].length} classe(s)</span>
            </label>
          `;
        }).join('')}
      </div>
    </div>

    ${niveauxActifs.length === 0 ? `
      <div class="empty-state">
        <p>Cochez un niveau ci-dessus pour ajouter des classes</p>
      </div>
    ` : niveauxActifs.map(niv => {
      const classesNiv = parNiveau[niv].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      return `
        <div class="card" style="margin-bottom:var(--sp-4);">
          <div class="card-header">
            <span class="card-title">
              <span class="tag tag-info" style="margin-right:var(--sp-2);font-size:var(--fs-sm);">${niv}</span>
              ${classesNiv.length} classe(s)
            </span>
            <button class="btn btn-sm btn-primary btn-add-cls-niv" data-niveau="${niv}">+ Classe</button>
          </div>
          <table class="data-table">
            <thead>
              <tr><th>Classe</th><th>Effectif</th><th>Enseignant</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${classesNiv.map(c => {
                const ens = enseignants.find(e => e.id === c.enseignantId);
                return `
                  <tr>
                    <td><strong>${c.nom || '<em style="color:var(--c-text-muted)">sans nom</em>'}</strong></td>
                    <td>${c.effectif}</td>
                    <td>${ens ? `${ens.prenom} ${ens.nom}` : '<span style="color:var(--c-text-muted)">-</span>'}</td>
                    <td>
                      <button class="btn btn-sm btn-outline btn-edit-cls" data-id="${c.id}">Modifier</button>
                      <button class="btn btn-sm btn-danger btn-del-cls" data-id="${c.id}">Suppr.</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('')}
  `;

  // Activer/désactiver un niveau → ajouter ou supprimer les classes
  container.querySelectorAll('.niv-check').forEach(cb => {
    cb.addEventListener('change', async () => {
      const niv = cb.dataset.niveau;
      if (cb.checked) {
        // Ajouter une première classe pour ce niveau
        const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const existantes = parNiveau[niv]?.length || 0;
        const lettre = lettres[existantes] || String(existantes + 1);
        const nom = niv.replace('e', '').replace('nde', 'nde').replace('ere', 'ère') + lettre;
        await captureUndo('Activation niveau ' + niv);
        await db.classes.add({ nom, niveau: niv, effectif: 30, enseignantId: null });
        toast.success(`Niveau ${niv} activé`);
      } else {
        // Supprimer toutes les classes de ce niveau
        const classesNiv = classes.filter(c => c.niveau === niv);
        if (classesNiv.length > 0) {
          if (await confirmModal('Supprimer', `Supprimer les ${classesNiv.length} classe(s) de ${niv} ?`)) {
            await captureUndo('Suppression classes ' + niv);
            for (const c of classesNiv) {
              await db.classes.delete(c.id);
            }
            toast.info(`Classes ${niv} supprimées`);
          } else {
            cb.checked = true;
            return;
          }
        }
      }
      await renderClassesTab(container);
    });
  });

  // Ajouter une classe dans un niveau
  container.querySelectorAll('.btn-add-cls-niv').forEach(btn => {
    btn.addEventListener('click', async () => {
      const niv = btn.dataset.niveau;
      const classesNiv = classes.filter(c => c.niveau === niv);
      const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lettre = lettres[classesNiv.length] || String(classesNiv.length + 1);
      // Générer un nom automatique : 5A, 5B, etc. ou 2ndeA, 1èreA...
      let prefixe = niv;
      if (niv === '2nde' || niv === '1ere' || niv === 'term') prefixe = niv;
      else prefixe = niv.replace('e', '');
      const nom = prefixe + lettre;
      await captureUndo('Ajout classe ' + nom);
      await db.classes.add({ nom, niveau: niv, effectif: 30, enseignantId: null });
      toast.success(`Classe ${nom} ajoutée`);
      await renderClassesTab(container);
    });
  });

  // Supprimer une classe
  container.querySelectorAll('.btn-del-cls').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirmModal('Supprimer', 'Supprimer cette classe ?')) {
        await captureUndo('Suppression classe');
        await db.classes.delete(parseInt(btn.dataset.id));
        toast.success('Classe supprimée');
        await renderClassesTab(container);
      }
    });
  });

  // Modifier une classe
  container.querySelectorAll('.btn-edit-cls').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cls = await db.classes.get(parseInt(btn.dataset.id));
      if (cls) openClasseModal(cls, niveaux, enseignants, container);
    });
  });
}

function openClasseModal(cls, niveaux, enseignants, parentContainer) {
  const { close } = openModal({
    title: `Modifier la classe ${cls.nom || ''}`,
    content: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nom</label>
          <input type="text" class="form-input" id="md-cls-nom" value="${cls.nom || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Niveau</label>
          <select class="form-select" id="md-cls-niveau">
            ${niveaux.map(n => `<option value="${n}" ${cls.niveau === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Effectif</label>
          <input type="number" class="form-input" id="md-cls-eff" value="${cls.effectif || 30}" min="1" max="40">
        </div>
        <div class="form-group">
          <label class="form-label">Enseignant</label>
          <select class="form-select" id="md-cls-ens">
            <option value="">-- Aucun --</option>
            ${enseignants.map(e => `<option value="${e.id}" ${cls.enseignantId == e.id ? 'selected' : ''}>${e.prenom} ${e.nom}</option>`).join('')}
          </select>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" id="md-cls-cancel">Annuler</button>
      <button class="btn btn-primary" id="md-cls-save">Enregistrer</button>
    `,
  });

  document.getElementById('md-cls-cancel')?.addEventListener('click', close);
  document.getElementById('md-cls-save')?.addEventListener('click', async () => {
    const ensVal = document.getElementById('md-cls-ens').value;
    await captureUndo('Modification classe');
    await db.classes.update(cls.id, {
      nom: document.getElementById('md-cls-nom').value.trim(),
      niveau: document.getElementById('md-cls-niveau').value,
      effectif: parseInt(document.getElementById('md-cls-eff').value) || 30,
      enseignantId: ensVal ? parseInt(ensVal) : null,
    });
    toast.success('Classe mise à jour');
    close();
    await renderClassesTab(parentContainer);
  });
}

// === Activités ===
async function renderActivitesTab(container) {
  const activites = await db.activites.toArray();
  const etabType = await getConfig('etablissementType') || 'mixte';
  const champsDisponibles = getChampsApprentissage(etabType);
  const tousNiveaux = etabType === 'college' ? NIVEAUX.college
    : etabType === 'lycee' ? NIVEAUX.lycee
    : [...NIVEAUX.college, ...NIVEAUX.lycee];

  // Grouper par champ d'apprentissage
  const parCA = {};
  for (const a of activites) {
    const ca = a.champApprentissage || 'autre';
    if (!parCA[ca]) parCA[ca] = [];
    parCA[ca].push(a);
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Activités EPS (${activites.length})</span>
        <button class="btn btn-sm btn-primary" id="btn-add-act">+ Ajouter une activité</button>
      </div>
      ${champsDisponibles.map(caInfo => {
        const acts = parCA[caInfo.code] || [];
        return `
          <div style="margin-bottom:var(--sp-4);">
            <h4 style="margin-bottom:var(--sp-2);display:flex;align-items:center;gap:var(--sp-2);">
              <span style="width:12px;height:12px;border-radius:3px;background:${caInfo.couleur};display:inline-block;"></span>
              ${caInfo.code} — ${caInfo.nom}
            </h4>
            ${acts.length > 0 ? `
              <table class="data-table">
                <thead>
                  <tr><th>Activité</th><th>Niveaux</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  ${acts.map(a => {
                    const niveauxAct = Array.isArray(a.niveaux) && a.niveaux.length > 0
                      ? a.niveaux.map(n => `<span class="tag tag-info" style="font-size:var(--fs-xs);padding:1px 6px;">${n}</span>`).join(' ')
                      : '<span style="color:var(--c-text-muted);font-size:var(--fs-xs);">Tous</span>';
                    return `
                      <tr>
                        <td><strong>${a.nom || '<em style="color:var(--c-text-muted)">sans nom</em>'}</strong></td>
                        <td>${niveauxAct}</td>
                        <td>
                          <button class="btn btn-sm btn-outline btn-edit-act" data-id="${a.id}">Modifier</button>
                          <button class="btn btn-sm btn-danger btn-del-act" data-id="${a.id}">Suppr.</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            ` : '<div style="padding:var(--sp-2);color:var(--c-text-muted);font-size:var(--fs-sm);">Aucune activité dans ce champ</div>'}
          </div>
        `;
      }).join('')}
      ${activites.length === 0 ? '<div class="empty-state"><p>Aucune activité configurée</p></div>' : ''}
    </div>
  `;

  // Ajouter une activité → ouvrir le modal
  container.querySelector('#btn-add-act')?.addEventListener('click', () => {
    openActiviteModal(null, champsDisponibles, tousNiveaux, container);
  });

  // Modifier une activité
  container.querySelectorAll('.btn-edit-act').forEach(btn => {
    btn.addEventListener('click', async () => {
      const act = await db.activites.get(parseInt(btn.dataset.id));
      if (act) openActiviteModal(act, champsDisponibles, tousNiveaux, container);
    });
  });

  // Supprimer une activité
  container.querySelectorAll('.btn-del-act').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirmModal('Supprimer', 'Supprimer cette activité ?')) {
        await captureUndo('Suppression activité');
        await db.activites.delete(parseInt(btn.dataset.id));
        toast.success('Activité supprimée');
        await renderActivitesTab(container);
      }
    });
  });
}

function openActiviteModal(act, champsDisponibles, tousNiveaux, parentContainer) {
  const isEdit = act !== null;
  const niveauxAct = act?.niveaux || [];

  const { close } = openModal({
    title: isEdit ? `Modifier : ${act.nom}` : 'Nouvelle activité',
    content: `
      <div class="form-group">
        <label class="form-label">Nom de l'activité <span class="required">*</span></label>
        <input type="text" class="form-input" id="md-act-nom" value="${act?.nom || ''}" placeholder="Ex: Natation, Basket-ball, Gymnastique...">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Champ d'apprentissage</label>
          <select class="form-select" id="md-act-ca">
            ${champsDisponibles.map(ca => `
              <option value="${ca.code}" ${act?.champApprentissage === ca.code ? 'selected' : ''}>${ca.code} — ${ca.nom}</option>
            `).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Niveaux de classes concernés</label>
        <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-top:var(--sp-1);">
          ${tousNiveaux.map(n => `
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;
                          padding:var(--sp-1) var(--sp-2);border:1px solid var(--c-border);border-radius:var(--radius-sm);">
              <input type="checkbox" class="md-act-niv" value="${n}" ${niveauxAct.includes(n) ? 'checked' : ''}>
              ${n}
            </label>
          `).join('')}
        </div>
        <div class="form-hint">Laissez tout décoché = activité disponible pour tous les niveaux</div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" id="md-act-cancel">Annuler</button>
      <button class="btn btn-primary" id="md-act-save">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
    `,
  });

  document.getElementById('md-act-cancel')?.addEventListener('click', close);
  document.getElementById('md-act-save')?.addEventListener('click', async () => {
    const nom = document.getElementById('md-act-nom').value.trim();
    if (!nom) {
      toast.warning('Le nom de l\'activité est obligatoire');
      return;
    }

    const niveauxChecked = [...document.querySelectorAll('.md-act-niv:checked')].map(cb => cb.value);

    const data = {
      nom,
      champApprentissage: document.getElementById('md-act-ca').value,
      niveaux: niveauxChecked,
    };

    await captureUndo(isEdit ? 'Modification activité' : 'Ajout activité');
    if (isEdit) {
      await db.activites.update(act.id, data);
      toast.success('Activité mise à jour');
    } else {
      await db.activites.add({ ...data, code: '', heuresHebdo: null, dureeSlot: null });
      toast.success('Activité ajoutée');
    }
    close();
    await renderActivitesTab(parentContainer);
  });
}

// === Indisponibilités — helper partagé ===
function buildIndispoRowHtml(existingIndispos, labelAbsent = 'Absent') {
  return JOURS_OUVRES.map(jour => {
    const indispo = existingIndispos.find(i => i.jour === jour);
    const absentJour = indispo && !indispo.heureDebut;
    const heureDebut = indispo?.heureDebut || '';
    const heureFin = indispo?.heureFin || '';
    return `
      <div class="indispo-row" data-jour="${jour}"
           style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);
                  border-bottom:1px solid var(--c-border);">
        <span style="width:36px;font-weight:600;font-size:var(--fs-sm);color:var(--c-text-secondary);">
          ${JOURS_COURTS[jour]}
        </span>
        <label style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer;white-space:nowrap;min-width:100px;">
          <input type="checkbox" class="indispo-absent" data-jour="${jour}" ${absentJour ? 'checked' : ''}>
          <span style="font-size:var(--fs-sm);">${labelAbsent}</span>
        </label>
        <div class="indispo-plage" style="display:flex;align-items:center;gap:var(--sp-2);${absentJour ? 'opacity:0.35;pointer-events:none;' : ''}">
          <span style="font-size:var(--fs-xs);color:var(--c-text-muted);">Indispo&nbsp;de</span>
          <input type="time" class="form-input indispo-debut" data-jour="${jour}" value="${heureDebut}"
                 style="width:88px;padding:3px 6px;font-size:var(--fs-sm);">
          <span style="font-size:var(--fs-xs);color:var(--c-text-muted);">à</span>
          <input type="time" class="form-input indispo-fin" data-jour="${jour}" value="${heureFin}"
                 style="width:88px;padding:3px 6px;font-size:var(--fs-sm);">
        </div>
      </div>
    `;
  }).join('');
}

function bindIndispoToggle(modalRoot) {
  modalRoot.querySelectorAll('.indispo-absent').forEach(cb => {
    cb.addEventListener('change', () => {
      const row = cb.closest('.indispo-row');
      const plage = row?.querySelector('.indispo-plage');
      if (plage) {
        plage.style.opacity = cb.checked ? '0.35' : '1';
        plage.style.pointerEvents = cb.checked ? 'none' : '';
      }
    });
  });
}

function collectIndisposFromModal(modalRoot, type, refId) {
  const result = [];
  modalRoot.querySelectorAll('.indispo-row').forEach(row => {
    const jour = row.dataset.jour;
    const absent = row.querySelector('.indispo-absent')?.checked;
    const heureDebut = row.querySelector('.indispo-debut')?.value;
    const heureFin = row.querySelector('.indispo-fin')?.value;
    if (absent) {
      result.push({ type, refId, jour, heureDebut: null, heureFin: null, motif: '' });
    } else if (heureDebut && heureFin && heureDebut < heureFin) {
      result.push({ type, refId, jour, heureDebut, heureFin, motif: '' });
    }
  });
  return result;
}

// === Installations ===
async function renderInstallationsTab(container) {
  const lieux = await db.lieux.toArray();
  const installations = await db.installations.toArray();
  const activites = await db.activites.toArray();
  const toutesIndisposInst = await db.indisponibilites.where('type').equals('installation').toArray();

  const indisposParInst = {};
  for (const i of toutesIndisposInst) {
    indisposParInst[i.refId] = (indisposParInst[i.refId] || 0) + 1;
  }

  const indisposMairie = await compterIndisposMairie();
  const totalMairie = Object.values(indisposMairie).reduce((a, b) => a + b, 0);

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Lieux (${lieux.length}) — Installations (${installations.length})</span>
        <div style="display:flex;gap:var(--sp-2);">
          <button class="btn btn-sm btn-outline" id="btn-import-mairie" title="Importer les créneaux de la Direction des Sports">
            &#128260; Import mairie${totalMairie > 0 ? ` <span class="tag tag-info" style="font-size:var(--fs-xs);">${totalMairie}</span>` : ''} ${helpTip('importMairie')}
          </button>
          <button class="btn btn-sm btn-primary" id="btn-add-lieu">+ Lieu</button>
        </div>
      </div>
      ${lieux.length === 0 ? '<div class="empty-state"><p>Aucun lieu configuré</p></div>' : `
        ${lieux.map(l => {
          const installs = installations.filter(i => i.lieuId === l.id);
          return `
            <div style="margin-bottom:var(--sp-4);border:1px solid var(--c-border);border-radius:var(--radius-md);overflow:hidden;">
              <div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3);background:var(--c-surface-alt);">
                <span style="font-size:1.2rem;">${l.necessiteBus ? '&#128652;' : '&#127939;'}</span>
                <strong>${l.nom}</strong>
                <span class="tag ${l.type === 'intra' ? 'tag-success' : 'tag-warning'}">${l.type}</span>
                ${l.necessiteBus ? '<span class="tag tag-info">Bus</span>' : ''}
                <span style="flex:1;"></span>
                <button class="btn btn-sm btn-outline btn-edit-lieu" data-id="${l.id}" title="Modifier le lieu">Modifier</button>
                <button class="btn btn-sm btn-outline btn-add-install" data-lieu="${l.id}">+ Installation</button>
                <button class="btn btn-sm btn-danger btn-del-lieu" data-id="${l.id}" title="Supprimer le lieu">Suppr.</button>
              </div>
              ${installs.length > 0 ? `
                <table class="data-table">
                  <thead><tr><th>Installation</th><th>Capacité</th><th>Activités compatibles</th><th>Actions</th></tr></thead>
                  <tbody>
                    ${installs.map(inst => {
                      const actsCompat = Array.isArray(inst.activitesCompatibles) && inst.activitesCompatibles.length > 0
                        ? inst.activitesCompatibles.map(aId => {
                            const a = activites.find(x => x.id === aId);
                            return a ? `<span class="tag tag-primary" style="font-size:var(--fs-xs);padding:1px 6px;">${a.nom}</span>` : '';
                          }).filter(Boolean).join(' ')
                        : '<span style="color:var(--c-text-muted);font-size:var(--fs-xs);">Toutes</span>';
                      const nbIndispos = indisposParInst[inst.id] || 0;
                      return `
                        <tr>
                          <td><strong>${inst.nom}</strong></td>
                          <td>${inst.capaciteSimultanee} classe(s)</td>
                          <td>${actsCompat}</td>
                          <td>
                            <button class="btn btn-sm btn-outline btn-indispo-inst" data-id="${inst.id}"
                                    title="Gérer les indisponibilités récurrentes">
                              ${nbIndispos > 0 ? `&#128683; Indispo (${nbIndispos})` : '&#128683; Indispo'}
                            </button>
                            <button class="btn btn-sm btn-outline btn-edit-inst" data-id="${inst.id}">Modifier</button>
                            <button class="btn btn-sm btn-danger btn-del-inst" data-id="${inst.id}">Suppr.</button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              ` : '<div style="padding:var(--sp-3);color:var(--c-text-muted);font-size:var(--fs-sm);">Aucune installation</div>'}
            </div>
          `;
        }).join('')}
      `}
    </div>
  `;

  // Import mairie
  container.querySelector('#btn-import-mairie')?.addEventListener('click', () => {
    openImportMairieModal(installations, container);
  });

  // Ajouter un lieu
  container.querySelector('#btn-add-lieu')?.addEventListener('click', () => {
    openLieuModal(null, container);
  });

  // Modifier un lieu
  container.querySelectorAll('.btn-edit-lieu').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lieu = await db.lieux.get(parseInt(btn.dataset.id));
      if (lieu) openLieuModal(lieu, container);
    });
  });

  // Supprimer un lieu (et ses installations + séances en cascade)
  container.querySelectorAll('.btn-del-lieu').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lieuId = parseInt(btn.dataset.id);
      const installs = installations.filter(i => i.lieuId === lieuId);
      const nbSeances = await countSeancesLieu(lieuId);
      let msg = installs.length > 0
        ? `Supprimer ce lieu et ses ${installs.length} installation(s) ?`
        : 'Supprimer ce lieu ?';
      if (nbSeances > 0) msg += ` ${nbSeances} séance(s) associée(s) seront également supprimées.`;
      if (await confirmModal('Supprimer', msg)) {
        await captureUndo('Suppression lieu');
        await cascadeDeleteLieu(lieuId);
        toast.success('Lieu supprimé');
        await renderInstallationsTab(container);
      }
    });
  });

  // Ajouter une installation
  container.querySelectorAll('.btn-add-install').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lieuId = parseInt(btn.dataset.lieu);
      openInstallationModal(null, lieuId, activites, container);
    });
  });

  // Indisponibilités d'une installation
  container.querySelectorAll('.btn-indispo-inst').forEach(btn => {
    btn.addEventListener('click', async () => {
      const inst = await db.installations.get(parseInt(btn.dataset.id));
      if (inst) openInstallationIndispoModal(inst, container);
    });
  });

  // Modifier une installation
  container.querySelectorAll('.btn-edit-inst').forEach(btn => {
    btn.addEventListener('click', async () => {
      const inst = await db.installations.get(parseInt(btn.dataset.id));
      if (inst) openInstallationModal(inst, inst.lieuId, activites, container);
    });
  });

  // Supprimer une installation (+ séances en cascade)
  container.querySelectorAll('.btn-del-inst').forEach(btn => {
    btn.addEventListener('click', async () => {
      const instId = parseInt(btn.dataset.id);
      const nbSeances = await countSeancesInstallation(instId);
      const msg = nbSeances > 0
        ? `Supprimer cette installation ? ${nbSeances} séance(s) associée(s) seront également supprimées.`
        : 'Supprimer cette installation ?';
      if (await confirmModal('Supprimer', msg)) {
        await captureUndo('Suppression installation');
        await cascadeDeleteInstallation(instId);
        toast.success('Installation supprimée');
        await renderInstallationsTab(container);
      }
    });
  });
}

// === Import disponibilités mairie ===

async function openImportMairieModal(installations, parentContainer) {
  let jsonData = null;
  let etape = 1; // 1 = charger les données, 2 = mapping + options

  // -- Étape 1 : charger le JSON --
  const { close, modal } = openModal({
    title: 'Import disponibilités — Direction des Sports',
    content: buildImportStep1Html(),
    footer: `
      <button class="btn btn-outline" id="md-import-cancel">Annuler</button>
      <button class="btn btn-primary" id="md-import-next" disabled>Suivant →</button>
    `,
    wide: true,
  });

  const btnNext = modal.querySelector('#md-import-next');
  const btnCancel = modal.querySelector('#md-import-cancel');
  btnCancel.addEventListener('click', close);

  // Source : données intégrées
  modal.querySelector('#import-src-builtin')?.addEventListener('change', async (e) => {
    if (e.target.checked) {
      try {
        const resp = await fetch('/extracted_eps_reservations.json');
        if (!resp.ok) throw new Error('Fichier non trouvé');
        jsonData = await resp.json();
        updateStep1Status(modal, `${jsonData.length} entrée(s) chargée(s) depuis les données intégrées.`);
        btnNext.disabled = false;
      } catch {
        toast.error('Impossible de charger les données intégrées.');
        jsonData = null;
        btnNext.disabled = true;
      }
    }
  });

  // Source : fichier uploadé
  modal.querySelector('#import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      jsonData = JSON.parse(text);
      if (!Array.isArray(jsonData)) throw new Error('Format invalide');
      updateStep1Status(modal, `${jsonData.length} entrée(s) chargée(s) depuis « ${file.name} ».`);
      btnNext.disabled = false;
    } catch {
      toast.error('Fichier JSON invalide.');
      jsonData = null;
      btnNext.disabled = true;
    }
  });

  btnNext.addEventListener('click', async () => {
    if (!jsonData) return;
    if (etape === 1) {
      etape = 2;
      const spaces = getUniqueSpaces(jsonData);
      modal.querySelector('.modal-title').textContent = 'Import mairie — Correspondance des espaces';
      modal.querySelector('.modal-body').innerHTML = buildImportStep2Html(spaces, installations);
      btnNext.textContent = 'Importer';
      btnNext.disabled = false;
    } else {
      await runImport(modal, jsonData, installations, close, parentContainer);
    }
  });
}

function buildImportStep1Html() {
  return `
    <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
      Chargez le fichier JSON de la Direction des Sports pour importer les créneaux réservés par les autres établissements.
      Ces créneaux seront enregistrés comme indisponibilités sur vos installations.
    </p>
    <div style="display:flex;flex-direction:column;gap:var(--sp-4);">
      <label style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3);border:1px solid var(--c-border);border-radius:var(--radius-md);cursor:pointer;">
        <input type="radio" name="import-src" id="import-src-builtin" value="builtin">
        <div>
          <strong>Utiliser les données intégrées</strong>
          <div style="font-size:var(--fs-sm);color:var(--c-text-secondary);">
            Réservations EPS 2025-2026 extraites du PDF Direction des Sports Antibes
          </div>
        </div>
      </label>
      <label style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3);border:1px solid var(--c-border);border-radius:var(--radius-md);cursor:pointer;">
        <input type="radio" name="import-src" id="import-src-file" value="file">
        <div style="flex:1;">
          <strong>Charger un fichier JSON</strong>
          <div style="font-size:var(--fs-sm);color:var(--c-text-secondary);">
            JSON exporté depuis le script d'extraction PDF
          </div>
          <input type="file" id="import-file" accept=".json" style="margin-top:var(--sp-2);display:none;">
          <button type="button" class="btn btn-sm btn-outline" style="margin-top:var(--sp-2);"
            onclick="document.getElementById('import-file').click()">Choisir un fichier…</button>
        </div>
      </label>
      <div id="import-step1-status" style="font-size:var(--fs-sm);color:var(--c-success);min-height:1.5em;"></div>
    </div>
  `;
}

function updateStep1Status(modal, msg) {
  const el = modal.querySelector('#import-step1-status');
  if (el) el.textContent = msg;
}

function buildImportStep2Html(spaces, installations) {
  const instOptions = installations.map(i => `<option value="${i.id}">${i.nom}</option>`).join('');

  const rows = spaces.map(({ facility, space, count }) => {
    const key = `${facility}|||${space}`;
    const safeKey = key.replace(/"/g, '&quot;');
    // Tentative de pré-sélection par mots-clés
    const nom = space.toLowerCase();
    const preselect = installations.find(i => {
      const iNom = i.nom.toLowerCase();
      return nom.includes(iNom) || iNom.includes(nom.split(' ')[0]);
    });
    return `
      <tr>
        <td style="font-size:var(--fs-sm);">
          <div style="font-weight:600;">${space}</div>
          <div style="color:var(--c-text-muted);font-size:var(--fs-xs);">${facility} · ${count} créneau(x)</div>
        </td>
        <td>
          <select class="form-select form-select-sm mapping-select" data-key="${safeKey}" style="min-width:180px;">
            <option value="">— Ignorer —</option>
            ${instOptions.replace(`value="${preselect?.id}"`, `value="${preselect?.id}" selected`)}
          </select>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="margin-bottom:var(--sp-3);">
      <div style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-3);">
        Associez chaque espace de la Direction des Sports à une de vos installations locales.
        Laissez sur <em>Ignorer</em> pour ne pas importer cet espace.
      </div>
      <div style="display:flex;gap:var(--sp-4);margin-bottom:var(--sp-3);padding:var(--sp-3);background:var(--c-surface-alt);border-radius:var(--radius-md);">
        <div class="form-group" style="flex:1;margin:0;">
          <label class="form-label" style="font-size:var(--fs-sm);">Exclure les réservations contenant :</label>
          <input type="text" class="form-input form-input-sm" id="import-exclude-kw" value="MSJ"
            placeholder="ex: MSJ, MT ST JEAN…"
            title="Les créneaux réservés par votre établissement ne seront pas importés comme indisponibilités">
        </div>
        <div class="form-group" style="margin:0;display:flex;align-items:flex-end;">
          <label style="display:flex;align-items:center;gap:var(--sp-2);font-size:var(--fs-sm);cursor:pointer;">
            <input type="checkbox" id="import-replace" checked>
            Remplacer les imports existants
          </label>
        </div>
      </div>
      <div style="max-height:350px;overflow-y:auto;border:1px solid var(--c-border);border-radius:var(--radius-md);">
        <table class="data-table" style="margin:0;">
          <thead><tr><th>Espace Direction des Sports</th><th>Installation locale</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

async function runImport(modal, jsonData, installations, close, parentContainer) {
  const mappings = {};
  modal.querySelectorAll('.mapping-select').forEach(sel => {
    if (sel.value) mappings[sel.dataset.key] = parseInt(sel.value);
  });

  const excludeKeyword = modal.querySelector('#import-exclude-kw')?.value || '';
  const remplacerExistantes = modal.querySelector('#import-replace')?.checked ?? true;

  const nbMapped = Object.keys(mappings).length;
  if (nbMapped === 0) {
    toast.warning('Aucune installation sélectionnée — import annulé.');
    return;
  }

  try {
    const { importees } = await importerDisponibilitesMairie(jsonData, mappings, {
      excludeKeyword,
      remplacerExistantes,
    });
    toast.success(`${importees} créneau(x) importé(s) depuis la Direction des Sports.`);
    close();
    await renderInstallationsTab(parentContainer);
  } catch (err) {
    console.error(err);
    toast.error('Erreur lors de l\'import : ' + err.message);
  }
}

async function openInstallationIndispoModal(inst, parentContainer) {
  const existingIndispos = await db.indisponibilites
    .filter(i => i.type === 'installation' && i.refId === inst.id)
    .toArray();

  const { close, modal } = openModal({
    title: `Indisponibilités — ${inst.nom}`,
    content: `
      <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-3);">
        Créneaux récurrents bloqués chaque semaine (ex : maintenance, fermeture hebdomadaire).
      </p>
      <div style="border:1px solid var(--c-border);border-radius:var(--radius-md);overflow:hidden;">
        ${buildIndispoRowHtml(existingIndispos, 'Fermé')}
      </div>
      <div class="form-hint" style="margin-top:var(--sp-2);">
        Fermé = installation indisponible toute la journée. Plage = créneau horaire bloqué.
      </div>
    `,
    footer: `
      <button class="btn btn-outline" id="md-instindispo-cancel">Annuler</button>
      <button class="btn btn-primary" id="md-instindispo-save">Enregistrer</button>
    `,
  });

  bindIndispoToggle(modal);

  modal.querySelector('#md-instindispo-cancel')?.addEventListener('click', close);
  modal.querySelector('#md-instindispo-save')?.addEventListener('click', async () => {
    const nouvellesIndispos = collectIndisposFromModal(modal, 'installation', inst.id);

    await captureUndo('Indisponibilités installation ' + inst.nom);
    await db.indisponibilites.filter(i => i.type === 'installation' && i.refId === inst.id).delete();
    for (const indispo of nouvellesIndispos) {
      await db.indisponibilites.add(indispo);
    }

    const n = nouvellesIndispos.length;
    toast.success(n > 0 ? `${n} créneau(x) indisponible(s) enregistré(s)` : 'Indisponibilités effacées');
    close();
    await renderInstallationsTab(parentContainer);
  });
}

function openLieuModal(lieu, parentContainer) {
  const isEdit = lieu !== null;
  const { close } = openModal({
    title: isEdit ? `Modifier : ${lieu.nom}` : 'Nouveau lieu',
    content: `
      <div class="form-group">
        <label class="form-label">Nom du lieu <span class="required">*</span></label>
        <input type="text" class="form-input" id="md-lieu-nom" value="${lieu?.nom || ''}" placeholder="Ex: Complexe Foch, Piscine Antibes...">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type ${helpTip('intraExtra')}</label>
          <select class="form-select" id="md-lieu-type">
            <option value="intra" ${lieu?.type === 'intra' ? 'selected' : ''}>Intra-muros (dans l'établissement)</option>
            <option value="extra" ${lieu?.type === 'extra' || !lieu ? 'selected' : ''}>Extra-muros (à l'extérieur)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Transport</label>
          <label style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer;margin-top:var(--sp-2);">
            <input type="checkbox" id="md-lieu-bus" ${lieu?.necessiteBus ? 'checked' : ''}>
            Nécessite un bus
          </label>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" id="md-lieu-cancel">Annuler</button>
      <button class="btn btn-primary" id="md-lieu-save">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
    `,
  });

  document.getElementById('md-lieu-cancel')?.addEventListener('click', close);
  document.getElementById('md-lieu-save')?.addEventListener('click', async () => {
    const nom = document.getElementById('md-lieu-nom').value.trim();
    if (!nom) { toast.warning('Le nom du lieu est obligatoire'); return; }

    const data = {
      nom,
      type: document.getElementById('md-lieu-type').value,
      necessiteBus: document.getElementById('md-lieu-bus').checked,
    };

    await captureUndo(isEdit ? 'Modification lieu' : 'Ajout lieu');
    if (isEdit) {
      await db.lieux.update(lieu.id, data);
      toast.success('Lieu mis à jour');
    } else {
      await db.lieux.add(data);
      toast.success('Lieu ajouté');
    }
    close();
    await renderInstallationsTab(parentContainer);
  });
}

function openInstallationModal(inst, lieuId, activites, parentContainer) {
  const isEdit = inst !== null;
  const actsCompatibles = inst?.activitesCompatibles || [];

  const { close } = openModal({
    title: isEdit ? `Modifier : ${inst.nom}` : 'Nouvelle installation',
    content: `
      <div class="form-group">
        <label class="form-label">Nom de l'installation <span class="required">*</span></label>
        <input type="text" class="form-input" id="md-inst-nom" value="${inst?.nom || ''}" placeholder="Ex: Terrain 1, Gymnase A, Bassin 25m...">
      </div>
      <div class="form-group">
        <label class="form-label">Capacité simultanée (nombre de classes) ${helpTip('capacite')}</label>
        <input type="number" class="form-input" id="md-inst-cap" value="${inst?.capaciteSimultanee || 1}" min="1" max="10" style="width:100px;">
        <div class="form-hint">Combien de classes peuvent utiliser cette installation en même temps ?</div>
      </div>
      <div class="form-group">
        <label class="form-label">Activités compatibles</label>
        <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-top:var(--sp-1);max-height:200px;overflow-y:auto;">
          ${activites.length > 0 ? activites.map(a => `
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;
                          padding:var(--sp-1) var(--sp-2);border:1px solid var(--c-border);border-radius:var(--radius-sm);
                          font-size:var(--fs-sm);">
              <input type="checkbox" class="md-inst-act" value="${a.id}" ${actsCompatibles.includes(a.id) ? 'checked' : ''}>
              ${a.nom}
            </label>
          `).join('') : '<span style="color:var(--c-text-muted);font-size:var(--fs-sm);">Aucune activité configurée. Ajoutez-en d\'abord dans l\'onglet Activités.</span>'}
        </div>
        <div class="form-hint">Laissez tout décoché = toutes les activités sont compatibles</div>
      </div>
    `,
    footer: `
      <button class="btn btn-outline" id="md-inst-cancel">Annuler</button>
      <button class="btn btn-primary" id="md-inst-save">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
    `,
  });

  document.getElementById('md-inst-cancel')?.addEventListener('click', close);
  document.getElementById('md-inst-save')?.addEventListener('click', async () => {
    const nom = document.getElementById('md-inst-nom').value.trim();
    if (!nom) { toast.warning('Le nom de l\'installation est obligatoire'); return; }

    const actsChecked = [...document.querySelectorAll('.md-inst-act:checked')].map(cb => parseInt(cb.value));

    const data = {
      nom,
      lieuId,
      capaciteSimultanee: parseInt(document.getElementById('md-inst-cap').value) || 1,
      activitesCompatibles: actsChecked,
    };

    await captureUndo(isEdit ? 'Modification installation' : 'Ajout installation');
    if (isEdit) {
      await db.installations.update(inst.id, data);
      toast.success('Installation mise à jour');
    } else {
      await db.installations.add(data);
      toast.success('Installation ajoutée');
    }
    close();
    await renderInstallationsTab(parentContainer);
  });
}

// === Périodes ===
async function renderPeriodesTab(container) {
  const periodes = await db.periodes.toArray();

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Périodes (${periodes.length})</span>
        <button class="btn btn-sm btn-primary" id="btn-add-per">+ Ajouter</button>
      </div>
      ${periodes.length === 0 ? '<div class="empty-state"><p>Aucune période</p></div>' : `
        <table class="data-table">
          <thead><tr><th>Nom</th><th>Type</th><th>Début</th><th>Fin</th><th>Niveau</th><th>Actions</th></tr></thead>
          <tbody>
            ${periodes.sort((a, b) => (a.ordre || 0) - (b.ordre || 0)).map(p => `
              <tr>
                <td><strong>${p.nom}</strong></td>
                <td><span class="tag tag-primary">${p.type}</span></td>
                <td>${p.dateDebut ? new Date(p.dateDebut).toLocaleDateString('fr-FR') : '-'}</td>
                <td>${p.dateFin ? new Date(p.dateFin).toLocaleDateString('fr-FR') : '-'}</td>
                <td>${p.niveau || 'tous'}</td>
                <td>
                  <button class="btn btn-sm btn-outline btn-edit-per" data-id="${p.id}">Modifier</button>
                  <button class="btn btn-sm btn-danger btn-del-per" data-id="${p.id}">Suppr.</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;

  container.querySelector('#btn-add-per')?.addEventListener('click', () => {
    openPeriodeModal(null, container);
  });

  container.querySelectorAll('.btn-edit-per').forEach(btn => {
    btn.addEventListener('click', async () => {
      const per = await db.periodes.get(parseInt(btn.dataset.id));
      if (per) openPeriodeModal(per, container);
    });
  });

  container.querySelectorAll('.btn-del-per').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirmModal('Supprimer', 'Supprimer cette période ? Les programmations associées seront conservées.')) {
        await captureUndo('Suppression période');
        await db.periodes.delete(parseInt(btn.dataset.id));
        toast.success('Période supprimée');
        await renderPeriodesTab(container);
      }
    });
  });
}

function openPeriodeModal(per, parentContainer) {
  const isEdit = per !== null;

  const contentEl = document.createElement('div');
  contentEl.innerHTML = `
    <div class="form-group">
      <label>Nom</label>
      <input type="text" id="per-nom" class="form-input" value="${per?.nom || ''}" placeholder="ex: Trimestre 1">
    </div>
    <div class="form-group">
      <label>Type</label>
      <select id="per-type" class="form-select">
        <option value="trimestre" ${per?.type === 'trimestre' ? 'selected' : ''}>Trimestre</option>
        <option value="semestre" ${per?.type === 'semestre' ? 'selected' : ''}>Semestre</option>
        <option value="custom" ${per?.type === 'custom' ? 'selected' : ''}>Personnalisé</option>
      </select>
    </div>
    <div style="display: flex; gap: 1rem;">
      <div class="form-group" style="flex:1;">
        <label>Date de début</label>
        <input type="date" id="per-debut" class="form-input" value="${per?.dateDebut || ''}">
      </div>
      <div class="form-group" style="flex:1;">
        <label>Date de fin</label>
        <input type="date" id="per-fin" class="form-input" value="${per?.dateFin || ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Niveau concerné</label>
      <select id="per-niveau" class="form-select">
        <option value="tous" ${(!per?.niveau || per?.niveau === 'tous') ? 'selected' : ''}>Tous</option>
        <option value="college" ${per?.niveau === 'college' ? 'selected' : ''}>Collège</option>
        <option value="lycee" ${per?.niveau === 'lycee' ? 'selected' : ''}>Lycée</option>
      </select>
    </div>
    <div class="form-group">
      <label>Ordre d'affichage</label>
      <input type="number" id="per-ordre" class="form-input" value="${per?.ordre || 1}" min="1" style="width: 80px;">
    </div>
  `;

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end;';

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn btn-outline';
  btnCancel.textContent = 'Annuler';
  footer.appendChild(btnCancel);

  const btnSave = document.createElement('button');
  btnSave.className = 'btn btn-primary';
  btnSave.textContent = isEdit ? 'Modifier' : 'Ajouter';
  footer.appendChild(btnSave);

  const { close } = openModal({
    title: isEdit ? `Modifier : ${per.nom}` : 'Nouvelle période',
    content: contentEl,
    footer,
  });

  btnCancel.addEventListener('click', close);
  btnSave.addEventListener('click', async () => {
    const nom = contentEl.querySelector('#per-nom').value.trim();
    if (!nom) { toast.error('Le nom est requis'); return; }

    const data = {
      nom,
      type: contentEl.querySelector('#per-type').value,
      dateDebut: contentEl.querySelector('#per-debut').value,
      dateFin: contentEl.querySelector('#per-fin').value,
      niveau: contentEl.querySelector('#per-niveau').value,
      ordre: parseInt(contentEl.querySelector('#per-ordre').value) || 1,
    };

    await captureUndo(isEdit ? 'Modification période' : 'Ajout période');
    if (isEdit) {
      await db.periodes.update(per.id, data);
      toast.success('Période modifiée');
    } else {
      await db.periodes.add(data);
      toast.success('Période ajoutée');
    }
    close();
    await renderPeriodesTab(parentContainer);
  });
}
