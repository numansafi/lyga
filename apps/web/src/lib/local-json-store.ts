import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface JsonFileStore<T> {
  /** Run an exclusive read/modify/write operation serialized by an in-process mutex. */
  withLock<R>(fn: () => Promise<R>): Promise<R>;
  /** Read the JSON file, returning a fresh clone of defaultValue when missing or corrupt. */
  read(): Promise<T>;
  /** Atomically write data to disk via a temporary sibling file + rename. */
  write(data: T): Promise<void>;
}

/**
 * Resolve the dev data directory consistently from either workspace root or apps/web.
 */
export function resolveLocalDataDir(envDirVar?: string): string {
  const override = envDirVar ? process.env[envDirVar] : undefined;
  if (override) return override;
  const cwd = process.cwd();
  // When running inside apps/web, step up two levels to the monorepo root's .lyga-dev-data
  return path.basename(cwd) === 'web' && path.basename(path.dirname(cwd)) === 'apps'
    ? path.resolve(cwd, '..', '..', '.lyga-dev-data')
    : path.resolve(cwd, '.lyga-dev-data');
}

/**
 * Create a serialized, atomic JSON file store for local-dev persistence.
 */
export function createJsonFileStore<T>(opts: {
  filename: string;
  envDirVar?: string;
  defaultValue: () => T;
}): JsonFileStore<T> {
  let lock: Promise<void> = Promise.resolve();

  const getFilePath = (): string => path.join(resolveLocalDataDir(opts.envDirVar), opts.filename);

  const withLock = <R>(fn: () => Promise<R>): Promise<R> => {
    const next = lock.then(fn, fn);
    lock = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };

  const read = async (): Promise<T> => {
    try {
      const raw = await readFile(getFilePath(), 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return opts.defaultValue();
    }
  };

  const write = async (data: T): Promise<void> => {
    const file = getFilePath();
    await mkdir(path.dirname(file), { recursive: true });
    const tmpFile = `${file}.${randomUUID()}.tmp`;
    await writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    await rename(tmpFile, file);
  };

  return { withLock, read, write };
}
