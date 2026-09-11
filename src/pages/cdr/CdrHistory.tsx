import { MouseEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { listConversations, listMessages, sessionPath } from '../../hooks/useCdr';
import { CdrSessionMode, MODE_LABELS } from '../../types/cdr';
import { buildSessionMarkdown, downloadMarkdown, sessionExportFilename } from '../../utils/cdrExport';

const CdrHistory = () => {
    const { tenant } = useAuth();
    const showToast = useToast();
    const [exportingId, setExportingId] = useState<string | null>(null);
    const { data: conversations = [], isLoading } = useQuery({
        queryKey: ['cdr-conversations', tenant?.id],
        queryFn: () => listConversations(tenant!.id),
        enabled: !!tenant?.id,
    });

    const exportConversation = async (
        event: MouseEvent,
        conv: (typeof conversations)[number],
    ) => {
        event.preventDefault();
        event.stopPropagation();
        setExportingId(conv.id);
        try {
            const messages = await listMessages(conv.id);
            if (!messages.some((msg) => msg.role === 'assistant')) {
                showToast('Esta sessão ainda não tem resposta para exportar.', 'error');
                return;
            }
            const mode = conv.mode as CdrSessionMode;
            const name = conv.representative_nome || 'Representante';
            downloadMarkdown(
                sessionExportFilename(name, mode, new Date(conv.updated_at)),
                buildSessionMarkdown({
                    representativeName: name,
                    mode,
                    messages,
                    generatedAt: new Date(conv.updated_at),
                }),
            );
            showToast('Artefato baixado.', 'success');
        } catch {
            showToast('Não foi possível exportar esta sessão.', 'error');
        } finally {
            setExportingId(null);
        }
    };

    return (
        <DashboardLayout title="Histórico">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">Histórico de interações</h1>
                <p className="text-sm text-slate-500 mt-1 mb-8">
                    Consultas realizadas com os representantes digitais deste espaço. Exporte o roteiro, o plano de aula, a minuta ou o registro da conversa.
                </p>

                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                        <span className="material-symbols-outlined text-primary text-4xl">history</span>
                        <p className="mt-4 text-sm text-slate-500">Ainda não há conversas registradas.</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {conversations.map((conv) => (
                            <li
                                key={conv.id}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-primary transition-colors flex items-stretch"
                            >
                                <Link
                                    to={`${sessionPath(conv.representative_id, conv.mode as CdrSessionMode)}?c=${conv.id}`}
                                    className="flex-1 min-w-0 p-5"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="font-bold text-slate-900 dark:text-white">
                                            {conv.representative_nome || 'Representante'}
                                        </p>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                                            {MODE_LABELS[conv.mode as CdrSessionMode] ?? conv.mode}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1 truncate">
                                        {conv.title || 'Sem título'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-2">
                                        {new Date(conv.updated_at).toLocaleString('pt-BR')}
                                    </p>
                                </Link>
                                <button
                                    type="button"
                                    onClick={(event) => exportConversation(event, conv)}
                                    disabled={exportingId === conv.id}
                                    className="shrink-0 px-4 text-xs font-bold text-slate-500 hover:text-primary disabled:opacity-40 border-l border-slate-200 dark:border-slate-800"
                                >
                                    {exportingId === conv.id ? '…' : 'Exportar'}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </DashboardLayout>
    );
};

export default CdrHistory;
