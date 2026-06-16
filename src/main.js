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

// Enregistrement Service Worker (PWA) + détection de mise à jour
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
      .then((registration) => {
        // SW déjà en attente au chargement (ex : onglet rouvert après update)
        if (registration.waiting) {
          window.dispatchEvent(new CustomEvent('swUpdateReady', { detail: registration }));
        }

        // Nouveau SW téléchargé pendant la session
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            // "installed" + controller existant = nouvelle version prête, ancienne active
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('swUpdateReady', { detail: registration }));
            }
          });
        });

        // Mémoriser la registration pour l'activer plus tard
        window.__swRegistration = registration;
      })
      .catch(() => {
        // Service worker non disponible (dev mode sans HTTPS)
      });

    // Quand le SW change de controller (après skipWaiting), recharger la page
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}
