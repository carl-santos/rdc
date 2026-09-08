import { describe, it, expect } from 'vitest';
import { parseDecimalBR } from './number';

describe('parseDecimalBR', () => {
    it('converte vírgula decimal (pt-BR) sem truncar', () => {
        expect(parseDecimalBR('1,70')).toBe(1.7);
        expect(parseDecimalBR('1,57')).toBe(1.57); // o caso clássico do bug (parseFloat -> 1)
        expect(parseDecimalBR('70,5')).toBe(70.5);
    });

    it('aceita ponto decimal também', () => {
        expect(parseDecimalBR('1.70')).toBe(1.7);
        expect(parseDecimalBR('82')).toBe(82);
    });

    it('ignora espaços nas bordas', () => {
        expect(parseDecimalBR('  1,80  ')).toBe(1.8);
    });

    it('retorna null para vazio/inválido/nulo', () => {
        expect(parseDecimalBR('')).toBeNull();
        expect(parseDecimalBR('   ')).toBeNull();
        expect(parseDecimalBR('abc')).toBeNull();
        expect(parseDecimalBR(null)).toBeNull();
        expect(parseDecimalBR(undefined)).toBeNull();
    });

    it('aceita number direto', () => {
        expect(parseDecimalBR(1.75)).toBe(1.75);
    });
});
