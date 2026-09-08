import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ClientLayout from '../../layouts/ClientLayout';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { useChatbot } from '../../contexts/ChatbotContext';
import { AttachmentPicker, uploadAttachments, type PendingFile } from '../../components/TicketAttachments';
import {
    SUPPORT_CATEGORIES,
    getCategoryDef,
    classifyTicket,
    getFaqCache,
    setFaqCache,
    type FaqSearchResult,
} from '../../utils/ticketClassifier';

const ClientSupport = () => {
    const { user, profile, tenant } = useAuth();
    const showToast = useToast();
    const { startChat } = useChatbot();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [ticketStep, setTicketStep] = useState(1);
    const [ticketData, setTicketData] = useState({
        category: '',
        subcategory: '',
        subject: '',
        description: '',
    });

    // FAQ suggestions
    const [suggestedArticles, setSuggestedArticles] = useState<FaqSearchResult[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [subjectArticles, setSubjectArticles] = useState<FaqSearchResult[]>([]);
    const [loadingSubjectSugg, setLoadingSubjectSugg] = useState(false);
    const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
    const [votedArticles, setVotedArticles] = useState<Record<string, boolean>>({});
    const subjectDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => { if (subjectDebounce.current) clearTimeout(subjectDebounce.current); };
    }, []);

    const faqs = [
        {
            question: 'Como funciona a operação visual?',
            answer: 'A operação visual usa inteligência artificial para projetar como seu corpo pode evoluir ao seguir o protocolo definido pelo seu profissional. A imagem gerada é uma estimativa visual baseada nas suas metas de peso e composição corporal.'
        },
        {
            question: 'Posso alterar meu e-mail de acesso?',
            answer: 'O e-mail de acesso é definido pelo seu profissional no momento do convite. Para alterá-lo, entre em contato com seu profissional ou abra um chamado de suporte.'
        },
        {
            question: 'Minhas imagens e dados são seguros?',
            answer: 'Sim. Todos os seus dados e imagens são armazenados com criptografia e protegidos conforme a LGPD (Lei Geral de Proteção de Dados). Acesse a seção LGPD no menu para mais informações ou para solicitar seus dados.'
        },
        {
            question: 'Como posso ver meu histórico de operações?',
            answer: 'Acesse a seção "Relatórios" no menu lateral. Lá você encontrará todas as operações realizadas pelo seu profissional, com imagens antes/depois e as metas definidas.'
        },
        {
            question: 'O que faço se minha senha não funcionar?',
            answer: 'Acesse a página de login e clique em "Esqueci minha senha". Um link de redefinição será enviado para o seu e-mail cadastrado.'
        },
    ];

    const filteredFaqs = faqs.filter(f =>
        f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.answer.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleOpenWhatsApp = () => {
        const phone = (tenant as any)?.whatsapp_atendimento?.replace(/\D/g, '') || '5542998244794';
        const message = 'Olá! Preciso de suporte no SaaS Foundation (Portal do Cliente)';
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleSendEmail = () => {
        window.location.href = `mailto:suporte@exemplo.com.br?subject=Suporte SaaS Foundation - Portal do Cliente&body=Olá,%0A%0APreciso de ajuda com:%0A%0A`;
    };

    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

    const resetModal = () => {
        setShowTicketModal(false);
        setTicketStep(1);
        setTicketData({ category: '', subcategory: '', subject: '', description: '' });
        setSuggestedArticles([]);
        setSubjectArticles([]);
        setExpandedArticle(null);
        setPendingFiles([]);
    };

    const searchFaq = async (
        category: string,
        subcategory: string,
        tags: string[],
        query: string,
        maxResults = 3,
    ): Promise<FaqSearchResult[]> => {
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

    const fetchSubcategorySuggestions = async (categoryId: string, subcategoryId: string) => {
        setLoadingSuggestions(true);
        setSuggestedArticles([]);
        try {
            const sub = getCategoryDef(categoryId)?.subcategories.find(s => s.id === subcategoryId);
            const results = await searchFaq(categoryId, subcategoryId, sub?.tags ?? [], '');
            setSuggestedArticles(results);
        } catch { /* non-critical */ }
        finally { setLoadingSuggestions(false); }
    };

    const fetchSubjectSuggestions = (subject: string) => {
        if (subjectDebounce.current) clearTimeout(subjectDebounce.current);
        if (subject.trim().length < 4) { setSubjectArticles([]); return; }
        subjectDebounce.current = setTimeout(async () => {
            setLoadingSubjectSugg(true);
            try {
                const sub = getCategoryDef(ticketData.category)?.subcategories.find(s => s.id === ticketData.subcategory);
                const results = await searchFaq(ticketData.category, ticketData.subcategory, sub?.tags ?? [], subject, 3);
                const step2Ids = new Set(suggestedArticles.map(a => a.id));
                setSubjectArticles(results.filter(r => !step2Ids.has(r.id)));
            } catch { /* non-critical */ }
            finally { setLoadingSubjectSugg(false); }
        }, 600);
    };

    const handleVote = async (articleId: string, helpful: boolean) => {
        if (votedArticles[articleId] !== undefined) return;
        setVotedArticles(prev => ({ ...prev, [articleId]: helpful }));
        await supabase.rpc('vote_faq_article', { p_article_id: articleId, p_helpful: helpful });
    };

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

        if (ticketStep < 3) {
            setTicketStep(ticketStep + 1);
            return;
        }

        if (!user) {
            showToast('Não foi possível identificar o usuário. Tente novamente.', 'error');
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

            const ticketNum = `T-${Math.floor(Math.random() * 90000) + 10000}`;
            const tenantId = (profile as any)?.tenant_id || null;

            const { data: ticket, error: tErr } = await supabase
                .from('support_tickets')
                .insert({
                    user_id:          user.id,
                    tenant_id:        tenantId,
                    subject:          ticketData.subject,
                    description:      ticketData.description,
                    category:         classified.category,
                    priority:         classified.priority,
                    status:           'open',
                    ticket_number:    ticketNum,
                    blocks_sales:     false,
                    read:             false,
                    unread_messages_count: 0,
                    subcategory:      classified.subcategory,
                    tags:             classified.tags,
                    resolution_type:  classified.resolution_type,
                    confidence_score: classified.confidence_score,
                } as any)
                .select()
                .single();

            if (tErr) throw tErr;

            // Para 'ai' a primeira mensagem (a própria pergunta) é persistida pela Edge Function
            // quando o widget a envia — não gravamos aqui para não duplicar no histórico.
            if (classified.resolution_type !== 'ai') {
                await supabase.from('ticket_messages').insert({
                    ticket_id:   (ticket as any).id,
                    sender_type: 'user',
                    sender_id:   user.id,
                    message:     ticketData.description,
                } as any);
            }

            await uploadAttachments(pendingFiles, (ticket as any).id, null, user.id);

            resetModal();
            if (classified.resolution_type === 'auto' || classified.resolution_type === 'ai') {
                startChat(ticket.id, ticketNum, classified.category, classified.subcategory, classified.resolution_type as 'auto' | 'ai', ticketData.description);
            } else {
                showToast(`Chamado ${ticketNum} aberto com sucesso! Nossa equipe entrará em contato.`, 'success');
            }
        } catch (error: any) {
            showToast(`Erro ao abrir chamado: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedCategory = getCategoryDef(ticketData.category);

    return (
        <ClientLayout title="Ajuda e Suporte">
            <div className="space-y-10">
                {/* Hero */}
                <div className="text-center space-y-4 pt-4">
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">Como podemos ajudar?</h2>
                    <p className="text-slate-500 text-base max-w-xl mx-auto">
                        Encontre respostas para suas dúvidas ou entre em contato com nossa equipe.
                    </p>
                    <div className="relative max-w-xl mx-auto">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary outline-none transition-all text-sm placeholder:text-slate-400"
                            placeholder="Buscar dúvidas..."
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                        onClick={() => { setShowTicketModal(true); setTicketStep(1); }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center hover:border-primary hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all group"
                    >
                        <div className="size-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all">
                            <span className="material-symbols-outlined text-3xl">confirmation_number</span>
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white mb-1">Abrir Chamado</h3>
                        <p className="text-slate-500 text-xs">Precisa de ajuda personalizada? Abra um ticket.</p>
                    </button>

                    <button
                        onClick={() => navigate('/cliente/chamados')}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center hover:border-primary hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all group"
                    >
                        <div className="size-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all">
                            <span className="material-symbols-outlined text-3xl">forum</span>
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white mb-1">Meus Chamados</h3>
                        <p className="text-slate-500 text-xs">Acompanhe seus chamados e respostas.</p>
                    </button>

                    <button
                        onClick={handleOpenWhatsApp}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center hover:border-[#25D366] hover:shadow-xl hover:shadow-[#25D366]/10 hover:-translate-y-1 transition-all group"
                    >
                        <div className="size-14 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-[#25D366] flex items-center justify-center mb-4 group-hover:bg-[#25D366] group-hover:text-white transition-all">
                            <i className="fa-brands fa-whatsapp text-3xl"></i>
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white mb-1">WhatsApp</h3>
                        <p className="text-slate-500 text-xs">Suporte direto via WhatsApp.</p>
                    </button>

                    <button
                        onClick={handleSendEmail}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all group"
                    >
                        <div className="size-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4 group-hover:bg-blue-500 group-hover:text-white transition-all">
                            <span className="material-symbols-outlined text-3xl">mail</span>
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white mb-1">E-mail</h3>
                        <p className="text-slate-500 text-xs">Envie sua dúvida por e-mail.</p>
                    </button>
                </div>

                {/* FAQ */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Perguntas Frequentes</h3>
                    {filteredFaqs.length > 0 ? filteredFaqs.map((faq, idx) => (
                        <details key={idx} className="group bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-primary/20 transition-all">
                            <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors list-none font-bold text-slate-800 dark:text-white text-sm">
                                <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-primary flex items-center justify-center group-open:bg-primary group-open:text-white transition-colors flex-shrink-0">
                                        <span className="material-symbols-outlined text-base">subject</span>
                                    </div>
                                    {faq.question}
                                </div>
                                <span className="material-symbols-outlined text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-3">expand_more</span>
                            </summary>
                            <div className="px-5 pb-5 pt-0 text-slate-500 dark:text-slate-400 text-sm leading-relaxed border-t border-slate-50 dark:border-slate-800/50 pl-16">
                                {faq.answer}
                            </div>
                        </details>
                    )) : (
                        <div className="text-center py-10">
                            <span className="material-symbols-outlined text-5xl text-slate-300 mb-3 block">search_off</span>
                            <p className="text-slate-500 text-sm">Nenhuma pergunta encontrada.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Ticket Modal */}
            {showTicketModal && (
                <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white">Novo Chamado</h3>
                            <button onClick={resetModal} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 size-9 rounded-xl flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>

                        {/* Mini stepper */}
                        <div className="px-6 pt-4 pb-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800">
                            {[
                                { step: 1, label: 'Categoria' },
                                { step: 2, label: 'Subcategoria' },
                                { step: 3, label: 'Detalhes' },
                            ].map((s, idx) => (
                                <div key={s.step} className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className={`flex items-center gap-1.5 shrink-0 font-bold text-xs tracking-widest uppercase ${ticketStep >= s.step ? 'text-primary' : 'text-slate-400'}`}>
                                        <div className={`size-5 rounded-full flex items-center justify-center text-[10px] text-white shrink-0 ${ticketStep >= s.step ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                            {ticketStep > s.step ? <span className="material-symbols-outlined text-[10px]">check</span> : s.step}
                                        </div>
                                        <span className="hidden sm:inline">{s.label}</span>
                                    </div>
                                    {idx < 2 && (
                                        <div className={`flex-1 h-[2px] rounded-full ${ticketStep > s.step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`} />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">

                            {/* Step 1: Category */}
                            {ticketStep === 1 && (
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    <p className="text-slate-500 text-sm mb-4">Selecione a categoria que melhor descreve sua necessidade.</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {SUPPORT_CATEGORIES.map(cat => (
                                            <div
                                                key={cat.id}
                                                onClick={() => setTicketData({ ...ticketData, category: cat.id, subcategory: '' })}
                                                className={`p-4 border-2 rounded-2xl cursor-pointer text-center transition-all ${ticketData.category === cat.id ? 'border-primary bg-primary/5' : 'border-slate-100 dark:border-slate-800 hover:border-primary/50'}`}
                                            >
                                                <div className={`size-12 rounded-full flex items-center justify-center mb-3 mx-auto transition-colors ${ticketData.category === cat.id ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                    <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-0.5">{cat.label}</h4>
                                                <p className="text-xs text-slate-400">{cat.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Subcategory */}
                            {ticketStep === 2 && selectedCategory && (
                                <div className="space-y-2 animate-in fade-in duration-200">
                                    <div className="inline-flex items-center gap-2 text-primary font-bold text-xs mb-3 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">
                                        <span className="material-symbols-outlined text-sm">{selectedCategory.icon}</span>
                                        {selectedCategory.label}
                                    </div>
                                    <p className="text-slate-500 text-sm mb-3">Selecione a opção que melhor descreve o problema.</p>
                                    {selectedCategory.subcategories.map(sub => (
                                        <button
                                            key={sub.id}
                                            onClick={() => {
                                                setTicketData({ ...ticketData, subcategory: sub.id });
                                                setExpandedArticle(null);
                                                fetchSubcategorySuggestions(ticketData.category, sub.id);
                                            }}
                                            className={`w-full flex items-center justify-between px-4 py-3.5 border-2 rounded-xl text-left transition-all ${ticketData.subcategory === sub.id ? 'border-primary bg-primary/5' : 'border-slate-100 dark:border-slate-800 hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                        >
                                            <span className={`font-semibold text-sm ${ticketData.subcategory === sub.id ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {sub.label}
                                            </span>
                                            {ticketData.subcategory === sub.id && (
                                                <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                                            )}
                                        </button>
                                    ))}

                                {/* Step 2 article suggestions */}
                                {loadingSuggestions && (
                                    <div className="flex items-center gap-2 text-sm text-slate-400 mt-4 animate-pulse">
                                        <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                                        Buscando artigos relacionados...
                                    </div>
                                )}
                                {!loadingSuggestions && suggestedArticles.length > 0 && (
                                    <div className="mt-4 border border-emerald-200 dark:border-emerald-800 rounded-2xl overflow-hidden animate-in fade-in duration-300">
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-emerald-600 text-base">auto_awesome</span>
                                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Artigos que podem ajudar:</p>
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {suggestedArticles.map(art => (
                                                <div key={art.id} className="bg-white dark:bg-slate-900">
                                                    <button onClick={() => setExpandedArticle(expandedArticle === art.id ? null : art.id)}
                                                        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-emerald-500 text-sm">article</span>
                                                            <span className="font-semibold text-sm text-slate-800 dark:text-white">{art.title}</span>
                                                        </div>
                                                        <span className={`material-symbols-outlined text-slate-400 text-sm transition-transform ${expandedArticle === art.id ? 'rotate-180' : ''}`}>expand_more</span>
                                                    </button>
                                                    {expandedArticle === art.id && (
                                                        <div className="px-4 pb-4 border-t border-slate-50 dark:border-slate-800">
                                                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pt-3 pb-3">{art.content}</p>
                                                            {votedArticles[art.id] === undefined ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-slate-400">Resolveu?</span>
                                                                    <button onClick={() => handleVote(art.id, true)} className="text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center gap-1">
                                                                        <span className="material-symbols-outlined text-[13px]">thumb_up</span>Sim
                                                                    </button>
                                                                    <button onClick={() => handleVote(art.id, false)} className="text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1">
                                                                        <span className="material-symbols-outlined text-[13px]">thumb_down</span>Não
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <p className={`text-xs font-bold flex items-center gap-1 ${votedArticles[art.id] ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                                    <span className="material-symbols-outlined text-[13px]">{votedArticles[art.id] ? 'check_circle' : 'info'}</span>
                                                                    {votedArticles[art.id] ? 'Ótimo! Obrigado.' : 'Continue para abrir um chamado.'}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                            Não resolveu? Clique em <strong>Continuar</strong> para abrir um chamado.
                                        </div>
                                    </div>
                                )}
                                </div>
                            )}

                            {/* Step 3: Details */}
                            {ticketStep === 3 && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Assunto *</label>
                                        <input
                                            type="text"
                                            maxLength={200}
                                            value={ticketData.subject}
                                            onChange={(e) => {
                                                setTicketData({ ...ticketData, subject: e.target.value });
                                                fetchSubjectSuggestions(e.target.value);
                                            }}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-slate-800 dark:text-white text-sm"
                                            placeholder="Descreva brevemente o problema"
                                        />
                                    </div>

                                    {/* Subject-level suggestions */}
                                    {loadingSubjectSugg && (
                                        <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse">
                                            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                            Buscando artigos...
                                        </div>
                                    )}
                                    {!loadingSubjectSugg && subjectArticles.length > 0 && (
                                        <div className="border border-emerald-200 dark:border-emerald-800 rounded-xl overflow-hidden animate-in fade-in duration-300">
                                            <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-emerald-600 text-sm">auto_awesome</span>
                                                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Artigos relacionados:</p>
                                            </div>
                                            {subjectArticles.map(art => (
                                                <div key={art.id} className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                                                    <button onClick={() => setExpandedArticle(expandedArticle === art.id ? null : art.id)}
                                                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <span className="font-medium text-xs text-slate-800 dark:text-white">{art.title}</span>
                                                        <span className={`material-symbols-outlined text-slate-400 text-sm transition-transform ${expandedArticle === art.id ? 'rotate-180' : ''}`}>expand_more</span>
                                                    </button>
                                                    {expandedArticle === art.id && (
                                                        <div className="px-4 pb-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap border-t border-slate-50 dark:border-slate-800 pt-2">
                                                            {art.content}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Descrição *</label>
                                        <textarea
                                            rows={5}
                                            maxLength={2000}
                                            value={ticketData.description}
                                            onChange={(e) => setTicketData({ ...ticketData, description: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all resize-none text-slate-800 dark:text-white text-sm"
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
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <button
                                onClick={() => ticketStep > 1 ? setTicketStep(ticketStep - 1) : resetModal()}
                                className="text-slate-500 font-bold px-5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-sm"
                            >
                                <span className="material-symbols-outlined text-base">arrow_back</span>
                                {ticketStep > 1 ? 'Voltar' : 'Cancelar'}
                            </button>
                            <button
                                onClick={handleNextStep}
                                disabled={isSubmitting}
                                className="bg-primary text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-primary/25 hover:brightness-110 transition-all disabled:opacity-60 flex items-center gap-2 text-sm"
                            >
                                {isSubmitting ? 'Enviando...' : (ticketStep < 3 ? 'Continuar' : 'Enviar Chamado')}
                                {!isSubmitting && <span className="material-symbols-outlined text-base">{ticketStep < 3 ? 'arrow_forward' : 'send'}</span>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ClientLayout>
    );
};

export default ClientSupport;
