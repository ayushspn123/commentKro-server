const User = require('../auth/auth.model');
const PreRegister = require('../preRegister/preRegister.model');
const SupportTicket = require('../supportTicket/supportTicket.model');
const Automation = require('../automation/automation.model');

// 1. Dashboard Overview Metrics
exports.getOverview = async (req, res) => {
  try {
    const [
      totalUsers,
      totalVip,
      vipList,
      totalAutomations,
      activeAutomations,
      totalTickets,
      openTickets,
      resolvedTickets
    ] = await Promise.all([
      User.countDocuments(),
      PreRegister.countDocuments({ status: 'CONFIRMED' }),
      PreRegister.find({ status: 'CONFIRMED' }).select('amount registeredAt createdAt'),
      Automation.countDocuments(),
      Automation.countDocuments({ isActive: true }),
      SupportTicket.countDocuments(),
      SupportTicket.countDocuments({ status: 'OPEN' }),
      SupportTicket.countDocuments({ status: 'RESOLVED' })
    ]);

    const totalRevenue = vipList.reduce((sum, item) => sum + (item.amount || 9), 0);
    const conversionRate = totalUsers > 0 ? ((totalVip / totalUsers) * 100).toFixed(1) : '0.0';

    // Group last 7 days registration trends
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentUsers, recentVip] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      PreRegister.countDocuments({ createdAt: { $gte: sevenDaysAgo }, status: 'CONFIRMED' })
    ]);

    return res.status(200).json({
      success: true,
      metrics: {
        totalUsers,
        totalVip,
        totalRevenue,
        conversionRate,
        totalAutomations,
        draftAutomations: totalAutomations - activeAutomations,
        totalTickets,
        openTickets,
        resolvedTickets,
        recentSignups7d: recentUsers,
        recentVip7d: recentVip
      }
    });
  } catch (error) {
    console.error('Admin getOverview error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load metrics.' });
  }
};

// 2. VIP Pre-Registered Users List
exports.getVipUsers = async (req, res) => {
  try {
    const { search = '', limit = 100, page = 1 } = req.query;
    const query = { status: 'CONFIRMED' };

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { whatsapp: regex },
        { registrationNumber: regex },
        { paymentId: regex }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [vipUsers, total] = await Promise.all([
      PreRegister.find(query)
        .sort({ registeredAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      PreRegister.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      total,
      vipUsers
    });
  } catch (error) {
    console.error('Admin getVipUsers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load VIP users.' });
  }
};

// 3. All Platform Users
exports.getAllUsers = async (req, res) => {
  try {
    const { search = '', limit = 100, page = 1 } = req.query;
    const query = {};

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { email: regex }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total, vipEmails] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-passwordHash -refreshToken'),
      User.countDocuments(query),
      PreRegister.find({ status: 'CONFIRMED' }).distinct('email')
    ]);

    const vipEmailSet = new Set(vipEmails.map(e => e.toLowerCase()));

    const enrichedUsers = users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      plan: u.plan,
      isVip: vipEmailSet.has(u.email.toLowerCase()),
      connectedPagesCount: u.connectedPages?.length || 0,
      connectedPages: u.connectedPages?.map(p => ({ platform: p.platform, name: p.pageName, username: p.username })) || [],
      createdAt: u.createdAt
    }));

    return res.status(200).json({
      success: true,
      total,
      users: enrichedUsers
    });
  } catch (error) {
    console.error('Admin getAllUsers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load users.' });
  }
};

// 4. Customer Support Tickets
exports.getSupportTickets = async (req, res) => {
  try {
    const { status, limit = 100, page = 1 } = req.query;
    const query = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      SupportTicket.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      total,
      tickets
    });
  } catch (error) {
    console.error('Admin getSupportTickets error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load support tickets.' });
  }
};

// 5. Update Ticket Status
exports.updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['OPEN', 'IN_REVIEW', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const updated = await SupportTicket.findOneAndUpdate(
      { $or: [{ ticketId: id }, { _id: id }] },
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    return res.status(200).json({
      success: true,
      ticket: updated
    });
  } catch (error) {
    console.error('Admin updateTicketStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update ticket.' });
  }
};

// 6. Automations List
exports.getAutomations = async (req, res) => {
  try {
    const { limit = 100, page = 1 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [automations, total] = await Promise.all([
      Automation.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Automation.countDocuments()
    ]);

    return res.status(200).json({
      success: true,
      total,
      automations
    });
  } catch (error) {
    console.error('Admin getAutomations error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load automations.' });
  }
};
