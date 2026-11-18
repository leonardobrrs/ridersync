/** Listas de referência do domínio (fonte única exposta em GET /api/meta). */
export const GENRES = [
  'MPB',
  'Forró',
  'Coco de roda',
  'Samba',
  'Pagode',
  'Rock',
  'Indie',
  'Jazz',
  'Sertanejo',
  'Eletrônico',
  'Brega',
  'Reggae',
  'Rap / Hip-hop',
  'Pop',
  'Instrumental',
  'Gospel',
] as const;

export const FORMATS = ['Solo', 'Duo', 'Trio', 'Com banda'] as const;

export const INSTRUMENTS = [
  'Voz',
  'Violão',
  'Guitarra',
  'Baixo',
  'Bateria',
  'Teclado',
  'Sanfona',
  'Percussão',
  'Sopros',
  'Cordas',
  'DJ',
] as const;

export const VENUE_KINDS = ['Casa de show', 'Bar com música', 'Teatro', 'Espaço cultural', 'Restaurante'] as const;

export const PAYMENT_TYPES = ['Cachê fixo', 'Bilheteria', 'Couvert artístico', 'A combinar'] as const;

export { AL_CITIES } from './al-cities';

/** Cidades em destaque nos filtros (as demais continuam disponíveis no preenchimento automático). */
export const CITY_SUGGESTIONS = [
  'Maceió',
  'Arapiraca',
  'Penedo',
  'Marechal Deodoro',
  'Maragogi',
  'Palmeira dos Índios',
  'Rio Largo',
  'União dos Palmares',
  'São Miguel dos Campos',
  'Delmiro Gouveia',
] as const;

/** Localidade restrita a Alagoas (requisito: só há preenchimento automático de cidades para AL). */
export const UF = ['AL'] as const;

/** Função/cargo do integrante na banda (informativo; o papel de permissão é OWNER/ADMIN/MEMBER). */
export const BAND_POSITIONS = [
  'Vocal',
  'Vocal de apoio',
  'Guitarra',
  'Violão',
  'Baixo',
  'Bateria',
  'Percussão',
  'Teclado',
  'Sanfona',
  'Sopros',
  'Cordas',
  'DJ',
  'Produção musical',
  'Direção musical',
  'Técnico de som',
  'Empresário(a)',
  'Outra função',
] as const;
