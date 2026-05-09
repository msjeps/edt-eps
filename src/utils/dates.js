/**
 * Utilitaires dates & calendrier scolaire
 * Gestion des vacances par zone (A, B, C, CORSE) et des jours fériés
 * Sources primaires : API Éducation nationale + api.gouv.fr (via calendrier-api.js)
 * Fallback        : données hardcodées ci-dessous si hors-ligne sans cache
 */
import { loadCalendrierScolaire } from './calendrier-api.js';

// ============================================================
// ANNÉES SCOLAIRES DISPONIBLES
// ============================================================

/**
 * Années de base toujours disponibles (fallback hardcodé).
 * Le wizard complète cette liste avec les années disponibles dans l'API.
 */
export const ANNEES_SCOLAIRES = [
  '2024-2025',
  '2025-2026',
  '2026-2027',
];

// ============================================================
// VACANCES SCOLAIRES PAR ANNÉE ET PAR ZONE
// Convention : debut = samedi début vacances, fin = lundi reprise cours
// Source : Arrêtés publiés au Journal officiel
// ============================================================

export const VACANCES_SCOLAIRES = {
  // ── 2024-2025 ──
  // Source : Arrêté du 7 décembre 2022 (Légifrance JORFTEXT000046704476)
  '2024-2025': {
    commun: [
      { nom: 'Toussaint', debut: '2024-10-19', fin: '2024-11-04' },
      { nom: 'Noël', debut: '2024-12-21', fin: '2025-01-06' },
    ],
    A: [
      { nom: 'Hiver', debut: '2025-02-22', fin: '2025-03-10' },
      { nom: 'Printemps', debut: '2025-04-19', fin: '2025-05-05' },
    ],
    B: [
      { nom: 'Hiver', debut: '2025-02-08', fin: '2025-02-24' },
      { nom: 'Printemps', debut: '2025-04-05', fin: '2025-04-22' },
    ],
    C: [
      { nom: 'Hiver', debut: '2025-02-15', fin: '2025-03-03' },
      { nom: 'Printemps', debut: '2025-04-12', fin: '2025-04-28' },
    ],
  },

  // ── 2025-2026 ──
  // Source : Arrêté du 7 décembre 2022 (Légifrance JORFTEXT000046704476)
  '2025-2026': {
    commun: [
      { nom: 'Toussaint', debut: '2025-10-18', fin: '2025-11-03' },
      { nom: 'Noël', debut: '2025-12-20', fin: '2026-01-05' },
    ],
    A: [
      { nom: 'Hiver', debut: '2026-02-21', fin: '2026-03-09' },
      { nom: 'Printemps', debut: '2026-04-18', fin: '2026-05-04' },
    ],
    B: [
      { nom: 'Hiver', debut: '2026-02-14', fin: '2026-03-02' },
      { nom: 'Printemps', debut: '2026-04-11', fin: '2026-04-27' },
    ],
    C: [
      { nom: 'Hiver', debut: '2026-02-07', fin: '2026-02-23' },
      { nom: 'Printemps', debut: '2026-04-04', fin: '2026-04-20' },
    ],
  },

  // ── 2026-2027 ──
  // Source : Arrêté du 22 octobre 2025 (Légifrance JORFTEXT000052416058)
  // Note : Montpellier et Toulouse passent en zone C pour 2026-2027
  '2026-2027': {
    commun: [
      { nom: 'Toussaint', debut: '2026-10-17', fin: '2026-11-02' },
      { nom: 'Noël', debut: '2026-12-19', fin: '2027-01-04' },
      // Pont de l'Ascension traité comme vacances en 2026-2027
      // "du mercredi 5 mai après les cours au lundi 10 mai 2027"
      { nom: 'Pont Ascension', debut: '2027-05-05', fin: '2027-05-10' },
    ],
    A: [
      { nom: 'Hiver', debut: '2027-02-13', fin: '2027-03-01' },
      { nom: 'Printemps', debut: '2027-04-10', fin: '2027-04-26' },
    ],
    B: [
      { nom: 'Hiver', debut: '2027-02-20', fin: '2027-03-08' },
      { nom: 'Printemps', debut: '2027-04-17', fin: '2027-05-03' },
    ],
    C: [
      { nom: 'Hiver', debut: '2027-02-06', fin: '2027-02-22' },
      { nom: 'Printemps', debut: '2027-04-03', fin: '2027-04-19' },
    ],
  },
};

