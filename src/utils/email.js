const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('./logger');

let transporter = null;

const getTransporter = () => {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure: env.SMTP_SECURE === 'true',
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html }) => {
  const t = getTransporter();
  if (!t) {
    logger.warn('SMTP not configured — skipping email send');
    return;
  }
  const info = await t.sendMail({
    from: env.SMTP_FROM || `"Comment Please" <${env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
  logger.info(`Email sent to ${to}: ${info.messageId}`);
};

module.exports = { sendEmail };
