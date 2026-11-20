import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { forbidden, notFound, unprocessable } from '../../common/errors';
import { optionalText } from '../../common/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { compareRider } from './compatibility';

const itemBase = {
  catalogItemId: z.string().trim().min(1).max(40).nullish(),
  customName: optionalText(80, 'Nome do item'),
  customUnit: optionalText(20, 'Unidade'),
  notes: z.string().trim().max(200).default(''),
};
const exactlyOne = (v: { catalogItemId?: string | null; customName?: string | null }) => !!v.catalogItemId !== !!v.customName;
const exactlyOneMsg = { message: 'Informe um item do catálogo OU um item personalizado (“outros”).' };

export const RiderItemSchema = z
  .object({ ...itemBase, quantity: z.number().int().min(1, 'Quantidade mínima: 1.').max(999) })
  .refine(exactlyOne, exactlyOneMsg);
export const PutRiderSchema = z
  .object({ notes: z.string().trim().max(2000).default(''), items: z.array(RiderItemSchema).max(80) })
  .strict();

export const EquipmentItemSchema = z
  .object({ ...itemBase, quantity: z.number().int().min(0, 'Quantidade não pode ser negativa.').max(9999) })
  .refine(exactlyOne, exactlyOneMsg);
export const PutEquipmentSchema = z.object({ items: z.array(EquipmentItemSchema).max(200) }).strict();

type ItemInput = z.infer<typeof RiderItemSchema> | z.infer<typeof EquipmentItemSchema>;

const itemSelect = {
  id: true,
  catalogItemId: true,
  customName: true,
  customUnit: true,
  quantity: true,
  notes: true,
  catalogItem: { select: { name: true, unit: true, category: true } },
} as const;

type ItemRow = {
  id: string;
  catalogItemId: string | null;
  customName: string | null;
  customUnit: string | null;
  quantity: number;
  notes: string;
  catalogItem: { name: string; unit: string; category: string } | null;
};

export function toItem(r: ItemRow) {
  return {
    id: r.id,
    catalogItemId: r.catalogItemId,
    customName: r.customName,
    name: r.catalogItem?.name ?? r.customName ?? '',
    unit: r.catalogItem?.unit ?? r.customUnit ?? 'un',
    category: r.catalogItem?.category ?? null,
    isCustom: !r.catalogItemId,
    quantity: r.quantity,
    notes: r.notes,
  };
}