// ============================================================
// JOURS FÉRIÉS PAR ANNÉE SCOLAIRE
// ============================================================

export const JOURS_FERIES = {
  // ── 2024-2025 ──
  '2024-2025': [
    { nom: 'Armistice', date: '2024-11-11' },
    { nom: 'Lundi de Pâques', date: '2025-04-21' },       // Pâques = 20 avril 2025
    { nom: 'Fête du travail', date: '2025-05-01' },
    { nom: 'Victoire 1945', date: '2025-05-08' },
    { nom: 'Ascension', date: '2025-05-29' },
    { nom: 'Pont Ascension', date: '2025-05-30' },
    { nom: 'Lundi de Pentecôte', date: '2025-06-09' },
  ],

  // ── 2025-2026 ──
  '2025-2026': [
    { nom: 'Armistice', date: '2025-11-11' },
    { nom: 'Lundi de Pâques', date: '2026-04-06' },       // Pâques = 5 avril 2026
    { nom: 'Fête du travail', date: '2026-05-01' },
    { nom: 'Victoire 1945', date: '2026-05-08' },
    { nom: 'Ascension', date: '2026-05-14' },
    { nom: 'Pont Ascension', date: '2026-05-15' },
    { nom: 'Lundi de Pentecôte', date: '2026-05-25' },
  ],

  // ── 2026-2027 ──
  // Pont Ascension déjà inclus dans les vacances communes ci-dessus
  '2026-2027': [
    { nom: 'Armistice', date: '2026-11-11' },
    { nom: 'Lundi de Pâques', date: '2027-03-29' },       // Pâques = 28 mars 2027
    { nom: 'Fête du travail', date: '2027-05-01' },       // Samedi → pas d'impact scolaire
    { nom: 'Victoire 1945', date: '2027-05-08' },         // Samedi → pas d'impact scolaire
    { nom: 'Lundi de Pentecôte', date: '2027-05-17' },
  ],
};

// ============================================================
// FONCTIONS PUBLIQUES
// ============================================================

/**
 * Retourne les vacances depuis le fallback hardcodé.
 * Zones A, B, C uniquement (données hardcodées avant API).
 */
function getVacancesHardcoded(zone, anneeScolaire) {
  const cal = VACANCES_SCOLAIRES[anneeScolaire];
  if (!cal) return [];
  const zoneUpper = (zone || 'B').toUpperCase();
  // CORSE non présente en hardcodé → fallback Zone B
  const zoneKey = ['A', 'B', 'C'].includes(zoneUpper) ? zoneUpper : 'B';
  return [...(cal.commun || []), ...(cal[zoneKey] || [])];
}

/**
 * Retourne les périodes de vacances (synchrone, depuis fallback hardcodé).
 * Pour la version async avec API, utiliser getCalendrierExclusions().
 * @param {string} zone - 'A' | 'B' | 'C' | 'CORSE'
 * @param {string} anneeScolaire - ex: '2025-2026'
 */
export function getVacancesParZone(zone = 'B', anneeScolaire = '2025-2026') {
  return getVacancesHardcoded(zone, anneeScolaire);
}

/**
 * Retourne les jours fériés (synchrone, fallback hardcodé).
 * @param {string} anneeScolaire - ex: '2025-2026'
 */
export function getJoursFeries(anneeScolaire = '2025-2026') {
  return JOURS_FERIES[anneeScolaire] || [];
}

/**
 * Retourne les exclusions calendaires (vacances + fériés) pour les exports.
 * Utilise l'API si disponible en cache, sinon le fallback hardcodé.
 * @param {string} zone - 'A' | 'B' | 'C' | 'CORSE'
 * @param {string} anneeScolaire - ex: '2025-2026'
 * @returns {Promise<Array<{debut, fin}>>}
 */
export async function getCalendrierExclusions(zone = 'B', anneeScolaire = '2025-2026') {
  const zoneUpper = (zone || 'B').toUpperCase();
  let vacances = [];
  let feries = [];

  // Essayer l'API (retourne null si hors-ligne sans cache)
  const apiData = await loadCalendrierScolaire(anneeScolaire);
  if (apiData) {
    vacances = apiData.vacances[zoneUpper] || apiData.vacances['B'] || [];
    feries = apiData.feries || [];
  } else {
    vacances = getVacancesHardcoded(zoneUpper, anneeScolaire);
    feries = getJoursFeries(anneeScolaire);
  }

  const exclusions = vacances.map(v => ({ debut: v.debut, fin: v.fin }));
  for (const jf of feries) {
    exclusions.push({ debut: jf.date, fin: jf.date });
  }
  return exclusions;
}

