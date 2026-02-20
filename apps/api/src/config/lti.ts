import { Express } from 'express';

// ltijs exports { Provider } — Provider is the main interface
const { Provider: lti } = require('ltijs');

/** Track whether LTI was successfully initialized */
let ltiInitialized = false;

/**
 * Initialize LTI 1.3 Provider via ltijs.
 *
 * ltijs manages its own internal database for LTI state (nonces, tokens, platform keys).
 * We run it in serverless mode and mount it onto our Express app.
 *
 * Initialization order per ltijs docs:
 *   1. setup()            — configure encryption key + DB connection + options
 *   2. deploy()           — initialize the internal DB and create routes
 *   3. registerPlatform() — register Canvas (must come AFTER deploy)
 *   4. onConnect()        — register launch handler
 *
 * Must be called BEFORE app.listen() so the LTI routes are registered.
 */
export async function initializeLTI(app: Express): Promise<void> {
  const canvasUrl = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';

  // 1. Provider Setup — configure encryption key and database
  lti.setup(
    process.env.LTI_KEY_ID || 'anatoview-dev-key',
    {
      // ltijs uses MongoDB internally for LTI state management.
      // In dev mode, it creates an in-memory store when no URL is provided.
      // For production, provide a MongoDB connection string in LTI_DB_URL.
      url: process.env.LTI_DB_URL || 'mongodb://localhost:27017/ltijs',
    },
    {
      cookies: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      },
      devMode: process.env.NODE_ENV !== 'production',
      ltiaas: false,
    }
  );

  // 2. Deploy in serverless mode — creates internal DB and route handlers
  await lti.deploy({ serverless: true });

  // 3. Register Canvas as an LTI Platform (MUST come after deploy)
  await lti.registerPlatform({
    url: canvasUrl,
    name: 'University Canvas',
    clientId: process.env.LTI_CLIENT_ID || 'your_canvas_client_id',
    authenticationEndpoint: `${canvasUrl}/api/lti/authorize_redirect`,
    accesstokenEndpoint: `${canvasUrl}/login/oauth2/token`,
    authConfig: {
      method: 'JWK_SET',
      key: `${canvasUrl}/api/lti/security/jwks`,
    },
  });

  // Mount the ltijs Express app onto our main app
  // This adds routes at /lti/login, /lti/launch, /lti/jwks, etc.
  app.use('/lti', lti.app);

  ltiInitialized = true;

  console.log(`[LTI] Provider deployed — platform: ${canvasUrl}`);
  console.log('[LTI] Routes: /lti/login, /lti/launch, /lti/jwks, /lti/deep-link');
}

/**
 * Check if LTI was successfully initialized.
 */
export function isLtiInitialized(): boolean {
  return ltiInitialized;
}

/**
 * Export the ltijs provider so routes/services can access it.
 */
export { lti };
