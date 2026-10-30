import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { assertProductionSecurity, config } from './config/index.js';
import { errorHandler, notFound } from './utils/errors.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { employeesRouter } from './modules/employees/employees.routes.js';
import { leaveRouter } from './modules/leave/leave.routes.js';
import { salaryRouter } from './modules/salary/salary.routes.js';
import { tasksRouter } from './modules/tasks/tasks.routes.js';
import { rolesRouter } from './modules/roles/roles.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { bankRouter } from './modules/bank/bank.routes.js';
import { backupRouter } from './modules/backup/backup.routes.js';
import { announcementsRouter } from './modules/announcements/announcements.routes.js';
import { departmentsRouter } from './modules/departments/departments.routes.js';
import { botRouter } from './modules/bot/bot.routes.js';
import { contactsRouter } from './modules/contacts/contacts.routes.js';
import { tradesRouter } from './modules/trades/trades.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { sourcesRouter } from './modules/sources/sources.routes.js';
import { optionsRouter } from './modules/options/options.routes.js';
import { sharesRouter, publicShareRouter } from './modules/shares/shares.routes.js';
import { opsbankRouter } from './modules/opsbank/opsbank.routes.js';
import { editsRouter } from './modules/edits/edits.routes.js';
import { startAuditRetentionJob } from './services/audit-retention.service.js';
import { attachRealtimeAuth, setRealtimeServer } from './services/realtime.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

assertProductionSecurity();

const app = express();
const httpServer = createServer(app);

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  if (config.corsOrigins.includes(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
    origin
  );
}

export const io = new SocketServer(httpServer, {
  path: '/socket.io',
  cors: {
    origin(origin, cb) {
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
});
setRealtimeServer(io);
attachRealtimeAuth(io);

if (config.isProd) {
  app.set('trust proxy', 1);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, cb) {
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));

const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));
app.get('/', (_req, res) => {
  res.redirect('/login.html');
});

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/employees', employeesRouter);
app.use('/api/v1/leave-requests', leaveRouter);
app.use('/api/v1/salary-requests', salaryRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/roles', rolesRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/audit-logs', auditRouter);
app.use('/api/v1/bank-accounts', bankRouter);
app.use('/api/v1/backup', backupRouter);
app.use('/api/v1/announcements', announcementsRouter);
app.use('/api/v1/departments', departmentsRouter);
app.use('/api/v1/bot', botRouter);
app.use('/api/v1/contacts', contactsRouter);
app.use('/api/v1/trades', tradesRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/sources', sourcesRouter);
app.use('/api/v1/options', optionsRouter);
app.use('/api/v1/shares', sharesRouter);
app.use('/api/v1/public/share', publicShareRouter);
app.use('/api/v1/ops-bank', opsbankRouter);
app.use('/api/v1/edit-history', editsRouter);

app.use(notFound);
app.use(errorHandler);

httpServer.listen(config.port, config.host, () => {
  console.log(`HR API listening on http://${config.host}:${config.port}`);
  startAuditRetentionJob();
});
