import { drawerOpen, isCompact } from './store';
import { t } from '../i18n/fr';
import { CanvasArea } from '../canvas/CanvasArea';
import { Drawer } from '../ui/Drawer';
import { Sidebar } from '../ui/Sidebar';
import './App.css';

const closeDrawer = () => (drawerOpen.value = false);
const drawerButton = () => document.querySelector<HTMLElement>('.canvas-area__drawer-button');

export function App() {
  const compact = isCompact.value;
  return (
    <div class="app">
      {!compact && (
        <aside class="app__sidebar" aria-label={t('drawer.open')}>
          <Sidebar />
        </aside>
      )}
      <CanvasArea />
      <Drawer open={compact && drawerOpen.value} label={t('drawer.open')} closeLabel={t('drawer.close')} onClose={closeDrawer} returnFocusTo={drawerButton}>
        <Sidebar onChosen={closeDrawer} />
      </Drawer>
    </div>
  );
}
