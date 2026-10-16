import { save } from '@tauri-apps/plugin-dialog';
import { BaseDirectory, exists, mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { dirname, join, pictureDir } from '@tauri-apps/api/path';
import type { ModelStore, Platform } from '../types';
import { isMac, pickFiles } from '../shared';

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
  modKeyLabel: isMac() ? '⌘' : 'Ctrl',
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
