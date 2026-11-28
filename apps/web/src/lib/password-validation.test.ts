import assert from 'node:assert/strict';
import test from 'node:test';
import { validateStrongPassword } from './password-validation.ts';

test('validateStrongPassword accepts strong passwords with all required character classes', () => {
  assert.deepEqual(validateStrongPassword('Lyga#2026'), { valid: true });
  assert.deepEqual(validateStrongPassword('aB1!xy9Z'), { valid: true });
});

test('validateStrongPassword reports missing requirements clearly', () => {
  const tooShort = validateStrongPassword('Ab1!xyz');
  assert.equal(tooShort.valid, false);
  assert.match(tooShort.error ?? '', /at least 8 characters/);

  const noSymbol = validateStrongPassword('Abcdef1');
  assert.equal(noSymbol.valid, false);
  assert.match(noSymbol.error ?? '', /a symbol/);

  const noUpperOrDigit = validateStrongPassword('abcdef!');
  assert.equal(noUpperOrDigit.valid, false);
  assert.match(noUpperOrDigit.error ?? '', /an uppercase letter/);
  assert.match(noUpperOrDigit.error ?? '', /a number/);
});
