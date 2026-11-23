import { formatPhone, phoneDigits } from '../lib/phone';
import { Icon } from './Icon';

export interface PublicContacts {
  instagram?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
}

/** Celular brasileiro (DDD + 9 dígitos começando com 9): só esses ganham o atalho de WhatsApp. */
const isMobile = (digits: string) => digits.length === 11 && digits[2] === '9';

/** Links de contato a partir dos campos públicos. Só aparecem os informados. */
function contactItems(c: PublicContacts) {
  const items: { key: string; icon: string; label: string; text: string; href: string; external: boolean }[] = [];
  if (c.instagram) items.push({ key: 'ig', icon: 'instagram', label: `Instagram @${c.instagram}`, text: `@${c.instagram}`, href: `https://instagram.com/${c.instagram}`, external: true });
  if (c.phone) {
    const d = phoneDigits(c.phone);
    items.push({ key: 'tel', icon: 'phone', label: `Telefone ${formatPhone(c.phone)}`, text: formatPhone(c.phone), href: `tel:+55${d}`, external: false });
    if (isMobile(d)) items.push({ key: 'wa', icon: 'whatsapp', label: `WhatsApp ${formatPhone(c.phone)}`, text: 'WhatsApp', href: `https://wa.me/55${d}`, external: true });
  }
  if (c.email) items.push({ key: 'mail', icon: 'mail', label: `E-mail ${c.email}`, text: c.email, href: `mailto:${c.email}`, external: false });
  if (c.website) {
    let host = c.website;
    try {
      host = new URL(c.website).hostname.replace(/^www\./, '');
    } catch {
      /* mantém o texto original */
    }
    items.push({ key: 'web', icon: 'globe', label: `Site ${host}`, text: host, href: c.website, external: true });
  }
  return items;
}

/** Fileira compacta de ícones (topo do perfil). */
export function ContactIcons({ contacts }: { contacts: PublicContacts }) {
  const items = contactItems(contacts);
  if (!items.length) return null;
  return (
    <ul className="contact-icons" aria-label="Contatos">
      {items.map((i) => (
        <li key={i.key}>
          <a href={i.href} aria-label={i.label} title={i.label} {...(i.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            <Icon name={i.icon} size={18} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Lista de contatos com ícone e texto (caixa "Contatos públicos"). */
export function ContactList({ contacts }: { contacts: PublicContacts }) {
  const items = contactItems(contacts);
  if (!items.length) return <p className="hint">Nenhum contato público informado.</p>;
  return (
    <ul className="contact-list">
      {items.map((i) => (
        <li key={i.key}>
          <a href={i.href} aria-label={i.label} {...(i.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            <span className="ci-ico" aria-hidden="true">
              <Icon name={i.icon} size={16} />
            </span>
            <span className="ci-txt">{i.text}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
