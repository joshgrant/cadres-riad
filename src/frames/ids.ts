import type { MessageKey } from '../i18n/fr';

/** Frame ids in sidebar order. */
export const FRAME_IDS = ['dore', 'noyer', 'brut', 'chene', 'noir', 'blanc', 'polaroid'] as const;

export type FrameId = (typeof FRAME_IDS)[number];

export function isFrameId(value: unknown): value is FrameId {
  return typeof value === 'string' && (FRAME_IDS as readonly string[]).includes(value);
}

export function frameNameKey(id: FrameId): MessageKey {
  return `frame.${id}`;
}
