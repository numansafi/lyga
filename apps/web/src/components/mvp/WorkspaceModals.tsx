'use client';

import { Modal } from '@mantine/core';
import styles from '@/app/app/Workspace.module.css';

const DARK_MODAL_CLASSNAMES = {
  content: styles.darkModalContent,
  header: styles.darkModalHeader,
  title: styles.darkModalTitle,
  close: styles.darkModalClose,
  body: styles.darkModalBody,
};

export function FeedbackModal({
  opened,
  category,
  text,
  sent,
  submitting,
  onClose,
  onCategoryChange,
  onTextChange,
  onSubmit,
}: {
  opened: boolean;
  category: 'bug' | 'idea' | 'other';
  text: string;
  sent: boolean;
  submitting: boolean;
  onClose: () => void;
  onCategoryChange: (cat: 'bug' | 'idea' | 'other') => void;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Send feedback"
      centered
      classNames={DARK_MODAL_CLASSNAMES}
    >
      {sent ? (
        <p className={styles.modalConfirmCopy} style={{ color: '#5eead4' }}>
          Thanks — your feedback has been sent!
        </p>
      ) : (
        <div className={styles.modalStack}>
          <div className={styles.feedbackPills} role="group" aria-label="Feedback category">
            {(
              [
                ['idea', 'Idea'],
                ['bug', 'Bug'],
                ['other', 'Other'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={category === key}
                className={`${styles.feedbackPill} ${
                  category === key ? styles.feedbackPillActive : ''
                }`}
                onClick={() => onCategoryChange(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            className={styles.modalTextarea}
            aria-label="Feedback message"
            rows={4}
            maxLength={2000}
            placeholder="Tell us what's working, what broke, or what you'd love next…"
            value={text}
            onChange={(e) => onTextChange(e.currentTarget.value)}
          />
          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={submitting || !text.trim()}
              onClick={onSubmit}
            >
              {submitting ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ClearFeedModal({
  opened,
  itemCount,
  clearing,
  onClose,
  onConfirm,
}: {
  opened: boolean;
  itemCount: number;
  clearing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Clear all storage?"
      centered
      classNames={DARK_MODAL_CLASSNAMES}
    >
      <div className={styles.modalStack}>
        <p className={styles.modalConfirmCopy}>
          This permanently deletes{' '}
          {itemCount === 1 ? 'the 1 item' : `all ${itemCount} items`} and any encrypted
          files from your storage. Your account and paired devices stay intact.
        </p>
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.dangerBtn}
            disabled={clearing}
            onClick={onConfirm}
          >
            {clearing ? 'Clearing…' : 'Clear all storage'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function DeleteAccountModal({
  opened,
  confirmText,
  deleting,
  onClose,
  onConfirmTextChange,
  onConfirm,
}: {
  opened: boolean;
  confirmText: string;
  deleting: boolean;
  onClose: () => void;
  onConfirmTextChange: (val: string) => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Delete account"
      centered
      classNames={DARK_MODAL_CLASSNAMES}
    >
      <div className={styles.modalStack}>
        <p className={styles.modalConfirmCopy}>
          This permanently deletes your account, all stored items and encrypted files in your
          storage, paired devices, and local encryption keys. This cannot be undone.
        </p>
        <input
          type="text"
          className={styles.modalInput}
          aria-label="Type DELETE to confirm account deletion"
          placeholder="Type DELETE to confirm"
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.currentTarget.value)}
        />
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.dangerBtn}
            disabled={deleting || confirmText.trim().toUpperCase() !== 'DELETE'}
            onClick={onConfirm}
          >
            {deleting ? 'Deleting…' : 'Permanently delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function EditItemModal({
  opened,
  draft,
  saving,
  onClose,
  onDraftChange,
  onSave,
}: {
  opened: boolean;
  draft: string;
  saving: boolean;
  onClose: () => void;
  onDraftChange: (val: string) => void;
  onSave: () => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Edit message"
      centered
      classNames={DARK_MODAL_CLASSNAMES}
    >
      <div className={styles.previewModalBody}>
        <textarea
          rows={5}
          className={styles.editTextarea}
          aria-label="Edit message text"
          value={draft}
          onChange={(e) => onDraftChange(e.currentTarget.value)}
        />
        <div className={styles.previewFooter}>
          <span className={styles.previewMetaText}>Re-encrypts for all paired devices</span>
          <button
            type="button"
            className={styles.saveBtnIn}
            disabled={saving || !draft.trim()}
            onClick={onSave}
          >
            <span>{saving ? 'Saving…' : 'Save changes'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
