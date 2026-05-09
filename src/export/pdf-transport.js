/**
 * Export PDF Transport — paysage A4
 * Page 1 : COLLÈGE  |  Page 2 : LYCÉE  (si les deux niveaux existent)
 *
 * Colonnes : JOURS | DATES | LIEUX | Départ MSJ | Retour depuis l'install sport
 *            | CLASSES | EFFECTIF | PROFS | Nb rotations
 *
 * Toutes les dates de la période (hors vacances) listées dans la colonne DATES.
 * Hauteurs de lignes adaptées pour tenir sur une seule page A4 si possible.
 */

import { jsPDF } from 'jspdf';
import db, { getConfig } from '../db/schema.js';
import { saveExportFile } from '../utils/filesystem.js';
import { toast } from '../components/toast.js';
import { getCalendrierExclusions } from '../utils/dates.js';

// ============================================================
// CONSTANTES
// ============================================================

const JOURS_ORDRE  = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
const JOURS_LABELS = {
  lundi: 'LUNDI', mardi: 'MARDI', mercredi: 'MERCREDI',
  jeudi: 'JEUDI', vendredi: 'VENDREDI',
};

// Niveaux par cycle
const NIVEAUX_COLLEGE = new Set(['6e', '5e', '4e', '3e']);
const NIVEAUX_LYCEE   = new Set(['2nde', '1ere', 'term']);

// Couleurs
const C_HDR_BG   = [50,  50,  50];   // en-tête colonnes (fond sombre)
const C_HDR_FG   = [255, 255, 255];  // texte en-tête
const C_TITLE_BG = [220, 220, 220];  // fond bandeau titre
const C_JOUR_BG  = [200, 200, 200];  // cellule JOURS
const C_WHITE    = [255, 255, 255];
const C_BORDER   = [130, 130, 130];

// Dimensions A4 paysage (mm)
const PW = 297, PH = 210;
const ML = 8, MR = 8, MT = 16, MB = 8;

// Colonnes — total = PW - ML - MR = 281 mm
const COLS = [
  { key: 'jour',     label: ['JOURS'],                           w: 22  },
  { key: 'dates',    label: ['DATES'],                           w: 75  },
  { key: 'lieu',     label: ['LIEUX'],                           w: 45  },
  { key: 'depart',   label: ['Départ', 'MSJ'],                   w: 20  },
  { key: 'retour',   label: ['Retour depuis', "l'install sport"], w: 24  },
  { key: 'classe',   label: ['CLASSES'],                         w: 20  },
  { key: 'effectif', label: ['EFFECTIF', 'CLASSE +', 'enseignant'], w: 22 },
  { key: 'prof',     label: ['PROFS'],                           w: 30  },
  { key: 'nbRot',    label: ['Nb', 'rotations'],                 w: 23  },
];
// Vérification : 22+75+45+20+24+20+22+30+23 = 281

// ============================================================
// HELPERS
// ============================================================

function hToMin(h) {
  if (!h) return 0;
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + (mm || 0);
}

