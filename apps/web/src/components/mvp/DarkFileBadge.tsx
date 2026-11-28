'use client';

import { FileArchive, FileText, Image as ImageIcon } from 'lucide-react';
import { IMAGE_EXTS } from '@/lib/mvp/feed-selectors';
import styles from '@/app/app/Workspace.module.css';

const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'tar', 'gz']);
const PDF_EXTS = new Set(['pdf']);

export function DarkFileBadge({ ext }: { ext: string }) {
  const norm = ext.toLowerCase();
  const tone = PDF_EXTS.has(norm)
    ? 'pdf'
    : ARCHIVE_EXTS.has(norm)
      ? 'zip'
      : IMAGE_EXTS.has(norm)
        ? 'media'
        : 'doc';

  const Icon = IMAGE_EXTS.has(norm)
    ? ImageIcon
    : ARCHIVE_EXTS.has(norm)
      ? FileArchive
      : FileText;

  return (
    <div className={styles.darkFileBadge} data-tone={tone}>
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
      <span className={styles.darkFileExt}>{(norm || 'file').slice(0, 4)}</span>
    </div>
  );
}
