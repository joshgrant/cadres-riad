import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// Cross-origin isolation, so multi-threaded WASM works in dev and preview
// exactly as it does inside the Tauri window.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [preact()],
  clearScreen: false,
  server: { port: 5173, strictPort: true, headers: isolationHeaders },
  preview: { port: 4173, strictPort: true, headers: isolationHeaders },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    // WKWebView on macOS 13 ships Safari 16 era WebKit.
    target: ['es2022', 'safari16', 'chrome120', 'edge120', 'firefox125'],
    // Only index.html is an input, so dev/components.html never ships.
    rollupOptions: { input: 'index.html' },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
