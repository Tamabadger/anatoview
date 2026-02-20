import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { instructorOnly } from '../middleware/roles';
import { validate, validateParams } from '../middleware/validate';
import { uploadSvg } from '../middleware/upload';
import { uploadBufferToS3, buildModelS3Key } from '../services/storage';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ─── Validation Schemas ──────────────────────────────────────

const modelIdParams = z.object({
  id: z.string().min(1, 'Model ID is required'),
});

const modelStructureParams = z.object({
  id: z.string().min(1, 'Model ID is required'),
  sid: z.string().min(1, 'Structure ID is required'),
});

const createModelSchema = z.object({
  animalId: z.string().uuid('Invalid animal ID'),
  organSystem: z.string().min(1, 'Organ system is required').max(100),
  version: z.string().min(1).max(20).default('1.0.0'),
  layerOrder: z.number().int().min(0).optional().default(0),
});

const updateModelSchema = z.object({
  organSystem: z.string().min(1).max(100).optional(),
  version: z.string().min(1).max(20).optional(),
  layerOrder: z.number().int().min(0).optional(),
});

const createStructuresSchema = z.object({
  structures: z
    .array(
      z.object({
        name: z.string().min(1, 'Name is required').max(255),
        latinName: z.string().max(255).optional(),
        svgElementId: z.string().max(100).optional(),
        description: z.string().max(2000).optional(),
        funFact: z.string().max(1000).optional(),
        hint: z.string().max(500).optional(),
        difficultyLevel: z.enum(['easy', 'medium', 'hard']).default('medium'),
        coordinates: z.record(z.number()).optional(),
        tags: z.array(z.string()).optional().default([]),
      }),
    )
    .min(1, 'At least one structure is required'),
});

const updateStructureSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  latinName: z.string().max(255).nullable().optional(),
  svgElementId: z.string().max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  funFact: z.string().max(1000).nullable().optional(),
  hint: z.string().max(500).nullable().optional(),
  difficultyLevel: z.enum(['easy', 'medium', 'hard']).optional(),
  coordinates: z.record(z.number()).nullable().optional(),
  tags: z.array(z.string()).optional(),
});

// ─── POST /models ────────────────────────────────────────────
/**
 * Create a new dissection model record. Instructor/admin only.
 * The SVG file is uploaded separately via POST /models/:id/upload.
 */
