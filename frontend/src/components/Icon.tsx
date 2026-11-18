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
  // Instrumentos e funções musicais (mesmo traço 24×24 dos demais; mapeamento em lib/instruments.ts)
  acousticGuitar: 'M13 11l7-7m-2-1 3 3M9.6 10.4a3 3 0 0 0-4.7 1.3 3.5 3.5 0 0 0-1.2 5.7l1 1a3.5 3.5 0 0 0 5.7-1.2 3 3 0 0 0 1.3-4.7ZM8 16.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  electricGuitar: 'M13 11l7-7m-2-1 3 3M11 9 6.5 7.5l.8 3.7L3.5 14l4 4.5 3-3.8 3.7.8ZM7.5 15l2.5-2.5',
  bass: 'M11.5 12.5 21 3m-2.5-.5 3 3M17 2.5l.9.9M21.6 7.1l-.9-.9M10 11 6 9.5l.6 3.4L3.5 15.5l3.5 4 2.7-3.1 3.3.6ZM7 16l2.2-2.2',
  drums: 'M4 10c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6M8 12.6v6M16 12.6v6M7 3l4 5M17 3l-4 5',
  keys: 'M3 6h18v12H3Zm4.5 0v12m4.5-12v12m4.5-12v12M6 6v6h3V6m4.5 0v6h3V6',
  accordion: 'M3 6h4v12H3Zm14 0h4v12h-4ZM7 7l2.5 10L12 7l2.5 10L17 7',
  percussion: 'M7 4h10l-1.5 16h-7Zm0 0c0 1.1 2.2 2 5 2s5-.9 5-2M7.7 11h8.6M8.3 16h7.4',
  winds: 'M3 10h9l5-4v12l-5-4H3Zm3 0V7m3 3V7M6 7h3M17 9h2.5M17 15h2.5',
  strings: 'M12 2v5m-2-3.5h4M10 7c-2.2 0-3.2 1.7-2.2 3.3-2.2 1-2.7 4.2-1.1 6.2 1.6 2.1 8.4 2.1 10 0 1.6-2-1.1-5.2-1.1-6.2 1-1.6 0-3.3-2.2-3.3ZM12 11v5m-2 0h4M9.5 22h5',
  dj: 'M3 5h18v14H3Zm8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-3h.01M17.5 8v6.5L16 16',
  sliders: 'M6 4v16M12 4v16M18 4v16M4 15h4M10 8h4M16 12h4',
  baton: 'M4 20 16 8m0 0 1.5-1.5a2 2 0 1 1 2.8 2.8L18.8 10.8M16 8l2.8 2.8M4 4h.01M7 3.5h.01M4 7.5h.01',
  briefcase: 'M3 8h18v11H3Zm6 0V5h6v3M3 13h18',
  headphones: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4Zm13 0h3v5h-3Z',
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
      <path d={PATHS[name] ?? PATHS.list} />
    </svg>
  );
}
