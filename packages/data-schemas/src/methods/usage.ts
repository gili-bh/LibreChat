import type { FilterQuery, Model, PipelineStage } from 'mongoose';
import type {
  TAdminAuditPage,
  TAdminConversationDetail,
  TAdminDailyUsage,
  TAdminEmployeesPage,
  TAdminUsageStatistics,
} from 'librechat-data-provider';
import type { IConversation, IMessage, IMongoFile, IUser } from '~/types';

const PREVIEW_LENGTH = 100;
const MAX_MESSAGE_TEXT_LENGTH = 20000;

export type AdminAuditQuery = {
  tenantId?: string;
  employeeId?: string;
  email?: string;
  from?: Date;
  to?: Date;
  files?: 'with' | 'without';
  query?: string;
  limit: number;
  offset: number;
};

export type AdminEmployeeQuery = {
  tenantId?: string;
  query?: string;
  limit: number;
  offset: number;
};

export interface AdminUsageMethods {
  listAdminAuditConversations: (input: AdminAuditQuery) => Promise<TAdminAuditPage>;
  getAdminConversationDetail: (input: {
    tenantId?: string;
    conversationId: string;
    limit: number;
    offset: number;
  }) => Promise<TAdminConversationDetail | null>;
  getAdminUsageStatistics: (input: {
    tenantId?: string;
    rangeDays: 7 | 30 | 90;
    now?: Date;
  }) => Promise<TAdminUsageStatistics>;
  listAdminEmployees: (input: AdminEmployeeQuery) => Promise<TAdminEmployeesPage>;
}

