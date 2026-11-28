export const PASSWORD_REQUIREMENTS_HINT =
  'At least 8 characters with uppercase, lowercase, a number, and a symbol.';

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Enforces Supabase Auth strong password policy:
 * >= 8 chars, lowercase, uppercase, digit, and symbol.
 */
export function validateStrongPassword(password: string): PasswordValidationResult {
  const missing: string[] = [];
  if (password.length < 8) missing.push('at least 8 characters');
  if (!/[a-z]/.test(password)) missing.push('a lowercase letter');
  if (!/[A-Z]/.test(password)) missing.push('an uppercase letter');
  if (!/\d/.test(password)) missing.push('a number');
  if (!/[^A-Za-z0-9]/.test(password)) missing.push('a symbol');

  if (missing.length === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Password needs ${missing.join(', ')}.`,
  };
}
