/**
 * Jeu de données démo — Collège-Lycée Les Quatre Vents
 * Établissement fictif, enseignants fictifs.
 * Génère un dataset complet : 5 profs, 12 classes (collège + lycée),
 * 3 trimestres, 11 activités, 3 lieux, 5 installations, 60 séances.
 */

// ── Enseignants ───────────────────────────────────────────────────────────────

const ENSEIGNANTS = [
  { id: 1, nom: 'LEBLANC',  prenom: 'Martin',  initiales: 'MLe', ors: 20, maxHeuresJour: 6 },
  { id: 2, nom: 'DUFOUR',   prenom: 'Sophie',  initiales: 'SDu', ors: 20, maxHeuresJour: 6 },
  { id: 3, nom: 'MOREAU',   prenom: 'Julien',  initiales: 'JMo', ors: 20, maxHeuresJour: 6 },
  { id: 4, nom: 'PETIT',    prenom: 'Camille', initiales: 'CPe', ors: 18, maxHeuresJour: 6 },
  { id: 5, nom: 'RENARD',   prenom: 'Thomas',  initiales: 'TRe', ors: 20, maxHeuresJour: 6 },
];

// ── Classes ───────────────────────────────────────────────────────────────────

const CLASSES = [
  // Collège — 6e (4h/sem = 2×2h)
  { id: 1,  nom: '6eA',   niveau: '6e',   effectif: 24, enseignantId: 1 },
  { id: 2,  nom: '6eB',   niveau: '6e',   effectif: 25, enseignantId: 1 },
  // Collège — 5e (3h/sem = 2×1h30)
  { id: 3,  nom: '5eA',   niveau: '5e',   effectif: 26, enseignantId: 2 },
  { id: 4,  nom: '5eB',   niveau: '5e',   effectif: 25, enseignantId: 2 },
  // Collège — 4e (3h/sem = 2×1h30)
  { id: 5,  nom: '4eA',   niveau: '4e',   effectif: 28, enseignantId: 3 },
  { id: 6,  nom: '4eB',   niveau: '4e',   effectif: 27, enseignantId: 3 },
  // Collège — 3e (3h/sem = 2×1h30)
  { id: 7,  nom: '3eA',   niveau: '3e',   effectif: 29, enseignantId: 4 },
  { id: 8,  nom: '3eB',   niveau: '3e',   effectif: 28, enseignantId: 4 },
  // Lycée — 2nde (2h/sem = 1×2h)
  { id: 9,  nom: '2ndeA', niveau: '2nde', effectif: 32, enseignantId: 5 },
  { id: 10, nom: '2ndeB', niveau: '2nde', effectif: 31, enseignantId: 5 },
  // Lycée — 1ère et Tle (2h/sem = 1×2h)
  { id: 11, nom: '1ereA', niveau: '1ere', effectif: 30, enseignantId: 1 },
  { id: 12, nom: 'TleA',  niveau: 'term', effectif: 28, enseignantId: 2 },
];

// ── Périodes ─────────────────────────────────────────────────────────────────

const PERIODES = [
  { id: 1, nom: 'Trimestre 1', type: 'trimestre', dateDebut: '2025-09-02', dateFin: '2025-12-20', niveau: 'tous', ordre: 1, cibles: 'tous' },
  { id: 2, nom: 'Trimestre 2', type: 'trimestre', dateDebut: '2026-01-06', dateFin: '2026-04-04', niveau: 'tous', ordre: 2, cibles: 'tous' },
  { id: 3, nom: 'Trimestre 3', type: 'trimestre', dateDebut: '2026-04-22', dateFin: '2026-07-04', niveau: 'tous', ordre: 3, cibles: 'tous' },
];

// ── Activités ─────────────────────────────────────────────────────────────────

