import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useToast } from '../Toast';
import { useTenantGate } from '../../hooks/useTenantGate';
import { listMessages } from '../../hooks/useCdr';
import { CdrMessage, CdrSessionMode, DigitalRepresentative, MODE_HINTS, MODE_ICONS, MODE_LABELS } from '../../types/cdr';
import { sourcesFromMetadata } from '../../utils/cdrKnowledge';
import { buildSessionMarkdown, downloadMarkdown, sessionExportFilename } from '../../utils/cdrExport';
import { MODE_STARTERS, modeEmptyCopy, modePlaceholder } from './modePresets';
import CdrSources from './CdrSources';

interface ChatPanelProps {
    representative: DigitalRepresentative;
    mode: CdrSessionMode;
}

interface ChatReply {
    reply: string;
    conversation_id: string;
    needs_confirmation?: boolean;
    sources?: unknown;
}

const ChatPanel = ({ representative, mode }: ChatPanelProps) => {
    const showToast = useToast();
    const { isBlocked, message: blockedMessage } = useTenantGate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [conversationId, setConversationId] = useState<string | null>(searchParams.get('c'));
    const [messages, setMessages] = useState<CdrMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fromUrl = searchParams.get('c');
        if (fromUrl && fromUrl !== conversationId) setConversationId(fromUrl);
    }, [searchParams]);

    useEffect(() => {
        if (!conversationId) {
            setMessages([]);
            return;
        }
        listMessages(conversationId)
            .then(setMessages)
            .catch(() => showToast('Não foi possível carregar o histórico.', 'error'));
    }, [conversationId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, sending]);

    const send = async (text: string) => {
        const message = text.trim();
        if (!message || sending || isBlocked) return;

        setSending(true);
        setInput('');
        setMessages((prev) => [
            ...prev,
            {
                id: `local-${Date.now()}`,
                conversation_id: conversationId ?? '',
                tenant_id: representative.tenant_id,
                role: 'user',
                content: message,
                metadata: {},
                created_at: new Date().toISOString(),
            },
        ]);

        const { data, error } = await supabase.functions.invoke('cdr-chat', {
            body: {
                representative_id: representative.id,
                conversation_id: conversationId,
                mode,
                message,
            },
        });

        setSending(false);

        if (error) {
            const payload = data as { error?: string } | null;
            showToast(payload?.error || error.message || 'Falha ao consultar o representante.', 'error');
            return;
        }

        const payload = data as ChatReply & { error?: string };
        if (payload?.error || !payload?.reply) {
            showToast(payload?.error || 'Falha ao consultar o representante.', 'error');
            return;
        }
        if (payload.conversation_id && payload.conversation_id !== conversationId) {
            setConversationId(payload.conversation_id);
            setSearchParams({ c: payload.conversation_id }, { replace: true });
        }

        setMessages((prev) => [
            ...prev.filter((m) => !m.id.startsWith('local-')),
            {
                id: `user-${Date.now()}`,
                conversation_id: payload.conversation_id,
                tenant_id: representative.tenant_id,
                role: 'user',
                content: message,
                metadata: {},
                created_at: new Date().toISOString(),
            },
            {
                id: `assistant-${Date.now()}`,
                conversation_id: payload.conversation_id,
                tenant_id: representative.tenant_id,
                role: 'assistant',
                content: payload.reply,
                metadata: { needs_confirmation: payload.needs_confirmation ?? false, sources: payload.sources ?? [] },
                created_at: new Date().toISOString(),
            },
        ]);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        send(input);
    };

    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    const needsConfirmation = Boolean(
        lastAssistant && (lastAssistant.metadata as { needs_confirmation?: boolean })?.needs_confirmation,
    );
    const starters = MODE_STARTERS[mode];
    const useTextarea = mode !== 'chat';
    const sendDisabled = sending || isBlocked || !representative.ativo;

    const copyReply = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast('Resposta copiada.', 'success');
        } catch {
            showToast('Não foi possível copiar.', 'error');
        }
    };

    const canExport = messages.some((msg) => msg.role === 'assistant');
    const exportSession = () => {
        if (!canExport) return;
        const markdown = buildSessionMarkdown({
            representativeName: representative.nome,
            mode,
            messages,
            generatedAt: new Date(),
        });
        downloadMarkdown(sessionExportFilename(representative.nome, mode), markdown);
        showToast('Artefato baixado.', 'success');
    };

    return (
        <div className="flex flex-col min-h-[560px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <span className="material-symbols-outlined text-primary mt-0.5">{MODE_ICONS[mode]}</span>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-primary">{MODE_LABELS[mode]}</p>
                        <p className="text-sm text-slate-500 mt-1">{MODE_HINTS[mode]}</p>
                    </div>
                </div>
                <button
                    type="button"
                    disabled={!canExport}
                    onClick={exportSession}
                    className="shrink-0 text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary disabled:opacity-40"
                >
                    Exportar
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.length === 0 && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">{modeEmptyCopy(mode)}</p>
                        <div className="flex flex-wrap gap-2">
                            {starters.map((starter) => (
                                <button
                                    key={starter.label}
                                    type="button"
                                    disabled={sendDisabled}
                                    onClick={() => send(starter.prompt)}
                                    className="text-left text-sm font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary disabled:opacity-50"
                                >
                                    {starter.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                            msg.role === 'user'
                                ? 'ml-auto bg-primary text-white'
                                : mode === 'presentation'
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-slate-800 dark:text-slate-100 border border-indigo-100 dark:border-indigo-900/60'
                                    : mode === 'class'
                                        ? 'bg-amber-50 dark:bg-amber-950/30 text-slate-800 dark:text-slate-100 border border-amber-100 dark:border-amber-900/50'
                                        : mode === 'meeting'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-slate-800 dark:text-slate-100 border border-emerald-100 dark:border-emerald-900/50'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                        }`}
                    >
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        {msg.role === 'assistant' && (
                            <>
                                <CdrSources sources={sourcesFromMetadata(msg.metadata)} />
                                {mode !== 'chat' && (
                                    <button
                                        type="button"
                                        onClick={() => copyReply(msg.content)}
                                        className="mt-3 block text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-primary"
                                    >
                                        Copiar
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                ))}
                {sending && (
                    <p className="text-xs text-slate-400">
                        {mode === 'presentation'
                            ? 'Preparando o próximo bloco de fala…'
                            : mode === 'class'
                                ? 'Preparando a explicação da aula…'
                                : mode === 'meeting'
                                    ? 'Preparando a síntese da reunião…'
                                    : 'O representante está elaborando a resposta…'}
                    </p>
                )}
                <div ref={bottomRef} />
            </div>

            {isBlocked && (
                <p className="px-5 pb-2 text-sm text-amber-700">{blockedMessage}</p>
            )}

            {needsConfirmation && !sending && (
                <div className="px-5 pb-2">
                    <button
                        type="button"
                        onClick={() => send('Confirmo o uso desta resposta.')}
                        className="text-sm font-bold text-primary hover:underline"
                    >
                        Confirmar sugestão
                    </button>
                </div>
            )}

            {messages.length > 0 && (
                <div className="px-4 pb-2 flex flex-wrap gap-2">
                    {starters.map((starter) => (
                        <button
                            key={starter.label}
                            type="button"
                            disabled={sendDisabled}
                            onClick={() => send(starter.prompt)}
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                            {starter.label}
                        </button>
                    ))}
                </div>
            )}

            <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2 items-end">
                {useTextarea ? (
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                send(input);
                            }
                        }}
                        disabled={sendDisabled}
                        maxLength={4000}
                        rows={3}
                        placeholder={modePlaceholder(mode, representative.ativo)}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm resize-none"
                    />
                ) : (
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={sendDisabled}
                        maxLength={4000}
                        placeholder={modePlaceholder(mode, representative.ativo)}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm"
                    />
                )}
                <button
                    type="submit"
                    disabled={sendDisabled || !input.trim()}
                    className="bg-primary text-white px-4 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50"
                >
                    Enviar
                </button>
            </form>
        </div>
    );
};

export default ChatPanel;
