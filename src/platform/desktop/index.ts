import { save } from '@tauri-apps/plugin-dialog';
import { BaseDirectory, exists, mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { dirname, join, pictureDir } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ModelStore, Platform, WindowMaterial } from '../types';
import { detectOs, pickFiles } from '../shared';

const SAVE_FOLDER_NAME = 'Cadres Riad';
const LAST_FOLDER_KEY = 'cadres.lastSaveFolder';

/** Model files live in the app data folder, under models/. */
const modelStore: ModelStore = {
  async get(key) {
    const path = modelPath(key);
    try {
      if (!(await exists(path, { baseDir: BaseDirectory.AppData }))) return null;
      return await readFile(path, { baseDir: BaseDirectory.AppData });
    } catch {
      return null;
    }
  },
  async put(key, data) {
    await mkdir('models', { baseDir: BaseDirectory.AppData, recursive: true });
    await writeFile(modelPath(key), data, { baseDir: BaseDirectory.AppData });
  },
};

function modelPath(key: string): string {
  return `models/${key.replace(/[^\w.-]+/g, '_')}`;
}

function readLastFolder(): string | null {
  try {
    return localStorage.getItem(LAST_FOLDER_KEY);
  } catch {
    return null;
  }
}

function writeLastFolder(folder: string): void {
  try {
    localStorage.setItem(LAST_FOLDER_KEY, folder);
  } catch {
    // Not remembering the folder is harmless.
  }
}

/** Images › Cadres Riad, created on first use. */
async function defaultFolder(): Promise<string> {
  const folder = await join(await pictureDir(), SAVE_FOLDER_NAME);
  try {
    await mkdir(folder, { recursive: true });
  } catch {
    // The dialog still opens; it just starts wherever the system chooses.
  }
  return folder;
}

export const desktopPlatform: Platform = {
  kind: 'desktop',
  os: detectOs(),
  overlayTitleBar: detectOs() === 'mac',
  modKeyLabel: detectOs() === 'mac' ? '⌘' : 'Ctrl',
  async windowMaterial() {
    try {
      return await invoke<WindowMaterial>('window_material');
    } catch {
      return 'none';
    }
  },
  async systemAccent() {
    try {
      return await invoke<string | null>('system_accent_color');
    } catch {
      return null;
    }
  },
  onOpenedFile(listener) {
    const drain = async () => {
      const path = await invoke<string | null>('take_opened_path');
      if (!path) return;
      const bytes = await invoke<ArrayBuffer>('read_opened_file', { path });
      const name = path.split(/[\\/]/).pop() ?? 'photo';
      listener(new File([bytes], name, { type: mimeFromName(name) }));
    };
    void listen('open-files', () => void drain());
    // A file may have arrived before the UI was listening (launched by a drop).
    void drain();
  },
  modelStore,
  async saveImage(image, suggestedName, dialogTitle) {
    const folder = readLastFolder() ?? (await defaultFolder());
    const path = await save({
      title: dialogTitle,
      defaultPath: await join(folder, suggestedName),
      filters: [{ name: 'JPEG', extensions: ['jpg', 'jpeg'] }],
    });
    if (!path) return false;
    await writeFile(path, new Uint8Array(await image.arrayBuffer()));
    writeLastFolder(await dirname(path));
    return true;
  },
  openImages: pickFiles,
  // The Tauri updater arrives with the release workflow (milestone 7).
  async checkForUpdate() {
    return null;
  },
};

function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
    case 'heif':
      return 'image/heic';
    default:
      return '';
  }
}
