import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for A Noise Maker.
// `base: './'` makes the built asset paths relative, so the production
// `dist/` folder works whether it's served from a domain root or a
// subfolder (e.g. GitHub Pages project sites).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
