// index.js - DEBUG VERSION FOR RENDER
// This version logs EVERYTHING to help us find the crash

const fs = require('fs');
const path = require('path');

// ========== EARLY DEBUG LOGS ==========
console.log('[DEBUG] index.js started');
console.log('[DEBUG] Node version:', process.version);
console.log('[DEBUG] CWD:', process.cwd());
console.log('[DEBUG] Env:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  RENDER: !!process.env.RENDER,
  RAILWAY: !!process.env.RAILWAY,
  HAS_DATABASE_URL: !!process.env.DATABASE_URL
});

// ========== CHECK FILES EXIST ==========
const requiredFiles = [
  './utils/jsonDB.js',
  './config/auth.js',
  './routes/index.js'
];

for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`[DEBUG] File check ${file}:`, exists ? '✅' : '❌ MISSING');
  if (!exists) {
    console.error(`[FATAL] Required file missing: ${file}`);
    // Don't exit - let's see what else fails
  }
}

// ========== SAFE REQUIRE WITH CATCH ==========
function safeRequire(modulePath, name) {
  try {
    console.log(`[DEBUG] Requiring: ${name}`);
    const mod = require(modulePath);
    console.log(`[DEBUG] ✓ Loaded: ${name}`);
    return mod;
  } catch (err) {
    console.error(`[ERROR] Failed to load ${name}:`, err.message);
    console.error('[ERROR] Stack:', err.stack?.split('\n')[1]?.trim());
    return null;
  }
}

// ========== LOAD DEPENDENCIES ==========
const express = safeRequire('express', 'express');if (!express) {
  console.error('[FATAL] Express failed to load - cannot continue');
  process.exit(1);
}

const session = safeRequire('express-session', 'express-session');
const helmet = safeRequire('helmet', 'helmet');
const cors = safeRequire('cors', 'cors');
const morgan = safeRequire('morgan', 'morgan');
const compression = safeRequire('compression', 'compression');
const rateLimit = safeRequire('express-rate-limit', 'express-rate-limit');

// Load dotenv
try {
  require('dotenv').config();
  console.log('[DEBUG] ✓ dotenv loaded');
} catch (err) {
  console.warn('[WARN] dotenv failed:', err.message);
}

// ========== LOAD OUR MODULES ==========
const JSONDB = safeRequire('./utils/jsonDB', 'JSONDB');
const Auth = safeRequire('./config/auth', 'Auth');
const PluginLoader = safeRequire('./config/pluginLoader', 'PluginLoader');

// Routes
const indexRoutes = safeRequire('./routes/index', 'routes/index');
const authRoutes = safeRequire('./routes/auth', 'routes/auth');
const adminRoutes = safeRequire('./routes/admin', 'routes/admin');
const pluginsRoutes = safeRequire('./routes/plugins', 'routes/plugins');

// ========== CREATE APP ==========
console.log('[DEBUG] Creating Express app...');
const app = express();

// ========== PORT CONFIG (CRITICAL) ==========
const PORT = parseInt(process.env.PORT) || 10000;
const HOST = '0.0.0.0'; // Render requires this

console.log(`[DEBUG] Server config: HOST=${HOST}, PORT=${PORT}`);

// ========== MIDDLEWARE ==========
console.log('[DEBUG] Setting up middleware...');

try {
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(morgan('combined'));
  app.use(compression());
    const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(limiter);
  
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  console.log('[DEBUG] ✓ Middleware setup complete');
} catch (err) {
  console.error('[ERROR] Middleware setup failed:', err.message);
}

// ========== SESSION (MemoryStore only for now) ==========
console.log('[DEBUG] Setting up session...');
try {
  const sessionStore = new session.MemoryStore();
  
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'shadowhub-dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // Disable for Render free tier
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      httpOnly: true
    }
  }));
  console.log('[DEBUG] ✓ Session setup complete');
} catch (err) {
  console.error('[ERROR] Session setup failed:', err.message);
}

// ========== VIEW ENGINE ==========
console.log('[DEBUG] Setting up EJS...');
try {
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  console.log('[DEBUG] ✓ EJS setup complete');
} catch (err) {
  console.error('[ERROR] EJS setup failed:', err.message);
}

