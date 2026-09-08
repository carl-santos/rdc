import { describe, it, expect } from 'vitest';
import { isValidImageContent } from './imageValidation';

function fileFrom(bytes: number[], type: string, name = 'img'): File {
    return new File([new Uint8Array(bytes)], name, { type });
}

// Assinaturas de magic bytes
const JPEG = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0];
const PNG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

describe('isValidImageContent', () => {
    it('aceita JPEG com MIME correspondente', async () => {
        expect(await isValidImageContent(fileFrom(JPEG, 'image/jpeg'))).toBe(true);
    });

    it('aceita PNG com MIME correspondente', async () => {
        expect(await isValidImageContent(fileFrom(PNG, 'image/png'))).toBe(true);
    });

    it('aceita WEBP com MIME correspondente', async () => {
        expect(await isValidImageContent(fileFrom(WEBP, 'image/webp'))).toBe(true);
    });

    it('rejeita quando o conteúdo não bate com o MIME declarado (PNG disfarçado de jpeg)', async () => {
        expect(await isValidImageContent(fileFrom(PNG, 'image/jpeg'))).toBe(false);
    });

    it('rejeita conteúdo arbitrário/não-imagem', async () => {
        const txt = [0x68, 0x65, 0x6C, 0x6C, 0x6F, 0, 0, 0, 0, 0, 0, 0]; // "hello"
        expect(await isValidImageContent(fileFrom(txt, 'image/png'))).toBe(false);
    });

    it('rejeita arquivo executável renomeado para .png', async () => {
        const mz = [0x4D, 0x5A, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // "MZ" (PE/EXE)
        expect(await isValidImageContent(fileFrom(mz, 'image/png', 'malware.png'))).toBe(false);
    });
});
