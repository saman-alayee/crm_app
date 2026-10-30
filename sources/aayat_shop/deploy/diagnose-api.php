<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') {
    http_response_code(403);
    exit('Forbidden');
}
header('Content-Type: text/plain; charset=utf-8');

$appDir = '/home/kiaakala/api.kiaakala.ir';
$node = '/opt/alt/alt-nodejs20/root/usr/bin/node';

function readEnvFile(string $path): array {
    $vars = [];
    if (!is_file($path)) return $vars;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if ($line[0] === '#' || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $vars[trim($k)] = trim($v, " \t\"'");
    }
    return $vars;
}

echo "=== API DIAGNOSE ===\n";
echo "appDir exists: " . (is_dir($appDir) ? 'yes' : 'no') . "\n";
echo "dist/index.js: " . (is_file("$appDir/dist/index.js") ? filesize("$appDir/dist/index.js") : 'missing') . "\n";
echo "node: " . (is_file($node) ? 'yes' : 'no') . "\n";

$env = readEnvFile("$appDir/.env");
echo "PORT from .env: " . ($env['PORT'] ?? 'unset') . "\n";
echo "DATABASE_URL set: " . (isset($env['DATABASE_URL']) ? 'yes' : 'no') . "\n";

$engine = "$appDir/node_modules/.prisma/client/libquery_engine-debian-openssl-1.0.x.so.node";
echo "prisma engine: " . (is_file($engine) ? filesize($engine) : 'missing') . "\n";

echo "\n--- port check ---\n";
passthru('curl -sS --max-time 3 http://127.0.0.1:3002/api/health 2>&1');
echo "\n";
passthru('curl -sS --max-time 3 http://127.0.0.1:3001/api/health 2>&1');
echo "\n";

echo "\n--- processes ---\n";
passthru('pgrep -af "dist/index.js" 2>&1');

echo "\n--- app.log (last 40 lines) ---\n";
$log = "$appDir/app.log";
if (is_file($log)) {
    $lines = file($log);
    echo implode('', array_slice($lines, -40));
} else {
    echo "no log\n";
}

echo "\n--- node test (5s timeout) ---\n";
$test = 'cd ' . escapeshellarg($appDir) . ' && timeout 5 ' . escapeshellarg($node) . ' -e "require(\'./dist/index.js\')" 2>&1';
passthru($test);
