const express = require('express');
const router = express.Router();
const { z } = require('zod');
const validate = require('../../middleware/validate.middleware');
const { sendEmail } = require('../../utils/email');
const { contactTemplate } = require('../../utils/emailTemplates');
const logger = require('../../utils/logger');
const env = require('../../config/env');

const contactSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    subject: z.string().min(1).max(200),
    message: z.string().min(1).max(5000),
  }),
});

router.post('/', validate(contactSchema), async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    const adminEmail = env.CONTACT_EMAIL || 'admin@commentkro.com';

    await sendEmail({
      to: adminEmail,
      replyTo: email,
      subject: `📬 [Contact] ${subject}`,
      html: contactTemplate({ name, email, subject, message }),
    });

    logger.info(`Contact form submitted by ${email} — subject: ${subject}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
