import { describe, expect, it } from 'vitest';
import {
    assembleRetrievedKnowledge,
    excerptFromText,
    sourcesFromHits,
    sourcesFromMetadata,
} from './cdrKnowledge';

describe('assembleRetrievedKnowledge', () => {
    it('numera trechos com o nome do arquivo', () => {
        const text = assembleRetrievedKnowledge([
            { file_name: 'aula.md', content: 'Primeiro bloco' },
            { file_name: 'slides.md', content: 'Segundo bloco' },
        ]);
        expect(text).toContain('### [1] aula.md');
        expect(text).toContain('Primeiro bloco');
        expect(text).toContain('### [2] slides.md');
    });

    it('respeita o teto de caracteres', () => {
        const text = assembleRetrievedKnowledge(
            [
                { file_name: 'a.md', content: 'AAAA' },
                { file_name: 'b.md', content: 'BBBB'.repeat(50) },
            ],
            40,
        );
        expect(text.length).toBeLessThanOrEqual(40);
        expect(text).toContain('### [1] a.md');
    });
});

describe('sourcesFromHits', () => {
    it('gera fontes numeradas com trecho curto', () => {
        const sources = sourcesFromHits([
            { file_name: 'relatorio.md', content: 'Preview é commodity.\n\nO produto precisa de foco.', match_rank: 0.8 },
        ]);
        expect(sources).toEqual([
            {
                index: 1,
                file_name: 'relatorio.md',
                excerpt: 'Preview é commodity. O produto precisa de foco.',
                match_rank: 0.8,
            },
        ]);
    });

    it('corta trechos longos', () => {
        expect(excerptFromText('palavra '.repeat(80), 40).endsWith('…')).toBe(true);
    });
});

describe('sourcesFromMetadata', () => {
    it('lê fontes gravadas na mensagem', () => {
        const sources = sourcesFromMetadata({
            needs_confirmation: false,
            sources: [{ index: 2, file_name: 'aula.md', excerpt: 'conceito central' }],
        });
        expect(sources).toEqual([{ index: 2, file_name: 'aula.md', excerpt: 'conceito central' }]);
    });

    it('ignora metadata sem fontes', () => {
        expect(sourcesFromMetadata({ needs_confirmation: true })).toEqual([]);
        expect(sourcesFromMetadata(null)).toEqual([]);
    });
});
