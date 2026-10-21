import type { ReactNode, SVGProps } from "react";

/** Line icons drawn on a 24 px grid, 1.7 px stroke, rounded joins. Decorative by default. */
const PATHS = {
  home: <path d="M3.5 10.5 12 4l8.5 6.5M5.75 9v10.5H10v-6h4v6h4.25V9" />,
  building: <path d="M3.5 20.5h17M6 20.5V5.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M15 9.5h3a1 1 0 0 1 1 1v10M8.75 8.25h3.5M8.75 11.75h3.5M8.75 15.25h3.5" />,
  people: (
    <path d="M15.5 19.5v-1.25A3.75 3.75 0 0 0 11.75 14.5h-4A3.75 3.75 0 0 0 4 18.25v1.25M9.75 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 19.5v-1.25a3.75 3.75 0 0 0-2.75-3.6M15 4.15a3.5 3.5 0 0 1 0 6.7" />
  ),
  calendar: <path d="M4.5 7.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11ZM4.5 10h15M8.5 3.5v3M15.5 3.5v3" />,
  docImport: <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5l-5-5ZM14 3.5v5h5M12 11.25v6M9.5 14.75 12 17.25l2.5-2.5" />,
  funnel: <path d="M4 5h16l-6.25 7.5v5.25L10.25 19.5v-7L4 5Z" />,
  person: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0" />,
  plug: <path d="M9 3.5v4M15 3.5v4M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0v-3ZM12 16v4.5" />,
  more: (
    <>
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <path d="M7.9 12h.01M12 12h.01M16.1 12h.01" strokeWidth="2.6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronLeft: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  search: <path d="M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20.5 20.5l-5-5" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  checkCircle: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.25l2.75 2.75L16 9.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  phone: <path d="M5.1 4.5h2.8l1.5 4-1.9 1.2a10.5 10.5 0 0 0 6.8 6.8l1.2-1.9 4 1.5v2.8a1.6 1.6 0 0 1-1.7 1.6A16.3 16.3 0 0 1 3.5 6.2a1.6 1.6 0 0 1 1.6-1.7Z" />,
  chat: <path d="M20 11.5a8 8 0 0 1-11.65 7.12L4 20l1.38-4.2A8 8 0 1 1 20 11.5Z" />,
  mail: <path d="M4.5 5.75h15a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6.75a1 1 0 0 1 1-1ZM4 6.5l8 6.25 8-6.25" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2" />,
  camera: <path d="M4 8.5a2 2 0 0 1 2-2h1.75l1.5-2h5.5l1.5 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9ZM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.55a1 1 0 0 0 1 .95h7.4a1 1 0 0 0 1-.95L17.5 7M10 11v5.5M14 11v5.5" />,
  external: <path d="M8 16 16.5 7.5M10 7.5h6.5V14" />,
  logout: <path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3M10 16.5 5.5 12 10 7.5M5.5 12h10" />,
  alert: <path d="M12 9v4.5m0 3.25v.01M10.3 4.3 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />,
  info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.75v.01" />,
  link: <path d="M10 14a4 4 0 0 0 5.66 0l3-3A4 4 0 0 0 13 5.34l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3A4 4 0 0 0 11 18.66l1-1" />,
  copy: <path d="M9 9h9.5a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1ZM16 9V5.5a1 1 0 0 0-1-1H5.5a1 1 0 0 0-1 1V15a1 1 0 0 0 1 1H8" />,
  pencil: <path d="m4.5 19.5 1-4.25L15.75 5a2 2 0 0 1 2.83 0l.42.42a2 2 0 0 1 0 2.83L8.75 18.5l-4.25 1Z" />,
  eye: <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  tray: <path d="M3.5 13.5 6 5.5h12l2.5 8v5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-5ZM3.5 13.5h5l1 2h5l1-2h5" />,
  note: <path d="M6 3.5h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1ZM8.5 8.5h7M8.5 12h7M8.5 15.5h4" />,
  tasks: <path d="M10 6.5h9.5M10 12h9.5M10 17.5h9.5M4.5 6.5l1.25 1.25L8 5.5M4.5 12l1.25 1.25L8 11M4.5 17.5l1.25 1.25L8 16.5" />,
  globe: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3Z" />,
  video: <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h9A1.5 1.5 0 0 1 16 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16.5v-9ZM16 10.5 20 8v8l-4-2.5" />,
  pin: <path d="M12 21s-6.5-5.75-6.5-11a6.5 6.5 0 0 1 13 0c0 5.25-6.5 11-6.5 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  upload: <path d="M12 15.5v-11M7.5 9 12 4.5 16.5 9M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15" />,
  photo: <path d="M5.5 4.5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1ZM4.5 15.5l4-4 4 4 2.5-2.5 4.5 4.5M15 9.5h.01" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  grip: (
    <g fill="currentColor" stroke="none">
      <circle cx="9" cy="6.5" r="1.5" />
      <circle cx="15" cy="6.5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17.5" r="1.5" />
      <circle cx="15" cy="17.5" r="1.5" />
    </g>
  ),
  star: <path d="m12 4 2.47 5 5.53.8-4 3.9.94 5.5L12 16.6l-4.94 2.6.94-5.5-4-3.9 5.53-.8L12 4Z" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, strokeWidth = 1.7, ...props }: { name: IconName; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {PATHS[name]}
    </svg>
  );
}
