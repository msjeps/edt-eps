/**
 * Point d'entrée de l'application EDT EPS
 */
import { initApp } from './app.js';
import { initHelpTooltips } from './components/help-tooltip.js';
import { escapeHtml } from './utils/escape.js';

// Démarrage
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initApp();
    initHelpTooltips();
    console.log('EDT EPS initialisé');
  } catch (err) {
    console.error('Erreur initialisation:', err);
    const appMain = document.getElementById('app-main');
    if (appMain) {
      const errMsg = document.createElement('div');
      errMsg.className = 'empty-state';
      errMsg.innerHTML = `
        <div class="empty-state-icon">&#9888;</div>
        <div class="empty-state-title">Erreur d'initialisation</div>
        <div class="empty-state-text"></div>
        <button class="btn btn-primary" onclick="location.reload()">Recharger</button>
      `;
      errMsg.querySelector('.empty-state-text').textContent = err.message;
      appMain.appendChild(errMsg);
    }
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
