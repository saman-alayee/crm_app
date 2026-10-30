<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') {
    http_response_code(403);
    exit('Forbidden');
}
header('Content-Type: text/plain; charset=utf-8');
echo "PHP " . PHP_VERSION . "\n";
echo "CWD " . getcwd() . "\n\n";

$paths = [
    '/usr/local/bin/node',
    '/opt/alt/alt-nodejs20/root/usr/bin/node',
    '/opt/alt/alt-nodejs18/root/usr/bin/node',
    '/home/kiaakala/nodevenv/api.kiaakala.ir/20/bin/node',
    '/home/kiaakala/nodevenv/api.kiaakala.ir/18/bin/node',
];
foreach ($paths as $p) {
    echo ($p . ': ' . (file_exists($p) ? 'exists' : 'missing') . "\n");
}

echo "\nwhich node:\n";
passthru('which node 2>&1');
echo "\nnode -v:\n";
passthru('node -v 2>&1');

echo "\nDisabled functions:\n";
echo ini_get('disable_functions') ?: '(none)';

echo "\n\nApache modules (if available):\n";
if (function_exists('apache_get_modules')) {
    $mods = apache_get_modules();
    foreach (['mod_proxy', 'mod_rewrite', 'mod_passenger'] as $m) {
        echo $m . ': ' . (in_array($m, $mods, true) ? 'yes' : 'no') . "\n";
    }
} else {
    echo "apache_get_modules unavailable\n";
}
