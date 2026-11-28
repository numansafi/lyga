import assert from 'node:assert/strict';
import test from 'node:test';
import { scrubE2eeUrl, scrubSentryEvent } from './sentry-scrub.ts';

test('scrubE2eeUrl redacts #wmk, #key, #k and multi-param fragments while preserving path and query', () => {
  assert.equal(
    scrubE2eeUrl('https://lyga.app/pair?code=ABCD1234#wmk=secretBase64Key'),
    'https://lyga.app/pair?code=ABCD1234#wmk=[REDACTED_KEY]'
  );
  assert.equal(
    scrubE2eeUrl('https://lyga.app/drop#key=dropSecretKey'),
    'https://lyga.app/drop#key=[REDACTED_KEY]'
  );
  assert.equal(
    scrubE2eeUrl('https://lyga.app/app#tab=all&wmk=multiParamKey'),
    'https://lyga.app/app#tab=all&wmk=[REDACTED_KEY]'
  );
  assert.equal(
    scrubE2eeUrl('https://lyga.app/app#k=legacyKey'),
    'https://lyga.app/app#k=[REDACTED_KEY]'
  );
  assert.equal(
    scrubE2eeUrl('https://lyga.app/app?tab=media'),
    'https://lyga.app/app?tab=media'
  );
});

test('scrubSentryEvent redacts request URLs, headers, messages, exceptions, and breadcrumbs', () => {
  const event = scrubSentryEvent({
    message: 'Failed at https://lyga.app/pair#wmk=msgSecret',
    exception: {
      values: [{ value: 'Error on https://lyga.app/drop#key=exSecret' }],
    },
    request: {
      url: 'https://lyga.app/pair?code=XYZ#wmk=superSecret',
      headers: { cookie: 'sb=123', authorization: 'Bearer abc', host: 'lyga.app' },
    },
    breadcrumbs: [
      {
        message: 'Navigated to https://lyga.app/pair#wmk=superSecret',
        data: {
          from: 'https://lyga.app/app#wmk=superSecret',
          to: 'https://lyga.app/pair?code=XYZ#wmk=superSecret',
        },
      },
    ],
  });

  assert.equal(event.message, 'Failed at https://lyga.app/pair#wmk=[REDACTED_KEY]');
  assert.equal(
    event.exception?.values?.[0]?.value,
    'Error on https://lyga.app/drop#key=[REDACTED_KEY]'
  );
  assert.equal(event.request?.url, 'https://lyga.app/pair?code=XYZ#wmk=[REDACTED_KEY]');
  assert.equal(event.request?.headers?.cookie, undefined);
  assert.equal(event.request?.headers?.authorization, undefined);
  assert.equal(event.request?.headers?.host, 'lyga.app');
  assert.equal(
    event.breadcrumbs?.[0]?.message,
    'Navigated to https://lyga.app/pair#wmk=[REDACTED_KEY]'
  );
  assert.equal(event.breadcrumbs?.[0]?.data?.from, 'https://lyga.app/app#wmk=[REDACTED_KEY]');
  assert.equal(
    event.breadcrumbs?.[0]?.data?.to,
    'https://lyga.app/pair?code=XYZ#wmk=[REDACTED_KEY]'
  );
});
