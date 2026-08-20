import type { SystemRoles } from '../roles';

export type TAdminUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  role: SystemRoles;
  provider: string;
  disabled: boolean;
  emailVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TAdminUsersResponse = {
  users: TAdminUser[];
  total: number;
  limit: number;
  offset: number;
};

export type TCreateAdminUser = Pick<TAdminUser, 'name' | 'email' | 'username' | 'role'> & {
  password: string;
  emailVerified?: boolean;
};

export type TUpdateAdminUser = Partial<
  Pick<TAdminUser, 'name' | 'email' | 'username' | 'role' | 'emailVerified'>
>;