function minToHLabel(m) {
  if (m < 0) m += 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${hh}H` : `${hh}H${String(mm).padStart(2, '0')}`;
}

function isCollege(niv) { return NIVEAUX_COLLEGE.has(niv); }
function isLycee(niv)   { return NIVEAUX_LYCEE.has(niv);   }

/**
 * Génère les dates (format YYYY-MM-DD) pour un jour de semaine donné
 * entre dateDebut et dateFin, en excluant les vacances scolaires.
 * Distinct de genererDatesJour qui retourne DD/MM — ici on garde ISO
 * pour pouvoir comparer avec les exclusions transport.
 */
function genDatesISO(jour, dateDebut, dateFin, vacances) {
  const JI = { dimanche:0, lundi:1, mardi:2, mercredi:3, jeudi:4, vendredi:5, samedi:6 };
  const ji = JI[(jour || '').toLowerCase()];
  if (ji === undefined) return [];

  const cur = new Date(dateDebut);
  while (cur.getDay() !== ji) cur.setDate(cur.getDate() + 1);

  const result = [];
  while (cur <= dateFin) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
    const exclu = (vacances || []).some(v => iso >= v.debut && iso <= v.fin);
    if (!exclu) result.push(iso);
    cur.setDate(cur.getDate() + 7);
  }
  return result;
}

/** "YYYY-MM-DD" → "DD/MM" */
function isoToDDMM(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** "YYYY-MM-DD" → "Lundi 15/01/2026" */
function formatSummaryDate(iso) {
  const d    = new Date(iso + 'T00:00:00');
  const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  return `${days[d.getDay()]} ${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Dessine du texte centré horizontalement ET verticalement dans un rectangle.
 * lines peut être un string ou un tableau de strings déjà splitté.
 */
function drawCellText(doc, lines, x, y, w, h, fs, bold = false, color = C_HDR_BG) {
  doc.setFontSize(fs);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(...color);

  if (!Array.isArray(lines)) {
    lines = doc.splitTextToSize(String(lines), w - 1.5);
  }

  const lh = fs * 0.42;            // hauteur inter-ligne empirique (mm)
  const blockH = lines.length * lh;
  // Baseline de la première ligne, centrée verticalement
  const startY = y + (h - blockH) / 2 + lh * 0.78;

  for (let i = 0; i < lines.length; i++) {
    const tw = doc.getTextWidth(lines[i]);
    doc.text(lines[i], x + (w - tw) / 2, startY + i * lh);
  }
  doc.setTextColor(0, 0, 0);
}

/** Rectangle rempli + bordure */
function drawRect(doc, x, y, w, h, fill) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'FD');
}

// ============================================================
// CONSTRUCTION DES DONNÉES
// ============================================================

/**
 * @param {string|number|null} periodeId
 * @param {Array}              exclusions  — [{id, date:"YYYY-MM-DD", raison, classesIds:"all"|[id,...]}]
 * @returns {{ rows, etab, annee, periodes, appliedExcl }}
 *   appliedExcl : [{date, raison, classesIds, classe}] — exclusions ayant supprimé ≥1 date
 */
async function buildData(periodeId, exclusions = []) {
  const [seances, insts, lieux, classes, enseignants, periodes] = await Promise.all([
    db.seances.toArray(),
    db.installations.toArray(),
    db.lieux.toArray(),
    db.classes.toArray(),
    db.enseignants.toArray(),
    db.periodes.toArray(),
  ]);

  const etab  = await getConfig('etablissementNom')  || '';
  const annee = await getConfig('anneeScolaire')      || '2025-2026';
  const zone  = await getConfig('etablissementZone')  || 'B';
  const excl  = await getCalendrierExclusions(zone, annee);

  let src = seances;
  if (periodeId) src = src.filter(s => s.periodeId === parseInt(periodeId));

  const rows       = [];
  const appliedExcl = []; // exclusions transport effectivement appliquées

  for (const s of src) {
    const inst = insts.find(i => i.id === s.installationId);
    const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;
    if (!lieu?.necessiteBus) continue;

    const cls = classes.find(c => c.id === s.classeId);
    const ens = enseignants.find(e => e.id === s.enseignantId);
    const per = periodes.find(p => p.id === s.periodeId);

    // 1. Dates ISO hors vacances scolaires
    let allISO = [];
    if (per?.dateDebut && per?.dateFin) {
      allISO = genDatesISO(s.jour, new Date(per.dateDebut), new Date(per.dateFin), excl);
    }

    // 2. Appliquer les exclusions transport propres à cette classe
    const clsId = cls?.id;
    const relevant = exclusions.filter(ex =>
      ex.classesIds === 'all' ||
      (Array.isArray(ex.classesIds) && ex.classesIds.includes(clsId))
    );

    const filteredISO = allISO.filter(iso => {
      const hit = relevant.find(ex => ex.date === iso);
      if (hit) {
        appliedExcl.push({ date: iso, raison: hit.raison || '', classesIds: hit.classesIds, classe: cls?.nom || '' });
        return false;
      }
      return true;
    });

    const dates = filteredISO.map(isoToDDMM);

    const sm = hToMin(s.heureDebut);
    const em = hToMin(s.heureFin);

    let profLabel = '';
    if (ens) {
      const ini = ens.prenom ? ens.prenom[0].toUpperCase() + '.' : '';
      profLabel  = ini + ens.nom.toUpperCase();
    }

    rows.push({
      jour:      (s.jour || '').toLowerCase(),
      lieu:      lieu?.nom?.toUpperCase() || '',
      depart:    minToHLabel(sm + 15),
      retour:    minToHLabel(em - 15),
      departMin: sm + 15,
      classe:    cls?.nom || '',
      niveau:    cls?.niveau || '',
      effectif:  cls?.effectif != null ? String(cls.effectif) : '',
      prof:      profLabel,
      dates,
      nbRot:     dates.length,
      periodeNom: per?.nom || '',
    });
  }

  // Tri : jour calendaire → heure départ (numérique) → lieu (alpha)
  rows.sort((a, b) => {
    const jo = JOURS_ORDRE.indexOf(a.jour) - JOURS_ORDRE.indexOf(b.jour);
    if (jo !== 0) return jo;
    const hd = a.departMin - b.departMin;
    if (hd !== 0) return hd;
    return a.lieu.localeCompare(b.lieu, 'fr');
  });

  return { rows, etab, annee, periodes, appliedExcl };
}

