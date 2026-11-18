import { CityField } from '../../components/CityField';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { applyServerErrors, PhoneField, ChipPicker, FormError, SelectField, TextArea, TextField } from '../../components/Fields';
import { formatPhone, isValidPhoneBR } from '../../lib/phone';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { centsFromReais, reaisFromCents } from '../../lib/format';
import { useMeta } from '../../lib/hooks';
import type { ManagedArtist } from '../../lib/types';

const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === '' || /^https:\/\/[^\s]+\.[^\s]+/.test(v), 'Use um link começando com https://');

export const ProfileFormSchema = z.object({
  name: z.string().trim().min(2, 'Nome artístico é obrigatório.').max(80),
  headline: z.string().trim().max(80, 'Máximo de 80 caracteres.'),
  bio: z.string().trim().max(3000),
  city: z.string().trim().max(80),
  state: z.string().length(2),
  genres: z.array(z.string()).max(6, 'Escolha no máximo 6 estilos.'),
  formats: z.array(z.string()),
  careerStartYear: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d{4}$/.test(v) && Number(v) >= 1940 && Number(v) <= new Date().getFullYear()), 'Ano inválido.'),
  baseFee: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d+([.,]\d{1,2})?$/.test(v), 'Valor inválido (ex.: 600 ou 600,00).'),
  contactEmail: z.string().trim().refine((v) => v === '' || z.email().safeParse(v).success, 'E-mail inválido.'),
  contactPhone: z.string().trim().max(20).refine(isValidPhoneBR, 'Telefone incompleto. Use DDD + número, ex.: (82) 99999-9999.'),
  instagram: z.string().trim().max(31),
  website: optionalUrl,
  mainInstrument: z.string(),
  instruments: z.array(z.string()),
});
export type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

export function toFormValues(a?: Partial<ManagedArtist>): ProfileFormValues {
  return {
    name: a?.name ?? '',
    headline: a?.headline ?? '',
    bio: a?.bio ?? '',
    city: a?.city ?? '',
    state: a?.state ?? 'AL',
    genres: a?.genres ?? [],
    formats: a?.formats ?? [],
    careerStartYear: a?.careerStartYear ? String(a.careerStartYear) : '',
    baseFee: reaisFromCents(a?.baseFeeCents),
    contactEmail: a?.contactEmail ?? '',
    contactPhone: formatPhone(a?.contactPhone),
    instagram: a?.instagram ?? '',
    website: a?.website ?? '',
    mainInstrument: a?.mainInstrument ?? '',
    instruments: a?.instruments ?? [],
  };
}

/** Converte o formulário no payload do PATCH /artists/:id (campos de perfil profissional). */
export function toArtistPayload(v: ProfileFormValues) {
  return {
    name: v.name,
    headline: v.headline,
    bio: v.bio,
    city: v.city || null,
    state: v.state,
    genres: v.genres,
    formats: v.formats,
    careerStartYear: v.careerStartYear ? Number(v.careerStartYear) : null,
    baseFeeCents: centsFromReais(v.baseFee),
    contactEmail: v.contactEmail || null,
    contactPhone: v.contactPhone || null,
    instagram: v.instagram || null,
    website: v.website || null,
  };
}

export function ProfileFields({ form, solo }: { form: ReturnType<typeof useForm<ProfileFormValues>>; solo: boolean }) {
  const { data: meta } = useMeta();
  const e = form.formState.errors;
  return (
    <>
      <div className="row2">
        <TextField label={solo ? 'Nome artístico' : 'Nome da banda'} {...form.register('name')} error={e.name} />
        <TextField label="Resumo (aparece no card)" placeholder={solo ? 'Ex.: Voz e violão — MPB' : 'Ex.: Quarteto de forró'} {...form.register('headline')} error={e.headline} />
      </div>
      <TextArea
        label="Descrição"
        hint="Mínimo de 40 caracteres para publicar. Conte trajetória, formato do show e repertório."
        {...form.register('bio')}
        error={e.bio}
      />
      <div className="row2">
        <CityField {...form.register('city')} error={e.city} />
        <TextField label="Em atividade desde (ano)" inputMode="numeric" {...form.register('careerStartYear')} error={e.careerStartYear} />
      </div>
      <Controller
        control={form.control}
        name="genres"
        render={({ field, fieldState }) => (
          <ChipPicker legend="Estilos musicais" options={meta?.genres ?? []} value={field.value} onChange={field.onChange} max={6} error={fieldState.error} />
        )}
      />
      <Controller
        control={form.control}
        name="formats"
        render={({ field }) => <ChipPicker legend="Formações de show" options={meta?.formats ?? []} value={field.value} onChange={field.onChange} />}
      />
      {solo && (
        <>
          <SelectField label="Instrumento/função principal" {...form.register('mainInstrument')}>
            <option value="">—</option>
            {meta?.instruments.map((i) => <option key={i}>{i}</option>)}
          </SelectField>
          <Controller
            control={form.control}
            name="instruments"
            render={({ field }) => (
              <ChipPicker legend="Outros instrumentos/habilidades" options={meta?.instruments ?? []} value={field.value} onChange={field.onChange} max={8} />
            )}
          />
        </>
      )}
      <TextField
        label="Cachê a partir de (R$)"
        inputMode="decimal"
        hint="Referência para contratantes. Pagamentos são combinados fora da plataforma."
        {...form.register('baseFee')}
        error={e.baseFee}
      />
      <fieldset>
        <legend>Contatos públicos (aparecem no perfil público)</legend>
        <div className="row2">
          <TextField label="E-mail de contato" type="email" {...form.register('contactEmail')} error={e.contactEmail} />
          <PhoneField label="Telefone/WhatsApp" {...form.register('contactPhone')} error={e.contactPhone} />
          <TextField label="Instagram" placeholder="@usuario" {...form.register('instagram')} error={e.instagram} />
          <TextField label="Site" placeholder="https://" {...form.register('website')} error={e.website} />
        </div>
      </fieldset>
    </>
  );
}

/** Edição do perfil de uma identidade artística existente (solo ou banda). */
export function ArtistProfileForm({ artist, queryKey }: { artist: ManagedArtist; queryKey: unknown[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const solo = artist.kind === 'SOLO';
  const form = useForm<ProfileFormValues>({ resolver: zodResolver(ProfileFormSchema), values: toFormValues(artist) });
  const disabled = !artist.access.canManage;

  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      await api.patch(`/artists/${artist.id}`, toArtistPayload(v));
      if (solo) await api.patch('/me/musician-profile', { mainInstrument: v.mainInstrument || null, instruments: v.instruments });
      await qc.invalidateQueries({ queryKey });
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast('Perfil salvo.');
    } catch (e) {
      setFormError(applyServerErrors(e, form.setError));
    }
  });

  return (
    <form className="box form" onSubmit={onSubmit} noValidate aria-label="Dados do perfil">
      <h2 className="lbl">Dados do perfil</h2>
      <FormError message={formError} />
      <fieldset disabled={disabled}>
        <ProfileFields form={form} solo={solo} />
      </fieldset>
      {!disabled && (
        <div className="actions">
          <button className="btn cue" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando…' : 'Salvar perfil'}
          </button>
        </div>
      )}
    </form>
  );
}
