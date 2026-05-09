/**
 * Vue Exports — CSV mairie, CSV transport, Excel EDT, Synthèses
 */
import db from '../../db/schema.js';
import { getConfig, setConfig } from '../../db/schema.js';
import { toast } from '../../components/toast.js';
import { genererDatesJour, getCalendrierExclusions } from '../../utils/dates.js';
import { JOURS_OUVRES, slugify } from '../../utils/helpers.js';
import Papa from 'papaparse';
import { saveExportFile } from '../../utils/filesystem.js';
import ExcelJS from 'exceljs';
import { exportPdfEquipe, exportPdfEnseignants, exportPdfClasses } from '../../export/pdf-edt.js';

function addSheetFromAoa(wb, sheetName, wsData, colWidths, merges) {
  const ws = wb.addWorksheet(sheetName);
  wsData.forEach(row => ws.addRow(row));
  if (colWidths) colWidths.forEach((c, i) => { ws.getColumn(i + 1).width = c.wch || 10; });
  if (merges) merges.forEach(m => ws.mergeCells(m.s.r + 1, m.s.c + 1, m.e.r + 1, m.e.c + 1));
  return ws;
}
import { exportPdfTransport } from '../../export/pdf-transport.js';
import { exportPartageHtml } from '../../export/partage-html.js';

// ============================================================
// Helpers tri jours semaine (ordre calendaire)
// ============================================================
const JOUR_ORDRE = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 7 };
function jourOrdre(jour) {
  return JOUR_ORDRE[(jour || '').toLowerCase()] || 99;
}

// ============================================================
// RENDER
// ============================================================

// ============================================================
// EXCLUSIONS TRANSPORT — helpers
// ============================================================
async function loadExclusions() {
  return (await getConfig('exclusionsTransport')) || [];
}
async function saveExclusions(list) {
  await setConfig('exclusionsTransport', list);
}

