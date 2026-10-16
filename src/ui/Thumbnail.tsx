import { useEffect, useRef } from 'preact/hooks';

/** Tile previews are drawn once into a fixed 4:3 bitmap, sharp at 2× on high-DPI screens. */
const WIDTH = 480;
const HEIGHT = 360;

export function Thumbnail({ draw, deps }: { draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void; deps: unknown[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    draw(ctx, WIDTH, HEIGHT);
  }, deps);
  return <canvas ref={ref} width={WIDTH} height={HEIGHT} aria-hidden="true" />;
}
