/**
 * Validateur de configuration du projet.
 * Vérifie la complétude avant d'autoriser l'accès aux vues opérationnelles.
 */
import db from '../db/schema.js';

/**
 * Lance tous les contrôles et retourne { errors, warnings }.
 * errors   → problèmes bloquants (accès EDT / Programmation refusé)
 * warnings → problèmes signalés (accès autorisé mais à corriger)
 *
 * Chaque item : { code, message, detail, goto, gotoLabel }
 */
export async function validateProjectConfig() {
  const [periodes, enseignants, classes, installations, creneauxClasses] = await Promise.all([
    db.periodes.toArray(),
    db.enseignants.toArray(),
    db.classes.toArray(),
    db.installations.toArray(),
    db.creneauxClasses.toArray(),
  ]);

  const errors = [];
  const warnings = [];

  // ── ERREURS BLOQUANTES ──────────────────────────────────────────────────────

  if (enseignants.length === 0) {
    errors.push({
      code: 'NO_ENSEIGNANTS',
      message: 'Aucun enseignant défini',
      detail: 'Ajoutez au moins un enseignant EPS pour créer des séances.',
      goto: 'wizard',
      gotoLabel: 'Configurer',
    });
  }

  if (classes.length === 0) {
    errors.push({
      code: 'NO_CLASSES',
      message: 'Aucune classe définie',
      detail: 'Ajoutez au moins une classe pour créer des séances.',
      goto: 'wizard',
      gotoLabel: 'Configurer',
    });
  }

  if (periodes.length === 0) {
    errors.push({
      code: 'NO_PERIODES',
      message: 'Aucune période définie',
      detail: "L'EDT nécessite au moins une période (trimestre, semestre…).",
      goto: 'wizard',
      gotoLabel: 'Configurer',
    });
  } else {
    const sansDate = periodes.filter(p => !p.dateDebut || !p.dateFin);
    if (sansDate.length > 0) {
      errors.push({
        code: 'PERIODES_SANS_DATES',
        message: `${sansDate.length === 1 ? '1 période' : `${sansDate.length} périodes`} sans dates`,
        detail: sansDate.map(p => p.nom).join(', '),
        goto: 'wizard',
        gotoLabel: 'Corriger',
      });
    }
  }

  if (installations.length === 0) {
    errors.push({
      code: 'NO_INSTALLATIONS',
      message: 'Aucune installation sportive définie',
      detail: 'Ajoutez au moins une installation pour planifier des séances.',
      goto: 'wizard',
      gotoLabel: 'Configurer',
    });
  }

  // ── AVERTISSEMENTS ──────────────────────────────────────────────────────────

  if (classes.length > 0 && enseignants.length > 0) {
    const enseignantIds = new Set(enseignants.map(e => e.id));
    const classesSansProf = classes.filter(c => !c.enseignantId || !enseignantIds.has(c.enseignantId));
    if (classesSansProf.length > 0) {
      warnings.push({
        code: 'CLASSES_SANS_ENSEIGNANT',
        message: `${classesSansProf.length === 1 ? '1 classe' : `${classesSansProf.length} classes`} sans enseignant assigné`,
        detail: classesSansProf.map(c => c.nom).join(', '),
        goto: 'donnees',
        gotoLabel: 'Corriger',
      });
    }
  }

  if (enseignants.length > 0 && classes.length > 0) {
    const enseignantsAvecClasse = new Set(classes.map(c => c.enseignantId).filter(Boolean));
    const sansClasse = enseignants.filter(e => !enseignantsAvecClasse.has(e.id));
    if (sansClasse.length > 0) {
      warnings.push({
        code: 'ENSEIGNANTS_SANS_CLASSE',
        message: `${sansClasse.length === 1 ? '1 enseignant' : `${sansClasse.length} enseignants`} sans classe associée`,
        detail: sansClasse.map(e => `${e.prenom} ${e.nom}`).join(', '),
        goto: 'donnees',
        gotoLabel: 'Vérifier',
      });
    }
  }

  if (creneauxClasses.length === 0 && classes.length > 0) {
    warnings.push({
      code: 'NO_CRENEAUX',
      message: 'Aucun créneau horaire défini',
      detail: 'Définissez les créneaux de chaque classe dans la Programmation.',
      goto: 'programmation',
      gotoLabel: 'Configurer',
    });
  }

  return { errors, warnings };
}

/**
 * Retourne true si la configuration permet d'accéder à l'EDT.
 */
export async function isConfigComplete() {
  const { errors } = await validateProjectConfig();
  return errors.length === 0;
}
