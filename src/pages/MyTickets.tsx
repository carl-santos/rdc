import { useState, useEffect } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Database } from '../types/database';
import { AttachmentPicker, uploadAttachments, type PendingFile } from '../components/TicketAttachments';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { getCategoryDef, getSubcategoryDef } from '../utils/ticketClassifier';
import { useChatbot } from '../contexts/ChatbotContext';

type Ticket = Database['public']['Tables']['support_tickets']['Row'];
type Message = Database['public']['Tables']['ticket_messages']['Row'];
type Attachment = Database['public']['Tables']['ticket_attachments']['Row'];

interface FullTicket extends Ticket {
    ticket_messages: (Message & { ticket_attachments: Attachment[] })[];
}

const MyTickets = () => {
    const { user, profile } = useAuth();
    const showToast = useToast();
    const { resumeChat, active: activeChatbot } = useChatbot();
    const [tickets, setTickets] = useState<FullTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modals
    const [selectedTicket, setSelectedTicket] = useState<FullTicket | null>(null);
    const [showConvModal, setShowConvModal] = useState(false);
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [replyMsg, setReplyMsg] = useState('');
    const [replyFiles, setReplyFiles] = useState<PendingFile[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user && profile?.tenant_id) {
            fetchTickets();
        }
    }, [user, profile]);

    const fetchTickets = async () => {
        if (!profile?.tenant_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .select(`
                    *,
                    ticket_messages (
                        *,
                        ticket_attachments (*)
                    )
                `)
                .eq('tenant_id', profile.tenant_id!)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            // sort messages by created_at ascending
            const formattedData = (data as any[]).map(t => ({
                ...t,
                ticket_messages: t.ticket_messages?.sort((a: any, b: any) => 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                ) || []
            }));

            setTickets(formattedData);
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
            const { error: msgErr } = await supabase
                .from('ticket_messages')
                .insert({
                    ticket_id: selectedTicket.id,
                    sender_type: 'user',
                    sender_id: user.id,
                    message: replyMsg
                });

            if (msgErr) throw msgErr;

            // Upload de anexos vinculados à mensagem
            if (replyFiles.length > 0) {
                const { data: msgData } = await supabase
                    .from('ticket_messages')
                    .select('id')
                    .eq('ticket_id', selectedTicket.id)
                    .eq('sender_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                await uploadAttachments(replyFiles, selectedTicket.id, msgData?.id ?? null, user.id);
            }

            // Mudar o status se estiver fechado ou resolvido e teve reposta do user?
            if (selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') {
                 await supabase.from('support_tickets').update({ status: 'open' }).eq('id', selectedTicket.id);
            }

            setReplyMsg('');
            setReplyFiles([]);
            setShowReplyModal(false);
            await fetchTickets();
            
            // Update selected ticket data inside modal open
            const updated = await supabase
                .from('support_tickets')
                .select(`*, ticket_messages(*, ticket_attachments(*))`)
                .eq('id', selectedTicket.id)
                .single();
                
            if (updated.data) {
                const refreshedTicket = updated.data as any;
                refreshedTicket.ticket_messages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                setSelectedTicket(refreshedTicket);
            }

            showToast('Resposta enviada com sucesso!', 'success');
        } catch (error: any) {
            showToast('Erro ao enviar resposta: ' + error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResolve = async (id: string) => {
        if (!confirm('Deseja marcar este chamado como resolvido?')) return;
        
        try {
            const { error } = await supabase
                .from('support_tickets')
                .update({ status: 'resolved' })
                .eq('id', id);

            if (error) throw error;
            fetchTickets();
            
            if (selectedTicket?.id === id) {
                setSelectedTicket(prev => prev ? {...prev, status: 'resolved'} : null);
            }
        } catch (err: any) {
            showToast('Erro ao marcar como resolvido: ' + err.message, 'error');
        }
    };

    // Derived states
    const filteredTickets = tickets.filter(t => {
        if (filter !== 'all' && t.status !== filter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return t.subject.toLowerCase().includes(q) || 
                   t.ticket_number.toLowerCase().includes(q) || 
                   t.category.toLowerCase().includes(q);
        }
        return true;
    });

    const stats = {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        inProgress: tickets.filter(t => t.status === 'in_progress').length,
        resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
    };

    const StatusBadge = ({ status }: { status: string | null }) => {
        const badges: Record<string, { bg: string, text: string, label: string }> = {
            open: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-500', label: 'Novo' },
            in_progress: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-500', label: 'Em Análise' },
            resolved: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-500', label: 'Resolvido' },
            closed: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', label: 'Fechado' }
        };
        const s = badges[status || 'open'] || badges.open;
        return <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${s.bg} ${s.text} border border-[currentColor]/10`}>{s.label}</span>;
    };

    return (
        <DashboardLayout title="Meus Chamados">
            <div className="max-w-[1080px] mx-auto py-8 animate-in fade-in duration-500 font-outfit">
                
                {/* HEAD */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white font-playfair tracking-tight mb-1">Meus Chamados</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Acompanhe o status e as interações dos seus tickets de suporte</p>
                    </div>
                    <Link to="/suporte" className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-bold transition-all shadow-xl shadow-primary/20 hover:-translate-y-0.5 w-fit">
                        <span className="material-symbols-outlined text-sm">add</span> Novo Chamado
                    </Link>
                </div>

                {/* STATS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total', value: stats.total, color: 'text-primary' },
                        { label: 'Novos', value: stats.open, color: 'text-yellow-600' },
                        { label: 'Em Análise', value: stats.inProgress, color: 'text-blue-600' },
                        { label: 'Resolvidos/Fechados', value: stats.resolved, color: 'text-emerald-600' }
                    ].map((s, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[1.5rem] text-center shadow-sm">
                            <span className={`text-4xl font-black block mb-1 font-playfair ${s.color}`}>{s.value}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* FILTERS & SEARCH */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] p-4 mb-8 flex flex-col md:flex-row gap-4 justify-between shadow-sm">
                    <div className="flex overflow-x-auto gap-2 pb-2 md:pb-0 hide-scrollbar">
                        {[
                            { id: 'all', label: 'Todos' },
                            { id: 'open', label: 'Novos' },
                            { id: 'in_progress', label: 'Em Análise' },
                            { id: 'resolved', label: 'Resolvidos' },
                            { id: 'closed', label: 'Fechados' }
                        ].map(f => (
                            <button 
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className={`px-5 py-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${filter === f.id ? 'bg-slate-100 dark:bg-slate-800 text-primary shadow-inner' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full md:w-72">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                        <input 
                            type="text" 
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-primary outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                            placeholder="Buscar protocolos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* TICKETS LIST */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                            <p className="text-slate-400 font-medium">Buscando chamados...</p>
                        </div>
                    ) : filteredTickets.length > 0 ? (
                        filteredTickets.map(ticket => (
                            <div key={ticket.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[1.5rem] transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 group">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 flex-wrap mb-3">
                                            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">{ticket.ticket_number}</span>
                                            <StatusBadge status={ticket.status} />
                                            {(ticket.priority === 'urgent' || ticket.priority === 'critical') && (
                                                <span className="text-[10px] font-black uppercase text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded border border-red-500/20 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
                                                    {ticket.priority === 'critical' ? 'Crítico' : 'Urgente'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5 flex-wrap">
                                            <span className="font-semibold text-slate-500">{getCategoryDef(ticket.category)?.label ?? ticket.category}</span>
                                            {ticket.subcategory && (
                                                <>
                                                    <span className="text-slate-300">›</span>
                                                    <span>{getSubcategoryDef(ticket.category, ticket.subcategory)?.label ?? ticket.subcategory}</span>
                                                </>
                                            )}
                                        </p>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 group-hover:text-primary transition-colors">{ticket.subject}</h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 md:pr-12 leading-relaxed">{ticket.description}</p>
                                    </div>

                                    <div className="flex flex-col items-start md:items-end gap-4 border-t border-slate-100 dark:border-slate-800 md:border-t-0 pt-4 md:pt-0 shrink-0">
                                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                                            {new Date(ticket.created_at!).toLocaleDateString('pt-BR')}
                                        </div>

                                        <div className="flex items-center gap-2 w-full md:w-auto mt-auto flex-wrap">
                                            {ticket.resolution_type === 'auto' && (ticket.status === 'open' || ticket.status === 'in_progress') && (
                                                <button
                                                    onClick={() => resumeChat(
                                                        ticket.id,
                                                        ticket.ticket_number,
                                                        ticket.category,
                                                        ticket.subcategory ?? null,
                                                        [],
                                                    )}
                                                    className={`flex-1 md:flex-none px-4 py-3 rounded-xl text-xs font-bold transition-all z-10 flex items-center justify-center gap-2 ${activeChatbot?.ticketId === ticket.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20'}`}
                                                >
                                                    <span className="relative">
                                                        <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                                                        {activeChatbot?.ticketId !== ticket.id && (
                                                            <span className="absolute -top-0.5 -right-0.5 size-2 bg-emerald-400 rounded-full animate-pulse" />
                                                        )}
                                                    </span>
                                                    {activeChatbot?.ticketId === ticket.id ? 'Chat aberto' : 'Continuar conversa'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => { setSelectedTicket(ticket); setShowConvModal(true); }}
                                                className="flex-1 md:flex-none border border-slate-200 dark:border-slate-700 hover:border-primary text-slate-600 dark:text-slate-300 px-4 py-3 rounded-xl text-xs font-bold transition-all hover:bg-slate-50 dark:hover:bg-slate-800 z-10 flex items-center justify-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">forum</span>
                                                Ver Interações
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-[2rem]">
                            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4 block">inbox</span>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Nenhum chamado encontrado</h3>
                            <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Você não tem chamados {filter !== 'all' ? `com o status selecionado` : 'abertos no momento'}.</p>
                        </div>
                    )}
                </div>

            </div>

            {/* CONVERSATION MODAL */}
            {showConvModal && selectedTicket && (
                <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                    <span className="font-mono text-sm text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20">{selectedTicket.ticket_number}</span>
                                    Interações do Chamado
                                </h3>
                                <div className="mt-2 flex items-center gap-3">
                                    <StatusBadge status={selectedTicket.status} />
                                    <span className="text-xs text-slate-500 font-medium">{new Date(selectedTicket.created_at!).toLocaleString('pt-BR')}</span>
                                </div>
                            </div>
                            <button onClick={() => setShowConvModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 size-11 rounded-xl flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto w-full bg-slate-50 dark:bg-slate-950 flex-1 space-y-6">
                            
                            {/* Assunto Details Box */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                                <h4 className="font-bold text-slate-800 dark:text-white mb-2">{selectedTicket.subject}</h4>
                                <div className="flex gap-2 flex-wrap mb-4">
                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase rounded tracking-widest">
                                        {getCategoryDef(selectedTicket.category)?.label ?? selectedTicket.category}
                                    </span>
                                    {selectedTicket.subcategory && (
                                        <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase rounded tracking-widest">
                                            {getSubcategoryDef(selectedTicket.category, selectedTicket.subcategory)?.label ?? selectedTicket.subcategory}
                                        </span>
                                    )}
                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase rounded tracking-widest">
                                        PRIORIDADE: {selectedTicket.priority.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            {/* Timeline of messages */}
                            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
                                {selectedTicket.ticket_messages.map((msg) => (
                                    <div key={msg.id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group select-none`}>
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 dark:border-slate-950 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 bg-white dark:bg-slate-900">
                                            {msg.sender_type === 'user' ? (
                                                <div className="size-full rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-[18px]">person</span>
                                                </div>
                                            ) : (
                                                <div className="size-full rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center shadow-inner">
                                                    <span className="material-symbols-outlined text-[18px]">support_agent</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-slate-800 dark:text-white">{msg.sender_type === 'user' ? 'Você' : 'Equipe de Suporte'}</span>
                                                <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                    {new Date(msg.created_at!).toLocaleDateString('pt-BR')} às {new Date(msg.created_at!).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                        </div>

                        {/* Footer / Actions */}
                        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center rounded-b-[2rem] shrink-0 flex-wrap gap-4">
                            {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' ? (
                                <button 
                                    onClick={() => handleResolve(selectedTicket.id)}
                                    className="text-emerald-600 hover:text-white border border-emerald-500 hover:bg-emerald-500 font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2 text-sm order-2 md:order-1"
                                >
                                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                    Marcar como Resolvido
                                </button>
                            ) : (
                                <div className="text-slate-400 text-sm italic font-medium flex items-center gap-2 order-2 md:order-1">
                                    <span className="material-symbols-outlined text-lg">lock</span> Este chamado está encerrado.
                                </div>
                            )}

                            <div className="flex items-center gap-3 ml-auto order-1 md:order-2 w-full md:w-auto">
                                <button onClick={() => setShowConvModal(false)} className="flex-1 md:flex-none text-slate-500 font-bold px-6 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    Voltar
                                </button>
                                {selectedTicket.status !== 'closed' && (
                                    <button 
                                        onClick={() => setShowReplyModal(true)}
                                        className="flex-1 md:flex-none bg-primary hover:bg-primary-dark text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-primary/30 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">reply</span>
                                        Nova Interação
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* REPLY MODAL */}
            {showReplyModal && (
                <div className="fixed inset-0 z-[9900] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Adicionar Resposta</h3>
                            <button onClick={() => setShowReplyModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 size-11 rounded-xl flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Mensagem <span className="text-red-500">*</span></label>
                                <textarea
                                    rows={5}
                                    maxLength={4000}
                                    value={replyMsg}
                                    onChange={(e) => setReplyMsg(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none text-slate-800 dark:text-white text-sm"
                                    placeholder="Digite sua resposta..."
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">
                                    Anexos <span className="text-slate-400 font-normal text-xs">(opcional)</span>
                                </label>
                                <AttachmentPicker files={replyFiles} onChange={setReplyFiles} />
                            </div>
                        </div>

                        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end items-center rounded-b-[2rem] gap-4">
                            <button onClick={() => setShowReplyModal(false)} className="text-slate-500 font-bold px-6 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors" disabled={isSubmitting}>
                                Cancelar
                            </button>
                            <button 
                                onClick={handleReply}
                                disabled={isSubmitting || !replyMsg.trim()}
                                className={`bg-primary hover:bg-primary-dark text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-primary/30 flex items-center gap-2 ${isSubmitting || !replyMsg.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
                            >
                                {isSubmitting ? 'Enviando...' : 'Enviar Resposta'}
                                {!isSubmitting && <span className="material-symbols-outlined text-sm">send</span>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </DashboardLayout>
    );
};

export default MyTickets;
