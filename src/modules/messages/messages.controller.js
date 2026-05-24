const mongoose = require('mongoose');
const Message = require('../messaging/message.model');

const getContacts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const [contacts, countResult] = await Promise.all([
      Message.aggregate([
        { $match: { userId, direction: 'outbound', type: 'dm' } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$recipientId',
            lastMessage: { $first: '$content' },
            lastSentAt: { $first: '$createdAt' },
            totalSent: { $sum: 1 },
            platform: { $first: '$platform' },
            status: { $first: '$status' },
          },
        },
        { $sort: { lastSentAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      Message.aggregate([
        { $match: { userId, direction: 'outbound', type: 'dm' } },
        { $group: { _id: '$recipientId' } },
        { $count: 'total' },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        contacts,
        total: countResult[0]?.total ?? 0,
        page,
        pages: Math.ceil((countResult[0]?.total ?? 0) / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 30);
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const filter = { userId };
    if (req.query.platform) filter.platform = req.query.platform;
    if (req.query.status) filter.status = req.query.status;

    const [messages, total] = await Promise.all([
      Message.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Message.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { messages, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getContacts, getMessages };
