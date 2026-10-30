<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') exit('Forbidden');
header('Content-Type: text/plain; charset=utf-8');

$name = basename($_GET['file'] ?? '');
if ($name === '' || str_contains($name, '..')) exit('bad file');

$manifest = __DIR__ . '/node_modules/.prisma/client/' . $name . '.manifest.txt';
$target = __DIR__ . '/node_modules/.prisma/client/' . $name;
if (!is_file($manifest)) exit('manifest missing');

$out = fopen($target, 'wb');
foreach (file($manifest, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $part) {
    $path = __DIR__ . '/node_modules/.prisma/client/' . basename($part);
    if (!is_file($path)) exit("missing part $part");
    stream_copy_to_stream(fopen($path, 'rb'), $out);
}
fclose($out);
echo 'merged ' . filesize($target) . " bytes\n";

$node = '/opt/alt/alt-nodejs20/root/usr/bin/node';
passthru('pkill -f "api.kiaakala.ir/dist/index.js" || true');
passthru('nohup ' . escapeshellarg($node) . ' dist/index.js >> app.log 2>&1 &');
sleep(3);
passthru('curl -sS http://127.0.0.1:3001/api/health 2>&1');
