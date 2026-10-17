import { useEffect, useRef } from 'preact/hooks';
import { capture, commit, step } from '../app/history';
import { prefs, updatePrefs } from '../app/prefs';
import { logoImage, logoSelected } from '../app/store';
import { t } from '../i18n/fr';
import type { FrameLayout } from '../render/layout';
import { clampLogo, logoRect, moveLogo, resizeLogo, scaleLogo, type Corner, type LogoPlacement } from '../render/logo';
import './LogoEditor.css';

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];

interface Drag {
  pointerId: number;
  x: number;
  y: number;
  start: LogoPlacement;
  corner: Corner | null;
  before: ReturnType<typeof capture>;
}

/**
 * The logo's hit area over the canvas. Pressing it selects it and drags it
 * (the photo doesn't pan); once selected, corner handles resize it with its
 * aspect kept. A press anywhere else, or Escape, deselects. Each drag is one undo step.
 */
export function LogoEditor({ layout }: { layout: FrameLayout }) {
  const element = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const image = logoImage.value;
  const selected = logoSelected.value;

  useEffect(() => {
    if (!selected) return;
    const onPress = (event: PointerEvent) => {
      if (!element.current?.contains(event.target as Node)) logoSelected.value = false;
    };
    document.addEventListener('pointerdown', onPress, true);
    return () => document.removeEventListener('pointerdown', onPress, true);
  }, [selected]);

  if (!image) return null;
  const aspect = image.width / image.height;
  const inner = layout.window;
  const rect = logoRect(prefs.value.logo, inner, aspect);

  const begin = (event: PointerEvent, corner: Corner | null) => {
    if (event.button !== 0 || drag.current) return;
    event.preventDefault();
    event.stopPropagation();
    element.current?.setPointerCapture(event.pointerId);
    element.current?.focus({ preventScroll: true });
    logoSelected.value = true;
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: clampLogo(prefs.value.logo, inner, aspect),
      corner,
      before: capture(),
    };
  };

  const move = (event: PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    updatePrefs({
      logo: current.corner
        ? resizeLogo(current.start, current.corner, dx, dy, inner, aspect)
        : moveLogo(current.start, dx, dy, inner, aspect),
    });
  };

  const end = (event: PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    commit(current.before);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = arrows[event.key];
    const placement = prefs.value.logo;
    if (direction) {
      const amount = inner.width * (event.shiftKey ? 0.1 : 0.01);
      step(() => updatePrefs({ logo: moveLogo(placement, direction[0] * amount, direction[1] * amount, inner, aspect) }));
    } else if (event.key === '+' || event.key === '=') {
      step(() => updatePrefs({ logo: scaleLogo(placement, 1.1, inner, aspect) }));
    } else if (event.key === '-' || event.key === '_') {
      step(() => updatePrefs({ logo: scaleLogo(placement, 1 / 1.1, inner, aspect) }));
    } else if (event.key === 'Escape' && logoSelected.value) {
      logoSelected.value = false;
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <div
      ref={element}
      class={`logo-editor${selected ? ' is-selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={t('logo.aria')}
      aria-pressed={selected}
      data-no-pan
      style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` }}
      onPointerDown={(event) => begin(event, null)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={onKeyDown}
    >
      {selected &&
        CORNERS.map((corner) => (
          <span
            key={corner}
            class={`logo-editor__handle logo-editor__handle--${corner}`}
            aria-hidden="true"
            onPointerDown={(event) => begin(event, corner)}
          />
        ))}
    </div>
  );
}
