import { computed, signal } from '@preact/signals';
import { effectiveOrientation } from '../frames/geometry';
import { DEFAULT_VIEW, type View, type ViewMode } from '../render/view';
import { prefs } from './prefs';

/** Below 48rem the sidebar becomes a drawer. rem media queries follow browser zoom. */
const COMPACT_QUERY = '(max-width: 47.99rem)';

function watchMedia(query: string) {
  const list = typeof matchMedia === 'function' ? matchMedia(query) : null;
  const state = signal(list?.matches ?? false);
  list?.addEventListener('change', (event) => (state.value = event.matches));
  return state;
}

export const isCompact = watchMedia(COMPACT_QUERY);
export const reducedMotion = watchMedia('(prefers-reduced-motion: reduce)');
export const drawerOpen = signal(false);

export interface Photo {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  name: string;
  /** SHA-256 of the original file bytes; keys the cut-out cache. */
  hash: string;
}

/** The current photo's people, cut out (same size as the photo). */
export interface Cutout {
  hash: string;
  bitmap: ImageBitmap;
}

/** The photo being framed. Not persisted; dropping a new one replaces it. */
export const photo = signal<Photo | null>(null);

/** Pan and zoom of the current photo. Resets with each new photo. */
export const view = signal<View>(DEFAULT_VIEW);

export const cutout = signal<Cutout | null>(null);

/** 'downloading' only during the first-time model download. */
export const cutoutStatus = signal<'idle' | 'downloading' | 'running'>('idle');

/** True through the first-ever cut-out, whose progress the download toast shows. */
export const cutoutFirstRun = signal(false);

/** 0–1 while the model downloads (the détourage button's ring), otherwise undefined. */
export const downloadProgress = signal<number | undefined>(undefined);

/** His selected background, decoded; null for Neutre. */
export const backgroundImage = signal<ImageBitmap | null>(null);

/** The people layer is shown, so pan and zoom move only the people. */
export const cutoutActive = computed(
  () => prefs.value.cutout && photo.value !== null && cutout.value !== null && cutout.value.hash === photo.value.hash,
);

export const viewMode = computed<ViewMode>(() => (cutoutActive.value ? 'free' : 'cover'));

/** Polaroid is always upright, whatever the rotate setting. */
export const orientation = computed(() => effectiveOrientation(prefs.value.frame, prefs.value.orientation));

/** Bumped when web fonts finish loading, so canvases redraw their text. */
export const fontsVersion = signal(0);
