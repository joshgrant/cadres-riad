import { chooseBackground as applyBackground, chooseFrame as applyFrame } from '../app/actions';
import { prefs, updatePrefs, NEUTRAL_BACKGROUND_ID } from '../app/prefs';
import { fontsVersion } from '../app/store';
import { addBackgrounds, backgrounds, removeBackground } from '../app/backgrounds';
import { useState } from 'preact/hooks';
import { DropOverlay } from './DropOverlay';
import { FRAME_IDS, frameNameKey, type FrameId } from '../frames/ids';
import { t } from '../i18n/fr';
import { platform } from '../platform';
import { FRAME_GEOMETRY as GEOMETRY, effectiveOrientation } from '../frames/geometry';
import { drawNeutralBackdrop } from '../render/backdrop';
import { drawFrameLayer, drawWindowContent, drawWindowOverlay } from '../render/frameRenderer';
import { fitFrame } from '../render/layout';
import { SidebarSection } from './SidebarSection';
import { AddTile, Tile } from './Tile';
import { TileGrid } from './TileGrid';
import { Thumbnail } from './Thumbnail';
import './Sidebar.css';

/** Frame and background pickers. `onChosen` lets the drawer close after a choice. */
export function Sidebar({ onChosen }: { onChosen?: () => void }) {
  const { frame, backgroundId, cutout, collapsed } = prefs.value;

  const { caption } = prefs.value;
  const [dropActive, setDropActive] = useState(false);
  const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
  const backgroundName =
    backgroundId === NEUTRAL_BACKGROUND_ID
      ? t('bg.neutral')
      : (backgrounds.value.find((item) => item.id === backgroundId)?.name ?? t('bg.neutral'));
  const chooseFrame = (id: FrameId) => {
    applyFrame(id);
    onChosen?.();
  };
  const chooseBackground = (id: string) => {
    applyBackground(id);
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
              <Thumbnail draw={(ctx, w, h) => drawFrameThumb(ctx, w, h, id, caption)} deps={[id, id === 'polaroid' ? caption : '', fontsVersion.value]} />
            </Tile>
          ))}
        </TileGrid>
      </SidebarSection>

      <hr class="sidebar__separator" />

      <div
        class="sidebar__drop-zone"
        onDragEnter={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          event.stopPropagation();
          setDropActive(true);
          // A drop target that is collapsed opens up.
          if (collapsed.background) updatePrefs({ collapsed: { ...collapsed, background: false } });
        }}
        onDragOver={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onDragLeave={(event) => {
          if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) setDropActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDropActive(false);
          void addBackgrounds(Array.from(event.dataTransfer?.files ?? []));
        }}
      >
        <SidebarSection
          title={t('section.background')}
          value={backgroundName}
          collapsed={collapsed.background}
          onToggle={() => updatePrefs({ collapsed: { ...collapsed, background: !collapsed.background } })}
          class={cutout ? undefined : 'sidebar__backgrounds--dimmed'}
        >
          {!cutout && <p class="sidebar__note type-secondary">{t('bg.disabledNote')}</p>}
          <div class="sidebar__background-grid">
            <TileGrid
              label={t('section.background')}
              after={
                <AddTile
                  label={t('bg.add')}
                  onClick={() =>
                    void platform()
                      .openImages({ multiple: true })
                      .then((files) => {
                        if (files.length > 0) void addBackgrounds(files);
                      })
                  }
                />
              }
            >
              <Tile
                label={t('bg.neutral')}
                selected={backgroundId === NEUTRAL_BACKGROUND_ID}
                onSelect={() => chooseBackground(NEUTRAL_BACKGROUND_ID)}
              >
                <Thumbnail draw={(ctx, w, h) => drawNeutralBackdrop(ctx, 0, 0, w, h)} deps={[]} />
              </Tile>
              {backgrounds.value.map((background) => (
                <Tile
                  key={background.id}
                  label={background.name}
                  selected={backgroundId === background.id}
                  onSelect={() => chooseBackground(background.id)}
                  onDelete={() => void removeBackground(background.id)}
                  deleteLabel={t('bg.deleteLabel')}
                >
                  <img src={background.thumbUrl} alt="" draggable={false} />
                </Tile>
              ))}
            </TileGrid>
          </div>
        </SidebarSection>
        {dropActive && <DropOverlay label={t('bg.dropHere')} />}
      </div>
    </div>
  );
}

/** Tiles use the real renderer, landscape where the frame allows it, around the neutral backdrop. */
function drawFrameThumb(ctx: CanvasRenderingContext2D, width: number, height: number, id: FrameId, caption: string) {
  const pad = width * 0.1;
  const bounds = { x: pad, y: pad * 0.8, width: width - 2 * pad, height: height - 2 * pad };
  const layout = fitFrame(bounds, GEOMETRY[id], effectiveOrientation(id, 'landscape'));
  drawFrameLayer(ctx, layout, id, caption);
  drawWindowContent(ctx, layout, null);
  drawWindowOverlay(ctx, layout, id);
}
