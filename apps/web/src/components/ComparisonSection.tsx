import styles from './ComparisonSection.module.css';

const ROWS = [
  {
    feature: 'Max file size',
    whatsapp: '16 MB (Business API)',
    emailFwd: '25 MB',
    localSend: 'Unlimited (local only)',
    lyga: '500 MB Free, 5 GB Pro',
  },
  {
    feature: 'Media quality',
    whatsapp: 'Compressed',
    emailFwd: 'Original',
    localSend: 'Original',
    lyga: 'Original (uncompressed)',
  },
  {
    feature: 'Works across networks',
    whatsapp: 'Yes',
    emailFwd: 'Yes',
    localSend: 'Same Wi-Fi only',
    lyga: 'Yes (even when laptop sleeps)',
  },
  {
    feature: 'Persistent feed',
    whatsapp: 'Buried in chat',
    emailFwd: 'Inbox clutter',
    localSend: 'None',
    lyga: 'Searchable encrypted feed',
  },
];

export function ComparisonSection() {
  return (
    <section id="compare" className={styles.section}>
      <div className={styles.inner}>
        <h2 className={styles.heading}>Built for the gap between your phone and computer</h2>
        <p className={styles.lead}>
          Stop emailing yourself attachments or shrinking 4K clips through chat apps.
        </p>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>What matters</th>
                <th>WhatsApp</th>
                <th>Email / fwd</th>
                <th>LocalSend</th>
                <th className={styles.lygaHeader}>Lyga</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.feature}>
                  <td className={styles.featureCell}>{row.feature}</td>
                  <td>{row.whatsapp}</td>
                  <td>{row.emailFwd}</td>
                  <td>{row.localSend}</td>
                  <td className={styles.lygaCol}>{row.lyga}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
