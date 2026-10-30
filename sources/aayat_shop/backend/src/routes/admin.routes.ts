import { Router } from 'express';
import { z } from 'zod';
import type { OrderStatus } from '../services/order.service';
import { categoryService } from '../services/category.service';
import { productService } from '../services/product.service';
import { orderService } from '../services/order.service';
import { customerService, customerGroupService, discountService, adminUserService } from '../services/user.service';
import { couponService } from '../services/coupon.service';
import { contentService } from '../services/content.service';
import { tagService } from '../services/tag.service';
import { sliderService } from '../services/slider.service';
import { salesService } from '../services/sales.service';
import { asyncHandler, successResponse, validate } from '../utils/errors';
import { authenticate, requireAdmin, requireRoles, requirePermission } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { paramId } from '../utils/params';
import { accessRoleService } from '../services/access-role.service';
import { settingsService } from '../services/settings.service';
import { backupService } from '../services/backup.service';
import { reviewService } from '../services/review.service';
import { PANEL_PERMISSIONS } from '../utils/permissions';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticate, requireAdmin);

const adminOnly = requireRoles('ADMIN');
const permCategories = requirePermission('categories');
const permCustomers = requirePermission('customers');
const permCoupons = requirePermission('coupons');
const permContent = requirePermission('content');
const permTags = requirePermission('tags');
const permSliders = requirePermission('sliders');
const permSales = requirePermission('sales');
const permSettings = requirePermission('settings');

// Dashboard stats
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const orderStats = await orderService.getOrderStats();
    const productCount = await productService.getAll({ includeInactive: true, limit: 1 }) as { pagination: { total: number } };
    const categories = await categoryService.getAll(true) as unknown[];
    successResponse(res, {
      orders: orderStats,
      products: productCount.pagination.total,
      categories: categories.length,
    });
  })
);

// Categories
const categorySchema = z.object({
  name: z.string().min(2),
  image: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await categoryService.getAll(true);
    successResponse(res, categories);
  })
);

router.post(
  '/categories',
  permCategories,
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    const category = await categoryService.create(req.body);
    successResponse(res, category, 'دسته‌بندی ایجاد شد', 201);
  })
);

router.put(
  '/categories/:id',
  permCategories,
  validate(categorySchema.partial()),
  asyncHandler(async (req, res) => {
    const category = await categoryService.update(paramId(req.params.id), req.body);
    successResponse(res, category, 'دسته‌بندی به‌روزرسانی شد');
  })
);

router.delete(
  '/categories/:id',
  permCategories,
  asyncHandler(async (req, res) => {
    await categoryService.delete(paramId(req.params.id));
    successResponse(res, null, 'دسته‌بندی حذف شد');
  })
);

router.put(
  '/categories/reorder',
  permCategories,
  asyncHandler(async (req, res) => {
    await categoryService.reorder(req.body.items);
    successResponse(res, null, 'ترتیب به‌روزرسانی شد');
  })
);

const categoryFeedSchema = z.object({
  feedSortMode: z.enum(['MANUAL', 'DISCOUNT', 'NEWEST']).optional(),
  productIds: z.array(z.string()).max(10).optional(),
});

router.get(
  '/categories/:id/feed-picks',
  asyncHandler(async (req, res) => {
    const picks = await productService.getCategoryFeedPicks(paramId(req.params.id));
    successResponse(res, picks);
  })
);

router.put(
  '/categories/:id/feed-picks',
  validate(categoryFeedSchema),
  asyncHandler(async (req, res) => {
    const picks = await productService.setCategoryFeedPicks(paramId(req.params.id), req.body);
    successResponse(res, picks, 'محصولات دسته ذخیره شد');
  })
);

router.post(
  '/categories/upload',
  permCategories,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'فایل تصویر الزامی است' });
      return;
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    successResponse(res, { url: imageUrl });
  })
);

// Products
/** Empty string from cleared number inputs → null; numeric strings → number. */
const optionalNullableNumber = z.preprocess((value) => {
  if (value === '' || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    return Number.isFinite(num) ? num : value;
  }
  return value;
}, z.number().positive().nullable().optional());

const requiredPositiveNumber = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    return Number.isFinite(num) ? num : value;
  }
  return value;
}, z.number().positive());

