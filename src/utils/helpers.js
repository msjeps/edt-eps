/**
 * Utilitaires généraux
 */

/**
 * Génère un ID unique court
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/**
 * Formate une date en DD/MM/YYYY
 */
export function formatDate(date) {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Formate une date en YYYY-MM-DD (ISO)
 */
export function formatDateISO(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Parse une date DD/MM/YYYY en Date
 */
export function parseDate(str) {
  const [d, m, y] = str.split('/').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Jour de la semaine en français (0=dimanche)
 */
const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export function jourSemaine(date) {
  return JOURS_FR[new Date(date).getDay()];
}

/**
 * Créer un élément DOM avec attributs
 */
export function el(tag, attrs = {}, children = []) {
  const elem = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') elem.className = val;
    else if (key === 'textContent') elem.textContent = val;
    else if (key === 'innerHTML') elem.innerHTML = val;
    else if (key.startsWith('on')) elem.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === 'style' && typeof val === 'object') {
      Object.assign(elem.style, val);
    } else elem.setAttribute(key, val);
  }
  for (const child of children) {
    if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
    else if (child) elem.appendChild(child);
  }
  return elem;
}

/**
 * Raccourci pour créer du HTML depuis un template string
 */
export function html(strings, ...values) {
  const template = document.createElement('template');
  template.innerHTML = String.raw(strings, ...values).trim();
  return template.content;
}

/**
 * Debounce
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Jours ouvrés par défaut
 */
export const JOURS_OUVRES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];

/**
 * Labels jours courts
 */
export const JOURS_COURTS = {
  lundi: 'LUN', mardi: 'MAR', mercredi: 'MER', jeudi: 'JEU', vendredi: 'VEN',
};

/**
 * Niveaux de classe
 */
export const NIVEAUX = {
  college: ['6e', '5e', '4e', '3e'],
  lycee: ['2nde', '1ere', 'term'],
};

/**
 * Champs d'apprentissage EPS
 * Collège : CA1-CA4 / Lycée : CA1-CA5 (CA5 = Entretien de soi)
 */
const CA_BASE = [
  { code: 'CA1', nom: 'Performance', couleur: '#FFCC00' },
  { code: 'CA2', nom: 'Environnement', couleur: '#1FB714' },
  { code: 'CA3', nom: 'Artistique / Acrobatique', couleur: '#33CCCC' },
  { code: 'CA4', nom: 'Affrontement', couleur: '#FF8080' },
];
const CA5 = { code: 'CA5', nom: 'Entretien de soi', couleur: '#C084FC' };

// Export rétrocompatible (tous les CA incluant CA5)
export const CHAMPS_APPRENTISSAGE = [...CA_BASE, CA5];

/**
 * Retourne les champs d'apprentissage selon le type d'établissement
 * @param {'college'|'lycee'|'mixte'} etabType
 */
export function getChampsApprentissage(etabType) {
  if (etabType === 'college') return CA_BASE;
  return [...CA_BASE, CA5]; // lycee ou mixte → 5 CA
}

/**
 * Palette couleurs par défaut pour les installations
 */
export const COULEURS_INSTALLATIONS = [
  { nom: 'Rose', hex: '#FF99CC' },
  { nom: 'Rouge', hex: '#CC0000' },
  { nom: 'Jaune', hex: '#FFFF00' },
  { nom: 'Vert clair', hex: '#CCFFCC' },
  { nom: 'Violet', hex: '#B4A7D6' },
  { nom: 'Cyan', hex: '#66FFFF' },
  { nom: 'Teal', hex: '#108080' },
  { nom: 'Gris', hex: '#C0C0C0' },
  { nom: 'Gris clair', hex: '#E0E0E0' },
  { nom: 'Bleu', hex: '#93C5FD' },
  { nom: 'Orange', hex: '#FDBA74' },
  { nom: 'Vert', hex: '#86EFAC' },
];

/**
 * Slugify pour les data-attributes
 */
export function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
