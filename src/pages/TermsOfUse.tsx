import Header from '../components/Header';
import Footer from '../components/Footer';

const TermsOfUse = () => {
    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <Header />
            <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-10 md:p-16 shadow-sm overflow-hidden text-left relative animate-in fade-in duration-700">
                    <div className="mb-12 border-b border-slate-100 dark:border-slate-800 pb-12 relative z-10">
                        <div className="flex items-center gap-2 text-primary font-black text-[9px] uppercase tracking-[0.3em] mb-4">
                            <span className="material-symbols-outlined text-sm">gavel</span>
                            Documentação Jurídica
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white leading-tight mb-6 tracking-tighter uppercase italic">
                            TERMOS DE USO
                        </h1>
                        <div className="flex items-center gap-3 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                            <span className="material-symbols-outlined text-lg">history_edu</span>
                            Última atualização: 10 de Março de 2026
                        </div>
                    </div>

                    <div className="space-y-12 text-slate-600 dark:text-slate-300 leading-relaxed text-lg font-medium relative z-10">
                        <div className="space-y-4">
                            <p>
                                Bem-vindo à plataforma RDC. Estes Termos de Uso regulam o acesso e a utilização da plataforma digital RDC, seus serviços, funcionalidades e conteúdos.
                            </p>
                            <p>
                                Ao acessar ou utilizar a plataforma, o usuário declara ter lido, compreendido e concordado com estes Termos de Uso.
                            </p>
                        </div>
                        
                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">1. Definições</h2>
                            <p className="mb-4">Para os fins destes Termos de Uso, consideram-se:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong>Plataforma:</strong> sistema digital RDC, acessível via web ou aplicativos.</li>
                                <li><strong>Usuário:</strong> qualquer pessoa que utilize a plataforma.</li>
                                <li><strong>Profissional:</strong> usuário que utiliza a plataforma para realizar análises ou acompanhamentos de clientes.</li>
                                <li><strong>Cliente, Cliente ou Aluno:</strong> pessoa cujos dados ou imagens são inseridos na plataforma para análise.</li>
                                <li><strong>Dados pessoais:</strong> qualquer informação relacionada a pessoa identificada ou identificável.</li>
                                <li><strong>Dados sensíveis:</strong> dados relacionados à saúde, características corporais ou imagens, conforme legislação aplicável.</li>
                            </ul>
                        </section>
                        
                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">2. Aceitação dos Termos</h2>
                            <p className="mb-4">O uso da plataforma implica na aceitação integral destes Termos de Uso e da Política de Privacidade da RDC.</p>
                            <p>Caso o usuário não concorde com qualquer disposição destes termos, não deverá utilizar a plataforma.</p>
                        </section>
                        
                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">3. Objeto da Plataforma</h2>
                            <p className="mb-4">A plataforma RDC disponibiliza ferramentas digitais destinadas à:</p>
                            <ul className="list-disc pl-6 space-y-2 mb-4">
                                <li>análise visual e computacional de imagens corporais;</li>
                                <li>operações e projeções visuais;</li>
                                <li>acompanhamento de evolução corporal;</li>
                                <li>geração de relatórios ou informações visuais.</li>
                            </ul>
                            <p>A plataforma atua como infraestrutura tecnológica, não prestando os serviços finais oferecidos pelo assinante.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">4. Cadastro de Usuários</h2>
                            <p className="mb-4">Para utilizar determinadas funcionalidades, o usuário deverá realizar cadastro fornecendo informações verdadeiras, completas e atualizadas.</p>
                            <p className="mb-4">O usuário é responsável por:</p>
                            <ul className="list-disc pl-6 space-y-2 mb-4">
                                <li>manter a confidencialidade de suas credenciais de acesso;</li>
                                <li>atualizar seus dados cadastrais;</li>
                                <li>comunicar imediatamente qualquer uso não autorizado de sua conta.</li>
                            </ul>
                            <p className="mb-4">A RDC poderá suspender ou cancelar contas que apresentem:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>informações falsas;</li>
                                <li>uso indevido da plataforma;</li>
                                <li>violação destes termos.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">5. Uso da Plataforma</h2>
                            <p className="mb-4">O usuário compromete-se a utilizar a plataforma de forma ética e legal.</p>
                            <p className="mb-4">É proibido utilizar a plataforma para:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>fins ilegais ou fraudulentos;</li>
                                <li>envio de conteúdos ofensivos, discriminatórios ou ilícitos;</li>
                                <li>violação de direitos de terceiros;</li>
                                <li>tentativa de acesso não autorizado a sistemas ou dados.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">6. Responsabilidades do Profissional</h2>
                            <p className="mb-4">Profissionais que utilizam a plataforma para análise ou acompanhamento de clientes comprometem-se a:</p>
                            <ul className="list-disc pl-6 space-y-2 mb-4">
                                <li>utilizar a plataforma exclusivamente para finalidades profissionais legítimas;</li>
                                <li>obter consentimento do cliente para coleta e envio de imagens;</li>
                                <li>garantir a legalidade do tratamento dos dados inseridos;</li>
                                <li>respeitar as normas profissionais e éticas aplicáveis à sua área de atuação.</li>
                            </ul>
                            <p>O profissional é integralmente responsável pela relação estabelecida com seus clientes.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">7. Tratamento de Dados e Privacidade</h2>
                            <p className="mb-4">A plataforma poderá coletar e tratar dados pessoais e dados sensíveis necessários para a prestação dos serviços.</p>
                            <p className="mb-4">Entre os dados que podem ser tratados estão:</p>
                            <ul className="list-disc pl-6 space-y-2 mb-4">
                                <li>imagens corporais;</li>
                                <li>medidas físicas;</li>
                                <li>informações de evolução corporal;</li>
                                <li>dados cadastrais dos usuários.</li>
                            </ul>
                            <p className="mb-4">O tratamento de dados ocorre conforme a legislação aplicável, incluindo a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).</p>
                            <p className="mb-4">Os dados serão utilizados para:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>execução das funcionalidades da plataforma;</li>
                                <li>geração de análises ou operações;</li>
                                <li>melhoria técnica dos serviços.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">8. Consentimento para Uso de Imagens</h2>
                            <p className="mb-4">Ao enviar imagens para a plataforma, o usuário declara possuir autorização do titular dos dados para o processamento dessas imagens.</p>
                            <p className="mb-4">As imagens poderão ser utilizadas para:</p>
                            <ul className="list-disc pl-6 space-y-2 mb-4">
                                <li>análise computacional;</li>
                                <li>geração de operações;</li>
                                <li>armazenamento para histórico do usuário.</li>
                            </ul>
                            <p>A plataforma compromete-se a adotar medidas de segurança para proteger essas informações.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">9. Segurança da Informação</h2>
                            <p className="mb-4">A RDC adota medidas técnicas e administrativas adequadas para proteger os dados armazenados contra:</p>
                            <ul className="list-disc pl-6 space-y-2 mb-4">
                                <li>acesso não autorizado;</li>
                                <li>perda ou destruição acidental;</li>
                                <li>uso indevido.</li>
                            </ul>
                            <p>Entretanto, nenhum sistema digital é completamente isento de riscos.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">10. Limitação de Responsabilidade</h2>
                            <p className="mb-4">A plataforma RDC fornece ferramentas tecnológicas de análise e operação.</p>
                            <p className="mb-4">Os resultados gerados possuem caráter informativo e auxiliar, não substituindo:</p>
                            <ul className="list-disc pl-6 space-y-2 mb-4">
                                <li>avaliação médica;</li>
                                <li>aconselhamento profissional especializado;</li>
                                <li>orientação profissional especializada.</li>
                            </ul>
                            <p>A RDC não se responsabiliza por decisões tomadas com base nas informações geradas pela plataforma.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">11. Propriedade Intelectual</h2>
                            <p className="mb-4">Todos os elementos da plataforma, incluindo:</p>
                            <ul className="list-disc pl-6 space-y-2 mb-4">
                                <li>software</li>
                                <li>design</li>
                                <li>algoritmos</li>
                                <li>interfaces</li>
                            </ul>
                            <p className="mb-2">são de propriedade da RDC ou licenciados à plataforma.</p>
                            <p>É proibida a reprodução, modificação ou distribuição sem autorização.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">12. Disponibilidade do Serviço</h2>
                            <p className="mb-4">A RDC busca manter a plataforma disponível continuamente, porém não garante funcionamento ininterrupto.</p>
                            <p className="mb-4">A plataforma poderá realizar:</p>
                            <ul className="list-disc pl-6 space-y-2 mb-4">
                                <li>manutenções programadas</li>
                                <li>atualizações</li>
                                <li>melhorias técnicas</li>
                            </ul>
                            <p>que podem resultar em interrupções temporárias.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">13. Cancelamento e Exclusão de Conta</h2>
                            <p className="mb-4">O usuário poderá solicitar a exclusão de sua conta a qualquer momento.</p>
                            <p className="mb-4">A RDC poderá suspender ou cancelar contas em caso de:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>violação destes termos</li>
                                <li>uso indevido da plataforma</li>
                                <li>atividades ilegais.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">14. Alterações nos Termos</h2>
                            <p className="mb-4">A RDC poderá atualizar estes Termos de Uso periodicamente.</p>
                            <p>A versão atualizada será disponibilizada na plataforma com indicação da data de revisão.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">15. Legislação e Foro</h2>
                            <p className="mb-4">Estes Termos de Uso serão regidos pela legislação brasileira.</p>
                            <p>Fica eleito o foro da comarca de União da Vitória/PR, com renúncia a qualquer outro, por mais privilegiado que seja, para dirimir eventuais conflitos decorrentes destes termos.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">16. Contato</h2>
                            <p className="mb-4">Em caso de dúvidas sobre estes Termos de Uso ou sobre o tratamento de dados, o usuário poderá entrar em contato através do canal:</p>
                            <p className="text-primary font-bold">privacidade@exemplo.com.br</p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default TermsOfUse;
