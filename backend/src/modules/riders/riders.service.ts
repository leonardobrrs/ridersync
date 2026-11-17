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
      select: { id: true, name: true, unit: true, category: true },
    });
  }

  private async validateCatalogIds(items: ItemInput[]) {
    const ids = items.map((i) => i.catalogItemId).filter((x): x is string => !!x);
    if (new Set(ids).size !== ids.length) throw unprocessable('DUPLICATE_ITEM', 'Cada item do catálogo deve aparecer uma única vez.');
    if (!ids.length) return;
    const found = await this.prisma.equipmentCatalogItem.count({ where: { id: { in: ids }, active: true } });
    if (found !== ids.length) throw unprocessable('UNKNOWN_CATALOG_ITEM', 'Item de catálogo desconhecido.');
  }

  async getRider(artistId: string) {
    const rider = await this.prisma.technicalRider.findUnique({
      where: { artistId },
      select: { id: true, notes: true, updatedAt: true, items: { select: itemSelect, orderBy: { createdAt: 'asc' } } },
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
    await this.validateCatalogIds(input.items);
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
    await this.validateCatalogIds(input.items);
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
   * Comparação sob demanda. Autorizado para: quem participa da identidade artística; ou
   * responsável da casa quando o artista é público ou já se relacionou com a casa (candidatura/negociação).
   */
  async compare(userId: string, artistId: string, organizationId: string) {
    const [artistAccess, org] = await Promise.all([
      this.access.artistAccess(userId, artistId),
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, slug: true } }),
    ]);
    if (!artistAccess) throw notFound('Perfil artístico não encontrado.');
    if (!org) throw notFound('Casa de show não encontrada.');
    if (!artistAccess.canView) {
      const role = await this.access.orgRole(userId, organizationId);
      if (!role) throw forbidden('Você não pode comparar este rider.');
      const artist = await this.prisma.artist.findUniqueOrThrow({
        where: { id: artistId },
        select: {
          visibility: true,
          _count: {
            select: {
              applications: { where: { event: { organizerId: organizationId } } },
              bookings: { where: { organizationId } },
            },
          },
        },
      });
      if (artist.visibility !== 'PUBLIC' && artist._count.applications === 0 && artist._count.bookings === 0) {
        throw forbidden('Este perfil artístico não é público.');
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
}

const CATEGORY_ORDER = ['Áudio', 'Backline', 'Palco e energia'];
function sortItems<T extends { category: string | null; name: string; isCustom: boolean }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ca = a.isCustom ? 99 : CATEGORY_ORDER.indexOf(a.category ?? '');
    const cb = b.isCustom ? 99 : CATEGORY_ORDER.indexOf(b.category ?? '');
    return ca - cb || a.name.localeCompare(b.name, 'pt-BR');
  });
}
