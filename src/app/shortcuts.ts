import { platform } from '../platform';
import { ZOOM_STEP, panByFraction, resetView, zoomBy } from './actions';
import { redo, undo } from './history';
import { savePhoto } from './save';
import { photo } from './store';

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/** Arrow keys belong to tile grids, toolbars and dialogs when focus is inside them. */
function ownsArrows(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('[role="radiogroup"], [role="toolbar"], [role="dialog"]') !== null;
}

/** Window-wide shortcuts: undo/redo, and pan/zoom when a photo is loaded. No single letters. */
export function installShortcuts(): void {
  const mac = platform().os === 'mac';
  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    const mod = mac ? event.metaKey : event.ctrlKey;
    const key = event.key.toLowerCase();
    // Overrides the browser's save-page, even while typing a caption.
    if (mod && key === 's') {
      event.preventDefault();
      void savePhoto();
      return;
    }
    if (isTyping(event.target)) return;

    if (mod && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (!mac && event.ctrlKey && key === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || !photo.value) return;

    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = arrows[event.key];
    if (direction && !ownsArrows(event.target)) {
      event.preventDefault();
      const amount = event.shiftKey ? 0.1 : 0.02;
      panByFraction(direction[0] * amount, direction[1] * amount);
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomBy(1 / ZOOM_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      resetView();
    }
  });
}

