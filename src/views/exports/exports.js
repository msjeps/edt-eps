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

  const noData = seances.length === 0;

  container.innerHTML = `
    <div style="max-width:960px;margin:0 auto;">

      <!-- ── En-tête page ── -->
      <div style="display:flex;align-items:center;gap:var(--sp-4);margin-bottom:var(--sp-8);">
        <div>
          <h2 style="margin:0;font-size:var(--fs-xl);font-weight:700;letter-spacing:-0.02em;">Exports</h2>
          <p style="margin:var(--sp-1) 0 0;font-size:var(--fs-sm);color:var(--c-text-muted);">
            ${seances.length} séance${seances.length !== 1 ? 's' : ''}
            · ${periodes.length} période${periodes.length !== 1 ? 's' : ''}
            · ${enseignants.length} enseignant${enseignants.length !== 1 ? 's' : ''}
          </p>
        </div>
        ${noData ? `<span class="exports-no-data">Aucune séance — exports désactivés</span>` : ''}
      </div>

      <!-- ════════════════════════════════════════
           SECTION 1 — PARTAGE & SAUVEGARDE
      ════════════════════════════════════════ -->
      <div class="export-section export-section--blue">
        <div class="export-section-heading">
          <div class="export-section-heading-icon" style="background:#DBEAFE;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </div>
          <div class="export-section-heading-text">
            <span class="export-section-heading-title">Partage &amp; Sauvegarde</span>
            <span class="export-section-heading-sub">Fichiers à partager ou à archiver</span>
          </div>
          <div class="export-section-heading-line"></div>
        </div>

        <div class="export-grid-2">

          <!-- Partage HTML lecture seule — carte principale (pleine largeur) -->
          <div class="export-card export-card-featured export-card-full">
            <div class="export-card-body">
              <div class="export-card-header">
                <div class="export-card-icon" style="background:#EFF6FF;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </div>
                <div class="export-card-meta">
                  <span class="export-card-title">Partage lecture seule</span>
                  <span class="fmt-badge fmt-badge-html">HTML</span>
                  <span style="background:var(--c-primary-bg-strong);color:var(--c-primary-dark);border:1px solid #BFDBFE;border-radius:var(--radius-full);padding:2px 8px;font-size:var(--fs-xs);font-weight:700;letter-spacing:.03em;">Nouveau</span>
                </div>
              </div>
              <p class="export-card-desc">
                Génère un fichier <strong>HTML autonome</strong> à envoyer par e-mail ou à déposer sur un espace partagé.
                Navigation par enseignant, par classe, filtre période, impression — <em>aucun accès à la saisie</em>.
              </p>
            </div>
            <div class="export-card-footer">
              <select class="form-select" id="export-partage-per" style="flex:1;max-width:280px;">
                <option value="">Toutes les périodes (recommandé)</option>
                ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
              </select>
              <button class="btn btn-primary" id="btn-export-partage" ${noData ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Générer le fichier HTML
              </button>
            </div>
          </div>

          <!-- Fichier projet JSON -->
          <div class="export-card">
            <div class="export-card-body">
              <div class="export-card-header">
                <div class="export-card-icon" style="background:#F5F3FF;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                </div>
                <div class="export-card-meta">
                  <span class="export-card-title">Fichier projet</span>
                  <span class="fmt-badge" style="background:#F5F5F5;color:#475569;font-family:var(--font-mono);">JSON</span>
                </div>
              </div>
              <p class="export-card-desc">
                Sauvegarde complète : données, séances, réservations. Permet de restaurer ou de transférer le projet vers un autre poste.
              </p>
            </div>
            <div class="export-card-footer">
              <button class="btn btn-primary" id="btn-export-json" style="flex:1;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
                Exporter
              </button>
              <button class="btn btn-outline" id="btn-import-json" style="flex:1;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
                Importer
              </button>
              <input type="file" id="import-json-file" accept=".json" style="display:none;">
            </div>
          </div>

          <!-- Synthèse occupation installations -->
          <div class="export-card">
            <div class="export-card-body">
              <div class="export-card-header">
                <div class="export-card-icon" style="background:#CFFAFE;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891B2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                </div>
                <div class="export-card-meta">
                  <span class="export-card-title">Occupation des installations</span>
                </div>
              </div>
              <p class="export-card-desc">
                Tableau croisé installations × créneaux : qui est où, quand. S'ouvre dans une fenêtre prête à imprimer.
              </p>
            </div>
            <div class="export-card-footer">
              <select class="form-select" id="synthese-occ-per" style="flex:1;min-width:150px;">
                <option value="">Toutes les périodes</option>
                ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
              </select>
              <button class="btn btn-outline" id="btn-synthese-occ" ${noData ? 'disabled' : ''}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                Afficher
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- ════════════════════════════════════════
           SECTION 2 — EMPLOI DU TEMPS
      ════════════════════════════════════════ -->
      <div class="export-section export-section--purple">
        <div class="export-section-heading">
          <div class="export-section-heading-icon" style="background:#DDD6FE;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="export-section-heading-text">
            <span class="export-section-heading-title">Emploi du Temps</span>
            <span class="export-section-heading-sub">PDF et Excel — grille équipe et fiches individuelles</span>
          </div>
          <div class="export-section-heading-line"></div>
        </div>

        <div class="export-grid-2">

          <!-- PDF EDT Équipe -->
          <div class="export-card">
            <div class="export-card-body">
              <div class="export-card-header">
                <div class="export-card-icon" style="background:#F3E8FF;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div class="export-card-meta">
                  <span class="export-card-title">EDT Équipe</span>
                  <span class="fmt-badge fmt-badge-pdf">PDF</span>
                </div>
              </div>
              <p class="export-card-desc">
                Grille semaine complète de l'équipe, paysage A4, avec couleurs par installation.
              </p>
            </div>
            <div class="export-card-footer">
              <select class="form-select" id="export-pdf-equipe-per" style="flex:1;">
                <option value="">Toutes les périodes</option>
                ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
              </select>
              <button class="btn btn-primary" id="btn-export-pdf-equipe" ${noData ? 'disabled' : ''}>Exporter</button>
            </div>
          </div>

          <!-- Excel EDT Équipe -->
          <div class="export-card">
            <div class="export-card-body">
              <div class="export-card-header">
                <div class="export-card-icon" style="background:#D1FAE5;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
                </div>
                <div class="export-card-meta">
                  <span class="export-card-title">EDT Équipe</span>
                  <span class="fmt-badge fmt-badge-xlsx">XLSX</span>
                </div>
              </div>
              <p class="export-card-desc">
                Emploi du temps complet avec une feuille par période, plus un onglet par enseignant.
              </p>
            </div>
            <div class="export-card-footer">
              <select class="form-select" id="export-edt-per" style="flex:1;">
                <option value="">Toutes les périodes</option>
                ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
              </select>
              <button class="btn btn-primary" id="btn-export-excel" ${noData ? 'disabled' : ''}>Exporter</button>
            </div>
          </div>

          <!-- Fiches individuelles PDF -->
          <div class="export-card">
            <div class="export-card-body">
              <div class="export-card-header">
                <div class="export-card-icon" style="background:#F3E8FF;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div class="export-card-meta">
                  <span class="export-card-title">Fiches individuelles</span>
                  <span class="fmt-badge fmt-badge-pdf">PDF</span>
                </div>
              </div>
              <p class="export-card-desc">
                EDT personnel de chaque enseignant, portrait A4. Filtrables par enseignant et par période.
              </p>
            </div>
            <div class="export-card-footer">
              <select class="form-select" id="export-pdf-fiche-per" style="flex:1;min-width:120px;">
                <option value="">Toutes les périodes</option>
                ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
              </select>
              <select class="form-select" id="export-pdf-fiche-ens" style="flex:1;min-width:140px;">
                <option value="">Tous les enseignants</option>
                ${enseignants.map(e => `<option value="${e.id}">${e.prenom ? e.prenom + ' ' : ''}${e.nom}</option>`).join('')}
              </select>
              <button class="btn btn-primary" id="btn-export-pdf-fiches" ${noData ? 'disabled' : ''}>Exporter</button>
            </div>
          </div>

          <!-- Fiches par classe PDF -->
          <div class="export-card">
            <div class="export-card-body">
              <div class="export-card-header">
                <div class="export-card-icon" style="background:#F3E8FF;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                </div>
                <div class="export-card-meta">
                  <span class="export-card-title">Fiches par classe</span>
                  <span class="fmt-badge fmt-badge-pdf">PDF</span>
                </div>
              </div>
              <p class="export-card-desc">
                EDT de chaque classe, portrait A4 — professeur, activité, installation. Filtrable par classe.
              </p>
            </div>
            <div class="export-card-footer">
              <select class="form-select" id="export-pdf-classe-per" style="flex:1;min-width:120px;">
                <option value="">Toutes les périodes</option>
                ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
              </select>
              <select class="form-select" id="export-pdf-classe-cls" style="flex:1;min-width:140px;">
                <option value="">Toutes les classes</option>
                ${classes.sort((a,b) => a.nom.localeCompare(b.nom,'fr')).map(c =>
                  `<option value="${c.id}">${c.nom}</option>`).join('')}
              </select>
              <button class="btn btn-primary" id="btn-export-pdf-classes" ${noData ? 'disabled' : ''}>Exporter</button>
            </div>
          </div>

        </div>
      </div>

      <!-- ════════════════════════════════════════
           SECTION 3 — INSTALLATIONS & RÉSERVATIONS
      ════════════════════════════════════════ -->
      <div class="export-section export-section--green">
        <div class="export-section-heading">
          <div class="export-section-heading-icon" style="background:#BBF7D0;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div class="export-section-heading-text">
            <span class="export-section-heading-title">Installations &amp; Réservations</span>
            <span class="export-section-heading-sub">CSV mairie et synthèses analytiques</span>
          </div>
          <div class="export-section-heading-line"></div>
        </div>

        <div class="export-grid-2">

          <!-- CSV Mairie -->
          <div class="export-card">
            <div class="export-card-body">
              <div class="export-card-header">
                <div class="export-card-icon" style="background:#D1FAE5;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div class="export-card-meta">
                  <span class="export-card-title">Réservations Mairie</span>
                  <span class="fmt-badge fmt-badge-csv">CSV</span>
                </div>
              </div>
              <p class="export-card-desc">
                Format Direction des Sports — complexe, installation, créneaux, dates. Prêt à envoyer.
              </p>
            </div>
            <div class="export-card-footer">
              <select class="form-select" id="export-mairie-per" style="flex:1;">
                <option value="">Toutes les périodes</option>
                ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
              </select>
              <button class="btn btn-primary" id="btn-export-mairie" ${noData ? 'disabled' : ''}>Exporter</button>
            </div>
          </div>

          <!-- Synthèses Excel -->
          <div class="export-card">
            <div class="export-card-body">
              <div class="export-card-header">
                <div class="export-card-icon" style="background:#D1FAE5;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </div>
                <div class="export-card-meta">
                  <span class="export-card-title">Synthèses analytiques</span>
                  <span class="fmt-badge fmt-badge-xlsx">XLSX</span>
                </div>
              </div>
              <p class="export-card-desc">
                Occupation installations, répartition intra/extra, charge enseignants, activités par classe et transport.
              </p>
            </div>
            <div class="export-card-footer">
              <button class="btn btn-primary" id="btn-synthese" ${noData ? 'disabled' : ''} style="width:100%;">
                Exporter les synthèses
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- ════════════════════════════════════════
           SECTION 4 — TRANSPORT
      ════════════════════════════════════════ -->
      <div class="export-section export-section--amber">
        <div class="export-section-heading">
          <div class="export-section-heading-icon" style="background:#FDE68A;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </div>
          <div class="export-section-heading-text">
            <span class="export-section-heading-title">Transport</span>
            <span class="export-section-heading-sub">Planning bus — CSV, PDF et dates exclues</span>
          </div>
          <div class="export-section-heading-line"></div>
        </div>

        <div class="export-grid-2">

          <!-- Transport CSV -->
          <div class="export-card">
            <div class="export-card-body">
              <div class="export-card-header">
                <div class="export-card-icon" style="background:#FEF3C7;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                </div>
                <div class="export-card-meta">
                  <span class="export-card-title">Demandes de transport</span>
                  <span class="fmt-badge fmt-badge-csv">CSV</span>
                </div>
              </div>
              <p class="export-card-desc">
                1 ligne = 1 classe — jour, créneau, lieu, horaires bus aller/retour, toutes les dates et nombre de rotations.
              </p>
            </div>
            <div class="export-card-footer">
              <select class="form-select" id="export-transport-per" style="flex:1;">
                <option value="">Toutes les périodes</option>
                ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
              </select>
              <button class="btn btn-primary" id="btn-export-transport" ${noData ? 'disabled' : ''}>Exporter</button>
            </div>
          </div>

          <!-- Transport PDF -->
          <div class="export-card">
            <div class="export-card-body">
              <div class="export-card-header">
                <div class="export-card-icon" style="background:#FEF3C7;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div class="export-card-meta">
                  <span class="export-card-title">Planning transport</span>
                  <span class="fmt-badge fmt-badge-pdf">PDF</span>
                </div>
              </div>
              <p class="export-card-desc">
                1 page collège + 1 page lycée — toutes les dates, triées par jour, avec lieux, horaires et enseignants.
              </p>
            </div>
            <div class="export-card-footer">
              <select class="form-select" id="export-transport-pdf-per" style="flex:1;">
                <option value="">Toutes les périodes</option>
                ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join('')}
              </select>
              <button class="btn btn-primary" id="btn-export-transport-pdf" ${noData ? 'disabled' : ''}>Exporter</button>
            </div>
          </div>

          <!-- Dates exclues transport — pleine largeur -->
          <div class="export-card export-card-full">
            <div class="export-card-body">
              <div class="export-card-header">
                <div class="export-card-icon" style="background:#FEE2E2;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                </div>
                <div class="export-card-meta">
                  <span class="export-card-title">Dates exclues du transport</span>
                </div>
              </div>
              <p class="export-card-desc">
                Ces dates sont retirées du planning PDF. Une page récapitulative est ajoutée si des exclusions sont appliquées.
                <span style="color:var(--c-text-muted);">Journées pédagogiques, voyages, bac blanc…</span>
              </p>

              <!-- Formulaire ajout -->
              <div class="excl-form">
                <div class="excl-form-group">
                  <label for="excl-date">Date</label>
                  <input type="date" class="form-input" id="excl-date" style="width:150px;">
                </div>
                <div class="excl-form-group" style="flex:1;min-width:200px;">
                  <label for="excl-raison">Raison</label>
                  <input type="text" class="form-input" id="excl-raison"
                         placeholder="ex : Journée pédagogique, Voyage 3eA…">
                </div>
                <div class="excl-form-group">
                  <label for="excl-classes">Classes concernées</label>
                  <select class="form-select" id="excl-classes" multiple style="height:72px;min-width:180px;">
                    <option value="all" selected>Toutes les classes</option>
                    ${classes.sort((a,b) => a.nom.localeCompare(b.nom,'fr')).map(c =>
                      `<option value="${c.id}">${c.nom}</option>`).join('')}
                  </select>
                  <span style="font-size:var(--fs-xs);color:var(--c-text-muted);margin-top:2px;">Ctrl+clic pour sélection multiple</span>
                </div>
                <button class="btn btn-primary" id="btn-add-exclusion" style="align-self:flex-end;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Ajouter
                </button>
              </div>
            </div>

            <div id="exclusions-list" style="padding:0 var(--sp-5) var(--sp-4);"></div>
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
