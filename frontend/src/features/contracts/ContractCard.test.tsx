import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ToastProvider } from '../../components/Toast';
import type { BookingDetail } from '../../lib/types';
import { ContractCard } from './ContractCard';

const contract = { id: 'c1', bookingId: 'b1', templateType: 'VENUE' as const, generatedAt: '2026-11-20T15:00:00Z', downloadUrl: '/api/contracts/c1/download' };

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
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(contract), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    renderCard(booking());
    expect(screen.queryByRole('link', { name: /Baixar contrato/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar contrato' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/contracts/booking/b1');
    expect(init?.method).toBe('POST');
  });

  it.each([
    ['negociação ainda não confirmada', { status: 'AGREED' as const, contract }],
    ['quem não participa da negociação', { mySide: null, contract }],
  ])('não aparece para %s', (_, over) => {
    renderCard(booking(over as Partial<BookingDetail>));
    expect(screen.queryByRole('region', { name: 'Contrato' })).not.toBeInTheDocument();
  });
});
