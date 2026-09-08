import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';

type LgpdType   = 'data_access' | 'data_portability' | 'revoke_consent' | 'data_delete' | 'grant_consent';
type LgpdStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';

interface Ticket {
    id: string;
    ticket_number: string;
    user_id: string;
    tenant_id: string | null;
    subject: string;
    description: string | null;
    status: string;
    created_at: string;
    lgpd_type: LgpdType | null;
    lgpd_status: LgpdStatus;
    lgpd_resolved_at: string | null;
    lgpd_processed_by: string | null;
    lgpd_resolution_notes: string | null;
    lgpd_export_path: string | null;
}

interface TargetProfile {
    id: string;
    nome: string;
    email: string;
    role: string;
    cargo: string | null;
    tenant_id: string | null;
    client_id: string | null;
    created_at: string;
    consents_revoked: Record<string, boolean> | null;
    consents_revoked_at: string | null;
    anonymized_at: string | null;
}

interface TicketMessage {
    id: string;
    ticket_id: string;
    sender_type: string;
    sender_id: string | null;
    message: string;
    created_at: string;
}

const TYPE_META: Record<LgpdType, { label: string; icon: string; article: string; description: string }> = {
    data_access:      { label: 'Acesso aos dados',     icon: 'manage_search',   article: 'Art. 18, II — LGPD',  description: 'O solicitante tem direito de receber um relatório completo dos seus dados armazenados na plataforma.' },
    data_portability: { label: 'Portabilidade',        icon: 'download',        article: 'Art. 18, V — LGPD',   description: 'O solicitante tem direito de receber seus dados em formato estruturado (JSON + CSV) para migração a outro fornecedor.' },
    revoke_consent:   { label: 'Revogar consentimento', icon: 'block',           article: 'Art. 18, IX — LGPD',  description: 'O solicitante tem direito de revogar consentimentos previamente concedidos. Operações que dependam do consentimento revogado serão bloqueadas a partir daqui.' },
    grant_consent:    { label: 'Reativar consentimento', icon: 'restart_alt',     article: 'Art. 8 §5º — LGPD',   description: 'O solicitante reativou um consentimento previamente revogado. Esta ação foi processada automaticamente pelo próprio titular. Este registro existe apenas para fins de auditoria.' },
    data_delete:      { label: 'Excluir conta',        icon: 'delete_forever',  article: 'Art. 18, VI — LGPD',  description: 'O solicitante tem direito de solicitar a anonimização dos seus dados. Registros financeiros/fiscais e logs de auditoria são preservados com IDs (sem PII) para conformidade legal.' },
};

