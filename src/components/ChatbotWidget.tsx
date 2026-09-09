import { useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabase';
import { useChatbot, ChatMessage, ChatOption, ChatbotFlow } from '../contexts/ChatbotContext';
import { AttachmentPicker, AttachmentList, uploadAttachments, fetchAttachmentsWithSignedUrls, type PendingFile, type UploadedAttachment } from './TicketAttachments';

let msgCounter = 0;
function newId() { return `msg-${++msgCounter}-${Date.now()}`; }

function botMsg(text: string, nodeId?: string, options: ChatOption[] = []): ChatMessage {
    return { id: newId(), sender: 'bot', text, timestamp: new Date(), nodeId, options };
}
function userMsg(text: string): ChatMessage {
    return { id: newId(), sender: 'user', text, timestamp: new Date() };
}

export default function ChatbotWidget() {
    const {
        active, isOpen, isMinimized,
        appendMessage, setCurrentNode, markResolved, markEscalated,
        open, minimize, dismiss,
    } = useChatbot();

    const [loadingNode, setLoadingNode] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const [aiFiles, setAiFiles] = useState<PendingFile[]>([]);
    const [msgAttachments, setMsgAttachments] = useState<Record<string, UploadedAttachment[]>>({});
    const bottomRef = useRef<HTMLDivElement>(null);
    const aiInputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [active?.messages.length, isOpen, isMinimized]);

    // Carrega anexos para mensagens que têm messageId e attachmentCount > 0
    useEffect(() => {
        if (!active) return;
        const toFetch = active.messages.filter(
            m => m.messageId && (m.attachmentCount ?? 0) > 0 && !msgAttachments[m.messageId!]
        );
        for (const msg of toFetch) {
            const mid = msg.messageId!;
            fetchAttachmentsWithSignedUrls(active.ticketId, mid).then(atts => {
                setMsgAttachments(prev => ({ ...prev, [mid]: atts }));
            });
        }
    }, [active?.messages.length]);

    // Inicializa o chat quando não há mensagens
    useEffect(() => {
        if (!active || active.messages.length > 0 || active.isResolved || active.isEscalated) return;
        if (active.resolutionType === 'ai') {
            initAiChat();
        } else {
            loadRootNode();
        }
    }, [active?.ticketId]);

    // ── Fluxo AUTO (árvore de nós) ────────────────────────────────────────────

    const loadRootNode = async () => {
        if (!active) return;
        setLoadingNode(true);
        try {
            const { data, error } = await supabase.rpc('get_chatbot_root', {
                p_category:    active.category,
                p_subcategory: active.subcategory ?? null,
            });
            if (error || !data || data.length === 0) {
                appendMessage(botMsg(
                    'Olá! Recebemos seu chamado. Nossa equipe irá analisá-lo em breve. Enquanto isso, confira nossa base de conhecimento — pode ter a resposta que você precisa!',
                ));
                return;
            }
            const root = data[0] as ChatbotFlow;
            await presentNode(root);
        } catch {
            appendMessage(botMsg('Ocorreu um erro ao carregar o atendimento. Sua solicitação foi registrada e nossa equipe entrará em contato.'));
        } finally {
            setLoadingNode(false);
        }
    };

    const loadChildren = async (parentId: string): Promise<ChatbotFlow[]> => {
        const { data, error } = await supabase.rpc('get_chatbot_children', { p_parent_id: parentId });
        if (error || !data) return [];
        return data as ChatbotFlow[];
    };

    const presentNode = async (node: ChatbotFlow) => {
        setCurrentNode(node.id);

        if (node.is_terminal) {
            appendMessage(botMsg(node.bot_message, node.id));
            markResolved();
            await persistBotMessage(node.bot_message);
            await resolveTicket();
            return;
        }

        if (node.escalate_to_human) {
            appendMessage(botMsg(node.bot_message, node.id));
            markEscalated();
            await persistBotMessage(node.bot_message);
            await escalateTicket();
            return;
        }

        const children = await loadChildren(node.id);
        const options: ChatOption[] = children.map(c => ({
            label: c.option_label ?? c.name,
            nodeId: c.id,
        }));

        appendMessage(botMsg(node.bot_message, node.id, options));
        await persistBotMessage(node.bot_message);
    };

    const handleOption = async (option: ChatOption, optionLabel: string) => {
        if (!active || loadingNode) return;
        setLoadingNode(true);

        const um = userMsg(optionLabel);
        appendMessage(um);
        await persistUserMessage(optionLabel);

        try {
            const { data, error } = await supabase
                .from('chatbot_flows')
                .select('*')
                .eq('id', option.nodeId)
                .single();

            if (error || !data) {
                appendMessage(botMsg('Não consegui carregar essa opção. Sua solicitação foi registrada e nossa equipe entrará em contato.'));
                markEscalated();
                await escalateTicket();
                return;
            }
            await presentNode(data as ChatbotFlow);
        } catch {
            appendMessage(botMsg('Ocorreu um erro inesperado. Nossa equipe foi notificada.'));
        } finally {
            setLoadingNode(false);
        }
    };

    // ── Fluxo AI (chat livre via Edge Function) ───────────────────────────────

    const initAiChat = () => {
        const initial = active?.initialUserMessage?.trim();
        if (initial) {
            // O usuário já escreveu a dúvida ao abrir o chamado — respondemos direto, sem re-perguntar.
            appendMessage(botMsg('Olá! Sou o assistente de suporte da RDC. Já recebi a sua dúvida — deixa eu ajudar:'));
            void answerInitialQuestion(initial);
        } else {
            appendMessage(botMsg('Olá! Sou o assistente de suporte da RDC. Como posso ajudar você hoje?'));
        }
    };

    // Responde automaticamente a pergunta que o usuário já digitou ao abrir o chamado.
    // Essa pergunta é enviada à Edge Function (que a persiste em ticket_messages), por isso
    // NÃO gravamos aqui de novo — para 'ai' o Support/ClientSupport também não a grava.
    const answerInitialQuestion = async (question: string) => {
        if (!active) return;
        appendMessage(userMsg(question));
        setLoadingNode(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão inválida');

            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-support-chat`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({
                        ticket_id:       active.ticketId,
                        message:         question,
                        history:         [],
                        idempotency_key: crypto.randomUUID(),
                    }),
                }
            );

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const json = await res.json() as { reply: string; shouldEscalate: boolean };
            if (json.reply) appendMessage(botMsg(json.reply));
            if (json.shouldEscalate) markEscalated();
        } catch {
            appendMessage(botMsg('Não consegui processar sua mensagem agora. Tente novamente ou aguarde nossa equipe entrar em contato.'));
        } finally {
            setLoadingNode(false);
            aiInputRef.current?.focus();
        }
    };

    const buildAiHistory = (): { role: 'user' | 'assistant'; content: string }[] => {
        if (!active) return [];
        return active.messages
            .filter(m => m.text)
            .map(m => ({
                role:    m.sender === 'user' ? 'user' : 'assistant',
                content: m.text,
            }));
    };

    const handleAiSend = async () => {
        if (!active || (!aiInput.trim() && aiFiles.length === 0) || loadingNode) return;

        const text = aiInput.trim();
        const filesToUpload = [...aiFiles];
        setAiInput('');
        setAiFiles([]);

        const um: ReturnType<typeof userMsg> = {
            ...userMsg(text || '(anexo)'),
            attachmentCount: filesToUpload.length,
        };
        appendMessage(um);
        setLoadingNode(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão inválida');

            // Persiste mensagem do usuário para obter o ID (necessário para vincular anexos)
            const { data: msgData } = await supabase
                .from('ticket_messages')
                .insert({
                    ticket_id:   active.ticketId,
                    sender_type: 'user',
                    sender_id:   session.user.id,
                    message:     text || '',
                })
                .select('id')
                .single();

            if (filesToUpload.length > 0 && msgData?.id) {
                await uploadAttachments(filesToUpload, active.ticketId, msgData.id, session.user.id);
            }

            const history = buildAiHistory();

            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-support-chat`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({
                        ticket_id:       active.ticketId,
                        message:         text,
                        history,
                        idempotency_key: crypto.randomUUID(),
                    }),
                }
            );

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const json = await res.json() as { reply: string; shouldEscalate: boolean };

            // Transbordo com operador vem com reply vazio — não renderizar bolha em branco;
            // o markEscalated() sinaliza que um humano assumiu.
            if (json.reply) {
                appendMessage(botMsg(json.reply));
            }

            if (json.shouldEscalate) {
                markEscalated();
            }
        } catch {
            appendMessage(botMsg('Não consegui processar sua mensagem agora. Tente novamente ou aguarde nossa equipe entrar em contato.'));
        } finally {
            setLoadingNode(false);
            aiInputRef.current?.focus();
        }
    };

    const handleAiKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAiSend();
        }
    };

    // ── Persistência ──────────────────────────────────────────────────────────

    const persistBotMessage = async (text: string) => {
        if (!active) return;
        await supabase.from('ticket_messages').insert({
            ticket_id:   active.ticketId,
            sender_type: 'bot',
            sender_id:   null,
            message:     text,
        });
    };

    const persistUserMessage = async (text: string) => {
        if (!active) return;
        await supabase.from('ticket_messages').insert({
            ticket_id:   active.ticketId,
            sender_type: 'user',
            sender_id:   null,
            message:     text,
        });
    };

    const resolveTicket = async () => {
        if (!active) return;
        await supabase
            .from('support_tickets')
            .update({ status: 'resolved' })
            .eq('id', active.ticketId);
    };

    const escalateTicket = async () => {
        if (!active) return;
        await supabase
            .from('support_tickets')
            .update({ resolution_type: 'human', status: 'open' })
            .eq('id', active.ticketId);
    };

    // Encerra o atendimento por IA a pedido do usuário: confirma, marca como resolvido e persiste.
    const resolveChat = async () => {
        if (!active || active.isResolved || active.isEscalated) return;
        const closing = 'Perfeito! Fico feliz em ajudar. Estou encerrando este atendimento — se precisar de mais alguma coisa, é só abrir um novo chamado. 🙂';
        appendMessage(botMsg(closing));
        markResolved();
        await persistBotMessage(closing);
        await resolveTicket();
    };

    // Fecha o widget e garante que o ticket fique com status correto no banco
    const handleDismiss = async () => {
        if (active && !active.isResolved && !active.isEscalated) {
            await resolveTicket();
        }
        dismiss();
    };

    // ─────────────────────────────────────────────────────────────────────────

    if (!active) return null;

    const isAi = active.resolutionType === 'ai';

    // ── Widget minimizado ─────────────────────────────────────────────────────
    if (!isOpen || isMinimized) {
        return (
            <button
                onClick={open}
                className="fixed bottom-6 right-6 z-[9500] flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-2xl shadow-2xl shadow-primary/40 hover:bg-primary-dark transition-all hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-300 group"
            >
                <span className="relative">
                    <span className="material-symbols-outlined text-xl">{isAi ? 'psychology' : 'smart_toy'}</span>
                    {!active.isResolved && !active.isEscalated && (
                        <span className="absolute -top-1 -right-1 size-2.5 bg-emerald-400 rounded-full animate-pulse" />
                    )}
                </span>
                <span className="text-sm font-bold max-w-[160px] truncate">
                    {active.isResolved
                        ? 'Atendimento encerrado'
                        : active.isEscalated
                        ? 'Aguardando equipe'
                        : 'Atendimento em andamento'}
                </span>
                <span className="material-symbols-outlined text-base opacity-70">expand_less</span>
            </button>
        );
    }

    // ── Widget aberto ─────────────────────────────────────────────────────────
    const lastMsg = active.messages[active.messages.length - 1];
    const pendingOptions = !isAi && lastMsg?.sender === 'bot' && !active.isResolved && !active.isEscalated
        ? (lastMsg.options ?? [])
        : [];

    return (
        <div className="fixed bottom-6 right-6 z-[9500] flex flex-col w-[360px] max-h-[560px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[1.75rem] shadow-2xl shadow-black/20 animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-primary text-white shrink-0">
                <div className="size-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl">{isAi ? 'psychology' : 'smart_toy'}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-black text-sm leading-tight">
                        {isAi ? 'Assistente IA' : 'Atendimento Automático'}
                    </p>
                    <p className="text-[11px] text-white/70 font-medium truncate">
                        Chamado {active.ticketNumber}
                        {active.isResolved && ' · Resolvido ✓'}
                        {active.isEscalated && ' · Encaminhado para equipe'}
                    </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={minimize}
                        className="size-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                        title="Minimizar"
                    >
                        <span className="material-symbols-outlined text-base">remove</span>
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="size-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                        title="Fechar atendimento"
                    >
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                </div>
            </div>

            {/* Status banner */}
            {(active.isResolved || active.isEscalated) && (
                <div className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 shrink-0 ${active.isResolved ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'}`}>
                    <span className="material-symbols-outlined text-sm">
                        {active.isResolved ? 'check_circle' : 'support_agent'}
                    </span>
                    {active.isResolved
                        ? 'Ótimo! O problema foi resolvido.'
                        : 'Sua solicitação foi encaminhada para nossa equipe de suporte.'}
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950">
                {active.messages.length === 0 && loadingNode && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm animate-pulse">
                        <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                        Iniciando atendimento...
                    </div>
                )}

                {active.messages.map(msg => {
                    const atts = msg.messageId ? (msgAttachments[msg.messageId] ?? []) : [];
                    return (
                    <div key={msg.id} className={`flex gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                        {msg.sender === 'bot' && (
                            <div className={`size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isAi ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'bg-primary/10 text-primary'}`}>
                                <span className="material-symbols-outlined text-[14px]">{isAi ? 'psychology' : 'smart_toy'}</span>
                            </div>
                        )}
                        <div className={`max-w-[80%] ${msg.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                            <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                                msg.sender === 'bot'
                                    ? 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-sm'
                                    : 'bg-primary text-white rounded-tr-sm'
                            }`}>
                                {msg.text}
                            </div>
                            {atts.length > 0 && (
                                <div className={msg.sender === 'user' ? 'self-end' : 'self-start'}>
                                    <AttachmentList attachments={atts} compact />
                                </div>
                            )}
                            <span className="text-[10px] text-slate-400 px-1">
                                {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                    );
                })}

                {loadingNode && active.messages.length > 0 && (
                    <div className="flex gap-2 items-center">
                        <div className={`size-7 rounded-full flex items-center justify-center shrink-0 ${isAi ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'bg-primary/10 text-primary'}`}>
                            <span className="material-symbols-outlined text-[14px]">{isAi ? 'psychology' : 'smart_toy'}</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                            <span className="size-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                            <span className="size-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                            <span className="size-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Opções (modo árvore) */}
            {pendingOptions.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-2 shrink-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escolha uma opção:</p>
                    <div className="flex flex-col gap-1.5">
                        {pendingOptions.map(opt => (
                            <button
                                key={opt.nodeId}
                                onClick={() => handleOption(opt, opt.label)}
                                disabled={loadingNode}
                                className="w-full text-left px-4 py-2.5 rounded-xl border-2 border-primary/20 hover:border-primary hover:bg-primary/5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input livre (modo IA) */}
            {isAi && !active.isResolved && !active.isEscalated && (
                <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                    {/* Depois que a IA responde: pergunta se resolveu + botão de encerrar o chamado */}
                    {active.messages.some(m => m.sender === 'user') && lastMsg?.sender === 'bot' && !loadingNode && (
                        <div className="mb-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 px-3 py-2.5 flex items-center justify-between gap-2">
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                                Isso resolveu sua dúvida? Se precisar de mais ajuda, é só continuar escrevendo.
                            </p>
                            <button
                                onClick={resolveChat}
                                className="shrink-0 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                Encerrar chamado
                            </button>
                        </div>
                    )}
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={aiInputRef}
                            rows={1}
                            maxLength={4000}
                            value={aiInput}
                            onChange={e => setAiInput(e.target.value)}
                            onKeyDown={handleAiKeyDown}
                            disabled={loadingNode}
                            placeholder="Digite sua dúvida..."
                            className="flex-1 resize-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-slate-800 dark:text-white placeholder:text-slate-400 disabled:opacity-50 max-h-32"
                            style={{ scrollbarWidth: 'thin' }}
                            onInput={e => {
                                const t = e.currentTarget;
                                t.style.height = 'auto';
                                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
                            }}
                        />
                        <button
                            onClick={handleAiSend}
                            disabled={loadingNode || (!aiInput.trim() && aiFiles.length === 0)}
                            className="size-10 shrink-0 bg-primary hover:bg-primary-dark text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
                        >
                            {loadingNode
                                ? <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                                : <span className="material-symbols-outlined text-base">send</span>
                            }
                        </button>
                    </div>
                    <AttachmentPicker files={aiFiles} onChange={setAiFiles} compact />
                    <p className="text-[10px] text-slate-400 mt-1 px-1">Enter para enviar · Shift+Enter para nova linha</p>
                </div>
            )}

            {/* Footer — sempre visível */}
            {!isAi && (
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                    <button
                        onClick={handleDismiss}
                        className="w-full text-center text-sm font-bold text-slate-400 hover:text-red-500 transition-colors py-1"
                    >
                        {active.isResolved || active.isEscalated ? 'Fechar atendimento' : 'Encerrar e fechar'}
                    </button>
                </div>
            )}
            {isAi && (active.isResolved || active.isEscalated) && (
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                    <button
                        onClick={handleDismiss}
                        className="w-full text-center text-sm font-bold text-slate-400 hover:text-red-500 transition-colors py-1"
                    >
                        Fechar atendimento
                    </button>
                </div>
            )}
        </div>
    );
}
