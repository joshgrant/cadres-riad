import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PHOTO = fileURLToPath(new URL('./fixtures/photo.jpg', import.meta.url));

async function loadPhoto(page: Page) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choisir une photo' }).click();
  await (await chooser).setFiles(PHOTO);
  await expect(page.getByRole('img', { name: /Photo dans un cadre/ })).toBeVisible();
}

const logo = (page: Page) => page.locator('.logo-editor');

/** The stored placement, as fractions of the window. */
const placement = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cadres.prefs.v1') ?? '{}').logo as { x: number; y: number; width: number });

/** A fingerprint of what the frame window shows: a 16×16 grid of sampled pixels. */
async function windowPixels(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.canvas-area__canvas')!;
    const box = document.querySelector('.canvas-area__window')!.getBoundingClientRect();
    const area = canvas.getBoundingClientRect();
    const scale = canvas.width / area.width;
    const ctx = canvas.getContext('2d')!;
    const samples: number[] = [];
    for (let i = 1; i < 16; i++) {
      for (let j = 1; j < 16; j++) {
        const x = Math.round((box.left - area.left + (box.width * i) / 16) * scale);
        const y = Math.round((box.top - area.top + (box.height * j) / 16) * scale);
        samples.push(...ctx.getImageData(x, y, 1, 1).data.slice(0, 3));
      }
    }
    return samples.join(',');
  });
}

async function drag(page: Page, from: { x: number; y: number }, by: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 6 });
  await page.mouse.up();
}

const centre = (box: { x: number; y: number; width: number; height: number }) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

const mod = (page: Page) => page.evaluate(() => (document.documentElement.dataset.os === 'mac' ? 'Meta' : 'Control'));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('the Logo section offers Aucun, the riad logos and Ajouter; Bleu is on by default', async ({ page }) => {
  const group = page.getByRole('radiogroup', { name: 'Logo' });
  await expect(group.getByRole('radio')).toHaveText(['Aucun', 'Bleu', 'Bois']);
  await expect(page.getByRole('radio', { name: 'Bleu' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Ajouter un logo' })).toBeVisible();

  await loadPhoto(page);
  await expect(logo(page)).toBeVisible();
  const withLogo = await windowPixels(page);
  await page.getByRole('radio', { name: 'Aucun' }).click();
  await expect(logo(page)).toHaveCount(0);
  expect(await windowPixels(page)).not.toEqual(withLogo);
  await page.getByRole('radio', { name: 'Bois', exact: true }).click();
  await expect(logo(page)).toBeVisible();
});

test('starts top left, a fifth of the window wide', async ({ page }) => {
  await loadPhoto(page);
  const window = (await page.locator('.canvas-area__window').boundingBox())!;
  const box = (await logo(page).boundingBox())!;
  expect(box.width / window.width).toBeCloseTo(0.2, 2);
  expect(box.x - window.x).toBeLessThan(window.width * 0.05);
  expect(box.y - window.y).toBeLessThan(window.height * 0.06);
});

test('dragging the logo moves it, not the photo; undo puts it back', async ({ page }) => {
  await loadPhoto(page);
  await page.getByRole('radio', { name: 'Aucun' }).click();
  const photoOnly = await windowPixels(page);
  await page.getByRole('radio', { name: 'Bleu' }).click();
  await expect(logo(page)).toBeVisible();

  const before = await placement(page);
  const box = (await logo(page).boundingBox())!;
  await drag(page, centre(box), { x: 120, y: 80 });
  await expect(logo(page)).toHaveAttribute('aria-pressed', 'true');
  const after = await placement(page);
  expect(after.x).toBeGreaterThan(before.x);
  expect(after.y).toBeGreaterThan(before.y);
  expect(after.width).toBeCloseTo(before.width);

  // The photo underneath didn't pan.
  await page.getByRole('radio', { name: 'Aucun' }).click();
  expect(await windowPixels(page)).toEqual(photoOnly);
  await page.getByRole('radio', { name: 'Bleu' }).click();

  const key = await mod(page);
  await page.keyboard.press(`${key}+z`); // back to Aucun
  await page.keyboard.press(`${key}+z`); // back to Bleu
  await page.keyboard.press(`${key}+z`); // the whole drag is one step
  expect(await placement(page)).toEqual(before);
});

test('dragging off the logo still pans the photo and leaves the logo', async ({ page }) => {
  await loadPhoto(page);
  await page.getByRole('button', { name: /^Zoom avant/ }).click({ modifiers: ['Shift'] });
  await expect(logo(page)).toBeVisible();
  const before = await placement(page);
  const pixels = await windowPixels(page);
  const window = (await page.locator('.canvas-area__window').boundingBox())!;
  await drag(page, { x: window.x + window.width * 0.7, y: window.y + window.height * 0.7 }, { x: -80, y: -40 });
  expect(await windowPixels(page)).not.toEqual(pixels);
  expect(await placement(page)).toEqual(before);
  await expect(logo(page)).toHaveAttribute('aria-pressed', 'false');
});

test('handles resize with the aspect kept, and the logo stays in the window', async ({ page }) => {
  await loadPhoto(page);
  await expect(logo(page)).toBeVisible();
  await logo(page).click();
  const handle = page.locator('.logo-editor__handle--se');
  await expect(handle).toBeVisible();

  const start = (await logo(page).boundingBox())!;
  await drag(page, centre((await handle.boundingBox())!), { x: 100, y: 60 });
  const bigger = (await logo(page).boundingBox())!;
  expect(bigger.width).toBeGreaterThan(start.width * 1.2);
  expect(bigger.width / bigger.height).toBeCloseTo(start.width / start.height, 1);
  expect(bigger.x).toBeCloseTo(start.x, 0);
  expect(bigger.y).toBeCloseTo(start.y, 0);

  // Past the bottom-right corner: it stops at the window edge.
  const window = (await page.locator('.canvas-area__window').boundingBox())!;
  await drag(page, centre(bigger), { x: window.width, y: window.height });
  const moved = (await logo(page).boundingBox())!;
  expect(moved.x + moved.width).toBeLessThanOrEqual(window.x + window.width + 1);
  expect(moved.y + moved.height).toBeLessThanOrEqual(window.y + window.height + 1);

  await page.keyboard.press('Escape');
  await expect(handle).toHaveCount(0);
});

test('an added logo is kept after a reload', async ({ page }) => {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Ajouter un logo' }).click();
  await (await chooser).setFiles(PHOTO);
  await expect(page.getByRole('radio', { name: 'photo' })).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByRole('radio', { name: 'photo' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('radio', { name: 'photo' }).hover();
  await page.getByRole('button', { name: 'Supprimer ce logo' }).click();
  await expect(page.getByRole('radio', { name: 'photo' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Aucun' })).toHaveAttribute('aria-checked', 'true');
});

test('the saved PNG includes the logo', async ({ page }) => {
  // Rendering 2400px in software WebGL is slow on CI runners.
  test.slow();
  await loadPhoto(page);
  await expect(logo(page)).toBeVisible();
  const save = async () => {
    const download = page.waitForEvent('download');
    await page.locator('.canvas-area__save').click();
    return readFile((await (await download).path())!);
  };
  const withLogo = await save();
  await page.getByRole('radio', { name: 'Aucun' }).click();
  const without = await save();
  expect(withLogo.equals(without)).toBe(false);
});
