/**
 * Export PDF — EDT Équipe (paysage A4) + Fiches individuelles (portrait A4)
 *
 * Layout inspiré du modèle Excel :
 *   LIGNES  = Jour > Enseignant > Période
 *   COLONNES = créneaux horaires (largeur proportionnelle à la durée)
 *   Couleurs par installation (même palette que EDT/Programmation)
 */
import { jsPDF } from 'jspdf';
import db, { getConfig } from '../db/schema.js';
import { saveExportFile } from '../utils/filesystem.js';
import { toast } from '../components/toast.js';
import { getInstallationColors } from '../utils/colors.js';
import { slugify } from '../utils/helpers.js';

// ============================================================
// CONSTANTES
// ============================================================

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
const JOURS_LABELS = {
  lundi: 'LUNDI', mardi: 'MARDI', mercredi: 'MERCREDI', jeudi: 'JEUDI', vendredi: 'VENDREDI',
};

const HEADER_BG   = [28, 48, 88];   // bandeau titre
const COL_HDR_BG  = [55, 75, 115];  // en-tête colonnes horaires
const JOUR_BG     = [228, 236, 252]; // cellule jour (fond)
const JOUR_FG     = [28, 48, 88];   // texte jour
const ENS_BG      = [242, 246, 255]; // cellule enseignant
const PER_BG      = [248, 250, 255]; // cellule période
const ROW_EVEN_BG = [252, 253, 255];
const ROW_ODD_BG  = [245, 248, 254];
const GRID_LINE   = [200, 207, 220];
const JOUR_LINE   = [145, 160, 195];

// ============================================================
// UTILITAIRES
// ============================================================

