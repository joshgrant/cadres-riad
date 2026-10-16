import { describe, expect, it } from 'vitest';
import { evictionOrder } from './db';

const entry = (hash: string, size: number, usedAt: number) => ({ hash, size, usedAt });

describe('evictionOrder', () => {
  it('keeps everything under the limits', () => {
    expect(evictionOrder([entry('a', 10, 1), entry('b', 10, 2)], { count: 5, bytes: 100 })).toEqual([]);
  });

  it('drops the least recently used beyond the count', () => {
    const entries = [entry('new', 1, 30), entry('old', 1, 10), entry('mid', 1, 20)];
    expect(evictionOrder(entries, { count: 2, bytes: 100 })).toEqual(['old']);
  });

  it('drops until under the byte budget', () => {
    const entries = [entry('a', 60, 1), entry('b', 60, 2), entry('c', 60, 3)];
    expect(evictionOrder(entries, { count: 20, bytes: 100 })).toEqual(['a', 'b']);
  });
});