router.post(
  '/',
  authenticate,
  instructorOnly,
  validate(createModelSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { animalId, organSystem, version, layerOrder } = req.body;

      // Verify animal exists
      const animal = await prisma.animal.findUnique({ where: { id: animalId } });
      if (!animal) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Animal with ID ${animalId} does not exist.`,
        });
        return;
      }

      const model = await prisma.dissectionModel.create({
        data: {
          animalId,
          organSystem,
          version,
          layerOrder,
          modelFileUrl: '', // Placeholder until SVG is uploaded
          isPublished: false,
        },
        include: {
          animal: { select: { id: true, commonName: true } },
          _count: { select: { structures: true } },
        },
      });

      res.status(201).json(model);
    } catch (error: any) {
      console.error('[Models] Create error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /models/:id/upload ─────────────────────────────────
/**
 * Upload an SVG file for a model. Instructor/admin only.
 */
router.post(
  '/:id/upload',
  authenticate,
  instructorOnly,
  validateParams(modelIdParams),
  uploadSvg.single('model'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No SVG file uploaded.' });
        return;
      }

      const model = await prisma.dissectionModel.findUnique({
        where: { id: req.params.id },
        include: { animal: { select: { commonName: true } } },
      });

      if (!model) {
        res.status(404).json({
          error: 'Not Found',
          message: `Model with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      const key = buildModelS3Key(model.animal.commonName, model.organSystem, model.version);
      const url = await uploadBufferToS3(req.file.buffer, key, 'image/svg+xml');

      const updated = await prisma.dissectionModel.update({
        where: { id: req.params.id },
        data: { modelFileUrl: url },
      });

      res.json(updated);
    } catch (error: any) {
      console.error('[Models] Upload error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── PUT /models/:id ─────────────────────────────────────────
/**
 * Update model metadata. Instructor/admin only.
 */
router.put(
  '/:id',
  authenticate,
  instructorOnly,
  validateParams(modelIdParams),
  validate(updateModelSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await prisma.dissectionModel.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        res.status(404).json({
          error: 'Not Found',
          message: `Model with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      const model = await prisma.dissectionModel.update({
        where: { id: req.params.id },
        data: req.body,
      });

      res.json(model);
    } catch (error: any) {
      console.error('[Models] Update error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /models/:id/publish ────────────────────────────────
/**
 * Publish a model (make it available for labs). Instructor/admin only.
 */
router.post(
  '/:id/publish',
  authenticate,
  instructorOnly,
  validateParams(modelIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const model = await prisma.dissectionModel.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { structures: true } } },
      });

      if (!model) {
        res.status(404).json({
          error: 'Not Found',
          message: `Model with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      if (!model.modelFileUrl) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Upload an SVG file before publishing.',
        });
        return;
      }

      const updated = await prisma.dissectionModel.update({
        where: { id: req.params.id },
        data: { isPublished: true },
      });

      res.json(updated);
    } catch (error: any) {
      console.error('[Models] Publish error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── DELETE /models/:id ──────────────────────────────────────
/**
 * Delete a model. Only allowed if unpublished and no labs reference it.
 */
router.delete(
  '/:id',
  authenticate,
  instructorOnly,
  validateParams(modelIdParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const model = await prisma.dissectionModel.findUnique({
        where: { id: req.params.id },
      });

      if (!model) {
        res.status(404).json({
          error: 'Not Found',
          message: `Model with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      if (model.isPublished) {
        res.status(409).json({
          error: 'Conflict',
          message: 'Unpublish the model before deleting it.',
        });
        return;
      }

      // Cascade delete will remove structures
      await prisma.dissectionModel.delete({ where: { id: req.params.id } });
      res.json({ message: 'Model deleted.' });
    } catch (error: any) {
      console.error('[Models] Delete error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /models/:id/structures ─────────────────────────────
/**
 * Bulk create anatomical structures for a model. Instructor/admin only.
 */
router.post(
  '/:id/structures',
  authenticate,
  instructorOnly,
  validateParams(modelIdParams),
  validate(createStructuresSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const model = await prisma.dissectionModel.findUnique({
        where: { id: req.params.id },
      });

      if (!model) {
        res.status(404).json({
          error: 'Not Found',
          message: `Model with ID ${req.params.id} does not exist.`,
        });
        return;
      }

      const { structures } = req.body;

      const created = await prisma.$transaction(
        structures.map((s: any) =>
          prisma.anatomicalStructure.create({
            data: {
              modelId: req.params.id,
              name: s.name,
              latinName: s.latinName,
              svgElementId: s.svgElementId,
              description: s.description,
              funFact: s.funFact,
              hint: s.hint,
              difficultyLevel: s.difficultyLevel,
              coordinates: s.coordinates,
              tags: s.tags,
            },
          }),
        ),
      );

      res.status(201).json({ structures: created, total: created.length });
    } catch (error: any) {
      console.error('[Models] Create structures error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── PUT /models/:id/structures/:sid ─────────────────────────
/**
 * Update a single structure. Instructor/admin only.
 */
router.put(
  '/:id/structures/:sid',
  authenticate,
  instructorOnly,
  validateParams(modelStructureParams),
  validate(updateStructureSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const structure = await prisma.anatomicalStructure.findFirst({
        where: { id: req.params.sid, modelId: req.params.id },
      });

      if (!structure) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Structure not found in this model.',
        });
        return;
      }

      const updated = await prisma.anatomicalStructure.update({
        where: { id: req.params.sid },
        data: req.body,
      });

      res.json(updated);
    } catch (error: any) {
      console.error('[Models] Update structure error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── DELETE /models/:id/structures/:sid ──────────────────────
/**
 * Delete a single structure. Instructor/admin only.
 */
router.delete(
  '/:id/structures/:sid',
  authenticate,
  instructorOnly,
  validateParams(modelStructureParams),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const structure = await prisma.anatomicalStructure.findFirst({
        where: { id: req.params.sid, modelId: req.params.id },
      });

      if (!structure) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Structure not found in this model.',
        });
        return;
      }

      await prisma.anatomicalStructure.delete({ where: { id: req.params.sid } });
      res.json({ message: `Structure "${structure.name}" deleted.` });
    } catch (error: any) {
      console.error('[Models] Delete structure error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
