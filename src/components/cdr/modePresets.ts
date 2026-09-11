import { CdrSessionMode, MODE_HINTS } from '../../types/cdr';

export type ModeStarter = {
    label: string;
    prompt: string;
};

export const MODE_PLACEHOLDERS: Record<CdrSessionMode, string> = {
    chat: 'Pergunte com base no conhecimento autorizado…',
    presentation: 'Peça o roteiro, o próximo tópico ou uma resposta à plateia…',
    class: 'Peça uma explicação, um exemplo ou uma pergunta para a turma…',
    meeting: 'Peça uma síntese, um esclarecimento ou a lista de pendências…',
};

export const MODE_EMPTY: Record<CdrSessionMode, string> = {
    chat: 'Comece uma conversa. O representante usará apenas os documentos extraídos e as instruções configuradas.',
    presentation: 'Use os atalhos abaixo para montar o roteiro, avançar tópicos ou responder à plateia em frases prontas para falar.',
    class: 'Use os atalhos para abrir a aula, explicar um conceito com exemplo e propor uma pergunta de verificação.',
    meeting: 'Use os atalhos para sintetizar o material, listar riscos e pendências e esclarecer um ponto sem inventar decisões.',
};

export const MODE_STARTERS: Record<CdrSessionMode, ModeStarter[]> = {
    chat: [
        { label: 'O que o material cobre?', prompt: 'Resuma o que a base autorizada cobre, em tópicos, sem inventar o que não estiver documentado.' },
        { label: 'Pontos centrais', prompt: 'Quais são os pontos centrais do material autorizado? Cite só o que estiver nos trechos.' },
        { label: 'Consolidar registro', prompt: 'Consolide esta conversa num registro final, pronto para exportar, só com o que estiver no material autorizado.' },
    ],
    presentation: [
        { label: 'Montar roteiro', prompt: 'Monte um roteiro de apresentação com tópicos numerados, tempo sugerido e uma frase de abertura para cada tópico. Só use o material autorizado.' },
        { label: 'Próximo tópico', prompt: 'Qual deve ser o próximo tópico agora? Dê a frase de abertura, 2 a 4 frases para falar e a transição.' },
        { label: 'Resposta à plateia', prompt: 'Prepare uma resposta curta, em voz alta, para uma pergunta da plateia sobre o ponto mais importante do material.' },
        { label: 'Objeções', prompt: 'Liste objeções possíveis da plateia e uma resposta de uma ou duas frases para cada uma, só com base no material.' },
        { label: 'Fechar roteiro', prompt: 'Consolide esta sessão num roteiro final numerado, pronto para apresentar e exportar. Inclua tópicos, frases para falar e transições. Só o material autorizado.' },
    ],
    class: [
        { label: 'Abrir a aula', prompt: 'Abra a aula: objetivo de aprendizagem, recapitulando só o que está no material, e o primeiro conceito a explicar.' },
        { label: 'Explicar com exemplo', prompt: 'Explique o conceito central do material em passos didáticos e termine com um exemplo concreto alinhado à base.' },
        { label: 'Pergunta para a turma', prompt: 'Proponha 3 perguntas de verificação para a turma, do mais simples ao mais analítico, cobrindo só o material autorizado.' },
        { label: 'Fechar em 5 minutos', prompt: 'Faça um fechamento de 5 minutos: o que deve ficar, um exemplo-resumo e uma pergunta final.' },
        { label: 'Consolidar plano', prompt: 'Consolide esta sessão num plano de aula final, pronto para exportar: objetivo, explicação, exemplo e pergunta de verificação. Só o material autorizado.' },
    ],
    meeting: [
        { label: 'Síntese de abertura', prompt: 'Sintetize os pontos do material para abrir a reunião em no máximo 8 tópicos. Não invente pauta que não esteja documentada.' },
        { label: 'Riscos e pendências', prompt: 'Extraia riscos, pendências e pontos em aberto que estejam no material. Separe o que está documentado do que não está.' },
        { label: 'Esclarecer um ponto', prompt: 'Esclareça o ponto mais crítico do material em linguagem controlada, pronta para usar na reunião.' },
        { label: 'Minuta objetiva', prompt: 'Monte uma minuta objetiva do que o material autoriza registrar: contexto, pontos, o que não decidir ainda.' },
        { label: 'Consolidar minuta', prompt: 'Consolide esta sessão numa minuta final, pronta para exportar: síntese, riscos, pendências e o que não está documentado. Não invente decisões.' },
    ],
};

export function modePlaceholder(mode: CdrSessionMode, ativo: boolean): string {
    if (!ativo) return 'Representante inativo';
    return MODE_PLACEHOLDERS[mode];
}

export function modeEmptyCopy(mode: CdrSessionMode): string {
    return MODE_EMPTY[mode] || MODE_HINTS[mode];
}
