import type { FrameId } from '../frames/ids';
import { FRAME_GEOMETRY } from '../frames/geometry';
import type { Orientation } from '../app/prefs';
import { drawFrameLayer, drawWindowContent, drawWindowOverlay, shadowExtent } from './frameRenderer';
import { fitFrame, frameProportions } from './layout';
import type { View } from './view';

export const EXPORT_LONG_EDGE = 2400;
const SIDE_MARGIN = 0.03; // of the frame's width, sides and top, at least
const BOTTOM_MARGIN = 0.06; // room for the frame's shadow, at least
const MAX_BYTES = 2 * 1024 * 1024;

export interface ExportInput {
  frame: FrameId;
  orientation: Orientation;
  caption: string;
  photo: { image: CanvasImageSource; width: number; height: number; view: View };
}

/** Canvas size and frame placement for the export: frame on white, long edge 2400px. */
export function exportGeometry(frame: FrameId, orientation: Orientation) {
  const unit = frameProportions(FRAME_GEOMETRY[frame], orientation);
  // The spec's margins, widened wherever the frame's shadow reaches further.
  const shadow = shadowExtent(frame, unit);
  const side = Math.max(unit.width * SIDE_MARGIN, shadow.side);
  const top = Math.max(unit.width * SIDE_MARGIN, shadow.top);
  const bottom = Math.max(unit.width * BOTTOM_MARGIN, shadow.bottom);
  const unitWidth = unit.width + 2 * side;
  const unitHeight = unit.height + top + bottom;
  const scale = EXPORT_LONG_EDGE / Math.max(unitWidth, unitHeight);
  const width = Math.round(unitWidth * scale);
  const height = Math.round(unitHeight * scale);
  const frameBox = {
    x: side * scale,
    y: top * scale,
    width: unit.width * scale,
    height: unit.height * scale,
  };
  return { width, height, frameBox };
}

/** Renders the framed photo with the same renderer as the preview and encodes a JPEG. */
export async function renderExport(input: ExportInput): Promise<Blob> {
  await document.fonts.ready;
  const { width, height, frameBox } = exportGeometry(input.frame, input.orientation);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const layout = fitFrame(frameBox, FRAME_GEOMETRY[input.frame], input.orientation);
  drawFrameLayer(ctx, layout, input.frame, input.caption, { forExport: true });
  drawWindowContent(ctx, layout, input.photo);
  drawWindowOverlay(ctx, layout, input.frame);

  // Canvas encoding drops EXIF, which also removes guests' location data.
  let blob = await encode(canvas, 0.9);
  if (blob.size > MAX_BYTES) blob = await encode(canvas, 0.85);
  return blob;
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('JPEG encoding failed'))), 'image/jpeg', quality),
  );
}

/** `Riad-Les-Chtis-DAgadir-2026_2026-10-16.jpg`: caption slug plus today's date. */
export function exportFileName(caption: string, date = new Date()): string {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const slug = caption
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/['’‘`]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'photo-encadree'}_${day}.jpg`;
}
