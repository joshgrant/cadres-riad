import { render } from 'preact';
import { App } from './app/App';
import { applyAccent } from './app/accent';
import { loadPhoto } from './app/actions';
import { persistPrefs } from './app/prefs';
import { installShortcuts } from './app/shortcuts';
import { installBackgrounds } from './app/backgrounds';
import { installCutout } from './segmentation/cutout';
import { installUpdateCheck } from './app/updates';
import { fontsVersion } from './app/store';
import { initPlatform } from './platform';
import '@fontsource/caveat/latin-500.css';
import '@fontsource/caveat/latin-ext-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-ext-600.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '@fontsource/cormorant-garamond/latin-ext-700.css';
import './styles/tokens.css';
import './styles/base.css';

const platform = await initPlatform();

// Platform hooks for CSS: native title bar, window material, flat Windows controls.
const root = document.documentElement;
root.dataset.os = platform.os;
root.dataset.shell = platform.kind;
if (platform.overlayTitleBar) root.dataset.titlebar = 'overlay';
root.dataset.material = await platform.windowMaterial();

// Follow the system accent colour; it may change while the app is in the background.
const refreshAccent = async () => applyAccent(await platform.systemAccent());
await refreshAccent();
window.addEventListener('focus', () => void refreshAccent());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => void refreshAccent());

// Dropping a file outside a drop target must never navigate the window away.
for (const type of ['dragover', 'drop'] as const) {
  window.addEventListener(type, (event) => event.preventDefault());
}

persistPrefs();
installShortcuts();
installBackgrounds();
installCutout();
installUpdateCheck();
platform.onOpenedFile((file) => void loadPhoto(file));

// Canvas text needs the frame fonts loaded first; redraw once they are.
void Promise.all([
  document.fonts.load('500 32px Caveat', 'Riad œ Ā'),
  document.fonts.load("600 32px 'Cormorant Garamond'", 'Riad œ Ā'),
  document.fonts.load("700 32px 'Cormorant Garamond'", 'Riad œ Ā'),
]).then(() => fontsVersion.value++);

render(<App />, document.getElementById('app')!);
