/**
 * Résolution de conflits — suggestions automatiques
 * Propose des déplacements, swaps et changements d'installation
 */
import { creneauxChevauche, heureToMinutes, validerSeance } from './constraints.js';

/**
 * Génère des suggestions de résolution pour un conflit donné
 * @param {Object} conflit - Le conflit détecté
 * @param {Object} context - Contexte complet (seances, classes, installations, etc.)
 * @returns {Array} Liste de suggestions avec score d'impact
 */
export function genererSuggestions(conflit, context) {
  const suggestions = [];

  switch (conflit.type) {
    case 'conflit_enseignant':
    case 'conflit_classe':
      suggestions.push(...suggestionsDeplacements(conflit, context));
      suggestions.push(...suggestionsSwaps(conflit, context));
      break;

    case 'conflit_installation':
      suggestions.push(...suggestionsChangementInstallation(conflit, context));
      suggestions.push(...suggestionsDeplacements(conflit, context));
      break;

    case 'ecart_24h':
      suggestions.push(...suggestionsDeplacements(conflit, context));
      break;

    case 'max_heures_jour':
      suggestions.push(...suggestionsDeplacementAutreJour(conflit, context));
      break;

    case 'incompatibilite':
      suggestions.push(...suggestionsChangementInstallation(conflit, context));
      break;
  }

  // Trier par score d'impact (meilleur en premier)
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, 5); // Max 5 suggestions
}

/**
 * Propose des créneaux libres pour déplacer une séance
 */
function suggestionsDeplacements(conflit, context) {
  const { seances, classes, installations, activites, indisponibilites } = context;
  const seance = conflit.seance;
  const suggestions = [];
  const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
  const duree = heureToMinutes(seance.heureFin) - heureToMinutes(seance.heureDebut);

  // Tester chaque créneau possible
  for (const jour of jours) {
    for (let startMin = 480; startMin <= 1020 - duree; startMin += 30) { // 8h à 17h
      const hDebut = minutesToHeure(startMin);
      const hFin = minutesToHeure(startMin + duree);
      const candidate = { ...seance, jour, heureDebut: hDebut, heureFin: hFin };

      // Vérifier que ce créneau ne crée aucun conflit
      const conflits = validerSeance(candidate, {
        seances: seances.filter(s => s.id !== seance.id),
        classes,
        installations,
        activites,
        indisponibilites,
      });

      if (conflits.length === 0) {
        const score = calculerScore(seance, candidate, context);
        suggestions.push({
          type: 'deplacement',
          description: `Déplacer vers ${jour} ${hDebut}-${hFin}`,
          seanceId: seance.id,
          nouvelles: { jour, heureDebut: hDebut, heureFin: hFin },
          score,
        });
      }
    }
  }

  return suggestions;
}

/**
 * Propose des échanges (swaps) entre deux blocs
 */
function suggestionsSwaps(conflit, context) {
  const { seances, classes, installations, activites, indisponibilites } = context;
  const seance = conflit.seance;
  const suggestions = [];

  // Chercher des séances du même enseignant qu'on pourrait échanger
  const seancesMemProf = seances.filter(s =>
    s.id !== seance.id &&
    s.enseignantId === seance.enseignantId &&
    !s.verrouille
  );

  for (const cible of seancesMemProf) {
    // Simuler l'échange
    const seanceSwapped = { ...seance, jour: cible.jour, heureDebut: cible.heureDebut, heureFin: cible.heureFin };
    const cibleSwapped = { ...cible, jour: seance.jour, heureDebut: seance.heureDebut, heureFin: seance.heureFin };

    const autresSeances = seances.filter(s => s.id !== seance.id && s.id !== cible.id);

    const conflitsA = validerSeance(seanceSwapped, {
      seances: [...autresSeances, cibleSwapped],
      classes, installations, activites, indisponibilites,
    });

    const conflitsB = validerSeance(cibleSwapped, {
      seances: [...autresSeances, seanceSwapped],
      classes, installations, activites, indisponibilites,
    });

    if (conflitsA.length === 0 && conflitsB.length === 0) {
      suggestions.push({
        type: 'swap',
        description: `Échanger avec ${cible.jour} ${cible.heureDebut}-${cible.heureFin}`,
        seanceId: seance.id,
        cibleId: cible.id,
        score: 8,
      });
    }
  }

  return suggestions;
}

/**
 * Propose des installations alternatives
 */
function suggestionsChangementInstallation(conflit, context) {
  const { seances, installations, activites } = context;
  const seance = conflit.seance;
  const activite = activites.find(a => a.id === seance.activiteId);
  const suggestions = [];

  for (const install of installations) {
    if (install.id === seance.installationId) continue;

    // Vérifier la compatibilité activité ↔ installation
    if (activite?.exigenceInstallation && install.id !== activite.exigenceInstallation) continue;

    // Vérifier la capacité
    const simultanées = seances.filter(s =>
      s.id !== seance.id &&
      s.installationId === install.id &&
      creneauxChevauche(s, seance)
    );

    if (simultanées.length < install.capaciteSimultanee) {
      suggestions.push({
        type: 'changement_installation',
        description: `Changer vers ${install.nom}`,
        seanceId: seance.id,
        nouvelleInstallation: install.id,
        score: 7,
      });
    }
  }

  return suggestions;
}

/**
 * Propose de déplacer une séance sur un autre jour (pour max heures/jour)
 */
function suggestionsDeplacementAutreJour(conflit, context) {
  const suggestions = suggestionsDeplacements(conflit, context);
  // Filtrer pour ne garder que les déplacements sur un autre jour
  return suggestions.filter(s => s.nouvelles.jour !== conflit.seance.jour);
}

/**
 * Score d'impact d'une suggestion (0-10, 10 = meilleur)
 */
function calculerScore(seanceOriginale, seanceCandidate, context) {
  let score = 10;

  // Pénalité si on change de jour
  if (seanceOriginale.jour !== seanceCandidate.jour) score -= 2;

  // Pénalité si on s'éloigne beaucoup de l'heure d'origine
  const ecartMinutes = Math.abs(
    heureToMinutes(seanceOriginale.heureDebut) - heureToMinutes(seanceCandidate.heureDebut)
  );
  if (ecartMinutes > 120) score -= 2;
  else if (ecartMinutes > 60) score -= 1;

  return Math.max(0, score);
}

/**
 * Convertit des minutes depuis minuit en "HH:MM"
 */
function minutesToHeure(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Applique une suggestion de résolution
 */
export async function appliquerSuggestion(suggestion, seanceStore) {
  switch (suggestion.type) {
    case 'deplacement':
      await seanceStore.update(suggestion.seanceId, suggestion.nouvelles);
      break;

    case 'swap': {
      const seanceA = await seanceStore.getById(suggestion.seanceId);
      const seanceB = await seanceStore.getById(suggestion.cibleId);
      if (seanceA && seanceB) {
        await seanceStore.update(seanceA.id, {
          jour: seanceB.jour,
          heureDebut: seanceB.heureDebut,
          heureFin: seanceB.heureFin,
        });
        await seanceStore.update(seanceB.id, {
          jour: seanceA.jour,
          heureDebut: seanceA.heureDebut,
          heureFin: seanceA.heureFin,
        });
      }
      break;
    }

    case 'changement_installation':
      await seanceStore.update(suggestion.seanceId, {
        installationId: suggestion.nouvelleInstallation,
      });
      break;
  }
}
