const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class Auth {
    constructor(db) {
        this.db = db;
    }

    async hashPassword(password) {
        return await bcrypt.hash(password, 12);
    }

    async verifyPassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    async createUser(username, password, role = 'user') {
        const existing = await this.db.findOne('users', u => u.username === username);
        if (existing) return { error: 'Username already exists' };

        const hashed = await this.hashPassword(password);
        const user = await this.db.push('users', {
            username,
            password: hashed,
            role,
            createdAt: new Date().toISOString()
        });

        // Remove password from return
        const { password: _, ...safeUser } = user;
        return { user: safeUser };
    }

    async authenticate(username, password) {
        const user = await this.db.findOne('users', u => u.username === username);
        if (!user) return { error: 'Invalid credentials' };

        const valid = await this.verifyPassword(password, user.password);
        if (!valid) return { error: 'Invalid credentials' };

        const { password: _, ...safeUser } = user;
        return { user: safeUser };
    }

    async isAdmin(userId) {
        const user = await this.db.get('users', userId);
        return user?.role === 'admin';
    }

    middleware() {
        return (req, res, next) => {
            if (req.session.user) {
                res.locals.user = req.session.user;
            }
            next();
        };
    }

    requireAuth() {
        return (req, res, next) => {
            if (!req.session.user) {
                return res.redirect('/auth/login');
            }
            next();
        };
    }

    requireAdmin() {
        return (req, res, next) => {
            if (!req.session.user || req.session.user.role !== 'admin') {
                return res.redirect('/auth/login');
            }
            next();
        };
    }
}

module.exports = Auth;
