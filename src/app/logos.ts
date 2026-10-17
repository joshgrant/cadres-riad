import { computed, effect, signal } from '@preact/signals';
import blueLogoUrl from '../../assets/logos/default.png';
import woodLogoUrl from '../../assets/logos/brown.webp';
import { t, type MessageKey } from '../i18n/fr';
import { deleteLogo, listLogos, putLogo, type StoredLogo } from '../storage/db';
import { showToast } from '../ui/toastStore';
import { isAcceptedImage } from './actions';
import { step } from './history';
import { resized, visibleBounds } from './images';
import { NO_LOGO_ID, prefs, updatePrefs } from './prefs';
import { logoImage, logoSelected } from './store';

/**
 * The riad's logos, built in, then his own: stored in IndexedDB as a 2400px PNG
 * plus a 400px thumbnail, newest first, transparent margins trimmed so the
 * handles hug the visible logo. Aucun is always first.
 */

export interface BuiltInLogo {
  id: string;
  nameKey: MessageKey;
  url: string;
}

export const BUILT_IN_LOGOS: readonly BuiltInLogo[] = [
  { id: 'default', nameKey: 'logo.blue', url: blueLogoUrl },
  { id: 'brown', nameKey: 'logo.wood', url: woodLogoUrl },
];

export interface LogoTile {
  id: string;
  name: string;
  thumbUrl: string;
}

/** His own logos; the built-in ones are listed separately. */
export const logos = signal<LogoTile[]>([]);

const FULL_EDGE = 2400;
const THUMB_EDGE = 400;
const UNDO_MS = 6000;

const decoded = new Map<string, Promise<ImageBitmap | null>>();
const fullImages = new Map<string, Blob>();

const png = (bytes: ArrayBuffer) => new Blob([bytes], { type: 'image/png' });

function toTile(stored: StoredLogo): LogoTile {
  return { id: stored.id, name: stored.name, thumbUrl: URL.createObjectURL(png(stored.thumb)) };
}

const builtIn = (id: string) => BUILT_IN_LOGOS.find((logo) => logo.id === id);

/** The name shown in the section header and on the tile. */
export function logoName(id: string): string {
  if (id === NO_LOGO_ID) return t('logo.none');
  const known = builtIn(id);
  if (known) return t(known.nameKey);
  return logos.value.find((logo) => logo.id === id)?.name ?? t('logo.none');
}

export async function loadLogos(): Promise<void> {
  const stored = await listLogos();
  for (const item of stored) fullImages.set(item.id, png(item.image));
  logos.value = stored.map(toTile);
  // A saved logo that no longer exists falls back to Aucun.
  const selected = prefs.value.logoId;
  if (selected !== NO_LOGO_ID && !builtIn(selected) && !fullImages.has(selected)) updatePrefs({ logoId: NO_LOGO_ID });
}

let persistAsked = false;

/** Adds images as logos; the newest is selected. */
export async function addLogos(files: File[]): Promise<void> {
  const accepted = files.filter(isAcceptedImage);
  if (accepted.length < files.length) showToast({ body: t('error.format'), tone: 'error', duration: 6000 });
  let newest: StoredLogo | null = null;
  for (const file of accepted) {
    let item: StoredLogo;
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      try {
        const crop = visibleBounds(bitmap);
        item = {
          id: `logo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          createdAt: Date.now(),
          image: await (await resized(bitmap, FULL_EDGE, 'image/png', crop)).arrayBuffer(),
          thumb: await (await resized(bitmap, THUMB_EDGE, 'image/png', crop)).arrayBuffer(),
        };
      } finally {
        bitmap.close();
      }
    } catch {
      showToast({ body: t('error.format'), tone: 'error', duration: 6000 });
      continue;
    }
    try {
      await putLogo(item);
    } catch {
      showToast({ body: t('error.storageLogo'), tone: 'error', duration: 8000 });
      break;
    }
    if (!persistAsked) {
      persistAsked = true;
      // Ask the browser not to evict his logos.
      void navigator.storage?.persist?.();
    }
    fullImages.set(item.id, png(item.image));
    logos.value = [toTile(item), ...logos.value];
    newest = item;
  }
  if (newest) {
    const id = newest.id;
    step(() => updatePrefs({ logoId: id }));
  }
}

/** Deletes at once, with “Logo supprimé” and Annuler for six seconds. */
export async function removeLogo(id: string): Promise<void> {
  const index = logos.value.findIndex((tile) => tile.id === id);
  const tile = logos.value[index];
  if (!tile || !fullImages.has(id)) return;
  const stored = (await listLogos()).find((item) => item.id === id);
  await deleteLogo(id);
  fullImages.delete(id);
  decoded.delete(id);
  logos.value = logos.value.filter((item) => item.id !== id);
  const wasSelected = prefs.value.logoId === id;
  if (wasSelected) updatePrefs({ logoId: NO_LOGO_ID });

  showToast({
    body: t('logo.deleted'),
    duration: UNDO_MS,
    action: {
      label: t('common.undo'),
      run: () => {
        if (!stored) return;
        void putLogo(stored).then(() => {
          fullImages.set(id, png(stored.image));
          const list = [...logos.value];
          list.splice(Math.min(index, list.length), 0, tile);
          logos.value = list;
          if (wasSelected) updatePrefs({ logoId: id });
        });
      },
    },
  });
}

/** Built-in logos come with wide empty margins; crop them away once, as his own are on import. */
async function decodeBuiltIn(url: string): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  const crop = visibleBounds(bitmap);
  if (crop.width === bitmap.width && crop.height === bitmap.height) return bitmap;
  const trimmed = await createImageBitmap(bitmap, crop.x, crop.y, crop.width, crop.height);
  bitmap.close();
  return trimmed;
}

function decode(id: string): Promise<ImageBitmap | null> {
  let promise = decoded.get(id);
  if (!promise) {
    const known = builtIn(id);
    const blob = fullImages.get(id);
    promise = (known ? decodeBuiltIn(known.url) : blob ? createImageBitmap(blob) : Promise.resolve(null)).catch(() => null);
    decoded.set(id, promise);
  }
  return promise;
}

const selectedLogoId = computed(() => prefs.value.logoId);

/** Keeps `logoImage` in step with the selected logo. */
export function installLogos(): void {
  const loaded = loadLogos();
  effect(() => {
    const id = selectedLogoId.value;
    logoSelected.value = false;
    if (id === NO_LOGO_ID) {
      logoImage.value = null;
      return;
    }
    // His own logos are known once the store has been read.
    void loaded
      .then(() => decode(id))
      .then((bitmap) => {
        if (prefs.value.logoId === id) logoImage.value = bitmap;
      });
  });
}
