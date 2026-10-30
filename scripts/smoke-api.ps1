$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$envFile = Join-Path $root '.env'
$user = 'owner'
$pass = 'ChangeMeOwner123!'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*SEED_OWNER_USERNAME=(.+)$') { $user = $Matches[1].Trim().Trim('"') }
    if ($_ -match '^\s*SEED_OWNER_PASSWORD=(.+)$') { $pass = $Matches[1].Trim().Trim('"') }
  }
}

$out = New-Object System.Collections.Generic.List[string]
try {
  $loginBody = (@{ username = $user; password = $pass } | ConvertTo-Json -Compress)
  $login = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/auth/login' -Method POST -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($loginBody)) -TimeoutSec 15
  $token = $login.data.accessToken
  $out.Add("LOGIN_OK perms=$($login.data.permissions.Count) roles=$($login.data.roles.slug -join ',')")
  $headers = @{ Authorization = "Bearer $token" }

  $me = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/auth/me' -Headers $headers -TimeoutSec 10
  $out.Add("ME_OK user=$($me.data.user.username)")

  $sum = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/dashboard/summary' -Headers $headers -TimeoutSec 15
  $out.Add("DASH_OK emp=$($sum.data.employeesTotal) leave=$($sum.data.leavePending) tasks=$($sum.data.tasksOpen) hire=$($sum.data.hireAnniversaries.Count)")

  $emp = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/employees?limit=5' -Headers $headers -TimeoutSec 10
  $out.Add("EMP_OK count=$($emp.data.items.Count)")

  $leave = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/leave-requests?limit=5' -Headers $headers -TimeoutSec 10
  $out.Add("LEAVE_OK count=$($leave.data.items.Count)")

  $tasks = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/tasks?limit=5' -Headers $headers -TimeoutSec 10
  $out.Add("TASKS_OK count=$($tasks.data.items.Count)")

  $depts = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/departments' -Headers $headers -TimeoutSec 10
  $deptCount = if ($depts.data -is [array]) { $depts.data.Count } else { 0 }
  $out.Add("DEPT_OK count=$deptCount")

  $null = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/announcements' -Headers $headers -TimeoutSec 10
  $out.Add('ANN_OK')

  $lock = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/settings/panel-lock' -Headers $headers -TimeoutSec 10
  $out.Add("LOCK_OK locked=$($lock.data.locked)")

  $unread = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/notifications/unread-count' -Headers $headers -TimeoutSec 10
  $out.Add("UNREAD_OK n=$($unread.data.unreadCount)")

  $roles = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/roles' -Headers $headers -TimeoutSec 10
  $roleCount = if ($roles.data -is [array]) { $roles.data.Count } else { 0 }
  $out.Add("ROLES_OK count=$roleCount")

  $sw = [Diagnostics.Stopwatch]::StartNew()
  1..5 | ForEach-Object {
    Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/auth/me' -Headers $headers -TimeoutSec 10 | Out-Null
  }
  $sw.Stop()
  $out.Add("CACHE_ME_5x_ms=$($sw.ElapsedMilliseconds)")
}
catch {
  $out.Add("API_FLOW_FAIL $($_.Exception.Message)")
  if ($_.ErrorDetails.Message) { $out.Add("DETAIL $($_.ErrorDetails.Message)") }
}

$path = Join-Path $root 'smoke-result.txt'
$out | Set-Content -Encoding utf8 $path
$out -join "`n"
