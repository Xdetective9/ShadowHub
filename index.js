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
const PORT = process.env.PORT || 10000;

// ========== DATABASE ==========
const JSONDB = require('./utils/jsonDB');
const db = new JSONDB('main.json', { users: [], plugins: [] });

// ========== AUTH ==========
const Auth = require('./config/auth');
const auth = new Auth(db);

// ========== PLUGIN LOADER ==========
const PluginLoader = require('./config/pluginLoader');
const pluginLoader = new PluginLoader(app, db);

// ========== MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: false // Allow inline styles for EJS
}));
app.use(cors());
app.use(morgan('tiny'));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
const sessionStore = process.env.DATABASE_URL 
    ? new (require('connect-pg-simple')(session))({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true    })
    : new session.MemoryStore();

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'shadowhub-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production' && process.env.RENDER !== undefined,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// Auth middleware
app.use(auth.middleware());

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Make db and auth available to routes
app.use((req, res, next) => {
    req.db = db;
    req.auth = auth;
    req.pluginLoader = pluginLoader;
    next();
});

// ========== ROUTES ==========
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/plugins', require('./routes/plugins'));

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Not Found | ShadowHub',
        message: 'The page you are looking for does not exist.',
        backUrl: req.get('Referrer') || '/'
    });
});

// Error handler
app.use((err, req, res, next) => {    console.error('[Error]', err.stack);
    res.status(500).render('error', {
        title: 'Server Error | ShadowHub',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        backUrl: '/'
    });
});

// ========== START SERVER ==========
async function start() {
    // Initialize plugin loader
    await pluginLoader.init();
    
    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════╗
║         🌑 ShadowHub Started 🌑           ║
╠════════════════════════════════════════════╣
║ 📍 Port: ${PORT}                          ║
║ ⚡ Environment: ${process.env.NODE_ENV || 'production'} ║
║ 🗄️  Database: JSON (Primary)              ║
╠════════════════════════════════════════════╣
║         ✅ ALL SYSTEMS GO ✅              ║
╚════════════════════════════════════════════╝

👑 Owner: ${process.env.OWNER_NAME}
🔥 ${process.env.OWNER_TAGLINE}
📞 ${process.env.OWNER_NUMBER}
🔐 Admin: /admin/login
🧩 Plugins: /plugins
🏥 Health: /health

⎯ʏᴏᴜ ᴀʀᴇ ᴍʏ ʙᴇsᴛ ғʀɪᴇɴᴅ, ᴍʏ ʜᴜᴍᴀɴ ᴅɪᴀʀʏ, ᴀɴᴅ ᴍʏ ᴏᴛʜᴇʀ ʜᴀʟғ𓄹ꠂ🫶🏻🐣🌷♡゙𓂃
        `);
    });
}

start().catch(console.error);

module.exports = app;
