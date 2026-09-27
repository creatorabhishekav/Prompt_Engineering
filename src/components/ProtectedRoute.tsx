import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/ui/Loading';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  roles?: UserRole[];
  adminOnly?: boolean;
}

export function ProtectedRoute({ roles, adminOnly = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Loading fullScreen label="Checking authorization..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const allowedRoles = roles ?? (adminOnly ? ['ADMIN'] : undefined);

  console.log('PROTECTED ROUTE', {
    path: location.pathname,
    user,
    role: user?.role,
    allowedRoles,
    isAuthenticated,
    loading: isLoading,
  });

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center p-4">
        <Card className="w-full text-center">
          <CardBody className="py-12 px-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Access Denied</h2>
            <p className="mt-2 text-sm text-slate-600">
              You are signed in as <strong className="text-slate-800">@{user.username}</strong> ({user.role}).
              You do not have administrative permissions to view this page.
            </p>
            <div className="mt-6 flex justify-center">
              <Link to="/instructions">
                <Button>Return to Instructions</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}