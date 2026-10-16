import { ProgressBar } from './ProgressBar';
import './ProgressOverlay.css';

/** Translucent veil over the photo while a cut-out runs. */
export function ProgressOverlay({ message, progress = 'indeterminate' }: { message: string; progress?: number | 'indeterminate' }) {
  return (
    <div class="progress-overlay">
      <div class="progress-overlay__panel material">
        <p class="progress-overlay__message">{message}</p>
        <ProgressBar value={progress} />
      </div>
    </div>
  );
}
