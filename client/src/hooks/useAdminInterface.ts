import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from './AuthContext';

export default function useAdminInterface(): boolean {
  const { user } = useAuthContext();

  return user?.role === SystemRoles.ADMIN;
}
