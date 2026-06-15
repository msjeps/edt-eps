/**
 * Import Excel Direction des Sports — deux formats :
 *
 * Format A : 1 fichier = 1 lieu, onglets = périodes (T1/T2/T3)
 *   - Col A = espace/installation, lignes "jour" = séparateurs de jour
 *   - Colonnes = créneaux horaires (résolution 30 min, 2 cols par heure)
 *   - Cellules fusionnées = durée réelle sur l'installation
 *
 * Format B : 1 fichier = 1 lieu + 1 période, onglets = jours (Lundi…Vendredi)
 *   - Lignes "zone" = nom de l'espace, lignes "header temps" = paires (H,M)
 *   - Lignes "couloir" = col A = numéro, colonnes = occupant par créneau 30 min
 */

import ExcelJS from 'exceljs';

const JOURS_NORM = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const SKIP_SHEETS = ['asso', 'as', 'association sportive', 'association'];

// ── Utilitaires ──────────────────────────────────────────────────────────────

function isJourName(val) {
  return val != null && JOURS_NORM.includes(String(val).trim().toLowerCase());
}

function minutesToHHMM(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function colLetterToIndex(letters) {
  let n = 0;
  for (const ch of String(letters).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n; // 1-based
}

function strVal(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function numVal(v) {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? null : n;
}

// ── Cellules fusionnées ──────────────────────────────────────────────────────

/**
 * Construit une map "row,col" (1-based) → colonne de droite (1-based) pour
 * chaque cellule fusionnée. Uniquement la cellule maîtresse (top-left) est
 * indexée.
 */
function buildMergeExtents(ws) {
  const ext = {};
  try {
    const merges = ws.model?.merges || [];
    for (const s of merges) {
      const m = s.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
      if (!m) continue;
      const top = +m[2], bottom = +m[4];
      const left = colLetterToIndex(m[1]), right = colLetterToIndex(m[3]);
      // N'indexer que la cellule maîtresse (top-left) de chaque fusion
      for (let r = top; r <= bottom; r++) {
        ext[`${r},${left}`] = right;
      }
    }
  } catch {}
  return ext;
}

// ── Détection des cellules colorées ─────────────────────────────────────────

function getCellFill(ws, rowNumber, cn) {
  try {
    return ws.getRow(rowNumber).getCell(cn)?.fill || null;
  } catch { return null; }
}

// FFFFFFFF=blanc, 00000000=transparent, FFFFFF00=jaune (séparateur jour)
// FF000000 (noir opaque) = nettoyage = indisponibilité réelle → PAS dans la liste
const SKIP_ARGB = new Set(['FFFFFFFF', '00000000', 'FFFFFF00']);

/**
 * Retourne true si la cellule a un fond coloré réel.
 * Gère deux cas :
 *  - fgColor.argb  : couleur hexadécimale explicite (ex. FF000000)
 *  - fgColor.theme : couleur de thème (theme:0 = blanc/fond, theme:1+ = coloré)
 */
function isCellFillColored(fill) {
  if (!fill || fill.pattern === 'none') return false;
  const fg = fill.fgColor;
  if (!fg) return false;
  if (fg.argb) return !SKIP_ARGB.has(fg.argb);
  // Couleur de thème : theme 0 = fond clair (blanc), 1+ = couleur réelle
  if (fg.theme != null) return fg.theme !== 0;
  return false;
}

/**
 * Retourne toutes les fusions (merges) colorées d'une feuille.
 * Une fusion colorée = la cellule maître (top-left) a un fond non-blanc/non-jaune.
 * Inclut les fusions multi-lignes (qui couvrent plusieurs espaces à la fois).
 */
function buildColoredMerges(ws) {
  const result = [];
  try {
    const merges = ws.model?.merges || [];
    for (const s of merges) {
      const m = s.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
      if (!m) continue;
      const top = +m[2], bottom = +m[4];
      const left = colLetterToIndex(m[1]), right = colLetterToIndex(m[3]);
      if (!isCellFillColored(getCellFill(ws, top, left))) continue;
      const masterVal = strVal(ws.getRow(top).getCell(left).value);
      result.push({ top, bottom, left, right, activity: masterVal });
    }
  } catch {}
  return result;
}

/**
 * Groupe les entrées 30-min consécutives (même espace/jour/période/activité)
 * en un seul bloc horaire.
 */
function groupConsecutiveEntries(entries) {
  const key = e => `${e.facility}|${e.space}|${e.day}|${e.date_range}|${e.activity || ''}`;
  const byKey = new Map();
  for (const e of entries) {
    const k = key(e);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(e);
  }
  const result = [];
  for (const arr of byKey.values()) {
    arr.sort((a, b) => a.time_range.localeCompare(b.time_range));
    const uniq = arr.filter((e, i) => i === 0 || e.time_range !== arr[i - 1].time_range);
    let cur = null;
    for (const e of uniq) {
      const [start, end] = e.time_range.split(' - ');
      if (!cur) { cur = { ...e }; continue; }
      const curEnd = cur.time_range.split(' - ')[1];
      if (curEnd === start) { cur = { ...cur, time_range: cur.time_range.split(' - ')[0] + ' - ' + end }; continue; }
      result.push(cur);
      cur = { ...e };
    }
    if (cur) result.push(cur);
  }
  return result;
}

// ── Détection du format ──────────────────────────────────────────────────────

/**
 * Format B si au moins un onglet porte un nom de jour (Lundi, Mardi…).
 * Sinon Format A (onglets = périodes).
 */
function detectFormat(wb) {
  return wb.worksheets.some(ws => JOURS_NORM.includes(ws.name.trim().toLowerCase()))
    ? 'B' : 'A';
}

// ── Pré-remplissage du nom de lieu depuis le nom de fichier ─────────────────

export function guessLieuFromFilename(filename) {
  const stem = filename.replace(/\.[^.]+$/, '');
  return stem
    .replace(/^P\d+[_\s]/i, '')           // retirer préfixe période "P2_"
    .replace(/[_\s]?(l[_\s]c|l[_\s]et[_\s]c)[_\s].*/i, '') // "_l_c_28JUIN…"
    .replace(/[_\s]?du[_\s].*/i, '')       // "_du_2dec…"
    .replace(/[_\s]?modifie.*/i, '')
    .replace(/[_\s]?inchange.*/i, '')
    .replace(/[_\s]+v\d+$/i, '')           // " V1", " V2"… en fin de nom
    .replace(/_/g, ' ')
    .trim()
    .toUpperCase() || stem.toUpperCase();
}

// ── Point d'entrée public ────────────────────────────────────────────────────

/**
 * Parse un fichier Excel Direction des Sports.
 * Retourne { format, entries } où entries est un tableau d'objets
 * { facility, space, day, date_range, time_range, activity } compatibles
 * avec importerDisponibilitesMairie().
 *
 * @param {File}   file          - Fichier .xlsx
 * @param {string} facilityName  - Nom du complexe (saisi par l'utilisateur)
 * @param {string} periodeLabel  - Période (Format B uniquement)
 */
export async function parseExcelMairie(file, facilityName, periodeLabel) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const format = detectFormat(wb);
  const entries = format === 'A'
    ? parseFormatA(wb, facilityName)
    : parseFormatB(wb, facilityName, periodeLabel || '');

  return { format, entries };
}

// ── Format A : onglets = périodes ────────────────────────────────────────────

function parseFormatA(wb, facilityName) {
  const rawEntries = [];

  for (const ws of wb.worksheets) {
    if (SKIP_SHEETS.includes(ws.name.trim().toLowerCase())) continue;
    const periodeName = ws.name;

    const allRows = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      allRows.push({ rowNumber, vals: row.values });
    });
    if (allRows.length < 2) continue;

    // Ligne 1 = header horaires.
    // Supporte "8h/9h", "8H", "8H30" (insensible à la casse)
    const headerVals = allRows[0].vals;
    let firstSlotCol = -1, firstSlotMin = -1;
    for (let c = 2; c <= (headerVals?.length ?? 0); c++) {
      const m = strVal(headerVals[c])?.match(/^(\d+)[Hh]/i);
      if (m) { firstSlotCol = c; firstSlotMin = +m[1] * 60; break; }
    }
    if (firstSlotCol < 0) continue;

    // Nombre de colonnes de créneaux (depuis le header — fixe même si la ligne de données est vide)
    let lastSlotCol = firstSlotCol;
    for (let c = firstSlotCol + 1; c <= (headerVals?.length ?? 0); c++) {
      if (strVal(headerVals[c])?.match(/^(\d+)[Hh]/i)) lastSlotCol = c;
    }

    const colToMin = (c) => firstSlotMin + (c - firstSlotCol) * 30;
    const mergeExt = buildMergeExtents(ws);
    const coloredMerges = buildColoredMerges(ws);

    // Map rowNumber → { day, space } pour tous les rangs "installation"
    let currentDay = null;
    const rowToSpace = {};
    for (const { rowNumber, vals } of allRows.slice(1)) {
      const strA = strVal(vals?.[1]);
      if (!strA) continue;
      if (isJourName(strA)) { currentDay = strA.toLowerCase(); continue; }
      // Ignorer les lignes dont col A est un commentaire administratif (> 60 car.)
      if (strA.length > 60) continue;
      if (currentDay) rowToSpace[rowNumber] = { day: currentDay, space: strA };
    }

    // Passe 1 : fusions colorées (peuvent couvrir plusieurs lignes/espaces)
    for (const mg of coloredMerges) {
      // Ignorer les merges qui commencent avant la zone des créneaux (notes, titres…)
      if (mg.left < firstSlotCol) continue;
      // Ignorer les fusions dont le texte est clairement une note administrative (> 60 car.)
      if (mg.activity && mg.activity.length > 60) continue;
      const startMin = colToMin(mg.left);
      const endMin   = colToMin(mg.right + 1);
      for (let r = mg.top; r <= mg.bottom; r++) {
        const info = rowToSpace[r];
        if (!info) continue;
        rawEntries.push({
          facility: facilityName, space: info.space, day: info.day,
          date_range: periodeName,
          time_range: `${minutesToHHMM(startMin)} - ${minutesToHHMM(endMin)}`,
          activity: mg.activity,
        });
      }
    }

    // Passe 2 : cellules texte et cellules colorées non-fusionnées
    for (const { rowNumber, vals } of allRows.slice(1)) {
      const info = rowToSpace[rowNumber];
      if (!info) continue;

      for (let c = firstSlotCol; c <= lastSlotCol; c++) {
        const activity = strVal(vals?.[c]);

        if (activity) {
          // Cellule avec texte (fusionnée ou non)
          const endCol = mergeExt[`${rowNumber},${c}`] ?? c;
          rawEntries.push({
            facility: facilityName, space: info.space, day: info.day,
            date_range: periodeName,
            time_range: `${minutesToHHMM(colToMin(c))} - ${minutesToHHMM(colToMin(endCol + 1))}`,
            activity,
          });
          c = endCol;
          continue;
        }

        // Cellule colorée sans texte (non-fusionnée — les fusionnées sont en passe 1)
        if (!isCellFillColored(getCellFill(ws, rowNumber, c))) continue;

        // Ignorer si déjà couverte par une fusion colorée
        const coveredByMerge = coloredMerges.some(
          mg => rowNumber >= mg.top && rowNumber <= mg.bottom && c >= mg.left && c <= mg.right
        );
        if (coveredByMerge) continue;

        rawEntries.push({
          facility: facilityName, space: info.space, day: info.day,
          date_range: periodeName,
          time_range: `${minutesToHHMM(colToMin(c))} - ${minutesToHHMM(colToMin(c + 1))}`,
          activity: null,
        });
      }
    }
  }

  return groupConsecutiveEntries(rawEntries);
}

