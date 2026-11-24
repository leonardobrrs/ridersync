import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../components/Toast';
import { AdminPage } from './AdminPage';

const json = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <AdminPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('painel de administração', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sem sessão mostra o login próprio e entra', async () => {
    let logged = false;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (u, init) => {
      const url = String(u);
      if (url.endsWith('/admin/login')) {
        logged = true;
        return json(null, 204);
      }
      if (url.endsWith('/admin/session')) return logged ? json({ authenticated: true }) : json({ code: 'ADMIN_UNAUTHENTICATED', message: 'Entre.' }, 401);
      if (url.endsWith('/admin/overview')) return json({ users: 3, solo: 1, bands: 1, venues: 1, individuals: 0, events: 2, bookings: 1, contracts: 1 });
      void init;
      return json([]);
    });
    renderPage();
    const form = await screen.findByRole('form', { name: 'Entrar no painel de administração' });
    fireEvent.change(within(form).getByLabelText('Usuário'), { target: { value: 'adm' } });
    fireEvent.change(within(form).getByLabelText('Senha'), { target: { value: 'segredo' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('tab', { name: 'Contas' });
    const login = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/admin/login'))!;
    expect(JSON.parse(String(login[1]?.body))).toEqual({ username: 'adm', password: 'segredo' });
    expect(await screen.findByText('Exclusões são', { exact: false })).toBeInTheDocument();
  });

  it('painel desativado no servidor: página não encontrada', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ code: 'NOT_FOUND', message: 'x' }, 404));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
  });

  it('lista, seleciona e exclui definitivamente com confirmação', async () => {
    const users = [
      { id: 'u1', name: 'Conta Teste', email: 'teste@example.com', accountType: 'ARTIST', createdAt: '2026-11-20T10:00:00Z', bands: [], organizations: [], profile: null },
      { id: 'u2', name: 'Outra Conta', email: 'outra@example.com', accountType: 'CONTRACTOR', createdAt: '2026-11-21T10:00:00Z', bands: [], organizations: [], profile: null },
    ];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (u, init) => {
      const url = String(u);
      if (init?.method === 'DELETE') return json({ deleted: 'user' });
      if (url.endsWith('/admin/session')) return json({ authenticated: true });
      if (url.endsWith('/admin/overview')) return json({ users: 2 });
      if (url.includes('/admin/users')) return json(users);
      return json([]);
    });
    renderPage();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Conta Teste')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Conta Teste (teste@example.com)' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Outra Conta (outra@example.com)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir selecionados (2)' }));
    const dlg = await screen.findByRole('dialog', { name: 'Excluir 2 itens?' });
    expect(dlg).toHaveTextContent('Esta ação não pode ser desfeita.');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Excluir definitivamente' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, i]) => i?.method === 'DELETE').map(([url]) => String(url))).toEqual([expect.stringMatching(/\/admin\/users\/u1$/), expect.stringMatching(/\/admin\/users\/u2$/)]));
  });
});
