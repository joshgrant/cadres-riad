import { platform } from '../platform';

/**
 * The background-removal model and ONNX Runtime files. They are fetched once,
 * chunk by chunk, from imgly's CDN for the pinned version, and kept through the
 * platform's model store (the app data folder on desktop, Cache Storage on the
 * web). Chunks already fetched survive a cancelled download.
 */

export const MODEL_VERSION = '1.7.0';
export const PUBLIC_PATH = `https://staticimgly.com/@imgly/background-removal-data/${MODEL_VERSION}/dist/`;

export type Device = 'gpu' | 'cpu';

interface Chunk {
  name: string;
  offsets: [number, number];
}

export interface ResourceEntry {
  chunks: Chunk[];
  size: number;
  mime: string;
}

export type Manifest = Record<string, ResourceEntry>;

/** WebGPU with fp16 weights, or WASM with the smaller quantised model. */
export function modelFor(device: Device): 'isnet_fp16' | 'isnet_quint8' {
  return device === 'gpu' ? 'isnet_fp16' : 'isnet_quint8';
}

export function requiredKeys(device: Device): string[] {
  const runtime = device === 'gpu' ? '/onnxruntime-web/ort-wasm-simd-threaded.jsep' : '/onnxruntime-web/ort-wasm-simd-threaded';
  return [`/models/${modelFor(device)}`, `${runtime}.wasm`, `${runtime}.mjs`];
}

export async function preferredDevice(): Promise<Device> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (gpu && (await gpu.requestAdapter())) return 'gpu';
  } catch {
    // Fall through to the CPU path.
  }
  return 'cpu';
}

const storeKey = (name: string) => `${MODEL_VERSION}/${name}`;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function manifest(signal?: AbortSignal): Promise<Manifest> {
  const store = platform().modelStore;
  const cached = await store.get(storeKey('resources.json'));
  if (cached) return JSON.parse(decoder.decode(cached)) as Manifest;
  const response = await fetch(new URL('resources.json', PUBLIC_PATH), signal ? { signal } : {});
  if (!response.ok) throw new Error(`Model manifest: HTTP ${response.status}`);
  const text = await response.text();
  await store.put(storeKey('resources.json'), encoder.encode(text));
  return JSON.parse(text) as Manifest;
}

function chunksFor(entries: Manifest, device: Device): Chunk[] {
  return requiredKeys(device).flatMap((key) => {
    const entry = entries[key];
    if (!entry) throw new Error(`Model manifest has no ${key}`);
    return entry.chunks;
  });
}

const chunkSize = (chunk: Chunk) => chunk.offsets[1] - chunk.offsets[0];

/** Total download size and how much of it is already stored. Null when the manifest can't be read. */
export async function downloadState(device: Device): Promise<{ total: number; stored: number } | null> {
  try {
    const entries = await manifest();
    const store = platform().modelStore;
    let stored = 0;
    let total = 0;
    for (const chunk of chunksFor(entries, device)) {
      total += chunkSize(chunk);
      if (await store.get(storeKey(chunk.name))) stored += chunkSize(chunk);
    }
    return { total, stored };
  } catch {
    return null;
  }
}

export interface ModelFiles {
  manifest: Manifest;
  /** Chunk name (relative to PUBLIC_PATH) → bytes. */
  files: Map<string, ArrayBuffer>;
}

/**
 * Returns every file the worker needs, downloading what isn't stored yet.
 * `onProgress(done, total)` counts bytes, including chunks already stored.
 */
export async function loadModel(
  device: Device,
  { signal, onProgress }: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<ModelFiles> {
  const entries = await manifest(signal);
  const store = platform().modelStore;
  const chunks = chunksFor(entries, device);
  const total = chunks.reduce((sum, chunk) => sum + chunkSize(chunk), 0);
  let done = 0;
  const files = new Map<string, ArrayBuffer>();
  const report = () => onProgress?.(done, total);

  const fetchChunk = async (chunk: Chunk) => {
    const stored = await store.get(storeKey(chunk.name));
    if (stored) {
      files.set(chunk.name, stored.buffer.slice(stored.byteOffset, stored.byteOffset + stored.byteLength) as ArrayBuffer);
      done += chunkSize(chunk);
      report();
      return;
    }
    const response = await fetch(new URL(chunk.name, PUBLIC_PATH), signal ? { signal } : {});
    if (!response.ok || !response.body) throw new Error(`Model chunk ${chunk.name}: HTTP ${response.status}`);
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done: finished, value } = await reader.read();
      if (finished) break;
      parts.push(value);
      received += value.byteLength;
      done += value.byteLength;
      report();
    }
    if (received !== chunkSize(chunk)) throw new Error(`Model chunk ${chunk.name}: size mismatch`);
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    await store.put(storeKey(chunk.name), bytes);
    files.set(chunk.name, bytes.buffer);
  };

  // A few chunks at a time keeps the connection busy without flooding it.
  const queue = [...chunks];
  const workers = Array.from({ length: 4 }, async () => {
    for (let chunk = queue.shift(); chunk; chunk = queue.shift()) {
      signal?.throwIfAborted();
      await fetchChunk(chunk);
    }
  });
  report();
  await Promise.all(workers);
  return { manifest: entries, files };
}
