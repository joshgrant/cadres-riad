import type { ComponentChildren } from 'preact';
import { Icon, type IconName } from './Icon';
import { useTooltip } from './Tooltip';
import './PrimaryButton.css';

interface PrimaryButtonProps {
  icon?: IconName;
  children: ComponentChildren;
  /** Shows a spinner; the label should change to the busy text. */
  busy?: boolean;
  disabled?: boolean;
  /** Optional extra hint (e.g. the keyboard shortcut), shown as a tooltip and description. */
  tooltip?: string;
  onClick?: () => void;
  class?: string;
}

export function PrimaryButton({ icon, children, busy, disabled, tooltip, onClick, class: className }: PrimaryButtonProps) {
  const { trigger, tooltip: tip } = useTooltip(tooltip ?? '');
  return (
    <>
      <button
        type="button"
        class={className ? `primary-button ${className}` : 'primary-button'}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        onClick={onClick}
        {...(tooltip ? trigger : {})}
      >
        {busy ? <span class="primary-button__spinner" aria-hidden="true" /> : icon && <Icon name={icon} />}
        <span>{children}</span>
      </button>
      {tooltip && tip}
    </>
  );
}