// ── Format B : onglets = jours ───────────────────────────────────────────────

function parseFormatB(wb, facilityName, periodeLabel) {
  const entries = [];

  for (const ws of wb.worksheets) {
    const dayName = ws.name.trim().toLowerCase();
    if (!JOURS_NORM.includes(dayName)) continue;

    const allRows = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      allRows.push({ rowNumber, vals: row.values });
    });
    if (!allRows.length) continue;

    const mergeExt  = buildMergeExtents(ws);
    let currentZone = null;
    let colToMin    = null; // reconstruit à chaque nouvelle zone

    for (const { rowNumber, vals } of allRows) {
      const v0 = vals[1]; // col A
      const v1 = vals[2]; // col B

      // Ligne zone : col A vide, col B = texte (non numérique)
      const strB = strVal(v1);
      if ((v0 == null || strVal(v0) == null) && strB && isNaN(parseFloat(strB))) {
        currentZone = strB;
        colToMin    = null;
        continue;
      }

      // Ligne header temps : col A vide, col B = nombre
      if ((v0 == null || strVal(v0) == null) && numVal(v1) != null) {
        colToMin = buildPiscineColToMin(vals);
        continue;
      }

      // Ligne couloir : col A = nombre
      if (numVal(v0) == null || !currentZone || !colToMin) continue;

      for (let c = 2; c <= (vals.length ?? 0); c++) {
        const v = vals[c];
        if (v == null) continue;
        const activity = strVal(v);
        // Ignorer les valeurs purement numériques (numéros de couloir, etc.)
        if (!activity || !isNaN(parseFloat(activity))) continue;

        const startMin = colToMin[c];
        if (startMin == null) continue;

        const endCol = mergeExt[`${rowNumber},${c}`] ?? c;
        const endMin = colToMin[endCol + 1] ?? colToMin[endCol] + 30;

        entries.push({
          facility:   facilityName,
          space:      currentZone,
          day:        dayName,
          date_range: periodeLabel,
          time_range: `${minutesToHHMM(startMin)} - ${minutesToHHMM(endMin)}`,
          activity,
        });
      }
    }
  }
  return entries;
}

