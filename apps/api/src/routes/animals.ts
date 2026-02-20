import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { instructorOnly, anyRole } from '../middleware/roles';
import { validate, validateQuery, validateParams } from '../middleware/validate';
import { uploadImage } from '../middleware/upload';
import { uploadBufferToS3, buildThumbnailS3Key } from '../services/storage';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── Validation Schemas ──────────────────────────────────────

const listAnimalsQuery = z.object({
  categoryId: z.string().optional(),
  modelType: z.enum(['svg', 'three_js', 'photographic']).optional(),
  search: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});

const animalIdParams = z.object({
  id: z.string().min(1, 'Animal ID is required'),
});

const createAnimalSchema = z.object({
  commonName: z.string().min(1, 'Common name is required').max(255),
  scientificName: z.string().max(255).optional(),
  categoryId: z.string().uuid('Invalid category ID'),
  description: z.string().max(2000).optional(),
  modelType: z.enum(['svg', 'three_js', 'photographic']),
});

const updateAnimalSchema = z.object({
  commonName: z.string().min(1).max(255).optional(),
  scientificName: z.string().max(255).nullable().optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().max(2000).nullable().optional(),
  modelType: z.enum(['svg', 'three_js', 'photographic']).optional(),
  isActive: z.boolean().optional(),
});

// ─── GET /animals ────────────────────────────────────────────
/**
 * List all animals with optional filtering.
 * Query params: ?categoryId=uuid&modelType=svg&search=cat&active=true
 */
router.get(
  '/',
  authenticate,
  anyRole,
  validateQuery(listAnimalsQuery),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { categoryId, modelType, search, active } = req.query as z.infer<typeof listAnimalsQuery>;

      const where: any = {};

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (modelType) {
        where.modelType = modelType;
      }

      if (search) {
        where.OR = [
          { commonName: { contains: search, mode: 'insensitive' } },
          { scientificName: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (active !== undefined) {
        where.isActive = active === 'true';
      } else {
        where.isActive = true;
      }

      const animals = await prisma.animal.findMany({
        where,
        include: {
          category: true,
          models: {
            where: { isPublished: true },
            select: {
              id: true,
              organSystem: true,
              version: true,
              thumbnailUrl: true,
              layerOrder: true,
            },
            orderBy: { layerOrder: 'asc' },
          },
          _count: {
            select: { labs: true },
          },
        },
        orderBy: { commonName: 'asc' },
      });

      res.json({
        animals,
        total: animals.length,
      });
    } catch (error: any) {
      console.error('[Animals] List error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── GET /animals/:id ────────────────────────────────────────
/**
 * Get a single animal with all its dissection models.
 */
router.get(
  '/:id',
  authenticate,
  anyRole,
  validateParams(animalIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const animal = await prisma.animal.findUnique({
        where: { id: req.params.id },
        include: {
          category: true,
          models: {
            orderBy: { layerOrder: 'asc' },
            include: {
              _count: {
                select: { structures: true },
              },
            },
          },
        },
      });

      if (!animal) {
        res.status(404).json({
          error: 'Not Found',
          message: `Animal with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      res.json(animal);
    } catch (error: any) {
      console.error('[Animals] Get error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── GET /animals/:id/structures ─────────────────────────────
/**
 * Get all anatomical structures for an animal across all its models.
 * Optionally filter by organ system.
 */
router.get(
  '/:id/structures',
  authenticate,
  anyRole,
  validateParams(animalIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const animal = await prisma.animal.findUnique({
        where: { id: req.params.id },
        select: { id: true, commonName: true },
      });

      if (!animal) {
        res.status(404).json({
          error: 'Not Found',
          message: `Animal with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      const organSystem = req.query.organSystem as string | undefined;

      const modelWhere: any = { animalId: req.params.id };
      if (organSystem) {
        modelWhere.organSystem = organSystem;
      }

      const structures = await prisma.anatomicalStructure.findMany({
        where: {
          model: modelWhere,
        },
        include: {
          model: {
            select: {
              id: true,
              organSystem: true,
              version: true,
            },
          },
        },
        orderBy: [
          { model: { organSystem: 'asc' } },
          { name: 'asc' },
        ],
      });

      res.json({
        animalId: animal.id,
        animalName: animal.commonName,
        structures,
        total: structures.length,
      });
    } catch (error: any) {
      console.error('[Animals] Structures error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /animals ───────────────────────────────────────────
/**
 * Create a new animal. Instructor/admin only.
 */
router.post(
  '/',
  authenticate,
  instructorOnly,
  validate(createAnimalSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { commonName, scientificName, categoryId, description, modelType } = req.body;

      // Verify category exists
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Category with ID ${categoryId} does not exist.`,
        });
        return;
      }

      const animal = await prisma.animal.create({
        data: { commonName, scientificName, categoryId, description, modelType },
        include: { category: true },
      });

      res.status(201).json(animal);
    } catch (error: any) {
      console.error('[Animals] Create error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── PUT /animals/:id ────────────────────────────────────────
/**
 * Update an animal. Instructor/admin only.
 */
router.put(
  '/:id',
  authenticate,
  instructorOnly,
  validateParams(animalIdParams),
  validate(updateAnimalSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await prisma.animal.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        res.status(404).json({
          error: 'Not Found',
          message: `Animal with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      // If categoryId is changing, verify new category exists
      if (req.body.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: req.body.categoryId },
        });
        if (!category) {
          res.status(400).json({
            error: 'Validation Error',
            message: `Category with ID ${req.body.categoryId} does not exist.`,
          });
          return;
        }
      }

      const animal = await prisma.animal.update({
        where: { id: req.params.id },
        data: req.body,
        include: { category: true },
      });

      res.json(animal);
    } catch (error: any) {
      console.error('[Animals] Update error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── DELETE /animals/:id ─────────────────────────────────────
/**
 * Soft-delete (deactivate) an animal. Instructor/admin only.
 */
router.delete(
  '/:id',
  authenticate,
  instructorOnly,
  validateParams(animalIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const animal = await prisma.animal.findUnique({
        where: { id: req.params.id },
      });

      if (!animal) {
        res.status(404).json({
          error: 'Not Found',
          message: `Animal with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      await prisma.animal.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });

      res.json({ message: `"${animal.commonName}" has been deactivated.` });
    } catch (error: any) {
      console.error('[Animals] Delete error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /animals/:id/thumbnail ─────────────────────────────
/**
 * Upload a thumbnail image for an animal. Instructor/admin only.
 */
router.post(
  '/:id/thumbnail',
  authenticate,
  instructorOnly,
  validateParams(animalIdParams),
  uploadImage.single('thumbnail'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }

      const animal = await prisma.animal.findUnique({
        where: { id: req.params.id },
      });

      if (!animal) {
        res.status(404).json({
          error: 'Not Found',
          message: `Animal with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      const ext = req.file.originalname.split('.').pop() || 'png';
      const key = buildThumbnailS3Key('animal', req.params.id, ext);
      const url = await uploadBufferToS3(req.file.buffer, key, req.file.mimetype);

      const updated = await prisma.animal.update({
        where: { id: req.params.id },
        data: { thumbnailUrl: url },
        include: { category: true },
      });

      res.json(updated);
    } catch (error: any) {
      console.error('[Animals] Thumbnail upload error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
