import { Icon, type IconName } from './Icon';
import { useTooltip } from './Tooltip';
import './IconButton.css';

interface IconButtonProps {
  icon: IconName;
  /** Accessible name; also the tooltip text unless `tooltip` is given. */
  label: string;
  tooltip?: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
  class?: string;
}

export function IconButton({ icon, label, tooltip, disabled, onClick, class: className }: IconButtonProps) {
  const text = tooltip ?? label;
  const { trigger, tooltip: tip } = useTooltip(text, { describe: text !== label });
  return (
    <>
      <button
        type="button"
        class={className ? `icon-button ${className}` : 'icon-button'}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        {...trigger}
      >
        <Icon name={icon} />
      </button>
      {tip}
    </>
  );
}

interface ToggleIconButtonProps extends IconButtonProps {
  pressed: boolean;
  /** 0–1 shows a determinate ring around the icon; undefined hides it. */
  progress?: number;
}

export function ToggleIconButton({
  icon,
  label,
  tooltip,
  disabled,
  onClick,
  pressed,
  progress,
  class: className,
}: ToggleIconButtonProps) {
  const text = tooltip ?? label;
  const { trigger, tooltip: tip } = useTooltip(text, { describe: text !== label });
  const circumference = 2 * Math.PI * 18;
  return (
    <>
      <button
        type="button"
        class={className ? `icon-button ${className}` : 'icon-button'}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
        {...trigger}
      >
        <Icon name={icon} />
        {progress !== undefined && (
          <svg class="icon-button__progress" viewBox="0 0 40 40" aria-hidden="true">
            <circle class="icon-button__progress-track" cx="20" cy="20" r="18" />
            <circle
              class="icon-button__progress-bar"
              cx="20"
              cy="20"
              r="18"
              stroke-dasharray={`${circumference * Math.min(1, Math.max(0, progress))} ${circumference}`}
            />
          </svg>
        )}
      </button>
      {tip}
    </>
  );
}
