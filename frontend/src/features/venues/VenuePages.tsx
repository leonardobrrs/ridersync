import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { CityField } from '../../components/CityField';
import { ConfirmButton } from '../../components/Dialog';
import { ImagePicker, prepareImage, uploadForm } from '../../components/Media';
import { TransferOwnershipDialog } from '../../components/TransferOwnershipDialog';
import { applyServerErrors, PhoneField, FormError, SelectField, TextArea, TextField } from '../../components/Fields';
import { formatPhone, isValidPhoneBR } from '../../lib/phone';
import { PageHead } from '../../components/Layout';
import { Avatar, Poster } from '../../components/Poster';
import { Empty, ErrorState, Loading, Status } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, errorMessage } from '../../lib/api';
import { date, dateTime, EVENT_STATUS, ROLE_LABEL } from '../../lib/format';
import { useAction, useMeta } from '../../lib/hooks';
import type { OrgDetail, OrgEventRow, OrgSummary, Rider } from '../../lib/types';
import { EquipmentEditor, type EquipmentInput } from '../artist/EquipmentEditor';

const OrgSchema = z.object({
  name: z.string().trim().min(2, 'Nome é obrigatório.').max(100),
  venueKind: z.string(),
  description: z.string().trim().max(3000),
  addressLine: z.string().trim().max(160),
  neighborhood: z.string().trim().max(80),
  city: z.string().trim().min(2, 'Cidade é obrigatória.').max(80),
  state: z.string().length(2),
  capacity: z.string().trim().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) > 0), 'Capacidade inválida.'),
  contactEmail: z.string().trim().refine((v) => v === '' || z.email().safeParse(v).success, 'E-mail inválido.'),
  contactPhone: z.string().trim().max(20).refine(isValidPhoneBR, 'Telefone incompleto. Use DDD + número, ex.: (82) 99999-9999.'),
  instagram: z.string().trim().max(31),
  website: z.string().trim().refine((v) => v === '' || /^https:\/\/[^\s]+\.[^\s]+/.test(v), 'Use um link começando com https://'),
});
type OrgValues = z.infer<typeof OrgSchema>;

const toOrgValues = (o?: Partial<OrgDetail>): OrgValues => ({
  name: o?.name ?? '',
  venueKind: o?.venueKind ?? '',
  description: o?.description ?? '',
  addressLine: o?.addressLine ?? '',
  neighborhood: o?.neighborhood ?? '',
  city: o?.city ?? 'Maceió',
  state: o?.state ?? 'AL',
  capacity: o?.capacity ? String(o.capacity) : '',
  contactEmail: o?.contactEmail ?? '',
  contactPhone: formatPhone(o?.contactPhone),
  instagram: o?.instagram ?? '',
  website: o?.website ?? '',
});
const toOrgPayload = (v: OrgValues) => ({
  name: v.name,
  venueKind: v.venueKind || null,
  description: v.description,
  addressLine: v.addressLine || null,
  neighborhood: v.neighborhood || null,
  city: v.city,
  state: v.state,
  capacity: v.capacity ? Number(v.capacity) : null,
  contactEmail: v.contactEmail || null,
  contactPhone: v.contactPhone || null,
  instagram: v.instagram || null,
  website: v.website || null,
});

function OrgFields({ form }: { form: ReturnType<typeof useForm<OrgValues>> }) {
  const { data: meta } = useMeta();
  const e = form.formState.errors;
  return (
    <>
      <div className="row2">
        <TextField label="Nome do estabelecimento" {...form.register('name')} error={e.name} />
        <SelectField label="Tipo de espaço" {...form.register('venueKind')}>
          <option value="">—</option>
          {meta?.venueKinds.map((k) => <option key={k}>{k}</option>)}
        </SelectField>
      </div>
      <TextArea label="Descrição" {...form.register('description')} error={e.description} />
      <div className="row2">
        <TextField label="Endereço" {...form.register('addressLine')} error={e.addressLine} />
        <TextField label="Bairro" {...form.register('neighborhood')} error={e.neighborhood} />
      </div>
      <div className="row2">
        <CityField {...form.register('city')} error={e.city} />
        <TextField label="Capacidade (pessoas)" inputMode="numeric" {...form.register('capacity')} error={e.capacity} />
      </div>
      <fieldset>
        <legend>Contatos públicos do estabelecimento</legend>
        <div className="row2">
          <TextField label="E-mail" type="email" {...form.register('contactEmail')} error={e.contactEmail} />
          <PhoneField label="Telefone/WhatsApp" {...form.register('contactPhone')} error={e.contactPhone} />
          <TextField label="Instagram" {...form.register('instagram')} error={e.instagram} />
          <TextField label="Site" {...form.register('website')} error={e.website} />
        </div>
      </fieldset>
    </>
  );
}

