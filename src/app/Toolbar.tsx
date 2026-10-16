import { ZOOM_STEP, ZOOM_STEP_LARGE, rotate, zoomBy } from './actions';
import { prefs } from './prefs';
import { savePhoto, saving } from './save';
import { downloadProgress, drawerOpen, isCompact, photo } from './store';
import { step } from './history';
import { updatePrefs } from './prefs';
import { FRAME_GEOMETRY } from '../frames/geometry';
import { t } from '../i18n/fr';
import { ControlDivider, ControlGroup } from '../ui/ControlGroup';
import { Icon } from '../ui/Icon';
import { IconButton, ToggleIconButton } from '../ui/IconButton';
import { useTooltip } from '../ui/Tooltip';
import './Toolbar.css';

/**
 * The window toolbar. On macOS it shares the title bar with the traffic lights;
 * on Windows it sits under the title bar as a command bar. Empty space drags the window.
 */
export function Toolbar() {
  const hasPhoto = photo.value !== null;
  const { cutout, frame } = prefs.value;
  const portraitOnly = FRAME_GEOMETRY[frame].portraitOnly ?? false;
  const drawerTip = useTooltip(t('drawer.open'), { describe: false });

  return (
    <header class="toolbar" data-tauri-drag-region>
      {isCompact.value && (
        <>
          <button
            type="button"
            class="toolbar__drawer-button"
            aria-label={t('drawer.open')}
            aria-expanded={drawerOpen.value}
            onClick={() => (drawerOpen.value = true)}
            {...drawerTip.trigger}
          >
            <Icon name="sidebar" />
            <span class="toolbar__drawer-label" aria-hidden="true">
              {t('drawer.open')}
            </span>
          </button>
          {drawerTip.tooltip}
        </>
      )}
      <div class="toolbar__spacer" data-tauri-drag-region />
      <ControlGroup label={t('ctrl.group')}>
        <ToggleIconButton
          icon="cutout"
          label={cutout ? t('ctrl.cutout.on') : t('ctrl.cutout.off')}
          pressed={cutout}
          disabled={!hasPhoto}
          {...(downloadProgress.value !== undefined ? { progress: downloadProgress.value } : {})}
          onClick={() => step(() => updatePrefs({ cutout: !cutout }))}
        />
        <ControlDivider />
        <IconButton icon="rotate" label={t('ctrl.rotate')} disabled={portraitOnly} onClick={rotate} />
        <IconButton
          icon="zoom-out"
          label={t('ctrl.zoomOut')}
          disabled={!hasPhoto}
          onClick={(event) => zoomBy(1 / (event.shiftKey ? ZOOM_STEP_LARGE : ZOOM_STEP))}
        />
        <IconButton
          icon="zoom-in"
          label={t('ctrl.zoomIn')}
          disabled={!hasPhoto}
          onClick={(event) => zoomBy(event.shiftKey ? ZOOM_STEP_LARGE : ZOOM_STEP)}
        />
      </ControlGroup>
      <IconButton
        icon="download"
        label={saving.value ? t('save.busy') : t('save.label')}
        class="toolbar__save"
        disabled={!hasPhoto || saving.value}
        onClick={() => void savePhoto()}
      />
    </header>
  );
}
