import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { IconButton } from './IconButton';
import './Drawer.css';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DrawerProps {
  open: boolean;
  label: string;
  closeLabel: string;
  onClose: () => void;
  /** Where focus goes on close when the opener wasn't focused (WebKit doesn't focus clicked buttons). */
  returnFocusTo?: () => HTMLElement | null;
  children: ComponentChildren;
}

/** Modal left drawer. Traps focus; closes on Escape or a click outside; gives focus back to the opener. */
export function Drawer({ open, label, closeLabel, onClose, returnFocusTo, children }: DrawerProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const active = document.activeElement as HTMLElement | null;
    const opener = active && active !== document.body ? active : (returnFocusTo?.() ?? null);
    const focusables = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    // Start on the first control after the close button, i.e. the content.
    (focusables()[1] ?? focusables()[0])?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      // Move focus ourselves: WebKit skips buttons on Tab by default, which would let focus escape.
      event.preventDefault();
      const items = focusables().filter((element) => element.offsetParent !== null);
      if (items.length === 0) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index + 1) % items.length;
      items[next]?.focus();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      opener?.focus();
    };
  }, [open, onClose, returnFocusTo]);

  if (!open) return null;
  return (
    <div class="drawer">
      <div class="drawer__scrim" onClick={onClose} />
      <div ref={panel} class="drawer__panel" role="dialog" aria-modal="true" aria-label={label}>
        <div class="drawer__header">
          <IconButton icon="close" label={closeLabel} onClick={onClose} />
        </div>
        <div class="drawer__content">{children}</div>
      </div>
    </div>
  );
}
