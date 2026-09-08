import Header from '../components/Header';
import Footer from '../components/Footer';

const PrivacyPolicy = () => {
    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <Header />
            <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row gap-8 max-w-[1440px] mx-auto animate-in fade-in duration-700">
                {/* Specialized Sidebar for Privacy Policy */}
                <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-24 h-fit space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">Sumário do Documento</h3>
                        <nav className="space-y-1">
                            {[
                                { id: 'introducao', icon: 'info', label: 'Introdução' },
                                { id: 'dados', icon: 'database', label: 'Dados Coletados' },
                                { id: 'finalidade', icon: 'settings_accessibility', label: 'Finalidade' },
                                { id: 'direitos', icon: 'gavel', label: 'Seus Direitos (LGPD)' },
                                { id: 'seguranca', icon: 'lock', label: 'Segurança' },
                                { id: 'contato', icon: 'alternate_email', label: 'Contato' },
                            ].map((item) => (
                                <a
                                    key={item.id}
                                    href={`#${item.id}`}
                                    className="flex items-center gap-4 px-5 py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-400 font-black text-xs uppercase tracking-tight group"
                                >
                                    <span className="material-symbols-outlined text-xl group-hover:text-primary transition-colors">{item.icon}</span>
                                    {item.label}
                                </a>
                            ))}
                        </nav>

                        <div className="mt-10 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                            <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">verified_user</span>
                                Compliance LGPD
                            </p>
                            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                                A SaaS Foundation criptografa os dados em repouso (AES-256) e em trânsito (TLS 1.3), com isolamento por linha (RLS) e imagens biométricas armazenadas em buckets privados.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                        <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-4">Tempo de leitura</h4>
                        <div className="flex items-center gap-4">
                            <div className="size-14 rounded-full border-4 border-primary/20 border-t-primary flex items-center justify-center text-xs font-black">
                                8 min
                            </div>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-tight">Documento detalhado para total transparência.</p>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-[3rem] p-10 md:p-16 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left relative">
                    <div className="absolute top-0 right-0 p-16 opacity-[0.03] pointer-events-none">
                        <span className="material-symbols-outlined text-[15rem]">gavel</span>
                    </div>

                    <div className="mb-12 border-b border-slate-100 dark:border-slate-800 pb-12 relative z-10">
                        <div className="flex items-center gap-2 text-primary font-black text-[9px] uppercase tracking-[0.3em] mb-4">
                            <span className="material-symbols-outlined text-sm">policy</span>
                            Documentação Jurídica
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white leading-tight mb-6 tracking-tighter uppercase italic">
                            POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS (LGPD)
                        </h1>
                        <div className="flex items-center gap-3 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                            <span className="material-symbols-outlined text-lg">history_edu</span>
                            Última atualização: 10 de Agosto de 2026
                        </div>
                    </div>

                    <div className="space-y-20 relative z-10">
                        <section id="introducao" className="scroll-mt-24 group">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-4 italic uppercase tracking-tighter">
                                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm not-italic font-black border border-primary/20 shadow-lg shadow-primary/5">1</span>
                                Introdução
                            </h2>
                            <div className="space-y-6 text-slate-600 dark:text-slate-300 leading-relaxed text-lg font-medium">
                                <p>
                                    Bem-vindo à SaaS Foundation. A sua privacidade e a segurança dos seus dados, bem como dos dados dos seus clientes, são a nossa prioridade absoluta. Esta Política de Privacidade descreve como coletamos, usamos, processamos e protegemos as informações em nossa plataforma SaaS.
                                </p>
                                <p className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border-l-8 border-primary italic">
                                    "Ao utilizar o motor SaaS Foundation, você confia à nossa empresa informações de saúde sensíveis. Estamos comprometidos em manter essa confiança através de uma governança de dados ética e transparente."
                                </p>
                                <p>
                                    Atuamos em total conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD), garantindo que cada interação com nossa inteligência artificial de operação corporal seja processada sob os mais rígidos protocolos de segurança cibernética.
                                </p>
                            </div>
                        </section>

                        <section id="dados" className="scroll-mt-24">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-4 italic uppercase tracking-tighter">
                                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm not-italic font-black border border-primary/20">2</span>
                                Dados Coletados
                            </h2>
                            <div className="grid md:grid-cols-2 gap-8 my-10">
                                <div className="p-8 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-primary/10 transition-all flex flex-col gap-4 group">
                                    <div className="size-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-2xl">badge</span>
                                    </div>
                                    <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2 text-xs uppercase tracking-widest">
                                        Dados do Profissional
                                    </h4>
                                    <p className="text-sm text-slate-500 font-bold leading-relaxed">Nome completo, e-mail corporativo e especialidade.</p>
                                </div>
                                <div className="p-8 rounded-[2.5rem] bg-primary/5 border border-primary/20 flex flex-col gap-4 group">
                                    <div className="size-12 rounded-2xl bg-primary text-slate-950 shadow-lg shadow-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-2xl">clinical_notes</span>
                                    </div>
                                    <h4 className="font-black text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                                        Dados do Cliente
                                    </h4>
                                    <p className="text-sm text-slate-500 font-bold leading-relaxed">Dados de identificação e contato dos clientes finais cadastrados pelo assinante, usados apenas para prestar o serviço contratado.</p>
                                </div>
                            </div>
                            <div className="p-8 bg-slate-900 text-white rounded-[2rem] border border-white/10 relative overflow-hidden shadow-2xl space-y-6">
                                <h4 className="text-primary font-black uppercase tracking-widest text-sm relative z-10 flex items-center gap-3">
                                    <span className="material-symbols-outlined">warning</span>
                                    Atenção: Uso de Imagens e Dados Visuais
                                </h4>
                                
                                <div className="relative z-10 space-y-4 text-sm leading-relaxed text-slate-300 font-medium">
                                    <p>
                                        A plataforma <strong className="font-bold text-white">SaaS Foundation</strong> poderá coletar e armazenar imagens enviadas voluntariamente pelos usuários durante a utilização dos serviços.
                                    </p>
                                    
                                    <p>Essas imagens são utilizadas exclusivamente para:</p>
                                    <ul className="list-disc list-inside space-y-1 ml-2">
                                        <li>execução das funcionalidades da plataforma;</li>
                                        <li>geração de análises ou operações corporais;</li>
                                        <li>aprimoramento técnico dos sistemas de inteligência artificial utilizados.</li>
                                    </ul>
                                    
                                    <p>
                                        As imagens são tratadas como <strong className="font-bold text-white">dados pessoais sensíveis</strong>, em conformidade com a legislação aplicável, incluindo a Lei Geral de Proteção de Dados Pessoais (LGPD).
                                    </p>
                                    
                                    <p>
                                        A SaaS Foundation adota medidas de segurança adequadas para proteger essas informações contra acesso não autorizado, perda ou uso indevido.
                                    </p>
                                    
                                    <p>
                                        Os seus dados não serão compartilhados com terceiros para fins comerciais sem consentimento explícito.
                                    </p>

                                    <p>
                                        Algumas funcionalidades usam <strong className="font-bold text-white">provedores de inteligência artificial</strong>, que podem processar os dados enviados em <strong className="font-bold text-white">servidores fora do Brasil</strong> (transferência internacional de dados). Esse tratamento ocorre exclusivamente para executar a funcionalidade solicitada, com base no seu <strong className="font-bold text-white">consentimento específico e destacado</strong> (LGPD Art. 7º, I; e Art. 33). Você pode <strong className="font-bold text-white">revogar esse consentimento a qualquer momento</strong> — a revogação é aplicada imediatamente e bloqueia novos envios (Art. 18, IX).
                                    </p>

                                    <p>O usuário poderá solicitar, a qualquer momento:</p>
                                    <ul className="list-disc list-inside space-y-1 ml-2">
                                        <li>acesso aos dados armazenados;</li>
                                        <li>correção de informações;</li>
                                        <li>exclusão definitiva dos dados enviados.</li>
                                    </ul>
                                    
                                    <p>
                                        Solicitações relacionadas à privacidade podem ser realizadas através do canal de contato disponibilizado pela plataforma.
                                    </p>
                                </div>
                                <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-[15rem] opacity-[0.03] pointer-events-none">imagesmode</span>
                            </div>
                        </section>

                        <section id="finalidade" className="scroll-mt-24">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-4 italic uppercase tracking-tighter">
                                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm not-italic font-black border border-primary/20">3</span>
                                Finalidade do Tratamento
                            </h2>
                            <div className="space-y-6">
                                {[
                                    { title: 'Prestação do Serviço', desc: 'Executar as funcionalidades contratadas pelo assinante.' },
                                    { title: 'Suporte e Atendimento', desc: 'Responder chamados e manter o histórico de atendimento.' },
                                    { title: 'Melhoria do Produto', desc: 'Análise estatística sobre dados agregados e anonimizados.' }
                                ].map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-6 p-6 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                                        <span className="material-symbols-outlined text-primary text-3xl">check_circle</span>
                                        <div>
                                            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm mb-1">{item.title}</h4>
                                            <p className="text-slate-500 font-medium text-base">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section id="direitos" className="scroll-mt-24">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-4 italic uppercase tracking-tighter">
                                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm not-italic font-black border border-primary/20">4</span>
                                Seus Direitos (LGPD)
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {[
                                    { icon: 'visibility', label: 'Acesso aos dados' },
                                    { icon: 'edit_square', label: 'Retificação e atualização' },
                                    { icon: 'delete', label: 'Exclusão (Esquecimento)' },
                                    { icon: 'output', label: 'Portabilidade de dados' },
                                ].map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-6 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:border-primary/40 transition-all bg-slate-50/50 group shadow-sm">
                                        <span className="material-symbols-outlined text-primary p-3 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform">{item.icon}</span>
                                        <span className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-xs">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section id="seguranca" className="scroll-mt-24 font-display">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-4 italic uppercase tracking-tighter">
                                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm not-italic font-black border border-primary/20">5</span>
                                Segurança da Informação
                            </h2>
                            <div className="relative overflow-hidden p-12 rounded-[3rem] bg-slate-900 text-white border border-slate-800 shadow-2xl">
                                <div className="grid md:grid-cols-3 gap-12 relative z-10">
                                    <div className="space-y-4">
                                        <div className="text-primary font-black text-4xl italic tracking-tighter">AES-256</div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-relaxed">Criptografia militar em repouso e em trânsito (TLS 1.3).</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="text-primary font-black text-4xl italic tracking-tighter">SOC2</div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-relaxed">Servidores AWS certificados e HIPAA-compliant.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="text-primary font-black text-4xl italic tracking-tighter">RLS</div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-relaxed">Isolamento por linha (Row-Level Security): cada usuário acessa apenas os próprios dados; imagens biométricas em buckets privados com URLs assinadas.</p>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined absolute -right-12 -bottom-12 text-[15rem] opacity-5 pointer-events-none">lock</span>
                            </div>
                        </section>

                        <section id="contato" className="scroll-mt-24 pb-12">
                            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-[3rem] p-10 border-l-[10px] border-primary shadow-inner">
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3 uppercase tracking-tighter italic">
                                    <span className="material-symbols-outlined text-primary text-3xl not-italic">support_agent</span>
                                    Encarregado de Dados (DPO)
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-6 text-lg font-medium leading-relaxed">
                                    Para exercer seus direitos, solicitar revogação de consentimento ou esclarecer dúvidas operacionais sobre o tratamento de seus dados, fale com o nosso Encarregado (DPO):
                                </p>
                                <div className="flex items-center gap-3 mb-10">
                                    <span className="material-symbols-outlined text-primary p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm">badge</span>
                                    <div>
                                        <p className="font-black text-slate-900 dark:text-white text-base leading-tight">Marcio Ricardo Luciano</p>
                                        <p className="text-xs text-slate-500 font-medium">Encarregado de Dados (DPO) · Advogado</p>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-10">
                                    <div className="flex items-center gap-4">
                                        <span className="material-symbols-outlined text-primary p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm">mail</span>
                                        <span className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-xs">privacidade@exemplo.com.br</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                                        <span className="material-symbols-outlined">location_on</span>
                                        União da Vitória, PR - Brasil
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <footer className="mt-24 pt-12 border-t border-slate-100 dark:border-slate-800 text-center relative z-10">
                        <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.4em] mb-4">© 2026 SaaS Foundation Tecnologia em Saúde Ltda. Todos os direitos reservados.</p>
                        <div className="flex justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-300">
                            <a href="#" className="hover:text-primary transition-colors">Termos de Uso</a>
                            <a href="#" className="hover:text-primary transition-colors">Segurança</a>
                            <a href="#" className="hover:text-primary transition-colors">Contratos</a>
                        </div>
                    </footer>
                </div>
            </div>
            </main>
            <Footer />
        </div>
    );
};

export default PrivacyPolicy;
