const express = require('express');
const { createAdminUsersHandlers, hashPassword } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const checkAdmin = require('~/server/middleware/roles/admin');
const db = require('~/models');

const router = express.Router();

const requireReadUsers = requireCapability(SystemCapabilities.READ_USERS);
const requireManageUsers = requireCapability(SystemCapabilities.MANAGE_USERS);

const handlers = createAdminUsersHandlers({
  findUsers: db.findUsers,
  countUsers: db.countUsers,
  createUser: db.createUser,
  updateUser: db.updateUser,
  deleteAllUserSessions: db.deleteAllUserSessions,
  hashPassword,
  minPasswordLength: Math.max(8, Number.parseInt(process.env.MIN_PASSWORD_LENGTH ?? '8', 10) || 8),
  deleteUserById: db.deleteUserById,
  deleteConfig: db.deleteConfig,
  deleteAclEntries: db.deleteAclEntries,
});

router.use(requireJwtAuth, checkAdmin);

router.get('/', requireReadUsers, handlers.listUsers);
router.get('/search', requireReadUsers, handlers.searchUsers);
router.post('/', requireManageUsers, handlers.createUser);
router.patch('/:id', requireManageUsers, handlers.updateUser);
router.post('/:id/reset-password', requireManageUsers, handlers.resetPassword);
router.post('/:id/status', requireManageUsers, handlers.setUserStatus);
router.delete('/:id', requireManageUsers, handlers.deleteUser);

module.exports = router;
