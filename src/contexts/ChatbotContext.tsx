import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Database } from '../types/database';

type ChatbotFlow = Database['public']['Tables']['chatbot_flows']['Row'];

export interface ChatMessage {
    id: string;
    sender: 'bot' | 'user';
    text: string;
    timestamp: Date;
    nodeId?: string;          // nó que gerou esta mensagem (para rastreio)
    options?: ChatOption[];   // opções apresentadas após mensagem do bot
    messageId?: string;       // ID da linha em ticket_messages (para carregar anexos)
    attachmentCount?: number; // quantos anexos foram enviados com esta mensagem
}

export interface ChatOption {
    label: string;
    nodeId: string;
}

export interface ActiveChatbot {
    ticketId: string;
    ticketNumber: string;
    category: string;
    subcategory: string | null;
    resolutionType: 'auto' | 'ai';  // 'auto' = árvore de nós; 'ai' = chat livre com IA
    initialUserMessage?: string;    // pergunta original digitada ao abrir o chamado (IA responde sem re-perguntar)
    currentNodeId: string | null;
    messages: ChatMessage[];
    isResolved: boolean;      // encerrou com sucesso
    isEscalated: boolean;     // foi escalado para humano
}

interface ChatbotContextValue {
    active: ActiveChatbot | null;
    isOpen: boolean;
    isMinimized: boolean;
    startChat: (ticketId: string, ticketNumber: string, category: string, subcategory: string | null, resolutionType?: 'auto' | 'ai', initialUserMessage?: string) => void;
    resumeChat: (ticketId: string, ticketNumber: string, category: string, subcategory: string | null, messages: ChatMessage[], resolutionType?: 'auto' | 'ai') => void;
    appendMessage: (msg: ChatMessage) => void;
    setCurrentNode: (nodeId: string | null) => void;
    markResolved: () => void;
    markEscalated: () => void;
    open: () => void;
    minimize: () => void;
    close: () => void;
    dismiss: () => void;  // fecha e limpa o chat ativo por completo
}

const ChatbotContext = createContext<ChatbotContextValue | null>(null);

export function ChatbotProvider({ children }: { children: ReactNode }) {
    const [active, setActive] = useState<ActiveChatbot | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const startChat = useCallback((
        ticketId: string,
        ticketNumber: string,
        category: string,
        subcategory: string | null,
        resolutionType: 'auto' | 'ai' = 'auto',
        initialUserMessage?: string,
    ) => {
        setActive({
            ticketId,
            ticketNumber,
            category,
            subcategory,
            resolutionType,
            initialUserMessage,
            currentNodeId: null,
            messages: [],
            isResolved: false,
            isEscalated: false,
        });
        setIsOpen(true);
        setIsMinimized(false);
    }, []);

    const resumeChat = useCallback((
        ticketId: string,
        ticketNumber: string,
        category: string,
        subcategory: string | null,
        messages: ChatMessage[],
        resolutionType: 'auto' | 'ai' = 'auto',
    ) => {
        setActive(prev => prev?.ticketId === ticketId ? prev : {
            ticketId,
            ticketNumber,
            category,
            subcategory,
            resolutionType,
            currentNodeId: null,
            messages,
            isResolved: false,
            isEscalated: false,
        });
        setIsOpen(true);
        setIsMinimized(false);
    }, []);

    const appendMessage = useCallback((msg: ChatMessage) => {
        setActive(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
    }, []);

    const setCurrentNode = useCallback((nodeId: string | null) => {
        setActive(prev => prev ? { ...prev, currentNodeId: nodeId } : prev);
    }, []);

    const markResolved = useCallback(() => {
        setActive(prev => prev ? { ...prev, isResolved: true } : prev);
    }, []);

    const markEscalated = useCallback(() => {
        setActive(prev => prev ? { ...prev, isEscalated: true } : prev);
    }, []);

    const open = useCallback(() => { setIsOpen(true); setIsMinimized(false); }, []);
    const minimize = useCallback(() => setIsMinimized(true), []);
    const close = useCallback(() => { setIsOpen(false); setIsMinimized(false); }, []);
    const dismiss = useCallback(() => { setActive(null); setIsOpen(false); setIsMinimized(false); }, []);

    return (
        <ChatbotContext.Provider value={{
            active, isOpen, isMinimized,
            startChat, resumeChat, appendMessage, setCurrentNode,
            markResolved, markEscalated,
            open, minimize, close, dismiss,
        }}>
            {children}
        </ChatbotContext.Provider>
    );
}

export function useChatbot() {
    const ctx = useContext(ChatbotContext);
    if (!ctx) throw new Error('useChatbot must be used inside ChatbotProvider');
    return ctx;
}

// Export type alias for convenience
export type { ChatbotFlow };
