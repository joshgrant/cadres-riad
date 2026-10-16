import { useEffect, useRef } from 'preact/hooks';
import { prefs, updatePrefs } from '../app/prefs';
import { drawerOpen, isCompact, photo } from '../app/store';
import { FRAME_GEOMETRY } from '../frames/geometry';
import { frameNameKey } from '../frames/ids';
import { t } from '../i18n/fr';
import { platform } from '../platform';
import { drawNeutralBackdrop } from '../render/backdrop';
import { fitFrame, type FrameLayout } from '../render/layout';
import { drawPlaceholderFrame, drawWindowShadow } from '../render/placeholderFrame';
import { ControlDivider, ControlGroup } from '../ui/ControlGroup';
import { Icon } from '../ui/Icon';
import { IconButton, ToggleIconButton } from '../ui/IconButton';
import { PrimaryButton } from '../ui/PrimaryButton';
import { ToastHost } from '../ui/Toast';
import { EmptyState } from './EmptyState';
import { useCanvasSize } from './useCanvasSize';
import './CanvasArea.css';

/** The framed photo, its floating controls and the save button. */
export function CanvasArea() {
  const area = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const areaSize = useCanvasSize(area);
  const stageSize = useCanvasSize(stage);

  const { frame, orientation, cutout, caption } = prefs.value;
  const hasPhoto = photo.value !== null;

  // Stage bounds relative to the canvas area; CSS decides the insets.
  const stageRect = stage.current && area.current ? relativeRect(stage.current, area.current) : null;
  const layout: FrameLayout | null = stageRect ? fitFrame(stageRect, FRAME_GEOMETRY[frame], orientation) : null;

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx || !layout) return;
    const { width, height, dpr } = areaSize;
    element.width = Math.round(width * dpr);
    element.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawPlaceholderFrame(ctx, layout, frame, { wallShadow: true });
    const { window: inner } = layout;
    drawNeutralBackdrop(ctx, inner.x, inner.y, inner.width, inner.height);
    drawWindowShadow(ctx, layout, frame);
  }, [areaSize, stageSize, frame, orientation]);

  const frameName = t(frameNameKey(frame));
  const label = hasPhoto ? t('canvas.label', { frame: frameName, caption }) : t('canvas.labelEmpty', { frame: frameName });
  const choosePhoto = () => void platform().openImages({ multiple: false });

  return (
    <main class="canvas-area" ref={area}>
      <canvas ref={canvas} class="canvas-area__canvas" role="img" aria-label={label} />
      <div ref={stage} class="canvas-area__stage" aria-hidden="true" />

      <div class="canvas-area__top">
        {isCompact.value && (
          <button
            type="button"
            class="canvas-area__drawer-button material"
            aria-expanded={drawerOpen.value}
            onClick={() => (drawerOpen.value = true)}
          >
            <Icon name="sidebar" />
            <span class="canvas-area__drawer-label">{t('drawer.open')}</span>
          </button>
        )}
        <ControlGroup label={t('ctrl.group')} class="canvas-area__controls">
          <ToggleIconButton
            icon="cutout"
            label={cutout ? t('ctrl.cutout.on') : t('ctrl.cutout.off')}
            pressed={cutout}
            disabled={!hasPhoto}
            onClick={() => updatePrefs({ cutout: !cutout })}
          />
          <ControlDivider />
          <IconButton
            icon="rotate"
            label={t('ctrl.rotate')}
            onClick={() => updatePrefs({ orientation: orientation === 'landscape' ? 'portrait' : 'landscape' })}
          />
          <IconButton icon="zoom-out" label={t('ctrl.zoomOut')} disabled={!hasPhoto} />
          <IconButton icon="zoom-in" label={t('ctrl.zoomIn')} disabled={!hasPhoto} />
        </ControlGroup>
      </div>

      {/* After the controls, so Tab order is controls → frame window → save. */}
      {!hasPhoto && layout && <EmptyState rect={layout.window} onChoose={choosePhoto} />}

      <PrimaryButton icon="download" class="canvas-area__save" disabled={!hasPhoto}>
        {t('save.label')}
      </PrimaryButton>

      <ToastHost />
    </main>
  );
}

function relativeRect(element: HTMLElement, container: HTMLElement) {
  const a = element.getBoundingClientRect();
  const b = container.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, width: a.width, height: a.height };
}
