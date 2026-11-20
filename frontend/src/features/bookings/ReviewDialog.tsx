import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { FormError } from '../../components/Fields';
import { StarInput } from '../../components/Stars';
import { api, errorMessage } from '../../lib/api';

/** Avaliação pós-show (0 a 5 estrelas + comentário). O contratante avalia o artista; o artista avalia o contratante. */
export function ReviewDialog({
  open,
  onClose,
  bookingId,
  targetName,
  side,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  targetName: string;
  side: 'VENUE' | 'ARTIST' | null;
  onDone: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (rating === null) return setErr('Escolha uma nota de 0 a 5 estrelas.');
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/bookings/${bookingId}/review`, { rating, comment: comment.trim() });
      onDone();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title={side === 'ARTIST' ? `Como foi tocar com ${targetName}?` : `Como foi o show de ${targetName}?`}>
      <div className="stack">
        <p className="hint">Sua avaliação aparece no perfil público {side === 'ARTIST' ? 'do contratante' : 'do artista'}, com o seu nome.</p>
        <FormError message={err} />
        <StarInput value={rating} onChange={setRating} />
        <label className="field">
          <span>Comentário (opcional)</span>
          <textarea className="input" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} style={{ minHeight: 90 }} />
        </label>
        <div className="actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            Depois
          </button>
          <button className="btn cue" type="button" onClick={submit} disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar avaliação'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
