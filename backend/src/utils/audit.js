const prisma = require('../utils/prisma');

/**
 * Create an immutable audit log entry.
 */
async function createAuditLog({ userId, module, action, recordId, oldValue, newValue, ipAddress }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        module,
        action,
        recordId: recordId || null,
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
        ipAddress: ipAddress || null,
      },
    });
  } catch (err) {
    // Audit log failures should not break the main flow
    console.error('Audit log error:', err.message);
  }
}

module.exports = { createAuditLog };
