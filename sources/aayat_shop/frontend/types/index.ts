export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  sortOrder: number;
  parentId?: string | null;
  feedSortMode?: 'MANUAL' | 'DISCOUNT' | 'NEWEST';
  isActive: boolean;
  _count?: { products: number };
  tags?: Tag[];
}

export type CategoryFeedSortMode = 'MANUAL' | 'DISCOUNT' | 'NEWEST';

export interface Tag {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  icon: string | null;
  sortOrder: number;
  isActive?: boolean;
  category?: { id: string; name: string; slug: string };
  _count?: { products: number };
}

export interface Slider {
  id: string;
  title: string | null;
  image: string;
  mobileImage?: string | null;
  linkUrl: string | null;
  sortOrder: number;
  placement: SliderPlacement;
  categoryId?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  isActive: boolean;
}

export type SliderPlacement = 'HOME_TOP' | 'HOME_MID';

export type UserRole = 'CUSTOMER' | 'ADMIN' | 'SUPERVISOR' | 'STAFF';

export const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: 'مشتری',
  ADMIN: 'مدیر',
  SUPERVISOR: 'مسئول',
  STAFF: 'پرسنل',
};

export type PanelPermission =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'sales'
  | 'categories'
  | 'tags'
  | 'sliders'
  | 'customers'
  | 'coupons'
  | 'content'
  | 'settings'
  | 'users';

export const PERMISSION_LABELS: Record<PanelPermission, string> = {
  dashboard: 'داشبورد',
  orders: 'سفارش‌ها',
  products: 'محصولات',
  sales: 'گزارش فروش',
  categories: 'دسته‌بندی',
  tags: 'برچسب‌ها',
  sliders: 'اسلایدرها',
  customers: 'مشتریان',
  coupons: 'کدهای تخفیف',
  content: 'قوانین و محتوا',
  settings: 'تنظیمات',
  users: 'کاربران و نقش‌ها',
};

export const BUILTIN_ROLE_GUIDE: Array<{
  role: UserRole;
  title: string;
  summary: string;
  permissions: PanelPermission[];
}> = [
  {
    role: 'ADMIN',
    title: 'مدیر',
    summary: 'دسترسی کامل به پنل؛ ساخت کاربر، نقش سفارشی و همه بخش‌ها.',
    permissions: [
      'dashboard',
      'orders',
      'products',
      'sales',
      'categories',
      'tags',
      'sliders',
      'customers',
      'coupons',
      'content',
      'settings',
      'users',
    ],
  },
  {
    role: 'SUPERVISOR',
    title: 'مسئول',
    summary: 'همه بخش‌های عملیاتی و گزارش‌ها؛ بدون مدیریت کاربران و نقش‌ها.',
    permissions: [
      'dashboard',
      'orders',
      'products',
      'sales',
      'categories',
      'tags',
      'sliders',
      'customers',
      'coupons',
      'content',
      'settings',
    ],
  },
  {
    role: 'STAFF',
    title: 'پرسنل',
    summary: 'کار روزمره فروشگاه: سفارش‌ها و محصولات (جمع‌آوری و موجودی).',
    permissions: ['dashboard', 'orders', 'products'],
  },
];

export interface AccessRole {
  id: string;
  name: string;
  description?: string | null;
  permissions: PanelPermission[];
  _count?: { users: number };
}

export interface ClothingVariant {
  color?: string;
  size?: string;
  stock: number;
  sku?: string;
}

export interface ClothingMeta {
  fabric?: string;
  sizeGuide?: string;
  colors?: { name: string; hex?: string; imageIndex?: number }[];
  sizes?: string[];
  variants?: ClothingVariant[];
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  barcode?: string | null;
  productionDate?: string | null;
  expiryDate?: string | null;
  clothingMeta?: ClothingMeta | null;
  price: number;
  discountPrice: number | null;
  effectivePrice: number;
  discountPercent: number;
  stock: number;
  image: string | null;
  images: string[];
  unit: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isOldPrice: boolean;
  isHomeDeal?: boolean;
  isHomeFeatured?: boolean;
  categoryId: string;
  tagId?: string | null;
  categoryIds?: string[];
  tagIds?: string[];
  categories?: Array<{ id: string; name: string; slug: string }>;
  tags?: Tag[];
  category?: { id: string; name: string; slug: string };
  tag?: Tag | null;
  inStock: boolean;
  ratingAvg?: number;
  ratingCount?: number;
}

