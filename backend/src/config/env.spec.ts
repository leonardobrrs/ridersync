import { originMatcher } from './env';

describe('originMatcher (CORS/CSRF)', () => {
  const allowed = originMatcher(['https://ridersync-front.vercel.app', 'https://ridersync-front-*-projetao2.vercel.app', 'http://localhost:5173']);

  it('aceita origens exatas', () => {
    expect(allowed('https://ridersync-front.vercel.app')).toBe(true);
    expect(allowed('http://localhost:5173')).toBe(true);
  });

  it('aceita URLs de Preview e alias de branch do projeto no time', () => {
    expect(allowed('https://ridersync-front-a1b2c3d4e-projetao2.vercel.app')).toBe(true);
    expect(allowed('https://ridersync-front-git-main-projetao2.vercel.app')).toBe(true);
  });

  it('recusa origens de terceiros e tentativas de burlar o curinga', () => {
    for (const o of [
      'https://evil.com',
      'https://ridersync-front.vercel.app.evil.com',
      'https://ridersync-front-x.evil.com-projetao2.vercel.app',
      'https://ridersync-front--projetao2.vercel.app',
      'http://ridersync-front-abc-projetao2.vercel.app',
      'https://ridersync-front-abc-projetao2.vercel.app:8443',
      'https://ridersync-front-abc-outrotime.vercel.app',
    ]) {
      expect(allowed(o)).toBe(false);
    }
  });

  it('sem curingas, comporta-se como lista exata', () => {
    const only = originMatcher(['http://localhost:5173']);
    expect(only('http://localhost:5173')).toBe(true);
    expect(only('http://localhost:5174')).toBe(false);
  });
});
