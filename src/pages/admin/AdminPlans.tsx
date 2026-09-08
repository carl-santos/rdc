import { useEffect, useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { supabase } from '../../utils/supabase';

interface Plan {
    id: string;
    nome: string;
    preco_mensal: number;
    limite_operacoes_mes: number | null;
    limite_clientes: number | null;
}

interface EditForm {
    nome: string;
    preco_mensal: number;
    limite_operacoes_mes: number | null;
}

const AdminPlans = () => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({ nome: '', preco_mensal: 0, limite_operacoes_mes: null });
    const [saving, setSaving] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from('plans')
                .select('*')
                .order('preco_mensal', { ascending: true });
            if (error) throw error;
            setPlans(data || []);
        } catch (err) {
            console.error('Error fetching plans:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (plan: Plan) => {
        setEditingId(plan.id);
        setEditForm({
            nome: plan.nome,
            preco_mensal: plan.preco_mensal,
            limite_operacoes_mes: plan.limite_operacoes_mes,
        });
    };

    const handleCancel = () => setEditingId(null);

    const handleSave = async (id: string) => {
        setSaving(true);
        try {
            const { error } = await (supabase as any)
                .from('plans')
                .update({
                    nome: editForm.nome,
                    preco_mensal: editForm.preco_mensal,
                    limite_operacoes_mes: editForm.limite_operacoes_mes,
                })
                .eq('id', id);
            if (error) throw error;
            setEditingId(null);
            await fetchPlans();
        } catch (err) {
            console.error('Error saving plan:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleCreate = async () => {
        setCreating(true);
        try {
            const { data, error } = await (supabase as any)
                .from('plans')
                .insert({ nome: 'Novo Pacote', preco_mensal: 0, limite_operacoes_mes: 0 })
                .select()
                .single();
            if (error) throw error;
            await fetchPlans();
            handleEdit(data);
        } catch (err) {
            console.error('Error creating plan:', err);
        } finally {
            setCreating(false);
        }
    };

    return (
        <DashboardLayout title="Estratégia de Planos da Plataforma">
            <div className="space-y-10 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Empilhamento de Valor</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Configure os limites e precificação de cada camada B2B.</p>
                    </div>
                    <button
                        onClick={handleCreate}
                        disabled={creating}
                        className="bg-primary text-white px-8 py-4 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-lg">add_card</span>
                        {creating ? 'Criando...' : 'Criar Novo Pacote'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {loading ? (
                        <div className="col-span-full py-20 flex justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="col-span-full py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[3rem] text-center">
                            <span className="material-symbols-outlined text-6xl text-slate-200 mb-4 font-thin italic">inventory_2</span>
                            <p className="text-slate-400 font-black uppercase text-xs tracking-[0.3em]">Nenhum plano configurado no momento.</p>
                        </div>
                    ) : plans.map((plan) => {
                        const isEditing = editingId === plan.id;
                        return (
                            <div key={plan.id} className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden group hover:-translate-y-2 transition-all duration-500">
                                <div className="absolute -top-20 -right-20 size-60 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all" />

                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-8">
                                        <span className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 text-[10px] font-black uppercase rounded-full border border-slate-100 dark:border-slate-700">ID: {plan.id.substring(0, 8)}</span>
                                        <span className="material-symbols-outlined text-slate-200 dark:text-slate-800 text-4xl group-hover:text-primary transition-colors">verified</span>
                                    </div>

                                    {/* Nome */}
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editForm.nome}
                                            onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))}
                                            className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic w-full bg-slate-50 dark:bg-slate-800 border border-primary/30 rounded-2xl px-4 py-2 focus:outline-none focus:border-primary mb-2"
                                        />
                                    ) : (
                                        <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1 italic">{plan.nome}</h3>
                                    )}

                                    {/* Preço */}
                                    <div className="flex items-baseline gap-2 mt-6 mb-8">
                                        <span className="text-sm font-black text-slate-400 italic">R$</span>
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={editForm.preco_mensal}
                                                onChange={e => setEditForm(f => ({ ...f, preco_mensal: Number(e.target.value) }))}
                                                className="text-5xl font-black text-primary tracking-tighter leading-none w-36 bg-slate-50 dark:bg-slate-800 border border-primary/30 rounded-2xl px-4 py-2 focus:outline-none focus:border-primary"
                                            />
                                        ) : (
                                            <span className="text-6xl font-black text-primary tracking-tighter leading-none">{plan.preco_mensal}</span>
                                        )}
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">/ mensal</span>
                                    </div>

                                    {/* Operações */}
                                    <div className="mb-10 border-t border-slate-50 dark:border-slate-800 pt-8">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Operações / Mês</p>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editForm.limite_operacoes_mes ?? ''}
                                                    onChange={e => setEditForm(f => ({ ...f, limite_operacoes_mes: e.target.value ? Number(e.target.value) : null }))}
                                                    placeholder="Ilimitado"
                                                    className="text-lg font-black text-slate-900 dark:text-white w-28 text-right bg-white dark:bg-slate-700 border border-primary/30 rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary"
                                                />
                                            ) : (
                                                <p className="text-lg font-black text-slate-900 dark:text-white leading-none italic uppercase">
                                                    {plan.limite_operacoes_mes ?? 'Ilimitado'}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Botões */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {isEditing ? (
                                            <>
                                                <button
                                                    onClick={() => handleSave(plan.id)}
                                                    disabled={saving}
                                                    className="py-4 bg-primary text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    <span className="material-symbols-outlined text-sm">save</span>
                                                    {saving ? 'Salvando...' : 'Salvar'}
                                                </button>
                                                <button
                                                    onClick={handleCancel}
                                                    className="py-4 border-2 border-slate-200 dark:border-slate-700 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                    Cancelar
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleEdit(plan)}
                                                    className="py-4 bg-slate-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:brightness-125 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-sm text-primary">edit</span>
                                                    Editar
                                                </button>
                                                <button className="py-4 border-2 border-slate-50 dark:border-slate-800 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center justify-center gap-2">
                                                    <span className="material-symbols-outlined text-sm">archive</span>
                                                    Arquivar
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Platform Policy Alert */}
                <div className="bg-primary/5 border border-primary/20 p-8 rounded-[3rem] flex flex-col md:flex-row items-center gap-8 justify-between">
                    <div className="flex items-center gap-6">
                        <div className="size-16 bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-3xl">policy</span>
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-primary uppercase tracking-tighter">Políticas de Cobrança</h4>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest max-w-xl">Qualquer alteração nos valores afetará apenas novas assinaturas. Assinantes antigos mantêm o "Price Lock" de acordo com o contrato inicial.</p>
                        </div>
                    </div>
                    <button className="px-8 py-3 bg-white dark:bg-slate-800 text-primary border border-primary/10 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-primary hover:text-white transition-all">Ver Contrato Padrão</button>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default AdminPlans;
