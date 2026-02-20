import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { instructorOnly, anyRole } from '../middleware/roles';
import { validate, validateParams } from '../middleware/validate';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── Validation Schemas ──────────────────────────────────────

const categoryIdParams = z.object({
  id: z.string().min(1, 'Category ID is required'),
});

const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50)
    .transform((s) => s.toLowerCase().trim()),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color (e.g. #1B4F72)'),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
});

const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .transform((s) => s.toLowerCase().trim())
    .optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ─── GET /categories ─────────────────────────────────────────
/**
 * List all categories sorted by sortOrder.
 */
router.get(
  '/',
  authenticate,
  anyRole,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: { select: { animals: true } },
        },
      });

      res.json({ categories, total: categories.length });
    } catch (error: any) {
      console.error('[Categories] List error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /categories ────────────────────────────────────────
/**
 * Create a new category. Instructor/admin only.
 */
router.post(
  '/',
  authenticate,
  instructorOnly,
  validate(createCategorySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, color, icon, sortOrder } = req.body;

      // Check for duplicate name
      const existing = await prisma.category.findUnique({ where: { name } });
      if (existing) {
        res.status(409).json({
          error: 'Conflict',
          message: `Category "${name}" already exists.`,
        });
        return;
      }

      const category = await prisma.category.create({
        data: { name, color, icon, sortOrder },
      });

      res.status(201).json(category);
    } catch (error: any) {
      console.error('[Categories] Create error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── PUT /categories/:id ─────────────────────────────────────
/**
 * Update a category. Instructor/admin only.
 */
router.put(
  '/:id',
  authenticate,
  instructorOnly,
  validateParams(categoryIdParams),
  validate(updateCategorySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await prisma.category.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        res.status(404).json({
          error: 'Not Found',
          message: `Category with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      // If name is changing, check for duplicates
      if (req.body.name && req.body.name !== existing.name) {
        const duplicate = await prisma.category.findUnique({
          where: { name: req.body.name },
        });
        if (duplicate) {
          res.status(409).json({
            error: 'Conflict',
            message: `Category "${req.body.name}" already exists.`,
          });
          return;
        }
      }

      const category = await prisma.category.update({
        where: { id: req.params.id },
        data: req.body,
      });

      res.json(category);
    } catch (error: any) {
      console.error('[Categories] Update error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── DELETE /categories/:id ──────────────────────────────────
/**
 * Delete a category. Fails with 409 if animals still reference it.
 */
router.delete(
  '/:id',
  authenticate,
  instructorOnly,
  validateParams(categoryIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const category = await prisma.category.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { animals: true } } },
      });

      if (!category) {
        res.status(404).json({
          error: 'Not Found',
          message: `Category with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      if (category._count.animals > 0) {
        res.status(409).json({
          error: 'Conflict',
          message: `Cannot delete category "${category.name}" — ${category._count.animals} animal(s) still use it. Reassign them first.`,
        });
        return;
      }

      await prisma.category.delete({ where: { id: req.params.id } });
      res.json({ message: `Category "${category.name}" deleted.` });
    } catch (error: any) {
      console.error('[Categories] Delete error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
