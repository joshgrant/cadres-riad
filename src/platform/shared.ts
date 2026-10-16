import { parseRgb, toHex } from '../app/accent';

export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

export function detectOs(): 'mac' | 'windows' | 'other' {
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac|iPhone|iPad/.test(navigator.platform || ua)) return 'mac';
  return 'other';
}

/** The system picker via a detached `<input type="file">`; works in browsers and both webviews. */
export function pickFiles(options: { multiple: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_IMAGE_TYPES;
    input.multiple = options.multiple;
    input.addEventListener('change', () => resolve(Array.from(input.files ?? [])), { once: true });
    input.addEventListener('cancel', () => resolve([]), { once: true });
    input.click();
  });
}

/** CSS `AccentColor`, where the browser exposes the system accent through it. */
export function cssAccentColor(): string | null {
  if (!CSS.supports('color', 'AccentColor')) return null;
  const probe = document.createElement('span');
  probe.style.color = 'AccentColor';
  document.body.append(probe);
  const rgb = parseRgb(getComputedStyle(probe).color);
  probe.remove();
  return rgb ? toHex(rgb) : null;
}
