import { describe, it, expect } from 'vitest';
import {
    classifyTicket,
    normalizePriority,
    getCategoryDef,
    getSubcategoryDef,
} from './ticketClassifier';

describe('normalizePriority', () => {
    it('mapeia valores legados', () => {
        expect(normalizePriority('urgent')).toBe('critical');
        expect(normalizePriority('normal')).toBe('medium');
    });
    it('mantém valores válidos', () => {
        expect(normalizePriority('high')).toBe('high');
        expect(normalizePriority('low')).toBe('low');
    });
    it('faz fallback para medium em valor desconhecido', () => {
        expect(normalizePriority('zzz')).toBe('medium');
    });
});

describe('getCategoryDef / getSubcategoryDef', () => {
    it('encontra categoria existente', () => {
        expect(getCategoryDef('support')?.label).toBe('Dúvidas Técnicas');
    });
    it('retorna undefined para categoria inexistente', () => {
        expect(getCategoryDef('nope')).toBeUndefined();
    });
    it('encontra subcategoria existente', () => {
        expect(getSubcategoryDef('conta', 'reembolso')?.priority).toBe('critical');
    });
});

describe('classifyTicket', () => {
    it('usa prioridade/resolução da subcategoria escolhida', () => {
        const t = classifyTicket('support', 'login', 'Não entro', 'Esqueci a senha');
        expect(t.priority).toBe('medium');
        expect(t.resolution_type).toBe('auto');
        expect(t.tags).toContain('login');
        expect(t.confidence_score).toBe(95);
    });

    it('escala a prioridade quando o texto contém sinal mais grave', () => {
        // subcategoria "realismo" é low; texto com "urgente" deve escalar para high
        const t = classifyTicket('operacoes', 'realismo', 'Problema', 'Isso é urgente, preciso resolver');
        expect(t.priority).toBe('high');
        expect(t.confidence_score).toBe(70);
    });

    it('não rebaixa a prioridade base por causa do texto', () => {
        // subcategoria "reembolso" é critical; texto neutro não deve baixar
        const t = classifyTicket('conta', 'reembolso', 'Quero reembolso', 'texto neutro');
        expect(t.priority).toBe('critical');
    });

    it('detecta palavra crítica e marca prioridade critical', () => {
        const t = classifyTicket('support', 'mobile', 'Erro', 'o sistema fora do ar, não funciona nada');
        expect(t.priority).toBe('critical');
    });

    it('faz fallback para resolução human em subcategoria inexistente', () => {
        const t = classifyTicket('support', 'inexistente', 'a', 'b');
        expect(t.resolution_type).toBe('human');
        expect(t.priority).toBe('medium');
    });
});