/**
 * Génère la liste des dates pour un jour de la semaine donné
 * entre deux dates, en excluant vacances et jours fériés
 * @param {string} jour - 'lundi' | 'mardi' | etc.
 * @param {Date} dateDebut
 * @param {Date} dateFin
 * @param {Array} vacances - Liste de périodes de vacances [{debut, fin}]
 * @returns {Array<string>} Dates au format DD/MM
 */
export function genererDatesJour(jour, dateDebut, dateFin, vacances = []) {
  const jourLower = (jour || '').toLowerCase().trim();
  const jourIndex = {
    dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  }[jourLower];

  if (jourIndex === undefined) return [];

  const dates = [];
  const current = new Date(dateDebut);

  // Avancer jusqu'au premier jour correspondant
  while (current.getDay() !== jourIndex) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= dateFin) {
    // Comparer en chaîne YYYY-MM-DD pour éviter les problèmes de timezone
    // (new Date('2026-05-01') = UTC minuit, mais current = heure locale)
    const currentStr = toISOLocal(current);

    const estExclue = vacances.some(v => {
      return currentStr >= v.debut && currentStr <= v.fin;
    });

    if (!estExclue) {
      dates.push(formatDateCourt(current));
    }

    current.setDate(current.getDate() + 7);
  }

  return dates;
}

/**
 * Convertit une Date en chaîne YYYY-MM-DD (heure locale, pas UTC)
 * Évite le décalage de timezone de toISOString()
 */
function toISOLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formate une date en DD/MM
 */
function formatDateCourt(date) {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Rétro-compatibilité : ancien export zone B hardcodé
 * @deprecated Utiliser getVacancesParZone('B') à la place
 */
export const VACANCES_ZONE_B_2025_2026 = [
  { nom: 'Toussaint', debut: '2025-10-18', fin: '2025-11-03' },
  { nom: 'Noël', debut: '2025-12-20', fin: '2026-01-05' },
  { nom: 'Hiver', debut: '2026-02-14', fin: '2026-03-02' },
  { nom: 'Printemps', debut: '2026-04-11', fin: '2026-04-27' },
];

/**
 * Vérifie si une date est un jour ouvré scolaire
 * @param {Date} date
 * @param {Array} exclusions - Périodes de vacances + jours fériés [{debut, fin}]
 */
export function estJourOuvre(date, exclusions = null) {
  const d = new Date(date);
  const jour = d.getDay();
  if (jour === 0 || jour === 6) return false; // weekend

  // Comparer en chaîne YYYY-MM-DD pour éviter les problèmes de timezone
  const dateStr = toISOLocal(d);
  const periodes = exclusions || VACANCES_ZONE_B_2025_2026;
  return !periodes.some(v => {
    return dateStr >= v.debut && dateStr <= v.fin;
  });
}

/**
 * Nombre de semaines entre deux dates
 */
export function nbSemaines(dateDebut, dateFin) {
  const msParSemaine = 7 * 24 * 60 * 60 * 1000;
  return Math.ceil((new Date(dateFin) - new Date(dateDebut)) / msParSemaine);
}

/**
 * Label lisible pour une zone
 * Note : la composition des zones peut changer d'une année à l'autre
 */
export function zoneLabel(zone) {
  const labels = {
    A:     'Zone A — Lyon, Bordeaux, Besançon, Clermont-Ferrand, Dijon, Grenoble, Limoges, Poitiers',
    B:     'Zone B — Nice, Aix-Marseille, Lille, Nantes, Rennes, Strasbourg, Amiens, Normandie, Nancy-Metz, Orléans-Tours, Reims',
    C:     'Zone C — Paris, Créteil, Versailles, Montpellier, Toulouse',
    CORSE: 'Corse — Ajaccio, Bastia',
  };
  return labels[zone] || `Zone ${zone}`;
}

/**
 * Label court pour une zone
 */
export function zoneLabelCourt(zone) {
  const labels = {
    A: 'Zone A',
    B: 'Zone B',
    C: 'Zone C',
  };
  return labels[zone] || `Zone ${zone}`;
}
