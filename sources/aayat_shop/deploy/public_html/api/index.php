<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
apiCors();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = trim($_GET['path'] ?? '', '/');
$segments = $path === '' ? [] : explode('/', $path);
$conn = apiDb();
$env = apiReadEnv();

try {
    // GET /api/health
    if ($method === 'GET' && $path === 'health') {
        apiJson(['message' => 'Hyper Market API is running', 'timestamp' => gmdate('c')]);
    }

    // GET /api/categories
    if ($method === 'GET' && ($segments[0] ?? '') === 'categories' && count($segments) === 1) {
        $res = $conn->query('SELECT id, name, slug, image, sortOrder, isActive, createdAt, updatedAt FROM categories WHERE isActive = 1 ORDER BY sortOrder ASC');
        $rows = [];
        while ($row = $res->fetch_assoc()) $rows[] = $row;
        apiJson($rows);
    }

    // GET /api/categories/:slug
    if ($method === 'GET' && ($segments[0] ?? '') === 'categories' && count($segments) === 2) {
        $slug = $segments[1];
        $stmt = $conn->prepare('SELECT id, name, slug, image, sortOrder, isActive, createdAt, updatedAt FROM categories WHERE slug = ? AND isActive = 1 LIMIT 1');
        $stmt->bind_param('s', $slug);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) apiError('دسته‌بندی یافت نشد', 404);
        apiJson($row);
    }

    // GET /api/products/home
    if ($method === 'GET' && ($segments[0] ?? '') === 'products' && ($segments[1] ?? '') === 'home') {
        $fetch = function (string $where) use ($conn): array {
            $sql = "SELECT p.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug
                    FROM products p JOIN categories c ON c.id = p.categoryId
                    WHERE p.isActive = 1 AND $where ORDER BY p.createdAt DESC LIMIT 8";
            $res = $conn->query($sql);
            $items = [];
            while ($row = $res->fetch_assoc()) {
                $images = apiFetchProductImages($conn, $row['id']);
                $items[] = apiFormatProduct($row, $images ?: ($row['image'] ? [$row['image']] : []));
            }
            return $items;
        };
        apiJson([
            'featured' => $fetch('p.isFeatured = 1'),
            'discounted' => $fetch('p.discountPrice IS NOT NULL'),
            'newProducts' => $fetch('p.isNew = 1'),
        ]);
    }

    // GET /api/products
    if ($method === 'GET' && ($segments[0] ?? '') === 'products' && count($segments) === 1) {
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int) ($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $where = ['p.isActive = 1'];
        $types = '';
        $params = [];
        if (!empty($_GET['category'])) {
            $where[] = 'c.slug = ?';
            $types .= 's';
            $params[] = $_GET['category'];
        }
        if (!empty($_GET['search'])) {
            $where[] = '(p.name LIKE ? OR p.description LIKE ?)';
            $types .= 'ss';
            $term = '%' . $_GET['search'] . '%';
            $params[] = $term;
            $params[] = $term;
        }
        if (($_GET['featured'] ?? '') === 'true') $where[] = 'p.isFeatured = 1';
        if (($_GET['discounted'] ?? '') === 'true') $where[] = 'p.discountPrice IS NOT NULL';
        if (($_GET['isNew'] ?? '') === 'true') $where[] = 'p.isNew = 1';
        $whereSql = implode(' AND ', $where);

        $countSql = "SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.categoryId WHERE $whereSql";
        $stmt = $conn->prepare($countSql);
        if ($types) $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $total = (int) $stmt->get_result()->fetch_assoc()['total'];

        $sql = "SELECT p.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug
                FROM products p JOIN categories c ON c.id = p.categoryId
                WHERE $whereSql ORDER BY p.createdAt DESC LIMIT ? OFFSET ?";
        $stmt = $conn->prepare($sql);
        $types2 = $types . 'ii';
        $params2 = [...$params, $limit, $offset];
        $stmt->bind_param($types2, ...$params2);
        $stmt->execute();
        $res = $stmt->get_result();
        $products = [];
        while ($row = $res->fetch_assoc()) {
            $images = apiFetchProductImages($conn, $row['id']);
            $products[] = apiFormatProduct($row, $images ?: ($row['image'] ? [$row['image']] : []));
        }
        apiJson(['products' => $products, 'pagination' => ['page' => $page, 'limit' => $limit, 'total' => $total, 'totalPages' => (int) ceil($total / $limit)]]);
    }

    // GET /api/products/:slug
    if ($method === 'GET' && ($segments[0] ?? '') === 'products' && count($segments) === 2 && $segments[1] !== 'home') {
        $slug = $segments[1];
        $stmt = $conn->prepare("SELECT p.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug
            FROM products p JOIN categories c ON c.id = p.categoryId
            WHERE p.slug = ? AND p.isActive = 1 LIMIT 1");
        $stmt->bind_param('s', $slug);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) apiError('محصول یافت نشد', 404);
        $images = apiFetchProductImages($conn, $row['id']);
        apiJson(apiFormatProduct($row, $images ?: ($row['image'] ? [$row['image']] : [])));
    }

    // GET /api/content/:slug
    if ($method === 'GET' && ($segments[0] ?? '') === 'content' && count($segments) === 2) {
        $slug = $segments[1];
        $stmt = $conn->prepare('SELECT title, body, updatedAt FROM content_pages WHERE slug = ? AND isPublished = 1 LIMIT 1');
        $stmt->bind_param('s', $slug);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) apiError('صفحه یافت نشد', 404);
        apiJson($row);
    }

    // POST /api/auth/send-otp
    if ($method === 'POST' && $path === 'auth/send-otp') {
        $body = apiBody();
        $phone = apiNormalizePhone($body['phone'] ?? '');
        $devMode = ($env['OTP_DEV_MODE'] ?? 'false') === 'true';
        $code = $devMode ? '123456' : (string) random_int(100000, 999999);
        $expires = date('Y-m-d H:i:s', time() + ((int) ($env['OTP_EXPIRES_MINUTES'] ?? 5) * 60));
        if (!$devMode) apiSendOtpSms($phone, $code);
        $id = apiCuid();
        $stmt = $conn->prepare('INSERT INTO otp_codes (id, phone, code, expiresAt, used, createdAt) VALUES (?, ?, ?, ?, 0, NOW(3))');
        $stmt->bind_param('ssss', $id, $phone, $code, $expires);
        $stmt->execute();
        $result = ['message' => 'کد تأیید ارسال شد'];
        if ($devMode) $result['devCode'] = $code;
        apiJson($result, 200, 'کد تأیید ارسال شد');
    }

    // POST /api/auth/verify-otp
    if ($method === 'POST' && $path === 'auth/verify-otp') {
        $body = apiBody();
        $phone = apiNormalizePhone($body['phone'] ?? '');
        $code = apiNormalizeDigits(trim($body['code'] ?? ''));
        $stmt = $conn->prepare('SELECT id FROM otp_codes WHERE phone = ? AND code = ? AND used = 0 AND expiresAt > NOW(3) ORDER BY createdAt DESC LIMIT 1');
        $stmt->bind_param('ss', $phone, $code);
        $stmt->execute();
        $otp = $stmt->get_result()->fetch_assoc();
        if (!$otp) apiError('کد تأیید نامعتبر یا منقضی شده است', 400);
        $conn->query("UPDATE otp_codes SET used = 1 WHERE id = '{$otp['id']}'");

        $stmt = $conn->prepare('SELECT id, phone, firstName, lastName, role FROM users WHERE phone = ? LIMIT 1');
        $stmt->bind_param('s', $phone);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        if (!$user) {
            $id = apiCuid();
            $role = ($phone === ($env['ADMIN_PHONE'] ?? '')) ? 'ADMIN' : 'CUSTOMER';
            $first = $role === 'ADMIN' ? 'مدیر' : null;
            $last = $role === 'ADMIN' ? 'سیستم' : null;
            $stmt = $conn->prepare('INSERT INTO users (id, phone, firstName, lastName, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, NOW(3), NOW(3))');
            $stmt->bind_param('sssss', $id, $phone, $first, $last, $role);
            $stmt->execute();
            $user = ['id' => $id, 'phone' => $phone, 'firstName' => $first, 'lastName' => $last, 'role' => $role];
        }
        $token = apiJwtEncode(['userId' => $user['id'], 'phone' => $user['phone'], 'role' => $user['role']]);
        apiJson(['token' => $token, 'user' => $user], 200, 'ورود موفق');
    }

    // POST /api/auth/login-password
    if ($method === 'POST' && $path === 'auth/login-password') {
        $body = apiBody();
        $phone = apiNormalizePhone($body['phone'] ?? '');
        $password = $body['password'] ?? '';
        if ($password !== ($env['ADMIN_PASSWORD'] ?? '')) apiError('شماره موبایل یا رمز عبور اشتباه است', 401);
        $stmt = $conn->prepare('SELECT id, phone, firstName, lastName, role, isActive FROM users WHERE phone = ? LIMIT 1');
        $stmt->bind_param('s', $phone);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        if (!$user || $user['role'] !== 'ADMIN') apiError('شماره موبایل یا رمز عبور اشتباه است', 401);
        if (!(int) $user['isActive']) apiError('حساب کاربری غیرفعال است', 403);
        $token = apiJwtEncode(['userId' => $user['id'], 'phone' => $user['phone'], 'role' => $user['role']]);
        unset($user['isActive']);
        apiJson(['token' => $token, 'user' => $user], 200, 'ورود موفق');
    }

    // GET /api/auth/profile
    if ($method === 'GET' && $path === 'auth/profile') {
        $auth = apiRequireAuth();
        $stmt = $conn->prepare('SELECT id, phone, firstName, lastName, role, createdAt FROM users WHERE id = ? LIMIT 1');
        $stmt->bind_param('s', $auth['userId']);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        if (!$user) apiError('کاربر یافت نشد', 404);
        apiJson($user);
    }

    // Cart helpers
    $sessionId = $_SERVER['HTTP_X_SESSION_ID'] ?? '';
    $auth = apiAuthUser();
    $userId = $auth['userId'] ?? null;

    $getCart = function () use ($conn, $userId, $sessionId): array {
        if ($userId) {
            $stmt = $conn->prepare('SELECT id FROM carts WHERE userId = ? LIMIT 1');
            $stmt->bind_param('s', $userId);
        } elseif ($sessionId) {
            $stmt = $conn->prepare('SELECT id FROM carts WHERE sessionId = ? LIMIT 1');
            $stmt->bind_param('s', $sessionId);
        } else {
            $newSession = apiUuid();
            $id = apiCuid();
            $stmt = $conn->prepare('INSERT INTO carts (id, sessionId, createdAt, updatedAt) VALUES (?, ?, NOW(3), NOW(3))');
            $stmt->bind_param('ss', $id, $newSession);
            $stmt->execute();
            return ['id' => $id, 'items' => [], 'totalItems' => 0, 'totalPrice' => 0, 'sessionId' => $newSession];
        }
        $stmt->execute();
        $cart = $stmt->get_result()->fetch_assoc();
        if (!$cart) {
            $id = apiCuid();
            if ($userId) {
                $stmt = $conn->prepare('INSERT INTO carts (id, userId, createdAt, updatedAt) VALUES (?, ?, NOW(3), NOW(3))');
                $stmt->bind_param('ss', $id, $userId);
            } else {
                $newSession = apiUuid();
                $stmt = $conn->prepare('INSERT INTO carts (id, sessionId, createdAt, updatedAt) VALUES (?, ?, NOW(3), NOW(3))');
                $stmt->bind_param('ss', $id, $newSession);
                $sessionId = $newSession;
            }
            $stmt->execute();
            $cart = ['id' => $id];
        }
        $cartId = $cart['id'];
        $sql = "SELECT ci.id, ci.quantity, p.id AS productId, p.name, p.slug, p.price, p.discountPrice, p.stock, p.image, p.unit, p.isActive
                FROM cart_items ci JOIN products p ON p.id = ci.productId WHERE ci.cartId = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('s', $cartId);
        $stmt->execute();
        $res = $stmt->get_result();
        $items = [];
        $totalItems = 0;
        $totalPrice = 0;
        while ($row = $res->fetch_assoc()) {
            if (!(int) $row['isActive']) continue;
            $price = (int) $row['price'];
            $discountPrice = $row['discountPrice'] !== null ? (int) $row['discountPrice'] : null;
            $effective = $discountPrice ?? $price;
            $subtotal = $effective * (int) $row['quantity'];
            $items[] = [
                'id' => $row['id'], 'productId' => $row['productId'], 'name' => $row['name'], 'slug' => $row['slug'],
                'image' => $row['image'], 'unit' => $row['unit'], 'quantity' => (int) $row['quantity'],
                'price' => $price, 'discountPrice' => $discountPrice, 'effectivePrice' => $effective,
                'subtotal' => $subtotal, 'stock' => (int) $row['stock'],
            ];
            $totalItems += (int) $row['quantity'];
            $totalPrice += $subtotal;
        }
        $result = ['id' => $cartId, 'items' => $items, 'totalItems' => $totalItems, 'totalPrice' => $totalPrice];
        if (!$userId && !$sessionId && isset($newSession)) $result['sessionId'] = $newSession;
        return $result;
    };

    if ($method === 'GET' && $path === 'cart') apiJson($getCart());

    if ($method === 'POST' && $path === 'cart/items') {
        $body = apiBody();
        $productId = $body['productId'] ?? '';
        $quantity = max(1, (int) ($body['quantity'] ?? 1));
        $cart = $getCart();
        $cartId = $cart['id'];
        $stmt = $conn->prepare('SELECT id, stock FROM products WHERE id = ? AND isActive = 1 LIMIT 1');
        $stmt->bind_param('s', $productId);
        $stmt->execute();
        $product = $stmt->get_result()->fetch_assoc();
        if (!$product) apiError('محصول یافت نشد', 404);
        if ((int) $product['stock'] < $quantity) apiError('موجودی کافی نیست', 400);
        $stmt = $conn->prepare('SELECT id, quantity FROM cart_items WHERE cartId = ? AND productId = ? LIMIT 1');
        $stmt->bind_param('ss', $cartId, $productId);
        $stmt->execute();
        $existing = $stmt->get_result()->fetch_assoc();
        if ($existing) {
            $newQty = (int) $existing['quantity'] + $quantity;
            if ($newQty > (int) $product['stock']) apiError('موجودی کافی نیست', 400);
            $stmt = $conn->prepare('UPDATE cart_items SET quantity = ?, updatedAt = NOW(3) WHERE id = ?');
            $stmt->bind_param('is', $newQty, $existing['id']);
            $stmt->execute();
        } else {
            $id = apiCuid();
            $stmt = $conn->prepare('INSERT INTO cart_items (id, cartId, productId, quantity, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(3), NOW(3))');
            $stmt->bind_param('sssi', $id, $cartId, $productId, $quantity);
            $stmt->execute();
        }
        apiJson($getCart());
    }

    if ($method === 'PUT' && ($segments[0] ?? '') === 'cart' && ($segments[1] ?? '') === 'items' && count($segments) === 3) {
        $productId = $segments[2];
        $body = apiBody();
        $quantity = (int) ($body['quantity'] ?? 0);
        $cart = $getCart();
        if ($quantity <= 0) {
            $stmt = $conn->prepare('DELETE FROM cart_items WHERE cartId = ? AND productId = ?');
            $stmt->bind_param('ss', $cart['id'], $productId);
            $stmt->execute();
        } else {
            $stmt = $conn->prepare('UPDATE cart_items SET quantity = ?, updatedAt = NOW(3) WHERE cartId = ? AND productId = ?');
            $stmt->bind_param('iss', $quantity, $cart['id'], $productId);
            $stmt->execute();
        }
        apiJson($getCart());
    }

    if ($method === 'DELETE' && ($segments[0] ?? '') === 'cart' && ($segments[1] ?? '') === 'items' && count($segments) === 3) {
        $productId = $segments[2];
        $cart = $getCart();
        $stmt = $conn->prepare('DELETE FROM cart_items WHERE cartId = ? AND productId = ?');
        $stmt->bind_param('ss', $cart['id'], $productId);
        $stmt->execute();
        apiJson($getCart());
    }

    // GET /api/admin/stats
    if ($method === 'GET' && $path === 'admin/stats') {
        apiRequireAdmin();
        $orders = $conn->query("SELECT status, COUNT(*) AS c FROM orders GROUP BY status")->fetch_all(MYSQLI_ASSOC);
        $stats = ['total' => 0, 'newOrders' => 0, 'preparing' => 0, 'shipped' => 0, 'delivered' => 0, 'cancelled' => 0];
        foreach ($orders as $row) {
            $stats['total'] += (int) $row['c'];
            match ($row['status']) {
                'NEW' => $stats['newOrders'] = (int) $row['c'],
                'PREPARING' => $stats['preparing'] = (int) $row['c'],
                'SHIPPED' => $stats['shipped'] = (int) $row['c'],
                'DELIVERED' => $stats['delivered'] = (int) $row['c'],
                'CANCELLED' => $stats['cancelled'] = (int) $row['c'],
                default => null,
            };
        }
        $products = (int) $conn->query('SELECT COUNT(*) AS c FROM products WHERE isActive = 1')->fetch_assoc()['c'];
        $categories = (int) $conn->query('SELECT COUNT(*) AS c FROM categories WHERE isActive = 1')->fetch_assoc()['c'];
        apiJson(['orders' => $stats, 'products' => $products, 'categories' => $categories]);
    }

    // GET /api/admin/orders
    if ($method === 'GET' && $path === 'admin/orders') {
        apiRequireAdmin();
        $status = $_GET['status'] ?? '';
        $sql = 'SELECT id, orderNumber, customerName, customerPhone, totalPrice, status, createdAt FROM orders';
        if ($status) $sql .= " WHERE status = '" . $conn->real_escape_string($status) . "'";
        $sql .= ' ORDER BY createdAt DESC LIMIT 100';
        $res = $conn->query($sql);
        $rows = [];
        while ($row = $res->fetch_assoc()) $rows[] = $row;
        apiJson($rows);
    }

    // GET /api/admin/products
    if ($method === 'GET' && $path === 'admin/products') {
        apiRequireAdmin();
        $res = $conn->query("SELECT p.*, c.name AS categoryName FROM products p LEFT JOIN categories c ON c.id = p.categoryId ORDER BY p.createdAt DESC LIMIT 200");
        $rows = [];
        while ($row = $res->fetch_assoc()) $rows[] = $row;
        apiJson($rows);
    }

    // GET /api/admin/categories
    if ($method === 'GET' && $path === 'admin/categories') {
        apiRequireAdmin();
        $res = $conn->query('SELECT * FROM categories ORDER BY sortOrder ASC');
        $rows = [];
        while ($row = $res->fetch_assoc()) $rows[] = $row;
        apiJson($rows);
    }

    // GET /api/admin/content
    if ($method === 'GET' && $path === 'admin/content') {
        apiRequireAdmin();
        $res = $conn->query('SELECT * FROM content_pages ORDER BY updatedAt DESC');
        $rows = [];
        while ($row = $res->fetch_assoc()) $rows[] = $row;
        apiJson($rows);
    }

    // GET /api/admin/coupons
    if ($method === 'GET' && $path === 'admin/coupons') {
        apiRequireAdmin();
        $res = $conn->query('SELECT * FROM coupons ORDER BY createdAt DESC');
        $rows = [];
        while ($row = $res->fetch_assoc()) $rows[] = $row;
        apiJson($rows);
    }

    // GET /api/admin/users
    if ($method === 'GET' && $path === 'admin/users') {
        apiRequireAdmin();
        $res = $conn->query('SELECT id, phone, firstName, lastName, role, isActive, createdAt FROM users ORDER BY createdAt DESC LIMIT 200');
        $rows = [];
        while ($row = $res->fetch_assoc()) $rows[] = $row;
        apiJson($rows);
    }

    // GET /api/notifications
    if ($method === 'GET' && $path === 'notifications') {
        $auth = apiRequireAuth();
        $stmt = $conn->prepare('SELECT id, title, message, type, isRead, orderId, createdAt FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50');
        $stmt->bind_param('s', $auth['userId']);
        $stmt->execute();
        $res = $stmt->get_result();
        $rows = [];
        while ($row = $res->fetch_assoc()) $rows[] = $row;
        apiJson($rows);
    }

    apiError('مسیر یافت نشد', 404);
} catch (Throwable $e) {
    apiError('خطای داخلی سرور', 500);
}
