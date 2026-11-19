import { fireEvent, render, screen } from '@testing-library/react';
import { CheckGroup, CityChecks, listLabel, readList, writeList } from './FilterChecks';

describe('filtros com marcadores', () => {
  it('lê e grava listas na URL e monta rótulos legíveis', () => {
    expect(readList(new URLSearchParams('genre=MPB%2CForr%C3%B3'), 'genre')).toEqual(['MPB', 'Forró']);
    expect(readList(new URLSearchParams(''), 'genre')).toEqual([]);
    expect(writeList(['MPB', 'Forró'])).toBe('MPB,Forró');
    expect(listLabel(['Maceió'], 'cidades')).toBe('Maceió');
    expect(listLabel(['Maceió', 'Penedo'], 'cidades')).toBe('Maceió e Penedo');
    expect(listLabel(['A', 'B', 'C'], 'cidades')).toBe('3 cidades');
  });

  it('marca e desmarca vários valores; "Ver mais" mostra o resto; selecionados sempre visíveis', () => {
    const onChange = vi.fn();
    const options = ['MPB', 'Forró', 'Samba', 'Rock', 'Jazz', 'Pop', 'Brega', 'Reggae'];
    const { rerender } = render(<CheckGroup legend="Estilo" options={options} selected={['Reggae']} onChange={onChange} initial={3} />);
    // Reggae está fora dos 3 primeiros, mas aparece por estar marcado
    expect(screen.getByRole('checkbox', { name: 'Reggae' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Jazz' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'MPB' }));
    expect(onChange).toHaveBeenLastCalledWith(['Reggae', 'MPB']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Reggae' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole('button', { name: /Ver mais/ }));
    expect(screen.getByRole('checkbox', { name: 'Jazz' })).toBeInTheDocument();
    rerender(<CheckGroup legend="Estilo" options={options} selected={['MPB', 'Rock']} onChange={onChange} initial={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar estilo' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('cidades: sugestões + busca sem acento entre os municípios', () => {
    const onChange = vi.fn();
    render(<CityChecks suggestions={['Maceió', 'Arapiraca']} all={['Maceió', 'Arapiraca', 'Piranhas', 'Pão de Açúcar', 'Penedo']} selected={['Maceió']} onChange={onChange} />);
    expect(screen.getByRole('checkbox', { name: 'Maceió' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Pão de Açúcar' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar outra cidade de Alagoas'), { target: { value: 'pao' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pão de Açúcar' }));
    expect(onChange).toHaveBeenLastCalledWith(['Maceió', 'Pão de Açúcar']);
  });
});
