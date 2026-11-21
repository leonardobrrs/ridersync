import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type InputHTMLAttributes } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { CityField } from '../../components/CityField';
import { applyServerErrors, FormError, PhoneField, TextField } from '../../components/Fields';
import { Loading } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { isValidCnpj, isValidCpf, maskCnpj, maskCpf } from '../../lib/documents';
import { formatPhone, isValidPhoneBR } from '../../lib/phone';
import type { BandDetail, LegalProfile, OrgSummary } from '../../lib/types';

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label: string;
  error?: { message?: string };
  hint?: React.ReactNode;
  onChange?: InputHTMLAttributes<HTMLInputElement>['onChange'];
};

/** Campo com máscara: o valor já chega formatado ao formulário (RHF). */
function maskedField(mask: (v: string) => string, props: { inputMode: 'numeric'; placeholder: string; maxLength: number }) {
  return function Masked({ onChange, ...rest }: FieldProps) {
    return (
      <TextField
        {...props}
        {...rest}
        onChange={(e) => {
          e.target.value = mask(e.target.value);
          onChange?.(e);
        }}
      />
    );
  };
}
export const CpfField = maskedField(maskCpf, { inputMode: 'numeric', placeholder: '000.000.000-00', maxLength: 14 });
export const CnpjField = maskedField(maskCnpj, { inputMode: 'numeric', placeholder: '00.000.000/0000-00', maxLength: 18 });

export const cpfRule = z.string().trim().refine((v) => v === '' || isValidCpf(v), 'CPF inválido.');
export const cnpjRule = z.string().trim().refine((v) => v === '' || isValidCnpj(v), 'CNPJ inválido.');

const LegalSchema = z.object({
  legalName: z.string().trim().max(120, 'No máximo 120 caracteres.'),
  cpf: cpfRule,
  rg: z.string().trim().max(20, 'No máximo 20 caracteres.'),
});
type LegalValues = z.infer<typeof LegalSchema>;

/**
 * Dados civis do titular, usados nos contratos (artista solo, representante de banda sem CNPJ e contratante
 * pessoa física). Privados: aparecem somente no contrato gerado para as partes da negociação.
 */
export function LegalProfileSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['legal-profile'], queryFn: () => api.get<LegalProfile>('/account/legal-profile') });
  const form = useForm<LegalValues>({
    resolver: zodResolver(LegalSchema),
    values: { legalName: q.data?.legalName ?? '', cpf: maskCpf(q.data?.cpf), rg: q.data?.rg ?? '' },
  });
  const e = form.formState.errors;
  const save = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      qc.setQueryData(['legal-profile'], await api.put<LegalProfile>('/account/legal-profile', { legalName: v.legalName || null, cpf: v.cpf || null, rg: v.rg || null }));
      toast('Dados para contrato salvos.');
    } catch (err) {
      setFormError(applyServerErrors(err, form.setError));
    }
  });
  return (
    <section className="box stack">
      <h2 className="lbl">Dados para contrato</h2>
      <p className="hint">
        Nome completo, CPF e RG aparecem apenas nos contratos das suas contratações confirmadas — nunca em perfis públicos. Se não preencher, o contrato sai com “[A PREENCHER]”.
      </p>
      {q.isLoading && <Loading />}
      {q.data && (
        <form className="form" onSubmit={save} noValidate>
          <FormError message={formError} />
          <TextField label="Nome completo (como no documento)" autoComplete="name" {...form.register('legalName')} error={e.legalName} />
          <div className="row2">
            <CpfField label="CPF" {...form.register('cpf')} error={e.cpf} />
            <TextField label="RG" {...form.register('rg')} error={e.rg} />
          </div>
          <div className="actions">
            <button className="btn dark" type="submit" disabled={form.formState.isSubmitting}>
              Salvar dados
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

const IndividualSchema = z.object({
  addressLine: z.string().trim().max(160),
  neighborhood: z.string().trim().max(80),
  city: z.string().trim().min(2, 'Cidade é obrigatória.').max(80),
  contactPhone: z.string().trim().max(20).refine(isValidPhoneBR, 'Telefone incompleto. Use DDD + número, ex.: (82) 99999-9999.'),
});
type IndividualValues = z.infer<typeof IndividualSchema>;

/**
 * Endereço e telefone do contratante pessoa física (aparecem no contrato). Ficam na organização INDIVIDUAL,
 * criada junto com o primeiro evento particular.
 */
export function IndividualContractorSection() {
  const q = useQuery({ queryKey: ['orgs'], queryFn: () => api.get<OrgSummary[]>('/organizations/mine') });
  const org = q.data?.find((o) => o.type === 'INDIVIDUAL');
  return (
    <section className="box stack">
      <h2 className="lbl">Endereço para contrato</h2>
      {q.isLoading && <Loading />}
      {q.data && !org && (
        <p className="hint">
          O endereço e o telefone do contratante entram no contrato dos eventos particulares. Eles ficam disponíveis aqui depois que você{' '}
          <Link className="link" to="/painel/eventos">
            criar seu primeiro evento
          </Link>
          .
        </p>
      )}
      {org && <IndividualForm org={org} />}
    </section>
  );
}

function IndividualForm({ org }: { org: OrgSummary }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<IndividualValues>({
    resolver: zodResolver(IndividualSchema),
    values: { addressLine: org.addressLine ?? '', neighborhood: org.neighborhood ?? '', city: org.city, contactPhone: formatPhone(org.contactPhone) },
  });
  const e = form.formState.errors;
  const save = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      await api.patch(`/organizations/${org.id}`, { addressLine: v.addressLine || null, neighborhood: v.neighborhood || null, city: v.city, contactPhone: v.contactPhone || null });
      await qc.invalidateQueries({ queryKey: ['orgs'] });
      toast('Endereço para contrato salvo.');
    } catch (err) {
      setFormError(applyServerErrors(err, form.setError));
    }
  });
  return (
    <form className="form" onSubmit={save} noValidate>
      <p className="hint">Dados privados: aparecem somente no contrato. Eventos particulares nunca exibem o endereço publicamente.</p>
      <FormError message={formError} />
      <div className="row2">
        <TextField label="Endereço" autoComplete="street-address" {...form.register('addressLine')} error={e.addressLine} />
        <TextField label="Bairro" {...form.register('neighborhood')} error={e.neighborhood} />
      </div>
      <div className="row2">
        <CityField {...form.register('city')} error={e.city} />
        <PhoneField label="Telefone" {...form.register('contactPhone')} error={e.contactPhone} />
      </div>
      <div className="actions">
        <button className="btn dark" type="submit" disabled={form.formState.isSubmitting}>
          Salvar endereço
        </button>
      </div>
    </form>
  );
}

