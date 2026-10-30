<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') exit('Forbidden');
header('Content-Type: text/plain; charset=utf-8');
set_time_limit(0);
ini_set('memory_limit', '512M');

$targets = [
    'debian-openssl-1.0.x' => __DIR__ . '/node_modules/.prisma/client/libquery_engine-debian-openssl-1.0.x.so.node',
    'rhel-openssl-3.0.x' => __DIR__ . '/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node',
];
$commit = 'c2990dca591cba766e3b7ef5d9e8a84796e47ab7';

foreach ($targets as $platform => $target) {
    if (is_file($target) && filesize($target) > 21700000) {
        echo "$platform already present (" . filesize($target) . ")\n";
        continue;
    }
    $url = "https://binaries.prisma.sh/all_commits/$commit/$platform/libquery_engine.so.node";
    echo "Downloading $platform...\n";
    $tmp = $target . '.tmp';
    $fp = fopen($tmp, 'w');
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_FILE => $fp,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 600,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $ok = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    fclose($fp);
    echo "HTTP $code ok=" . ($ok ? 'yes' : 'no') . " err=$err size=" . (is_file($tmp) ? filesize($tmp) : 0) . "\n";
    if ($ok && is_file($tmp) && filesize($tmp) > 21700000) {
        rename($tmp, $target);
        echo "Saved $target\n";
    } else {
        @unlink($tmp);
    }
}

$node = '/opt/alt/alt-nodejs20/root/usr/bin/node';
passthru('pkill -f "api.kiaakala.ir/dist/index.js" || true');
passthru('nohup ' . escapeshellarg($node) . ' dist/index.js >> app.log 2>&1 &');
sleep(3);
passthru('curl -sS http://127.0.0.1:3001/api/health 2>&1');
