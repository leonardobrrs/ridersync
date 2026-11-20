/**
 * Avaliação pós-show. Regras puras (testadas em review.rules.spec.ts).
 *  - só contratações CONFIRMADAS cuja apresentação já aconteceu (data acordada no passado ou apresentação registrada);
 *  - uma avaliação por lado: o contratante (VENUE) avalia o artista; o artista (ARTIST) avalia o contratante;
 *  - nota inteira de 0 a 5 estrelas.
 */
export type ReviewSide = 'VENUE' | 'ARTIST';

export function reviewEligibility(input: {
  bookingStatus: string;
  performanceAt: Date | null;
  performanceRegistered: boolean;
  side: ReviewSide | null;
  existingSides: ReviewSide[];
  now: Date;
}): { canReview: boolean; reason: string | null } {
  if (!input.side) return { canReview: false, reason: 'Só quem participa da contratação pode avaliar.' };
  if (input.bookingStatus !== 'CONFIRMED') return { canReview: false, reason: 'A avaliação fica disponível depois de uma contratação confirmada.' };
  const happened = input.performanceRegistered || (!!input.performanceAt && input.performanceAt.getTime() <= input.now.getTime());
  if (!happened) return { canReview: false, reason: 'A avaliação fica disponível depois da apresentação.' };
  if (input.existingSides.includes(input.side)) return { canReview: false, reason: 'Você já avaliou esta apresentação.' };
  return { canReview: true, reason: null };
}

/** Média com uma casa decimal; null sem avaliações. */
export function averageRating(ratings: number[]): number | null {
  if (!ratings.length) return null;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}