const BandLegalSchema = z.object({
  legalName: z.string().trim().max(150, 'No máximo 150 caracteres.'),
  cnpj: cnpjRule,
});
type BandLegalValues = z.infer<typeof BandLegalSchema>;

/** Razão social e CNPJ da banda para contratos. Sem CNPJ, o proprietário assina como representante legal. */
export function BandLegalSection({ band }: { band: BandDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const legal = band.legal;
  const form = useForm<BandLegalValues>({
    resolver: zodResolver(BandLegalSchema),
    values: { legalName: legal?.legalName ?? '', cnpj: maskCnpj(legal?.cnpj) },
  });
  const e = form.formState.errors;
  if (!legal) return null;
  const save = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      qc.setQueryData(['band', band.bandId], await api.put<BandDetail>(`/bands/${band.bandId}/legal`, { legalName: v.legalName || null, cnpj: v.cnpj || null }));
      toast('Dados para contrato da banda salvos.');
    } catch (err) {
      setFormError(applyServerErrors(err, form.setError));
    }
  });
  return (
    <section className="box stack" aria-label="Dados para contrato da banda">
      <h2 className="lbl">Dados para contrato</h2>
      <p className="hint">
        Se a banda tem CNPJ, informe a razão social e o CNPJ. Sem CNPJ, o contrato usa o nome completo e o CPF do proprietário como representante legal do grupo
        {band.myRole === 'OWNER' ? '' : ' (quem é proprietário preenche em Conta e privacidade)'}.
      </p>
      {!legal.cnpj && !legal.ownerHasLegalData && (
        <div className="inline-msg warn">
          O proprietário ainda não informou nome completo e CPF —{' '}
          <Link className="link" to="/painel/conta">
            preencher em Conta e privacidade
          </Link>
          . Sem isso, o contrato sairá com “[A PREENCHER]”.
        </div>
      )}
      <form className="form" onSubmit={save} noValidate>
        <FormError message={formError} />
        <div className="row2">
          <TextField label="Razão social (se tiver CNPJ)" {...form.register('legalName')} error={e.legalName} />
          <CnpjField label="CNPJ" {...form.register('cnpj')} error={e.cnpj} />
        </div>
        <div className="actions">
          <button className="btn dark" type="submit" disabled={form.formState.isSubmitting}>
            Salvar dados
          </button>
        </div>
      </form>
    </section>
  );
}
