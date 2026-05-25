const mongoose = require('mongoose');
const Message = require('../messaging/message.model');
const Automation = require('../automation/automation.model');

/**
 * Get message analytics for a user
 */
const getMessageStats = async (userId, { from, to, platform } = {}) => {
  const match = { userId: new mongoose.Types.ObjectId(userId) };
  if (platform) match.platform = platform;
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const [msgStats] = await Message.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
      },
    },
  ]);

  // Sum triggered count from automations for "Comments Matched"
  const [triggerStats] = await Automation.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, triggered: { $sum: '$stats.triggered' } } },
  ]);

  return {
    total: triggerStats?.triggered ?? 0,
    sent: msgStats?.sent ?? 0,
    delivered: msgStats?.delivered ?? 0,
    failed: msgStats?.failed ?? 0,
  };
};

/**
 * Get daily message volume for charting
 */
const getDailyVolume = async (userId, days = 30) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return Message.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

/**
 * Get top performing automations
 */
const getTopAutomations = async (userId, limit = 5) => {
  return Automation.find({ userId })
    .sort({ 'stats.sent': -1 })
    .limit(limit)
    .select('name stats platform')
    .lean();
};

/**
 * Get current usage vs plan limits for sidebar meters
 */
const getUsageStats = async (userId) => {
  const User = require('../auth/auth.model');
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [user, automationsCount, dmsThisMonth] = await Promise.all([
    User.findById(userId),
    Automation.countDocuments({ userId }),
    Message.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      direction: 'outbound',
      type: 'dm',
      status: { $in: ['sent', 'delivered', 'read'] },
      createdAt: { $gte: startOfMonth },
    }),
  ]);

  return {
    dmsThisMonth,
    automationsCount,
    limits: {
      dailyDMs: user?.planLimits?.dailyDMs ?? 1000,
      automations: user?.planLimits?.automations ?? 3,
    },
    plan: user?.plan ?? 'free',
  };
};

/**
 * Get stats + daily volume for a single automation
 */
const getAutomationStats = async (userId, automationId, days = 30) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const aid = new mongoose.Types.ObjectId(automationId);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const automation = await Automation.findOne({ _id: aid, userId: uid })
    .select('name stats platform trigger isActive createdAt')
    .lean();
  if (!automation) return null;

  const [msgStats] = await Message.aggregate([
    { $match: { userId: uid, automationId: aid } },
    {
      $group: {
        _id: null,
        sent: { $sum: { $cond: [{ $in: ['$status', ['sent', 'delivered', 'read']] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
      },
    },
  ]);

  const volume = await Message.aggregate([
    { $match: { userId: uid, automationId: aid, createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    automation: {
      _id: automation._id,
      name: automation.name,
      platform: automation.platform,
      isActive: automation.isActive,
      triggerType: automation.trigger?.type,
      createdAt: automation.createdAt,
    },
    stats: {
      triggered: automation.stats?.triggered ?? 0,
      sent: msgStats?.sent ?? 0,
      delivered: msgStats?.delivered ?? 0,
      failed: msgStats?.failed ?? 0,
    },
    volume,
  };
};

module.exports = { getMessageStats, getDailyVolume, getTopAutomations, getUsageStats, getAutomationStats };
