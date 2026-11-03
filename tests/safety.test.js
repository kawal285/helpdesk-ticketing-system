const {
  detectHazard,
  hazardEscalationMessage,
  containsDangerousAdvice,
  safeFallbackForDangerousAdvice,
  redactSecrets,
} = require('../src/services/rag/safety');

describe('detectHazard', () => {
  it.each([
    'my computer is smoking and theres a burning smell',
    'I can smell something burning near the server rack',
    'there are sparks coming from the power strip',
    'the cable has exposed wiring, I can see the bare wire',
    'I touched the laptop charger and got an electric shock',
    'I spilled water on it and the power strip is still plugged in',
    'the monitor caught fire a minute ago',
  ])('flags an active physical hazard: "%s"', (text) => {
    expect(detectHazard(text)).toBe(true);
  });

  it.each([
    'my computer wont turn on',
    'the WiFi keeps disconnecting',
    'my screen is flickering a little',
    'I spilled some sparkling water near my desk but not on anything',
    'the printer light is blinking red',
    'my laptop battery drains really fast',
  ])('does not flag ordinary IT trouble: "%s"', (text) => {
    expect(detectHazard(text)).toBe(false);
  });

  it('returns false for non-string input rather than throwing', () => {
    expect(detectHazard(null)).toBe(false);
    expect(detectHazard(undefined)).toBe(false);
    expect(detectHazard(42)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(detectHazard('I SEE SPARKS COMING FROM THE OUTLET')).toBe(true);
  });
});

describe('hazardEscalationMessage', () => {
  it('tells the reader to unplug if safe, not to keep troubleshooting', () => {
    const message = hazardEscalationMessage();

    expect(message).toMatch(/unplug/i);
    expect(message).toMatch(/raise a ticket/i);
    expect(message).not.toMatch(/step \d|first,? try/i);
  });

  it('is a fixed string, not something that could vary between calls', () => {
    expect(hazardEscalationMessage()).toBe(hazardEscalationMessage());
  });
});

describe('containsDangerousAdvice', () => {
  it.each([
    'First, open the power supply and check the capacitors inside.',
    'You will need to remove the PSU from the case.',
    'Open up the computer case and to access the motherboard, remove the cover.',
    'Discharge the capacitor before touching anything else.',
    'Try opening the monitor casing to inspect the backlight.',
  ])('flags dangerous disassembly instructions: "%s"', (text) => {
    expect(containsDangerousAdvice(text)).toBe(true);
  });

  it.each([
    'The power supply might be faulty and may need replacing by a technician.',
    'Try restarting the computer and checking that all cables are firmly connected.',
    'Reseat the external USB cable and try a different port.',
    'If the issue continues, raise a ticket so a technician can take a look.',
  ])('does not flag safe, external troubleshooting advice: "%s"', (text) => {
    expect(containsDangerousAdvice(text)).toBe(false);
  });

  it('returns false for non-string input rather than throwing', () => {
    expect(containsDangerousAdvice(null)).toBe(false);
  });
});

describe('safeFallbackForDangerousAdvice', () => {
  it('redirects to a technician rather than repeating any repair steps', () => {
    const message = safeFallbackForDangerousAdvice();

    expect(message).toMatch(/raising a ticket|qualified technician/i);
    expect(message.toLowerCase()).not.toContain('open the power supply');
  });
});

describe('redactSecrets', () => {
  it('redacts a Google-style API key', () => {
    const text = 'Your key is AIzaSyD4GhK9mXyZ1234567890abcdefGHIJKL and should work now.';
    expect(redactSecrets(text)).toBe('Your key is [redacted] and should work now.');
  });

  it('redacts an OpenAI-style secret key', () => {
    const text = 'Use sk-abcdefghijklmnopqrstuvwxyz123456 as your key.';
    expect(redactSecrets(text)).toBe('Use [redacted] as your key.');
  });

  it('redacts a GitHub personal access token', () => {
    const text = 'token: ghp_abcdefghijklmnopqrstuvwxyz1234567890';
    expect(redactSecrets(text)).toContain('[redacted]');
  });

  it('redacts a Bearer authorization header', () => {
    const text = 'Send Bearer abcdefghijklmnopqrstuvwxyz123456 in the header.';
    expect(redactSecrets(text)).toBe('Send [redacted] in the header.');
  });

  it('redacts a labelled password or secret', () => {
    expect(redactSecrets('password: hunter2plus')).toBe('[redacted]');
    expect(redactSecrets('api_key=sdlkj2384lkjsf')).toBe('[redacted]');
  });

  it('leaves ordinary text with no credential-shaped content untouched', () => {
    const text = 'Restart the computer and check that the Ethernet cable is connected.';
    expect(redactSecrets(text)).toBe(text);
  });

  it('returns non-string input unchanged rather than throwing', () => {
    expect(redactSecrets(null)).toBeNull();
    expect(redactSecrets(undefined)).toBeUndefined();
  });
});
