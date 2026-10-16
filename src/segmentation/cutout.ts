import { computed, effect } from '@preact/signals';
import { prefs, updatePrefs } from '../app/prefs';
import { cutout, cutoutFirstRun, cutoutStatus, downloadProgress, photo, type Photo } from '../app/store';
import { t } from '../i18n/fr';
import { getMask, putMask } from '../storage/db';
import { announce, dismissToast, showToast, updateToast } from '../ui/toastStore';
import { Throughput, etaText, megabytes } from './eta';
import { downloadState, loadModel, preferredDevice, type Device } from './model';
import type { WorkerRequest, WorkerResponse } from './worker';

/**
 * Détourage: runs whenever a photo is loaded with détourage on. Cached cut-outs
 * apply at once; otherwise the worker runs, after a one-time model download
 * with a toast that says what is happening and how long it will take.
 */

/** Longest edge sent to the model; the cut-out is drawn scaled to the photo. */
const MAX_CUTOUT_EDGE = 4000;

let worker: Worker | null = null;
const filesSent = new Set<string>();
let jobId = 0;
const pending = new Map<number, { resolve: (r: WorkerResponse) => void }>();
let download: AbortController | null = null;
/** Hash of the photo a job is running for, so repeated triggers don't restart it. */
let inFlight: string | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (message.type === 'progress') return;
    pending.get(message.id)?.resolve(message);
    pending.delete(message.id);
  };
  return worker;
}

