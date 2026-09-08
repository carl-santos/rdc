import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Database } from '../types/database';
import { useToast } from '../components/Toast';

type Profile = Database['public']['Tables']['profiles']['Row'];

const Teams = () => {
    const { tenant, profile: currentProfile } = useAuth();
    const showToast = useToast();
    const [members, setMembers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<Profile | null>(null);
    const [memberToDelete, setMemberToDelete] = useState<Profile | null>(null);

    // Invite Form States
    const [inviteForm, setInviteForm] = useState({
        email: '',
        nome: '',
        cargo: '',
        role: 'collaborator' as 'collaborator' | 'tenant_admin',
    });
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteToast, setInviteToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    // Edit Form States
    const [editFormData, setEditFormData] = useState({ cargo: '', role: '' as Profile['role'] });

    useEffect(() => {
        if (tenant?.id) {
            fetchMembers(tenant.id);
        }
    }, [tenant?.id]);

    const fetchMembers = async (tenantId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('tenant_id' as any, tenantId as any)
                .in('role' as any, ['tenant_admin', 'collaborator'] as any)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMembers((data as any) || []);
        } catch (err) {
            console.error('Error fetching team members:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEditModal = (member: Profile) => {
        setEditingMember(member);
        setEditFormData({
            cargo: member.cargo || '',
            role: (member.role as any) || 'collaborator'
        });
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteForm.email || !inviteForm.nome) return;
        setInviteLoading(true);
        setInviteToast(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-team-member`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify({ ...inviteForm, redirectTo: window.location.origin }),
                }
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Erro ao enviar convite');
            setInviteToast({ type: 'success', msg: `Convite enviado para ${inviteForm.email}!` });
            setInviteForm({ email: '', nome: '', cargo: '', role: 'collaborator' });
            setTimeout(() => { setIsInviteModalOpen(false); setInviteToast(null); }, 2500);
        } catch (err: any) {
            setInviteToast({ type: 'error', msg: err.message });
        } finally {
            setInviteLoading(false);
        }
    };

    const handleUpdateMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMember) return;

        setActionLoading(true);
        try {
            const { error } = await supabase.rpc('update_team_member' as any, {
                member_id: editingMember.id,
                new_cargo: editFormData.cargo || '',
                new_role: editFormData.role || 'collaborator',
            });

            if (error) throw error;
            showToast(`Permissões de ${editingMember.nome} atualizadas com sucesso.`, 'success');
            setEditingMember(null);
            if (tenant?.id) fetchMembers(tenant.id);
        } catch (err: any) {
            showToast('Erro ao atualizar membro: ' + err.message, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteMember = async () => {
        if (!memberToDelete) return;

        setActionLoading(true);
        try {
            const { error } = await supabase.rpc('revoke_team_member' as any, {
                member_id: memberToDelete.id,
            });

            if (error) throw error;
            showToast(`Acesso de ${memberToDelete.nome} revogado com sucesso.`, 'success');
            setMemberToDelete(null);
            if (tenant?.id) fetchMembers(tenant.id);
        } catch (err: any) {
            showToast('Erro ao remover membro: ' + err.message, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const filteredMembers = useMemo(() => {
        return members.filter(m => {
            const search = searchTerm.toLowerCase();
            return (
                m.nome.toLowerCase().includes(search) ||
                m.email.toLowerCase().includes(search) ||
                m.cargo?.toLowerCase().includes(search)
            );
        });
    }, [members, searchTerm]);

    const stats = useMemo(() => {
        return {
            total: members.length,
            admins: members.filter(m => m.role === 'tenant_admin').length,
            collaborators: members.filter(m => m.role === 'collaborator').length
        };
    }, [members]);

    const getRoleBadge = (role: string | null) => {
        switch (role) {
            case 'tenant_admin':
                return (
                    <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-primary/10 text-primary border border-primary/20">
                        Administrador
                    </span>
                );
            case 'collaborator':
                return (
                    <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                        Colaborador
                    </span>
                );
            default:
                return (
                    <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-slate-100 text-slate-400 italic">
                        Sem Acesso
                    </span>
                );
        }
    };

    return (
        <DashboardLayout title="Gestão de Equipe">
            <div className="max-w-[1200px] mx-auto space-y-12 py-6 text-left animate-in fade-in duration-500">
                <header className="flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="space-y-2">
                        <h1 className="text-5xl font-black uppercase tracking-tighter italic leading-tight">Gestão de Integrantes</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Controle os níveis de acesso e permissões da sua equipe.</p>
                    </div>
                    {currentProfile?.role === 'tenant_admin' && (
                        <button
                            onClick={() => setIsInviteModalOpen(true)}
                            className="bg-primary text-slate-950 px-8 h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-3"
                        >
                            <span className="material-symbols-outlined text-xl">person_add</span>
                            Adicionar Novo Membro
                        </button>
                    )}
                </header>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { label: 'Total da Equipe', val: stats.total, icon: 'groups', color: 'primary' },
                        { label: 'Administradores', val: stats.admins, icon: 'admin_panel_settings', color: 'primary' },
                        { label: 'Colaboradores', val: stats.collaborators, icon: 'badge', color: 'slate' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none group-hover:scale-125 transition-transform duration-700">
                                <span className="material-symbols-outlined text-8xl">{s.icon}</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">{s.label}</p>
                            <p className={`text-4xl font-black ${s.color === 'primary' ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{s.val}</p>
                        </div>
                    ))}
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="relative w-full max-w-md group">
                            <span className="absolute inset-y-0 left-5 flex items-center text-slate-400 group-focus-within:text-primary transition-colors">
                                <span className="material-symbols-outlined">search</span>
                            </span>
                            <input
                                type="text"
                                className="block w-full h-14 pl-14 pr-6 border-2 border-slate-50 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none uppercase tracking-widest placeholder:text-slate-300"
                                placeholder="Buscar por nome ou email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none overflow-hidden">
                        {loading ? (
                            <div className="p-20 flex justify-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
                            </div>
                        ) : (
                            <>
                            {/* Mobile: cards empilhados (evita a tabela com scroll horizontal) */}
                            <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800/50">
                                {filteredMembers.map((member) => (
                                    <div key={member.id} className="p-5 flex items-start gap-4">
                                        <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                                            {member.id === currentProfile?.id ? (
                                                <span className="material-symbols-outlined text-primary font-black">person_filled</span>
                                            ) : (
                                                <span className="material-symbols-outlined">person</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{member.nome}</p>
                                                {member.id === currentProfile?.id && (
                                                    <span className="bg-primary/20 text-primary text-[8px] px-2 py-0.5 rounded-full font-black italic shrink-0">VOCÊ</span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-400 font-medium truncate">{member.email}</p>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                {getRoleBadge(member.role)}
                                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 italic uppercase">{member.cargo || 'Profissional'}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            {currentProfile?.role === 'tenant_admin' && member.id !== currentProfile.id && (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleOpenEditModal(member)}
                                                        className="size-10 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                                        title="Editar Permissões"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">settings</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setMemberToDelete(member)}
                                                        className="size-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                                        title="Remover Membro"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">person_remove</span>
                                                    </button>
                                                </div>
                                            )}
                                            {member.id === currentProfile?.id && (
                                                <span className="text-[9px] font-black text-slate-300 uppercase italic">Proprietário</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Desktop: tabela */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Membro da Equipe</th>
                                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Cargo / Especialidade</th>
                                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Permissão</th>
                                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {filteredMembers.map((member) => (
                                            <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                                                <td className="px-10 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 border-2 border-white dark:border-slate-800 shadow-sm group-hover:border-primary transition-all">
                                                            {member.id === currentProfile?.id ? (
                                                                <span className="material-symbols-outlined text-primary font-black">person_filled</span>
                                                            ) : (
                                                                <span className="material-symbols-outlined">person</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center">
                                                                {member.nome}
                                                                {member.id === currentProfile?.id && (
                                                                    <span className="ml-3 bg-primary/20 text-primary text-[8px] px-2 py-0.5 rounded-full font-black italic">VOCÊ</span>
                                                                )}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 font-medium">{member.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-6 text-sm font-bold text-slate-600 dark:text-slate-300 italic uppercase">
                                                    {member.cargo || 'Profissional'}
                                                </td>
                                                <td className="px-10 py-6">
                                                    {getRoleBadge(member.role)}
                                                </td>
                                                <td className="px-10 py-6 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {currentProfile?.role === 'tenant_admin' && member.id !== currentProfile.id && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleOpenEditModal(member)}
                                                                    className="size-11 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                                                    title="Editar Permissões"
                                                                >
                                                                    <span className="material-symbols-outlined text-xl">settings</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => setMemberToDelete(member)}
                                                                    className="size-11 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                                                    title="Remover Membro"
                                                                >
                                                                    <span className="material-symbols-outlined text-xl">person_remove</span>
                                                                </button>
                                                            </>
                                                        )}
                                                        {member.id === currentProfile?.id && (
                                                            <span className="text-[10px] font-black text-slate-300 uppercase italic px-4">Proprietário</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Invite Modal */}
                {isInviteModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !inviteLoading && setIsInviteModalOpen(false)} />
                        <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500">

                            {/* Header */}
                            <div className="px-10 pt-10 pb-6 text-center">
                                <div className="size-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-5">
                                    <span className="material-symbols-outlined text-3xl">person_add</span>
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Adicionar Membro</h2>
                                <p className="text-slate-500 text-sm font-medium mt-2">Preencha os dados e enviaremos um convite por e-mail.</p>
                            </div>

                            {/* Toast */}
                            {inviteToast && (
                                <div className={`mx-8 mb-4 flex items-center gap-3 px-5 py-3 rounded-2xl text-white text-sm font-bold ${inviteToast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                    <span className="material-symbols-outlined text-lg">{inviteToast.type === 'success' ? 'check_circle' : 'error'}</span>
                                    {inviteToast.msg}
                                </div>
                            )}

                            {/* Form */}
                            <form onSubmit={handleInvite} className="px-10 pb-10 space-y-5">

                                {/* Nome */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nome Completo *</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full h-13 px-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-primary rounded-2xl font-bold text-sm transition-all outline-none"
                                        placeholder="Dr. João Silva"
                                        value={inviteForm.nome}
                                        onChange={e => setInviteForm({ ...inviteForm, nome: e.target.value })}
                                        disabled={inviteLoading}
                                    />
                                </div>

                                {/* Email */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">E-mail *</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full h-13 px-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-primary rounded-2xl font-bold text-sm transition-all outline-none"
                                        placeholder="joao@clinica.com"
                                        value={inviteForm.email}
                                        onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                                        disabled={inviteLoading}
                                    />
                                </div>

                                {/* Cargo */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Cargo / Especialidade</label>
                                    <input
                                        type="text"
                                        className="w-full h-13 px-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-primary rounded-2xl font-bold text-sm transition-all outline-none"
                                        placeholder="Ex: Nutricionista, Médico, Recepcionista..."
                                        value={inviteForm.cargo}
                                        onChange={e => setInviteForm({ ...inviteForm, cargo: e.target.value })}
                                        disabled={inviteLoading}
                                    />
                                </div>

                                {/* Função / Permissão */}
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nível de Acesso</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {[
                                            { id: 'collaborator', label: 'Colaborador', desc: 'Acesso a fichas e operações.', icon: 'person' },
                                            { id: 'tenant_admin', label: 'Administrador', desc: 'Controle total da empresa.', icon: 'shield_person' },
                                        ].map(r => (
                                            <button
                                                key={r.id}
                                                type="button"
                                                disabled={inviteLoading}
                                                onClick={() => setInviteForm({ ...inviteForm, role: r.id as any })}
                                                className={`p-4 text-left rounded-2xl border-2 transition-all flex items-start gap-3 ${
                                                    inviteForm.role === r.id
                                                        ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                                                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'
                                                }`}
                                            >
                                                <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                                    inviteForm.role === r.id ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                                }`}>
                                                    <span className="material-symbols-outlined text-base">{r.icon}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-[11px] font-black uppercase tracking-widest ${inviteForm.role === r.id ? 'text-primary' : 'text-slate-600 dark:text-slate-300'}`}>{r.label}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{r.desc}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsInviteModalOpen(false)}
                                        disabled={inviteLoading}
                                        className="flex-1 h-13 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={inviteLoading || !inviteForm.email || !inviteForm.nome}
                                        className="flex-1 h-13 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-primary text-slate-950 shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {inviteLoading ? (
                                            <><span className="animate-spin material-symbols-outlined text-base">progress_activity</span> Enviando...</>
                                        ) : (
                                            <><span className="material-symbols-outlined text-base">send</span> Enviar Convite</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Member Modal */}
                {editingMember && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={() => setEditingMember(null)}></div>
                        <div className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                            <div className="px-10 py-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/30">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Configurações de Acesso</h3>
                                <button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-slate-950 transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <form onSubmit={handleUpdateMember} className="p-12 space-y-10">
                                <div className="flex items-center gap-6 p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
                                    <div className="size-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border-2 border-white dark:border-slate-900 shadow-sm">
                                        <span className="material-symbols-outlined text-3xl font-black">badge</span>
                                    </div>
                                    <div>
                                        <p className="font-black text-2xl text-slate-900 dark:text-white uppercase tracking-tighter italic leading-none">{editingMember.nome}</p>
                                        <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-2">{editingMember.email}</p>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Cargo / Especialidade</label>
                                        <input
                                            className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-primary rounded-2xl font-bold text-sm outline-none transition-all shadow-inner"
                                            value={editFormData.cargo}
                                            onChange={(e) => setEditFormData({ ...editFormData, cargo: e.target.value })}
                                            placeholder="Ex: Nutricionista, Médico, Secretária..."
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Nível de Permissão</label>
                                        <div className="grid grid-cols-1 gap-3">
                                            {[
                                                { id: 'collaborator', label: 'Colaborador', desc: 'Acesso às fichas e operações de clientes.', icon: 'person' },
                                                { id: 'tenant_admin', label: 'Administrador', desc: 'Controle total da empresa, faturamento e equipe.', icon: 'shield_person' }
                                            ].map((r) => (
                                                <button
                                                    key={r.id}
                                                    type="button"
                                                    onClick={() => setEditFormData({ ...editFormData, role: r.id as any })}
                                                    className={`p-6 text-left rounded-[2rem] border-2 transition-all flex items-center gap-5 ${editFormData.role === r.id
                                                        ? 'border-primary bg-primary/5 shadow-lg shadow-primary/5'
                                                        : 'border-slate-50 dark:border-slate-800 hover:border-slate-100 dark:hover:border-slate-700'}`}
                                                >
                                                    <div className={`size-12 rounded-xl flex items-center justify-center transition-colors ${editFormData.role === r.id ? 'bg-primary text-slate-950' : 'bg-slate-50 dark:bg-slate-800 text-slate-300'}`}>
                                                        <span className="material-symbols-outlined">{r.icon}</span>
                                                    </div>
                                                    <div>
                                                        <p className={`text-xs font-black uppercase tracking-widest ${editFormData.role === r.id ? 'text-primary' : 'text-slate-600'}`}>{r.label}</p>
                                                        <p className="text-[10px] text-slate-400 mt-1 font-medium">{r.desc}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setEditingMember(null)}
                                        className="h-14 px-8 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        Descartar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="flex-1 bg-primary text-slate-950 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {actionLoading ? 'Processando...' : 'Confirmar Alterações'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {memberToDelete && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setMemberToDelete(null)}></div>
                        <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-12 text-center animate-in zoom-in slide-in-from-bottom-8 duration-500">
                            <div className="size-24 bg-red-100 dark:bg-red-500/10 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 transition-transform hover:scale-110 duration-500">
                                <span className="material-symbols-outlined text-6xl font-black">person_remove</span>
                            </div>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tighter italic">Revogar Acesso?</h3>
                            <p className="text-slate-500 font-medium mb-12 max-w-sm mx-auto leading-relaxed">
                                Tem certeza que deseja remover <b>{memberToDelete.nome}</b>? Este profissional perderá o acesso imediato aos dados dos clientes e às operações desta unidade.
                            </p>
                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={handleDeleteMember}
                                    disabled={actionLoading}
                                    className="w-full h-16 text-[11px] font-black bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all shadow-2xl shadow-red-600/20 active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em]"
                                >
                                    {actionLoading ? 'Processando...' : 'Sim, Revogar Acesso Agora'}
                                </button>
                                <button
                                    onClick={() => setMemberToDelete(null)}
                                    className="w-full py-4 text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors"
                                >
                                    Não, manter profissional
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default Teams;
