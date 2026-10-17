import { beforeEach, describe, expect, it } from 'vitest';
import { clearHistory, redo, step, undo } from './history';
import { defaultPrefs, prefs, updatePrefs } from './prefs';
import { view } from './store';

beforeEach(() => {
  prefs.value = defaultPrefs();
  view.value = { cx: 0.5, cy: 0.5, zoom: 1 };
  clearHistory();
});

describe('history', () => {
  it('undoes and redoes frame and view changes', () => {
    step(() => updatePrefs({ frame: 'noir' }));
    step(() => (view.value = { cx: 0.4, cy: 0.5, zoom: 2 }));
    undo();
    expect(view.value.zoom).toBe(1);
    expect(prefs.value.frame).toBe('noir');
    undo();
    expect(prefs.value.frame).toBe('dore');
    redo();
    redo();
    expect(prefs.value.frame).toBe('noir');
    expect(view.value.zoom).toBe(2);
  });

  it('ignores no-op steps and clears redo on a new change', () => {
    step(() => updatePrefs({ frame: 'dore' }));
    undo();
    expect(prefs.value.frame).toBe('dore');
    step(() => updatePrefs({ frame: 'blanc' }));
    undo();
    step(() => updatePrefs({ frame: 'noyer' }));
    redo();
    expect(prefs.value.frame).toBe('noyer');
  });

  it('undoes logo choices and moves', () => {
    step(() => updatePrefs({ logoId: 'brown' }));
    step(() => updatePrefs({ logo: { x: 0.5, y: 0.5, width: 0.3 } }));
    undo();
    expect(prefs.value.logo).toEqual({ x: 0.03, y: 0.04, width: 0.2 });
    expect(prefs.value.logoId).toBe('brown');
    undo();
    expect(prefs.value.logoId).toBe('default');
    redo();
    redo();
    expect(prefs.value.logo.width).toBe(0.3);
  });

  it('keeps at most 50 steps', () => {
    for (let i = 0; i < 60; i++) step(() => (view.value = { cx: 0.5, cy: 0.5, zoom: 1 + i / 100 + 0.01 }));
    for (let i = 0; i < 60; i++) undo();
    expect(view.value.zoom).toBeCloseTo(1 + 9 / 100 + 0.01);
  });
});
