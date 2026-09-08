// Otimização de imagem no cliente ANTES do upload.
//
// Câmeras de celular geram JPEGs de vários MB (12MP+). Como o upload (subida) do
// mobile é lento, isso fazia a foto de entrada da operação levar dezenas de
// segundos. Aqui reduzimos para ~1600px no maior lado e reencodamos em JPEG de
// alta qualidade — o suficiente com folga para a operação (os modelos trabalham
// em ~1024px) e para exibir no app, sem perda visível.
//
// Segurança: qualquer falha (formato exótico, canvas indisponível, decode) devolve
// o arquivo ORIGINAL, para nunca bloquear o upload.

export interface DownscaleOptions {
    maxDimension?: number; // maior lado em px (default 1600)
    quality?: number;      // qualidade JPEG 0..1 (default 0.9)
    loadTimeoutMs?: number; // teto para o carregamento do <img> (default 12000)
}

export async function downscaleImage(file: File, opts: DownscaleOptions = {}): Promise<File> {
    const maxDimension = opts.maxDimension ?? 1600;
    const quality = opts.quality ?? 0.9;
    const loadTimeoutMs = opts.loadTimeoutMs ?? 12000;

    // Só processa rasters comuns; qualquer outro passa direto.
    if (typeof document === 'undefined') return file;
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) return file;

    try {
        // <img> aplica a orientação EXIF automaticamente (image-orientation: from-image,
        // padrão nos navegadores atuais), então o canvas desenha na orientação certa.
        const img = await loadImage(file, loadTimeoutMs);
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        if (!width || !height) return file;

        const scale = Math.min(1, maxDimension / Math.max(width, height));
        if (scale >= 1) return file; // já pequena o bastante — não reencoda à toa

        const w = Math.round(width * scale);
        const h = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', quality)
        );
        // Se falhou ou não ficou menor, mantém o original.
        if (!blob || blob.size >= file.size) return file;

        const base = file.name.replace(/\.[^.]+$/, '') || 'foto';
        return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    } catch {
        return file; // fallback seguro
    }
}

function loadImage(file: File, timeoutMs: number): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        let settled = false;
        const finish = (fn: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            URL.revokeObjectURL(url);
            fn();
        };
        // Teto de segurança: um arquivo corrompido pode nunca disparar onload nem
        // onerror (deixaria o upload pendurado para sempre). No timeout, rejeita e
        // o chamador cai no fallback (devolve o original).
        const timer = setTimeout(() => finish(() => reject(new Error('image load timeout'))), timeoutMs);
        img.onload = () => finish(() => resolve(img));
        img.onerror = (e) => finish(() => reject(e));
        img.src = url;
    });
}
