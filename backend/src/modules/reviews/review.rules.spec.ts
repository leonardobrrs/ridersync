import { averageRating, reviewEligibility } from './review.rules';

const now = new Date('2026-11-19T20:00:00-03:00');
const past = new Date('2026-11-10T21:00:00-03:00');
const future = new Date('2026-12-10T21:00:00-03:00');
const base = { bookingStatus: 'CONFIRMED', performanceAt: past, performanceRegistered: false, side: 'VENUE' as const, existingSides: [], now };

describe('avaliação pós-show', () => {
  it('libera para participante de contratação confirmada depois da apresentação', () => {
    expect(reviewEligibility(base).canReview).toBe(true);
    expect(reviewEligibility({ ...base, side: 'ARTIST' }).canReview).toBe(true);
  });
  it('apresentação registrada libera mesmo antes da data acordada', () => {
    expect(reviewEligibility({ ...base, performanceAt: future, performanceRegistered: true }).canReview).toBe(true);
  });
  it('bloqueia antes do show, sem confirmação, para terceiros e quando o lado já avaliou', () => {
    expect(reviewEligibility({ ...base, performanceAt: future }).reason).toContain('depois da apresentação');
    expect(reviewEligibility({ ...base, bookingStatus: 'AGREED' }).canReview).toBe(false);
    expect(reviewEligibility({ ...base, side: null }).canReview).toBe(false);
    expect(reviewEligibility({ ...base, existingSides: ['VENUE'] }).reason).toBe('Você já avaliou esta apresentação.');
    expect(reviewEligibility({ ...base, side: 'ARTIST', existingSides: ['VENUE'] }).canReview).toBe(true);
  });
  it('média com uma casa decimal', () => {
    expect(averageRating([])).toBeNull();
    expect(averageRating([5, 4, 4])).toBe(4.3);
    expect(averageRating([0, 5])).toBe(2.5);
  });
});
