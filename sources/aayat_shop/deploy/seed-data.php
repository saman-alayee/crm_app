<?php
if (($_GET['key'] ?? '') !== 'kiaakala-deploy-2026') {
    http_response_code(403);
    exit('Forbidden');
}
error_reporting(E_ALL);
ini_set('display_errors', '1');
header('Content-Type: text/plain; charset=utf-8');

function readEnv(string $path): array {
    $vars = [];
    if (!is_file($path)) return $vars;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if ($line[0] === '#' || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $vars[trim($k)] = trim($v, " \t\"'");
    }
    return $vars;
}

function cuid(): string {
    return 'c' . bin2hex(random_bytes(12));
}

function upsertUser(mysqli $conn, string $phone, string $first, string $last, string $role): string {
    $stmt = $conn->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
    $stmt->bind_param('s', $phone);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        $id = cuid();
        $stmt2 = $conn->prepare('INSERT INTO users (id, phone, firstName, lastName, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, NOW(3), NOW(3))');
        $stmt2->bind_param('sssss', $id, $phone, $first, $last, $role);
        $stmt2->execute();
        return $id;
    }
    $row = $res->fetch_assoc();
    $stmt2 = $conn->prepare('UPDATE users SET firstName=?, lastName=?, role=?, isActive=1, updatedAt=NOW(3) WHERE id=?');
    $stmt2->bind_param('ssss', $first, $last, $role, $row['id']);
    $stmt2->execute();
    return $row['id'];
}

function productBySlug(mysqli $conn, string $slug): ?array {
    $stmt = $conn->prepare('SELECT id, name, price, discountPrice FROM products WHERE slug = ? LIMIT 1');
    $stmt->bind_param('s', $slug);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) return null;
    return $res->fetch_assoc();
}

$envPaths = [
    __DIR__ . '/.env',
    __DIR__ . '/../api.kiaakala.ir/.env',
    dirname(__DIR__) . '/api.kiaakala.ir/.env',
    '/home/kiaakala/api.kiaakala.ir/.env',
];
$env = [];
foreach ($envPaths as $path) {
    if (is_file($path)) {
        $env = readEnv($path);
        break;
    }
}
preg_match('/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/', $env['DATABASE_URL'] ?? '', $m);
if (count($m) < 6) exit('Invalid DATABASE_URL');
[$all, $user, $pass, $host, $port, $db] = $m;
$user = urldecode($user);
$pass = urldecode($pass);

$conn = new mysqli($host, $user, $pass, $db, (int) $port);
if ($conn->connect_error) exit('DB connect failed: ' . $conn->connect_error);
$conn->set_charset('utf8mb4');

$adminPhone = $env['ADMIN_PHONE'] ?? '09120000000';
$adminPassword = $env['ADMIN_PASSWORD'] ?? 'admin1234';

$categories = [
    ['labaniat', 'لبنیات', 1, '/images/categories/dairy.jpg'],
    ['noshedani', 'نوشیدنی', 2, '/images/categories/drinks.jpg'],
    ['tangholat', 'تنقلات', 3, '/images/categories/snacks.jpg'],
    ['mavad-ghazaei', 'مواد غذایی', 4, '/images/categories/food.jpg'],
    ['mive-sabzi', 'میوه و سبزیجات', 5, '/images/categories/fruits.jpg'],
    ['shoyandeha', 'شوینده‌ها', 6, '/images/categories/cleaning.jpg'],
    ['mahsulat-khane', 'محصولات خانه', 7, '/images/categories/home.jpg'],
];

