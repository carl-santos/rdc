import { describe, it, expect } from 'vitest';
import {
    contentTypeForCdrDocument,
    extractDocumentText,
    fileExtension,
    isAllowedCdrDocument,
    isExtractableTextFile,
    needsServerExtraction,
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

    it('mapeia MIME pela extensão quando o navegador não informa o tipo', () => {
        expect(contentTypeForCdrDocument(fileFrom('# aula', 'aula.md', ''))).toBe('text/plain');
        expect(contentTypeForCdrDocument(fileFrom('x', 'PRE_TCC.docx', 'application/octet-stream'))).toBe(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
    });

    it('marca PDF e Office para extração no servidor', () => {
        expect(needsServerExtraction('aula.pdf')).toBe(true);
        expect(needsServerExtraction('PRE_TCC.docx')).toBe(true);
        expect(needsServerExtraction('slides.pptx')).toBe(true);
        expect(needsServerExtraction('notas.md')).toBe(false);
    });

    it('extrai texto de arquivos legíveis e ignora binários', async () => {
        expect(isExtractableTextFile(fileFrom('# aula', 'aula.md', 'text/markdown'))).toBe(true);
        expect(isExtractableTextFile(fileFrom('x', 'aula.pdf', 'application/pdf'))).toBe(false);
        const text = await extractDocumentText(fileFrom('  Olá turma  ', 'aula.txt'));
        expect(text).toBe('Olá turma');
    });
});