const requiredNonNegInt = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    return Number.isFinite(num) ? num : value;
  }
  return value;
}, z.number().int().min(0));

const productBaseSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  barcode: z.string().optional().nullable(),
  productionDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  price: requiredPositiveNumber,
  discountPrice: optionalNullableNumber,
  stock: requiredNonNegInt,
  image: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
  unit: z.string().optional(),
  clothingMeta: z.record(z.unknown()).optional().nullable(),
  categoryId: z.string().optional(),
  categoryIds: z.array(z.string()).min(1).optional(),
  tagId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isOldPrice: z.boolean().optional(),
  isHomeDeal: z.boolean().optional(),
  isHomeFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const productSchema = productBaseSchema.refine(
  (data) => (data.categoryIds?.length ?? 0) > 0 || Boolean(data.categoryId),
  {
    message: 'حداقل یک دسته‌بندی لازم است',
    path: ['categoryIds'],
  }
);

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || 'all');
    const result = await productService.getAll({
      includeInactive: status !== 'active',
      isActive: status === 'active' ? true : status === 'inactive' ? false : undefined,
      search: req.query.search as string,
      barcode: req.query.barcode as string,
      tagId: req.query.tagId as string,
      categoryId: req.query.categoryId as string,
      expiringBefore: req.query.expiringBefore as string,
      expiringAfter: req.query.expiringAfter as string,
      discounted: req.query.discounted === 'true',
      sort: req.query.sort as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: Math.min(req.query.limit ? parseInt(req.query.limit as string) : 20, 50),
    });
    successResponse(res, result);
  })
);

router.get(
  '/products/home-picks',
  asyncHandler(async (_req, res) => {
    const picks = await productService.getHomePicks();
    successResponse(res, picks);
  })
);

const homePicksSchema = z.object({
  discountedIds: z.array(z.string()).max(10).optional(),
  featuredIds: z.array(z.string()).max(10).optional(),
});

router.put(
  '/products/home-picks',
  validate(homePicksSchema),
  asyncHandler(async (req, res) => {
    const picks = await productService.setHomePicks(req.body);
    successResponse(res, picks, 'محصولات صفحه اول ذخیره شد');
  })
);

router.post(
  '/products',
  validate(productSchema),
  asyncHandler(async (req, res) => {
    const product = await productService.create(req.body);
    successResponse(res, product, 'محصول ایجاد شد', 201);
  })
);

router.put(
  '/products/:id',
  validate(productBaseSchema.partial()),
  asyncHandler(async (req, res) => {
    const product = await productService.update(paramId(req.params.id), req.body);
    successResponse(res, product, 'محصول به‌روزرسانی شد');
  })
);

router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    await productService.delete(paramId(req.params.id));
    successResponse(res, null, 'محصول حذف شد');
  })
);

router.post(
  '/products/upload',
  upload.single('image'),
  asyncHandler(async (req, res, next) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'فایل تصویر الزامی است' });
      return;
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    successResponse(res, { url: imageUrl });
  })
);

// Orders
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const result = await orderService.getAllOrders({
      status: req.query.status as OrderStatus,
      search: req.query.search as string,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    });
    successResponse(res, result);
  })
);

router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrderById(paramId(req.params.id));
    successResponse(res, order);
  })
);

router.put(
  '/orders/:id/status',
  asyncHandler(async (req, res) => {
    const { status, note } = req.body;
    const order = await orderService.updateStatus(paramId(req.params.id), status, note);
    successResponse(res, order, 'وضعیت سفارش به‌روزرسانی شد');
  })
);

router.post(
  '/orders/:id/send-sms',
  asyncHandler(async (req, res) => {
    const result = await orderService.sendOrderSms(paramId(req.params.id));
    successResponse(res, result, 'پیامک ارسال شد');
  })
);

// Customers & users
router.get(
  '/customers',
  permCustomers,
  asyncHandler(async (req, res) => {
    const result = await customerService.getAll(
      req.query.page ? parseInt(req.query.page as string) : 1,
      req.query.limit ? parseInt(req.query.limit as string) : 100,
      req.query.search as string,
      'CUSTOMER',
      req.query.paymentMethod as string,
      (req.query.customerGroupId as string) || (req.query.groupId as string)
    );
    successResponse(res, result);
  })
);

