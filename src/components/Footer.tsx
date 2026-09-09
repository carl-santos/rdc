import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BRAND } from '../brand';

const Footer = () => {
    const [showFaq, setShowFaq] = useState(false);
    const [faqForm, setFaqForm] = useState({ nome: '', email: '', assunto: '', mensagem: '' });
    const navigate = useNavigate();
    const location = useLocation();

    const scrollToSection = (id: string) => {
        if (location.pathname !== '/') {
            navigate(`/#${id}`);
        } else {
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const faqReady = !!(faqForm.nome.trim() && faqForm.email.trim() && faqForm.mensagem.trim());
    const handleSendFaq = () => {
        if (!faqReady) return;
        const subject = faqForm.assunto.trim() || `Contato pelo site ${BRAND.name}`;
        const body = `Nome: ${faqForm.nome}\nE-mail: ${faqForm.email}\n\nMensagem:\n${faqForm.mensagem}`;
        window.location.href = `mailto:contato@exemplo.com.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setShowFaq(false);
        setFaqForm({ nome: '', email: '', assunto: '', mensagem: '' });
    };

    return (
        <>
            <footer className="py-16 bg-white dark:bg-background-dark border-t border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-6 lg:px-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                        <div className="col-span-1">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-primary p-1.5 rounded-lg">
                                    <span className="material-symbols-outlined text-white text-xl">psychology</span>
                                </div>
                                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{BRAND.name}</h2>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                A tecnologia que aproxima o conhecimento de quem precisa ouvi-lo — com controle ético e acessibilidade.
                            </p>
                        </div>
                        <div>
                            <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-wider">Links Úteis</h5>
                            <ul className="space-y-4">
                                <li>
                                    <button
                                        onClick={() => scrollToSection('como-funciona')}
                                        className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors font-medium"
                                    >
                                        Funcionalidades
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => scrollToSection('precos')}
                                        className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors font-medium"
                                    >
                                        Planos
                                    </button>
                                </li>
                                <li>
                                    <a className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors font-medium" href="#">Blog</a>
                                </li>
                                <li>
                                    <button
                                        onClick={() => setShowFaq(true)}
                                        className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors font-medium"
                                    >
                                        FAQ
                                    </button>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-wider">Legal</h5>
                            <ul className="space-y-4">
                                <li><Link to="/privacidade" className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors font-medium">Privacidade</Link></li>
                                <li><Link to="/termos" className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors font-medium">Termos de Uso</Link></li>
                                <li><Link to="/lgpd" className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors font-medium">LGPD</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-12 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            © {BRAND.year} {BRAND.name}. Todos os direitos reservados.
                        </p>
                        <div className="flex gap-6">
                            <a className="text-slate-400 hover:text-primary transition-colors" href="#">
                                <span className="material-symbols-outlined">social_leaderboard</span>
                            </a>
                            <a className="text-slate-400 hover:text-primary transition-colors" href="#">
                                <span className="material-symbols-outlined">camera</span>
                            </a>
                            <a className="text-slate-400 hover:text-primary transition-colors" href="#">
                                <span className="material-symbols-outlined">alternate_email</span>
                            </a>
                        </div>
                    </div>
                </div>
            </footer>

            {/* FAQ Modal */}
            {showFaq && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-10 shadow-2xl">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">Fale Conosco</h2>
                        <p className="text-xs text-slate-400 font-medium mb-8 uppercase tracking-widest">Preencha os dados abaixo e entraremos em contato.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nome</label>
                                <input
                                    type="text"
                                    value={faqForm.nome}
                                    onChange={e => setFaqForm(f => ({ ...f, nome: e.target.value }))}
                                    placeholder="Seu nome completo"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">E-mail</label>
                                <input
                                    type="email"
                                    value={faqForm.email}
                                    onChange={e => setFaqForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="seu@email.com"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Assunto</label>
                                <input
                                    type="text"
                                    value={faqForm.assunto}
                                    onChange={e => setFaqForm(f => ({ ...f, assunto: e.target.value }))}
                                    placeholder="Sobre o que deseja falar?"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Mensagem</label>
                                <textarea
                                    value={faqForm.mensagem}
                                    onChange={e => setFaqForm(f => ({ ...f, mensagem: e.target.value }))}
                                    placeholder="Descreva sua dúvida ou sugestão..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={handleSendFaq}
                                disabled={!faqReady}
                                className="flex-1 py-4 rounded-[1.5rem] bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Enviar
                            </button>
                            <button
                                onClick={() => { setShowFaq(false); setFaqForm({ nome: '', email: '', assunto: '', mensagem: '' }); }}
                                className="flex-1 py-4 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] hover:border-slate-300 hover:text-slate-700 transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Footer;
