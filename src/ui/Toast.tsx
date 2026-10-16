import { announcement, dismissToast, toasts, type ToastData } from './toastStore';
import { ProgressBar } from './ProgressBar';
import './Toast.css';

export function Toast({ toast, onAction }: { toast: Omit<ToastData, 'id'>; onAction?: () => void }) {
  return (
    <div class={`toast${toast.tone === 'error' ? ' toast--error' : ''}`}>
      <div class="toast__text">
        {toast.title && <p class="toast__title">{toast.title}</p>}
        <p class="toast__body">{toast.body}</p>
        {toast.progress !== undefined && <ProgressBar value={toast.progress} />}
        {toast.status && <p class="toast__status">{toast.status}</p>}
      </div>
      {toast.action && (
        <button type="button" class="toast__action" onClick={onAction}>
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

/** Stack of toasts, bottom-centre of its container, plus the polite live region. */
export function ToastHost() {
  return (
    <>
      <div class="toast-host">
        {toasts.value.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onAction={() => {
              toast.action?.run();
              dismissToast(toast.id);
            }}
          />
        ))}
      </div>
      <div class="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement.value}
      </div>
    </>
  );
}
