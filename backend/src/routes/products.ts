import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import {
  archivedFilter,
  listQuerySchema,
  listResponse,
  orderBy,
  paginate,
  serialize,
} from '../lib/http';
import { asyncHandler } from '../middleware/error';
import { requireAdmin, requireAuth, requireBackOffice } from '../middleware/auth';
import { productCategorySchema, productSchema } from '../validation/masters';

export const productsRouter = Router();
export const productCategoriesRouter = Router();

productsRouter.use(requireAuth, requireBackOffice);
productCategoriesRouter.use(requireAuth, requireBackOffice);

const SELECT = {
  id: true,
  name: true,
  type: true,
  categoryId: true,
  category: { select: { id: true, name: true } },
  salesPrice: true,
  cost: true,
  imageUrl: true,
  isArchived: true,
} as const;

// ------------------------------------------------------------------ categories

productCategoriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const where = {
      ...archivedFilter(query),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.productCategory.findMany({ where, orderBy: { name: 'asc' }, ...paginate(query) }),
      prisma.productCategory.count({ where }),
    ]);
    res.json(listResponse(items, total, query));
  }),
);

productCategoriesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = productCategorySchema.parse(req.body);
    const category = await prisma.productCategory.upsert({
      where: { name: input.name },
      create: { name: input.name },
      update: {},
    });
    res.status(201).json(serialize(category));
  }),
);

// -------------------------------------------------------------------- products

/** Resolve the category picker, which may also carry a brand new name. */
async function resolveCategoryId(input: {
  categoryId?: number | null;
  categoryName?: string | null;
}): Promise<number | null> {
  if (input.categoryId) return input.categoryId;
  if (!input.categoryName) return null;
  const category = await prisma.productCategory.upsert({
    where: { name: input.categoryName },
    create: { name: input.categoryName },
    update: {},
  });
  return category.id;
}

productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const where = {
      ...archivedFilter(query),
      ...(query.status ? { type: query.status as 'GOODS' | 'SERVICE' | 'COMBO' } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { category: { name: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: SELECT,
        orderBy: orderBy(query, ['name', 'salesPrice', 'cost', 'type', 'createdAt'], 'name'),
        ...paginate(query),
      }),
      prisma.product.count({ where }),
    ]);

    res.json(listResponse(items, total, query));
  }),
);

productsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      select: SELECT,
    });
    if (!product) throw notFound('Product not found');
    res.json(serialize(product));
  }),
);

productsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = productSchema.parse(req.body);
    const product = await prisma.product.create({
      data: {
        name: input.name,
        type: input.type,
        categoryId: await resolveCategoryId(input),
        salesPrice: input.salesPrice,
        cost: input.cost,
        imageUrl: input.imageUrl ?? null,
      },
      select: SELECT,
    });
    res.status(201).json(serialize(product));
  }),
);

productsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = productSchema.parse(req.body);
    const product = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: {
        name: input.name,
        type: input.type,
        categoryId: await resolveCategoryId(input),
        salesPrice: input.salesPrice,
        cost: input.cost,
        imageUrl: input.imageUrl ?? null,
      },
      select: SELECT,
    });
    res.json(serialize(product));
  }),
);

productsRouter.post(
  '/:id/archive',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const product = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: true },
      select: SELECT,
    });
    res.json(serialize(product));
  }),
);

productsRouter.post(
  '/:id/restore',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const product = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: false },
      select: SELECT,
    });
    res.json(serialize(product));
  }),
);
