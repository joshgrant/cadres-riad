import { effect, signal } from '@preact/signals';
import { type FrameId, isFrameId } from '../frames/ids';
import { messages } from '../i18n/fr';

/** Shared settings that survive relaunches. The photo itself is never kept. */
export interface Prefs {
  version: 1;
  frame: FrameId;
  orientation: Orientation;
  /** 'neutral' for the built-in backdrop, otherwise an id from the backgrounds store. */
  backgroundId: string;
  cutout: boolean;
  caption: string;
  collapsed: { frame: boolean; background: boolean };
  hintDismissed: boolean;
}

export type Orientation = 'landscape' | 'portrait';

export const PREFS_KEY = 'cadres.prefs.v1';
export const NEUTRAL_BACKGROUND_ID = 'neutral';
const CURRENT_VERSION = 1;

export function defaultPrefs(): Prefs {
  return {
    version: CURRENT_VERSION,
    frame: 'dore',
    orientation: 'landscape',
    backgroundId: NEUTRAL_BACKGROUND_ID,
    cutout: false,
    caption: messages['caption.default'],
    collapsed: { frame: false, background: false },
    hintDismissed: false,
  };
}

/**
 * Turns whatever is in storage into valid prefs. Unknown versions and
 * unparseable data give defaults; a bad field falls back on its own.
 */
export function parsePrefs(raw: string | null): Prefs {
  const defaults = defaultPrefs();
  if (raw === null) return defaults;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!isRecord(data) || data.version !== CURRENT_VERSION) return defaults;

  const collapsed = isRecord(data.collapsed) ? data.collapsed : {};
  return {
    version: CURRENT_VERSION,
    frame: isFrameId(data.frame) ? data.frame : defaults.frame,
    orientation: data.orientation === 'portrait' || data.orientation === 'landscape' ? data.orientation : defaults.orientation,
    backgroundId: typeof data.backgroundId === 'string' && data.backgroundId ? data.backgroundId : defaults.backgroundId,
    cutout: typeof data.cutout === 'boolean' ? data.cutout : defaults.cutout,
    caption: typeof data.caption === 'string' ? data.caption.slice(0, 60) : defaults.caption,
    collapsed: {
      frame: typeof collapsed.frame === 'boolean' ? collapsed.frame : defaults.collapsed.frame,
      background: typeof collapsed.background === 'boolean' ? collapsed.background : defaults.collapsed.background,
    },
    hintDismissed: typeof data.hintDismissed === 'boolean' ? data.hintDismissed : defaults.hintDismissed,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStorage(): string | null {
  try {
    return localStorage.getItem(PREFS_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(value));
  } catch {
    // Storage full or blocked: keep working with in-memory prefs.
  }
}

export const prefs = signal<Prefs>(parsePrefs(readStorage()));

export function updatePrefs(patch: Partial<Omit<Prefs, 'version'>>): void {
  prefs.value = { ...prefs.value, ...patch };
}

let persisting = false;

/** Starts writing prefs back to storage on every change. Call once at startup. */
export function persistPrefs(): void {
  if (persisting) return;
  persisting = true;
  effect(() => writeStorage(prefs.value));
}
