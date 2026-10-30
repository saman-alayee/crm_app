<?php
declare(strict_types=1);

function apiReadEnv(): array {
    $paths = [
        __DIR__ . '/../../api.kiaakala.ir/.env',
        '/home/kiaakala/api.kiaakala.ir/.env',
    ];
    $vars = [];
    foreach ($paths as $path) {
        if (!is_file($path)) continue;
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if ($line[0] === '#' || !str_contains($line, '=')) continue;
            [$k, $v] = explode('=', $line, 2);
            $vars[trim($k)] = trim($v, " \t\"'");
        }
        break;
    }
    return $vars;
}

function apiDb(): mysqli {
    static $conn = null;
    if ($conn instanceof mysqli) return $conn;
    $env = apiReadEnv();
    preg_match('/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/', $env['DATABASE_URL'] ?? '', $m);
    if (count($m) < 6) throw new RuntimeException('Invalid DATABASE_URL');
    $conn = new mysqli($m[3], urldecode($m[1]), urldecode($m[2]), $m[5], (int) $m[4]);
    if ($conn->connect_error) throw new RuntimeException('DB connect failed');
    $conn->set_charset('utf8mb4');
    return $conn;
}

function apiJson($data, int $code = 200, ?string $message = null): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => $code >= 200 && $code < 300, 'data' => $data, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function apiError(string $message, int $code = 400, ?string $errorCode = null): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    $payload = ['success' => false, 'message' => $message];
    if ($errorCode) $payload['code'] = $errorCode;
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function apiBody(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function apiCuid(): string {
    return 'c' . bin2hex(random_bytes(12));
}

function apiUuid(): string {
    return sprintf('%s-%s-%s-%s-%s', bin2hex(random_bytes(4)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(6)));
}

function apiNormalizeDigits(string $value): string {
    $persian = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹','٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    $latin =   ['0','1','2','3','4','5','6','7','8','9','0','1','2','3','4','5','6','7','8','9'];
    return str_replace($persian, $latin, $value);
}

function apiNormalizePhone(string $phone): string {
    $digits = preg_replace('/\D/', '', apiNormalizeDigits($phone));
    if (str_starts_with($digits, '98') && strlen($digits) === 12) $digits = '0' . substr($digits, 2);
    if (str_starts_with($digits, '9') && strlen($digits) === 10) $digits = '0' . $digits;
    if (!preg_match('/^09\d{9}$/', $digits)) apiError('شماره موبایل نامعتبر است', 400);
    return $digits;
}

function apiB64Url(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function apiJwtEncode(array $payload): string {
    $env = apiReadEnv();
    $secret = $env['JWT_SECRET'] ?? 'dev-secret';
    $header = apiB64Url(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $payload['iat'] = time();
    $payload['exp'] = time() + (7 * 24 * 3600);
    $body = apiB64Url(json_encode($payload, JSON_UNESCAPED_UNICODE));
    $sig = apiB64Url(hash_hmac('sha256', "$header.$body", $secret, true));
    return "$header.$body.$sig";
}

function apiJwtDecode(?string $token): ?array {
    if (!$token) return null;
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    $env = apiReadEnv();
    $secret = $env['JWT_SECRET'] ?? 'dev-secret';
    $expected = apiB64Url(hash_hmac('sha256', "{$parts[0]}.{$parts[1]}", $secret, true));
    if (!hash_equals($expected, $parts[2])) return null;
    $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
    if (!is_array($payload) || ($payload['exp'] ?? 0) < time()) return null;
    return $payload;
}

function apiAuthUser(): ?array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($header, 'Bearer ')) return null;
    return apiJwtDecode(trim(substr($header, 7)));
}

function apiRequireAuth(): array {
    $user = apiAuthUser();
    if (!$user) apiError('لطفاً وارد حساب کاربری شوید', 401, 'UNAUTHORIZED');
    return $user;
}

function apiRequireAdmin(): array {
    $user = apiRequireAuth();
    if (($user['role'] ?? '') !== 'ADMIN') apiError('دسترسی غیرمجاز', 403, 'FORBIDDEN');
    return $user;
}

function apiFormatProduct(array $row, ?array $images = null): array {
    $price = (int) $row['price'];
    $discountPrice = isset($row['discountPrice']) && $row['discountPrice'] !== null ? (int) $row['discountPrice'] : null;
    $effectivePrice = $discountPrice ?? $price;
    $discountPercent = ($discountPrice && $price > 0) ? (int) round((($price - $discountPrice) / $price) * 100) : 0;
    $imageList = $images ?? ($row['image'] ? [$row['image']] : []);
    $primary = $imageList[0] ?? null;
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'slug' => $row['slug'],
        'description' => $row['description'] ?? null,
        'price' => $price,
        'discountPrice' => $discountPrice,
        'effectivePrice' => $effectivePrice,
        'discountPercent' => $discountPercent,
        'stock' => (int) $row['stock'],
        'image' => $primary,
        'images' => $imageList,
        'unit' => $row['unit'] ?? null,
        'isActive' => (bool) $row['isActive'],
        'isFeatured' => (bool) $row['isFeatured'],
        'isNew' => (bool) $row['isNew'],
        'categoryId' => $row['categoryId'],
        'category' => isset($row['category_id']) ? [
            'id' => $row['category_id'],
            'name' => $row['category_name'],
            'slug' => $row['category_slug'],
        ] : null,
        'inStock' => (int) $row['stock'] > 0,
        'createdAt' => $row['createdAt'] ?? null,
        'updatedAt' => $row['updatedAt'] ?? null,
    ];
}

function apiFetchProductImages(mysqli $conn, string $productId): array {
    $stmt = $conn->prepare('SELECT url FROM product_images WHERE productId = ? ORDER BY sortOrder ASC');
    $stmt->bind_param('s', $productId);
    $stmt->execute();
    $res = $stmt->get_result();
    $urls = [];
    while ($row = $res->fetch_assoc()) $urls[] = $row['url'];
    return $urls;
}

function apiSendOtpSms(string $phone, string $code): void {
    $env = apiReadEnv();
    $apiKey = $env['FARAZSMS_API_KEY'] ?? '';
    $pattern = $env['FARAZSMS_PATTERN_CODE'] ?? '';
    $line = $env['FARAZSMS_LINE_NUMBER'] ?? '90008361';
    $attr = $env['FARAZSMS_OTP_ATTRIBUTE'] ?? 'code';
    if (!$apiKey || !$pattern) apiError('سرویس پیامک پیکربندی نشده است', 503, 'SMS_NOT_CONFIGURED');

    $payload = json_encode([
        'code' => $pattern,
        'attributes' => [$attr => $code],
        'recipient' => $phone,
        'line_number' => $line,
        'number_format' => $env['FARAZSMS_NUMBER_FORMAT'] ?? 'english',
        'schedule' => null,
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init('https://api.iranpayamak.com/ws/v1/sms/pattern');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/json', 'Api-Key: ' . $apiKey],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_TIMEOUT => 20,
    ]);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($status === 401) apiError('پیکربندی سرویس پیامک نامعتبر است', 503, 'SMS_UNAUTHORIZED');
    if ($status < 200 || $status >= 300) apiError('ارسال پیامک ناموفق بود', 502, 'SMS_SEND_FAILED');
}

function apiCors(): void {
    $env = apiReadEnv();
    $origin = $env['CORS_ORIGIN'] ?? 'https://kiaakala.ir';
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Session-Id');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') exit;
}
