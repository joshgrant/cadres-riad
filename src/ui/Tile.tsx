import type { ComponentChildren } from 'preact';
import { Icon } from './Icon';
import { useTooltip } from './Tooltip';
import './Tile.css';

interface TileProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
  /** The 4:3 preview: a canvas, an image or a generated swatch. */
  children: ComponentChildren;
  /** Shows a × button on hover and focus (his own backgrounds only). */
  onDelete?: () => void;
  deleteLabel?: string;
}

/** A radio in a TileGrid. Arrow keys move focus within the grid; Enter or Space selects. */
export function Tile({ label, selected, onSelect, children, onDelete, deleteLabel }: TileProps) {
  return (
    <div class={`tile${selected ? ' tile--selected' : ''}`}>
      <div
        class="tile__button"
        role="radio"
        aria-checked={selected}
        tabIndex={-1}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
      >
        <div class="tile__preview">{children}</div>
        <span class="tile__label">{label}</span>
      </div>
      {onDelete && deleteLabel && <DeleteButton label={deleteLabel} onDelete={onDelete} />}
    </div>
  );
}

function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  const { trigger, tooltip } = useTooltip(label, { describe: false });
  return (
    <>
      <button type="button" class="tile__delete material" aria-label={label} onClick={onDelete} {...trigger}>
        <Icon name="close" />
      </button>
      {tooltip}
    </>
  );
}

/** Dashed “add” tile at the end of a grid. A plain button, outside the radio set. */
export function AddTile({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div class="tile tile--add">
      <button type="button" class="tile__button" onClick={onClick}>
        <div class="tile__preview">
          <Icon name="plus" />
        </div>
        <span class="tile__label">{label}</span>
      </button>
    </div>
  );
}
