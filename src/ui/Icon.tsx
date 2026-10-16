import type { JSX } from 'preact';

/**
 * Original icon set drawn in the manner of SF Symbols (not SF Symbols themselves):
 * 24px grid, 1.75px stroke, round caps and joins, currentColor.
 */
const paths = {
  cutout: (
    <>
      <rect x="3" y="3.5" width="18" height="17" rx="2.5" stroke-dasharray="0.1 3.4" />
      <circle cx="12" cy="9.75" r="2.75" />
      <path d="M6.75 20.5c0-3.1 2.35-5.5 5.25-5.5s5.25 2.4 5.25 5.5" />
    </>
  ),
  rotate: (
    <>
      <rect x="3.5" y="9.5" width="11" height="11" rx="1.75" />
      <path d="M10.5 4.5h2.75a5.75 5.75 0 0 1 5.75 5.75v2.25" />
      <path d="m16.5 10 2.5 2.5 2.5-2.5" />
    </>
  ),
  'zoom-in': (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.25 15.25 5.25 5.25M8 10.5h5M10.5 8v5" />
    </>
  ),
  'zoom-out': (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.25 15.25 5.25 5.25M8 10.5h5" />
    </>
  ),
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  chevron: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m7 7 10 10M17 7 7 17" />,
  hand: (
    <path d="M8.5 13.5V7a1.5 1.5 0 0 1 3 0v5M11.5 11.5V5.5a1.5 1.5 0 0 1 3 0v6M14.5 11.5V7a1.5 1.5 0 0 1 3 0v7c0 3.6-2.6 6.5-6 6.5-2.4 0-3.9-1-5.2-2.9l-2.2-3.2a1.45 1.45 0 0 1 2.3-1.75l1.6 1.85" />
  ),
  'photo-add': (
    <>
      <path d="M13.5 4H5.5a2.5 2.5 0 0 0-2.5 2.5v11A2.5 2.5 0 0 0 5.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-6" />
      <path d="m3.5 16.5 4.25-4.25 3 3 2-2 5.75 5.5" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="M19 2.5v6M16 5.5h6" />
    </>
  ),
  sidebar: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M9.5 4.5v15M5.5 8h1.5M5.5 11h1.5" />
    </>
  ),
} satisfies Record<string, JSX.Element>;

export type IconName = keyof typeof paths;

export function Icon({ name, class: className }: { name: IconName; class?: string }) {
  return (
    <svg
      class={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
