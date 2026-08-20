import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dataService,
  MutationKeys,
  QueryKeys,
  type TAdminUsersResponse,
  type TCreateAdminUser,
  type TUpdateAdminUser,
} from 'librechat-data-provider';

export const useAdminUsers = (params: { q?: string; limit: number; offset: number }) =>
  useQuery<TAdminUsersResponse>(
    [QueryKeys.adminUsers, params],
    () => dataService.getAdminUsers(params),
    { keepPreviousData: true },
  );

export const useAdminUserMutations = () => {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries([QueryKeys.adminUsers]);
  return {
    createUser: useMutation((payload: TCreateAdminUser) => dataService.createAdminUser(payload), {
      mutationKey: [MutationKeys.adminUser, 'create'],
      onSuccess: refresh,
    }),
    updateUser: useMutation(
      ({ id, payload }: { id: string; payload: TUpdateAdminUser }) =>
        dataService.updateAdminUser(id, payload),
      { mutationKey: [MutationKeys.adminUser, 'update'], onSuccess: refresh },
    ),
    resetPassword: useMutation(
      ({ id, password }: { id: string; password: string }) =>
        dataService.resetAdminUserPassword(id, password),
      { mutationKey: [MutationKeys.adminUser, 'password'], onSuccess: refresh },
    ),
    setStatus: useMutation(
      ({ id, disabled }: { id: string; disabled: boolean }) =>
        dataService.setAdminUserStatus(id, disabled),
      { mutationKey: [MutationKeys.adminUser, 'status'], onSuccess: refresh },
    ),
    deleteUser: useMutation((id: string) => dataService.deleteAdminUser(id), {
      mutationKey: [MutationKeys.adminUser, 'delete'],
      onSuccess: refresh,
    }),
  };
};
