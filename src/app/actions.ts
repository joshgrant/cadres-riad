import { signal } from '@preact/signals';
import type { FrameId } from '../frames/ids';
import { FRAME_GEOMETRY } from '../frames/geometry';
import { t } from '../i18n/fr';
import { DEFAULT_VIEW, clampView, panBy, zoomAt, type Size } from '../render/view';
import { showToast } from '../ui/toastStore';
import { clearHistory, step } from './history';
import { prefs, updatePrefs } from './prefs';
import { photo, view, viewMode } from './store';

/** Current frame window size in CSS pixels, kept up to date by the canvas. */
export const windowSize = signal<Size>({ width: 0, height: 0 });

/** Zoom button step, and the Shift (double) step. */
export const ZOOM_STEP = 1.15;
export const ZOOM_STEP_LARGE = 1.32;

/** Longest edge kept in memory. Export is 2400px; this leaves room to zoom in. */
const MAX_DECODED_EDGE = 6000;

const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif)$/;
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED.test(file.type) || (!file.type && ACCEPTED_EXTENSIONS.test(file.name)) || ACCEPTED_EXTENSIONS.test(file.name);
}

async function decode(file: File): Promise<ImageBitmap> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // HEIC and some engines only decode through an <img>.
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      bitmap = await createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_DECODED_EDGE) return bitmap;
  const scale = MAX_DECODED_EDGE / longest;
  const resized = await createImageBitmap(bitmap, {
    resizeWidth: Math.round(bitmap.width * scale),
    resizeHeight: Math.round(bitmap.height * scale),
    resizeQuality: 'high',
  });
  bitmap.close();
  return resized;
}

/** Replaces the current photo. Unsupported files leave everything as it was. */
export async function loadPhoto(file: File): Promise<boolean> {
  if (!isAcceptedImage(file)) {
    showToast({ body: t('error.format'), tone: 'error', duration: 6000 });
    return false;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    showToast({ body: t('error.format'), tone: 'error', duration: 6000 });
    return false;
  }
  const hash = await sha256(file);
  photo.value?.bitmap.close();
  photo.value = { bitmap, width: bitmap.width, height: bitmap.height, name: file.name, hash };
  view.value = DEFAULT_VIEW;
  clearHistory();
  return true;
}

async function sha256(file: Blob): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Without SubtleCrypto the cache just never hits.
    return `${file.size}-${Date.now()}-${Math.random()}`;
  }
}

function imageSize(): Size | null {
  const current = photo.value;
  return current ? { width: current.width, height: current.height } : null;
}

export function zoomBy(factor: number, anchor = { x: 0, y: 0 }): void {
  const image = imageSize();
  if (!image) return;
  step(() => (view.value = zoomAt(view.value, factor, anchor, windowSize.value, image, viewMode.value)));
}

/** Pans by a fraction of the window size (keyboard arrows). */
export function panByFraction(fx: number, fy: number): void {
  const image = imageSize();
  if (!image) return;
  const { width, height } = windowSize.value;
  step(() => (view.value = panBy(view.value, -fx * width, -fy * height, windowSize.value, image, viewMode.value)));
}

export function resetView(): void {
  if (!photo.value) return;
  step(() => (view.value = DEFAULT_VIEW));
}

/** Keeps the view valid after the window changes shape (rotate, frame, resize). Not an undo step. */
export function reclampView(): void {
  const image = imageSize();
  if (!image || windowSize.value.width <= 0) return;
  const clamped = clampView(view.value, windowSize.value, image, viewMode.value);
  const current = view.value;
  if (clamped.cx !== current.cx || clamped.cy !== current.cy || clamped.zoom !== current.zoom) view.value = clamped;
}

export function rotate(): void {
  if (FRAME_GEOMETRY[prefs.value.frame].portraitOnly) return;
  step(() => updatePrefs({ orientation: prefs.value.orientation === 'landscape' ? 'portrait' : 'landscape' }));
}

export function chooseFrame(frame: FrameId): void {
  step(() => updatePrefs({ frame }));
}

/** Choosing a background has only one meaning, so it also turns détourage on. */
export function chooseBackground(backgroundId: string): void {
  step(() => updatePrefs({ backgroundId, cutout: true }));
}
