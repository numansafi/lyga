import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { publishWorkspaceEvent, subscribeWorkspaceEvents } from './events.ts';

describe('mvp events pub/sub', () => {
  it('delivers refresh events only to matching workspace subscribers and cleans up on unsubscribe', () => {
    const receivedA: string[] = [];
    const receivedB: string[] = [];

    const unsubA = subscribeWorkspaceEvents('ws-a', (evt) => receivedA.push(evt.workspaceId));
    const unsubB = subscribeWorkspaceEvents('ws-b', (evt) => receivedB.push(evt.workspaceId));

    publishWorkspaceEvent('ws-a');
    assert.deepEqual(receivedA, ['ws-a']);
    assert.deepEqual(receivedB, []);

    unsubA();
    publishWorkspaceEvent('ws-a');
    assert.deepEqual(receivedA, ['ws-a']);

    unsubB();
  });
});
