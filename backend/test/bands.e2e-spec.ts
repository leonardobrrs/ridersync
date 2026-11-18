import { INestApplication } from '@nestjs/common';
import { bootApp, Client, createPublicMusician, PUBLISHABLE_PROFILE, registerUser, TEST_PASSWORD } from './helpers';

describe('Bandas, convites, papéis e último OWNER (integração)', () => {
  let app: INestApplication;
  let owner: Client;
  let admin: Client;
  let member: Client;
  let outsider: Client;
  let bandId: string;
  let artistId: string;

  beforeAll(async () => {
    app = await bootApp();
    owner = await registerUser(app, 'Olga Owner');
    admin = await registerUser(app, 'Ada Admin');
    member = await registerUser(app, 'Mel Member');
    outsider = await registerUser(app, 'Otto Outsider');
  });
  afterAll(async () => {
    await app.close();
  });

  it('cria banda com identidade própria e o criador como OWNER ativo', async () => {
    const res = await owner.post('/bands', { name: 'Maré Alta Teste', ...PUBLISHABLE_PROFILE });
    expect(res.status).toBe(201);
    expect(res.body.myRole).toBe('OWNER');
    expect(res.body.artist.kind).toBe('BAND');
    expect(res.body.members).toHaveLength(1);
    bandId = res.body.bandId;
    artistId = res.body.artist.id;
  });

  it('convite pendente não é membership ativa; convidado aceita ou recusa', async () => {
    const inv = await owner.post(`/bands/${bandId}/invitations`, { email: member.user!.email, role: 'MEMBER', instrument: 'Baixo' });
    expect(inv.status).toBe(201);
    // ainda não é integrante
    await member.get(`/bands/${bandId}`).expect(403);
    const mine = await member.get('/me/invitations');
    expect(mine.body.bands).toHaveLength(1);
    // outra pessoa não pode aceitar o convite alheio
    await outsider.post(`/me/invitations/band/${inv.body.id}/accept`).expect(404);
    await member.post(`/me/invitations/band/${inv.body.id}/accept`).expect(201);
    const detail = await member.get(`/bands/${bandId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.myRole).toBe('MEMBER');
    // aceitar de novo não é possível
    await member.post(`/me/invitations/band/${inv.body.id}/accept`).expect(409);

    const invAdmin = await owner.post(`/bands/${bandId}/invitations`, { email: admin.user!.email, role: 'ADMIN' });
    await admin.post(`/me/invitations/band/${invAdmin.body.id}/accept`).expect(201);

    const invOut = await owner.post(`/bands/${bandId}/invitations`, { email: outsider.user!.email, role: 'MEMBER' });
    await outsider.post(`/me/invitations/band/${invOut.body.id}/decline`).expect(201);
    await outsider.get(`/bands/${bandId}`).expect(403);
  });

  it('convite duplicado e convite para e-mail inexistente são tratados', async () => {
    await owner.post(`/bands/${bandId}/invitations`, { email: member.user!.email, role: 'MEMBER' }).expect(409);
    await owner.post(`/bands/${bandId}/invitations`, { email: 'ninguem@nao.existe', role: 'MEMBER' }).expect(404);
  });

  it('MEMBER não administra: não edita perfil, rider, nem convida', async () => {
    await member.patch(`/artists/${artistId}`, { headline: 'tentativa' }).expect(403);
    await member.put(`/artists/${artistId}/rider`, { notes: '', items: [] }).expect(403);
    await member.post(`/bands/${bandId}/invitations`, { email: outsider.user!.email, role: 'MEMBER' }).expect(403);
    // mas pode visualizar o rider interno da banda
    await member.get(`/artists/${artistId}/rider`).expect(200);
    await outsider.get(`/artists/${artistId}/rider`).expect(403);
  });

  it('ADMIN edita a banda e convida MEMBER, mas não convida ADMIN nem altera papéis', async () => {
    await admin.patch(`/artists/${artistId}`, { headline: 'Quarteto de forró' }).expect(200);
    await admin.post(`/bands/${bandId}/invitations`, { email: outsider.user!.email, role: 'ADMIN' }).expect(403);
    const detail = await owner.get(`/bands/${bandId}`);
    const memberRow = detail.body.members.find((m: { name: string }) => m.name === 'Mel Member');
    await admin.patch(`/bands/${bandId}/members/${memberRow.id}`, { role: 'ADMIN' }).expect(403);
  });

  it('protege o último OWNER: não pode sair, nem ser rebaixado; transferência atômica funciona', async () => {
    await owner.post(`/bands/${bandId}/leave`).expect(409);
    const detail = await owner.get(`/bands/${bandId}`);
    const me = detail.body.members.find((m: { isMe: boolean }) => m.isMe);
    const res = await owner.patch(`/bands/${bandId}/members/${me.id}`, { role: 'ADMIN' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LAST_OWNER');

    const adminRow = detail.body.members.find((m: { name: string }) => m.name === 'Ada Admin');
    // OWNER não é concedido pelo dropdown de papéis: só pela transferência com senha
    await owner.patch(`/bands/${bandId}/members/${adminRow.id}`, { role: 'OWNER' }).expect(400);
    await owner.post(`/bands/${bandId}/transfer-ownership`, { memberId: adminRow.id }).expect(400);
    const wrong = await owner.post(`/bands/${bandId}/transfer-ownership`, { memberId: adminRow.id, password: 'Errada@123' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe('INVALID_PASSWORD');
    await admin.post(`/bands/${bandId}/transfer-ownership`, { memberId: adminRow.id, password: TEST_PASSWORD }).expect(403);
    const t = await owner.post(`/bands/${bandId}/transfer-ownership`, { memberId: adminRow.id, password: TEST_PASSWORD });
    expect(t.status).toBe(201);
    expect(t.body.myRole).toBe('ADMIN');
    const after = await admin.get(`/bands/${bandId}`);
    expect(after.body.myRole).toBe('OWNER');
    // agora o antigo dono (ADMIN) pode sair; o novo OWNER único não pode
    await admin.post(`/bands/${bandId}/leave`).expect(409);
  });

  it('remoção de integrante: ADMIN remove MEMBER; ninguém remove o último OWNER', async () => {
    const detail = await admin.get(`/bands/${bandId}`);
    const memberRow = detail.body.members.find((m: { name: string }) => m.name === 'Mel Member');
    const ownerRow = detail.body.members.find((m: { role: string }) => m.role === 'OWNER');
    await owner.delete(`/bands/${bandId}/members/${ownerRow.id}`).expect(403); // owner antigo agora é ADMIN
    await owner.delete(`/bands/${bandId}/members/${memberRow.id}`).expect(204);
    await member.get(`/bands/${bandId}`).expect(403);
  });

  it('rider da banda é independente do rider individual de um integrante', async () => {
    const soloOwner = await registerUser(app, 'Rita Rider');
    const solo = await createPublicMusician(soloOwner, 'Rita Solo');
    const band = await soloOwner.post('/bands', { name: 'Rita e Banda', ...PUBLISHABLE_PROFILE });
    const bandArtistId = band.body.artist.id;
    await soloOwner.put(`/artists/${bandArtistId}/rider`, { notes: 'Banda', items: [{ catalogItemId: 'bateria', quantity: 1 }] }).expect(200);
    await soloOwner
      .put(`/artists/${solo.id}/rider`, { notes: 'Solo', items: [{ catalogItemId: 'mic-din', quantity: 2 }, { customName: 'Pedal looper', quantity: 1 }] })
      .expect(200);
    const bandRider = await soloOwner.get(`/artists/${bandArtistId}/rider`);
    expect(bandRider.body.items).toHaveLength(1);
    expect(bandRider.body.items[0].catalogItemId).toBe('bateria');
    const soloRider = await soloOwner.get(`/artists/${solo.id}/rider`);
    expect(soloRider.body.items.map((i: { name: string }) => i.name)).toEqual(['Microfone dinâmico', 'Pedal looper']);
    // editar o perfil individual não altera o perfil da banda
    await soloOwner.patch(`/artists/${solo.id}`, { headline: 'Voz e violão' }).expect(200);
    const bandAfter = await soloOwner.get(`/artists/${bandArtistId}/manage`);
    expect(bandAfter.body.headline).toBe('');
  });

  it('rider rejeita item duplicado, quantidade inválida e item ambíguo', async () => {
    await admin.put(`/artists/${artistId}/rider`, { items: [{ catalogItemId: 'di', quantity: 1 }, { catalogItemId: 'di', quantity: 2 }] }).expect(422);
    await admin.put(`/artists/${artistId}/rider`, { items: [{ catalogItemId: 'di', quantity: 0 }] }).expect(400);
    await admin.put(`/artists/${artistId}/rider`, { items: [{ catalogItemId: 'di', customName: 'x', quantity: 1 }] }).expect(400);
    await admin.put(`/artists/${artistId}/rider`, { items: [{ catalogItemId: 'nao-existe', quantity: 1 }] }).expect(422);
  });
});
