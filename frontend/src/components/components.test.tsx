import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ApiError } from '../lib/api';
import { COMPAT_STATUS } from '../lib/format';
import { applyServerErrors, ChipPicker, TextField } from './Fields';
import { Status } from './States';

describe('componentes compartilhados', () => {
  it('TextField associa rótulo, dica e erro de forma acessível', () => {
    render(<TextField label="E-mail" hint="Não aparece publicamente." error={{ message: 'E-mail inválido.' }} />);
    const input = screen.getByLabelText('E-mail');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Não aparece publicamente. E-mail inválido.');
  });

  it('ChipPicker respeita o limite de seleção', () => {
    function Harness() {
      const [v, setV] = useState<string[]>(['MPB']);
      return <ChipPicker legend="Estilos" options={['MPB', 'Forró', 'Jazz']} value={v} onChange={setV} max={2} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Forró'));
    expect(screen.getByLabelText('Forró')).toBeChecked();
    expect(screen.getByLabelText('Jazz')).toBeDisabled();
  });

  it('Status exibe o rótulo humano da comparação', () => {
    render(<Status value="PARTIALLY_AVAILABLE" map={COMPAT_STATUS} />);
    expect(screen.getByText('Parcialmente disponível')).toHaveClass('st', 'parcial');
  });

  it('applyServerErrors mapeia detalhes do backend para campos', () => {
    const setError = vi.fn();
    const err = new ApiError(400, 'VALIDATION_ERROR', 'Dados inválidos.', [{ path: 'email', message: 'E-mail inválido.' }]);
    expect(applyServerErrors(err, setError)).toBeNull();
    expect(setError).toHaveBeenCalledWith('email', { message: 'E-mail inválido.' });
    expect(applyServerErrors(new ApiError(409, 'EMAIL_TAKEN', 'Já existe uma conta.'), setError)).toBe('Já existe uma conta.');
  });
});
