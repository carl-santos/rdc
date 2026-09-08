import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type AuditCategory = 'auth' | 'operation' | 'data_access' | 'system' | 'billing' | 'error';
type AuditSeverity = 'info' | 'warning' | 'critical';

interface AuditLog {
    id: string;
    created_at: string;
    user_id: string | null;
    tenant_id: string | null;
    role: string | null;
    event_type: string | null;
    action: string;
    category: AuditCategory | null;
    resource_type: string;
    resource_id: string | null;
    severity: AuditSeverity | null;
    status: 'success' | 'error' | null;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, unknown>;
}

interface Profile {
    id: string;
    nome: string;
    email: string;
}

interface Tenant {
    id: string;
    razao_social?: string;
    nome_fantasia?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const CATEGORIES: { value: string; label: string; icon: string }[] = [
    { value: 'all',         label: 'Todos',        icon: 'list_alt' },
    { value: 'auth',        label: 'Auth',          icon: 'lock' },
    { value: 'operation',  label: 'Operação',     icon: 'model_training' },
    { value: 'data_access', label: 'Dados',         icon: 'database' },
    { value: 'billing',     label: 'Cobrança',      icon: 'payments' },
    { value: 'system',      label: 'Sistema',       icon: 'settings' },
    { value: 'error',       label: 'Erros',         icon: 'error' },
];

const SEVERITIES = [
    { value: 'all',      label: 'Todas',    color: 'text-slate-400' },
    { value: 'info',     label: 'Info',     color: 'text-blue-400' },
    { value: 'warning',  label: 'Aviso',    color: 'text-amber-400' },
    { value: 'critical', label: 'Crítico',  color: 'text-red-400' },
];

const DATE_RANGES = [
    { value: '1h',  label: 'Última hora' },
    { value: '24h', label: 'Últimas 24h' },
    { value: '7d',  label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: 'all', label: 'Todos' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityBadge(s: AuditSeverity | null) {
    if (s === 'critical') return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (s === 'warning')  return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
}

function severityDot(s: AuditSeverity | null) {
    if (s === 'critical') return 'bg-red-400';
    if (s === 'warning')  return 'bg-amber-400';
    return 'bg-blue-400';
}

function categoryIcon(c: AuditCategory | null) {
    const map: Record<string, string> = {
        auth: 'lock', operation: 'model_training', data_access: 'database',
        billing: 'payments', system: 'settings', error: 'error',
    };
    return map[c ?? ''] ?? 'circle';
}

function categoryColor(c: AuditCategory | null) {
    const map: Record<string, string> = {
        auth: 'text-purple-400', operation: 'text-emerald-400',
        data_access: 'text-sky-400', billing: 'text-yellow-400',
        system: 'text-slate-400', error: 'text-red-400',
    };
    return map[c ?? ''] ?? 'text-slate-500';
}

function fmtDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function shortId(id: string | null) {
    return id ? id.slice(0, 8) + '…' : '—';
}

function dateRangeCutoff(range: string): string | null {
    const now = new Date();
    if (range === '1h')  { now.setHours(now.getHours() - 1);   return now.toISOString(); }
    if (range === '24h') { now.setDate(now.getDate() - 1);      return now.toISOString(); }
    if (range === '7d')  { now.setDate(now.getDate() - 7);      return now.toISOString(); }
    if (range === '30d') { now.setDate(now.getDate() - 30);     return now.toISOString(); }
    return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

const AdminAuditLogs = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();

    // Data
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [profiles, setProfiles] = useState<Record<string, Profile>>({});
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const cursorRef = useRef<string | null>(null);

    // Filters
    const [category, setCategory] = useState('all');
    const [severity, setSeverity] = useState('all');
    const [dateRange, setDateRange] = useState('24h');
    const [search, setSearch] = useState('');
    const [tenantFilter, setTenantFilter] = useState('all');
    const [tenantList, setTenantList] = useState<Tenant[]>([]);

    // UI
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // KPIs
    const [kpis, setKpis] = useState({ total: 0, errors: 0, critical: 0 });

    // Guard: platform_admin only
    useEffect(() => {
        if (profile && profile.role !== 'platform_admin') navigate('/dashboard');
    }, [profile, navigate]);

    // Load tenant list for filter
    useEffect(() => {
        supabase.from('tenants').select('id, razao_social, nome_fantasia').limit(200)
            .then(({ data }) => { if (data) setTenantList(data as Tenant[]); });
    }, []);

    const buildQuery = useCallback((afterCursor: string | null) => {
        let q = supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE);

        if (category !== 'all') q = q.eq('category', category);
        if (severity !== 'all') q = q.eq('severity', severity as 'info' | 'warning' | 'critical');
        if (tenantFilter !== 'all') q = q.eq('tenant_id', tenantFilter);

        const cutoff = dateRangeCutoff(dateRange);
        if (cutoff) q = q.gte('created_at', cutoff);

        if (search.trim()) q = q.or(`action.ilike.%${search.trim()}%,event_type.ilike.%${search.trim()}%,resource_type.ilike.%${search.trim()}%`);

        if (afterCursor) q = q.lt('created_at', afterCursor);

        return q;
    }, [category, severity, dateRange, search, tenantFilter]);

    const enrichProfiles = useCallback(async (items: AuditLog[]) => {
        const ids = [...new Set(items.map(l => l.user_id).filter(Boolean))] as string[];
        const missing = ids.filter(id => !profiles[id]);
        if (!missing.length) return;
        const { data } = await supabase
            .from('profiles')
            .select('id, nome, email')
            .in('id', missing);
        if (data) {
            setProfiles(prev => {
                const next = { ...prev };
                (data as Profile[]).forEach(p => { next[p.id] = p; });
                return next;
            });
        }
    }, [profiles]);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        cursorRef.current = null;
        const { data, error } = await buildQuery(null);
        if (!error && data) {
            const items = data as AuditLog[];
            setLogs(items);
            setHasMore(items.length === PAGE_SIZE);
            if (items.length) cursorRef.current = items[items.length - 1].created_at;
            enrichProfiles(items);

            // Simple KPIs from current page (approximation — não faz queries extras)
            setKpis({
                total: items.length,
                errors: items.filter(l => l.status === 'error').length,
                critical: items.filter(l => l.severity === 'critical').length,
            });
        }
        setLoading(false);
    }, [buildQuery, enrichProfiles]);