$products = [
    ['shir-pasteurized-1l', 'شیر پاستوریزه یک لیتری', 'labaniat', 45000, 39000, 80, '۱ عدد', 'شیر پاستوریزه تازه.', 1, 0],
    ['mast-khamei-900g', 'ماست خامه‌ای ۹۰۰ گرمی', 'labaniat', 62000, null, 45, '۱ عدد', 'ماست پرچرب.', 0, 1],
    ['panir-liquan-400g', 'پنیر لیقوان ۴۰۰ گرمی', 'labaniat', 98000, 89000, 30, '۱ عدد', 'پنیر صبحانه.', 1, 0],
    ['ab-madani-1-5l', 'آب معدنی ۱.۵ لیتری', 'noshedani', 12000, null, 200, '۱ عدد', 'آب معدنی.', 1, 0],
    ['nooshabe-pepsi-1-5l', 'نوشابه پپسی ۱.۵ لیتری', 'noshedani', 28000, 25000, 60, '۱ عدد', 'نوشابه.', 0, 0],
    ['abmive-sanich-1l', 'آبمیوه سن‌ایچ یک لیتری', 'noshedani', 55000, null, 40, '۱ عدد', 'آبمیوه.', 0, 1],
    ['chips-mazmaz-100g', 'چیپس مزمز ۱۰۰ گرمی', 'tangholat', 35000, 29000, 100, '۱ عدد', 'چیپس.', 1, 0],
    ['pofak-60g', 'پفک ۶۰ گرمی', 'tangholat', 18000, null, 120, '۱ عدد', 'پفک.', 0, 0],
    ['shokolat-farmand', 'شکلات تخته‌ای فارمند', 'tangholat', 85000, 72000, 25, '۱ عدد', 'شکلات.', 0, 1],
    ['berenj-tarem-5kg', 'برنج طارم هاشمی ۵ کیلویی', 'mavad-ghazaei', 420000, 395000, 20, '۱ عدد', 'برنج.', 1, 0],
    ['roghan-1-5l', 'روغن آفتابگردان ۱.۵ لیتری', 'mavad-ghazaei', 185000, null, 35, '۱ عدد', 'روغن.', 0, 0],
    ['rob-goje-800g', 'رب گوجه ۸۰۰ گرمی', 'mavad-ghazaei', 48000, 42000, 50, '۱ عدد', 'رب.', 0, 0],
    ['sib-1kg', 'سیب درختی یک کیلویی', 'mive-sabzi', 65000, null, 40, '۱ کیلو', 'سیب.', 1, 0],
    ['goje-1kg', 'گوجه فرنگی یک کیلویی', 'mive-sabzi', 38000, 32000, 55, '۱ کیلو', 'گوجه.', 0, 1],
    ['sibzamini-2kg', 'سیب‌زمینی ۲ کیلویی', 'mive-sabzi', 52000, null, 70, '۲ کیلو', 'سیب‌زمینی.', 0, 0],
    ['maye-zarfshuyi-1l', 'مایع ظرفشویی ۱ لیتری', 'shoyandeha', 72000, 65000, 45, '۱ عدد', 'مایع ظرفشویی.', 1, 0],
    ['powder-labashui-2kg', 'پودر لباسشویی ۲ کیلویی', 'shoyandeha', 145000, null, 30, '۱ عدد', 'پودر.', 0, 0],
    ['dastmal-kaghazi', 'دستمال کاغذی ۲۰۰ برگی', 'shoyandeha', 38000, null, 60, '۱ عدد', 'دستمال.', 0, 1],
    ['lamp-led-9w', 'لامپ LED ۹ وات', 'mahsulat-khane', 95000, 82000, 40, '۱ عدد', 'لامپ.', 1, 0],
    ['battery-aa-4pack', 'باطری قلمی AA بسته ۴ عددی', 'mahsulat-khane', 68000, null, 50, '۱ بسته', 'باطری.', 0, 0],
    ['naylon-zobale', 'نایلون زباله ۳ رول', 'mahsulat-khane', 42000, null, 80, '۱ بسته', 'نایلون.', 0, 1],
];

$contentPages = [
    ['terms', 'قوانین و مقررات', "# قوانین و مقررات کیاکالا\n\n## ثبت سفارش\n- ثبت سفارش به منزله پذیرش قیمت‌ها است.\n\n## تماس\n- پشتیبانی: 09120000000"],
    ['about', 'درباره کیاکالا', "# درباره کیاکالا\n\nفروشگاه آنلاین کیاکالا برای تأمین نیازهای روزانه خانواده‌ها."],
    ['privacy', 'حریم خصوصی', "# حریم خصوصی\n\nاطلاعات شما فقط برای پردازش سفارش استفاده می‌شود."],
    ['shipping', 'شرایط ارسال', "# شرایط ارسال\n\nسفارش‌ها در ساعات کاری ارسال می‌شوند. پرداخت در محل."],
    ['faq', 'سوالات متداول', "# سوالات متداول\n\n## چطور سفارش بدهم؟\nمحصول را به سبد اضافه کنید."],
];

$coupons = [
    ['WELCOME10', 'تخفیف خوش‌آمدگویی', 'PERCENT', 10, 100000, 50000, 100, 1],
    ['SAVE50K', '۵۰ هزار تومان تخفیف', 'FIXED', 50000, 250000, null, 50, 2],
    ['NOWRUZ15', 'تخفیف ۱۵ درصدی', 'PERCENT', 15, 150000, 80000, 200, 1],
];

