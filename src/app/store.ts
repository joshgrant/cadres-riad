import { computed, signal } from '@preact/signals';
import { effectiveOrientation } from '../frames/geometry';
import { DEFAULT_VIEW, type View } from '../render/view';
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
}

/** The photo being framed. Not persisted; dropping a new one replaces it. */
export const photo = signal<Photo | null>(null);

/** Pan and zoom of the current photo. Resets with each new photo. */
export const view = signal<View>(DEFAULT_VIEW);

/** Polaroid is always upright, whatever the rotate setting. */
export const orientation = computed(() => effectiveOrientation(prefs.value.frame, prefs.value.orientation));

/** Bumped when web fonts finish loading, so canvases redraw their text. */
export const fontsVersion = signal(0);
