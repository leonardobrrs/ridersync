import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ToastProvider } from '../../components/Toast';
import type { BookingDetail } from '../../lib/types';
import { ContractCard } from './ContractCard';

const contract = { id: 'c1', bookingId: 'b1', templateType: 'VENUE' as const, generatedAt: '2026-11-20T15:00:00Z', downloadUrl: '/api/contracts/c1/download', pendingFields: 0, pendingItems: [] };

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
    const link = screen.getByRole('link', { name: 'Baixar PDF' });
    expect(link).toHaveAttribute('href', '/api/contracts/c1/download');
    expect(link).toHaveAttribute('download', 'contrato-b1.pdf');
    expect(screen.getByText(/com casa de show/)).toBeInTheDocument();
    expect(screen.getByText(/não há assinatura\s+eletrônica nem validade jurídica/i)).toBeInTheDocument();
  });

  it('contratante também vê o download; evento particular descreve o modelo certo', () => {
    renderCard(booking({ mySide: 'VENUE', contract: { ...contract, templateType: 'INDIVIDUAL' } }));
    expect(screen.getByRole('link', { name: 'Baixar PDF' })).toBeInTheDocument();
    expect(screen.getByText(/para evento particular/)).toBeInTheDocument();
  });

  it('sem contrato gerado: oferece gerar e chama a API', async () => {
    const ready = { contractor: { missing: [], link: '/painel/casas/o1' }, artist: { missing: [], link: '/painel/conta' } };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (u) =>
      new Response(JSON.stringify(String(u).endsWith('/readiness') ? ready : contract), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    renderCard(booking());
    expect(screen.queryByRole('link', { name: 'Baixar PDF' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar contrato' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/contracts/booking/b1') && i?.method === 'POST')).toBe(true));
    expect(screen.getByRole('link', { name: 'Meus dados' })).toBeInTheDocument();
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

    it.each([
      ['antes do show: manda atualizar', future, null, /Clique em “Atualizar contrato” para gerar de novo/],
      ['show realizado: manda completar à mão', { performanceAt: '2020-01-01T20:00:00Z' }, { id: 'p1', performedAt: '2020-01-01T23:00:00Z' }, /completem à mão antes de assinar/],
    ])('contrato de versão anterior, sem identificação dos campos (%s)', (_, agreedOffer, performance, expected) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(readiness));
      const legacy = { ...contract, pendingFields: 9, pendingItems: [], unlabeledPending: 9 };
      renderCard(booking({ contract: legacy, agreedOffer, performance } as unknown as Partial<BookingDetail>));
      const list = screen.getByRole('region', { name: 'O que falta preencher' });
      expect(list).toHaveTextContent('9 campos foram gerados por uma versão anterior');
      expect(list).toHaveTextContent(expected);
    });

    it('mostra os campos em aberto, o que falta do meu lado e atualiza o contrato', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
        String(url).endsWith('/readiness') ? json(readiness) : json({ ...contract, pendingFields: 0 }, 201),
      );
      const pendingItems = [
        { label: 'CPF do artista', who: 'CONTRATADO', how: 'No RiderSync, em "Conta e privacidade".' },
        { label: 'CNPJ da casa', who: 'CONTRATANTE', how: 'Em "Dados da casa".' },
        { label: 'Forma de pagamento', who: 'AMBAS', how: 'Preencham à mão antes de assinar.' },
      ];
      renderCard(booking({ contract: { ...contract, pendingFields: 4, pendingItems }, agreedOffer: future, performance: null } as Partial<BookingDetail>));
      expect(screen.getByRole('region', { name: 'O que falta preencher' })).toHaveTextContent('4 campos saem em branco no PDF');
      // o que é, de quem é a vez (do ponto de vista do artista) e como
      const sec = (title: string) => screen.getByRole('heading', { name: title }).parentElement!;
      expect(sec('Com você')).toHaveTextContent('CPF do artista');
      expect(sec('Com a outra parte (contratante)')).toHaveTextContent('CNPJ da casa');
      expect(sec('Com as duas partes')).toHaveTextContent('Forma de pagamentoPreencham à mão antes de assinar.');
      // com o contrato gerado, a lista de pendências substitui o aviso separado; o botão leva aos meus dados
      expect(screen.queryByText(/Faltam seus dados para o contrato/)).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('link', { name: 'Meus dados' })).toHaveAttribute('href', '/painel/conta'));
      fireEvent.click(screen.getByRole('button', { name: 'Atualizar contrato' }));
      await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/contracts/booking/b1/refresh') && i?.method === 'POST')).toBe(true));
    });

    it.each([
      ['apresentação registrada', { agreedOffer: { performanceAt: '2099-01-01T20:00:00Z' }, performance: { id: 'p1', performedAt: '2026-11-20T23:00:00Z' } }],
      ['data do show já passou', { agreedOffer: { performanceAt: '2020-01-01T20:00:00Z' }, performance: null }],
    ])('show realizado (%s): aviso e "Atualizar contrato" bloqueado para as duas partes', (_, over) => {
      for (const mySide of ['VENUE', 'ARTIST']) {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(readiness));
        const { unmount } = renderCard(booking({ mySide, contract, ...over } as unknown as Partial<BookingDetail>));
        expect(screen.getByText(/Show realizado em .*: o contrato não pode mais ser atualizado/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Atualizar contrato' })).toBeDisabled();
        expect(screen.getByRole('link', { name: 'Baixar PDF' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Meus dados' })).not.toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
        unmount();
        vi.restoreAllMocks();
      }
    });
  });
});
