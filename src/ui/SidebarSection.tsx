import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import { Icon } from './Icon';
import './SidebarSection.css';

interface SidebarSectionProps {
  title: string;
  /** Current choice, always shown in the header. */
  value: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ComponentChildren;
  class?: string;
}

/** Collapsible sidebar section. The whole header row is one button. */
export function SidebarSection({ title, value, collapsed, onToggle, children, class: className }: SidebarSectionProps) {
  const bodyId = useId();
  return (
    <section class={`sidebar-section${collapsed ? ' sidebar-section--collapsed' : ''}${className ? ` ${className}` : ''}`}>
      <h2 class="sidebar-section__heading">
        <button type="button" class="sidebar-section__header" aria-expanded={!collapsed} aria-controls={bodyId} onClick={onToggle}>
          <span class="sidebar-section__title type-title">{title}</span>
          <span class="sidebar-section__value type-secondary">{value}</span>
          <Icon name="chevron" class="sidebar-section__chevron" />
        </button>
      </h2>
      <div class="sidebar-section__body" id={bodyId} inert={collapsed}>
        <div class="sidebar-section__inner">{children}</div>
      </div>
    </section>
  );
}
