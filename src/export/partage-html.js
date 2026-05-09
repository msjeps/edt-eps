/**
 * Export "Partage lecture seule" — génère un fichier HTML autonome
 * que les enseignants ouvrent dans leur navigateur pour consulter
 * leur planning sans accès à l'outil de saisie.
 *
 * Le fichier produit est 100% standalone : CSS, données JSON et JS
 * sont tous embarqués — aucune connexion réseau n'est nécessaire.
 */
import db from '../db/schema.js';
import { getConfig } from '../db/schema.js';
import { saveExportFile } from '../utils/filesystem.js';
import { toast } from '../components/toast.js';

export async function exportPartageHtml(periodeId) {
  const [seances, periodes, enseignants, classes, activites, installations, lieux] = await Promise.all([
    db.seances.toArray(),
    db.periodes.toArray(),
    db.enseignants.toArray(),
    db.classes.toArray(),
    db.activites.toArray(),
    db.installations.toArray(),
    db.lieux.toArray(),
  ]);

  if (seances.length === 0) {
    toast.warning('Aucune séance à exporter');
    return;
  }

  const etablissementNom  = await getConfig('etablissementNom')  || 'Établissement';
  const anneeScolaire     = await getConfig('anneeScolaire')     || '2025-2026';
  const joursOuvres       = (await getConfig('joursOuvres'))     || ['lundi','mardi','mercredi','jeudi','vendredi'];
  const etablissementType = await getConfig('etablissementType') || 'college';

  const sortedPeriodes = [...periodes].sort((a, b) => (a.ordre ?? a.id) - (b.ordre ?? b.id));
  const sortedEns      = [...enseignants].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const sortedClasses  = [...classes].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  // Filtrer les séances de la période choisie si demandé (mais on embarque quand même TOUT
  // pour que le filtre dynamique côté HTML fonctionne)
  const data = {
    etablissement: { nom: etablissementNom, anneeScolaire, type: etablissementType },
    joursOuvres,
    periodes:      sortedPeriodes,
    enseignants:   sortedEns,
    classes:       sortedClasses,
    activites,
    installations,
    lieux,
    seances,
    generatedAt:   new Date().toISOString(),
    filtrePeriodeId: periodeId ? parseInt(periodeId) : null,
  };

  const html = buildHtml(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });

  const periodeLabel = periodeId
    ? (sortedPeriodes.find(p => p.id === parseInt(periodeId))?.nom || 'periode')
    : 'complet';
  const ts = new Date().toISOString().split('T')[0];
  await saveExportFile(blob, `EDT_EPS_Partage_${periodeLabel}_${ts}.html`);
  toast.success('Fichier HTML de partage exporté — distribuez-le aux enseignants');
}