function renderExclusionsList(exclusions, classes, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (exclusions.length === 0) {
    el.innerHTML = `<p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin:0;">Aucune date exclue pour l'instant.</p>`;
    return;
  }
  const rows = [...exclusions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(ex => {
      const d   = new Date(ex.date + 'T00:00:00');
      const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
      const label = `${days[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      let clsLabel = ex.classesIds === 'all'
        ? 'Toutes les classes'
        : (Array.isArray(ex.classesIds)
            ? ex.classesIds.map(id => classes.find(c => c.id === id)?.nom || id).join(', ')
            : '?');
      return `
        <div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);
                    border-bottom:1px solid var(--c-border);font-size:var(--fs-sm);">
          <span style="font-weight:600;min-width:110px;">${label}</span>
          <span style="flex:1;color:var(--c-text-secondary);">${ex.raison || '<em>sans raison</em>'}</span>
          <span style="min-width:140px;color:var(--c-text-secondary);font-style:italic;">${clsLabel}</span>
          <button class="btn btn-outline btn-sm" data-del-excl="${ex.id}"
                  style="padding:2px 8px;font-size:11px;">✕</button>
        </div>`;
    }).join('');
  el.innerHTML = `<div style="border:1px solid var(--c-border);border-radius:6px;overflow:hidden;">${rows}</div>`;
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================
export async function renderExports(container) {
  const seances = await db.seances.toArray();
  const periodes = await db.periodes.toArray();
  const enseignants = await db.enseignants.toArray();
  const classes = await db.classes.toArray();

  container.innerHTML = `
    <div style="max-width:900px;margin:0 auto;">
      <h2 style="margin-bottom:var(--sp-6);">Exports</h2>

      <div class="dashboard-grid">

        <!-- Partage lecture seule -->
        <div class="card" style="cursor:default;grid-column:1/-1;border-left:4px solid #3b82f6;">
          <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-2);">
            <span style="font-size:1.8rem;">&#128279;</span>
            <h3 style="margin:0;">Partage lecture seule</h3>
            <span style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;
                         border-radius:12px;padding:2px 10px;font-size:11px;font-weight:700;
                         letter-spacing:.04em;text-transform:uppercase;margin-left:4px;">Nouveau</span>
          </div>
          <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
            Génère un fichier <strong>HTML autonome</strong> que vous pouvez envoyer aux enseignants par e-mail ou déposer sur un espace partagé.
            Ils l'ouvrent dans leur navigateur&nbsp;: navigation par enseignant, par classe, filtre période, impression — <em>aucun accès à l'outil de saisie</em>.
          </p>
          <div style="display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap;">
            <select class="form-select" id="export-partage-per" style="flex:1;max-width:260px;">
              <option value="">Toutes les périodes (recommandé)</option>
              ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
            </select>
            <button class="btn btn-primary" id="btn-export-partage" ${seances.length === 0 ? 'disabled' : ''}
                    style="background:#3b82f6;">
              &#128279;&nbsp;Générer le fichier HTML
            </button>
          </div>
        </div>

        <!-- Export CSV Mairie -->
        <div class="card" style="cursor:default;">
          <div style="font-size:2rem;margin-bottom:var(--sp-3);">&#127963;</div>
          <h3 style="margin-bottom:var(--sp-2);">CSV Mairie (réservations)</h3>
          <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
            Export des réservations d'installations au format CSV, inspiré du format Direction des Sports d'Antibes.
          </p>
          <div style="display:flex;gap:var(--sp-2);">
            <select class="form-select" id="export-mairie-per" style="flex:1;">
              <option value="">Toutes les périodes</option>
              ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
            </select>
            <button class="btn btn-primary" id="btn-export-mairie" ${seances.length === 0 ? 'disabled' : ''}>
              Exporter CSV
            </button>
          </div>
        </div>

        <!-- Export Transport CSV -->
        <div class="card" style="cursor:default;">
          <div style="font-size:2rem;margin-bottom:var(--sp-3);">&#128652;</div>
          <h3 style="margin-bottom:var(--sp-2);">Transport (demandes bus)</h3>
          <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
            Export des besoins en transport : 1 ligne = 1 classe, avec dates, lieu, horaires départ/retour.
          </p>
          <div style="display:flex;gap:var(--sp-2);">
            <select class="form-select" id="export-transport-per" style="flex:1;">
              <option value="">Toutes les périodes</option>
              ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
            </select>
            <button class="btn btn-primary" id="btn-export-transport" ${seances.length === 0 ? 'disabled' : ''}>
              Exporter CSV
            </button>
          </div>
        </div>

        <!-- Dates exclues transport -->
        <div class="card" style="cursor:default;grid-column:1/-1;">
          <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-2);">
            <span style="font-size:1.6rem;">🚫</span>
            <h3 style="margin:0;">Dates exclues du transport</h3>
            <span style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-left:auto;">
              Journées péda, voyages, bac blanc…
            </span>
          </div>
          <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-3);">
            Ces dates sont retirées du planning PDF transport. Une page récapitulative est ajoutée au PDF si des exclusions sont appliquées.
          </p>

          <!-- Formulaire ajout -->
          <div style="display:flex;gap:var(--sp-2);align-items:flex-end;flex-wrap:wrap;
                      background:var(--c-surface-2,#f5f7fa);border-radius:8px;padding:var(--sp-3);
                      margin-bottom:var(--sp-3);">
            <div style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:var(--fs-sm);font-weight:600;">Date</label>
              <input type="date" class="form-control" id="excl-date" style="width:150px;">
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:200px;">
              <label style="font-size:var(--fs-sm);font-weight:600;">Raison</label>
              <input type="text" class="form-control" id="excl-raison"
                     placeholder="ex : Journée pédagogique, Voyage 3eA…">
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:var(--fs-sm);font-weight:600;">Classes concernées</label>
              <select class="form-select" id="excl-classes" multiple
                      style="height:72px;min-width:180px;">
                <option value="all" selected>Toutes les classes</option>
                ${classes.sort((a,b) => a.nom.localeCompare(b.nom,'fr')).map(c =>
                  `<option value="${c.id}">${c.nom}</option>`).join('')}
              </select>
              <small style="color:var(--c-text-secondary);font-size:10px;">
                Ctrl+clic pour sélection multiple
              </small>
            </div>
            <button class="btn btn-primary" id="btn-add-exclusion">+ Ajouter</button>
          </div>

          <!-- Liste des exclusions -->
          <div id="exclusions-list"></div>
        </div>

        <!-- Export Transport PDF -->
        <div class="card" style="cursor:default;">
          <div style="font-size:2rem;margin-bottom:var(--sp-3);">&#128652;</div>
          <h3 style="margin-bottom:var(--sp-2);">Transport PDF (planning bus)</h3>
          <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
            Planning transport au format PDF — 1 page collège + 1 page lycée. Toutes les dates de la période, triées par jour, avec lieux, horaires et enseignants.
          </p>
          <div style="display:flex;gap:var(--sp-2);">
            <select class="form-select" id="export-transport-pdf-per" style="flex:1;">
              <option value="">Toutes les périodes</option>
              ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
            </select>
            <button class="btn btn-primary" id="btn-export-transport-pdf" ${seances.length === 0 ? 'disabled' : ''}>
              Exporter PDF
            </button>
          </div>
        </div>

        <!-- Export EDT Excel -->
        <div class="card" style="cursor:default;">
          <div style="font-size:2rem;margin-bottom:var(--sp-3);">&#128196;</div>
          <h3 style="margin-bottom:var(--sp-2);">EDT Équipe (Excel)</h3>
          <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
            Emploi du temps complet de l'équipe EPS au format Excel, avec une feuille par période.
          </p>
          <div style="display:flex;gap:var(--sp-2);">
            <select class="form-select" id="export-edt-per" style="flex:1;">
              <option value="">Toutes les périodes (1 feuille chacune)</option>
              ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
            </select>
            <button class="btn btn-primary" id="btn-export-excel" ${seances.length === 0 ? 'disabled' : ''}>
              Exporter Excel
            </button>
          </div>
        </div>

        <!-- Export Projet (JSON) -->
        <div class="card" style="cursor:default;">
          <div style="font-size:2rem;margin-bottom:var(--sp-3);">&#128190;</div>
          <h3 style="margin-bottom:var(--sp-2);">Fichier projet (JSON)</h3>
          <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
            Sauvegarde complète du projet (données + séances + réservations) au format JSON.
          </p>
          <div style="display:flex;gap:var(--sp-2);">
            <button class="btn btn-primary" id="btn-export-json">Exporter</button>
            <button class="btn btn-outline" id="btn-import-json">Importer</button>
            <input type="file" id="import-json-file" accept=".json" style="display:none;">
          </div>
        </div>

        <!-- Synthèses -->
        <div class="card" style="cursor:default;">
          <div style="font-size:2rem;margin-bottom:var(--sp-3);">&#128202;</div>
          <h3 style="margin-bottom:var(--sp-2);">Synthèses</h3>
          <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
            Occupation des installations, répartition intra/extra-muros par période et niveau.
          </p>
          <button class="btn btn-primary" id="btn-synthese" ${seances.length === 0 ? 'disabled' : ''}>
            Exporter synthèses (Excel)
          </button>
        </div>

        <!-- Export PDF EDT Équipe -->
        <div class="card" style="cursor:default;">
          <div style="font-size:2rem;margin-bottom:var(--sp-3);">&#128196;</div>
          <h3 style="margin-bottom:var(--sp-2);">PDF EDT Équipe</h3>
          <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
            Grille semaine complète de l'équipe EPS au format PDF (paysage A4), avec couleurs par installation.
          </p>
          <div style="display:flex;gap:var(--sp-2);">
            <select class="form-select" id="export-pdf-equipe-per" style="flex:1;">
              <option value="">Toutes les périodes</option>
              ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
            </select>
            <button class="btn btn-primary" id="btn-export-pdf-equipe" ${seances.length === 0 ? 'disabled' : ''}>
              Exporter PDF
            </button>
          </div>
        </div>

        <!-- Export PDF Fiches individuelles -->
        <div class="card" style="cursor:default;">
          <div style="font-size:2rem;margin-bottom:var(--sp-3);">&#128101;</div>
          <h3 style="margin-bottom:var(--sp-2);">Fiches individuelles (PDF)</h3>
          <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
            Emploi du temps individuel de chaque enseignant au format PDF (portrait A4), à distribuer.
          </p>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
            <select class="form-select" id="export-pdf-fiche-per" style="flex:1;min-width:120px;">
              <option value="">Toutes les périodes</option>
              ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
            </select>
            <select class="form-select" id="export-pdf-fiche-ens" style="flex:1;min-width:130px;">
              <option value="">Tous les enseignants</option>
              ${enseignants.map(e => `<option value="${e.id}">${e.prenom ? e.prenom + ' ' : ''}${e.nom}</option>`).join('')}
            </select>
            <button class="btn btn-primary" id="btn-export-pdf-fiches" ${seances.length === 0 ? 'disabled' : ''}>
              Exporter PDF
            </button>
          </div>
        </div>

        <!-- Export PDF Fiches par classe -->
        <div class="card" style="cursor:default;">
          <div style="font-size:2rem;margin-bottom:var(--sp-3);">&#127979;</div>
          <h3 style="margin-bottom:var(--sp-2);">Fiches par classe (PDF)</h3>
          <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
            Emploi du temps de chaque classe au format PDF (portrait A4) — affiche le professeur, l'activité et l'installation.
          </p>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
            <select class="form-select" id="export-pdf-classe-per" style="flex:1;min-width:120px;">
              <option value="">Toutes les périodes</option>
              ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
            </select>
            <select class="form-select" id="export-pdf-classe-cls" style="flex:1;min-width:130px;">
              <option value="">Toutes les classes</option>
              ${classes.sort((a,b) => a.nom.localeCompare(b.nom,'fr')).map(c => `<option value="${c.id}">${c.nom}</option>`).join('')}
            </select>
            <button class="btn btn-primary" id="btn-export-pdf-classes" ${seances.length === 0 ? 'disabled' : ''}>
              Exporter PDF
            </button>
          </div>
        </div>
        <!-- Synthèse occupation installations -->
        <div class="card" style="cursor:default;grid-column:1/-1;">
          <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-2);">
            <span style="font-size:1.8rem;">📍</span>
            <h3 style="margin:0;">Synthèse occupation installations</h3>
            <span style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-left:auto;">
              Qui est où, quand — vue sur une page
            </span>
          </div>
          <p style="font-size:var(--fs-sm);color:var(--c-text-secondary);margin-bottom:var(--sp-4);">
            Tableau croisé installations × créneaux : toutes les classes et enseignants, jour par jour.
            S'ouvre dans une nouvelle fenêtre prête à imprimer ou enregistrer en PDF.
          </p>
          <div style="display:flex;gap:var(--sp-2);">
            <select class="form-select" id="synthese-occ-per" style="flex:1;max-width:280px;">
              <option value="">Toutes les périodes</option>
              ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
            </select>
            <button class="btn btn-primary" id="btn-synthese-occ" ${seances.length === 0 ? 'disabled' : ''}>
              Afficher / Imprimer
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  // === Partage lecture seule (HTML) ===
  document.getElementById('btn-export-partage')?.addEventListener('click', async () => {
    const periodeId = document.getElementById('export-partage-per')?.value;
    await exportPartageHtml(periodeId);
  });

  // === Export CSV Mairie ===
  document.getElementById('btn-export-mairie')?.addEventListener('click', async () => {
    await exportCsvMairie(document.getElementById('export-mairie-per')?.value);
  });

  // === Export Transport CSV ===
  document.getElementById('btn-export-transport')?.addEventListener('click', async () => {
    await exportCsvTransport(document.getElementById('export-transport-per')?.value);
  });

  // === Exclusions transport — init liste ===
  let exclusions = await loadExclusions();
  renderExclusionsList(exclusions, classes, 'exclusions-list');

  // === Exclusions transport — ajout ===
  document.getElementById('btn-add-exclusion')?.addEventListener('click', async () => {
    const date   = document.getElementById('excl-date')?.value;
    const raison = document.getElementById('excl-raison')?.value.trim();
    const sel    = document.getElementById('excl-classes');
    const opts   = [...(sel?.selectedOptions || [])].map(o => o.value);

    if (!date) { toast.warning('Veuillez saisir une date'); return; }

    // Déterminer classesIds
    let classesIds = 'all';
    if (opts.length > 0 && !opts.includes('all')) {
      classesIds = opts.map(v => parseInt(v)).filter(Boolean);
    }

    exclusions.push({
      id:         crypto.randomUUID(),
      date,
      raison,
      classesIds,
    });
    await saveExclusions(exclusions);
    renderExclusionsList(exclusions, classes, 'exclusions-list');

    // Reset form
    if (document.getElementById('excl-date'))   document.getElementById('excl-date').value = '';
    if (document.getElementById('excl-raison')) document.getElementById('excl-raison').value = '';
    // Reset select : remettre "Toutes" sélectionné
    if (sel) { [...sel.options].forEach(o => { o.selected = o.value === 'all'; }); }
    toast.success('Date exclue ajoutée');
  });

  // === Exclusions transport — suppression (délégation) ===
  document.getElementById('exclusions-list')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.delExcl;
    if (!id) return;
    exclusions = exclusions.filter(ex => ex.id !== id);
    await saveExclusions(exclusions);
    renderExclusionsList(exclusions, classes, 'exclusions-list');
    toast.success('Exclusion supprimée');
  });

  // === Export Transport PDF ===
  document.getElementById('btn-export-transport-pdf')?.addEventListener('click', async () => {
    const periodeId = document.getElementById('export-transport-pdf-per')?.value || null;
    const excl      = await loadExclusions();
    await exportPdfTransport(periodeId, excl);
  });

  // === Export Excel EDT ===
  document.getElementById('btn-export-excel')?.addEventListener('click', async () => {
    await exportExcelEdt(document.getElementById('export-edt-per')?.value);
  });

  // === Synthèses ===
  document.getElementById('btn-synthese')?.addEventListener('click', async () => {
    await exportSyntheses();
  });

  // === Export PDF EDT Équipe ===
  document.getElementById('btn-export-pdf-equipe')?.addEventListener('click', async () => {
    await exportPdfEquipe(document.getElementById('export-pdf-equipe-per')?.value);
  });

  // === Export PDF Fiches individuelles ===
  document.getElementById('btn-export-pdf-fiches')?.addEventListener('click', async () => {
    const periodeId = document.getElementById('export-pdf-fiche-per')?.value;
    const enseignantId = document.getElementById('export-pdf-fiche-ens')?.value;
    await exportPdfEnseignants(periodeId, enseignantId);
  });

  // === Export PDF Fiches par classe ===
  document.getElementById('btn-export-pdf-classes')?.addEventListener('click', async () => {
    const periodeId = document.getElementById('export-pdf-classe-per')?.value;
    const classeId  = document.getElementById('export-pdf-classe-cls')?.value;
    await exportPdfClasses(periodeId, classeId);
  });

  // === Synthèse occupation installations ===
  document.getElementById('btn-synthese-occ')?.addEventListener('click', async () => {
    await afficherSyntheseOccupation(document.getElementById('synthese-occ-per')?.value);
  });

  // === Export Projet JSON (réutilise la fonction globale) ===
  document.getElementById('btn-export-json')?.addEventListener('click', async () => {
    const { saveProject } = await import('../../app.js');
    await saveProject();
  });

  // === Import Projet JSON ===
  document.getElementById('btn-import-json')?.addEventListener('click', () => {
    document.getElementById('import-json-file')?.click();
  });
  document.getElementById('import-json-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.enseignants && !data.classes && !data.config) {
        throw new Error('Ce fichier ne semble pas être un projet EDT EPS valide');
      }
      const confirm = window.confirm(
        `Charger le projet depuis "${file.name}" ?\n\nAttention : cela remplacera TOUTES les données actuelles.`
      );
      if (!confirm) {
        e.target.value = '';
        return;
      }
      await importProjetJson(data);
      toast.success('Projet importé avec succès ! Rechargement...');
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast.error('Erreur import : ' + err.message);
    }
    e.target.value = '';
  });
}