router.post(
  '/customers',
  permCustomers,
  asyncHandler(async (req, res) => {
    const customer = await customerService.create(req.body);
    successResponse(res, customer, 'مشتری ایجاد شد', 201);
  })
);

router.get(
  '/customers/export-phones',
  permCustomers,
  asyncHandler(async (req, res) => {
    const csv = await customerService.exportPhonesCsv({
      customerGroupId: (req.query.customerGroupId as string) || (req.query.groupId as string),
      paymentMethod: req.query.paymentMethod as string,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="customer-phones.csv"');
    res.send('\uFEFF' + csv);
  })
);

router.post(
  '/customers/broadcast-sms',
  permCustomers,
  asyncHandler(async (req, res) => {
    const { message, customerGroupId, paymentMethod } = req.body;
    const result = await customerService.broadcastSms(message, { customerGroupId, paymentMethod });
    successResponse(res, result, 'پیامک‌ها در صف ارسال قرار گرفت');
  })
);

router.put(
  '/customers/:id/group',
  permCustomers,
  asyncHandler(async (req, res) => {
    const customer = await customerService.assignGroup(
      paramId(req.params.id),
      req.body.customerGroupId ?? null
    );
    successResponse(res, customer, 'گروه مشتری به‌روزرسانی شد');
  })
);

router.get(
  '/users',
  adminOnly,
  asyncHandler(async (req, res) => {
    const result = await customerService.getAll(
      req.query.page ? parseInt(req.query.page as string) : 1,
      req.query.limit ? parseInt(req.query.limit as string) : 20,
      req.query.search as string,
      req.query.role as 'CUSTOMER' | 'ADMIN' | 'SUPERVISOR' | 'STAFF' | undefined
    );
    successResponse(res, result);
  })
);

router.post(
  '/users/admin',
  adminOnly,
  validate(
    z.object({
      phone: z.string().min(10),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      password: z.string().min(6).optional(),
      role: z.enum(['ADMIN', 'SUPERVISOR', 'STAFF']).optional(),
      accessRoleId: z.string().nullable().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const user = await adminUserService.createAdmin(req.body);
    successResponse(res, user, 'کاربر پنل اضافه شد', 201);
  })
);

router.put(
  '/users/:id/role',
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = await adminUserService.updateRole(
      paramId(req.params.id),
      { role: req.body.role, accessRoleId: req.body.accessRoleId ?? null },
      req.user!.userId
    );
    successResponse(res, user, 'نقش کاربر به‌روزرسانی شد');
  })
);

router.put(
  '/users/:id/toggle-active',
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = await adminUserService.toggleActive(paramId(req.params.id), req.user!.userId);
    successResponse(res, user, 'وضعیت کاربر به‌روزرسانی شد');
  })
);

router.get(
  '/customers/frequent',
  permCustomers,
  asyncHandler(async (_req, res) => {
    const customers = await customerService.getFrequentCustomers();
    successResponse(res, customers);
  })
);

router.get(
  '/customers/:id',
  permCustomers,
  asyncHandler(async (req, res) => {
    const customer = await customerService.getById(paramId(req.params.id));
    successResponse(res, customer);
  })
);

