import { describe, it, expect } from 'vitest';
import {
    extractDocumentText,
    fileExtension,
    isAllowedCdrDocument,
    isExtractableTextFile,
} from './cdrDocuments';

function fileFrom(content: string, name: string, type = 'text/plain'): File {
    return new File([content], name, { type });
}

describe('cdrDocuments', () => {
    it('reconhece extensão em minúsculas', () => {
        expect(fileExtension('Aula.PDF')).toBe('.pdf');
        expect(fileExtension('notas')).toBe('');
    });

    it('aceita formatos previstos no MVP', () => {
        expect(isAllowedCdrDocument(fileFrom('x', 'notas.txt'))).toBe(true);
        expect(isAllowedCdrDocument(fileFrom('x', 'slides.pptx'))).toBe(true);
        expect(isAllowedCdrDocument(fileFrom('x', 'malware.exe'))).toBe(false);
    });

    it('extrai texto de arquivos legíveis e ignora binários', async () => {
        expect(isExtractableTextFile(fileFrom('# aula', 'aula.md', 'text/markdown'))).toBe(true);
        expect(isExtractableTextFile(fileFrom('x', 'aula.pdf', 'application/pdf'))).toBe(false);
        const text = await extractDocumentText(fileFrom('  Olá turma  ', 'aula.txt'));
        expect(text).toBe('Olá turma');
    });
});
