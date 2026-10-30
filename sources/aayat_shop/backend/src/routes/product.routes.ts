import { Router } from 'express';
import { z } from 'zod';
import { productService } from '../services/product.service';
import { reviewService } from '../services/review.service';
import { asyncHandler, successResponse, validate } from '../utils/errors';
import { authenticate } from '../middleware/auth';
import { paramId } from '../utils/params';

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(500).optional().default(''),
});

const router = Router();

router.get(
  '/home',
  asyncHandler(async (_req, res) => {
    const sections = await productService.getHomeSections();
    successResponse(res, sections);
  })
);

router.get(
  '/home-feed',
  asyncHandler(async (_req, res) => {
    const feed = await productService.getHomeFeed();
    successResponse(res, feed);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      categoryId,
      category,
      tagId,
      ids,
      search,
      featured,
      discounted,
      homeDeal,
      homeFeatured,
      isNew,
      inStock,
      listing,
      sort,
      page,
      limit,
    } = req.query;

    const idList = typeof ids === 'string'
      ? ids.split(',').map((id) => id.trim()).filter(Boolean)
      : undefined;

    const parsedLimit = limit ? parseInt(limit as string) : idList?.length || 20;
    const result = await productService.getAll({
      categoryId: categoryId as string,
      categorySlug: category as string,
      tagId: (tagId as string) || (req.query.tag as string),
      ids: idList,
      search: search as string,
      featured: featured === 'true',
      discounted: discounted === 'true',
      homeDeal: homeDeal === 'true',
      homeFeatured: homeFeatured === 'true',
      isNew: isNew === 'true',
      inStock: inStock === 'true' || inStock === '1',
      listing: listing === 'discount' || listing === 'new' || listing === 'other' ? listing : undefined,
      sort: sort as string,
      page: page ? parseInt(page as string) : 1,
      limit: Math.min(parsedLimit, idList?.length ? 100 : 50),
    });
    successResponse(res, result);
  })
);

router.get(
  '/:slug/related',
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;
    const related = await productService.getRelatedByTag(paramId(req.params.slug), limit);
    successResponse(res, related);
  })
);

router.get(
  '/:slug/reviews',
  asyncHandler(async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const result = await reviewService.list(paramId(req.params.slug), page);
    successResponse(res, result);
  })
);

router.get(
  '/:slug/reviews/mine',
  authenticate,
  asyncHandler(async (req, res) => {
    const review = await reviewService.mine(paramId(req.params.slug), req.user!.userId);
    successResponse(res, review);
  })
);

router.post(
  '/:slug/reviews',
  authenticate,
  validate(reviewSchema),
  asyncHandler(async (req, res) => {
    const result = await reviewService.save(
      paramId(req.params.slug),
      req.user!.userId,
      req.body.rating,
      req.body.body,
    );
    successResponse(res, result, 'نظر شما ثبت شد');
  })
);

router.delete(
  '/:slug/reviews/mine',
  authenticate,
  asyncHandler(async (req, res) => {
    const summary = await reviewService.removeMine(paramId(req.params.slug), req.user!.userId);
    successResponse(res, summary, 'نظر حذف شد');
  })
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const product = await productService.getBySlug(paramId(req.params.slug));
    successResponse(res, product);
  })
);

export default router;
