import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'fs';

/**
 * Plugin Vite : après le build, remplace le CACHE_NAME dans dist/sw.js
 * par une valeur unique (timestamp), ce qui force le navigateur à détecter
 * un nouveau service worker à chaque déploiement et affiche le bouton
 * "Mise à jour disponible" dans l'app.
 */
const injectSwTimestamp = () => ({
  name: 'inject-sw-timestamp',
  writeBundle() {
    const path = './dist/sw.js';
    try {
      let content = readFileSync(path, 'utf8');
      content = content.replace(/CACHE_NAME = 'edt-eps-[^']*'/, `CACHE_NAME = 'edt-eps-${Date.now()}'`);
      writeFileSync(path, content);
    } catch {
      // sw.js absent du dist (ex: mode dev) — rien à faire
    }
  },
});

export default defineConfig({
  root: '.',
  base: '/edt-eps/',   // nom du dépôt GitHub
  publicDir: 'public',
  plugins: [injectSwTimestamp()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
