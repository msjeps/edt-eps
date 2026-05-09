/**
 * Grille EDT — Vue principale emploi du temps
 * - Auto-sync depuis Programmation (creneauxClasses + programmations → séances)
 * - Grille 30min avec spanning multi-colonnes
 * - Vue par période ou toutes périodes
 * - Drag & drop avec préservation de durée
 */
import db from '../../db/schema.js';
import { getConfig } from '../../db/schema.js';
import { captureUndo } from '../../utils/undo.js';
import { toast } from '../../components/toast.js';
import { openModal } from '../../components/modal.js';
import { validerSeance, heureToMinutes, conflitIndisponibilite } from '../../engine/constraints.js';
import { updateConflictBadge } from '../../app.js';
import { JOURS_COURTS } from '../../utils/helpers.js';
import { slugify } from '../../utils/helpers.js';

// État local
let state = {
  periodeId: null,
  showAllPeriodes: false,
  filtreEnseignant: null,
  filtreClasse: null,
  dragSeance: null,
};

// ============================
// AUTO-SYNC DEPUIS PROGRAMMATION
// ============================

/**
 * Synchronise les séances avec les données de programmation.
 * Crée/met à jour/supprime les séances automatiques.
 */
async function syncSeancesFromProgrammation() {
  const [creneauxClasses, programmations, seances] = await Promise.all([
    db.creneauxClasses.toArray(),
    db.programmations.toArray(),
    db.seances.toArray(),
  ]);

  // Index existing auto-generated séances by programmationId
  const existingByProgId = {};
  for (const s of seances) {
    if (s.programmationId) {
      existingByProgId[s.programmationId] = s;
    }
  }

  const progIds = new Set(programmations.map(p => p.id));

  // 1. Create missing séances for new programmations
  for (const prog of programmations) {
    if (existingByProgId[prog.id]) continue;

    const creneau = creneauxClasses.find(cc => cc.id === prog.creneauClasseId);
    if (!creneau) continue;

    await db.seances.add({
      classeId: prog.classeId || creneau.classeId,
      enseignantId: creneau.enseignantId,
      activiteId: prog.activiteId,
      installationId: prog.installationId,
      jour:       prog.jour      || creneau.jour,
      heureDebut: prog.heureDebut || creneau.heureDebut,
      heureFin:   prog.heureFin  || creneau.heureFin,
      periodeId: prog.periodeId,
      programmationId: prog.id,
      creneauClasseId: prog.creneauClasseId,
      verrouille: false,
      notes: '',
    });
  }

  // 2. Remove orphaned auto-generated séances
  for (const s of seances) {
    if (s.programmationId && !progIds.has(s.programmationId)) {
      await db.seances.delete(s.id);
    }
  }

  // 3. Update existing auto-generated séances if data changed
  for (const prog of programmations) {
    const existing = existingByProgId[prog.id];
    if (!existing) continue;

    const creneau = creneauxClasses.find(cc => cc.id === prog.creneauClasseId);
    if (!creneau) continue;

    const updates = {};
    if (existing.activiteId !== prog.activiteId) updates.activiteId = prog.activiteId;
    if (existing.installationId !== prog.installationId) updates.installationId = prog.installationId;
    if (existing.periodeId !== prog.periodeId) updates.periodeId = prog.periodeId;
    const effJour = prog.jour      || creneau.jour;
    const effHDeb = prog.heureDebut || creneau.heureDebut;
    const effHFin = prog.heureFin  || creneau.heureFin;
    if (existing.jour !== effJour) updates.jour = effJour;
    if (existing.heureDebut !== effHDeb) updates.heureDebut = effHDeb;
    if (existing.heureFin !== effHFin) updates.heureFin = effHFin;
    if (existing.enseignantId !== creneau.enseignantId) updates.enseignantId = creneau.enseignantId;
    const classeId = prog.classeId || creneau.classeId;
    if (existing.classeId !== classeId) updates.classeId = classeId;

    if (Object.keys(updates).length > 0) {
      await db.seances.update(existing.id, updates);
    }
  }
}

// ============================
// MAIN RENDER
// ============================

