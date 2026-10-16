import { prefs, updatePrefs, NEUTRAL_BACKGROUND_ID } from '../app/prefs';
import { FRAME_GEOMETRY } from '../frames/geometry';
import { FRAME_IDS, frameNameKey, type FrameId } from '../frames/ids';
import { t } from '../i18n/fr';
import { platform } from '../platform';
import { drawNeutralBackdrop } from '../render/backdrop';
import { fitFrame } from '../render/layout';
import { drawPlaceholderFrame, drawWindowShadow } from '../render/placeholderFrame';
import { SidebarSection } from './SidebarSection';
import { AddTile, Tile } from './Tile';
import { TileGrid } from './TileGrid';
import { Thumbnail } from './Thumbnail';
import './Sidebar.css';

/** Frame and background pickers. `onChosen` lets the drawer close after a choice. */
export function Sidebar({ onChosen }: { onChosen?: () => void }) {
  const { frame, backgroundId, cutout, collapsed } = prefs.value;

  const chooseFrame = (id: FrameId) => {
    updatePrefs({ frame: id });
    onChosen?.();
  };
  // Choosing a background has only one meaning, so it also turns détourage on.
  const chooseBackground = (id: string) => {
    updatePrefs({ backgroundId: id, cutout: true });
    onChosen?.();
  };

  return (
    <div class="sidebar">
      <SidebarSection
        title={t('section.frame')}
        value={t(frameNameKey(frame))}
        collapsed={collapsed.frame}
        onToggle={() => updatePrefs({ collapsed: { ...collapsed, frame: !collapsed.frame } })}
      >
        <TileGrid label={t('section.frame')}>
          {FRAME_IDS.map((id) => (
            <Tile key={id} label={t(frameNameKey(id))} selected={id === frame} onSelect={() => chooseFrame(id)}>
              <Thumbnail draw={(ctx, w, h) => drawFrameThumb(ctx, w, h, id)} deps={[id]} />
            </Tile>
          ))}
        </TileGrid>
      </SidebarSection>

      <hr class="sidebar__separator" />

      <SidebarSection
        title={t('section.background')}
        value={t('bg.neutral')}
        collapsed={collapsed.background}
        onToggle={() => updatePrefs({ collapsed: { ...collapsed, background: !collapsed.background } })}
        class={cutout ? undefined : 'sidebar__backgrounds--dimmed'}
      >
        {!cutout && <p class="sidebar__note type-secondary">{t('bg.disabledNote')}</p>}
        <div class="sidebar__background-grid">
          <TileGrid
            label={t('section.background')}
            after={<AddTile label={t('bg.add')} onClick={() => void platform().openImages({ multiple: true })} />}
          >
            <Tile
              label={t('bg.neutral')}
              selected={backgroundId === NEUTRAL_BACKGROUND_ID}
              onSelect={() => chooseBackground(NEUTRAL_BACKGROUND_ID)}
            >
              <Thumbnail draw={(ctx, w, h) => drawNeutralBackdrop(ctx, 0, 0, w, h)} deps={[]} />
            </Tile>
          </TileGrid>
        </div>
      </SidebarSection>
    </div>
  );
}

function drawFrameThumb(ctx: CanvasRenderingContext2D, width: number, height: number, id: FrameId) {
  const pad = width * 0.1;
  const layout = fitFrame({ x: pad, y: pad * 0.8, width: width - 2 * pad, height: height - 2 * pad }, FRAME_GEOMETRY[id], 'landscape');
  drawPlaceholderFrame(ctx, layout, id, { wallShadow: true });
  const { window: inner } = layout;
  drawNeutralBackdrop(ctx, inner.x, inner.y, inner.width, inner.height);
  drawWindowShadow(ctx, layout, id);
}
