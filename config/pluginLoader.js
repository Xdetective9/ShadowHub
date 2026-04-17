const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const { v4: uuidv4 } = require('uuid');

class PluginLoader {
    constructor(app, db) {
        this.app = app;
        this.db = db;
        this.plugins = new Map();
        this.pluginsPath = path.join(process.cwd(), 'plugins');
    }

    async init() {
        await fs.ensureDir(this.pluginsPath);
        await this.loadAllPlugins();
        this.watchPlugins();
        console.log(`[PluginLoader] Initialized - watching ${this.pluginsPath}`);
    }

    async loadAllPlugins() {
        const dirs = await fs.readdir(this.pluginsPath);
        for (const dir of dirs) {
            const pluginPath = path.join(this.pluginsPath, dir);
            if (await fs.stat(pluginPath).then(s => s.isDirectory())) {
                await this.loadPlugin(dir);
            }
        }
    }

    async loadPlugin(pluginId) {
        try {
            const pluginPath = path.join(this.pluginsPath, pluginId);
            const manifestPath = path.join(pluginPath, 'plugin.json');
            
            if (!await fs.pathExists(manifestPath)) {
                console.warn(`[PluginLoader] Skip ${pluginId}: no plugin.json`);
                return null;
            }

            const manifest = await fs.readJSON(manifestPath);
            if (!manifest.enabled) {
                console.log(`[PluginLoader] Disabled: ${manifest.name}`);
                return null;
            }

            // Load plugin routes
            const routeFile = path.join(pluginPath, 'index.js');
            if (await fs.pathExists(routeFile)) {
                const pluginModule = require(routeFile);                if (typeof pluginModule === 'function') {
                    // Mount at /plugins/{id}
                    this.app.use(`/plugins/${pluginId}`, pluginModule(this.app, this.db, manifest));
                    console.log(`[PluginLoader] ✓ Loaded: ${manifest.name} v${manifest.version}`);
                }
            }

            // Register in DB
            const existing = await this.db.findOne('plugins', p => p.pluginId === pluginId);
            if (!existing) {
                await this.db.push('plugins', {
                    pluginId,
                    name: manifest.name,
                    version: manifest.version,
                    description: manifest.description,
                    author: manifest.author,
                    icon: manifest.icon || '🧩',
                    enabled: true,
                    route: `/plugins/${pluginId}`,
                    settings: manifest.settings || {}
                });
            }

            this.plugins.set(pluginId, { manifest, path: pluginPath });
            return { manifest, path: pluginPath };

        } catch (err) {
            console.error(`[PluginLoader] Error loading ${pluginId}:`, err.message);
            return null;
        }
    }

    async unloadPlugin(pluginId) {
        // Note: In production, unloading requires server restart
        // For now, we just remove from memory & DB
        this.plugins.delete(pluginId);
        await this.db.delete('plugins', pluginId);
        console.log(`[PluginLoader] Unloaded: ${pluginId}`);
    }

    watchPlugins() {
        const watcher = chokidar.watch(this.pluginsPath, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true
        });

        watcher.on('addDir', async (pluginPath) => {
            const pluginId = path.basename(pluginPath);
            if (await fs.pathExists(path.join(pluginPath, 'plugin.json'))) {                console.log(`[PluginLoader] New plugin detected: ${pluginId}`);
                await this.loadPlugin(pluginId);
            }
        });

        watcher.on('change', async (filePath) => {
            if (path.basename(filePath) === 'plugin.json') {
                const pluginId = path.basename(path.dirname(filePath));
                console.log(`[PluginLoader] Config changed: ${pluginId}`);
                await this.loadPlugin(pluginId);
            }
        });

        watcher.on('unlinkDir', async (pluginPath) => {
            const pluginId = path.basename(pluginPath);
            console.log(`[PluginLoader] Plugin removed: ${pluginId}`);
            await this.unloadPlugin(pluginId);
        });
    }

    getAllPlugins() {
        return Array.from(this.plugins.values()).map(p => p.manifest);
    }

    getPlugin(pluginId) {
        return this.plugins.get(pluginId) || null;
    }
}

module.exports = PluginLoader;
