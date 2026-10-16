import './DropOverlay.css';

/** Dashed accent outline with a label, shown while files are dragged over a drop target. */
export function DropOverlay({ label, class: className }: { label: string; class?: string }) {
  return (
    <div class={className ? `drop-overlay ${className}` : 'drop-overlay'} aria-hidden="true">
      <p class="drop-overlay__label material">{label}</p>
    </div>
  );
}
