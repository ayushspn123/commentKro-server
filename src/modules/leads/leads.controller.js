const Lead = require('./lead.model');

const getLeads = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const filter = { userId: req.user.id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.platform) filter.platform = req.query.platform;
    if (req.query.tag) filter.tags = req.query.tag;

    const [leads, total] = await Promise.all([
      Lead.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Lead.countDocuments(filter),
    ]);

    res.json({ success: true, data: { leads, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
};

const updateLead = async (req, res, next) => {
  try {
    const allowed = ['status', 'notes', 'tags'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.status) update.lastContactedAt = new Date();

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: update },
      { new: true }
    );
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
};

const exportLeads = async (req, res, next) => {
  try {
    const User = require('../auth/auth.model');
    const user = await User.findById(req.user.id).select('plan').lean();
    if (!user || user.plan === 'free') {
      return res.status(403).json({ success: false, message: 'CSV export is a Pro feature. Upgrade to download your leads.' });
    }

    const leads = await Lead.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();

    const header = 'ID,Recipient ID,Platform,Automation,Status,Tags,Notes,Created At,Last Contacted\n';
    const rows = leads.map(l =>
      [
        l._id,
        l.recipientId,
        l.platform,
        `"${(l.automationName || '').replace(/"/g, '""')}"`,
        l.status,
        `"${(l.tags || []).join(', ')}"`,
        `"${(l.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        l.createdAt ? new Date(l.createdAt).toISOString() : '',
        l.lastContactedAt ? new Date(l.lastContactedAt).toISOString() : '',
      ].join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`);
    res.send(header + rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { getLeads, updateLead, exportLeads };
