import { signal } from '@preact/signals';

/** Below 48rem the sidebar becomes a drawer. rem media queries follow browser zoom. */
const COMPACT_QUERY = '(max-width: 47.99rem)';

function watchMedia(query: string) {
  const list = typeof matchMedia === 'function' ? matchMedia(query) : null;
  const state = signal(list?.matches ?? false);
  list?.addEventListener('change', (event) => (state.value = event.matches));
  return state;
}

export const isCompact = watchMedia(COMPACT_QUERY);
export const drawerOpen = signal(false);

/** The loaded photo. Always null until photo import lands (milestone 2). */
export const photo = signal<ImageBitmap | null>(null);
