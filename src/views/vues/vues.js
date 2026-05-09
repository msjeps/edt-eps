/**
 * Vues individuelles — grilles EDT par enseignant, classe ou installation
 * Read-only, printable
 */
import db from '../../db/schema.js';
import { getInstallationColors } from '../../utils/colors.js';
import { slugify } from '../../utils/helpers.js';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
const JOURS_COURTS = { lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven' };

// px par 30 minutes dans la mini-grille
const SLOT_PX = 24;

let currentTab = 'enseignant';

// ============================================================
// UTILITAIRES
// ============================================================

function heureToMin(h) {
  if (!h) return 0;
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + (mm || 0);
}

function minToLabel(m) {
  const h = Math.floor(m / 60);
  const mn = m % 60;
  return mn === 0 ? `${h}h` : `${h}h${String(mn).padStart(2, '0')}`;
}

/**
 * Déduplique les séances par creneauClasseId pour le calcul hebdomadaire.
 * Si "toutes les périodes" : une séance récurrente (même creneauClasseId) ne compte qu'une fois.
 */
export function seancesHebdo(seances) {
  const seen = new Set();
  return seances.filter(s => {
    const key = s.creneauClasseId
      ? `cc:${s.creneauClasseId}`
      : `manual:${s.enseignantId}:${s.classeId}:${s.jour}:${s.heureDebut}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function totalMin(seances) {
  return seances.reduce((acc, s) => acc + heureToMin(s.heureFin) - heureToMin(s.heureDebut), 0);
}

export function totalHStr(seances) {
  const min = totalMin(seancesHebdo(seances));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

function hexToRgb(hex) {
  if (!hex || hex[0] !== '#') return [150, 150, 155];
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Les couleurs sont basées sur le LIEU (parent de l'installation), comme dans la grille EDT
function getColors(inst, lieux) {
  if (!inst) return getInstallationColors('default');
  const lieu = lieux?.find(l => l.id === inst.lieuId);
  const slug = lieu ? slugify(lieu.nom) : slugify(inst.nom);
  return getInstallationColors(slug);
}

/**
 * Calcule l'axe temps (min/max arrondis à 30 min) pour un ensemble de séances.
 */
function calcTimeRange(seances) {
  if (!seances.length) return { firstMin: 480, lastMin: 1080 };
  let firstMin = Infinity, lastMin = 0;
  for (const s of seances) {
    if (s.heureDebut) firstMin = Math.min(firstMin, heureToMin(s.heureDebut));
    if (s.heureFin)   lastMin  = Math.max(lastMin,  heureToMin(s.heureFin));
  }
  // Arrondir à 30 min
  firstMin = Math.floor(firstMin / 30) * 30;
  lastMin  = Math.ceil(lastMin / 30) * 30;
  return { firstMin, lastMin };
}

// ============================================================
// MINI-GRILLE SEMAINE
// ============================================================

/**
 * Génère le HTML d'une mini-grille semaine pour un ensemble de séances.
 * @param {Array} seances - séances à afficher
 * @param {Object} refs   - { classes, enseignants, activites, installations, lieux }
 * @param {Object} opts   - { showEnseignant, showClasse, showInstallation }
 */
export function buildMiniGrid(seances, refs, opts = {}) {
  if (!seances.length) {
    return `<div style="color:var(--c-text-secondary);font-style:italic;padding:var(--sp-3);">Aucune séance</div>`;
  }

  const { firstMin, lastMin } = calcTimeRange(seances);
  const totalSlots = (lastMin - firstMin) / 30;
  const gridH = totalSlots * SLOT_PX;
  const DAY_COL_W = 110;
  const TIME_COL_W = 36;

  // Générer les labels de temps (toutes les 30 min, label tous les 60 min)
  const timeLabels = [];
  for (let m = firstMin; m <= lastMin; m += 30) {
    timeLabels.push(m);
  }

  // Séances groupées par jour
  const byJour = {};
  for (const jour of JOURS) byJour[jour] = [];
  for (const s of seances) {
    if (s.jour && byJour[s.jour]) byJour[s.jour].push(s);
  }

  // Déterminer les jours qui ont au moins une séance
  const jourActifs = JOURS.filter(j => byJour[j].length > 0);
  if (!jourActifs.length) {
    return `<div style="color:var(--c-text-secondary);font-style:italic;padding:var(--sp-3);">Aucune séance</div>`;
  }

  const totalW = TIME_COL_W + jourActifs.length * DAY_COL_W;

  let html = `<div class="mini-grid" style="width:${totalW}px;min-width:${totalW}px;">`;

  // --- EN-TÊTES JOURS ---
  html += `<div class="mini-grid-header" style="display:flex;">`;
  html += `<div style="width:${TIME_COL_W}px;flex-shrink:0;"></div>`;
  for (const jour of jourActifs) {
    html += `<div class="mini-grid-day-hdr" style="width:${DAY_COL_W}px;flex-shrink:0;">${JOURS_COURTS[jour] || jour}</div>`;
  }
  html += `</div>`;

  // --- CORPS ---
  html += `<div class="mini-grid-body" style="display:flex;position:relative;height:${gridH}px;">`;

  // Colonne labels de temps
  html += `<div class="mini-grid-time-col" style="width:${TIME_COL_W}px;flex-shrink:0;position:relative;height:${gridH}px;">`;
  for (const m of timeLabels) {
    const top = (m - firstMin) / 30 * SLOT_PX;
    const label = m % 60 === 0 ? minToLabel(m) : '';
    if (label) {
      html += `<div style="position:absolute;top:${top}px;right:4px;font-size:9px;color:var(--c-text-secondary);line-height:1;transform:translateY(-50%);">${label}</div>`;
    }
  }
  html += `</div>`;

  // Colonnes jours
  for (const jour of jourActifs) {
    html += `<div class="mini-grid-day-col" style="width:${DAY_COL_W}px;flex-shrink:0;position:relative;height:${gridH}px;">`;

    // Lignes guides horizontales (toutes les 30 min)
    for (const m of timeLabels) {
      const top = (m - firstMin) / 30 * SLOT_PX;
      const isDark = m % 60 === 0;
      html += `<div style="position:absolute;top:${top}px;left:0;right:0;border-top:${isDark ? '1px solid #cbd5e1' : '1px dashed #e2e8f0'};pointer-events:none;"></div>`;
    }

    // Blocs séances
    for (const s of byJour[jour]) {
      const startMin = heureToMin(s.heureDebut);
      const endMin   = heureToMin(s.heureFin);
      if (startMin < firstMin || endMin > lastMin || startMin >= endMin) continue;

      const top    = (startMin - firstMin) / 30 * SLOT_PX + 1;
      const height = (endMin - startMin) / 30 * SLOT_PX - 2;

      const inst   = refs.installations.find(i => i.id === s.installationId);
      const cls    = refs.classes.find(c => c.id === s.classeId);
      const ens    = refs.enseignants.find(e => e.id === s.enseignantId);
      const act    = refs.activites.find(a => a.id === s.activiteId);
      const colors = getColors(inst, refs.lieux);
      const rgb    = hexToRgb(colors.bg);
      const borderRgb = hexToRgb(colors.border);
      const textDark  = luminance(hexToRgb(colors.text)) < 128;

      const lines = [];
      if (opts.showClasse    && cls)  lines.push(`<strong>${cls.nom}</strong>`);
      if (opts.showEnseignant && ens) lines.push(`<span style="font-size:9px;">${ens.prenom ? ens.prenom[0] + '. ' : ''}${ens.nom}</span>`);
      if (act && height >= 28)        lines.push(`<span style="font-size:9px;opacity:.85;">${act.nom.length > 14 ? act.nom.slice(0, 13) + '…' : act.nom}</span>`);
      if (opts.showInstallation && inst && height >= 38) {
        lines.push(`<span style="font-size:8px;opacity:.75;">${inst.nom.length > 12 ? inst.nom.slice(0, 11) + '…' : inst.nom}</span>`);
      }

      html += `<div style="
        position:absolute;
        top:${top}px;
        left:2px;right:2px;
        height:${height}px;
        background:${colors.bg};
        border:1.5px solid ${colors.border};
        border-radius:3px;
        overflow:hidden;
        padding:2px 3px;
        color:${colors.text};
        display:flex;
        flex-direction:column;
        justify-content:flex-start;
        gap:1px;
        font-size:10px;
        line-height:1.25;
        box-sizing:border-box;
      ">
        <div style="height:3px;background:${colors.border};margin:-2px -3px 1px;border-radius:2px 2px 0 0;"></div>
        ${lines.join('')}
      </div>`;
    }

    html += `</div>`; // mini-grid-day-col
  }

  html += `</div>`; // mini-grid-body
  html += `</div>`; // mini-grid
  return html;
}

// ============================================================
// VUES PAR ONGLET
// ============================================================

function renderVueEnseignants(seances, data) {
  const { enseignants, classes, activites, installations, lieux } = data;
  const refs = { classes, enseignants, activites, installations, lieux };

  const ensAvecSeances = enseignants.filter(e => seances.some(s => s.enseignantId === e.id));
  if (!ensAvecSeances.length) {
    return `<div class="empty-state"><div class="empty-state-icon">&#128100;</div><div class="empty-state-title">Aucun enseignant avec des séances</div></div>`;
  }

  return `<div class="vues-cards-wrap" style="display:flex;flex-wrap:wrap;gap:var(--sp-5);">` +
    ensAvecSeances.map(ens => {
      const ensSeances = seances.filter(s => s.enseignantId === ens.id);
      const totalH = totalHStr(ensSeances);
      const nom = [ens.prenom, ens.nom].filter(Boolean).join(' ');
      return `
        <div class="card vue-card" style="cursor:default;min-width:400px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--sp-3);">
            <div>
              <div style="font-weight:600;font-size:var(--fs-base);">${nom}</div>
              ${ens.ors ? `<div style="font-size:var(--fs-sm);color:var(--c-text-secondary);">ORS : ${ens.ors}h</div>` : ''}
            </div>
            <span class="badge badge-info" style="font-size:var(--fs-sm);white-space:nowrap;">${totalH} / sem.</span>
          </div>
          <div class="mini-grid-scroll" style="overflow-x:auto;">
            ${buildMiniGrid(ensSeances, refs, { showClasse: true, showInstallation: true })}
          </div>
        </div>`;
    }).join('') +
  `</div>`;
}

function renderVueClasses(seances, data) {
  const { enseignants, classes, activites, installations, lieux } = data;
  const refs = { classes, enseignants, activites, installations, lieux };

  const niveauOrdre = { '6e': 1, '5e': 2, '4e': 3, '3e': 4, '2nde': 5, '1ere': 6, 'term': 7 };
  const classesAvecSeances = classes
    .filter(c => seances.some(s => s.classeId === c.id))
    .sort((a, b) => (niveauOrdre[a.niveau] ?? 99) - (niveauOrdre[b.niveau] ?? 99) || (a.nom || '').localeCompare(b.nom || ''));

  if (!classesAvecSeances.length) {
    return `<div class="empty-state"><div class="empty-state-icon">&#127979;</div><div class="empty-state-title">Aucune classe avec des séances</div></div>`;
  }

  return `<div class="vues-cards-wrap" style="display:flex;flex-wrap:wrap;gap:var(--sp-5);">` +
    classesAvecSeances.map(cls => {
      const clsSeances = seances.filter(s => s.classeId === cls.id);
      const totalH = totalHStr(clsSeances);
      return `
        <div class="card vue-card" style="cursor:default;min-width:400px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--sp-3);">
            <div>
              <div style="font-weight:600;font-size:var(--fs-base);">${cls.nom}</div>
              ${cls.effectif ? `<div style="font-size:var(--fs-sm);color:var(--c-text-secondary);">${cls.effectif} élèves</div>` : ''}
            </div>
            <span class="badge badge-info" style="font-size:var(--fs-sm);white-space:nowrap;">${totalH} / sem.</span>
          </div>
          <div class="mini-grid-scroll" style="overflow-x:auto;">
            ${buildMiniGrid(clsSeances, refs, { showEnseignant: true, showInstallation: true })}
          </div>
        </div>`;
    }).join('') +
  `</div>`;
}

function renderVueInstallations(seances, data) {
  const { enseignants, classes, activites, installations, lieux } = data;
  const refs = { classes, enseignants, activites, installations, lieux };

  const instAvecSeances = installations.filter(i => seances.some(s => s.installationId === i.id));
  if (!instAvecSeances.length) {
    return `<div class="empty-state"><div class="empty-state-icon">&#127968;</div><div class="empty-state-title">Aucune installation utilisée</div></div>`;
  }

  return `<div class="vues-cards-wrap" style="display:flex;flex-wrap:wrap;gap:var(--sp-5);">` +
    instAvecSeances.map(inst => {
      const instSeances = seances.filter(s => s.installationId === inst.id);
      const lieu = lieux.find(l => l.id === inst.lieuId);
      const colors = getColors(inst, lieux);
      const nbClasses = new Set(instSeances.map(s => s.classeId)).size;
      return `
        <div class="card vue-card" style="cursor:default;min-width:400px;border-top:3px solid ${colors.border};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--sp-3);">
            <div>
              <div style="font-weight:600;font-size:var(--fs-base);">${inst.nom}</div>
              <div style="font-size:var(--fs-sm);color:var(--c-text-secondary);">${lieu?.nom || ''} · ${nbClasses} classe${nbClasses > 1 ? 's' : ''}</div>
            </div>
            <span class="badge badge-info" style="font-size:var(--fs-sm);white-space:nowrap;">${instSeances.length} séance${instSeances.length > 1 ? 's' : ''}/sem.</span>
          </div>
          <div class="mini-grid-scroll" style="overflow-x:auto;">
            ${buildMiniGrid(instSeances, refs, { showClasse: true, showEnseignant: true })}
          </div>
        </div>`;
    }).join('') +
  `</div>`;
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

export async function renderVues(container) {
  const [seances, enseignants, classes, activites, installations, lieux, periodes] = await Promise.all([
    db.seances.toArray(),
    db.enseignants.toArray(),
    db.classes.toArray(),
    db.activites.toArray(),
    db.installations.toArray(),
    db.lieux.toArray(),
    db.periodes.toArray(),
  ]);

  const data = { seances, enseignants, classes, activites, installations, lieux, periodes };
  const periodesPrincipales = periodes.filter(p => !p.parentId).sort((a, b) => (a.ordre ?? a.id) - (b.ordre ?? b.id));

  container.innerHTML = `
    <div style="max-width:1400px;margin:0 auto;">

      <!-- Contrôles écran (masqués à l'impression) -->
      <div class="vues-toolbar" style="display:flex;gap:var(--sp-4);margin-bottom:var(--sp-5);align-items:center;flex-wrap:wrap;">
        <!-- Tabs -->
        <div style="display:flex;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);padding:2px;gap:2px;">
          <button class="vue-tab-btn ${currentTab==='enseignant'?'vue-tab-active':''}" data-tab="enseignant"
            style="padding:var(--sp-2) var(--sp-4);border:none;border-radius:calc(var(--radius) - 2px);cursor:pointer;font-size:var(--fs-sm);font-weight:500;background:${currentTab==='enseignant'?'white':'transparent'};color:${currentTab==='enseignant'?'var(--c-text)':'var(--c-text-secondary)'};box-shadow:${currentTab==='enseignant'?'0 1px 3px rgba(0,0,0,.1)':''};transition:all .15s;">
            &#128100; Par enseignant
          </button>
          <button class="vue-tab-btn ${currentTab==='classe'?'vue-tab-active':''}" data-tab="classe"
            style="padding:var(--sp-2) var(--sp-4);border:none;border-radius:calc(var(--radius) - 2px);cursor:pointer;font-size:var(--fs-sm);font-weight:500;background:${currentTab==='classe'?'white':'transparent'};color:${currentTab==='classe'?'var(--c-text)':'var(--c-text-secondary)'};box-shadow:${currentTab==='classe'?'0 1px 3px rgba(0,0,0,.1)':''};transition:all .15s;">
            &#127979; Par classe
          </button>
          <button class="vue-tab-btn ${currentTab==='installation'?'vue-tab-active':''}" data-tab="installation"
            style="padding:var(--sp-2) var(--sp-4);border:none;border-radius:calc(var(--radius) - 2px);cursor:pointer;font-size:var(--fs-sm);font-weight:500;background:${currentTab==='installation'?'white':'transparent'};color:${currentTab==='installation'?'var(--c-text)':'var(--c-text-secondary)'};box-shadow:${currentTab==='installation'?'0 1px 3px rgba(0,0,0,.1)':''};transition:all .15s;">
            &#127968; Par installation
          </button>
        </div>

        <!-- Filtre période -->
        <select class="form-select" id="vue-periode" style="width:auto;min-width:180px;">
          <option value="">Toutes les périodes</option>
          ${periodesPrincipales.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
        </select>

        <!-- Bouton Imprimer -->
        <button class="btn btn-secondary btn-print-trigger" onclick="window.print()"
          style="margin-left:auto;display:flex;align-items:center;gap:var(--sp-2);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimer
        </button>
      </div>

      <!-- Header d'impression (masqué à l'écran, visible via @media print) -->
      <div class="vues-print-header" style="display:none;">
        <div class="print-header-left">
          <div class="print-header-title" id="vues-print-title">Vues individuelles</div>
          <div class="print-header-subtitle" id="vues-print-subtitle"></div>
        </div>
        <div class="print-header-right">
          Imprimé le ${new Date().toLocaleDateString('fr-FR')}<br>EDT EPS
        </div>
      </div>

      <div id="vue-content"></div>
    </div>
  `;

  function getSeancesFiltrees() {
    const val = container.querySelector('#vue-periode')?.value;
    if (!val) return seances;
    return seances.filter(s => s.periodeId === parseInt(val));
  }

  const TAB_LABELS = { enseignant: 'Par enseignant', classe: 'Par classe', installation: 'Par installation' };

  function updatePrintHeader() {
    const titleEl = container.querySelector('#vues-print-title');
    const subtitleEl = container.querySelector('#vues-print-subtitle');
    if (titleEl) titleEl.textContent = `EDT EPS — ${TAB_LABELS[currentTab] || currentTab}`;
    if (subtitleEl) {
      const val = container.querySelector('#vue-periode')?.value;
      subtitleEl.textContent = val
        ? (periodesPrincipales.find(p => p.id === parseInt(val))?.nom || '')
        : 'Toutes les périodes';
    }
  }

  function renderContent() {
    const sf = getSeancesFiltrees();
    const content = container.querySelector('#vue-content');
    if (!content) return;
    if (currentTab === 'enseignant')    content.innerHTML = renderVueEnseignants(sf, data);
    else if (currentTab === 'classe')   content.innerHTML = renderVueClasses(sf, data);
    else                                content.innerHTML = renderVueInstallations(sf, data);
    updatePrintHeader();
  }

  container.querySelectorAll('.vue-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      // Re-render complet pour mettre à jour l'état des boutons
      renderVues(container);
    });
  });

  container.querySelector('#vue-periode')?.addEventListener('change', renderContent);

  renderContent();
}
