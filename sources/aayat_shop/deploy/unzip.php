<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') {
    http_response_code(403);
    exit('Forbidden');
}

$zip = $_GET['zip'] ?? '';
$target = $_GET['target'] ?? '';
$allowed = [
    'frontend.zip' => __DIR__,
    'api.zip' => dirname(__DIR__) . '/api.kiaakala.ir',
];

if (!isset($allowed[$zip])) {
    http_response_code(400);
    exit('Invalid zip');
}

$zipPath = __DIR__ . '/' . $zip;
$dest = $allowed[$zip];

if (!file_exists($zipPath)) {
    http_response_code(404);
    exit('Zip not found');
}

$archive = new ZipArchive();
if ($archive->open($zipPath) !== true) {
    http_response_code(500);
    exit('Cannot open zip');
}

$archive->extractTo($dest);
$archive->close();

echo 'OK';
