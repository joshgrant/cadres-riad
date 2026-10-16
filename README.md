# Cadres Riad

A French desktop app for macOS and Windows that puts a photo in a luxury, Moroccan-inspired frame, adds a caption and saves a JPEG ready to email. Everything runs on the computer: no server, no account.

Status: **milestone 1 (foundation)**. The editor shell, design system, French strings, preferences, platform adapter and installers are in place. Photo editing, the real frames, background removal and export arrive in later milestones.

## Installer l’application (pour l’utilisateur)

Téléchargez la dernière version depuis la page **Releases** du dépôt.

**Windows 10 ou 11**

1. Téléchargez le fichier `Cadres Riad_…_x64-setup.exe`.
2. Double-cliquez dessus. Windows affiche « Windows a protégé votre ordinateur » : cliquez sur **Informations complémentaires**, puis **Exécuter quand même**. Cet avertissement n’apparaît qu’une fois.
3. L’application s’ouvre depuis le menu Démarrer : **Cadres Riad**.

**macOS 13 ou plus récent**

1. Téléchargez le fichier `Cadres Riad_…_universal.dmg` et ouvrez-le.
2. Glissez **Cadres Riad** dans le dossier **Applications**.
3. La première fois seulement : dans Applications, faites un clic droit (ou Ctrl-clic) sur **Cadres Riad**, puis **Ouvrir**, puis **Ouvrir** à nouveau. Si macOS refuse encore, ouvrez **Réglages Système › Confidentialité et sécurité** et cliquez sur **Ouvrir quand même**.

Les avertissements viennent de ce que l’application n’est pas signée par un certificat payant ; ils ne réapparaissent pas ensuite.

## Development

Requirements: Node 22+, and for the desktop app, Rust stable (`rustup default stable`). On macOS also `rustup target add aarch64-apple-darwin x86_64-apple-darwin` for the universal build.

```bash
npm install
npm run dev            # browser, http://localhost:5173
npm run tauri dev      # desktop window, hot reload
```

Component stories, both themes: <http://localhost:5173/dev/components.html> (dev only, never shipped).

### Tests

```bash
npm run typecheck
npm test               # Vitest: layout math, French typography, preferences
npx playwright install chromium webkit firefox   # once
npm run test:e2e       # zoom matrix (100–300 %), light and dark, axe, keyboard, persistence
```

Playwright’s Chromium and WebKit stand in for WebView2 (Windows) and WKWebView (macOS).

### Building installers

- **Locally (macOS):** `npm run tauri build -- --target universal-apple-darwin` → `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`.
- **Both systems:** push a version tag. GitHub Actions builds the `.dmg` and the Windows `.exe` (NSIS) and `.msi` into a draft Release.

  ```bash
  git tag v0.1.0 && git push origin v0.1.0
  ```

  Bump `version` in `package.json` and `src-tauri/tauri.conf.json` together.

### Layout

```
src/
  app/          preferences, app state, App shell
  ui/           components (tokens only), icons
  canvas/       editor canvas area, empty state
  render/       layout math, placeholder frame, Neutre backdrop
  frames/       frame ids and geometry
  platform/     web/ and desktop/ implementations of one interface
  i18n/fr.ts    every UI string
  styles/       tokens.css, base.css
src-tauri/      Tauri 2 config, capabilities, icons
dev/            component stories (dev only)
tests/          Playwright
```

Everything platform-specific lives in `src/platform/`; the rest is identical on desktop and web.

## Licence

AGPL-3.0-or-later, because background removal uses `@imgly/background-removal` (AGPL-3.0). See [LICENSE](LICENSE).