/** Photo pixels for the model, downscaled if the photo is very large. */
function photoPixels(current: Photo): { width: number; height: number; pixels: ArrayBuffer } {
  const scale = Math.min(1, MAX_CUTOUT_EDGE / Math.max(current.width, current.height));
  const width = Math.round(current.width * scale);
  const height = Math.round(current.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(current.bitmap, 0, 0, width, height);
  return { width, height, pixels: ctx.getImageData(0, 0, width, height).data.buffer };
}

class Cancelled extends Error {}

async function runOn(device: Device, current: Photo, id: number): Promise<ImageBitmap> {
  const state = await downloadState(device);
  if (!state) throw new Error('model manifest unavailable');
  const firstTime = state.stored < state.total;
  let toastId: number | null = null;
  const meter = new Throughput();
  let lastRefresh = 0;
  let lastQuarter = 0;

  cutoutFirstRun.value = firstTime;
  if (firstTime) {
    download = new AbortController();
    cutoutStatus.value = 'downloading';
    downloadProgress.value = state.stored / state.total;
    const total = megabytes(state.total);
    toastId = showToast({
      title: t('download.title'),
      body: t('download.body', { total }),
      progress: state.stored / state.total,
      status: t('download.progress', { done: megabytes(state.stored), total, eta: t('eta.calculating') }),
      action: { label: t('common.cancel'), run: () => download?.abort() },
    });
  } else {
    cutoutStatus.value = 'running';
  }

  let files;
  try {
    files = await loadModel(device, {
      ...(download ? { signal: download.signal } : {}),
      onProgress: (done, total) => {
        if (toastId === null) return;
        const now = performance.now();
        meter.add(done, now);
        downloadProgress.value = done / total;
        const quarter = Math.floor((done / total) * 4);
        if (quarter > lastQuarter && quarter < 4) {
          lastQuarter = quarter;
          announce(`${t('download.title')} : ${quarter * 25} %`);
        }
        if (now - lastRefresh < 1000 && done < total) return;
        lastRefresh = now;
        updateToast(toastId, {
          progress: done / total,
          status: t('download.progress', {
            done: megabytes(done),
            total: megabytes(total),
            eta: etaText(total - done, meter.rate(), now - meter.startedAt),
          }),
        });
      },
    });
  } catch (error) {
    if (toastId !== null) dismissToast(toastId);
    if (download?.signal.aborted) throw new Cancelled();
    throw error;
  } finally {
    download = null;
    downloadProgress.value = undefined;
  }

  if (toastId !== null) {
    // The first cut-out follows straight on; the toast says so, then closes.
    updateToast(toastId, { title: undefined, body: t('cutout.running'), progress: 'indeterminate', status: undefined, action: undefined });
  }
  cutoutStatus.value = 'running';

  try {
    const target = getWorker();
    const newFiles = [...files.files].filter(([name]) => !filesSent.has(name));
    if (newFiles.length > 0) {
      target.postMessage(
        { type: 'files', manifest: files.manifest, files: newFiles } satisfies WorkerRequest,
        newFiles.map(([, bytes]) => bytes),
      );
      for (const [name] of newFiles) filesSent.add(name);
    }
    const { width, height, pixels } = photoPixels(current);
    const result = await new Promise<WorkerResponse>((resolve) => {
      pending.set(id, { resolve });
      target.postMessage({ type: 'run', id, device, width, height, pixels } satisfies WorkerRequest, [pixels]);
    });
    if (result.type === 'error') throw new Error(result.message);
    if (result.type !== 'done') throw new Error('unexpected worker reply');
    return await createImageBitmap(new ImageData(new Uint8ClampedArray(result.pixels), result.width, result.height));
  } finally {
    if (toastId !== null) dismissToast(toastId);
    cutoutFirstRun.value = false;
  }
}

async function encodePng(bitmap: ImageBitmap): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function fail(): void {
  updatePrefs({ cutout: false });
  showToast({ body: t('error.cutout'), tone: 'error', duration: 8000 });
}

async function ensureCutout(current: Photo): Promise<void> {
  const id = ++jobId;
  inFlight = current.hash;
  try {
    await cutoutJob(current, id);
  } finally {
    if (id === jobId) inFlight = null;
  }
}

/** End-to-end tests set this flag: an elliptical fixture mask instead of the model. */
function mockedForTests(): boolean {
  try {
    return localStorage.getItem('cadres.test.mockCutout') === '1';
  } catch {
    return false;
  }
}

async function fixtureCutout(current: Photo): Promise<ImageBitmap> {
  const canvas = document.createElement('canvas');
  canvas.width = current.width;
  canvas.height = current.height;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.ellipse(current.width / 2, current.height * 0.6, current.width * 0.3, current.height * 0.4, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(current.bitmap, 0, 0);
  await new Promise((resolve) => setTimeout(resolve, 300));
  return createImageBitmap(canvas);
}

async function cutoutJob(current: Photo, id: number): Promise<void> {
  const isCurrent = () => id === jobId && photo.value?.hash === current.hash && prefs.value.cutout;

  if (mockedForTests()) {
    cutoutStatus.value = 'running';
    const bitmap = await fixtureCutout(current);
    cutoutStatus.value = 'idle';
    if (isCurrent()) cutout.value = { hash: current.hash, bitmap };
    return;
  }

  const cached = await getMask(current.hash);
  if (!isCurrent()) return;
  if (cached) {
    const bitmap = await createImageBitmap(cached);
    if (isCurrent()) cutout.value = { hash: current.hash, bitmap };
    return;
  }

  const device = await preferredDevice();
  let bitmap: ImageBitmap;
  try {
    try {
      bitmap = await runOn(device, current, id);
    } catch (error) {
      // If the GPU path throws, retry once on the CPU before giving up.
      if (device !== 'gpu' || error instanceof Cancelled) throw error;
      console.warn('Détourage: GPU path failed, retrying on the CPU.', error);
      bitmap = await runOn('cpu', current, id);
    }
  } catch (error) {
    cutoutStatus.value = 'idle';
    if (error instanceof Cancelled) {
      // Annuler: chunks already fetched are kept; détourage goes back off.
      if (prefs.value.cutout) updatePrefs({ cutout: false });
      return;
    }
    console.error('Détourage failed.', error);
    if (isCurrent()) fail();
    return;
  }
  cutoutStatus.value = 'idle';
  if (!isCurrent()) return; // A newer photo or a toggle made this result stale.
  cutout.value = { hash: current.hash, bitmap };
  announce(t('cutout.done'));
  const png = await encodePng(bitmap);
  if (png) await putMask(current.hash, png);
}

/** Starts watching the photo and the détourage setting. Call once at startup. */
export function installCutout(): void {
  // Only these two matter; other preference changes must not restart a job.
  const wanted = computed(() => prefs.value.cutout);
  effect(() => {
    const current = photo.value;
    if (!current || !wanted.value) {
      jobId++; // Results of anything in flight are dropped.
      inFlight = null;
      download?.abort();
      return;
    }
    if (cutout.peek()?.hash === current.hash || inFlight === current.hash) return;
    void ensureCutout(current);
  });
}
