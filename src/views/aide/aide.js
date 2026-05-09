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
        <li><strong>Verrou</strong> — cliquez l'icône 🔒 d'un bloc pour l'empêcher d'être déplacé accidentellement.</li>
        <li><strong>Filtre période</strong> — changez la période dans la barre d'outils pour naviguer entre T1, T2, T3…</li>
        <li><strong>Filtre vue</strong> — affichez l'EDT d'un enseignant, d'une classe ou d'une installation spécifique.</li>
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
    id: 'exports',
    titre: 'Exports',
    icone: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v9M6.5 8.5L10 12l3.5-3.5"/><path d="M4 14v1a2 2 0 002 2h8a2 2 0 002-2v-1"/></svg>`,
    contenu: `
      <table class="aide-table">
        <thead><tr><th>Format</th><th>Contenu</th><th>Destinataire</th></tr></thead>
        <tbody>
          <tr><td>CSV Mairie</td><td>Créneaux par installation (format Direction des Sports)</td><td>Service municipal</td></tr>
          <tr><td>CSV Transport</td><td>1 ligne = 1 demande de bus (classe, lieu, départ/retour)</td><td>Service transport</td></tr>
          <tr><td>PDF EDT</td><td>Grille équipe paysage A4 + fiches individuelles portrait par enseignant</td><td>Affichage / distribution</td></tr>
          <tr><td>Excel EDT</td><td>Tableau EDT complet avec mise en forme couleur</td><td>Administration</td></tr>
          <tr><td>Excel Synthèses</td><td>Occupation intra/extra, heures par enseignant, bilan transport</td><td>Direction</td></tr>
          <tr><td>JSON Projet</td><td>Sauvegarde complète de toutes les données (bouton 💾 sidebar)</td><td>Archivage / transfert</td></tr>
        </tbody>
      </table>
      <p style="margin-top: var(--sp-3);">Les fichiers sont enregistrés dans le dossier <code>EDT EPS/EXPORTS/</code> mémorisé (ou dans Téléchargements si l'API Dossier n'est pas disponible).</p>
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
