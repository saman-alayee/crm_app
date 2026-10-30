const BASE = 'http://127.0.0.1:4000/api/v1';

const ACCOUNTS = [
  { username: 'owner', password: 'QaOwner123!', expectRole: 'owner' },
  { username: 'admin_qa', password: 'QaTest123!', expectRole: 'admin' },
  { username: 'hr_qa', password: 'QaTest123!', expectRole: 'hr-manager' },
  { username: 'manager_qa', password: 'QaTest123!', expectRole: 'manager' },
  { username: 'accountant_qa', password: 'QaTest123!', expectRole: 'accountant' },
  { username: 'employee_qa', password: 'QaTest123!', expectRole: 'employee' },
];

const ROUTES = [
  { method: 'GET', path: '/dashboard/summary', perm: 'dashboard.view' },
  { method: 'GET', path: '/employees', perm: 'employees.view' },
  { method: 'GET', path: '/leave-requests', perm: 'leave.view' },
  { method: 'GET', path: '/salary-requests', perm: 'salary.view' },
  { method: 'GET', path: '/bank-accounts', perm: 'bank.view' },
  { method: 'GET', path: '/tasks', perm: 'tasks.view' },
  { method: 'GET', path: '/roles', perm: 'roles.view' },
  { method: 'GET', path: '/notifications', perm: 'notifications.view' },
  { method: 'GET', path: '/announcements', perm: 'announcements.view' },
  { method: 'GET', path: '/departments', perm: 'departments.view' },
  { method: 'GET', path: '/reports/employees', perm: 'reports.view' },
  { method: 'GET', path: '/audit-logs', perm: 'audit.view' },
  { method: 'GET', path: '/settings', perm: 'settings.view' },
];

const bugs = [];
const results = [];

function note(level, msg, extra = {}) {
  bugs.push({ level, msg, ...extra });
  console.log(`[${level}] ${msg}${extra.user ? ' @' + extra.user : ''}${extra.message ? ' | ' + extra.message : ''}`);
}

async function login(username, password) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`login ${username}: ${j.message || r.status}`);
  return j.data;
}

async function req(token, method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try {
    j = await r.json();
  } catch {
    j = { raw: true };
  }
  return { status: r.status, ok: r.ok, body: j };
}

function hasPerm(perms, key) {
  return perms.includes(key);
}

async function main() {
  let ownerToken = null;
  let sampleEmployeeId = null;

  for (const acc of ACCOUNTS) {
    let data;
    try {
      data = await login(acc.username, acc.password);
    } catch (e) {
      note('critical', e.message, { user: acc.username });
      continue;
    }
    if (acc.expectRole === 'owner') ownerToken = data.accessToken;

    const roles = (data.roles || []).map((r) => r.slug);
    const perms = data.permissions || [];
    if (!roles.includes(acc.expectRole)) {
      note('high', `expected role ${acc.expectRole}, got ${roles.join(',')}`, { user: acc.username });
    }
    if (!perms.length) note('critical', 'empty permissions', { user: acc.username });

    const row = { user: acc.username, role: roles, permCount: perms.length, routes: {} };

    for (const route of ROUTES) {
      const res = await req(data.accessToken, route.method, route.path);
      const allowed = hasPerm(perms, route.perm);
      let verdict = 'ok';
      if (status404(res) && allowed) {
        verdict = 'path_missing';
        note('high', `404 ${route.path}`, { user: acc.username });
      } else if (allowed && (res.status === 401 || res.status === 403)) {
        verdict = 'false_deny';
        note('high', `has ${route.perm} but ${res.status} ${route.path}`, {
          user: acc.username,
          message: res.body?.message,
        });
      } else if (!allowed && res.status >= 200 && res.status < 300) {
        verdict = 'false_allow';
        note('critical', `NO ${route.perm} but allowed ${route.path}`, { user: acc.username });
      } else if (allowed && res.status >= 500) {
        verdict = 'server_error';
        note('critical', `${res.status} ${route.path}`, {
          user: acc.username,
          message: res.body?.message,
        });
      } else if (allowed && res.status >= 400) {
        verdict = 'client_error';
        note('high', `${res.status} ${route.path}`, {
          user: acc.username,
          message: res.body?.message,
        });
      }
      row.routes[route.path] = { status: res.status, verdict, allowed };

      if (route.path === '/employees' && res.ok) {
        const list = res.body?.data?.items || res.body?.data || [];
        if (Array.isArray(list) && list[0]) sampleEmployeeId = list[0].id;
      }
    }

    if (acc.expectRole === 'owner') {
      await exerciseOwnerFlows(data.accessToken, data.user, sampleEmployeeId);
    }
    if (acc.expectRole === 'employee') {
      await exerciseEmployeeFlows(data.accessToken, data.user, perms, acc.username);
    }
    if (acc.expectRole === 'manager') {
      await exerciseManagerFlows(data.accessToken, perms, acc.username);
    }

    results.push(row);
  }

  // Cross-check: employee token cannot approve leave
  if (ownerToken) {
    const emp = await login('employee_qa', 'QaTest123!');
    const leaves = await req(ownerToken, 'GET', '/leave-requests');
    const items = leaves.body?.data?.items || leaves.body?.data || [];
    const pending = Array.isArray(items) ? items.find((x) => x.status === 'PENDING') : null;
    if (pending) {
      const deny = await req(emp.accessToken, 'POST', `/leave-requests/${pending.id}/approve`);
      if (deny.status >= 200 && deny.status < 300) {
        note('critical', 'employee approved leave without permission', { user: 'employee_qa' });
      }
    }
  }

  const { writeFileSync } = await import('fs');
  writeFileSync(
    new URL('./qa-report.json', import.meta.url),
    JSON.stringify({ at: new Date().toISOString(), bugs, results }, null, 2),
  );
  const crit = bugs.filter((b) => b.level === 'critical').length;
  const high = bugs.filter((b) => b.level === 'high').length;
  console.log(`\nDone. bugs=${bugs.length} critical=${crit} high=${high}`);
}

