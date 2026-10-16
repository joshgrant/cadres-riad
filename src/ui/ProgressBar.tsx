import './ProgressBar.css';

/** Determinate (0–1) or indeterminate shimmer. Keeps animating under reduced motion, as a progress indicator. */
export function ProgressBar({ value }: { value: number | 'indeterminate' }) {
  const indeterminate = value === 'indeterminate';
  const percent = indeterminate ? undefined : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      class={`progress-bar${indeterminate ? ' progress-bar--indeterminate' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div class="progress-bar__fill" style={percent === undefined ? undefined : { width: `${percent}%` }} />
    </div>
  );
}
