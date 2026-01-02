import express from 'express';
import cors from 'cors';
import {
  initDb,
  createEmail,
  getAllEmails,
  getEmailWithOpens,
  recordOpen,
  getStats,
} from './db';

const PORT = 8080;

// For production/ngrok, set PUBLIC_URL environment variable
// Example: PUBLIC_URL=https://abc123.ngrok-free.app
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

const app = express();

// Middleware - Explicit CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://mail.google.com', 'chrome-extension://*'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Handle preflight requests explicitly
app.options('*', cors());

app.use(express.json());

// ============================================
// Health Check
// ============================================
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// ============================================
// Tracking Pixel Endpoint (THE MAGIC!)
// ============================================

// 1x1 transparent PNG (smallest possible valid PNG)
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

app.get('/track/:id.png', (req, res) => {
  const { id } = req.params;
  
  // Extract tracking metadata
  const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;

  // Record the open (async-ish, we don't wait for it)
  const open = recordOpen({
    emailId: id,
    ipAddress: ipAddress || undefined,
    userAgent: userAgent || undefined,
  });

  if (open) {
    console.log(`[track] Email ${id} opened from ${ipAddress} using ${userAgent?.substring(0, 50)}...`);
  } else {
    console.log(`[track] Unknown email ID: ${id}`);
  }

  // Always return the pixel (even if email ID doesn't exist)
  // This prevents leaking info about valid IDs
  res.set({
    'Content-Type': 'image/png',
    'Content-Length': TRANSPARENT_PNG.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  
  res.send(TRANSPARENT_PNG);
});

// ============================================
// Email API Endpoints
// ============================================

/**
 * POST /api/emails
 * Create a new tracked email
 * Body: { recipient: string, subject?: string, sender?: string }
 */
app.post('/api/emails', (req, res) => {
  try {
    const { recipient, subject, sender } = req.body;

    if (!recipient) {
      return res.status(400).json({ error: 'recipient is required' });
    }

    const email = createEmail({ recipient, subject, sender });
    
    // Return the email with the tracking pixel URL
    res.status(201).json({
      ...email,
      tracking_url: `${PUBLIC_URL}/track/${email.id}.png`,
      tracking_html: `<img src="${PUBLIC_URL}/track/${email.id}.png" width="1" height="1" style="display:none" alt="">`,
    });
  } catch (error) {
    console.error('[api] Error creating email:', error);
    res.status(500).json({ error: 'Failed to create email' });
  }
});

/**
 * GET /api/emails
 * List all tracked emails with open counts
 */
app.get('/api/emails', (_req, res) => {
  try {
    const emails = getAllEmails();
    res.json(emails);
  } catch (error) {
    console.error('[api] Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

/**
 * GET /api/emails/:id
 * Get a single email with all its opens
 */
app.get('/api/emails/:id', (req, res) => {
  try {
    const { id } = req.params;
    const email = getEmailWithOpens(id);
    
    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(email);
  } catch (error) {
    console.error('[api] Error fetching email:', error);
    res.status(500).json({ error: 'Failed to fetch email' });
  }
});

/**
 * GET /api/stats
 * Get overview statistics
 */
app.get('/api/stats', (_req, res) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (error) {
    console.error('[api] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============================================
// Initialize and Start
// ============================================
initDb();

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
  console.log(`[server] Endpoints:`);
  console.log(`         GET  /health         - Health check`);
  console.log(`         GET  /track/:id.png  - Tracking pixel`);
  console.log(`         POST /api/emails     - Create tracked email`);
  console.log(`         GET  /api/emails     - List all emails`);
  console.log(`         GET  /api/emails/:id - Get email details`);
  console.log(`         GET  /api/stats      - Get statistics`);
});
