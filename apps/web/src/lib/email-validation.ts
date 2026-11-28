import Mailcheck from 'mailcheck';

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

const EXTRA_VALID_DOMAINS = [
  ...Mailcheck.defaultDomains,
  'hey.com',
  'proton.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'fastmail.com',
  'icloud.com',
];

const EXTRA_SECOND_LEVEL_DOMAINS = [
  ...Mailcheck.defaultSecondLevelDomains,
  'hey',
  'proton',
  'protonmail',
  'pm',
  'fastmail',
];

export interface EmailValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

/** Validate auth email syntax and catch common domain/TLD typos without blocking valid corporate/short addresses. */
export function validateAuthEmail(raw: string): EmailValidationResult {
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

  if (tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { valid: false, normalized, error: 'Please enter a valid email address.' };
  }

  if (BLOCKED_TLDS.has(tld)) {
    return { valid: false, normalized, error: 'Please enter a valid email address.' };
  }

  const isKnownTypoTld = ['con', 'cmo', 'ocm', 'cim', 'xom', 'vom', 'nte', 'ogr'].includes(tld);
  if (rootLabel.length >= 3 || isKnownTypoTld) {
    const suggestion = Mailcheck.run({
      email: normalized,
      domains: EXTRA_VALID_DOMAINS,
      secondLevelDomains: EXTRA_SECOND_LEVEL_DOMAINS,
    });
    if (suggestion && suggestion.full !== normalized) {
      return {
        valid: false,
        normalized,
        error: `Did you mean ${suggestion.full}?`,
      };
    }
  }

  return { valid: true, normalized };
}
