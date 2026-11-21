const EMAIL_SYNTAX_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const BLOCKED_TLDS = new Set([
  'test',
  'example',
  'invalid',
  'localhost',
  'local',
  'lan',
  'internal',
]);

const BLOCKED_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.org',
  'test.net',
  'testing.com',
  'fake.com',
  'asdf.com',
  'qwerty.com',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.org',
  '10minutemail.com',
  'temp-mail.org',
  'tempmail.com',
  'yopmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'fakeinbox.com',
]);

const BLOCKED_LOCAL_PARTS = new Set([
  'test',
  'testing',
  'tester',
  'fake',
  'dummy',
  'sample',
  'asdf',
  'qwerty',
  'noreply',
  'no-reply',
  'admin',
  'root',
  '123',
  '1234',
  '12345',
  '123456',
  'abc',
  'xyz',
]);

export interface EmailValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

/** Validate waitlist email syntax and reject test, placeholder, and disposable addresses. */
export function validateWaitlistEmail(raw: string): EmailValidationResult {
  const normalized = raw.trim().toLowerCase();

  if (!normalized || normalized.length > 254 || !EMAIL_SYNTAX_REGEX.test(normalized)) {
    return { valid: false, normalized, error: 'Please enter a valid email address.' };
  }

  const atIndex = normalized.lastIndexOf('@');
  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);

  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return { valid: false, normalized, error: 'Please enter a valid email address.' };
  }

  const labels = domain.split('.');
  const tld = labels[labels.length - 1] ?? '';
  const rootLabel = labels[0] ?? '';

  if (tld.length < 2 || !/^[a-z]+$/.test(tld) || rootLabel.length < 2) {
    return { valid: false, normalized, error: 'Please enter a valid email address.' };
  }

  const baseLocal = local.split('+')[0] ?? local;
  const isRepeatedChar = /^(.)\1{2,}$/.test(baseLocal);

  if (
    BLOCKED_TLDS.has(tld) ||
    BLOCKED_DOMAINS.has(domain) ||
    BLOCKED_LOCAL_PARTS.has(baseLocal) ||
    isRepeatedChar
  ) {
    return {
      valid: false,
      normalized,
      error: 'Please use a real email address (test or disposable emails are not accepted).',
    };
  }

  return { valid: true, normalized };
}
