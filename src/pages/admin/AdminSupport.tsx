import { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../types/database';
import {
    SUPPORT_CATEGORIES,
    getCategoryDef,
    getSubcategoryDef,
} from '../../utils/ticketClassifier';
import { AttachmentList, fetchAttachmentsWithSignedUrls, type UploadedAttachment } from '../../components/TicketAttachments';

type TicketStatus   = 'open' | 'in_progress' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'normal' | 'high' | 'urgent' | 'critical';

type FaqArticle      = Database['public']['Tables']['faq_articles']['Row'];
type ChatbotFlow     = Database['public']['Tables']['chatbot_flows']['Row'];
type SuggestionMeta  = Database['public']['Tables']['suggestion_meta']['Row'];
type SuggestionStatus = SuggestionMeta['status'];

interface SuggestionRow {
    id: string;
    ticket_number: string;
    subject: string;
    description: string;
    category: string;
    subcategory: string | null;
    tags: string[] | null;
    created_at: string | null;
    tenant_id: string | null;
    user_id: string;
    meta: SuggestionMeta | null;
    messages_count: number;
}

interface SuggestionAnalytics {
    by_status:      { status: string; total: number }[];
    daily_volume:   { day: string; total: number }[];
    by_subcategory: { subcategory: string; total: number }[];
    by_tenant:      { tenant_name: string; total: number }[];
    total:          number;
    total_period:   number;
}

interface Message {
    id: string;
    ticket_id: string;
    sender_type: string;
    sender_id: string | null;
    message: string;
    created_at: string | null;
}

interface Ticket {
    id: string;
    ticket_number: string;
    subject: string;
    description: string;
    category: string;
    subcategory: string | null;
    priority: TicketPriority;
    status: TicketStatus;
    created_at: string | null;
    updated_at: string | null;
    user_id: string;
    tenant_id: string;
    blocks_sales: boolean | null;
    unread_messages_count: number | null;
    tags: string[] | null;
    resolution_type: string | null;
    confidence_score: number | null;
    ticket_messages: Message[];
    tenant_name?: string;
    user_email?: string;
}

// ─── display helpers ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
    critical: { label: 'Crítica',  bg: 'bg-red-100 dark:bg-red-900/30',    text: 'text-red-600 dark:text-red-400',       icon: 'local_fire_department' },
    urgent:   { label: 'Urgente',  bg: 'bg-red-100 dark:bg-red-900/30',    text: 'text-red-600 dark:text-red-400',       icon: 'local_fire_department' },
    high:     { label: 'Alta',     bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', icon: 'arrow_upward' },
    medium:   { label: 'Média',    bg: 'bg-blue-100 dark:bg-blue-900/30',  text: 'text-blue-600 dark:text-blue-400',     icon: 'remove' },
    normal:   { label: 'Normal',   bg: 'bg-blue-100 dark:bg-blue-900/30',  text: 'text-blue-600 dark:text-blue-400',     icon: 'remove' },
    low:      { label: 'Baixa',    bg: 'bg-slate-100 dark:bg-slate-800',   text: 'text-slate-500 dark:text-slate-400',   icon: 'arrow_downward' },
};

const STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; text: string }> = {
    open:        { label: 'Novo',        bg: 'bg-yellow-100 dark:bg-yellow-900/30',  text: 'text-yellow-700 dark:text-yellow-400'  },
    in_progress: { label: 'Em Análise',  bg: 'bg-blue-100 dark:bg-blue-900/30',      text: 'text-blue-700 dark:text-blue-400'      },
    resolved:    { label: 'Resolvido',   bg: 'bg-emerald-100 dark:bg-emerald-900/30',text: 'text-emerald-700 dark:text-emerald-400'},
    closed:      { label: 'Fechado',     bg: 'bg-slate-100 dark:bg-slate-800',       text: 'text-slate-500 dark:text-slate-400'    },
};

const RESOLUTION_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    auto:  { label: 'Automático', color: 'text-emerald-600 dark:text-emerald-400', icon: 'smart_toy'     },
    ai:    { label: 'IA',         color: 'text-violet-600 dark:text-violet-400',   icon: 'psychology'    },
    human: { label: 'Humano',     color: 'text-blue-600 dark:text-blue-400',       icon: 'support_agent' },
};

function categoryLabel(id: string) {
    return getCategoryDef(id)?.label ?? id;
}
function subcategoryLabel(catId: string, subId: string | null) {
    if (!subId) return null;
    return getSubcategoryDef(catId, subId)?.label ?? subId;
}

// ─── Component ────────────────────────────────────────────────────────────────

