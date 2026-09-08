import { Component, ErrorInfo } from 'react';
import { captureException } from '../utils/sentry';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, _info: ErrorInfo) {
        // PROD-01: reporta ao monitoramento (no-op sem VITE_SENTRY_DSN)
        captureException(error);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
                    <div className="text-center max-w-md">
                        <span className="material-symbols-outlined text-5xl text-slate-400 mb-4 block">error</span>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Algo deu errado</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                            Ocorreu um erro inesperado. Tente recarregar a página.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:brightness-110 transition-all"
                        >
                            Recarregar
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