// Discounts
const discountSchema = z.object({
  productId: z.string(),
  percentage: z.number().min(1).max(99).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

router.get(
  '/discounts',
  permCoupons,
  asyncHandler(async (_req, res) => {
    const discounts = await discountService.getAll(true);
    successResponse(res, discounts);
  })
);

router.post(
  '/discounts',
  permCoupons,
  validate(discountSchema),
  asyncHandler(async (req, res) => {
    const data = {
      ...req.body,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
    };
    const discount = await discountService.create(data);
    successResponse(res, discount, 'تخفیف ایجاد شد', 201);
  })
);

router.put(
  '/discounts/:id',
  permCoupons,
  asyncHandler(async (req, res) => {
    const data = {
      ...req.body,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
    };
    const discount = await discountService.update(paramId(req.params.id), data);
    successResponse(res, discount, 'تخفیف به‌روزرسانی شد');
  })
);

router.delete(
  '/discounts/:id',
  permCoupons,
  asyncHandler(async (req, res) => {
    await discountService.delete(paramId(req.params.id));
    successResponse(res, null, 'تخفیف حذف شد');
  })
);

// Coupon codes
const couponSchema = z.object({
  code: z.string().min(2),
  title: z.string().optional(),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().positive(),
  minPurchase: z.number().int().min(0).optional(),
  maxDiscount: z.number().int().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.get(
  '/coupons',
  permCoupons,
  asyncHandler(async (_req, res) => {
    const coupons = await couponService.getAll(true);
    successResponse(res, coupons);
  })
);

router.post(
  '/coupons',
  permCoupons,
  validate(couponSchema),
  asyncHandler(async (req, res) => {
    const coupon = await couponService.create({
      ...req.body,
      startDate: req.body.startDate ? new Date(req.body.startDate) : null,
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
    });
    successResponse(res, coupon, 'کد تخفیف ایجاد شد', 201);
  })
);

router.put(
  '/coupons/:id',
  permCoupons,
  validate(couponSchema.partial()),
  asyncHandler(async (req, res) => {
    const coupon = await couponService.update(paramId(req.params.id), {
      ...req.body,
      startDate: req.body.startDate ? new Date(req.body.startDate) : req.body.startDate,
      endDate: req.body.endDate ? new Date(req.body.endDate) : req.body.endDate,
    });
    successResponse(res, coupon, 'کد تخفیف به‌روزرسانی شد');
  })
);

router.delete(
  '/coupons/:id',
  permCoupons,
  asyncHandler(async (req, res) => {
    await couponService.delete(paramId(req.params.id));
    successResponse(res, null, 'کد تخفیف غیرفعال شد');
  })
);

// Content pages
const contentUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  body: z.string().min(1).optional(),
  isPublished: z.boolean().optional(),
});

router.get(
  '/content',
  permContent,
  asyncHandler(async (_req, res) => {
    const pages = await contentService.getAll();
    successResponse(res, pages);
  })
);

router.put(
  '/content/:slug',
  permContent,
  validate(contentUpdateSchema),
  asyncHandler(async (req, res) => {
    const slug = paramId(req.params.slug);
    const existing = await contentService.getBySlug(slug).catch(() => null);
    const page = await contentService.upsert({
      slug,
      title: req.body.title ?? existing?.title ?? slug,
      body: req.body.body ?? existing?.body ?? '',
      isPublished: req.body.isPublished ?? existing?.isPublished ?? true,
    });
    successResponse(res, page, 'صفحه ذخیره شد');
  })
);

// Tags
const tagSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string(),
  icon: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
});

router.get(
  '/tags',
  asyncHandler(async (req, res) => {
    const tags = await tagService.getAll(req.query.categoryId as string | undefined);
    successResponse(res, tags);
  })
);

router.post(
  '/tags',
  permTags,
  validate(tagSchema),
  asyncHandler(async (req, res) => {
    const tag = await tagService.create(req.body);
    successResponse(res, tag, 'برچسب ایجاد شد', 201);
  })
);

router.put(
  '/tags/:id',
  permTags,
  validate(tagSchema.partial()),
  asyncHandler(async (req, res) => {
    const tag = await tagService.update(paramId(req.params.id), req.body);
    successResponse(res, tag, 'برچسب به‌روزرسانی شد');
  })
);

router.delete(
  '/tags/:id',
  permTags,
  asyncHandler(async (req, res) => {
    await tagService.delete(paramId(req.params.id));
    successResponse(res, null, 'برچسب حذف شد');
  })
);

