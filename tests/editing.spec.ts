import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const PHOTO = fileURLToPath(new URL('./fixtures/photo.jpg', import.meta.url));

async function freshStart(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function loadPhoto(page: Page) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choisir une photo' }).click();
  await (await chooser).setFiles(PHOTO);
  await expect(page.getByRole('img', { name: /Photo dans un cadre/ })).toBeVisible();
}

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

/** The app uses ⌘ when it thinks it runs on macOS, Ctrl otherwise. */
async function mod(page: Page): Promise<string> {
  return page.evaluate(() => (document.documentElement.dataset.os === 'mac' ? 'Meta' : 'Control'));
}

test.beforeEach(async ({ page }) => freshStart(page));

test('loading a photo shows it, enables zoom and save, and shows the hint', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^Zoom avant/ })).toBeDisabled();
  await loadPhoto(page);
  await expect(page.getByRole('button', { name: /^Zoom avant/ })).toBeEnabled();
  await expect(page.locator('.canvas-area__save')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Glisser pour déplacer la photo' })).toBeVisible();
});

test('unsupported files show the format error and keep the empty state', async ({ page }) => {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choisir une photo' }).click();
  await (await chooser).setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.locator('.toast__body')).toContainText('Ce format d’image n’est pas pris en charge');
  await expect(page.getByRole('button', { name: 'Choisir une photo' })).toBeVisible();
});

test('zoom, drag to pan, undo and redo', async ({ page }) => {
  await loadPhoto(page);
  const start = await windowPixels(page);
  await page.getByRole('button', { name: /^Zoom avant/ }).click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: /^Zoom avant/ }).click();
  const zoomed = await windowPixels(page);
  expect(zoomed).not.toEqual(start);

  // Drag on the empty canvas space beside the frame: it still pans.
  const area = await page.locator('.canvas-area').boundingBox();
  await page.mouse.move(area!.x + 30, area!.y + area!.height / 2);
  await page.mouse.down();
  await page.mouse.move(area!.x + 130, area!.y + area!.height / 2, { steps: 5 });
  await page.mouse.up();
  const panned = await windowPixels(page);
  expect(panned).not.toEqual(zoomed);

  const key = await mod(page);
  await page.keyboard.press(`${key}+z`); // the whole drag is one step
  expect(await windowPixels(page)).toEqual(zoomed);
  await page.keyboard.press(`${key}+Shift+z`);
  expect(await windowPixels(page)).toEqual(panned);
  await page.keyboard.press('0');
  expect(await windowPixels(page)).toEqual(start);
});

test('keyboard pans and zooms when the frame window has focus', async ({ page }) => {
  await loadPhoto(page);
  await page.getByRole('img', { name: /Photo dans un cadre/ }).focus();
  const start = await windowPixels(page);
  await page.keyboard.press('+');
  const zoomed = await windowPixels(page);
  expect(zoomed).not.toEqual(start);
  await page.keyboard.press('Shift+ArrowLeft');
  expect(await windowPixels(page)).not.toEqual(zoomed);
  await page.keyboard.press('0');
  expect(await windowPixels(page)).toEqual(start);
});

test('rotate switches orientation; Polaroid is portrait only', async ({ page }) => {
  await loadPhoto(page);
  const shape = async () => {
    const box = (await page.locator('.canvas-area__window').boundingBox())!;
    return box.width / box.height;
  };
  expect(await shape()).toBeCloseTo(4 / 3, 1);
  await page.getByRole('button', { name: 'Pivoter le cadre' }).click();
  expect(await shape()).toBeCloseTo(3 / 4, 1);
  await page.getByRole('button', { name: 'Pivoter le cadre' }).click();

  await page.getByRole('radio', { name: 'Polaroid' }).click();
  expect(await shape()).toBeCloseTo(1, 1);
  await expect(page.getByRole('button', { name: 'Pivoter le cadre' })).toBeDisabled();

  // Undo restores the previous frame.
  await page.keyboard.press(`${await mod(page)}+z`);
  await expect(page.getByRole('radio', { name: 'Doré sculpté' })).toHaveAttribute('aria-checked', 'true');
});

