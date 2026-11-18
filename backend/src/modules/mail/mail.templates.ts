import type { MailMessage } from './mail.transport';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

interface LayoutInput {
  to: string;
  subject: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer?: string[];
}

/** Monta HTML e texto simples a partir de conteúdo sempre escapado (nenhum dado do usuário vira HTML). */
export function renderEmail(input: LayoutInput): MailMessage {
  const p = input.paragraphs.map((t) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(t)}</p>`).join('');
  const button = input.action
    ? `<p style="margin:22px 0"><a href="${escapeHtml(input.action.url)}" style="background:#FFC83A;color:#151719;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">${escapeHtml(input.action.label)}</a></p>
       <p style="margin:0 0 14px;font-size:13px;color:#555">Se o botão não funcionar, copie e cole este endereço no navegador:<br>${escapeHtml(input.action.url)}</p>`
    : '';
  const footer = (input.footer ?? []).map((t) => `<p style="margin:0 0 6px;font-size:12px;color:#777">${t}</p>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f1f2f0;font-family:Arial,Helvetica,sans-serif;color:#151719">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#151719;color:#FFC83A;font-weight:900;letter-spacing:.06em;padding:14px 20px;border-radius:10px 10px 0 0">RIDERSYNC</div>
<div style="background:#fff;padding:24px 20px;border-radius:0 0 10px 10px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(input.heading)}</h1>${p}${button}
</div>${footer ? `<div style="padding:14px 6px">${footer}</div>` : ''}
</div></body></html>`;
  const text = [
    input.heading,
    '',
    ...input.paragraphs,
    ...(input.action ? ['', `${input.action.label}: ${input.action.url}`] : []),
    ...(input.footer?.length ? ['', ...input.footer.map(stripTags)] : []),
  ].join('\n');
  return { to: input.to, subject: input.subject, html, text };
}

const stripTags = (s: string) => s.replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, '$2: $1').replace(/<[^>]+>/g, '');

export function verificationEmail(to: string, name: string, url: string) {
  return renderEmail({
    to,
    subject: 'Confirme seu e-mail no RiderSync',
    heading: `Olá, ${name}!`,
    paragraphs: [
      'Recebemos um cadastro no RiderSync com este endereço de e-mail.',
      'Para confirmar que é você e ativar todos os recursos da conta, use o botão abaixo. O link vale por 24 horas e só pode ser usado uma vez.',
      'Se você não criou esta conta, ignore esta mensagem.',
    ],
    action: { label: 'Confirmar e-mail', url },
  });
}

export function passwordResetEmail(to: string, name: string, url: string) {
  return renderEmail({
    to,
    subject: 'Redefinição de senha do RiderSync',
    heading: `Olá, ${name}`,
    paragraphs: [
      'Recebemos um pedido para redefinir a senha da sua conta.',
      'O link abaixo vale por 1 hora e só pode ser usado uma vez. Ao redefinir, todas as sessões abertas serão encerradas.',
      'Se você não pediu a redefinição, ignore esta mensagem: sua senha atual continua valendo.',
    ],
    action: { label: 'Criar nova senha', url },
  });
}

export function notificationEmail(input: {
  to: string;
  title: string;
  body: string;
  url: string | null;
  preferencesUrl: string;
  unsubscribeUrl: string | null;
}) {
  const footer = [`Gerencie suas notificações em <a href="${escapeHtml(input.preferencesUrl)}">${escapeHtml(input.preferencesUrl)}</a>.`];
  if (input.unsubscribeUrl) {
    footer.push(`Para não receber mais e-mails de notificação, <a href="${escapeHtml(input.unsubscribeUrl)}">desative com um clique</a>.`);
  } else {
    footer.push('Este é um aviso de segurança/funcionamento da conta e é enviado mesmo com as notificações por e-mail desativadas.');
  }
  return renderEmail({
    to: input.to,
    subject: `RiderSync: ${input.title}`,
    heading: input.title,
    paragraphs: input.body ? [input.body] : [],
    action: input.url ? { label: 'Abrir no RiderSync', url: input.url } : undefined,
    footer,
  });
}
