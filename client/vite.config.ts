import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for the client application. It enables the
// React plugin and sets a default port for the dev server. When
// deploying, you can run `npm run build` and then serve the static
// files from the server's public directory.

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});