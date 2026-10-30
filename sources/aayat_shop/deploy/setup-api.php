<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') {
    http_response_code(403);
    exit('Forbidden');
}
chdir(__DIR__);
header('Content-Type: text/plain; charset=utf-8');
$node = '/opt/alt/alt-nodejs20/root/usr/bin/node';
$bash = 'export PATH=/opt/alt/alt-nodejs20/root/usr/bin:$PATH && cd ' . escapeshellarg(__DIR__);

passthru($bash . ' && ' . escapeshellarg($node) . ' node_modules/prisma/build/index.js db push --accept-data-loss 2>&1', $push);
echo "\n--- seed ---\n";
passthru($bash . ' && ' . escapeshellarg($node) . ' node_modules/tsx/dist/cli.mjs prisma/seed.ts 2>&1', $seed);
echo "\n--- restart ---\n";
passthru('pkill -f "api.kiaakala.ir/dist/index.js" || true');
passthru('nohup ' . escapeshellarg($node) . ' dist/index.js >> app.log 2>&1 &');
sleep(3);
passthru('curl -sS http://127.0.0.1:3001/api/health 2>&1');
echo "\nDone push=$push seed=$seed\n";
