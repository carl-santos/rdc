import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ClientLayout from '../../layouts/ClientLayout';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { AttachmentPicker, uploadAttachments, type PendingFile } from '../../components/TicketAttachments';
import { useChatbot } from '../../contexts/ChatbotContext';

interface Message {
    id: string;
    created_at: string | null;
    sender_type: string | null;
    message: string | null;
}

interface Ticket {
    id: string;
    created_at: string | null;
    ticket_number: string;
    subject: string;
    description: string | null;
    category: string;
    priority: string;
    status: string | null;
    ticket_messages: Message[];
}

const StatusBadge = ({ status }: { status: string | null }) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
        open: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-400', label: 'Novo' },
        in_progress: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-400', label: 'Em Análise' },
        resolved: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', label: 'Resolvido' },
        closed: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', label: 'Fechado' },
    };
    const s = badges[status || 'open'] || badges.open;
    return (
        <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full ${s.bg} ${s.text}`}>
            {s.label}
        </span>
    );
};

const ClientMyTickets = () => {
    const { user } = useAuth();
    const showToast = useToast();
    const { resumeChat, active: activeChatbot } = useChatbot();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [showConvModal, setShowConvModal] = useState(false);
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [replyMsg, setReplyMsg] = useState('');
    const [replyFiles, setReplyFiles] = useState<PendingFile[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user) fetchTickets();
    }, [user]);

    const fetchTickets = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .select(`*, ticket_messages(*)`)
                .eq('user_id', user.id as any)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formatted = (data as any[]).map(t => ({
                ...t,
                ticket_messages: (t.ticket_messages || []).sort((a: any, b: any) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                ),
            }));
            setTickets(formatted);
        } catch (err) {
            console.error('Error fetching tickets:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReply = async () => {
        if (!replyMsg.trim() || !selectedTicket || !user) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('ticket_messages').insert({
                ticket_id: selectedTicket.id,
                sender_type: 'user',
                sender_id: user.id,
                message: replyMsg,
            } as any);
            if (error) throw error;

            if (replyFiles.length > 0) {
                const { data: msgData } = await supabase
                    .from('ticket_messages')
                    .select('id')
                    .eq('ticket_id', selectedTicket.id as any)
                    .eq('sender_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                await uploadAttachments(replyFiles, selectedTicket.id as string, msgData?.id ?? null, user.id);
            }

            if (selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') {
                await supabase.from('support_tickets').update({ status: 'open' } as any).eq('id', selectedTicket.id as any);
            }

            setReplyMsg('');
            setReplyFiles([]);
            setShowReplyModal(false);
            await fetchTickets();

            const updated = await supabase
                .from('support_tickets')
                .select('*, ticket_messages(*)')
                .eq('id', selectedTicket.id as any)
                .single();

            if (updated.data) {
                const r = updated.data as any;
                r.ticket_messages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                setSelectedTicket(r);
            }
        } catch (err: any) {
            showToast('Erro ao enviar resposta: ' + err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResolve = async (id: string) => {
        if (!confirm('Deseja marcar este chamado como resolvido?')) return;
        try {
            await supabase.from('support_tickets').update({ status: 'resolved' } as any).eq('id', id as any);
            fetchTickets();
            if (selectedTicket?.id === id) {
                setSelectedTicket(prev => prev ? { ...prev, status: 'resolved' } : null);
            }
        } catch (err: any) {
            showToast('Erro: ' + err.message, 'error');
        }
    };

    const filtered = tickets.filter(t => filter === 'all' || t.status === filter);

    return (
        <ClientLayout title="Meus Chamados">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Meus Chamados</h2>
                        <p className="text-slate-500 text-sm mt-1">Acompanhe seus tickets de suporte.</p>
                    </div>
                    <Link
                        to="/cliente/suporte"
                        className="flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 transition-all text-sm"
                    >
                        <span className="material-symbols-outlined text-base">add</span>
                        Novo Chamado
                    </Link>
                </div>

                {/* Filter pills */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {[
                        { id: 'all', label: 'Todos' },
                        { id: 'open', label: 'Novos' },
                        { id: 'in_progress', label: 'Em Análise' },
                        { id: 'resolved', label: 'Resolvidos' },
                        { id: 'closed', label: 'Fechados' },
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${filter === f.id ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Tickets */}
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="space-y-3">
                        {filtered.map(ticket => (
                            <div key={ticket.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-primary/40 hover:shadow-lg transition-all">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{ticket.ticket_number}</span>
                                            <StatusBadge status={ticket.status} />
                                        </div>
                                        <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">{ticket.subject}</h3>
                                        <p className="text-slate-500 text-xs line-clamp-2">{ticket.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                                        <span className="text-xs text-slate-400">{new Date(ticket.created_at!).toLocaleDateString('pt-BR')}</span>
                                        {(ticket as any).resolution_type === 'auto' && (ticket.status === 'open' || ticket.status === 'in_progress') && (
                                            <button
                                                onClick={() => resumeChat(
                                                    ticket.id,
                                                    ticket.ticket_number,
                                                    ticket.category,
                                                    (ticket as any).subcategory ?? null,
                                                    [],
                                                )}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${activeChatbot?.ticketId === ticket.id ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20'}`}
                                            >
                                                <span className="material-symbols-outlined text-base">smart_toy</span>
                                                {activeChatbot?.ticketId === ticket.id ? 'Aberto' : 'Continuar'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setSelectedTicket(ticket); setShowConvModal(true); }}
                                            className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 hover:border-primary text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                        >
                                            <span className="material-symbols-outlined text-base">forum</span>
                                            Ver
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">inbox</span>
                        <h3 className="font-bold text-slate-800 dark:text-white mb-1">Nenhum chamado encontrado</h3>
                        <p className="text-slate-500 text-sm">Você não tem chamados {filter !== 'all' ? 'com este status' : 'abertos'}.</p>
                    </div>
                )}
            </div>

            {/* Conversation Modal */}
            {showConvModal && selectedTicket && (
                <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-base">
                                    <span className="font-mono text-sm text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{selectedTicket.ticket_number}</span>
                                    Interações
                                </h3>
                                <div className="mt-1 flex items-center gap-2">
                                    <StatusBadge status={selectedTicket.status} />
                                    <span className="text-xs text-slate-400">{new Date(selectedTicket.created_at!).toLocaleString('pt-BR')}</span>
                                </div>
                            </div>
                            <button onClick={() => setShowConvModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 size-9 rounded-xl flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50 dark:bg-slate-950">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1">{selectedTicket.subject}</h4>
                                <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{selectedTicket.category}</span>
                            </div>
                            {selectedTicket.ticket_messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl p-4 ${msg.sender_type === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-bl-sm'}`}>
                                        <p className={`text-xs font-bold mb-1 ${msg.sender_type === 'user' ? 'text-primary-100' : 'text-slate-500'}`}>
                                            {msg.sender_type === 'user' ? 'Você' : 'Equipe de Suporte'}
                                        </p>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                        <p className={`text-[10px] mt-1 ${msg.sender_type === 'user' ? 'text-white/60' : 'text-slate-400'}`}>
                                            {new Date(msg.created_at!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center flex-shrink-0 flex-wrap gap-3">
                            {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' ? (
                                <button
                                    onClick={() => handleResolve(selectedTicket.id)}
                                    className="text-emerald-600 border border-emerald-400 hover:bg-emerald-500 hover:text-white font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 text-sm"
                                >
                                    <span className="material-symbols-outlined text-base">check_circle</span>
                                    Marcar como Resolvido
                                </button>
                            ) : (
                                <p className="text-xs text-slate-400 italic flex items-center gap-1">
                                    <span className="material-symbols-outlined text-base">lock</span> Chamado encerrado.
                                </p>
                            )}
                            <div className="flex gap-2 ml-auto">
                                <button onClick={() => setShowConvModal(false)} className="text-slate-500 font-bold px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm">
                                    Fechar
                                </button>
                                {selectedTicket.status !== 'closed' && (
                                    <button
                                        onClick={() => setShowReplyModal(true)}
                                        className="bg-primary text-white font-bold px-5 py-2 rounded-xl shadow-lg shadow-primary/25 hover:brightness-110 transition-all flex items-center gap-1.5 text-sm"
                                    >
                                        <span className="material-symbols-outlined text-base">reply</span>
                                        Responder
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reply Modal */}
            {showReplyModal && (
                <div className="fixed inset-0 z-[9900] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 dark:text-white">Adicionar Resposta</h3>
                            <button onClick={() => setShowReplyModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 size-9 rounded-xl flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <textarea
                                rows={5}
                                maxLength={4000}
                                value={replyMsg}
                                onChange={(e) => setReplyMsg(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all resize-none text-slate-800 dark:text-white text-sm"
                                placeholder="Digite sua mensagem..."
                                disabled={isSubmitting}
                            />
                            <AttachmentPicker files={replyFiles} onChange={setReplyFiles} />
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                            <button onClick={() => setShowReplyModal(false)} className="text-slate-500 font-bold px-5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm" disabled={isSubmitting}>
                                Cancelar
                            </button>
                            <button
                                onClick={handleReply}
                                disabled={isSubmitting || !replyMsg.trim()}
                                className="bg-primary text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-primary/25 hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
                            >
                                {isSubmitting ? 'Enviando...' : 'Enviar'}
                                {!isSubmitting && <span className="material-symbols-outlined text-base">send</span>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ClientLayout>
    );
};

export default ClientMyTickets;