$customers = [
    ['09121111111', 'علی', 'رضایی'],
    ['09122222222', 'مریم', 'احمدی'],
    ['09123333333', 'رضا', 'کریمی'],
];

echo "=== KIAAKALA FULL SEED ===\n";

upsertUser($conn, $adminPhone, 'مدیر', 'KIAA KALA', 'ADMIN');
echo "Admin: $adminPhone (password env: $adminPassword)\n";

$userIds = [];
foreach ($customers as [$phone, $first, $last]) {
    $userIds[$phone] = upsertUser($conn, $phone, $first, $last, 'CUSTOMER');
    echo "Customer: $first $last ($phone)\n";
}

$categoryIds = [];
foreach ($categories as [$slug, $name, $sort, $image]) {
    $stmt = $conn->prepare('SELECT id FROM categories WHERE slug = ? LIMIT 1');
    $stmt->bind_param('s', $slug);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        $id = cuid();
        $stmt2 = $conn->prepare('INSERT INTO categories (id, name, slug, image, sortOrder, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, NOW(3), NOW(3))');
        $stmt2->bind_param('ssssi', $id, $name, $slug, $image, $sort);
        $stmt2->execute();
        $categoryIds[$slug] = $id;
    } else {
        $categoryIds[$slug] = $res->fetch_assoc()['id'];
    }
}
echo "Categories: " . count($categories) . "\n";

$conn->query("UPDATE products SET isActive = 0 WHERE slug LIKE 'fake-%'");

$categoryImages = [];
foreach ($categories as [$slug, $name, $sort, $image]) {
    $categoryImages[$slug] = $image;
}

$productIds = [];
foreach ($products as [$slug, $name, $catSlug, $price, $discount, $stock, $unit, $desc, $featured, $isNew]) {
    $catId = $categoryIds[$catSlug];
    $image = $categoryImages[$catSlug] ?? null;
    $stmt = $conn->prepare('SELECT id FROM products WHERE slug = ? LIMIT 1');
    $stmt->bind_param('s', $slug);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        $id = cuid();
        if ($discount === null) {
            $stmt2 = $conn->prepare('INSERT INTO products (id, name, slug, description, price, discountPrice, stock, image, unit, isActive, isFeatured, isNew, categoryId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, ?, ?, NOW(3), NOW(3))');
            $stmt2->bind_param('ssssiissiis', $id, $name, $slug, $desc, $price, $stock, $image, $unit, $featured, $isNew, $catId);
        } else {
            $stmt2 = $conn->prepare('INSERT INTO products (id, name, slug, description, price, discountPrice, stock, image, unit, isActive, isFeatured, isNew, categoryId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, NOW(3), NOW(3))');
            $stmt2->bind_param('ssssiiissiis', $id, $name, $slug, $desc, $price, $discount, $stock, $image, $unit, $featured, $isNew, $catId);
        }
        $stmt2->execute();
        $productIds[$slug] = $id;
        $imgId = cuid();
        $stmt3 = $conn->prepare('INSERT INTO product_images (id, productId, url, sortOrder, createdAt) VALUES (?, ?, ?, 0, NOW(3))');
        $stmt3->bind_param('sss', $imgId, $id, $image);
        $stmt3->execute();
    } else {
        $id = $res->fetch_assoc()['id'];
        if ($discount === null) {
            $stmt2 = $conn->prepare('UPDATE products SET name=?, description=?, price=?, discountPrice=NULL, stock=?, image=?, unit=?, isActive=1, isFeatured=?, isNew=?, categoryId=?, updatedAt=NOW(3) WHERE id=?');
            $stmt2->bind_param('ssiissiiss', $name, $desc, $price, $stock, $image, $unit, $featured, $isNew, $catId, $id);
        } else {
            $stmt2 = $conn->prepare('UPDATE products SET name=?, description=?, price=?, discountPrice=?, stock=?, image=?, unit=?, isActive=1, isFeatured=?, isNew=?, categoryId=?, updatedAt=NOW(3) WHERE id=?');
            $stmt2->bind_param('ssiiissiiss', $name, $desc, $price, $discount, $stock, $image, $unit, $featured, $isNew, $catId, $id);
        }
        $stmt2->execute();
        $productIds[$slug] = $id;
    }
}
echo "Products: " . count($products) . "\n";

