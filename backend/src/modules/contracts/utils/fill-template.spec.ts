import { fillTemplate, PLACEHOLDER } from './fill-template';

describe('fillTemplate', () => {
  it('substitui todos os marcadores, inclusive repetidos', () => {
    expect(fillTemplate('{{A}} e {{B}} e {{A}}', { A: 'x', B: 'y' })).toBe('x e y e x');
  });

  it('usa [A PREENCHER] para campos ausentes ou nulos e mantém string vazia', () => {
    expect(fillTemplate('[{{A}}][{{B}}][{{C}}]', { A: undefined, B: null, C: '' })).toBe(`[${PLACEHOLDER}][${PLACEHOLDER}][]`);
    expect(fillTemplate('{{DESCONHECIDO}}', {})).toBe(PLACEHOLDER);
  });

  it('não reinterpreta marcadores presentes nos valores', () => {
    expect(fillTemplate('{{A}}', { A: '{{B}}', B: 'z' })).toBe('{{B}}');
  });

  it('preserva o restante do texto', () => {
    expect(fillTemplate('R$ {{V}},\n  linha', { V: '10' })).toBe('R$ 10,\n  linha');
  });
});