function hexToRgb(hex) {
  if (!hex || hex[0] !== '#') return [150, 150, 155];
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function heureToMin(h) {
  if (!h) return 0;
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + (mm || 0);
}

function minToLabel(m) {
  const h  = Math.floor(m / 60);
  const mn = m % 60;
  return mn === 0 ? `${h}h` : `${h}h${String(mn).padStart(2, '0')}`;
}

// Couleur basée sur le lieu (comme la grille EDT), pas sur l'installation
function instColors(installation, lieux) {
  if (!installation) return getInstallationColors('default');
  const lieu = lieux?.find(l => l.id === installation.lieuId);
  const slug = lieu ? slugify(lieu.nom) : slugify(installation.nom);
  return getInstallationColors(slug);
}

// Déduplique par creneauClasseId pour obtenir les heures d'une semaine type
function seancesHebdo(seances) {
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

function totalHebdoStr(seances) {
  const uniq = seancesHebdo(seances);
  const totalMin = uniq.reduce(
    (acc, s) => acc + heureToMin(s.heureFin) - heureToMin(s.heureDebut), 0
  );
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

// ============================================================
// AXE TEMPS — construction des colonnes proportionnelles
// ============================================================

/**
 * Retourne la liste triée et dédupliquée de toutes les bornes horaires (en minutes)
 * issues des séances. Ex : [480, 510, 540, 600, 720, 840]
 */
function buildTimeAxis(seances) {
  const times = new Set();
  for (const s of seances) {
    if (s.heureDebut) times.add(heureToMin(s.heureDebut));
    if (s.heureFin)   times.add(heureToMin(s.heureFin));
  }
  const sorted = [...times].sort((a, b) => a - b);
  if (sorted.length < 2) return sorted;
  // Remplir tous les demi-créneaux (30 min) entre min et max
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  for (let t = min; t <= max; t += 30) times.add(t);
  return [...times].sort((a, b) => a - b);
}

/**
 * Transforme l'axe temps en coordonnées X (en mm) à partir de startX.
 * Les largeurs sont proportionnelles à la durée entre chaque borne.
 * @returns {number[]} xCoords — une valeur par borne de timeAxis
 */
function buildXCoords(timeAxis, startX, availableWidth) {
  if (timeAxis.length < 2) return timeAxis.map((_, i) => startX + i * availableWidth);
  const total = timeAxis[timeAxis.length - 1] - timeAxis[0];
  return timeAxis.map(t => startX + ((t - timeAxis[0]) / total) * availableWidth);
}

// ============================================================
// CHARGEMENT DES DONNÉES
// ============================================================

async function loadData() {
  const [seances, enseignants, classes, activites, installations, lieux, periodes] = await Promise.all([
    db.seances.toArray(),
    db.enseignants.toArray(),
    db.classes.toArray(),
    db.activites.toArray(),
    db.installations.toArray(),
    db.lieux.toArray(),
    db.periodes.toArray(),
  ]);
  const etablissement = await getConfig('etablissementNom') || 'Établissement';
  const anneeScolaire = await getConfig('anneeScolaire') || '2025-2026';
  return { seances, enseignants, classes, activites, installations, lieux, periodes, etablissement, anneeScolaire };
}

// ============================================================
// CONSTRUCTION DES LIGNES DE GRILLE
// ============================================================

/**
 * Construit le tableau de lignes pour la grille.
 * Chaque ligne = { jour, ens, per, seances[] }
 * Ordre : Jour (LUNDI→VEN) > Enseignant (ordre DB) > Période (ordre croissant)
 */
function buildRows(seances, enseignants, periodes, periodeId) {
  const targetPeriodeIds = new Set(periodes.map(p => p.id));
  const rows = [];

  for (const jour of JOURS) {
    const jourSeances = seances.filter(s => s.jour === jour);
    if (!jourSeances.length) continue;

    const ensIds = [...new Set(jourSeances.map(s => s.enseignantId))]
      .sort((a, b) => {
        const ia = enseignants.findIndex(e => e.id === a);
        const ib = enseignants.findIndex(e => e.id === b);
        return ia - ib;
      });

    for (const ensId of ensIds) {
      const ensSeances = jourSeances.filter(s => s.enseignantId === ensId);
      const ens = enseignants.find(e => e.id === ensId);

      const perIds = [...new Set(ensSeances.map(s => s.periodeId))]
        .filter(pid => targetPeriodeIds.has(pid))
        .sort((a, b) => {
          const pa = periodes.find(p => p.id === a);
          const pb = periodes.find(p => p.id === b);
          return (pa?.ordre ?? pa?.id ?? a) - (pb?.ordre ?? pb?.id ?? b);
        });

      for (const pId of perIds) {
        const perSeances = ensSeances.filter(s => s.periodeId === pId);
        if (!perSeances.length) continue;
        const per = periodes.find(p => p.id === pId);
        rows.push({ jour, ens, per, seances: perSeances });
      }
    }
  }
  return rows;
}

// ============================================================
// DESSIN D'UN BLOC SÉANCE
// ============================================================

// showTeacher = true → affiche le nom de l'enseignant à la place de la classe (fiches par classe)
function drawBloc(doc, x, y, w, h, seance, refs, showTeacher = false) {
  const { classes, enseignants, activites, installations, lieux } = refs;
  if (w < 1) return;

  const inst = installations.find(i => i.id === seance.installationId);
  const cls  = classes.find(c => c.id === seance.classeId);
  const ens  = enseignants.find(e => e.id === seance.enseignantId);
  const act  = activites.find(a => a.id === seance.activiteId);
  const colors = instColors(inst, lieux);

  const bgRgb     = hexToRgb(colors.bg);
  const borderRgb = hexToRgb(colors.border);
  const textRgb   = hexToRgb(colors.text);

  doc.setFillColor(...bgRgb);
  doc.rect(x, y, w, h, 'F');

  const bandH = Math.min(1.5, h * 0.3);
  doc.setFillColor(...borderRgb);
  doc.rect(x, y, w, bandH, 'F');

  const pad = 1;
  const maxW = w - 2 * pad;

  const primaryLabel = showTeacher
    ? (ens ? [ens.prenom, ens.nom].filter(Boolean).join(' ') : '')
    : (cls?.nom || '');

  if (h < 7) {
    const actName = act ? (act.nom.length > 14 ? act.nom.substring(0, 13) + '…' : act.nom) : '';
    const label = primaryLabel && actName ? `${primaryLabel} — ${actName}` : primaryLabel || actName;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...textRgb);
    doc.text(label, x + pad, y + bandH + (h - bandH) / 2 + 1, { maxWidth: maxW });
  } else {
    let textY = y + bandH + 2.2;
    if (primaryLabel) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...textRgb);
      doc.text(primaryLabel, x + pad, textY, { maxWidth: maxW });
      textY += 2.8;
    }
    if (act) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.2);
      doc.setTextColor(...textRgb);
      const nomAct = act.nom.length > 18 ? act.nom.substring(0, 16) + '…' : act.nom;
      doc.text(nomAct, x + pad, textY, { maxWidth: maxW });
      textY += 2.4;
    }
    if (inst && h >= 11) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5);
      doc.setTextColor(...hexToRgb(colors.border));
      doc.text(inst.nom.substring(0, 14), x + pad, textY, { maxWidth: maxW });
    }
  }

  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h, 'S');
}