// ─────────────────────────────────────────────────────────────
// Échappement HTML minimal (pas de lib externe dans ce module)
// ─────────────────────────────────────────────────────────────
function h(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────
// ENTRÉE PRINCIPALE
// ─────────────────────────────────────────────────────────────
function buildHtml(data) {
  const title   = `EDT EPS — ${h(data.etablissement.nom)} — ${h(data.etablissement.anneeScolaire)}`;
  const dateGen = new Date(data.generatedAt).toLocaleDateString('fr-FR',
    { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });

  const periodesOpts = data.periodes.map(p =>
    `<option value="${p.id}"${data.filtrePeriodeId === p.id ? ' selected' : ''}>${h(p.nom)}</option>`
  ).join('');

  const navEns = data.enseignants.map(e => {
    const nom = e.prenom ? `${h(e.prenom)} ${h(e.nom)}` : h(e.nom);
    return `<button class="nav-btn" data-view="ens:${e.id}" title="${nom}">${nom}</button>`;
  }).join('');

  const navCls = data.classes.map(c =>
    `<button class="nav-btn" data-view="cls:${c.id}">${h(c.nom)}</button>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>
<header class="app-header">
  <div class="header-left">
    <span class="header-icon">&#128197;</span>
    <div>
      <div class="header-title">${h(data.etablissement.nom)}</div>
      <div class="header-sub">Emploi du temps EPS &mdash; ${h(data.etablissement.anneeScolaire)}</div>
    </div>
  </div>
  <div class="header-center">
    <label class="sel-label" for="periode-sel">P&eacute;riode&nbsp;:</label>
    <select id="periode-sel" class="sel">
      <option value="">Toutes les p&eacute;riodes</option>
      ${periodesOpts}
    </select>
  </div>
  <div class="header-right">
    <span class="badge-ro">Lecture seule</span>
    <button class="btn-print no-print" onclick="window.print()">&#128438;&nbsp;Imprimer</button>
  </div>
</header>

<div class="layout">
  <nav class="sidebar no-print">
    <div class="nav-section-title">Vue</div>
    <button class="nav-btn active" data-view="equipe">&#128101;&nbsp;Équipe complète</button>
    <div class="nav-section-title">Enseignants</div>
    ${navEns}
    <div class="nav-section-title">Classes</div>
    ${navCls}
    <div class="nav-footer">G&eacute;n&eacute;r&eacute; le ${dateGen}</div>
  </nav>
  <main id="main" class="main"></main>
</div>

<script>
const DATA = ${JSON.stringify(data)};
${JS}
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// CSS EMBARQUÉ
// ─────────────────────────────────────────────────────────────
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
  background:#f1f5f9;color:#1e293b;display:flex;flex-direction:column}

/* ── Header ── */
.app-header{display:flex;align-items:center;gap:16px;padding:9px 20px;
  background:#1e293b;color:#f1f5f9;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.header-icon{font-size:1.4rem;flex-shrink:0}
.header-title{font-size:14px;font-weight:700}
.header-sub{font-size:11px;color:#94a3b8;margin-top:1px}
.header-center{flex:1;display:flex;align-items:center;gap:8px;justify-content:center}
.sel-label{font-size:12px;color:#94a3b8;white-space:nowrap}
.sel{padding:5px 10px;border-radius:6px;border:1px solid #334155;
  background:#334155;color:#f1f5f9;font-size:13px;cursor:pointer}
.header-right{display:flex;align-items:center;gap:10px}
.badge-ro{background:#334155;color:#94a3b8;border:1px solid #475569;
  border-radius:12px;padding:3px 10px;font-size:10px;font-weight:700;
  letter-spacing:.06em;text-transform:uppercase}
.btn-print{padding:5px 14px;border-radius:6px;border:none;
  background:#3b82f6;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
.btn-print:hover{background:#2563eb}

/* ── Layout ── */
.layout{display:flex;flex:1;overflow:hidden}

/* ── Sidebar ── */
.sidebar{width:210px;background:#fff;border-right:1px solid #e2e8f0;
  overflow-y:auto;flex-shrink:0;padding:6px 0 0}
.nav-section-title{font-size:10px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:#94a3b8;padding:10px 14px 3px}
.nav-btn{display:block;width:100%;text-align:left;padding:6px 14px;
  border:none;background:none;cursor:pointer;font-size:12.5px;color:#475569;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .12s}
.nav-btn:hover{background:#f8fafc;color:#1e293b}
.nav-btn.active{background:#eff6ff;color:#2563eb;font-weight:600;
  border-right:3px solid #3b82f6}
.nav-footer{font-size:10px;color:#94a3b8;padding:14px 14px 10px;
  border-top:1px solid #e2e8f0;margin-top:6px}

/* ── Main content ── */
.main{flex:1;overflow-y:auto;padding:20px 24px}
.view-title{font-size:18px;font-weight:700;margin-bottom:3px}
.view-sub{font-size:13px;color:#64748b;margin-bottom:18px}
.empty-state{text-align:center;padding:48px 24px;color:#94a3b8;font-size:14px}

/* ── Carte enseignant ── */
.ens-section{background:#fff;border:1px solid #e2e8f0;border-radius:10px;
  margin-bottom:22px;overflow:hidden}
.ens-header{display:flex;align-items:center;gap:10px;padding:10px 16px;
  background:#f8fafc;border-bottom:1px solid #e2e8f0;flex-wrap:wrap}
.ens-name{font-weight:700;font-size:14px}
.ens-badge{font-size:11px;color:#64748b;background:#e2e8f0;
  border-radius:8px;padding:2px 8px}
.ens-hours{font-size:11px;color:#3b82f6;font-weight:700;margin-left:auto}

/* ── Grille horaire ── */
.grid-outer{overflow-x:auto;padding:10px 14px 14px}
.grid-wrap{display:flex;gap:0}
.time-col{flex-shrink:0;width:50px;position:relative}
.time-label{position:absolute;right:7px;font-size:9.5px;color:#94a3b8;
  transform:translateY(-50%);white-space:nowrap}
.days-row{flex:1;display:flex;gap:4px}
.day-col{flex:1;min-width:120px}
.day-header{text-align:center;font-size:10.5px;font-weight:700;color:#475569;
  text-transform:uppercase;letter-spacing:.07em;padding-bottom:6px}
.day-slots{position:relative}
.grid-line{position:absolute;left:0;right:0;border-top:1px solid #f1f5f9}
.grid-line.on-hour{border-top-color:#e2e8f0}

/* ── Bloc séance ── */
.bloc{position:absolute;left:1px;right:1px;border-radius:5px;
  overflow:hidden;padding:4px 6px;font-size:11px;line-height:1.3;
  border-left:3px solid transparent}
.bloc-time{font-size:9px;color:#64748b;margin-bottom:1px}
.bloc-main{font-weight:700;font-size:11.5px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.bloc-act{font-size:10px;color:#475569;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.bloc-loc{font-size:10px;color:#64748b;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.bloc-ens{font-size:9px;color:#94a3b8;margin-top:1px}

/* ── Légende couleurs ── */
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;
  margin-bottom:16px;padding:10px 14px;background:#fff;
  border:1px solid #e2e8f0;border-radius:8px}
.legend-item{display:flex;align-items:center;gap:5px;font-size:11px;color:#475569}
.legend-dot{width:12px;height:12px;border-radius:3px;flex-shrink:0;border:1px solid rgba(0,0,0,.1)}

/* ── Stats équipe ── */
.team-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));
  gap:12px;margin-bottom:20px}
.stat-card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;
  padding:12px 14px}
.stat-name{font-size:12px;font-weight:700;margin-bottom:4px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stat-hours{font-size:22px;font-weight:800;color:#3b82f6;line-height:1}
.stat-ors{font-size:10px;color:#94a3b8;margin-top:2px}
.stat-sessions{font-size:10px;color:#64748b}

/* ── Print ── */
@media print{
  @page{size:A4 landscape;margin:10mm}
  *,*::before,*::after{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  html,body{height:auto;overflow:visible}
  .no-print{display:none!important}
  .app-header{padding:6px 14px;background:#1e293b!important}
  .header-right,.badge-ro,.btn-print{display:none!important}
  .layout{height:auto;overflow:visible}
  .sidebar{display:none!important}
  .main{overflow:visible;padding:0 6px}
  .ens-section{page-break-inside:avoid;break-inside:avoid;margin-bottom:12px}
  .grid-outer{overflow-x:visible}
  .legend{page-break-inside:avoid}
  .team-stats{page-break-inside:avoid}
}
`;

// ─────────────────────────────────────────────────────────────
// JS EMBARQUÉ (s'exécute dans le fichier HTML généré)
// ─────────────────────────────────────────────────────────────
const JS = `
// ── Constantes couleurs (miroir de src/utils/colors.js) ──
const COLORS = {
  'fort-carre':    {bg:'#FCE4EC',border:'#E91E63'},
  'beach-fc':      {bg:'#FFEBEE',border:'#D32F2F'},
  'auvergne':      {bg:'#FFF8E1',border:'#F59E0B'},
  'stade-auvergne':{bg:'#FFF8E1',border:'#F59E0B'},
  'foch':          {bg:'#E8F5E9',border:'#43A047'},
  'stade-foch':    {bg:'#E8F5E9',border:'#43A047'},
  'fontonne':      {bg:'#EDE7F6',border:'#7B1FA2'},
  'piscine':       {bg:'#E0F7FA',border:'#0097A7'},
  'gymnase':       {bg:'#E0F2F1',border:'#00796B'},
  'terr-msj':      {bg:'#ECEFF1',border:'#546E7A'},
  'terrain-msj':   {bg:'#ECEFF1',border:'#546E7A'},
  'parc-exflora':  {bg:'#F5F5F5',border:'#757575'},
};
const DEFAULT_COLOR = {bg:'#EFF6FF',border:'#3B82F6'};

const JOURS_COURTS = {lundi:'Lundi',mardi:'Mardi',mercredi:'Mercredi',jeudi:'Jeudi',vendredi:'Vendredi',samedi:'Samedi'};
const SLOT_H = 30; // px par tranche de 30 min

function slugify(s){
  return String(s).toLowerCase().normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function heureToMin(h){if(!h)return 0;const[hh,mm]=h.split(':').map(Number);return hh*60+(mm||0);}
function escH(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function instColor(installationId){
  const inst=DATA.installations.find(i=>i.id===installationId);
  const lieu=inst?DATA.lieux.find(l=>l.id===inst.lieuId):null;
  const slug=lieu?slugify(lieu.nom):(inst?slugify(inst.nom):'');
  return COLORS[slug]||DEFAULT_COLOR;
}

function ensLabel(ens){
  if(!ens)return'';
  if(ens.initiales)return ens.initiales;
  return((ens.prenom?ens.prenom[0]+'. ':'')+ens.nom).trim();
}

// Déduplique par creneauClasseId pour le total hebdo
function seancesHebdo(seances){
  const seen=new Set();
  return seances.filter(s=>{
    const k=s.creneauClasseId?'cc:'+s.creneauClasseId:'m:'+s.enseignantId+':'+s.classeId+':'+s.jour+':'+s.heureDebut;
    if(seen.has(k))return false;seen.add(k);return true;
  });
}
function totalHStr(seances){
  const uniq=seancesHebdo(seances);
  const min=uniq.reduce((a,s)=>a+heureToMin(s.heureFin)-heureToMin(s.heureDebut),0);
  const hh=Math.floor(min/60),mm=min%60;
  return mm?hh+'h'+String(mm).padStart(2,'0')+'/sem':hh+'h/sem';
}

// ── Grille horaire ──
// mode : 'ens' (affiche classe+act+lieu), 'cls' (act+lieu+ens)
function renderGrid(seances, mode){
  if(!seances.length)return'<p class="empty-state">Aucune séance pour cette sélection</p>';
  const jours=DATA.joursOuvres;

  // Plage horaire arrondie à 30 min
  let firstMin=Infinity,lastMin=0;
  for(const s of seances){
    if(s.heureDebut)firstMin=Math.min(firstMin,heureToMin(s.heureDebut));
    if(s.heureFin)  lastMin =Math.max(lastMin, heureToMin(s.heureFin));
  }
  firstMin=Math.floor(firstMin/30)*30;
  lastMin =Math.ceil(lastMin/30)*30;
  const totalPx=((lastMin-firstMin)/30)*SLOT_H;

  // Colonne temps
  let timeCols='';
  for(let m=firstMin;m<=lastMin;m+=30){
    const top=((m-firstMin)/30)*SLOT_H;
    const hh=Math.floor(m/60),mn=m%60;
    const lbl=mn===0?hh+'h':hh+'h'+String(mn).padStart(2,'0');
    timeCols+='<div class="time-label" style="top:'+top+'px">'+lbl+'</div>';
  }

  // Colonnes jours
  let daysCols='';
  for(const jour of jours){
    const jourSeances=seances.filter(s=>(s.jour||'').toLowerCase()===jour);
    let lines='';
    for(let m=firstMin;m<lastMin;m+=30){
      const top=((m-firstMin)/30)*SLOT_H;
      lines+='<div class="grid-line'+(m%60===0?' on-hour':'')+'" style="top:'+top+'px"></div>';
    }
    let blocs='';
    for(const s of jourSeances){
      const top=((heureToMin(s.heureDebut)-firstMin)/30)*SLOT_H;
      const ht=Math.max(((heureToMin(s.heureFin)-heureToMin(s.heureDebut))/30)*SLOT_H-2,20);
      const c=instColor(s.installationId);
      const cls=DATA.classes.find(cc=>cc.id===s.classeId);
      const ens=DATA.enseignants.find(e=>e.id===s.enseignantId);
      const act=DATA.activites.find(a=>a.id===s.activiteId);
      const inst=DATA.installations.find(i=>i.id===s.installationId);
      const lieu=inst?DATA.lieux.find(l=>l.id===inst.lieuId):null;
      const lieuNom=lieu?.nom||inst?.nom||'';

      let main='',sub1='',sub2='',extra='';
      if(mode==='ens'){
        main=escH(cls?.nom||'');sub1=escH(act?.nom||'');sub2=escH(lieuNom);
      } else if(mode==='cls'){
        main=escH(act?.nom||'');sub1=escH(lieuNom);sub2=ens?escH(ensLabel(ens)):'';
      } else {
        // equipe : toutes les infos
        main=escH(cls?.nom||'');sub1=escH(act?.nom||'');sub2=escH(lieuNom);
        extra=ens?'<div class="bloc-ens">'+escH(ensLabel(ens))+'</div>':'';
      }

      blocs+='<div class="bloc" style="top:'+top+'px;height:'+ht+'px;background:'+c.bg+';border-left-color:'+c.border+';">'
        +'<div class="bloc-time">'+escH(s.heureDebut)+'&ndash;'+escH(s.heureFin)+'</div>'
        +'<div class="bloc-main">'+main+'</div>'
        +(sub1?'<div class="bloc-act">'+sub1+'</div>':'')
        +(sub2?'<div class="bloc-loc">'+sub2+'</div>':'')
        +extra
        +'</div>';
    }
    daysCols+='<div class="day-col">'
      +'<div class="day-header">'+(JOURS_COURTS[jour]||jour)+'</div>'
      +'<div class="day-slots" style="height:'+totalPx+'px;">'+lines+blocs+'</div>'
      +'</div>';
  }

  return'<div class="grid-outer"><div class="grid-wrap">'
    +'<div class="time-col" style="height:'+totalPx+'px;">'+timeCols+'</div>'
    +'<div class="days-row">'+daysCols+'</div>'
    +'</div></div>';
}

// ── Légende installations utilisées ──
function renderLegend(seances){
  const usedInstIds=new Set(seances.map(s=>s.installationId).filter(Boolean));
  if(!usedInstIds.size)return'';
  const items=[...usedInstIds].map(id=>{
    const c=instColor(id);
    const inst=DATA.installations.find(i=>i.id===id);
    const lieu=inst?DATA.lieux.find(l=>l.id===inst.lieuId):null;
    const nom=lieu?.nom||inst?.nom||'';
    return'<div class="legend-item"><div class="legend-dot" style="background:'+c.bg+';border-color:'+c.border+'"></div>'+escH(nom)+'</div>';
  }).join('');
  return'<div class="legend">'+items+'</div>';
}

// ── Filtrage par période ──
function filterSeances(periodeId){
  if(!periodeId)return DATA.seances;
  const pid=parseInt(periodeId);
  return DATA.seances.filter(s=>s.periodeId===pid);
}

// ── Vues ──
function renderEquipe(periodeId){
  const seances=filterSeances(periodeId);
  const per=periodeId?DATA.periodes.find(p=>p.id===parseInt(periodeId)):null;
  let html='<div class="view-title">Équipe complète</div>'
    +'<div class="view-sub">'+(per?escH(per.nom):'Toutes les périodes')+' &mdash; '+escH(DATA.etablissement.nom)+'</div>';

  // Cartes stats rapides
  html+='<div class="team-stats">';
  for(const ens of DATA.enseignants){
    const es=seances.filter(s=>s.enseignantId===ens.id);
    if(!es.length)continue;
    const nom=ens.prenom?ens.prenom+' '+ens.nom:ens.nom;
    const uniq=seancesHebdo(es);
    const min=uniq.reduce((a,s)=>a+heureToMin(s.heureFin)-heureToMin(s.heureDebut),0);
    const hh=Math.floor(min/60),mm=min%60;
    const heureStr=mm?hh+'h'+String(mm).padStart(2,'0'):hh+'h';
    html+='<div class="stat-card">'
      +'<div class="stat-name">'+escH(nom)+'</div>'
      +'<div class="stat-hours">'+heureStr+'</div>'
      +'<div class="stat-ors">'+(ens.ors?'ORS : '+escH(String(ens.ors))+'h':'')+'</div>'
      +'<div class="stat-sessions">'+es.length+' séance'+(es.length>1?'s':'')+'</div>'
      +'</div>';
  }
  html+='</div>';

  html+=renderLegend(seances);

  for(const ens of DATA.enseignants){
    const es=seances.filter(s=>s.enseignantId===ens.id);
    if(!es.length)continue;
    const nom=ens.prenom?ens.prenom+' '+ens.nom:ens.nom;
    html+='<div class="ens-section">'
      +'<div class="ens-header">'
        +'<span class="ens-name">'+escH(nom)+'</span>'
        +(ens.initiales?'<span class="ens-badge">'+escH(ens.initiales)+'</span>':'')
        +'<span class="ens-hours">'+totalHStr(es)+'</span>'
      +'</div>'
      +renderGrid(es,'ens')
      +'</div>';
  }
  return html;
}

function renderEnseignant(ensId,periodeId){
  const ens=DATA.enseignants.find(e=>e.id===ensId);
  if(!ens)return'<p class="empty-state">Enseignant introuvable</p>';
  const seances=filterSeances(periodeId).filter(s=>s.enseignantId===ensId);
  const nom=ens.prenom?ens.prenom+' '+ens.nom:ens.nom;
  const per=periodeId?DATA.periodes.find(p=>p.id===parseInt(periodeId)):null;
  return'<div class="view-title">'+escH(nom)+'</div>'
    +'<div class="view-sub">'+(per?escH(per.nom):'Toutes les périodes')+' &mdash; '+totalHStr(seances)+'</div>'
    +renderLegend(seances)
    +'<div class="ens-section">'+renderGrid(seances,'ens')+'</div>';
}

function renderClasse(classeId,periodeId){
  const cls=DATA.classes.find(c=>c.id===classeId);
  if(!cls)return'<p class="empty-state">Classe introuvable</p>';
  const seances=filterSeances(periodeId).filter(s=>s.classeId===classeId);
  const per=periodeId?DATA.periodes.find(p=>p.id===parseInt(periodeId)):null;
  const ens=cls.enseignantId?DATA.enseignants.find(e=>e.id===cls.enseignantId):null;
  const sub=(per?escH(per.nom):'Toutes les périodes')+(ens?' &mdash; Prof&nbsp;: '+escH(ens.prenom?ens.prenom+' '+ens.nom:ens.nom):'');
  return'<div class="view-title">'+escH(cls.nom)+'</div>'
    +'<div class="view-sub">'+sub+'</div>'
    +renderLegend(seances)
    +'<div class="ens-section">'+renderGrid(seances,'cls')+'</div>';
}

// ── État global ──
let currentView='equipe';

function render(){
  const periodeId=document.getElementById('periode-sel')?.value||'';
  const main=document.getElementById('main');
  if(!main)return;
  if(currentView==='equipe'){
    main.innerHTML=renderEquipe(periodeId);
  }else if(currentView.startsWith('ens:')){
    main.innerHTML=renderEnseignant(parseInt(currentView.slice(4)),periodeId);
  }else if(currentView.startsWith('cls:')){
    main.innerHTML=renderClasse(parseInt(currentView.slice(4)),periodeId);
  }
  main.scrollTop=0;
}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentView=btn.dataset.view;
      render();
    });
  });
  document.getElementById('periode-sel')?.addEventListener('change',render);
  render();
});
`;
