import { useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';
import { windowSize } from '../app/actions';
import { capture, commit } from '../app/history';
import { photo, view } from '../app/store';
import { panBy, zoomAt } from '../render/view';
import type { Rect } from '../render/layout';

/** Elements that keep their own behaviour: a drag never starts on them. */
const NO_PAN = 'button, a, input, textarea, [contenteditable], [role="toolbar"], .hint-pill, .toast-host, [data-no-pan]';

/**
 * Drag anywhere in the canvas area to pan; wheel, trackpad pinch and two-finger
 * touch pinch to zoom around the pointer. Each gesture is one undo step.
 */
export function useGestures(area: RefObject<HTMLElement | null>, windowRect: () => Rect | null): void {
  useEffect(() => {
    const element = area.current;
    if (!element) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let before: ReturnType<typeof capture> | null = null;
    let pinch: { distance: number; mid: { x: number; y: number } } | null = null;

    const image = () => (photo.value ? { width: photo.value.width, height: photo.value.height } : null);

    /** Pointer position relative to the frame window centre. */
    const anchor = (clientX: number, clientY: number) => {
      const rect = windowRect();
      const box = element.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: clientX - box.left - (rect.x + rect.width / 2), y: clientY - box.top - (rect.y + rect.height / 2) };
    };

    const twoPointerState = () => {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return null;
      return { distance: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!photo.value || event.button !== 0) return;
      if ((event.target as Element).closest(NO_PAN)) return;
      element.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        before = capture();
        element.classList.add('is-grabbing');
      }
      pinch = pointers.size === 2 ? twoPointerState() : null;
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      const last = pointers.get(event.pointerId);
      const size = image();
      if (!last || !size) return;
      const next = { x: event.clientX, y: event.clientY };
      pointers.set(event.pointerId, next);
      if (pointers.size === 1) {
        view.value = panBy(view.value, next.x - last.x, next.y - last.y, windowSize.value, size);
      } else if (pointers.size === 2 && pinch) {
        const now = twoPointerState();
        if (!now || pinch.distance === 0) return;
        const moved = panBy(view.value, now.mid.x - pinch.mid.x, now.mid.y - pinch.mid.y, windowSize.value, size);
        view.value = zoomAt(moved, now.distance / pinch.distance, anchor(now.mid.x, now.mid.y), windowSize.value, size);
        pinch = now;
      }
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return;
      pinch = pointers.size === 2 ? twoPointerState() : null;
      if (pointers.size === 0) {
        element.classList.remove('is-grabbing');
        if (before) commit(before);
        before = null;
      }
    };

    // Wheel bursts become a single undo step once they pause.
    let wheelBefore: ReturnType<typeof capture> | null = null;
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      const size = image();
      if (!size || (event.target as Element).closest('[role="toolbar"], .toast-host')) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
      // Trackpad pinch arrives as a wheel event with ctrlKey; it needs a stronger factor.
      const factor = Math.exp(-event.deltaY * unit * (event.ctrlKey ? 0.01 : 0.0015));
      wheelBefore ??= capture();
      view.value = zoomAt(view.value, factor, anchor(event.clientX, event.clientY), windowSize.value, size);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        if (wheelBefore) commit(wheelBefore);
        wheelBefore = null;
      }, 300);
    };

    // Safari's own pinch gesture would zoom the page; only on the canvas area.
    const stopGesture = (event: Event) => event.preventDefault();

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerEnd);
    element.addEventListener('pointercancel', onPointerEnd);
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('gesturestart', stopGesture);
    element.addEventListener('gesturechange', stopGesture);
    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerEnd);
      element.removeEventListener('pointercancel', onPointerEnd);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('gesturestart', stopGesture);
      element.removeEventListener('gesturechange', stopGesture);
      clearTimeout(wheelTimer);
    };
  }, [area, windowRect]);
}