// ============================================================
// EXPORT CSV MAIRIE
// Tri : PERIODE → JOUR → LIEU → CRENEAU
// ============================================================
async function exportCsvMairie(periodeId) {
  const [seances, installations, lieux, classes, enseignants, activites, periodes] = await Promise.all([
    db.seances.toArray(), db.installations.toArray(), db.lieux.toArray(),
    db.classes.toArray(), db.enseignants.toArray(), db.activites.toArray(), db.periodes.toArray(),
  ]);
  const etablissement = await getConfig('etablissementNom') || 'Établissement';
  const zone = await getConfig('etablissementZone') || 'B';
  const anneeScolaire = await getConfig('anneeScolaire') || '2025-2026';
  const exclusions = getCalendrierExclusions(zone, anneeScolaire);

  let data = seances;
  if (periodeId) {
    data = data.filter(s => s.periodeId === parseInt(periodeId));
  }

  // Index des ordres de périodes pour le tri
  const periodeOrdreMap = {};
  for (const p of periodes) {
    periodeOrdreMap[p.id] = p.ordre ?? p.id;
  }

  let nbDatesMissing = 0;

  const rows = data.map(s => {
    const inst = installations.find(i => i.id === s.installationId);
    const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;
    const cls = classes.find(c => c.id === s.classeId);
    const act = activites.find(a => a.id === s.activiteId);
    const per = periodes.find(p => p.id === s.periodeId);

    // Générer les dates pour cette période (exclut vacances zone + jours fériés)
    let dates = '';
    if (per?.dateDebut && per?.dateFin) {
      dates = genererDatesJour(s.jour, new Date(per.dateDebut), new Date(per.dateFin), exclusions).join(', ');
    } else {
      nbDatesMissing++;
    }

    return {
      // Champs de tri internes
      _sortPeriode: periodeOrdreMap[s.periodeId] || 99,
      _sortJour: jourOrdre(s.jour),
      _sortLieu: (lieu?.nom || '').toLowerCase(),
      _sortHeure: s.heureDebut || '',
      // Colonnes CSV
      COMPLEXE: lieu?.nom || '',
      INSTALLATION: inst?.nom || '',
      JOUR: s.jour ? s.jour.charAt(0).toUpperCase() + s.jour.slice(1) : '',
      CRENEAU: `${s.heureDebut}-${s.heureFin}`,
      PERIODE: per?.nom || '',
      DATES: dates,
      ETABLISSEMENT: etablissement,
      CLASSE: cls?.nom || '',
      ACTIVITE: act?.nom || '',
    };
  });

  // Tri : PERIODE → JOUR → LIEU → CRENEAU
  rows.sort((a, b) => {
    if (a._sortPeriode !== b._sortPeriode) return a._sortPeriode - b._sortPeriode;
    if (a._sortJour !== b._sortJour) return a._sortJour - b._sortJour;
    if (a._sortLieu !== b._sortLieu) return a._sortLieu.localeCompare(b._sortLieu);
    if (a._sortHeure !== b._sortHeure) return a._sortHeure.localeCompare(b._sortHeure);
    return 0;
  });

  // Supprimer les champs de tri internes
  const cleanRows = rows.map(({ _sortPeriode, _sortJour, _sortLieu, _sortHeure, ...rest }) => rest);

  const csv = Papa.unparse(cleanRows, { delimiter: ';' });
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const per = periodeId ? periodes.find(p => p.id === parseInt(periodeId))?.nom || '' : 'annuel';
  await saveExportFile(blob, `Reservations_Mairie_${per}_${new Date().toISOString().split('T')[0]}.csv`);

  if (nbDatesMissing > 0) {
    toast.warning(`Export CSV mairie sauvegardé — ${nbDatesMissing} séance(s) sans dates (période non configurée)`);
  } else {
    toast.success('Export CSV mairie sauvegardé');
  }
}

