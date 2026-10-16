import { useState } from 'preact/hooks';
import { Icon } from './Icon';
import { useTooltip } from './Tooltip';
import './HintPill.css';

/** Dismissable hint. Clicking fades it out, then calls onDismiss. */
export function HintPill({ text, dismissLabel, onDismiss, class: className }: { text: string; dismissLabel: string; onDismiss: () => void; class?: string }) {
  const [leaving, setLeaving] = useState(false);
  const { trigger, tooltip } = useTooltip(dismissLabel);
  return (
    <>
      <button
        type="button"
        class={`hint-pill material${leaving ? ' hint-pill--leaving' : ''}${className ? ` ${className}` : ''}`}
        onClick={() => setLeaving(true)}
        onTransitionEnd={() => leaving && onDismiss()}
        {...trigger}
      >
        <Icon name="hand" />
        <span>{text}</span>
      </button>
      {tooltip}
    </>
  );
}
