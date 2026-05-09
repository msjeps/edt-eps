/**
 * Calendrier scolaire — fetch API Éducation nationale + jours fériés api.gouv.fr
 * Cache localStorage 7 jours, fallback sur données hardcodées si hors-ligne.
 *
 * Zones supportées : A, B, C, CORSE
 * API vacances : data.education.gouv.fr
 * API fériés   : calendrier.api.gouv.fr
 */

const API_VACANCES = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records';
const API_FERIES   = 'https://calendrier.api.gouv.fr/jours-feries/metropole/';
const CACHE_KEY    = 'edteps_calendrier_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

// Mapping zone app → libellé API
const ZONE_API = {
  A: 'Zone A',
  B: 'Zone B',
  C: 'Zone C',
  CORSE: 'Corse',
};

// ============================================================
// DATE UTILS
// ============================================================

/**
 * Convertit une date UTC ISO (format API) en date locale française YYYY-MM-DD.
 * L'API renvoie toujours l'heure à minuit heure française :
 *   été  → T22:00:00+00:00  (UTC+2 CEST)
 *   hiver → T23:00:00+00:00 (UTC+1 CET)
 * Ajouter 2h au timestamp UTC donne toujours le bon jour local.
 */
function utcToFrDate(isoString) {
  return new Date(new Date(isoString).getTime() + 2 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
}

// ============================================================
// CACHE localStorage
// ============================================================

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (Date.now() - cache.timestamp > CACHE_TTL_MS) return null; // expiré
    return cache.annees || {};
  } catch {
    return null;
  }
}

function setCache(annees) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), annees }));
  } catch {
    // localStorage plein ou indisponible — pas bloquant
  }
}

function getCacheAnnee(anneeScolaire) {
  const cache = getCache();
  return cache ? (cache[anneeScolaire] || null) : null;
}

// ============================================================
// FETCH VACANCES
// ============================================================

async function fetchVacances(anneeScolaire) {
  const params = new URLSearchParams({
    limit: '100',
    where: `annee_scolaire="${anneeScolaire}"`,
    select: 'description,start_date,end_date,zones',
  });
  const res = await fetch(`${API_VACANCES}?${params}`);
  if (!res.ok) throw new Error(`API vacances HTTP ${res.status}`);
  const json = await res.json();

  const byZone = { A: [], B: [], C: [], CORSE: [] };
  const seen = new Set();

  for (const r of json.results) {
    // Trouver la clé de zone correspondante
    const zoneKey = Object.keys(ZONE_API).find(k => ZONE_API[k] === r.zones);
    if (!zoneKey) continue;

    const key = `${r.zones}|${r.start_date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    byZone[zoneKey].push({
      nom: r.description,
      debut: utcToFrDate(r.start_date),
      fin: utcToFrDate(r.end_date),
    });
  }

  return byZone;
}

// ============================================================
// FETCH JOURS FÉRIÉS
// ============================================================

async function fetchFeries(anneeScolaire) {
  const [y1, y2] = anneeScolaire.split('-').map(Number);
  const [data1, data2] = await Promise.all([
    fetch(`${API_FERIES}${y1}.json`).then(r => r.ok ? r.json() : {}),
    fetch(`${API_FERIES}${y2}.json`).then(r => r.ok ? r.json() : {}),
  ]);

  const merged = { ...data1, ...data2 };
  const debut  = `${y1}-09-01`;
  const fin    = `${y2}-08-31`;

  return Object.entries(merged)
    .filter(([date]) => date >= debut && date <= fin)
    .map(([date, nom]) => ({ nom, date }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================
// API PUBLIQUE
// ============================================================

/**
 * Charge le calendrier pour une année scolaire.
 * Lit le cache, fetch si absent ou expiré.
 * Retourne null si hors-ligne ET pas de cache → appelant utilise le fallback.
 * @returns {Promise<{vacances: Object, feries: Array}|null>}
 */
export async function loadCalendrierScolaire(anneeScolaire) {
  const cached = getCacheAnnee(anneeScolaire);
  if (cached) return cached;

  try {
    const [vacances, feries] = await Promise.all([
      fetchVacances(anneeScolaire),
      fetchFeries(anneeScolaire),
    ]);
    const data = { vacances, feries };

    // Mettre à jour le cache (toutes les années déjà en cache + la nouvelle)
    const allCached = getCache() || {};
    allCached[anneeScolaire] = data;
    setCache(allCached);

    return data;
  } catch (err) {
    console.warn(`[calendrier-api] Fetch échoué pour ${anneeScolaire} :`, err.message);
    return null;
  }
}

/**
 * Rafraîchit le calendrier en arrière-plan (non bloquant).
 * À appeler au démarrage de l'app pour maintenir le cache à jour.
 */
export function refreshCalendrierBackground(anneesScolaires) {
  // Éviter de bloquer le démarrage — fire & forget
  setTimeout(async () => {
    for (const annee of anneesScolaires) {
      const cached = getCacheAnnee(annee);
      if (!cached) {
        await loadCalendrierScolaire(annee).catch(() => {});
      }
    }
  }, 2000); // attendre 2s après le démarrage
}

/**
 * Vide le cache (utile en dev ou en cas de données corrompues)
 */
export function clearCalendrierCache() {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Retourne les années scolaires disponibles dans le cache.
 */
export function getAnneesCachees() {
  const cache = getCache();
  return cache ? Object.keys(cache).sort() : [];
}
