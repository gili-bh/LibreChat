import { Types } from 'mongoose';
import { z } from 'zod';
import { PrincipalType, SystemRoles } from 'librechat-data-provider';
import type { BalanceConfig } from 'librechat-data-provider';
import { logger, isValidObjectIdString } from '@librechat/data-schemas';
import type {
  IUser,
  IConfig,
  CreateUserRequest,
  AdminUserListItem,
  AdminUserSearchResult,
  UserDeleteResult,
} from '@librechat/data-schemas';
import type { FilterQuery } from 'mongoose';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { parsePagination } from './pagination';

const MAX_SEARCH_LENGTH = 200;
const MAX_PASSWORD_LENGTH = 128;
const USER_LIST_FIELDS =
  '_id name username email avatar role provider disabled emailVerified createdAt updatedAt';

const roleSchema = z.enum([SystemRoles.USER, SystemRoles.ADMIN]);
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
const usernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[\p{L}\p{N}_.@#$%&*()]+$/u, 'Invalid characters in username')
  .transform((value) => value.toLowerCase());
const createUserSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    email: emailSchema,
    username: usernameSchema,
    password: z.string(),
    role: roleSchema.default(SystemRoles.USER),
    emailVerified: z.boolean().default(true),
  })
  .strict();
const updateUserSchema = z
  .object({
    name: z.string().trim().min(3).max(80).optional(),
    email: emailSchema.optional(),
    username: usernameSchema.optional(),
    role: roleSchema.optional(),
    emailVerified: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
const statusSchema = z.object({ disabled: z.boolean() }).strict();

type UserUpdate = Partial<
  Pick<IUser, 'name' | 'email' | 'username' | 'role' | 'emailVerified' | 'disabled' | 'password'>
>;

export interface AdminUsersDeps {
  findUsers: (
    searchCriteria: FilterQuery<IUser>,
    fieldsToSelect?: string | string[] | null,
    options?: { limit?: number; offset?: number; sort?: Record<string, 1 | -1> },
  ) => Promise<IUser[]>;
  countUsers: (filter?: FilterQuery<IUser>) => Promise<number>;
  createUser: (
    data: CreateUserRequest,
    balanceConfig?: BalanceConfig,
    disableTTL?: boolean,
    returnUser?: boolean,
  ) => Promise<Types.ObjectId | Partial<IUser>>;
  updateUser: (userId: string, updateData: UserUpdate) => Promise<IUser | null>;
  deleteAllUserSessions: (filter: { userId: string }) => Promise<unknown>;
  hashPassword: (password: string) => Promise<string>;
  minPasswordLength: number;
  deleteUserById: (userId: string) => Promise<UserDeleteResult>;
  deleteConfig: (
    principalType: PrincipalType,
    principalId: string | Types.ObjectId,
  ) => Promise<IConfig | null>;
  deleteAclEntries: (filter: {
    principalType: PrincipalType;
    principalId: string | Types.ObjectId;
  }) => Promise<void>;
}

export interface AdminUsersHandlers {
  listUsers: (req: ServerRequest, res: Response) => Promise<Response>;
  searchUsers: (req: ServerRequest, res: Response) => Promise<Response>;
  createUser: (req: ServerRequest, res: Response) => Promise<Response>;
  updateUser: (req: ServerRequest, res: Response) => Promise<Response>;
  resetPassword: (req: ServerRequest, res: Response) => Promise<Response>;
  setUserStatus: (req: ServerRequest, res: Response) => Promise<Response>;
  deleteUser: (req: ServerRequest, res: Response) => Promise<Response>;
}

const sanitizeUser = (user: Partial<IUser>): AdminUserListItem => ({
  id: user._id?.toString() ?? '',
  name: user.name ?? '',
  username: user.username ?? '',
  email: user.email ?? '',
  avatar: user.avatar ?? '',
  role: user.role ?? SystemRoles.USER,
  provider: user.provider ?? 'local',
  disabled: user.disabled === true,
  emailVerified: user.emailVerified === true,
  createdAt: user.createdAt?.toISOString(),
  updatedAt: user.updatedAt?.toISOString(),
});

const getCallerId = (req: ServerRequest): string => req.user?._id?.toString() ?? req.user?.id ?? '';

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' && error != null && 'code' in error && error.code === 11000;

export function createAdminUsersHandlers(deps: AdminUsersDeps): AdminUsersHandlers {
  const {
    findUsers,
    countUsers,
    createUser,
    updateUser,
    deleteAllUserSessions,
    hashPassword,
    minPasswordLength,
    deleteUserById,
    deleteConfig,
    deleteAclEntries,
  } = deps;

  const passwordSchema = z
    .string()
    .min(Math.max(1, minPasswordLength))
    .max(MAX_PASSWORD_LENGTH)
    .refine((value) => value.trim().length > 0, 'Password cannot be only spaces');

  async function findDuplicateUser(
    email: string | undefined,
    username: string | undefined,
    excludeId?: string,
  ): Promise<IUser | undefined> {
    const alternatives: FilterQuery<IUser>[] = [];
    if (email) {
      alternatives.push({ email });
    }
    if (username) {
      alternatives.push({ username });
    }
    if (alternatives.length === 0) {
      return undefined;
    }
    const filter: FilterQuery<IUser> = { $or: alternatives };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const [duplicate] = await findUsers(filter, '_id email username', { limit: 1 });
    return duplicate;
  }

  async function getTargetUser(id: string, fields = USER_LIST_FIELDS): Promise<IUser | undefined> {
    const [user] = await findUsers({ _id: id }, fields, { limit: 1 });
    return user;
  }

  async function getAdminRemovalError(
    target: IUser,
    callerId: string,
  ): Promise<string | undefined> {
    if (target.role !== SystemRoles.ADMIN) {
      return undefined;
    }
    if (target._id.toString() === callerId) {
      return 'Cannot remove your own admin access';
    }
    const adminCount = await countUsers({ role: SystemRoles.ADMIN });
    return adminCount <= 1 ? 'Cannot remove the last admin user' : undefined;
  }

  async function listUsersHandler(req: ServerRequest, res: Response) {
    try {
      const { limit, offset } = parsePagination(req.query);
      const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (rawQuery.length > MAX_SEARCH_LENGTH) {
        return res.status(400).json({ error: 'Search query is too long' });
      }
      const escaped = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = rawQuery ? new RegExp(escaped, 'i') : undefined;
      const filter: FilterQuery<IUser> = regex
        ? { $or: [{ name: regex }, { email: regex }, { username: regex }] }
        : {};
      const [users, total] = await Promise.all([
        findUsers(filter, USER_LIST_FIELDS, { limit, offset, sort: { createdAt: -1 } }),
        countUsers(filter),
      ]);
      return res.status(200).json({ users: users.map(sanitizeUser), total, limit, offset });
    } catch (error) {
      logger.error('[adminUsers] listUsers error:', error);
      return res.status(500).json({ error: 'Failed to list users' });
    }
  }

  async function searchUsersHandler(req: ServerRequest, res: Response) {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }
      if (query.length < 2 || query.length > MAX_SEARCH_LENGTH) {
        return res.status(400).json({ error: 'Query must be between 2 and 200 characters' });
      }
      const requestedLimit = typeof req.query.limit === 'string' ? req.query.limit : '20';
      const limit = Math.min(Math.max(1, parseInt(requestedLimit, 10) || 20), 50);
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}`, 'i');
      const users = await findUsers(
        { $or: [{ name: regex }, { email: regex }, { username: regex }] },
        '_id name email username avatar',
        { limit, sort: { name: 1 } },
      );
      const results: AdminUserSearchResult[] = users.map((user) => ({
        id: user._id?.toString() ?? '',
        name: user.name ?? '',
        email: user.email ?? '',
        username: user.username,
        avatarUrl: user.avatar,
      }));
      return res
        .status(200)
        .json({ users: results, total: results.length, capped: results.length >= limit });
    } catch (error) {
      logger.error('[adminUsers] searchUsers error:', error);
      return res.status(500).json({ error: 'Failed to search users' });
    }
  }

  async function createUserHandler(req: ServerRequest, res: Response) {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid user details' });
    }
    const password = passwordSchema.safeParse(parsed.data.password);
    if (!password.success) {
      return res.status(400).json({ error: 'Password does not meet the configured policy' });
    }
    try {
      const duplicate = await findDuplicateUser(parsed.data.email, parsed.data.username);
      if (duplicate) {
        const field = duplicate.email === parsed.data.email ? 'email' : 'username';
        return res.status(409).json({ error: `A user with that ${field} already exists`, field });
      }
      const passwordHash = await hashPassword(password.data);
      const created = await createUser(
        {
          name: parsed.data.name,
          email: parsed.data.email,
          username: parsed.data.username,
          password: passwordHash,
          role: parsed.data.role,
          emailVerified: parsed.data.emailVerified,
          provider: 'local',
        },
        undefined,
        true,
        true,
      );
      return res.status(201).json({ user: sanitizeUser(created as Partial<IUser>) });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ error: 'A user with that email or username already exists' });
      }
      logger.error('[adminUsers] createUser error:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }

  async function updateUserHandler(req: ServerRequest, res: Response) {
    const { id } = req.params as { id: string };
    if (!isValidObjectIdString(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid user update' });
    }
    try {
      const target = await getTargetUser(id);
      if (!target) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (target.role === SystemRoles.ADMIN && parsed.data.role === SystemRoles.USER) {
        const safetyError = await getAdminRemovalError(target, getCallerId(req));
        if (safetyError) {
          return res.status(400).json({ error: safetyError });
        }
      }
      const duplicate = await findDuplicateUser(parsed.data.email, parsed.data.username, id);
      if (duplicate) {
        const field = duplicate.email === parsed.data.email ? 'email' : 'username';
        return res.status(409).json({ error: `A user with that ${field} already exists`, field });
      }
      const updated = await updateUser(id, parsed.data);
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(200).json({ user: sanitizeUser(updated) });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ error: 'A user with that email or username already exists' });
      }
      logger.error('[adminUsers] updateUser error:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }

  async function resetPasswordHandler(req: ServerRequest, res: Response) {
    const { id } = req.params as { id: string };
    if (!isValidObjectIdString(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const parsed = z.object({ password: passwordSchema }).strict().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Password does not meet the configured policy' });
    }
    try {
      const target = await getTargetUser(id, '_id');
      if (!target) {
        return res.status(404).json({ error: 'User not found' });
      }
      const passwordHash = await hashPassword(parsed.data.password);
      await updateUser(id, { password: passwordHash });
      await deleteAllUserSessions({ userId: id });
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error('[adminUsers] resetPassword error:', error);
      return res.status(500).json({ error: 'Failed to reset password' });
    }
  }

  async function setUserStatusHandler(req: ServerRequest, res: Response) {
    const { id } = req.params as { id: string };
    if (!isValidObjectIdString(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid user status' });
    }
    if (parsed.data.disabled && id === getCallerId(req)) {
      return res.status(400).json({ error: 'Cannot disable your own account' });
    }
    try {
      const updated = await updateUser(id, { disabled: parsed.data.disabled });
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (parsed.data.disabled) {
        await deleteAllUserSessions({ userId: id });
      }
      return res.status(200).json({ user: sanitizeUser(updated) });
    } catch (error) {
      logger.error('[adminUsers] setUserStatus error:', error);
      return res.status(500).json({ error: 'Failed to update user status' });
    }
  }

  async function deleteUserHandler(req: ServerRequest, res: Response) {
    const { id } = req.params as { id: string };
    if (!isValidObjectIdString(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    if (getCallerId(req) === id) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }
    try {
      const target = await getTargetUser(id, '_id role');
      if (!target) {
        return res.status(404).json({ error: 'User not found' });
      }
      const safetyError = await getAdminRemovalError(target, getCallerId(req));
      if (safetyError) {
        return res.status(400).json({ error: safetyError });
      }
      await deleteAllUserSessions({ userId: id });
      const result = await deleteUserById(id);
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const objectId = new Types.ObjectId(id);
      const cleanupResults = await Promise.allSettled([
        deleteConfig(PrincipalType.USER, id),
        deleteAclEntries({ principalType: PrincipalType.USER, principalId: objectId }),
      ]);
      for (const cleanup of cleanupResults) {
        if (cleanup.status === 'rejected') {
          logger.error('[adminUsers] cascade cleanup failed for user:', id, cleanup.reason);
        }
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error('[adminUsers] deleteUser error:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  return {
    listUsers: listUsersHandler,
    searchUsers: searchUsersHandler,
    createUser: createUserHandler,
    updateUser: updateUserHandler,
    resetPassword: resetPasswordHandler,
    setUserStatus: setUserStatusHandler,
    deleteUser: deleteUserHandler,
  };
}
