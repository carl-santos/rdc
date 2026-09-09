import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { useTenantGate } from '../../hooks/useTenantGate';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useRepresentatives } from '../../hooks/useRepresentatives';
import { AUTONOMY_HINTS, AUTONOMY_LABELS, CdrAutonomy } from '../../types/cdr';

const emptyForm = {
    nome: '',
    descricao: '',
    persona: '',
    instrucoes: '',
    autonomia: 'assisted' as CdrAutonomy,
};

const Representatives = () => {
    const { tenant, user } = useAuth();
    const showToast = useToast();
    const { isBlocked, message: blockedMessage } = useTenantGate();
    const { logEvent } = useAuditLog();
    const { data: representatives = [], isLoading, refetch } = useRepresentatives();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        if (!tenant?.id || !form.nome.trim()) return;

        setSaving(true);
        const { data, error } = await supabase.from('digital_representatives').insert({
            tenant_id: tenant.id,
            created_by: user?.id ?? null,
            nome: form.nome.trim(),
            descricao: form.descricao.trim() || null,
            persona: form.persona.trim() || null,
            instrucoes: form.instrucoes.trim() || null,
            autonomia: form.autonomia,
        }).select('id').maybeSingle();
        setSaving(false);

        if (error) {
            showToast(error.message, 'error');
            return;
        }

        logEvent({
            event_type: 'cdr_created',
            action: 'Criou representante digital',
            category: 'cdr',
            resource_type: 'digital_representative',
            resource_id: data?.id ?? null,
        });
        showToast('Representante criado.', 'success');
        setForm(emptyForm);
        setIsFormOpen(false);
        refetch();
    };

    return (
        <DashboardLayout title="Representantes">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Representantes digitais</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Treine um RDC com o seu conhecimento para apoiar apresentações, aulas e reuniões.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsFormOpen((o) => !o)}
                        disabled={isBlocked}
                        className="bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/25 hover:brightness-110 disabled:opacity-50"
                    >
                        {isFormOpen ? 'Cancelar' : 'Novo representante'}
                    </button>
                </div>

                {isBlocked && (
                    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                        {blockedMessage}
                    </div>
                )}

                {isFormOpen && (
                    <form
                        onSubmit={handleCreate}
                        className="mb-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 grid gap-4"
                    >
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Nome</span>
                            <input
                                required
                                maxLength={120}
                                value={form.nome}
                                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5"
                                placeholder="Ex.: Prof. Ana — disciplina de IA"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Descrição</span>
                            <textarea
                                maxLength={2000}
                                rows={2}
                                value={form.descricao}
                                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5"
                                placeholder="Para que este representante existe?"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Persona</span>
                            <textarea
                                maxLength={4000}
                                rows={3}
                                value={form.persona}
                                onChange={(e) => setForm({ ...form, persona: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5"
                                placeholder="Como ele deve se comunicar? Tom, vocabulário, limites."
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Instruções</span>
                            <textarea
                                maxLength={8000}
                                rows={3}
                                value={form.instrucoes}
                                onChange={(e) => setForm({ ...form, instrucoes: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5"
                                placeholder="O que nunca deve fazer, fontes autorizadas, avisos éticos."
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Autonomia</span>
                            <select
                                value={form.autonomia}
                                onChange={(e) => setForm({ ...form, autonomia: e.target.value as CdrAutonomy })}
                                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5"
                            >
                                {(Object.keys(AUTONOMY_LABELS) as CdrAutonomy[]).map((key) => (
                                    <option key={key} value={key}>{AUTONOMY_LABELS[key]}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">{AUTONOMY_HINTS[form.autonomia]}</p>
                        </label>
                        <button
                            type="submit"
                            disabled={saving || isBlocked}
                            className="justify-self-start bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50"
                        >
                            {saving ? 'Salvando…' : 'Criar'}
                        </button>
                    </form>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
                    </div>
                ) : representatives.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                        <span className="material-symbols-outlined text-primary text-4xl">psychology</span>
                        <h2 className="mt-4 text-xl font-bold">Nenhum representante ainda</h2>
                        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
                            Crie o primeiro RDC e envie documentos para formar a base de conhecimento.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {representatives.map((cdr) => (
                            <Link
                                key={cdr.id}
                                to={`/representantes/${cdr.id}`}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:border-primary transition-colors"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="bg-primary/10 size-10 rounded-lg flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary">psychology</span>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                                        cdr.ativo
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                            : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {cdr.ativo ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                                <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{cdr.nome}</h2>
                                <p className="mt-1 text-sm text-slate-500 line-clamp-2">{cdr.descricao || 'Sem descrição'}</p>
                                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                    {AUTONOMY_LABELS[cdr.autonomia as CdrAutonomy] ?? cdr.autonomia}
                                </p>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default Representatives;
