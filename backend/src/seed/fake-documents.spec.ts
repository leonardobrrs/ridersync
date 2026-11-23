import { isValidCnpj, isValidCpf } from '../common/documents';
import { fakeCnpj, fakeCpf } from './fake-documents';

describe('documentos fictícios dos seeds', () => {
  it('são válidos e determinísticos', () => {
    for (const k of ['ana@demo.ridersync.local', 'caio@demo.ridersync.local', 'x', '']) {
      expect(isValidCpf(fakeCpf(k))).toBe(true);
      expect(isValidCnpj(fakeCnpj(k))).toBe(true);
      expect(fakeCpf(k)).toBe(fakeCpf(k));
    }
    expect(fakeCpf('a')).not.toBe(fakeCpf('b'));
  });
});
