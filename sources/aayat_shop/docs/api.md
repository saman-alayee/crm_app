# API Documentation — Aayat Shop (عایت)

Base URL: `http://localhost:3001/api`

## Authentication

### POST /auth/send-otp
Send OTP code to phone number.

```json
{ "phone": "09123456789" }
```

### POST /auth/verify-otp
Verify OTP and get JWT token.

```json
{ "phone": "09123456789", "code": "123456" }
```

### GET /auth/profile
Get user profile (requires auth).

### PUT /auth/profile
Update profile (requires auth).

---

## Categories

### GET /categories
List all active categories.

### GET /categories/:slug
Get category by slug.

---

## Products

### GET /products
List products with filters.

Query params: `category`, `search`, `featured`, `discounted`, `isNew`, `page`, `limit`

### GET /products/home
Get home page sections (featured, discounted, new).

### GET /products/:slug
Get product details.

---

## Cart

Headers: `X-Session-Id` (for guest), `Authorization` (for logged in)

### GET /cart
Get current cart.

### POST /cart/items
Add item to cart.

```json
{ "productId": "...", "quantity": 1 }
```

### PUT /cart/items/:productId
Update item quantity.

### DELETE /cart/items/:productId
Remove item from cart.

---

## Orders

**No payment endpoint exists.** Orders are placed directly.

### POST /orders
Create order (cash on delivery).

```json
{
  "customerName": "علی محمدی",
  "customerPhone": "09123456789",
  "deliveryAddress": "تهران، ...",
  "notes": "optional"
}
```

### GET /orders
Get user orders (requires auth).

### GET /orders/:id
Get order details.

### GET /orders/track/:orderNumber
Track order by number.

---

## Addresses

All require authentication.

### GET /addresses
### POST /addresses
### PUT /addresses/:id
### DELETE /addresses/:id

---

## Admin (requires ADMIN role)

### GET /admin/stats
### CRUD /admin/categories
### CRUD /admin/products
### POST /admin/products/upload
### GET /admin/orders, PUT /admin/orders/:id/status
### GET /admin/customers
### CRUD /admin/discounts

---

## Order Status Flow

```
NEW → PREPARING → SHIPPED → DELIVERED
                    ↓
                CANCELLED
```

## Response Format

```json
{
  "success": true,
  "data": { ... },
  "message": "optional message"
}
```
