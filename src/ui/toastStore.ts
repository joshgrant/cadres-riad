import { signal } from '@preact/signals';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastData {
  id: number;
  title?: string;
  body: string;
  /** Second line under the body, e.g. download status. */
  status?: string;
  /** 0–1 for a determinate bar, 'indeterminate' for a shimmer. */
  progress?: number | 'indeterminate';
  action?: ToastAction;
  tone?: 'default' | 'error';
  /** Milliseconds before it closes on its own; undefined keeps it until dismissed. */
  duration?: number;
}

export const toasts = signal<ToastData[]>([]);
export const announcement = signal('');

let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function showToast(toast: Omit<ToastData, 'id'>): number {
  const id = nextId++;
  toasts.value = [...toasts.value, { ...toast, id }];
  if (toast.duration !== undefined) timers.set(id, setTimeout(() => dismissToast(id), toast.duration));
  announce([toast.title, toast.body].filter(Boolean).join('. '));
  return id;
}

export function updateToast(id: number, patch: Partial<Omit<ToastData, 'id'>>): void {
  toasts.value = toasts.value.map((toast) => (toast.id === id ? { ...toast, ...patch } : toast));
}

export function dismissToast(id: number): void {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

/** Polite live-region announcement for progress, saves and errors. */
export function announce(text: string): void {
  // Clear first so repeating the same text is announced again.
  announcement.value = '';
  queueMicrotask(() => (announcement.value = text));
}
