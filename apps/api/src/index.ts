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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

assertProductionSecurity();

const app = express();
const httpServer = createServer(app);

export const io = new SocketServer(httpServer, {
  cors: {
    origin: config.corsOrigins,
    credentials: true,
  },
});

if (config.isProd) {
  app.set('trust proxy', 1);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, cb) {
      const allowed =
        !origin ||
        config.corsOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        // LAN / phone testing for PWA (private IPv4)
        /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
          origin
        );
      if (allowed) return cb(null, true);
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

app.use(notFound);
app.use(errorHandler);

io.on('connection', (socket) => {
  socket.on('subscribe', (userId: string) => {
    if (typeof userId === 'string' && userId) {
      socket.join(`user:${userId}`);
    }
  });
});

httpServer.listen(config.port, config.host, () => {
  console.log(`HR API listening on http://${config.host}:${config.port}`);
});
