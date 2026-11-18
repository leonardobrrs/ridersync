/**
 * Ícones de instrumentos e funções musicais (filtro da página inicial, cards, perfis e integrantes).
 *
 * Desenhos marcados como "Lucide" são cópias de Lucide Icons v1.68.0 (https://lucide.dev), licença ISC:
 *   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
 *   All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *   Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is
 *   hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
 * Os marcados como "RiderSync" foram desenhados para o projeto seguindo a mesma grade (24×24, traço 2,
 * pontas arredondadas), pois não há equivalente no Lucide.
 */
export type IconNode = ReadonlyArray<readonly ['path' | 'circle' | 'ellipse' | 'rect', Readonly<Record<string, string | number>>]>;

export const INSTRUMENT_ICONS: Record<string, IconNode> = {
  // Voz / vocal — Lucide "mic-vocal"
  'inst-voice': [
    ['path', { d: 'm11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12' }],
    ['path', { d: 'M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5' }],
    ['circle', { cx: 16, cy: 7, r: 5 }],
  ],
  // Vocal de apoio — Lucide "mic"
  'inst-backing-vocal': [
    ['path', { d: 'M12 19v3' }],
    ['path', { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }],
    ['rect', { x: 9, y: 2, width: 6, height: 13, rx: 3 }],
  ],
  // Violão — Lucide "guitar"
  'inst-acoustic-guitar': [
    ['path', { d: 'm11.9 12.1 4.514-4.514' }],
    ['path', { d: 'M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z' }],
    ['path', { d: 'm6 16 2 2' }],
    ['path', { d: 'M8.23 9.85A3 3 0 0 1 11 8a5 5 0 0 1 5 5 3 3 0 0 1-1.85 2.77l-.92.38A2 2 0 0 0 12 18a4 4 0 0 1-4 4 6 6 0 0 1-6-6 4 4 0 0 1 4-4 2 2 0 0 0 1.85-1.23z' }],
  ],
  // Guitarra — Lucide "guitar-electric"
  'inst-electric-guitar': [
    ['path', { d: 'm12.172 11.828 4.242-4.242' }],
    ['path', { d: 'M16.414 7.586A2 2 0 0017 6.172V5a2 2 0 011.177-1.823L20.59 2.09a1 1 0 011.32 1.32l-1.088 2.412A2 2 0 0119 7h-1a2 2 0 00-1.586.586' }],
    ['path', { d: 'm6 16 2 2' }],
    ['path', { d: 'M8.23 9.85a3 3 0 011.28-1.454 1 1 0 011.496.815 4 4 0 003.783 3.783 1 1 0 01.815 1.496 3 3 0 01-1.454 1.28l-.92.38A2 2 0 0012 18a4 4 0 01-4 4 6 6 0 01-6-6 4 4 0 014-4 2 2 0 001.85-1.23z' }],
  ],
  // Baixo (corpo menor, braço longo, 4 tarraxas) — RiderSync
  'inst-bass': [
    ['path', { d: 'M8.23 9.85a3 3 0 011.28-1.454 1 1 0 011.496.815 4 4 0 003.783 3.783 1 1 0 01.815 1.496 3 3 0 01-1.454 1.28l-.92.38A2 2 0 0012 18a4 4 0 01-4 4 6 6 0 01-6-6 4 4 0 014-4 2 2 0 001.85-1.23z', transform: 'translate(2 22) scale(0.82) translate(-2 -22)' }],
    ['path', { d: 'm6 16 2 2', transform: 'translate(2 22) scale(0.82) translate(-2 -22)' }],
    ['path', { d: 'm10.3 13.7 8.2-8.2' }],
    ['path', { d: 'M18.5 5.5 21 3' }],
    ['path', { d: 'M19.2 2.8h.01M21.2 4.8h.01M17.6 4.4h.01M19.6 6.4h.01' }],
  ],
  // Bateria — Lucide "drum"
  'inst-drums': [
    ['path', { d: 'm2 2 8 8' }],
    ['path', { d: 'm22 2-8 8' }],
    ['ellipse', { cx: 12, cy: 9, rx: 10, ry: 5 }],
    ['path', { d: 'M7 13.4v7.9' }],
    ['path', { d: 'M12 14v8' }],
    ['path', { d: 'M17 13.4v7.9' }],
    ['path', { d: 'M2 9v8a10 5 0 0 0 20 0V9' }],
  ],
  // Percussão (atabaque) — RiderSync
  'inst-percussion': [
    ['ellipse', { cx: 12, cy: 4.5, rx: 5, ry: 2 }],
    ['path', { d: 'M7 4.5c0 4 2 6.5 2 9.5v5.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V14c0-3 2-5.5 2-9.5' }],
    ['path', { d: 'M8.3 10h7.4M9 15.5h6' }],
  ],
  // Teclado — Lucide "keyboard-music"
  'inst-keys': [
    ['rect', { width: 20, height: 16, x: 2, y: 4, rx: 2 }],
    ['path', { d: 'M6 8h4' }],
    ['path', { d: 'M14 8h.01' }],
    ['path', { d: 'M18 8h.01' }],
    ['path', { d: 'M2 12h20' }],
    ['path', { d: 'M6 12v4' }],
    ['path', { d: 'M10 12v4' }],
    ['path', { d: 'M14 12v4' }],
    ['path', { d: 'M18 12v4' }],
  ],
  // Piano — Lucide "piano"
  'inst-piano': [
    ['path', { d: 'M10 13v4' }],
    ['path', { d: 'M14 13v4' }],
    ['path', { d: 'M18 13v4' }],
    ['path', { d: 'M2 13h20' }],
    ['path', { d: 'M22 11.5A3.5 3.5 0 0018.5 8a3.52 3.52 0 01-3.173-2A7 7 0 002 9v10a2 2 0 002 2h16a2 2 0 002-2z' }],
    ['path', { d: 'M6 13v4' }],
  ],
  // Sanfona — RiderSync
  'inst-accordion': [
    ['rect', { x: 2, y: 5, width: 5, height: 14, rx: 1.5 }],
    ['rect', { x: 17, y: 5, width: 5, height: 14, rx: 1.5 }],
    ['path', { d: 'M7 6.5 9.5 8 12 6.5 14.5 8 17 6.5' }],
    ['path', { d: 'M7 17.5 9.5 16 12 17.5 14.5 16 17 17.5' }],
    ['path', { d: 'M9.5 8v8M12 6.5v11M14.5 8v8' }],
    ['path', { d: 'M4.5 8.5h.01M4.5 12h.01M4.5 15.5h.01M19.5 9h.01M19.5 12h.01M19.5 15h.01' }],
  ],
  // Sopros (trompete) — RiderSync
  'inst-winds': [
    ['path', { d: 'M2 10.5v3M2 12h13.5' }],
    ['path', { d: 'M15.5 10.5c2.2 0 3.8-1.6 5.5-4v11c-1.7-2.4-3.3-4-5.5-4Z' }],
    ['path', { d: 'M5.5 12v2.5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V13.5' }],
    ['path', { d: 'M8 12V8.5M10.5 12V8.5M13 12V8.5' }],
    ['path', { d: 'M7.3 8.5h1.4M9.8 8.5h1.4M12.3 8.5h1.4' }],
  ],
  // Cordas (violino) — RiderSync
  'inst-strings': [
    ['path', { d: 'M12 1.5V8M10.8 2h2.4' }],
    ['path', { d: 'M12 8C9.2 8 7.8 9.3 7.8 11.2c0 1.2 1.1 1.7 1.1 2.4s-1.9 1.3-1.9 3.6c0 3 2.2 5.3 5 5.3s5-2.3 5-5.3c0-2.3-1.9-2.9-1.9-3.6s1.1-1.2 1.1-2.4C16.2 9.3 14.8 8 12 8Z' }],
    ['path', { d: 'M12 8v10.5M10.5 18.5h3M9.7 13.2v1.6M14.3 13.2v1.6' }],
  ],
  // DJ — Lucide "disc-3"
  'inst-dj': [
    ['circle', { cx: 12, cy: 12, r: 10 }],
    ['path', { d: 'M6 12c0-1.7.7-3.2 1.8-4.2' }],
    ['circle', { cx: 12, cy: 12, r: 2 }],
    ['path', { d: 'M18 12c0 1.7-.7 3.2-1.8 4.2' }],
  ],
  // Produção musical — Lucide "sliders-vertical"
  'inst-production': [
    ['path', { d: 'M10 8h4' }],
    ['path', { d: 'M12 21v-9' }],
    ['path', { d: 'M12 8V3' }],
    ['path', { d: 'M17 16h4' }],
    ['path', { d: 'M19 12V3' }],
    ['path', { d: 'M19 21v-5' }],
    ['path', { d: 'M3 14h4' }],
    ['path', { d: 'M5 10V3' }],
    ['path', { d: 'M5 21v-7' }],
  ],
  // Direção musical — Lucide "metronome"
  'inst-direction': [
    ['path', { d: 'M12 11.4V9.1' }],
    ['path', { d: 'm12 17 6.59-6.59' }],
    ['path', { d: 'm15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2' }],
    ['circle', { cx: 20, cy: 9, r: 2 }],
  ],
  // Técnico de som — Lucide "headphones"
  'inst-sound-tech': [
    ['path', { d: 'M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3' }],
  ],
  // Empresário(a) — Lucide "briefcase-business"
  'inst-manager': [
    ['path', { d: 'M12 12h.01' }],
    ['path', { d: 'M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2' }],
    ['path', { d: 'M22 13a18.15 18.15 0 0 1-20 0' }],
    ['rect', { width: 20, height: 14, x: 2, y: 6, rx: 2 }],
  ],
  // Outra função / genérico — Lucide "music"
  'inst-other': [
    ['path', { d: 'M21 16V3a1 1 0 0 0-1.28-.96l-10 2.917a1 1 0 0 0-.72.96V19' }],
    ['circle', { cx: 18, cy: 16, r: 3 }],
    ['circle', { cx: 6, cy: 19, r: 3 }],
  ],
};
