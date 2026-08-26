/**
 * Vue Aide — Documentation et guide utilisateur
 */
import { navigateTo } from '../../app.js';

const SECTIONS = [
  {
    id: 'demarrage',
    titre: 'Démarrage rapide',
    icone: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M8 7l5 3-5 3V7z"/></svg>`,
    contenu: `
      <p>EDT EPS se configure en 4 étapes, puis s'utilise au quotidien pour gérer vos créneaux et réservations.</p>
      <ol class="aide-steps">
        <li>
          <strong>Configuration</strong> — Lancez l'assistant (icône ⚙ en bas de la barre latérale) et renseignez vos établissement, enseignants, classes, activités et installations. Comptez environ 10 minutes pour un établissement type.
        </li>
        <li>
          <strong>Programmation annuelle</strong> — Dans l'onglet <em>Programmation</em>, affectez une activité et une installation à chaque classe pour chaque période. C'est la base qui alimente l'EDT.
        </li>
        <li>
          <strong>Emploi du temps</strong> — L'onglet <em>EDT</em> affiche la grille semaine. Déplacez les séances par glisser-déposer, ajustez les horaires, verrouillez les blocs définitifs.
        </li>
        <li>
          <strong>Exports</strong> — Depuis l'onglet <em>Exports</em>, générez le CSV mairie, le CSV transport, le PDF EDT équipe/individuels ou l'Excel de synthèse.
        </li>
      </ol>
    `,
  },
  {
    id: 'donnees',
    titre: 'Onglet Données',
    icone: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><ellipse cx="10" cy="5" rx="7" ry="2.5"/><path d="M3 5v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5"/><path d="M3 9v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V9"/></svg>`,
    contenu: `
      <p>Gérez toutes les entités de votre projet via des tableaux editables.</p>
      <table class="aide-table">
        <thead><tr><th>Onglet</th><th>Ce que vous pouvez faire</th></tr></thead>
        <tbody>
          <tr><td>Enseignants</td><td>Ajouter/modifier des enseignants, renseigner l'ORS, saisir les indisponibilités (jours, plages horaires)</td></tr>
          <tr><td>Classes</td><td>Créer des classes par niveau (6e → Terminale), associer un enseignant référent</td></tr>
          <tr><td>Activités</td><td>Choisir les APSA du catalogue EPS par champ d'apprentissage (CA1–CA4), définir la durée et l'installation requise</td></tr>
          <tr><td>Installations</td><td>Gérer les lieux et installations, importer les disponibilités mairie (bouton "Import mairie")</td></tr>
          <tr><td>Périodes</td><td>Paramétrer les trimestres, semestres ou périodes personnalisées</td></tr>
          <tr><td>Créneaux</td><td>Définir les plages horaires de base (modifiables par période dans Programmation)</td></tr>
        </tbody>
      </table>
    `,
  },
  {
    id: 'programmation',
    titre: 'Programmation annuelle',
    icone: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><rect x="2" y="2" width="16" height="16" rx="2"/><path d="M2 7h16M2 13h16M7 7v9M13 7v9"/></svg>`,
    contenu: `
      <p>La matrice <strong>classe × période</strong> est le cœur du planning annuel.</p>
      <ul class="aide-list">
        <li>Cliquez sur une cellule vide pour affecter une activité + installation + créneau.</li>
        <li>Un <strong>badge bleu</strong> indique un horaire spécifique à la période (différent du créneau de base).</li>
        <li>Un avertissement <strong>orange</strong> signale qu'une activité est déjà utilisée sur la même période ; <strong>bleu</strong> si c'est une autre période.</li>
        <li>Les séances d'une période longue (semestre) s'affichent en <em>fantômes grisés</em> dans les sous-périodes (trimestres) pour visualiser les chevauchements.</li>
        <li>La vue <strong>Installation × Période</strong> (onglet à droite) montre l'occupation des espaces sportifs.</li>
      </ul>
    `,
  },
  {
    id: 'edt',
    titre: 'Emploi du temps (EDT)',
    icone: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><rect x="2" y="3" width="16" height="15" rx="2"/><path d="M6 1.5v3M14 1.5v3M2 8.5h16"/></svg>`,
    contenu: `
      <p>Grille semaine interactive avec gestion des conflits en temps réel.</p>
      <ul class="aide-list">
        <li><strong>Glisser-déposer</strong> — déplacez un bloc dans la même journée ou vers un autre jour. Un dialogue vous propose de déplacer pour "Cette période uniquement" ou "Toutes les périodes".</li>
        <li><strong>Clic sur un bloc</strong> — ouvre la modale de détail/modification de la séance.</li>
        <li><strong>Verrou d'une séance</strong> — dans la modale d'une séance, cochez « Verrouiller » pour l'empêcher d'être déplacée accidentellement (icône 🔒 sur le bloc).</li>
        <li><strong>Verrouillage global de l'EDT</strong> — le bouton <em>🔓 Verrouiller l'EDT</em> de la barre d'outils fige tout l'emploi du temps une fois accepté : plus aucun ajout, déplacement, modification ou suppression n'est possible (glisser-déposer désactivé, bouton <em>+ Séance</em> grisé, Ctrl+Z bloqué). Le bouton devient ambre (<em>🔒 EDT verrouillé</em>) et le clic sur un bloc ouvre la modale en lecture seule. La <em>Programmation</em> reste modifiable pendant ce temps ; un bandeau y rappelle que la synchro vers l'EDT est différée jusqu'au déverrouillage.</li>
        <li><strong>Légende</strong> — bouton <em>🎨 Légende</em> dans la barre d'outils pour afficher ou masquer la légende des installations (utile pour gagner de la hauteur d'écran quand il y a beaucoup d'installations).</li>
        <li><strong>Filtre période</strong> — changez la période dans la barre d'outils pour naviguer entre T1, T2, T3…</li>
        <li><strong>Filtre vue</strong> — affichez l'EDT d'un enseignant, d'une classe ou d'une installation spécifique.</li>
        <li><strong>Séance d'AS</strong> — dans le bouton <em>+ Séance</em>, cochez « Séance d'Association Sportive » tout en haut du formulaire : le champ Classe est remplacé par un intitulé libre (ex. « AS Badminton ») et le champ Activité par une saisie libre (l'AS peut proposer des activités hors programmation des classes). L'AS ne compte pas dans les 6h/jour ORS mais occupe bien l'installation. Bouton <em>AS visible/masquée</em> dans la barre d'outils pour l'afficher ou non.</li>
        <li>Les séances en conflit apparaissent avec une bordure rouge. Consultez l'onglet <em>Conflits</em> pour le détail.</li>
      </ul>
    `,
  },
  {
    id: 'conflits',
    titre: 'Détection de conflits',
    icone: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.5L2 17.5h16L10 2.5z"/><path d="M10 8.5v4M10 14.5v.5"/></svg>`,
    contenu: `
      <p>Les conflits sont détectés automatiquement à chaque modification.</p>
      <table class="aide-table">
        <thead><tr><th>Type</th><th>Déclencheur</th></tr></thead>
        <tbody>
          <tr><td>Conflit ressource</td><td>Même enseignant, même classe ou même installation sur deux séances simultanées</td></tr>
          <tr><td>ORS dépassé</td><td>Enseignant dépasse 6 h d'EPS par jour (AS exclue)</td></tr>
          <tr><td>Écart 24 h</td><td>Deux séances d'une même classe collège espacées de moins de 24 h</td></tr>
          <tr><td>Incompatibilité</td><td>Activité incompatible avec l'installation (ex. natation hors piscine)</td></tr>
          <tr><td>Indisponibilité</td><td>Enseignant ou installation marqué indisponible sur ce créneau</td></tr>
          <tr><td>Capacité</td><td>Effectif classe supérieur à la capacité de l'installation</td></tr>
        </tbody>
      </table>
      <p style="margin-top: var(--sp-3);">Le badge rouge dans la barre latérale indique le nombre de conflits actifs.</p>
    `,
  },
  {
    id: 'reservations',
    titre: 'Réservations',
    icone: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M7 3.5h6M6 3H4a1 1 0 00-1 1v13a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1h-2"/><rect x="6" y="1.5" width="8" height="3.5" rx="1"/><path d="M7 10.5h6M7 14h4"/></svg>`,
    contenu: `
      <p>Suivez le statut des demandes auprès de la Direction des Sports.</p>
      <ul class="aide-list">
        <li><strong>Proposé</strong> — créneaux générés depuis la Programmation, pas encore transmis.</li>
        <li><strong>Demandé</strong> — demande envoyée à la mairie, en attente de réponse.</li>
        <li><strong>Accepté</strong> — créneau confirmé.</li>
        <li><strong>Refusé</strong> — créneau refusé (un conflit apparaît dans la grille EDT).</li>
      </ul>
      <p>Changez le statut en cliquant sur le bouton d'action de chaque réservation dans le tableau.</p>
    `,
  },
  {
    id: 'vues',
    titre: 'Vues individuelles',
    icone: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="7" height="7" rx="1"/><rect x="11" y="3" width="7" height="7" rx="1"/><rect x="2" y="12" width="7" height="5" rx="1"/><rect x="11" y="12" width="7" height="5" rx="1"/></svg>`,
    contenu: `
      <p>L'onglet <em>Vues</em> génère des fiches individuelles (une carte par enseignant, classe ou installation) pratiques à imprimer isolément — par exemple l'occupation d'un seul gymnase.</p>
      <ul class="aide-list">
        <li><strong>4 filtres indépendants</strong> — Enseignants, Installations, Périodes, Classes — toujours visibles en haut de l'écran, chacun avec une option « Tous/Toutes » par défaut.</li>
        <li>Les filtres se <strong>combinent</strong> (ET logique) : par exemple Installations = Gymnase + Classes = 6eA n'affiche que les séances de 6eA au gymnase.</li>
        <li><strong>Regroupement automatique</strong> — les cartes sont groupées par enseignant, classe ou installation selon le premier filtre précis renseigné (priorité enseignant &gt; classe &gt; installation) ; sans filtre précis, le regroupement se fait par enseignant.</li>
        <li>En mode « Toutes les périodes », un badge <strong>S1/T2</strong> apparaît sur chaque bloc de la mini-grille, et un badge orange signale une entité dont toutes les séances appartiennent à une seule période. Les heures hebdomadaires affichées sont alors <strong>annualisées</strong> (ex. 2h en S1 seul sur 2 semestres → 1h/sem. affiché, avec astérisque).</li>
        <li>Le sélecteur de période de cet écran est local (celui du header est masqué ici pour éviter le doublon).</li>
        <li>Bouton <em>Imprimer</em> — le titre et le sous-titre de la page imprimée reprennent le regroupement actif et la liste des filtres appliqués.</li>
      </ul>
    `,
  },
  {
    id: 'exports',
    titre: 'Exports',
    icone: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v9M6.5 8.5L10 12l3.5-3.5"/><path d="M4 14v1a2 2 0 002 2h8a2 2 0 002-2v-1"/></svg>`,
    contenu: `
      <table class="aide-table">
        <thead><tr><th>Format</th><th>Contenu</th><th>Destinataire</th></tr></thead>
        <tbody>
          <tr><td>CSV Mairie</td><td>Créneaux par installation (format Direction des Sports)</td><td>Service municipal</td></tr>
          <tr><td>CSV Transport</td><td>1 ligne = 1 demande de bus (classe, lieu, départ/retour)</td><td>Service transport</td></tr>
          <tr><td>PDF EDT équipe</td><td>Grille équipe paysage A4 (couleurs alignées sur la légende)</td><td>Affichage / distribution</td></tr>
          <tr><td>PDF EDT enseignants</td><td>Fiches individuelles portrait par enseignant (ORS + total hebdo)</td><td>Distribution aux profs</td></tr>
          <tr><td>PDF EDT classes</td><td>Fiches individuelles portrait par classe</td><td>Distribution aux classes</td></tr>
          <tr><td>PDF EDT installation</td><td>Fiche portrait A4 par installation, groupée jour &gt; période (classe/activité + enseignant)</td><td>Gestionnaire d'installation</td></tr>
          <tr><td>Excel EDT</td><td>Tableau EDT complet avec mise en forme couleur</td><td>Administration</td></tr>
          <tr><td>Excel Synthèses</td><td>Occupation intra/extra, heures par enseignant, bilan transport (colonne Nb rotations)</td><td>Direction</td></tr>
          <tr><td>JSON Projet</td><td>Sauvegarde complète de toutes les données (bouton 💾 sidebar)</td><td>Archivage / transfert</td></tr>
        </tbody>
      </table>
      <p style="margin-top: var(--sp-3);">Les fichiers sont enregistrés dans le dossier <code>EDT EPS/EXPORTS/</code> mémorisé (ou dans Téléchargements si l'API Dossier n'est pas disponible).</p>
      <h3 class="section-title">Dates de transport (exclusions et ajouts)</h3>
      <ul class="aide-list">
        <li><strong>Dates à exclure</strong> — retire des dates du planning PDF et du CSV transport (journée pédagogique, voyage, bac blanc…). Renseignez une <em>date de fin</em> pour exclure une période entière (option « jours ouvrés uniquement » pour ne viser que lun-ven), ou utilisez <em>📅 Sélection multiple sur calendrier</em> pour cocher des jours non consécutifs (ex. tous les vendredis de septembre).</li>
        <li><strong>Dates à ajouter</strong> — pour un besoin de bus ponctuel hors planning habituel (sortie, compétition, rattrapage) : date, classe, lieu et horaires dédiés, sans dépendre d'une séance de l'EDT.</li>
        <li>Les deux listes sont <strong>repliables</strong> (bouton « ▾ Masquer / ▸ Afficher les dates ») pour ne pas avoir à scroller après plusieurs ajouts ; le compteur de dates reste visible même repliée.</li>
      </ul>
    `,
  },
  {
    id: 'sauvegarde',
    titre: 'Sauvegarde et chargement',
    icone: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M3 3.5A.5.5 0 013.5 3h10l3.5 3.5V16.5a.5.5 0 01-.5.5H3.5a.5.5 0 01-.5-.5v-13z"/><path d="M7 3v5h6V3M7 12.5h6"/></svg>`,
    contenu: `
      <ul class="aide-list">
        <li><strong>Sauvegarde (💾)</strong> — enregistre toutes les données en JSON dans <code>EDT EPS/PROJET/</code>. Un point jaune (●) dans la barre de statut indique des modifications non sauvegardées.</li>
        <li><strong>Chargement (📂)</strong> — importe un fichier JSON de projet. <em>Attention : remplace toutes les données actuelles.</em></li>
        <li><strong>Versions (🕐)</strong> — crée un snapshot horodaté de l'état actuel. Restaurez ou comparez deux snapshots depuis la modale Versions.</li>
        <li><strong>Annuler (↶ ou Ctrl+Z)</strong> — revient à l'état précédant la dernière modification (jusqu'à 20 niveaux).</li>
      </ul>
      <p>Les données sont stockées localement dans IndexedDB — aucune donnée n'est envoyée sur un serveur.</p>
    `,
  },
  {
    id: 'raccourcis',
    titre: 'Raccourcis clavier',
    icone: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="16" height="11" rx="2"/><path d="M5 9h1M8 9h1M11 9h1M14 9h1M5 13h10"/></svg>`,
    contenu: `
      <table class="aide-table aide-table-shortcuts">
        <thead><tr><th>Raccourci</th><th>Action</th></tr></thead>
        <tbody>
          <tr><td><kbd>Ctrl</kbd> + <kbd>Z</kbd></td><td>Annuler la dernière action</td></tr>
          <tr><td><kbd>Ctrl</kbd> + <kbd>S</kbd></td><td>Non disponible — utilisez le bouton 💾 dans la barre latérale</td></tr>
          <tr><td><kbd>Échap</kbd></td><td>Fermer une modale ou un panneau</td></tr>
          <tr><td><kbd>Entrée</kbd></td><td>Valider un formulaire (dans les modales)</td></tr>
          <tr><td>Glisser-déposer</td><td>Déplacer une séance dans la grille EDT</td></tr>
        </tbody>
      </table>
    `,
  },
  {
    id: 'faq',
    titre: 'Questions fréquentes',
    icone: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M8.5 7.5a1.5 1.5 0 112.1 1.4C10 9.5 10 10 10 10.5"/><circle cx="10" cy="13.5" r=".5" fill="currentColor"/></svg>`,
    contenu: `
      <div class="aide-faq">
        <details>
          <summary>Mes données sont-elles sauvegardées automatiquement ?</summary>
          <p>Toutes les modifications sont immédiatement enregistrées dans IndexedDB (stockage local du navigateur). En revanche, la sauvegarde en fichier JSON doit être déclenchée manuellement via le bouton 💾. Pensez à sauvegarder régulièrement pour pouvoir transférer ou archiver votre projet.</p>
        </details>
        <details>
          <summary>Comment transférer le projet sur un autre ordinateur ?</summary>
          <p>Sauvegardez le projet en JSON (💾), copiez le fichier sur l'autre machine, puis utilisez le bouton 📂 "Charger" pour l'importer dans EDT EPS.</p>
        </details>
        <details>
          <summary>L'application fonctionne-t-elle hors connexion ?</summary>
          <p>L'application nécessite une connexion internet pour charger les ressources (polices, premier chargement). Une fois chargée, toutes les fonctions principales sont disponibles sans connexion, hormis la récupération du calendrier scolaire officiel.</p>
        </details>
        <details>
          <summary>Comment gérer plusieurs établissements ?</summary>
          <p>EDT EPS gère un seul établissement par projet. Pour plusieurs établissements, créez autant de fichiers JSON distincts et chargez celui souhaité selon le contexte.</p>
        </details>
        <details>
          <summary>Comment supprimer toutes les données et repartir de zéro ?</summary>
          <p>Relancez l'assistant de configuration (⚙ Paramètres) puis, à la première étape, un bouton "Réinitialiser le projet" vous permet d'effacer toutes les données après confirmation.</p>
        </details>
        <details>
          <summary>Les séances créées manuellement dans l'EDT sont-elles visibles dans Programmation ?</summary>
          <p>Oui — toute séance ajoutée directement dans la grille EDT crée automatiquement une entrée de programmation correspondante (créneau classe + programmation annuelle).</p>
        </details>
        <details>
          <summary>Où déclarer l'Association Sportive (AS) ? Je ne la trouve pas dans Données.</summary>
          <p>L'AS ne se déclare pas comme une classe ou une activité : c'est un type de séance qu'on place directement dans la grille. Allez dans <strong>Emploi du temps &gt; + Séance</strong> et cochez « Séance d'Association Sportive » tout en haut du formulaire — le champ Classe est alors remplacé par un intitulé libre. Le champ « AS (heures) » dans Données &gt; Enseignants ne sert lui qu'à déclarer le volume horaire statutaire, pas à placer les créneaux.</p>
        </details>
        <details>
          <summary>Comment figer l'emploi du temps une fois accepté par tout le monde ?</summary>
          <p>Cliquez sur <strong>🔓 Verrouiller l'EDT</strong> dans la barre d'outils de l'onglet Emploi du temps. Tant qu'il est verrouillé (bouton ambre 🔒), plus aucune modification n'est possible sur la grille — glisser-déposer, ajout, édition, suppression et Ctrl+Z sont bloqués. La <em>Programmation</em> annuelle reste modifiable ; les changements s'y accumulent et se répercutent sur l'EDT dès le déverrouillage.</p>
        </details>
      </div>
    `,
  },
];

export function renderAide(container) {
  let activeSectionId = SECTIONS[0].id;

  function render() {
    const activeSection = SECTIONS.find(s => s.id === activeSectionId) || SECTIONS[0];

    container.innerHTML = `
      <div class="aide-layout">
        <nav class="aide-nav">
          ${SECTIONS.map(s => `
            <button
              class="aide-nav-btn${s.id === activeSectionId ? ' active' : ''}"
              data-section="${s.id}"
            >
              <span class="aide-nav-icon">${s.icone}</span>
              <span class="aide-nav-label">${s.titre}</span>
            </button>
          `).join('')}
        </nav>

        <article class="aide-content">
          <h2 class="aide-section-title">
            <span class="aide-section-icon">${activeSection.icone}</span>
            ${activeSection.titre}
          </h2>
          <div class="aide-section-body">
            ${activeSection.contenu}
          </div>
        </article>
      </div>
    `;

    container.querySelectorAll('.aide-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSectionId = btn.dataset.section;
        render();
      });
    });
  }

  render();
}
