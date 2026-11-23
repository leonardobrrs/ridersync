import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '../lib/api';
import { isValidCpf, maskCpf } from '../lib/documents';
import { useMe } from '../lib/hooks';
import type { AccountType, AuthConfig, Me } from '../lib/types';
import { AccountTypeChooser } from './AccountTypeChooser';
import { Dialog } from './Dialog';
import { FormError } from './Fields';
import { useToast } from './Toast';

/**
 * Pendências da conta exibidas no painel: e-mail não confirmado (aviso), tipo de conta de contas
 * legadas, aceite da versão vigente da política e CPF de contas criadas com Google (modais obrigatórios).
 */
export function AccountGate() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState<AccountType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [cpf, setCpf] = useState('');
  if (!me) return null;

  const update = (next: Me) => qc.setQueryData(['me'], next);
  const run = async (fn: () => Promise<Me>) => {
    setBusy(true);
    setError(null);
    try {
      update(await fn());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  const needsType = !me.user.accountType;
  const needsTerms = !needsType && me.user.needsTermsAcceptance;
  const needsCpf = !needsType && !needsTerms && !!me.user.needsCpf;
  const cpfValid = isValidCpf(cpf);

  return (
    <>
      {!me.user.emailVerified && (
        <div className="wrap">
          <div className="inline-msg warn banner" role="status">
            <span>
              <strong>Confirme seu e-mail.</strong> Enviamos um link para <strong>{me.user.email}</strong>. A confirmação comprova que a conta é sua
              {me.features.emailVerificationRequired ? ' e é obrigatória para entrar.' : '.'}
            </span>
            <button
              type="button"
              className="btn sm"
              disabled={sent}
              onClick={async () => {
                try {
                  const r = await api.post<{ alreadyVerified: boolean }>('/auth/email-verification/resend');
                  if (r.alreadyVerified) await qc.invalidateQueries({ queryKey: ['me'] });
                  setSent(true);
                  toast('Enviamos um novo link de confirmação.');
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : 'Não foi possível reenviar.', 'error');
                }
              }}
            >
              {sent ? 'Link reenviado' : 'Reenviar link'}
            </button>
          </div>
        </div>
      )}

      <Dialog open={needsType} onClose={() => undefined} dismissible={false} title="Escolha o tipo da sua conta">
        <div className="stack">
          <p>Artistas e contratantes usam contas separadas no RiderSync. A escolha é definitiva.</p>
          <AccountTypeChooser value={type} onChange={setType} />
          <FormError message={error} />
          <button
            type="button"
            className="btn cue block"
            disabled={!type || busy}
            onClick={() => run(() => api.post<Me>('/account/account-type', { accountType: type }))}
          >
            {busy ? 'Salvando…' : 'Confirmar tipo de conta'}
          </button>
        </div>
      </Dialog>

      <Dialog open={needsTerms} onClose={() => undefined} dismissible={false} title="Atualizamos nossos termos">
        <div className="stack">
          <p>
            Para continuar usando o RiderSync, leia e aceite a versão atual dos{' '}
            <Link className="link" to="/termos" target="_blank">
              Termos de Uso
            </Link>{' '}
            e da{' '}
            <Link className="link" to="/privacidade" target="_blank">
              Política de Privacidade
            </Link>
            .
          </p>
          <FormError message={error} />
          <button
            type="button"
            className="btn cue block"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const cfg = await api.get<AuthConfig>('/auth/config');
                return api.post<Me>('/account/accept-terms', { version: cfg.privacyPolicyVersion });
              })
            }
          >
            Li e aceito
          </button>
        </div>
      </Dialog>
      <Dialog open={needsCpf} onClose={() => undefined} dismissible={false} title="Informe seu CPF">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (cpfValid) void run(() => api.post<Me>('/account/cpf', { cpf }));
          }}
        >
          <p>O CPF é obrigatório no cadastro do RiderSync e é usado nos contratos das suas contratações. Ele nunca aparece no seu perfil público.</p>
          <label className="field">
            <span>CPF</span>
            <input
              className="input"
              inputMode="numeric"
              placeholder="000.000.000-00"
              maxLength={14}
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              aria-invalid={cpf.length === 14 && !cpfValid}
              autoFocus
            />
          </label>
          {cpf.length === 14 && !cpfValid && <span className="err">CPF inválido. Confira os números.</span>}
          <FormError message={error} />
          <button type="submit" className="btn cue block" disabled={!cpfValid || busy}>
            {busy ? 'Salvando…' : 'Salvar CPF'}
          </button>
        </form>
      </Dialog>
    </>
  );
}
