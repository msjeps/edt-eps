/**
 * Système de tooltips d'aide contextuelle
 * Usage : helpTip('ors') → <span class="help-tip" data-help="ors">?</span>
 * Initialiser une fois avec initHelpTooltips() dans main.js
 */

const HELP_TOPICS = {
  ors: {
    titre: 'ORS — Obligations Réglementaires de Service',
    corps: 'Temps de service hebdomadaire d\'enseignement EPS sur l\'établissement.\n• Certifié EPS (taux plein) : 17h d\'enseignement + 3h AS\n• Agrégé EPS (taux plein) : 15h d\'enseignement + 3h AS\nUn enseignant partagé entre plusieurs établissements ou à temps partiel peut n\'avoir que quelques heures ici (ex : 6h). Saisir uniquement les heures effectuées dans cet établissement. Les heures d\'AS sont comptabilisées séparément.',
  },
  as: {
    titre: 'Association Sportive (AS)',
    corps: 'L\'AS est hors ORS : elle ne compte pas dans la limite journalière de 6h EPS. Ses créneaux peuvent toutefois bloquer les ressources (installation, enseignant) s\'ils sont activés. L\'AS peut être placée le mercredi, sur le créneau méridien ou après les cours selon l\'organisation de l\'établissement.',
  },
  creneau24h: {
    titre: 'Contrainte 24h (collège)',
    corps: 'Au collège, deux séances d\'une même classe ne peuvent pas être planifiées à moins de 24h d\'intervalle. Cette règle ne s\'applique pas au lycée.',
  },
  periodes: {
    titre: 'Périodes scolaires',
    corps: 'L\'EDT est structuré par périodes (trimestres, semestres ou mixte). Chaque séance appartient à une période. Un même créneau peut avoir des horaires différents selon la période (badge bleu dans la Programmation).',
  },
  periodeHoraire: {
    titre: 'Horaires par période',
    corps: 'Un même créneau peut avoir des horaires différents selon la période (ex : piscine en T1 de 9h à 11h, mais 10h à 12h en T2). Le badge bleu dans la Programmation signale un horaire personnalisé. Ces overrides sont pris en compte dans l\'EDT.',
  },
  champApprentissage: {
    titre: 'Champs d\'apprentissage (CA)',
    corps: 'Les 4 champs d\'apprentissage du programme EPS national :\n• CA1 : Produire une performance mesurable\n• CA2 : Adapter ses déplacements à des environnements variés\n• CA3 : S\'exprimer devant les autres par une motricité à visée artistique\n• CA4 : Conduire et maîtriser un affrontement',
  },
  importMairie: {
    titre: 'Import disponibilités mairie',
    corps: 'La Direction des Sports publie un PDF hebdomadaire listant les réservations sur les équipements municipaux. Ce fichier JSON (extrait du PDF) permet de bloquer automatiquement les créneaux déjà réservés sur vos installations, évitant les conflits avec d\'autres clubs.',
  },
  reservationStatut: {
    titre: 'Statut de réservation',
    corps: 'Workflow en 3 étapes :\n• Proposé — créé automatiquement depuis une séance\n• Demandé — transmis à la Direction des Sports\n• Accepté / Refusé — réponse reçue\nSeules les réservations acceptées sont garanties sur l\'installation.',
  },
  intraExtra: {
    titre: 'Installations intra / extra muros',
    corps: '• Intra-muros : installations dans l\'établissement (gymnase, terrain intérieur)\n• Extra-muros : équipements extérieurs (piscine, stade municipal)\nLes séances extra-muros génèrent automatiquement des demandes de transport bus.',
  },
  capacite: {
    titre: 'Capacité simultanée',
    corps: 'Nombre de classes pouvant utiliser l\'installation en même temps. Exemple : un gymnase avec capacité 2 peut accueillir deux classes simultanément (dans des zones différentes). Si l\'effectif dépasse la capacité, un conflit est signalé.',
  },
  zone: {
    titre: 'Zone',
    corps: 'Sous-espace d\'une installation permettant d\'accueillir plusieurs classes simultanément. Ex : "Gymnase A" et "Gymnase B" dans le même gymnase. La capacité totale est la somme des zones actives.',
  },
  indisponibilite: {
    titre: 'Indisponibilités',
    corps: 'Créneaux bloqués pour un enseignant ou une installation (formation, réservation externe, fermeture technique...). Le moteur de contraintes interdit toute séance sur un créneau indisponible (contrainte hard).',
  },
  snapshot: {
    titre: 'Snapshot / Version',
    corps: 'Photo complète de l\'EDT à un instant T, stockée localement. Permet de revenir à un état antérieur en cas de regret. Différent de Ctrl+Z : les snapshots sont permanents (max 50), Ctrl+Z est éphémère (max 20 niveaux, perdu à la fermeture).',
  },
  transport: {
    titre: 'Demande de transport',
    corps: '1 demande = 1 classe sur 1 créneau extra-muros. Le départ de l\'établissement est calculé avec le temps de trajet configuré (+15 min par défaut). Export au format Direction des Sports. La mutualisation de bus entre classes n\'est pas gérée automatiquement.',
  },
  niveauClasse: {
    titre: 'Créneaux par niveau',
    corps: 'Volume horaire réglementaire par semaine :\n• 6e : 2×2h = 4h\n• 5e, 4e, 3e : 3h (2×1h30 ou 2h+1h)\n• 2nde : 1×2h\n• 1re/Term : 1×2h (groupes inter-classes possibles)',
  },
  verrou: {
    titre: 'Séance verrouillée',
    corps: 'Une séance verrouillée ne peut pas être déplacée par le générateur automatique ni par glisser-déposer accidentel. Déverrouillez-la manuellement pour la modifier.',
  },
  contraintes: {
    titre: 'Contraintes hard / soft',
    corps: '• Contraintes hard : jamais violées (conflits de ressources, indisponibilités, capacité dépassée)\n• Contraintes soft : optimisées si possible (desideratas enseignants, équilibrage des journées)\nLe tableau Conflits liste toutes les violations détectées en temps réel.',
  },
};

