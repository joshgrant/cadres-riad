import type { ComponentChildren } from 'preact';
import './ControlGroup.css';

/** Floating translucent capsule of icon buttons. */
export function ControlGroup({ label, children, class: className }: { label: string; children: ComponentChildren; class?: string }) {
  return (
    <div class={className ? `control-group material ${className}` : 'control-group material'} role="toolbar" aria-label={label}>
      {children}
    </div>
  );
}

export function ControlDivider() {
  return <span class="control-group__divider" aria-hidden="true" />;
}