function status404(res) {
  return res.status === 404;
}

async function exerciseOwnerFlows(token, user, employeeId) {
  // Create leave for self
  const leave = await req(token, 'POST', '/leave-requests', {
    type: 'DAILY',
    leaveDate: new Date().toISOString().slice(0, 10),
    reason: 'QA leave owner',
  });
  if (leave.status >= 500) {
    note('critical', `leave create ${leave.status}`, { user: 'owner', message: leave.body?.message });
  } else if (leave.status >= 400) {
    note('high', `leave create ${leave.status}`, {
      user: 'owner',
      message: JSON.stringify(leave.body)?.slice(0, 250),
    });
  }

  const salary = await req(token, 'POST', '/salary-requests', {
    type: 'ADVANCE',
    amount: 1000000,
    description: 'QA advance',
  });
  if (salary.status >= 500) {
    note('critical', `salary create ${salary.status}`, { user: 'owner', message: salary.body?.message });
  } else if (salary.status >= 400) {
    note('high', `salary create ${salary.status}`, {
      user: 'owner',
      message: JSON.stringify(salary.body)?.slice(0, 250),
    });
  }

  const empId = employeeId || user?.employee?.id;
  const task = await req(token, 'POST', '/tasks', {
    title: 'وظیفه QA مالک',
    description: 'تست',
    priority: 'MEDIUM',
    assigneeId: empId,
    dueAt: new Date(Date.now() + 86400000).toISOString(),
  });
  if (task.status >= 500) {
    note('critical', `task create ${task.status}`, { user: 'owner', message: task.body?.message });
  } else if (task.status >= 400) {
    note('high', `task create ${task.status}`, {
      user: 'owner',
      message: JSON.stringify(task.body)?.slice(0, 250),
    });
  } else {
    console.log('[ok] task created', task.body?.data?.id || '');
  }

  const ann = await req(token, 'POST', '/announcements', {
    title: 'QA اطلاعیه',
    body: 'متن تست کامل QA',
  });
  if (ann.status >= 400) {
    note('high', `announcement create ${ann.status}`, {
      user: 'owner',
      message: JSON.stringify(ann.body)?.slice(0, 250),
    });
  }

  const dept = await req(token, 'POST', '/departments', {
    name: `QA-${Date.now()}`,
    description: 'qa dept',
  });
  if (dept.status >= 400) {
    note('high', `department create ${dept.status}`, {
      user: 'owner',
      message: JSON.stringify(dept.body)?.slice(0, 250),
    });
  }

  const bank = await req(token, 'POST', '/bank-accounts', {
    employeeId: empId,
    bankName: 'ملی',
    accountNumber: '1234567890',
    iban: 'IR120170000000123456789001',
    holderName: 'تست',
  });
  if (bank.status >= 500) {
    note('critical', `bank create ${bank.status}`, { user: 'owner', message: bank.body?.message });
  } else if (bank.status >= 400) {
    note('medium', `bank create ${bank.status}`, {
      user: 'owner',
      message: JSON.stringify(bank.body)?.slice(0, 250),
    });
  }

  // settings
  const settings = await req(token, 'GET', '/settings');
  if (settings.status >= 400) {
    note('high', `settings ${settings.status}`, { user: 'owner', message: settings.body?.message });
  }

  // backup HEAD/GET — may stream binary
  const bak = await fetch(`${BASE}/backup/database`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (bak.status >= 500) note('critical', `backup ${bak.status}`, { user: 'owner' });
  else if (bak.status === 403) note('high', 'owner denied backup', { user: 'owner' });
  else if (bak.status === 404) note('high', 'backup route missing', { user: 'owner' });
  else console.log('[ok] backup status', bak.status, bak.headers.get('content-type'));

  // auth/me
  const me = await req(token, 'GET', '/auth/me');
  if (me.status >= 400) note('high', `auth/me ${me.status}`, { user: 'owner' });
}

async function exerciseEmployeeFlows(token, user, perms, username) {
  const leave = await req(token, 'POST', '/leave-requests', {
    type: 'DAILY',
    leaveDate: new Date().toISOString().slice(0, 10),
    reason: 'QA emp leave',
  });
  if (hasPerm(perms, 'leave.create')) {
    if (leave.status >= 500) note('critical', `emp leave ${leave.status}`, { user: username, message: leave.body?.message });
    else if (leave.status >= 400)
      note('high', `emp leave ${leave.status}`, {
        user: username,
        message: JSON.stringify(leave.body)?.slice(0, 250),
      });
    else console.log('[ok] employee leave created');
  }

  const salary = await req(token, 'POST', '/salary-requests', {
    type: 'SALARY',
    amount: 500000,
    description: 'QA emp salary',
  });
  if (hasPerm(perms, 'salary.create')) {
    if (salary.status >= 400)
      note('high', `emp salary ${salary.status}`, {
        user: username,
        message: JSON.stringify(salary.body)?.slice(0, 250),
      });
  } else if (salary.status >= 200 && salary.status < 300) {
    note('critical', 'employee created salary without salary.create', { user: username });
  }

  // must not create employees
  const emp = await req(token, 'POST', '/employees', {
    username: 'hack_emp',
    password: 'Hack123!',
    firstName: 'هک',
    lastName: 'تست',
  });
  if (emp.status >= 200 && emp.status < 300) {
    note('critical', 'employee created another employee', { user: username });
  }

  // must not see roles
  const roles = await req(token, 'GET', '/roles');
  if (roles.status < 300 && !hasPerm(perms, 'roles.view')) {
    note('critical', 'employee listed roles', { user: username });
  }

  // must not edit settings
  const settings = await req(token, 'GET', '/settings');
  if (settings.status < 300 && !hasPerm(perms, 'settings.view')) {
    note('critical', 'employee viewed settings', { user: username });
  }
}

async function exerciseManagerFlows(token, perms, username) {
  // manager should not access roles/settings typically
  if (!hasPerm(perms, 'roles.view')) {
    const roles = await req(token, 'GET', '/roles');
    if (roles.status < 300) note('critical', 'manager listed roles without perm', { user: username });
  }
  if (!hasPerm(perms, 'settings.view')) {
    const settings = await req(token, 'GET', '/settings');
    if (settings.status < 300) note('critical', 'manager viewed settings without perm', { user: username });
  }
  if (!hasPerm(perms, 'backup.export')) {
    const bak = await fetch(`${BASE}/backup/database`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (bak.status < 300) note('critical', 'manager got backup without perm', { user: username });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
