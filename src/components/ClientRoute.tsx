import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ClientRoute = () => {
    const { user, profile, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;
    if ((profile?.role as string) !== 'client') return <Navigate to="/dashboard" replace />;

    return <Outlet />;
};

export default ClientRoute;
