import { act, fireEvent, render, screen } from '@testing-library/react';
import { z } from 'zod';
import { matchesWhenBothFilled, PASSWORD_RULES, strongPassword } from '../lib/password';
import { ConfirmButton, CountdownButton } from './Dialog';
import { PasswordField } from './PasswordField';

describe('campo de senha', () => {
  it('olho fechado oculta e olho aberto mostra a senha', () => {
    render(<PasswordField label="Senha" defaultValue="Segredo@1" />);
    const input = screen.getByLabelText('Senha');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('lista os requisitos marcando os atendidos', () => {
    render(<PasswordField label="Senha" showRules watchValue="abcdefgh1" />);
    const list = screen.getByRole('list', { name: 'Requisitos da senha' });
    expect(list.querySelectorAll('li.ok')).toHaveLength(2);
  });
});

describe('política de senha (cliente)', () => {
  it('exige 8+ caracteres, maiúscula, número e caractere especial', () => {
    expect(strongPassword.safeParse('Forte@123').success).toBe(true);
    for (const weak of ['forte@123', 'Forte@abc', 'Forte1234', 'F@1a']) expect(strongPassword.safeParse(weak).success).toBe(false);
    expect(PASSWORD_RULES).toHaveLength(4);
  });

  it('acusa senhas diferentes mesmo com outros campos ainda inválidos', () => {
    const schema = z
      .object({ name: z.string().min(2), password: z.string(), passwordConfirmation: z.string() })
      .refine((v) => v.password === v.passwordConfirmation, matchesWhenBothFilled('password', 'passwordConfirmation'));
    const r = schema.safeParse({ name: '', password: 'A@1aaaaa', passwordConfirmation: 'outra' });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path.join('.'))).toEqual(expect.arrayContaining(['name', 'passwordConfirmation']));
  });
});

describe('confirmações do sistema (sem diálogos nativos)', () => {
  it('ConfirmButton abre modal próprio e só executa ao confirmar', async () => {
    const native = vi.spyOn(window, 'confirm');
    const onConfirm = vi.fn();
    render(
      <ConfirmButton confirm="Aceitar esta proposta?" confirmLabel="Aceitar proposta" onConfirm={onConfirm}>
        Aceitar
      </ConfirmButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));
    expect(screen.getByText('Aceitar esta proposta?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Aceitar proposta' }));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(native).not.toHaveBeenCalled();
  });

  it('CountdownButton só libera o clique após 3 segundos', () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    render(<CountdownButton onClick={onClick}>Transferir propriedade</CountdownButton>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('(3s)');
    for (let i = 0; i < 3; i++) act(() => vi.advanceTimersByTime(1000));
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
