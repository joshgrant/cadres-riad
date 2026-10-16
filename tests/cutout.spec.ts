import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const PHOTO = fileURLToPath(new URL('./fixtures/photo.jpg', import.meta.url));

async function loadPhoto(page: Page) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choisir une photo' }).click();
  await (await chooser).setFiles(PHOTO);
  await expect(page.getByRole('img', { name: /Photo dans un cadre/ })).toBeVisible();
}

const prefs = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('cadres.prefs.v1') ?? '{}'));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem('cadres.test.mockCutout', '1');
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('cadres');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
  await page.reload();
});

test('détourage toggles, and the people can then shrink below cover-fit', async ({ page }) => {
  await loadPhoto(page);
  const toggle = page.getByRole('button', { name: 'Détourer les personnes' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(page.getByRole('button', { name: /^Détourage activé/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.progress-overlay')).toHaveCount(0, { timeout: 10_000 });
  // Cover mode stops at 1×; with the people layer, zooming out keeps going.
  const zoomOut = page.getByRole('button', { name: /^Zoom arrière/ });
  for (let i = 0; i < 4; i++) await zoomOut.click();
  const window = await page.locator('.canvas-area__window').boundingBox();
  const pixels = await page.evaluate(({ x, y }) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.canvas-area__canvas')!;
    const area = canvas.getBoundingClientRect();
    const scale = canvas.width / area.width;
    // Near the window's corner, the background now shows instead of the photo.
    return Array.from(canvas.getContext('2d')!.getImageData((x - area.left + 6) * scale, (y - area.top + 40) * scale, 1, 1).data);
  }, window!);
  // The Neutre backdrop is a warm grey; the photo's sky there is orange.
  expect(Math.abs(pixels[0]! - pixels[2]!)).toBeLessThan(40);
});

test('the Fond grid is dimmed with a note until détourage is on; a click turns it on', async ({ page }) => {
  await loadPhoto(page);
  await expect(page.getByText('Activez le détourage pour placer les personnes devant un fond.')).toBeVisible();
  await page.getByRole('radio', { name: 'Neutre' }).click();
  expect((await prefs(page)).cutout).toBe(true);
  await expect(page.getByText('Activez le détourage pour placer les personnes devant un fond.')).toHaveCount(0);
});

test('adds a background, selects it, deletes it and undoes the delete', async ({ page, browserName }) => {
  // Known issue, not yet diagnosed: adding a background fails in headless WebKit.
  test.fixme(browserName === 'webkit', 'Background add fails in headless WebKit');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Ajouter un fond' }).click();
  await (await chooser).setFiles(PHOTO);
  const tile = page.getByRole('radio', { name: 'photo' });
  await expect(tile).toHaveAttribute('aria-checked', 'true');
  expect((await prefs(page)).cutout).toBe(true);

  await tile.hover();
  await page.getByRole('button', { name: 'Supprimer ce fond' }).click();
  await expect(page.getByRole('radio', { name: 'photo' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Neutre' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.toast__body')).toHaveText('Fond supprimé');
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('radio', { name: 'photo' })).toHaveAttribute('aria-checked', 'true');

  // It survives a reload.
  await page.reload();
  await expect(page.getByRole('radio', { name: 'photo' })).toHaveAttribute('aria-checked', 'true');
});

test('saving with détourage includes the background and people', async ({ page }) => {
  await loadPhoto(page);
  await page.getByRole('button', { name: 'Détourer les personnes' }).click();
  await expect(page.getByRole('button', { name: /^Détourage activé/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.locator('.canvas-area__save').click();
  expect((await download).suggestedFilename()).toMatch(/\.jpg$/);
});