// ============================================================
// EXPORT CSV TRANSPORT
// Tri : PERIODE → JOUR → LIEU → CRENEAU
// Horaires bus : départ = début cours + 15min, retour = fin cours - 15min
// ============================================================
async function exportCsvTransport(periodeId) {
  const [seances, installations, lieux, classes, enseignants, periodes] = await Promise.all([
    db.seances.toArray(), db.installations.toArray(), db.lieux.toArray(),
    db.classes.toArray(), db.enseignants.toArray(), db.periodes.toArray(),
  ]);
  const zone = await getConfig('etablissementZone') || 'B';
  const anneeScolaire = await getConfig('anneeScolaire') || '2025-2026';
  const exclusions = getCalendrierExclusions(zone, anneeScolaire);

  // Index des ordres de périodes pour le tri
  const periodeOrdreMap = {};
  for (const p of periodes) {
    periodeOrdreMap[p.id] = p.ordre ?? p.id;
  }

  let data = seances;
  if (periodeId) {
    data = data.filter(s => s.periodeId === parseInt(periodeId));
  }

  // Filtrer seulement les séances qui nécessitent un transport
  let nbDatesMissing = 0;
  const rows = [];
  for (const s of data) {
    const inst = installations.find(i => i.id === s.installationId);
    const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;
    if (!lieu?.necessiteBus) continue;

    const cls = classes.find(c => c.id === s.classeId);
    const ens = enseignants.find(e => e.id === s.enseignantId);
    const per = periodes.find(p => p.id === s.periodeId);

    // Calculer heures bus (départ +15min après début, retour -15min avant fin)
    const startMin = heureToMin(s.heureDebut);
    const endMin = heureToMin(s.heureFin);
    const departBus = minToHeure(startMin + 15);  // Bus aller : début cours + 15min
    const retourBus = minToHeure(endMin - 15);     // Bus retour : fin cours - 15min

    // Dates — chaque date = 1 rotation (1 aller-retour bus)
    let datesArr = [];
    if (per?.dateDebut && per?.dateFin) {
      datesArr = genererDatesJour(s.jour, new Date(per.dateDebut), new Date(per.dateFin), exclusions);
    } else {
      nbDatesMissing++;
    }

    rows.push({
      // Champs de tri internes
      _sortPeriode: periodeOrdreMap[s.periodeId] || 99,
      _sortJour: jourOrdre(s.jour),
      _sortLieu: (lieu?.nom || '').toLowerCase(),
      _sortHeure: s.heureDebut || '',
      _periodeNom: per?.nom || '',
      // Colonnes CSV
      JOUR: s.jour ? s.jour.charAt(0).toUpperCase() + s.jour.slice(1) : '',
      CRENEAU: `${s.heureDebut}-${s.heureFin}`,
      LIEU: lieu?.nom || '',
      BUS_ALLER: departBus,
      BUS_RETOUR: retourBus,
      DATES: datesArr.join(' ; '),
      PERIODE: per?.nom || '',
      CLASSE: cls?.nom || '',
      EFFECTIF: cls?.effectif || '',
      ENSEIGNANT: ens ? `${ens.prenom} ${ens.nom}` : '',
      NB_ROTATIONS: datesArr.length,
    });
  }

  if (rows.length === 0) {
    toast.warning('Aucune séance nécessitant un transport');
    return;
  }

  // Tri : PERIODE → JOUR → LIEU → CRENEAU
  rows.sort((a, b) => {
    if (a._sortPeriode !== b._sortPeriode) return a._sortPeriode - b._sortPeriode;
    if (a._sortJour !== b._sortJour) return a._sortJour - b._sortJour;
    if (a._sortLieu !== b._sortLieu) return a._sortLieu.localeCompare(b._sortLieu);
    if (a._sortHeure !== b._sortHeure) return a._sortHeure.localeCompare(b._sortHeure);
    return 0;
  });

  // Insérer les lignes de total par période
  // Regrouper par période pour calculer les totaux
  const totalParPeriode = {};
  for (const r of rows) {
    const pNom = r._periodeNom;
    if (!totalParPeriode[pNom]) totalParPeriode[pNom] = 0;
    totalParPeriode[pNom] += r.NB_ROTATIONS;
  }

  // Construire les lignes finales avec lignes de total intercalées
  const finalRows = [];
  let currentPeriode = null;
  for (const r of rows) {
    // Détecter le changement de période pour insérer le total de la période précédente
    if (currentPeriode !== null && r._periodeNom !== currentPeriode) {
      finalRows.push({
        JOUR: '',
        CRENEAU: '',
        LIEU: '',
        BUS_ALLER: '',
        BUS_RETOUR: '',
        DATES: '',
        PERIODE: `TOTAL ${currentPeriode}`,
        CLASSE: '',
        EFFECTIF: '',
        ENSEIGNANT: '',
        NB_ROTATIONS: totalParPeriode[currentPeriode] || 0,
      });
      // Ligne vide de séparation
      finalRows.push({
        JOUR: '', CRENEAU: '', LIEU: '', BUS_ALLER: '', BUS_RETOUR: '',
        DATES: '', PERIODE: '', CLASSE: '', EFFECTIF: '', ENSEIGNANT: '', NB_ROTATIONS: '',
      });
    }
    currentPeriode = r._periodeNom;

    // Supprimer les champs de tri internes
    const { _sortPeriode, _sortJour, _sortLieu, _sortHeure, _periodeNom, ...clean } = r;
    finalRows.push(clean);
  }
  // Total de la dernière période
  if (currentPeriode !== null) {
    finalRows.push({
      JOUR: '',
      CRENEAU: '',
      LIEU: '',
      BUS_ALLER: '',
      BUS_RETOUR: '',
      DATES: '',
      PERIODE: `TOTAL ${currentPeriode}`,
      CLASSE: '',
      EFFECTIF: '',
      ENSEIGNANT: '',
      NB_ROTATIONS: totalParPeriode[currentPeriode] || 0,
    });
  }

  // Total général
  const totalGeneral = Object.values(totalParPeriode).reduce((sum, v) => sum + v, 0);
  finalRows.push({
    JOUR: '', CRENEAU: '', LIEU: '', BUS_ALLER: '', BUS_RETOUR: '',
    DATES: '', PERIODE: '', CLASSE: '', EFFECTIF: '', ENSEIGNANT: '', NB_ROTATIONS: '',
  });
  finalRows.push({
    JOUR: '',
    CRENEAU: '',
    LIEU: '',
    BUS_ALLER: '',
    BUS_RETOUR: '',
    DATES: '',
    PERIODE: 'TOTAL GÉNÉRAL',
    CLASSE: '',
    EFFECTIF: '',
    ENSEIGNANT: '',
    NB_ROTATIONS: totalGeneral,
  });

  const csv = Papa.unparse(finalRows, { delimiter: ';' });
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const per = periodeId ? periodes.find(p => p.id === parseInt(periodeId))?.nom || '' : 'annuel';
  await saveExportFile(blob, `Transport_EPS_${per}_${new Date().toISOString().split('T')[0]}.csv`);

  if (nbDatesMissing > 0) {
    toast.warning(`Export transport sauvegardé — ${nbDatesMissing} séance(s) sans dates (période non configurée)`);
  } else {
    toast.success('Export transport sauvegardé');
  }
}

