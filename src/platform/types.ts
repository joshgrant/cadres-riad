/**
 * Everything that differs between the desktop app (Tauri) and the web build.
 * The rest of the app talks only to this interface.
 */
export interface Platform {
  kind: 'web' | 'desktop';
  os: 'mac' | 'windows' | 'other';
  /** macOS desktop: content runs under a transparent title bar, beside the traffic lights. */
  overlayTitleBar: boolean;
  /** Native material behind the window, shown through the sidebar. */
  windowMaterial(): Promise<WindowMaterial>;
  /** The system accent (tint) colour as #rrggbb, or null to keep the default blue. */
  systemAccent(): Promise<string | null>;
  /** Photos handed over by the system (dropped on the app icon, Ouvrir avec…). */
  onOpenedFile(listener: (file: File) => void): void;
  /** Modifier shown in tooltips: ⌘ on macOS, Ctrl elsewhere. */
  modKeyLabel: '⌘' | 'Ctrl';
  /** Model files for background removal; persistent, never evicted. */
  modelStore: ModelStore;
  /** Saves a finished JPEG. Resolves to false if he cancelled the dialog. */
  saveImage(image: Blob, suggestedName: string, dialogTitle: string): Promise<boolean>;
  /** Opens the system file picker for images. Resolves to [] if cancelled. */
  openImages(options: { multiple: boolean }): Promise<File[]>;
  /** Resolves to an update the user can install, or null. */
  checkForUpdate(): Promise<AvailableUpdate | null>;
}

export interface ModelStore {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, data: Uint8Array): Promise<void>;
}

export interface AvailableUpdate {
  version: string;
  install(): Promise<void>;
}

export type WindowMaterial = 'sidebar' | 'mica' | 'none';
