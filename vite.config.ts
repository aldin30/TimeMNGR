import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Vital for GitHub Pages subfolder hosting
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "")
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});