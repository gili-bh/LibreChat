import { z } from 'zod';
import { logger } from '@librechat/data-schemas';
import type {
  TAdminAuditPage,
  TAdminConversationDetail,
  TAdminEmployeesPage,
  TAdminUsageStatistics,
} from 'librechat-data-provider';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';

const MAX_QUERY_LENGTH = 200;
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
const dateSchema = z
  .string()
  .date()
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
const auditQuerySchema = paginationSchema.extend({
  employeeId: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().max(320).optional(),
  from: dateSchema.optional(),
  to: dateSchema.transform((value) => new Date(value.getTime() + 86400000 - 1)).optional(),
  files: z.enum(['with', 'without']).optional(),
  q: z.string().trim().max(MAX_QUERY_LENGTH).optional(),
});
const employeeQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(MAX_QUERY_LENGTH).optional(),
});
const statisticsQuerySchema = z.object({
  days: z.coerce
    .number()
    .pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))
    .default(30),
});
const detailParamsSchema = z.object({ conversationId: z.string().trim().min(1).max(200) });

export interface AdminUsageDeps {
  listAdminAuditConversations: (input: {
    tenantId?: string;
    employeeId?: string;
    email?: string;
    from?: Date;
    to?: Date;
    files?: 'with' | 'without';
    query?: string;
    limit: number;
    offset: number;
  }) => Promise<TAdminAuditPage>;
  getAdminConversationDetail: (input: {
    tenantId?: string;
    conversationId: string;
    limit: number;
    offset: number;
  }) => Promise<TAdminConversationDetail | null>;
  getAdminUsageStatistics: (input: {
    tenantId?: string;
    rangeDays: 7 | 30 | 90;
  }) => Promise<TAdminUsageStatistics>;
  listAdminEmployees: (input: {
    tenantId?: string;
    query?: string;
    limit: number;
    offset: number;
  }) => Promise<TAdminEmployeesPage>;
}

export interface AdminUsageHandlers {
  listConversations: (req: ServerRequest, res: Response) => Promise<Response>;
  getConversation: (req: ServerRequest, res: Response) => Promise<Response>;
  getStatistics: (req: ServerRequest, res: Response) => Promise<Response>;
  listEmployees: (req: ServerRequest, res: Response) => Promise<Response>;
}

const tenantId = (req: ServerRequest): string | undefined => req.user?.tenantId || undefined;

export function createAdminUsageHandlers(deps: AdminUsageDeps): AdminUsageHandlers {
  async function listConversations(req: ServerRequest, res: Response): Promise<Response> {
    const parsed = auditQuerySchema.safeParse(req.query);
    if (
      !parsed.success ||
      (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to)
    ) {
      return res.status(400).json({ error: 'Invalid audit query' });
    }
    try {
      const result = await deps.listAdminAuditConversations({
        tenantId: tenantId(req),
        employeeId: parsed.data.employeeId,
        email: parsed.data.email,
        from: parsed.data.from,
        to: parsed.data.to,
        files: parsed.data.files,
        query: parsed.data.q,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });
      return res.status(200).json(result);
    } catch (error) {
      logger.error('[adminUsage] Failed to list conversations', error);
      return res.status(500).json({ error: 'Failed to list conversations' });
    }
  }

  async function getConversation(req: ServerRequest, res: Response): Promise<Response> {
    const params = detailParamsSchema.safeParse(req.params);
    const query = paginationSchema.safeParse(req.query);
    if (!params.success || !query.success) {
      return res.status(400).json({ error: 'Invalid conversation query' });
    }
    try {
      const result = await deps.getAdminConversationDetail({
        tenantId: tenantId(req),
        conversationId: params.data.conversationId,
        limit: query.data.limit,
        offset: query.data.offset,
      });
      return result
        ? res.status(200).json(result)
        : res.status(404).json({ error: 'Conversation not found' });
    } catch (error) {
      logger.error('[adminUsage] Failed to inspect conversation', error);
      return res.status(500).json({ error: 'Failed to inspect conversation' });
    }
  }

  async function getStatistics(req: ServerRequest, res: Response): Promise<Response> {
    const parsed = statisticsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid statistics range' });
    }
    try {
      const result = await deps.getAdminUsageStatistics({
        tenantId: tenantId(req),
        rangeDays: parsed.data.days,
      });
      return res.status(200).json(result);
    } catch (error) {
      logger.error('[adminUsage] Failed to load statistics', error);
      return res.status(500).json({ error: 'Failed to load statistics' });
    }
  }

  async function listEmployees(req: ServerRequest, res: Response): Promise<Response> {
    const parsed = employeeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid employee query' });
    }
    try {
      const result = await deps.listAdminEmployees({
        tenantId: tenantId(req),
        query: parsed.data.q,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });
      return res.status(200).json(result);
    } catch (error) {
      logger.error('[adminUsage] Failed to list employees', error);
      return res.status(500).json({ error: 'Failed to list employees' });
    }
  }

  return { listConversations, getConversation, getStatistics, listEmployees };
}
