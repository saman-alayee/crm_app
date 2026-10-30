<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') exit('Forbidden');
header('Content-Type: text/plain; charset=utf-8');
$log = __DIR__ . '/app.log';
echo file_exists($log) ? file_get_contents($log) : 'no log';
