export type CdrKnowledgeHit = {
    file_name: string;
    content: string;
    match_rank?: number;
};

export type CdrSource = {
    index: number;
    file_name: string;
    excerpt: string;
    match_rank?: number;
};

const DEFAULT_MAX_CHARS = 16_000;
const DEFAULT_EXCERPT = 220;

export function excerptFromText(text: string, maxChars = DEFAULT_EXCERPT): string {
    const compact = text.trim().replace(/\s+/g, ' ');
    if (compact.length <= maxChars) return compact;
    return `${compact.slice(0, maxChars).trimEnd()}…`;
}

export function sourcesFromHits(hits: CdrKnowledgeHit[], excerptChars = DEFAULT_EXCERPT): CdrSource[] {
    return hits.map((hit, i) => ({
        index: i + 1,
        file_name: hit.file_name,
        excerpt: excerptFromText(hit.content, excerptChars),
        match_rank: hit.match_rank,
    }));
}

export function sourcesFromMetadata(metadata: unknown): CdrSource[] {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
    const raw = (metadata as { sources?: unknown }).sources;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item, i) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        const file_name = typeof row.file_name === 'string' ? row.file_name : '';
        const excerpt = typeof row.excerpt === 'string' ? row.excerpt : '';
        if (!file_name) return [];
        const index = typeof row.index === 'number' && row.index > 0 ? row.index : i + 1;
        const match_rank = typeof row.match_rank === 'number' ? row.match_rank : undefined;
        return [{ index, file_name, excerpt, match_rank }];
    });
}

/** Junta trechos recuperados no formato usado pelo prompt do RDC. */
export function assembleRetrievedKnowledge(
    hits: CdrKnowledgeHit[],
    maxChars = DEFAULT_MAX_CHARS,
): string {
    const parts: string[] = [];
    let used = 0;

    for (let i = 0; i < hits.length; i++) {
        const hit = hits[i];
        const block = `### [${i + 1}] ${hit.file_name}\n${hit.content.trim()}`;
        if (used + block.length > maxChars) {
            const remaining = maxChars - used;
            if (remaining > 80) parts.push(block.slice(0, remaining));
            break;
        }
        parts.push(block);
        used += block.length + 2;
    }

    return parts.join('\n\n');
}
