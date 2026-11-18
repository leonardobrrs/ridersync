import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { applyServerErrors, FormError } from '../../components/Fields';
import { ImagePicker, uploadForm } from '../../components/Media';
import { PageHead } from '../../components/Layout';
import { ErrorState, Loading } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import type { ManagedArtist } from '../../lib/types';
import { ArtistWorkspace } from './ArtistWorkspace';
import { ProfileFields, ProfileFormSchema, toArtistPayload, toFormValues, type ProfileFormValues } from './ArtistProfileForm';

const KEY = ['musician-profile'];

function CreateProfile() {
  const qc = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const form = useForm<ProfileFormValues>({ resolver: zodResolver(ProfileFormSchema), defaultValues: toFormValues() });
  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      const created = await api.post<ManagedArtist>('/me/musician-profile', {
        ...toArtistPayload(v),
        mainInstrument: v.mainInstrument || null,
        instruments: v.instruments,
      });
      if (photo) {
        await api.upload('PUT', `/artists/${created.id}/photo`, uploadForm(photo)).catch(() => toast('O perfil foi criado, mas a foto não pôde ser enviada.', 'error'));
      }
      await qc.invalidateQueries({ queryKey: KEY });
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast('Perfil criado! Ele começa privado — publique quando estiver pronto.');
    } catch (e) {
      setFormError(applyServerErrors(e, form.setError));
    }
  });
  return (
    <form className="box form" onSubmit={onSubmit} noValidate aria-label="Criar perfil individual">
      <div className="notice">
        Seu perfil profissional é separado da sua conta: o e-mail de acesso nunca aparece publicamente. Ele começa privado.
      </div>
      <FormError message={formError} />
      <ImagePicker label="Foto do perfil" value={photo} onChange={setPhoto} />
      <ProfileFields form={form} solo />
      <div className="actions">
        <button className="btn cue" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Criando…' : 'Criar meu perfil'}
        </button>
      </div>
    </form>
  );
}

export function MyProfilePage() {
  const q = useQuery({ queryKey: KEY, queryFn: () => api.get<{ profile: ManagedArtist | null }>('/me/musician-profile') });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const profile = q.data!.profile;
  return (
    <>
      <PageHead
        title={profile ? profile.name : 'Criar perfil individual'}
        subtitle={profile ? 'Seu perfil profissional individual — identidade separada das suas bandas.' : 'Apresente-se como músico: estilos, formações, contatos públicos, portfólio e rider.'}
      />
      {profile ? <ArtistWorkspace artist={profile} queryKey={KEY} /> : <CreateProfile />}
    </>
  );
}
