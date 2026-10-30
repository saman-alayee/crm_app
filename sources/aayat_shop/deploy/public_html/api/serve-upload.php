<?php
declare(strict_types=1);

$file = basename(str_replace(['..', '\\'], '', $_GET['f'] ?? ''));
if ($file === '') {
    http_response_code(404);
    exit;
}

$path = '/home/kiaakala/api.kiaakala.ir/uploads/' . $file;
if (!is_file($path)) {
    http_response_code(404);
    exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
header('Content-Type: ' . finfo_file($finfo, $path));
header('Cache-Control: public, max-age=86400');
readfile($path);