const AdminLgpdDetail = () => {
    const { ticketId } = useParams<{ ticketId: string }>();
    const navigate = useNavigate();
    const showToast = useToast();
    const { profile } = useAuth();

    const [ticket,   setTicket]   = useState<Ticket | null>(null);
    const [target,   setTarget]   = useState<TargetProfile | null>(null);
    const [client,  setClient]  = useState<any | null>(null);
    const [messages, setMessages] = useState<TicketMessage[]>([]);
    const [loading,  setLoading]  = useState(true);

    // Form state
    const [resolutionNotes,    setResolutionNotes]    = useState('');
    const [revokeAI,           setRevokeAI]           = useState(false);
    const [revokeThirdParty,   setRevokeThirdParty]   = useState(false);
    const [revokeMarketing,    setRevokeMarketing]    = useState(false);
    const [deleteConfirm,      setDeleteConfirm]      = useState('');
    const [processing,         setProcessing]        = useState(false);
    // Gerenciamento de atendimento (status + reply)
    const [replyMessage,       setReplyMessage]      = useState('');
    const [managing,           setManaging]          = useState(false);

    // Export downloads
    const [exportUrls, setExportUrls] = useState<{ name: string; url: string }[]>([]);

    const isPlatformAdmin = (profile as any)?.role === 'platform_admin';

    const fetchData = useCallback(async () => {
        if (!ticketId) return;
        setLoading(true);
        try {
            const { data: ticketData, error: tErr } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('id' as any, ticketId as any)
                .single();
            if (tErr) throw tErr;
            const tk = ticketData as any as Ticket;
            setTicket(tk);

            if (tk.lgpd_resolution_notes) setResolutionNotes(tk.lgpd_resolution_notes);

            // Target profile
            const { data: profData } = await supabase
                .from('profiles')
                .select('id, nome, email, role, cargo, tenant_id, client_id, created_at, consents_revoked, consents_revoked_at, anonymized_at')
                .eq('id' as any, tk.user_id as any)
                .maybeSingle();
            const tg = profData as any as TargetProfile | null;
            setTarget(tg);

            // Registro de cliente vinculado, se houver
            if (tg?.client_id) {
                const paRes = await supabase
                    .from('clients').select('*').eq('id' as any, tg.client_id as any).maybeSingle();
                setClient((paRes.data as any) || null);
            }

            // Mensagens do ticket
            const { data: msgs } = await supabase
                .from('ticket_messages')
                .select('*')
                .eq('ticket_id' as any, ticketId as any)
                .order('created_at', { ascending: true });
            setMessages((msgs as any[]) || []);

            // Se já tem export, gera signed URLs
            if (tk.lgpd_export_path) {
                const files = tk.lgpd_type === 'data_portability'
                    ? ['dados.json', 'chamados.csv']
                    : ['dados.json'];
                const urls: { name: string; url: string }[] = [];
                for (const f of files) {
                    const { data: signed } = await supabase.storage
                        .from('lgpd-exports')
                        .createSignedUrl(`${tk.lgpd_export_path}/${f}`, 7 * 24 * 60 * 60); // 7 dias
                    if (signed?.signedUrl) urls.push({ name: f, url: signed.signedUrl });
                }
                setExportUrls(urls);
            }
        } catch (err: any) {
            showToast('Erro ao carregar ticket: ' + (err.message || 'desconhecido'), 'error');
        } finally {
            setLoading(false);
        }
    }, [ticketId, showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const callEdgeFunction = async (payload: Record<string, unknown>) => {
        if (!ticket) return;
        setProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-lgpd-request`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify({
                        ticket_id: ticket.id,
                        action: ticket.lgpd_type,
                        payload,
                    }),
                }
            );
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);

            showToast('Solicitação LGPD processada com sucesso.', 'success');
            await fetchData(); // recarrega estado atualizado
        } catch (err: any) {
            showToast('Falha: ' + (err.message || 'erro desconhecido'), 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Meta-ação: gerencia ciclo de vida do ticket (status, reply) sem executar ação técnica.
    const callManageTicket = async (newStatus: 'pending' | 'in_progress' | 'resolved' | 'rejected' | null, reply: string) => {
        if (!ticket) return;
        if (!newStatus && !reply.trim()) {
            showToast('Informe uma resposta ou selecione um novo status.', 'error');
            return;
        }
        setManaging(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-lgpd-request`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify({
                        ticket_id: ticket.id,
                        action: 'manage_ticket',
                        payload: {
                            new_status: newStatus ?? undefined,
                            reply_message: reply.trim() || undefined,
                            resolution_notes: resolutionNotes || undefined,
                        },
                    }),
                }
            );
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);

            const statusLabel: Record<string, string> = {
                pending: 'pendente',
                in_progress: 'em análise',
                resolved: 'atendido',
                rejected: 'rejeitado',
            };
            showToast(
                newStatus
                    ? `Ticket marcado como ${statusLabel[newStatus]}.`
                    : 'Resposta enviada.',
                'success'
            );
            setReplyMessage('');
            await fetchData();
        } catch (err: any) {
            showToast('Falha: ' + (err.message || 'erro desconhecido'), 'error');
        } finally {
            setManaging(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout title="Solicitação LGPD">
                <div className="p-12 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
            </DashboardLayout>
        );
    }

    if (!ticket || !target) {
        return (
            <DashboardLayout title="Solicitação LGPD">
                <div className="p-12 text-center text-slate-500">
                    Ticket ou usuário-alvo não encontrado.
                </div>
            </DashboardLayout>
        );
    }

    const type = ticket.lgpd_type ? TYPE_META[ticket.lgpd_type] : null;
    const isResolved = ticket.lgpd_status === 'resolved';
    const canDelete = isPlatformAdmin; // decisão 1-C
    const blocked   = ticket.lgpd_type === 'data_delete' && !canDelete;

    return (
        <DashboardLayout title="Solicitação LGPD">
            <div className="max-w-4xl space-y-6">

                {/* Breadcrumb + back */}
                <div className="flex items-center justify-between">
                    <Link to="/admin/lgpd" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        Voltar à Central LGPD
                    </Link>
                    <span className="text-xs font-mono text-slate-400">{ticket.ticket_number}</span>
                </div>

                {/* Cabeçalho da solicitação */}
                {type && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                <span className="material-symbols-outlined text-2xl">{type.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{type.label}</h2>
                                <p className="text-xs font-bold text-primary uppercase tracking-widest mt-0.5">{type.article}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{type.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border ${
                                    ticket.lgpd_status === 'resolved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                    ticket.lgpd_status === 'in_progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                    'bg-amber-100 text-amber-700 border-amber-200'
                                }`}>
                                    {ticket.lgpd_status}
                                </span>
                                {ticket.lgpd_resolved_at && (
                                    <span className="text-[10px] text-slate-400">
                                        Atendido em {new Date(ticket.lgpd_resolved_at).toLocaleString('pt-BR')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Aviso de bloqueio */}
                {blocked && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 flex items-start gap-3">
                        <span className="material-symbols-outlined text-amber-600 flex-shrink-0">lock</span>
                        <div className="text-sm text-amber-800 dark:text-amber-200">
                            <strong>Ação restrita.</strong> Exclusão de conta requer um administrador da plataforma (platform_admin) para executar — decisão de governança da Central LGPD. Como tenant_admin, você pode visualizar mas não processar este tipo de solicitação.
                        </div>
                    </div>
                )}

                {/* Dados do solicitante */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Dados do solicitante</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Nome</p>
                            <p className="font-medium text-slate-900 dark:text-white truncate">{target.nome || '—'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">E-mail</p>
                            <p className="font-medium text-slate-900 dark:text-white truncate">{target.email}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Role</p>
                            <p className="font-medium text-slate-900 dark:text-white">{target.role}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Cadastrado</p>
                            <p className="font-medium text-slate-900 dark:text-white">{new Date(target.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                    </div>
                    {target.anonymized_at && (
                        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs text-slate-500">
                            <strong>Conta já anonimizada</strong> em {new Date(target.anonymized_at).toLocaleString('pt-BR')}
                        </div>
                    )}
                </div>

                {/* Painel específico por tipo de solicitação */}
                {!blocked && !isResolved && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Executar ação</h3>

                        {/* DATA_ACCESS / DATA_PORTABILITY */}
                        {(ticket.lgpd_type === 'data_access' || ticket.lgpd_type === 'data_portability') && (
                            <div className="space-y-4">
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm space-y-1">
                                    <p className="font-bold text-slate-700 dark:text-slate-200 mb-2">Escopo do export:</p>
                                    <p className="text-slate-600 dark:text-slate-400">• Profile do usuário (nome, e-mail, role, datas)</p>
                                    <p className="text-slate-600 dark:text-slate-400">• Consentimentos atuais + revogados</p>
                                    {client && <p className="text-slate-600 dark:text-slate-400">• Client: {client.nome}</p>}
                                    {ticket.lgpd_type === 'data_portability' && (
                                        <p className="text-slate-600 dark:text-slate-400">• <strong>+CSV tabular</strong> de operações</p>
                                    )}
                                </div>
                                <textarea
                                    placeholder="Observações (opcional)"
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary"
                                />
                                <button
                                    onClick={() => callEdgeFunction({ resolution_notes: resolutionNotes || undefined })}
                                    disabled={processing}
                                    className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {processing
                                        ? <><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>Gerando...</>
                                        : <><span className="material-symbols-outlined text-base">build</span>Gerar pacote de dados</>
                                    }
                                </button>
                            </div>
                        )}

                        {/* REVOKE_CONSENT */}
                        {ticket.lgpd_type === 'revoke_consent' && (
                            <div className="space-y-4">
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
                                    <p className="font-bold mb-1 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-base">warning</span>
                                        Impactos da revogação
                                    </p>
                                    <ul className="text-xs space-y-1 list-disc list-inside">
                                        <li><strong>IA</strong>: novas operações serão bloqueadas em <code>run-operation</code> (a aplicar na Fase 4)</li>
                                        <li><strong>Terceiros</strong>: dados não serão mais enviados a provedores externos de IA (mesmo efeito do anterior)</li>
                                        <li><strong>Marketing</strong>: usuário será removido das comunicações por e-mail</li>
                                        <li>Os tenant_admins do tenant do solicitante serão notificados se IA/terceiros forem revogados</li>
                                    </ul>
                                </div>

                                <div className="space-y-3">
                                    {([
                                        { key: 'ai',          label: 'Consentimento de IA',                desc: 'Processamento de imagens por inteligência artificial' },
                                        { key: 'third_party', label: 'Compartilhamento com terceiros',     desc: 'Envio de dados a provedores externos de IA' },
                                        { key: 'marketing',   label: 'Marketing',                          desc: 'Comunicações promocionais por e-mail' },
                                    ] as const).map(c => {
                                        const checked  = c.key === 'ai' ? revokeAI : c.key === 'third_party' ? revokeThirdParty : revokeMarketing;
                                        const setter   = c.key === 'ai' ? setRevokeAI : c.key === 'third_party' ? setRevokeThirdParty : setRevokeMarketing;
                                        const already  = (target.consents_revoked as any)?.[`consent_${c.key}`] === true;
                                        return (
                                            <label key={c.key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-700'} ${already ? 'opacity-50' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked || already}
                                                    onChange={(e) => !already && setter(e.target.checked)}
                                                    disabled={already}
                                                    className="mt-0.5 size-4 text-amber-600 focus:ring-amber-500 rounded"
                                                />
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{c.label}</p>
                                                    <p className="text-xs text-slate-500">{c.desc}</p>
                                                    {already && <p className="text-[10px] font-bold text-amber-600 mt-1">JÁ REVOGADO</p>}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>

                                <textarea
                                    placeholder="Observações (opcional)"
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary"
                                />
                                <button
                                    onClick={() => callEdgeFunction({
                                        revoke: { consent_ai: revokeAI, consent_third_party: revokeThirdParty, consent_marketing: revokeMarketing },
                                        resolution_notes: resolutionNotes || undefined,
                                    })}
                                    disabled={processing || (!revokeAI && !revokeThirdParty && !revokeMarketing)}
                                    className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-600/20 hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {processing
                                        ? <><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>Revogando...</>
                                        : <><span className="material-symbols-outlined text-base">block</span>Revogar consentimentos selecionados</>
                                    }
                                </button>
                            </div>
                        )}

                        {/* DATA_DELETE */}
                        {ticket.lgpd_type === 'data_delete' && (
                            <div className="space-y-4">
                                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl p-4 text-sm text-red-800 dark:text-red-200">
                                    <p className="font-bold mb-2 flex items-center gap-2">
                                        <span className="material-symbols-outlined">delete_forever</span>
                                        Anonimização permanente
                                    </p>
                                    <p className="text-xs mb-3"><strong>Esta operação é irreversível.</strong> Será executada agora:</p>
                                    <ul className="text-xs space-y-1 list-disc list-inside">
                                        <li>Profile <code>{target.nome}</code> → <code>nome=[REMOVIDO]</code>, <code>email=anon_xxx@deleted.local</code></li>
                                        {client && <li>Client <code>{client.nome}</code> → <code>nome=[REMOVIDO]</code>, telefone/email/foto removidos</li>}
                                        <li>auth.user banido por 100 anos + senha aleatória + e-mail anonimizado</li>
                                        <li><strong>Preservados</strong>: billing_invoices e audit_logs (apenas IDs, sem PII) — conformidade fiscal/médica</li>
                                    </ul>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                        Para confirmar, digite <code className="bg-red-100 text-red-700 px-1 rounded font-mono">EXCLUIR</code>
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteConfirm}
                                        onChange={(e) => setDeleteConfirm(e.target.value)}
                                        placeholder="EXCLUIR"
                                        className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-slate-800 text-sm font-mono uppercase tracking-widest focus:ring-red-500 focus:border-red-500"
                                    />
                                </div>

                                <textarea
                                    placeholder="Observações (opcional — recomendado documentar o motivo)"
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary"
                                />

                                <button
                                    onClick={() => {
                                        if (deleteConfirm.trim().toUpperCase() !== 'EXCLUIR') {
                                            showToast('Digite "EXCLUIR" exatamente para confirmar.', 'error');
                                            return;
                                        }
                                        callEdgeFunction({ resolution_notes: resolutionNotes || undefined });
                                    }}
                                    disabled={processing || deleteConfirm.trim().toUpperCase() !== 'EXCLUIR'}
                                    className="w-full py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {processing
                                        ? <><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>Anonimizando...</>
                                        : <><span className="material-symbols-outlined text-base">delete_forever</span>Anonimizar conta permanentemente</>
                                    }
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Resultado / exports (se já resolved) */}
                {isResolved && exportUrls.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-6 shadow-sm">
                        <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">check_circle</span>
                            Arquivos gerados (signed URL válida por 7 dias)
                        </h3>
                        <div className="space-y-2">
                            {exportUrls.map(f => (
                                <a key={f.name} href={f.url} target="_blank" rel="noopener noreferrer"
                                   className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 transition-colors">
                                    <span className="text-sm font-mono text-slate-700 dark:text-slate-300">{f.name}</span>
                                    <span className="material-symbols-outlined text-primary">download</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Estado de consentimentos (sempre útil de mostrar) */}
                {target.consents_revoked && Object.keys(target.consents_revoked).length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Consentimentos atuais</h3>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(target.consents_revoked).map(([k, v]) => v && (
                                <span key={k} className="px-2 py-1 text-[10px] font-black uppercase rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 border border-red-200 dark:border-red-800">
                                    {k.replace('consent_', '')} REVOGADO
                                </span>
                            ))}
                        </div>
                        {target.consents_revoked_at && (
                            <p className="text-[10px] text-slate-400 mt-2">Última revogação: {new Date(target.consents_revoked_at).toLocaleString('pt-BR')}</p>
                        )}
                    </div>
                )}

                {/* Gerenciar atendimento — sempre visível (exceto quando bloqueado por permissão) */}
                {!blocked && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">support_agent</span>
                            Gerenciar atendimento
                        </h3>

                        <div className="space-y-3">
                            <textarea
                                placeholder="Resposta ao titular (opcional — entra na thread do ticket e na notificação)"
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                rows={3}
                                disabled={managing}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary"
                            />

                            <div className="flex flex-wrap gap-2">
                                {/* Marcar em análise — só visível se pending */}
                                {ticket.lgpd_status === 'pending' && (
                                    <button
                                        onClick={() => callManageTicket('in_progress', replyMessage)}
                                        disabled={managing}
                                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-black uppercase tracking-wider hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-60"
                                    >
                                        <span className="material-symbols-outlined text-base">hourglass_top</span>
                                        Marcar em análise
                                    </button>
                                )}

                                {/* Marcar atendido — quando pending ou in_progress */}
                                {(ticket.lgpd_status === 'pending' || ticket.lgpd_status === 'in_progress') && (
                                    <button
                                        onClick={() => callManageTicket('resolved', replyMessage)}
                                        disabled={managing}
                                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-black uppercase tracking-wider hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-60"
                                    >
                                        <span className="material-symbols-outlined text-base">task_alt</span>
                                        Marcar atendido
                                    </button>
                                )}

                                {/* Rejeitar — quando pending ou in_progress */}
                                {(ticket.lgpd_status === 'pending' || ticket.lgpd_status === 'in_progress') && (
                                    <button
                                        onClick={() => {
                                            if (!replyMessage.trim()) {
                                                showToast('Justifique a rejeição na resposta antes de prosseguir.', 'error');
                                                return;
                                            }
                                            callManageTicket('rejected', replyMessage);
                                        }}
                                        disabled={managing}
                                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-black uppercase tracking-wider hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-60"
                                    >
                                        <span className="material-symbols-outlined text-base">block</span>
                                        Rejeitar
                                    </button>
                                )}

                                {/* Reabrir — quando resolved ou rejected */}
                                {(ticket.lgpd_status === 'resolved' || ticket.lgpd_status === 'rejected') && (
                                    <button
                                        onClick={() => callManageTicket('pending', replyMessage)}
                                        disabled={managing}
                                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-black uppercase tracking-wider hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-60"
                                    >
                                        <span className="material-symbols-outlined text-base">restart_alt</span>
                                        Reabrir
                                    </button>
                                )}

                                {/* Só responder — sempre visível, requer texto */}
                                <button
                                    onClick={() => callManageTicket(null, replyMessage)}
                                    disabled={managing || !replyMessage.trim()}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 ml-auto"
                                    title={!replyMessage.trim() ? 'Escreva uma resposta primeiro' : 'Apenas adiciona a mensagem no ticket'}
                                >
                                    <span className="material-symbols-outlined text-base">reply</span>
                                    Só responder
                                </button>
                            </div>

                            {managing && (
                                <p className="text-xs text-slate-500 italic flex items-center gap-2">
                                    <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                                    Atualizando...
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Conversa do ticket */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Histórico do ticket</h3>
                    <div className="space-y-3">
                        {messages.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">Sem mensagens.</p>
                        ) : messages.map(m => (
                            <div key={m.id} className={`p-3 rounded-xl border ${m.sender_type === 'admin' ? 'bg-primary/5 border-primary/20' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-[10px] font-black uppercase ${m.sender_type === 'admin' ? 'text-primary' : 'text-slate-500'}`}>
                                        {m.sender_type === 'admin' ? 'Admin' : 'Usuário'}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{new Date(m.created_at).toLocaleString('pt-BR')}</span>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">{m.message}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <button onClick={() => navigate('/admin/lgpd')}
                        className="text-xs text-slate-500 hover:text-primary transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    Voltar à lista
                </button>
            </div>
        </DashboardLayout>
    );
};

export default AdminLgpdDetail;
