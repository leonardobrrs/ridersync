import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf, maskCnpj, maskCpf } from './documents';

describe('documentos (CPF/CNPJ)', () => {
  it('valida os dígitos verificadores', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false);
  });

  it('aplica máscara progressiva e ignora o que não é dígito', () => {
    expect(maskCpf('5')).toBe('5');
    expect(maskCpf('5299')).toBe('529.9');
    expect(maskCpf('529982247')).toBe('529.982.247');
    expect(maskCpf('52998224725')).toBe('529.982.247-25');
    expect(maskCpf('529.982.247-25999')).toBe('529.982.247-25');
    expect(maskCpf(null)).toBe('');
    expect(maskCnpj('11222333')).toBe('11.222.333');
    expect(maskCnpj('112223330001')).toBe('11.222.333/0001');
    expect(maskCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(maskCnpj(undefined)).toBe('');
  });
});
