/// <reference lib="webworker" />
import { removeBackground } from '@imgly/background-removal';
import { PUBLIC_PATH, modelFor, type Device, type Manifest } from './model';
import { refineCutout } from './refine';

/**
 * Background removal off the main thread. The main thread hands over the model
 * files it has cached; imgly's own fetches are answered from them, so nothing
 * is downloaded here.
 */

export type WorkerRequest =
  | { type: 'files'; manifest: Manifest; files: [string, ArrayBuffer][] }
  | { type: 'run'; id: number; device: Device; width: number; height: number; pixels: ArrayBuffer };

export type WorkerResponse =
  | { type: 'progress'; id: number; step: string }
  | { type: 'done'; id: number; width: number; height: number; pixels: ArrayBuffer }
  | { type: 'error'; id: number; device: Device; message: string };

declare const self: DedicatedWorkerGlobalScope;

let manifest: Manifest | null = null;
const files = new Map<string, ArrayBuffer>();
const networkFetch = self.fetch.bind(self);

self.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith(PUBLIC_PATH)) {
    const name = url.slice(PUBLIC_PATH.length);
    if (name === 'resources.json' && manifest) return new Response(JSON.stringify(manifest));
    const bytes = files.get(name);
    if (bytes) return new Response(bytes.slice(0));
  }
  return networkFetch(input, init);
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === 'files') {
    manifest = message.manifest;
    for (const [name, bytes] of message.files) files.set(name, bytes);
    return;
  }

  const { id, device, width, height } = message;
  try {
    // Raw RGBA in imgly's own format, so it skips decoding and keeps our orientation.
    const image = new Blob([message.pixels], { type: `image/x-rgba8;width=${width};height=${height}` });
    const blob = await removeBackground(image, {
      publicPath: PUBLIC_PATH,
      device,
      model: modelFor(device),
      output: { format: 'image/x-rgba8', quality: 1 },
      progress: (step: string) => {
        if (step.startsWith('compute:')) self.postMessage({ type: 'progress', id, step } satisfies WorkerResponse);
      },
    });
    const rgba = new Uint8ClampedArray(await blob.arrayBuffer());
    refineCutout(rgba, width, height, Math.max(2, Math.round(Math.max(width, height) / 1000)));
    self.postMessage({ type: 'done', id, width, height, pixels: rgba.buffer } satisfies WorkerResponse, [rgba.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', id, device, message: String(error) } satisfies WorkerResponse);
  }
};
