/**
 * Schéma IndexedDB via Dexie.js
 * Base de données locale pour l'application EDT EPS
 */
import Dexie from 'dexie';

const db = new Dexie('EdtEpsDB');

// Version 1 — schéma initial
db.version(1).stores({
  // Établissement (un seul par projet)
  etablissement: '++id, nom, type',

  // Périodes (trimestres, semestres, custom)
  // cibles: 'tous' ou { niveaux: ['3e'], classesIds: [12,13] }
  periodes: '++id, nom, type, dateDebut, dateFin, parentId, niveau, ordre',

  // Enseignants
  enseignants: '++id, nom, prenom, initiales',

  // Classes
  classes: '++id, nom, niveau, effectif, enseignantId',

  // Activités
  activites: '++id, nom, champApprentissage, code',

  // Lieux (regroupement d'installations)
  lieux: '++id, nom, type, necessiteBus',

  // Installations (espaces sportifs au sein d'un lieu)
  installations: '++id, lieuId, nom, capaciteSimultanee',

  // Zones (sous-divisions d'une installation)
  zones: '++id, installationId, nom',

  // Programmation activités par classe et période
  programmations: '++id, classeId, activiteId, periodeId, installationId, zoneId',

  // Séances (blocs EDT = classe + prof + activité + installation + créneau)
  seances: '++id, classeId, enseignantId, activiteId, installationId, zoneId, jour, heureDebut, heureFin, periodeId, verrouille',

  // Réservations
  reservations: '++id, seanceId, installationId, statut, periodeId',

  // Transports
  transports: '++id, seanceId, jour, lieuId, classeId, enseignantId',

  // Indisponibilités (profs et installations)
  indisponibilites: '++id, type, refId, jour, heureDebut, heureFin, periodeId, motif',

  // Préférences enseignants (soft constraints)
  preferences: '++id, enseignantId, type, valeur, poids',

  // Contraintes personnalisées
  contraintes: '++id, nom, type, niveau, params, actif',

  // Créneaux de l'établissement
  creneaux: '++id, jour, heureDebut, heureFin, label, ordre',

  // Snapshots (versions)
  snapshots: '++id, nom, date, description, data',

  // Journal de modifications
  changelog: '++id, date, action, entite, entiteId, details',

  // Configuration projet
  config: 'cle',
});

// Version 2 — nouvelles tables + champs non-indexés pour programmation annuelle
db.version(2).stores({
  // Tables existantes (inchangées au niveau index)
  etablissement: '++id, nom, type',
  periodes: '++id, nom, type, dateDebut, dateFin, parentId, niveau, ordre',
  enseignants: '++id, nom, prenom, initiales',
  classes: '++id, nom, niveau, effectif, enseignantId',
  activites: '++id, nom, champApprentissage, code',
  lieux: '++id, nom, type, necessiteBus',
  installations: '++id, lieuId, nom, capaciteSimultanee',
  zones: '++id, installationId, nom',
  programmations: '++id, classeId, activiteId, periodeId, installationId, zoneId, creneauClasseId, statut',
  seances: '++id, classeId, enseignantId, activiteId, installationId, zoneId, jour, heureDebut, heureFin, periodeId, verrouille',
  reservations: '++id, seanceId, installationId, statut, periodeId',
  transports: '++id, seanceId, jour, lieuId, classeId, enseignantId',
  indisponibilites: '++id, type, refId, jour, heureDebut, heureFin, periodeId, motif',
  preferences: '++id, enseignantId, type, valeur, poids',
  contraintes: '++id, nom, type, niveau, params, actif',
  creneaux: '++id, jour, heureDebut, heureFin, label, ordre',
  snapshots: '++id, nom, date, description, data',
  changelog: '++id, date, action, entite, entiteId, details',
  config: 'cle',

  // Nouvelle table : créneaux-classes (structure horaire par classe)
  // Un créneau-classe = un slot fixe de la semaine pour une classe donnée
  creneauxClasses: '++id, classeId, enseignantId, jour, heureDebut, heureFin',

  // Nouvelle table : modèles de programmation par niveau
  // Définit la structure créneaux + rotation activités par période
  modelesNiveau: '++id, niveau, nom',
}).upgrade(tx => {
  // Migration des activités existantes : ajouter champs non-indexés
  return tx.table('activites').toCollection().modify(act => {
    if (!act.niveaux) act.niveaux = [];           // niveaux de classe concernés
    if (!act.heuresHebdo) act.heuresHebdo = null;  // durée hebdo par défaut
    if (!act.dureeSlot) act.dureeSlot = null;       // durée du slot en minutes
  }).then(() => {
    // Migration des installations : ajouter activités compatibles
    return tx.table('installations').toCollection().modify(inst => {
      if (!inst.activitesCompatibles) inst.activitesCompatibles = []; // IDs activités
    });
  }).then(() => {
    // Migration des programmations : ajouter champs
    return tx.table('programmations').toCollection().modify(prog => {
      if (!prog.creneauClasseId) prog.creneauClasseId = null;
      if (!prog.statut) prog.statut = 'propose'; // propose | accepte | a_reconsiderer
    });
  });
});

export default db;

/**
 * Initialise la configuration par défaut si la base est vide
 */
export async function initDefaultConfig() {
  const count = await db.config.count();
  if (count > 0) return;

  const defaults = {
    joursOuvres: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],
    heureDebut: '08:00',
    heureFin: '17:00',
    pasSlot: 30, // minutes
    maxHeuresJourProf: 6,
    minEcartSeancesCollegeH: 24,
    dureeTrajetDefautMin: 15,
    anneeScolaire: '2025-2026',
    etablissementNom: '',
    etablissementType: 'mixte', // college | lycee | mixte
    etablissementZone: 'B', // zone vacances scolaires : A | B | C
    contrainte_max_heures_actif: true,
    contrainte_ecart_24h_actif: true,
    contrainte_1prof_1classe_actif: true,
  };

  for (const [cle, valeur] of Object.entries(defaults)) {
    await db.config.put({ cle, valeur: JSON.stringify(valeur) });
  }
}

/**
 * Récupère une valeur de config
 */
export async function getConfig(cle) {
  const row = await db.config.get(cle);
  return row ? JSON.parse(row.valeur) : null;
}

/**
 * Met à jour une valeur de config
 */
export async function setConfig(cle, valeur) {
  await db.config.put({ cle, valeur: JSON.stringify(valeur) });
}
