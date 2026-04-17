module.exports = (app, db, manifest) => {
    const express = require('express');
    const router = express.Router();
    const path = require('path');
    
    // Serve plugin static files
    router.use(express.static(path.join(__dirname, 'public')));
    
    // Plugin home
    router.get('/', (req, res) => {
        res.render('plugins/example-downloader/view', {
            title: manifest.name + ' | ShadowHub',
            plugin: manifest,
            pluginStyles: '<link rel="stylesheet" href="/plugins/downloader/style.css">',
            pluginScripts: '<script src="/plugins/downloader/script.js"></script>'
        });
    });
    
    // Download endpoint
    router.post('/download', async (req, res) => {
        const { url, format } = req.body;
        // Actual download logic would go here
        res.json({
            success: true,
            message: `Would download: ${url} as ${format}`,
            // In production: return download URL or file stream
        });
    });
    
    return router;
};
