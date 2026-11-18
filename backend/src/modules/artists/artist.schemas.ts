import { z } from 'zod';
import {
  externalUrl,
  formats,
  genres,
  instruments,
  moneyCents,
  optionalEmail,
  optionalExternalUrl,
  optionalInstagram,
  optionalPhone,
  optionalAlCity,
  text,
  uf,
} from '../../common/validation';
import { INSTRUMENTS } from '../../common/domain-lists';

const currentYear = new Date().getUTCFullYear();

/** Campos de perfil profissional compartilhados por músico individual e banda. */
export const ArtistProfileFields = {
  name: text(2, 80, 'Nome artístico'),
  headline: z.string().trim().max(80, 'Resumo deve ter no máximo 80 caracteres.'),
  bio: z.string().trim().max(3000, 'Descrição deve ter no máximo 3000 caracteres.'),
  city: optionalAlCity,
  state: uf,
  genres,
  formats,
  careerStartYear: z.number().int().min(1940, 'Ano inválido.').max(currentYear, 'Ano não pode estar no futuro.').nullable(),
  baseFeeCents: moneyCents.nullable(),
  contactEmail: optionalEmail,
  contactPhone: optionalPhone,
  instagram: optionalInstagram,
  website: optionalExternalUrl,
};

export const UpdateArtistSchema = z.object(ArtistProfileFields).partial().strict();
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;

export const CreateArtistSchema = z
  .object(ArtistProfileFields)
  .partial()
  .extend({ name: ArtistProfileFields.name })
  .strict();
export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;

export const MusicianDetailsSchema = z
  .object({
    mainInstrument: z.enum(INSTRUMENTS, { error: 'Instrumento inválido.' }).nullable(),
    instruments,
  })
  .partial()
  .strict();

export const CreateMusicianSchema = CreateArtistSchema.extend(MusicianDetailsSchema.shape).strict();

export const VisibilitySchema = z.object({ visibility: z.enum(['PUBLIC', 'PRIVATE']) });

export const PortfolioLinkSchema = z
  .object({
    kind: z.enum(['AUDIO', 'VIDEO', 'PHOTO', 'DOCUMENT', 'LINK']),
    title: text(2, 100, 'Título'),
    description: z.string().trim().max(300).default(''),
    url: externalUrl,
  })
  .strict();

export const PortfolioUploadFieldsSchema = z.object({
  kind: z.enum(['PHOTO', 'DOCUMENT']),
  title: text(2, 100, 'Título'),
  description: z.string().trim().max(300).default(''),
});

export const PortfolioUpdateSchema = z
  .object({
    title: text(2, 100, 'Título'),
    description: z.string().trim().max(300),
    position: z.number().int().min(0).max(1000),
  })
  .partial()
  .strict();

/** Requisitos mínimos para um perfil artístico ficar público (e candidatar-se / receber propostas). */
export function publicationIssues(a: { name: string; bio: string; city: string | null; genres: string[] }): string[] {
  const issues: string[] = [];
  if (a.name.trim().length < 2) issues.push('Nome artístico');
  if (!a.city) issues.push('Cidade');
  if (a.genres.length === 0) issues.push('Ao menos um estilo musical');
  if (a.bio.trim().length < 40) issues.push('Descrição com ao menos 40 caracteres');
  return issues;
}
