<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') {
    http_response_code(403);
    exit('Forbidden');
}

$zip = basename($_GET['zip'] ?? '');
if ($zip !== 'api.zip') {
    http_response_code(400);
    exit('Invalid zip');
}

$zipPath = __DIR__ . '/' . $zip;
if (!file_exists($zipPath)) {
    http_response_code(404);
    exit('Zip not found: ' . filesize($zipPath));
}

header('Content-Type: text/plain; charset=utf-8');
echo "Zip size: " . filesize($zipPath) . "\n";

$archive = new ZipArchive();
$code = $archive->open($zipPath);
if ($code !== true) {
    http_response_code(500);
    exit('Cannot open zip, code=' . $code);
}

if (!$archive->extractTo(__DIR__)) {
    http_response_code(500);
    exit('Extract failed');
}
$archive->close();
echo "OK extracted to " . __DIR__;
