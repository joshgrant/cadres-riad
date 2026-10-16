import { render } from 'preact';
import { App } from './app/App';
import { persistPrefs } from './app/prefs';
import { initPlatform } from './platform';
import './styles/tokens.css';
import './styles/base.css';

await initPlatform();
persistPrefs();
render(<App />, document.getElementById('app')!);
