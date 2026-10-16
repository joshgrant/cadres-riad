/**
 * Dev-only component stories, each in both themes. Open /dev/components.html
 * with `npm run dev`. Not part of the production build.
 */
import { render, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { initPlatform } from '../src/platform';
import { t } from '../src/i18n/fr';
import { drawNeutralBackdrop } from '../src/render/backdrop';
import { ControlDivider, ControlGroup } from '../src/ui/ControlGroup';
import { DropOverlay } from '../src/ui/DropOverlay';
import { Drawer } from '../src/ui/Drawer';
import { HintPill } from '../src/ui/HintPill';
import { IconButton, ToggleIconButton } from '../src/ui/IconButton';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { ProgressOverlay } from '../src/ui/ProgressOverlay';
import { SidebarSection } from '../src/ui/SidebarSection';
import { Thumbnail } from '../src/ui/Thumbnail';
import { AddTile, Tile } from '../src/ui/Tile';
import { TileGrid } from '../src/ui/TileGrid';
import { Toast } from '../src/ui/Toast';
import '../src/styles/tokens.css';
import '../src/styles/base.css';
import './components.css';

function Story({ name, children }: { name: string; children: ComponentChildren }) {
  return (
    <section class="story">
      <h2 class="story__name type-secondary">{name}</h2>
      <div class="story__body">{children}</div>
    </section>
  );
}

const neutral = (ctx: CanvasRenderingContext2D, w: number, h: number) => drawNeutralBackdrop(ctx, 0, 0, w, h);

function Stories({ theme }: { theme: 'light' | 'dark' }) {
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState('a');
  const [pressed, setPressed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [hint, setHint] = useState(true);

  return (
    <div class="theme-column" data-theme={theme}>
      <h1 class="type-title">{theme === 'light' ? 'Clair' : 'Sombre'}</h1>

      <Story name="IconButton, ToggleIconButton, ControlGroup">
        <ControlGroup label={t('ctrl.group')}>
          <ToggleIconButton icon="cutout" label={t('ctrl.cutout.off')} pressed={pressed} onClick={() => setPressed(!pressed)} />
          <ControlDivider />
          <IconButton icon="rotate" label={t('ctrl.rotate')} />
          <IconButton icon="zoom-out" label={t('ctrl.zoomOut')} />
          <IconButton icon="zoom-in" label={t('ctrl.zoomIn')} disabled />
        </ControlGroup>
        <ControlGroup label="Téléchargement">
          <ToggleIconButton icon="cutout" label={t('ctrl.cutout.on')} pressed progress={0.42} />
        </ControlGroup>
      </Story>

      <Story name="PrimaryButton">
        <div class="row">
          <PrimaryButton icon="download">{t('save.label')}</PrimaryButton>
          <PrimaryButton busy>{t('save.busy')}</PrimaryButton>
          <PrimaryButton icon="download" disabled>
            {t('save.label')}
          </PrimaryButton>
        </div>
      </Story>

      <Story name="HintPill">
        {hint ? (
          <HintPill text={t('hint.drag')} dismissLabel={t('hint.dismiss')} onDismiss={() => setHint(false)} />
        ) : (
          <button type="button" onClick={() => setHint(true)}>
            Réafficher
          </button>
        )}
      </Story>

      <Story name="SidebarSection, Tile, AddTile, TileGrid">
        <div class="sidebar-sample">
          <SidebarSection title={t('section.background')} value={t('bg.neutral')} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}>
            <TileGrid label={t('section.background')} after={<AddTile label={t('bg.add')} onClick={() => {}} />}>
              <Tile label={t('bg.neutral')} selected={selected === 'a'} onSelect={() => setSelected('a')}>
                <Thumbnail draw={neutral} deps={[]} />
              </Tile>
              <Tile
                label="Plage"
                selected={selected === 'b'}
                onSelect={() => setSelected('b')}
                onDelete={() => {}}
                deleteLabel={t('bg.deleteLabel')}
              >
                <div class="swatch" />
              </Tile>
            </TileGrid>
          </SidebarSection>
        </div>
      </Story>

      <Story name="Toast">
        <div class="stack">
          <Toast toast={{ body: t('bg.deleted'), action: { label: t('common.undo'), run: () => {} } }} />
          <Toast
            toast={{
              title: t('download.title'),
              body: t('download.body', { total: 80 }),
              progress: 0.52,
              status: t('download.progress', { done: 42, total: 80, eta: t('eta.oneMinute') }),
              action: { label: t('common.cancel'), run: () => {} },
            }}
          />
          <Toast toast={{ body: t('error.format'), tone: 'error' }} />
        </div>
      </Story>

      <Story name="ProgressOverlay">
        <div class="frame-sample">
          <ProgressOverlay message={t('cutout.running')} />
        </div>
      </Story>

      <Story name="DropOverlay">
        <div class="frame-sample">
          <DropOverlay label={t('canvas.dropReplace')} />
        </div>
      </Story>

      <Story name="Drawer">
        <button type="button" class="dev-button" onClick={() => setDrawer(true)}>
          {t('drawer.open')}
        </button>
        <Drawer open={drawer} label={t('drawer.open')} closeLabel={t('drawer.close')} onClose={() => setDrawer(false)}>
          <p style={{ padding: 'var(--space-5)' }}>{t('bg.disabledNote')}</p>
        </Drawer>
      </Story>
    </div>
  );
}

await initPlatform();
render(
  <div class="columns">
    <Stories theme="light" />
    <Stories theme="dark" />
  </div>,
  document.getElementById('app')!,
);
