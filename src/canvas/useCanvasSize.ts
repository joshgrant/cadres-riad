import { useEffect, useState } from 'preact/hooks';
import type { RefObject } from 'preact';

export interface CanvasSize {
  /** CSS pixels. */
  width: number;
  height: number;
  /** Device pixels per CSS pixel; changes with browser zoom and when the window moves screens. */
  dpr: number;
}

/** Tracks an element's CSS size and the device pixel ratio. */
export function useCanvasSize(ref: RefObject<HTMLElement | null>): CanvasSize {
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0, dpr: devicePixelRatio || 1 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize((previous) => {
        const next = { width: rect.width, height: rect.height, dpr: devicePixelRatio || 1 };
        return previous.width === next.width && previous.height === next.height && previous.dpr === next.dpr ? previous : next;
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    // Re-arm a resolution query each time the ratio changes (zooming changes it).
    let media: MediaQueryList | undefined;
    const watchRatio = () => {
      media?.removeEventListener('change', onRatioChange);
      media = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
      media.addEventListener('change', onRatioChange);
    };
    const onRatioChange = () => {
      measure();
      watchRatio();
    };
    watchRatio();
    measure();
    return () => {
      observer.disconnect();
      media?.removeEventListener('change', onRatioChange);
    };
  }, [ref]);

  return size;
}
