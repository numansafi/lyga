import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapStoreError } from './api-context.ts';

describe('mvp api-context', () => {
  it('maps store error reasons to expected HTTP status codes and payloads', async () => {
    const tooBig = mapStoreError('file_too_large');
    assert.equal(tooBig.status, 413);
    assert.equal(((await tooBig.json()) as { code: string }).code, 'FILE_TOO_LARGE');

    const full = mapStoreError('storage_full');
    assert.equal(full.status, 413);
    assert.equal(((await full.json()) as { code: string }).code, 'STORAGE_FULL');

    const limit = mapStoreError('device_limit');
    assert.equal(limit.status, 403);
    assert.equal(((await limit.json()) as { code: string }).code, 'DEVICE_LIMIT');

    assert.equal(mapStoreError('last_device').status, 409);
    assert.equal(mapStoreError('not_found').status, 404);
    assert.equal(mapStoreError('invalid').status, 400);
    assert.equal(mapStoreError('unauthorized').status, 401);
  });
});
