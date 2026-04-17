const express = require('express');
const path = require('path');
const router = express.Router();

// Catch-all for plugin routes - handled by pluginLoader
router.use('*', (req, res, next) => {
    // Plugins are mounted directly by pluginLoader at /plugins/:id
    // This route is a fallback for 404
    next();
});

module.exports = router;
