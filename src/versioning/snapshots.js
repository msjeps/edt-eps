/**
 * Gestion des snapshots (versions nommées de la base).
 * Stockage dans db.snapshots (table IDB existante).
 */
import db from '../db/schema.js';
import { exportAllData, importAllData } from '../db/store.js';

const DIFF_TABLES = [
  { key: 'enseignants',     label: 'Enseignants' },
  { key: 'classes',         label: 'Classes' },
  { key: 'activites',       label: 'Activités' },
  { key: 'lieux',           label: 'Lieux' },
  { key: 'installations',   label: 'Installations' },
  { key: 'periodes',        label: 'Périodes' },
  { key: 'creneaux',        label: 'Créneaux' },
  { key: 'creneauxClasses', label: 'Créneaux-classes' },
  { key: 'programmations',  label: 'Programmations' },
  { key: 'seances',         label: 'Séances EDT' },
  { key: 'reservations',    label: 'Réservations' },
  { key: 'transports',      label: 'Transports' },
];

const JOURS = { lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam' };

// ─── CRUD snapshots ──────────────────────────────────────────────────────────

export async function captureSnapshot(nom, description = '') {
  const data = await exportAllData();
  return db.snapshots.add({
    nom: nom.trim(),
    description: description.trim(),
    date: new Date().toISOString(),
    data: JSON.stringify(data),
  });
}

export async function getSnapshots() {
  const all = await db.snapshots.toArray();
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function deleteSnapshot(id) {
  await db.snapshots.delete(id);
}

export async function restoreSnapshot(id) {
  const snap = await db.snapshots.get(id);
  if (!snap) throw new Error('Snapshot introuvable');
  await importAllData(JSON.parse(snap.data));
  return snap;
}

// ─── Helpers diff ────────────────────────────────────────────────────────────

function buildRefs(data) {
  return {
    classes:      new Map((data.classes || []).map(c => [c.id, c.nom])),
    enseignants:  new Map((data.enseignants || []).map(e => [e.id, `${e.prenom ? e.prenom + ' ' : ''}${e.nom}`])),
    activites:    new Map((data.activites || []).map(a => [a.id, a.nom])),
    installations:new Map((data.installations || []).map(i => [i.id, i.nom])),
    periodes:     new Map((data.periodes || []).map(p => [p.id, p.nom])),
  };
}

function labelSeance(s, refs) {
  return {
    classe:     refs.classes.get(s.classeId)          || `Classe #${s.classeId}`,
    prof:       refs.enseignants.get(s.enseignantId)  || `Prof #${s.enseignantId}`,
    activite:   refs.activites.get(s.activiteId)      || `Activité #${s.activiteId}`,
    install:    refs.installations.get(s.installationId) || `#${s.installationId}`,
    jour:       JOURS[s.jour] || s.jour || '?',
    heureDebut: s.heureDebut || '',
    heureFin:   s.heureFin || '',
  };
}

function diffSeanceFields(sA, sB, refA, refB) {
  const changes = [];
  if (sA.jour !== sB.jour || sA.heureDebut !== sB.heureDebut || sA.heureFin !== sB.heureFin) {
    changes.push({
      field: 'Horaire',
      from: `${JOURS[sA.jour] || sA.jour} ${sA.heureDebut}–${sA.heureFin}`,
      to:   `${JOURS[sB.jour] || sB.jour} ${sB.heureDebut}–${sB.heureFin}`,
    });
  }
  if (sA.activiteId !== sB.activiteId) {
    changes.push({ field: 'Activité',
      from: refA.activites.get(sA.activiteId) || '?',
      to:   refB.activites.get(sB.activiteId) || '?',
    });
  }
  if (sA.installationId !== sB.installationId) {
    changes.push({ field: 'Installation',
      from: refA.installations.get(sA.installationId) || '?',
      to:   refB.installations.get(sB.installationId) || '?',
    });
  }
  if (sA.enseignantId !== sB.enseignantId) {
    changes.push({ field: 'Enseignant',
      from: refA.enseignants.get(sA.enseignantId) || '?',
      to:   refB.enseignants.get(sB.enseignantId) || '?',
    });
  }
  return changes;
}

function computeDiff(dataA, dataB) {
  return DIFF_TABLES.map(({ key, label }) => {
    const itemsA = dataA[key] || [];
    const itemsB = dataB[key] || [];
    const mapA = new Map(itemsA.map(i => [i.id, i]));
    const mapB = new Map(itemsB.map(i => [i.id, i]));
    const added   = itemsB.filter(i => !mapA.has(i.id)).length;
    const removed = itemsA.filter(i => !mapB.has(i.id)).length;
    const changed = itemsA.filter(i =>
      mapB.has(i.id) && JSON.stringify(i) !== JSON.stringify(mapB.get(i.id))
    ).length;
    return { key, label, snapCount: itemsA.length, currCount: itemsB.length, added, removed, changed };
  });
}

function computeSeanceDiff(dataA, dataB) {
  const seancesA = dataA.seances || [];
  const seancesB = dataB.seances || [];
  const refA = buildRefs(dataA);
  const refB = buildRefs(dataB);
  const mapA = new Map(seancesA.map(s => [s.id, s]));
  const mapB = new Map(seancesB.map(s => [s.id, s]));

  const added = seancesB
    .filter(s => !mapA.has(s.id))
    .map(s => labelSeance(s, refB));

  const removed = seancesA
    .filter(s => !mapB.has(s.id))
    .map(s => labelSeance(s, refA));

  const changed = seancesA
    .filter(s => mapB.has(s.id) && JSON.stringify(s) !== JSON.stringify(mapB.get(s.id)))
    .map(s => {
      const sB = mapB.get(s.id);
      return {
        from: labelSeance(s, refA),
        to:   labelSeance(sB, refB),
        changes: diffSeanceFields(s, sB, refA, refB),
      };
    });

  return { added, removed, changed };
}

// ─── Comparaisons publiques ──────────────────────────────────────────────────

/**
 * Compare un snapshot avec l'état actuel de la base.
 * dataA = snapshot (avant), dataB = état actuel (après).
 */
export async function compareWithCurrent(id) {
  const snap = await db.snapshots.get(id);
  if (!snap) throw new Error('Snapshot introuvable');
  const dataA = JSON.parse(snap.data);
  const dataB = await exportAllData();
  return {
    snapA: snap,
    snapB: null,       // null = état actuel
    diff: computeDiff(dataA, dataB),
    seanceDiff: computeSeanceDiff(dataA, dataB),
  };
}

/**
 * Compare deux snapshots entre eux.
 * idA = référence (avant), idB = version cible (après).
 */
export async function compareSnapshots(idA, idB) {
  const [snapA, snapB] = await Promise.all([db.snapshots.get(idA), db.snapshots.get(idB)]);
  if (!snapA || !snapB) throw new Error('Snapshot introuvable');
  const dataA = JSON.parse(snapA.data);
  const dataB = JSON.parse(snapB.data);
  return {
    snapA,
    snapB,
    diff: computeDiff(dataA, dataB),
    seanceDiff: computeSeanceDiff(dataA, dataB),
  };
}