foreach ($contentPages as [$slug, $title, $body]) {
    $stmt = $conn->prepare('SELECT id FROM content_pages WHERE slug = ? LIMIT 1');
    $stmt->bind_param('s', $slug);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        $id = cuid();
        $pub = 1;
        $stmt2 = $conn->prepare('INSERT INTO content_pages (id, slug, title, body, isPublished, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))');
        $stmt2->bind_param('ssssi', $id, $slug, $title, $body, $pub);
        $stmt2->execute();
    } else {
        $id = $res->fetch_assoc()['id'];
        $pub = 1;
        $stmt2 = $conn->prepare('UPDATE content_pages SET title=?, body=?, isPublished=?, updatedAt=NOW(3) WHERE id=?');
        $stmt2->bind_param('ssis', $title, $body, $pub, $id);
        $stmt2->execute();
    }
}
echo "Content pages: " . count($contentPages) . "\n";

foreach ($coupons as [$code, $title, $type, $value, $min, $maxDisc, $usage, $perUser]) {
    $stmt = $conn->prepare('SELECT id FROM coupons WHERE code = ? LIMIT 1');
    $stmt->bind_param('s', $code);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        $id = cuid();
        $active = 1;
        $used = 0;
        if ($maxDisc === null) {
            $stmt2 = $conn->prepare('INSERT INTO coupons (id, code, title, type, value, minPurchase, maxDiscount, usageLimit, perUserLimit, usedCount, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NOW(3), NOW(3))');
            $stmt2->bind_param('ssssiiiiii', $id, $code, $title, $type, $value, $min, $usage, $perUser, $used, $active);
        } else {
            $stmt2 = $conn->prepare('INSERT INTO coupons (id, code, title, type, value, minPurchase, maxDiscount, usageLimit, perUserLimit, usedCount, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))');
            $stmt2->bind_param('ssssiiiiiii', $id, $code, $title, $type, $value, $min, $maxDisc, $usage, $perUser, $used, $active);
        }
        $stmt2->execute();
    } else {
        $id = $res->fetch_assoc()['id'];
        $active = 1;
        if ($maxDisc === null) {
            $stmt2 = $conn->prepare('UPDATE coupons SET title=?, type=?, value=?, minPurchase=?, maxDiscount=NULL, usageLimit=?, perUserLimit=?, isActive=?, updatedAt=NOW(3) WHERE id=?');
            $stmt2->bind_param('ssiiiiis', $title, $type, $value, $min, $usage, $perUser, $active, $id);
        } else {
            $stmt2 = $conn->prepare('UPDATE coupons SET title=?, type=?, value=?, minPurchase=?, maxDiscount=?, usageLimit=?, perUserLimit=?, isActive=?, updatedAt=NOW(3) WHERE id=?');
            $stmt2->bind_param('ssiiiiiis', $title, $type, $value, $min, $maxDisc, $usage, $perUser, $active, $id);
        }
        $stmt2->execute();
    }
}
echo "Coupons: " . count($coupons) . "\n";

foreach ($customers as [$phone, $first, $last]) {
    $uid = $userIds[$phone];
    $conn->query("DELETE FROM addresses WHERE userId = '$uid'");
    $addrId = cuid();
    $title = 'منزل';
    $address = "تهران، آدرس نمونه $first $last";
    $lat = 35.7219;
    $lng = 51.3347;
    $def = 1;
    $stmt = $conn->prepare('INSERT INTO addresses (id, userId, title, address, latitude, longitude, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))');
    $stmt->bind_param('ssssddi', $addrId, $uid, $title, $address, $lat, $lng, $def);
    $stmt->execute();

    $stmt = $conn->prepare('SELECT id FROM notifications WHERE userId = ? AND title = ? LIMIT 1');
    $welcome = 'خوش آمدید به کیاکالا';
    $stmt->bind_param('ss', $uid, $welcome);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) {
        $nid = cuid();
        $msg = "$first عزیز، از خرید آنلاین با کیاکالا لذت ببرید.";
        $type = 'GENERAL';
        $read = 0;
        $stmt2 = $conn->prepare('INSERT INTO notifications (id, userId, title, message, type, isRead, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW(3))');
        $stmt2->bind_param('sssssi', $nid, $uid, $welcome, $msg, $type, $read);
        $stmt2->execute();
    }
}
echo "Addresses + welcome notifications done\n";

