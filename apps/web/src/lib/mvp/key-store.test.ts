import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deleteWorkspaceKey, getWorkspaceKey, saveWorkspaceKey } from './key-store.ts';

describe('mvp key-store memory fallback', () => {
  it('saves, retrieves, and deletes keys when IndexedDB is unavailable', async () => {
    await saveWorkspaceKey('ws-key-test', 'wmk-secret-123');
    assert.equal(await getWorkspaceKey('ws-key-test'), 'wmk-secret-123');

    await deleteWorkspaceKey('ws-key-test');
    assert.equal(await getWorkspaceKey('ws-key-test'), null);
  });
});