const ACTIVITES = [
  // CA1 — Produire une performance mesurable
  { id: 1,  nom: 'Athlétisme',      champApprentissage: 'CA1', code: 'ATH', niveaux: [], heuresHebdo: null, dureeSlot: null },
  { id: 2,  nom: 'Natation',        champApprentissage: 'CA1', code: 'NAT', niveaux: [], heuresHebdo: null, dureeSlot: null },
  { id: 3,  nom: 'Gym au sol',      champApprentissage: 'CA1', code: 'GYM', niveaux: [], heuresHebdo: null, dureeSlot: null },
  // CA2 — Se déplacer en milieu naturel
  { id: 4,  nom: 'Escalade',        champApprentissage: 'CA2', code: 'ESC', niveaux: [], heuresHebdo: null, dureeSlot: null },
  // CA3 — S'exprimer devant les autres
  { id: 5,  nom: 'Danse',           champApprentissage: 'CA3', code: 'DAN', niveaux: [], heuresHebdo: null, dureeSlot: null },
  { id: 6,  nom: 'Acrosport',       champApprentissage: 'CA3', code: 'ACR', niveaux: [], heuresHebdo: null, dureeSlot: null },
  // CA4 — Conduire un affrontement
  { id: 7,  nom: 'Basket',          champApprentissage: 'CA4', code: 'BAS', niveaux: [], heuresHebdo: null, dureeSlot: null },
  { id: 8,  nom: 'Handball',        champApprentissage: 'CA4', code: 'HDB', niveaux: [], heuresHebdo: null, dureeSlot: null },
  { id: 9,  nom: 'Badminton',       champApprentissage: 'CA4', code: 'BAD', niveaux: [], heuresHebdo: null, dureeSlot: null },
  { id: 10, nom: 'Tennis de table', champApprentissage: 'CA4', code: 'TDT', niveaux: [], heuresHebdo: null, dureeSlot: null },
  { id: 11, nom: 'Volleyball',      champApprentissage: 'CA4', code: 'VOL', niveaux: [], heuresHebdo: null, dureeSlot: null },
];

// ── Lieux ────────────────────────────────────────────────────────────────────

const LIEUX = [
  { id: 1, nom: 'Gymnase municipal',    type: 'intra', necessiteBus: false, adresse: '5 allée des Pins, Vence' },
  { id: 2, nom: 'Complexe aquatique',   type: 'extra', necessiteBus: true,  adresse: '15 avenue des Sports, Vence', tempsTrajet: 15 },
  { id: 3, nom: 'Stade Georges Nallet', type: 'extra', necessiteBus: true,  adresse: '2 route des Serres, Vence',   tempsTrajet: 10 },
];

// ── Installations ────────────────────────────────────────────────────────────

const INSTALLATIONS = [
  { id: 1, lieuId: 1, nom: 'Grand gymnase',     capaciteSimultanee: 3, activitesCompatibles: [3,5,6,7,8,9,10,11] },
  { id: 2, lieuId: 1, nom: "Salle d'escalade",  capaciteSimultanee: 1, activitesCompatibles: [4] },
  { id: 3, lieuId: 1, nom: 'Salle polyvalente', capaciteSimultanee: 2, activitesCompatibles: [9,10,11] },
  { id: 4, lieuId: 2, nom: 'Piscine',           capaciteSimultanee: 2, activitesCompatibles: [2] },
  { id: 5, lieuId: 3, nom: 'Stade athlétisme',  capaciteSimultanee: 4, activitesCompatibles: [1] },
];

// ── Créneaux-classes ─────────────────────────────────────────────────────────
// Un créneau-classe = slot fixe hebdomadaire d'EPS pour une classe donnée.

