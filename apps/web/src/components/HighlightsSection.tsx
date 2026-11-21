import styles from './HighlightsSection.module.css';

export function HighlightsSection() {
  return (
    <section className={styles.section} aria-label="Key highlights">
      <div className={styles.inner}>
        <div className={styles.left}>
          <h2 className={styles.heading}>Send it once. Find it anywhere.</h2>
        </div>

        <div className={styles.cards}>
          <div className={`${styles.card} ${styles.cardPrimary}`}>
            <span className={styles.cardText}>From phone to PC in milliseconds</span>
            <span className={styles.tick} aria-hidden="true">
              ✓✓
            </span>
          </div>

          <div className={`${styles.card} ${styles.cardNeutral}`}>
            <span className={styles.cardText}>Feels like texting yourself</span>
            <span className={styles.tick} aria-hidden="true">
              ✓✓
            </span>
          </div>

          <div className={`${styles.card} ${styles.cardSolid}`}>
            <span>✓✓ No clunky cables</span>
            <span>✓✓ Ditch email &amp; chat apps</span>
            <span>✓✓ Zero quality loss</span>
          </div>
        </div>
      </div>
    </section>
  );
}
