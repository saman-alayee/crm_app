<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') {
    http_response_code(403);
    exit('Forbidden');
}

chdir(dirname(__DIR__) . '/api.kiaakala.ir');
header('Content-Type: text/plain; charset=utf-8');

echo "Running prisma db push...\n";
passthru('/usr/local/bin/ea-php99 -v 2>&1');
passthru('which node 2>&1');
passthru('node -v 2>&1');
passthru('./node_modules/.bin/prisma db push 2>&1', $code1);
echo "\nSeed...\n";
passthru('./node_modules/.bin/tsx prisma/seed.ts 2>&1', $code2);
echo "\nDone push=$code1 seed=$code2\n";
