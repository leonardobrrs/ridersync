import type { ApplicationStatus, BookingStatus, CompatStatus, EventStatus, OfferStatus } from './types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const money = (cents: number | null | undefined) => (cents == null ? '—' : brl.format(cents / 100));

const TZ = 'America/Maceio';
export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const dayMonth = (iso: string) => {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit' }),
    month: d.toLocaleDateString('pt-BR', { timeZone: TZ, month: 'short' }).replace('.', ''),
  };
};
export const duration = (min: number | null | undefined) => {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
};

/** ISO → valor para <input type="datetime-local"> no fuso de Maceió (UTC-3, sem horário de verão). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000);
  return d.toISOString().slice(0, 16);
}
/** <input type="datetime-local"> (horário de Maceió) → ISO com offset. */
export function fromLocalInput(v: string): string {
  return `${v}:00-03:00`;
}

export const centsFromReais = (v: string | number | null | undefined) => {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
export const reaisFromCents = (c: number | null | undefined) => (c == null ? '' : String(c / 100));

type Tone = 'ok' | 'parcial' | 'falta' | 'conferir' | 'pend' | 'pub' | 'draft' | 'neutral' | 'info';

export const EVENT_STATUS: Record<EventStatus, [string, Tone]> = {
  DRAFT: ['Rascunho', 'draft'],
  OPEN: ['Inscrições abertas', 'pub'],
  CLOSED: ['Inscrições encerradas', 'neutral'],
  COMPLETED: ['Concluído', 'info'],
  CANCELLED: ['Cancelado', 'falta'],
};
export const APPLICATION_STATUS: Record<ApplicationStatus, [string, Tone]> = {
  PENDING: ['Em análise', 'pend'],
  ACCEPTED: ['Selecionada', 'ok'],
  REJECTED: ['Não selecionada', 'falta'],
  WITHDRAWN: ['Retirada', 'neutral'],
};
export const BOOKING_STATUS: Record<BookingStatus, [string, Tone]> = {
  NEGOTIATING: ['Em negociação', 'pend'],
  AGREED: ['Termos aceitos — aguardando confirmação', 'info'],
  CONFIRMED: ['Contratação confirmada', 'ok'],
  DECLINED: ['Recusada', 'falta'],
  CANCELLED: ['Encerrada', 'neutral'],
};
export const OFFER_STATUS: Record<OfferStatus, [string, Tone]> = {
  PENDING: ['Aguardando resposta', 'pend'],
  ACCEPTED: ['Aceita', 'ok'],
  DECLINED: ['Recusada', 'falta'],
  SUPERSEDED: ['Substituída por contraproposta', 'neutral'],
  WITHDRAWN: ['Retirada', 'neutral'],
};
export const COMPAT_STATUS: Record<CompatStatus, [string, Tone]> = {
  COMPATIBLE: ['Compatível', 'ok'],
  PARTIALLY_AVAILABLE: ['Parcialmente disponível', 'parcial'],
  UNAVAILABLE: ['Indisponível', 'falta'],
  NEEDS_CHECK: ['Conferir com a casa', 'conferir'],
};
export const ROLE_LABEL: Record<string, string> = { OWNER: 'Proprietário', ADMIN: 'Administrador', MEMBER: 'Integrante' };
export const SIDE_LABEL = { VENUE: 'Casa', ARTIST: 'Artista' } as const;
export const PORTFOLIO_KIND: Record<string, string> = { AUDIO: 'Áudio', VIDEO: 'Vídeo', PHOTO: 'Foto', DOCUMENT: 'Documento', LINK: 'Link' };
