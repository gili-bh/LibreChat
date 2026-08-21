import { useQuery } from '@tanstack/react-query';
import {
  dataService,
  QueryKeys,
  type TAdminAuditPage,
  type TAdminConversationDetail,
  type TAdminEmployeesPage,
  type TAdminUsageFilters,
  type TAdminUsageStatistics,
} from 'librechat-data-provider';

export const useAdminAudit = (params: TAdminUsageFilters) =>
  useQuery<TAdminAuditPage>(
    [QueryKeys.adminAudit, params],
    () => dataService.getAdminAuditConversations(params),
    { keepPreviousData: true },
  );

export const useAdminAuditConversation = (
  conversationId: string | null,
  params: { limit: number; offset: number },
) =>
  useQuery<TAdminConversationDetail>(
    [QueryKeys.adminAuditConversation, conversationId, params],
    () => dataService.getAdminAuditConversation(conversationId ?? '', params),
    { enabled: Boolean(conversationId), keepPreviousData: true },
  );

export const useAdminUsageStatistics = (days: 7 | 30 | 90) =>
  useQuery<TAdminUsageStatistics>(
    [QueryKeys.adminUsageStatistics, days],
    () => dataService.getAdminUsageStatistics(days),
    { keepPreviousData: true },
  );

export const useAdminUsageEmployees = (q = '') =>
  useQuery<TAdminEmployeesPage>(
    [QueryKeys.adminUsageEmployees, q],
    () => dataService.getAdminUsageEmployees({ q: q || undefined, limit: 100, offset: 0 }),
    { staleTime: 60000 },
  );