export async function renderEdt(container) {
  // Auto-sync from programmation
  await syncSeancesFromProgrammation();

  const [
    seances, enseignants, classes, activites,
    installations, lieux, periodes, joursOuvres,
    heureDebut, heureFin, etablissementNom
  ] = await Promise.all([
    db.seances.toArray(),
    db.enseignants.toArray(),
    db.classes.toArray(),
    db.activites.toArray(),
    db.installations.toArray(),
    db.lieux.toArray(),
    db.periodes.toArray(),
    getConfig('joursOuvres'),
    getConfig('heureDebut'),
    getConfig('heureFin'),
    getConfig('etablissementNom'),
  ]);

  const jours = joursOuvres || ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
  const hStart = heureToMinutes(heureDebut || '08:00');
  const hEnd = heureToMinutes(heureFin || '17:00');
  const PAS = 30; // 30-minute slots
  const slots = genererSlots(hStart, hEnd, PAS);

  // Période par défaut
  if (!state.periodeId && !state.showAllPeriodes && periodes.length > 0) {
    state.periodeId = periodes[0].id;
  }

  // Filtrer séances
  let seancesFiltrees = seances;
  if (!state.showAllPeriodes && state.periodeId) {
    seancesFiltrees = seances.filter(s => s.periodeId === state.periodeId || !s.periodeId);
  }
  if (state.filtreEnseignant) {
    seancesFiltrees = seancesFiltrees.filter(s => s.enseignantId === state.filtreEnseignant);
  }
  if (state.filtreClasse) {
    seancesFiltrees = seancesFiltrees.filter(s => s.classeId === state.filtreClasse);
  }

  // Sort periodes by ordre
  periodes.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

  // Données pour le header d'impression
  const periodeActive = !state.showAllPeriodes && state.periodeId
    ? periodes.find(p => p.id === state.periodeId)
    : null;
  const nomEtab = etablissementNom || 'EDT EPS';

  // Légende des installations présentes dans les séances filtrées
  const instIds = [...new Set(seancesFiltrees.map(s => s.installationId).filter(Boolean))];
  const legendeItems = instIds.map(instId => {
    const inst = installations.find(i => i.id === instId);
    const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;
    const slug = lieu ? slugify(lieu.nom) : 'default';
    return inst ? { inst, slug } : null;
  }).filter(Boolean);

  // Couleurs résolues inline pour la légende print (les CSS vars ne sont pas utilisables en inline)
  const INSTALL_COLORS = {
    'fort-carre': '#E91E63', 'beach-fc': '#D32F2F', 'auvergne': '#F59E0B',
    'foch': '#43A047', 'fontonne': '#7B1FA2', 'piscine': '#0097A7',
    'gymnase': '#00796B', 'terr-msj': '#546E7A', 'parc-exflora': '#757575',
  };

  container.innerHTML = `
    <div class="edt-container">

      <!-- Header visible uniquement à l'impression -->
      <div class="print-header" style="display:none;">
        <div class="print-header-left">
          <span class="print-header-title">${nomEtab} — Emploi du temps EPS</span>
          <span class="print-header-subtitle">
            ${periodeActive ? periodeActive.nom : 'Toutes les périodes'}
            ${state.filtreEnseignant ? ' · ' + (enseignants.find(e=>e.id===state.filtreEnseignant)?.prenom || '') + ' ' + (enseignants.find(e=>e.id===state.filtreEnseignant)?.nom || '') : ''}
            ${state.filtreClasse ? ' · ' + (classes.find(c=>c.id===state.filtreClasse)?.nom || '') : ''}
          </span>
        </div>
        <div class="print-header-right">
          Imprimé le ${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}<br>
          ${seancesFiltrees.length} séance(s)
        </div>
      </div>

      <!-- Légende print (visible uniquement à l'impression) -->
      ${legendeItems.length > 0 ? `
        <div class="edt-legend-print" style="display:none;">
          ${legendeItems.map(({ inst, slug }) => `
            <span class="edt-legend-print-item">
              <span class="edt-legend-print-swatch" style="background:${INSTALL_COLORS[slug] || '#3B82F6'};"></span>
              ${inst.nom}
            </span>
          `).join('')}
        </div>
      ` : ''}

      <!-- Toolbar (masqué à l'impression) -->
      <div class="edt-toolbar">
        <div class="toolbar-group">
          <div class="period-selector">
            <button class="period-btn ${state.showAllPeriodes ? 'active' : ''}" data-periode="all">Toutes</button>
            ${periodes.map(p => `
              <button class="period-btn ${!state.showAllPeriodes && p.id === state.periodeId ? 'active' : ''}" data-periode="${p.id}">${p.nom}</button>
            `).join('')}
          </div>
        </div>

        <div class="toolbar-separator"></div>

        <div class="toolbar-group edt-filters">
          <select id="edt-filtre-ens" class="form-select" style="width:150px;padding:4px 8px;font-size:var(--fs-xs);">
            <option value="">Tous les enseignants</option>
            ${enseignants.map(e => `
              <option value="${e.id}" ${state.filtreEnseignant === e.id ? 'selected' : ''}>${e.prenom} ${e.nom}</option>
            `).join('')}
          </select>
          <select id="edt-filtre-cls" class="form-select" style="width:120px;padding:4px 8px;font-size:var(--fs-xs);">
            <option value="">Toutes les classes</option>
            ${classes.map(c => `
              <option value="${c.id}" ${state.filtreClasse === c.id ? 'selected' : ''}>${c.nom}</option>
            `).join('')}
          </select>
        </div>

        <div class="toolbar-separator"></div>

        <div class="toolbar-group">
          <button class="btn btn-sm btn-primary" id="edt-btn-add">+ Séance</button>
          <button class="btn btn-sm btn-ghost btn-print-trigger" id="edt-btn-print" title="Imprimer l'EDT (Ctrl+P)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimer
          </button>
        </div>
      </div>

      <!-- Légende installations (à l'écran) -->
      <div class="edt-legend" id="edt-legend">
        ${legendeItems.map(({ inst, slug }) => `
          <div class="edt-legend-item">
            <div class="edt-legend-color" style="background:var(--c-${slug}, #93C5FD);"></div>
            <span>${inst.nom}</span>
          </div>
        `).join('')}
      </div>

      <!-- Grille EDT -->
      <div class="edt-grid-wrapper">
        <div class="edt-grid" style="grid-template-columns: ${state.showAllPeriodes && periodes.length > 1 ? '40px ' : ''}repeat(${slots.length}, 1fr);">
          <!-- En-têtes temps -->
          ${state.showAllPeriodes && periodes.length > 1 ? '<div class="edt-header-cell" style="font-size:9px;">Pér.</div>' : ''}
          ${slots.map(s => `
            <div class="edt-header-cell ${s.isHour ? '' : 'half-hour'}">${s.label}</div>
          `).join('')}

          <!-- Lignes par jour -->
          ${state.showAllPeriodes && periodes.length > 1
            ? renderAllPeriodesRows(jours, periodes, slots, seancesFiltrees, hStart, PAS, { enseignants, classes, activites, installations, lieux })
            : renderSinglePeriodeRows(jours, slots, seancesFiltrees, hStart, PAS, { enseignants, classes, activites, installations, lieux, periodes })
          }
        </div>
      </div>

      <!-- Stats -->
      <div class="edt-stats">
        ${seancesFiltrees.length} séance(s) affichée(s)
        ${state.showAllPeriodes ? ' — toutes les périodes' : ''}
      </div>
    </div>
  `;

  // === Bind events ===
  bindEdtEvents(container, seancesFiltrees, { enseignants, classes, activites, installations, lieux, periodes });
}

// ============================
// GRID RENDERING
// ============================

/**
 * Assigne un niveau de pile (stackLevel) à chaque séance par coloration de graphe d'intervalles.
 * Deux séances qui se chevauchent dans le temps reçoivent des niveaux différents.
 * Retourne une Map<seanceId, stackLevel>.
 */
function assignStackLevels(seances) {
  if (!seances || seances.length === 0) return new Map();

  // Trier par heure de début
  const sorted = [...seances].sort(
    (a, b) => heureToMinutes(a.heureDebut) - heureToMinutes(b.heureDebut)
  );

  const levels = new Map();          // seanceId → level
  const levelEndTimes = [];          // level → minute de fin de la dernière séance placée

  for (const s of sorted) {
    const startMin = heureToMinutes(s.heureDebut);
    const endMin   = heureToMinutes(s.heureFin);

    // Trouver le premier niveau disponible (pas de chevauchement)
    let level = 0;
    while (levelEndTimes[level] !== undefined && levelEndTimes[level] > startMin) {
      level++;
    }

    levels.set(s.id, level);
    levelEndTimes[level] = endMin;
  }

  return levels;
}

/**
 * Rendu lignes jour pour une seule période (vue standard)
 */