type AuditAggregateRow = {
  conversationId: string;
  title?: string;
  employee?: { _id?: { toString(): string }; name?: string; email?: string };
  preview?: string;
  messageCount?: number;
  fileCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

type CountRow = { count: number };
type PeriodCounts = { today: number; sevenDays: number; thirtyDays: number };
type DailyMessageRow = { _id: string; messages: number; activeUsers: number };
type DailyConversationRow = { _id: string; conversations: number };

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const iso = (value?: Date): string | undefined => value?.toISOString();

const collectionScope = (tenantId?: string): FilterQuery<IConversation> =>
  tenantId
    ? { tenantId }
    : { $or: [{ tenantId: { $exists: false } }, { tenantId: null }, { tenantId: '' }] };

const userScope = (tenantId?: string): FilterQuery<IUser> =>
  tenantId
    ? { tenantId }
    : { $or: [{ tenantId: { $exists: false } }, { tenantId: null }, { tenantId: '' }] };

const addOwnerLookup = (userCollection: string): PipelineStage[] => [
  {
    $set: {
      ownerObjectId: { $convert: { input: '$user', to: 'objectId', onError: null, onNull: null } },
    },
  },
  {
    $lookup: {
      from: userCollection,
      localField: 'ownerObjectId',
      foreignField: '_id',
      pipeline: [{ $project: { name: 1, email: 1 } }],
      as: 'employee',
    },
  },
  { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
];

export function createAdminUsageMethods(mongoose: typeof import('mongoose')): AdminUsageMethods {
  const Conversation = mongoose.models.Conversation as Model<IConversation>;
  const Message = mongoose.models.Message as Model<IMessage>;
  const File = mongoose.models.File as Model<IMongoFile>;
  const User = mongoose.models.User as Model<IUser>;

  async function listAdminAuditConversations(input: AdminAuditQuery): Promise<TAdminAuditPage> {
    const match: FilterQuery<IConversation> = {
      ...collectionScope(input.tenantId),
      isTemporary: { $ne: true },
    };
    if (input.employeeId) {
      match.user = input.employeeId;
    }
    if (input.from || input.to) {
      match.updatedAt = {
        ...(input.from ? { $gte: input.from } : {}),
        ...(input.to ? { $lte: input.to } : {}),
      };
    }

    const postLookup: FilterQuery<AuditAggregateRow> = {};
    if (input.email) {
      postLookup['employee.email'] = new RegExp(escapeRegex(input.email), 'i');
    }
    if (input.files === 'with') {
      postLookup.fileCount = { $gt: 0 };
    } else if (input.files === 'without') {
      postLookup.fileCount = 0;
    }
    if (input.query) {
      const regex = new RegExp(escapeRegex(input.query), 'i');
      postLookup.$or = [
        { title: regex },
        { preview: regex },
        { 'employee.name': regex },
        { 'employee.email': regex },
      ];
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      ...addOwnerLookup(User.collection.name),
      {
        $lookup: {
          from: Message.collection.name,
          let: { conversationId: '$conversationId', owner: '$user' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$conversationId'] },
                    { $eq: ['$user', '$$owner'] },
                    { $ne: ['$isTemporary', true] },
                  ],
                },
              },
            },
            {
              $facet: {
                preview: [
                  { $match: { isCreatedByUser: true, text: { $type: 'string' } } },
                  { $sort: { createdAt: 1, _id: 1 } },
                  { $limit: 1 },
                  { $project: { _id: 0, text: { $substrCP: ['$text', 0, PREVIEW_LENGTH] } } },
                ],
                count: [{ $count: 'value' }],
              },
            },
          ],
          as: 'messageSummary',
        },
      },
      {
        $lookup: {
          from: File.collection.name,
          let: { conversationId: '$conversationId', owner: '$ownerObjectId' },
          pipeline: [
            {
              $match: {
                context: 'message_attachment',
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$conversationId'] },
                    { $eq: ['$user', '$$owner'] },
                  ],
                },
              },
            },
            { $count: 'value' },
          ],
          as: 'fileSummary',
        },
      },
      {
        $set: {
          preview: {
            $ifNull: [{ $arrayElemAt: ['$messageSummary.preview.text', 0] }, ''],
          },
          messageCount: {
            $ifNull: [{ $arrayElemAt: ['$messageSummary.count.value', 0] }, 0],
          },
          fileCount: { $ifNull: [{ $arrayElemAt: ['$fileSummary.value', 0] }, 0] },
        },
      },
      { $match: postLookup },
      {
        $facet: {
          rows: [
            { $sort: { updatedAt: -1, _id: -1 } },
            { $skip: input.offset },
            { $limit: input.limit },
            {
              $project: {
                _id: 0,
                conversationId: 1,
                title: 1,
                employee: 1,
                preview: 1,
                messageCount: 1,
                fileCount: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await Conversation.aggregate<{
      rows: AuditAggregateRow[];
      total: CountRow[];
    }>(pipeline);
    const conversations = (result?.rows ?? []).map((row) => ({
      conversationId: row.conversationId,
      title: row.title ?? '',
      employee: {
        id: row.employee?._id?.toString() ?? '',
        name: row.employee?.name ?? '',
        email: row.employee?.email ?? '',
      },
      preview: row.preview ?? '',
      messageCount: row.messageCount ?? 0,
      fileCount: row.fileCount ?? 0,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    }));
    return {
      conversations,
      total: result?.total[0]?.count ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async function getAdminConversationDetail(input: {
    tenantId?: string;
    conversationId: string;
    limit: number;
    offset: number;
  }): Promise<TAdminConversationDetail | null> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          ...collectionScope(input.tenantId),
          conversationId: input.conversationId,
          isTemporary: { $ne: true },
        },
      },
      { $limit: 1 },
      ...addOwnerLookup(User.collection.name),
      {
        $lookup: {
          from: Message.collection.name,
          let: { conversationId: '$conversationId', owner: '$user' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$conversationId'] },
                    { $eq: ['$user', '$$owner'] },
                    { $ne: ['$isTemporary', true] },
                  ],
                },
              },
            },
            {
              $facet: {
                rows: [
                  { $sort: { createdAt: 1, _id: 1 } },
                  { $skip: input.offset },
                  { $limit: input.limit },
                  {
                    $project: {
                      _id: 0,
                      messageId: 1,
                      sender: 1,
                      text: { $substrCP: [{ $ifNull: ['$text', ''] }, 0, MAX_MESSAGE_TEXT_LENGTH] },
                      isCreatedByUser: 1,
                      createdAt: 1,
                    },
                  },
                ],
                total: [{ $count: 'count' }],
              },
            },
          ],
          as: 'messagePage',
        },
      },
      {
        $lookup: {
          from: File.collection.name,
          let: { conversationId: '$conversationId', owner: '$ownerObjectId' },
          pipeline: [
            {
              $match: {
                context: 'message_attachment',
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$conversationId'] },
                    { $eq: ['$user', '$$owner'] },
                  ],
                },
              },
            },
            { $sort: { createdAt: 1, _id: 1 } },
            { $limit: 200 },
            {
              $project: {
                _id: 0,
                fileId: '$file_id',
                filename: 1,
                type: 1,
                bytes: 1,
                createdAt: 1,
              },
            },
          ],
          as: 'files',
        },
      },
      {
        $project: {
          _id: 0,
          conversationId: 1,
          title: 1,
          employee: 1,
          createdAt: 1,
          updatedAt: 1,
          messages: { $ifNull: [{ $arrayElemAt: ['$messagePage.rows', 0] }, []] },
          messageTotal: { $ifNull: [{ $arrayElemAt: ['$messagePage.total.count', 0] }, 0] },
          files: 1,
        },
      },
    ];
    const [row] = await Conversation.aggregate<{
      conversationId: string;
      title?: string;
      employee?: { _id?: { toString(): string }; name?: string; email?: string };
      createdAt?: Date;
      updatedAt?: Date;
      messages: Array<{
        messageId: string;
        sender?: string;
        text?: string;
        isCreatedByUser?: boolean;
        createdAt?: Date;
      }>;
      files: Array<{
        fileId: string;
        filename: string;
        type: string;
        bytes: number;
        createdAt?: Date;
      }>;
      messageTotal: number;
    }>(pipeline);
    if (!row) {
      return null;
    }
    return {
      conversationId: row.conversationId,
      title: row.title ?? '',
      employee: {
        id: row.employee?._id?.toString() ?? '',
        name: row.employee?.name ?? '',
        email: row.employee?.email ?? '',
      },
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
      messages: row.messages.map((message) => ({
        messageId: message.messageId,
        sender: message.sender ?? '',
        text: message.text ?? '',
        isCreatedByUser: message.isCreatedByUser === true,
        createdAt: iso(message.createdAt),
      })),
      files: row.files.map((file) => ({
        fileId: file.fileId,
        filename: file.filename,
        type: file.type,
        bytes: file.bytes,
        createdAt: iso(file.createdAt),
      })),
      messageTotal: row.messageTotal,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async function getAdminUsageStatistics(input: {
    tenantId?: string;
    rangeDays: 7 | 30 | 90;
    now?: Date;
  }): Promise<TAdminUsageStatistics> {
    const now = input.now ?? new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const sevenDays = new Date(today.getTime() - 6 * 86400000);
    const thirtyDays = new Date(today.getTime() - 29 * 86400000);
    const rangeStart = new Date(today.getTime() - (input.rangeDays - 1) * 86400000);
    const statisticsStart = input.rangeDays > 30 ? rangeStart : thirtyDays;
    const scope = collectionScope(input.tenantId);
    const messageScope = {
      ...scope,
      isTemporary: { $ne: true },
      createdAt: { $gte: statisticsStart },
    };
    const periodGroup = {
      _id: null,
      today: { $sum: { $cond: [{ $gte: ['$createdAt', today] }, 1, 0] } },
      sevenDays: { $sum: { $cond: [{ $gte: ['$createdAt', sevenDays] }, 1, 0] } },
      thirtyDays: { $sum: { $cond: [{ $gte: ['$createdAt', thirtyDays] }, 1, 0] } },
    };
    const [registeredUsers, messageResult, conversationResult, fileResult] = await Promise.all([
      User.countDocuments(userScope(input.tenantId)),
      Message.aggregate<{
        counts: PeriodCounts[];
        active: PeriodCounts[];
        daily: DailyMessageRow[];
      }>([
        { $match: messageScope },
        {
          $facet: {
            counts: [{ $group: periodGroup }],
            active: [
              { $group: { _id: '$user', lastActivity: { $max: '$createdAt' } } },
              {
                $group: {
                  _id: null,
                  today: { $sum: { $cond: [{ $gte: ['$lastActivity', today] }, 1, 0] } },
                  sevenDays: { $sum: { $cond: [{ $gte: ['$lastActivity', sevenDays] }, 1, 0] } },
                  thirtyDays: { $sum: { $cond: [{ $gte: ['$lastActivity', thirtyDays] }, 1, 0] } },
                },
              },
            ],
            daily: [
              { $match: { createdAt: { $gte: rangeStart } } },
              {
                $group: {
                  _id: {
                    date: {
                      $dateToString: {
                        date: '$createdAt',
                        format: '%Y-%m-%d',
                        timezone: 'Asia/Jerusalem',
                      },
                    },
                    user: '$user',
                  },
                  messages: { $sum: 1 },
                },
              },
              {
                $group: {
                  _id: '$_id.date',
                  messages: { $sum: '$messages' },
                  activeUsers: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]).then((rows) => rows[0]),
      Conversation.aggregate<{ counts: PeriodCounts[]; daily: DailyConversationRow[] }>([
        {
          $match: {
            ...scope,
            isTemporary: { $ne: true },
            createdAt: { $gte: statisticsStart },
          },
        },
        {
          $facet: {
            counts: [{ $group: periodGroup }],
            daily: [
              { $match: { createdAt: { $gte: rangeStart } } },
              {
                $group: {
                  _id: {
                    $dateToString: {
                      date: '$createdAt',
                      format: '%Y-%m-%d',
                      timezone: 'Asia/Jerusalem',
                    },
                  },
                  conversations: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]).then((rows) => rows[0]),
      File.aggregate<{ total: CountRow[]; conversations: CountRow[] }>([
        { $match: { ...scope, context: 'message_attachment' } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            conversations: [
              { $match: { conversationId: { $type: 'string', $ne: '' } } },
              { $group: { _id: '$conversationId' } },
              { $count: 'count' },
            ],
          },
        },
      ]).then((rows) => rows[0]),
    ]);

    const messageCounts = messageResult?.counts[0] ?? { today: 0, sevenDays: 0, thirtyDays: 0 };
    const activeCounts = messageResult?.active[0] ?? { today: 0, sevenDays: 0, thirtyDays: 0 };
    const conversationCounts = conversationResult?.counts[0] ?? {
      today: 0,
      sevenDays: 0,
      thirtyDays: 0,
    };
    const daily = new Map<string, TAdminDailyUsage>();
    for (const row of messageResult?.daily ?? []) {
      daily.set(row._id, {
        date: row._id,
        messages: row.messages,
        activeUsers: row.activeUsers,
        conversations: 0,
      });
    }
    for (const row of conversationResult?.daily ?? []) {
      const current = daily.get(row._id);
      daily.set(row._id, {
        date: row._id,
        messages: current?.messages ?? 0,
        activeUsers: current?.activeUsers ?? 0,
        conversations: row.conversations,
      });
    }
    return {
      registeredUsers,
      activeUsersToday: activeCounts.today,
      activeUsers7Days: activeCounts.sevenDays,
      activeUsers30Days: activeCounts.thirtyDays,
      conversationsToday: conversationCounts.today,
      conversations7Days: conversationCounts.sevenDays,
      conversations30Days: conversationCounts.thirtyDays,
      messagesToday: messageCounts.today,
      messages7Days: messageCounts.sevenDays,
      messages30Days: messageCounts.thirtyDays,
      conversationsWithFiles: fileResult?.conversations[0]?.count ?? 0,
      totalUploadedFiles: fileResult?.total[0]?.count ?? 0,
      rangeDays: input.rangeDays,
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async function listAdminEmployees(input: AdminEmployeeQuery): Promise<TAdminEmployeesPage> {
    const filter: FilterQuery<IUser> = userScope(input.tenantId);
    if (input.query) {
      const regex = new RegExp(escapeRegex(input.query), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { username: regex }];
    }
    const [rows, total] = await Promise.all([
      User.find(filter, '_id name email')
        .sort({ name: 1, _id: 1 })
        .skip(input.offset)
        .limit(input.limit)
        .lean<IUser[]>(),
      User.countDocuments(filter),
    ]);
    return {
      employees: rows.map((row) => ({
        id: row._id.toString(),
        name: row.name ?? '',
        email: row.email ?? '',
      })),
      total,
      limit: input.limit,
      offset: input.offset,
    };
  }

  return {
    listAdminAuditConversations,
    getAdminConversationDetail,
    getAdminUsageStatistics,
    listAdminEmployees,
  };
}
