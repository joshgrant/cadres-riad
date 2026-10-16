import { signal } from '@preact/signals';
import { t } from '../i18n/fr';
import { platform } from '../platform';
import { exportFileName, renderExport } from '../render/export';
import { announce, showToast } from '../ui/toastStore';
import { prefs } from './prefs';
import { backgroundImage, cutoutActive, cutoutStatus, orientation, photo } from './store';
import { windowPhoto } from './scene';

export const saving = signal(false);

/** “Enregistrer”: renders the 2400px PNG and hands it to the platform's save. */
export async function savePhoto(): Promise<void> {
  const current = photo.value;
  if (!current || saving.value) return;
  saving.value = true;
  announce(t('save.busy'));
  try {
    // Wait for a cut-out that is still on its way.
    while (cutoutStatus.value !== 'idle' && prefs.value.cutout) await new Promise((resolve) => setTimeout(resolve, 200));
    const { frame, caption } = prefs.value;
    const blob = await renderExport({
      frame,
      orientation: orientation.value,
      caption,
      photo: windowPhoto(current, cutoutActive.value, backgroundImage.value)!,
    });
    const saved = await platform().saveImage(blob, exportFileName(caption), t('save.dialogTitle'));
    if (saved) showToast({ body: t('save.done'), duration: 4000 });
  } catch {
    showToast({ body: t('error.save'), tone: 'error', duration: 6000 });
  } finally {
    saving.value = false;
  }
}
