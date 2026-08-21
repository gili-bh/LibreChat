const express = require('express');
const { createAdminUsageHandlers } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const checkAdmin = require('~/server/middleware/roles/admin');
const db = require('~/models');

const router = express.Router();
const requireUsageRead = requireCapability(SystemCapabilities.READ_USAGE);
const handlers = createAdminUsageHandlers({
  listAdminAuditConversations: db.listAdminAuditConversations,
  getAdminConversationDetail: db.getAdminConversationDetail,
  getAdminUsageStatistics: db.getAdminUsageStatistics,
  listAdminEmployees: db.listAdminEmployees,
});

router.use(requireJwtAuth, checkAdmin, requireUsageRead);
router.get('/conversations', handlers.listConversations);
router.get('/conversations/:conversationId', handlers.getConversation);
router.get('/statistics', handlers.getStatistics);
router.get('/employees', handlers.listEmployees);

module.exports = router;
