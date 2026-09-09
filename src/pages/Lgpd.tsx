import Header from '../components/Header';
import Footer from '../components/Footer';

const Lgpd = () => {
    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <Header />
            <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-10 md:p-16 shadow-sm overflow-hidden text-left relative animate-in fade-in duration-700">
                    <div className="mb-12 border-b border-slate-100 dark:border-slate-800 pb-12 relative z-10">
                        <div className="flex items-center gap-2 text-primary font-black text-[9px] uppercase tracking-[0.3em] mb-4">
                            <span className="material-symbols-outlined text-sm">shield</span>
                            Documentação Jurídica
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white leading-tight mb-6 tracking-tighter uppercase italic">
                            ADEQUAÇÃO LGPD
                        </h1>
                        <div className="flex items-center gap-3 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                            <span className="material-symbols-outlined text-lg">history_edu</span>
                            Última atualização: 24 de Outubro de 2023
                        </div>
                    </div>

                    <div className="space-y-12 text-slate-600 dark:text-slate-300 leading-relaxed text-lg font-medium relative z-10">
                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">1. Diretrizes de Privacidade</h2>
                            <p className="mb-4">
                                Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), a RDC estabelece padrões rigorosos de tratamento de dados pessoais. 
                                Sendo uma plataforma voltada a profissionais da saúde e estética, estamos plenamente cientes de nossa responsabilidade como Operadores dos dados de seus clientes.
                            </p>
                        </section>
                        
                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">2. Salvamento e Imagens no Banco de Dados</h2>
                            <p className="mb-4">
                                As imagens geradas pelas operações visuais e os dados fornecidos pelo assinante são mantidas em um banco de dados unicamente com o intuito de apresentar um histórico e acompanhamento visual na conta. 
                                O consentimento para este armazenamento deve ser captado do cliente pelo profissional pelo uso adequado. No que diz respeito à RDC e o usuário final (você), seu consentimento é obtido ativamente durante seu cadastro na plataforma. 
                            </p>
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-l-4 border-primary mt-4 flex gap-4">
                                <span className="material-symbols-outlined text-primary text-2xl">verified</span>
                                <p className="text-sm">
                                    Todas as informações corporais de clientes são anonimizadas onde for possível e criptografadas para garantir a proteção máxima da privacidade de titular de dados.
                                </p>
                            </div>
                        </section>
                        
                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">3. Direitos do Titular</h2>
                            <p className="mb-4">
                                Os usuários da RDC têm total controle sobre seus dados e dos perfis que administram. A qualquer momento você pode solicitar a exclusão de todas as imagens, arquivos da conta e finalidade da relação sem prejuízo algum. 
                            </p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default Lgpd;
