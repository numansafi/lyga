'use client';

import { useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import {
  MULTIPART_THRESHOLD_BYTES,
  type FeedItemRecord,
  type WorkspaceRecord,
} from '@/lib/mvp/constants';
import {
  classifyFileKind,
  classifyTextKind,
  encryptFileChunked,
  encryptString,
  type DecryptedItemMeta,
} from '@/lib/mvp/crypto';
import { uploadFileMultipart } from '@/lib/mvp/multipart-client';
import type { DecryptedFeedItem } from '@/lib/mvp/feed-selectors';

export interface UploadStatusState {
  fileName: string;
  sizeBytes: number;
  stage: 'Preparing' | 'Encrypting' | 'Uploading' | 'Saving';
  pct: number;
}

interface UseWorkspaceComposerActionsArgs {
  workspace: WorkspaceRecord | null;
  cryptoKey: CryptoKey | null;
  hkdfKey: CryptoKey | null;
  deviceId: string | null;
  myDeviceName: string;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  sending: boolean;
  setSending: Dispatch<SetStateAction<boolean>>;
  setUploadStatus: Dispatch<SetStateAction<UploadStatusState | null>>;
  setAttachMenuOpen: Dispatch<SetStateAction<boolean>>;
  setErrorMsg: Dispatch<SetStateAction<string | null>>;
  setInfoMsg: Dispatch<SetStateAction<string | null>>;
  setItems: Dispatch<SetStateAction<DecryptedFeedItem[]>>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  decryptedCacheRef: MutableRefObject<Map<string, DecryptedFeedItem>>;
  loadWorkspace: () => Promise<void>;
}

export function useWorkspaceComposerActions({
  workspace,
  cryptoKey,
  hkdfKey,
  deviceId,
  myDeviceName,
  draft,
  setDraft,
  sending,
  setSending,
  setUploadStatus,
  setAttachMenuOpen,
  setErrorMsg,
  setInfoMsg,
  setItems,
  textareaRef,
  decryptedCacheRef,
  loadWorkspace,
}: UseWorkspaceComposerActionsArgs) {
  const uploadCancelledRef = useRef(false);
  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const handleSendFiles = async (fileList: FileList | null) => {
    if (!cryptoKey || !fileList || fileList.length === 0 || sending) return;
    setErrorMsg(null);

    let uploadedAny = false;
    setSending(true);
    try {
      for (const file of Array.from(fileList)) {
        setUploadStatus({
          fileName: file.name,
          sizeBytes: file.size,
          stage: 'Preparing',
          pct: 5,
        });

        const kind = classifyFileKind(file.type, file.name);
        const meta: DecryptedItemMeta = {
          title: file.name,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          senderDeviceId: deviceId ?? undefined,
          senderLabel: myDeviceName,
        };

        if (file.size > MULTIPART_THRESHOLD_BYTES && hkdfKey && workspace) {
          uploadCancelledRef.current = false;
          const abortController = new AbortController();
          uploadAbortRef.current = abortController;
          setUploadStatus({
            fileName: file.name,
            sizeBytes: file.size,
            stage: 'Uploading',
            pct: 1,
          });
          const mpResult = await uploadFileMultipart(
            workspace.id,
            file,
            cryptoKey,
            hkdfKey,
            meta,
            kind,
            {
              signal: abortController.signal,
              onProgress: (pct) => {
                setUploadStatus({
                  fileName: file.name,
                  sizeBytes: file.size,
                  stage: pct >= 96 ? 'Saving' : 'Uploading',
                  pct,
                });
              },
            }
          );
          uploadAbortRef.current = null;
          if (mpResult.ok) {
            uploadedAny = true;
            continue;
          }
          if (mpResult.cancelled || uploadCancelledRef.current) {
            setInfoMsg('Upload cancelled.');
          } else {
            setErrorMsg(mpResult.error);
          }
          break;
        }

        const [prepRes, encryptedMeta] = await Promise.all([
          fetch('/api/mvp/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sizeBytes: file.size }),
          }),
          encryptString(cryptoKey, JSON.stringify(meta)),
        ]);

        if (!prepRes.ok) {
          const err = (await prepRes.json().catch(() => null)) as {
            error?: string;
            code?: string;
          } | null;
          setErrorMsg(err?.error ?? 'Upload limit reached.');
          if (err?.code === 'FILE_TOO_LARGE' || err?.code === 'STORAGE_FULL') {
            setErrorMsg(
              workspace?.plan === 'pro'
                ? (err?.error ?? 'Vault storage limit reached.')
                : `${err?.error ?? 'Free limit reached.'} Upgrade to Pro (£3.75/mo yearly) for 5 GB files & 100 GB vault.`
            );
          }
          break;
        }

        const { blobKey, uploadUrl } = (await prepRes.json()) as {
          blobKey: string;
          uploadUrl: string;
        };

        const { blob, chunkCount } = await encryptFileChunked(cryptoKey, file, (pct) => {
          setUploadStatus({
            fileName: file.name,
            sizeBytes: file.size,
            stage: 'Encrypting',
            pct: Math.max(5, Math.round(pct * 0.5)),
          });
        });

        setUploadStatus({
          fileName: file.name,
          sizeBytes: file.size,
          stage: 'Uploading',
          pct: 50,
        });

        uploadCancelledRef.current = false;
        const putOk = await new Promise<boolean>((resolve) => {
          const xhr = new XMLHttpRequest();
          uploadXhrRef.current = xhr;
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', 'application/octet-stream');
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable && ev.total > 0) {
              const frac = ev.loaded / ev.total;
              setUploadStatus({
                fileName: file.name,
                sizeBytes: file.size,
                stage: 'Uploading',
                pct: Math.min(90, 50 + Math.round(frac * 40)),
              });
            }
          };
          xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
          xhr.onerror = () => resolve(false);
          xhr.onabort = () => resolve(false);
          xhr.send(blob);
        });
        uploadXhrRef.current = null;

        if (uploadCancelledRef.current) {
          setInfoMsg('Upload cancelled.');
          break;
        }
        if (!putOk) {
          setErrorMsg('Failed to upload encrypted file.');
          break;
        }
        setUploadStatus({
          fileName: file.name,
          sizeBytes: file.size,
          stage: 'Saving',
          pct: 92,
        });

        const saveRes = await fetch('/api/mvp/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind,
            encryptedMeta,
            encryptedBody: null,
            blobKey,
            sizeBytes: file.size,
            chunkCount,
          }),
        });

        if (!saveRes.ok) {
          const err = (await saveRes.json().catch(() => null)) as { error?: string } | null;
          setErrorMsg(err?.error ?? 'Unable to save file.');
          break;
        }

        uploadedAny = true;
        setUploadStatus({
          fileName: file.name,
          sizeBytes: file.size,
          stage: 'Saving',
          pct: 100,
        });
      }

      if (uploadedAny) {
        await loadWorkspace();
      }
    } finally {
      setSending(false);
      setUploadStatus(null);
    }
  };

  const handlePasteFromClipboard = async () => {
    setAttachMenuOpen(false);
    setErrorMsg(null);
    if (!navigator.clipboard) {
      setErrorMsg('Clipboard access is not available in this browser.');
      return;
    }

    try {
      if (typeof navigator.clipboard.read === 'function') {
        const clipItems = await navigator.clipboard.read();
        const files: File[] = [];
        for (const clipItem of clipItems) {
          const imageType = clipItem.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await clipItem.getType(imageType);
            const ext = imageType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
            files.push(new File([blob], `pasted-image.${ext}`, { type: imageType }));
          }
        }
        if (files.length > 0) {
          const dt = new DataTransfer();
          files.forEach((f) => dt.items.add(f));
          void handleSendFiles(dt.files);
          return;
        }
      }

      const text = await navigator.clipboard.readText();
      if (text) {
        setDraft((prev) => (prev ? `${prev}${prev.endsWith('\n') ? '' : '\n'}${text}` : text));
        textareaRef.current?.focus();
        return;
      }

      setInfoMsg('Nothing in clipboard to paste.');
    } catch {
      setErrorMsg('Clipboard permission denied. Tap the text box and paste directly.');
    }
  };

  const handleSendText = async () => {
    if (!cryptoKey || !draft.trim()) return;
    setErrorMsg(null);
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const kind = classifyTextKind(text);
      const meta: DecryptedItemMeta = {
        title: text.split('\n')[0].slice(0, 80),
        senderDeviceId: deviceId ?? undefined,
        senderLabel: myDeviceName,
      };
      const [encryptedMeta, encryptedBody] = await Promise.all([
        encryptString(cryptoKey, JSON.stringify(meta)),
        encryptString(cryptoKey, text),
      ]);

      const res = await fetch('/api/mvp/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          encryptedMeta,
          encryptedBody,
          sizeBytes: 0,
          chunkCount: 0,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setDraft(text);
        setErrorMsg(err?.error ?? 'Unable to send message.');
        return;
      }

      const payload = (await res.json()) as { item?: FeedItemRecord };
      if (payload.item) {
        const decrypted: DecryptedFeedItem = { raw: payload.item, meta, bodyText: text };
        decryptedCacheRef.current.set(payload.item.id, decrypted);
        setItems((curr) =>
          curr.some((it) => it.raw.id === decrypted.raw.id) ? curr : [decrypted, ...curr]
        );
      } else {
        await loadWorkspace();
      }
    } finally {
      setSending(false);
    }
  };

  const cancelUpload = () => {
    uploadCancelledRef.current = true;
    uploadXhrRef.current?.abort();
    uploadAbortRef.current?.abort();
  };

  return {
    handlePasteFromClipboard,
    handleSendText,
    handleSendFiles,
    cancelUpload,
  };
}
