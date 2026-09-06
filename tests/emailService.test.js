const EMAIL_ENV_KEYS = [
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'EMAIL_SECURE',
  'EMAIL_FROM',
];

const ORIGINAL_ENV = {};
for (const key of EMAIL_ENV_KEYS) ORIGINAL_ENV[key] = process.env[key];

function clearEmailEnv() {
  for (const key of EMAIL_ENV_KEYS) delete process.env[key];
}

function setConfiguredEmailEnv() {
  process.env.EMAIL_HOST = 'smtp.example.com';
  process.env.EMAIL_PORT = '587';
  process.env.EMAIL_USER = 'helpdesk@example.com';
  process.env.EMAIL_PASSWORD = 'super-secret';
}

afterEach(() => {
  for (const key of EMAIL_ENV_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL_ENV[key];
  }
});

describe('emailService when SMTP is not configured', () => {
  beforeEach(() => {
    jest.resetModules();
    clearEmailEnv();
  });

  it('emailIsConfigured() is false when any credential is missing', () => {
    const { emailIsConfigured } = require('../src/services/emailService');
    expect(emailIsConfigured()).toBe(false);
  });

  it('sendEmail() skips with reason smtp-not-configured, without throwing', async () => {
    const { sendEmail } = require('../src/services/emailService');

    const result = await sendEmail({
      to: 'someone@example.com',
      subject: 'Test',
      text: 'body',
    });

    expect(result).toEqual({ skipped: true, reason: 'smtp-not-configured' });
  });

  it('verifyEmailConnection() reports configured: false without trying to connect', async () => {
    const { verifyEmailConnection } = require('../src/services/emailService');

    const result = await verifyEmailConnection();

    expect(result.configured).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.message).toMatch(/SMTP is not configured/);
  });
});

describe('emailService sendEmail() recipient guard', () => {
  beforeEach(() => {
    jest.resetModules();
    setConfiguredEmailEnv();
  });

  it('skips with reason missing-recipient when there is no "to", even when SMTP is configured', async () => {
    const { sendEmail } = require('../src/services/emailService');

    const result = await sendEmail({ subject: 'No recipient', text: 'body' });

    expect(result).toEqual({ skipped: true, reason: 'missing-recipient' });
  });
});

describe('emailService when SMTP is configured', () => {
  const sendMail = jest.fn();
  const verify = jest.fn();
  const createTransport = jest.fn(() => ({ sendMail, verify }));

  beforeEach(() => {
    jest.resetModules();
    setConfiguredEmailEnv();
    sendMail.mockReset();
    verify.mockReset();
    createTransport.mockClear();

    jest.doMock('nodemailer', () => ({ createTransport }));
  });

  afterEach(() => {
    jest.dontMock('nodemailer');
  });

  it('sends through nodemailer and returns the message id', async () => {
    sendMail.mockResolvedValue({ messageId: 'msg-1' });

    const { sendEmail } = require('../src/services/emailService');

    const result = await sendEmail({
      to: 'agent@example.com',
      subject: 'New comment',
      text: 'A customer replied.',
    });

    expect(result).toEqual({ skipped: false, messageId: 'msg-1' });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'agent@example.com',
        subject: 'New comment',
        text: 'A customer replied.',
      })
    );
  });

  it('defaults the from address when EMAIL_FROM is not set', async () => {
    sendMail.mockResolvedValue({ messageId: 'msg-2' });

    const { sendEmail } = require('../src/services/emailService');
    await sendEmail({ to: 'a@example.com', subject: 'S', text: 'T' });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'OP IT Helpdesk <helpdesk@example.com>' })
    );
  });

  it('uses EMAIL_FROM when it is set', async () => {
    process.env.EMAIL_FROM = 'AIC Helpdesk <noreply@aic.ac.nz>';
    sendMail.mockResolvedValue({ messageId: 'msg-3' });

    const { sendEmail } = require('../src/services/emailService');
    await sendEmail({ to: 'a@example.com', subject: 'S', text: 'T' });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'AIC Helpdesk <noreply@aic.ac.nz>' })
    );
  });

  it('reuses one transporter across multiple sends instead of reconnecting each time', async () => {
    sendMail.mockResolvedValue({ messageId: 'msg-4' });

    const { sendEmail } = require('../src/services/emailService');
    await sendEmail({ to: 'a@example.com', subject: 'S', text: 'T' });
    await sendEmail({ to: 'b@example.com', subject: 'S', text: 'T' });
    await sendEmail({ to: 'c@example.com', subject: 'S', text: 'T' });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(3);
  });

  it('verifyEmailConnection() verifies the transporter and reports success', async () => {
    verify.mockResolvedValue(true);

    const { verifyEmailConnection } = require('../src/services/emailService');
    const result = await verifyEmailConnection();

    expect(result).toEqual({
      configured: true,
      verified: true,
      message: 'SMTP connection verified.',
    });
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('propagates a verification failure instead of silently reporting success', async () => {
    verify.mockRejectedValue(new Error('ECONNREFUSED'));

    const { verifyEmailConnection } = require('../src/services/emailService');

    await expect(verifyEmailConnection()).rejects.toThrow('ECONNREFUSED');
  });
});
