import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import categoriesRoutes from './routes/categories';
import animalsRoutes from './routes/animals';
import modelsRoutes from './routes/models';
import labsRoutes from './routes/labs';
import attemptsRoutes from './routes/attempts';
import gradesRoutes from './routes/grades';

const app = express();

// ─── Global Middleware ──────────────────────────────────────────

// Security headers (relaxed in dev so Canvas iframes and LTI redirects work)
app.use(
  helmet({
    // Allow embedding in Canvas iframes
    contentSecurityPolicy: process.env.NODE_ENV === 'production'
      ? undefined  // use helmet defaults in prod
      : false,     // disabled in dev for easier LTI testing
    // Canvas LTI launches require cross-origin framing
    crossOriginEmbedderPolicy: false,
  })
);

// CORS — allow the frontend origin and Canvas
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost',
      process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ───────────────────────────────────────────────
// Required for Docker healthcheck — must respond before any auth middleware
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'anatoview-api',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
  });
});

// ─── API Routes ─────────────────────────────────────────────────

// nginx strips /api/ prefix — so /api/auth/me arrives here as /auth/me
app.use('/auth', authRoutes);
app.use('/categories', categoriesRoutes);
app.use('/animals', animalsRoutes);
app.use('/models', modelsRoutes);
app.use('/labs', labsRoutes);
// Attempts routes handle both /labs/:id/attempt/* and /attempts/:id/*
app.use('/', attemptsRoutes);
app.use('/grades', gradesRoutes);

// ─── Root Route ─────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    service: 'AnatoView API',
    version: process.env.npm_package_version || '0.1.0',
    docs: 'See FRAMEWORK.md Section 6 for the full route map.',
  });
});

// ─── 404 Handler ────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist.',
  });
});

// ─── Global Error Handler ───────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API] Unhandled error:', err.message);

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong.',
  });
});

export { app };