// ============================================================
// DESSIN DE LA GRILLE (EN-TÊTES + LIGNES + BLOCS)
// ============================================================

/**
 * Dessine la grille complète sur la page courante.
 * @returns {number} Y du bas de la grille
 */
function drawGrid(doc, {
  gX, gY,                     // origine de la grille
  jourColW, ensColW, perColW, // largeurs colonnes fixes
  timeAxis, xCoords,          // axe temps
  rows, refs,
  rowH, headerH,
  showEnsCol,                 // false pour fiches individuelles
  showTeacher = false,        // true pour fiches par classe
}) {
  const gridW = (showEnsCol
    ? jourColW + ensColW + perColW
    : jourColW + perColW
  ) + (xCoords[xCoords.length - 1] - xCoords[0]);

  // Colonnes fixes X positions
  let col0X = gX;
  let col1X = gX + jourColW;
  let col2X = showEnsCol ? gX + jourColW + ensColW : gX + jourColW;
  let colTimeX = showEnsCol ? gX + jourColW + ensColW + perColW : gX + jourColW + perColW;

  // ---- EN-TÊTE colonnes fixes ----
  const fixedCols = showEnsCol
    ? [
        { x: col0X, w: jourColW,  label: 'JOUR' },
        { x: col1X, w: ensColW,   label: 'ENSEIGNANT' },
        { x: col2X, w: perColW,   label: 'PÉR.' },
      ]
    : [
        { x: col0X, w: jourColW,  label: 'JOUR' },
        { x: col1X, w: perColW,   label: 'PÉR.' },
      ];

  doc.setFillColor(...COL_HDR_BG);
  for (const c of fixedCols) {
    doc.rect(c.x, gY, c.w, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(255, 255, 255);
    doc.text(c.label, c.x + c.w / 2, gY + headerH / 2 + 1, { align: 'center' });
  }

  // ---- EN-TÊTES horaires ----
  doc.setFillColor(...COL_HDR_BG);
  const timeW = xCoords[xCoords.length - 1] - xCoords[0];
  doc.rect(colTimeX, gY, timeW, headerH, 'F');

  for (let i = 0; i < timeAxis.length; i++) {
    const x = colTimeX + (xCoords[i] - xCoords[0]);
    // Trait vertical
    if (i > 0) {
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.1);
      doc.line(x, gY, x, gY + headerH);
    }
    // Label (seulement si assez de place)
    const colW = i < timeAxis.length - 1
      ? (xCoords[i + 1] - xCoords[i])
      : 0;
    if (i < timeAxis.length - 1 && colW >= 7) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(255, 255, 255);
      doc.text(minToLabel(timeAxis[i]), x + colW / 2, gY + headerH / 2 + 1, { align: 'center' });
    } else if (i < timeAxis.length - 1) {
      doc.setFontSize(4.5);
      doc.text(minToLabel(timeAxis[i]), x + 0.5, gY + headerH - 1);
    }
    // Dernière borne : label à droite
    if (i === timeAxis.length - 1) {
      doc.setFontSize(5.5);
      doc.text(minToLabel(timeAxis[i]), x - 0.5, gY + headerH / 2 + 1, { align: 'right' });
    }
  }

  // ---- LIGNES DE DONNÉES ----
  rows.forEach((row, ri) => {
    const y = gY + headerH + ri * rowH;
    const bg = ri % 2 === 0 ? ROW_EVEN_BG : ROW_ODD_BG;
    doc.setFillColor(...bg);
    doc.rect(gX, y, gridW, rowH, 'F');

    // Période
    doc.setFillColor(...PER_BG);
    doc.rect(col2X, y, perColW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(55, 65, 95);
    const perLabel = row.per
      ? row.per.nom.replace('Trimestre', 'T').replace('Semestre', 'S').replace('trimestre', 'T').replace('semestre', 'S')
      : '?';
    doc.text(perLabel, col2X + perColW / 2, y + rowH / 2 + 1, { align: 'center', maxWidth: perColW - 1 });

    // Blocs séances
    for (const s of row.seances) {
      const startMin = heureToMin(s.heureDebut);
      const endMin   = heureToMin(s.heureFin);
      const startIdx = timeAxis.indexOf(startMin);
      const endIdx   = timeAxis.indexOf(endMin);
      if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) continue;

      const bX = colTimeX + (xCoords[startIdx] - xCoords[0]) + 0.3;
      const bW = (xCoords[endIdx] - xCoords[startIdx]) - 0.6;
      drawBloc(doc, bX, y + 0.4, bW, rowH - 0.8, s, refs, showTeacher);
    }
  });

  // ---- TRAITS HORIZONTAUX ----
  doc.setDrawColor(...GRID_LINE);
  doc.setLineWidth(0.12);
  rows.forEach((_, ri) => {
    const y = gY + headerH + ri * rowH;
    doc.line(gX, y, gX + gridW, y);
  });

  // ---- TRAITS VERTICAUX (colonnes fixes) ----
  doc.setDrawColor(...GRID_LINE);
  doc.setLineWidth(0.2);
  if (showEnsCol) {
    doc.line(col1X, gY + headerH, col1X, gY + headerH + rows.length * rowH);
    doc.line(col2X, gY + headerH, col2X, gY + headerH + rows.length * rowH);
  } else {
    doc.line(col1X, gY + headerH, col1X, gY + headerH + rows.length * rowH);
  }
  doc.line(colTimeX, gY + headerH, colTimeX, gY + headerH + rows.length * rowH);

  // ---- TRAITS VERTICAUX (horaires) ----
  doc.setDrawColor(...GRID_LINE);
  doc.setLineWidth(0.1);
  for (let i = 1; i < timeAxis.length; i++) {
    const x = colTimeX + (xCoords[i] - xCoords[0]);
    doc.line(x, gY + headerH, x, gY + headerH + rows.length * rowH);
  }

  // ---- CELLULES JOUR & ENSEIGNANT (merged, dessinées en dernier pour couvrir la grille) ----
  let ri = 0;
  while (ri < rows.length) {
    const thisJour = rows[ri].jour;
    let ej = ri;
    while (ej < rows.length && rows[ej].jour === thisJour) ej++;

    const jourY = gY + headerH + ri * rowH;
    const jourH = (ej - ri) * rowH;

    // Cellule jour (fond + texte)
    doc.setFillColor(...JOUR_BG);
    doc.rect(col0X, jourY, jourColW, jourH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...JOUR_FG);
    doc.text(
      JOURS_LABELS[thisJour] || thisJour.toUpperCase(),
      col0X + jourColW / 2,
      jourY + jourH / 2 + 1,
      { align: 'center' }
    );
    doc.setDrawColor(...JOUR_LINE);
    doc.setLineWidth(0.4);
    doc.rect(col0X, jourY, jourColW, jourH, 'S');

    if (showEnsCol) {
      // Cellules enseignant (merged par enseignant dans ce jour)
      let ensRi = ri;
      while (ensRi < ej) {
        const thisEnsId = rows[ensRi].ens?.id;
        let ensEnd = ensRi;
        while (ensEnd < ej && rows[ensEnd].ens?.id === thisEnsId) ensEnd++;

        const ensY = gY + headerH + ensRi * rowH;
        const ensH = (ensEnd - ensRi) * rowH;

        doc.setFillColor(...ENS_BG);
        doc.rect(col1X, ensY, ensColW, ensH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(35, 50, 95);
        const ensLabel = rows[ensRi].ens
          ? [rows[ensRi].ens.prenom, rows[ensRi].ens.nom].filter(Boolean).join(' ')
          : '?';
        const ensLines = doc.splitTextToSize(ensLabel, ensColW - 2);
        doc.text(
          ensLines,
          col1X + ensColW / 2,
          ensY + ensH / 2 - (ensLines.length - 1) * 1.8 + 1,
          { align: 'center' }
        );
        doc.setDrawColor(175, 185, 215);
        doc.setLineWidth(0.25);
        doc.rect(col1X, ensY, ensColW, ensH, 'S');

        ensRi = ensEnd;
      }
    }

    ri = ej;
  }

  // Bordure extérieure
  doc.setDrawColor(...HEADER_BG);
  doc.setLineWidth(0.5);
  doc.rect(gX, gY, gridW, headerH + rows.length * rowH, 'S');

  return gY + headerH + rows.length * rowH;
}

