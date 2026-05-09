import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/edt-eps/',   // nom du dépôt GitHub
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