function renderSinglePeriodeRows(jours, slots, seances, hStart, pas, ctx) {
  let html = '';
  for (const jour of jours) {
    const jourSeances = seances.filter(s => s.jour === jour);

    // Assigner les niveaux de pile par coloration de graphe d'intervalles
    const stackLevels = assignStackLevels(jourSeances);
    const maxLevel = jourSeances.length > 0
      ? Math.max(0, ...jourSeances.map(s => stackLevels.get(s.id) || 0))
      : 0;
    const rowHeight = Math.max(52, (maxLevel + 1) * 36 + 4);

    // Indexer les séances par slot de départ pour l'affichage
    const bySlot = {};
    for (const s of jourSeances) {
      const slotIdx = findSlotIndex(s.heureDebut, hStart, pas);
      if (slotIdx < 0) continue;
      if (!bySlot[slotIdx]) bySlot[slotIdx] = [];
      bySlot[slotIdx].push(s);
    }

    // Bande jour pleine largeur — sert de séparateur visuel entre les jours
    const jourFull = jour.charAt(0).toUpperCase() + jour.slice(1);
    const nbSeances = jourSeances.length;
    html += `<div class="edt-day-header" style="grid-column:1/-1;">
      <span class="edt-day-header-name">${jourFull}</span>
      ${nbSeances > 0 ? `<span class="edt-day-header-count">${nbSeances} séance${nbSeances > 1 ? 's' : ''}</span>` : ''}
    </div>`;

    for (let si = 0; si < slots.length; si++) {
      const slot = slots[si];
      const blocsHere = bySlot[si] || [];
      const isHourBorder = slot.isHour ? 'hour-border' : '';

      html += `<div class="edt-slot ${isHourBorder}" data-jour="${jour}" data-heure="${slot.debut}" data-fin="${slot.fin}" style="min-height:${rowHeight}px;">`;

      for (const s of blocsHere) {
        const level = stackLevels.get(s.id) || 0;
        html += renderBloc(s, level, hStart, pas, ctx);
      }

      html += `</div>`;
    }
  }
  return html;
}

/**
 * Rendu lignes jour avec sous-lignes par période (vue "Toutes")
 * Optimisation : n'affiche que les périodes qui ont au moins 1 séance ce jour-là
 */
function renderAllPeriodesRows(jours, periodes, slots, seances, hStart, pas, ctx) {
  let html = '';
  for (const jour of jours) {
    // Filtrer les périodes qui ont des séances ce jour
    const jourSeances = seances.filter(s => s.jour === jour);
    const periodesAvecSeances = periodes.filter(per =>
      jourSeances.some(s => s.periodeId === per.id)
    );

    // Si aucune séance ce jour, afficher 1 ligne vide
    const periodesAffichees = periodesAvecSeances.length > 0 ? periodesAvecSeances : [null];

    for (let pi = 0; pi < periodesAffichees.length; pi++) {
      const per = periodesAffichees[pi];
      const perSeances = per
        ? jourSeances.filter(s => s.periodeId === per.id)
        : [];

      // Assigner les niveaux de pile par coloration de graphe d'intervalles
      const stackLevels = assignStackLevels(perSeances);
      const maxLevel = perSeances.length > 0
        ? Math.max(0, ...perSeances.map(s => stackLevels.get(s.id) || 0))
        : 0;
      const rowHeight = Math.max(40, (maxLevel + 1) * 34 + 4);

      // Indexer par slot de départ
      const bySlot = {};
      for (const s of perSeances) {
        const slotIdx = findSlotIndex(s.heureDebut, hStart, pas);
        if (slotIdx < 0) continue;
        if (!bySlot[slotIdx]) bySlot[slotIdx] = [];
        bySlot[slotIdx].push(s);
      }

      // Bande jour pleine largeur (uniquement pour la première ligne de période)
      if (pi === 0) {
        const jourFull = jour.charAt(0).toUpperCase() + jour.slice(1);
        const nbSeances = jourSeances.length;
        html += `<div class="edt-day-header" style="grid-column:1/-1;">
          <span class="edt-day-header-name">${jourFull}</span>
          ${nbSeances > 0 ? `<span class="edt-day-header-count">${nbSeances} séance${nbSeances > 1 ? 's' : ''}</span>` : ''}
        </div>`;
      }

      // Period label (abbreviated)
      // edt-period-continued : lignes 2+ d'un même jour — "break-before: avoid" en impression
      html += `<div class="edt-period-cell${pi > 0 ? ' edt-period-continued' : ''}">${per ? abrevPeriode(per.nom) : '—'}</div>`;

      // Slot cells
      for (let si = 0; si < slots.length; si++) {
        const slot = slots[si];
        const blocsHere = bySlot[si] || [];
        const isHourBorder = slot.isHour ? 'hour-border' : '';

        html += `<div class="edt-slot ${isHourBorder}" data-jour="${jour}" data-heure="${slot.debut}" data-fin="${slot.fin}" ${per ? `data-periode="${per.id}"` : ''} style="min-height:${rowHeight}px;">`;

        for (const s of blocsHere) {
          const level = stackLevels.get(s.id) || 0;
          html += renderBloc(s, level, hStart, pas, ctx);
        }

        html += `</div>`;
      }
    }
  }
  return html;
}

// ============================
// BLOC RENDERING (with spanning)
// ============================

function renderBloc(seance, stackIndex, hStart, pas, ctx) {
  const { enseignants, classes, activites, installations, lieux } = ctx;
  const ens = enseignants.find(e => e.id === seance.enseignantId);
  const cls = classes.find(c => c.id === seance.classeId);
  const act = activites.find(a => a.id === seance.activiteId);
  const inst = installations.find(i => i.id === seance.installationId);
  const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;
  const slug = lieu ? slugify(lieu.nom) : 'default';

  // Calculate spanning
  const startMin = heureToMinutes(seance.heureDebut);
  const endMin = heureToMinutes(seance.heureFin);
  const durationSlots = Math.max(1, (endMin - startMin) / pas);
  const widthPct = durationSlots * 100;
  const topOffset = stackIndex * 34 + 2;

  const isFromProg = !!seance.programmationId;

  return `
    <div class="edt-bloc ${seance.verrouille ? 'locked' : ''} ${isFromProg ? 'from-prog' : ''}"
         data-seance-id="${seance.id}"
         data-install="${slug}"
         draggable="${seance.verrouille ? 'false' : 'true'}"
         style="width:${widthPct}%; top:${topOffset}px; position:absolute; left:0; height:32px;"
         title="${cls?.nom || ''} — ${act?.nom || ''}\n${ens ? ens.prenom + ' ' + ens.nom : ''}\n${inst?.nom || ''}\n${formatHeureLabel(seance.heureDebut)}-${formatHeureLabel(seance.heureFin)}">
      <span class="bloc-class">${cls?.nom || '?'}</span>
      <span class="bloc-activity">${act?.nom || ''}</span>
      <span class="bloc-install">${inst?.nom || ''}</span>
      <span class="bloc-prof">${ens?.initiales || (ens ? ens.prenom?.[0] + '.' + ens.nom?.[0] : '')}</span>
      ${seance.verrouille ? '<span class="bloc-lock-icon">&#128274;</span>' : ''}
    </div>
  `;
}

// ============================
// EVENT BINDING
// ============================

