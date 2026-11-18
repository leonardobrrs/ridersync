import type { NotificationCategory } from '@prisma/client';

export interface NotificationInput {
  category: NotificationCategory;
  type: string;
  title: string;
  body?: string;
  link?: string | null;
  /** Identifica a ocorrência: a mesma chave para o mesmo destinatário nunca gera duas notificações/e-mails. */
  dedupeKey: string;
}

/** Categorias cujo e-mail independe da preferência (segurança e funcionamento da conta). */
export const MANDATORY_EMAIL_CATEGORIES: NotificationCategory[] = ['ACCOUNT'];

export const PREFERENCE_FIELD: Record<Exclude<NotificationCategory, 'ACCOUNT'>, 'emailInvitations' | 'emailApplications' | 'emailBookings' | 'emailEvents'> = {
  INVITATIONS: 'emailInvitations',
  APPLICATIONS: 'emailApplications',
  BOOKINGS: 'emailBookings',
  EVENTS: 'emailEvents',
};

export interface EmailPreferences {
  emailEnabled: boolean;
  emailInvitations: boolean;
  emailApplications: boolean;
  emailBookings: boolean;
  emailEvents: boolean;
}

export const DEFAULT_PREFERENCES: EmailPreferences = {
  emailEnabled: true,
  emailInvitations: true,
  emailApplications: true,
  emailBookings: true,
  emailEvents: true,
};

/** Regra pura: decide se uma notificação desta categoria gera e-mail para o destinatário. */
export function shouldEmail(category: NotificationCategory, prefs: EmailPreferences | null | undefined): boolean {
  if (MANDATORY_EMAIL_CATEGORIES.includes(category)) return true;
  const p = prefs ?? DEFAULT_PREFERENCES;
  if (!p.emailEnabled) return false;
  return p[PREFERENCE_FIELD[category as Exclude<NotificationCategory, 'ACCOUNT'>]];
}
