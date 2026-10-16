import { drawerOpen, isCompact } from './store';
import { t } from '../i18n/fr';
import { CanvasArea } from '../canvas/CanvasArea';
import { Drawer } from '../ui/Drawer';
import { Sidebar } from '../ui/Sidebar';
import { Toolbar } from './Toolbar';
import './App.css';

const closeDrawer = () => (drawerOpen.value = false);
const drawerButton = () => document.querySelector<HTMLElement>('.toolbar__drawer-button');

export function App() {
  const compact = isCompact.value;
  return (
    <div class={`app${compact ? ' app--compact' : ''}`}>
      {!compact && (
        <aside class="app__sidebar" aria-label={t('drawer.open')}>
          <div class="app__titlebar-space" data-tauri-drag-region />
          <Sidebar />
        </aside>
      )}
      <main class="editor">
        <Toolbar />
        <CanvasArea />
      </main>
      <Drawer open={compact && drawerOpen.value} label={t('drawer.open')} closeLabel={t('drawer.close')} onClose={closeDrawer} returnFocusTo={drawerButton}>
        <Sidebar onChosen={closeDrawer} />
      </Drawer>
    </div>
  );
}
