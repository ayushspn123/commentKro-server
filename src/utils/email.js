const { Resend } = require('resend');
const logger = require('./logger');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Comment Kro <noreply@docorio.app>';

const sendEmail = async ({ to, subject, html, replyTo }) => {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('RESEND_API_KEY not configured — skipping email send');
    return;
  }
  const payload = { from: FROM, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  const { data, error } = await resend.emails.send(payload);
  if (error) throw new Error(`Resend error: ${error.message}`);
  logger.info(`Email sent to ${to}: ${data.id}`);
};

module.exports = { sendEmail };
