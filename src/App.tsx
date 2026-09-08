import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
// Eager: necessarios no primeiro paint
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AcceptInvite from './pages/AcceptInvite';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import ClientRoute from './components/ClientRoute';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatbotProvider } from './contexts/ChatbotContext';
import ChatbotWidget from './components/ChatbotWidget';
import CookieConsent from './components/CookieConsent';

// Lazy: cada um vira um chunk separado
const Dashboard       = lazy(() => import('./pages/Dashboard'));
const Clients         = lazy(() => import('./pages/Clients'));
const ClientProfile   = lazy(() => import('./pages/ClientProfile'));
const Settings        = lazy(() => import('./pages/Settings'));
const Teams           = lazy(() => import('./pages/Teams'));
const PrivacyPolicy   = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfUse      = lazy(() => import('./pages/TermsOfUse'));
const Lgpd            = lazy(() => import('./pages/Lgpd'));
const Subscription    = lazy(() => import('./pages/Subscription'));
const Support         = lazy(() => import('./pages/Support'));
const MyTickets       = lazy(() => import('./pages/MyTickets'));
const Profile         = lazy(() => import('./pages/Profile'));

const AdminDashboard  = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminTenants    = lazy(() => import('./pages/admin/AdminTenants'));
const AdminPlans      = lazy(() => import('./pages/admin/AdminPlans'));
const AdminSupport    = lazy(() => import('./pages/admin/AdminSupport'));
const AdminAuditLogs  = lazy(() => import('./pages/admin/AdminAuditLogs'));
const AdminLgpd       = lazy(() => import('./pages/admin/AdminLgpd'));
const AdminLgpdDetail = lazy(() => import('./pages/admin/AdminLgpdDetail'));

const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const ClientSettings  = lazy(() => import('./pages/client/ClientSettings'));
const ClientSupport   = lazy(() => import('./pages/client/ClientSupport'));
const ClientMyTickets = lazy(() => import('./pages/client/ClientMyTickets'));
const ClientLgpd      = lazy(() => import('./pages/client/ClientLgpd'));

function ScrollToTop() {
    const location = useLocation();
    useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
    return null;
}

// Links de convite chegam com o tipo salvo em sessionStorage por supabase.ts,
// antes de o hash da URL ser consumido pelo cliente de auth.
function InviteRedirect() {
    const navigate = useNavigate();
    useEffect(() => {
        const linkType = sessionStorage.getItem('app_auth_link_type');
        if (linkType === 'invite') {
            navigate('/aceitar-convite', { replace: true });
        }
    }, [navigate]);
    return null;
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 1,
        },
    },
});

function App() {
    return (
        <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
        <ToastProvider>
        <ChatbotProvider>
        <Router>
            <ScrollToTop />
            <InviteRedirect />
            <ChatbotWidget />
            <CookieConsent />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" /></div>}>
            <Routes>
                {/* Publicas */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Signup />} />
                <Route path="/recuperar-senha" element={<ForgotPassword />} />
                <Route path="/redefinir-senha" element={<ResetPassword />} />
                <Route path="/privacidade" element={<PrivacyPolicy />} />
                <Route path="/termos" element={<TermsOfUse />} />
                <Route path="/lgpd" element={<Lgpd />} />
                <Route path="/aceitar-convite" element={<AcceptInvite />} />

                {/* Equipe do assinante */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/clientes" element={<Clients />} />
                    <Route path="/clientes/:clientId" element={<ClientProfile />} />
                    <Route path="/configuracoes" element={<Settings />} />
                    <Route path="/equipes" element={<Teams />} />
                    <Route path="/assinatura" element={<Subscription />} />
                    <Route path="/suporte" element={<Support />} />
                    <Route path="/meus-chamados" element={<MyTickets />} />
                    <Route path="/perfil" element={<Profile />} />

                    {/* Requer role platform_admin */}
                    <Route element={<AdminRoute />}>
                        <Route path="/admin/dashboard" element={<AdminDashboard />} />
                        <Route path="/admin/tenants" element={<AdminTenants />} />
                        <Route path="/admin/plans" element={<AdminPlans />} />
                        <Route path="/admin/support" element={<AdminSupport />} />
                        <Route path="/admin/auditoria" element={<AdminAuditLogs />} />
                        <Route path="/admin/lgpd" element={<AdminLgpd />} />
                        <Route path="/admin/lgpd/:ticketId" element={<AdminLgpdDetail />} />
                    </Route>
                </Route>

                {/* Portal do cliente final - requer role client */}
                <Route element={<ClientRoute />}>
                    <Route path="/cliente/dashboard" element={<ClientDashboard />} />
                    <Route path="/cliente/configuracoes" element={<ClientSettings />} />
                    <Route path="/cliente/suporte" element={<ClientSupport />} />
                    <Route path="/cliente/chamados" element={<ClientMyTickets />} />
                    <Route path="/cliente/lgpd" element={<ClientLgpd />} />
                </Route>
            </Routes>
            </Suspense>
        </Router>
        </ChatbotProvider>
        </ToastProvider>
        </QueryClientProvider>
        </ErrorBoundary>
    );
}

export default App;
