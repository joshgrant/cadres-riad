import { useEffect, useRef } from 'preact/hooks';

/** Tile previews are drawn once into a fixed 4:3 bitmap, sharp at 2× on high-DPI screens. */
const WIDTH = 480;
const HEIGHT = 360;

/**
 * Rendered tiles, kept across mounts (the drawer remounts the sidebar) and only
 * redrawn when their key changes: frame, caption, fonts, theme.
 */
const cache = new Map<string, HTMLCanvasElement>();

/** Uncached tiles render one per frame, so opening the sidebar never stalls the UI. */
const queue: (() => void)[] = [];
let scheduled = false;
function enqueue(job: () => void): void {
  queue.push(job);
  if (scheduled) return;
  scheduled = true;
  const next = () => {
    queue.shift()?.();
    if (queue.length > 0) requestAnimationFrame(next);
    else scheduled = false;
  };
  requestAnimationFrame(next);
}

export function Thumbnail({
  draw,
  deps,
}: {
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  deps: unknown[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // deps must identify the drawing: they are the cache key.
  const key = JSON.stringify(deps);
  useEffect(() => {
    let cancelled = false;
    const show = (rendered: HTMLCanvasElement) => {
      const ctx = ref.current?.getContext('2d');
      if (cancelled || !ctx) return;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.drawImage(rendered, 0, 0);
    };
    const cached = cache.get(key);
    if (cached) {
      show(cached);
    } else {
      enqueue(() => {
        if (cancelled) return;
        const rendered = document.createElement('canvas');
        rendered.width = WIDTH;
        rendered.height = HEIGHT;
        const renderCtx = rendered.getContext('2d');
        if (renderCtx) draw(renderCtx, WIDTH, HEIGHT);
        cache.set(key, rendered);
        show(rendered);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [key]);
  return <canvas ref={ref} width={WIDTH} height={HEIGHT} aria-hidden="true" />;
}
