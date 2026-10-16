import { t } from '../i18n/fr';
import { platform } from '../platform';
import { showToast, updateToast } from '../ui/toastStore';

/** Look again every six hours, for a window left open for days. */
const INTERVAL_MS = 6 * 60 * 60 * 1000;

let offered = false;

/**
 * Checks for a new version shortly after launch and then periodically. When
 * there is one, a toast offers “Mettre à jour”; nothing installs or restarts
 * until he clicks it.
 */
export function installUpdateCheck(): void {
  const check = async () => {
    if (offered) return;
    const update = await platform().checkForUpdate();
    if (!update) return;
    offered = true;
    showToast({
      body: t('update.available'),
      action: {
        label: t('update.action'),
        run: () => {
          // The toast stays while the update downloads, then the app restarts.
          setTimeout(() => {
            const busy = showToast({ body: t('update.installing'), progress: 'indeterminate' });
            update.install().catch(() => {
              updateToast(busy, { body: t('update.failed'), progress: undefined, tone: 'error', duration: 8000 });
              offered = false;
            });
          });
        },
      },
    });
  };
  setTimeout(() => void check(), 5000);
  setInterval(() => void check(), INTERVAL_MS);
}
