import { signal } from '@preact/signals';
import type { View } from '../render/view';
import { prefs, updatePrefs, type Prefs } from './prefs';
import { view } from './store';

/**
 * Undo and redo, in memory, capped at 50 steps. A step is the editor state
 * before a change: frame, orientation, background, détourage, caption, logo, pan/zoom.
 */

type Snapshot = Pick<Prefs, 'frame' | 'orientation' | 'backgroundId' | 'cutout' | 'caption' | 'logoId' | 'logo'> & { view: View };

const LIMIT = 50;
const undoStack = signal<Snapshot[]>([]);
const redoStack = signal<Snapshot[]>([]);

export const canUndo = () => undoStack.value.length > 0;
export const canRedo = () => redoStack.value.length > 0;

export function capture(): Snapshot {
  const { frame, orientation, backgroundId, cutout, caption, logoId, logo } = prefs.value;
  return { frame, orientation, backgroundId, cutout, caption, logoId, logo, view: view.value };
}

function same(a: Snapshot, b: Snapshot): boolean {
  return (
    a.frame === b.frame &&
    a.orientation === b.orientation &&
    a.backgroundId === b.backgroundId &&
    a.cutout === b.cutout &&
    a.caption === b.caption &&
    a.logoId === b.logoId &&
    a.logo.x === b.logo.x &&
    a.logo.y === b.logo.y &&
    a.logo.width === b.logo.width &&
    a.view.cx === b.view.cx &&
    a.view.cy === b.view.cy &&
    a.view.zoom === b.view.zoom
  );
}

/** Records `before` as one undo step, if anything actually changed since. */
export function commit(before: Snapshot): void {
  if (same(before, capture())) return;
  undoStack.value = [...undoStack.value, before].slice(-LIMIT);
  redoStack.value = [];
}

/** Runs a change as one undo step. */
export function step(change: () => void): void {
  const before = capture();
  change();
  commit(before);
}

function restore(snapshot: Snapshot): void {
  const { view: savedView, ...saved } = snapshot;
  updatePrefs(saved);
  view.value = savedView;
}

export function undo(): void {
  const previous = undoStack.value.at(-1);
  if (!previous) return;
  undoStack.value = undoStack.value.slice(0, -1);
  redoStack.value = [...redoStack.value, capture()];
  restore(previous);
}

export function redo(): void {
  const next = redoStack.value.at(-1);
  if (!next) return;
  redoStack.value = redoStack.value.slice(0, -1);
  undoStack.value = [...undoStack.value, capture()];
  restore(next);
}

export function clearHistory(): void {
  undoStack.value = [];
  redoStack.value = [];
}
