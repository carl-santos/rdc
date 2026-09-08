import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Controla o hook de signed URL e isola o SafeImage (que faz fetch real).
const mockUseSignedUrl = vi.fn();
vi.mock('../hooks/useSignedUrl', () => ({ useSignedUrl: (p: unknown) => mockUseSignedUrl(p) }));
vi.mock('./SafeImage', () => ({
    default: ({ src, fallback }: { src: string | null; fallback?: React.ReactNode }) =>
        src ? <img data-testid="safe-img" src={src} /> : <>{fallback}</>,
}));

import StorageImage from './StorageImage';

beforeEach(() => mockUseSignedUrl.mockReset());

describe('StorageImage', () => {
    it('mostra skeleton enquanto resolve a Signed URL', () => {
        mockUseSignedUrl.mockReturnValue({ url: null, loading: true });
        const { container } = render(
            <StorageImage path="avatars/t/x.jpg" skeletonClassName="sk" fallback={<span>FB</span>} />,
        );
        expect(container.querySelector('.sk')).not.toBeNull();
        expect(screen.queryByTestId('safe-img')).toBeNull();
        expect(screen.queryByText('FB')).toBeNull();
    });

    it('renderiza a imagem com a Signed URL resolvida', () => {
        mockUseSignedUrl.mockReturnValue({ url: 'https://x/signed?token=1', loading: false });
        render(<StorageImage path="avatars/t/x.jpg" />);
        expect(screen.getByTestId('safe-img')).toHaveAttribute('src', 'https://x/signed?token=1');
    });

    it('mostra o fallback quando não há path/URL', () => {
        mockUseSignedUrl.mockReturnValue({ url: null, loading: false });
        render(<StorageImage path={null} fallback={<span>FB</span>} />);
        expect(screen.getByText('FB')).toBeInTheDocument();
    });
});
