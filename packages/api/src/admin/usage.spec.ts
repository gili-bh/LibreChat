import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { createAdminUsageHandlers, type AdminUsageDeps } from './usage';

jest.mock('@librechat/data-schemas', () => ({
  logger: { error: jest.fn() },
}));

const deps = (): jest.Mocked<AdminUsageDeps> => ({
  listAdminAuditConversations: jest.fn().mockResolvedValue({
    conversations: [],
    total: 0,
    limit: 25,
    offset: 0,
  }),
  getAdminConversationDetail: jest.fn().mockResolvedValue({
    conversationId: 'conversation-1',
    title: 'Title',
    employee: { id: '1', name: 'Name', email: 'a@example.com' },
    messages: [],
    files: [],
    messageTotal: 0,
    limit: 25,
    offset: 0,
  }),
  getAdminUsageStatistics: jest.fn().mockResolvedValue({
    registeredUsers: 0,
    activeUsersToday: 0,
    activeUsers7Days: 0,
    activeUsers30Days: 0,
    conversationsToday: 0,
    conversations7Days: 0,
    conversations30Days: 0,
    messagesToday: 0,
    messages7Days: 0,
    messages30Days: 0,
    conversationsWithFiles: 0,
    totalUploadedFiles: 0,
    rangeDays: 30,
    daily: [],
  }),
  listAdminEmployees: jest
    .fn()
    .mockResolvedValue({ employees: [], total: 0, limit: 25, offset: 0 }),
});

const reqRes = (query: Record<string, string> = {}, params: Record<string, string> = {}) => {
  const req = { query, params, user: { tenantId: 'tenant-a' } } as unknown as ServerRequest;
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { req, res: { status } as unknown as Response, status, json };
};

describe('admin usage handlers', () => {
  it('validates and forwards search, filters and pagination', async () => {
    const mocks = deps();
    const { req, res, status } = reqRes({
      q: 'contract',
      employeeId: 'employee-1',
      email: 'user@example.com',
      files: 'with',
      from: '2026-08-01',
      to: '2026-08-20',
      limit: '10',
      offset: '20',
    });
    await createAdminUsageHandlers(mocks).listConversations(req, res);
    expect(status).toHaveBeenCalledWith(200);
    expect(mocks.listAdminAuditConversations).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        query: 'contract',
        employeeId: 'employee-1',
        email: 'user@example.com',
        files: 'with',
        limit: 10,
        offset: 20,
      }),
    );
  });

  it('rejects invalid pagination and date ranges', async () => {
    const mocks = deps();
    const pagination = reqRes({ limit: '1000' });
    await createAdminUsageHandlers(mocks).listConversations(pagination.req, pagination.res);
    expect(pagination.status).toHaveBeenCalledWith(400);
    const dates = reqRes({ from: '2026-09-01', to: '2026-08-01' });
    await createAdminUsageHandlers(mocks).listConversations(dates.req, dates.res);
    expect(dates.status).toHaveBeenCalledWith(400);
  });

  it('tenant-scopes conversation inspection and returns 404 for inaccessible records', async () => {
    const mocks = deps();
    mocks.getAdminConversationDetail.mockResolvedValue(null);
    const { req, res, status } = reqRes({}, { conversationId: 'other-user-conversation' });
    await createAdminUsageHandlers(mocks).getConversation(req, res);
    expect(mocks.getAdminConversationDetail).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      conversationId: 'other-user-conversation',
      limit: 25,
      offset: 0,
    });
    expect(status).toHaveBeenCalledWith(404);
  });

  it('supports only the approved statistics ranges', async () => {
    const mocks = deps();
    const valid = reqRes({ days: '90' });
    await createAdminUsageHandlers(mocks).getStatistics(valid.req, valid.res);
    expect(mocks.getAdminUsageStatistics).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      rangeDays: 90,
    });
    const invalid = reqRes({ days: '365' });
    await createAdminUsageHandlers(mocks).getStatistics(invalid.req, invalid.res);
    expect(invalid.status).toHaveBeenCalledWith(400);
  });
});
