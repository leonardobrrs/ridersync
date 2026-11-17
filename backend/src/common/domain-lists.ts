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

/** Sugestões de cidades (escopo inicial: Alagoas). Campo continua livre. */
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

export const UF = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