const CRENEAUX_CLASSES = [
  // 6eA : 2×2h — MLe (id:1)
  { id: 1,  classeId: 1,  enseignantId: 1, jour: 'lundi',    heureDebut: '08:00', heureFin: '10:00' },
  { id: 2,  classeId: 1,  enseignantId: 1, jour: 'mercredi', heureDebut: '08:00', heureFin: '10:00' },
  // 6eB : 2×2h — MLe (id:1)
  { id: 3,  classeId: 2,  enseignantId: 1, jour: 'lundi',    heureDebut: '10:00', heureFin: '12:00' },
  { id: 4,  classeId: 2,  enseignantId: 1, jour: 'mercredi', heureDebut: '10:00', heureFin: '12:00' },
  // 5eA : 2×1h30 — SDu (id:2)
  { id: 5,  classeId: 3,  enseignantId: 2, jour: 'mardi',    heureDebut: '08:00', heureFin: '09:30' },
  { id: 6,  classeId: 3,  enseignantId: 2, jour: 'jeudi',    heureDebut: '08:00', heureFin: '09:30' },
  // 5eB : 2×1h30 — SDu (id:2)
  { id: 7,  classeId: 4,  enseignantId: 2, jour: 'mardi',    heureDebut: '09:30', heureFin: '11:00' },
  { id: 8,  classeId: 4,  enseignantId: 2, jour: 'jeudi',    heureDebut: '09:30', heureFin: '11:00' },
  // 4eA : 2×1h30 — JMo (id:3)
  { id: 9,  classeId: 5,  enseignantId: 3, jour: 'mardi',    heureDebut: '11:00', heureFin: '12:30' },
  { id: 10, classeId: 5,  enseignantId: 3, jour: 'vendredi', heureDebut: '08:00', heureFin: '09:30' },
  // 4eB : 2×1h30 — JMo (id:3)
  { id: 11, classeId: 6,  enseignantId: 3, jour: 'mercredi', heureDebut: '08:00', heureFin: '09:30' },
  { id: 12, classeId: 6,  enseignantId: 3, jour: 'vendredi', heureDebut: '11:00', heureFin: '12:30' },
  // 3eA : 2×1h30 — CPe (id:4)
  { id: 13, classeId: 7,  enseignantId: 4, jour: 'lundi',    heureDebut: '14:00', heureFin: '15:30' },
  { id: 14, classeId: 7,  enseignantId: 4, jour: 'jeudi',    heureDebut: '14:00', heureFin: '15:30' },
  // 3eB : 2×1h30 — CPe (id:4)
  { id: 15, classeId: 8,  enseignantId: 4, jour: 'lundi',    heureDebut: '15:30', heureFin: '17:00' },
  { id: 16, classeId: 8,  enseignantId: 4, jour: 'jeudi',    heureDebut: '15:30', heureFin: '17:00' },
  // 2ndeA : 1×2h — TRe (id:5)
  { id: 17, classeId: 9,  enseignantId: 5, jour: 'mercredi', heureDebut: '14:00', heureFin: '16:00' },
  // 2ndeB : 1×2h — TRe (id:5)
  { id: 18, classeId: 10, enseignantId: 5, jour: 'vendredi', heureDebut: '14:00', heureFin: '16:00' },
  // 1ereA : 1×2h — MLe (id:1)
  { id: 19, classeId: 11, enseignantId: 1, jour: 'vendredi', heureDebut: '10:00', heureFin: '12:00' },
  // TleA : 1×2h — SDu (id:2)
  { id: 20, classeId: 12, enseignantId: 2, jour: 'mardi',    heureDebut: '14:00', heureFin: '16:00' },
];

// ── Programmations + Séances ──────────────────────────────────────────────────
// Plan activités par créneau-classe et par période.
// Chaque entrée : { ccId, periodeId, activiteId, installationId }

