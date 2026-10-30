<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') {
    http_response_code(403);
    exit('Forbidden');
}

$root = __DIR__;
$keep = ['.well-known', 'cleanup.php'];

foreach (scandir($root) as $item) {
    if ($item === '.' || $item === '..' || in_array($item, $keep, true)) {
        continue;
    }
    $path = $root . DIRECTORY_SEPARATOR . $item;
    if (is_dir($path)) {
        deleteDir($path);
    } else {
        unlink($path);
    }
}

echo 'OK';

function deleteDir(string $dir): void
{
    foreach (scandir($dir) as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path)) {
            deleteDir($path);
        } else {
            unlink($path);
        }
    }
    rmdir($dir);
}
