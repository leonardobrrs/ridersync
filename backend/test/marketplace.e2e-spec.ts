import { INestApplication } from '@nestjs/common';
import { bootApp, Client, createPublicMusician, PUBLISHABLE_PROFILE, registerUser } from './helpers';

describe('Marketplace público (integração)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await bootApp();
    const a = await registerUser(app, 'Joana Forro');
    const artist = await createPublicMusician(a, 'Joana do Forró Busca');
    await a.patch(`/artists/${artist.id}`, { city: 'Arapiraca', genres: ['Forró'], formats: ['Trio'] }).expect(200);
    const b = await registerUser(app, 'Kleber Jazz');
    const band = await b.post('/bands', { name: 'Trio Jazz Busca', ...PUBLISHABLE_PROFILE, genres: ['Jazz'] });
    await b.put(`/artists/${band.body.artist.id}/visibility`, { visibility: 'PUBLIC' }).expect(200);
    await b.post('/me/musician-profile', { name: 'Kleber Privado Busca' }); // privado
  });
  afterAll(async () => {
    await app.close();
  });

  it('visitante lista perfis públicos sem login e não vê perfis privados', async () => {
    const res = await new Client(app).get('/public/artists?q=Busca&pageSize=48');
    expect(res.status).toBe(200);
    const names = res.body.items.map((i: { name: string }) => i.name);
    expect(names).toEqual(expect.arrayContaining(['Joana do Forró Busca', 'Trio Jazz Busca']));
    expect(names).not.toContain('Kleber Privado Busca');
    expect(JSON.stringify(res.body)).not.toMatch(/contactEmail|@teste\.ridersync\.dev|visibility/);
  });

  it('filtra por estilo, cidade, tipo e formação', async () => {
    const v = new Client(app);
    const byGenre = await v.get('/public/artists?genre=Jazz&q=Busca');
    expect(byGenre.body.items.map((i: { name: string }) => i.name)).toEqual(['Trio Jazz Busca']);
    const byCity = await v.get('/public/artists?city=arapiraca&q=Busca');
    expect(byCity.body.items.map((i: { name: string }) => i.name)).toEqual(['Joana do Forró Busca']);
    const byKind = await v.get('/public/artists?kind=BAND&q=Busca');
    expect(byKind.body.items.every((i: { kind: string }) => i.kind === 'BAND')).toBe(true);
    const byFormat = await v.get('/public/artists?format=Trio&q=Busca');
    expect(byFormat.body.items.map((i: { name: string }) => i.name)).toEqual(['Joana do Forró Busca']);
    await v.get('/public/artists?genre=Inexistente').expect(400);
  });

  it('banda pública lista apenas integrantes com perfil individual público', async () => {
    const res = await new Client(app).get('/public/artists?kind=BAND&q=Trio Jazz');
    const slug = res.body.items[0].slug;
    const page = await new Client(app).get(`/public/artists/${slug}`);
    expect(page.body.members.total).toBe(1);
    expect(page.body.members.public).toHaveLength(0);
  });

  it('catálogo técnico e metadados são públicos', async () => {
    const cat = await new Client(app).get('/catalog/equipment');
    expect(cat.body.find((i: { id: string }) => i.id === 'mic-din')).toMatchObject({ unit: 'un', category: 'Áudio' });
    const meta = await new Client(app).get('/public/meta');
    expect(meta.body.genres).toContain('Forró');
  });
});
