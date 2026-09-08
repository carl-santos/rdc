import { useEffect, useState } from 'react';

/**
 * Carrega imagens externas via fetch() para contornar o ERR_QUIC_PROTOCOL_ERROR.
 * Estratégia em duas tentativas:
 *   1. fetch() com mode:'cors' — funciona para CDNs externos e Supabase Storage público
 *   2. fetch() com mode:'no-cors' + leitura via <img> direto — fallback para URLs
 *      que bloqueiam CORS mas ainda são acessíveis pelo browser (ex: imagens antigas)
 * Se ambas falharem, exibe o `fallback`.
 */
interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    src: string | null | undefined;
    fallback?: React.ReactNode;
    skeletonClassName?: string;
}

const TIMEOUT_MS = 15000;

const SafeImage = ({ src, fallback, skeletonClassName, ...imgProps }: SafeImageProps) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!src) return;

        let objectUrl: string | null = null;
        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout>;

        const controller = new AbortController();

        const tryFetch = async () => {
            // Tentativa 1: fetch normal com CORS.
            // cache: 'default' permite cache HTTP mas revalida via headers
            // condicionais (LGPD: se um titular pedir deleção, a próxima
            // requisição pega o 404/304 e o cache antigo expira).
            try {
                const res = await fetch(src, {
                    signal: controller.signal,
                    cache: 'default',
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setBlobUrl(objectUrl);
                return;
            } catch (err: any) {
                if (cancelled || err?.name === 'AbortError') return;
                // ERR_QUIC_PROTOCOL_ERROR: falhou via HTTP/3.
                // O browser agora marca QUIC como quebrado para este host;
                // a segunda tentativa usa HTTP/2 automaticamente.
            }

            // Tentativa 2: re-fetch imediato — browser usará TCP/HTTP2 agora.
            // cache:'no-store' evita servir o resultado corrompido da tentativa anterior.
            try {
                const res2 = await fetch(src, {
                    signal: controller.signal,
                    cache: 'no-store',
                });
                if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
                const blob2 = await res2.blob();
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob2);
                setBlobUrl(objectUrl);
                return;
            } catch (err2: any) {
                if (cancelled || (err2 as any)?.name === 'AbortError') return;
            }

            // Tentativa 3: deixa o <img> tentar diretamente (sem conversão blob)
            // Isso funciona para URLs que bloqueiam fetch mas não bloqueiam <img>
            if (!cancelled) {
                setBlobUrl(src); // usa a URL direta como último recurso
            }
        };

        // Timeout de segurança: se demorar demais, mostra fallback
        timeoutId = setTimeout(() => {
            if (!blobUrl && !cancelled) {
                controller.abort();
                setFailed(true);
            }
        }, TIMEOUT_MS);

        tryFetch().finally(() => clearTimeout(timeoutId));

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            setBlobUrl(null);
            setFailed(false);
        };
    }, [src]);

    if (!src) return fallback ? <>{fallback}</> : null;
    if (failed) return fallback ? <>{fallback}</> : null;

    if (!blobUrl) {
        return (
            <div className={skeletonClassName ?? 'w-full h-full animate-pulse bg-slate-200 dark:bg-slate-700'} />
        );
    }

    return (
        <img
            {...imgProps}
            src={blobUrl}
            onError={(e) => {
                const el = e.currentTarget;
                el.style.display = 'none';
                setFailed(true);
            }}
        />
    );
};

export default SafeImage;
