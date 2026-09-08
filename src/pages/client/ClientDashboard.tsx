import { Link } from 'react-router-dom';
import ClientLayout from '../../layouts/ClientLayout';
import { useAuth } from '../../contexts/AuthContext';

const ClientDashboard = () => {
    const { profile } = useAuth();
    const firstName = profile?.nome?.split(' ')[0] || 'bem-vindo(a)';

    return (
        <ClientLayout title="Início">
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="size-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-4xl text-primary">waving_hand</span>
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
                    Olá, {firstName}!
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md mb-8 leading-relaxed">
                    Seu portal está pronto. Por aqui você fala com o suporte, acompanha seus
                    chamados e exerce seus direitos de titular de dados.
                </p>
                <Link
                    to="/cliente/suporte"
                    className="inline-flex items-center gap-2 bg-primary text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-primary/25 hover:brightness-110 transition-all transform hover:-translate-y-0.5 active:scale-[0.98]"
                >
                    <span className="material-symbols-outlined">support_agent</span>
                    Falar com o suporte
                </Link>
            </div>
        </ClientLayout>
    );
};

export default ClientDashboard;
