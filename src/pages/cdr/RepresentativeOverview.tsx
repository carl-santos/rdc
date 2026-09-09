import { FormEvent, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useToast } from '../../components/Toast';
import { useAuditLog } from '../../hooks/useAuditLog';
import { AUTONOMY_HINTS, AUTONOMY_LABELS, CdrAutonomy, DigitalRepresentative, MODE_HINTS, MODE_ICONS, MODE_LABELS, CdrSessionMode } from '../../types/cdr';
import { sessionPath } from '../../hooks/useCdr';

interface OutletCtx {
    representative: DigitalRepresentative;
    reload: () => void;
}

const RepresentativeOverview = () => {
    const { representative, reload } = useOutletContext<OutletCtx>();
    const showToast = useToast();
    const { logEvent } = useAuditLog();
    const [form, setForm] = useState({
        nome: representative.nome,
        descricao: representative.descricao ?? '',
        persona: representative.persona ?? '',
        instrucoes: representative.instrucoes ?? '',
        autonomia: representative.autonomia as CdrAutonomy,
        ativo: representative.ativo,
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm({
            nome: representative.nome,
            descricao: representative.descricao ?? '',
            persona: representative.persona ?? '',
            instrucoes: representative.instrucoes ?? '',
            autonomia: representative.autonomia as CdrAutonomy,
            ativo: representative.ativo,
        });
    }, [representative]);

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const { error } = await supabase.from('digital_representatives').update({
            nome: form.nome.trim(),
            descricao: form.descricao.trim() || null,
            persona: form.persona.trim() || null,
            instrucoes: form.instrucoes.trim() || null,
            autonomia: form.autonomia,
            ativo: form.ativo,
        }).eq('id', representative.id);
        setSaving(false);

        if (error) {
            showToast(error.message, 'error');
            return;
        }
        logEvent({
            event_type: 'cdr_updated',
            action: 'Atualizou representante digital',
            category: 'cdr',
            resource_type: 'digital_representative',
            resource_id: representative.id,
        });
        showToast('Configurações salvas.', 'success');
        reload();
    };

    const modes: CdrSessionMode[] = ['chat', 'presentation', 'class', 'meeting'];

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 grid gap-4">
                <h2 className="text-lg font-bold">Configuração do representante</h2>
                <label className="block">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Nome</span>
                    <input
                        required
                        maxLength={120}
                        value={form.nome}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5"
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
                    />
                </label>
                <label className="block">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Persona</span>
                    <textarea
                        maxLength={4000}
                        rows={4}
                        value={form.persona}
                        onChange={(e) => setForm({ ...form, persona: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5"
                    />
                </label>
                <label className="block">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Instruções e limites éticos</span>
                    <textarea
                        maxLength={8000}
                        rows={4}
                        value={form.instrucoes}
                        onChange={(e) => setForm({ ...form, instrucoes: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5"
                    />
                </label>
                <label className="block">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Nível de autonomia</span>
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
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={form.ativo}
                        onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                    />
                    Representante ativo
                </label>
                <button
                    type="submit"
                    disabled={saving}
                    className="justify-self-start bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50"
                >
                    {saving ? 'Salvando…' : 'Salvar'}
                </button>
            </form>

            <aside className="space-y-3">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Modos de uso</h2>
                {modes.map((mode) => (
                    <Link
                        key={mode}
                        to={sessionPath(representative.id, mode)}
                        className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-primary transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">{MODE_ICONS[mode]}</span>
                            <span className="font-bold text-sm">{MODE_LABELS[mode]}</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500 leading-relaxed">{MODE_HINTS[mode]}</p>
                    </Link>
                ))}
            </aside>
        </div>
    );
};

export default RepresentativeOverview;
