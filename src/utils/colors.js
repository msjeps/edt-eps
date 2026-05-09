/**
 * Gestion des couleurs installations
 * Palette professionnelle — source unique de vérité pour EDT et Programmation
 */

const DEFAULT_COLORS = {
  'fort-carre':         { bg: '#FCE4EC', border: '#E91E63', text: '#880E4F' },
  'beach-fc':           { bg: '#FFEBEE', border: '#D32F2F', text: '#B71C1C' },
  'auvergne':           { bg: '#FFF8E1', border: '#F59E0B', text: '#78350F' },
  'stade-auvergne':     { bg: '#FFF8E1', border: '#F59E0B', text: '#78350F' },
  'foch':               { bg: '#E8F5E9', border: '#43A047', text: '#1B5E20' },
  'stade-foch':         { bg: '#E8F5E9', border: '#43A047', text: '#1B5E20' },
  'fontonne':           { bg: '#EDE7F6', border: '#7B1FA2', text: '#4A148C' },
  'piscine':            { bg: '#E0F7FA', border: '#0097A7', text: '#006064' },
  'gymnase':            { bg: '#E0F2F1', border: '#00796B', text: '#004D40' },
  'terr-msj':           { bg: '#ECEFF1', border: '#546E7A', text: '#263238' },
  'terrain-msj':        { bg: '#ECEFF1', border: '#546E7A', text: '#263238' },
  'parc-exflora':       { bg: '#F5F5F5', border: '#757575', text: '#424242' },
  'default':            { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF' },
};

/**
 * Retourne les couleurs pour un slug d'installation
 */
export function getInstallationColors(slug) {
  return DEFAULT_COLORS[slug] || DEFAULT_COLORS['default'];
}

/**
 * Génère un style CSS inline pour un bloc EDT
 */
export function blocStyle(slug) {
  const colors = getInstallationColors(slug);
  return `background:${colors.bg};border-left-color:${colors.border};color:${colors.text}`;
}

/**
 * Palette automatique pour N installations dynamiques
 */
const PALETTE = [
  '#E91E63', '#D32F2F', '#F59E0B', '#43A047', '#7B1FA2',
  '#0097A7', '#00796B', '#546E7A', '#1565C0', '#E64A19',
  '#6A1B9A', '#00838F', '#2E7D32', '#C62828', '#4527A0',
];

export function couleurAutoIndex(index) {
  return PALETTE[index % PALETTE.length];
}