// ============================================================
// EXPORT EXCEL EDT EQUIPE
// Grille semaine par période, 1 feuille par période
// ============================================================
async function exportExcelEdt(periodeId) {
  const [seances, installations, lieux, classes, enseignants, activites, periodes] = await Promise.all([
    db.seances.toArray(), db.installations.toArray(), db.lieux.toArray(),
    db.classes.toArray(), db.enseignants.toArray(), db.activites.toArray(), db.periodes.toArray(),
  ]);
  const etablissement = await getConfig('etablissementNom') || 'Établissement';
  const joursOuvres = await getConfig('joursOuvres') || JOURS_OUVRES;
  const heureDebut = await getConfig('heureDebut') || '08:00';
  const heureFin = await getConfig('heureFin') || '17:00';

  // Périodes à exporter
  let periodesToExport = periodes.sort((a, b) => (a.ordre ?? a.id) - (b.ordre ?? b.id));
  if (periodeId) {
    periodesToExport = periodesToExport.filter(p => p.id === parseInt(periodeId));
  }

  if (periodesToExport.length === 0) {
    toast.warning('Aucune période trouvée');
    return;
  }

  // Générer les créneaux horaires (1h par ligne)
  const slots = [];
  const startMin = heureToMin(heureDebut);
  const endMin = heureToMin(heureFin);
  for (let m = startMin; m < endMin; m += 60) {
    slots.push({
      debut: minToHeure(m),
      fin: minToHeure(m + 60),
      label: `${minToHeure(m)}-${minToHeure(m + 60)}`,
    });
  }

  const wb = new ExcelJS.Workbook();

  for (const per of periodesToExport) {
    const perSeances = seances.filter(s => s.periodeId === per.id);

    const headerRow = ['Créneau', ...joursOuvres.map(j => j.charAt(0).toUpperCase() + j.slice(1))];
    const dataRows = [];

    for (const slot of slots) {
      const row = [slot.label];

      for (const jour of joursOuvres) {
        const slotSeances = perSeances.filter(s => {
          if ((s.jour || '').toLowerCase() !== jour) return false;
          const sStart = heureToMin(s.heureDebut);
          const sEnd = heureToMin(s.heureFin);
          const slotStart = heureToMin(slot.debut);
          const slotEnd = heureToMin(slot.fin);
          return sStart < slotEnd && sEnd > slotStart;
        });

        if (slotSeances.length === 0) {
          row.push('');
        } else {
          const cellContent = slotSeances.map(s => {
            const cls = classes.find(c => c.id === s.classeId);
            const ens = enseignants.find(e => e.id === s.enseignantId);
            const act = activites.find(a => a.id === s.activiteId);
            const inst = installations.find(i => i.id === s.installationId);
            const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;

            const parts = [];
            if (cls) parts.push(cls.nom);
            if (act) parts.push(act.nom);
            if (lieu) parts.push(lieu.nom);
            if (inst && inst.nom !== lieu?.nom) parts.push(inst.nom);
            if (ens) parts.push(`(${ens.prenom?.[0] || ''}. ${ens.nom})`);
            return parts.join(' — ');
          }).join('\n');

          row.push(cellContent);
        }
      }

      dataRows.push(row);
    }

    const wsData = [
      [`EDT ${etablissement} — ${per.nom}`],
      [],
      headerRow,
      ...dataRows,
    ];

    addSheetFromAoa(wb, per.nom.substring(0, 31), wsData,
      [{ wch: 14 }, ...joursOuvres.map(() => ({ wch: 40 }))],
      [{ s: { r: 0, c: 0 }, e: { r: 0, c: joursOuvres.length } }],
    );
  }

  // Export EDT par enseignant (une feuille par prof)
  for (const ens of enseignants) {
    const ensSeances = seances.filter(s => s.enseignantId === ens.id);
    if (ensSeances.length === 0) continue;

    const headerRow = ['Créneau', ...joursOuvres.map(j => j.charAt(0).toUpperCase() + j.slice(1))];
    const dataRows = [];

    for (const per of periodesToExport) {
      const perSeances = ensSeances.filter(s => s.periodeId === per.id);
      if (perSeances.length === 0) continue;

      dataRows.push([`— ${per.nom} —`, ...joursOuvres.map(() => '')]);

      for (const slot of slots) {
        const row = [slot.label];

        for (const jour of joursOuvres) {
          const slotSeances = perSeances.filter(s => {
            if ((s.jour || '').toLowerCase() !== jour) return false;
            const sStart = heureToMin(s.heureDebut);
            const sEnd = heureToMin(s.heureFin);
            const slotStart = heureToMin(slot.debut);
            const slotEnd = heureToMin(slot.fin);
            return sStart < slotEnd && sEnd > slotStart;
          });

          if (slotSeances.length === 0) {
            row.push('');
          } else {
            const cellContent = slotSeances.map(s => {
              const cls = classes.find(c => c.id === s.classeId);
              const act = activites.find(a => a.id === s.activiteId);
              const inst = installations.find(i => i.id === s.installationId);
              const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;

              const parts = [];
              if (cls) parts.push(cls.nom);
              if (act) parts.push(act.nom);
              if (lieu) parts.push(lieu.nom);
              if (inst && inst.nom !== lieu?.nom) parts.push(inst.nom);
              return parts.join(' — ');
            }).join('\n');

            row.push(cellContent);
          }
        }

        dataRows.push(row);
      }
    }

    const wsData = [
      [`EDT ${ens.prenom} ${ens.nom}`],
      [],
      headerRow,
      ...dataRows,
    ];

    const sheetName = `${ens.prenom?.[0] || ''}. ${ens.nom}`.substring(0, 31);
    addSheetFromAoa(wb, sheetName, wsData,
      [{ wch: 14 }, ...joursOuvres.map(() => ({ wch: 35 }))],
      [{ s: { r: 0, c: 0 }, e: { r: 0, c: joursOuvres.length } }],
    );
  }

  // Télécharger
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await saveExportFile(blob, `EDT_EPS_${etablissement}_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast.success('Export Excel sauvegardé');
}

// ============================================================
// SYNTHÈSES
// Occupation installations + répartition intra/extra par niveau
// ============================================================

const COLLEGE_NIVEAUX = new Set(['6e', '5e', '4e', '3e']);
const LYCEE_NIVEAUX   = new Set(['2nde', '1ere', 'term']);

function isCollege(niveau) { return COLLEGE_NIVEAUX.has(niveau); }
function isLycee(niveau)   { return LYCEE_NIVEAUX.has(niveau); }

// Construit une feuille d'occupation des installations.
// seancesFiltered : séances déjà filtrées (toutes, collège seul, lycée seul)
function buildOccupationSheet(wb, titre, sheetName, installations, lieux, seancesFiltered, periodesTriees) {
  const headerRow = ['Installation', 'Lieu', 'Capacité', ...periodesTriees.map(p => p.nom), 'TOTAL'];
  const dataRows  = [];

  for (const inst of installations) {
    const lieu = lieux.find(l => l.id === inst.lieuId);
    // N'inclure que les installations utilisées dans ces séances
    const instSeances = seancesFiltered.filter(s => s.installationId === inst.id);
    if (instSeances.length === 0) continue;

    const row = [inst.nom, lieu?.nom || '', inst.capaciteSimultanee || ''];
    let totalInst = 0;
    for (const per of periodesTriees) {
      const count = instSeances.filter(s => s.periodeId === per.id).length;
      row.push(count || '');
      totalInst += count;
    }
    row.push(totalInst);
    dataRows.push(row);
  }

  // Ligne total
  const totalRow = ['TOTAL', '', ''];
  let grandTotal = 0;
  for (const per of periodesTriees) {
    const count = seancesFiltered.filter(s => s.periodeId === per.id).length;
    totalRow.push(count);
    grandTotal += count;
  }
  totalRow.push(grandTotal);
  dataRows.push(totalRow);

  const wsData = [[titre], [], headerRow, ...dataRows];
  addSheetFromAoa(wb, sheetName, wsData,
    [{ wch: 25 }, { wch: 20 }, { wch: 10 }, ...periodesTriees.map(() => ({ wch: 14 })), { wch: 10 }],
    [{ s: { r: 0, c: 0 }, e: { r: 0, c: periodesTriees.length + 3 } }],
  );
}

// Construit une feuille transport.
// seancesFiltered : séances déjà filtrées (toutes, collège seul, lycée seul)
// Tri : période → jour → créneau → lieu
function buildTransportSheet(wb, titre, sheetName, installations, lieux, classes, enseignants, periodesTriees, seancesFiltered) {
  const periodeOrdreMap = {};
  for (const per of periodesTriees) periodeOrdreMap[per.id] = per.ordre ?? per.id;

  const headerRow = ['Période', 'Jour', 'Créneau', 'Lieu', 'Classe', 'Bus Aller', 'Bus Retour', 'Enseignant'];
  const rows = [];

  for (const s of seancesFiltered) {
    const inst = installations.find(i => i.id === s.installationId);
    const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;
    if (!lieu?.necessiteBus) continue;

    const per = periodesTriees.find(p => p.id === s.periodeId);
    const cls = classes.find(c => c.id === s.classeId);
    const ens = enseignants.find(e => e.id === s.enseignantId);
    const startMin = heureToMin(s.heureDebut);
    const endMin   = heureToMin(s.heureFin);

    rows.push({
      _sortPer:  periodeOrdreMap[s.periodeId] ?? 99,
      _sortJour: jourOrdre(s.jour),
      _sortHre:  s.heureDebut || '',
      _sortLieu: (lieu?.nom || '').toLowerCase(),
      data: [
        per?.nom || '',
        s.jour ? s.jour.charAt(0).toUpperCase() + s.jour.slice(1) : '',
        `${s.heureDebut}-${s.heureFin}`,
        lieu?.nom || '',
        cls?.nom || '',
        minToHeure(startMin + 15),
        minToHeure(endMin - 15),
        ens ? `${ens.prenom} ${ens.nom}` : '',
      ],
    });
  }

  // Tri chronologique : période → jour → créneau → lieu
  rows.sort((a, b) => {
    if (a._sortPer  !== b._sortPer)  return a._sortPer  - b._sortPer;
    if (a._sortJour !== b._sortJour) return a._sortJour - b._sortJour;
    if (a._sortHre  !== b._sortHre)  return a._sortHre.localeCompare(b._sortHre);
    return a._sortLieu.localeCompare(b._sortLieu);
  });

  const wsData = [[titre], [], headerRow, ...rows.map(r => r.data)];
  addSheetFromAoa(wb, sheetName, wsData,
    [{ wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 25 }],
    [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }],
  );
}

async function exportSyntheses() {
  const [seances, installations, lieux, classes, enseignants, activites, periodes] = await Promise.all([
    db.seances.toArray(), db.installations.toArray(), db.lieux.toArray(),
    db.classes.toArray(), db.enseignants.toArray(), db.activites.toArray(), db.periodes.toArray(),
  ]);

  const etablissementType = await getConfig('etablissementType') || 'mixte';
  const isMixte = etablissementType === 'mixte';

  const periodesTriees = [...periodes].sort((a, b) => (a.ordre ?? a.id) - (b.ordre ?? b.id));

  // Sets d'IDs classes collège / lycée
  const collegeIds = new Set(classes.filter(c => isCollege(c.niveau)).map(c => c.id));
  const lyceeIds   = new Set(classes.filter(c => isLycee(c.niveau)).map(c => c.id));

  const seancesCollege = seances.filter(s => collegeIds.has(s.classeId));
  const seancesLycee   = seances.filter(s => lyceeIds.has(s.classeId));

  const wb = new ExcelJS.Workbook();

  // ── Feuilles Occupation installations ──
  buildOccupationSheet(wb, 'Occupation des installations', 'Occupation Installations',
    installations, lieux, seances, periodesTriees);

  if (isMixte) {
    buildOccupationSheet(wb, 'Occupation des installations — Collège', 'Occupation Collège',
      installations, lieux, seancesCollege, periodesTriees);
    buildOccupationSheet(wb, 'Occupation des installations — Lycée', 'Occupation Lycée',
      installations, lieux, seancesLycee, periodesTriees);
  }

  // ── Feuille : Répartition Intra/Extra-muros par niveau ──
  {
    const niveaux = [...new Set(classes.map(c => c.niveau).filter(Boolean))];
    const headerRow = ['Niveau', ...periodesTriees.map(p => `${p.nom} Intra`), ...periodesTriees.map(p => `${p.nom} Extra`), 'Total Intra', 'Total Extra'];
    const dataRows = [];

    for (const niv of niveaux) {
      const classesNiv = classes.filter(c => c.niveau === niv);
      const classesIds = new Set(classesNiv.map(c => c.id));

      const row = [niv];
      let totalIntra = 0;
      let totalExtra = 0;

      for (const per of periodesTriees) {
        const perSeances = seances.filter(s => classesIds.has(s.classeId) && s.periodeId === per.id);
        let intra = 0;
        for (const s of perSeances) {
          const inst = installations.find(i => i.id === s.installationId);
          const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;
          if (lieu?.type === 'intra') intra++;
        }
        row.push(intra || '');
        totalIntra += intra;
      }

      for (const per of periodesTriees) {
        const perSeances = seances.filter(s => classesIds.has(s.classeId) && s.periodeId === per.id);
        let extra = 0;
        for (const s of perSeances) {
          const inst = installations.find(i => i.id === s.installationId);
          const lieu = inst ? lieux.find(l => l.id === inst.lieuId) : null;
          if (lieu?.type === 'extra') extra++;
        }
        row.push(extra || '');
        totalExtra += extra;
      }

      row.push(totalIntra, totalExtra);
      dataRows.push(row);
    }

    const wsData = [
      ['Répartition Intra / Extra-muros par niveau'],
      [],
      headerRow,
      ...dataRows,
    ];

    addSheetFromAoa(wb, 'Intra-Extra par Niveau', wsData,
      [{ wch: 10 }, ...periodesTriees.map(() => ({ wch: 14 })), ...periodesTriees.map(() => ({ wch: 14 })), { wch: 14 }, { wch: 14 }],
      [{ s: { r: 0, c: 0 }, e: { r: 0, c: periodesTriees.length * 2 + 2 } }],
    );
  }

  // ── Feuille : Heures enseignants par période ──
  {
    const headerRow = ['Enseignant', 'ORS', ...periodesTriees.map(p => p.nom), 'TOTAL Heures/sem'];
    const dataRows = [];

    for (const ens of enseignants) {
      const row = [`${ens.prenom} ${ens.nom}`, ens.ors || ''];

      let totalHeures = 0;
      for (const per of periodesTriees) {
        const perSeances = seances.filter(s => s.enseignantId === ens.id && s.periodeId === per.id);
        let heures = 0;
        for (const s of perSeances) {
          const dureeMin = heureToMin(s.heureFin) - heureToMin(s.heureDebut);
          heures += dureeMin / 60;
        }
        row.push(heures ? `${heures}h` : '');
        totalHeures = Math.max(totalHeures, heures);
      }
      row.push(`${totalHeures}h`);
      dataRows.push(row);
    }

    const wsData = [
      ['Charge horaire enseignants'],
      [],
      headerRow,
      ...dataRows,
    ];

    addSheetFromAoa(wb, 'Charge Enseignants', wsData,
      [{ wch: 25 }, { wch: 8 }, ...periodesTriees.map(() => ({ wch: 14 })), { wch: 18 }],
      [{ s: { r: 0, c: 0 }, e: { r: 0, c: periodesTriees.length + 2 } }],
    );
  }

  // ── Feuille : Activités par niveau et période ──
  {
    const niveaux = [...new Set(classes.map(c => c.niveau).filter(Boolean))];
    const headerRow = ['Niveau', 'Classe', ...periodesTriees.map(p => p.nom)];
    const dataRows = [];

    for (const niv of niveaux) {
      const classesNiv = classes.filter(c => c.niveau === niv).sort((a, b) => a.nom.localeCompare(b.nom));

      for (const cls of classesNiv) {
        const row = [niv, cls.nom];

        for (const per of periodesTriees) {
          const perSeances = seances.filter(s => s.classeId === cls.id && s.periodeId === per.id);
          const activitesStr = perSeances.map(s => {
            const act = activites.find(a => a.id === s.activiteId);
            return act?.nom || '?';
          }).join(', ');
          row.push(activitesStr || '');
        }

        dataRows.push(row);
      }
    }

    const wsData = [
      ['Activités par classe et par période'],
      [],
      headerRow,
      ...dataRows,
    ];

    addSheetFromAoa(wb, 'Activités par Classe', wsData,
      [{ wch: 8 }, { wch: 10 }, ...periodesTriees.map(() => ({ wch: 30 }))],
      [{ s: { r: 0, c: 0 }, e: { r: 0, c: periodesTriees.length + 1 } }],
    );
  }

  // ── Feuilles Transport ──
  buildTransportSheet(wb, 'Synthèse transport', 'Transport',
    installations, lieux, classes, enseignants, periodesTriees, seances);

  if (isMixte) {
    buildTransportSheet(wb, 'Synthèse transport — Collège', 'Transport Collège',
      installations, lieux, classes, enseignants, periodesTriees, seancesCollege);
    buildTransportSheet(wb, 'Synthèse transport — Lycée', 'Transport Lycée',
      installations, lieux, classes, enseignants, periodesTriees, seancesLycee);
  }

  // Télécharger
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const etablissement = await getConfig('etablissementNom') || 'Établissement';
  await saveExportFile(blob, `Syntheses_EPS_${etablissement}_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast.success('Synthèses sauvegardées');
}

// ============================================================
// SYNTHÈSE OCCUPATION INSTALLATIONS — popup imprimable
// Tableau croisé : créneau × installation → classe + enseignant
// ============================================================
async function afficherSyntheseOccupation(periodeId) {
  const [seances, installations, lieux, classes, enseignants, periodes] = await Promise.all([
    db.seances.toArray(), db.installations.toArray(), db.lieux.toArray(),
    db.classes.toArray(), db.enseignants.toArray(), db.periodes.toArray(),
  ]);
  const etablissement = await getConfig('etablissementNom') || 'Établissement';

  let data = seances;
  let periodeLabel = 'Toutes les périodes';
  if (periodeId) {
    data = data.filter(s => s.periodeId === parseInt(periodeId));
    periodeLabel = periodes.find(p => p.id === parseInt(periodeId))?.nom || '';
  }

  if (data.length === 0) {
    toast.warning('Aucune séance à afficher');
    return;
  }

  // Installations utilisées, triées par lieu puis nom
  const usedInstIds = new Set(data.map(s => s.installationId).filter(Boolean));
  const usedInsts = installations
    .filter(i => usedInstIds.has(i.id))
    .sort((a, b) => {
      const lA = lieux.find(l => l.id === a.lieuId)?.nom || '';
      const lB = lieux.find(l => l.id === b.lieuId)?.nom || '';
      return lA !== lB ? lA.localeCompare(lB, 'fr') : a.nom.localeCompare(b.nom, 'fr');
    });

  // Créneaux uniques (jour + heureDebut + heureFin), triés calendrier puis heure
  const slotMap = new Map();
  for (const s of data) {
    if (!s.jour || !s.heureDebut) continue;
    const key = `${s.jour}|${s.heureDebut}|${s.heureFin}`;
    if (!slotMap.has(key)) slotMap.set(key, { jour: s.jour, heureDebut: s.heureDebut, heureFin: s.heureFin });
  }
  const slots = [...slotMap.values()].sort((a, b) => {
    const jo = jourOrdre(a.jour) - jourOrdre(b.jour);
    return jo !== 0 ? jo : a.heureDebut.localeCompare(b.heureDebut);
  });

  // Palette couleurs (basée sur lieu slug, identique à la grille EDT)
  const INST_COLORS = {
    'fort-carre':   { bg: '#FCE4EC', border: '#E91E63' },
    'beach-fc':     { bg: '#FFEBEE', border: '#D32F2F' },
    'auvergne':     { bg: '#FFF8E1', border: '#F59E0B' },
    'stade-auvergne':{ bg: '#FFF8E1', border: '#F59E0B' },
    'foch':         { bg: '#E8F5E9', border: '#43A047' },
    'stade-foch':   { bg: '#E8F5E9', border: '#43A047' },
    'fontonne':     { bg: '#EDE7F6', border: '#7B1FA2' },
    'piscine':      { bg: '#E0F7FA', border: '#0097A7' },
    'gymnase':      { bg: '#E0F2F1', border: '#00796B' },
    'terr-msj':     { bg: '#ECEFF1', border: '#546E7A' },
    'terrain-msj':  { bg: '#ECEFF1', border: '#546E7A' },
    'parc-exflora': { bg: '#F5F5F5', border: '#757575' },
  };
  function instColor(inst) {
    const lieu = lieux.find(l => l.id === inst?.lieuId);
    const slug = lieu ? slugify(lieu.nom) : slugify(inst?.nom || '');
    return INST_COLORS[slug] || { bg: '#EFF6FF', border: '#3B82F6' };
  }

  function ensLabel(ens) {
    if (!ens) return '';
    if (ens.initiales) return ens.initiales;
    return ((ens.prenom?.[0] || '') + '. ' + ens.nom).trim();
  }

  // En-têtes colonnes installations
  const colHeaders = usedInsts.map(inst => {
    const lieu = lieux.find(l => l.id === inst.lieuId);
    const c = instColor(inst);
    const lieuSub = lieu && lieu.nom !== inst.nom
      ? `<small style="font-weight:400;color:#64748b;display:block;">${lieu.nom}</small>` : '';
    return `<th style="background:${c.bg};border-bottom:3px solid ${c.border};">${inst.nom}${lieuSub}</th>`;
  }).join('');

  // Lignes du tableau
  let tableRows = '';
  let lastJour = null;
  for (const slot of slots) {
    if (slot.jour !== lastJour) {
      const jourLabel = slot.jour.charAt(0).toUpperCase() + slot.jour.slice(1);
      tableRows += `<tr class="day-sep"><td colspan="${usedInsts.length + 1}">${jourLabel}</td></tr>`;
      lastJour = slot.jour;
    }
    tableRows += '<tr>';
    tableRows += `<td class="creneau">${slot.heureDebut}–${slot.heureFin}</td>`;
    for (const inst of usedInsts) {
      const c = instColor(inst);
      const instSeances = data.filter(s =>
        s.installationId === inst.id &&
        s.jour === slot.jour &&
        s.heureDebut === slot.heureDebut &&
        s.heureFin === slot.heureFin
      );
      if (instSeances.length === 0) {
        tableRows += '<td class="empty"></td>';
      } else {
        const blocs = instSeances.map(s => {
          const cls = classes.find(cc => cc.id === s.classeId);
          const ens = enseignants.find(e => e.id === s.enseignantId);
          return `<div class="bloc" style="border-left:3px solid ${c.border};">
            <span class="bloc-cls">${cls?.nom || '?'}</span>
            <span class="bloc-ens">${ensLabel(ens)}</span>
          </div>`;
        }).join('');
        tableRows += `<td style="background:${c.bg}20;">${blocs}</td>`;
      }
    }
    tableRows += '</tr>';
  }

  const dateStr = new Date().toLocaleDateString('fr-FR');
  const nbPeriodesCols = usedInsts.length + 1;

  const popupHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Occupation installations — ${etablissement}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;background:#fff;color:#1e293b}
.no-print{position:fixed;top:0;left:0;right:0;background:#1e293b;color:#f1f5f9;
  padding:8px 16px;display:flex;align-items:center;gap:12px;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.no-print .ttl{flex:1;font-weight:700;font-size:10.5pt}
.no-print button{padding:5px 14px;border:none;border-radius:4px;cursor:pointer;font-size:8.5pt;font-weight:600}
.btn-p{background:#3b82f6;color:#fff}.btn-c{background:#475569;color:#fff}
.page{padding:52px 14px 14px}
.ph{display:flex;justify-content:space-between;align-items:flex-end;
  padding-bottom:6px;margin-bottom:8px;border-bottom:2px solid #1e293b}
.ph-title{font-size:12pt;font-weight:700}.ph-sub{font-size:8pt;color:#475569;margin-top:2px}
.ph-date{font-size:7pt;color:#94a3b8}
table{width:100%;border-collapse:collapse;table-layout:fixed}
thead th{padding:4px 5px;font-size:7.5pt;font-weight:700;text-align:center;
  border:1px solid #e2e8f0;vertical-align:bottom;line-height:1.3;word-break:break-word}
th.th-cr{background:#f1f5f9;width:70px;text-align:left;padding-left:6px}
tr.day-sep td{background:#1e293b;color:#f1f5f9;font-weight:800;font-size:8.5pt;
  letter-spacing:.12em;text-transform:uppercase;padding:4px 8px}
td{border:1px solid #e2e8f0;padding:3px 4px;vertical-align:top}
td.creneau{background:#f8fafc;font-weight:600;font-size:7.5pt;color:#475569;white-space:nowrap}
td.empty{background:#fafafa}
.bloc{display:flex;align-items:baseline;gap:5px;padding:2px 4px 2px 5px;
  border-radius:3px;background:rgba(0,0,0,.04);margin-bottom:2px}
.bloc:last-child{margin-bottom:0}
.bloc-cls{font-weight:700;font-size:8pt}
.bloc-ens{font-size:6.5pt;color:#64748b}
@media print{
  @page{size:A4 landscape;margin:8mm 10mm}
  *,*::before,*::after{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .no-print{display:none!important}
  .page{padding:0}
  .ph{margin-bottom:4px;padding-bottom:4px}
  .ph-title{font-size:10pt}
  thead th{font-size:6pt;padding:2px 3px}
  td{font-size:6pt;padding:2px 3px}
  td.creneau{font-size:6pt}
  tr.day-sep td{font-size:7pt;padding:3px 6px}
  .bloc{padding:1px 3px 1px 4px;margin-bottom:1px}
  .bloc-cls{font-size:6pt}.bloc-ens{font-size:5pt}
}
</style>
</head>
<body>
<div class="no-print">
  <span class="ttl">Occupation des installations — ${etablissement} — ${periodeLabel}</span>
  <button class="btn-p" onclick="window.print()">&#128438; Imprimer / PDF</button>
  <button class="btn-c" onclick="window.close()">&#x2715; Fermer</button>
</div>
<div class="page">
  <div class="ph">
    <div>
      <div class="ph-title">Occupation des installations</div>
      <div class="ph-sub">${etablissement} &mdash; ${periodeLabel}</div>
    </div>
    <div class="ph-date">Imprimé le ${dateStr}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="th-cr">Créneau</th>
        ${colHeaders}
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=1280,height=900');
  if (!w) {
    toast.error('Popup bloquée — autorisez les popups pour ce site dans votre navigateur');
    return;
  }
  w.document.write(popupHtml);
  w.document.close();
}

// ============================================================
// IMPORT PROJET
// ============================================================
async function importProjetJson(data) {
  const { importAllData } = await import('../../db/store.js');
  await importAllData(data);
}

// ============================================================
// HELPERS
// ============================================================
function heureToMin(h) {
  if (!h) return 0;
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + (mm || 0);
}

function minToHeure(m) {
  if (m < 0) m += 24 * 60;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
