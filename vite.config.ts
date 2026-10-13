import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Public synthetic UI only. Never accept inherited backend or provider settings.
if (Object.keys(process.env).some(name => /^(ANTHROPIC_|JUNO_|RENDER|VITE_|REPL_)/.test(name) || ['PORT', 'DATABASE_URL', 'DYNO', 'K_SERVICE'].includes(name))) {
  throw new Error('Remove provider, backend, and production configuration before building this demo.');
}
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig(({ mode }) => {
  if (mode === 'embedded-preview') throw new Error('Development-only CORS mode is not available in this public demo.');
  return {
    root, base: '/juno2-preview/', envDir: false,
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }, dedupe: ['react', 'react-dom'] },
    build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
    server: { host: '127.0.0.1', port: 5173, strictPort: true, cors: false, fs: { strict: true, allow: [root] } },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true, cors: false },
  };
});