function bindEdtEvents(container, seancesFiltrees, ctx) {
  const { enseignants, classes, activites, installations, lieux, periodes } = ctx;

  // Sélection période
  container.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.periode;
      if (val === 'all') {
        state.showAllPeriodes = true;
        state.periodeId = null;
      } else {
        state.showAllPeriodes = false;
        state.periodeId = parseInt(val);
      }
      renderEdt(container);
    });
  });

  // Filtres
  container.querySelector('#edt-filtre-ens')?.addEventListener('change', (e) => {
    state.filtreEnseignant = e.target.value ? parseInt(e.target.value) : null;
    renderEdt(container);
  });
  container.querySelector('#edt-filtre-cls')?.addEventListener('change', (e) => {
    state.filtreClasse = e.target.value ? parseInt(e.target.value) : null;
    renderEdt(container);
  });

  // Ajout séance
  container.querySelector('#edt-btn-add')?.addEventListener('click', () => {
    openSeanceModal(null, ctx, container);
  });

  // Impression
  container.querySelector('#edt-btn-print')?.addEventListener('click', () => {
    window.print();
  });

  // Click bloc → éditer
  container.querySelectorAll('.edt-bloc').forEach(bloc => {
    bloc.addEventListener('click', async (e) => {
      const seanceId = parseInt(bloc.dataset.seanceId);
      const seance = await db.seances.get(seanceId);
      if (seance) {
        openSeanceModal(seance, ctx, container);
      }
    });
  });

  // Drag & drop
  setupDragDrop(container, seancesFiltrees, ctx);

  // ---- Zoom auto à l'impression ----
  // Nettoie les handlers précédents (re-render lors d'un changement de filtre/période)
  if (window._edtPrintCleanup) window._edtPrintCleanup();

  // A4 paysage imprimable : (210 - 10 - 8) mm × 96dpi / 25.4 = 725 px
  const A4_H_PX = 725;

  const onBeforePrint = () => {
    const viewEl = document.getElementById('view-edt');
    if (!viewEl?.classList.contains('active')) return;
    const c = viewEl.querySelector('.edt-container');
    if (!c) return;
    const h = c.scrollHeight;
    if (h > A4_H_PX) {
      const scale = A4_H_PX / h;
      // Applique le zoom uniquement si la réduction est ≤ 28% (reste lisible)
      // Au-delà, on laisse les sauts de page naturels s'en charger
      if (scale >= 0.72) {
        c.style.zoom = scale.toFixed(4);
        c.dataset.printZoom = '1';
      }
    }
  };

  const onAfterPrint = () => {
    const c = document.querySelector('#view-edt .edt-container');
    if (c?.dataset.printZoom) {
      c.style.zoom = '';
      delete c.dataset.printZoom;
    }
  };

  window.addEventListener('beforeprint', onBeforePrint);
  window.addEventListener('afterprint', onAfterPrint);
  window._edtPrintCleanup = () => {
    window.removeEventListener('beforeprint', onBeforePrint);
    window.removeEventListener('afterprint', onAfterPrint);
  };
}

// ============================
// DRAG & DROP
// ============================

function setupDragDrop(container, seances, context) {
  // Drag start
  container.querySelectorAll('.edt-bloc[draggable="true"]').forEach(bloc => {
    bloc.addEventListener('dragstart', (e) => {
      const seanceId = parseInt(bloc.dataset.seanceId);
      state.dragSeance = seanceId;
      e.dataTransfer.setData('text/plain', String(seanceId));
      e.dataTransfer.effectAllowed = 'move';
      bloc.classList.add('dragging');

      // Disable pointer events on other blocks so drops hit the slots
      setTimeout(() => {
        container.querySelectorAll('.edt-bloc').forEach(b => {
          if (b !== bloc) b.style.pointerEvents = 'none';
        });
        highlightValidSlots(container);
      }, 50);
    });

    bloc.addEventListener('dragend', () => {
      bloc.classList.remove('dragging');
      // Restore pointer events
      container.querySelectorAll('.edt-bloc').forEach(b => {
        b.style.pointerEvents = '';
      });
      clearHighlights(container);
      state.dragSeance = null;
    });
  });

  // Drop targets (slot cells)
  container.querySelectorAll('.edt-slot').forEach(slot => {
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      slot.classList.add('drop-over');
    });

    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drop-over');
    });

    slot.addEventListener('drop', async (e) => {
      e.preventDefault();
      slot.classList.remove('drop-over');
      clearHighlights(container);

      if (!state.dragSeance) return;
      const seanceId = state.dragSeance;
      state.dragSeance = null;
      const seance = await db.seances.get(seanceId);
      if (!seance) return;

      const newJour      = slot.dataset.jour;
      const newHeureDebut = slot.dataset.heure;
      const duration     = heureToMinutes(seance.heureFin) - heureToMinutes(seance.heureDebut);
      const newHeureFin  = minutesToHeure(heureToMinutes(newHeureDebut) + duration);

      await captureUndo('Déplacement séance');
      // Update the séance itself
      await db.seances.update(seanceId, { jour: newJour, heureDebut: newHeureDebut, heureFin: newHeureFin });

      if (seance.programmationId) {
        // Linked to a programmation: store overrides on prog, not on the shared creneauClasse
        const creneau = seance.creneauClasseId ? await db.creneauxClasses.get(seance.creneauClasseId) : null;
        const jourOvr  = (!creneau || newJour       !== creneau.jour)      ? newJour      : null;
        const hDebOvr  = (!creneau || newHeureDebut !== creneau.heureDebut) ? newHeureDebut : null;
        const hFinOvr  = (!creneau || newHeureFin   !== creneau.heureFin)  ? newHeureFin  : null;
        await db.programmations.update(seance.programmationId, { jour: jourOvr, heureDebut: hDebOvr, heureFin: hFinOvr });

        // Check for sibling programmations (other periods sharing the same creneauClasse)
        const siblings = seance.creneauClasseId
          ? (await db.programmations.where('creneauClasseId').equals(seance.creneauClasseId).toArray())
              .filter(p => p.id !== seance.programmationId)
          : [];

        if (siblings.length > 0) {
          // Ask the user: this period only, or all periods?
          await showMoveChoiceDialog({
            seance, siblings, creneau,
            newJour, newHeureDebut, newHeureFin,
            container,
          });
          return; // renderEdt called inside the dialog
        }
      } else if (seance.creneauClasseId) {
        // Manual séance (no programmation): update the shared creneauClasse
        await db.creneauxClasses.update(seance.creneauClasseId, {
          jour: newJour, heureDebut: newHeureDebut, heureFin: newHeureFin,
        });
      }

      await validateAndRenderAfterMove(seanceId, container);
    });
  });
}

// ============================
// MOVE HELPERS
// ============================

