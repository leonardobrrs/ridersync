import { formatCnpj, formatCpf } from '../../common/documents';
import { toExtenso } from './utils/to-extenso';

/**
 * Regras puras do contrato: monta o dicionário de campos do template a partir de dados já carregados.
 * Nada aqui acessa banco, relógio ou disco (a data de geração entra por parâmetro).
 * Valor ausente = `undefined` (vira "[A PREENCHER]"); string vazia só onde é intencional.
 */

export const CONTRACT_TZ = 'America/Maceio';
const DEFAULT_RESCISSION_DAYS = 2;
const DEFAULT_SUBSTITUTION_DAYS = 5;
const DEFAULT_INFO_DAYS = 3;
const EVENT_DESCRIPTION_MAX = 300;
const WITNESS_LINE = '______________________________';
const MISSING = '[A PREENCHER]';

export type ContractorType = 'VENUE' | 'INDIVIDUAL';

interface Place {
  name?: string | null;
  addressLine?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface ContractSource {
  generatedAt: Date;
  contractorType: ContractorType;
  organization: Place & { legalName: string | null; cnpj: string | null; contactPhone: string | null };
  /** OWNER ativo da organização INDIVIDUAL (dados civis do contratante pessoa física). */
  contractorPerson: { legalName: string | null; cpf: string | null; rg: string | null } | null;
  artist: { kind: 'SOLO' | 'BAND'; name: string };
  /** Dono do perfil individual (artista SOLO). */
  soloPerson: { legalName: string | null; cpf: string | null } | null;
  band: { legalName: string | null; cnpj: string | null } | null;
  /** OWNER ativo da banda — representante legal quando a banda não tem CNPJ. */
  bandOwner: { legalName: string | null; cpf: string | null } | null;
  event: {
    title: string;
    description: string;
    locationName: string | null;
    locationAddress: string | null;
    locationCity: string | null;
    locationState: string | null;
    venue: Place | null;
  } | null;
  /** Oferta ACEITA: os termos acordados. */
  offer: {
    performanceAt: Date;
    durationMinutes: number;
    feeCents: number;
    presentationDesc: string | null;
    advanceMinutes: number | null;
    signalCents: number | null;
    signalDueDate: Date | null;
    balanceDueDate: Date | null;
    paymentMethod: string | null;
    rescissionDays: number | null;
    substitutionDays: number | null;
  };
}

export type ContractFields = Record<string, string | undefined>;

/** Texto em linha única; vazio/branco vira undefined. */
function val(v: string | null | undefined): string | undefined {
  const s = v?.replace(/\s+/g, ' ').trim();
  return s ? s : undefined;
}

const cpf = (v: string | null | undefined) => (val(v) ? formatCpf(val(v)!) : undefined);
const cnpj = (v: string | null | undefined) => (val(v) ? formatCnpj(val(v)!) : undefined);

/** 150000 → "1.500,00" (aritmética inteira, sem depender de ICU). */
export function formatMoney(cents: number): string {
  const reais = Math.trunc(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${reais},${String(cents % 100).padStart(2, '0')}`;
}

const dateParts = (tz: string, d: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<'day' | 'month' | 'year' | 'hour' | 'minute', string>;

/** Instante → DD/MM/AAAA no fuso de Maceió. */
export function formatDateBR(d: Date): string {
  const p = dateParts(CONTRACT_TZ, d);
  return `${p.day}/${p.month}/${p.year}`;
}

/** Instante → HH:MM no fuso de Maceió. */
export function formatTimeBR(d: Date): string {
  const p = dateParts(CONTRACT_TZ, d);
  return `${p.hour}:${p.minute}`;
}

/** Colunas `@db.Date` chegam como meia-noite UTC: formatar em UTC evita voltar um dia. */
export function formatDateOnly(d: Date): string {
  const p = dateParts('UTC', d);
  return `${p.day}/${p.month}/${p.year}`;
}

const join = (...xs: (string | null | undefined)[]) => val(xs.map(val).filter(Boolean).join(', '));

/**
 * Local do show: casa vinculada ao evento → local descrito no evento → endereço do contratante (proposta direta,
 * sem evento). Cidade e UF caem para os do contratante só quando ausentes no local escolhido.
 */
export function resolveLocation(src: Pick<ContractSource, 'event' | 'organization'>) {
  const { event, organization: org } = src;
  const described: Place | null =
    event && (event.locationAddress || event.locationName || event.locationCity)
      ? { name: event.locationName, addressLine: event.locationAddress, city: event.locationCity, state: event.locationState }
      : null;
  const place: Place = event?.venue ?? described ?? org;
  return {
    address: join(place.name, place.addressLine, place.neighborhood),
    city: val(place.city) ?? val(org.city),
    state: val(place.state) ?? val(org.state),
  };
}

function artistFields(src: ContractSource): ContractFields {
  const name = val(src.artist.name);
  if (src.artist.kind === 'SOLO') {
    return {
      ARTISTA_NOME_ARTISTICO: name,
      // Cláusula de substituição: artista solo não tem "grupo"; quem pode ser substituído é quem o acompanha.
      ARTISTA_GRUPO: `da equipe que acompanha ${name ?? MISSING}`,
      ARTISTA_NOME_LEGAL: val(src.soloPerson?.legalName),
      ARTISTA_DOCUMENTO: cpf(src.soloPerson?.cpf),
      ARTISTA_REPRESENTANTE: '',
    };
  }
  if (val(src.band?.cnpj)) {
    return {
      ARTISTA_NOME_ARTISTICO: name,
      ARTISTA_GRUPO: `do grupo ${name ?? MISSING}`,
      ARTISTA_NOME_LEGAL: val(src.band?.legalName),
      ARTISTA_DOCUMENTO: cnpj(src.band?.cnpj),
      ARTISTA_REPRESENTANTE: '',
    };
  }
  // Banda sem CNPJ: o OWNER responde como representante legal e como parte contratada.
  const ownerName = val(src.bandOwner?.legalName);
  const ownerCpf = cpf(src.bandOwner?.cpf);
  return {
    ARTISTA_NOME_ARTISTICO: name,
    ARTISTA_GRUPO: `do grupo ${name ?? MISSING}`,
    ARTISTA_NOME_LEGAL: ownerName,
    ARTISTA_DOCUMENTO: ownerCpf,
    ARTISTA_REPRESENTANTE: `${ownerName ?? MISSING}, CPF ${ownerCpf ?? MISSING}, representando o grupo musical "${name ?? MISSING}"`,
  };
}

function contractorFields(src: ContractSource): ContractFields {
  const org = src.organization;
  const address = join(org.addressLine, org.neighborhood);
  if (src.contractorType === 'VENUE') {
    return {
      CONTRATANTE_NOME: val(org.legalName) ?? val(org.name),
      CONTRATANTE_CNPJ: cnpj(org.cnpj),
      CONTRATANTE_ENDERECO: address,
      CONTRATANTE_CIDADE: val(org.city),
      CONTRATANTE_UF: val(org.state),
    };
  }
  const person = src.contractorPerson;
  return {
    CONTRATANTE_NOME: val(person?.legalName),
    CONTRATANTE_CPF: cpf(person?.cpf),
    CONTRATANTE_RG: val(person?.rg),
    CONTRATANTE_ENDERECO: address,
    CONTRATANTE_CIDADE: val(org.city),
    CONTRATANTE_UF: val(org.state),
    CONTRATANTE_TELEFONE: val(org.contactPhone),
  };
}

function paymentFields(src: ContractSource): ContractFields {
  const { feeCents, signalCents } = src.offer;
  // Saldo = cachê − sinal. Sem sinal definido, a divisão é desconhecida: sinal e saldo ficam "[A PREENCHER]".
  const balanceCents = signalCents == null ? null : feeCents - signalCents;
  const money = (c: number | null) => (c == null ? undefined : formatMoney(c));
  const words = (c: number | null) => (c == null ? undefined : toExtenso(c));
  return {
    CACHE_VALOR: formatMoney(feeCents),
    CACHE_VALOR_EXTENSO: toExtenso(feeCents),
    SINAL_VALOR: money(signalCents),
    SINAL_VALOR_EXTENSO: words(signalCents),
    SINAL_PRAZO: src.offer.signalDueDate ? formatDateOnly(src.offer.signalDueDate) : undefined,
    SALDO_VALOR: money(balanceCents),
    SALDO_VALOR_EXTENSO: words(balanceCents),
    SALDO_PRAZO: src.offer.balanceDueDate ? formatDateOnly(src.offer.balanceDueDate) : undefined,
    FORMA_PAGAMENTO: val(src.offer.paymentMethod),
  };
}

function truncate(s: string | undefined, max: number) {
  return s && s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Dicionário completo de campos para os dois templates. */
export function buildContractFields(src: ContractSource): ContractFields {
  const { offer, event } = src;
  const place = resolveLocation(src);
  return {
    ...contractorFields(src),
    ...artistFields(src),
    ...paymentFields(src),
    APRESENTACAO_DESCRICAO: val(offer.presentationDesc) ?? val(event?.title),
    EVENTO_DATA: formatDateBR(offer.performanceAt),
    EVENTO_HORARIO: formatTimeBR(offer.performanceAt),
    EVENTO_DURACAO: String(offer.durationMinutes),
    EVENTO_ENDERECO: place.address,
    EVENTO_CIDADE: place.city,
    EVENTO_UF: place.state,
    EVENTO_DESCRICAO: truncate(val(event?.description), EVENT_DESCRIPTION_MAX),
    ANTECEDENCIA_MINUTOS: offer.advanceMinutes == null ? undefined : String(offer.advanceMinutes),
    ANTECEDENCIA_INFORMACAO: String(DEFAULT_INFO_DAYS),
    ANTECEDENCIA_SUBSTITUICAO: String(offer.substitutionDays ?? DEFAULT_SUBSTITUTION_DAYS),
    RESCISAO_PRAZO: String(offer.rescissionDays ?? DEFAULT_RESCISSION_DAYS),
    FORO_CIDADE: place.city,
    FORO_UF: place.state,
    CONTRATO_CIDADE: place.city,
    CONTRATO_DATA: formatDateBR(src.generatedAt),
    // Testemunhas assinam à mão: linhas em branco em vez de "[A PREENCHER]".
    TESTEMUNHA_1_NOME: WITNESS_LINE,
    TESTEMUNHA_1_CPF: WITNESS_LINE,
    TESTEMUNHA_2_NOME: WITNESS_LINE,
    TESTEMUNHA_2_CPF: WITNESS_LINE,
  };
}

export function templateFileFor(type: ContractorType): 'venue-artist.md' | 'individual-artist.md' {
  return type === 'VENUE' ? 'venue-artist.md' : 'individual-artist.md';
}

/** Dados cadastrais (não negociados) que faltam em cada lado: o que cada parte pode completar antes ou depois de confirmar. */
export interface MissingPartyData {
  contractor: string[];
  artist: string[];
}

/**
 * Lista, com rótulos para a interface, os dados civis que sairiam como "[A PREENCHER]" no contrato. Termos da oferta
 * (sinal, prazos, forma de pagamento) ficam fora: só mudam por contraproposta, não pelo cadastro.
 */
export function missingPartyData(src: ContractSource): MissingPartyData {
  const f = buildContractFields(src);
  const pick = (pairs: [key: string, label: string][]) => pairs.filter(([k]) => f[k] === undefined).map(([, label]) => label);
  const contractor =
    src.contractorType === 'VENUE'
      ? pick([
          ['CONTRATANTE_CNPJ', 'CNPJ da casa'],
          ['CONTRATANTE_ENDERECO', 'Endereço da casa'],
          ['CONTRATANTE_CIDADE', 'Cidade da casa'],
        ])
      : pick([
          ['CONTRATANTE_NOME', 'Nome completo do contratante'],
          ['CONTRATANTE_CPF', 'CPF do contratante'],
          ['CONTRATANTE_RG', 'RG do contratante'],
          ['CONTRATANTE_ENDERECO', 'Endereço do contratante'],
          ['CONTRATANTE_TELEFONE', 'Telefone do contratante'],
        ]);
  const band = src.artist.kind === 'BAND';
  const withCnpj = band && !!val(src.band?.cnpj);
  const artist = pick([
    ['ARTISTA_NOME_LEGAL', withCnpj ? 'Razão social da banda' : band ? 'Nome completo do responsável pela banda' : 'Nome completo do artista'],
    ['ARTISTA_DOCUMENTO', band ? 'CPF do responsável pela banda (ou CNPJ da banda)' : 'CPF do artista'],
  ]);
  return { contractor, artist };
}
