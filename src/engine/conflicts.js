/**
 * Résolution de conflits — suggestions automatiques
 * Propose des déplacements, swaps et changements d'installation
 */
import { creneauxChevauche, heureToMinutes, validerSeance } from './constraints.js';

// Temps méridien exclu des suggestions : ne pas proposer de créneau qui chevauche 12h-14h
const MERIDIEN_DEBUT = 12 * 60; // 720 min
const MERIDIEN_FIN   = 14 * 60; // 840 min
function chevauche_meridien(startMin, endMin) {
  return startMin < MERIDIEN_FIN && endMin > MERIDIEN_DEBUT;
}

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
      suggestions.push(...suggestionsDeplacements(conflit, context, 1));
      suggestions.push(...suggestionsSwaps(conflit, context));
      break;

    case 'conflit_installation':
    case 'indisponibilite': {
      // Priorité : même lieu (10) > autre lieu compatible (8) > 1 créneau (7)
      const instSugs = suggestionsChangementInstallation(conflit, context);
      suggestions.push(...instSugs);
      if (suggestions.length === 0) {
        suggestions.push(...suggestionsDeplacements(conflit, context, 1));
      } else {
        // Ajouter au plus 1 créneau alternatif en dernier recours
        const slot = suggestionsDeplacements(conflit, context, 1);
        suggestions.push(...slot);
      }
      break;
    }

    case 'ecart_24h':
      suggestions.push(...suggestionsDeplacements(conflit, context, 1));
      break;

    case 'max_heures_jour':
      suggestions.push(...suggestionsDeplacementAutreJour(conflit, context));
      break;

    case 'incompatibilite':
      suggestions.push(...suggestionsChangementInstallation(conflit, context));
      break;
  }

  // Trier par score d'impact (meilleur en premier), max 4 suggestions
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, 4);
}

/**
 * Propose des créneaux libres pour déplacer une séance.
 * @param {number} maxResults - Nombre max de suggestions (défaut illimité, passer 1 pour 1 seul créneau)
 */
function suggestionsDeplacements(conflit, context, maxResults = Infinity) {
  const { seances, classes, installations, activites, indisponibilites } = context;
  const seance = conflit.seance;
  const suggestions = [];
  const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
  const duree = heureToMinutes(seance.heureFin) - heureToMinutes(seance.heureDebut);

  // Tester chaque créneau possible
  for (const jour of jours) {
    for (let startMin = 480; startMin <= 1020 - duree; startMin += 30) { // 8h à 17h
      // Exclure le temps méridien (tout créneau qui chevauche 12h-14h)
      if (chevauche_meridien(startMin, startMin + duree)) continue;

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
          description: `Déplacer vers ${jour} ${hDebut}–${hFin}`,
          seanceId: seance.id,
          nouvelles: { jour, heureDebut: hDebut, heureFin: hFin },
          score: Math.min(score, 7), // Les déplacements de créneau plafonnent à 7
        });
        if (suggestions.length >= maxResults) return suggestions;
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
 * Propose des installations alternatives.
 * Score 10 : autre installation sur le même lieu.
 * Score  8 : installation sur un autre lieu, compatible avec l'activité.
 */
function suggestionsChangementInstallation(conflit, context) {
  const { seances, installations, lieux = [], activites } = context;
  const seance = conflit.seance;
  const activite = activites.find(a => a.id === seance.activiteId);

  // Lieu de l'installation actuelle
  const currentInstId = seance.installationId
    || seance.installationsIds?.[0]
    || null;
  const currentInst = installations.find(i => i.id === currentInstId);
  const currentLieuId = currentInst?.lieuId ?? null;

  const suggestions = [];

  for (const install of installations) {
    if (install.id === currentInstId) continue;

    // Compatibilité activité ↔ installation
    if (activite?.exigenceInstallation
      && install.id !== activite.exigenceInstallation
      && !install.activitesCompatibles?.includes(activite.id)) continue;

    // Vérifier la capacité à ce créneau
    const simultanées = seances.filter(s => {
      if (s.id === seance.id) return false;
      const sIds = s.installationsIds?.length
        ? s.installationsIds
        : (s.installationId ? [s.installationId] : []);
      return sIds.includes(install.id) && creneauxChevauche(s, seance);
    });
    if (simultanées.length >= install.capaciteSimultanee) continue;

    const lieu = lieux.find(l => l.id === install.lieuId);
    const memeLieu = currentLieuId && install.lieuId === currentLieuId;
    const score = memeLieu ? 10 : 8;
    const lieuLabel = lieu ? `${lieu.nom} › ` : '';

    suggestions.push({
      type: 'changement_installation',
      description: `${memeLieu ? '✓ Même lieu' : '↗ Autre lieu'} — ${lieuLabel}${install.nom}`,
      seanceId: seance.id,
      nouvelleInstallation: install.id,
      score,
    });
  }

  // Même lieu en premier (10), autre lieu ensuite (8), max 3 installations
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, 3);
}

/**
 * Propose de déplacer une séance sur un autre jour (pour max heures/jour)
 */
function suggestionsDeplacementAutreJour(conflit, context) {
  const suggestions = suggestionsDeplacements(conflit, context, Infinity);
  // Filtrer pour ne garder que les déplacements sur un autre jour, max 1
  const autreJour = suggestions.filter(s => s.nouvelles.jour !== conflit.seance.jour);
  return autreJour.slice(0, 1);
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