async function validateAndRenderAfterMove(seanceId, container) {
  const updatedSeance = await db.seances.get(seanceId);
  const [toutesSeances, classes, installations, activites, indisponibilites,
    ctMax, ctEcart, ct1prof] = await Promise.all([
    db.seances.toArray(),
    db.classes.toArray(),
    db.installations.toArray(),
    db.activites.toArray(),
    db.indisponibilites.toArray(),
    getConfig('contrainte_max_heures_actif'),
    getConfig('contrainte_ecart_24h_actif'),
    getConfig('contrainte_1prof_1classe_actif'),
  ]);
  const conflits = validerSeance(updatedSeance, {
    seances: toutesSeances,
    classes, installations, activites, indisponibilites,
    contrainte_max_heures_actif: ctMax ?? true,
    contrainte_ecart_24h_actif: ctEcart ?? true,
    contrainte_1prof_1classe_actif: ct1prof ?? true,
  });
  if (conflits.length > 0) {
    toast.warning(`Séance déplacée — ${conflits.length} conflit(s) détecté(s)`);
  } else {
    toast.success('Séance déplacée');
  }
  renderEdt(container);
}

async function showMoveChoiceDialog({ seance, siblings, creneau, newJour, newHeureDebut, newHeureFin, container }) {
  const periodes = await db.periodes.toArray();
  const siblingNames = siblings
    .map(s => periodes.find(p => p.id === s.periodeId)?.nom || '?')
    .join(', ');

  return new Promise(resolve => {
    const footerEl = document.createElement('div');
    footerEl.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end;';

    const btnSingle = document.createElement('button');
    btnSingle.className = 'btn btn-outline';
    btnSingle.textContent = 'Cette période uniquement';

    const btnAll = document.createElement('button');
    btnAll.className = 'btn btn-primary';
    btnAll.textContent = 'Toutes les périodes';

    footerEl.appendChild(btnSingle);
    footerEl.appendChild(btnAll);

    const currentPeriode = periodes.find(p => p.id === seance.periodeId);

    const { close } = openModal({
      title: 'Appliquer le déplacement à…',
      content: `
        <p style="margin:0 0 0.75rem;">Ce déplacement concerne aussi d'autres périodes :</p>
        <ul style="margin:0 0 0.75rem 1.25rem;font-size:0.85rem;color:var(--c-text-secondary);">
          ${siblings.map(s => {
            const pNom = periodes.find(p => p.id === s.periodeId)?.nom || '?';
            return `<li>${pNom}</li>`;
          }).join('')}
        </ul>
        <p style="margin:0;font-size:0.85rem;color:var(--c-text-muted);">
          <strong>Cette période uniquement</strong> conserve les horaires des autres périodes indépendants.<br>
          <strong>Toutes les périodes</strong> met à jour le créneau commun (efface les horaires individuels).
        </p>`,
      footer: footerEl,
    });

    btnSingle.addEventListener('click', async () => {
      close();
      toast.success(`Séance déplacée pour ${currentPeriode?.nom || 'cette période'} uniquement`);
      await validateAndRenderAfterMove(seance.id, container);
      resolve();
    });

    btnAll.addEventListener('click', async () => {
      close();
      if (seance.creneauClasseId) {
        // Update the shared creneauClasse to the new slot
        await db.creneauxClasses.update(seance.creneauClasseId, {
          jour: newJour, heureDebut: newHeureDebut, heureFin: newHeureFin,
        });
        // Clear overrides for current prog and siblings (creneauClasse is now the truth)
        await db.programmations.update(seance.programmationId, { jour: null, heureDebut: null, heureFin: null });
        for (const sib of siblings) {
          await db.programmations.update(sib.id, { jour: null, heureDebut: null, heureFin: null });
        }
        // Update ALL seances sharing this creneauClasseId
        const allSeances = (await db.seances.toArray()).filter(s => s.creneauClasseId === seance.creneauClasseId);
        for (const s of allSeances) {
          await db.seances.update(s.id, { jour: newJour, heureDebut: newHeureDebut, heureFin: newHeureFin });
        }
      }
      toast.success('Déplacement appliqué à toutes les périodes');
      renderEdt(container);
      resolve();
    });
  });
}

function highlightValidSlots(container) {
  container.querySelectorAll('.edt-slot').forEach(slot => {
    slot.classList.add('drop-valid');
  });
}

function clearHighlights(container) {
  container.querySelectorAll('.edt-slot').forEach(slot => {
    slot.classList.remove('drop-valid', 'drop-invalid', 'drop-over');
  });
}

// ============================
// MODAL SÉANCE
// ============================

