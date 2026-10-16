import type { ModelStore, Platform } from '../types';
import { cssAccentColor, detectOs, pickFiles } from '../shared';

const MODEL_CACHE = 'cadres-models-v1';

const modelStore: ModelStore = {
  async get(key) {
    try {
      const response = await (await caches.open(MODEL_CACHE)).match(key);
      return response ? new Uint8Array(await response.arrayBuffer()) : null;
    } catch {
      return null;
    }
  },
  async put(key, data) {
    const cache = await caches.open(MODEL_CACHE);
    await cache.put(key, new Response(data.slice().buffer));
  },
};

export const webPlatform: Platform = {
  kind: 'web',
  os: detectOs(),
  overlayTitleBar: false,
  modKeyLabel: detectOs() === 'mac' ? '⌘' : 'Ctrl',
  async windowMaterial() {
    return 'none';
  },
  async systemAccent() {
    return cssAccentColor();
  },
  onOpenedFile() {
    // Browsers have no app icon to drop on.
  },
  modelStore,
  async saveImage(image, suggestedName) {
    const url = URL.createObjectURL(image);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  },
  openImages: pickFiles,
  // The service-worker update toast arrives with the optional web build (milestone 7).
  async checkForUpdate() {
    return null;
  },
};
