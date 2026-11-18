import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

/** Abre a versão principal (até 1600 px) da imagem em tamanho natural, sem ampliar além da resolução real. */
export function ImageLightbox({ src, alt, open, onClose }: { src: string; alt: string; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={alt} wide>
      <div className="lightbox">
        <img src={src} alt={alt} />
      </div>
    </Dialog>
  );
}

/**
 * Foto de destaque do perfil: a imagem inteira (object-fit: contain) sobre um fundo desfocado da própria foto,
 * em vez de recortar e ampliar a miniatura — evita o aspecto "estourado" em telas grandes.
 */
export function ProfilePhoto({ thumbUrl, largeUrl, name }: { thumbUrl: string | null; largeUrl: string | null; name: string }) {
  const [open, setOpen] = useState(false);
  if (!thumbUrl || !largeUrl) return null;
  return (
    <>
      <button type="button" className="hero-photo" onClick={() => setOpen(true)} aria-label={`Ampliar foto de ${name}`}>
        <span className="hero-photo-bg" style={{ backgroundImage: `url("${thumbUrl}")` }} aria-hidden="true" />
        <img src={largeUrl} alt={`Foto de ${name}`} />
        <span className="hero-photo-zoom" aria-hidden="true">
          <Icon name="expand" size={18} />
        </span>
      </button>
      <ImageLightbox src={largeUrl} alt={`Foto de ${name}`} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Miniatura com fallback: se a imagem externa falhar (ex.: vídeo removido), mostra o ícone. */
export function Thumb({ src, alt, fallback }: { src: string | null; alt: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

const MAX_SIDE = 2560;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Reduz no navegador imagens muito grandes antes do envio (limite de corpo da hospedagem e uploads mais
 * rápidos). O servidor ainda valida tipo real, tamanho e reprocessa a imagem.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_UPLOAD_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
}

/** Seleção de imagem com pré-visualização (usada na criação de perfis, bandas, casas e na conta). */
export function ImagePicker({
  label,
  value,
  onChange,
  currentUrl,
  hint = 'JPG, PNG ou WEBP. Imagens grandes são reduzidas automaticamente.',
}: {
  label: string;
  value: File | null;
  onChange: (f: File | null) => void;
  currentUrl?: string | null;
  hint?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const shown = preview ?? currentUrl ?? null;
  return (
    <div className="field">
      <span className="lbl-like" id={`${id}-l`}>
        {label}
      </span>
      <div className="picker">
        <span className="picker-prev" aria-hidden={!shown}>
          {shown ? <img src={shown} alt="Pré-visualização" /> : <Icon name="user" size={28} />}
        </span>
        <div className="stack-sm">
          <input
            ref={input}
            id={id}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-labelledby={`${id}-l`}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              onChange(f ? await prepareImage(f) : null);
            }}
          />
          <div className="row">
            <button type="button" className="btn sm" onClick={() => input.current?.click()}>
              {shown ? 'Trocar imagem' : 'Escolher imagem'}
            </button>
            {value && (
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  onChange(null);
                  if (input.current) input.current.value = '';
                }}
              >
                Remover
              </button>
            )}
          </div>
          <small>{hint}</small>
        </div>
      </div>
    </div>
  );
}

export function uploadForm(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return fd;
}