// Sliders
const sliderSchema = z.object({
  title: z.string().min(2),
  image: z.string().min(1),
  mobileImage: z.string().optional().nullable(),
  linkUrl: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
  placement: z.enum(['HOME_TOP', 'HOME_MID']).optional(),
  categoryId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.get(
  '/sliders',
  permSliders,
  asyncHandler(async (_req, res) => {
    const sliders = await sliderService.getAll();
    successResponse(res, sliders);
  })
);

router.post(
  '/sliders',
  permSliders,
  validate(sliderSchema),
  asyncHandler(async (req, res) => {
    const slider = await sliderService.create(req.body);
    successResponse(res, slider, 'اسلایدر ایجاد شد', 201);
  })
);

router.put(
  '/sliders/:id',
  permSliders,
  validate(sliderSchema.partial()),
  asyncHandler(async (req, res) => {
    const slider = await sliderService.update(paramId(req.params.id), req.body);
    successResponse(res, slider, 'اسلایدر به‌روزرسانی شد');
  })
);

router.delete(
  '/sliders/:id',
  permSliders,
  asyncHandler(async (req, res) => {
    await sliderService.delete(paramId(req.params.id));
    successResponse(res, null, 'اسلایدر حذف شد');
  })
);

router.post(
  '/sliders/upload',
  permSliders,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'فایل تصویر الزامی است' });
      return;
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    successResponse(res, { url: imageUrl });
  })
);

// Sales
router.get(
  '/sales/overview',
  permSales,
  asyncHandler(async (req, res) => {
    const overview = await salesService.getOverview({
      days: req.query.days ? parseInt(req.query.days as string) : 30,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      productSearch: (req.query.productSearch || req.query.search) as string | undefined,
    });
    successResponse(res, overview);
  })
);

router.get(
  '/sales/daily',
  permSales,
  asyncHandler(async (req, res) => {
    const date = req.query.date ? new Date(req.query.date as string) : undefined;
    const daily = await salesService.getDailySales(date);
    successResponse(res, daily);
  })
);

router.get(
  '/sales/top-products',
  permSales,
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const top = await salesService.getTopProducts(limit, {
      days: req.query.days ? parseInt(req.query.days as string) : 30,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      productSearch: req.query.productSearch as string | undefined,
    });
    successResponse(res, top);
  })
);

router.get(
  '/sales/by-payment',
  permSales,
  asyncHandler(async (req, res) => {
    const data = await salesService.getByPaymentMethod({
      days: req.query.days ? parseInt(req.query.days as string) : 30,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    });
    successResponse(res, data);
  })
);

router.get(
  '/sales/charts',
  permSales,
  asyncHandler(async (req, res) => {
    const chart = await salesService.getChartData({
      days: req.query.days ? parseInt(req.query.days as string) : 30,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      productSearch: req.query.productSearch as string | undefined,
    });
    successResponse(res, chart);
  })
);

// Customer groups
const customerGroupSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
});

router.get(
  '/customer-groups',
  permCustomers,
  asyncHandler(async (_req, res) => {
    const groups = await customerGroupService.getAll();
    successResponse(res, groups);
  })
);

router.post(
  '/customer-groups',
  permCustomers,
  validate(customerGroupSchema),
  asyncHandler(async (req, res) => {
    const group = await customerGroupService.create(req.body);
    successResponse(res, group, 'گروه ایجاد شد', 201);
  })
);

router.put(
  '/customer-groups/:id',
  permCustomers,
  validate(customerGroupSchema.partial()),
  asyncHandler(async (req, res) => {
    const group = await customerGroupService.update(paramId(req.params.id), req.body);
    successResponse(res, group, 'گروه به‌روزرسانی شد');
  })
);

router.delete(
  '/customer-groups/:id',
  permCustomers,
  asyncHandler(async (req, res) => {
    await customerGroupService.delete(paramId(req.params.id));
    successResponse(res, null, 'گروه حذف شد');
  })
);

const accessRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  permissions: z.array(z.string()),
});

router.get(
  '/access-roles',
  adminOnly,
  asyncHandler(async (_req, res) => {
    const roles = await accessRoleService.getAll();
    successResponse(res, {
      roles,
      catalog: PANEL_PERMISSIONS.filter((key) => key !== 'users'),
    });
  })
);

router.post(
  '/access-roles',
  adminOnly,
  validate(accessRoleSchema),
  asyncHandler(async (req, res) => {
    const role = await accessRoleService.create(req.body);
    successResponse(res, role, 'نقش جدید ساخته شد', 201);
  })
);

router.put(
  '/access-roles/:id',
  adminOnly,
  validate(accessRoleSchema.partial()),
  asyncHandler(async (req, res) => {
    const role = await accessRoleService.update(paramId(req.params.id), req.body);
    successResponse(res, role, 'نقش به‌روزرسانی شد');
  })
);

