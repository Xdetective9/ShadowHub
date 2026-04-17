const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('index', {
        title: 'Home | ShadowHub',
        ownerName: process.env.OWNER_NAME || 'Abdullah',
        ownerNumber: process.env.OWNER_NUMBER || '+923288055104',
        ownerTagline: process.env.OWNER_TAGLINE || 'Abdullah Is onFire 🔥'
    });
});

router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        node: process.version,
        platform: process.platform
    });
});

router.get('/plugins', async (req, res, next) => {
    try {
        const plugins = await req.db.findAll('plugins');
        res.render('plugins/index', {
            title: 'Plugins | ShadowHub',
            plugins: plugins.map(p => ({
                ...p,
                url: p.route
            }))
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
