import { useEffect, useState } from 'react';
import { resolveStorageUrl } from '../utils/storageUrl';

/**
 * SEC-01 — Resolve um valor gravado (referência de storage ou URL) para uma URL
 * exibível, gerando Signed URL quando o bucket é privado.
 *
 * Retorna `{ url, loading }`. Enquanto resolve uma referência sensível, `loading`
 * é true para o consumidor poder exibir skeleton em vez do fallback de erro.
 */
export function useSignedUrl(stored?: string | null): { url: string | null; loading: boolean } {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(!!stored);

    useEffect(() => {
        let cancelled = false;

        if (!stored) {
            setUrl(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        resolveStorageUrl(stored)
            .then((resolved) => {
                if (!cancelled) {
                    setUrl(resolved);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setUrl(null);
                    setLoading(false);
                }
            });

        return () => { cancelled = true; };
    }, [stored]);

    return { url, loading };
}
