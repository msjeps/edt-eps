/**
 * Utilitaires d'échappement HTML pour prévenir les injections XSS
 */

// Caractères spéciaux HTML à échapper
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

/**
 * Échappe les caractères HTML spéciaux dans une chaîne
 * Utilisé pour les contenus insérés dans innerHTML ou les attributs
 * @param {string} str - La chaîne à échapper
 * @returns {string} La chaîne échappée
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * Alias court pour une utilisation dans les templates
 * @param {string} str - La chaîne à échapper
 * @returns {string} La chaîne échappée
 */
export function h(str) {
  return escapeHtml(str);
}

/**
 * Échappe une chaîne pour utilisation dans un attribut HTML
 * Alias pour escapeHtml() mais sémantiquement clair
 * @param {string} str - La chaîne à échapper
 * @returns {string} La chaîne échappée
 */
export function escapeAttribute(str) {
  return escapeHtml(str);
}

/**
 * Échappe une chaîne pour utilisation dans du texte (textContent sûr)
 * Non nécessaire si utilisant textContent, mais disponible pour cohérence
 * @param {string} str - La chaîne à échapper
 * @returns {string} La chaîne échappée
 */
export function escapeText(str) {
  return String(str ?? '');
}
