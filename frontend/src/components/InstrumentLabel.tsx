import { instrumentIcon } from '../lib/instruments';
import { Icon } from './Icon';

/** Instrumento/função com o ícone correspondente. O texto exibido é o valor original. */
export function InstrumentLabel({ value, size = 14, className = 'inst' }: { value: string; size?: number; className?: string }) {
  return (
    <span className={className}>
      <Icon name={instrumentIcon(value)} size={size} />
      {value}
    </span>
  );
}
