import { describe, it, expect } from 'vitest';
import { downscaleImage } from './imageDownscale';

describe('downscaleImage', () => {
    it('devolve o próprio arquivo para tipos não-imagem (fallback seguro)', async () => {
        const f = new File(['conteudo'], 'doc.txt', { type: 'text/plain' });
        expect(await downscaleImage(f)).toBe(f);
    });

    it('não quebra com imagem inválida — devolve o original', async () => {
        // Bytes que não decodificam como imagem. Dependendo do ambiente de teste, o
        // <img> pode não disparar onerror; o teto de carregamento (loadTimeoutMs)
        // garante o fallback rápido e determinístico, devolvendo o original.
        const f = new File([new Uint8Array([1, 2, 3, 4])], 'x.jpg', { type: 'image/jpeg' });
        const out = await downscaleImage(f, { loadTimeoutMs: 50 });
        expect(out).toBe(f);
    });
});
