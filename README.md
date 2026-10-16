# Cadres Riad

A French desktop app for macOS and Windows that puts a photo in a luxury, Moroccan-inspired frame, adds a caption and saves a JPEG ready to email. Everything runs on the computer: no server, no account.

Status: **feature-complete for v1, in review**. Seven frames rendered per pixel with WebGL (engraved-brass Doré, carved walnut Noyer, weathered Bois brut, light oak, black-stained oak, tadelakt white, and a paper Polaroid), captions edited in place on the frame (engraved, burned, gilded or handwritten), background removal on the device with a library of his own backgrounds, undo/redo, and a 2400px JPEG export.

Background removal uses `@imgly/background-removal` 1.7.0. The model (about 56–111 MB depending on whether WebGPU is available) downloads once from imgly's CDN the first time détourage is used, then lives in the app data folder (desktop) or Cache Storage (web) and works offline.

On macOS the toolbar shares the title bar and the sidebar uses the system's translucent sidebar material; on Windows 11 the window uses Mica with a command bar under the title bar (Windows 10 stays opaque). Buttons and selection follow the system accent colour, adjusted where needed to keep text readable.

Reference photos for frame reviews live in `assets/frames/` locally and are git-ignored: they come from the web and must not be published.

## Installer l’application (pour l’utilisateur)

Téléchargez la dernière version depuis la page **Releases** du dépôt.

**Raccourcis** : glisser pour déplacer la photo ; molette ou pincement pour zoomer ; flèches pour déplacer (Maj : plus loin) ; + et − pour zoomer ; 0 pour recadrer ; Ctrl+Z / Ctrl+Maj+Z (⌘ sur Mac) pour annuler et rétablir ; Ctrl+S (⌘S) pour enregistrer. On peut aussi déposer une photo sur l’icône de l’application.

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
