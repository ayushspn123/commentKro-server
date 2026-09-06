const SupportTicket = require('./supportTicket.model');

function generateTicketId() {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return 'CK-TICKET-' + randomDigits;
}

// Create new ticket
exports.createTicket = async (req, res) => {
  try {
    const { name, email, whatsapp, category, subject, message, screenshot } = req.body || {};

    if (!email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email and issue description.',
      });
    }

    const userId = req.user?.id || req.user?._id || email;
    const ticketId = generateTicketId();

    const ticket = await SupportTicket.create({
      ticketId,
      userId: String(userId),
      name: name || req.user?.name || 'Valued Creator',
      email,
      whatsapp: whatsapp || '',
      category: category || 'General',
      subject: subject || 'Support Concern',
      message,
      screenshot: screenshot || null,
      status: 'OPEN',
    });

    return res.status(201).json({
      success: true,
      message: 'Support ticket submitted successfully. Our team will contact you soon.',
      ticket: {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit support ticket. Please try again or reach out on WhatsApp.',
    });
  }
};

// Get user tickets
exports.getUserTickets = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const email = req.user?.email;

    const query = [];
    if (userId) query.push({ userId: String(userId) });
    if (email) query.push({ email });

    const tickets = await SupportTicket.find(query.length ? { $or: query } : {})
      .sort({ createdAt: -1 })
      .select('-screenshot');

    return res.status(200).json({
      success: true,
      tickets,
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load tickets.',
    });
  }
};
