import { spawn } from 'child_process';
import { createWriteStream, createReadStream, promises as fs } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import path from 'path';
import os from 'os';
import type { Response } from 'express';
import { config } from '../config';
import { AppError } from '../utils/errors';

export interface MysqlConnectionParts {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

export function parseMysqlUrl(databaseUrl: string): MysqlConnectionParts {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new AppError(500, 'آدرس دیتابیس نامعتبر است');
  }

  if (!parsed.protocol.startsWith('mysql')) {
    throw new AppError(500, 'بکاپ فقط برای دیتابیس MySQL پشتیبانی می‌شود');
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('?')[0] || '');
  if (!database) {
    throw new AppError(500, 'نام دیتابیس در تنظیمات پیدا نشد');
  }

  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port || '3306',
    user: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    database,
  };
}

function buildFilename(database: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeDb = database.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeDb}-backup-${stamp}.sql.gz`;
}

export class BackupService {
  async streamDatabaseBackup(res: Response) {
    const db = parseMysqlUrl(config.databaseUrl);
    const filename = buildFilename(db.database);
    const tmpPath = path.join(os.tmpdir(), `jetkala-${Date.now()}-${filename}`);

    const args = [
      `--host=${db.host}`,
      `--port=${db.port}`,
      `--user=${db.user}`,
      '--single-transaction',
      '--routines',
      '--triggers',
      '--events',
      '--hex-blob',
      '--default-character-set=utf8mb4',
      db.database,
    ];

    try {
      await this.runMysqldumpToGzip(args, db.password, tmpPath);

      const stat = await fs.stat(tmpPath);
      if (!stat.size) {
        throw new AppError(500, 'فایل بکاپ خالی است');
      }

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

      return { filename, database: db.database, bytes: stat.size };
    } finally {
      await fs.unlink(tmpPath).catch(() => undefined);
    }
  }

  private runMysqldumpToGzip(args: string[], password: string, outPath: string) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const ok = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const child = spawn('mysqldump', args, {
        env: {
          ...process.env,
          MYSQL_PWD: password,
        },
        windowsHide: true,
      });

      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });

      child.on('error', (error) => {
        const message =
          (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? 'ابزار mysqldump روی سرور نصب نیست. بسته mysql-client را نصب کنید.'
            : 'اجرای بکاپ دیتابیس ناموفق بود';
        fail(new AppError(500, message));
      });

      const gzip = createGzip({ level: 9 });
      const output = createWriteStream(outPath);

      let dumpCode: number | null = null;
      let pipeDone = false;

      const maybeFinish = () => {
        if (dumpCode === null || !pipeDone) return;
        if (dumpCode === 0) {
          ok();
          return;
        }
        const detail = stderr.trim().slice(0, 300);
        fail(
          new AppError(
            500,
            detail ? `بکاپ دیتابیس ناموفق بود: ${detail}` : 'بکاپ دیتابیس ناموفق بود'
          )
        );
      };

      pipeline(child.stdout, gzip, output)
        .then(() => {
          pipeDone = true;
          maybeFinish();
        })
        .catch((error) => {
          fail(error instanceof Error ? error : new Error(String(error)));
        });

      child.on('close', (code) => {
        dumpCode = code ?? 1;
        maybeFinish();
      });
    });
  }
}

export const backupService = new BackupService();
