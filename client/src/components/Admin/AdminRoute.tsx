import { Navigate, Outlet } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks/AuthContext';

export default function AdminRoute() {
  const { user } = useAuthContext();
  return user?.role === SystemRoles.ADMIN ? <Outlet /> : <Navigate to="/c/new" replace />;
}
