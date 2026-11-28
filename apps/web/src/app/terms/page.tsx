import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../LegalPage.module.css';

export const metadata: Metadata = {
  title: 'Terms of Service — Lyga',
  description: 'Terms for using Lyga to move files, photos, and notes across your devices.',
};

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.backLink}>
          ← Back to Lyga
        </Link>

        <p className={styles.draftBanner}>
          Draft for review — customize with your legal and company details before public launch.
        </p>

        <h1 className={styles.title}>Terms of Service</h1>
        <p className={styles.updated}>Last updated: November 28, 2026</p>

        <section className={styles.section}>
          <h2 className={styles.heading}>1. Using Lyga</h2>
          <p className={styles.copy}>
            Lyga lets you transfer files, photos, notes, and links between your own devices. You are
            responsible for the content you upload and for keeping your recovery link and paired
            devices secure.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>2. Acceptable use</h2>
          <p className={styles.copy}>
            Do not use Lyga to store or distribute illegal content, malware, or material that
            violates others&apos; rights, or to abuse storage and bandwidth limits.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>3. Plans and storage limits</h2>
          <p className={styles.copy}>
            Free accounts include 250 MB per file, 1 GB active storage, 3-day file retention, and up
            to 2 paired devices. Paid Pro plans, when enabled, expand file size, storage, retention,
            and device limits and can be canceled anytime.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>4. Service availability and encryption keys</h2>
          <p className={styles.copy}>
            Because your items are encrypted client-side, we cannot recover encrypted data if you
            lose access to all paired devices and your backup recovery link.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>5. Contact</h2>
          <p className={styles.copy}>
            Questions about these terms? Reach us at{' '}
            <a href="mailto:support@uselyga.com">support@uselyga.com</a>.
          </p>
        </section>

        <div className={styles.footerLinks}>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/">Home</Link>
        </div>
      </div>
    </main>
  );
}