@Injectable()
export class RidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  catalog() {
    return this.prisma.equipmentCatalogItem.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }],
      select: { id: true, name: true, unit: true, category: true, artistRequirement: true },
    });
  }

  private async validateCatalogIds(items: ItemInput[], forArtistRider: boolean) {
    const ids = items.map((i) => i.catalogItemId).filter((x): x is string => !!x);
    if (new Set(ids).size !== ids.length) throw unprocessable('DUPLICATE_ITEM', 'Cada item do catálogo deve aparecer uma única vez.');
    if (!ids.length) return;
    const found = await this.prisma.equipmentCatalogItem.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, artistRequirement: true } });
    if (found.length !== ids.length) throw unprocessable('UNKNOWN_CATALOG_ITEM', 'Item de catálogo desconhecido.');
    if (forArtistRider && found.some((f) => !f.artistRequirement)) {
      throw unprocessable('VENUE_ONLY_ITEM', 'Palco, energia, iluminação e camarim são exigências do local e não fazem parte do rider do artista.');
    }
  }

  /** Itens de exigência do local gravados antes da regra atual ficam ocultos (e saem no próximo salvamento). */
  async getRider(artistId: string) {
    const rider = await this.prisma.technicalRider.findUnique({
      where: { artistId },
      select: {
        id: true,
        notes: true,
        updatedAt: true,
        items: {
          where: { OR: [{ catalogItemId: null }, { catalogItem: { artistRequirement: true } }] },
          select: itemSelect,
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!rider) throw notFound('Rider não encontrado.');
    return { notes: rider.notes, updatedAt: rider.updatedAt, items: sortItems(rider.items.map(toItem)) };
  }

  async getRiderForMember(userId: string, artistId: string) {
    await this.access.assertCanViewArtist(userId, artistId);
    return this.getRider(artistId);
  }

  /** Substitui atomicamente os itens do rider de UMA identidade artística (não afeta outros riders). */
  async putRider(userId: string, artistId: string, input: z.infer<typeof PutRiderSchema>) {
    await this.access.assertCanManageArtist(userId, artistId);
    await this.validateCatalogIds(input.items, true);
    await this.prisma.$transaction(async (tx) => {
      const rider = await tx.technicalRider.upsert({ where: { artistId }, create: { artistId, notes: input.notes }, update: { notes: input.notes } });
      await tx.riderItem.deleteMany({ where: { riderId: rider.id } });
      if (input.items.length) {
        await tx.riderItem.createMany({
          data: input.items.map((i) => ({
            riderId: rider.id,
            catalogItemId: i.catalogItemId ?? null,
            customName: i.catalogItemId ? null : i.customName,
            customUnit: i.catalogItemId ? null : i.customUnit,
            quantity: i.quantity,
            notes: i.notes,
          })),
        });
      }
    });
    return this.getRider(artistId);
  }

  async getEquipment(organizationId: string) {
    const rows = await this.prisma.venueEquipmentItem.findMany({
      where: { organizationId },
      select: itemSelect,
      orderBy: { createdAt: 'asc' },
    });
    return { items: sortItems(rows.map(toItem)) };
  }

  async getEquipmentForMember(userId: string, organizationId: string) {
    await this.access.assertOrgMember(userId, organizationId);
    return this.getEquipment(organizationId);
  }

  /** Substitui atomicamente o inventário da casa (não altera riders). */
  async putEquipment(userId: string, organizationId: string, input: z.infer<typeof PutEquipmentSchema>) {
    await this.access.assertOrgMember(userId, organizationId);
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { type: true } });
    if (org.type !== 'VENUE') throw unprocessable('NOT_A_VENUE', 'Somente casas de show possuem inventário de equipamentos.');
    await this.validateCatalogIds(input.items, false);
    await this.prisma.$transaction(async (tx) => {
      await tx.venueEquipmentItem.deleteMany({ where: { organizationId } });
      if (input.items.length) {
        await tx.venueEquipmentItem.createMany({
          data: input.items.map((i) => ({
            organizationId,
            organizationType: 'VENUE' as const,
            catalogItemId: i.catalogItemId ?? null,
            customName: i.catalogItemId ? null : i.customName,
            customUnit: i.catalogItemId ? null : i.customUnit,
            quantity: i.quantity,
            notes: i.notes,
          })),
        });
      }
    });
    return this.getEquipment(organizationId);
  }

  /**
   * Comparação sob demanda, somente em contextos autorizados:
   *  - quem participa da identidade artística (perfil pessoal), contra qualquer casa de show;
   *  - responsável da casa apenas no contexto de negociação/candidatura com aquele artista.
   * O perfil público não oferece comparação.
   */
  async compare(userId: string, artistId: string, organizationId: string) {
    const [artistAccess, org] = await Promise.all([
      this.access.artistAccess(userId, artistId),
      this.prisma.organization.findFirst({ where: { id: organizationId, type: 'VENUE' }, select: { id: true, name: true, slug: true } }),
    ]);
    if (!artistAccess) throw notFound('Perfil artístico não encontrado.');
    if (!org) throw notFound('Casa de show não encontrada.');
    if (!artistAccess.canView) {
      const role = await this.access.orgRole(userId, organizationId);
      if (!role) throw forbidden('Você não pode comparar este rider.');
      const related = await this.prisma.artist.findUniqueOrThrow({
        where: { id: artistId },
        select: {
          _count: {
            select: {
              applications: { where: { event: { organizerId: organizationId } } },
              bookings: { where: { organizationId } },
            },
          },
        },
      });
      if (related._count.applications === 0 && related._count.bookings === 0) {
        throw forbidden('A comparação de rider fica disponível na negociação ou na análise de candidaturas.');
      }
    }
    const rider = await this.getRider(artistId);
    const inventory = await this.prisma.venueEquipmentItem.findMany({
      where: { organizationId },
      select: { catalogItemId: true, customName: true, customUnit: true, quantity: true, notes: true },
    });
    const result = compareRider(
      rider.items.map((i) => ({
        riderItemId: i.id,
        catalogItemId: i.catalogItemId,
        name: i.name,
        category: i.category,
        unit: i.unit,
        quantity: i.quantity,
        notes: i.notes,
      })),
      inventory.filter((i) => i.catalogItemId).map((i) => ({ catalogItemId: i.catalogItemId!, quantity: i.quantity, notes: i.notes })),
    );
    return {
      organization: org,
      riderNotes: rider.notes,
      inventoryRegistered: inventory.length > 0,
      venueCustomItems: inventory
        .filter((i) => !i.catalogItemId)
        .map((i) => ({ name: i.customName, unit: i.customUnit ?? 'un', quantity: i.quantity, notes: i.notes })),
      ...result,
    };
  }

  /**
   * Comparação técnica de uma candidatura: o que o artista disse precisar da casa (necessidades informadas na
   * candidatura) × inventário da casa de show do evento. O rider do perfil representa o que o artista já possui.
   * Acesso: artista que se candidatou ou responsáveis do organizador.
   */
  async compareApplication(userId: string, applicationId: string) {
    const app = await this.prisma.eventApplication.findUnique({
      where: { id: applicationId },
      select: { artistId: true, needs: true, event: { select: { organizerId: true, venueId: true, organizer: { select: { type: true } } } } },
    });
    if (!app) throw notFound('Candidatura não encontrada.');
    const [artistAccess, role] = await Promise.all([this.access.artistAccess(userId, app.artistId), this.access.orgRole(userId, app.event.organizerId)]);
    if (!artistAccess?.canView && !role) throw notFound('Candidatura não encontrada.');
    const venueId = app.event.venueId ?? (app.event.organizer.type === 'VENUE' ? app.event.organizerId : null);
    if (!venueId) throw unprocessable('NO_VENUE_INVENTORY', 'Evento sem casa de show: não há inventário para comparar. Combine os equipamentos na negociação.');
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: venueId }, select: { id: true, name: true, slug: true } });
    const needs = (Array.isArray(app.needs) ? app.needs : []) as { catalogItemId: string | null; customName: string | null; quantity: number; notes?: string }[];
    const catalog = await this.prisma.equipmentCatalogItem.findMany({
      where: { id: { in: needs.map((n) => n.catalogItemId).filter((x): x is string => !!x) } },
      select: { id: true, name: true, unit: true, category: true },
    });
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const inventory = await this.prisma.venueEquipmentItem.findMany({
      where: { organizationId: venueId },
      select: { catalogItemId: true, customName: true, customUnit: true, quantity: true, notes: true },
    });
    const result = compareRider(
      needs.map((n, idx) => {
        const c = n.catalogItemId ? byId.get(n.catalogItemId) : undefined;
        return {
          riderItemId: `need-${idx}`,
          catalogItemId: c ? c.id : null,
          name: c?.name ?? n.customName ?? 'Item',
          category: c?.category ?? null,
          unit: c?.unit ?? 'un',
          quantity: n.quantity,
          notes: n.notes ?? '',
        };
      }),
      inventory.filter((i) => i.catalogItemId).map((i) => ({ catalogItemId: i.catalogItemId!, quantity: i.quantity, notes: i.notes })),
    );
    return {
      organization: org,
      riderNotes: '',
      source: 'APPLICATION' as const,
      inventoryRegistered: inventory.length > 0,
      venueCustomItems: inventory
        .filter((i) => !i.catalogItemId)
        .map((i) => ({ name: i.customName, unit: i.customUnit ?? 'un', quantity: i.quantity, notes: i.notes })),
      ...result,
    };
  }
}

const CATEGORY_ORDER = ['Áudio', 'Instrumentos e amplificação', 'Palco e energia'];
function sortItems<T extends { category: string | null; name: string; isCustom: boolean }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ca = a.isCustom ? 99 : CATEGORY_ORDER.indexOf(a.category ?? '');
    const cb = b.isCustom ? 99 : CATEGORY_ORDER.indexOf(b.category ?? '');
    return ca - cb || a.name.localeCompare(b.name, 'pt-BR');
  });
}