export function MyVenuesPage() {
  const q = useQuery({ queryKey: ['orgs'], queryFn: () => api.get<OrgSummary[]>('/organizations/mine') });
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const form = useForm<OrgValues>({ resolver: zodResolver(OrgSchema), defaultValues: toOrgValues() });
  const venues = q.data?.filter((o) => o.type === 'VENUE');
  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      const org = await api.post<OrgDetail>('/organizations', toOrgPayload(v));
      if (photo) {
        await api.upload('PUT', `/organizations/${org.id}/photo`, uploadForm(photo)).catch(() => toast('A casa foi cadastrada, mas a imagem não pôde ser enviada.', 'error'));
      }
      await qc.invalidateQueries({ queryKey: ['orgs'] });
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast('Casa cadastrada. Você é o proprietário.');
      navigate(`/painel/casas/${org.id}`);
    } catch (e) {
      setFormError(applyServerErrors(e, form.setError));
    }
  });
  return (
    <>
      <PageHead
        title="Casas de show"
        subtitle="Estabelecimentos que você administra: perfil, responsáveis, inventário técnico e publicações."
        actions={
          !creating && (
            <button className="btn cue" type="button" onClick={() => setCreating(true)}>
              Cadastrar casa
            </button>
          )
        }
      />
      {creating && (
        <form className="box form" onSubmit={onSubmit} noValidate aria-label="Cadastrar casa">
          <h2 className="lbl">Nova casa de show</h2>
          <FormError message={formError} />
          <ImagePicker label="Imagem da casa" value={photo} onChange={setPhoto} />
          <OrgFields form={form} />
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setCreating(false)}>
              Cancelar
            </button>
            <button className="btn cue" type="submit" disabled={form.formState.isSubmitting}>
              Cadastrar
            </button>
          </div>
        </form>
      )}
      {q.isLoading && <Loading />}
      {q.error && <ErrorState error={q.error} retry={q.refetch} />}
      {venues?.length === 0 && !creating && (
        <Empty title="Você não administra nenhuma casa">
          Cadastre seu estabelecimento para publicar oportunidades e buscar artistas. Vai contratar para um evento sem casa (ex.: aniversário)? Use{' '}
          <Link className="link" to="/painel/eventos">
            Eventos particulares
          </Link>
          .
        </Empty>
      )}
      <div className="stack-sm">
        {venues?.map((o) => (
          <article className="prow" key={o.id}>
            <Poster name={o.name} photoUrl={o.photoUrl} top={[o.city, o.state]} bottom={[o.venueKind ?? '', o.capacity ? `${o.capacity} pessoas` : '']} />
            <div>
              <h3>{o.name}</h3>
              <div className="meta">
                <span className={`role ${o.role === 'OWNER' ? 'owner' : ''}`}>{ROLE_LABEL[o.role]}</span>
                <span>{o.openEvents} publicação(ões) aberta(s)</span>
                <span>{o.equipmentItems} item(ns) no inventário</span>
              </div>
            </div>
            <div className="acts">
              <Link className="btn sm" to={`/painel/casas/${o.id}`}>
                Gerenciar
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function OrgProfileTab({ org }: { org: OrgDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['org', org.id];
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const form = useForm<OrgValues>({ resolver: zodResolver(OrgSchema), values: toOrgValues(org) });
  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      await api.patch(`/organizations/${org.id}`, toOrgPayload(v));
      await qc.invalidateQueries({ queryKey: key });
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast('Dados da casa salvos.');
    } catch (e) {
      setFormError(applyServerErrors(e, form.setError));
    }
  });
  const photo = async (file?: File) => {
    setBusy(true);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        await api.upload('PUT', `/organizations/${org.id}/photo`, fd);
      } else await api.delete(`/organizations/${org.id}/photo`);
      await qc.invalidateQueries({ queryKey: key });
      toast(file ? 'Foto atualizada.' : 'Foto removida.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="stack">
      <section className="box" aria-label="Foto">
        <h2 className="lbl">Foto do espaço</h2>
        <div className="photo-edit">
          <Poster name={org.name} photoUrl={org.photoUrl} top={[org.city, org.state]} bottom={[org.venueKind ?? '', '']} />
          <div className="stack-sm">
            <label className="btn sm">
              {busy ? 'Enviando…' : org.photoUrl ? 'Trocar foto' : 'Enviar foto'}
              <input ref={input} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async (e) => e.target.files?.[0] && photo(await prepareImage(e.target.files[0]))} />
            </label>
            {org.photoUrl && (
              <button className="btn sm ghost danger" type="button" onClick={() => photo()} disabled={busy}>
                Remover foto
              </button>
            )}
          </div>
        </div>
        <Link className="btn sm" to={`/casas/${org.slug}`}>
          Ver página pública
        </Link>
      </section>
      <form className="box form" onSubmit={onSubmit} noValidate aria-label="Dados da casa">
        <FormError message={formError} />
        <OrgFields form={form} />
        <div className="actions">
          <button className="btn cue" type="submit" disabled={form.formState.isSubmitting}>
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

function OrgMembersTab({ org }: { org: OrgDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const key = ['org', org.id];
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const isOwner = org.myRole === 'OWNER';
  const candidates = org.members.filter((m) => m.status === 'ACTIVE' && !m.isMe).map((m) => ({ id: m.id, name: m.name }));
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: key });
      toast(ok);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const leave = useAction(() => api.post(`/organizations/${org.id}/leave`), {
    invalidate: [['orgs'], ['me']],
    success: 'Você deixou de administrar esta casa.',
    onSuccess: () => navigate('/painel/casas'),
  });
  const invite = async () => {
    setErr(null);
    if (!z.email().safeParse(email.trim()).success) return setErr('Informe um e-mail válido.');
    try {
      await api.post(`/organizations/${org.id}/invitations`, { email: email.trim(), role: 'ADMIN' });
      setEmail('');
      await qc.invalidateQueries({ queryKey: key });
      toast('Convite enviado.');
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <section className="box" aria-label="Responsáveis">
      <div className="row space">
        <h2 className="lbl">Responsáveis</h2>
        {isOwner && (
          <button className="btn sm dark" type="button" onClick={() => setTransferOpen(true)}>
            Transferir propriedade
          </button>
        )}
      </div>
      <ul className="mlist">
        {org.members.map((m) => (
          <li key={m.id}>
            <Avatar name={m.name} />
            <div>
              <strong>
                {m.name}
                {m.isMe && ' (você)'}
              </strong>
              {m.status === 'INVITED' && <small className="hint" style={{ display: 'block' }}>{m.email} · convite pendente</small>}
            </div>
            {m.status === 'INVITED' ? <span className="st pend">Pendente</span> : <span className={`role ${m.role === 'OWNER' ? 'owner' : ''}`}>{ROLE_LABEL[m.role]}</span>}
            <span className="row" style={{ gap: 4 }}>
              {m.status === 'INVITED' ? (
                <ConfirmButton
                  className="btn sm ghost danger"
                  confirm="Cancelar este convite?"
                  confirmLabel="Cancelar convite"
                  danger
                  onConfirm={() => run(() => api.delete(`/organizations/${org.id}/invitations/${m.id}`), 'Convite cancelado.')}
                >
                  Cancelar
                </ConfirmButton>
              ) : (
                isOwner &&
                !m.isMe &&
                m.role !== 'OWNER' && (
                  <ConfirmButton
                    className="btn sm ghost danger"
                    confirm={`Remover ${m.name} dos responsáveis pela casa?`}
                    confirmLabel="Remover"
                    danger
                    onConfirm={() => run(() => api.delete(`/organizations/${org.id}/members/${m.id}`), 'Responsável removido.')}
                  >
                    Remover
                  </ConfirmButton>
                )
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="cmp-f">
        <TextField label="Convidar administrador (e-mail da conta)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err ? { message: err } : undefined} />
        <button className="btn dark" type="button" onClick={invite}>
          Convidar
        </button>
      </div>
      <div className="row between">
        <p className="hint">A casa precisa sempre de um proprietário. Somente o proprietário remove responsáveis e transfere a propriedade.</p>
        <ConfirmButton className="btn sm danger" confirm="Deixar de administrar esta casa?" confirmLabel="Deixar de administrar" danger onConfirm={() => leave.mutate(undefined)}>
          Deixar de administrar
        </ConfirmButton>
      </div>
      {isOwner && (
        <TransferOwnershipDialog
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          entityLabel="casa"
          entityName={org.name}
          candidates={candidates}
          onTransfer={async (memberId, password) => {
            await api.post(`/organizations/${org.id}/transfer-ownership`, { memberId, password });
            await qc.invalidateQueries({ queryKey: key });
            await qc.invalidateQueries({ queryKey: ['orgs'] });
            toast('Propriedade transferida. Você agora é administrador(a).');
          }}
        />
      )}
    </section>
  );
}

function InventoryTab({ orgId }: { orgId: string }) {
  const q = useQuery({ queryKey: ['equipment', orgId], queryFn: () => api.get<Rider>(`/organizations/${orgId}/equipment`) });
  const save = useAction((p: { items: EquipmentInput[] }) => api.put(`/organizations/${orgId}/equipment`, { items: p.items }), {
    invalidate: [['equipment', orgId]],
    success: 'Inventário salvo.',
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  return (
    <div className="stack">
      <div className="notice">O inventário pertence à casa e é usado na comparação com riders. Ele nunca altera riders de artistas ou bandas.</div>
      <EquipmentEditor key={JSON.stringify(q.data!.items.map((i) => [i.id, i.quantity]))} mode="inventory" items={q.data!.items} saving={save.isPending} onSave={(p) => save.mutate(p)} />
    </div>
  );
}

function EventsTab({ orgId }: { orgId: string }) {
  const q = useQuery({ queryKey: ['org-events', orgId], queryFn: () => api.get<OrgEventRow[]>(`/organizations/${orgId}/events`) });
  return (
    <section className="box" aria-label="Publicações">
      <div className="row between">
        <h2 className="lbl">Eventos</h2>
        <Link className="btn cue sm" to={`/painel/casas/${orgId}/eventos/novo`}>
          Novo evento
        </Link>
      </div>
      {q.isLoading && <Loading />}
      {q.error && <ErrorState error={q.error} retry={q.refetch} />}
      {q.data?.length === 0 && <Empty title="Nenhum evento">Crie um evento com vagas e prazo para receber candidaturas.</Empty>}
      {!!q.data?.length && (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Evento</th>
                <th>Estado</th>
                <th>Apresentação</th>
                <th>Prazo</th>
                <th>Vagas</th>
                <th>Candidaturas</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link className="link" to={`/painel/eventos/${e.id}`}>
                      {e.title}
                    </Link>{' '}
                    {e.visibility === 'PRIVATE' && <span className="st draft">Privado</span>}
                  </td>
                  <td>
                    <Status value={e.status} map={EVENT_STATUS} />
                  </td>
                  <td>{dateTime(e.startsAt)}</td>
                  <td>{date(e.applicationDeadline)}</td>
                  <td className="n">
                    {e.filledSlots}/{e.slots}
                  </td>
                  <td className="n">
                    {e.applicationCounts.total} ({e.applicationCounts.pending} em análise)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function VenueManagePage() {
  const { orgId } = useParams();
  const q = useQuery({ queryKey: ['org', orgId], queryFn: () => api.get<OrgDetail>(`/organizations/${orgId}/manage`) });
  const [tab, setTab] = useState('eventos');
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const org = q.data!;
  const tabs = [
    ['eventos', 'Eventos'],
    ['perfil', 'Perfil do estabelecimento'],
    ['inventario', 'Inventário técnico'],
    ['responsaveis', `Responsáveis (${org.members.filter((m) => m.status === 'ACTIVE').length})`],
  ];
  return (
    <>
      <PageHead
        title={org.name}
        back="/painel/casas"
        subtitle={
          <>
            {org.city}/{org.state} · seu papel: <span className={`role ${org.myRole === 'OWNER' ? 'owner' : ''}`}>{ROLE_LABEL[org.myRole]}</span>
          </>
        }
        actions={
          <Link className="btn sm" to={`/?from=${org.id}`}>
            Buscar artistas
          </Link>
        }
      />
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'eventos' && <EventsTab orgId={org.id} />}
      {tab === 'perfil' && <OrgProfileTab org={org} />}
      {tab === 'inventario' && <InventoryTab orgId={org.id} />}
      {tab === 'responsaveis' && <OrgMembersTab org={org} />}
    </>
  );
}
