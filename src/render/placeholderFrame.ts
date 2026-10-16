import { PLACEHOLDER_COLOURS } from '../frames/geometry';
import type { FrameId } from '../frames/ids';
import type { FrameLayout } from './layout';

/**
 * Milestone 1–2 stand-in: a flat frame with mitred corners, a simple top-lit
 * shade per rail and the wall shadow. Replaced by the WebGL renderer in milestone 3.
 */
export function drawPlaceholderFrame(
  ctx: CanvasRenderingContext2D,
  layout: FrameLayout,
  frame: FrameId,
  options: { wallShadow: boolean },
): void {
  const { frame: outer, window: inner } = layout;
  if (outer.width <= 0 || outer.height <= 0) return;
  const colours = PLACEHOLDER_COLOURS[frame];

  ctx.save();
  if (options.wallShadow) {
    // Hangs on a wall lit from above: offset down ~1.5%, blur ~4%, ~35% opacity.
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = outer.height * 0.04;
    ctx.shadowOffsetY = outer.height * 0.015;
  }
  ctx.fillStyle = colours.face;
  ctx.fillRect(outer.x, outer.y, outer.width, outer.height);
  ctx.restore();

  // Mitred rails, each shaded as if lit from above.
  const corners = {
    outer: [
      [outer.x, outer.y],
      [outer.x + outer.width, outer.y],
      [outer.x + outer.width, outer.y + outer.height],
      [outer.x, outer.y + outer.height],
    ],
    inner: [
      [inner.x, inner.y],
      [inner.x + inner.width, inner.y],
      [inner.x + inner.width, inner.y + inner.height],
      [inner.x, inner.y + inner.height],
    ],
  } as const;
  const shades = [
    'rgba(255, 255, 255, 0.10)', // top rail catches the light
    'rgba(0, 0, 0, 0.04)',
    'rgba(0, 0, 0, 0.14)', // bottom rail falls into shade
    'rgba(0, 0, 0, 0.04)',
  ];
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4;
    ctx.beginPath();
    ctx.moveTo(...corners.outer[side]!);
    ctx.lineTo(...corners.outer[next]!);
    ctx.lineTo(...corners.inner[next]!);
    ctx.lineTo(...corners.inner[side]!);
    ctx.closePath();
    ctx.fillStyle = shades[side]!;
    ctx.fill();
  }

  // Hairline mitre joints.
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = Math.max(1, outer.width / 1200);
  ctx.beginPath();
  for (let corner = 0; corner < 4; corner++) {
    ctx.moveTo(...corners.outer[corner]!);
    ctx.lineTo(...corners.inner[corner]!);
  }
  ctx.stroke();
  ctx.restore();

  // Inner lip.
  const lip = Math.max(1, Math.min(layout.rails.left, layout.rails.top) * 0.08);
  ctx.save();
  ctx.strokeStyle = colours.lip;
  ctx.lineWidth = lip;
  ctx.strokeRect(inner.x - lip / 2, inner.y - lip / 2, inner.width + lip, inner.height + lip);
  ctx.restore();
}

/** Inner shadow cast by the top rail onto the picture; much fainter on the sides, none at the bottom. */
export function drawWindowShadow(ctx: CanvasRenderingContext2D, layout: FrameLayout, _frame: FrameId): void {
  const { window: inner } = layout;
  if (inner.width <= 0 || inner.height <= 0) return;
  const topDepth = inner.height * 0.015;
  const sideDepth = inner.height * 0.004;
  ctx.save();
  const top = ctx.createLinearGradient(0, inner.y, 0, inner.y + topDepth);
  top.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
  top.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(inner.x, inner.y, inner.width, topDepth);
  for (const [x, direction] of [
    [inner.x, 1],
    [inner.x + inner.width, -1],
  ] as const) {
    const side = ctx.createLinearGradient(x, 0, x + direction * sideDepth, 0);
    side.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
    side.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = side;
    ctx.fillRect(Math.min(x, x + direction * sideDepth), inner.y, sideDepth, inner.height);
  }
  ctx.restore();
}