// ========== STATIC FILES ==========console.log('[DEBUG] Setting up static files...');
try {
  app.use(express.static(path.join(__dirname, 'public')));
  console.log('[DEBUG] ✓ Static files setup complete');
} catch (err) {
  console.error('[ERROR] Static files setup failed:', err.message);
}

// ========== MAKE DB/AUTH AVAILABLE ==========
if (JSONDB && Auth) {
  try {
    const db = new JSONDB('main.json', { users: [], plugins: [] });
    const auth = new Auth(db);
    
    app.use((req, res, next) => {
      req.db = db;
      req.auth = auth;
      auth.middleware()(req, res, next);
    });
    console.log('[DEBUG] ✓ DB/Auth middleware attached');
  } catch (err) {
    console.error('[ERROR] DB/Auth setup failed:', err.message);
  }
}

// ========== ROUTES ==========
console.log('[DEBUG] Mounting routes...');
try {
  if (indexRoutes) app.use('/', indexRoutes);
  if (authRoutes) app.use('/auth', authRoutes);
  if (adminRoutes) app.use('/admin', adminRoutes);
  if (pluginsRoutes) app.use('/plugins', pluginsRoutes);
  console.log('[DEBUG] ✓ Routes mounted');
} catch (err) {
  console.error('[ERROR] Route mounting failed:', err.message);
}

// ========== HEALTH CHECK (Critical for Render) ==========
app.get('/health', (req, res) => {
  console.log('[DEBUG] /health endpoint hit');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT,
    host: HOST,
    memory: process.memoryUsage().heapUsed / 1024 / 1024 + ' MB',
    env: process.env.NODE_ENV
  });
});
// ========== CATCH-ALL 404 ==========
app.use((req, res) => {
  console.log(`[DEBUG] 404: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
  console.error('[ERROR] Express error handler:', err.message);
  console.error('[ERROR] Stack:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ========== PRE-START CHECKS ==========
console.log('[DEBUG] Pre-start checks...');
console.log('[DEBUG] - Routes registered:', app._router?.stack?.length || 'unknown');
console.log('[DEBUG] - Views path:', app.get('views'));
console.log('[DEBUG] - View engine:', app.get('view engine'));

// ========== START SERVER ==========
console.log(`[DEBUG] Attempting to listen on ${HOST}:${PORT}...`);

let server;
try {
  server = app.listen(PORT, HOST, () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║     🌑 SHADOWHUB STARTED 🌑           ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ 📍 Listening on ${HOST}:${PORT}          ║`);
    console.log(`║ ⚡ Environment: ${process.env.NODE_ENV || 'production'} ║`);
    console.log('║ ✅ SERVER IS RUNNING ✅                ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`[DEBUG] Server callback fired - truly listening`);
    
    // Force a log flush
    console.log('[DEBUG] If you see this, the server is alive!');
  });
  
  console.log('[DEBUG] app.listen() called, waiting for callback...');
  
  // Timeout to detect if callback never fires
  setTimeout(() => {
    console.log('[DEBUG] ⚠️  10 second timeout - if no "listening" message above, server failed to bind');
  }, 10000);
  
} catch (err) {
  console.error('[FATAL] app.listen() threw error:', err.message);
  console.error('[FATAL] Stack:', err.stack);
  process.exit(1);}

// ========== SERVER ERROR HANDLER ==========
if (server) {
  server.on('error', (err) => {
    console.error('[SERVER ERROR]', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`[SERVER ERROR] Port ${PORT} is already in use`);
    }
    // Don't exit - let Render detect the failure
  });
  
  server.on('listening', () => {
    console.log('[DEBUG] Server "listening" event fired');
  });
}

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGTERM', () => {
  console.log('[DEBUG] SIGTERM received');
  if (server) {
    server.close(() => {
      console.log('[DEBUG] Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// ========== CATCH UNHANDLED ERRORS (Don't exit!) ==========
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
  // Log but don't exit - keep server running
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  // Only exit on truly fatal errors
  if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('express')) {
    process.exit(1);
  }
  // Otherwise, log and continue
});

console.log('[DEBUG] index.js finished executing - server should be starting');

// Export for testing
module.exports = app;