// ============================================================
// LÉGENDE & FOOTER
// ============================================================

function drawLegend(doc, x, y, seances, installations, maxX, lieux) {
  const usedInsts = [...new Set(seances.map(s => s.installationId))]
    .map(id => installations.find(i => i.id === id))
    .filter(Boolean);
  if (!usedInsts.length) return;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(60, 70, 100);
  doc.text('Installations : ', x, y + 2.5);
  let legX = x + doc.getTextWidth('Installations : ') + 1;
  doc.setFont('helvetica', 'normal');

  for (const inst of usedInsts) {
    const colors = instColors(inst, lieux);
    doc.setFillColor(...hexToRgb(colors.border));
    doc.rect(legX, y, 3.5, 3, 'F');
    doc.setTextColor(50, 60, 80);
    doc.text(inst.nom, legX + 4.5, y + 2.5);
    legX += 5 + doc.getTextWidth(inst.nom) + 4;
    if (legX > maxX) break;
  }
}

function drawFooter(doc, pw, ph) {
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(170, 175, 185);
  doc.text(
    `Généré le ${new Date().toLocaleDateString('fr-FR')} — EDT EPS`,
    pw / 2, ph - 3.5, { align: 'center' }
  );
}

// ============================================================
// EXPORT PDF ÉQUIPE (PAYSAGE A4)
// ============================================================

