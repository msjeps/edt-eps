/**
 * Point d'entrée de l'application EDT EPS
 */
import { initApp } from './app.js';
import { initHelpTooltips } from './components/help-tooltip.js';

// Démarrage
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initApp();
    initHelpTooltips();
    console.log('EDT EPS initialisé');
  } catch (err) {
    console.error('Erreur initialisation:', err);
    document.getElementById('app-main').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#9888;</div>
        <div class="empty-state-title">Erreur d'initialisation</div>
        <div class="empty-state-text">${err.message}</div>
        <button class="btn btn-primary" onclick="location.reload()">Recharger</button>
      </div>
    `;
  }
});

// Enregistrement Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker non disponible (dev mode)
    });
  });
}
