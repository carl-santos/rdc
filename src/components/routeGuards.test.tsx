import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock do contexto de auth (evita importar supabase e permite controlar o estado).
const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import ProtectedRoute from './ProtectedRoute';
import AdminRoute from './AdminRoute';
import ClientRoute from './ClientRoute';

function renderGuard(element: React.ReactNode) {
    return render(
        <MemoryRouter initialEntries={['/x']}>
            <Routes>
                <Route element={element}>
                    <Route path="/x" element={<div>PRIVATE</div>} />
                </Route>
                <Route path="/login" element={<div>LOGIN</div>} />
                <Route path="/dashboard" element={<div>DASHBOARD</div>} />
                <Route path="/cliente/dashboard" element={<div>CLIENT_DASH</div>} />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => mockUseAuth.mockReset());

describe('ProtectedRoute', () => {
    it('mostra loading (nem conteúdo nem redirect) enquanto carrega', () => {
        mockUseAuth.mockReturnValue({ user: null, profile: null, loading: true });
        renderGuard(<ProtectedRoute />);
        expect(screen.queryByText('PRIVATE')).toBeNull();
        expect(screen.queryByText('LOGIN')).toBeNull();
    });

    it('redireciona para /login sem usuário', () => {
        mockUseAuth.mockReturnValue({ user: null, profile: null, loading: false });
        renderGuard(<ProtectedRoute />);
        expect(screen.getByText('LOGIN')).toBeInTheDocument();
    });

    it('libera o conteúdo para profissional autenticado', () => {
        mockUseAuth.mockReturnValue({ user: { id: '1' }, profile: { role: 'tenant_admin' }, loading: false });
        renderGuard(<ProtectedRoute />);
        expect(screen.getByText('PRIVATE')).toBeInTheDocument();
    });

    it('redireciona cliente para o portal do cliente', () => {
        mockUseAuth.mockReturnValue({ user: { id: '1' }, profile: { role: 'client' }, loading: false });
        renderGuard(<ProtectedRoute />);
        expect(screen.getByText('CLIENT_DASH')).toBeInTheDocument();
    });
});

describe('AdminRoute', () => {
    it('libera apenas platform_admin', () => {
        mockUseAuth.mockReturnValue({ profile: { role: 'platform_admin' }, loading: false });
        renderGuard(<AdminRoute />);
        expect(screen.getByText('PRIVATE')).toBeInTheDocument();
    });

    it('redireciona não-admin para /dashboard', () => {
        mockUseAuth.mockReturnValue({ profile: { role: 'tenant_admin' }, loading: false });
        renderGuard(<AdminRoute />);
        expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
    });
});

describe('ClientRoute', () => {
    it('redireciona para /login sem usuário', () => {
        mockUseAuth.mockReturnValue({ user: null, profile: null, loading: false });
        renderGuard(<ClientRoute />);
        expect(screen.getByText('LOGIN')).toBeInTheDocument();
    });

    it('libera o conteúdo para cliente', () => {
        mockUseAuth.mockReturnValue({ user: { id: '1' }, profile: { role: 'client' }, loading: false });
        renderGuard(<ClientRoute />);
        expect(screen.getByText('PRIVATE')).toBeInTheDocument();
    });

    it('redireciona não-cliente para /dashboard', () => {
        mockUseAuth.mockReturnValue({ user: { id: '1' }, profile: { role: 'collaborator' }, loading: false });
        renderGuard(<ClientRoute />);
        expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
    });
});
