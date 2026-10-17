import { chooseBackground as applyBackground, chooseFrame as applyFrame, chooseLogo as applyLogo } from '../app/actions';
import { prefs, updatePrefs, NEUTRAL_BACKGROUND_ID, NO_LOGO_ID } from '../app/prefs';
import { fontsVersion } from '../app/store';
import { addBackgrounds, backgrounds, removeBackground } from '../app/backgrounds';
import { BUILT_IN_LOGOS, addLogos, logoName, logos, removeLogo } from '../app/logos';
import type { ComponentChildren } from 'preact';
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

/** Frame, background and logo pickers. `onChosen` lets the drawer close after a choice. */
export function Sidebar({ onChosen }: { onChosen?: () => void }) {
  const { frame, backgroundId, cutout, collapsed, logoId } = prefs.value;

  const { caption } = prefs.value;
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
  const chooseLogo = (id: string) => {
    applyLogo(id);
    onChosen?.();
  };
  const pickFiles = (add: (files: File[]) => Promise<void>) =>
    void platform()
      .openImages({ multiple: true })
      .then((files) => {
        if (files.length > 0) void add(files);
      });

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

      <FileDropZone
        label={t('bg.dropHere')}
        onEnter={() => {
          // A drop target that is collapsed opens up.
          if (collapsed.background) updatePrefs({ collapsed: { ...collapsed, background: false } });
        }}
        onFiles={(files) => void addBackgrounds(files)}
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
                <AddTile label={t('bg.add')} onClick={() => pickFiles(addBackgrounds)} />
              }
            >
              <Tile
                label={t('bg.neutral')}
                selected={backgroundId === NEUTRAL_BACKGROUND_ID}
                onSelect={() => chooseBackground(NEUTRAL_BACKGROUND_ID)}
              >
                <Thumbnail draw={(ctx, w, h) => drawNeutralBackdrop(ctx, 0, 0, w, h)} deps={['neutral']} />
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
      </FileDropZone>

      <hr class="sidebar__separator" />

      <FileDropZone
        label={t('logo.dropHere')}
        onEnter={() => {
          if (collapsed.logo) updatePrefs({ collapsed: { ...collapsed, logo: false } });
        }}
        onFiles={(files) => void addLogos(files)}
      >
        <SidebarSection
          title={t('section.logo')}
          value={logoName(logoId)}
          collapsed={collapsed.logo}
          onToggle={() => updatePrefs({ collapsed: { ...collapsed, logo: !collapsed.logo } })}
        >
          <div class="sidebar__logo-grid">
            <TileGrid label={t('section.logo')} after={<AddTile label={t('logo.add')} onClick={() => pickFiles(addLogos)} />}>
              <Tile label={t('logo.none')} selected={logoId === NO_LOGO_ID} onSelect={() => chooseLogo(NO_LOGO_ID)}>
                <span />
              </Tile>
              {BUILT_IN_LOGOS.map((logo) => (
                <Tile key={logo.id} label={t(logo.nameKey)} selected={logoId === logo.id} onSelect={() => chooseLogo(logo.id)}>
                  <img src={logo.url} alt="" draggable={false} />
                </Tile>
              ))}
              {logos.value.map((logo) => (
                <Tile
                  key={logo.id}
                  label={logo.name}
                  selected={logoId === logo.id}
                  onSelect={() => chooseLogo(logo.id)}
                  onDelete={() => void removeLogo(logo.id)}
                  deleteLabel={t('logo.deleteLabel')}
                >
                  <img src={logo.thumbUrl} alt="" draggable={false} />
                </Tile>
              ))}
            </TileGrid>
          </div>
        </SidebarSection>
      </FileDropZone>
    </div>
  );
}

interface FileDropZoneProps {
  label: string;
  /** Files are being dragged over the zone. */
  onEnter: () => void;
  onFiles: (files: File[]) => void;
  children: ComponentChildren;
}

/** A sidebar section that takes dropped image files, with its own overlay. */
function FileDropZone({ label, onEnter, onFiles, children }: FileDropZoneProps) {
  const [active, setActive] = useState(false);
  const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
  return (
    <div
      class="sidebar__drop-zone"
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setActive(true);
        onEnter();
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onDragLeave={(event) => {
        if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) setActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setActive(false);
        onFiles(Array.from(event.dataTransfer?.files ?? []));
      }}
    >
      {children}
      {active && <DropOverlay label={label} />}
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
