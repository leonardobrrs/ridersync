import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api } from '../../lib/api';
import type { CompatibilityResult } from '../../lib/types';
import { CompatibilityView, reasonFor } from './Compatibility';
import { EquipmentEditor } from './EquipmentEditor';

vi.mock('../../lib/api', async (orig) => ({ ...(await orig<typeof import('../../lib/api')>()), api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('../../lib/hooks', async (orig) => ({
  ...(await orig<typeof import('../../lib/hooks')>()),
  useCatalog: () => ({
    isLoading: false,
    data: [
      { id: 'amp-gtr', name: 'Amplificador de guitarra', unit: 'un', category: 'Backline', artistRequirement: true },
      { id: 'mic-din', name: 'Microfone dinâmico', unit: 'un', category: 'Áudio', artistRequirement: true },
    ],
  }),
}));

const result = (over: Partial<CompatibilityResult> = {}): CompatibilityResult => ({
  organization: { id: 'o1', name: 'Casa Maré', slug: 'casa-mare' },
  riderNotes: '',
  inventoryRegistered: true,
  venueCustomItems: [],
  items: [
    {
      riderItemId: 'i1',
      catalogItemId: 'amp-gtr',
      name: 'Amplificador de guitarra',
      category: 'Backline',
      unit: 'un',
      required: 2,
      owned: 1,
      available: 1,
      venueProvides: 1,
      artistProvides: 1,
      missing: 0,
      status: 'COMPATIBLE',
      reason: 'A casa tem 1 un (necessário: 2 un). A casa fornece 1 un e o artista precisa levar 1 un (possui 1 un).',
      riderNotes: '',
      venueNotes: null,
    },
  ],
  summary: { COMPATIBLE: 1, PARTIALLY_AVAILABLE: 0, UNAVAILABLE: 0, NEEDS_CHECK: 0, total: 1 },
  fullyCompatible: true,
  artistSuppliedItems: 1,
  ...over,
});

function renderView(props: Parameters<typeof CompatibilityView>[0], data = result()) {
  vi.mocked(api.get).mockResolvedValue(data);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CompatibilityView {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('comparação de rider com a casa', () => {
  it('reasonFor troca "o artista" por "você" só para o próprio artista', () => {
    const txt = 'A casa fornece 1 un e o artista precisa levar 1 un. O artista leva todas.';
    expect(reasonFor(txt, 'ARTIST')).toBe('A casa fornece 1 un e você precisa levar 1 un. Você leva todas.');
    expect(reasonFor(txt, 'VENUE')).toBe(txt);
  });

  it('artista: positivo, com 1 amplificador da casa e 1 a levar em destaque', async () => {
    renderView({ artistId: 'a1', organizationId: 'o1', perspective: 'ARTIST' });
    expect(await screen.findByRole('heading', { name: /Seu rider × Casa Maré/ })).toBeInTheDocument();
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('Você precisa levar 1 un · Amplificador de guitarra (a casa fornece 1)');
    expect(note).toHaveTextContent('a casa atende o seu rider');
    const row = screen.getByText('Amplificador de guitarra', { selector: 'strong' }).closest('tr')!;
    expect(within(row).getByText('Compatível')).toBeInTheDocument();
    expect(row).toHaveTextContent('você precisa levar 1 un');
    expect(api.get).toHaveBeenCalledWith('/artists/a1/compatibility/o1');
  });

  it('casa: mesmo resultado, na voz do contratante', async () => {
    renderView({ applicationId: 'app1', perspective: 'VENUE' });
    expect(await screen.findByRole('heading', { name: /Rider do artista × Casa Maré/ })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('O artista vai levar 1 un · Amplificador de guitarra');
    expect(api.get).toHaveBeenCalledWith('/applications/app1/compatibility');
  });

  it('sem nada a levar, não exibe o aviso', async () => {
    const r = result();
    r.items[0] = { ...r.items[0], owned: 0, artistProvides: 0, venueProvides: 2, available: 2, reason: 'Disponível 2 un — atende o necessário (2 un).' };
    renderView({ artistId: 'a1', organizationId: 'o1' }, { ...r, artistSuppliedItems: 0 });
    await screen.findByRole('heading', { name: /Seu rider/ });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});

describe('editor do rider: o que preciso × o que já possuo', () => {
  const baseItem = {
    id: 'r1',
    catalogItemId: 'amp-gtr',
    customName: null,
    name: 'Amplificador de guitarra',
    unit: 'un',
    category: 'Backline',
    isCustom: false,
    quantity: 2,
    ownedQuantity: 1,
    notes: '',
  };

  it('envia a quantidade possuída e nunca deixa passar do necessário', () => {
    const onSave = vi.fn();
    render(<EquipmentEditor mode="rider" items={[baseItem]} notes="" onSave={onSave} />);
    const owned = screen.getByLabelText('Quantidade que você já possui de Amplificador de guitarra') as HTMLInputElement;
    expect(owned.value).toBe('1');
    fireEvent.change(owned, { target: { value: '9' } });
    expect(owned.value).toBe('2'); // limitado ao necessário
    fireEvent.change(screen.getByLabelText('Quantidade necessária de Amplificador de guitarra'), { target: { value: '1' } });
    expect(owned.value).toBe('1'); // reduzir o necessário reduz o possuído
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rider' }));
    expect(onSave).toHaveBeenCalledWith({ notes: '', items: [{ catalogItemId: 'amp-gtr', quantity: 1, ownedQuantity: 1, notes: '' }] });
  });

  it('inventário da casa não tem coluna "Já possuo" nem envia ownedQuantity', () => {
    const onSave = vi.fn();
    render(<EquipmentEditor mode="inventory" items={[{ ...baseItem, ownedQuantity: undefined }]} onSave={onSave} />);
    expect(screen.queryByText('Já possuo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar inventário' }));
    expect(onSave.mock.calls[0][0].items[0]).not.toHaveProperty('ownedQuantity');
  });
});
