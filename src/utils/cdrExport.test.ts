import { describe, expect, it } from 'vitest';
import {
    ARTIFACT_TITLES,
    buildSessionMarkdown,
    collectSessionSources,
    sessionExportFilename,
    slugForExport,
} from './cdrExport';

describe('cdrExport', () => {
    it('monta nome de arquivo por modo', () => {
        const name = sessionExportFilename('Professor Carlos', 'presentation', new Date('2026-09-10T15:00:00.000Z'));
        expect(name).toBe('roteiro-professor-carlos-2026-09-10.md');
        expect(slugForExport('Aula 01 — RDC')).toBe('aula-01-rdc');
    });

    it('gera markdown com título, falas e fontes deduplicadas', () => {
        const markdown = buildSessionMarkdown({
            representativeName: 'Professor Carlos',
            mode: 'meeting',
            generatedAt: new Date('2026-09-10T15:00:00.000Z'),
            messages: [
                { role: 'user', content: 'Sintetize a abertura.' },
                {
                    role: 'assistant',
                    content: 'Síntese: preview é commodity.',
                    metadata: {
                        sources: [
                            { index: 1, file_name: '00-RELATORIO-GERAL.md', excerpt: 'Preview é commodity' },
                            { index: 1, file_name: '00-RELATORIO-GERAL.md', excerpt: 'Preview é commodity' },
                        ],
                    },
                },
            ],
        });
        expect(markdown).toContain(`# ${ARTIFACT_TITLES.meeting}`);
        expect(markdown).toContain('Professor Carlos');
        expect(markdown).toContain('## Você');
        expect(markdown).toContain('Síntese: preview é commodity.');
        expect(markdown).toContain('## Fontes autorizadas');
        expect(markdown.match(/00-RELATORIO-GERAL\.md/g)?.length).toBe(1);
    });

    it('reindexa fontes únicas', () => {
        const sources = collectSessionSources([
            { metadata: { sources: [{ index: 3, file_name: 'a.md', excerpt: 'um' }] } },
            { metadata: { sources: [{ index: 1, file_name: 'b.md', excerpt: 'dois' }] } },
        ]);
        expect(sources.map((s) => s.index)).toEqual([1, 2]);
        expect(sources.map((s) => s.file_name)).toEqual(['a.md', 'b.md']);
    });
});
