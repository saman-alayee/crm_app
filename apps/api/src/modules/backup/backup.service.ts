import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import os from 'node:os';
import type { Response } from 'express';
import { config } from '../../config/index.js';
import { AppError } from '../../utils/errors.js';

function resolveSqlitePath(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) {
    throw new AppError(500, 'بکاپ محلی فعلاً برای SQLite پیکربندی شده است');
  }
  const raw = databaseUrl.replace(/^file:/, '');
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

export class BackupService {
  async streamDatabaseBackup(res: Response) {
    const dbPath = resolveSqlitePath(config.databaseUrl || process.env.DATABASE_URL || '');
    try {
      await fs.access(dbPath);
    } catch {
      throw new AppError(404, 'فایل دیتابیس یافت نشد');
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `hr-sqlite-backup-${stamp}.db.gz`;
    const tmpPath = path.join(os.tmpdir(), `hr-backup-${Date.now()}.db.gz`);

    try {
      await pipeline(createReadStream(dbPath), createGzip(), createWriteStream(tmpPath));
      const stat = await fs.stat(tmpPath);
      if (!stat.size) throw new AppError(500, 'فایل بکاپ خالی است');

      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Backup-Filename', filename);

      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(tmpPath);
        stream.on('error', reject);
        res.on('error', reject);
        res.on('finish', resolve);
        stream.pipe(res);
      });

      return { filename, bytes: stat.size };
    } finally {
      await fs.unlink(tmpPath).catch(() => undefined);
    }
  }
}

export const backupService = new BackupService();
