const nodemailer = require('nodemailer');

let transporter = null;

function emailIsConfigured() {
  return Boolean(
    process.env.EMAIL_HOST &&
      process.env.EMAIL_PORT &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASSWORD
  );
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure:
      String(process.env.EMAIL_SECURE).toLowerCase() ===
      'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  return transporter;
}

async function sendEmail({
  to,
  subject,
  text,
  html,
}) {
  if (!to) {
    console.warn(
      `Email skipped because no recipient was provided: ${subject}`
    );

    return {
      skipped: true,
      reason: 'missing-recipient',
    };
  }

  /*
   * During local development the project can run without
   * institutional SMTP credentials. Deployment staff can add the
   * approved credentials through environment variables.
   */
  if (!emailIsConfigured()) {
    console.info(
      `Email skipped because SMTP is not configured: ${subject} → ${to}`
    );

    return {
      skipped: true,
      reason: 'smtp-not-configured',
    };
  }

  const mailer = getTransporter();

  const information = await mailer.sendMail({
    from:
      process.env.EMAIL_FROM ||
      'OP IT Helpdesk <helpdesk@example.com>',
    to,
    subject,
    text,
    html,
  });

  console.info(
    `Email sent: ${information.messageId} → ${to}`
  );

  return {
    skipped: false,
    messageId: information.messageId,
  };
}

async function verifyEmailConnection() {
  if (!emailIsConfigured()) {
    return {
      configured: false,
      verified: false,
      message:
        'SMTP is not configured. Emails will be skipped during local development.',
    };
  }

  await getTransporter().verify();

  return {
    configured: true,
    verified: true,
    message: 'SMTP connection verified.',
  };
}

module.exports = {
  emailIsConfigured,
  sendEmail,
  verifyEmailConnection,
};