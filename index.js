const express = require('express');
const session = require('express-session');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ========== PORT BINDING (CRITICAL FOR RENDER) ==========
const PORT = parseInt(process.env.PORT) || 10000;
const HOST = '0.0.0.0'; // Render requires this, not 'localhost'

// ========== DATABASE (JSON-First, PG-Optional) ==========
const JSONDB = require('./utils/jsonDB');
const db = new JSONDB('main.json', { users: [], plugins: [] });

// ========== AUTH ==========
const Auth = require('./config/auth');
const auth = new Auth(db);

// ========== PLUGIN LOADER (Non-blocking) ==========
const PluginLoader = require('./config/pluginLoader');
let pluginLoader;

// ========== MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? undefined : true
}));
app.use(morgan('combined'));
app.use(compression());

// Rate limiting - more generous for free tier
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session - MemoryStore for free tier, PG for paid
let sessionStore;
if (process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
    try {
        const PostgreSQLStore = require('connect-pg-simple')(session);
        sessionStore = new PostgreSQLStore({
            conString: process.env.DATABASE_URL,
            createTableIfMissing: true,
            errorHandler: () => {} // Prevent crashes
        });
        console.log('[Session] Using PostgreSQL store');
    } catch (err) {
        console.warn('[Session] PG store failed, using MemoryStore');
        sessionStore = new session.MemoryStore();
    }
} else {
    sessionStore = new session.MemoryStore();
}

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'shadowhub-secret-change-me-now-please',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production' && !process.env.RENDER?.includes('localhost'),
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        httpOnly: true
    }
}));

// Auth middleware
app.use(auth.middleware());

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));

// Make db/auth available
app.use((req, res, next) => {
    req.db = db;
    req.auth = auth;    if (pluginLoader) req.pluginLoader = pluginLoader;
    next();
});

// ========== ROUTES ==========
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/plugins', require('./routes/plugins'));

// Health check (CRITICAL for Render)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        port: PORT,
        host: HOST,
        env: process.env.NODE_ENV,
        render: !!process.env.RENDER,
        railway: !!process.env.RAILWAY,
        plugins: pluginLoader?.getAllPlugins?.().length || 0
    });
});

// 404 handler
app.use((req, res) => {
    if (req.path.startsWith('/api') || req.xhr) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.status(404).render('error', {
        title: 'Not Found | ShadowHub',
        message: 'The page you are looking for does not exist.',
        backUrl: req.get('Referrer') || '/',
        ownerName: process.env.OWNER_NAME,
        ownerNumber: process.env.OWNER_NUMBER
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.stack);
    
    // Don't leak errors in production
    const message = process.env.NODE_ENV === 'development' 
        ? err.message 
        : 'Something went wrong';
    
    if (req.xhr || req.path.startsWith('/api')) {
        return res.status(500).json({ error: message });    }
    
    res.status(500).render('error', {
        title: 'Server Error | ShadowHub',
        message,
        backUrl: '/',
        ownerName: process.env.OWNER_NAME,
        ownerNumber: process.env.OWNER_NUMBER
    });
});

// ========== START SERVER ==========
async function start() {
    // Initialize plugin loader (non-blocking)
    try {
        pluginLoader = new PluginLoader(app, db);
        // Don't await - let server start even if plugins fail
        pluginLoader.init().catch(err => {
            console.error('[PluginLoader] Init error:', err.message);
        });
    } catch (err) {
        console.error('[PluginLoader] Setup error:', err.message);
    }

    // Bind to 0.0.0.0 for Render/Railway
    const server = app.listen(PORT, HOST, () => {
        console.log(`
╔════════════════════════════════════════════╗
║         🌑 ShadowHub Started 🌑           ║
╠════════════════════════════════════════════╣
║ 📍 Host: ${HOST}                          ║
║ 📍 Port: ${PORT}                          ║
║ ⚡ Environment: ${process.env.NODE_ENV || 'production'} ║
║ 🗄️  Database: JSON (Primary)              ║
║ 🔌 Plugins: ${pluginLoader ? 'Loading...' : 'Disabled'} ║
╠════════════════════════════════════════════╣
║         ✅ READY FOR DEPLOY ✅            ║
╚════════════════════════════════════════════╝

👑 Owner: ${process.env.OWNER_NAME}
🔥 ${process.env.OWNER_TAGLINE || 'Abdullah Is onFire 🔥'}
📞 ${process.env.OWNER_NUMBER}
🔐 Admin: /admin/login
🧩 Plugins: /plugins
🏥 Health: /health

⎯ʏᴏᴜ ᴀʀᴇ ᴍʏ ʙᴇsᴛ ғʀɪᴇɴᴅ, ᴍʏ ʜᴜᴍᴀɴ ᴅɪᴀʀʏ, ᴀɴᴅ ᴍʏ ᴏᴛʜᴇʀ ʜᴀʟғ𓄹ꠂ🫶🏻🐣🌷♡゙𓂃
        `);
    });
    // Handle server errors
    server.on('error', (err) => {
        console.error('[Server] Error:', err.message);
        if (err.code === 'EADDRINUSE') {
            console.log('[Server] Port in use, retrying...');
            setTimeout(() => server.listen(PORT, HOST), 1000);
        }
        process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('[Server] SIGTERM received, shutting down...');
        server.close(() => {
            console.log('[Server] Closed');
            process.exit(0);
        });
    });

    // Prevent unhandled rejections from crashing
    process.on('unhandledRejection', (reason, promise) => {
        console.error('[Unhandled Rejection]', reason);
        // Don't exit - keep server running
    });

    process.on('uncaughtException', (err) => {
        console.error('[Uncaught Exception]', err);
        // Don't exit on plugin errors
        if (err.message.includes('plugin') || err.message.includes('Plugin')) {
            return;
        }
        process.exit(1);
    });
}

// Start
start().catch(err => {
    console.error('[Startup] Fatal:', err);
    process.exit(1);
});

module.exports = app;