/**
 * Construit la map col (1-based ExcelJS) → minutes depuis le header temps.
 *
 * Le header encode les créneaux 30 min comme paires (H, M) sur 2 colonnes.
 * Pour les heures ≥ 10 l'Excel stocke (1, X) pour (10+X):00 et (2, X) pour (20+X):00.
 * Les demi-heures (ex : 10:30) apparaissent avec le nombre complet (10, 30).
 */
function buildPiscineColToMin(vals) {
  const map = {};
  let ci = 2; // col B = premier chiffre de la première paire
  while (ci + 1 <= (vals.length ?? 0)) {
    const h = numVal(vals[ci]);
    const m = numVal(vals[ci + 1]);
    if (h == null || m == null) { ci += 2; continue; }

    const minutes = decodePiscinePair(h, m);
    map[ci]     = minutes;
    map[ci + 1] = minutes; // les deux cols de la paire → même créneau
    ci += 2;
  }
  return map;
}

/**
 * Décode une paire (H, M) du header Piscine en minutes.
 * L'Excel stocke les heures ≥ 10 avec H = chiffre des dizaines :
 *   (1, 0) → 10:00  |  (1, 3) → 13:00  |  (2, 0) → 20:00
 * Les demi-heures sont encodées normalement : (10, 30), (11, 30)…
 */
function decodePiscinePair(h, m) {
  // Encodage "dizaines" : H ∈ {1,2} et M est le chiffre des unités (entier 0-9)
  if (h === 1 && Number.isInteger(m) && m >= 0 && m <= 9 && m !== 30) return (10 + m) * 60;
  if (h === 2 && Number.isInteger(m) && m >= 0 && m <= 2 && m !== 30) return (20 + m) * 60;
  return Math.round(h * 60 + m);
}
