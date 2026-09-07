import { Types } from 'mongoose';
import { PrincipalType, SystemRoles } from 'librechat-data-provider';
import type { IUser } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { createAdminUsersHandlers, type AdminUsersDeps } from './users';

jest.mock('@librechat/data-schemas', () => ({
  ...jest.requireActual('@librechat/data-schemas'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const callerId = new Types.ObjectId().toString();
const targetId = new Types.ObjectId().toString();
const user = (overrides: Partial<IUser> = {}): IUser =>
  ({
    _id: new Types.ObjectId(targetId),
    name: 'Test User',
    username: 'testuser',
    email: 'test@example.com',
    role: SystemRoles.USER,
    provider: 'local',
    disabled: false,
    emailVerified: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    ...overrides,
  }) as IUser;

const deps = (overrides: Partial<AdminUsersDeps> = {}): AdminUsersDeps => ({
  findUsers: jest.fn().mockResolvedValue([]),
  countUsers: jest.fn().mockResolvedValue(0),
  createUser: jest.fn().mockResolvedValue(user()),
  updateUser: jest.fn().mockImplementation((_id, update) => Promise.resolve(user(update))),
  deleteAllUserSessions: jest.fn().mockResolvedValue(undefined),
  hashPassword: jest.fn().mockResolvedValue('$2a$10$hashed'),
  minPasswordLength: 8,
  deleteUserById: jest.fn().mockResolvedValue({ deletedCount: 1, message: 'deleted' }),
  deleteConfig: jest.fn().mockResolvedValue(null),
  deleteAclEntries: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const reqRes = (body: unknown = {}, id = targetId) => {
  const req = {
    body,
    params: { id },
    query: {},
    user: { _id: new Types.ObjectId(callerId), role: SystemRoles.ADMIN },
  } as unknown as ServerRequest;
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { req, res: { status } as unknown as Response, status, json };
};

describe('admin user handlers', () => {
  it('returns a sanitized paginated user list', async () => {
    const mocks = deps({
      findUsers: jest.fn().mockResolvedValue([user()]),
      countUsers: jest.fn().mockResolvedValue(1),
    });
    const { req, res, json } = reqRes();
    req.query = { q: 'test', limit: '10' };
    await createAdminUsersHandlers(mocks).listUsers(req, res);
    const response = json.mock.calls[0][0];
    expect(response.total).toBe(1);
    expect(response.users[0]).not.toHaveProperty('password');
  });

  it('hashes a new local password and never returns it', async () => {
    const createUser = jest.fn().mockResolvedValue(user());
    const mocks = deps({ createUser });
    const { req, res, status, json } = reqRes({
      name: 'New User',
      email: 'NEW@example.com',
      username: 'NewUser',
      password: 'raw-secret',
      role: SystemRoles.USER,
    });
    await createAdminUsersHandlers(mocks).createUser(req, res);
    expect(mocks.hashPassword).toHaveBeenCalledWith('raw-secret');
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', password: '$2a$10$hashed' }),
      undefined,
      true,
      true,
    );
    expect(status).toHaveBeenCalledWith(201);
    expect(JSON.stringify(json.mock.calls[0][0])).not.toMatch(/raw-secret|\$2a\$10\$hashed/);
  });

  it('rejects duplicate email before creating a user', async () => {
    const mocks = deps({ findUsers: jest.fn().mockResolvedValue([user()]) });
    const { req, res, status } = reqRes({
      name: 'New User',
      email: 'test@example.com',
      username: 'different',
      password: 'raw-secret',
    });
    await createAdminUsersHandlers(mocks).createUser(req, res);
    expect(status).toHaveBeenCalledWith(409);
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it('accepts a Hebrew-only name update', async () => {
    const mocks = deps({ findUsers: jest.fn().mockResolvedValue([user()]) });
    const { req, res, status, json } = reqRes({ name: 'דן' });

    await createAdminUsersHandlers(mocks).updateUser(req, res);

    expect(mocks.updateUser).toHaveBeenCalledWith(targetId, { name: 'דן' });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      user: expect.objectContaining({ name: 'דן' }),
    });
  });

  it('resets a hashed password and revokes sessions', async () => {
    const mocks = deps({ findUsers: jest.fn().mockResolvedValue([user()]) });
    const { req, res } = reqRes({ password: 'new-secret' });
    await createAdminUsersHandlers(mocks).resetPassword(req, res);
    expect(mocks.updateUser).toHaveBeenCalledWith(targetId, { password: '$2a$10$hashed' });
    expect(mocks.deleteAllUserSessions).toHaveBeenCalledWith({ userId: targetId });
  });

  it('disables a user and revokes sessions', async () => {
    const mocks = deps();
    const { req, res } = reqRes({ disabled: true });
    await createAdminUsersHandlers(mocks).setUserStatus(req, res);
    expect(mocks.updateUser).toHaveBeenCalledWith(targetId, { disabled: true });
    expect(mocks.deleteAllUserSessions).toHaveBeenCalledWith({ userId: targetId });
  });

  it('prevents self-demotion and deleting the last administrator', async () => {
    const self = user({ _id: new Types.ObjectId(callerId), role: SystemRoles.ADMIN });
    const mocks = deps({
      findUsers: jest.fn().mockResolvedValue([self]),
      countUsers: jest.fn().mockResolvedValue(1),
    });
    const edit = reqRes({ role: SystemRoles.USER }, callerId);
    await createAdminUsersHandlers(mocks).updateUser(edit.req, edit.res);
    expect(edit.status).toHaveBeenCalledWith(400);
    const remove = reqRes();
    await createAdminUsersHandlers(
      deps({
        findUsers: jest.fn().mockResolvedValue([user({ role: SystemRoles.ADMIN })]),
        countUsers: jest.fn().mockResolvedValue(1),
      }),
    ).deleteUser(remove.req, remove.res);
    expect(remove.status).toHaveBeenCalledWith(400);
  });

  it('deletes a regular user and its auth/config records', async () => {
    const mocks = deps({ findUsers: jest.fn().mockResolvedValue([user()]) });
    const { req, res, status } = reqRes();
    await createAdminUsersHandlers(mocks).deleteUser(req, res);
    expect(mocks.deleteAllUserSessions).toHaveBeenCalledWith({ userId: targetId });
    expect(mocks.deleteConfig).toHaveBeenCalledWith(PrincipalType.USER, targetId);
    expect(mocks.deleteAclEntries).toHaveBeenCalledWith({
      principalType: PrincipalType.USER,
      principalId: expect.any(Types.ObjectId),
    });
    expect(status).toHaveBeenCalledWith(200);
  });
});
