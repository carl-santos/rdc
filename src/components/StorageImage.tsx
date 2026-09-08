import SafeImage from './SafeImage';
import { useSignedUrl } from '../hooks/useSignedUrl';

/**
 * SEC-01 — Exibe uma imagem cujo valor gravado pode ser uma referência de
 * storage privado (gera Signed URL) ou uma URL direta (passthrough).
 *
 * Substitui `<SafeImage src={...} />` / `<img src={...} />` nos pontos que exibem
 * arquivos privados (buckets privados do tenant).
 */
interface StorageImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    /** Valor gravado no banco: referência "bucket/caminho" ou URL. */
    path?: string | null;
    fallback?: React.ReactNode;
    skeletonClassName?: string;
}

const StorageImage = ({ path, fallback, skeletonClassName, ...imgProps }: StorageImageProps) => {
    const { url, loading } = useSignedUrl(path);

    // Enquanto resolve a Signed URL de uma imagem existente, mostra skeleton
    // (e não o fallback de erro).
    if (path && loading) {
        return <div className={skeletonClassName ?? 'w-full h-full animate-pulse bg-slate-200 dark:bg-slate-700'} />;
    }

    return (
        <SafeImage
            src={url}
            fallback={fallback}
            skeletonClassName={skeletonClassName}
            {...imgProps}
        />
    );
};

export default StorageImage;
