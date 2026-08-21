import { createAdminUsageMethods } from './usage';

const aggregate = jest.fn();
const countDocuments = jest.fn();
const find = jest.fn();
const model = (name: string) => ({ aggregate, countDocuments, find, collection: { name } });
const mongoose = {
  models: {
    Conversation: model('conversations'),
    Message: model('messages'),
    File: model('files'),
    User: model('users'),
  },
} as never;

describe('admin usage database methods', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds paginated summary aggregation and returns only sanitized fields', async () => {
    aggregate.mockResolvedValueOnce([
      {
        rows: [
          {
            conversationId: 'conversation-1',
            title: 'Contract review',
            employee: {
              _id: { toString: () => 'employee-1' },
              name: 'Gili',
              email: 'gili@example.com',
              password: 'hidden',
            },
            preview: 'Please review this contract',
            messageCount: 2,
            fileCount: 1,
            createdAt: new Date('2026-08-20T08:00:00.000Z'),
            updatedAt: new Date('2026-08-20T09:00:00.000Z'),
            system: 'hidden prompt',
            model: 'hidden model',
          },
        ],
        total: [{ count: 1 }],
      },
    ]);
    const page = await createAdminUsageMethods(mongoose).listAdminAuditConversations({
      tenantId: 'tenant-a',
      query: 'contract',
      files: 'with',
      limit: 10,
      offset: 20,
    });
    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ $match: expect.objectContaining({ tenantId: 'tenant-a' }) }),
        expect.objectContaining({ $facet: expect.any(Object) }),
      ]),
    );
    const facet = pipeline.find((stage: { $facet?: object }) => stage.$facet)?.$facet;
    expect(facet.rows).toEqual(expect.arrayContaining([{ $skip: 20 }, { $limit: 10 }]));
    expect(page.total).toBe(1);
    expect(page.conversations[0]).toEqual({
      conversationId: 'conversation-1',
      title: 'Contract review',
      employee: { id: 'employee-1', name: 'Gili', email: 'gili@example.com' },
      preview: 'Please review this contract',
      messageCount: 2,
      fileCount: 1,
      createdAt: '2026-08-20T08:00:00.000Z',
      updatedAt: '2026-08-20T09:00:00.000Z',
    });
    expect(JSON.stringify(page)).not.toMatch(/password|hidden prompt|hidden model/);
  });

  it('sanitizes inspector messages and file metadata', async () => {
    aggregate.mockResolvedValueOnce([
      {
        conversationId: 'conversation-1',
        title: 'Title',
        employee: {
          _id: { toString: () => 'employee-1' },
          name: 'Gili',
          email: 'gili@example.com',
        },
        messages: [
          {
            messageId: 'm1',
            sender: 'Gili',
            text: 'Visible',
            isCreatedByUser: true,
            createdAt: new Date('2026-08-20T08:00:00.000Z'),
            model: 'secret',
          },
        ],
        files: [
          {
            fileId: 'f1',
            filename: 'report.pdf',
            type: 'application/pdf',
            bytes: 100,
            filepath: '/secret',
          },
        ],
        messageTotal: 1,
      },
    ]);
    const detail = await createAdminUsageMethods(mongoose).getAdminConversationDetail({
      tenantId: 'tenant-a',
      conversationId: 'conversation-1',
      limit: 25,
      offset: 0,
    });
    expect(detail?.messages[0]).not.toHaveProperty('model');
    expect(detail?.files[0]).not.toHaveProperty('filepath');
    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({
      $match: expect.objectContaining({ tenantId: 'tenant-a', conversationId: 'conversation-1' }),
    });
  });
});
