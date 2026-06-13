/**
 * Gestion du thème clair / sombre.
 * Source de vérité unique : attribut data-theme sur <html>, mémorisé en
 * localStorage. Valeur initiale = préférence système (prefers-color-scheme)
 * si rien n'est mémorisé. Le flash au chargement est évité par un script
 * inline dans index.html qui pose data-theme avant le rendu.
 */

const KEY = 'edteps-theme';
const listeners = new Set();

function systemPref() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Thème courant ('light' | 'dark'). */
export function getTheme() {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch { /* mode privé */ }
  return systemPref();
}

/** Applique le thème au DOM (attribut + couleur de barre navigateur), sans mémoriser. */
export function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#0A101D' : '#1E293B');
}

/** Définit, mémorise et applique le thème, puis notifie les abonnés. */
export function setTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  try { localStorage.setItem(KEY, t); } catch { /* mode privé */ }
  applyTheme(t);
  listeners.forEach(fn => { try { fn(t); } catch { /* abonné défaillant */ } });
}

/** Bascule clair ↔ sombre. */
export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/** Abonnement aux changements de thème. Retourne une fonction de désabonnement. */
export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
