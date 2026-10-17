import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Zoom matrix: a 1280×720 browser viewport at 100–300% zoom. Browser zoom
 * shrinks the CSS viewport and raises devicePixelRatio, so emulate both.
 */
const SCREEN = { width: 1280, height: 720 };
const ZOOMS = [1, 1.5, 2, 3];

interface Box {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Visible chrome that must never overlap, in page coordinates. */
async function chromeBoxes(page: Page): Promise<Box[]> {
  return page.evaluate(() => {
    const selectors: Record<string, string> = {
      sidebar: '.app__sidebar',
      drawerButton: '.toolbar__drawer-button',
      controls: '.toolbar .control-group',
      save: '.canvas-area__save',
      toolbarSave: '.toolbar__save',
      emptyState: '.empty-state__content',
    };
    const boxes: Box[] = [];
    for (const [name, selector] of Object.entries(selectors)) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      boxes.push({ name, x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height });
    }
    return boxes;
  });
}

function overlaps(a: Box, b: Box): boolean {
  const slack = 0.5;
  return (
    a.x + slack < b.x + b.width && b.x + slack < a.x + a.width && a.y + slack < b.y + b.height && b.y + slack < a.y + a.height
  );
}

for (const scheme of ['light', 'dark'] as const) {
  for (const zoom of ZOOMS) {
    const viewport = { width: Math.floor(SCREEN.width / zoom), height: Math.floor(SCREEN.height / zoom) };
    const compact = viewport.width < 48 * 16;

    test.describe(`${scheme}, ${zoom * 100}% zoom (${viewport.width}×${viewport.height})`, () => {
      test.use({ viewport, deviceScaleFactor: zoom, colorScheme: scheme });

      test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await expect(page.locator('.empty-state__content')).toBeVisible();
      });

      test('no horizontal scroll, no overlapping controls', async ({ page }) => {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        const boxes = await chromeBoxes(page);
        const names = boxes.map((box) => box.name);
        expect(names).toEqual(
          expect.arrayContaining(compact ? ['drawerButton', 'controls', 'emptyState'] : ['sidebar', 'controls', 'emptyState']),
        );
        // Exactly one save button is shown: in the canvas, or in the toolbar when narrow.
        expect(names.filter((name) => name === 'save' || name === 'toolbarSave')).toHaveLength(1);
        for (const box of boxes) {
          expect(box.x, `${box.name} left edge`).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, `${box.name} right edge`).toBeLessThanOrEqual(viewport.width + 0.5);
        }
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            expect(overlaps(boxes[i]!, boxes[j]!), `${boxes[i]!.name} overlaps ${boxes[j]!.name}`).toBe(false);
          }
        }

        // The empty-state view is never clipped by its frame window.
        const clipped = await page.evaluate(() => {
          const window = document.querySelector('.empty-state')!.getBoundingClientRect();
          const content = document.querySelector('.empty-state__content')!.getBoundingClientRect();
          return content.top < window.top - 0.5 || content.bottom > window.bottom + 0.5 || content.left < window.left - 0.5 || content.right > window.right + 0.5;
        });
        expect(clipped).toBe(false);
      });

      test('every control is reachable with Tab', async ({ page, browserName }) => {
        // WebKit only tabs to buttons with the macOS "all controls" setting.
        test.skip(browserName === 'webkit', 'Safari tabs to links and fields only by default');
        const seen = new Set<string>();
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press('Tab');
          const name = await page.evaluate(() => {
            const element = document.activeElement as HTMLElement | null;
            return element?.getAttribute('aria-label') ?? element?.textContent?.trim() ?? '';
          });
          seen.add(name);
        }
        const expected = compact
          ? ['Cadre, fond et logo', 'Pivoter le cadre', 'Choisir une photo']
          : ['CadreDoré sculpté', 'FondNeutre', 'Doré sculpté', 'Neutre', 'Ajouter un fond', 'Pivoter le cadre', 'Choisir une photo'];
        for (const name of expected) expect([...seen], name).toContain(name);
      });

      test('no accessibility violations', async ({ page }) => {
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      });

      if (compact) {
        test('drawer opens, traps focus, closes on Escape', async ({ page }) => {
          const opener = page.getByRole('button', { name: 'Cadre, fond et logo' });
          await opener.click();
          const dialog = page.getByRole('dialog', { name: 'Cadre, fond et logo' });
          await expect(dialog).toBeVisible();
          await expect(dialog.locator(':focus')).toHaveCount(1);
          for (let i = 0; i < 12; i++) {
            await page.keyboard.press('Tab');
            await expect(dialog.locator(':focus')).toHaveCount(1);
          }
          const results = await new AxeBuilder({ page }).analyze();
          expect(results.violations.map((v) => v.id)).toEqual([]);
          await page.keyboard.press('Escape');
          await expect(dialog).toHaveCount(0);
          await expect(opener).toBeFocused();
        });
      }
    });
  }
}

test.describe('preferences', () => {
  test('frame, orientation and collapse state survive a reload', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('radio', { name: 'Noir' }).click();
    await page.getByRole('button', { name: 'Pivoter le cadre' }).click();
    await page.getByRole('button', { name: /^Fond/ }).click();
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Noir' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: /^Fond/ })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: /^Cadre/ })).toContainText('Noir');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cadres.prefs.v1') ?? '{}'));
    expect(stored).toMatchObject({ version: 1, frame: 'noir', orientation: 'portrait', collapsed: { background: true } });
  });

  test('arrow keys move between frame tiles; Enter selects', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('radio', { name: 'Doré sculpté' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'Bois brut' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Chêne clair' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('radio', { name: 'Chêne clair' })).toHaveAttribute('aria-checked', 'true');
  });

  test('corrupt stored prefs fall back to defaults', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('cadres.prefs.v1', '{broken'));
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Doré sculpté' })).toHaveAttribute('aria-checked', 'true');
  });
});
