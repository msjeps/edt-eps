/**
 * Moteur de contraintes EDT EPS
 * Vérifie les contraintes hard et soft sur les séances
 */

// === Jours de la semaine avec index pour calcul d'écart ===
const JOURS_INDEX = {
  lundi: 0, mardi: 1, mercredi: 2, jeudi: 3, vendredi: 4,
};

const NIVEAUX_COLLEGE = ['6e', '5e', '4e', '3e'];

/**
 * Convertit une heure "HH:MM" en minutes depuis minuit
 */
export function heureToMinutes(heure) {
  const [h, m] = heure.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Calcule la durée d'un bloc en heures
 */
export function dureeBloc(heureDebut, heureFin) {
  return (heureToMinutes(heureFin) - heureToMinutes(heureDebut)) / 60;
}

/**
 * Vérifie si deux créneaux se chevauchent
 */
export function creneauxChevauche(a, b) {
  if (a.jour !== b.jour) return false;
  const aStart = heureToMinutes(a.heureDebut);
  const aEnd = heureToMinutes(a.heureFin);
  const bStart = heureToMinutes(b.heureDebut);
  const bEnd = heureToMinutes(b.heureFin);
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Calcule l'écart en heures entre deux séances (pour contrainte 24h collège)
 * Prend en compte les jours de la semaine
 */
export function ecartEntreSeances(seanceA, seanceB) {
  const jourA = JOURS_INDEX[seanceA.jour];
  const jourB = JOURS_INDEX[seanceB.jour];
  if (jourA === undefined || jourB === undefined) return Infinity;

  const minutesA = jourA * 24 * 60 + heureToMinutes(seanceA.heureDebut);
  const minutesB = jourB * 24 * 60 + heureToMinutes(seanceB.heureDebut);
  return Math.abs(minutesB - minutesA) / 60;
}

// === CONTRAINTES HARD ===

/**
 * Vérifie si deux séances sont sur la même période
 * (null = toutes les périodes → considéré comme "même période")
 */
function memePeriode(a, b) {
  // Si l'une n'a pas de période assignée, elles peuvent se chevaucher
  if (!a.periodeId || !b.periodeId) return true;
  return a.periodeId === b.periodeId;
}

/**
 * Vérifie qu'un enseignant n'est pas en double sur le même créneau
 * (même période uniquement — des créneaux identiques sur des périodes
 *  différentes ne sont pas des conflits car ils ne coexistent pas)
 */
export function conflitEnseignant(seance, toutesSeances) {
  return toutesSeances.filter(s =>
    s.id !== seance.id &&
    s.enseignantId === seance.enseignantId &&
    memePeriode(s, seance) &&
    creneauxChevauche(s, seance)
  );
}

/**
 * Vérifie qu'une classe n'est pas en double sur le même créneau
 * (même période uniquement)
 */
export function conflitClasse(seance, toutesSeances) {
  return toutesSeances.filter(s =>
    s.id !== seance.id &&
    s.classeId === seance.classeId &&
    memePeriode(s, seance) &&
    creneauxChevauche(s, seance)
  );
}

/**
 * Vérifie qu'une installation n'est pas en surcharge
 * (capacité simultanée dépassée, même période uniquement)
 */
export function conflitInstallation(seance, toutesSeances, installations) {
  const install = installations.find(i => i.id === seance.installationId);
  if (!install) return [];

  const simultanées = toutesSeances.filter(s =>
    s.id !== seance.id &&
    s.installationId === seance.installationId &&
    memePeriode(s, seance) &&
    creneauxChevauche(s, seance)
  );

  // +1 pour la séance courante
  if (simultanées.length + 1 > install.capaciteSimultanee) {
    return simultanées;
  }
  return [];
}

/**
 * Vérifie la contrainte 24h minimum entre deux séances
 * d'une même classe de collège (même période uniquement)
 */
export function conflitEcart24h(seance, toutesSeances, classes) {
  const classe = classes.find(c => c.id === seance.classeId);
  if (!classe || !NIVEAUX_COLLEGE.includes(classe.niveau)) return [];

  return toutesSeances.filter(s => {
    if (s.id === seance.id || s.classeId !== seance.classeId) return false;
    if (!memePeriode(s, seance)) return false;
    const ecart = ecartEntreSeances(seance, s);
    return ecart > 0 && ecart < 24;
  });
}

/**
 * Vérifie le max 6h/jour pour un enseignant
 * Retourne le nombre total d'heures sur le jour (même période)
 */
export function totalHeuresJour(enseignantId, jour, toutesSeances, excludeAS = true, periodeId = null) {
  const seancesJour = toutesSeances.filter(s =>
    s.enseignantId === enseignantId &&
    s.jour === jour &&
    (!excludeAS || !s.isAS) &&
    (!periodeId || !s.periodeId || s.periodeId === periodeId)
  );

  return seancesJour.reduce((total, s) => {
    return total + dureeBloc(s.heureDebut, s.heureFin);
  }, 0);
}

/**
 * Vérifie la compatibilité activité ↔ installation
 * (ex: natation → piscine obligatoire)
 */
export function conflitCompatibilite(seance, activites, installations) {
  const activite = activites.find(a => a.id === seance.activiteId);
  const install = installations.find(i => i.id === seance.installationId);
  if (!activite || !install) return null;

  // Vérifier si l'activité requiert une installation spécifique
  if (activite.exigenceInstallation &&
      install.id !== activite.exigenceInstallation &&
      !install.activitesCompatibles?.includes(activite.id)) {
    return {
      type: 'incompatibilite',
      message: `${activite.nom} requiert une installation spécifique`,
      activite,
      installation: install,
    };
  }
  return null;
}

/**
 * Vérifie les indisponibilités
 */
export function conflitIndisponibilite(seance, indisponibilites) {
  return indisponibilites.filter(indispo => {
    const matchRef =
      (indispo.type === 'enseignant' && indispo.refId === seance.enseignantId) ||
      (indispo.type === 'installation' && indispo.refId === seance.installationId);

    if (!matchRef) return false;
    if (indispo.jour && indispo.jour !== seance.jour) return false;

    if (indispo.heureDebut && indispo.heureFin) {
      return creneauxChevauche(
        { jour: seance.jour, heureDebut: indispo.heureDebut, heureFin: indispo.heureFin },
        seance
      );
    }
    return true;
  });
}

// === VALIDATION COMPLÈTE ===

/**
 * Valide une séance contre toutes les contraintes hard
 * Retourne un tableau de conflits détectés
 */
export function validerSeance(seance, context) {
  const {
    seances, classes, installations, activites, indisponibilites,
    maxHeuresJour = 6,
    contrainte_max_heures_actif = true,
    contrainte_ecart_24h_actif = true,
    contrainte_1prof_1classe_actif = true,
  } = context;
  const conflits = [];

  // 1. Conflit enseignant
  if (contrainte_1prof_1classe_actif) {
    const confEns = conflitEnseignant(seance, seances);
    if (confEns.length > 0) {
      conflits.push({
        type: 'conflit_enseignant',
        severity: 'high',
        message: `L'enseignant est déjà occupé sur ce créneau`,
        seancesEnConflit: confEns,
        seance,
      });
    }
  }

  // 2. Conflit classe (toujours actif — une classe ne peut être à deux endroits)
  const confClasse = conflitClasse(seance, seances);
  if (confClasse.length > 0) {
    conflits.push({
      type: 'conflit_classe',
      severity: 'high',
      message: `La classe est déjà en cours sur ce créneau`,
      seancesEnConflit: confClasse,
      seance,
    });
  }

  // 3. Conflit installation (capacité)
  const confInstall = conflitInstallation(seance, seances, installations);
  if (confInstall.length > 0) {
    conflits.push({
      type: 'conflit_installation',
      severity: 'high',
      message: `Capacité de l'installation dépassée`,
      seancesEnConflit: confInstall,
      seance,
    });
  }

  // 4. Écart 24h (collège)
  if (contrainte_ecart_24h_actif) {
    const confEcart = conflitEcart24h(seance, seances, classes);
    if (confEcart.length > 0) {
      conflits.push({
        type: 'ecart_24h',
        severity: 'high',
        message: `Moins de 24h entre deux séances de la même classe (collège)`,
        seancesEnConflit: confEcart,
        seance,
      });
    }
  }

  // 5. Max heures/jour enseignant (par période)
  if (contrainte_max_heures_actif) {
    const heuresJour = totalHeuresJour(seance.enseignantId, seance.jour, seances, true, seance.periodeId);
    if (heuresJour > maxHeuresJour) {
      conflits.push({
        type: 'max_heures_jour',
        severity: 'high',
        message: `L'enseignant dépasse ${maxHeuresJour}h sur ${seance.jour} (${heuresJour}h)`,
        seance,
      });
    }
  }

  // 6. Compatibilité activité ↔ installation
  const confCompat = conflitCompatibilite(seance, activites, installations);
  if (confCompat) {
    conflits.push({
      ...confCompat,
      severity: 'high',
      seance,
    });
  }

  // 7. Indisponibilités
  if (indisponibilites) {
    const confIndispo = conflitIndisponibilite(seance, indisponibilites);
    if (confIndispo.length > 0) {
      conflits.push({
        type: 'indisponibilite',
        severity: 'high',
        message: `Créneau en conflit avec une indisponibilité`,
        indisponibilites: confIndispo,
        seance,
      });
    }
  }

  return conflits;
}

/**
 * Valide toutes les séances et retourne la liste complète des conflits
 */
export function validerToutesSeances(context) {
  const { seances } = context;
  const tousConflits = [];
  const dejaVus = new Set();

  for (const seance of seances) {
    const conflits = validerSeance(seance, context);
    for (const conflit of conflits) {
      // Éviter les doublons (A conflit B = B conflit A)
      const cle = genererCleConflit(conflit);
      if (!dejaVus.has(cle)) {
        dejaVus.add(cle);
        tousConflits.push(conflit);
      }
    }
  }

  return tousConflits;
}

function genererCleConflit(conflit) {
  const seanceId = conflit.seance?.id || '';
  const autreIds = (conflit.seancesEnConflit || []).map(s => s.id).sort().join(',');
  return `${conflit.type}:${seanceId}:${autreIds}`;
}