export async function exportPdfEquipe(periodeId) {
  const {
    seances: seancesAll, enseignants, classes, activites,
    installations, lieux, periodes, etablissement, anneeScolaire,
  } = await loadData();

  const refs = { classes, enseignants, activites, installations, lieux };

  const targetPeriodes = periodeId
    ? periodes.filter(p => p.id === parseInt(periodeId))
    : periodes.filter(p => !p.parentId).sort((a, b) => (a.ordre ?? a.id) - (b.ordre ?? b.id));

  if (!targetPeriodes.length) { toast.warning('Aucune période sélectionnée'); return; }

  const seances = seancesAll.filter(s => targetPeriodes.some(p => p.id === s.periodeId));
  if (!seances.length) { toast.warning('Aucune séance à exporter'); return; }

  // Axe temps unique sur toutes les séances
  const timeAxis = buildTimeAxis(seances);
  if (timeAxis.length < 2) { toast.warning('Données insuffisantes'); return; }

  // Lignes de grille
  const rows = buildRows(seances, enseignants, targetPeriodes, periodeId);
  if (!rows.length) { toast.warning('Aucune ligne à générer'); return; }

  // Dimensions paysage A4 — tout sur une seule page
  const PW = 297, PH = 210;
  const M = 8;
  const TITLE_H = 12;
  const JOUR_COL_W = 14;
  const ENS_COL_W  = 26;
  const PER_COL_W  = 10;
  const FIXED_W = JOUR_COL_W + ENS_COL_W + PER_COL_W;
  const TIME_AVAIL = PW - 2 * M - FIXED_W;
  const xCoords = buildXCoords(timeAxis, 0, TIME_AVAIL);

  // Hauteur de ligne dynamique pour tenir sur une page
  const HEADER_H = rows.length > 25 ? 6 : 8;
  const LEGEND_FOOTER_H = 12;
  const AVAILABLE_H = PH - 2 * M - TITLE_H - HEADER_H - LEGEND_FOOTER_H;
  const ROW_H = Math.max(4, Math.min(9, AVAILABLE_H / rows.length));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const periodeLabel = periodeId
    ? (targetPeriodes[0]?.nom || '')
    : 'Toutes les périodes';

  // ---- TITRE ----
  doc.setFillColor(...HEADER_BG);
  doc.rect(M, M, PW - 2 * M, TITLE_H - 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`EDT EPS — ${etablissement}`, M + 5, M + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(190, 210, 245);
  doc.text(`${periodeLabel}  ·  ${anneeScolaire}`, M + 5, M + 11);

  // ---- GRILLE ----
  const gX = M;
  const gY = M + TITLE_H;
  const bottomY = drawGrid(doc, {
    gX, gY,
    jourColW: JOUR_COL_W,
    ensColW: ENS_COL_W,
    perColW: PER_COL_W,
    timeAxis, xCoords: xCoords.map(x => x + M + FIXED_W),
    rows,
    refs,
    rowH: ROW_H,
    headerH: HEADER_H,
    showEnsCol: true,
  });

  // ---- LÉGENDE ----
  if (bottomY + 8 < PH - 4) {
    drawLegend(doc, M, bottomY + 4, seances, installations, PW - M, lieux);
  }
  drawFooter(doc, PW, PH);

  const perLabel = periodeId ? (targetPeriodes[0]?.nom || 'periode') : 'annuel';
  const blob = doc.output('blob');
  await saveExportFile(blob, `EDT_Equipe_${perLabel}_${new Date().toISOString().split('T')[0]}.pdf`);
  toast.success(`PDF EDT Équipe exporté (${doc.getNumberOfPages()} page(s))`);
}

// ============================================================
// EXPORT PDF FICHES INDIVIDUELLES (PORTRAIT A4)
// ============================================================

export async function exportPdfEnseignants(periodeId, enseignantIdFilter) {
  const {
    seances: seancesAll, enseignants, classes, activites,
    installations, lieux, periodes, etablissement, anneeScolaire,
  } = await loadData();

  const refs = { classes, enseignants, activites, installations, lieux };

  const targetEnseignants = enseignantIdFilter
    ? enseignants.filter(e => e.id === parseInt(enseignantIdFilter))
    : enseignants;

  const targetPeriodes = periodeId
    ? periodes.filter(p => p.id === parseInt(periodeId))
    : periodes.filter(p => !p.parentId).sort((a, b) => (a.ordre ?? a.id) - (b.ordre ?? b.id));

  if (!targetPeriodes.length || !targetEnseignants.length) {
    toast.warning('Aucune donnée à exporter');
    return;
  }

  const PW = 210, PH = 297;
  const M = 9;
  const TITLE_H  = 20;
  const HEADER_H = 8;
  const ROW_H    = 10;
  const JOUR_COL_W = 14;
  const PER_COL_W  = 10;
  const FIXED_W = JOUR_COL_W + PER_COL_W;
  const TIME_AVAIL = PW - 2 * M - FIXED_W;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let firstPage = true;

  for (const ens of targetEnseignants) {
    const ensSeances = seancesAll.filter(
      s => s.enseignantId === ens.id && targetPeriodes.some(p => p.id === s.periodeId)
    );
    if (!ensSeances.length) continue;

    if (!firstPage) doc.addPage('a4', 'portrait');
    firstPage = false;

    const timeAxis = buildTimeAxis(ensSeances);
    if (timeAxis.length < 2) continue;
    const xCoords = buildXCoords(timeAxis, 0, TIME_AVAIL);

    const rows = buildRows(ensSeances, enseignants, targetPeriodes, periodeId)
      .filter(r => r.ens?.id === ens.id);

    const periodeLabel = periodeId
      ? (targetPeriodes[0]?.nom || '')
      : 'Toutes les périodes';

    // ---- EN-TÊTE ----
    doc.setFillColor(...HEADER_BG);
    doc.rect(M, M, PW - 2 * M, TITLE_H, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text([ens.prenom, ens.nom].filter(Boolean).join(' '), M + 5, M + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 210, 245);
    const orsLabel = ens.ors ? `ORS : ${ens.ors}h  ·  ` : '';
    doc.text(`${orsLabel}${periodeLabel}  ·  ${anneeScolaire}`, M + 5, M + 14.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(220, 235, 255);
    doc.text(`${totalHebdoStr(ensSeances)} / semaine`, PW - M - 5, M + 8, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 185, 225);
    doc.text(etablissement, PW - M - 5, M + 14.5, { align: 'right' });

    // ---- GRILLE ----
    const gX = M;
    const gY = M + TITLE_H;
    const bottomY = drawGrid(doc, {
      gX, gY,
      jourColW: JOUR_COL_W,
      ensColW: 0,
      perColW: PER_COL_W,
      timeAxis,
      xCoords: xCoords.map(x => x + M + FIXED_W),
      rows,
      refs,
      rowH: ROW_H,
      headerH: HEADER_H,
      showEnsCol: false,
    });

    // ---- LÉGENDE ----
    if (bottomY + 8 < PH - 8) {
      drawLegend(doc, M, bottomY + 4, ensSeances, installations, PW - M, lieux);
    }
    drawFooter(doc, PW, PH);
  }

  if (firstPage) { toast.warning('Aucune séance trouvée'); return; }

  const ensLabel = enseignantIdFilter ? (targetEnseignants[0]?.nom || 'ens') : 'tous';
  const blob = doc.output('blob');
  await saveExportFile(blob, `Fiches_Enseignants_${ensLabel}_${new Date().toISOString().split('T')[0]}.pdf`);
  toast.success(`Fiches PDF exportées (${doc.getNumberOfPages()} page(s))`);
}

// ============================================================
// EXPORT PDF FICHES PAR CLASSE (PORTRAIT A4)
// ============================================================

export async function exportPdfClasses(periodeId, classeIdFilter) {
  const {
    seances: seancesAll, enseignants, classes, activites,
    installations, lieux, periodes, etablissement, anneeScolaire,
  } = await loadData();

  const refs = { classes, enseignants, activites, installations, lieux };

  const targetClasses = classeIdFilter
    ? classes.filter(c => c.id === parseInt(classeIdFilter))
    : [...classes].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  const targetPeriodes = periodeId
    ? periodes.filter(p => p.id === parseInt(periodeId))
    : periodes.filter(p => !p.parentId).sort((a, b) => (a.ordre ?? a.id) - (b.ordre ?? b.id));

  if (!targetPeriodes.length || !targetClasses.length) {
    toast.warning('Aucune donnée à exporter');
    return;
  }

  const PW = 210, PH = 297;
  const M = 9;
  const TITLE_H  = 20;
  const HEADER_H = 8;
  const ROW_H    = 10;
  const JOUR_COL_W = 14;
  const PER_COL_W  = 10;
  const FIXED_W = JOUR_COL_W + PER_COL_W;
  const TIME_AVAIL = PW - 2 * M - FIXED_W;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let firstPage = true;

  for (const cls of targetClasses) {
    const clsSeances = seancesAll.filter(
      s => s.classeId === cls.id && targetPeriodes.some(p => p.id === s.periodeId)
    );
    if (!clsSeances.length) continue;

    if (!firstPage) doc.addPage('a4', 'portrait');
    firstPage = false;

    const timeAxis = buildTimeAxis(clsSeances);
    if (timeAxis.length < 2) continue;
    const xCoords = buildXCoords(timeAxis, 0, TIME_AVAIL);

    // Construire les lignes pour cette classe (par jour > période)
    // On réutilise buildRows qui groupe jour > ens > période
    // puis on efface la colonne enseignant (showEnsCol: false),
    // les blocs afficheront le nom du prof via showTeacher.
    const rows = buildRows(clsSeances, enseignants, targetPeriodes, periodeId)
      .filter(r => r.seances.some(s => s.classeId === cls.id));

    if (!rows.length) continue;

    const periodeLabel = periodeId
      ? (targetPeriodes[0]?.nom || '')
      : 'Toutes les périodes';

    // Enseignant(s) principal de la classe
    const ensIds = [...new Set(clsSeances.map(s => s.enseignantId))];
    const ensLabel = ensIds
      .map(id => {
        const e = enseignants.find(en => en.id === id);
        return e ? [e.prenom, e.nom].filter(Boolean).join(' ') : null;
      })
      .filter(Boolean)
      .join(' / ');

    // ---- EN-TÊTE ----
    doc.setFillColor(...HEADER_BG);
    doc.rect(M, M, PW - 2 * M, TITLE_H, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(cls.nom, M + 5, M + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(190, 210, 245);
    const niveauLabel = cls.niveau ? `${cls.niveau}  ·  ` : '';
    const effectifLabel = cls.effectif ? `${cls.effectif} élèves  ·  ` : '';
    doc.text(`${niveauLabel}${effectifLabel}${periodeLabel}  ·  ${anneeScolaire}`, M + 5, M + 14.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(220, 235, 255);
    doc.text(`${totalHebdoStr(clsSeances)} / semaine`, PW - M - 5, M + 8, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 185, 225);
    if (ensLabel) doc.text(ensLabel, PW - M - 5, M + 14.5, { align: 'right' });

    // ---- GRILLE ----
    const gX = M;
    const gY = M + TITLE_H;
    const bottomY = drawGrid(doc, {
      gX, gY,
      jourColW: JOUR_COL_W,
      ensColW: 0,
      perColW: PER_COL_W,
      timeAxis,
      xCoords: xCoords.map(x => x + M + FIXED_W),
      rows,
      refs,
      rowH: ROW_H,
      headerH: HEADER_H,
      showEnsCol: false,
      showTeacher: true,
    });

    // ---- LÉGENDE ----
    if (bottomY + 8 < PH - 8) {
      drawLegend(doc, M, bottomY + 4, clsSeances, installations, PW - M, lieux);
    }
    drawFooter(doc, PW, PH);
  }

  if (firstPage) { toast.warning('Aucune séance trouvée'); return; }

  const clsLabel = classeIdFilter ? (targetClasses[0]?.nom || 'classe') : 'toutes';
  const blob = doc.output('blob');
  await saveExportFile(blob, `Fiches_Classes_${clsLabel}_${new Date().toISOString().split('T')[0]}.pdf`);
  toast.success(`Fiches classes PDF exportées (${doc.getNumberOfPages()} page(s))`);
}
