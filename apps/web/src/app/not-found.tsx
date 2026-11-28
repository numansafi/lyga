import Link from 'next/link';
import styles from './NotFound.module.css';

export default function NotFoundPage() {
  return (
    <main className={styles.page}>
      <div className={styles.thread}>
        <div className={styles.bubbleIn}>
          <div className={styles.metaIn}>You · 404</div>
          <p className={styles.textIn}>Wait, where did this page go?</p>
        </div>

        <div className={styles.bubbleOut}>
          <div className={styles.metaOut}>Lyga · Just now</div>
          <h1 className={styles.textOut}>
            Looks like that page isn&apos;t here. The link might be broken or moved.
          </h1>
          <Link href="/" className={styles.homeBtn}>
            Back to Home →
          </Link>
        </div>
      </div>
    </main>
  );
}
