const analyticsService = require('./analytics.service');

const getStats = async (req, res, next) => {
  try {
    const stats = await analyticsService.getMessageStats(req.user.id, req.query);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

const getDailyVolume = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const data = await analyticsService.getDailyVolume(req.user.id, days);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const getTopAutomations = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;
    const data = await analyticsService.getTopAutomations(req.user.id, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const getUsage = async (req, res, next) => {
  try {
    const data = await analyticsService.getUsageStats(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const getAutomationStats = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const data = await analyticsService.getAutomationStats(req.user.id, req.params.id, days);
    if (!data) return res.status(404).json({ success: false, message: 'Automation not found' });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStats, getDailyVolume, getTopAutomations, getUsage, getAutomationStats };