export interface ProductReview {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  authorName: string;
  mine?: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  unit: string | null;
  quantity: number;
  price: number;
  discountPrice: number | null;
  effectivePrice: number;
  subtotal: number;
  stock: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  holdMinutes?: number;
  expiresAt?: string | null;
  sessionId?: string;
}

export interface User {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  isActive?: boolean;
  customerGroupId?: string | null;
  customerGroup?: CustomerGroup | null;
  hasPassword?: boolean;
  accessRoleId?: string | null;
  accessRole?: { id: string; name: string; permissions: PanelPermission[] } | null;
  permissions?: PanelPermission[];
}

export interface CustomerGroup {
  id: string;
  name: string;
  description: string | null;
}

export interface Coupon {
  id: string;
  code: string;
  title: string | null;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minPurchase: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

export interface ContentPage {
  id: string;
  slug: string;
  title: string;
  body: string;
  isPublished: boolean;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'ORDER_STATUS' | 'GENERAL';
  isRead: boolean;
  orderId: string | null;
  createdAt: string;
}

export type PaymentMethod =
  | 'CASH_AT_DOOR'
  | 'RETIREMENT_FUND'
  | 'SOCIAL_SECURITY'
  | 'TARA'
  | 'OTHER_WALLET'
  | 'ZIBAL';

export interface Order {
  id: string;
  orderNumber: string;
  subtotal?: number;
  discountAmount?: number;
  couponCode?: string | null;
  totalPrice: number;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  paymentDetails?: {
    deliveryMethod?: 'PICKUP' | 'NATIONWIDE' | 'FREE' | 'JET' | string;
    deliveryFee?: number | string;
    nationalId?: string;
    salaryCard?: string;
    taraId?: string;
    walletNote?: string;
    requestedShipDate?: string;
    otpVerified?: boolean | string;
    [key: string]: unknown;
  } | null;
  customerName: string;
  customerPhone?: string;
  deliveryAddress?: string;
  addressId?: string | null;
  addressTitle?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  statusLogs?: OrderStatusLog[];
}

export interface OrderStatusLog {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  name: string;
  subtotal?: number;
  product?: { image: string | null; slug: string; barcode?: string | null };
}

export type OrderStatus =
  | 'NEW'
  | 'REVIEWING'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Address {
  id: string;
  title: string | null;
  address: string;
  plaque: string | null;
  unit: string | null;
  province: string | null;
  city: string | null;
  postalCode: string | null;
  isDefault: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface HomeSections {
  featured: Product[];
  discounted: Product[];
  newProducts: Product[];
}

export interface HomeCategorySection {
  category: Category;
  products: Product[];
}

export interface SalesStats {
  daily: { label: string; revenue: number; orders: number }[];
  byPaymentMethod: { method: PaymentMethod; count: number; revenue: number }[];
  totals: { revenue: number; orders: number; customers: number };
}

export interface AdminCustomer extends User {
  createdAt: string;
  address?: string | null;
  totalSpend?: number;
  lastOrderAt?: string | null;
  lastPaymentMethod?: PaymentMethod | null;
  _count: { orders: number };
  orders?: Order[];
  addresses?: Address[];
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH_AT_DOOR: 'پرداخت در محل',
  RETIREMENT_FUND: 'صندوق بازنشستگی',
  SOCIAL_SECURITY: 'تامین اجتماعی',
  TARA: 'کیف پول تارا',
  OTHER_WALLET: 'سایر کیف پول‌ها',
  ZIBAL: 'زیبال',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'خریداری شده',
  REVIEWING: 'در حال بررسی',
  PREPARING: 'درخواست ارسال',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل داده شده',
  CANCELLED: 'لغو شده',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  REVIEWING: 'bg-indigo-100 text-indigo-700',
  PREPARING: 'bg-yellow-100 text-yellow-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};
