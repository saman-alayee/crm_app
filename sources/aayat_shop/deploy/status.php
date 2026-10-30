<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') exit('Forbidden');
header('Content-Type: text/plain; charset=utf-8');
$target = __DIR__ . '/node_modules/.prisma/client/libquery_engine-debian-openssl-1.0.x.so.node';
echo 'engine size: ' . (is_file($target) ? filesize($target) : 0) . "\n";
echo file_exists(__DIR__ . '/engine-download.log') ? file_get_contents(__DIR__ . '/engine-download.log') : 'no log';
echo "\n--- app.log tail ---\n";
$log = __DIR__ . '/app.log';
if (is_file($log)) {
    $lines = file($log);
    echo implode('', array_slice($lines, -15));
}