router.delete(
  '/access-roles/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    await accessRoleService.delete(paramId(req.params.id));
    successResponse(res, null, 'نقش حذف شد');
  })
);

const newOrderSmsSchema = z.object({
  enabled: z.boolean(),
  phones: z.array(z.string().min(10).max(15)).max(30),
  includePanelStaff: z.boolean(),
  messageTemplate: z.string().min(5).max(500),
});

router.get(
  '/settings/new-order-sms',
  permSettings,
  asyncHandler(async (_req, res) => {
    const settings = await settingsService.getNewOrderSms();
    successResponse(res, settings);
  })
);

router.put(
  '/settings/new-order-sms',
  permSettings,
  validate(newOrderSmsSchema),
  asyncHandler(async (req, res) => {
    const settings = await settingsService.updateNewOrderSms(req.body);
    successResponse(res, settings, 'تنظیمات پیامک ذخیره شد');
  })
);

const newOrderSmsTestSchema = z.object({
  phone: z.string().min(10).max(15),
  messageTemplate: z.string().min(5).max(500).optional(),
});

router.post(
  '/settings/new-order-sms/test',
  permSettings,
  validate(newOrderSmsTestSchema),
  asyncHandler(async (req, res) => {
    const result = await settingsService.sendNewOrderSmsTest(req.body);
    const message = result.stub
      ? 'پیامک تست در حالت توسعه شبیه‌سازی شد (FarazSMS پیکربندی نشده)'
      : 'پیامک تست ارسال شد';
    successResponse(res, result, message);
  })
);

const announcementSchema = z.object({
  text: z.string().max(180),
});

router.get(
  '/settings/announcement',
  permSettings,
  asyncHandler(async (_req, res) => {
    successResponse(res, await settingsService.getAnnouncement());
  })
);

router.put(
  '/settings/announcement',
  permSettings,
  validate(announcementSchema),
  asyncHandler(async (req, res) => {
    const settings = await settingsService.updateAnnouncement(req.body.text ?? '');
    successResponse(res, settings, 'متن بالای سایت ذخیره شد');
  })
);

const shippingSettingsSchema = z.object({
  nationwideFee: z.coerce.number().int().min(0).max(10_000_000),
  nationwideHint: z.string().trim().min(2).max(200),
  cartHoldMinutes: z.coerce.number().int().min(5).max(24 * 60),
});

router.get(
  '/settings/shipping',
  permSettings,
  asyncHandler(async (_req, res) => {
    successResponse(res, await settingsService.getShipping());
  })
);

router.put(
  '/settings/shipping',
  permSettings,
  validate(shippingSettingsSchema),
  asyncHandler(async (req, res) => {
    const settings = await settingsService.updateShipping(req.body);
    successResponse(res, settings, 'تنظیمات ارسال ذخیره شد');
  })
);

const maintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().min(2).max(280).optional(),
});

router.get(
  '/settings/maintenance',
  permSettings,
  asyncHandler(async (_req, res) => {
    const settings = await settingsService.getMaintenance();
    successResponse(res, settings);
  })
);

router.put(
  '/settings/maintenance',
  permSettings,
  validate(maintenanceSchema),
  asyncHandler(async (req, res) => {
    const settings = await settingsService.updateMaintenance(req.body);
    successResponse(
      res,
      settings,
      settings.enabled ? 'حالت تعمیر فروشگاه روشن شد' : 'فروشگاه دوباره باز شد'
    );
  })
);

/** Full database dump (gzip). Main ADMIN only. */
router.get(
  '/backup/database',
  adminOnly,
  asyncHandler(async (_req, res) => {
    try {
      await backupService.streamDatabaseBackup(res);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, error instanceof Error ? error.message : 'خطا در بکاپ دیتابیس');
    }
  })
);

router.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const result = await reviewService.adminList(page);
    successResponse(res, result);
  })
);

router.delete(
  '/reviews/:id',
  asyncHandler(async (req, res) => {
    await reviewService.adminRemove(paramId(req.params.id));
    successResponse(res, null, 'نظر حذف شد');
  })
);

export default router;
