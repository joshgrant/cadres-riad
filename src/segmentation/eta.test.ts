import { describe, expect, it } from 'vitest';
import { Throughput, etaText, megabytes } from './eta';

describe('etaText', () => {
  it('calculates for the first two seconds', () => {
    expect(etaText(80e6, 1e6, 1500)).toBe('Calcul du temps restant…');
  });
  it('rounds to friendly minutes', () => {
    expect(etaText(30e6, 1e6, 5000)).toBe('moins d’une minute');
    expect(etaText(70e6, 1e6, 5000)).toBe('environ 1 min restante');
    expect(etaText(180e6, 1e6, 5000)).toBe('environ 3 min restantes');
  });
});

describe('Throughput', () => {
  it('averages over the last five seconds', () => {
    const meter = new Throughput(0);
    meter.add(0, 0);
    meter.add(1e6, 1000);
    meter.add(2e6, 2000);
    expect(meter.rate()).toBeCloseTo(1e6);
    // A burst long ago no longer counts once it leaves the window.
    meter.add(12e6, 9000);
    expect(meter.rate()).toBeCloseTo(10e6 / 7000 * 1000);
  });
});

describe('megabytes', () => {
  it('formats whole MB', () => {
    expect(megabytes(88_152_708)).toBe('88');
  });
});
