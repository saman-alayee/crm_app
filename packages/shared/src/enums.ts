export const LEAVE_TYPES = ['HOURLY', 'DAILY'] as const;
export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export const SALARY_REQUEST_TYPES = ['SALARY', 'ADVANCE'] as const;
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export const TASK_SCHEDULE_KINDS = ['ONCE', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type SalaryRequestType = (typeof SALARY_REQUEST_TYPES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskScheduleKind = (typeof TASK_SCHEDULE_KINDS)[number];