test('the hint dismisses for good', async ({ page }) => {
  await loadPhoto(page);
  await page.getByRole('button', { name: 'Glisser pour déplacer la photo' }).click();
  await expect(page.getByRole('button', { name: 'Glisser pour déplacer la photo' })).toHaveCount(0);
  await page.reload();
  await loadPhoto(page);
  await expect(page.getByRole('button', { name: 'Glisser pour déplacer la photo' })).toHaveCount(0);
});

test('save produces a 2400px transparent PNG named after the caption', async ({ page }) => {
  // Rendering 2400px in software WebGL is slow on CI runners.
  test.slow();
  await loadPhoto(page);
  const download = page.waitForEvent('download');
  await page.locator('.canvas-area__save').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^Riad-Les-Chtis-DAgadir-2026_\d{4}-\d{2}-\d{2}\.png$/);
  await expect(page.locator('.toast__body')).toHaveText('Photo enregistrée');
  // Read the PNG header directly: width and height (big-endian) and colour type 6 = RGBA.
  const bytes = await (await import('node:fs/promises')).readFile((await file.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  expect(Math.max(width, height)).toBe(2400);
  expect(bytes[25]).toBe(6);
});

test.describe('caption', () => {
  const caption = () => page_.evaluate(() => JSON.parse(localStorage.getItem('cadres.prefs.v1') ?? '{}').caption);
  let page_: Page;

  test.beforeEach(({ page }) => {
    page_ = page;
  });

  for (const text of ['Été à Agadir — œuvre de François', 'Noël 2026 !', "L'équipe du Riad"]) {
    test(`edits in place: ${text}`, async ({ page }) => {
      await page.getByRole('radio', { name: 'Chêne clair' }).click();
      await page.getByRole('button', { name: /^Modifier la légende/ }).click();
      const field = page.getByRole('textbox', { name: 'Cliquer pour modifier la légende' });
      await expect(field).toBeFocused();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type(text);
      await page.keyboard.press('Enter');
      await expect(field).toHaveCount(0);
      expect(await caption()).toBe(text.replace("'", '’'));
      // One undo step brings the old caption back.
      await page.keyboard.press(`${await mod(page)}+z`);
      expect(await caption()).toBe('Riad Les Chtis D’Agadir 2026');
    });
  }

  test('Escape reverts; empty shows the placeholder', async ({ page }) => {
    await page.getByRole('button', { name: /^Modifier la légende/ }).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Brouillon');
    await page.keyboard.press('Escape');
    expect(await caption()).toBe('Riad Les Chtis D’Agadir 2026');

    await page.getByRole('button', { name: /^Modifier la légende/ }).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Enter');
    expect(await caption()).toBe('');
    await expect(page.getByRole('button', { name: 'Ajouter une légende' })).toBeVisible();
  });

  test('refuses text that would no longer fit', async ({ page }) => {
    await page.getByRole('button', { name: /^Modifier la légende/ }).click();
    await page.keyboard.type(' — et encore beaucoup plus de texte pour remplir');
    await page.keyboard.press('Enter');
    const stored: string = await caption();
    expect(stored.length).toBeLessThanOrEqual(60);
    expect(stored.startsWith('Riad Les Chtis D’Agadir 2026')).toBe(true);
  });
});

test('every frame renders without errors, in both orientations', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await loadPhoto(page);
  for (const name of ['Doré sculpté', 'Noyer sculpté', 'Bois brut', 'Chêne clair', 'Noir', 'Blanc', 'Polaroid']) {
    await page.getByRole('radio', { name }).click();
    await expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
    const rotate = page.getByRole('button', { name: 'Pivoter le cadre' });
    if (await rotate.isEnabled()) {
      await rotate.click();
      await rotate.click();
    }
  }
  expect(errors).toEqual([]);
});