function seedOrder(mysqli $conn, array $cfg, array $userIds): void {
    $orderNumber = $cfg['orderNumber'];
    $stmt = $conn->prepare('SELECT id FROM orders WHERE orderNumber = ? LIMIT 1');
    $stmt->bind_param('s', $orderNumber);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        $orderId = cuid();
        $stmt2 = $conn->prepare('INSERT INTO orders (id, orderNumber, userId, subtotal, discountAmount, totalPrice, couponCode, couponId, status, customerName, customerPhone, deliveryAddress, addressTitle, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))');
        $stmt2->bind_param('sssiiisssssss', $orderId, $orderNumber, $cfg['userId'], $cfg['subtotal'], $cfg['discountAmount'], $cfg['totalPrice'], $cfg['couponCode'], $cfg['couponId'], $cfg['status'], $cfg['customerName'], $cfg['customerPhone'], $cfg['deliveryAddress'], $cfg['addressTitle']);
        $stmt2->execute();
    } else {
        $orderId = $res->fetch_assoc()['id'];
        $stmt2 = $conn->prepare('UPDATE orders SET userId=?, subtotal=?, discountAmount=?, totalPrice=?, couponCode=?, couponId=?, status=?, customerName=?, customerPhone=?, deliveryAddress=?, addressTitle=?, updatedAt=NOW(3) WHERE id=?');
        $stmt2->bind_param('siiissssssss', $cfg['userId'], $cfg['subtotal'], $cfg['discountAmount'], $cfg['totalPrice'], $cfg['couponCode'], $cfg['couponId'], $cfg['status'], $cfg['customerName'], $cfg['customerPhone'], $cfg['deliveryAddress'], $cfg['addressTitle'], $orderId);
        $stmt2->execute();
        $conn->query("DELETE FROM order_items WHERE orderId = '$orderId'");
        $conn->query("DELETE FROM order_status_logs WHERE orderId = '$orderId'");
        $conn->query("DELETE FROM notifications WHERE orderId = '$orderId'");
    }

    foreach ($cfg['items'] as $item) {
        $p = productBySlug($conn, $item['slug']);
        if (!$p) continue;
        $price = $p['discountPrice'] ?? $p['price'];
        $itemId = cuid();
        $stmt = $conn->prepare('INSERT INTO order_items (id, orderId, productId, quantity, price, name) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->bind_param('sssiis', $itemId, $orderId, $p['id'], $item['qty'], $price, $p['name']);
        $stmt->execute();
    }

    foreach ($cfg['logs'] as $status) {
        $logId = cuid();
        $note = 'ثبت سفارش نمونه';
        $stmt = $conn->prepare('INSERT INTO order_status_logs (id, orderId, status, note, createdAt) VALUES (?, ?, ?, ?, NOW(3))');
        $stmt->bind_param('ssss', $logId, $orderId, $status, $note);
        $stmt->execute();
    }
}

$couponWelcome = null;
$stmt = $conn->prepare('SELECT id FROM coupons WHERE code = ? LIMIT 1');
$code = 'WELCOME10';
$stmt->bind_param('s', $code);
$stmt->execute();
$res = $stmt->get_result();
if ($res->num_rows) $couponWelcome = $res->fetch_assoc()['id'];