const AdminSupport = () => {
    const { user } = useAuth();

    // Tab
    const [activeTab, setActiveTab] = useState<'tickets' | 'faq' | 'bot' | 'suggestions'>('tickets');

    // Tickets state
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterResolution, setFilterResolution] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [replyMsg, setReplyMsg] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // FAQ state
    const [articles, setArticles] = useState<FaqArticle[]>([]);
    const [loadingFaq, setLoadingFaq] = useState(false);
    const [showFaqModal, setShowFaqModal] = useState(false);
    const [editingArticle, setEditingArticle] = useState<Partial<FaqArticle> | null>(null);
    const [tagsInput, setTagsInput] = useState('');
    const [savingArticle, setSavingArticle] = useState(false);

    // "Resolved → propose article" prompt
    const [proposeArticleTicket, setProposeArticleTicket] = useState<Ticket | null>(null);

    // Suggestions state
    const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
    const [loadingSugg, setLoadingSugg] = useState(false);
    const [suggFilterStatus, setSuggFilterStatus] = useState<string>('all');
    const [suggFilterSub] = useState<string>('all');
    const [suggPeriod, setSuggPeriod] = useState<90 | 60 | 30>(90);
    const [suggSearch, setSuggSearch] = useState('');
    const [selectedSugg, setSelectedSugg] = useState<SuggestionRow | null>(null);
    const [editingNotes, setEditingNotes] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);
    const [analytics, setAnalytics] = useState<SuggestionAnalytics | null>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    // Bot flows state
    const [flows, setFlows] = useState<ChatbotFlow[]>([]);
    const [loadingFlows, setLoadingFlows] = useState(false);
    const [showFlowModal, setShowFlowModal] = useState(false);
    const [editingFlow, setEditingFlow] = useState<Partial<ChatbotFlow> | null>(null);
    const [flowTagsInput, setFlowTagsInput] = useState('');
    const [savingFlow, setSavingFlow] = useState(false);
    const [expandedFlow, setExpandedFlow] = useState<string | null>(null);

    // Attachments per message (keyed by message ID)
    const [msgAttachments, setMsgAttachments] = useState<Record<string, UploadedAttachment[]>>({});

    // Toast
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    useEffect(() => { fetchTickets(); }, []);
    useEffect(() => { if (activeTab === 'faq') fetchArticles(); }, [activeTab]);
    useEffect(() => { if (activeTab === 'bot') fetchFlows(); }, [activeTab]);
    useEffect(() => {
        if (activeTab === 'suggestions') { fetchSuggestions(); fetchAnalytics(); }
    }, [activeTab, suggPeriod]);

    // Carrega anexos para todas as mensagens do ticket selecionado
    useEffect(() => {
        if (!selectedTicket) return;
        setMsgAttachments({});
        for (const msg of selectedTicket.ticket_messages) {
            fetchAttachmentsWithSignedUrls(selectedTicket.id, msg.id).then(atts => {
                if (atts.length > 0) {
                    setMsgAttachments(prev => ({ ...prev, [msg.id]: atts }));
                }
            });
        }
    }, [selectedTicket?.id]);

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    };

    // ── Tickets ──────────────────────────────────────────────────────────────

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .select(`*, ticket_messages (*)`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formatted = (data as any[]).map(t => ({
                ...t,
                ticket_messages: t.ticket_messages?.sort((a: any, b: any) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                ) || [],
            }));
            setTickets(formatted);
        } catch (err: any) {
            showToast('error', 'Erro ao buscar tickets: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (ticketId: string, newStatus: TicketStatus) => {
        setIsUpdatingStatus(true);
        try {
            const { error } = await supabase
                .from('support_tickets')
                .update({ status: newStatus })
                .eq('id', ticketId);

            if (error) throw error;
            setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
            if (selectedTicket?.id === ticketId) setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
            showToast('success', 'Status atualizado!');

            // When resolving, offer to create a KB article from the thread
            if (newStatus === 'resolved') {
                const ticket = tickets.find(t => t.id === ticketId);
                if (ticket) setProposeArticleTicket({ ...ticket, status: 'resolved' });
            }
        } catch (err: any) {
            showToast('error', 'Erro ao atualizar status: ' + err.message);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleProposeArticle = () => {
        if (!proposeArticleTicket) return;
        const t = proposeArticleTicket;
        // Pre-fill content from the last support reply, or fall back to description
        const lastSupportMsg = [...t.ticket_messages].reverse().find(m => m.sender_type === 'support');
        const preTags = t.tags ?? [];
        setEditingArticle({
            title:       t.subject,
            content:     lastSupportMsg?.message ?? t.description,
            category:    t.category,
            subcategory: t.subcategory,
            tags:        preTags,
            is_published: false,
        });
        setTagsInput(preTags.join(', '));
        setProposeArticleTicket(null);
        setShowFaqModal(true);
        setActiveTab('faq');
    };

    const handleReply = async () => {
        if (!replyMsg.trim() || !selectedTicket || !user) return;
        setIsReplying(true);
        try {
            const { error } = await supabase
                .from('ticket_messages')
                .insert({ ticket_id: selectedTicket.id, sender_type: 'support', sender_id: user.id, message: replyMsg.trim() });
            if (error) throw error;

            if (selectedTicket.status === 'open') {
                await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', selectedTicket.id);
                setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'in_progress' } : t));
                setSelectedTicket(prev => prev ? { ...prev, status: 'in_progress' } : null);
            }

            setReplyMsg('');
            await fetchTickets();
            const updated = await supabase.from('support_tickets').select(`*, ticket_messages(*)`).eq('id', selectedTicket.id).single();
            if (updated.data) {
                const r = updated.data as any;
                r.ticket_messages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                setSelectedTicket(r);
            }
            showToast('success', 'Resposta enviada!');
        } catch (err: any) {
            showToast('error', 'Erro ao enviar resposta: ' + err.message);
        } finally {
            setIsReplying(false);
        }
    };

    const filteredTickets = tickets.filter(t => {
        if (filterStatus !== 'all' && t.status !== filterStatus) return false;
        if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
        if (filterCategory !== 'all' && t.category !== filterCategory) return false;
        if (filterResolution !== 'all' && t.resolution_type !== filterResolution) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return t.subject.toLowerCase().includes(q) ||
                   t.ticket_number.toLowerCase().includes(q) ||
                   t.description.toLowerCase().includes(q) ||
                   (t.subcategory ?? '').toLowerCase().includes(q);
        }
        return true;
    });

    const stats = {
        total:      tickets.length,
        open:       tickets.filter(t => t.status === 'open').length,
        inProgress: tickets.filter(t => t.status === 'in_progress').length,
        resolved:   tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
        critical:   tickets.filter(t => t.priority === 'critical' || t.priority === 'urgent').length,
    };

    // ── FAQ CRUD ─────────────────────────────────────────────────────────────

    const fetchArticles = async () => {
        setLoadingFaq(true);
        try {
            const { data, error } = await supabase
                .from('faq_articles')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setArticles((data as FaqArticle[]) || []);
        } catch (err: any) {
            showToast('error', 'Erro ao buscar artigos: ' + err.message);
        } finally {
            setLoadingFaq(false);
        }
    };

    const openNewArticle = () => {
        setEditingArticle({ title: '', content: '', category: 'support', subcategory: null, tags: [], is_published: false });
        setTagsInput('');
        setShowFaqModal(true);
    };

    const openEditArticle = (a: FaqArticle) => {
        setEditingArticle({ ...a });
        setTagsInput((a.tags ?? []).join(', '));
        setShowFaqModal(true);
    };

    const handleSaveArticle = async () => {
        if (!editingArticle || !user) return;
        if (!editingArticle.title?.trim() || !editingArticle.content?.trim()) {
            showToast('error', 'Título e conteúdo são obrigatórios.');
            return;
        }
        const parsedTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
        setSavingArticle(true);
        try {
            if (editingArticle.id) {
                const { error } = await supabase
                    .from('faq_articles')
                    .update({
                        title:       editingArticle.title,
                        content:     editingArticle.content,
                        category:    editingArticle.category,
                        subcategory: editingArticle.subcategory || null,
                        tags:        parsedTags,
                        is_published: editingArticle.is_published ?? false,
                    })
                    .eq('id', editingArticle.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('faq_articles')
                    .insert({
                        title:       editingArticle.title!,
                        content:     editingArticle.content!,
                        category:    editingArticle.category!,
                        subcategory: editingArticle.subcategory || null,
                        tags:        parsedTags,
                        is_published: editingArticle.is_published ?? false,
                        created_by:  user.id,
                    });
                if (error) throw error;
            }
            showToast('success', 'Artigo salvo!');
            setShowFaqModal(false);
            setEditingArticle(null);
            await fetchArticles();
        } catch (err: any) {
            showToast('error', 'Erro ao salvar artigo: ' + err.message);
        } finally {
            setSavingArticle(false);
        }
    };

    const handleDeleteArticle = async (id: string) => {
        if (!confirm('Excluir este artigo?')) return;
        try {
            const { error } = await supabase.from('faq_articles').delete().eq('id', id);
            if (error) throw error;
            setArticles(prev => prev.filter(a => a.id !== id));
            showToast('success', 'Artigo excluído.');
        } catch (err: any) {
            showToast('error', 'Erro ao excluir: ' + err.message);
        }
    };

    const handleTogglePublish = async (a: FaqArticle) => {
        try {
            const { error } = await supabase.from('faq_articles').update({ is_published: !a.is_published }).eq('id', a.id);
            if (error) throw error;
            setArticles(prev => prev.map(x => x.id === a.id ? { ...x, is_published: !a.is_published } : x));
        } catch (err: any) {
            showToast('error', 'Erro: ' + err.message);
        }
    };

    // ── Suggestions ──────────────────────────────────────────────────────────

    const fetchSuggestions = async () => {
        setLoadingSugg(true);
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .select('*, suggestion_meta(*), ticket_messages(id)')
                .eq('category', 'feedback')
                .order('created_at', { ascending: false });
            if (error) throw error;
            const rows: SuggestionRow[] = (data as any[]).map(t => ({
                id:             t.id,
                ticket_number:  t.ticket_number,
                subject:        t.subject,
                description:    t.description,
                category:       t.category,
                subcategory:    t.subcategory,
                tags:           t.tags,
                created_at:     t.created_at,
                tenant_id:      t.tenant_id,
                user_id:        t.user_id,
                meta:           t.suggestion_meta ?? null,
                messages_count: (t.ticket_messages ?? []).length,
            }));
            setSuggestions(rows);
        } catch (err: any) {
            showToast('error', 'Erro ao buscar sugestões: ' + err.message);
        } finally {
            setLoadingSugg(false);
        }
    };

    const fetchAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            const { data, error } = await supabase.rpc('get_suggestion_analytics', { p_days: suggPeriod });
            if (error) throw error;
            setAnalytics(data as unknown as SuggestionAnalytics);
        } catch {
            // analytics são não-críticos
        } finally {
            setLoadingAnalytics(false);
        }
    };

    const handleSuggStatusChange = async (ticketId: string, newStatus: SuggestionStatus) => {
        try {
            const { error } = await supabase
                .from('suggestion_meta')
                .upsert({
                    ticket_id:   ticketId,
                    status:      newStatus,
                    reviewed_by: newStatus !== 'unread' ? user?.id : null,
                    reviewed_at: newStatus !== 'unread' ? new Date().toISOString() : null,
                }, { onConflict: 'ticket_id' });
            if (error) throw error;
            setSuggestions(prev => prev.map(s => s.id === ticketId
                ? { ...s, meta: { ...(s.meta ?? { ticket_id: ticketId, admin_notes: null, reviewed_by: null, reviewed_at: null, created_at: null, updated_at: null }), status: newStatus } }
                : s
            ));
            if (selectedSugg?.id === ticketId)
                setSelectedSugg(prev => prev ? { ...prev, meta: { ...(prev.meta ?? { ticket_id: ticketId, admin_notes: null, reviewed_by: null, reviewed_at: null, created_at: null, updated_at: null }), status: newStatus } } : null);
            fetchAnalytics();
        } catch (err: any) {
            showToast('error', 'Erro ao atualizar status: ' + err.message);
        }
    };

    const handleSaveNotes = async () => {
        if (!selectedSugg) return;
        setSavingNotes(true);
        try {
            const { error } = await supabase
                .from('suggestion_meta')
                .upsert({ ticket_id: selectedSugg.id, admin_notes: editingNotes }, { onConflict: 'ticket_id' });
            if (error) throw error;
            setSuggestions(prev => prev.map(s => s.id === selectedSugg.id
                ? { ...s, meta: { ...(s.meta ?? { ticket_id: selectedSugg.id, status: 'unread' as SuggestionStatus, reviewed_by: null, reviewed_at: null, created_at: null, updated_at: null }), admin_notes: editingNotes } }
                : s
            ));
            setSelectedSugg(prev => prev ? { ...prev, meta: { ...(prev.meta ?? { ticket_id: selectedSugg.id, status: 'unread' as SuggestionStatus, reviewed_by: null, reviewed_at: null, created_at: null, updated_at: null }), admin_notes: editingNotes } } : null);
            showToast('success', 'Nota salva!');
        } catch (err: any) {
            showToast('error', 'Erro ao salvar nota: ' + err.message);
        } finally {
            setSavingNotes(false);
        }
    };

    const SUGG_STATUS_CONFIG: Record<SuggestionStatus, { label: string; bg: string; text: string; icon: string }> = {
        unread:      { label: 'Não visualizado', bg: 'bg-slate-100 dark:bg-slate-800',       text: 'text-slate-500',                                   icon: 'mark_email_unread'  },
        reviewing:   { label: 'Em análise',      bg: 'bg-blue-100 dark:bg-blue-900/30',      text: 'text-blue-700 dark:text-blue-400',                 icon: 'manage_search'      },
        planned:     { label: 'Planejado',        bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400',             icon: 'event_note'         },
        implemented: { label: 'Implementado',     bg: 'bg-emerald-100 dark:bg-emerald-900/30',text: 'text-emerald-700 dark:text-emerald-400',          icon: 'check_circle'       },
        rejected:    { label: 'Recusado',         bg: 'bg-red-100 dark:bg-red-900/30',       text: 'text-red-700 dark:text-red-400',                   icon: 'cancel'             },
    };

    const filteredSuggestions = suggestions.filter(s => {
        const status = s.meta?.status ?? 'unread';
        if (suggFilterStatus !== 'all' && status !== suggFilterStatus) return false;
        if (suggFilterSub !== 'all' && s.subcategory !== suggFilterSub) return false;
        if (suggSearch) {
            const q = suggSearch.toLowerCase();
            return s.subject.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
        }
        return true;
    });

    // Barras de progresso CSS: porcentagem relativa ao maior valor
    function barPct(value: number, max: number) {
        return max > 0 ? Math.round((value / max) * 100) : 0;
    }

    // ── Bot Flows CRUD ────────────────────────────────────────────────────────

    const fetchFlows = async () => {
        setLoadingFlows(true);
        try {
            const { data, error } = await supabase
                .from('chatbot_flows')
                .select('*')
                .order('category')
                .order('is_root', { ascending: false })
                .order('created_at');
            if (error) throw error;
            setFlows((data as ChatbotFlow[]) || []);
        } catch (err: any) {
            showToast('error', 'Erro ao buscar fluxos: ' + err.message);
        } finally {
            setLoadingFlows(false);
        }
    };

    const openNewFlow = (parentId?: string, parentCategory?: string, parentSubcategory?: string | null) => {
        setEditingFlow({
            name: '',
            category: parentCategory ?? 'support',
            subcategory: parentSubcategory ?? null,
            tags: [],
            parent_id: parentId ?? null,
            bot_message: '',
            option_label: parentId ? '' : null,
            is_root: !parentId,
            is_terminal: false,
            escalate_to_human: false,
            is_published: false,
        });
        setFlowTagsInput('');
        setShowFlowModal(true);
    };

    const openEditFlow = (f: ChatbotFlow) => {
        setEditingFlow({ ...f });
        setFlowTagsInput((f.tags ?? []).join(', '));
        setShowFlowModal(true);
    };

    const handleSaveFlow = async () => {
        if (!editingFlow || !user) return;
        if (!editingFlow.bot_message?.trim() || !editingFlow.name?.trim()) {
            showToast('error', 'Nome e mensagem do bot são obrigatórios.');
            return;
        }
        if (!editingFlow.is_root && !editingFlow.option_label?.trim()) {
            showToast('error', 'Nós filhos precisam de um label de opção.');
            return;
        }
        const parsedTags = flowTagsInput.split(',').map(t => t.trim()).filter(Boolean);
        setSavingFlow(true);
        try {
            const payload = {
                name:             editingFlow.name!,
                category:         editingFlow.category!,
                subcategory:      editingFlow.subcategory || null,
                tags:             parsedTags,
                parent_id:        editingFlow.parent_id || null,
                bot_message:      editingFlow.bot_message!,
                option_label:     editingFlow.is_root ? null : (editingFlow.option_label || null),
                is_root:          editingFlow.is_root ?? false,
                is_terminal:      editingFlow.is_terminal ?? false,
                escalate_to_human: editingFlow.escalate_to_human ?? false,
                is_published:     editingFlow.is_published ?? false,
            };
            if (editingFlow.id) {
                const { error } = await supabase.from('chatbot_flows').update(payload).eq('id', editingFlow.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('chatbot_flows').insert({ ...payload, created_by: user.id });
                if (error) throw error;
            }
            showToast('success', 'Nó salvo!');
            setShowFlowModal(false);
            setEditingFlow(null);
            await fetchFlows();
        } catch (err: any) {
            showToast('error', 'Erro ao salvar: ' + err.message);
        } finally {
            setSavingFlow(false);
        }
    };

    const handleDeleteFlow = async (id: string) => {
        if (!confirm('Excluir este nó e todos os seus filhos?')) return;
        try {
            const { error } = await supabase.from('chatbot_flows').delete().eq('id', id);
            if (error) throw error;
            setFlows(prev => prev.filter(f => f.id !== id && f.parent_id !== id));
            showToast('success', 'Nó excluído.');
        } catch (err: any) {
            showToast('error', 'Erro ao excluir: ' + err.message);
        }
    };

    const handleToggleFlowPublish = async (f: ChatbotFlow) => {
        try {
            const { error } = await supabase.from('chatbot_flows').update({ is_published: !f.is_published }).eq('id', f.id);
            if (error) throw error;
            setFlows(prev => prev.map(x => x.id === f.id ? { ...x, is_published: !f.is_published } : x));
        } catch (err: any) {
            showToast('error', 'Erro: ' + err.message);
        }
    };

    // Monta árvore de nós para exibição agrupada
    const rootFlows = flows.filter(f => f.is_root);
    const childrenOf = (parentId: string) => flows.filter(f => f.parent_id === parentId);

    // ── Sub-components ────────────────────────────────────────────────────────

    const PriorityBadge = ({ priority }: { priority: string }) => {
        const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.normal;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
                <span className="material-symbols-outlined text-[12px]">{cfg.icon}</span>
                {cfg.label}
            </span>
        );
    };

    const StatusBadge = ({ status }: { status: TicketStatus }) => {
        const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
        return (
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
                {cfg.label}
            </span>
        );
    };

    const ResolutionBadge = ({ type }: { type: string | null }) => {
        const cfg = RESOLUTION_CONFIG[type ?? 'human'] ?? RESOLUTION_CONFIG.human;
        return (
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${cfg.color}`}>
                <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                {cfg.label}
            </span>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <DashboardLayout title="Central de Suporte — Admin">
            <div className="space-y-8 pb-20 font-outfit animate-in fade-in duration-500">

                {/* TOAST */}
                {toast && (
                    <div className={`fixed top-6 right-6 z-[99999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl text-white text-sm font-bold animate-in slide-in-from-right-4 fade-in duration-300 ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                        <span className="material-symbols-outlined">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
                        {toast.msg}
                    </div>
                )}

                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight font-playfair">Central de Suporte</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gerencie chamados e a base de conhecimento da plataforma</p>
                    </div>
                    <button
                        onClick={() => { fetchTickets(); if (activeTab === 'faq') fetchArticles(); }}
                        className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 hover:border-primary text-slate-600 dark:text-slate-300 hover:text-primary px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:bg-primary/5"
                    >
                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                        Atualizar
                    </button>
                </div>

                {/* TABS */}
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit">
                    {([
                    { id: 'tickets',     label: 'Chamados',             icon: 'confirmation_number' },
                    { id: 'faq',         label: 'Base de Conhecimento', icon: 'menu_book'           },
                    { id: 'bot',         label: 'Bot de Atendimento',   icon: 'smart_toy'           },
                    { id: 'suggestions', label: 'Sugestões',            icon: 'lightbulb'           },
                ] as const).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <span className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                {tab.label}
                            </span>
                        </button>
                    ))}
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    TAB: TICKETS
                ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'tickets' && (
                    <>
                        {/* STATS */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {[
                                { label: 'Total',      value: stats.total,      color: 'text-slate-700 dark:text-slate-200', icon: 'inbox',                bg: 'bg-slate-100 dark:bg-slate-800'     },
                                { label: 'Novos',      value: stats.open,       color: 'text-yellow-600',                   icon: 'mark_email_unread',    bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
                                { label: 'Em Análise', value: stats.inProgress, color: 'text-blue-600',                     icon: 'pending',               bg: 'bg-blue-50 dark:bg-blue-900/20'    },
                                { label: 'Resolvidos', value: stats.resolved,   color: 'text-emerald-600',                  icon: 'task_alt',              bg: 'bg-emerald-50 dark:bg-emerald-900/20'},
                                { label: 'Críticos',   value: stats.critical,   color: 'text-red-600',                      icon: 'local_fire_department', bg: 'bg-red-50 dark:bg-red-900/20'      },
                            ].map((s, i) => (
                                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                                    <div className={`size-12 rounded-xl flex items-center justify-center ${s.bg} ${s.color} shrink-0`}>
                                        <span className="material-symbols-outlined">{s.icon}</span>
                                    </div>
                                    <div>
                                        <span className={`text-2xl font-black italic block ${s.color}`}>{s.value}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* FILTERS */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
                            <div className="flex flex-wrap gap-2">
                                {/* Status */}
                                <div className="flex overflow-x-auto gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-1">
                                    {[
                                        { id: 'all', label: 'Todos' },
                                        { id: 'open', label: 'Novos' },
                                        { id: 'in_progress', label: 'Em Análise' },
                                        { id: 'resolved', label: 'Resolvidos' },
                                        { id: 'closed', label: 'Fechados' },
                                    ].map(f => (
                                        <button key={f.id} onClick={() => setFilterStatus(f.id)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterStatus === f.id ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Priority */}
                                <div className="flex overflow-x-auto gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-1">
                                    {[
                                        { id: 'all', label: 'Qualquer Prio.' },
                                        { id: 'critical', label: '🔴 Crítica' },
                                        { id: 'high', label: '🟠 Alta' },
                                        { id: 'medium', label: '🟡 Média' },
                                        { id: 'low', label: '🟢 Baixa' },
                                    ].map(f => (
                                        <button key={f.id} onClick={() => setFilterPriority(f.id)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterPriority === f.id ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Category */}
                                <div className="flex overflow-x-auto gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-1">
                                    <button onClick={() => setFilterCategory('all')}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterCategory === 'all' ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                        Todas Categorias
                                    </button>
                                    {SUPPORT_CATEGORIES.map(c => (
                                        <button key={c.id} onClick={() => setFilterCategory(c.id)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterCategory === c.id ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                            {c.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Resolution type */}
                                <div className="flex overflow-x-auto gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-1">
                                    {[
                                        { id: 'all', label: 'Todos Roteamentos' },
                                        { id: 'auto', label: '🤖 Automático' },
                                        { id: 'ai', label: '🧠 IA' },
                                        { id: 'human', label: '👤 Humano' },
                                    ].map(f => (
                                        <button key={f.id} onClick={() => setFilterResolution(f.id)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterResolution === f.id ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative w-full md:w-72 shrink-0">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                <input type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:border-primary outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                    placeholder="Buscar tickets..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* TICKET LIST */}
                        <div className="space-y-3">
                            {loading ? (
                                <div className="text-center py-20">
                                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto mb-4" />
                                    <p className="text-slate-400 font-medium">Carregando tickets...</p>
                                </div>
                            ) : filteredTickets.length > 0 ? (
                                filteredTickets.map(ticket => (
                                    <div
                                        key={ticket.id}
                                        onClick={() => setSelectedTicket(ticket)}
                                        className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-xl group ${selectedTicket?.id === ticket.id ? 'border-primary shadow-lg shadow-primary/10' : 'border-slate-200 dark:border-slate-800 hover:border-primary/40'}`}
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                                            <div className={`w-1.5 h-12 rounded-full shrink-0 hidden md:block ${ticket.status === 'open' ? 'bg-yellow-400' : ticket.status === 'in_progress' ? 'bg-blue-400' : ticket.status === 'resolved' ? 'bg-emerald-400' : 'bg-slate-300'}`} />

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{ticket.ticket_number}</span>
                                                    <StatusBadge status={ticket.status} />
                                                    <PriorityBadge priority={ticket.priority} />
                                                    {ticket.blocks_sales && (
                                                        <span className="text-[10px] font-black uppercase text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded border border-red-500/20 flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px]">block</span>
                                                            Bloqueia Atendimento
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="font-bold text-slate-800 dark:text-white text-base truncate group-hover:text-primary transition-colors">{ticket.subject}</h3>
                                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold">{categoryLabel(ticket.category)}</span>
                                                    {ticket.subcategory && (
                                                        <>
                                                            <span className="text-slate-300">›</span>
                                                            <span>{subcategoryLabel(ticket.category, ticket.subcategory)}</span>
                                                        </>
                                                    )}
                                                    <span className="text-slate-300">·</span>
                                                    <ResolutionBadge type={ticket.resolution_type} />
                                                    <span className="text-slate-300">·</span>
                                                    <span>{ticket.ticket_messages.length} msg(s)</span>
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-4 shrink-0 text-right">
                                                <div className="text-xs text-slate-400 font-medium">
                                                    <span className="block font-bold text-slate-600 dark:text-slate-300">{new Date(ticket.created_at!).toLocaleDateString('pt-BR')}</span>
                                                    <span>{new Date(ticket.created_at!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                                    <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 block mb-4">inbox</span>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Nenhum ticket encontrado</h3>
                                    <p className="text-slate-500 text-sm mt-1">Ajuste os filtros ou aguarde novos chamados.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    TAB: FAQ
                ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'faq' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-white">Base de Conhecimento</h2>
                                <p className="text-slate-500 text-sm mt-0.5">{articles.filter(a => a.is_published).length} artigos publicados · {articles.filter(a => !a.is_published).length} rascunhos</p>
                            </div>
                            <button
                                onClick={openNewArticle}
                                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-primary/25 hover:-translate-y-0.5 text-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                Novo Artigo
                            </button>
                        </div>

                        {loadingFaq ? (
                            <div className="text-center py-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto mb-4" />
                            </div>
                        ) : articles.length === 0 ? (
                            <div className="text-center py-20 border border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                                <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">menu_book</span>
                                <p className="text-slate-500">Nenhum artigo criado ainda.</p>
                                <button onClick={openNewArticle} className="mt-4 text-primary font-bold text-sm hover:underline">Criar primeiro artigo</button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {articles.map(article => (
                                    <div key={article.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-4 group hover:border-primary/40 transition-all">
                                        <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${article.is_published ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                            <span className="material-symbols-outlined text-lg">{article.is_published ? 'public' : 'draft'}</span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate group-hover:text-primary transition-colors">{article.title}</h4>
                                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                                <span>{categoryLabel(article.category)}</span>
                                                {article.subcategory && (
                                                    <><span className="text-slate-300">›</span><span>{subcategoryLabel(article.category, article.subcategory)}</span></>
                                                )}
                                                {(article.tags ?? []).length > 0 && (
                                                    <span className="text-slate-400">· {article.tags!.slice(0, 3).join(', ')}</span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${article.is_published ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                {article.is_published ? 'Publicado' : 'Rascunho'}
                                            </span>
                                            <button onClick={() => handleTogglePublish(article)} title={article.is_published ? 'Despublicar' : 'Publicar'}
                                                className="size-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-primary hover:text-primary flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-base">{article.is_published ? 'visibility_off' : 'publish'}</span>
                                            </button>
                                            <button onClick={() => openEditArticle(article)} title="Editar"
                                                className="size-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-primary hover:text-primary flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-base">edit</span>
                                            </button>
                                            <button onClick={() => handleDeleteArticle(article.id)} title="Excluir"
                                                className="size-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-500 flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-base">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>

                {/* ═══════════════════════════════════════════════════════════
                    TAB: BOT
                ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'bot' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-white">Bot de Atendimento</h2>
                                <p className="text-slate-500 text-sm mt-0.5">{rootFlows.filter(f => f.is_published).length} fluxos publicados · {rootFlows.filter(f => !f.is_published).length} rascunhos</p>
                            </div>
                            <button
                                onClick={() => openNewFlow()}
                                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-primary/25 hover:-translate-y-0.5 text-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                Novo Fluxo Raiz
                            </button>
                        </div>

                        {/* Legenda */}
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-primary/20 border border-primary/40 inline-block" /> Nó raiz (início do fluxo)</span>
                            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-emerald-100 border border-emerald-300 inline-block" /> Terminal (encerra com sucesso)</span>
                            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-orange-100 border border-orange-300 inline-block" /> Escala para humano</span>
                            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 inline-block" /> Nó intermediário</span>
                        </div>

                        {loadingFlows ? (
                            <div className="text-center py-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto mb-4" />
                            </div>
                        ) : rootFlows.length === 0 ? (
                            <div className="text-center py-20 border border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                                <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">smart_toy</span>
                                <p className="text-slate-500">Nenhum fluxo criado ainda.</p>
                                <button onClick={() => openNewFlow()} className="mt-4 text-primary font-bold text-sm hover:underline">Criar primeiro fluxo</button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {rootFlows.map(root => (
                                    <div key={root.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                                        {/* Nó raiz */}
                                        <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
                                            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-primary text-lg">account_tree</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-slate-800 dark:text-white text-sm">{root.name}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${root.is_published ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                        {root.is_published ? 'Publicado' : 'Rascunho'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {categoryLabel(root.category)}{root.subcategory && ` › ${subcategoryLabel(root.category, root.subcategory)}`}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1 italic line-clamp-1">"{root.bot_message}"</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button onClick={() => setExpandedFlow(expandedFlow === root.id ? null : root.id)}
                                                    title="Ver filhos"
                                                    className="size-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-primary hover:text-primary flex items-center justify-center transition-colors">
                                                    <span className={`material-symbols-outlined text-base transition-transform ${expandedFlow === root.id ? 'rotate-180' : ''}`}>expand_more</span>
                                                </button>
                                                <button onClick={() => openNewFlow(root.id, root.category, root.subcategory)} title="Adicionar nó filho"
                                                    className="size-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-500 flex items-center justify-center transition-colors">
                                                    <span className="material-symbols-outlined text-base">add</span>
                                                </button>
                                                <button onClick={() => handleToggleFlowPublish(root)} title={root.is_published ? 'Despublicar' : 'Publicar'}
                                                    className="size-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-primary hover:text-primary flex items-center justify-center transition-colors">
                                                    <span className="material-symbols-outlined text-base">{root.is_published ? 'visibility_off' : 'publish'}</span>
                                                </button>
                                                <button onClick={() => openEditFlow(root)} title="Editar"
                                                    className="size-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-primary hover:text-primary flex items-center justify-center transition-colors">
                                                    <span className="material-symbols-outlined text-base">edit</span>
                                                </button>
                                                <button onClick={() => handleDeleteFlow(root.id)} title="Excluir"
                                                    className="size-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-500 flex items-center justify-center transition-colors">
                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Filhos (recursivo 2 níveis) */}
                                        {expandedFlow === root.id && (
                                            <div className="p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/30">
                                                {childrenOf(root.id).length === 0 ? (
                                                    <p className="text-xs text-slate-400 text-center py-3">Nenhum nó filho. <button onClick={() => openNewFlow(root.id, root.category, root.subcategory)} className="text-primary font-bold hover:underline">Adicionar opção</button></p>
                                                ) : childrenOf(root.id).map(child => (
                                                    <div key={child.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                                        <div className="flex items-center gap-3 p-4">
                                                            <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${child.is_terminal ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : child.escalate_to_human ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                                <span className="material-symbols-outlined text-sm">{child.is_terminal ? 'check_circle' : child.escalate_to_human ? 'support_agent' : 'subdirectory_arrow_right'}</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">"{child.option_label}"</span>
                                                                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">{child.name}</span>
                                                                </div>
                                                                <p className="text-[11px] text-slate-400 mt-0.5 italic line-clamp-1">"{child.bot_message}"</p>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <button onClick={() => openNewFlow(child.id, child.category, child.subcategory)} title="Adicionar sub-nó"
                                                                    className="size-7 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-500 flex items-center justify-center transition-colors">
                                                                    <span className="material-symbols-outlined text-sm">add</span>
                                                                </button>
                                                                <button onClick={() => openEditFlow(child)} title="Editar"
                                                                    className="size-7 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-primary hover:text-primary flex items-center justify-center transition-colors">
                                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                                </button>
                                                                <button onClick={() => handleDeleteFlow(child.id)} title="Excluir"
                                                                    className="size-7 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-500 flex items-center justify-center transition-colors">
                                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {/* Sub-filhos nível 3 */}
                                                        {childrenOf(child.id).length > 0 && (
                                                            <div className="pl-10 pr-4 pb-3 space-y-1.5 border-t border-slate-50 dark:border-slate-800">
                                                                {childrenOf(child.id).map(grand => (
                                                                    <div key={grand.id} className="flex items-center gap-2 py-2 border-b border-dashed border-slate-100 dark:border-slate-800 last:border-0">
                                                                        <div className={`size-6 rounded flex items-center justify-center shrink-0 ${grand.is_terminal ? 'bg-emerald-50 text-emerald-600' : grand.escalate_to_human ? 'bg-orange-50 text-orange-500' : 'bg-slate-100 text-slate-400'}`}>
                                                                            <span className="material-symbols-outlined text-[11px]">{grand.is_terminal ? 'check_circle' : grand.escalate_to_human ? 'support_agent' : 'arrow_right'}</span>
                                                                        </div>
                                                                        <span className="text-[10px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">"{grand.option_label}"</span>
                                                                        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium flex-1 truncate">{grand.name}</span>
                                                                        <div className="flex gap-1 shrink-0">
                                                                            <button onClick={() => openEditFlow(grand)} className="size-6 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-primary hover:text-primary flex items-center justify-center transition-colors">
                                                                                <span className="material-symbols-outlined text-[11px]">edit</span>
                                                                            </button>
                                                                            <button onClick={() => handleDeleteFlow(grand.id)} className="size-6 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-500 flex items-center justify-center transition-colors">
                                                                                <span className="material-symbols-outlined text-[11px]">delete</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    TAB: SUGGESTIONS
                ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'suggestions' && (
                    <div className="space-y-6">

                        {/* Header + período */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-white">Banco de Sugestões</h2>
                                <p className="text-slate-500 text-sm mt-0.5">{suggestions.length} sugestões registradas</p>
                            </div>
                            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                {([30, 60, 90] as const).map(d => (
                                    <button key={d} onClick={() => setSuggPeriod(d)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${suggPeriod === d ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                        {d} dias
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Analytics ── */}
                        {loadingAnalytics ? (
                            <div className="flex items-center gap-2 text-slate-400 text-sm py-4 animate-pulse">
                                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                                Carregando analytics...
                            </div>
                        ) : analytics && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                {/* Card: por status */}
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                                    <div className="flex items-center gap-2 mb-5">
                                        <span className="material-symbols-outlined text-primary text-lg">donut_large</span>
                                        <h3 className="font-black text-slate-800 dark:text-white text-sm">Por Status</h3>
                                        <span className="ml-auto text-xs text-slate-400 font-medium">{analytics.total} total</span>
                                    </div>
                                    <div className="space-y-3">
                                        {(Object.entries(SUGG_STATUS_CONFIG) as [SuggestionStatus, typeof SUGG_STATUS_CONFIG[SuggestionStatus]][]).map(([key, cfg]) => {
                                            const item = analytics.by_status?.find(s => s.status === key);
                                            const val = item?.total ?? 0;
                                            const pct = barPct(val, analytics.total || 1);
                                            return (
                                                <div key={key}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={`flex items-center gap-1.5 text-xs font-bold ${cfg.text}`}>
                                                            <span className="material-symbols-outlined text-[13px]">{cfg.icon}</span>
                                                            {cfg.label}
                                                        </span>
                                                        <span className="text-xs font-black text-slate-600 dark:text-slate-300">{val}</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-500 ${key === 'implemented' ? 'bg-emerald-500' : key === 'planned' ? 'bg-violet-500' : key === 'reviewing' ? 'bg-blue-500' : key === 'rejected' ? 'bg-red-400' : 'bg-slate-300'}`}
                                                            style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Card: por subcategoria */}
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                                    <div className="flex items-center gap-2 mb-5">
                                        <span className="material-symbols-outlined text-primary text-lg">bar_chart</span>
                                        <h3 className="font-black text-slate-800 dark:text-white text-sm">Por Tipo de Sugestão</h3>
                                    </div>
                                    {(analytics.by_subcategory ?? []).length === 0 ? (
                                        <p className="text-slate-400 text-sm text-center py-6">Sem dados</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {analytics.by_subcategory.map((item, i) => {
                                                const max = analytics.by_subcategory[0]?.total ?? 1;
                                                const label = subcategoryLabel('feedback', item.subcategory) ?? item.subcategory;
                                                return (
                                                    <div key={i}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[70%]">{label}</span>
                                                            <span className="text-xs font-black text-slate-600 dark:text-slate-300">{item.total}</span>
                                                        </div>
                                                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div className="h-full bg-primary/70 rounded-full transition-all duration-500"
                                                                style={{ width: `${barPct(item.total, max)}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Card: volume diário */}
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                                    <div className="flex items-center gap-2 mb-5">
                                        <span className="material-symbols-outlined text-primary text-lg">trending_up</span>
                                        <h3 className="font-black text-slate-800 dark:text-white text-sm">Volume — últimos {suggPeriod} dias</h3>
                                        <span className="ml-auto text-xs text-slate-400 font-medium">{analytics.total_period} no período</span>
                                    </div>
                                    {(analytics.daily_volume ?? []).length === 0 ? (
                                        <p className="text-slate-400 text-sm text-center py-6">Sem dados no período</p>
                                    ) : (
                                        <div className="flex items-end gap-1 h-24">
                                            {analytics.daily_volume.map((item, i) => {
                                                const max = Math.max(...analytics.daily_volume.map(d => d.total), 1);
                                                const h = barPct(item.total, max);
                                                return (
                                                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                                                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                            {new Date(item.day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}: {item.total}
                                                        </div>
                                                        <div className="w-full bg-primary/70 rounded-sm transition-all duration-300"
                                                            style={{ height: `${Math.max(h, 4)}%` }} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Card: top tenants */}
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                                    <div className="flex items-center gap-2 mb-5">
                                        <span className="material-symbols-outlined text-primary text-lg">business</span>
                                        <h3 className="font-black text-slate-800 dark:text-white text-sm">Top Assinantes</h3>
                                    </div>
                                    {(analytics.by_tenant ?? []).length === 0 ? (
                                        <p className="text-slate-400 text-sm text-center py-6">Sem dados</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {analytics.by_tenant.map((item, i) => {
                                                const max = analytics.by_tenant[0]?.total ?? 1;
                                                return (
                                                    <div key={i} className="flex items-center gap-3">
                                                        <span className="text-[11px] font-black text-slate-400 w-4 text-right shrink-0">{i + 1}</span>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between mb-1">
                                                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{item.tenant_name}</span>
                                                                <span className="text-xs font-black text-slate-600 dark:text-slate-300 shrink-0 ml-2">{item.total}</span>
                                                            </div>
                                                            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                                <div className="h-full bg-primary/50 rounded-full" style={{ width: `${barPct(item.total, max)}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Filtros ── */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
                            {/* Status */}
                            <div className="flex gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-1 flex-wrap">
                                <button onClick={() => setSuggFilterStatus('all')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${suggFilterStatus === 'all' ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                    Todos
                                </button>
                                {(Object.entries(SUGG_STATUS_CONFIG) as [SuggestionStatus, typeof SUGG_STATUS_CONFIG[SuggestionStatus]][]).map(([key, cfg]) => (
                                    <button key={key} onClick={() => setSuggFilterStatus(key)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${suggFilterStatus === key ? `${cfg.bg} ${cfg.text} shadow` : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                        <span className="material-symbols-outlined text-[12px]">{cfg.icon}</span>
                                        {cfg.label}
                                    </button>
                                ))}
                            </div>
                            {/* Busca */}
                            <div className="relative ml-auto">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                                <input type="text" value={suggSearch} onChange={e => setSuggSearch(e.target.value)}
                                    placeholder="Buscar sugestões..."
                                    className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-primary transition-all text-slate-800 dark:text-white placeholder:text-slate-400 w-56" />
                            </div>
                        </div>

                        {/* ── Lista ── */}
                        {loadingSugg ? (
                            <div className="text-center py-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto mb-4" />
                                <p className="text-slate-400 text-sm">Carregando sugestões...</p>
                            </div>
                        ) : filteredSuggestions.length === 0 ? (
                            <div className="text-center py-20 border border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                                <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">lightbulb</span>
                                <p className="text-slate-500">Nenhuma sugestão encontrada.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredSuggestions.map(s => {
                                    const status = s.meta?.status ?? 'unread';
                                    const cfg = SUGG_STATUS_CONFIG[status];
                                    return (
                                        <div key={s.id}
                                            className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg group ${selectedSugg?.id === s.id ? 'border-primary shadow-lg shadow-primary/10' : 'border-slate-200 dark:border-slate-800 hover:border-primary/40'}`}
                                            onClick={() => { setSelectedSugg(s); setEditingNotes(s.meta?.admin_notes ?? ''); }}>
                                            <div className="flex flex-col md:flex-row md:items-start gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{s.ticket_number}</span>
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
                                                            <span className="material-symbols-outlined text-[11px]">{cfg.icon}</span>
                                                            {cfg.label}
                                                        </span>
                                                        {s.subcategory && (
                                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                                                {subcategoryLabel('feedback', s.subcategory) ?? s.subcategory}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1 group-hover:text-primary transition-colors">{s.subject}</h3>
                                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{s.description}</p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="text-right">
                                                        <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                                                            {s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : '—'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">{s.messages_count} msg(s)</span>
                                                    </div>
                                                    {/* Status dropdown inline */}
                                                    <select
                                                        value={status}
                                                        onClick={e => e.stopPropagation()}
                                                        onChange={e => { e.stopPropagation(); handleSuggStatusChange(s.id, e.target.value as SuggestionStatus); }}
                                                        className={`text-[10px] font-black uppercase tracking-widest border rounded-lg px-2 py-1.5 outline-none cursor-pointer transition-all ${cfg.bg} ${cfg.text} border-current/20`}>
                                                        {(Object.entries(SUGG_STATUS_CONFIG) as [SuggestionStatus, typeof SUGG_STATUS_CONFIG[SuggestionStatus]][]).map(([k, c]) => (
                                                            <option key={k} value={k}>{c.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            {s.meta?.admin_notes && (
                                                <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-800 flex items-start gap-2">
                                                    <span className="material-symbols-outlined text-slate-400 text-sm shrink-0 mt-0.5">sticky_note_2</span>
                                                    <p className="text-xs text-slate-500 italic line-clamp-1">{s.meta.admin_notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

            {/* ═══════════════════════════════════════════════════════════
                SUGGESTION DETAIL PANEL
            ═══════════════════════════════════════════════════════════ */}
            {selectedSugg && (
                <div className="fixed inset-0 z-[9000] flex items-center justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right-4 duration-300 overflow-hidden">

                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-start shrink-0">
                            <div>
                                <div className="flex items-center gap-3 flex-wrap mb-2">
                                    <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20">{selectedSugg.ticket_number}</span>
                                    {(() => {
                                        const st = selectedSugg.meta?.status ?? 'unread';
                                        const cfg = SUGG_STATUS_CONFIG[st];
                                        return (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
                                                <span className="material-symbols-outlined text-[11px]">{cfg.icon}</span>
                                                {cfg.label}
                                            </span>
                                        );
                                    })()}
                                    {selectedSugg.subcategory && (
                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                                            {subcategoryLabel('feedback', selectedSugg.subcategory) ?? selectedSugg.subcategory}
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-lg font-black text-slate-800 dark:text-white leading-tight">{selectedSugg.subject}</h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    {selectedSugg.created_at ? new Date(selectedSugg.created_at).toLocaleString('pt-BR') : '—'}
                                    {' · '}{selectedSugg.messages_count} mensagem(ns) no fluxo
                                </p>
                            </div>
                            <button onClick={() => setSelectedSugg(null)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 size-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ml-4">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Status bar */}
                        <div className="px-8 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 shrink-0 flex-wrap">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Status:</span>
                            {(Object.entries(SUGG_STATUS_CONFIG) as [SuggestionStatus, typeof SUGG_STATUS_CONFIG[SuggestionStatus]][]).map(([key, cfg]) => {
                                const isActive = (selectedSugg.meta?.status ?? 'unread') === key;
                                return (
                                    <button key={key} onClick={() => handleSuggStatusChange(selectedSugg.id, key)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1 ${isActive ? `${cfg.bg} ${cfg.text} border-current` : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-primary hover:text-primary'}`}>
                                        <span className="material-symbols-outlined text-[11px]">{cfg.icon}</span>
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50 dark:bg-slate-950">

                            {/* Description */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="size-9 rounded-full bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-violet-500 text-[18px]">person</span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-slate-800 dark:text-white">Sugestão do Usuário</span>
                                        <span className="block text-[11px] text-slate-400">{selectedSugg.created_at ? new Date(selectedSugg.created_at).toLocaleString('pt-BR') : '—'}</span>
                                    </div>
                                    <span className="ml-auto text-[10px] font-black uppercase bg-violet-50 dark:bg-violet-500/10 text-violet-500 px-2 py-1 rounded-full">Origem</span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedSugg.description}</p>
                                {(selectedSugg.tags ?? []).length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-1.5">
                                        {selectedSugg.tags!.map(tag => (
                                            <span key={tag} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold rounded-full">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Admin notes */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-amber-500 text-lg">sticky_note_2</span>
                                    <h4 className="font-black text-slate-800 dark:text-white text-sm">Notas Internas</h4>
                                    <span className="ml-auto text-[10px] text-slate-400">Visível apenas para admins</span>
                                </div>
                                <textarea
                                    rows={5}
                                    value={editingNotes}
                                    onChange={e => setEditingNotes(e.target.value)}
                                    placeholder="Adicione observações sobre esta sugestão, plano de ação, referências..."
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none text-slate-800 dark:text-white placeholder:text-slate-400"
                                />
                                <div className="flex justify-end mt-3">
                                    <button onClick={handleSaveNotes} disabled={savingNotes}
                                        className={`flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-primary/25 text-sm ${savingNotes ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}>
                                        {savingNotes
                                            ? (<><span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>Salvando...</>)
                                            : (<><span className="material-symbols-outlined text-sm">save</span>Salvar Nota</>)
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TICKET DETAIL PANEL
            ═══════════════════════════════════════════════════════════ */}
            {selectedTicket && (
                <div className="fixed inset-0 z-[9000] flex items-center justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right-4 duration-300 overflow-hidden">

                        {/* Panel Header */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-start shrink-0">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20">{selectedTicket.ticket_number}</span>
                                    <StatusBadge status={selectedTicket.status} />
                                    <PriorityBadge priority={selectedTicket.priority} />
                                </div>
                                <h2 className="text-lg font-black text-slate-800 dark:text-white leading-tight">{selectedTicket.subject}</h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    {categoryLabel(selectedTicket.category)}
                                    {selectedTicket.subcategory && (
                                        <> › <span className="font-semibold">{subcategoryLabel(selectedTicket.category, selectedTicket.subcategory)}</span></>
                                    )}
                                    {' · '}Aberto em {new Date(selectedTicket.created_at!).toLocaleString('pt-BR')}
                                </p>
                            </div>
                            <button onClick={() => setSelectedTicket(null)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 size-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ml-4">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Intelligence metadata strip */}
                        <div className="px-8 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4 flex-wrap bg-slate-50/30 dark:bg-slate-900/30 shrink-0">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <span className="font-black uppercase tracking-widest text-[10px]">Roteamento:</span>
                                <ResolutionBadge type={selectedTicket.resolution_type} />
                            </div>
                            {selectedTicket.confidence_score != null && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <span className="font-black uppercase tracking-widest text-[10px]">Confiança:</span>
                                    <span className={`font-bold ${selectedTicket.confidence_score >= 90 ? 'text-emerald-600' : selectedTicket.confidence_score >= 70 ? 'text-yellow-600' : 'text-red-500'}`}>
                                        {selectedTicket.confidence_score}%
                                    </span>
                                </div>
                            )}
                            {(selectedTicket.tags ?? []).length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {selectedTicket.tags!.map(tag => (
                                        <span key={tag} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold rounded-full">{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Status Changer */}
                        <div className="px-8 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 shrink-0 flex-wrap">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Status:</span>
                            {(['open', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map(s => {
                                const cfg = STATUS_CONFIG[s];
                                const isActive = selectedTicket.status === s;
                                return (
                                    <button key={s} disabled={isUpdatingStatus} onClick={() => handleUpdateStatus(selectedTicket.id, s)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${isActive ? `${cfg.bg} ${cfg.text} border-current` : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-primary hover:text-primary'}`}>
                                        {cfg.label}
                                    </button>
                                );
                            })}
                            {isUpdatingStatus && (
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                                    Atualizando...
                                </span>
                            )}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-5 bg-slate-50 dark:bg-slate-950">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="size-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-slate-500 text-[18px]">person</span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-slate-800 dark:text-white">Usuário</span>
                                        <span className="block text-[11px] text-slate-400">{new Date(selectedTicket.created_at!).toLocaleString('pt-BR')}</span>
                                    </div>
                                    <span className="ml-auto text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-full">Abertura</span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
                                {selectedTicket.blocks_sales && (
                                    <div className="mt-4 flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl border border-red-200 dark:border-red-800">
                                        <span className="material-symbols-outlined text-sm">block</span>
                                        Este chamado está bloqueando o atendimento de clientes
                                    </div>
                                )}
                            </div>

                            {selectedTicket.ticket_messages.map(msg => {
                                const isSupport = msg.sender_type === 'support';
                                const atts = msgAttachments[msg.id] ?? [];
                                return (
                                    <div key={msg.id} className={`flex gap-3 ${isSupport ? 'flex-row-reverse' : ''}`}>
                                        <div className={`size-9 rounded-full flex items-center justify-center shrink-0 ${isSupport ? 'bg-primary/20 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                            <span className="material-symbols-outlined text-[18px]">{isSupport ? 'support_agent' : 'person'}</span>
                                        </div>
                                        <div className={`max-w-[80%] ${isSupport ? 'text-right items-end' : 'items-start'} flex flex-col gap-1`}>
                                            <div className={`flex items-center gap-2 mb-1 ${isSupport ? 'flex-row-reverse' : ''}`}>
                                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{isSupport ? '🛡️ Equipe SaaS Foundation' : 'Usuário'}</span>
                                                <span className="text-[10px] text-slate-400">{new Date(msg.created_at!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className={`px-5 py-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${isSupport ? 'bg-primary text-white rounded-tr-sm shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-sm shadow-sm'}`}>
                                                {msg.message}
                                            </div>
                                            {atts.length > 0 && (
                                                <div className={isSupport ? 'self-end' : 'self-start'}>
                                                    <AttachmentList attachments={atts} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {selectedTicket.ticket_messages.length === 0 && (
                                <div className="text-center py-8 text-slate-400 text-sm">Nenhuma mensagem além da descrição inicial.</div>
                            )}
                        </div>

                        {/* Reply Box */}
                        {selectedTicket.status !== 'closed' ? (
                            <div className="px-8 py-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Responder como Equipe de Suporte</label>
                                <textarea rows={3} maxLength={4000} value={replyMsg} onChange={e => setReplyMsg(e.target.value)} disabled={isReplying}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none text-slate-800 dark:text-white placeholder:text-slate-400"
                                    placeholder="Digite sua resposta ao usuário..." />
                                <div className="flex justify-between items-center mt-3">
                                    <span className="text-xs text-slate-400">{replyMsg.length}/2000</span>
                                    <button onClick={handleReply} disabled={isReplying || !replyMsg.trim()}
                                        className={`flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-primary/30 text-sm ${isReplying || !replyMsg.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}>
                                        {isReplying ? (<><span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>Enviando...</>) : (<><span className="material-symbols-outlined text-sm">send</span>Enviar Resposta</>)}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="px-8 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-center text-slate-400 text-sm italic shrink-0">
                                <span className="material-symbols-outlined align-middle mr-1 text-lg">lock</span>Este chamado está fechado.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                PROPOSE ARTICLE MODAL (after ticket resolved)
            ═══════════════════════════════════════════════════════════ */}
            {proposeArticleTicket && (
                <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
                        <div className="px-8 pt-8 pb-6 flex flex-col items-center text-center gap-4">
                            <div className="size-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-3xl text-emerald-600">menu_book</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white">Criar artigo na KB?</h3>
                                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                    O chamado <span className="font-bold text-slate-700 dark:text-slate-300">{proposeArticleTicket.ticket_number}</span> foi resolvido.
                                    Deseja criar um artigo na Base de Conhecimento com a solução para ajudar outros usuários?
                                </p>
                            </div>
                            <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 text-left text-xs text-slate-500 space-y-1">
                                <p><span className="font-bold text-slate-700 dark:text-slate-300">Título:</span> {proposeArticleTicket.subject}</p>
                                <p><span className="font-bold text-slate-700 dark:text-slate-300">Categoria:</span> {categoryLabel(proposeArticleTicket.category)}{proposeArticleTicket.subcategory && ` › ${subcategoryLabel(proposeArticleTicket.category, proposeArticleTicket.subcategory)}`}</p>
                                {(proposeArticleTicket.tags ?? []).length > 0 && (
                                    <p><span className="font-bold text-slate-700 dark:text-slate-300">Tags:</span> {proposeArticleTicket.tags!.join(', ')}</p>
                                )}
                            </div>
                        </div>
                        <div className="px-8 pb-8 flex gap-3">
                            <button
                                onClick={() => setProposeArticleTicket(null)}
                                className="flex-1 text-slate-500 font-bold px-6 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700">
                                Agora não
                            </button>
                            <button
                                onClick={handleProposeArticle}
                                className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2 hover:-translate-y-0.5">
                                <span className="material-symbols-outlined text-sm">add</span>
                                Criar Artigo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                FAQ ARTICLE EDITOR MODAL
            ═══════════════════════════════════════════════════════════ */}
            {showFaqModal && editingArticle && (
                <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">
                                {editingArticle.id ? 'Editar Artigo' : 'Novo Artigo'}
                            </h3>
                            <button onClick={() => { setShowFaqModal(false); setEditingArticle(null); }}
                                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 size-11 rounded-xl flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Título <span className="text-red-500">*</span></label>
                                <input type="text" value={editingArticle.title ?? ''} onChange={e => setEditingArticle({ ...editingArticle, title: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-slate-800 dark:text-white"
                                    placeholder="Ex: Como recuperar minha senha" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Categoria</label>
                                    <select value={editingArticle.category ?? 'support'}
                                        onChange={e => setEditingArticle({ ...editingArticle, category: e.target.value, subcategory: null })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-slate-800 dark:text-white">
                                        {SUPPORT_CATEGORIES.map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Subcategoria</label>
                                    <select value={editingArticle.subcategory ?? ''}
                                        onChange={e => setEditingArticle({ ...editingArticle, subcategory: e.target.value || null })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-slate-800 dark:text-white">
                                        <option value="">— Todas —</option>
                                        {(getCategoryDef(editingArticle.category ?? 'support')?.subcategories ?? []).map(s => (
                                            <option key={s.id} value={s.id}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Tags <span className="text-slate-400 font-normal text-xs">(separadas por vírgula)</span></label>
                                <input type="text"
                                    value={tagsInput}
                                    onChange={e => setTagsInput(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-slate-800 dark:text-white"
                                    placeholder="senha, login, acesso, recuperar" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Conteúdo <span className="text-red-500">*</span></label>
                                <textarea rows={7} value={editingArticle.content ?? ''}
                                    onChange={e => setEditingArticle({ ...editingArticle, content: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none text-slate-800 dark:text-white"
                                    placeholder="Descreva a solução ou resposta completa..." />
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer"
                                        checked={editingArticle.is_published ?? false}
                                        onChange={e => setEditingArticle({ ...editingArticle, is_published: e.target.checked })} />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                                <span className="text-sm font-bold text-slate-800 dark:text-white">Publicar imediatamente</span>
                            </div>
                        </div>

                        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-4 rounded-b-[2rem]">
                            <button onClick={() => { setShowFaqModal(false); setEditingArticle(null); }}
                                className="text-slate-500 font-bold px-6 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors" disabled={savingArticle}>
                                Cancelar
                            </button>
                            <button onClick={handleSaveArticle} disabled={savingArticle}
                                className={`bg-primary hover:bg-primary-dark text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-primary/30 flex items-center gap-2 ${savingArticle ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}>
                                {savingArticle ? 'Salvando...' : 'Salvar Artigo'}
                                {!savingArticle && <span className="material-symbols-outlined text-sm">save</span>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                BOT NODE EDITOR MODAL
            ═══════════════════════════════════════════════════════════ */}
            {showFlowModal && editingFlow && (
                <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white">
                                    {editingFlow.id ? 'Editar Nó' : editingFlow.is_root ? 'Novo Fluxo Raiz' : 'Novo Nó Filho'}
                                </h3>
                                {!editingFlow.is_root && editingFlow.parent_id && (
                                    <p className="text-xs text-slate-400 mt-0.5">Filho de: {flows.find(f => f.id === editingFlow.parent_id)?.name ?? editingFlow.parent_id}</p>
                                )}
                            </div>
                            <button onClick={() => { setShowFlowModal(false); setEditingFlow(null); }}
                                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 size-11 rounded-xl flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-5">
                            {/* Nome interno */}
                            <div>
                                <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Nome interno <span className="text-red-500">*</span></label>
                                <input type="text" value={editingFlow.name ?? ''} onChange={e => setEditingFlow({ ...editingFlow, name: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-slate-800 dark:text-white text-sm"
                                    placeholder="Ex: Login - Senha Esquecida" />
                            </div>

                            {/* Option label (apenas filhos) */}
                            {!editingFlow.is_root && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Label do botão <span className="text-red-500">*</span> <span className="text-slate-400 font-normal text-xs">(texto que o usuário vê para escolher esta opção)</span></label>
                                    <input type="text" value={editingFlow.option_label ?? ''} onChange={e => setEditingFlow({ ...editingFlow, option_label: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-slate-800 dark:text-white text-sm"
                                        placeholder="Ex: Esqueci minha senha" />
                                </div>
                            )}

                            {/* Mensagem do bot */}
                            <div>
                                <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Mensagem do bot <span className="text-red-500">*</span></label>
                                <textarea rows={4} value={editingFlow.bot_message ?? ''} onChange={e => setEditingFlow({ ...editingFlow, bot_message: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none text-slate-800 dark:text-white text-sm"
                                    placeholder="Ex: Para recuperar sua senha, clique em 'Esqueci minha senha' na tela de login e siga as instruções no e-mail." />
                            </div>

                            {/* Categoria / Subcategoria (somente raiz) */}
                            {editingFlow.is_root && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Categoria</label>
                                        <select value={editingFlow.category ?? 'support'}
                                            onChange={e => setEditingFlow({ ...editingFlow, category: e.target.value, subcategory: null })}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-slate-800 dark:text-white text-sm">
                                            {SUPPORT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Subcategoria</label>
                                        <select value={editingFlow.subcategory ?? ''}
                                            onChange={e => setEditingFlow({ ...editingFlow, subcategory: e.target.value || null })}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-slate-800 dark:text-white text-sm">
                                            <option value="">— Qualquer —</option>
                                            {(getCategoryDef(editingFlow.category ?? 'support')?.subcategories ?? []).map(s => (
                                                <option key={s.id} value={s.id}>{s.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Tags (somente raiz) */}
                            {editingFlow.is_root && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Tags <span className="text-slate-400 font-normal text-xs">(separadas por vírgula)</span></label>
                                    <input type="text" value={flowTagsInput} onChange={e => setFlowTagsInput(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-slate-800 dark:text-white text-sm"
                                        placeholder="senha, login, acesso" />
                                </div>
                            )}

                            {/* Comportamento do nó */}
                            <div className="space-y-3 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Comportamento deste nó</p>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={editingFlow.is_terminal ?? false}
                                        onChange={e => setEditingFlow({ ...editingFlow, is_terminal: e.target.checked, escalate_to_human: e.target.checked ? false : editingFlow.escalate_to_human })}
                                        className="size-4 rounded border-slate-300 accent-primary" />
                                    <div>
                                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Terminal — encerra com sucesso</span>
                                        <p className="text-xs text-slate-400">O usuário solucionou o problema. O chat encerra.</p>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={editingFlow.escalate_to_human ?? false}
                                        onChange={e => setEditingFlow({ ...editingFlow, escalate_to_human: e.target.checked, is_terminal: e.target.checked ? false : editingFlow.is_terminal })}
                                        className="size-4 rounded border-slate-300 accent-primary" />
                                    <div>
                                        <span className="text-sm font-bold text-orange-600 dark:text-orange-400">Escalar para suporte humano</span>
                                        <p className="text-xs text-slate-400">O ticket entra na fila de atendimento humano.</p>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={editingFlow.is_published ?? false}
                                        onChange={e => setEditingFlow({ ...editingFlow, is_published: e.target.checked })}
                                        className="size-4 rounded border-slate-300 accent-primary" />
                                    <div>
                                        <span className="text-sm font-bold text-slate-800 dark:text-white">Publicar</span>
                                        <p className="text-xs text-slate-400">Disponível para o bot usar com usuários.</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-4 rounded-b-[2rem]">
                            <button onClick={() => { setShowFlowModal(false); setEditingFlow(null); }} disabled={savingFlow}
                                className="text-slate-500 font-bold px-6 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSaveFlow} disabled={savingFlow}
                                className={`bg-primary hover:bg-primary-dark text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-primary/30 flex items-center gap-2 ${savingFlow ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}>
                                {savingFlow ? 'Salvando...' : 'Salvar Nó'}
                                {!savingFlow && <span className="material-symbols-outlined text-sm">save</span>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default AdminSupport;
