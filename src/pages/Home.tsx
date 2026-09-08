import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PlanCardSkeleton } from '../components/Skeleton';

interface Plan {
    id: string;
    nome: string;
    preco_mensal: number;
    limite_operacoes_mes: number | null;
}

const recursos = [
    {
        icone: 'apartment',
        titulo: 'Multi-tenant de verdade',
        texto: 'Cada assinante enxerga apenas os proprios dados. O isolamento e garantido por Row Level Security no banco, nao por checagem no frontend.',
    },
    {
        icone: 'shield_person',
        titulo: 'Tres perfis de acesso',
        texto: 'Administrador da plataforma, equipe do assinante e cliente final, cada um com seu portal e suas rotas protegidas.',
    },
    {
        icone: 'payments',
        titulo: 'Assinatura e creditos',
        texto: 'Planos com limite mensal, compra de creditos avulsos, webhook de pagamento e bloqueio automatico quando a assinatura vence.',
    },
    {
        icone: 'support_agent',
        titulo: 'Suporte com triagem por IA',
        texto: 'Chamados com classificacao automatica, deteccao de duplicidade, base de conhecimento com busca full-text e chatbot por fluxos.',
    },
    {
        icone: 'policy',
        titulo: 'LGPD operacional',
        texto: 'Central de solicitacoes para acesso, portabilidade, revogacao de consentimento e exclusao, com exports em bucket privado.',
    },
    {
        icone: 'manage_search',
        titulo: 'Auditoria',
        texto: 'Registro de acessos e acoes sensiveis com categoria, severidade, IP e user-agent, com retencao configuravel.',
    },
];

