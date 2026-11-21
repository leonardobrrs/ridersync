import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ToastProvider } from '../../components/Toast';
import type { BookingDetail } from '../../lib/types';
import { ContractCard } from './ContractCard';

const contract = { id: 'c1', bookingId: 'b1', templateType: 'VENUE' as const, generatedAt: '2026-11-20T15:00:00Z', downloadUrl: '/api/contracts/c1/download', pendingFields: 0 };

const booking = (over: Partial<BookingDetail> = {}) => ({ id: 'b1', status: 'CONFIRMED', mySide: 'ARTIST', contract: null, ...over }) as unknown as BookingDetail;

function renderCard(b: BookingDetail) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <MemoryRouter>
          <ContractCard b={b} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('contrato da negociação', () => {
  afterEach(() => vi.restoreAllMocks());

  it('contratação confirmada com contrato: link de download autenticado', () => {
    renderCard(booking({ contract }));
    const link = screen.getByRole('link', { name: /Baixar contrato/ });
    expect(link).toHaveAttribute('href', '/api/contracts/c1/download');
    expect(link).toHaveAttribute('download', 'contrato-b1.pdf');
    expect(screen.getByText(/com casa de show/)).toBeInTheDocument();
    expect(screen.getByText(/não há assinatura\s+eletrônica nem validade jurídica/i)).toBeInTheDocument();
  });

  it('contratante também vê o download; evento particular descreve o modelo certo', () => {
    renderCard(booking({ mySide: 'VENUE', contract: { ...contract, templateType: 'INDIVIDUAL' } }));
    expect(screen.getByRole('link', { name: /Baixar contrato/ })).toBeInTheDocument();
    expect(screen.getByText(/para evento particular/)).toBeInTheDocument();
  });

  it('sem contrato gerado: oferece gerar e chama a API', async () => {
    const ready = { contractor: { missing: [], link: '/painel/casas/o1' }, artist: { missing: [], link: '/painel/conta' } };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (u) =>
      new Response(JSON.stringify(String(u).endsWith('/readiness') ? ready : contract), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    renderCard(booking());
    expect(screen.queryByRole('link', { name: /Baixar contrato/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar contrato' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/contracts/booking/b1') && i?.method === 'POST')).toBe(true));
    expect(screen.getByRole('link', { name: 'Meus dados para contrato' })).toBeInTheDocument();
  });

  it.each([
    ['negociação ainda não confirmada', { status: 'AGREED' as const, contract }],
    ['quem não participa da negociação', { mySide: null, contract }],
  ])('não aparece para %s', (_, over) => {
    renderCard(booking(over as Partial<BookingDetail>));
    expect(screen.queryByRole('region', { name: 'Contrato' })).not.toBeInTheDocument();
  });
  describe('atualização com dados preenchidos depois', () => {
    const future = { performanceAt: new Date(Date.now() + 10 * 86400_000).toISOString() };
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    const readiness = { contractor: { missing: [], link: '/painel/casas/o1' }, artist: { missing: ['CPF do artista'], link: '/painel/conta' } };

    it('mostra os campos em aberto, o que falta do meu lado e atualiza o contrato', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
        String(url).endsWith('/readiness') ? json(readiness) : json({ ...contract, pendingFields: 0 }, 201),
      );
      renderCard(booking({ contract: { ...contract, pendingFields: 4 }, agreedOffer: future, performance: null } as Partial<BookingDetail>));
      expect(screen.getByText(/4 campos ainda estão/)).toBeInTheDocument();
      expect(await screen.findByText(/Faltam seus dados para o contrato: CPF do artista/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Completar dados' })).toHaveAttribute('href', '/painel/conta');
      fireEvent.click(screen.getByRole('button', { name: 'Atualizar contrato' }));
      await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/contracts/booking/b1/refresh') && i?.method === 'POST')).toBe(true));
    });

    it('contratante, depois do show: ainda atualiza e o botão de dados leva à tela do seu lado', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ...readiness, contractor: { missing: ['CPF do contratante'], link: '/painel/conta' } }));
      renderCard(booking({ mySide: 'VENUE', contract, agreedOffer: { performanceAt: '2020-01-01T20:00:00Z' }, performance: { id: 'p1' } } as Partial<BookingDetail>));
      expect(screen.getByRole('button', { name: 'Atualizar contrato' })).toBeInTheDocument();
      expect(await screen.findByText(/Faltam seus dados para o contrato: CPF do contratante/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Meus dados para contrato' })).toHaveAttribute('href', '/painel/conta');
    });
  });
});
