const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const router = express.Router();

// Admin login (simple password from .env)
router.get('/login', (req, res) => {
    res.render('admin/login', { title: 'Admin Login | ShadowHub' });
});

router.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.user = {
            id: 'admin',
            username: 'admin',
            role: 'admin',
            name: process.env.OWNER_NAME
        };
        return res.redirect('/admin');
    }
    res.render('admin/login', {
        title: 'Admin Login | ShadowHub',
        error: 'Incorrect password'
    });
});

// Admin dashboard
router.get('/', async (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }

    try {
        const users = await req.db.findAll('users');
        const plugins = await req.db.findAll('plugins');
        
        res.render('admin/dashboard', {
            title: 'Admin Dashboard | ShadowHub',
            user: req.session.user,
            stats: {
                users: users.length,
                plugins: plugins.length,
                uptime: process.uptime()
            }
        });
    } catch (err) {
        next(err);
    }
});
// Plugin management
router.get('/plugins', async (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/admin/login');
    }

    try {
        const plugins = await req.db.findAll('plugins');
        res.render('admin/plugins', {
            title: 'Manage Plugins | ShadowHub',
            plugins
        });
    } catch (err) {
        next(err);
    }
});

// Enable/Disable plugin
router.post('/plugins/:id/toggle', async (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const { id } = req.params;
        const { enabled } = req.body;
        
        const plugin = await req.db.findOne('plugins', p => p.id === id);
        if (!plugin) return res.status(404).json({ error: 'Plugin not found' });

        // Update manifest file
        const manifestPath = path.join(process.cwd(), 'plugins', plugin.pluginId, 'plugin.json');
        if (await fs.pathExists(manifestPath)) {
            const manifest = await fs.readJSON(manifestPath);
            manifest.enabled = enabled === 'true';
            await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
        }

        // Update DB
        await req.db.update('plugins', id, { enabled: enabled === 'true' });
        
        res.json({ success: true, plugin: { id, enabled: enabled === 'true' } });
    } catch (err) {
        next(err);
    }
});

// Delete plugin
router.delete('/plugins/:id', async (req, res, next) => {    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const { id } = req.params;
        const plugin = await req.db.findOne('plugins', p => p.id === id);
        if (!plugin) return res.status(404).json({ error: 'Plugin not found' });

        // Remove from DB
        await req.db.delete('plugins', id);
        
        // Remove folder (optional - keep for safety)
        // await fs.remove(path.join(process.cwd(), 'plugins', plugin.pluginId));
        
        res.json({ success: true, message: 'Plugin disabled' });
    } catch (err) {
        next(err);
    }
});

// Upload new plugin (zip or folder)
router.post('/plugins/upload', async (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    // Implementation for file upload would go here
    // For now, we rely on manual plugin folder creation
    res.json({ success: true, message: 'Upload via plugins/ folder' });
});

module.exports = router;
