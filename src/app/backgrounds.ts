import { effect, signal } from '@preact/signals';
import { t } from '../i18n/fr';
import { deleteBackground, listBackgrounds, putBackground, type StoredBackground } from '../storage/db';
import { showToast } from '../ui/toastStore';
import { isAcceptedImage } from './actions';
import { step } from './history';
import { resized } from './images';
import { NEUTRAL_BACKGROUND_ID, prefs, updatePrefs } from './prefs';
import { backgroundImage } from './store';

/**
 * His own backgrounds: stored in IndexedDB as a 3000px JPEG plus a 400px
 * thumbnail, newest first. Neutre is built in and always first.
 */

export interface BackgroundTile {
  id: string;
  name: string;
  thumbUrl: string;
}

export const backgrounds = signal<BackgroundTile[]>([]);

const FULL_EDGE = 3000;
const THUMB_EDGE = 400;
const UNDO_MS = 6000;

const decoded = new Map<string, Promise<ImageBitmap | null>>();
const fullImages = new Map<string, Blob>();

/** Backgrounds saved by version 0.2 hold Blobs; newer ones hold bytes. */
const jpeg = (bytes: ArrayBuffer | Blob) => (bytes instanceof Blob ? bytes : new Blob([bytes], { type: 'image/jpeg' }));

function toTile(stored: StoredBackground): BackgroundTile {
  return { id: stored.id, name: stored.name, thumbUrl: URL.createObjectURL(jpeg(stored.thumb)) };
}

export async function loadBackgrounds(): Promise<void> {
  const stored = await listBackgrounds();
  for (const item of stored) fullImages.set(item.id, jpeg(item.image));
  backgrounds.value = stored.map(toTile);
  // A saved background that no longer exists falls back to Neutre.
  const selected = prefs.value.backgroundId;
  if (selected !== NEUTRAL_BACKGROUND_ID && !fullImages.has(selected)) updatePrefs({ backgroundId: NEUTRAL_BACKGROUND_ID });
}

let persistAsked = false;

/** Adds images as backgrounds; the newest is selected (which turns détourage on). */
export async function addBackgrounds(files: File[]): Promise<void> {
  const accepted = files.filter(isAcceptedImage);
  if (accepted.length < files.length) showToast({ body: t('error.format'), tone: 'error', duration: 6000 });
  let newest: StoredBackground | null = null;
  for (const file of accepted) {
    let item: StoredBackground;
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      try {
        item = {
          id: `bg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          createdAt: Date.now(),
          image: await (await resized(bitmap, FULL_EDGE, 'image/jpeg')).arrayBuffer(),
          thumb: await (await resized(bitmap, THUMB_EDGE, 'image/jpeg')).arrayBuffer(),
        };
      } finally {
        bitmap.close();
      }
    } catch {
      showToast({ body: t('error.format'), tone: 'error', duration: 6000 });
      continue;
    }
    try {
      await putBackground(item);
    } catch {
      showToast({ body: t('error.storage'), tone: 'error', duration: 8000 });
      break;
    }
    if (!persistAsked) {
      persistAsked = true;
      // Ask the browser not to evict his backgrounds.
      void navigator.storage?.persist?.();
    }
    fullImages.set(item.id, jpeg(item.image));
    backgrounds.value = [toTile(item), ...backgrounds.value];
    newest = item;
  }
  if (newest) {
    const id = newest.id;
    step(() => updatePrefs({ backgroundId: id, cutout: true }));
  }
}

/** Deletes at once, with “Fond supprimé” and Annuler for six seconds. */
export async function removeBackground(id: string): Promise<void> {
  const index = backgrounds.value.findIndex((tile) => tile.id === id);
  const tile = backgrounds.value[index];
  const image = fullImages.get(id);
  if (!tile || !image) return;
  const all = await listBackgrounds();
  const stored = all.find((item) => item.id === id);
  await deleteBackground(id);
  fullImages.delete(id);
  decoded.delete(id);
  backgrounds.value = backgrounds.value.filter((item) => item.id !== id);
  const wasSelected = prefs.value.backgroundId === id;
  if (wasSelected) updatePrefs({ backgroundId: NEUTRAL_BACKGROUND_ID });

  showToast({
    body: t('bg.deleted'),
    duration: UNDO_MS,
    action: {
      label: t('common.undo'),
      run: () => {
        if (!stored) return;
        void putBackground(stored).then(() => {
          fullImages.set(id, jpeg(stored.image));
          const list = [...backgrounds.value];
          list.splice(Math.min(index, list.length), 0, tile);
          backgrounds.value = list;
          if (wasSelected) updatePrefs({ backgroundId: id });
        });
      },
    },
  });
}

function decode(id: string): Promise<ImageBitmap | null> {
  let promise = decoded.get(id);
  if (!promise) {
    const blob = fullImages.get(id);
    promise = blob ? createImageBitmap(blob).catch(() => null) : Promise.resolve(null);
    decoded.set(id, promise);
  }
  return promise;
}

/** Keeps `backgroundImage` in step with the selected background. */
export function installBackgrounds(): void {
  void loadBackgrounds();
  effect(() => {
    const id = prefs.value.backgroundId;
    if (id === NEUTRAL_BACKGROUND_ID) {
      backgroundImage.value = null;
      return;
    }
    void decode(id).then((bitmap) => {
      if (prefs.value.backgroundId === id) backgroundImage.value = bitmap;
    });
  });
}
