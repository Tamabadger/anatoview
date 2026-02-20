import multer from 'multer';
import path from 'path';

/**
 * Multer upload middleware using memory storage.
 * Files are stored in-memory as Buffer and uploaded to S3 by route handlers.
 */

const storage = multer.memoryStorage();

// ─── File Filters ────────────────────────────────────────────

const svgFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.svg' || file.mimetype === 'image/svg+xml') {
    cb(null, true);
  } else {
    cb(new Error('Only SVG files are allowed.'));
  }
};

const imageFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (SVG, PNG, JPEG, WebP) are allowed.'));
  }
};

// ─── Configured Multer Instances ─────────────────────────────

/** SVG model upload — 10 MB max */
export const uploadSvg = multer({
  storage,
  fileFilter: svgFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/** Thumbnail / image upload — 5 MB max */
export const uploadImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
