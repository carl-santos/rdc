import { Database } from './database';

export type DigitalRepresentative = Database['public']['Tables']['digital_representatives']['Row'];
export type DigitalRepresentativeInsert = Database['public']['Tables']['digital_representatives']['Insert'];
export type CdrDocument = Database['public']['Tables']['cdr_documents']['Row'];
export type CdrConversation = Database['public']['Tables']['cdr_conversations']['Row'];
export type CdrMessage = Database['public']['Tables']['cdr_messages']['Row'];

export type CdrAutonomy = 'supervised' | 'assisted' | 'autonomous';
export type CdrSessionMode = 'chat' | 'presentation' | 'class' | 'meeting';
export type CdrDocumentStatus = 'pending' | 'ready' | 'failed';

export const AUTONOMY_LABELS: Record<CdrAutonomy, string> = {
    supervised: 'Supervisionado',
    assisted: 'Assistido',
    autonomous: 'Autônomo',
};

export const AUTONOMY_HINTS: Record<CdrAutonomy, string> = {
    supervised: 'O representante sugere respostas e aguarda a sua confirmação antes de seguir.',
    assisted: 'O representante responde com base no conhecimento e sinaliza incerteza.',
    autonomous: 'O representante responde diretamente a partir da base autorizada.',
};

export const MODE_LABELS: Record<CdrSessionMode, string> = {
    chat: 'Chat',
    presentation: 'Apresentação',
    class: 'Aula',
    meeting: 'Reunião',
};

export const MODE_HINTS: Record<CdrSessionMode, string> = {
    chat: 'Pergunte qualquer coisa com base nos documentos do representante.',
    presentation: 'Apoio a palestras: tópicos, transições e respostas objetivas à plateia.',
    class: 'Apoio educacional: explicações didáticas alinhadas ao material da aula.',
    meeting: 'Apoio a reuniões: sínteses, esclarecimentos e respostas controladas.',
};

export const MODE_ICONS: Record<CdrSessionMode, string> = {
    chat: 'chat',
    presentation: 'present_to_all',
    class: 'school',
    meeting: 'groups',
};
