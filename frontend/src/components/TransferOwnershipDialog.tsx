import { useState } from 'react';
import { ApiError } from '../lib/api';
import { CountdownButton, Dialog } from './Dialog';
import { FormError } from './Fields';
import { PasswordField } from './PasswordField';

interface Candidate {
  id: string;
  name: string;
}

/**
 * Transferência de propriedade (banda ou casa): explica a consequência, pede confirmação e a senha;
 * o botão final só aparece após a senha e libera o clique depois de 3 segundos.
 */
export function TransferOwnershipDialog({
  open,
  onClose,
  entityLabel,
  entityName,
  candidates,
  onTransfer,
}: {
  open: boolean;
  onClose: () => void;
  entityLabel: 'banda' | 'casa';
  entityName: string;
  candidates: Candidate[];
  onTransfer: (memberId: string, password: string) => Promise<unknown>;
}) {
  const [memberId, setMemberId] = useState('');
  const [password, setPassword] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = candidates.find((c) => c.id === memberId);

  const close = () => {
    setMemberId('');
    setPassword('');
    setSure(false);
    setError(null);
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onTransfer(memberId, password);
      close();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível transferir.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} title="Transferir propriedade">
      <div className="stack">
        <div className="inline-msg warn" role="note">
          <strong>A propriedade de {entityName} será alterada.</strong> A pessoa escolhida passa a ser a proprietária da {entityLabel}: poderá
          alterar papéis, remover integrantes e transferir a propriedade novamente. Você continuará como administrador(a).
        </div>
        {candidates.length === 0 ? (
          <p className="muted">Não há outro integrante ativo para receber a propriedade.</p>
        ) : (
          <>
            <label className="field">
              <span>Novo(a) proprietário(a)</span>
              <select className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">Escolha um integrante ativo</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {target && (
              <label className="check">
                <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
                Tenho certeza de que quero transferir a propriedade para <strong>{target.name}</strong>.
              </label>
            )}
            {target && sure && (
              <PasswordField
                label="Confirme com a sua senha"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </>
        )}
        <FormError message={error} />
        <div className="row dlg-actions">
          <button type="button" className="btn" onClick={close} disabled={busy}>
            Cancelar
          </button>
          {target && sure && password.length > 0 && (
            <CountdownButton key={`${memberId}-${password.length > 0}`} busy={busy} onClick={submit}>
              Transferir propriedade
            </CountdownButton>
          )}
        </div>
      </div>
    </Dialog>
  );
}
