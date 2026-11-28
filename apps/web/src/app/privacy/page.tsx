import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../LegalPage.module.css';

export const metadata: Metadata = {
  title: 'Privacy Policy — Lyga',
  description: 'How Lyga handles your account and end-to-end encrypted transfers.',
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.backLink}>
          ← Back to Lyga
        </Link>

        <p className={styles.draftBanner}>
          Draft for review — customize with your legal and company details before public launch.
        </p>

        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.updated}>Last updated: November 28, 2026</p>

        <section className={styles.section}>
          <h2 className={styles.heading}>1. End-to-end encrypted by default</h2>
          <p className={styles.copy}>
            Lyga encrypts your notes, links, file names, and uploaded files in your browser before
            they leave your device. Your workspace encryption keys stay on your paired devices, so we
            cannot read your files or contents.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>2. What information we store</h2>
          <p className={styles.copy}>
            To run your account and sync between your devices, we store your sign-in email address,
            paired device labels, encrypted item metadata, encrypted file blobs, and total storage
            used.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>3. Retention and deletion</h2>
          <p className={styles.copy}>
            On the Free plan, uploaded files are automatically deleted after 3 days. You can also
            delete individual items, clear your entire feed, or permanently delete your account and
            vault from your account menu at any time.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>4. Service providers</h2>
          <p className={styles.copy}>
            Lyga uses trusted infrastructure providers for authentication, database, encrypted object
            storage, hosting, and optional product analytics. Payment processing for Pro plans is
            handled by Stripe when enabled.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>5. Contact</h2>
          <p className={styles.copy}>
            Questions about privacy or data requests? Contact{' '}
            <a href="mailto:support@uselyga.com">support@uselyga.com</a>.
          </p>
        </section>

        <div className={styles.footerLinks}>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/">Home</Link>
        </div>
      </div>
    </main>
  );
}
