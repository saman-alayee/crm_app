<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') exit('Forbidden');
header('Content-Type: text/plain; charset=utf-8');

$env = file_get_contents(__DIR__ . '/.env');
preg_match('/DATABASE_URL="mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^"]+)"/', $env, $m);
if (!$m) { exit('Bad DATABASE_URL'); }

$user = urldecode($m[1]);
$pass = urldecode($m[2]);
$host = $m[3];
$port = (int) $m[4];
$db = $m[5];

$sql = file_get_contents(__DIR__ . '/init.sql');
$conn = new mysqli($host, $user, $pass, $db, $port);
if ($conn->connect_error) exit('Connect failed: ' . $conn->connect_error);

if ($conn->multi_query($sql)) {
    do {
        if ($result = $conn->store_result()) $result->free();
    } while ($conn->more_results() && $conn->next_result());
}
if ($conn->error) exit('SQL error: ' . $conn->error);
echo "SQL OK\n";

$node = '/opt/alt/alt-nodejs20/root/usr/bin/node';
passthru('pkill -f "api.kiaakala.ir/dist/index.js" || true');
passthru('nohup ' . escapeshellarg($node) . ' dist/index.js >> app.log 2>&1 &');
sleep(3);
passthru('curl -sS http://127.0.0.1:3001/api/health 2>&1');
