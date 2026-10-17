import { effect, signal } from '@preact/signals';
import { type FrameId, isFrameId } from '../frames/ids';
import { messages } from '../i18n/fr';
import { DEFAULT_LOGO_PLACEMENT, type LogoPlacement } from '../render/logo';

/** Shared settings that survive relaunches. The photo itself is never kept. */
export interface Prefs {
  version: 1;
  frame: FrameId;
  orientation: Orientation;
  /** 'neutral' for the built-in backdrop, otherwise an id from the backgrounds store. */
  backgroundId: string;
  cutout: boolean;
  caption: string;
  /** 'none', a built-in logo's id, or an id from the logos store. */
  logoId: string;
  logo: LogoPlacement;
  collapsed: { frame: boolean; background: boolean; logo: boolean };
  hintDismissed: boolean;
}

export type Orientation = 'landscape' | 'portrait';

export const PREFS_KEY = 'cadres.prefs.v1';
export const NEUTRAL_BACKGROUND_ID = 'neutral';
export const NO_LOGO_ID = 'none';
export const DEFAULT_LOGO_ID = 'default';
const CURRENT_VERSION = 1;

export function defaultPrefs(): Prefs {
  return {
    version: CURRENT_VERSION,
    frame: 'dore',
    orientation: 'landscape',
    backgroundId: NEUTRAL_BACKGROUND_ID,
    cutout: false,
    caption: messages['caption.default'],
    logoId: DEFAULT_LOGO_ID,
    logo: { ...DEFAULT_LOGO_PLACEMENT },
    collapsed: { frame: false, background: false, logo: false },
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
    logoId: typeof data.logoId === 'string' && data.logoId ? data.logoId : defaults.logoId,
    logo: isPlacement(data.logo) ? { x: data.logo.x, y: data.logo.y, width: data.logo.width } : defaults.logo,
    collapsed: {
      frame: typeof collapsed.frame === 'boolean' ? collapsed.frame : defaults.collapsed.frame,
      background: typeof collapsed.background === 'boolean' ? collapsed.background : defaults.collapsed.background,
      logo: typeof collapsed.logo === 'boolean' ? collapsed.logo : defaults.collapsed.logo,
    },
    hintDismissed: typeof data.hintDismissed === 'boolean' ? data.hintDismissed : defaults.hintDismissed,
  };
}

/** Fractions of the window; the canvas clamps them to the logo's real size. */
function isPlacement(value: unknown): value is LogoPlacement {
  if (!isRecord(value)) return false;
  const fraction = (n: unknown) => typeof n === 'number' && n >= 0 && n <= 1;
  return fraction(value.x) && fraction(value.y) && fraction(value.width) && (value.width as number) > 0;
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