// ============================================================
// DESSIN D'UNE PAGE
// ============================================================

/**
 * @param {jsPDF}  doc
 * @param {Array}  rows    — lignes filtrées pour ce niveau
 * @param {object} opts    — { titre, supraG, supraD }
 */
function drawTransportPage(doc, rows, { titre, supraG, supraD }) {
  const usableW = PW - ML - MR;   // 281 mm

  // ── Supra-header (hors tableau) ────────────────────────────
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(supraG, ML, MT - 4);
  doc.text(supraD, PW - MR, MT - 4, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  let y = MT;

  // ── Titre du tableau ───────────────────────────────────────
  const TITLE_H = 7;
  drawRect(doc, ML, y, usableW, TITLE_H, C_TITLE_BG);
  drawCellText(doc, [titre], ML, y, usableW, TITLE_H, 9, true, [0, 0, 0]);
  y += TITLE_H;

  // ── En-têtes colonnes ──────────────────────────────────────
  const HDR_H = 11;
  let xc = ML;
  for (const col of COLS) {
    drawRect(doc, xc, y, col.w, HDR_H, C_HDR_BG);
    drawCellText(doc, col.label, xc, y, col.w, HDR_H, 6.5, true, C_HDR_FG);
    xc += col.w;
  }
  y += HDR_H;

  // ── Calcul adaptatif des hauteurs ─────────────────────────
  const DATES_W   = COLS[1].w;       // largeur colonne dates
  const availH    = PH - MB - y;     // hauteur disponible pour les données
  const MIN_ROW_H = 5.5;             // hauteur minimale par ligne (mm)
  const MAX_ROW_H = 18;              // hauteur maximale par ligne (mm)

  // Grouper les lignes par jour
  const groups = [];
  for (const jour of JOURS_ORDRE) {
    const jRows = rows.filter(r => r.jour === jour);
    if (jRows.length) groups.push({ jour, rows: jRows });
  }

  if (groups.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Aucune séance de transport pour ce niveau.', ML + 4, y + 10);
    return;
  }

  /**
   * Estime le nombre de lignes nécessaires pour afficher les dates
   * dans la colonne DATES à la taille de police donnée.
   */
  function estimateDateLines(row, fs) {
    const str  = row.dates.join(', ');
    if (!str) return 1;
    // Largeur en mm par caractère à cette taille de police
    // Empirique : fs (pt) → ~0.51 mm/char en Helvetica
    const charsPerLine = Math.floor((DATES_W - 2) / (fs * 0.51));
    return Math.max(1, Math.ceil(str.length / charsPerLine));
  }

  /**
   * Calcule la hauteur naturelle d'une ligne à une taille de police donnée.
   * Minimum imposé.
   */
  function naturalRowH(row, fs) {
    const nLines = estimateDateLines(row, fs);
    const lh     = fs * 0.42;
    return Math.max(MIN_ROW_H, nLines * lh + 2.5);
  }

  // Essayer d'abord avec fs=6.5, puis 6, puis 5.5 pour tenir en 1 page
  let fs = 6.5;
  let totalH;
  for (const tryFs of [6.5, 6.0, 5.5]) {
    fs = tryFs;
    totalH = groups.reduce((sum, g) =>
      sum + g.rows.reduce((s, r) => s + naturalRowH(r, fs), 0), 0
    );
    if (totalH <= availH) break;
  }

  // Si ça déborde encore, on scale proportionnellement (plancher MIN_ROW_H)
  const scale = totalH > availH ? availH / totalH : 1;

  // ── Dessin des groupes ─────────────────────────────────────
  for (const { jour, rows: gRows } of groups) {
    // Hauteurs finales de chaque ligne du groupe
    const rowHs  = gRows.map(r => Math.max(MIN_ROW_H, Math.min(MAX_ROW_H, naturalRowH(r, fs) * scale)));
    const groupH = rowHs.reduce((s, h) => s + h, 0);

    // Cellule JOURS (fusionnée sur tout le groupe)
    drawRect(doc, ML, y, COLS[0].w, groupH, C_JOUR_BG);
    drawCellText(doc, [JOURS_LABELS[jour]], ML, y, COLS[0].w, groupH, 8, true, [0, 0, 0]);

    let yr = y;

    for (let ri = 0; ri < gRows.length; ri++) {
      const row = gRows[ri];
      const rh  = rowHs[ri];
      let xr    = ML + COLS[0].w;

      // ── DATES ─────────────────────────────────────────────
      const datesStr = row.dates.join(', ');
      drawRect(doc, xr, yr, COLS[1].w, rh, C_WHITE);
      doc.setFontSize(fs);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const dLines = doc.splitTextToSize(datesStr, COLS[1].w - 1.5);
      const dlh    = fs * 0.42;
      const dbH    = dLines.length * dlh;
      const dY0    = yr + (rh - dbH) / 2 + dlh * 0.78;
      for (let di = 0; di < dLines.length; di++) {
        const tw = doc.getTextWidth(dLines[di]);
        doc.text(dLines[di], xr + (COLS[1].w - tw) / 2, dY0 + di * dlh);
      }
      xr += COLS[1].w;

      // ── LIEUX ─────────────────────────────────────────────
      drawRect(doc, xr, yr, COLS[2].w, rh, C_WHITE);
      drawCellText(doc, [row.lieu], xr, yr, COLS[2].w, rh, 7.5, true, [0, 0, 0]);
      xr += COLS[2].w;

      // ── DÉPART MSJ ────────────────────────────────────────
      drawRect(doc, xr, yr, COLS[3].w, rh, C_WHITE);
      drawCellText(doc, [row.depart], xr, yr, COLS[3].w, rh, 8.5, false, [0, 0, 0]);
      xr += COLS[3].w;

      // ── RETOUR ────────────────────────────────────────────
      drawRect(doc, xr, yr, COLS[4].w, rh, C_WHITE);
      drawCellText(doc, [row.retour], xr, yr, COLS[4].w, rh, 8.5, false, [0, 0, 0]);
      xr += COLS[4].w;

      // ── CLASSES ───────────────────────────────────────────
      drawRect(doc, xr, yr, COLS[5].w, rh, C_WHITE);
      drawCellText(doc, [row.classe], xr, yr, COLS[5].w, rh, 8, false, [0, 0, 0]);
      xr += COLS[5].w;

      // ── EFFECTIF ──────────────────────────────────────────
      drawRect(doc, xr, yr, COLS[6].w, rh, C_WHITE);
      drawCellText(doc, [row.effectif], xr, yr, COLS[6].w, rh, 8, false, [0, 0, 0]);
      xr += COLS[6].w;

      // ── PROFS ─────────────────────────────────────────────
      drawRect(doc, xr, yr, COLS[7].w, rh, C_WHITE);
      drawCellText(doc, [row.prof], xr, yr, COLS[7].w, rh, 8, false, [0, 0, 0]);
      xr += COLS[7].w;

      // ── NB ROTATIONS ──────────────────────────────────────
      drawRect(doc, xr, yr, COLS[8].w, rh, C_WHITE);
      drawCellText(doc, [String(row.nbRot)], xr, yr, COLS[8].w, rh, 9, true, [0, 0, 0]);

      yr += rh;
    }

    y += groupH;
  }
}

// ============================================================
// PAGE RÉCAPITULATIF DES EXCLUSIONS
// ============================================================

/**
 * Dessine une page récapitulative des dates exclues du transport.
 * @param {jsPDF} doc
 * @param {Array} appliedExcl  — [{date, raison, classesIds, classe}]
 * @param {string} etab
 * @param {string} periodeNom
 * @param {string} annee
 */
function drawSummaryPage(doc, appliedExcl, etab, periodeNom, annee) {
  const usableW = PW - ML - MR;

  // Regrouper par date
  const byDate = {};
  for (const e of appliedExcl) {
    if (!byDate[e.date]) {
      byDate[e.date] = { date: e.date, raison: e.raison, isAll: false, classes: new Set() };
    }
    if (e.classesIds === 'all') {
      byDate[e.date].isAll = true;
    } else {
      byDate[e.date].classes.add(e.classe);
    }
  }

  const summaryRows = Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({
      dateLabel:    formatSummaryDate(r.date),
      raison:       r.raison,
      classesLabel: r.isAll ? 'Toutes les classes' : [...r.classes].sort((a, b) => a.localeCompare(b, 'fr')).join(', '),
    }));

  let y = MT;

  // Supra-header
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`${etab.toUpperCase()} — ${periodeNom.toUpperCase()} — ANNEE SCOLAIRE ${annee}`, ML, y - 4);
  doc.setTextColor(0, 0, 0);

  // Titre
  const TITLE_H = 8;
  drawRect(doc, ML, y, usableW, TITLE_H, C_TITLE_BG);
  drawCellText(doc, ['Récapitulatif des dates exclues — Export Transport'], ML, y, usableW, TITLE_H, 10, true, [0, 0, 0]);
  y += TITLE_H;

  // Sous-titre
  const SUBTITLE_H = 6;
  drawRect(doc, ML, y, usableW, SUBTITLE_H, [245, 245, 245]);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(80, 80, 80);
  const sub = `Ces dates ont été retirées du planning transport car exclues manuellement (journées pédagogiques, voyages scolaires, examens...).`;
  const subLines = doc.splitTextToSize(sub, usableW - 4);
  doc.text(subLines[0], ML + 2, y + SUBTITLE_H / 2 + 1.5);
  doc.setTextColor(0, 0, 0);
  y += SUBTITLE_H;

  // En-têtes colonnes
  const COLS_SUMM = [
    { label: 'DATE', w: 60 },
    { label: 'RAISON', w: 121 },
    { label: 'CLASSES CONCERNÉES', w: 100 },
  ];
  const HDR_H = 9;
  let xc = ML;
  for (const col of COLS_SUMM) {
    drawRect(doc, xc, y, col.w, HDR_H, C_HDR_BG);
    drawCellText(doc, [col.label], xc, y, col.w, HDR_H, 7, true, C_HDR_FG);
    xc += col.w;
  }
  y += HDR_H;

  // Lignes de données
  const ROW_H = 8;
  for (let i = 0; i < summaryRows.length; i++) {
    const row  = summaryRows[i];
    const fill = i % 2 === 0 ? C_WHITE : [248, 248, 248];
    let xr = ML;

    drawRect(doc, xr, y, COLS_SUMM[0].w, ROW_H, fill);
    drawCellText(doc, [row.dateLabel], xr, y, COLS_SUMM[0].w, ROW_H, 7.5, true, [0, 0, 0]);
    xr += COLS_SUMM[0].w;

    drawRect(doc, xr, y, COLS_SUMM[1].w, ROW_H, fill);
    drawCellText(doc, [row.raison], xr, y, COLS_SUMM[1].w, ROW_H, 7.5, false, [0, 0, 0]);
    xr += COLS_SUMM[1].w;

    drawRect(doc, xr, y, COLS_SUMM[2].w, ROW_H, fill);
    drawCellText(doc, [row.classesLabel], xr, y, COLS_SUMM[2].w, ROW_H, 7, false, [0, 0, 0]);

    y += ROW_H;
    if (y > PH - MB - ROW_H) {
      // Sécurité : nouvelle page si débordement
      doc.addPage();
      y = MT;
    }
  }

  // Pied de page : total
  y += 4;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total : ${summaryRows.length} date(s) exclue(s)`, ML, y);
}

// ============================================================
// EXPORT PRINCIPAL
// ============================================================

/**
 * Génère le PDF transport (1 page collège + 1 page lycée + 1 page récap exclusions).
 * @param {string|number|null} periodeId  — null = toutes les périodes
 * @param {Array}              exclusions — [{id, date, raison, classesIds}]
 */
export async function exportPdfTransport(periodeId, exclusions = []) {
  try {
    const { rows, etab, annee, periodes, appliedExcl } = await buildData(periodeId, exclusions);

    if (rows.length === 0) {
      toast.warning('Aucune séance nécessitant un transport');
      return;
    }

    const per     = periodeId ? periodes.find(p => p.id === parseInt(periodeId)) : null;
    const perNom  = per?.nom || (rows[0]?.periodeNom || 'Annuel');
    const etabType = (await getConfig('etablissementType')) || 'mixte';

    // Plage de dates pour le supra-header
    let dateRange = annee;
    if (per?.dateDebut && per?.dateFin) {
      const d1 = new Date(per.dateDebut);
      const d2 = new Date(per.dateFin);
      const fmt = d =>
        `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      dateRange = `DU ${fmt(d1)} au ${fmt(d2)}`;
    }

    const college = rows.filter(r => isCollege(r.niveau));
    const lycee   = rows.filter(r => isLycee(r.niveau));

    // Afficher collège si établissement est collège ou mixte (et qu'il y a des données)
    const showCollege = college.length > 0 && ['college', 'mixte'].includes(etabType);
    // Afficher lycée si établissement est lycée ou mixte (et qu'il y a des données)
    const showLycee   = lycee.length   > 0 && ['lycee',   'mixte'].includes(etabType);

    if (!showCollege && !showLycee) {
      toast.warning('Aucune séance transport trouvée pour les niveaux configurés');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let firstPage = true;

    // ── Page COLLÈGE ──────────────────────────────────────────
    if (showCollege) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      drawTransportPage(doc, college, {
        titre:  `Transports COLLEGE ${etab} ${perNom} - ANNEE SCOLAIRE ${annee}`,
        supraG: `TRANSPORTS COLLEGE ${etab.toUpperCase()} - ${perNom.toUpperCase()}`,
        supraD: dateRange,
      });
    }

    // ── Page LYCÉE ────────────────────────────────────────────
    if (showLycee) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      drawTransportPage(doc, lycee, {
        titre:  `Transports lycée ${etab} ${perNom} - ANNEE SCOLAIRE ${annee}`,
        supraG: `TRANSPORTS LYCEE ${etab.toUpperCase()} - ${perNom.toUpperCase()}`,
        supraD: dateRange,
      });
    }

    // ── Page récapitulatif exclusions (si des dates ont été exclues) ──
    if (appliedExcl.length > 0) {
      doc.addPage();
      drawSummaryPage(doc, appliedExcl, etab, perNom, annee);
    }

    const blob  = doc.output('blob');
    const fname = `Transport_PDF_${etab}_${perNom}_${new Date().toISOString().split('T')[0]}.pdf`
      .replace(/\s+/g, '_');
    await saveExportFile(blob, fname);

    const msg = appliedExcl.length > 0
      ? `PDF Transport sauvegardé (${[...new Set(appliedExcl.map(e => e.date))].length} date(s) exclue(s))`
      : 'PDF Transport sauvegardé';
    toast.success(msg);

  } catch (err) {
    console.error('Erreur export PDF Transport:', err);
    toast.error('Erreur export PDF Transport : ' + err.message);
  }
}
