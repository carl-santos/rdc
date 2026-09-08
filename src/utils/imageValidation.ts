// VAL-07 — Validação de conteúdo de imagem por "magic bytes".
//
// O `file.type` (MIME) é informado pelo browser e pode ser forjado. Aqui lemos
// os primeiros bytes do arquivo e confirmamos que o conteúdo corresponde a um
// formato de imagem permitido (JPEG/PNG/WebP) E ao MIME declarado — bloqueando
// upload de arquivos disfarçados por extensão/MIME.

export async function isValidImageContent(file: File): Promise<boolean> {
    try {
        const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        const b = (i: number) => buf[i];

        // JPEG: FF D8 FF
        if (b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF) {
            return file.type === 'image/jpeg' || file.type === 'image/jpg';
        }
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47) {
            return file.type === 'image/png';
        }
        // WEBP: "RIFF" .... "WEBP"
        if (
            b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
            b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50
        ) {
            return file.type === 'image/webp';
        }
        return false;
    } catch {
        return false;
    }
}
