import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW, clampView, panBy, photoRect, zoomAt } from './view';

const landscape = { x: 0, y: 0, width: 400, height: 300 };
const portrait = { x: 0, y: 0, width: 300, height: 400 };
const image = { width: 4000, height: 3000 };

describe('photoRect', () => {
  it('cover-fits and centres by default', () => {
    expect(photoRect(DEFAULT_VIEW, landscape, image)).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    const rect = photoRect(DEFAULT_VIEW, portrait, image);
    expect(rect.height).toBeCloseTo(400);
    expect(rect.x + rect.width / 2).toBeCloseTo(150);
  });
});

describe('clampView', () => {
  it('never uncovers the window', () => {
    const view = clampView({ cx: 0, cy: 1, zoom: 2 }, landscape, image);
    const rect = photoRect(view, landscape, image);
    expect(rect.x).toBeCloseTo(0);
    expect(rect.y + rect.height).toBeCloseTo(300);
  });

  it('limits zoom to 1×–5× cover', () => {
    expect(clampView({ cx: 0.5, cy: 0.5, zoom: 0.2 }, landscape, image).zoom).toBe(1);
    expect(clampView({ cx: 0.5, cy: 0.5, zoom: 9 }, landscape, image).zoom).toBe(5);
  });
});

describe('panBy', () => {
  it('moves with the pointer at 1:1 and clamps', () => {
    const zoomed = { cx: 0.5, cy: 0.5, zoom: 2 };
    const moved = panBy(zoomed, 50, 0, landscape, image);
    expect(photoRect(moved, landscape, image).x - photoRect(zoomed, landscape, image).x).toBeCloseTo(50);
    expect(panBy(DEFAULT_VIEW, 50, 50, landscape, image)).toEqual(DEFAULT_VIEW);
  });
});

describe('zoomAt', () => {
  it('keeps the point under the anchor still', () => {
    const anchor = { x: 100, y: -60 };
    const start = { cx: 0.5, cy: 0.5, zoom: 1.5 };
    const before = photoRect(start, landscape, image);
    const after = photoRect(zoomAt(start, 1.15, anchor, landscape, image), landscape, image);
    const screen = { x: 200 + anchor.x, y: 150 + anchor.y };
    const u = (screen.x - before.x) / before.width;
    expect((screen.x - after.x) / after.width).toBeCloseTo(u);
  });

  it('zooming in then out by the same factor returns to the start', () => {
    const start = { cx: 0.4, cy: 0.55, zoom: 2 };
    const back = zoomAt(zoomAt(start, 1.15, { x: 0, y: 0 }, landscape, image), 1 / 1.15, { x: 0, y: 0 }, landscape, image);
    expect(back.zoom).toBeCloseTo(2);
    expect(back.cx).toBeCloseTo(0.4);
  });
});

describe('rotate', () => {
  it('keeps the centre point and relative zoom, re-clamped to the new window', () => {
    const view = clampView({ cx: 0.3, cy: 0.5, zoom: 2 }, landscape, image);
    const rotated = clampView(view, portrait, image);
    expect(rotated.zoom).toBe(2);
    expect(rotated.cx).toBeCloseTo(0.3);
    // Cover-fit in portrait has no horizontal slack at zoom 1, so it recentres.
    expect(clampView({ cx: 0.3, cy: 0.5, zoom: 1 }, portrait, image).cx).toBeCloseTo(0.3, 1);
  });
});

describe('free mode (détourage)', () => {
  it('allows zooming out to 30% and keeps 20% of the people inside the window', () => {
    const view = clampView({ cx: 5, cy: -5, zoom: 0.1 }, landscape, image, 'free');
    expect(view.zoom).toBeCloseTo(0.3);
    const rect = photoRect(view, landscape, image);
    const visibleWidth = Math.min(rect.x + rect.width, 400) - Math.max(rect.x, 0);
    const visibleHeight = Math.min(rect.y + rect.height, 300) - Math.max(rect.y, 0);
    expect(visibleWidth / rect.width).toBeCloseTo(0.2);
    expect(visibleHeight / rect.height).toBeCloseTo(0.2);
  });

  it('switching back to cover mode refills the window', () => {
    const free = clampView({ cx: 0.9, cy: 0.5, zoom: 0.5 }, landscape, image, 'free');
    expect(clampView(free, landscape, image, 'cover')).toEqual({ cx: 0.5, cy: 0.5, zoom: 1 });
  });
});
