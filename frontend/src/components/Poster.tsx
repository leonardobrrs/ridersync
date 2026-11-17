/** Capa em estilo cartaz de show (identidade dos protótipos). Usa a foto quando existe. */
const PALETTES: [string, string][] = [
  ['#FFC83A', '#1B1500'],
  ['#0B766E', '#F1F2F0'],
  ['#151719', '#FFC83A'],
  ['#E0443F', '#FFF4E8'],
  ['#3F5F75', '#F1F2F0'],
  ['#EDE3CF', '#151719'],
  ['#1E7A45', '#F5F0E6'],
  ['#5B3C88', '#FFC83A'],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

export function Poster({
  name,
  top,
  bottom,
  photoUrl,
  ratio,
  className = '',
}: {
  name: string;
  top?: [string, string?];
  bottom?: [string, string?];
  photoUrl?: string | null;
  ratio?: string;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <div className={`cover ${className}`} style={ratio ? { aspectRatio: ratio } : undefined}>
        <img src={photoUrl} alt="" loading="lazy" />
      </div>
    );
  }
  const h = hash(name);
  const [pb, pf] = PALETTES[h % PALETTES.length];
  return (
    <div
      className={`cover poster p${h % 4} ${className}`}
      style={{ ['--pb' as string]: pb, ['--pf' as string]: pf, ...(ratio ? { aspectRatio: ratio } : {}) }}
      aria-hidden="true"
    >
      <div className="pt">
        <span>{top?.[0] ?? ''}</span>
        <span>{top?.[1] ?? ''}</span>
      </div>
      <div className="pn">{name}</div>
      <div className="pr">
        <span>{bottom?.[0] ?? ''}</span>
        <span>{bottom?.[1] ?? ''}</span>
      </div>
    </div>
  );
}

export function Avatar({ name, photoUrl, size = 44 }: { name: string; photoUrl?: string | null; size?: number }) {
  const h = hash(name);
  const [pb, pf] = PALETTES[h % PALETTES.length];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span className="av" style={{ width: size, height: size, background: pb, color: pf, fontSize: size * 0.42 }} aria-hidden="true">
      {photoUrl ? <img src={photoUrl} alt="" /> : initials}
    </span>
  );
}
