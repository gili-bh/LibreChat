const express = require('express');
const request = require('supertest');
const { SystemRoles } = require('librechat-data-provider');

jest.mock('@librechat/api', () => ({
  createAdminUsersHandlers: () => ({
    listUsers: (_req, res) => res.status(200).json({ users: [] }),
    searchUsers: (_req, res) => res.status(200).json({ users: [] }),
    createUser: (_req, res) => res.status(201).json({}),
    updateUser: (_req, res) => res.status(200).json({}),
    resetPassword: (_req, res) => res.status(200).json({}),
    setUserStatus: (_req, res) => res.status(200).json({}),
    deleteUser: (_req, res) => res.status(200).json({}),
  }),
  hashPassword: jest.fn(),
}));
jest.mock('@librechat/data-schemas', () => ({
  SystemCapabilities: { READ_USERS: 'read', MANAGE_USERS: 'manage' },
}));
jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = { role: req.get('x-test-role') || 'USER' };
    next();
  },
}));
jest.mock('~/server/middleware/roles/capabilities', () => ({
  requireCapability: () => (_req, _res, next) => next(),
}));
jest.mock('~/models', () => ({}));

const router = require('./users');
const app = express().use(express.json()).use('/api/admin/users', router);

describe('admin users route authorization', () => {
  it.each([
    ['get', '/api/admin/users'],
    ['post', '/api/admin/users'],
    ['patch', '/api/admin/users/507f1f77bcf86cd799439011'],
    ['post', '/api/admin/users/507f1f77bcf86cd799439011/reset-password'],
    ['post', '/api/admin/users/507f1f77bcf86cd799439011/status'],
    ['delete', '/api/admin/users/507f1f77bcf86cd799439011'],
  ])('denies a standard user: %s %s', async (method, path) => {
    await request(app)[method](path).set('x-test-role', SystemRoles.USER).expect(403);
  });

  it('allows a built-in administrator to list users', async () => {
    await request(app).get('/api/admin/users').set('x-test-role', SystemRoles.ADMIN).expect(200);
  });
});