    const loadMore = useCallback(async () => {
        if (!cursorRef.current || loadingMore) return;
        setLoadingMore(true);
        const { data, error } = await buildQuery(cursorRef.current);
        if (!error && data) {
            const items = data as AuditLog[];
            setLogs(prev => [...prev, ...items]);
            setHasMore(items.length === PAGE_SIZE);
            if (items.length) cursorRef.current = items[items.length - 1].created_at;
            enrichProfiles(items);
        }
        setLoadingMore(false);
    }, [buildQuery, loadingMore, enrichProfiles]);

    // Refetch on filter change
    useEffect(() => { fetchLogs(); }, [category, severity, dateRange, tenantFilter]);

    // Debounced search
    useEffect(() => {
        const t = setTimeout(() => fetchLogs(), 400);
        return () => clearTimeout(t);
    }, [search]);

    if (profile?.role !== 'platform_admin') return null;

    return (
        <DashboardLayout title="Central de Auditoria">
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Central de Auditoria</h1>
                        <p className="text-sm text-slate-400 mt-0.5">Rastreamento de eventos, segurança e conformidade LGPD</p>
                    </div>
                    <button
                        onClick={fetchLogs}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all text-sm"
                    >
                        <span className="material-symbols-outlined text-base">refresh</span>
                        Atualizar
                    </button>
                </div>

                {/* KPI pills */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Eventos (página)', value: kpis.total, icon: 'list_alt', color: 'text-slate-300' },
                        { label: 'Erros', value: kpis.errors, icon: 'error_outline', color: 'text-red-400' },
                        { label: 'Críticos', value: kpis.critical, icon: 'warning', color: 'text-amber-400' },
                    ].map(k => (
                        <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                            <span className={`material-symbols-outlined text-2xl ${k.color}`}>{k.icon}</span>
                            <div>
                                <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                                <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">{k.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">

                    {/* Category tabs */}
                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map(c => (
                            <button
                                key={c.value}
                                onClick={() => setCategory(c.value)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    category === c.value
                                        ? 'bg-primary text-white'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                <span className="material-symbols-outlined text-sm">{c.icon}</span>
                                {c.label}
                            </button>
                        ))}
                    </div>

                    {/* Row 2: severity + date + tenant + search */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <select
                            value={severity}
                            onChange={e => setSeverity(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                        >
                            {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>

                        <select
                            value={dateRange}
                            onChange={e => setDateRange(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                        >
                            {DATE_RANGES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>

                        <select
                            value={tenantFilter}
                            onChange={e => setTenantFilter(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary max-w-[200px]"
                        >
                            <option value="all">Todos os tenants</option>
                            {tenantList.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.razao_social ?? t.nome_fantasia ?? shortId(t.id)}
                                </option>
                            ))}
                        </select>

                        <div className="flex-1 min-w-[200px] relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base">search</span>
                            <input
                                type="text"
                                placeholder="Buscar ação, evento, recurso..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Log timeline */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="py-16 text-center">
                            <span className="material-symbols-outlined text-4xl text-slate-700">search_off</span>
                            <p className="text-slate-500 mt-2">Nenhum evento encontrado</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800">
                            {logs.map(log => {
                                const p = log.user_id ? profiles[log.user_id] : null;
                                const isExpanded = expandedId === log.id;
                                return (
                                    <div key={log.id}>
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-800/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                {/* Severity dot */}
                                                <div className={`size-2 rounded-full flex-shrink-0 ${severityDot(log.severity)}`} />

                                                {/* Category icon */}
                                                <span className={`material-symbols-outlined text-lg flex-shrink-0 ${categoryColor(log.category)}`}>
                                                    {categoryIcon(log.category)}
                                                </span>

                                                {/* Main info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-semibold text-slate-200 truncate">
                                                            {log.action}
                                                        </span>
                                                        {log.event_type && (
                                                            <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                                                                {log.event_type}
                                                            </span>
                                                        )}
                                                        {log.status === 'error' && (
                                                            <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded border border-red-400/20">
                                                                ERRO
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                                        <span className="text-[11px] text-slate-500">
                                                            {fmtDate(log.created_at)}
                                                        </span>
                                                        <span className="text-[11px] text-slate-600">
                                                            {p ? `${p.nome} · ${p.email}` : shortId(log.user_id)}
                                                        </span>
                                                        {log.resource_type !== 'unknown' && (
                                                            <span className="text-[11px] text-slate-600">
                                                                {log.resource_type}{log.resource_id ? ` #${shortId(log.resource_id)}` : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Severity badge */}
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex-shrink-0 ${severityBadge(log.severity)}`}>
                                                    {log.severity ?? 'info'}
                                                </span>

                                                {/* Expand chevron */}
                                                <span className={`material-symbols-outlined text-slate-600 text-base transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                                    expand_more
                                                </span>
                                            </div>
                                        </button>

                                        {/* Expanded detail */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4 bg-slate-950 border-t border-slate-800">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                                                    {[
                                                        { label: 'User ID',    value: log.user_id },
                                                        { label: 'Tenant ID',  value: log.tenant_id },
                                                        { label: 'IP',         value: log.ip_address },
                                                        { label: 'Role',       value: log.role },
                                                    ].map(f => f.value && (
                                                        <div key={f.label} className="bg-slate-900 rounded-lg p-2">
                                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{f.label}</p>
                                                            <p className="text-slate-300 font-mono mt-0.5 break-all">{f.value}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {log.user_agent && (
                                                    <div className="mt-2 bg-slate-900 rounded-lg p-2">
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">User Agent</p>
                                                        <p className="text-slate-400 text-xs mt-0.5 break-all">{log.user_agent}</p>
                                                    </div>
                                                )}

                                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                    <div className="mt-2 bg-slate-900 rounded-lg p-2">
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Metadata</p>
                                                        <pre className="text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap break-all">
                                                            {JSON.stringify(log.metadata, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Load more */}
                    {hasMore && !loading && (
                        <div className="px-4 py-3 border-t border-slate-800">
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="w-full py-2 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all disabled:opacity-50"
                            >
                                {loadingMore
                                    ? <span className="flex items-center justify-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-t-2 border-primary" />Carregando...</span>
                                    : 'Carregar mais'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default AdminAuditLogs;