/**
 * Retourne le HTML d'un badge "?" à insérer dans un label ou un en-tête.
 * @param {string} key — clé dans HELP_TOPICS
 * @param {object} opts — { inline: bool }
 */
export function helpTip(key, opts = {}) {
  const topic = HELP_TOPICS[key];
  if (!topic) return '';
  const cls = ['help-tip', opts.inline ? 'help-tip--inline' : ''].filter(Boolean).join(' ');
  return `<span class="${cls}" data-help="${key}" tabindex="0" role="button" aria-label="Aide : ${topic.titre}">?</span>`;
}

/**
 * Initialise le système de tooltip global.
 * À appeler une seule fois au démarrage de l'application.
 */
export function initHelpTooltips() {
  if (document.getElementById('help-tooltip-bubble')) return;

  const bubble = document.createElement('div');
  bubble.id = 'help-tooltip-bubble';
  bubble.className = 'help-tooltip-bubble';
  bubble.setAttribute('role', 'tooltip');
  document.body.appendChild(bubble);

  let hideTimer = null;

  const show = (anchor) => {
    const key = anchor.dataset.help;
    const topic = HELP_TOPICS[key];
    if (!topic) return;
    clearTimeout(hideTimer);

    bubble.innerHTML = `
      <div class="htt-title">${topic.titre}</div>
      <div class="htt-body">${topic.corps.replace(/\n/g, '<br>')}</div>
    `;
    bubble.classList.add('visible');
    positionBubble(bubble, anchor);
  };

  const hide = (delay = 120) => {
    hideTimer = setTimeout(() => bubble.classList.remove('visible'), delay);
  };

  // Hover sur les badges
  document.addEventListener('mouseover', (e) => {
    const tip = e.target.closest('.help-tip');
    if (tip) show(tip);
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('.help-tip')) hide();
  });

  // La bulle elle-même reste ouverte quand on la survole
  bubble.addEventListener('mouseover', () => clearTimeout(hideTimer));
  bubble.addEventListener('mouseout', () => hide());

  // Focus clavier
  document.addEventListener('focus', (e) => {
    const tip = e.target.closest?.('.help-tip');
    if (tip) show(tip);
  }, true);
  document.addEventListener('blur', (e) => {
    if (e.target.closest?.('.help-tip')) hide(200);
  }, true);

  // Fermeture Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') bubble.classList.remove('visible');
  });
}

function positionBubble(bubble, anchor) {
  // Lire les dimensions avant de placer (offsetWidth peut être 0 avant 1er affichage)
  bubble.style.top = '0px';
  bubble.style.left = '0px';

  const rect = anchor.getBoundingClientRect();
  const bw = bubble.offsetWidth || 288;
  const bh = bubble.offsetHeight || 80;
  const gap = 8;

  const spaceBelow = window.innerHeight - rect.bottom;
  const above = spaceBelow < bh + gap + 12;

  let top = above
    ? rect.top - bh - gap + window.scrollY
    : rect.bottom + gap + window.scrollY;

  let left = rect.left + rect.width / 2 - bw / 2 + window.scrollX;
  left = Math.max(8 + window.scrollX, Math.min(left, window.scrollX + window.innerWidth - bw - 8));

  bubble.style.top = `${top}px`;
  bubble.style.left = `${left}px`;
  bubble.classList.toggle('above', above);
}
