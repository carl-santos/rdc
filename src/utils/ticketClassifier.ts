// Ticket intelligence layer — subcategory map, auto-classifier and priority router.
// All logic is deterministic and runs client-side.
// Future: replace classifyTicket() with an embeddings/LLM call without changing callers.
//
// FAQ search uses the Postgres RPC search_faq_articles which implements 3 strategies:
//   A) exact category+subcategory match
//   B) tag overlap (&&)
//   C) Portuguese full-text search (tsvector/tsquery)
// Results are cascaded: A fills first, B fills gaps, C fills remaining gaps.

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type ResolutionType = 'auto' | 'ai' | 'human';

export interface SubcategoryDef {
  id: string;
  label: string;
  tags: string[];
  priority: TicketPriority;
  resolution: ResolutionType;
}

export interface CategoryDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
  subcategories: SubcategoryDef[];
}

export interface ClassifiedTicket {
  category: string;
  subcategory: string;
  subject: string;
  message: string;
  tags: string[];
  priority: TicketPriority;
  resolution_type: ResolutionType;
  confidence_score: number;
}

// ─── Category / Subcategory definitions ──────────────────────────────────────

export const SUPPORT_CATEGORIES: CategoryDef[] = [
  {
    id: 'support',
    label: 'Dúvidas Técnicas',
    icon: 'settings',
    desc: 'Configurações e erros',
    subcategories: [
      { id: 'login',      label: 'Login e acesso',          tags: ['login', 'senha', 'acesso', 'autenticação'],              priority: 'medium', resolution: 'auto'  },
      { id: 'upload',     label: 'Upload de imagem',         tags: ['upload', 'imagem', 'foto', 'arquivo'],                   priority: 'medium', resolution: 'ai'    },
      { id: 'lentidao',   label: 'Lentidão',                 tags: ['lento', 'lentidão', 'carregando', 'performance'],        priority: 'low',    resolution: 'human' },
      { id: 'erro_sim',   label: 'Erro ao gerar operação',  tags: ['erro', 'operação', 'geração', 'falha'],                  priority: 'high',   resolution: 'human' },
      { id: 'travando',   label: 'Aplicação travando',       tags: ['trava', 'travando', 'crash', 'parar'],                   priority: 'high',   resolution: 'human' },
      { id: 'mobile',     label: 'Problemas mobile',         tags: ['celular', 'mobile', 'app', 'smartphone'],                priority: 'medium', resolution: 'ai'    },
      { id: 'pagamento',  label: 'Problemas de pagamento',   tags: ['pagamento', 'cobrança', 'cartão', 'pix', 'boleto'],      priority: 'high',   resolution: 'human' },
    ],
  },
  {
    id: 'operacoes',
    label: 'Operações',
    icon: 'body_system',
    desc: 'Protocolos e resultados',
    subcategories: [
      { id: 'resultado',    label: 'Resultado inesperado',    tags: ['resultado', 'diferente', 'errado', 'inesperado'],         priority: 'medium', resolution: 'ai'    },
      { id: 'realismo',     label: 'Operação pouco realista',tags: ['irreal', 'realismo', 'artificial', 'estranho'],           priority: 'low',    resolution: 'ai'    },
      { id: 'anatomia',     label: 'Erro anatômico',          tags: ['anatomia', 'corpo', 'proporção', 'distorção'],            priority: 'medium', resolution: 'human' },
      { id: 'posicao',      label: 'Problema de posicionamento', tags: ['posição', 'alinhamento', 'posicionamento'],            priority: 'medium', resolution: 'ai'    },
      { id: 'qualidade',    label: 'Qualidade da imagem',     tags: ['qualidade', 'resolução', 'pixelado', 'desfocado'],        priority: 'low',    resolution: 'ai'    },
      { id: 'parametros',   label: 'Ajuste de parâmetros',    tags: ['parâmetros', 'configuração', 'ajuste', 'calibração'],     priority: 'low',    resolution: 'auto'  },
      { id: 'manual',       label: 'Solicitação manual',      tags: ['manual', 'solicitação', 'pedido', 'personalizado'],       priority: 'medium', resolution: 'human' },
    ],
  },
  {
    id: 'conta',
    label: 'Minha Conta',
    icon: 'manage_accounts',
    desc: 'Acesso e dados',
    subcategories: [
      { id: 'email',        label: 'Alterar e-mail',          tags: ['email', 'e-mail', 'alterar', 'mudar'],                   priority: 'medium', resolution: 'human' },
      { id: 'assinatura',   label: 'Assinatura',              tags: ['assinatura', 'plano', 'upgrade', 'downgrade'],            priority: 'high',   resolution: 'human' },
      { id: 'cancelamento', label: 'Cancelamento',            tags: ['cancelar', 'cancelamento', 'encerrar', 'terminar'],       priority: 'high',   resolution: 'human' },
      { id: 'reembolso',    label: 'Reembolso',               tags: ['reembolso', 'estorno', 'devolver', 'ressarcimento'],      priority: 'critical', resolution: 'human'},
      { id: 'lgpd',         label: 'Privacidade/LGPD',        tags: ['lgpd', 'privacidade', 'dados', 'exclusão', 'portabilidade'], priority: 'high', resolution: 'human'},
    ],
  },
  {
    id: 'feedback',
    label: 'Sugestões',
    icon: 'lightbulb',
    desc: 'Melhorias e ideias',
    subcategories: [
      { id: 'funcionalidade', label: 'Nova funcionalidade', tags: ['novo', 'funcionalidade', 'recurso', 'feature'],             priority: 'low',  resolution: 'auto' },
      { id: 'ux',             label: 'Melhorias UX',        tags: ['ux', 'interface', 'usabilidade', 'design', 'experiência'],  priority: 'low',  resolution: 'auto' },
      { id: 'bug_percebido',  label: 'Bugs percebidos',     tags: ['bug', 'problema', 'falha', 'erro percebido'],               priority: 'medium', resolution: 'human'},
      { id: 'feedback_geral', label: 'Feedback geral',      tags: ['feedback', 'opinião', 'sugestão', 'melhoria'],              priority: 'low',  resolution: 'auto' },
    ],
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getCategoryDef(categoryId: string): CategoryDef | undefined {
  return SUPPORT_CATEGORIES.find(c => c.id === categoryId);
}

export function getSubcategoryDef(categoryId: string, subcategoryId: string): SubcategoryDef | undefined {
  return getCategoryDef(categoryId)?.subcategories.find(s => s.id === subcategoryId);
}

// ─── FAQ search cache (sessionStorage) ───────────────────────────────────────
// Key: "faq_cache:{category}:{subcategory}:{queryHash}"
// TTL: session only (cleared on tab close). Fine for FAQ articles that change rarely.

const FAQ_CACHE_PREFIX = 'faq_cache:';

function cacheKey(category: string, subcategory: string, query: string): string {
  return `${FAQ_CACHE_PREFIX}${category}:${subcategory}:${query.slice(0, 60)}`;
}

export function getFaqCache(category: string, subcategory: string, query: string): FaqSearchResult[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(category, subcategory, query));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setFaqCache(category: string, subcategory: string, query: string, results: FaqSearchResult[]): void {
  try {
    sessionStorage.setItem(cacheKey(category, subcategory, query), JSON.stringify(results));
  } catch {
    // sessionStorage may be full or unavailable — silently skip
  }
}

// Shape returned by the search_faq_articles RPC
export interface FaqSearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory: string | null;
  tags: string[] | null;
  helpful_yes: number;
  helpful_no: number;
  match_strategy: 'exact' | 'tags' | 'fulltext';
  rank: number;
}

// ─── Classifier ───────────────────────────────────────────────────────────────

const CRITICAL_KEYWORDS = ['indisponível', 'sistema fora', 'down', 'não funciona nada', 'erro geral', 'travou tudo'];
const HIGH_KEYWORDS      = ['urgente', 'bloqueado', 'não consigo', 'pagamento', 'cobrança indevida', 'cancelar', 'reembolso'];

function inferPriorityFromText(subject: string, message: string): TicketPriority | null {
  const text = `${subject} ${message}`.toLowerCase();
  if (CRITICAL_KEYWORDS.some(k => text.includes(k))) return 'critical';
  if (HIGH_KEYWORDS.some(k => text.includes(k))) return 'high';
  return null;
}

// Converts legacy priority values that may already exist in the DB
export function normalizePriority(raw: string): TicketPriority {
  if (raw === 'urgent') return 'critical';
  if (raw === 'normal') return 'medium';
  if (['low', 'medium', 'high', 'critical'].includes(raw)) return raw as TicketPriority;
  return 'medium';
}

export function classifyTicket(
  categoryId: string,
  subcategoryId: string,
  subject: string,
  message: string,
): ClassifiedTicket {
  const sub = getSubcategoryDef(categoryId, subcategoryId);

  const basePriority: TicketPriority = sub?.priority ?? 'medium';
  const textPriority = inferPriorityFromText(subject, message);

  // Text signals can escalate but never de-escalate the subcategory baseline
  const priorityRank: TicketPriority[] = ['low', 'medium', 'high', 'critical'];
  const finalPriority: TicketPriority = textPriority && priorityRank.indexOf(textPriority) > priorityRank.indexOf(basePriority)
    ? textPriority
    : basePriority;

  const tags: string[] = [...(sub?.tags ?? [])];

  // Confidence: 100 when subcategory is explicitly chosen; drops if text signals override priority
  const confidence_score = textPriority && textPriority !== basePriority ? 70 : 95;

  return {
    category:         categoryId,
    subcategory:      subcategoryId,
    subject,
    message,
    tags,
    priority:         finalPriority,
    resolution_type:  sub?.resolution ?? 'human',
    confidence_score,
  };
}
