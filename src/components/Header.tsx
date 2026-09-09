import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../brand';

const Header = () => {
    const [showContact, setShowContact] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [form, setForm] = useState({ nome: '', email: '', assunto: '', mensagem: '' });

    const closeMenu = () => setMenuOpen(false);

    const contactReady = !!(form.nome.trim() && form.email.trim() && form.mensagem.trim());
    const handleSendContact = () => {
        if (!contactReady) return;
        const subject = form.assunto.trim() || `Contato pelo site ${BRAND.name}`;
        const body = `Nome: ${form.nome}\nE-mail: ${form.email}\n\nMensagem:\n${form.mensagem}`;
        window.location.href = `mailto:contato@exemplo.com.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setShowContact(false);
        setForm({ nome: '', email: '', assunto: '', mensagem: '' });
    };

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="bg-primary p-1.5 rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-2xl">psychology</span>
                        </div>
                        <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">{BRAND.name}</h2>
                    </Link>

                    {/* Desktop nav */}
                    <nav className="hidden md:flex items-center gap-10">
                        <Link className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors" to="/#como-funciona">Como Funciona</Link>
                        <Link className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors" to="/#beneficios">Benefícios</Link>
                        <Link className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors" to="/#precos">Preços</Link>
                        <Link className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors" to="/#sobre">Sobre</Link>
                        <button
                            onClick={() => setShowContact(true)}
                            className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
                        >
                            Entre em Contato
                        </button>
                    </nav>

                    {/* Desktop CTA */}
                    <div className="hidden md:flex items-center gap-3">
                        <Link to="/login" className="text-slate-600 dark:text-slate-300 font-bold text-sm px-4 py-2 hover:text-primary transition-colors">Entrar</Link>
                        <Link to="/cadastro" className="bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/25 hover:brightness-110 transition-all transform active:scale-[0.98]">
                            Começar Agora
                        </Link>
                    </div>

                    {/* Hamburger button — mobile only */}
                    <button
                        onClick={() => setMenuOpen(o => !o)}
                        className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Abrir menu"
                    >
                        <span className="material-symbols-outlined text-2xl">
                            {menuOpen ? 'close' : 'menu'}
                        </span>
                    </button>
                </div>

                {/* Mobile menu */}
                {menuOpen && (
                    <div className="md:hidden bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-6 py-6 flex flex-col gap-4">
                        <Link onClick={closeMenu} className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors py-2" to="/#como-funciona">Como Funciona</Link>
                        <Link onClick={closeMenu} className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors py-2" to="/#beneficios">Benefícios</Link>
                        <Link onClick={closeMenu} className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors py-2" to="/#precos">Preços</Link>
                        <Link onClick={closeMenu} className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors py-2" to="/#sobre">Sobre</Link>
                        <button
                            onClick={() => { closeMenu(); setShowContact(true); }}
                            className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors py-2 text-left"
                        >
                            Entre em Contato
                        </button>
                        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col gap-3">
                            <Link onClick={closeMenu} to="/login" className="text-center w-full py-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:text-primary transition-colors">Entrar</Link>
                            <Link to="/cadastro" onClick={closeMenu} className="text-center w-full bg-primary text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-primary/25 hover:brightness-110 transition-all">Começar Agora</Link>
                        </div>
                    </div>
                )}
            </header>

            {/* Contact Modal */}
            {showContact && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-10 shadow-2xl">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">Fale Conosco</h2>
                        <p className="text-xs text-slate-400 font-medium mb-8 uppercase tracking-widest">Preencha os dados abaixo e entraremos em contato.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nome</label>
                                <input
                                    type="text"
                                    value={form.nome}
                                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                                    placeholder="Seu nome completo"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">E-mail</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="seu@email.com"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Assunto</label>
                                <input
                                    type="text"
                                    value={form.assunto}
                                    onChange={e => setForm(f => ({ ...f, assunto: e.target.value }))}
                                    placeholder="Sobre o que deseja falar?"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Mensagem</label>
                                <textarea
                                    value={form.mensagem}
                                    onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))}
                                    placeholder="Descreva sua dúvida ou sugestão..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={handleSendContact}
                                disabled={!contactReady}
                                className="flex-1 py-4 rounded-[1.5rem] bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Enviar
                            </button>
                            <button
                                onClick={() => { setShowContact(false); setForm({ nome: '', email: '', assunto: '', mensagem: '' }); }}
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

export default Header;
