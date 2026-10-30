<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') {
    http_response_code(403);
    exit('Forbidden');
}
header('Content-Type: text/plain; charset=utf-8');

$appDir = '/home/kiaakala/api.kiaakala.ir';
$script = $appDir . '/start-api.sh';

if (!is_file($script)) {
    exit("Missing $script — upload start-api.sh first\n");
}

chmod($script, 0755);
passthru('bash ' . escapeshellarg($script) . ' 2>&1');
