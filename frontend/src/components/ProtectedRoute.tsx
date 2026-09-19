import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/ui/Loading';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  roles?: UserRole[];
  adminOnly?: boolean;
}

export function ProtectedRoute({ roles, adminOnly = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const allowedRoles = roles ?? (adminOnly ? ['ADMIN'] : undefined);
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/instructions" replace />;
  }

  return <Outlet />;
}