const Home = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, profile, loading: authLoading } = useAuth();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [plansError, setPlansError] = useState(false);

    // Redireciona usuario autenticado para o painel correspondente ao seu papel.
    // Nao redireciona quando ha convite pendente: o InviteRedirect cuida disso.
    useEffect(() => {
        if (!authLoading && user) {
            const pendingInvite = sessionStorage.getItem('app_auth_link_type') === 'invite';
            if (pendingInvite) return;
            const role = user.user_metadata?.role || (profile as any)?.role;
            navigate(role === 'client' ? '/cliente/dashboard' : '/dashboard', { replace: true });
        }
    }, [user, authLoading, profile, navigate]);

    useEffect(() => {
        let cancelled = false;
        const fetchPlans = async () => {
            setPlansLoading(true);
            setPlansError(false);
            try {
                const { data, error } = await supabase
                    .from('plans')
                    .select('id, nome, preco_mensal, limite_operacoes_mes')
                    .order('preco_mensal', { ascending: true });
                if (cancelled) return;
                if (error) throw error;
                if (data) setPlans(data);
            } catch {
                if (!cancelled) setPlansError(true);
            } finally {
                if (!cancelled) setPlansLoading(false);
            }
        };
        fetchPlans();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (location.hash) {
            const id = location.hash.replace('#', '');
            const element = document.getElementById(id);
            if (element) {
                const timer = setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth' });
                }, 100);
                return () => clearTimeout(timer);
            }
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [location]);

    return (
        <div className="bg-white dark:bg-background-dark">
            <Header />

            <main className="pt-20">
                {/* Hero */}
                <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
                    <div className="max-w-3xl">
                        <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-4">
                            Base de aplicacao SaaS
                        </span>
                        <h1 className="text-4xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.1]">
                            O trabalho chato do SaaS, ja resolvido.
                        </h1>
                        <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                            Multi-tenant com RLS, tres perfis de acesso, cobranca recorrente, suporte,
                            auditoria e LGPD. Comece pelo que diferencia o seu produto, nao pela
                            quinta vez que voce escreve uma tela de login.
                        </p>
                        <div className="mt-10 flex flex-wrap items-center gap-4">
                            <Link
                                to="/cadastro"
                                className="bg-primary text-white px-7 py-3.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/25 hover:brightness-110 transition-all active:scale-[0.98]"
                            >
                                Criar conta
                            </Link>
                            <Link
                                to="/login"
                                className="px-7 py-3.5 rounded-lg font-bold text-sm border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary transition-colors"
                            >
                                Entrar
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Recursos */}
                <section id="como-funciona" className="border-y border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
                        <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                            O que ja vem pronto
                        </h2>
                        <p className="mt-4 text-slate-600 dark:text-slate-300 max-w-2xl">
                            Cada item abaixo esta implementado, com politica de acesso no banco e
                            interface correspondente.
                        </p>

                        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                            {recursos.map((r) => (
                                <div key={r.titulo} className="bg-white dark:bg-slate-900 rounded-2xl p-7 border border-slate-200 dark:border-slate-800">
                                    <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-5">
                                        <span className="material-symbols-outlined text-primary text-2xl">{r.icone}</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{r.titulo}</h3>
                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{r.texto}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Beneficios */}
                <section id="beneficios" className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
                    <div className="grid lg:grid-cols-2 gap-14 items-start">
                        <div>
                            <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                Seguranca que nao depende do frontend
                            </h2>
                            <p className="mt-5 text-slate-600 dark:text-slate-300 leading-relaxed">
                                O isolamento entre assinantes vive no banco. Toda tabela tem RLS
                                habilitado, os helpers de policy usam SECURITY DEFINER com search_path
                                fixo, e os buckets de arquivo sao privados, acessados por URL assinada.
                            </p>
                            <p className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed">
                                Um usuario nao consegue elevar o proprio papel nem trocar de tenant:
                                um trigger em profiles bloqueia essas colunas para quem nao e
                                administrador.
                            </p>
                        </div>
                        <div className="bg-slate-900 dark:bg-black rounded-2xl p-7 border border-slate-800">
                            <p className="text-xs font-mono text-slate-500 mb-4">policy de isolamento</p>
                            <pre className="text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto"><code>{`CREATE POLICY clients_tenant_manage
  ON public.clients
  FOR ALL TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
    AND public.is_tenant_professional()
  );`}</code></pre>
                        </div>
                    </div>
                </section>

                {/* Precos */}
                <section id="precos" className="border-y border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
                        <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                            Planos
                        </h2>
                        <p className="mt-4 text-slate-600 dark:text-slate-300">
                            Os planos abaixo vem do seed da baseline. Ajuste em Admin, Planos.
                        </p>

                        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                            {plansLoading && <><PlanCardSkeleton /><PlanCardSkeleton /><PlanCardSkeleton /></>}

                            {!plansLoading && plansError && (
                                <p className="text-sm text-slate-500">
                                    Nao foi possivel carregar os planos agora.
                                </p>
                            )}

                            {!plansLoading && !plansError && plans.map((plan) => (
                                <div key={plan.id} className="bg-white dark:bg-slate-900 rounded-2xl p-7 border border-slate-200 dark:border-slate-800 flex flex-col">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.nome}</h3>
                                    <p className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
                                        R$ {Number(plan.preco_mensal).toFixed(2).replace('.', ',')}
                                        <span className="text-sm font-medium text-slate-500">/mes</span>
                                    </p>
                                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                                        {plan.limite_operacoes_mes ?? 0} operacoes por mes
                                    </p>
                                    <Link
                                        to="/cadastro"
                                        className="mt-7 text-center bg-primary text-white py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all"
                                    >
                                        Comecar
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Sobre */}
                <section id="sobre" className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
                    <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                        Sobre esta base
                    </h2>
                    <p className="mt-5 max-w-3xl text-slate-600 dark:text-slate-300 leading-relaxed">
                        Esta e a fundacao extraida de um SaaS em producao: React com Vite e
                        TypeScript no frontend, Supabase no backend, Edge Functions em Deno para
                        cobranca, convites, auditoria e LGPD. Substitua este texto e as demais
                        secoes pelo posicionamento do seu produto.
                    </p>
                </section>
            </main>

            <Footer />
        </div>
    );
};

export default Home;
