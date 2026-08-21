const express = require('express');
const request = require('supertest');
const { SystemRoles } = require('librechat-data-provider');

jest.mock('@librechat/api', () => ({
  createAdminUsageHandlers: () => ({
    listConversations: (_req, res) => res.status(200).json({ conversations: [] }),
    getConversation: (_req, res) => res.status(200).json({ conversationId: 'one' }),
    getStatistics: (_req, res) => res.status(200).json({ daily: [] }),
    listEmployees: (_req, res) => res.status(200).json({ employees: [] }),
  }),
}));
jest.mock('@librechat/data-schemas', () => ({ SystemCapabilities: { READ_USAGE: 'read:usage' } }));
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

const router = require('./usage');
const app = express().use('/api/admin/usage', router);

describe('admin usage route authorization', () => {
  const paths = [
    '/api/admin/usage/conversations',
    '/api/admin/usage/conversations/conversation-1',
    '/api/admin/usage/statistics',
    '/api/admin/usage/employees',
  ];
  it.each(paths)('returns 403 to a standard user for %s', async (path) => {
    await request(app).get(path).set('x-test-role', SystemRoles.USER).expect(403);
  });
  it.each(paths)('allows a built-in administrator to access %s', async (path) => {
    await request(app).get(path).set('x-test-role', SystemRoles.ADMIN).expect(200);
  });
});
