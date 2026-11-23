import { INSTRUMENT_ICONS } from './instrument-icons';

const PATHS: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.3-4.3',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 7m6 9a7 7 0 0 0-4-6.3',
  home: 'M4 11 12 4l8 7v9H4Zm6 9v-6h4v6',
  music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  calendar: 'M4 6h16v14H4ZM4 10h16M8 3v4m8-4v4',
  chat: 'M4 5h16v11H9l-5 4Z',
  venue: 'M3 21V9l9-6 9 6v12M9 21v-6h6v6',
  plug: 'M9 3v6m6-6v6M6 9h12v3a6 6 0 0 1-12 0Zm6 9v3',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  ticket: 'M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 0 0-4V4H3Z',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12l5 5L20 7',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3 2-1-2-4-2 1-2-1-1-2H10L9 7 7 8 5 7l-2 4 2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1Z',
  compare: 'M7 4v16M17 4v16M3 8h8M13 16h8',
  mail: 'M3 5h18v14H3Zm0 0 9 8 9-8',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13',
  arrowLeft: 'M19 12H5m6-6-6 6 6 6',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.1 6.1A17.4 17.4 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.9-1.9M9.9 9.9a3 3 0 0 0 4.2 4.2',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9Zm4.3 13a2 2 0 0 0 3.4 0',
  lock: 'M6 11h12v10H6Zm2 0V7a4 4 0 0 1 8 0v4',
  pin: 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2',
  play: 'M8 5v14l11-7Z',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  guitar: 'M14 7l3-3 3 3-3 3M17 4l-6 6m-1.5 2.5a4 4 0 1 0 2 2l-2-2Z',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm-7-3a7 7 0 0 0 14 0M12 19v3',
  grid: 'M4 4h7v7H4Zm9 0h7v7h-7ZM4 13h7v7H4Zm9 0h7v7h-7Z',
  // Contatos (traço fino, mesmo estilo dos demais)
  instagram: 'M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3Zm4.5 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm5-9h.01',
  phone: 'M5.5 3.5h3l1.8 4.6-2.3 1.4a11.5 11.5 0 0 0 6.5 6.5l1.4-2.3 4.6 1.8v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3.5 5.6a2 2 0 0 1 2-2.1Z',
  whatsapp: 'M3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 8 19.3Zm5.6-12c-.6 0-1 .6-.9 1.3.4 2.8 3 5.4 5.9 5.8.7.1 1.3-.4 1.3-1v-1.1l-2-.8-.8.8a4.5 4.5 0 0 1-2.4-2.4l.8-.8-.8-2Z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9M12 3C9.5 5.5 8.2 8.5 8.2 12s1.3 6.5 3.8 9',
  chevronDown: 'M6 9l6 6 6-6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-14v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
};

export function Icon({ name, size = 20, label }: { name: keyof typeof PATHS | string; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {INSTRUMENT_ICONS[name] ? (
        INSTRUMENT_ICONS[name].map(([Tag, attrs], i) => <Tag key={i} {...attrs} />)
      ) : (
        <path d={PATHS[name] ?? PATHS.list} />
      )}
    </svg>
  );
}
