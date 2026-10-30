<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') exit('Forbidden');
header('Content-Type: text/plain; charset=utf-8');

$root = '/home/kiaakala/public_html';
$patterns = [
    '"https://kiaakala.ir/api "' => '"https://kiaakala.ir/api"',
    "'https://kiaakala.ir/api '" => "'https://kiaakala.ir/api'",
    'https://kiaakala.ir/api "' => 'https://kiaakala.ir/api"',
    'https://kiaakala.ir/api%20' => 'https://kiaakala.ir/api',
];
$count = 0;

$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root));
foreach ($it as $file) {
    if (!$file->isFile()) continue;
    $ext = $file->getExtension();
    if (!in_array($ext, ['html', 'js', 'json', 'css', 'webmanifest'], true)) continue;
    $path = $file->getPathname();
    if (str_contains($path, '/api/index.php')) continue;
    $content = file_get_contents($path);
    $fixed = str_replace(array_keys($patterns), array_values($patterns), $content);
    if ($fixed !== $content) {
        file_put_contents($path, $fixed);
        $count++;
        echo "fixed: $path\n";
    }
}
echo "Done. files=$count\n";
