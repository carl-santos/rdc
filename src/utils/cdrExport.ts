import { CdrSessionMode, MODE_LABELS } from '../types/cdr';
import { CdrSource, sourcesFromMetadata } from './cdrKnowledge';

export const ARTIFACT_TITLES: Record<CdrSessionMode, string> = {
    chat: 'Registro da conversa',
    presentation: 'Roteiro de apresentação',
    class: 'Plano de aula',
    meeting: 'Minuta de reunião',
};

export const ARTIFACT_SLUGS: Record<CdrSessionMode, string> = {
    chat: 'conversa',
    presentation: 'roteiro',
    class: 'plano-de-aula',
    meeting: 'minuta',
};

export function slugForExport(value: string): string {
    const slug = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return slug || 'rdc';
}

export function sessionExportFilename(
    representativeName: string,
    mode: CdrSessionMode,
    date = new Date(),
): string {
    const day = date.toISOString().slice(0, 10);
    return `${ARTIFACT_SLUGS[mode]}-${slugForExport(representativeName)}-${day}.md`;
}

export function collectSessionSources(messages: Array<{ metadata?: unknown }>): CdrSource[] {
    const seen = new Set<string>();
    const sources: CdrSource[] = [];
    for (const message of messages) {
        for (const source of sourcesFromMetadata(message.metadata)) {
            const key = `${source.file_name}::${source.excerpt}`;
            if (seen.has(key)) continue;
            seen.add(key);
            sources.push({ ...source, index: sources.length + 1 });
        }
    }
    return sources;
}

export function buildSessionMarkdown(input: {
    representativeName: string;
    mode: CdrSessionMode;
    messages: Array<{ role: string; content: string; metadata?: unknown }>;
    generatedAt: Date;
}): string {
    const lines = [
        `# ${ARTIFACT_TITLES[input.mode]}`,
        '',
        `- Representante: ${input.representativeName}`,
        `- Modo: ${MODE_LABELS[input.mode]}`,
        `- Gerado em: ${input.generatedAt.toLocaleString('pt-BR')}`,
        '',
        '---',
        '',
    ];

    for (const message of input.messages) {
        if (message.role !== 'user' && message.role !== 'assistant') continue;
        const who = message.role === 'user' ? 'Você' : input.representativeName;
        lines.push(`## ${who}`, '', message.content.trim(), '');
    }

    const sources = collectSessionSources(input.messages);
    if (sources.length > 0) {
        lines.push('---', '', '## Fontes autorizadas', '');
        for (const source of sources) {
            lines.push(`- **[${source.index}] ${source.file_name}**${source.excerpt ? ` — ${source.excerpt}` : ''}`);
        }
        lines.push('');
    }

    lines.push('_Artefato gerado pelo RDC a partir da base autorizada. Não substitui o material original._', '');
    return lines.join('\n');
}

export function downloadMarkdown(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
