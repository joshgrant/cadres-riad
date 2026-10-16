import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { loadPhoto, reclampView, windowSize } from '../app/actions';
import { prefs, updatePrefs } from '../app/prefs';
import { savePhoto, saving } from '../app/save';
import { fontsVersion, orientation, photo, reducedMotion, view } from '../app/store';
import { FRAME_GEOMETRY } from '../frames/geometry';
import { frameNameKey } from '../frames/ids';
import { t } from '../i18n/fr';
import { frenchSpacing } from '../i18n/typography';
import { platform } from '../platform';
import { drawFrameLayer, drawWindowContent, drawWindowOverlay } from '../render/frameRenderer';
import { fitFrame, type FrameLayout } from '../render/layout';
import { DropOverlay } from '../ui/DropOverlay';
import { HintPill } from '../ui/HintPill';
import { PrimaryButton } from '../ui/PrimaryButton';
import { ToastHost } from '../ui/Toast';
import { EmptyState } from './EmptyState';
import { useCanvasSize } from './useCanvasSize';
import { useGestures } from './useGestures';
import './CanvasArea.css';

const FRAME_FADE_MS = 200;
const ROTATE_FADE_MS = 250;

/** The framed photo: drag to pan, zoom, drop to replace, save. */
export function CanvasArea() {
  const area = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ghost = useRef<HTMLCanvasElement>(null);
  const areaSize = useCanvasSize(area);
  const stageSize = useCanvasSize(stage);
  const [dropActive, setDropActive] = useState(false);

  const { frame, caption, hintDismissed } = prefs.value;
  const currentOrientation = orientation.value;
  const current = photo.value;

  // Stage bounds relative to the canvas area; CSS decides the insets.
  const stageRect = stage.current && area.current ? relativeRect(stage.current, area.current) : null;
  const layout: FrameLayout | null = stageRect ? fitFrame(stageRect, FRAME_GEOMETRY[frame], currentOrientation) : null;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const windowRect = useCallback(() => layoutRef.current?.window ?? null, []);
  useGestures(area, windowRect);

  const windowWidth = layout?.window.width ?? 0;
  const windowHeight = layout?.window.height ?? 0;
  useLayoutEffect(() => {
    windowSize.value = { width: windowWidth, height: windowHeight };
    reclampView();
  }, [windowWidth, windowHeight]);

  // The frame layer only changes with the frame, size or caption, never while panning.
  const { width, height, dpr } = areaSize;
  const frameLayer = useMemo(() => {
    if (!layout || width <= 0 || height <= 0) return null;
    const layer = document.createElement('canvas');
    layer.width = Math.round(width * dpr);
    layer.height = Math.round(height * dpr);
    const ctx = layer.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrameLayer(ctx, layout, frame, caption);
    return layer;
    // Keyed on the values that change the layer; `layout` is derived from them.
  }, [width, height, dpr, stageSize, frame, currentOrientation, caption, fontsVersion.value]);

  // Crossfade frame and orientation changes, so the switch reads as one object changing.
  const shownKey = useRef<string | null>(null);
  const key = `${frame}/${currentOrientation}`;

  useLayoutEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx || !layout || !frameLayer) return;

    if (shownKey.current && shownKey.current !== key && !reducedMotion.value) {
      const rotated = shownKey.current.split('/')[0] === frame;
      fadeOut(element, ghost.current, rotated ? ROTATE_FADE_MS : FRAME_FADE_MS, rotated);
    }
    shownKey.current = key;

    element.width = frameLayer.width;
    element.height = frameLayer.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, element.width, element.height);
    ctx.drawImage(frameLayer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWindowContent(ctx, layout, current ? { image: current.bitmap, width: current.width, height: current.height, view: view.value } : null);
    drawWindowOverlay(ctx, layout, frame);
  }, [frameLayer, current, view.value]);

  const frameName = t(frameNameKey(frame));
  const label = t('canvas.label', { frame: frameName, caption: frenchSpacing(caption) || t('caption.placeholder') });
  const choosePhoto = async () => {
    const [file] = await platform().openImages({ multiple: false });
    if (file) await loadPhoto(file);
  };

  const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;

  return (
    <div
      class={`canvas-area${current ? ' has-photo' : ''}`}
      ref={area}
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        setDropActive(true);
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        if (!area.current?.contains(event.relatedTarget as Node | null)) setDropActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDropActive(false);
        const file = event.dataTransfer?.files[0];
        if (file) void loadPhoto(file);
      }}
    >
      <canvas ref={canvas} class="canvas-area__canvas" aria-hidden="true" />
      <canvas ref={ghost} class="canvas-area__ghost" aria-hidden="true" />
      <div ref={stage} class="canvas-area__stage" aria-hidden="true" />

      {layout && current && (
        <div
          class="canvas-area__window"
          role="img"
          tabIndex={0}
          aria-label={label}
          style={{
            left: `${layout.window.x}px`,
            top: `${layout.window.y}px`,
            width: `${layout.window.width}px`,
            height: `${layout.window.height}px`,
          }}
        />
      )}
      {layout && !current && <EmptyState rect={layout.window} onChoose={() => void choosePhoto()} />}

      {layout && current && !hintDismissed && (
        <div
          class="canvas-area__hint"
          style={{ left: `${layout.frame.x + layout.frame.width / 2}px`, top: `${layout.frame.y + layout.frame.height}px` }}
        >
          <HintPill text={t('hint.drag')} dismissLabel={t('hint.dismiss')} onDismiss={() => updatePrefs({ hintDismissed: true })} />
        </div>
      )}

      <PrimaryButton
        icon="download"
        class="canvas-area__save"
        disabled={!current}
        busy={saving.value}
        tooltip={`${t('save.label')} (${platform().modKeyLabel}${platform().modKeyLabel === 'Ctrl' ? '+' : ''}S)`}
        onClick={() => void savePhoto()}
      >
        {saving.value ? t('save.busy') : t('save.label')}
      </PrimaryButton>

      {dropActive && <DropOverlay label={t('canvas.dropReplace')} />}
      <ToastHost />
    </div>
  );
}

/** Copies the current pixels to the ghost canvas and fades it out over the new render. */
function fadeOut(element: HTMLCanvasElement, ghost: HTMLCanvasElement | null, duration: number, scale: boolean): void {
  if (!ghost || element.width === 0) return;
  ghost.width = element.width;
  ghost.height = element.height;
  ghost.getContext('2d')?.drawImage(element, 0, 0);
  const easing = 'cubic-bezier(.2,.8,.2,1)';
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing, fill: 'forwards' });
  element.animate(
    scale ? [{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'scale(1)' }] : [{ opacity: 0 }, { opacity: 1 }],
    { duration, easing },
  );
}

function relativeRect(element: HTMLElement, container: HTMLElement) {
  const a = element.getBoundingClientRect();
  const b = container.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, width: a.width, height: a.height };
}
