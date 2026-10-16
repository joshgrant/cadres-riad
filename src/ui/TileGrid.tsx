import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import './Tile.css';

const COLUMNS = 2;

/**
 * Two-column radiogroup with a roving tabindex: one Tab stop on the selected
 * tile, arrow keys move between tiles. `after` holds non-radio tiles (Add).
 */
export function TileGrid({ label, children, after }: { label: string; children: ComponentChildren; after?: ComponentChildren }) {
  const grid = useRef<HTMLDivElement>(null);

  const radios = () => Array.from(grid.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []);

  // Keep exactly one radio tabbable: the selected one, or the first.
  useLayoutEffect(() => {
    const items = radios();
    const current = items.find((item) => item.getAttribute('aria-checked') === 'true') ?? items[0];
    for (const item of items) item.tabIndex = item === current ? 0 : -1;
  });

  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }[event.key];
    const home = event.key === 'Home';
    const end = event.key === 'End';
    if (step === undefined && !home && !end) return;
    const items = radios();
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const target = home ? 0 : end ? items.length - 1 : Math.min(items.length - 1, Math.max(0, index + (step ?? 0)));
    const next = items[target];
    if (!next) return;
    for (const item of items) item.tabIndex = item === next ? 0 : -1;
    next.focus();
  };

  return (
    <div class="tile-grid">
      <div ref={grid} class="tile-grid__radios" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
        {children}
      </div>
      {after}
    </div>
  );
}
