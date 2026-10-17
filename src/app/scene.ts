import type { WindowPhoto } from '../render/frameRenderer';
import { prefs } from './prefs';
import { cutout, logoImage, view, type Photo } from './store';

/** What the window shows: the photo, or with détourage the background and the people; then the logo. */
export function windowPhoto(
  current: Photo | null,
  active: boolean,
  background: ImageBitmap | null,
): WindowPhoto | null {
  if (!current) return null;
  const people = active ? cutout.value : null;
  const logo = logoImage.value;
  return {
    image: current.bitmap,
    width: current.width,
    height: current.height,
    view: view.value,
    cutout: people
      ? { image: people.bitmap, background, ...(background ? { backgroundSize: { width: background.width, height: background.height } } : {}) }
      : null,
    logo: logo ? { image: logo, aspect: logo.width / logo.height, placement: prefs.value.logo } : null,
  };
}

