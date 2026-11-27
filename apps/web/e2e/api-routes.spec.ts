import { expect, test } from '@playwright/test';
import { FREE_MAX_FILE_BYTES } from '../src/lib/mvp/constants';

test.describe('MVP API Routes (/api/mvp/items, /api/mvp/devices, /api/mvp/feedback)', () => {
  test('enforces auth, validation, caps, and CRUD contracts end-to-end', async ({ request }) => {
    // 1. Unauthenticated guards
    expect((await request.post('/api/mvp/items', { data: {} })).status()).toBe(401);
    expect((await request.patch('/api/mvp/devices', { data: { label: 'X' } })).status()).toBe(401);
    expect((await request.delete('/api/mvp/devices?id=dev-1')).status()).toBe(401);
    expect((await request.post('/api/mvp/feedback', { data: { message: 'hi' } })).status()).toBe(
      401
    );

    // 2. Sign in & initialize workspace session cookie
    const authRes = await request.post('/api/auth/session', {
      data: { devEmail: `api-e2e-${Date.now()}@lyga.app` },
    });
    expect(authRes.status()).toBe(200);

    const wsRes = await request.get('/api/mvp/workspace');
    expect(wsRes.status()).toBe(200);
    const wsData = (await wsRes.json()) as {
      workspace: { pair_code: string };
      deviceId: string;
    };

    // 3. /api/mvp/items validation, caps, CRUD
    expect(
      (await request.post('/api/mvp/items', { data: { kind: 'invalid', encryptedMeta: 'm' } })).status()
    ).toBe(400);
    expect(
      (
        await request.post('/api/mvp/items', {
          data: { kind: 'file', encryptedMeta: 'm', blobKey: '../bad' },
        })
      ).status()
    ).toBe(400);

    const tooBigRes = await request.post('/api/mvp/items', {
      data: {
        kind: 'file',
        encryptedMeta: 'm',
        blobKey: 'ws_1234567890abcdef',
        sizeBytes: FREE_MAX_FILE_BYTES + 1,
        chunkCount: 1,
      },
    });
    expect(tooBigRes.status()).toBe(413);
    expect(((await tooBigRes.json()) as { code: string }).code).toBe('FILE_TOO_LARGE');

    const createRes = await request.post('/api/mvp/items', {
      data: { kind: 'text', encryptedMeta: 'meta-1', encryptedBody: 'body-1' },
    });
    expect(createRes.status()).toBe(200);
    const created = (await createRes.json()) as { ok: boolean; item: { id: string } };
    expect(created.ok).toBe(true);

    const patchRes = await request.patch('/api/mvp/items', {
      data: {
        id: created.item.id,
        kind: 'code',
        encryptedMeta: 'meta-2',
        encryptedBody: 'body-2',
      },
    });
    expect(patchRes.status()).toBe(200);
    expect(
      (
        await request.patch('/api/mvp/items', {
          data: { id: 'missing-id', kind: 'text', encryptedMeta: 'm' },
        })
      ).status()
    ).toBe(404);

    expect((await request.delete('/api/mvp/items?id=missing-id')).status()).toBe(404);
    expect((await request.delete(`/api/mvp/items?id=${created.item.id}`)).status()).toBe(200);

    // 4. /api/mvp/devices validation, last_device 409, and pair + remove
    expect((await request.patch('/api/mvp/devices', { data: { label: '   ' } })).status()).toBe(400);
    const renameRes = await request.patch('/api/mvp/devices', {
      data: { id: wsData.deviceId, label: 'Primary E2E' },
    });
    expect(renameRes.status()).toBe(200);
    expect(((await renameRes.json()) as { label: string }).label).toBe('Primary E2E');

    expect((await request.delete('/api/mvp/devices')).status()).toBe(400);
    expect((await request.delete(`/api/mvp/devices?id=${wsData.deviceId}`)).status()).toBe(409);

    // Pair a second device without overwriting our primary request context cookie?
    // /api/mvp/pair sets cookie on response, so use a separate fetch or re-auth after;
    // here we check 404 for unknown device ID first.
    expect((await request.delete('/api/mvp/devices?id=unknown-dev')).status()).toBe(404);

    // 5. /api/mvp/feedback validation & success
    expect((await request.post('/api/mvp/feedback', { data: { message: '   ' } })).status()).toBe(
      400
    );
    expect(
      (await request.post('/api/mvp/feedback', { data: { message: 'x'.repeat(2001) } })).status()
    ).toBe(400);
    const fbRes = await request.post('/api/mvp/feedback', {
      data: { category: 'bug', message: 'API route E2E feedback check' },
    });
    expect(fbRes.status()).toBe(200);
    expect(((await fbRes.json()) as { ok: boolean }).ok).toBe(true);
  });
});
