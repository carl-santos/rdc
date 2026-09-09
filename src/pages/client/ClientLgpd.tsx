import { useEffect, useState } from 'react';
import ClientLayout from '../../layouts/ClientLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';

type RequestType = 'data_access' | 'data_delete' | 'data_portability' | 'revoke_consent' | 'grant_consent' | null;

const ClientLgpd = () => {
    const { user, profile } = useAuth();
    const [selectedRequest, setSelectedRequest] = useState<RequestType>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [revokedConsents, setRevokedConsents] = useState<Record<string, boolean>>({});
    const [revokedAt, setRevokedAt] = useState<string | null>(null);
    // Estado dos toggles de revogação (granular)
    const [revokeAI, setRevokeAI]                 = useState(false);
    const [revokeThirdParty, setRevokeThirdParty] = useState(false);
    const [revokeMarketing, setRevokeMarketing]   = useState(false);
    // Estado dos toggles de reativação (granular)
    const [grantAI, setGrantAI]                   = useState(false);
    const [grantThirdParty, setGrantThirdParty]   = useState(false);
    const [grantMarketing, setGrantMarketing]     = useState(false);

    const hasRevokedConsents = !!(revokedConsents.consent_ai || revokedConsents.consent_third_party || revokedConsents.consent_marketing);

    // Busca consents_revoked do próprio profile para o banner informativo
    useEffect(() => {
        if (!user) return;
        supabase
            .from('profiles')
            .select('consents_revoked, consents_revoked_at')
            .eq('id' as any, user.id as any)
            .maybeSingle()
            .then(({ data }) => {
                const cr = (data as any)?.consents_revoked || {};
                setRevokedConsents(cr);
                setRevokedAt((data as any)?.consents_revoked_at || null);
            });
    }, [user?.id]);

    const requestTypes = [
        {
            id: 'data_access' as RequestType,
            icon: 'manage_search',
            title: 'Acessar meus dados',
            description: 'Solicite um relatório completo com todos os seus dados armazenados na plataforma.',
            color: 'border-blue-200 hover:border-blue-400 dark:border-blue-900',
            iconBg: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
            visible: true,
        },
        {
            id: 'data_portability' as RequestType,
            icon: 'download',
            title: 'Portabilidade de dados',
            description: 'Receba seus dados em formato estruturado (JSON/CSV) para usar em outra plataforma.',
            color: 'border-violet-200 hover:border-violet-400 dark:border-violet-900',
            iconBg: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600',
            visible: true,
        },
        {
            id: 'revoke_consent' as RequestType,
            icon: 'block',
            title: 'Revogar consentimento',
            description: 'Solicite a interrupção do tratamento dos seus dados para fins específicos.',
            color: 'border-amber-200 hover:border-amber-400 dark:border-amber-900',
            iconBg: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
            visible: true,
        },
        {
            id: 'grant_consent' as RequestType,
            icon: 'restart_alt',
            title: 'Reativar consentimento',
            description: 'Conceda novamente um consentimento que você havia revogado. A reativação é aplicada imediatamente.',
            color: 'border-emerald-200 hover:border-emerald-400 dark:border-emerald-900',
            iconBg: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
            // Só visível se há algo revogado pra reativar
            visible: hasRevokedConsents,
        },
        {
            id: 'data_delete' as RequestType,
            icon: 'delete_forever',
            title: 'Excluir minha conta',
            description: 'Solicite a exclusão permanente de todos os seus dados e conta da plataforma.',
            color: 'border-red-200 hover:border-red-400 dark:border-red-900',
            iconBg: 'bg-red-50 dark:bg-red-900/20 text-red-600',
            visible: true,
        },
    ];

    const handleSubmitRequest = async () => {
        if (!selectedRequest || !user) return;

        // Validação específica para revogação: precisa selecionar ao menos 1 consentimento
        if (selectedRequest === 'revoke_consent' && !revokeAI && !revokeThirdParty && !revokeMarketing) {
            setError('Selecione ao menos um consentimento para revogar.');
            return;
        }

        // Validação específica para reativação: precisa selecionar ao menos 1 consentimento
        if (selectedRequest === 'grant_consent' && !grantAI && !grantThirdParty && !grantMarketing) {
            setError('Selecione ao menos um consentimento para reativar.');
            return;
        }

        const confirmMessages: Record<string, string> = {
            data_access: 'Confirma a solicitação de acesso aos seus dados? Nossa equipe entrará em contato.',
            data_portability: 'Confirma a solicitação de portabilidade dos seus dados?',
            revoke_consent: 'Confirma a revogação dos consentimentos selecionados? A revogação é aplicada imediatamente.',
            grant_consent: 'Confirma a reativação dos consentimentos selecionados? A reativação é aplicada imediatamente.',
            data_delete: 'ATENÇÃO: Esta ação solicitará a exclusão permanente de todos os seus dados. Esta operação é irreversível. Confirma?',
        };

        if (!confirm(confirmMessages[selectedRequest])) return;

        setSubmitting(true);
        setError(null);
        try {
            const labels: Record<string, string> = {
                data_access: 'Solicitação de Acesso aos Dados (Art. 18, II - LGPD)',
                data_portability: 'Portabilidade de Dados (Art. 18, V - LGPD)',
                revoke_consent: 'Revogação de Consentimento (Art. 18, IX - LGPD)',
                grant_consent: 'Reativação de Consentimento (Art. 8 §5º - LGPD)',
                data_delete: 'Solicitação de Exclusão de Conta e Dados (Art. 18, VI - LGPD)',
            };

            const ticketNum = `LGPD-${Math.floor(Math.random() * 90000) + 10000}`;
            const tenantId = (profile as any)?.tenant_id || null;

            const { data: ticket, error: tErr } = await supabase
                .from('support_tickets')
                .insert({
                    user_id: user.id,
                    tenant_id: tenantId,
                    subject: labels[selectedRequest],
                    description: `Solicitação LGPD enviada pelo portal do cliente.\nUsuário: ${profile?.nome || user.email}\nE-mail: ${user.email}\nTipo: ${selectedRequest}\nData: ${new Date().toLocaleString('pt-BR')}`,
                    category: 'lgpd',
                    lgpd_type: selectedRequest,
                    priority: selectedRequest === 'data_delete' ? 'high' : 'normal',
                    status: 'open',
                    ticket_number: ticketNum,
                    blocks_sales: false,
                    read: false,
                    unread_messages_count: 0,
                } as any)
                .select()
                .single();

            if (tErr) throw tErr;

            await supabase.from('ticket_messages').insert({
                ticket_id: (ticket as any).id,
                sender_type: 'user',
                sender_id: user.id,
                message: `Solicitação LGPD: ${labels[selectedRequest]}\n\nEnviada em: ${new Date().toLocaleString('pt-BR')}`,
            } as any);

            // Para revoke_consent ou grant_consent: executa imediatamente via Edge Function
            // (LGPD Art. 18 §3º — revogação facilitada; Art. 8 §5º — concessão livre)
            if (selectedRequest === 'revoke_consent' || selectedRequest === 'grant_consent') {
                const isGrant = selectedRequest === 'grant_consent';
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
                            ticket_id: (ticket as any).id,
                            action: selectedRequest,
                            payload: isGrant
                                ? {
                                    grant: {
                                        consent_ai: grantAI,
                                        consent_third_party: grantThirdParty,
                                        consent_marketing: grantMarketing,
                                    },
                                }
                                : {
                                    revoke: {
                                        consent_ai: revokeAI,
                                        consent_third_party: revokeThirdParty,
                                        consent_marketing: revokeMarketing,
                                    },
                                },
                        }),
                    },
                );
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.error || `Erro ${res.status} ao processar solicitação.`);
                // Refetch consents para atualizar o banner imediatamente
                const { data: refresh } = await supabase
                    .from('profiles')
                    .select('consents_revoked, consents_revoked_at')
                    .eq('id' as any, user.id as any)
                    .maybeSingle();
                setRevokedConsents((refresh as any)?.consents_revoked || {});
                setRevokedAt((refresh as any)?.consents_revoked_at || null);
                // Reseta toggles
                setRevokeAI(false); setRevokeThirdParty(false); setRevokeMarketing(false);
                setGrantAI(false);  setGrantThirdParty(false);  setGrantMarketing(false);
            }

            setSubmitted(ticketNum);
            setSelectedRequest(null);
        } catch (err: any) {
            setError(err.message || 'Erro ao enviar solicitação.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ClientLayout title="LGPD">
            <div className="max-w-2xl space-y-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Seus Direitos — LGPD</h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito de solicitar acesso, portabilidade, correção ou exclusão dos seus dados.
                    </p>
                </div>

                {/* Banner de consentimentos revogados — visível sempre que houver pelo menos 1 revogação */}
                {(revokedConsents.consent_ai || revokedConsents.consent_third_party || revokedConsents.consent_marketing) && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-red-600 mt-0.5">shield_lock</span>
                            <div className="flex-1">
                                <h4 className="font-bold text-red-800 dark:text-red-300 mb-1">Consentimentos revogados</h4>
                                <p className="text-red-700 dark:text-red-400 text-sm">
                                    Os seguintes consentimentos estão atualmente revogados na sua conta:
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-400">
                                    {revokedConsents.consent_ai && (
                                        <li className="flex items-start gap-2">
                                            <span className="material-symbols-outlined text-xs mt-1">block</span>
                                            <span><strong>Processamento por IA</strong> — novas operações não serão geradas</span>
                                        </li>
                                    )}
                                    {revokedConsents.consent_third_party && (
                                        <li className="flex items-start gap-2">
                                            <span className="material-symbols-outlined text-xs mt-1">block</span>
                                            <span><strong>Compartilhamento com terceiros</strong> — dados não serão enviados a provedores externos de IA</span>
                                        </li>
                                    )}
                                    {revokedConsents.consent_marketing && (
                                        <li className="flex items-start gap-2">
                                            <span className="material-symbols-outlined text-xs mt-1">block</span>
                                            <span><strong>Marketing</strong> — você não receberá novidades por e-mail</span>
                                        </li>
                                    )}
                                </ul>
                                {revokedAt && (
                                    <p className="text-xs text-red-600 dark:text-red-500 mt-3">
                                        Última revogação registrada em: {new Date(revokedAt).toLocaleString('pt-BR')}
                                    </p>
                                )}
                                <p className="text-xs text-red-600 dark:text-red-500 mt-3">
                                    Para reativar um consentimento, abra uma nova solicitação descrevendo qual consentimento deseja restaurar. A reativação não é automática — passa por análise do controlador.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Success message */}
                {submitted && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 flex items-start gap-4">
                        <div className="size-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-emerald-800 dark:text-emerald-300 mb-1">Solicitação enviada com sucesso!</h4>
                            <p className="text-emerald-700 dark:text-emerald-400 text-sm">
                                Protocolo: <span className="font-mono font-bold">{submitted}</span>. Nossa equipe responderá em até 15 dias úteis, conforme previsto na LGPD.
                            </p>
                            <button
                                onClick={() => setSubmitted(null)}
                                className="text-emerald-600 text-xs font-bold mt-2 hover:underline"
                            >
                                Fazer outra solicitação
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">error</span>
                        {error}
                    </div>
                )}

                {!submitted && (
                    <>
                        {/* Rights overview */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">shield</span>
                                Seus direitos garantidos (Art. 18 LGPD)
                            </h3>
                            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                {[
                                    'Confirmação da existência de tratamento de dados',
                                    'Acesso aos dados armazenados sobre você',
                                    'Correção de dados incompletos ou desatualizados',
                                    'Anonimização, bloqueio ou eliminação de dados desnecessários',
                                    'Portabilidade dos dados a outro fornecedor',
                                    'Eliminação dos dados tratados com consentimento',
                                    'Revogação do consentimento a qualquer momento',
                                ].map((right, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="material-symbols-outlined text-emerald-500 text-base mt-0.5 flex-shrink-0">check</span>
                                        {right}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Request types */}
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Fazer uma solicitação</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {requestTypes.filter(r => r.visible).map((req) => (
                                    <button
                                        key={req.id}
                                        onClick={() => setSelectedRequest(selectedRequest === req.id ? null : req.id)}
                                        className={`text-left border-2 rounded-2xl p-5 transition-all ${selectedRequest === req.id ? 'border-primary bg-primary/5' : `${req.color} bg-white dark:bg-slate-900`}`}
                                    >
                                        <div className={`size-10 rounded-xl flex items-center justify-center mb-3 ${req.iconBg}`}>
                                            <span className="material-symbols-outlined">{req.icon}</span>
                                        </div>
                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1">{req.title}</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed">{req.description}</p>
                                        {selectedRequest === req.id && (
                                            <div className="mt-3 flex items-center gap-1 text-primary text-xs font-bold">
                                                <span className="material-symbols-outlined text-base">check_circle</span>
                                                Selecionado
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedRequest && (
                            <div className={`rounded-2xl p-5 border-2 ${
                                selectedRequest === 'data_delete' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                : selectedRequest === 'revoke_consent' ? 'bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-800'
                                : selectedRequest === 'grant_consent' ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-800'
                                : 'bg-primary/5 border-primary/20'
                            }`}>
                                {selectedRequest === 'data_delete' ? (
                                    <p className="text-sm font-medium mb-4 text-red-700 dark:text-red-400">
                                        ⚠️ Atenção: A exclusão de conta é permanente e irreversível. Todos os seus dados, imagens e histórico serão removidos.
                                    </p>
                                ) : selectedRequest === 'revoke_consent' ? (
                                    <div className="mb-4 space-y-4">
                                        <p className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-base">warning</span>
                                            O que acontece ao revogar consentimento
                                        </p>
                                        <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-2 leading-relaxed">
                                            <li className="flex items-start gap-2">
                                                <span className="material-symbols-outlined text-amber-600 text-sm flex-shrink-0 mt-0.5">block</span>
                                                <span>
                                                    <strong>Você perderá o acesso a novas operações.</strong> O processamento de imagens por IA depende do seu consentimento — sem ele, o profissional que te acompanha não poderá gerar novos relatórios na plataforma.
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="material-symbols-outlined text-amber-600 text-sm flex-shrink-0 mt-0.5">history</span>
                                                <span>
                                                    <strong>Operações já realizadas não são apagadas.</strong> A revogação afeta apenas o processamento futuro. Se quiser apagar histórico, escolha "Excluir minha conta".
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="material-symbols-outlined text-amber-600 text-sm flex-shrink-0 mt-0.5">support_agent</span>
                                                <span>
                                                    <strong>O profissional será notificado.</strong> O administrador do seu tenant é avisado para não tentar executar enquanto o consentimento estiver revogado.
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="material-symbols-outlined text-emerald-600 text-sm flex-shrink-0 mt-0.5">restart_alt</span>
                                                <span>
                                                    <strong>Você pode reativar a qualquer momento</strong> abrindo uma nova solicitação no portal.
                                                </span>
                                            </li>
                                        </ul>

                                        <div className="border-t border-amber-200 dark:border-amber-800 pt-4 space-y-2">
                                            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                                                Quais consentimentos deseja revogar?
                                            </p>
                                            {([
                                                { key: 'ai',          checked: revokeAI,         setter: setRevokeAI,         label: 'Processamento por IA', desc: 'Bloqueia novas operações geradas por inteligência artificial', already: revokedConsents.consent_ai },
                                                { key: 'third_party', checked: revokeThirdParty, setter: setRevokeThirdParty, label: 'Compartilhamento com terceiros', desc: 'Impede o envio de dados a provedores externos de IA', already: revokedConsents.consent_third_party },
                                                { key: 'marketing',   checked: revokeMarketing,  setter: setRevokeMarketing,  label: 'Marketing por e-mail', desc: 'Cancela o recebimento de novidades e comunicações promocionais', already: revokedConsents.consent_marketing },
                                            ] as const).map(c => (
                                                <label key={c.key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${c.checked ? 'border-amber-400 bg-amber-100/50 dark:bg-amber-900/30' : 'border-amber-200 dark:border-amber-800 bg-white/50 dark:bg-amber-900/10'} ${c.already ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={c.checked || c.already}
                                                        onChange={(e) => !c.already && c.setter(e.target.checked)}
                                                        disabled={c.already || submitting}
                                                        className="mt-0.5 size-4 text-amber-600 focus:ring-amber-500 rounded"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="text-xs font-bold text-amber-900 dark:text-amber-200">{c.label}</p>
                                                        <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">{c.desc}</p>
                                                        {c.already && <p className="text-[10px] font-bold text-amber-600 mt-1">JÁ REVOGADO</p>}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>

                                        <p className="text-[11px] text-amber-700 dark:text-amber-400 italic flex items-start gap-1">
                                            <span className="material-symbols-outlined text-xs mt-0.5">info</span>
                                            A revogação será aplicada <strong>imediatamente</strong> após a confirmação (LGPD Art. 18 §3º).
                                        </p>
                                    </div>
                                ) : selectedRequest === 'grant_consent' ? (
                                    <div className="mb-4 space-y-4">
                                        <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-base">restart_alt</span>
                                            Reativar consentimento
                                        </p>
                                        <ul className="text-xs text-emerald-700 dark:text-emerald-300 space-y-2 leading-relaxed">
                                            <li className="flex items-start gap-2">
                                                <span className="material-symbols-outlined text-emerald-600 text-sm flex-shrink-0 mt-0.5">check_circle</span>
                                                <span>
                                                    <strong>Você concederá novamente as autorizações selecionadas</strong>, voltando a permitir as operações que estavam bloqueadas.
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="material-symbols-outlined text-emerald-600 text-sm flex-shrink-0 mt-0.5">support_agent</span>
                                                <span>
                                                    <strong>O profissional será notificado</strong> de que pode voltar a gerar operações para você.
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="material-symbols-outlined text-emerald-600 text-sm flex-shrink-0 mt-0.5">history</span>
                                                <span>
                                                    <strong>Você pode revogar novamente a qualquer momento</strong> abrindo uma nova solicitação.
                                                </span>
                                            </li>
                                        </ul>

                                        <div className="border-t border-emerald-200 dark:border-emerald-800 pt-4 space-y-2">
                                            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                                                Quais consentimentos deseja reativar?
                                            </p>
                                            {([
                                                { key: 'ai',          checked: grantAI,         setter: setGrantAI,         label: 'Processamento por IA', desc: 'Permite novamente que suas imagens sejam processadas por inteligência artificial', wasRevoked: revokedConsents.consent_ai },
                                                { key: 'third_party', checked: grantThirdParty, setter: setGrantThirdParty, label: 'Compartilhamento com terceiros', desc: 'Permite novamente o envio a provedores externos de IA', wasRevoked: revokedConsents.consent_third_party },
                                                { key: 'marketing',   checked: grantMarketing,  setter: setGrantMarketing,  label: 'Marketing por e-mail', desc: 'Volta a receber novidades e comunicações promocionais', wasRevoked: revokedConsents.consent_marketing },
                                            ] as const).map(c => (
                                                <label key={c.key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${c.checked ? 'border-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30' : 'border-emerald-200 dark:border-emerald-800 bg-white/50 dark:bg-emerald-900/10'} ${!c.wasRevoked ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={c.checked}
                                                        onChange={(e) => c.wasRevoked && c.setter(e.target.checked)}
                                                        disabled={!c.wasRevoked || submitting}
                                                        className="mt-0.5 size-4 text-emerald-600 focus:ring-emerald-500 rounded"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">{c.label}</p>
                                                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">{c.desc}</p>
                                                        {!c.wasRevoked && <p className="text-[10px] font-bold text-slate-500 mt-1">JÁ ATIVO</p>}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>

                                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 italic flex items-start gap-1">
                                            <span className="material-symbols-outlined text-xs mt-0.5">info</span>
                                            A reativação será aplicada <strong>imediatamente</strong> após a confirmação (LGPD Art. 8 §5º).
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm font-medium mb-4 text-slate-700 dark:text-slate-300">
                                        Sua solicitação será registrada e respondida em até 15 dias úteis, conforme previsto na LGPD.
                                    </p>
                                )}
                                <button
                                    onClick={handleSubmitRequest}
                                    disabled={submitting}
                                    className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                        selectedRequest === 'data_delete' ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20'
                                        : selectedRequest === 'revoke_consent' ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/20'
                                        : selectedRequest === 'grant_consent' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20'
                                        : 'bg-primary text-white shadow-lg shadow-primary/20 hover:brightness-110'
                                    } disabled:opacity-60`}
                                >
                                    {submitting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-base">
                                                {selectedRequest === 'grant_consent' ? 'check_circle' : 'send'}
                                            </span>
                                            {selectedRequest === 'revoke_consent' ? 'Confirmar revogação'
                                             : selectedRequest === 'grant_consent' ? 'Confirmar reativação'
                                             : 'Enviar Solicitação'}
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Info box */}
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 text-sm text-slate-500 dark:text-slate-400">
                            <p className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-slate-400 text-base mt-0.5 flex-shrink-0">info</span>
                                Para exercer seus direitos, podemos solicitar a verificação da sua identidade. As solicitações são processadas pela equipe RDC em até 15 dias úteis. Para dúvidas, entre em contato via{' '}
                                <a href="mailto:privacidade@exemplo.com.br" className="text-primary font-bold hover:underline">privacidade@exemplo.com.br</a>.
                            </p>
                        </div>
                    </>
                )}
            </div>
        </ClientLayout>
    );
};

export default ClientLgpd;
