import { useRef, useState, useEffect } from 'react';

interface ImagePickerProps {
    onFileSelected: (file: File) => void;
    accept?: string;
    disabled?: boolean;
    cameraFacingMode?: 'user' | 'environment';
    children: (open: () => void) => React.ReactNode;
}

const ImagePicker = ({
    onFileSelected,
    accept = 'image/jpeg,image/png,image/webp',
    disabled = false,
    cameraFacingMode = 'environment',
    children,
}: ImagePickerProps) => {
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const openMenu = () => {
        if (disabled) return;
        setIsMenuOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onFileSelected(file);
        e.target.value = '';
        setIsMenuOpen(false);
    };

    const triggerCamera = () => cameraInputRef.current?.click();
    const triggerGallery = () => galleryInputRef.current?.click();

    useEffect(() => {
        if (!isMenuOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsMenuOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isMenuOpen]);

    return (
        <>
            {children(openMenu)}
            <input
                ref={galleryInputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled}
            />
            <input
                ref={cameraInputRef}
                type="file"
                accept={accept}
                capture={cameraFacingMode}
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled}
            />
            {isMenuOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
                        onClick={() => setIsMenuOpen(false)}
                    />
                    <div className="relative bg-white dark:bg-slate-900 w-full max-w-xs rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="px-6 pt-5 pb-2">
                            <h3 className="text-base font-black text-slate-900 dark:text-white">Selecionar imagem</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Escolha como deseja adicionar a foto.</p>
                        </div>
                        <div className="p-4 space-y-2">
                            <button
                                type="button"
                                onClick={triggerCamera}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                            >
                                <span className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined">photo_camera</span>
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Tirar foto</p>
                                    <p className="text-[10px] text-slate-500">Usar a câmera do dispositivo</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={triggerGallery}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                            >
                                <span className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined">photo_library</span>
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Escolher arquivo</p>
                                    <p className="text-[10px] text-slate-500">Selecionar da galeria ou disco</p>
                                </div>
                            </button>
                        </div>
                        <div className="px-4 pb-4">
                            <button
                                type="button"
                                onClick={() => setIsMenuOpen(false)}
                                className="w-full px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ImagePicker;