const PLAN = [
  // ── Trimestre 1 ─────────────────────────────────────────────────────────
  // 6e → Gym au sol (GYM) au Grand gymnase
  { ccId: 1,  periodeId: 1, activiteId: 3,  installationId: 1 },
  { ccId: 2,  periodeId: 1, activiteId: 3,  installationId: 1 },
  { ccId: 3,  periodeId: 1, activiteId: 3,  installationId: 1 },
  { ccId: 4,  periodeId: 1, activiteId: 3,  installationId: 1 },
  // 5e → Athlétisme au Stade
  { ccId: 5,  periodeId: 1, activiteId: 1,  installationId: 5 },
  { ccId: 6,  periodeId: 1, activiteId: 1,  installationId: 5 },
  { ccId: 7,  periodeId: 1, activiteId: 1,  installationId: 5 },
  { ccId: 8,  periodeId: 1, activiteId: 1,  installationId: 5 },
  // 4e → Basket au Grand gymnase
  { ccId: 9,  periodeId: 1, activiteId: 7,  installationId: 1 },
  { ccId: 10, periodeId: 1, activiteId: 7,  installationId: 1 },
  { ccId: 11, periodeId: 1, activiteId: 7,  installationId: 1 },
  { ccId: 12, periodeId: 1, activiteId: 7,  installationId: 1 },
  // 3e → Badminton en Salle polyvalente
  { ccId: 13, periodeId: 1, activiteId: 9,  installationId: 3 },
  { ccId: 14, periodeId: 1, activiteId: 9,  installationId: 3 },
  { ccId: 15, periodeId: 1, activiteId: 9,  installationId: 3 },
  { ccId: 16, periodeId: 1, activiteId: 9,  installationId: 3 },
  // Lycée → Handball / Danse / Volleyball au Grand gymnase
  { ccId: 17, periodeId: 1, activiteId: 8,  installationId: 1 },
  { ccId: 18, periodeId: 1, activiteId: 8,  installationId: 1 },
  { ccId: 19, periodeId: 1, activiteId: 5,  installationId: 1 },
  { ccId: 20, periodeId: 1, activiteId: 11, installationId: 1 },

  // ── Trimestre 2 ─────────────────────────────────────────────────────────
  // 6e → Natation à la Piscine
  { ccId: 1,  periodeId: 2, activiteId: 2,  installationId: 4 },
  { ccId: 2,  periodeId: 2, activiteId: 2,  installationId: 4 },
  { ccId: 3,  periodeId: 2, activiteId: 2,  installationId: 4 },
  { ccId: 4,  periodeId: 2, activiteId: 2,  installationId: 4 },
  // 5e → Gym au sol au Grand gymnase
  { ccId: 5,  periodeId: 2, activiteId: 3,  installationId: 1 },
  { ccId: 6,  periodeId: 2, activiteId: 3,  installationId: 1 },
  { ccId: 7,  periodeId: 2, activiteId: 3,  installationId: 1 },
  { ccId: 8,  periodeId: 2, activiteId: 3,  installationId: 1 },
  // 4e → Handball au Grand gymnase
  { ccId: 9,  periodeId: 2, activiteId: 8,  installationId: 1 },
  { ccId: 10, periodeId: 2, activiteId: 8,  installationId: 1 },
  { ccId: 11, periodeId: 2, activiteId: 8,  installationId: 1 },
  { ccId: 12, periodeId: 2, activiteId: 8,  installationId: 1 },
  // 3e → Danse au Grand gymnase
  { ccId: 13, periodeId: 2, activiteId: 5,  installationId: 1 },
  { ccId: 14, periodeId: 2, activiteId: 5,  installationId: 1 },
  { ccId: 15, periodeId: 2, activiteId: 5,  installationId: 1 },
  { ccId: 16, periodeId: 2, activiteId: 5,  installationId: 1 },
  // Lycée → Acrosport / Escalade / Basket
  { ccId: 17, periodeId: 2, activiteId: 6,  installationId: 1 },
  { ccId: 18, periodeId: 2, activiteId: 7,  installationId: 1 },
  { ccId: 19, periodeId: 2, activiteId: 4,  installationId: 2 },
  { ccId: 20, periodeId: 2, activiteId: 6,  installationId: 1 },

  // ── Trimestre 3 ─────────────────────────────────────────────────────────
  // 6e → Basket au Grand gymnase
  { ccId: 1,  periodeId: 3, activiteId: 7,  installationId: 1 },
  { ccId: 2,  periodeId: 3, activiteId: 7,  installationId: 1 },
  { ccId: 3,  periodeId: 3, activiteId: 7,  installationId: 1 },
  { ccId: 4,  periodeId: 3, activiteId: 7,  installationId: 1 },
  // 5e → Volleyball au Grand gymnase
  { ccId: 5,  periodeId: 3, activiteId: 11, installationId: 1 },
  { ccId: 6,  periodeId: 3, activiteId: 11, installationId: 1 },
  { ccId: 7,  periodeId: 3, activiteId: 11, installationId: 1 },
  { ccId: 8,  periodeId: 3, activiteId: 11, installationId: 1 },
  // 4e → Athlétisme au Stade
  { ccId: 9,  periodeId: 3, activiteId: 1,  installationId: 5 },
  { ccId: 10, periodeId: 3, activiteId: 1,  installationId: 5 },
  { ccId: 11, periodeId: 3, activiteId: 1,  installationId: 5 },
  { ccId: 12, periodeId: 3, activiteId: 1,  installationId: 5 },
  // 3e → Handball au Grand gymnase
  { ccId: 13, periodeId: 3, activiteId: 8,  installationId: 1 },
  { ccId: 14, periodeId: 3, activiteId: 8,  installationId: 1 },
  { ccId: 15, periodeId: 3, activiteId: 8,  installationId: 1 },
  { ccId: 16, periodeId: 3, activiteId: 8,  installationId: 1 },
  // Lycée → Tennis de table / Badminton / Volleyball
  { ccId: 17, periodeId: 3, activiteId: 10, installationId: 3 },
  { ccId: 18, periodeId: 3, activiteId: 9,  installationId: 3 },
  { ccId: 19, periodeId: 3, activiteId: 9,  installationId: 3 },
  { ccId: 20, periodeId: 3, activiteId: 11, installationId: 1 },
];