$orders = [
    [
        'orderNumber' => 'HM-SEED-001', 'status' => 'NEW', 'userId' => $userIds['09121111111'],
        'customerName' => 'علی رضایی', 'customerPhone' => '09121111111',
        'deliveryAddress' => 'تهران، سعادت‌آباد، خیابان سرو، پلاک ۱۲', 'addressTitle' => 'منزل',
        'couponCode' => null, 'couponId' => null, 'discountAmount' => 0,
        'items' => [['slug' => 'shir-pasteurized-1l', 'qty' => 2], ['slug' => 'chips-mazmaz-100g', 'qty' => 1]],
        'logs' => ['NEW'],
    ],
    [
        'orderNumber' => 'HM-SEED-002', 'status' => 'PREPARING', 'userId' => $userIds['09122222222'],
        'customerName' => 'مریم احمدی', 'customerPhone' => '09122222222',
        'deliveryAddress' => 'تهران، پونک، بلوار میرزابابایی، پلاک ۸', 'addressTitle' => 'منزل',
        'couponCode' => null, 'couponId' => null, 'discountAmount' => 0,
        'items' => [['slug' => 'berenj-tarem-5kg', 'qty' => 1], ['slug' => 'roghan-1-5l', 'qty' => 1], ['slug' => 'ab-madani-1-5l', 'qty' => 6]],
        'logs' => ['NEW', 'PREPARING'],
    ],
    [
        'orderNumber' => 'HM-SEED-003', 'status' => 'SHIPPED', 'userId' => $userIds['09122222222'],
        'customerName' => 'مریم احمدی', 'customerPhone' => '09122222222',
        'deliveryAddress' => 'تهران، پونک، بلوار میرزابابایی، پلاک ۸', 'addressTitle' => 'منزل',
        'couponCode' => null, 'couponId' => null, 'discountAmount' => 0,
        'items' => [['slug' => 'maye-zarfshuyi-1l', 'qty' => 2], ['slug' => 'lamp-led-9w', 'qty' => 1]],
        'logs' => ['NEW', 'PREPARING', 'SHIPPED'],
    ],
    [
        'orderNumber' => 'HM-SEED-004', 'status' => 'DELIVERED', 'userId' => $userIds['09123333333'],
        'customerName' => 'رضا کریمی', 'customerPhone' => '09123333333',
        'deliveryAddress' => 'تهران، نیاوران، خیابان باهنر، پلاک ۲۵', 'addressTitle' => 'محل کار',
        'couponCode' => 'WELCOME10', 'couponId' => $couponWelcome, 'discountAmount' => 42000,
        'items' => [['slug' => 'panir-liquan-400g', 'qty' => 1], ['slug' => 'nooshabe-pepsi-1-5l', 'qty' => 2], ['slug' => 'goje-1kg', 'qty' => 2], ['slug' => 'shokolat-farmand', 'qty' => 1]],
        'logs' => ['NEW', 'PREPARING', 'SHIPPED', 'DELIVERED'],
    ],
    [
        'orderNumber' => 'HM-SEED-005', 'status' => 'CANCELLED', 'userId' => null,
        'customerName' => 'مهمان نمونه', 'customerPhone' => '09124444444',
        'deliveryAddress' => 'تهران، ونک، خیابان ملاصدرا، پلاک ۳', 'addressTitle' => 'منزل',
        'couponCode' => null, 'couponId' => null, 'discountAmount' => 0,
        'items' => [['slug' => 'sib-1kg', 'qty' => 1]],
        'logs' => ['NEW', 'CANCELLED'],
    ],
];

foreach ($orders as &$orderCfg) {
    $subtotal = 0;
    foreach ($orderCfg['items'] as $item) {
        $p = productBySlug($conn, $item['slug']);
        if (!$p) continue;
        $price = $p['discountPrice'] ?? $p['price'];
        $subtotal += $price * $item['qty'];
    }
    $orderCfg['subtotal'] = $subtotal;
    $orderCfg['totalPrice'] = $subtotal - $orderCfg['discountAmount'];
    seedOrder($conn, $orderCfg, $userIds);
}
echo "Orders: " . count($orders) . "\n";

$uid = $userIds['09121111111'];
$stmt = $conn->prepare('SELECT id FROM carts WHERE userId = ? LIMIT 1');
$stmt->bind_param('s', $uid);
$stmt->execute();
$res = $stmt->get_result();
if ($res->num_rows === 0) {
    $cartId = cuid();
    $stmt2 = $conn->prepare('INSERT INTO carts (id, userId, createdAt, updatedAt) VALUES (?, ?, NOW(3), NOW(3))');
    $stmt2->bind_param('ss', $cartId, $uid);
    $stmt2->execute();
} else {
    $cartId = $res->fetch_assoc()['id'];
    $conn->query("DELETE FROM cart_items WHERE cartId = '$cartId'");
}
$milk = productBySlug($conn, 'shir-pasteurized-1l');
$chips = productBySlug($conn, 'chips-mazmaz-100g');
if ($milk && $chips) {
    $ci1 = cuid(); $q1 = 2;
    $stmt = $conn->prepare('INSERT INTO cart_items (id, cartId, productId, quantity, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(3), NOW(3))');
    $stmt->bind_param('sssi', $ci1, $cartId, $milk['id'], $q1);
    $stmt->execute();
    $ci2 = cuid(); $q2 = 1;
    $stmt->bind_param('sssi', $ci2, $cartId, $chips['id'], $q2);
    $stmt->execute();
}
echo "Sample cart for 09121111111\n";

echo "DONE.\n";
