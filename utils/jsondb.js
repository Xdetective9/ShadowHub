const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class JSONDB {
    constructor(filePath, defaultData = {}) {
        this.filePath = path.join(process.cwd(), 'data', filePath);
        this.defaultData = defaultData;
        this.locked = false;
        this.init();
    }

    async init() {
        await fs.ensureDir(path.dirname(this.filePath));
        if (!await fs.pathExists(this.filePath)) {
            await fs.writeJSON(this.filePath, this.defaultData, { spaces: 2 });
        }
    }

    async lock() {
        while (this.locked) {
            await new Promise(res => setTimeout(res, 50));
        }
        this.locked = true;
    }

    unlock() {
        this.locked = false;
    }

    async read() {
        await this.lock();
        try {
            const data = await fs.readJSON(this.filePath);
            return data;
        } catch (err) {
            console.error(`[JSONDB] Read error: ${err.message}`);
            return this.defaultData;
        } finally {
            this.unlock();
        }
    }

    async write(data) {
        await this.lock();
        try {
            await fs.writeJSON(this.filePath, data, { spaces: 2 });
            return true;
        } catch (err) {
            console.error(`[JSONDB] Write error: ${err.message}`);            return false;
        } finally {
            this.unlock();
        }
    }

    async get(key, defaultValue = null) {
        const data = await this.read();
        return data[key] !== undefined ? data[key] : defaultValue;
    }

    async set(key, value) {
        const data = await this.read();
        data[key] = value;
        return await this.write(data);
    }

    async push(key, item) {
        const data = await this.read();
        if (!Array.isArray(data[key])) data[key] = [];
        const id = uuidv4().slice(0, 8);
        const newItem = { id, ...item, createdAt: new Date().toISOString() };
        data[key].push(newItem);
        await this.write(data);
        return newItem;
    }

    async update(key, id, updates) {
        const data = await this.read();
        if (!Array.isArray(data[key])) return false;
        const index = data[key].findIndex(item => item.id === id);
        if (index === -1) return false;
        data[key][index] = { ...data[key][index], ...updates, updatedAt: new Date().toISOString() };
        return await this.write(data);
    }

    async delete(key, id) {
        const data = await this.read();
        if (!Array.isArray(data[key])) return false;
        const filtered = data[key].filter(item => item.id !== id);
        if (filtered.length === data[key].length) return false;
        data[key] = filtered;
        return await this.write(data);
    }

    async findAll(key, filterFn = null) {
        const data = await this.read();
        const items = Array.isArray(data[key]) ? data[key] : [];
        return filterFn ? items.filter(filterFn) : items;
    }
    async findOne(key, filterFn) {
        const items = await this.findAll(key);
        return items.find(filterFn) || null;
    }
}

module.exports = JSONDB;