// ── Génération des programmations et séances ──────────────────────────────────

function buildProgrammationsAndSeances() {
  const programmations = [];
  const seances = [];

  // Index des créneaux-classes pour accès rapide
  const ccById = {};
  CRENEAUX_CLASSES.forEach(cc => { ccById[cc.id] = cc; });

  let progId = 1;
  let seanceId = 1;

  for (const entry of PLAN) {
    const cc = ccById[entry.ccId];
    if (!cc) continue;

    const prog = {
      id: progId,
      classeId: cc.classeId,
      activiteId: entry.activiteId,
      periodeId: entry.periodeId,
      installationId: entry.installationId,
      zoneId: null,
      creneauClasseId: entry.ccId,
      statut: 'accepte',
    };
    programmations.push(prog);

    const seance = {
      id: seanceId,
      classeId: cc.classeId,
      enseignantId: cc.enseignantId,
      activiteId: entry.activiteId,
      installationId: entry.installationId,
      zoneId: null,
      jour: cc.jour,
      heureDebut: cc.heureDebut,
      heureFin: cc.heureFin,
      periodeId: entry.periodeId,
      programmationId: progId,
      creneauClasseId: entry.ccId,
      verrouille: false,
      notes: '',
    };
    seances.push(seance);

    progId++;
    seanceId++;
  }

  return { programmations, seances };
}

// ── Config ────────────────────────────────────────────────────────────────────

function buildConfig() {
  const values = {
    etablissementNom:              'Collège-Lycée Les Quatre Vents',
    etablissementType:             'mixte',
    etablissementZone:             'B',
    anneeScolaire:                 '2025-2026',
    heureDebut:                    '08:00',
    heureFin:                      '17:00',
    pasSlot:                       30,
    maxHeuresJourProf:             6,
    minEcartSeancesCollegeH:       24,
    dureeTrajetDefautMin:          15,
    joursOuvres:                   ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],
    contrainte_max_heures_actif:   true,
    contrainte_ecart_24h_actif:    true,
    contrainte_1prof_1classe_actif: true,
  };
  return Object.entries(values).map(([cle, valeur]) => ({
    cle,
    valeur: JSON.stringify(valeur),
  }));
}

// ── Export principal ──────────────────────────────────────────────────────────

export function getDemoData() {
  const { programmations, seances } = buildProgrammationsAndSeances();

  return {
    _meta: {
      version: 2,
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0',
      isDemo: true,
    },
    etablissement:   [],
    periodes:        PERIODES,
    enseignants:     ENSEIGNANTS,
    classes:         CLASSES,
    activites:       ACTIVITES,
    lieux:           LIEUX,
    installations:   INSTALLATIONS,
    zones:           [],
    programmations,
    seances,
    reservations:    [],
    transports:      [],
    indisponibilites: [],
    preferences:     [],
    contraintes:     [],
    creneaux:        [],
    config:          buildConfig(),
    creneauxClasses: CRENEAUX_CLASSES,
    modelesNiveau:   [],
  };
}