async function openSeanceModal(seance, context, edtContainer) {
  const { enseignants, classes, activites, installations, lieux, periodes } = context;
  const isEdit = seance !== null;

  // === Helpers pour filtrage dynamique ===
  function getActivitesForNiveau(niveau) {
    return activites.filter(a => {
      if (!a.niveaux || a.niveaux.length === 0) return true;
      return niveau && a.niveaux.includes(niveau);
    });
  }

  // Retourne les activités déjà utilisées par la classe, réparties en deux niveaux :
  // - samePeriod : même période → conflit réel
  // - otherPeriod : autre période → info (même activité sur un autre trimestre)
  async function getUsedActInfo(classeId, periodeId) {
    if (!classeId) return { samePeriod: new Set(), otherPeriod: new Set(), details: {} };
    const toutes = await db.seances.toArray();
    const periodes = await db.periodes.toArray();

    const autres = toutes.filter(s =>
      s.classeId === classeId &&
      s.activiteId != null &&
      !(isEdit && s.id === seance.id)
    );

    const samePeriod = new Set();
    const otherPeriod = new Set();
    const details = {}; // activiteId → [{periodeNom, jour}]

    for (const s of autres) {
      const isSame = periodeId ? s.periodeId === periodeId : true;
      if (isSame) samePeriod.add(s.activiteId);
      else otherPeriod.add(s.activiteId);

      if (!details[s.activiteId]) details[s.activiteId] = [];
      const pNom = periodes.find(p => p.id === s.periodeId)?.nom || '(sans période)';
      details[s.activiteId].push({ periodeNom: pNom, jour: s.jour });
    }

    return { samePeriod, otherPeriod, details };
  }

  function buildActOptions(niveau, selectedId, usedInfo = null) {
    const { samePeriod = new Set(), otherPeriod = new Set() } = usedInfo || {};
    const filtered = getActivitesForNiveau(niveau);
    let opts = '<option value="">-- Choisir --</option>';
    for (const a of filtered) {
      const inSame = samePeriod.has(a.id);
      const inOther = !inSame && otherPeriod.has(a.id);
      const suffix = inSame ? ' ✓' : inOther ? ' ○' : '';
      const label = `${a.nom} (${a.champApprentissage})${suffix}`;
      opts += `<option value="${a.id}" ${selectedId === a.id ? 'selected' : ''} data-same="${inSame}" data-other="${inOther}">${label}</option>`;
    }
    return opts;
  }

  function buildInstOptions(actId, selectedId) {
    let opts = '<option value="">-- Choisir --</option>';
    for (const l of lieux) {
      const installs = installations.filter(i => {
        if (i.lieuId !== l.id) return false;
        if (actId && i.activitesCompatibles && i.activitesCompatibles.length > 0) {
          return i.activitesCompatibles.includes(actId);
        }
        return true;
      });
      if (installs.length === 0) continue;
      for (const i of installs) {
        opts += `<option value="${i.id}" ${selectedId === i.id ? 'selected' : ''}>${l.nom} → ${i.nom}</option>`;
      }
    }
    return opts;
  }

  // Met à jour le bandeau d'alerte en fonction de l'activité sélectionnée
  function checkActWarning(usedInfo) {
    const { samePeriod = new Set(), otherPeriod = new Set(), details = {} } = usedInfo || {};
    const warning = document.getElementById('md-act-warning');
    if (!warning) return;
    const actId = parseInt(document.getElementById('md-seance-act')?.value) || null;
    if (!actId) { warning.style.display = 'none'; warning.className = 'md-act-warning'; return; }

    if (samePeriod.has(actId)) {
      warning.className = 'md-act-warning md-act-warning--conflict';
      warning.textContent = '⚠ Cette activité est déjà programmée sur un autre créneau pour cette classe dans cette période.';
      warning.style.display = 'block';
    } else if (otherPeriod.has(actId)) {
      const lieux = (details[actId] || []).map(d => `${d.periodeNom} (${d.jour})`).join(', ');
      warning.className = 'md-act-warning md-act-warning--info';
      warning.textContent = `ℹ Activité déjà utilisée pour cette classe dans une autre période : ${lieux}.`;
      warning.style.display = 'block';
    } else {
      warning.style.display = 'none';
      warning.className = 'md-act-warning';
    }
  }

  // Trouver le niveau de la classe sélectionnée
  const selectedClasse = seance ? classes.find(c => c.id === seance.classeId) : null;
  const initNiveau = selectedClasse?.niveau || null;
  const initActId = seance?.activiteId || null;
  const initInstId = seance?.installationId || null;

  // Pré-calculer les activités déjà utilisées pour l'état initial
  let currentUsedInfo = await getUsedActInfo(seance?.classeId || null, seance?.periodeId || null);

  // Calcul état initial du bandeau
  const initInSame = initActId && currentUsedInfo.samePeriod.has(initActId);
  const initInOther = initActId && !initInSame && currentUsedInfo.otherPeriod.has(initActId);
  const initWarningClass = initInSame ? 'md-act-warning md-act-warning--conflict' : initInOther ? 'md-act-warning md-act-warning--info' : 'md-act-warning';
  const initWarningText = initInSame
    ? '⚠ Cette activité est déjà programmée sur un autre créneau pour cette classe dans cette période.'
    : initInOther
      ? `ℹ Activité déjà utilisée pour cette classe dans une autre période : ${(currentUsedInfo.details[initActId] || []).map(d => `${d.periodeNom} (${d.jour})`).join(', ')}.`
      : '';

  const { close } = openModal({
    title: isEdit ? 'Modifier la séance' : 'Nouvelle séance',
    content: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Classe <span class="required">*</span></label>
          <select class="form-select" id="md-seance-classe">
            <option value="">-- Choisir --</option>
            ${classes.map(c => `<option value="${c.id}" ${seance?.classeId === c.id ? 'selected' : ''}>${c.nom} (${c.niveau})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Enseignant <span class="required">*</span></label>
          <select class="form-select" id="md-seance-ens">
            <option value="">-- Choisir --</option>
            ${enseignants.map(e => `<option value="${e.id}" ${seance?.enseignantId === e.id ? 'selected' : ''}>${e.prenom} ${e.nom}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Activité</label>
          <select class="form-select" id="md-seance-act">
            ${buildActOptions(initNiveau, initActId, currentUsedInfo)}
          </select>
          <div id="md-act-warning" class="${initWarningClass}" style="display:${initInSame || initInOther ? 'block' : 'none'};">${initWarningText}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Installation</label>
          <select class="form-select" id="md-seance-inst">
            ${buildInstOptions(initActId, initInstId)}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Jour</label>
          <select class="form-select" id="md-seance-jour">
            ${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'].map(j => `
              <option value="${j}" ${seance?.jour === j ? 'selected' : ''}>${j.charAt(0).toUpperCase() + j.slice(1)}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Heure début</label>
          <input type="time" class="form-input" id="md-seance-hdeb" value="${seance?.heureDebut || '08:00'}">
        </div>
        <div class="form-group">
          <label class="form-label">Heure fin</label>
          <input type="time" class="form-input" id="md-seance-hfin" value="${seance?.heureFin || '10:00'}">
        </div>
      </div>
      <div id="md-indispo-warning" class="md-act-warning md-act-warning--danger" style="display:none;"></div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Période</label>
          <select class="form-select" id="md-seance-per">
            <option value="">-- Toutes --</option>
            ${periodes.map(p => `<option value="${p.id}" ${seance?.periodeId === p.id ? 'selected' : ''}>${p.nom}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="md-seance-notes" rows="2" placeholder="Notes...">${seance?.notes || ''}</textarea>
      </div>
      ${seance?.programmationId ? '<p style="color:var(--c-text-muted);font-size:var(--fs-xs);margin-top:var(--sp-2);">&#9432; Cette séance est liée à la programmation annuelle.</p>' : ''}
    `,
    footer: `
      ${isEdit ? '<button class="btn btn-danger" id="md-seance-del">Supprimer</button>' : '<span></span>'}
      <div style="display:flex;gap:var(--sp-2);">
        ${isEdit ? '<button class="btn btn-ghost" id="md-seance-copy" title="Dupliquer cette séance vers un autre jour ou une autre période">⧉ Copier</button>' : ''}
        <button class="btn btn-outline" id="md-seance-cancel">Annuler</button>
        <button class="btn btn-primary" id="md-seance-save">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    `,
    wide: true,
  });

  // Vérifie les indisponibilités de l'enseignant sélectionné sur le créneau
  async function checkIndispoWarning() {
    const warning = document.getElementById('md-indispo-warning');
    if (!warning) return;

    const ensId = parseInt(document.getElementById('md-seance-ens')?.value) || null;
    const jour = document.getElementById('md-seance-jour')?.value || null;
    const heureDebut = document.getElementById('md-seance-hdeb')?.value || null;
    const heureFin = document.getElementById('md-seance-hfin')?.value || null;

    if (!ensId || !jour || !heureDebut || !heureFin) {
      warning.style.display = 'none';
      return;
    }

    const indisposEns = await db.indisponibilites
      .filter(i => i.type === 'enseignant' && i.refId === ensId)
      .toArray();

    const conflicts = conflitIndisponibilite(
      { enseignantId: ensId, installationId: null, jour, heureDebut, heureFin },
      indisposEns
    );

    if (conflicts.length > 0) {
      const ens = enseignants.find(e => e.id === ensId);
      const ensNom = ens ? `${ens.prenom} ${ens.nom}` : 'cet enseignant';
      const msgs = conflicts.map(i =>
        !i.heureDebut ? 'absent toute la journée' : `indisponible de ${i.heureDebut} à ${i.heureFin}`
      );
      warning.textContent = `⛔ ${ensNom} est ${msgs.join(', ')} le ${jour}.`;
      warning.style.display = 'block';
    } else {
      warning.style.display = 'none';
    }
  }

  // Recalcule usedInfo et rafraîchit le select activité
  async function refreshActSelect() {
    const clId = parseInt(document.getElementById('md-seance-classe')?.value) || null;
    const perId = parseInt(document.getElementById('md-seance-per')?.value) || null;
    const cl = clId ? classes.find(c => c.id === clId) : null;
    const prevActId = parseInt(document.getElementById('md-seance-act')?.value) || null;

    currentUsedInfo = await getUsedActInfo(clId, perId);

    const actSelect = document.getElementById('md-seance-act');
    if (actSelect) {
      actSelect.innerHTML = buildActOptions(cl?.niveau, prevActId, currentUsedInfo);
    }
    checkActWarning(currentUsedInfo);
  }

  // Appel initial : vérifier les indispos pour la séance existante
  checkIndispoWarning();

  // === Filtrage dynamique : classe → activités, activité → installations ===
  document.getElementById('md-seance-classe')?.addEventListener('change', async (e) => {
    await refreshActSelect();
    const instSelect = document.getElementById('md-seance-inst');
    if (instSelect) instSelect.innerHTML = buildInstOptions(null, null);
  });

  document.getElementById('md-seance-ens')?.addEventListener('change', () => checkIndispoWarning());
  document.getElementById('md-seance-jour')?.addEventListener('change', () => checkIndispoWarning());
  document.getElementById('md-seance-hdeb')?.addEventListener('change', () => checkIndispoWarning());
  document.getElementById('md-seance-hfin')?.addEventListener('change', () => checkIndispoWarning());

  document.getElementById('md-seance-per')?.addEventListener('change', async () => {
    await refreshActSelect();
  });

  document.getElementById('md-seance-act')?.addEventListener('change', (e) => {
    const actId = parseInt(e.target.value) || null;
    const instSelect = document.getElementById('md-seance-inst');
    if (instSelect) {
      const prevVal = parseInt(instSelect.value) || null;
      instSelect.innerHTML = buildInstOptions(actId, prevVal);
    }
    checkActWarning(currentUsedInfo);
  });

  document.getElementById('md-seance-copy')?.addEventListener('click', () => {
    close();
    openDuplicateModal(seance, ctx, edtContainer);
  });

  document.getElementById('md-seance-cancel')?.addEventListener('click', close);
  document.getElementById('md-seance-del')?.addEventListener('click', async () => {
    await captureUndo('Suppression séance');
    await db.seances.delete(seance.id);
    // Also delete linked programmation if exists
    if (seance.programmationId) {
      await db.programmations.delete(seance.programmationId);
    }
    toast.success('Séance supprimée');
    close();
    renderEdt(edtContainer);
  });
  document.getElementById('md-seance-save')?.addEventListener('click', async () => {
    const data = {
      classeId: parseInt(document.getElementById('md-seance-classe').value) || null,
      enseignantId: parseInt(document.getElementById('md-seance-ens').value) || null,
      activiteId: parseInt(document.getElementById('md-seance-act').value) || null,
      installationId: parseInt(document.getElementById('md-seance-inst').value) || null,
      jour: document.getElementById('md-seance-jour').value,
      heureDebut: document.getElementById('md-seance-hdeb').value,
      heureFin: document.getElementById('md-seance-hfin').value,
      periodeId: parseInt(document.getElementById('md-seance-per').value) || null,
      notes: document.getElementById('md-seance-notes').value.trim(),
      verrouille: seance?.verrouille || false,
    };

    if (!data.classeId || !data.enseignantId) {
      toast.warning('Classe et enseignant sont obligatoires');
      return;
    }

    await captureUndo(isEdit ? 'Modification séance' : 'Ajout séance');
    if (isEdit) {
      await db.seances.update(seance.id, data);
      // Si lié à une programmation : mettre à jour les overrides sur la prog, pas le créneau partagé
      if (seance.programmationId) {
        const creneau = seance.creneauClasseId ? await db.creneauxClasses.get(seance.creneauClasseId) : null;
        const jourOvr = (!creneau || data.jour       !== creneau.jour)      ? data.jour       : null;
        const hDeb    = (!creneau || data.heureDebut !== creneau.heureDebut) ? data.heureDebut : null;
        const hFin    = (!creneau || data.heureFin   !== creneau.heureFin)  ? data.heureFin   : null;
        await db.programmations.update(seance.programmationId, { jour: jourOvr, heureDebut: hDeb, heureFin: hFin });
      } else if (seance.creneauClasseId) {
        // Séance manuelle sans programmation : mettre à jour le créneau partagé
        await db.creneauxClasses.update(seance.creneauClasseId, {
          enseignantId: data.enseignantId,
          jour: data.jour,
          heureDebut: data.heureDebut,
          heureFin: data.heureFin,
        });
      }
      // Mettre à jour la programmation liée si elle existe
      if (seance.programmationId) {
        await db.programmations.update(seance.programmationId, {
          activiteId: data.activiteId,
          installationId: data.installationId,
          periodeId: data.periodeId,
        });
      }
      toast.success('Séance mise à jour');
    } else {
      // --- Nouvelle séance : créer creneauClasse + programmation pour la synchronisation ---
      let creneauClasseId = null;
      let programmationId = null;

      if (data.classeId && data.jour && data.heureDebut && data.heureFin) {
        // Réutiliser un créneau existant si même classe + jour + heure début
        const allCreneaux = await db.creneauxClasses.toArray();
        const existingCreneau = allCreneaux.find(cc =>
          cc.classeId === data.classeId &&
          cc.jour === data.jour &&
          cc.heureDebut === data.heureDebut
        );

        creneauClasseId = existingCreneau
          ? existingCreneau.id
          : await db.creneauxClasses.add({
              classeId: data.classeId,
              enseignantId: data.enseignantId,
              jour: data.jour,
              heureDebut: data.heureDebut,
              heureFin: data.heureFin,
            });

        // Créer une programmation si une période est choisie
        if (data.periodeId) {
          const existingProg = await db.programmations
            .where({ creneauClasseId, periodeId: data.periodeId })
            .first();

          programmationId = existingProg
            ? existingProg.id
            : await db.programmations.add({
                creneauClasseId,
                periodeId: data.periodeId,
                activiteId: data.activiteId,
                installationId: data.installationId,
                classeId: data.classeId,
                statut: 'propose',
              });
        }
      }

      await db.seances.add({ ...data, creneauClasseId, programmationId });
      toast.success('Séance ajoutée');
    }
    close();
    renderEdt(edtContainer);
  });
}

// ============================
// DUPLICATION SÉANCE
// ============================

async function openDuplicateModal(seance, ctx, edtContainer) {
  const { enseignants, classes, activites, installations, lieux, periodes } = ctx;

  const cls   = classes.find(c => c.id === seance.classeId);
  const act   = activites.find(a => a.id === seance.activiteId);
  const inst  = installations.find(i => i.id === seance.installationId);
  const ens   = enseignants.find(e => e.id === seance.enseignantId);
  const curPer = periodes.find(p => p.id === seance.periodeId);

  const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];

  const { close } = openModal({
    title: 'Dupliquer la séance',
    content: `
      <div style="background:var(--c-surface-2,#f5f5f5);border-radius:var(--radius);padding:var(--sp-3) var(--sp-4);margin-bottom:var(--sp-4);font-size:var(--fs-sm);">
        <strong>${cls?.nom || '?'}</strong> — ${act?.nom || '?'} — ${inst?.nom || '?'}<br>
        <span style="color:var(--c-text-muted);">
          ${ens ? ens.prenom + ' ' + ens.nom + ' · ' : ''}${seance.jour ? seance.jour.charAt(0).toUpperCase() + seance.jour.slice(1) : ''} ${seance.heureDebut}–${seance.heureFin} · ${curPer?.nom || 'Toutes périodes'}
        </span>
      </div>

      <div class="form-group">
        <label class="form-label">Jour de la copie</label>
        <select class="form-select" id="dup-jour">
          ${JOURS.map(j => `<option value="${j}" ${j === seance.jour ? 'selected' : ''}>${j.charAt(0).toUpperCase() + j.slice(1)}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Période(s) de destination</label>
        <div style="display:flex;flex-direction:column;gap:var(--sp-2);margin-top:var(--sp-1);">
          ${periodes.map(p => `
            <label style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer;font-size:var(--fs-sm);">
              <input type="checkbox" name="dup-per" value="${p.id}" ${p.id !== seance.periodeId ? 'checked' : ''} style="width:15px;height:15px;cursor:pointer;">
              <span>${p.nom}${p.id === seance.periodeId ? ' <span style="color:var(--c-text-muted);font-size:var(--fs-xs);">(période actuelle)</span>' : ''}</span>
            </label>
          `).join('')}
        </div>
        <p style="font-size:var(--fs-xs);color:var(--c-text-muted);margin-top:var(--sp-2);margin-bottom:0;">
          Une copie indépendante sera créée pour chaque période cochée.
        </p>
      </div>
    `,
    footer: `
      <span></span>
      <div style="display:flex;gap:var(--sp-2);">
        <button class="btn btn-outline" id="dup-cancel">Annuler</button>
        <button class="btn btn-primary" id="dup-confirm">Dupliquer</button>
      </div>
    `,
    wide: true,
  });

  document.getElementById('dup-cancel')?.addEventListener('click', close);

  document.getElementById('dup-confirm')?.addEventListener('click', async () => {
    const targetJour = document.getElementById('dup-jour').value;
    const selectedPeriodeIds = [...document.querySelectorAll('input[name="dup-per"]:checked')]
      .map(cb => parseInt(cb.value));

    if (selectedPeriodeIds.length === 0) {
      toast.warning('Sélectionnez au moins une période de destination');
      return;
    }

    await captureUndo('Duplication séance');

    let created = 0;
    for (const periodeId of selectedPeriodeIds) {
      const data = {
        classeId:      seance.classeId,
        enseignantId:  seance.enseignantId,
        activiteId:    seance.activiteId,
        installationId: seance.installationId,
        jour:          targetJour,
        heureDebut:    seance.heureDebut,
        heureFin:      seance.heureFin,
        periodeId,
        notes:         seance.notes || '',
        verrouille:    false,
      };

      // Réutiliser ou créer un creneauClasse
      const allCreneaux = await db.creneauxClasses.toArray();
      const existingCreneau = allCreneaux.find(cc =>
        cc.classeId   === data.classeId &&
        cc.jour       === data.jour &&
        cc.heureDebut === data.heureDebut
      );
      const creneauClasseId = existingCreneau
        ? existingCreneau.id
        : await db.creneauxClasses.add({
            classeId:    data.classeId,
            enseignantId: data.enseignantId,
            jour:        data.jour,
            heureDebut:  data.heureDebut,
            heureFin:    data.heureFin,
          });

      // Réutiliser ou créer une programmation
      const existingProg = await db.programmations
        .where({ creneauClasseId, periodeId })
        .first();
      const programmationId = existingProg
        ? existingProg.id
        : await db.programmations.add({
            creneauClasseId,
            periodeId,
            activiteId:    data.activiteId,
            installationId: data.installationId,
            classeId:      data.classeId,
            statut:        'propose',
          });

      await db.seances.add({ ...data, creneauClasseId, programmationId });
      created++;
    }

    const s = created > 1;
    toast.success(`${created} séance${s ? 's' : ''} créée${s ? 's' : ''}`);
    close();
    renderEdt(edtContainer);
  });
}

// ============================
// HELPERS
// ============================

function genererSlots(startMin, endMin, pasMinutes) {
  const slots = [];
  for (let m = startMin; m < endMin; m += pasMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const isHour = min === 0;
    const label = isHour ? `${h}h` : `${h}h${String(min).padStart(2, '0')}`;
    slots.push({
      debut: minutesToHeure(m),
      fin: minutesToHeure(m + pasMinutes),
      label,
      isHour,
    });
  }
  return slots;
}

function minutesToHeure(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatHeureLabel(str) {
  if (!str) return '';
  const [h, m] = str.split(':');
  return m === '00' ? `${parseInt(h)}h` : `${parseInt(h)}h${m}`;
}

function seDansSlot(seance, slot) {
  const sDebut = heureToMinutes(seance.heureDebut);
  const slotDebut = heureToMinutes(slot.debut);
  const slotFin = heureToMinutes(slot.fin);
  return sDebut >= slotDebut && sDebut < slotFin;
}

function findSlotIndex(heureDebut, hStart, pas) {
  const startMin = heureToMinutes(heureDebut);
  const idx = Math.floor((startMin - hStart) / pas);
  return idx >= 0 ? idx : -1;
}

/**
 * Abréviation intelligente d'un nom de période
 * "Trimestre 1" → "T1", "Semestre 2" → "S2", "Période 6" → "P6"
 */
function abrevPeriode(nom) {
  if (!nom) return '?';
  // Extraire la première lettre + chiffre s'il y en a un
  const match = nom.match(/^(\S)\S*\s*(\d+)/);
  if (match) return match[1].toUpperCase() + match[2];
  // Sinon prendre les 3 premiers caractères
  return nom.substring(0, 3);
}

async function refreshView(data, rootContainer) {
  // Unused - kept for compatibility
}
