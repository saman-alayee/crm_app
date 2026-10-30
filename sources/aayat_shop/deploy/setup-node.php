<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') {
    http_response_code(403);
    exit('Forbidden');
}
header('Content-Type: text/plain; charset=utf-8');

$appRoot = '/home/kiaakala/api.kiaakala.ir';
$user = 'kiaakala';

echo "=== CloudLinux Node.js setup ===\n\n";

$cmds = [
    'which cloudlinux-selector 2>&1',
    'cloudlinux-selector get --json --interpreter nodejs 2>&1',
    'cloudlinux-selector set --json --interpreter nodejs --user ' . escapeshellarg($user)
        . ' --app-root ' . escapeshellarg($appRoot)
        . ' --domain kiaakala.ir --app-uri api --version 20 --startup-file dist/index.js 2>&1',
    'cloudlinux-selector start --json --interpreter nodejs --user ' . escapeshellarg($user)
        . ' --app-root ' . escapeshellarg($appRoot) . ' 2>&1',
];

foreach ($cmds as $cmd) {
    echo ">>> $cmd\n";
    passthru($cmd);
    echo "\n\n";
}

echo "--- htaccess tail ---\n";
$ht = '/home/kiaakala/public_html/.htaccess';
if (is_file($ht)) {
    $lines = file($ht);
    echo implode('', array_slice($lines, -20));
}

echo "\n--- health ---\n";
passthru('curl -sS --max-time 10 https://kiaakala.ir/api/health 2>&1');
