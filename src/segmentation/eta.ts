import { t } from '../i18n/fr';
import { formatNumber } from '../i18n/typography';

/**
 * Download speed from a rolling 5-second window, turned into a rounded,
 * human time remaining. Refreshed at most once a second by the caller.
 */
export class Throughput {
  private samples: { time: number; bytes: number }[] = [];
  readonly startedAt: number;

  constructor(now = performance.now()) {
    this.startedAt = now;
  }

  add(bytesSoFar: number, now = performance.now()): void {
    this.samples.push({ time: now, bytes: bytesSoFar });
    while (this.samples.length > 2 && now - this.samples[0]!.time > 5000) this.samples.shift();
  }

  /** Bytes per second over the window, or null with too little data. */
  rate(): number | null {
    const first = this.samples[0];
    const last = this.samples.at(-1);
    if (!first || !last || last.time - first.time < 500) return null;
    return ((last.bytes - first.bytes) / (last.time - first.time)) * 1000;
  }
}

/** “Calcul du temps restant…” for the first 2 seconds, then rounded minutes. */
export function etaText(remainingBytes: number, rate: number | null, elapsedMs: number): string {
  if (elapsedMs < 2000 || !rate || rate <= 0) return t('eta.calculating');
  const minutes = remainingBytes / rate / 60;
  if (minutes < 1) return t('eta.lessThanMinute');
  const rounded = Math.round(minutes);
  return rounded <= 1 ? t('eta.oneMinute') : t('eta.minutes', { n: rounded });
}

/** Whole megabytes in French formatting: “42”. */
export function megabytes(bytes: number): string {
  return formatNumber(Math.round(bytes / 1_000_000));
}
