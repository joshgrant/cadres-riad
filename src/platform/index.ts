import { isTauri } from '@tauri-apps/api/core';
import type { Platform } from './types';

export type { Platform } from './types';

let current: Platform | undefined;

/** Picks the implementation once at startup. The desktop code is never loaded on the web. */
export async function initPlatform(): Promise<Platform> {
  current = isTauri()
    ? (await import('./desktop/index')).desktopPlatform
    : (await import('./web/index')).webPlatform;
  return current;
}

export function platform(): Platform {
  if (!current) throw new Error('initPlatform() must run before platform()');
  return current;
}
