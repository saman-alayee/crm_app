# API Outline — `/api/v1`

Base response: `{ success: true, data?, message? }` یا `{ success: false, message, code?, errors? }`

Auth header: `Authorization: Bearer <accessToken>`  
Bot internal: `X-Bot-Api-Key: <BOT_INTERNAL_API_KEY>` + `X-Telegram-User-Id`

## Auth
- `POST /auth/login` `{ username, password }` → access + refresh + user + permissions
- `POST /auth/refresh` `{ refreshToken }`
- `POST /auth/logout` `{ refreshToken }`
- `POST /auth/logout-all` (auth)
- `GET /auth/me` (auth) → profile + roles + permissions + employee

## Employees `employees.view|create|edit|delete`
- `GET /employees` query: search, isActive, page, limit
- `POST /employees`
- `GET /employees/:id`
- `PATCH /employees/:id`
- `POST /employees/:id/deactivate` — sets user.isActive=false, tokenVersion++, revoke refresh
- `POST /employees/:id/activate`
- `POST /employees/:id/link-telegram` `{ telegramUserId }`
- `GET /employees/:id/activity`

## Roles `roles.*`
- `GET /roles` · `POST /roles` · `PATCH /roles/:id` · `DELETE /roles/:id`
- `GET /permissions`
- `PUT /roles/:id/permissions` `{ permissionKeys: string[] }`
- `PUT /users/:userId/roles` `{ roleIds: string[] }`
- `PUT /users/:userId/permissions` `{ items: { key, effect }[] }`

## Leave
- `GET /leave-requests` filters
- `POST /leave-requests` (self or create for other if allowed)
- `POST /leave-requests/:id/approve`
- `POST /leave-requests/:id/reject` `{ reason }`

## Salary
- همان الگوی leave با `salary.*` و ماسک مبلغ بدون `salary.view_sensitive`

## Bank
- `GET /bank-accounts/me` · `PUT /bank-accounts/me`
- `GET /bank-accounts` (admin) — mask مگر `bank.view_sensitive`
- `GET /bank-accounts/:id/history`

## Tasks
- `GET /tasks` · `POST /tasks` · `PATCH /tasks/:id`
- `POST /tasks/:id/assign` `{ assigneeEmployeeId }`
- `POST /tasks/:id/complete`
- `POST /tasks/:id/delay-reminder` `{ minutes?: number }` default 60
- `POST /tasks/:id/schedule/pause|resume`

## Notifications
- `GET /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all`
- `GET /notifications/unread-count`

## Reports / Audit / Settings
- `GET /reports/dashboard`
- `GET /reports/employees`
- `GET /reports/export` format=csv|xlsx|pdf + `reports.export`
- `GET /audit-logs`
- `GET /settings` · `PATCH /settings`

## Telegram bridge
- `GET /telegram/me` (bot key + telegram user id)
- `POST /telegram/ensure-session` — resolves employee linkage
