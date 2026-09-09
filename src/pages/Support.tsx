import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { useChatbot } from '../contexts/ChatbotContext';
import { AttachmentPicker, uploadAttachments, type PendingFile } from '../components/TicketAttachments';
import {
    SUPPORT_CATEGORIES,
    getCategoryDef,
    classifyTicket,
    normalizePriority,
    getFaqCache,
    setFaqCache,
    type FaqSearchResult,
} from '../utils/ticketClassifier';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DuplicateTicket {
    ticket_number: string;
    subject: string;
    status: string;
    created_at: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Support = () => {
    const { user, profile } = useAuth();
    const showToast = useToast();
    const { startChat } = useChatbot();
    const navigate = useNavigate();

    // Page state
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [ticketStep, setTicketStep] = useState(1);
    const [ticketData, setTicketData] = useState({
        category: '',
        subcategory: '',
        subject: '',
        description: '',
        urgency: 'normal',
        blocksSales: false,
    });

    // FAQ suggestion state (step 2 + step 3)
    const [suggestedArticles, setSuggestedArticles] = useState<FaqSearchResult[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
    const [votedArticles, setVotedArticles] = useState<Record<string, boolean>>({});

    // Subject-level suggestion state (step 3)
    const [subjectArticles, setSubjectArticles] = useState<FaqSearchResult[]>([]);
    const [loadingSubjectSugg, setLoadingSubjectSugg] = useState(false);
    const subjectDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Duplicate detection
    const [duplicateTicket, setDuplicateTicket] = useState<DuplicateTicket | null>(null);
    const [checkingDuplicate, setCheckingDuplicate] = useState(false);

    // Incident warning
    const [incidentWarning, setIncidentWarning] = useState(false);

    // ── Static FAQ (hardcoded, shown on main page) ────────────────────────────

    const faqs = [
        {
            question: "Como funciona o controle de acesso por perfil?",
            answer: "A plataforma separa três perfis: administrador da plataforma, equipe do assinante e cliente final. Cada perfil enxerga apenas os dados do próprio tenant, garantido por políticas de RLS no banco, não apenas por checagem no frontend."
        },
        {
            question: "Como funcionam os créditos e o limite do plano?",
            answer: "Cada plano define um limite mensal de operações. O consumo é contabilizado no banco de forma atômica, e créditos extras podem ser comprados avulsos. O limite reinicia no primeiro dia de cada mês."
        },
        {
            question: "Posso convidar minha equipe?",
            answer: "Sim. Administradores do tenant podem convidar membros por e-mail. O convidado recebe um link de aceite e entra já vinculado ao tenant, com o papel definido no convite."
        },
        {
            question: "Como são protegidos os dados dos clientes?",
            answer: "Os dados são isolados por tenant via RLS, os buckets de arquivos são privados e acessados por URL assinada, e todo acesso sensível é registrado na central de auditoria. A plataforma inclui um módulo de LGPD para exclusão, exportação e anonimização."
        },
        {
            question: "Como faço a integração com outros sistemas?",
            answer: "As Edge Functions expõem os fluxos de billing, convites e suporte. O webhook de pagamento já vem implementado, e novos endpoints podem ser adicionados seguindo o mesmo padrão de validação de segredo e log de auditoria."
        }
    ];

    const filteredFaqs = faqs.filter(f =>
        f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.answer.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Suporte oficial RDC (profissional → plataforma): número fixo da equipe RDC.
    const handleOpenWhatsApp = () => {
        const phone = '5542988021788';
        const message = "Olá! Preciso de suporte no RDC";
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleSendEmail = () => {
        window.location.href = `mailto:suporte@exemplo.com.br?subject=Suporte RDC&body=Olá,%0A%0APreciso de ajuda com:%0A%0A`;
    };

    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

    const resetModal = () => {
        setShowTicketModal(false);
        setTicketStep(1);
        setTicketData({ category: '', subcategory: '', subject: '', description: '', urgency: 'normal', blocksSales: false });
        setPendingFiles([]);
        setSuggestedArticles([]);
        setSubjectArticles([]);
        setExpandedArticle(null);
        setDuplicateTicket(null);
        setIncidentWarning(false);
    };

    // ── 3-layer FAQ search via Postgres RPC ──────────────────────────────────

    const searchFaq = async (
        category: string,
        subcategory: string,
        tags: string[],
        query: string,
        maxResults = 4,
    ): Promise<FaqSearchResult[]> => {
        // Check cache first
        const cached = getFaqCache(category, subcategory, query);
        if (cached) return cached;

        const { data, error } = await supabase.rpc('search_faq_articles', {
            p_category:    category,
            p_subcategory: subcategory || null,
            p_tags:        tags.length > 0 ? tags : null,
            p_query:       query || null,
            p_max_results: maxResults,
        });

        if (error || !data) return [];
        const results = data as FaqSearchResult[];
        setFaqCache(category, subcategory, query, results);
        return results;
    };

    // Called when user picks a subcategory (step 2)
    const fetchSubcategorySuggestions = async (categoryId: string, subcategoryId: string) => {
        setLoadingSuggestions(true);
        setSuggestedArticles([]);
        try {
            const sub = getCategoryDef(categoryId)?.subcategories.find(s => s.id === subcategoryId);
            const results = await searchFaq(categoryId, subcategoryId, sub?.tags ?? [], '');
            setSuggestedArticles(results);
        } catch {
            // non-critical
        } finally {
            setLoadingSuggestions(false);
        }
    };

    // Called on every keystroke in the subject field (step 3), debounced 600 ms
    const fetchSubjectSuggestions = (subject: string) => {
        if (subjectDebounce.current) clearTimeout(subjectDebounce.current);
        if (subject.trim().length < 4) {
            setSubjectArticles([]);
            return;
        }
        subjectDebounce.current = setTimeout(async () => {
            setLoadingSubjectSugg(true);
            try {
                const sub = getCategoryDef(ticketData.category)?.subcategories.find(s => s.id === ticketData.subcategory);
                const results = await searchFaq(ticketData.category, ticketData.subcategory, sub?.tags ?? [], subject, 3);
                // Only show articles not already shown in step 2
                const step2Ids = new Set(suggestedArticles.map(a => a.id));
                setSubjectArticles(results.filter(r => !step2Ids.has(r.id)));
            } catch {
                // non-critical
            } finally {
                setLoadingSubjectSugg(false);
            }
        }, 600);
    };

    // Article helpful/not-helpful vote
    const handleVote = async (articleId: string, helpful: boolean) => {
        if (votedArticles[articleId] !== undefined) return; // already voted
        setVotedArticles(prev => ({ ...prev, [articleId]: helpful }));
        await supabase.rpc('vote_faq_article', { p_article_id: articleId, p_helpful: helpful });
    };

    // ── Duplicate detection ───────────────────────────────────────────────────

    const checkDuplicate = async (category: string, subcategory: string) => {
        if (!user) return;
        setCheckingDuplicate(true);
        setDuplicateTicket(null);
        try {
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
            const { data } = await supabase
                .from('support_tickets')
                .select('ticket_number, subject, status, created_at')
                .eq('user_id', user.id)
                .eq('category', category)
                .eq('subcategory', subcategory)
                .not('status', 'in', '("closed")')
                .gte('created_at', since)
                .order('created_at', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                setDuplicateTicket(data[0] as DuplicateTicket);
            }
        } catch {
            // non-critical
        } finally {
            setCheckingDuplicate(false);
        }
    };

    // ── Incident detection ────────────────────────────────────────────────────

    const checkIncident = async (category: string, subcategory: string) => {
        try {
            const { data } = await supabase.rpc('detect_support_incident', {
                p_category:        category,
                p_subcategory:     subcategory,
                p_threshold:       3,
                p_window_minutes:  30,
            });
            setIncidentWarning(data === true);
        } catch {
            // non-critical
        }
    };

    // When subcategory is selected, trigger suggestions + duplicate check + incident check
    const handleSubcategorySelect = (subcategoryId: string) => {
        setTicketData(prev => ({ ...prev, subcategory: subcategoryId }));
        setExpandedArticle(null);
        fetchSubcategorySuggestions(ticketData.category, subcategoryId);
        checkDuplicate(ticketData.category, subcategoryId);
        checkIncident(ticketData.category, subcategoryId);
    };

    // ── Cleanup debounce on unmount ───────────────────────────────────────────
    useEffect(() => {
        return () => { if (subjectDebounce.current) clearTimeout(subjectDebounce.current); };
    }, []);

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleNextStep = async () => {
        if (ticketStep === 1 && !ticketData.category) {
            showToast('Selecione uma categoria.', 'info');
            return;
        }
        if (ticketStep === 2 && !ticketData.subcategory) {
            showToast('Selecione uma subcategoria.', 'info');
            return;
        }
        if (ticketStep === 3 && (ticketData.subject.length < 5 || ticketData.description.length < 20)) {
            showToast('Por favor, preencha o assunto e a descrição detalhadamente.', 'info');
            return;
        }

        if (ticketStep < 4) {
            setTicketStep(ticketStep + 1);
            return;
        }

        if (!user || !profile?.tenant_id) {
            showToast('Não foi possível identificar o usuário ou empresa. Tente novamente.', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const classified = classifyTicket(
                ticketData.category,
                ticketData.subcategory,
                ticketData.subject,
                ticketData.description,
            );

            const finalPriority = ticketData.blocksSales ? 'critical' : classified.priority;
            const userPriority   = normalizePriority(ticketData.urgency);
            const priorityRank   = ['low', 'medium', 'high', 'critical'];
            const resolvedPriority = priorityRank.indexOf(finalPriority) >= priorityRank.indexOf(userPriority)
                ? finalPriority
                : userPriority;

            const ticketNum = `T-${Math.floor(Math.random() * 90000) + 10000}`;

            const { data: ticket, error: tErr } = await supabase
                .from('support_tickets')
                .insert({
                    user_id:               user.id,
                    tenant_id:             profile.tenant_id,
                    subject:               ticketData.subject,
                    description:           ticketData.description,
                    category:              classified.category,
                    priority:              resolvedPriority,
                    status:                'open',
                    ticket_number:         ticketNum,
                    blocks_sales:          ticketData.blocksSales,
                    read:                  false,
                    unread_messages_count: 0,
                    subcategory:           classified.subcategory,
                    tags:                  classified.tags,
                    resolution_type:       classified.resolution_type,
                    confidence_score:      classified.confidence_score,
                } as any)
                .select()
                .single();

            if (tErr) throw tErr;

            // Para 'ai' a primeira mensagem (a própria pergunta) é persistida pela Edge Function
            // quando o widget a envia — não gravamos aqui para não duplicar no histórico.
            if (classified.resolution_type !== 'ai') {
                const { error: mErr } = await supabase
                    .from('ticket_messages')
                    .insert({
                        ticket_id:   ticket.id,
                        sender_type: 'user',
                        sender_id:   user.id,
                        message:     ticketData.description,
                    });

                if (mErr) throw mErr;
            }

            // Upload de anexos (não bloqueia se falhar)
            await uploadAttachments(pendingFiles, ticket.id, null, user.id);

            resetModal();
            if (classified.resolution_type === 'auto' || classified.resolution_type === 'ai') {
                startChat(ticket.id, ticketNum, classified.category, classified.subcategory, classified.resolution_type as 'auto' | 'ai', ticketData.description);
            } else {
                showToast(`Chamado ${ticketNum} aberto com sucesso! Nossa equipe entrará em contato.`, 'success');
            }
        } catch (error: any) {
            console.error('Erro ao abrir chamado:', error);
            showToast(`Erro ao abrir chamado: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Derived ───────────────────────────────────────────────────────────────

    const selectedCategory = getCategoryDef(ticketData.category);

    const STEPS = [
        { step: 1, label: 'Categoria' },
        { step: 2, label: 'Subcategoria' },
        { step: 3, label: 'Detalhes' },
        { step: 4, label: 'Impacto' },
    ];

    // ── Article suggestion block (reused in step 2 and step 3) ───────────────

    const ArticleSuggestions = ({
        articles,
        loading,
        label,
    }: {
        articles: FaqSearchResult[];
        loading: boolean;
        label: string;
    }) => {
        if (loading) return (
            <div className="flex items-center gap-2 text-sm text-slate-400 mt-4 animate-pulse">
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                Buscando artigos relacionados...
            </div>
        );
        if (articles.length === 0) return null;

        const strategyLabel: Record<string, string> = {
            exact:    'correspondência exata',
            tags:     'tags relacionadas',
            fulltext: 'busca textual',
        };

        return (
            <div className="mt-5 border border-emerald-200 dark:border-emerald-800 rounded-2xl overflow-hidden animate-in fade-in duration-300">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 px-5 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-lg">auto_awesome</span>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{label}</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {articles.map(art => (
                        <div key={art.id} className="bg-white dark:bg-slate-900">
                            <button
                                onClick={() => setExpandedArticle(expandedArticle === art.id ? null : art.id)}
                                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="material-symbols-outlined text-emerald-500 text-base shrink-0">article</span>
                                    <div className="min-w-0">
                                        <span className="font-semibold text-sm text-slate-800 dark:text-white block truncate">{art.title}</span>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-widest">via {strategyLabel[art.match_strategy] ?? art.match_strategy}</span>
                                    </div>
                                </div>
                                <span className={`material-symbols-outlined text-slate-400 text-base transition-transform shrink-0 ml-3 ${expandedArticle === art.id ? 'rotate-180' : ''}`}>expand_more</span>
                            </button>
                            {expandedArticle === art.id && (
                                <div className="px-5 pb-4 border-t border-slate-50 dark:border-slate-800">
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pt-3 pb-4">
                                        {art.content}
                                    </p>
                                    {/* Helpful feedback */}
                                    {votedArticles[art.id] === undefined ? (
                                        <div className="flex items-center gap-3 pt-1">
                                            <span className="text-xs text-slate-400 font-medium">Isso resolveu?</span>
                                            <button
                                                onClick={() => handleVote(art.id, true)}
                                                className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">thumb_up</span>
                                                Sim
                                            </button>
                                            <button
                                                onClick={() => handleVote(art.id, false)}
                                                className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">thumb_down</span>
                                                Não
                                            </button>
                                        </div>
                                    ) : (
                                        <p className={`text-xs font-bold mt-1 flex items-center gap-1 ${votedArticles[art.id] ? 'text-emerald-600' : 'text-slate-500'}`}>
                                            <span className="material-symbols-outlined text-[14px]">{votedArticles[art.id] ? 'check_circle' : 'info'}</span>
                                            {votedArticles[art.id] ? 'Que ótimo! Obrigado pelo feedback.' : 'Obrigado. Você pode continuar e abrir um chamado.'}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 px-5 py-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Se os artigos não resolveram, clique em <strong>Continuar</strong> para abrir um chamado.
                </div>
            </div>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <DashboardLayout title="Central de Suporte">
            <div className="max-w-[1200px] mx-auto space-y-16 py-8 text-left animate-in fade-in duration-500 font-outfit">

                {/* Hero / Search */}
                <section className="text-center space-y-8 pt-8">
                    <h1 className="text-5xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">
                        🔍 Central de Atendimento e Suporte
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                        Encontre respostas rápidas para suas dúvidas ou abra um chamado de suporte personalizado
                    </p>
                    <div className="relative max-w-2xl mx-auto group">
                        <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-2xl">search</span>
                        <input
                            className="w-full h-16 pl-16 pr-32 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-primary transition-all text-base placeholder:text-slate-400 outline-none shadow-xl shadow-slate-200/20 dark:shadow-none"
                            placeholder="Digite sua dúvida... Ex: Como realizar a operação?"
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-xl text-sm font-bold transition-all shadow-md">
                            Buscar
                        </button>
                    </div>
                </section>

                {/* Quick Actions */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                    <div onClick={() => { setShowTicketModal(true); setTicketStep(1); }} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 text-center cursor-pointer hover:-translate-y-2 hover:border-primary hover:shadow-2xl hover:shadow-primary/10 transition-all group">
                        <div className="size-20 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all">
                            <span className="material-symbols-outlined text-4xl">confirmation_number</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Abrir Chamado</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Precisa de ajuda personalizada? Abra um ticket e nossa equipe te ajudará.</p>
                    </div>

                    <div onClick={() => navigate('/meus-chamados')} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 text-center cursor-pointer hover:-translate-y-2 hover:border-primary hover:shadow-2xl hover:shadow-primary/10 transition-all group">
                        <div className="size-20 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all">
                            <span className="material-symbols-outlined text-4xl">forum</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Meus Chamados</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Acompanhe seus chamados abertos e veja as respostas da equipe.</p>
                    </div>

                    <div onClick={handleOpenWhatsApp} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 text-center cursor-pointer hover:-translate-y-2 hover:border-[#25D366] hover:shadow-2xl hover:shadow-[#25D366]/10 transition-all group">
                        <div className="size-20 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-[#25D366] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-[#25D366] group-hover:text-white transition-all">
                            <i className="fa-brands fa-whatsapp text-4xl"></i>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">WhatsApp</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Early Adopters têm acesso direto via WhatsApp para suporte urgente.</p>
                    </div>

                    <div onClick={handleSendEmail} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 text-center cursor-pointer hover:-translate-y-2 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 transition-all group">
                        <div className="size-20 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all">
                            <span className="material-symbols-outlined text-4xl">mail</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Email Suporte</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Prefere email? Envie sua dúvida diretamente para nossa equipe.</p>
                    </div>
                </section>

                {/* FAQ */}
                <section className="space-y-8 max-w-4xl mx-auto pt-8">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-black uppercase tracking-widest text-slate-400 mb-2">Base de Conhecimento</h2>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white font-playfair">Perguntas Frequentes</h3>
                    </div>
                    <div className="space-y-4">
                        {filteredFaqs.length > 0 ? filteredFaqs.map((faq, idx) => (
                            <details key={idx} className="group border-2 border-slate-50 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 overflow-hidden transition-all hover:border-primary/20">
                                <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors list-none font-bold text-slate-800 dark:text-white pr-6 text-base">
                                    <div className="flex items-center gap-4">
                                        <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-primary flex items-center justify-center group-open:bg-primary group-open:text-white transition-colors">
                                            <span className="material-symbols-outlined text-lg">subject</span>
                                        </div>
                                        {faq.question}
                                    </div>
                                    <span className="material-symbols-outlined text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                                </summary>
                                <div className="p-6 md:pl-20 pt-0 text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed border-t-2 border-slate-50 dark:border-slate-800/50">
                                    {faq.answer}
                                </div>
                            </details>
                        )) : (
                            <div className="text-center py-10">
                                <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">search_off</span>
                                <p className="text-slate-500">Nenhuma pergunta encontrada para sua busca.</p>
                            </div>
                        )}
                    </div>
                </section>

            </div>

            {/* ═══════════════════════════════════════════════════
                TICKET MODAL
            ═══════════════════════════════════════════════════ */}
            {showTicketModal && (
                <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">Novo Chamado</h3>
                            <button onClick={resetModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 size-11 rounded-xl flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Stepper */}
                        <div className="px-8 pt-6 pb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
                            {STEPS.map((s, idx) => (
                                <div key={s.step} className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className={`flex items-center gap-1.5 shrink-0 ${ticketStep >= s.step ? 'text-primary' : 'text-slate-400'} font-bold text-xs tracking-widest uppercase`}>
                                        <div className={`size-6 rounded-full flex items-center justify-center text-[10px] text-white shrink-0 ${ticketStep >= s.step ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                            {ticketStep > s.step ? <span className="material-symbols-outlined text-[12px]">check</span> : s.step}
                                        </div>
                                        <span className="hidden sm:inline">{s.label}</span>
                                    </div>
                                    {idx < STEPS.length - 1 && (
                                        <div className={`flex-1 h-[2px] rounded-full ${ticketStep > s.step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`} />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Body */}
                        <div className="p-8 overflow-y-auto w-full">

                            {/* ── STEP 1: Categoria ── */}
                            {ticketStep === 1 && (
                                <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                                    <div className="text-center mb-8">
                                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-playfair mb-2">Como podemos te ajudar?</h2>
                                        <p className="text-slate-500">Selecione a categoria que melhor descreve sua necessidade.</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {SUPPORT_CATEGORIES.map(cat => (
                                            <div
                                                key={cat.id}
                                                onClick={() => setTicketData({ ...ticketData, category: cat.id, subcategory: '' })}
                                                className={`p-6 border-2 rounded-2xl cursor-pointer text-center transition-all flex flex-col items-center ${ticketData.category === cat.id ? 'border-primary bg-indigo-50/50 dark:bg-indigo-500/10' : 'border-slate-100 dark:border-slate-800 hover:border-primary/50'}`}
                                            >
                                                <div className={`size-14 rounded-full flex items-center justify-center mb-4 transition-colors ${ticketData.category === cat.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                    <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                                                </div>
                                                <h3 className="font-bold text-slate-800 dark:text-white mb-1">{cat.label}</h3>
                                                <p className="text-xs text-slate-500">{cat.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── STEP 2: Subcategoria + sugestões ── */}
                            {ticketStep === 2 && selectedCategory && (
                                <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                                    <div className="text-center mb-8">
                                        <div className="inline-flex items-center gap-2 text-primary font-bold text-sm mb-3 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 rounded-full">
                                            <span className="material-symbols-outlined text-base">{selectedCategory.icon}</span>
                                            {selectedCategory.label}
                                        </div>
                                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-playfair mb-2">Qual é o assunto específico?</h2>
                                        <p className="text-slate-500 text-sm">Selecione a opção que melhor descreve o seu problema.</p>
                                    </div>

                                    {/* Incident warning */}
                                    {incidentWarning && (
                                        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-5 py-4 flex items-start gap-3 animate-in fade-in duration-300">
                                            <span className="material-symbols-outlined text-red-500 text-xl shrink-0 mt-0.5">warning</span>
                                            <div>
                                                <p className="text-sm font-bold text-red-700 dark:text-red-400">Possível instabilidade detectada</p>
                                                <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                                                    Vários usuários abriram chamados similares nos últimos 30 minutos. Nossa equipe já pode estar ciente. Você pode continuar abrindo seu chamado ou acompanhar nossas comunicações.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Duplicate warning */}
                                    {!checkingDuplicate && duplicateTicket && (
                                        <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-5 py-4 flex items-start gap-3 animate-in fade-in duration-300">
                                            <span className="material-symbols-outlined text-amber-500 text-xl shrink-0 mt-0.5">info</span>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Você já tem um chamado aberto nesta categoria</p>
                                                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                                                    <strong>{duplicateTicket.ticket_number}</strong> — {duplicateTicket.subject}
                                                    <span className="ml-2 uppercase font-black tracking-widest text-[10px] bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">{duplicateTicket.status}</span>
                                                </p>
                                                <p className="text-xs text-amber-500 mt-1">Você pode continuar e abrir um novo chamado mesmo assim.</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-2.5">
                                        {selectedCategory.subcategories.map(sub => (
                                            <button
                                                key={sub.id}
                                                onClick={() => handleSubcategorySelect(sub.id)}
                                                className={`w-full flex items-center justify-between px-5 py-4 border-2 rounded-2xl text-left transition-all ${ticketData.subcategory === sub.id ? 'border-primary bg-indigo-50/50 dark:bg-indigo-500/10' : 'border-slate-100 dark:border-slate-800 hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${ticketData.subcategory === sub.id ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                        <span className="material-symbols-outlined text-base">
                                                            {sub.priority === 'critical' ? 'priority_high' : sub.priority === 'high' ? 'error_outline' : sub.priority === 'medium' ? 'info' : 'help_outline'}
                                                        </span>
                                                    </div>
                                                    <span className={`font-semibold text-sm ${ticketData.subcategory === sub.id ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                                                        {sub.label}
                                                    </span>
                                                </div>
                                                {ticketData.subcategory === sub.id && (
                                                    <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    <ArticleSuggestions
                                        articles={suggestedArticles}
                                        loading={loadingSuggestions}
                                        label="Encontramos artigos que podem resolver isso:"
                                    />
                                </div>
                            )}

                            {/* ── STEP 3: Detalhes + sugestões por assunto ── */}
                            {ticketStep === 3 && (
                                <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-5">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Assunto <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            maxLength={200}
                                            value={ticketData.subject}
                                            onChange={(e) => {
                                                setTicketData({ ...ticketData, subject: e.target.value });
                                                fetchSubjectSuggestions(e.target.value);
                                            }}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-slate-800 dark:text-white"
                                            placeholder="Ex: Erro ao gerar preview frontal"
                                        />
                                    </div>

                                    {/* Inline subject suggestions */}
                                    <ArticleSuggestions
                                        articles={subjectArticles}
                                        loading={loadingSubjectSugg}
                                        label="Artigos relacionados ao seu assunto:"
                                    />

                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Descrição <span className="text-red-500">*</span></label>
                                        <textarea
                                            rows={5}
                                            maxLength={2000}
                                            value={ticketData.description}
                                            onChange={(e) => setTicketData({ ...ticketData, description: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none text-slate-800 dark:text-white"
                                            placeholder="Descreva detalhadamente o que aconteceu..."
                                        />
                                        <div className="text-right text-xs text-slate-400 mt-1">{ticketData.description.length}/2000</div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">
                                            Anexos <span className="text-slate-400 font-normal text-xs">(opcional)</span>
                                        </label>
                                        <AttachmentPicker files={pendingFiles} onChange={setPendingFiles} />
                                    </div>
                                </div>
                            )}

                            {/* ── STEP 4: Impacto ── */}
                            {ticketStep === 4 && (
                                <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                                    <div className="text-center mb-10">
                                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-playfair mb-8">Qual a urgência deste chamado?</h2>
                                        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex max-w-md mx-auto shadow-inner">
                                            {(['low', 'normal', 'high'] as const).map(urg => (
                                                <button
                                                    key={urg}
                                                    onClick={() => setTicketData({ ...ticketData, urgency: urg })}
                                                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${ticketData.urgency === urg ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                                >
                                                    {urg === 'low' ? 'Baixa' : urg === 'normal' ? 'Média' : 'Alta'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 p-6 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="size-12 rounded-full bg-orange-200 dark:bg-orange-900/50 text-orange-600 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined">warning</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">Este problema impede atendimentos?</h4>
                                                <p className="text-xs text-slate-500 mt-1">Ative caso não consiga gerar operações para clientes.</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={ticketData.blocksSales}
                                                onChange={(e) => setTicketData({ ...ticketData, blocksSales: e.target.checked })}
                                            />
                                            <div className="w-14 h-8 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-primary shadow-inner"></div>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 sm:px-8 py-4 sm:py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center rounded-b-[2rem]">
                            <button
                                onClick={() => setTicketStep(ticketStep > 1 ? ticketStep - 1 : 1)}
                                className={`text-slate-500 font-bold px-6 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 ${ticketStep === 1 ? 'hidden' : ''}`}
                            >
                                <span className="material-symbols-outlined text-sm">arrow_back</span> Voltar
                            </button>

                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <button onClick={resetModal} className="flex-1 sm:flex-none text-slate-500 font-bold px-6 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors" disabled={isSubmitting}>
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleNextStep}
                                    disabled={isSubmitting}
                                    className={`flex-1 sm:flex-none justify-center bg-primary hover:bg-primary-dark text-white font-bold px-6 sm:px-8 py-3 rounded-xl transition-all shadow-lg shadow-primary/30 flex items-center gap-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
                                >
                                    {isSubmitting ? 'Enviando...' : (ticketStep < 4 ? 'Continuar' : 'Enviar Chamado')}
                                    {!isSubmitting && <span className="material-symbols-outlined text-sm">{ticketStep < 4 ? 'arrow_forward' : 'send'}</span>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default Support;
