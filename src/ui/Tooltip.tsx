import { createPortal } from 'preact';
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import './Tooltip.css';

const GAP = 8;
const EDGE = 8;

export interface TooltipTriggerProps {
  onPointerEnter: (event: PointerEvent) => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
  onFocus: (event: FocusEvent) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  'aria-describedby'?: string;
}

/**
 * Instant tooltip on hover and keyboard focus. Spread `trigger` on the target and
 * render `tooltip` anywhere. Pass `describe: false` when the text equals the
 * target's aria-label, so screen readers don't hear it twice.
 */
export function useTooltip(
  text: string,
  options: { describe?: boolean } = {},
): { trigger: TooltipTriggerProps; tooltip: JSX.Element } {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const describe = options.describe ?? true;

  const trigger: TooltipTriggerProps = {
    onPointerEnter: (event) => {
      if (event.pointerType !== 'touch') setAnchor(event.currentTarget as HTMLElement);
    },
    onPointerLeave: () => setAnchor(null),
    onPointerDown: () => setAnchor(null),
    onFocus: (event) => {
      const target = event.currentTarget as HTMLElement;
      if (target.matches(':focus-visible')) setAnchor(target);
    },
    onBlur: () => setAnchor(null),
    onKeyDown: (event) => {
      if (event.key === 'Escape') setAnchor(null);
    },
  };
  if (describe) trigger['aria-describedby'] = id;

  const tooltip = (
    <>
      {describe && (
        <span id={id} hidden>
          {text}
        </span>
      )}
      {anchor && createPortal(<Bubble anchor={anchor} text={text} />, document.body)}
    </>
  );
  return { trigger, tooltip };
}

function Bubble({ anchor, text }: { anchor: HTMLElement; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const bubble = ref.current;
    if (!bubble) return;
    const target = anchor.getBoundingClientRect();
    const { width, height } = bubble.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    let top = target.bottom + GAP;
    if (top + height > viewportHeight - EDGE) top = Math.max(EDGE, target.top - GAP - height);
    const centred = target.left + target.width / 2 - width / 2;
    const left = Math.min(Math.max(EDGE, centred), Math.max(EDGE, viewportWidth - width - EDGE));
    setPosition({ top, left });
  }, [anchor, text]);

  return (
    <div
      ref={ref}
      class="tooltip material"
      role="tooltip"
      aria-hidden="true"
      style={position ? { top: `${position.top}px`, left: `${position.left}px` } : { visibility: 'hidden' }}
    >
      {text}
    </div>
  );
}
