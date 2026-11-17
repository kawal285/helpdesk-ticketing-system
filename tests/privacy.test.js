const { redactSensitiveData, redact } = require('../src/utils/privacy');

// Each row: input, what must disappear, the placeholder that replaces it.
const SENSITIVE_EXAMPLES = [
  ['My password is Summer2024!', 'Summer2024!', '[PASSWORD]'],
  ['password: hunter2', 'hunter2', '[PASSWORD]'],
  ['pwd=Tr0ub4dor&3 for the VPN', 'Tr0ub4dor&3', '[PASSWORD]'],
  ['my new password was "correct horse battery"', 'correct horse battery', '[PASSWORD]'],
  ['Set my PIN to 4821 please', '4821', '[PASSWORD]'],
  ['client_secret: 9f8e7d6c5b4a', '9f8e7d6c5b4a', '[PASSWORD]'],
  ['key AIzaSyA1234567890abcdefghijklmnopqrstu leaked', 'AIzaSyA1234567890abcdefghijklmnopqrstu', '[API_KEY]'],
  ['using sk-proj1234567890abcdefghijkl', 'sk-proj1234567890abcdefghijkl', '[API_KEY]'],
  ['GROQ key gsk_abcdefghijklmnopqrstuvwx12', 'gsk_abcdefghijklmnopqrstuvwx12', '[API_KEY]'],
  ['token ghp_abcdefghijklmnopqrstuvwxyz0123456789', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789', '[API_KEY]'],
  ['AWS AKIAIOSFODNN7EXAMPLE in the script', 'AKIAIOSFODNN7EXAMPLE', '[API_KEY]'],
  ['Authorization: Bearer abcdef1234567890ABCDEF', 'abcdef1234567890ABCDEF', '[TOKEN]'],
  [
    'cookie eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MTIzNDV9.c2lnbmF0dXJlMTIz',
    'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MTIzNDV9.c2lnbmF0dXJlMTIz',
    '[TOKEN]',
  ],
  [
    '-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----',
    'MIIEow',
    '[PRIVATE_KEY]',
  ],
  ['email me at jo.smith@example.co.nz', 'jo.smith@example.co.nz', '[EMAIL]'],
  ['call 021 123 4567', '021 123 4567', '[PHONE]'],
  ['office (09) 123 4567', '(09) 123 4567', '[PHONE]'],
  ['mobile +64 21 987 6543', '+64 21 987 6543', '[PHONE]'],
  ['freephone 0800 123 456', '0800 123 456', '[PHONE]'],
  ['card 4111 1111 1111 1111 charged twice', '4111 1111 1111 1111', '[CARD]'],
  ['card 5500-0000-0000-0004', '5500-0000-0000-0004', '[CARD]'],
];

// Text that looks a bit like the above but must be left untouched, or the
// AI loses information it needs to classify and answer the ticket.
const SAFE_EXAMPLES = [
  'My password is expired and Outlook will not open',
  'I forgot my password',
  'Reset password link does not arrive',
  'Error 0x80070005 when installing updates',
  'It broke on 05-11-2026 after the update',
  'Cannot reach 10.0.0.1 or 192.168.1.20 from the lab',
  'Order 1234567890123 has not arrived', // 13 digits, fails the card check
  'Ticket #4521 is still open after 3 days',
  'Printer on level 2 room B204 is jammed',
  'Windows 11 version 23H2 build 22631',
];

describe('redactSensitiveData', () => {
  it.each(SENSITIVE_EXAMPLES)('redacts %j', (input, secret, placeholder) => {
    const { text, redactions } = redactSensitiveData(input);

    expect(text).not.toContain(secret);
    expect(text).toContain(placeholder);
    expect(redactions[placeholder.slice(1, -1)]).toBeGreaterThan(0);
  });

  it.each(SAFE_EXAMPLES)('leaves %j unchanged', (input) => {
    expect(redactSensitiveData(input)).toEqual({ text: input, redactions: {} });
  });

  it('keeps the label so the model still knows what kind of detail it was', () => {
    expect(redact('password: hunter2')).toBe('password: [PASSWORD]');
    expect(redact('my password is Summer2024! and it fails')).toBe(
      'my password is [PASSWORD] and it fails'
    );
  });

  it('counts each type once per match, without double-counting placeholders', () => {
    const { text, redactions } = redactSensitiveData(
      'api_key=sk-abcdefghijklmnopqrstuvwx1234, mail a@b.com and c@d.org'
    );

    expect(text).toBe('api_key=[API_KEY], mail [EMAIL] and [EMAIL]');
    expect(redactions).toEqual({ API_KEY: 1, EMAIL: 2 });
  });

  it('handles a realistic ticket with several details at once', () => {
    const ticket =
      'Hi, I am Jo (jo.smith@example.co.nz, 021 123 4567). My VPN login fails ' +
      'with password: Winter#2026. Card 4111 1111 1111 1111 was billed for it.';

    const { text, redactions } = redactSensitiveData(ticket);

    expect(text).toBe(
      'Hi, I am Jo ([EMAIL], [PHONE]). My VPN login fails ' +
        'with password: [PASSWORD]. Card [CARD] was billed for it.'
    );
    expect(redactions).toEqual({ EMAIL: 1, PHONE: 1, PASSWORD: 1, CARD: 1 });
  });

  it('passes through non-strings and empty strings', () => {
    expect(redact(undefined)).toBeUndefined();
    expect(redact(null)).toBeNull();
    expect(redact('')).toBe('');
  });
});
