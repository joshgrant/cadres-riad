import type { Rect } from '../render/layout';
import { t } from '../i18n/fr';
import { Icon } from '../ui/Icon';
import './EmptyState.css';

/** Content-unavailable view, placed over the frame window. Scales down with the window. */
export function EmptyState({ rect, onChoose }: { rect: Rect; onChoose: () => void }) {
  return (
    <div
      class="empty-state"
      style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` }}
    >
      <div class="empty-state__content">
        <Icon name="photo-add" class="empty-state__glyph" />
        <h1 class="empty-state__title">{t('canvas.emptyTitle')}</h1>
        <p class="empty-state__body">{t('canvas.emptyBody')}</p>
        <button type="button" class="empty-state__button" onClick={onChoose}>
          {t('canvas.choose')}
        </button>
      </div>
    </div>
  );
}
