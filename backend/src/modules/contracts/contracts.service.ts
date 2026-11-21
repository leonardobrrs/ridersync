import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { conflict, notFound } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildContractFields, ContractSource, missingPartyData } from './contract-data.rules';
import { loadTemplate } from './templates';
import { fillTemplate, PLACEHOLDER } from './utils/fill-template';
import { generateContractPdf } from './utils/generate-pdf';

export const contractSummarySelect = { id: true, bookingId: true, templateType: true, generatedAt: true, content: true } satisfies Prisma.ContractSelect;

export const contractDownloadUrl = (id: string) => `/api/contracts/${id}/download`;

export function toContractSummary(c: Prisma.ContractGetPayload<{ select: typeof contractSummarySelect }>) {
  return {
    id: c.id,
    bookingId: c.bookingId,
    templateType: c.templateType,
    generatedAt: c.generatedAt,
    downloadUrl: contractDownloadUrl(c.id),
    /** Campos que saíram como "[A PREENCHER]" (o texto em si nunca vai para a listagem; só no PDF autenticado). */
    pendingFields: c.content.split(PLACEHOLDER).length - 1,
  };
}

const personSelect = { legalName: true, cpf: true } satisfies Prisma.UserSelect;
const ownerWhere = { role: 'OWNER', status: 'ACTIVE' } as const;

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Só quem administra um dos lados da negociação enxerga o contrato. Quem não participa recebe 404 (não revela existência). */
  private async assertParticipant(userId: string, booking: { organizationId: string; artistId: string }) {
    const [orgRole, artistAccess] = await Promise.all([
      this.access.orgRole(userId, booking.organizationId),
      this.access.artistAccess(userId, booking.artistId),
    ]);
    if (!orgRole && !artistAccess?.canManage) throw notFound('Contrato não encontrado.');
  }

  /**
   * Avisa as duas partes (todos os administradores de cada lado) que o contrato foi gerado ou atualizado — no
   * sino e por e-mail, conforme as preferências de "Negociações". Cada versão do contrato notifica uma única vez.
   */
  private async notifyParties(
    contract: { id: string; bookingId: string; generatedAt: Date; pendingFields: number },
    kind: 'READY' | 'UPDATED',
  ) {
    try {
      const b = await this.prisma.booking.findUniqueOrThrow({
        where: { id: contract.bookingId },
        select: { organizationId: true, artistId: true, title: true, event: { select: { title: true } } },
      });
      const [orgUsers, artistUsers] = await Promise.all([
        this.access.organizationMemberUserIds(b.organizationId),
        this.access.artistManagerUserIds(b.artistId),
      ]);
      const what = b.event?.title ?? b.title;
      const pending =
        contract.pendingFields > 0
          ? ` Ainda há ${contract.pendingFields} campo(s) "[A PREENCHER]": complete seus dados para contrato e atualize o contrato na negociação.`
          : ' Todos os campos estão preenchidos; confira antes de assinar.';
      await this.prisma.$transaction((tx) =>
        this.notifications.notify(tx, [...orgUsers, ...artistUsers], {
          category: 'BOOKINGS',
          type: kind === 'READY' ? 'CONTRACT_READY' : 'CONTRACT_UPDATED',
          title: kind === 'READY' ? `Contrato disponível: ${what}` : `Contrato atualizado: ${what}`,
          body: (kind === 'READY' ? 'O contrato de prestação de serviços desta contratação foi gerado.' : 'O contrato foi refeito com os dados cadastrais atuais.') + pending,
          link: `/painel/negociacoes/${contract.bookingId}`,
          dedupeKey: `contract:${kind}:${contract.id}:${contract.generatedAt.getTime()}`,
        }),
      );
      await this.notifications.flush();
    } catch (e) {
      // Aviso é complementar: falha aqui não desfaz a geração do contrato.
      this.logger.error(`Falha ao notificar o contrato ${contract.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async loadSource(
    bookingId: string,
  ): Promise<ContractSource & { status: string; performed: boolean; links: { contractor: string; artist: string } }> {
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        status: true,
        performance: { select: { id: true } },
        organization: {
          select: {
            id: true,
            type: true,
            name: true,
            legalName: true,
            cnpj: true,
            addressLine: true,
            neighborhood: true,
            city: true,
            state: true,
            contactPhone: true,
            members: { where: ownerWhere, take: 1, orderBy: { joinedAt: 'asc' }, select: { user: { select: { legalName: true, cpf: true, rg: true } } } },
          },
        },
        artist: {
          select: {
            kind: true,
            name: true,
            musicianProfile: { select: { user: { select: personSelect } } },
            band: {
              select: {
                id: true,
                legalName: true,
                cnpj: true,
                members: { where: ownerWhere, take: 1, orderBy: { joinedAt: 'asc' }, select: { user: { select: personSelect } } },
              },
            },
          },
        },
        event: {
          select: {
            title: true,
            description: true,
            locationName: true,
            locationAddress: true,
            locationCity: true,
            locationState: true,
            venue: { select: { name: true, addressLine: true, neighborhood: true, city: true, state: true } },
          },
        },
        offers: {
          where: { status: 'ACCEPTED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            performanceAt: true,
            durationMinutes: true,
            feeCents: true,
            presentationDesc: true,
            advanceMinutes: true,
            signalCents: true,
            signalDueDate: true,
            balanceDueDate: true,
            paymentMethod: true,
            rescissionDays: true,
            substitutionDays: true,
          },
        },
      },
    });
    if (!b) throw notFound('Negociação não encontrada.');
    const offer = b.offers[0];
    if (!offer) throw conflict('NO_AGREED_OFFER', 'Não há termos acordados nesta negociação.');
    const { members: orgOwners, type, id: orgId, ...orgData } = b.organization;
    const { artist } = b;
    return {
      status: b.status,
      performed: !!b.performance,
      // Onde cada lado completa os dados para contrato.
      links: {
        contractor: type === 'VENUE' ? `/painel/casas/${orgId}` : '/painel/conta',
        artist: artist.band ? `/painel/bandas/${artist.band.id}` : '/painel/conta',
      },
      generatedAt: new Date(),
      contractorType: type,
      organization: orgData,
      contractorPerson: orgOwners[0]?.user ?? null,
      artist: { kind: artist.kind, name: artist.name },
      soloPerson: artist.musicianProfile?.user ?? null,
      band: artist.band ? { legalName: artist.band.legalName, cnpj: artist.band.cnpj } : null,
      bandOwner: artist.band?.members[0]?.user ?? null,
      event: b.event,
      offer,
    };
  }

  /**
   * Gera o contrato de uma contratação CONFIRMADA (idempotente: um por negociação). O texto é preenchido só por
   * substituição de campos; o conteúdo fica congelado no banco e o PDF é renderizado a partir dele no download.
   * Chamado após o commit da confirmação — nunca dentro da transação.
   */
  async generateForBooking(bookingId: string) {
    const existing = await this.prisma.contract.findUnique({ where: { bookingId }, select: contractSummarySelect });
    if (existing) return toContractSummary(existing);
    const { status, performed: _performed, links: _links, ...source } = await this.loadSource(bookingId);
    if (status !== 'CONFIRMED') throw conflict('NOT_CONFIRMED', 'O contrato só é gerado para contratações confirmadas.');
    const content = fillTemplate(loadTemplate(source.contractorType), buildContractFields(source));
    try {
      const created = await this.prisma.contract.create({
        data: { bookingId, templateType: source.contractorType, content, generatedAt: source.generatedAt },
        select: contractSummarySelect,
      });
      const summary = toContractSummary(created);
      await this.notifyParties(summary, 'READY');
      return summary;
    } catch (e) {
      // Duas confirmações concorrentes: a segunda perde a corrida pela unicidade de bookingId e devolve a existente.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return toContractSummary(await this.prisma.contract.findUniqueOrThrow({ where: { bookingId }, select: contractSummarySelect }));
      }
      throw e;
    }
  }

  /**
   * Refaz o texto com os dados cadastrais ATUAIS (ex.: as partes preencheram CPF/CNPJ depois da confirmação).
   * Permitido enquanto a contratação estiver CONFIRMADA e o show não tiver acontecido (apresentação registrada ou data
   * combinada já passada): depois disso o contrato fica como está. As duas partes são avisadas de cada atualização.
   * Os termos continuam os da oferta aceita.
   */
  async refreshForBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { organizationId: true, artistId: true } });
    if (!booking) throw notFound('Negociação não encontrada.');
    await this.assertParticipant(userId, booking);
    const { status, performed, links: _links, ...source } = await this.loadSource(bookingId);
    if (status !== 'CONFIRMED') throw conflict('NOT_CONFIRMED', 'O contrato só é gerado para contratações confirmadas.');
    if (performed || source.offer.performanceAt.getTime() <= Date.now()) {
      throw conflict('CONTRACT_LOCKED', 'Show realizado: o contrato não pode mais ser atualizado.');
    }
    const content = fillTemplate(loadTemplate(source.contractorType), buildContractFields(source));
    const saved = await this.prisma.contract.upsert({
      where: { bookingId },
      create: { bookingId, templateType: source.contractorType, content, generatedAt: source.generatedAt },
      update: { templateType: source.contractorType, content, generatedAt: source.generatedAt },
      select: contractSummarySelect,
    });
    const summary = toContractSummary(saved);
    await this.notifyParties(summary, 'UPDATED');
    return summary;
  }

  /** O que falta de dados cadastrais em cada lado (com o link de onde completar), para avisar antes e depois de confirmar. */
  async readiness(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { organizationId: true, artistId: true } });
    if (!booking) throw notFound('Negociação não encontrada.');
    await this.assertParticipant(userId, booking);
    const { status: _s, performed: _p, links, ...source } = await this.loadSource(bookingId);
    const missing = missingPartyData(source);
    return {
      contractor: { missing: missing.contractor, link: links.contractor },
      artist: { missing: missing.artist, link: links.artist },
    };
  }

  /** Geração a partir da confirmação: uma falha aqui não pode desfazer a contratação (o contrato pode ser gerado depois). */
  async generateAfterConfirmation(bookingId: string): Promise<void> {
    try {
      await this.generateForBooking(bookingId);
    } catch (e) {
      this.logger.error(`Falha ao gerar o contrato da negociação ${bookingId}: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    }
  }

  /** Metadados do contrato da negociação (null se ainda não gerado). */
  async findByBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { organizationId: true, artistId: true } });
    if (!booking) throw notFound('Negociação não encontrada.');
    await this.assertParticipant(userId, booking);
    const c = await this.prisma.contract.findUnique({ where: { bookingId }, select: contractSummarySelect });
    return c ? toContractSummary(c) : null;
  }

  /** Gera sob demanda (recuperação quando a geração automática falhou ou para contratações anteriores ao módulo). */
  async ensureForBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { organizationId: true, artistId: true } });
    if (!booking) throw notFound('Negociação não encontrada.');
    await this.assertParticipant(userId, booking);
    return this.generateForBooking(bookingId);
  }

  /** PDF do contrato, para qualquer das duas partes. */
  async download(userId: string, contractId: string) {
    const c = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, content: true, generatedAt: true, booking: { select: { id: true, organizationId: true, artistId: true } } },
    });
    if (!c) throw notFound('Contrato não encontrado.');
    await this.assertParticipant(userId, c.booking);
    const pdf = await generateContractPdf(c.content, { createdAt: c.generatedAt });
    return { pdf, filename: `contrato-${c.booking.id}.pdf` };
  }
}
